# Customer session outbox (SC-202851)

The session outbox groups supported business changes for one canonical customer and tenant. Each save starts a 60-second window. Reopening pauses the complete session; only explicit Resume starts another window. Contributors can manage the shared session; only supervisors and administrators can cancel it.

## Deployment

Run `php bin/console app:outbox-sessions:migrate` once before deploying the new writers and UI together. The migration is additive and serialized with a database advisory lock. Historical subscription orders are retained as read-only records. Do not mix old and new writers during deployment.

Set `KIWI_OUTBOX_ACCEPT_WRITES=0` to stop new writes and claims during rollback. Retain the session tables and do not restore direct writers while pending sessions exist. Production delivery is a separate acceptance gate: SC-187756 must provide a worker with current authorization and upstream version checks. This change does not enable blocked source mutations.

## HTTP contract

`GET /api/v1/outbox-sessions` returns a visibility-filtered list with pagination. Detail is available at `/{id}`. POST actions `reopen`, `pause`, `resume`, `cancel` require `Idempotency-Key` and `X-Kiwi-Outbox-Revision`. Business forms use their existing endpoints and return a provisional result plus `outbox` metadata.

Writes require an idempotency key. `X-Kiwi-Outbox-Id`, `X-Kiwi-Outbox-Revision` and `X-Kiwi-Change-Id` identify corrections. A new contributor may append a validated change but cannot read or correct the shared session before becoming a contributor. Revision conflicts preserve the browser input; reload before explicitly reapplying.

## Worker contract v1

`SessionConsumer::claim()` atomically freezes and claims one ready session. Earlier sessions for the same customer must be completed or cancelled. The envelope includes tenant, canonical customer reference and ordered changes with stable per-change idempotency keys.

`consume()` requires a verifier and a sender supplied by the worker. The verifier must recheck current permissions, source versions and dependencies for every step. Expired authorization fails closed. A step intent is persisted before sending; ambiguous outcomes stop the session in `uncertain`. A crashed `processing` session requires reconciliation, not automatic replay. No cross-system atomicity is promised. There is no production sender in this repository.

## Acceptance

Verify role and tenant isolation, concurrent saves and claims, deadline boundaries, browser restoration, migration repeatability, immutable snapshots, idempotent retries and source mutations remaining blocked. Run PHP and frontend tests plus local Compose OIDC and customer-session smoke checks. Report external delivery separately from queue acceptance.
