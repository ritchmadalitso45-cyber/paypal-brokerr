# Private search deployment

Search runs on the existing Contabo server as a single-node Elasticsearch service.
It is a rebuildable search index; PostgreSQL remains the source of truth. A single
node does not provide high availability.

`provision_search.py` is a one-time provisioning script for `/opt/paypal-broker`.
It refuses to overwrite an existing Compose override. It creates a private CA,
a server certificate, an authenticated index, and an API key limited to the
`copilot-transactions` index. It does not publish ports 9200 or 9300.

The service has a 2 GB memory limit and 1 GB JVM heap. The generated
`compose.override.yaml` is loaded automatically by `docker compose`. Keep this
file with deployment backups. The API and worker trust the search CA through a
bundle that also includes the normal public certificate authorities. Certificate
verification remains enabled for all providers.

Private files, excluded from Git:

- `.elastic.env`: Elasticsearch administrator bootstrap password.
- `.env`: scoped application API key and search URL.
- `elastic-certs/`: CA and server certificates/private keys.
- `secrets/search-trust.pem`: public trust bundle mounted read-only.

The server certificate expires one year after provisioning. Renew it before
expiry using the existing CA and the DNS names in `server.ext`, then restart
Elasticsearch. Protect and back up the CA key. Never replace it casually: clients
trust the installed CA bundle.

Run `verify_search.py` inside the API container to backfill existing SQL
transactions and verify the authenticated search endpoint. This script does not
create synthetic financial records. New synchronized transactions are indexed by
the durable background worker. If the search volume is lost, recreate the index
and backfill from PostgreSQL.

## External delivery connections

Slack, Zapier and CRM delivery require real destination accounts and their HTTPS
webhook addresses. Store those addresses only in the server's private `.env` as
`SLACK_WEBHOOK_URL`, `ZAPIER_WEBHOOK_URL`, and `CRM_WEBHOOK_URL`. Create explicit
workflow subscriptions for supported events after connecting each destination.
Treat webhook addresses as credentials. Do not commit them or expose them to
the frontend. Receivers must deduplicate `event_id` because delivery is at least
once. An account alone does not complete a delivery integration.

Automatic payment reminders are a separate setting and remain disabled unless
explicitly enabled for the intended invoice workflow.
