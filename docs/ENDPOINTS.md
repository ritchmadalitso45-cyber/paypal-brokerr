# Endpoint reference

Generated from the FastAPI application schema. See `openapi.json` for full request and response definitions.

Base path: `https://broker.95.111.247.118.sslip.io`. Protected endpoints use a Firebase ID token in `Authorization: Bearer <token>`; trusted server clients can use configured service keys. Never put a service key in frontend code.

Administrator-only writes are additionally checked by the server. Proposal creation does not execute a payment action; approval is separate. Use `Idempotency-Key` on proposal/sync endpoints where the schema requires it. Unknown write outcomes need reconciliation.

| Method | Path | Purpose | Authentication |
| --- | --- | --- | --- |
| GET | `/health/live` | Live | Public/provider verification |
| GET | `/health/ready` | Ready | Public/provider verification |
| GET | `/api/v1/openapi.json` | Openapi | Bearer token |
| GET | `/api/v1/integrations` | Integrations | Bearer token |
| GET | `/api/v1/dashboard` | Summary | Bearer token |
| GET | `/api/v1/session` | Session | Bearer token |
| GET | `/api/v1/operations` | Operations | Bearer token |
| GET | `/api/v1/invoices` | Invoices | Bearer token |
| POST | `/api/v1/invoices` | Create Invoice | Bearer token |
| GET | `/api/v1/invoices/{invoice_id}` | Invoice | Bearer token |
| POST | `/api/v1/invoices/{invoice_id}/send` | Send Invoice | Bearer token |
| POST | `/api/v1/invoices/{invoice_id}/reminders` | Reminder | Bearer token |
| GET | `/api/v1/operations/{operation_id}` | Operation | Bearer token |
| POST | `/api/v1/operations/{operation_id}/approve` | Approve | Bearer token |
| POST | `/api/v1/operations/{operation_id}/reconcile` | Reconcile | Bearer token |
| GET | `/api/v1/transactions` | Transactions | Bearer token |
| GET | `/api/v1/transactions/search` | Search | Bearer token |
| GET | `/api/v1/transactions/{transaction_id}` | Transaction | Bearer token |
| GET | `/api/v1/alerts` | Alerts | Bearer token |
| GET | `/api/v1/subscriptions/{subscription_id}` | Subscription | Bearer token |
| POST | `/api/v1/subscriptions/{subscription_id}/actions` | Subscription Action | Bearer token |
| GET | `/api/v1/disputes` | Disputes | Bearer token |
| POST | `/api/v1/sync` | Sync | Bearer token |
| POST | `/api/v1/overdue/scan` | Overdue Scan | Bearer token |
| GET | `/api/v1/jobs/{job_id}` | Job Status | Bearer token |
| GET | `/api/v1/workflows` | Workflows | Bearer token |
| POST | `/api/v1/workflows` | Workflow | Bearer token |
| DELETE | `/api/v1/workflows/{workflow_id}` | Delete Workflow | Bearer token |
| GET | `/api/v1/audit` | Audit | Bearer token |
| POST | `/api/v1/agent/chat` | Agent Chat | Bearer token |
| GET | `/api/v1/events` | Events | Bearer token |
| POST | `/api/v1/webhooks/paypal` | Webhook | Public/provider verification |

## Common responses

- `401`: missing, invalid, expired or revoked identity; sign in again.
- `403`: insufficient role, wrong merchant or unverified email.
- `404`: requested resource not found.
- `409`: stale, expired, already claimed or uncertain operation; inspect its state.
- `422`: request validation failed.
- `429`: rate limit; honor `Retry-After`.
- `502` / `503`: provider unavailable or configuration/dependency problem.

## Roles and side effects

Read endpoints require merchant membership. Mutation endpoints such as proposals, approvals, synchronization, workflow changes and reconciliation require an administrator. The assistant exposes proposal tools only to administrators. `/api/v1/webhooks/paypal` authenticates PayPal through provider signature verification rather than a Firebase bearer token.

Search uses Elasticsearch. The paginated transaction list uses SQL and is separate from search. Currency totals must not be combined. Workflow configuration does not automatically connect an external account.

Consult the schema for required headers, pagination limits and typed request bodies.
