# Submission readiness

Team: Zenith. Representative: Vincent Banda. Member: Madalitso Ritchie.

## Verified implementation

- Hosted frontend and HTTPS API respond.
- PayPal Sandbox authentication, invoice listing, transaction search and the
  registered webhook configuration returned successful responses.
- Firebase signed identity, merchant isolation, viewer write denial and
  administrator reads were tested against the deployment.
- OpenAI Responses API returned a completed answer; the application's assistant
  endpoint returned a nonempty dashboard answer, no write proposals and the
  approval-required flag.
- Elasticsearch search endpoint returned HTTP 200 over verified TLS and denied
  anonymous access. No existing transactions were present at backfill time.
- Automated backend, client and isolated browser tests are included. Browser
  tests use synthetic fixtures and do not prove live PayPal write execution.

## Required submission gates

- [ ] Publish the complete repository and verify GitHub detects the root MIT license.
- [ ] Run the included checks against the published revision.
- [ ] Verify a dedicated judge login against the hosted UI and provide its
      credentials in private testing instructions, not public source.
- [ ] Demonstrate a successful sandbox write through proposal and approval.
- [ ] Join the event on Devpost as the authorized team representative.
- [ ] Add team members and confirm all eligibility, ownership and permissions.
- [ ] Record a functional demo below three minutes and upload it publicly to YouTube.
- [ ] Enter the video URL, demo URL, source URL, description, tools and testing instructions.
- [ ] Review the exact final submission and accept the event agreements.
- [ ] Confirm submission receipt before the deadline.

## Event timing and rules checked on 12 November 2026

The published submission deadline is 12 November 2026 at 12:00 p.m. PST, which
is 10:00 p.m. Africa/Johannesburg time. The published judging period ends
15 December 2026 at 8:00 a.m. PST. Keep the demo and required access available
through that period. A final eligibility decision belongs to the organizers.

Sources: https://paypalaihackathon.devpost.com/rules and
https://paypalaihackathon.devpost.com/.

The representative must confirm team authority and rule compliance. The
repository does not publish ages, passwords, private keys or private testing
credentials. Optional delivery integrations remain clearly identified as
unconfigured; their completion is not required for the core PayPal + AI entry.
