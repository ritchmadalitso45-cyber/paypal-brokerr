# PayPal Broker

**Team Zenith — Vincent Banda (representative) and Madalitso Ritchie.**

An independent small-business payment operations assistant built around PayPal Sandbox and OpenAI. This is a hackathon prototype, not an official PayPal product.

- [Hosted application](https://paypal-brokerr.vercel.app/)
- [Complete setup and judge instructions](docs/JUDGE_GUIDE.md)
- [Project description and tools](docs/SUBMISSION.md)
- [API reference](docs/ENDPOINTS.md) and [OpenAPI schema](docs/openapi.json)
- [Demo video script](docs/DEMO_SCRIPT.md)
- [Verified capabilities and remaining submission steps](docs/READINESS.md)
- [MIT license](LICENSE)

Integrated React/Firebase frontend and Python payment operations service. The backend is included under `backend/`; this project is independent of Gridform.

## Connected functionality

Firebase sign-in, signup, email verification, password reset and refresh; server-verified Firebase ID tokens, merchant membership and roles; currency-separated dashboard; paginated transactions/invoices; CSV page export; screening alerts; invoice/reminder/send proposals; exact-action review and approval; uncertain-outcome reconciliation; conversational assistant; workflows; known-ID subscription retrieval/actions and dispute listing. Loading, empty, access-denied, configuration and failure states replace simulated payment data.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill Firebase public web configuration and API URL.
npm run dev
```

Vercel's existing Firebase web settings can be retained. Set `VITE_API_BASE_URL=https://broker.95.111.247.118.sslip.io`, without `/api/v1`. Never place service keys or Firebase Admin private keys in Vite variables.

For Python, create a virtual environment and install `backend/requirements.lock`. Configure `backend/.env` from its example. From `backend/`, run `python -m alembic upgrade head`, `python -m uvicorn copilot.api:app --port 8000` and, in another terminal, `python -m copilot.worker`. SQLite is development-only; production requires PostgreSQL/Redis.

## Firebase permissions

New accounts must verify their email and receive merchant access from a trusted operator. Client-selected roles and Firestore profile fields never authorize financial access. The server requires `FIREBASE_PROJECT_ID=brokerr-5ba5c`, `FIREBASE_MERCHANT_ID=paypal-broker`, and Firebase Admin credentials via `FIREBASE_CREDENTIALS_FILE` or Application Default Credentials.

From a trusted backend environment:

```bash
python -m copilot.grant_access USER_UID admin
python -m copilot.grant_access USER_UID viewer
python -m copilot.grant_access USER_UID revoke
```

This manages signed `broker_role`/`broker_merchant_id` claims, preserves unrelated claims and revokes earlier sessions. Users must sign in again. Existing self-selected admin profiles are not automatically promoted. Enable email/password authentication, allow the frontend domain and configure verification/reset templates in Firebase.

`firestore.rules` is a proposed profile-only ruleset. The supplied repository contained no rules file. Review against the current console rules before deploying; existing rules are not overwritten automatically. Financial data is stored in backend SQL.

## Contabo

Host: `95.111.247.118`. Application: `/opt/paypal-broker`. API hostname: `https://broker.95.111.247.118.sslip.io`. This uses a separate Compose stack and the existing Caddy edge network, retaining Maso's existing route. SQL and Redis have no public port bindings.

```bash
cd /opt/paypal-broker
python3 deploy/contabo/prepare_server.py
cd deploy/contabo
docker compose up -d --build
# After readiness succeeds:
python3 /opt/paypal-broker/deploy/contabo/activate_proxy.py
```

Private settings are in `deploy/contabo/.env`. The proxy script backs up and validates Caddy configuration before reloading. Migrations precede API/worker startup; persistent volumes and restart policies survive restarts. The hostname relies on sslip.io; replace it with an owned domain when available.

Place the Firebase service account at `deploy/contabo/secrets/firebase-admin.json`, grant read access to the API container's application user with appropriately restricted host permissions, and set `FIREBASE_CREDENTIALS_FILE=/run/secrets/firebase-admin.json`. Never commit this file. Restart the API after configuring it. The worker needs no Firebase permissions.

Configure PayPal sandbox credentials, webhook ID and reporting permission. Listener: `https://broker.95.111.247.118.sslip.io/api/v1/webhooks/paypal`. Configure OpenAI key/model for chat. Elastic and HTTPS workflow destinations are optional. Do not reuse Maso application credentials. Without provider credentials, integrations report unavailable and never fabricate financial data. API readiness checks SQL/cache, not live providers or worker availability.

## Checks

```bash
npm test
npm run lint
npm run build
npm run test:browser
cd backend
python -m pytest -q
python -m ruff check .
python -m alembic upgrade head
python -m alembic check
```

Browser tests use isolated synthetic API responses. No authentication bypass ships in the app. Firebase verification is mocked in unit tests; live validation requires configured credentials and a verified assigned account.

One merchant per backend remains the isolation boundary. No payout initiation, bank-statement matching, device-login screening, subscription discovery, alert dismissal or PDF-export workflow is implied. Those unsupported demo buttons were removed. Automatic reminders remain off unless the operator enables them. Service audit actors currently identify roles rather than individual users.
