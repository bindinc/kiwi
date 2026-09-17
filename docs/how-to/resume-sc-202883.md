# Resume SC-202883 implementation

Checkpoint: 17 September 2026, end-of-day pause requested for 16:58 Europe/Amsterdam.

## Agreed scope

Implement backend roles **and customer/bank editing** in this iteration. Employee-level
mandant access from Entra app roles is deferred; do not require unprovisioned mandant
roles. Admin, supervisor and user can perform business mutations. View is read-only;
dev alone has no business access. Existing feedback permissions stay separate.

New Subscription API writes must remain disabled until the supplier confirms and
contract tests prove atomic stale-write rejection. Bank deletion additionally needs
an atomic current-link check. A local lock, refetch or environment switch is insufficient.
No merge, preview rollout or production activation has been performed.

## Branches and verified work

1. `/home/bartdeijkers/_worktrees/enforce-entra-roles-and-mandant-authorization`
   - Branch: `codex/enforce-server-side-entra-role-authorization`
   - Draft PR: https://github.com/bindinc/kiwi/pull/117
   - Commit: `511581d`.
   - Verified ID-token authorization context, expiry on requests, default-deny API
     policies/voter, service write guards, CSRF, exact role values and protected legacy paths.
   - PHP: 244 tests / 1765 assertions. JavaScript: 32 tests. Guardrails and container lint passed.
2. `/home/bartdeijkers/_worktrees/add-protected-customer-and-bank-editing`
   - Branch: `codex/add-protected-customer-and-bank-editing`, based on PR 117.
   - Preparatory checkpoint only: operation/content-type contract, unconditional
     upstream-write gate and server-reported capabilities in Subscription API detail responses.
   - PHP: 287 tests / 1919 assertions. Container lint passed.
   - The guard has no write transport. It is preparation, not a completed editing implementation.

## Next implementation steps

1. Review PR 117, including all indirect write paths and queued-operation execution.
   Authorization expiry is stored in subscription queue payloads, but an external worker
   still needs verified enforcement before starting execution. No worker is present here.
2. Implement explicit section routes and independently authorized application services;
   add every route to `ApiRoutePolicy` and KIWI OpenAPI. Require verified customer and
   subresource identity, configured source credentials, strict field allowlists and CSRF.
3. Add durable audit intent and shared PostgreSQL mutation/idempotency records; refuse
   writes if audit storage fails, distinguish unknown outcomes, never automatically retry
   an uncertain mutation. Do not log tokens, full IBANs or whole customer payloads.
4. Add person/address/email/landline/mobile editors without conflating first name and
   initials. Support multiple contacts through explicit selection. Add bank create/update/
   delete UI with masking and confirmation, IBAN country-length/checksum and BIC validation.
   No opt-ins, mandate editing or subscription relinking. Reload confirmed source data.
5. Add denial, forged-object, audit-failure, timeout and concurrency acceptance tests.
   Keep all new source mutations gated until independently proven supplier guarantees.
6. Complete Compose fallback login, three-node Flux/kind multi-replica validation and
   controlled Entra preview validation. These are NOT yet passed.

## Local validation notes

- Isolated PostgreSQL container: `kiwi-entra-auth-tests`, localhost port 55439,
  database/user `kiwi`/`postgres`, local trust authentication. Preserve until deliberate cleanup.
- Test command from either worktree:

  ```sh
  SESSION_DB_HOST=127.0.0.1 SESSION_DB_PORT=55439 SESSION_DB_NAME=kiwi \
  SESSION_DB_USER=postgres SESSION_DB_PASSWORD='' SESSION_DB_SSLMODE=disable php bin/phpunit
  ```

- Test logs: `/tmp/kiwi-roles-full.log`, `/tmp/kiwi-roles-js.log`,
  `/tmp/kiwi-roles-guardrail.log`, `/tmp/kiwi-editing-full.log`.
- Isolated Compose build succeeded. Smoke at port 8543 failed because Keycloak advertises
  fixed port 8443 in `docker-compose.yaml`. Make advertised hostname configurable and validate
  fallback realm redirects before rerunning. `/tmp/kiwi-role-compose.log` holds the failure.
  The smoke script removed its own test stack; the pre-existing stack was untouched.
- `docker-desktop` Kubernetes context was unreachable at localhost:54939. No cluster changes.
- Source API contract: `/home/bartdeijkers/subscription-api-docs.json`. No conditional-version
  headers documented. IBAN schema contains IBAN/BIC but no resource identity: never infer IDs
  from array position. Missing link information must make bank deletion unavailable.
- Shortcut MCP restored. Story https://app.shortcut.com/bindincit/story/202883 has no extra
  feedback as of this checkpoint. Existing custom workflow has no `Gestart - Vandaag` lane;
  retain its active `Codex in Progress` state instead of silently moving workflows.
