# PayPal Broker

**Tagline:** Understand what is owed. Review what happens next.

**Team:** Zenith
**Representative:** Vincent Banda
**Member:** Madalitso Ritchie
**Platform:** Desktop and responsive web application
**Demo:** https://paypal-brokerr.vercel.app/
**Source:** https://github.com/ritchmadalitso45-cyber/paypal-brokerr

## Inspiration

Small-business owners often spend time moving between invoices, account activity,
customer follow-ups and spreadsheets. A conversational assistant can make that
work easier, but payment actions need clear boundaries. PayPal Broker combines
an operational dashboard with an assistant that reads actual connected records
and proposes follow-ups for a person to review.

## What it does

PayPal Broker connects a business to PayPal Sandbox. It provides invoice and
transaction views, overdue invoice tracking, totals separated by currency,
screening alerts, and a conversational payment assistant. An owner can ask about
the records or request a reminder draft. The assistant uses bounded tools to
retrieve business facts and creates a proposal rather than sending a message.

The approval screen shows the exact action and payload. A business administrator
must approve the proposal before the backend makes a PayPal write request.
Invoices can also be created as drafts through an approved operation. Sending
an invoice is a separate proposal. Uncertain provider outcomes are held for
manual reconciliation instead of being blindly retried.

The live application uses Firebase authentication, server-managed merchant
membership and administrator/viewer roles. Elasticsearch supports authenticated
transaction search. PostgreSQL stores business records, operations, durable jobs
and audit events; the background worker handles synchronization and indexing.

## How we built it

The React/Vite frontend calls a Python FastAPI application using Firebase ID
tokens. The server verifies token signatures and revocation, checks verified
email and signed merchant claims, validates requests with Pydantic, and stores
records through SQLAlchemy. Alembic manages database migrations.

The assistant calls the OpenAI Responses API using `gpt-6-luna` in the current
deployment. Its tools expose bounded dashboard, invoice, transaction and alert
reads, plus a reminder-proposal action for administrators. It has no approval
tool. The prompt treats customer records as untrusted input and requires tools
for financial facts. Model responses can still be wrong; users review the exact
proposal before action.

The frontend is hosted on Vercel. The API, worker, PostgreSQL, Redis and private
Elasticsearch service run on Contabo. HTTPS protects the public API and private
search connection. Private keys and provider credentials stay on the server.

## Tools and their actual use

| Tool | Use |
| --- | --- |
| PayPal Sandbox REST APIs | Invoice retrieval, invoice creation/send/reminder operations, transaction reporting, and registered webhook verification |
| OpenAI Responses API / GPT-6 Luna | Business-data questions, bounded tool calls, and reminder proposals |
| Elasticsearch | Private, authenticated transaction indexing and search |
| Firebase Authentication / Admin SDK | Sign-in, email verification, revoked-session checks, signed roles and merchant membership |
| React / Vite | Responsive dashboard and explicit approval interface |
| FastAPI / Python / Pydantic | Validated endpoints and provider orchestration |
| PostgreSQL / SQLAlchemy / Alembic | Persistent business state, audit events, jobs and migrations |
| Redis | Shared rate-limit infrastructure |
| Docker Compose / Caddy / Contabo | Separate application services and HTTPS deployment |
| Vercel | Frontend hosting |
| pytest / Playwright / Node test runner / Ruff / ESLint | Backend, client and browser verification |

Slack, Zapier and CRM delivery adapters are present, but their destination
accounts are not connected in the current deployment. They are not claimed as
completed integrations. AG Grid, APIMatic, Astropods, Bryntum, Channel3, KERNEL,
Postman and Render are not claimed as used.

## Challenges and decisions

Payment writes can succeed even when a network response is lost. We therefore
separate proposals from approvals and preserve uncertain operations for manual
reconciliation. Repeated reminder execution is constrained by a cooldown and
canonical provider checks. Authorization belongs to the server rather than a
client-selected account role. Multi-currency totals stay separate.

## Progress during the hackathon

The starting repository contained a React dashboard. During the submission
period it was extended with the Python backend, real API client, Firebase
server-side authorization, payment proposal/approval flow, durable jobs,
OpenAI tool integration, private search, deployment and tests. The repository
commit history and the validation notes provide evidence of this integration
work. We do not claim third-party infrastructure or libraries as original work.

## Current limits and next steps

This deployment is one merchant per backend and uses PayPal Sandbox only. It
does not initiate payouts, discover all subscriptions, match bank statements,
or export PDF invoices. Screening alerts are rules-based review signals, not
proof of fraud. Search is a single-node rebuildable index rather than a highly
available cluster. The assistant reads bounded result sets and questions are
independent. Automatic reminders remain disabled.

Next steps include multi-merchant isolation, individual-user audit attribution,
connected external workflow destinations, stronger operational monitoring and
broader real sandbox lifecycle coverage. Production payment use requires a
separate review and live-provider configuration.

## Project ownership and attribution

Original project code is released by Team Zenith under the MIT license.
Third-party libraries retain their licenses. PayPal, OpenAI, Firebase and other
product names identify integrations and do not imply endorsement. The demo
should use original narration and screen footage, with no background music or
third-party promotional material.
