# Demo recording plan — target 2 minutes 40 seconds

Record the working hosted application in a desktop browser. Sign in before
recording. Hide browser bookmarks, personal tabs, passwords, service dashboards
and notifications. Do not use mock responses or the isolated browser-test
harness as evidence of live payment functionality. Use sandbox data only.

| Time | Screen/action | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Dashboard, project name | “Small-business owners lose time checking invoices and following up on payments. We are Team Zenith, and this is PayPal Broker.” |
| 0:15–0:35 | Connected integrations and PayPal Sandbox indicator | “The application connects to PayPal Sandbox, with a Python backend and authenticated business access. These are connected records, not simulated revenue cards.” |
| 0:35–1:00 | Invoices and transactions | “Owners can inspect invoices and account activity, with totals kept separate by currency. An empty account is shown honestly; new sandbox invoices can be created through approval.” |
| 1:00–1:30 | Assistant: “Use the dashboard tool to summarize my connected records.” | “The OpenAI assistant calls tools to retrieve financial facts. It can explain what it finds, including when data is missing.” |
| 1:30–2:05 | For an unpaid sandbox invoice, ask for a reminder; open Approvals | “The assistant can draft a reminder, but it cannot approve or send it. The owner reviews the exact recipient, invoice and message before choosing whether to approve.” |
| 2:05–2:25 | Approve only a prepared sandbox action; inspect actual result | “The backend executes approved requests through PayPal. Uncertain outcomes require reconciliation instead of a blind retry.” |
| 2:25–2:40 | Dashboard/architecture closing | “PayPal Broker turns payment administration into a reviewable workflow: understand the records, decide what to do, and keep the business owner in control.” |

If no unpaid sandbox invoice has been prepared, replace the reminder section
with the real draft-invoice creation proposal and approval flow. Do not narrate
an unperformed reminder or claim a payment occurred. Leave enough time to show
an actual successful provider operation before the closing.

## Upload details

- Suggested title: **PayPal Broker — Team Zenith | PayPal AI Hackathon Demo**
- Description: “A working PayPal Sandbox payment operations assistant by Team
  Zenith. Python/FastAPI, React, Firebase, OpenAI and Elasticsearch. Source:
  https://github.com/ritchmadalitso45-cyber/paypal-brokerr. Application:
  https://paypal-brokerr.vercel.app/. Independent prototype; not an official
  PayPal product. Sandbox only; no real payments.”
- Visibility: Public, as required by the event.
- Keep the final exported video below 3:00.
- Use original narration. Do not add unlicensed music, stock footage or sponsor
  logos. Review any visible third-party marks against the event's rules.

A script is not a submitted demo video. The recording, public YouTube upload,
and final URL must be completed before submission.
