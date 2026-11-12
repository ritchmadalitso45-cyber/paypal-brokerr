"""Run on the VPS after uploading tested source. Never print credentials."""
import secrets
from pathlib import Path

root = Path('/opt/paypal-broker').resolve()
assert str(root) == '/opt/paypal-broker'
config = root / 'deploy/contabo'
(config / 'secrets').mkdir(mode=0o750, parents=True, exist_ok=True)
environment = config / '.env'
if not environment.exists():
    source = (config / '.env.example').read_text()
    for key in ['ADMIN_API_KEY', 'VIEWER_API_KEY', 'POSTGRES_PASSWORD']:
        source = source.replace(key + '=\n', key + '=' + secrets.token_urlsafe(48) + '\n')
    environment.write_text(source)
    environment.chmod(0o600)
print('Private environment prepared. Provider credentials remain operator-configured.')
