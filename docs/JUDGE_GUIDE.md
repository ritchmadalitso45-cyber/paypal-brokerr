# Run and evaluate PayPal Broker

## Hosted application

Open https://paypal-brokerr.vercel.app/ in a current desktop browser. A responsive
mobile layout is also included. The application is connected to PayPal Sandbox;
do not use it for live payments. The API is
https://broker.95.111.247.118.sslip.io.

The representative supplies a dedicated sandbox-merchant judge login in the
submission's private testing instructions. Use that login rather than creating
a new account: new registrations require verified email and explicit merchant
membership. No payment or subscription is required of judges. Credentials and
provider keys are deliberately absent from this public repository.

### Suggested evaluation

1. Sign in with the supplied judge account.
2. Open Dashboard, Invoices and Transactions. Empty views are legitimate for a
   new sandbox merchant; the application does not invent records.
3. Ask the assistant: “Use the dashboard tool to summarize my connected records.”
4. If an unpaid sandbox invoice is present, request a reminder draft. Open
   Approvals and review the exact message. A proposal does not send it.
5. To test invoice creation, enter a PayPal sandbox buyer email, USD, a due date,
   and a line item. Review the resulting proposal, then approve it. Creation
   produces a draft; sending is a separate approval.
6. Inspect operation results. Never retry an uncertain write blindly; use the
   reconciliation screen only after independently confirming the provider state.

Do not put real customer data into the shared sandbox demo. Financial facts sent
to the assistant are processed through the configured OpenAI API. AI answers may
be incorrect; inspect source records and action payloads before approval.

## Reproduce the backend independently

Prerequisites: Python 3.14 (the deployed and CI version), Node.js 24, Git, a PayPal
Sandbox REST application with Invoicing and Transaction Search permissions, and
an OpenAI API key with available credits and Responses access. Firebase is needed
for the browser login; backend-only evaluation can use generated service keys.

```bash
git clone https://github.com/ritchmadalitso45-cyber/paypal-brokerr.git
cd paypal-brokerr/backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
```

Copy `backend/.env.example` to `backend/.env`. Set:

```dotenv
ENVIRONMENT=development
DATABASE_URL=sqlite:///./copilot.db
ADMIN_API_KEY=<independent random value, at least 32 characters>
VIEWER_API_KEY=<different random value, at least 32 characters>
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=<your sandbox application client ID>
PAYPAL_CLIENT_SECRET=<your sandbox application secret>
PAYPAL_WEBHOOK_ID=<your registered sandbox webhook ID>
OPENAI_API_KEY=<your OpenAI key>
OPENAI_MODEL=gpt-6-luna
CORS_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=
FIREBASE_MERCHANT_ID=
FIREBASE_CREDENTIALS_FILE=
```

Generate each service key with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.
For backend-only evaluation leave all three Firebase settings blank. Redis and
Elasticsearch are optional in local development; transaction listing works
without search. External delivery connections are optional and should remain
blank unless an actual HTTPS receiving workflow exists.

From `backend/` run:

```bash
python -m alembic upgrade head
python -m uvicorn copilot.api:app --host 127.0.0.1 --port 8000
```

In a second activated terminal, from the same directory:

```bash
python -m copilot.worker
```

`GET http://127.0.0.1:8000/health/ready` should return `{"status":"ready"}`.
For protected requests send `Authorization: Bearer <ADMIN_API_KEY>` or the viewer
key. Service keys are for trusted terminal/server use, never browser variables.
Use `docs/openapi.json` for request/response schemas. Interactive Swagger UI is
not publicly exposed; the authenticated schema is `/api/v1/openapi.json`.

Examples using shell environment variables (PowerShell users can use
`Invoke-RestMethod` with the same JSON and headers):

```bash
export BROKER_TOKEN='<your locally generated admin key>'
curl http://127.0.0.1:8000/api/v1/integrations \
  -H "Authorization: Bearer $BROKER_TOKEN"
curl http://127.0.0.1:8000/api/v1/agent/chat \
  -H "Authorization: Bearer $BROKER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Use the dashboard tool to summarize my connected records."}'
```

## Run the browser frontend against your own backend

Create a Firebase project, enable Email/Password authentication, and authorize
`localhost` in Authentication settings. Save an Admin service-account JSON
outside the repository. Configure the backend with that project's ID,
`FIREBASE_MERCHANT_ID=paypal-broker`, and the service-account path, then restart it.
Never use the deployed project's Admin credentials for a local copy.

At the repository root:

```bash
npm ci
# Copy .env.example to .env.local and fill YOUR Firebase web settings.
# Set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Create your account in the application and follow the verification email. Copy
its UID from the access screen. From `backend/` with your environment active:

```bash
python -m copilot.grant_access YOUR_FIREBASE_UID admin
```

Sign out and back in. Your account now has access to your local merchant. Client
Firestore role fields never grant access. The supplied `firestore.rules` is a
profile-only proposal; review before applying it to an existing Firebase project.

## PayPal sandbox and webhooks

Use a PayPal Developer business sandbox account and REST app. Grant Invoicing
and Transaction Search. Register an HTTPS webhook ending in
`/api/v1/webhooks/paypal` with relevant invoice, capture and sale events; install
its ID in the backend environment. Local webhook testing needs an HTTPS tunnel
you control. The handler requires valid PayPal signature verification and
deduplicates received events. Registration alone does not prove event delivery.

Use a personal sandbox buyer for test invoices. No live credentials are needed.
Transaction reporting may lag newly created activity. Never substitute mock
data when claiming a live provider test passed.

## Verification commands

At the repository root:

```bash
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

Windows browser tests use installed Microsoft Edge. On Linux CI they use
Chromium. These browser tests use an isolated synthetic API harness, not live
payment responses. From `backend/`:

```bash
python -m pytest -q
python -m ruff check .
python -m alembic upgrade head
python -m alembic check
```

Provider access, email delivery and a full hosted browser session need separate
live verification. See `READINESS.md` for precisely what has been tested.

## Deployment and limits

See `deploy/contabo/` for the separate production stack and `SEARCH.md` for TLS
search setup. The Contabo deployment requires its documented existing edge
network; it is not a generic one-command VPS installer. `backend/compose.yaml`
provides a local service alternative. Production uses PostgreSQL and Redis;
SQLite is development-only. Search is single-node and rebuildable from SQL.

Keep the hosted demo online throughout judging. Do not publish sandbox
passwords, Firebase Admin JSON, webhook URLs, API keys, or judge credentials in
source, logs, screenshots or the public video.
