"""Provision private, TLS-protected search without publishing Elasticsearch ports."""
from pathlib import Path
import base64
import json
import os
import secrets
import subprocess
import time

root = Path('/opt/paypal-broker/deploy/contabo')
image = 'docker.elastic.co/elasticsearch/elasticsearch:9.5.6'

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def private_write(path, content):
    fd = os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)

os.chdir(root)
override = root / 'compose.override.yaml'
if override.exists():
    raise SystemExit('An override already exists; review before replacing it.')
certs = root / 'elastic-certs'
certs.mkdir(mode=0o750, exist_ok=True)
run(['openssl', 'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-days', '3650', '-subj', '/CN=PayPal Broker Search CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', str(certs/'ca.key'), '-out', str(certs/'ca.crt')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
run(['openssl', 'req', '-newkey', 'rsa:3072', '-nodes', '-subj', '/CN=elasticsearch', '-keyout', str(certs/'server.key'), '-out', str(certs/'server.csr')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
(certs/'server.ext').write_text('subjectAltName=DNS:elasticsearch,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n')
run(['openssl', 'x509', '-req', '-in', str(certs/'server.csr'), '-CA', str(certs/'ca.crt'), '-CAkey', str(certs/'ca.key'), '-CAcreateserial', '-out', str(certs/'server.crt'), '-days', '365', '-extfile', str(certs/'server.ext')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for name in ['server.key', 'server.crt', 'ca.crt']:
    os.chown(certs/name, 1000, 0)
    os.chmod(certs/name, 0o440)
os.chmod(certs/'ca.key', 0o600)
os.chmod(certs, 0o755)
password = secrets.token_urlsafe(48)
private_write(root/'.elastic.env', 'ELASTIC_PASSWORD='+password+'\n')
# Retain ordinary public CAs for PayPal, Firebase, OpenAI, and delivery destinations.
bundle = root/'secrets'/'search-trust.pem'
bundle.write_bytes(Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()+b'\n'+(certs/'ca.crt').read_bytes())
os.chmod(bundle, 0o444)
override.write_text('''services:
  elasticsearch:
    image: '''+image+'''
    restart: unless-stopped
    mem_limit: 2g
    cpus: 1.5
    env_file: .elastic.env
    environment:
      discovery.type: single-node
      cluster.name: paypal-broker-search
      xpack.license.self_generated.type: basic
      xpack.security.enabled: "true"
      xpack.security.http.ssl.enabled: "true"
      xpack.security.http.ssl.key: certs/server.key
      xpack.security.http.ssl.certificate: certs/server.crt
      xpack.security.http.ssl.certificate_authorities: certs/ca.crt
      ES_JAVA_OPTS: -Xms1g -Xmx1g
    volumes:
      - elastic-data:/usr/share/elasticsearch/data
      - ./elastic-certs/server.key:/usr/share/elasticsearch/config/certs/server.key:ro
      - ./elastic-certs/server.crt:/usr/share/elasticsearch/config/certs/server.crt:ro
      - ./elastic-certs/ca.crt:/usr/share/elasticsearch/config/certs/ca.crt:ro
    networks: [private]
    healthcheck:
      test: [CMD-SHELL, 'curl --silent --cacert config/certs/ca.crt https://localhost:9200 | grep -q missing']
      interval: 20s
      timeout: 10s
      retries: 15
    logging:
      driver: json-file
      options: {max-size: 5m, max-file: "3"}
  api:
    environment:
      SSL_CERT_FILE: /run/secrets/search-trust.pem
  worker:
    environment:
      SSL_CERT_FILE: /run/secrets/search-trust.pem
    volumes: ["./secrets/search-trust.pem:/run/secrets/search-trust.pem:ro"]
volumes:
  elastic-data:
''')
run(['docker', 'compose', 'up', '-d', 'elasticsearch'])

def request(method, path, body=None):
    credential = base64.b64encode(('elastic:'+password).encode()).decode()
    config = 'silent\nshow-error\nfail-with-body\ncacert = "config/certs/ca.crt"\nheader = "Authorization: Basic '+credential+'"\nheader = "Content-Type: application/json"\n'
    args = ['docker', 'compose', 'exec', '-T', 'elasticsearch', 'curl', '--config', '-', '-X', method, 'https://localhost:9200'+path]
    if body is not None:
        config += 'data = '+json.dumps(json.dumps(body))+'\n'
    result = subprocess.run(args, input=config, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Search request failed: '+str(result.returncode))
    return json.loads(result.stdout)

for attempt in range(90):
    try:
        request('GET', '/')
        break
    except (RuntimeError, json.JSONDecodeError):
        time.sleep(2)
else:
    raise SystemExit('Search did not become ready; existing API settings are unchanged.')
request('PUT', '/copilot-transactions', {'settings': {'number_of_shards': 1, 'number_of_replicas': 0}, 'mappings': {'properties': {'id': {'type': 'keyword'}, 'status': {'type': 'keyword'}, 'country': {'type': 'keyword'}, 'event_code': {'type': 'keyword'}}}})
key = request('POST', '/_security/api_key', {'name': 'paypal-broker-search', 'role_descriptors': {'broker': {'cluster': [], 'indices': [{'names': ['copilot-transactions'], 'privileges': ['read', 'index', 'view_index_metadata']}]}}})['encoded']
target = root/'.env'
values = {'ELASTIC_URL': 'https://elasticsearch:9200', 'ELASTIC_API_KEY': key}
lines = [line for line in target.read_text().splitlines() if line.partition('=')[0] not in values]
lines.extend(name+'='+value for name,value in values.items())
private_write(target, '\n'.join(lines)+'\n')
run(['docker', 'compose', 'up', '-d', 'api', 'worker'])
print('Private Elasticsearch provisioned; TLS and scoped API key configured.')
