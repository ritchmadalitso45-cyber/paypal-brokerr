import asyncio
import httpx
from sqlalchemy import select
from copilot.config import Settings
from copilot.database import Transaction, make_database
from copilot.providers import Connectors

async def main():
    settings = Settings()
    engine, sessions = make_database(settings.database_url)
    count = 0
    async with httpx.AsyncClient(timeout=30) as client:
        connectors = Connectors(settings, client)
        with sessions() as db:
            for row in db.scalars(select(Transaction).execution_options(yield_per=100)):
                await connectors.index_transaction({
                    'id': row.id, 'status': row.status, 'amount': str(row.amount),
                    'currency': row.currency, 'country': row.country,
                    'event_code': row.event_code,
                    'occurred_at': row.occurred_at.isoformat() + 'Z'})
                count += 1
        print('Existing transactions indexed:', count)
        headers = {'Authorization': 'Bearer ' + settings.admin_api_key.get_secret_value()}
        for name, url, params in [
            ('Search endpoint', '/api/v1/transactions/search', {'q': 'completed'}),
            ('Readiness', '/health/ready', None),
            ('Integrations', '/api/v1/integrations', None),
        ]:
            response = await client.get('http://127.0.0.1:8000'+url, params=params, headers=headers)
            print(name+': HTTP', response.status_code)
            if name == 'Integrations' and response.is_success:
                print(response.json())
        anonymous = await client.get(settings.elastic_url)
        print('Search denies anonymous access:', anonymous.status_code == 401)
        print('PayPal TLS:', (await client.get('https://api-m.sandbox.paypal.com/')).status_code)
    engine.dispose()

asyncio.run(main())
