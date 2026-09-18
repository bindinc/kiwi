# SC-202883 implementation and activation status

Updated: 18 September 2026. Both PRs are drafts; no merge or deployment has occurred.

## Scope

Backend roles and customer/bank editing are included. Employee-level mandant visibility
through Entra roles is deferred. Admin, supervisor and user may perform business writes;
view is read-only and dev alone has no business access. Existing feedback access is separate.
All configured source credentials remain available to the business read roles. Source
customer division and resource ownership must still match the selected configured context.

## Review branches

- PR 117: https://github.com/bindinc/kiwi/pull/117
  - Branch `codex/enforce-server-side-entra-role-authorization`
  - Worktree `/home/bartdeijkers/_worktrees/enforce-entra-roles-and-mandant-authorization`
  - Verified ID-token context, role and expiry enforcement, explicit route policies,
    service guards, CSRF and protected legacy paths. Local IPv6 proxy callback fix included.
- PR 119: https://github.com/bindinc/kiwi/pull/119
  - Branch `codex/add-protected-customer-and-bank-editing`
  - Worktree `/home/bartdeijkers/_worktrees/add-protected-customer-and-bank-editing`
  - Includes the prerequisites from PR 117; rebase after PR 117 merges.
  - Section routes, role-protected services, strict fields, IBAN/BIC validation, explicit
    source IDs, masked bank views, confirmation, endpoint-specific write contracts,
    shared audit/duplicate detection and independent server write gates.

## What remains blocked before activation

1. **Supplier contract:** the supplied `/home/bartdeijkers/subscription-api-docs.json`
   does not specify an atomic stale-write condition. `CustomerMutationPolicy` deliberately
   rejects every new mutation. `verifiedVersionCondition()` cannot return any header.
   There is no runtime flag to activate writes. Do not guess an `If-Match` contract.
   Implement the confirmed condition and independent-client concurrency tests in PR 3.
2. **Bank deletion:** source link completeness and an atomic current-link guard are not
   confirmed. `verifySubresource()` refuses every bank deletion. Banks without a returned
   resource ID remain read-only; array indices never become source IDs.
3. **Distributed acceptance:** the `docker-desktop` context at localhost:54939 is unreachable
   and no three-node kind cluster is currently available. Flux bootstrap, multiple app
   replicas, cross-replica sessions and simultaneous source writes are not validated.
4. **Preview Entra:** controlled preview accounts/data and deployment acceptance remain
   outstanding. Production activation is a separate approval.
5. **External subscription worker:** queue payloads now contain immutable authorization
   expiry, but execution-time expiry enforcement must be verified in the external worker.
   No external worker implementation is present in this repository. Do not claim this
   dispatch acceptance criterion is complete.

## Current validation evidence

- PR 117 PHP suite: 244 tests / 1765 assertions passed before final issuer hardening;
  the updated OIDC test file passed 28 tests, and the combined suite below includes it.
- PR 119 PHP suite: 366 tests / 2114 assertions passed, including endpoint, validation,
  resource ownership, audit-outage and duplicate-detection cases.
- Frontend suite: 69 tests passed. Guardrails and Symfony container lint passed.
- Strengthened Docker Compose fallback smoke passed, including HTTPS callback origin,
  application prefix, local role claims and PostgreSQL session storage.
- Actual browser login passed for admin, supervisor, user, view, dev and the no-role account.
  Admin/supervisor/user source writes return 409 while gated. View reads return 200 and
  writes return 403. Dev business reads and writes return 403. No-role business access
  returns 403. Missing CSRF returns 403, including for admin.
- Separate PostgreSQL connections verified durable intent and duplicate rejection after
  an unknown outcome. This is not proof of atomic source concurrency across replicas.
- Desktop (1280px) and narrow (390px) UI reviewed with explicitly synthetic data, including
  masked banks and disabled writes. No horizontal overflow. These are component reviews,
  not a successful live source-editing acceptance test.
- Shortcut file upload could not access the browser tool's local screenshot paths. Images
  remain under `/home/bartdeijkers/kiwi/.playwright-mcp/`, untracked and outside the PR.

## API and storage contract

`GET /api/v1/persons/{personId}/editing?credentialKey=...` returns fields grouped by person,
address, email, landline, mobile and bank, explicit source IDs, masked account labels,
server capabilities and a currently unavailable version. Contact lists do not silently
select the first item.

Mutation routes are `PATCH .../profile`, `PATCH .../addresses/{resourceId}`,
`PATCH .../emails/{resourceId}`, `PATCH .../phones/{resourceId}`,
`PATCH .../mobiles/{resourceId}`, and `POST/PATCH/DELETE .../bank-accounts[/{resourceId}]`.
They require `application/json`, session CSRF and a UUID `Idempotency-Key`. The body accepts
only `credentialKey`, `expectedVersion` and `changes`. Field lists and errors appear in
KIWI OpenAPI. The general legacy customer PATCH cannot modify source customers.

Provision the ledger with `php bin/console app:customer-mutations:bootstrap` before any
future activation. Provisioning does not enable writes. Intent is inserted and committed
before source access, using a unique actor/request key shared by all replicas. Only actor,
configured context, object IDs, operation, field names, time, correlation and outcome are
stored. No field values, full IBANs or tokens. Any duplicate is rejected, including after
an uncertain outcome. A failed audit result write leaves the original intent and continues
to prevent replay. Source transport does not retry or follow redirects.

The supplier activation PR must exercise success, conflict, definitive rejection, timeout,
audit failure, simultaneous replicas and an independent upstream writer against the actual
contract. None of those tests may weaken the default server gate to simulate acceptance.

## Local resources

- Isolated test PostgreSQL: `kiwi-entra-auth-tests`, localhost:55439, database `kiwi`, user
  `postgres`, local trust authentication. Preserve until deliberate cleanup.
- Run the PHP suite with the synthetic test database:

  ```sh
  SESSION_DB_HOST=127.0.0.1 SESSION_DB_PORT=55439 SESSION_DB_NAME=kiwi \
  SESSION_DB_USER=postgres SESSION_DB_PASSWORD='' SESSION_DB_SSLMODE=disable php bin/phpunit
  ```

- Logs: `/tmp/kiwi-role-sep18-tests.log`, `/tmp/kiwi-editing-sep18-tests.log`,
  `/tmp/kiwi-editing-sep18-js.log`, `/tmp/kiwi-editing-sep18-guardrail.log`,
  `/tmp/kiwi-editing-compose-final.log`.
- Isolated Compose project `kiwi-sc202883-editing` uses the default local port 8443. Its smoke
  cleans up only its own stack. The previously existing `sc200162selection` stack is untouched.
- Local Docker IPv6 required the Compose proxy fix. Production must explicitly configure
  `TRUSTED_PROXIES` for actual ingress peers before deployment; defaults trust loopback only.
- Shortcut story: https://app.shortcut.com/bindincit/story/202883. The story remains in its
  existing active custom workflow, which has no `Gestart - Vandaag` state.
