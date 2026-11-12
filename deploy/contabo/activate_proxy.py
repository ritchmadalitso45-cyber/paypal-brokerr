"""Add PayPal Broker routing while retaining the existing Maso route."""
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

target = Path('/opt/maso/deploy/oracle/Caddyfile')
fragment = Path('/opt/paypal-broker/deploy/contabo/Caddyfile.fragment').read_text()
original = target.read_text()
if 'broker.95.111.247.118.sslip.io' not in original:
    backup = target.with_name('Caddyfile.before-paypal-broker-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    shutil.copy2(target, backup)
    target.write_text(original.rstrip() + '\n\n' + fragment)
    try:
        subprocess.run(['docker', 'exec', 'oracle-https-1', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile'], check=True)
        subprocess.run(['docker', 'exec', 'oracle-https-1', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile'], check=True)
    except Exception:
        target.write_text(original)
        raise
print('PayPal Broker hostname attached to the existing HTTPS proxy.')
