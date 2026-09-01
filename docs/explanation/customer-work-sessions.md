# Customer work sessions

Kiwi keeps one explicit customer work session in the browser. This is the
working context for one active customer and is deliberately separate from the
OIDC login, the telephony call session, and the PostgreSQL-backed Symfony
session. Ending a customer work session therefore never logs the agent out or
ends an active call.

The browser owns this context because consecutive requests can reach different
Kiwi replicas. No replica may infer the active customer from pod-local or
server-side session state.

## Customer reference and request context

The customer work session uses one customer reference throughout client state,
API requests, queued subscription payloads, and audit records:

- `personId`
- `credentialKey`
- `sourceSystem`
- `divisionId`
- `mandant`

The work session also has a random `workflowSessionId` and an increasing
`contextGeneration`. Customer-bound API requests carry these values in the
`X-Kiwi-Workflow-Session-Id`, `X-Kiwi-Context-Generation`, and
`X-Kiwi-Customer-*` headers. Subscription queue requests persist the same data
under `customerContext` so the queued operation remains attributable after the
browser request has ended.

## Lifecycle and concurrency

Opening a search result starts a provisional selection. The customer only
becomes active after its detail response is accepted. While the first detail
request is pending, a newer selection supersedes it and aborts the earlier
request where possible. Every response is also checked against the workflow
session, generation, and full customer reference before it can update state.
This check is the correctness boundary; request cancellation is only an
optimization.

Once confirmed, an active customer cannot be silently replaced. The agent must
use **New customer / end customer work session** before opening a different
primary customer. Recipient and requester/payer selections remain independent
roles and never replace the active customer.

A customer reset clears customer details, caches, search filters and results,
offers, recipient/requester selections, form drafts, queued-status UI, and
open reads. It leaves authentication and telephony state intact.

## Queue acceptance and mutation safety

HTTP 202 means that Kiwi accepted the subscription request into its queue; it
does not mean downstream processing has completed. The confirmation therefore
shows the recipient and requester/payer and asks the agent to continue with the
same customer or end the customer work session.

Each logical request keeps one stable `submissionId`. If the POST response is
ambiguous, Kiwi checks the queue by that submission ID. A found order resolves
the request as queued; a definite 404 resolves it as not queued; an unavailable
status endpoint keeps the mutation unresolved and blocks customer reset. The
database uniqueness constraint and transactional order/outbox write continue
to guarantee one order and one outbox event for retries with the same ID.

## Audit records

The backend writes audit events in the same request that searches for or opens
customer data, rather than relying on a separate client logging call. The
recorded actions are:

- `CUSTOMER_SEARCH_PERFORMED`
- `CUSTOMER_PROFILE_OPENED`
- `CUSTOMER_SESSION_RESET`

Every record contains a UTC timestamp, the authenticated OIDC identity, result,
workflow session and generation, server-generated request ID, and the customer
reference when one is known. Search audit metadata stores only filter field
names and the result count; raw names, addresses, telephone numbers, email
addresses, and other entered search values are not retained.

Audit records are stored in `customer_audit_events`. Access is limited to the
application database role and explicitly authorized database operators; they
are not exposed through a browser API. The configured retention period is 365
days. Run the following command from the application runtime as a scheduled
maintenance task:

```bash
php bin/console app:customer-audit:cleanup
```

The command deletes records older than the configured retention boundary. The
cluster configuration schedules this command and uses the same CloudNativePG
RW service as the application.

## Availability boundary

The work session remains client-owned when requests move between three Kiwi
replicas with `sessionAffinity: None`. Kubernetes startup, readiness, and
liveness probes determine which pods receive traffic, and topology constraints
spread replicas over the available nodes. Temporary application or PostgreSQL
failures may surface as retryable errors, but must never replace the active
customer, apply a stale response, or generate a second mutation identity.
