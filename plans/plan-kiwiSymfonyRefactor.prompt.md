# Plan: Kiwi Symfony Refactor — Top 3 Improvements

**TL;DR** — Three structural issues stand out after the migration: a 1213-line God service class, volatile file-based session storage in a multi-pod Kubernetes deployment, and a predictable `APP_SECRET` used in production due to missing k8s secret injection. None require touching the readonly `bink8s-cluster-management` repo.

---

## Issue 1 — `PocStateService` God Class (1213 lines, 52 methods)

**Problem**: A single class owns 10+ distinct domains simultaneously (customers, contact history, delivery remarks, call queue, call sessions, disposition, subscriptions, winback, article orders, deceased handling). This puts 52 method signatures in a reader's working memory before understanding any one domain. It also means every API controller depends on one enormous service, making individual features hard to test or reason about in isolation.

**Approach**: Decompose into three domain-focused services + one shared state accessor, in parallel:

### Steps

1. Extract `src/Repository/SessionStateRepository.php` — wraps the single-key session blob (`kiwi_poc_state`). Owns: `getState()`, `saveState()`, `resetState()`, `deepCopyDefaultState()`, `loadDefaultState()`, `nextCounter()`, `utcNowIso()`, `utcTodayIso()`, `currentTimestampMs()`. All 3 new services inject this.

2. Extract `src/Service/CustomerService.php` — owns the 10 customer-domain methods: `searchCustomers`, `createCustomer`, `getCustomer`, `getCustomerState`, `replaceCustomers`, `updateCustomer`, `getContactHistory`, `createContactHistoryEntry`, `updateDeliveryRemarks`, `createEditorialComplaint`. Also owns the private `findCustomerIndex`, `readCustomerFromState`, `createCustomerInState`, `replaceCustomerInState`, `appendContactHistory`, `sortAndFilterCustomers`, `paginate` helpers. *(parallel with step 3, 4)*

3. Extract `src/Service/CallService.php` — owns the 13 call-domain methods: all `getCallQueue`/`writeCallQueue`/`clearCallQueue`/`generateDebugQueue`/`acceptNextCall`/`getCallSessionSnapshot`/`writeCallSession`/`startDebugCall`/`identifyCaller`/`holdCall`/`resumeCall`/`endCall`/`saveDisposition`. Owns private `getCallQueueFromState`, `defaultCallQueue`, `getCallSessionFromState`, `defaultCallSession`, `buildQueueEntry` helpers. *(parallel with steps 2, 4)*

4. Extract `src/Service/SubscriptionService.php` — owns: `updateSubscription`, `createSubscriptionComplaint`, `completeWinback`, `processDeceasedActions`, `completeRestitutionTransfer`, `createSubscriptionSignup`, `getArticleOrders`, `createArticleOrder`. Owns private `findSubscriptionIndex`, `findSubscriptionLocation`, `parseRolePayload`, `resolveExistingRolePerson`, `buildSignupHistoryEntries` helpers. *(parallel with steps 2, 3)*

5. Update all `src/Controller/Api/*` controllers — replace single `PocStateService $state` constructor arg with the relevant focused service(s). Most controllers will inject exactly one domain service.

6. Delete `src/Service/PocStateService.php` once all controllers are migrated.

7. Update `tests/` — each new service is independently unit-testable; update `PocStateService` test stubs to target the three new services.

### Relevant files
- `src/Service/PocStateService.php` — source of truth for splitting; delete at end
- `src/Controller/Api/AbstractApiController.php` — base class for all API controllers; will need injection updates
- `config/services.yaml` — autowiring covers new services automatically; no changes needed
- `tests/Unit/` — add per-service unit tests

---

## Issue 2 — Volatile `/tmp` Session Storage in a Multi-Pod Cluster

**Problem**: Sessions live in `/tmp/kiwi-sessions` inside each pod. With 2 production replicas per track and `ClientIP` session affinity, a pod restart silently destroys every session on that pod. For a call-center tool where agents are mid-call, this is a data-loss scenario. The `kiwi-postgres` cluster (3-instance HA, already running) is never used by the app despite being provisioned exclusively for kiwi.

**Recommendation**: Migrate to `PdoSessionHandler` backed by the existing PostgreSQL cluster. This also clears the way for proper domain entities later.

### Steps

1. Add `doctrine/dbal` to `composer.json` (`composer require doctrine/dbal`). DBAL is sufficient for `PdoSessionHandler` without needing full Doctrine ORM.

2. Add `SESSION_DSN` to `.env` as a documented placeholder:
   ```
   SESSION_DSN=pgsql://user:password@localhost:5432/kiwi
   ```

3. Update `config/packages/framework.yaml` to replace file session handler with PdoSessionHandler:
   - Remove `save_path: '/tmp/kiwi-sessions'`
   - Add `handler_id: 'Symfony\Component\HttpFoundation\Session\Storage\Handler\PdoSessionHandler'`
   - Wire `Symfony\Component\HttpFoundation\Session\Storage\Handler\PdoSessionHandler` as a service with `dsn: '%env(SESSION_DSN)%'`

4. Remove stale `session.save_path` from `infra/docker/app/php.ini` to avoid confusion.

5. Update `docker-compose.yaml` to pass `SESSION_DSN` from a local `.env.local` override (document in README that local dev requires a local PostgreSQL or use SQLite DSN for simplicity).

6. Document the required k8s environment variable in `README.md` under a "Required Secrets / Env Vars" section:
   - `SESSION_DSN` must be injected by the cluster operator via the `kiwi-db-rw` k8s secret that already exists in the `kiwi` namespace.

### Note
The bink8s-cluster-management k8s deployments must have `SESSION_DSN` added — this is in the readonly repo and must be done by the cluster operator as a follow-up. The kiwi side documents this dependency clearly.

---

## Issue 3 — `APP_SECRET` Uses Dev Placeholder in Production

**Problem**: `.env` sets `APP_SECRET=local-dev-placeholder-not-a-real-secret`. No Kubernetes secret overrides this. Symfony uses `APP_SECRET` to sign sessions and CSRF tokens — a predictable value means an attacker who knows the secret can forge signed session cookies. This is an OWASP A02 (Cryptographic Failures) risk.

### Steps

1. Add a `StartupSecurityCheck` kernel event subscriber in `src/EventSubscriber/StartupSecurityCheck.php` that:
   - Listens on `KernelEvents::REQUEST` (first request only, using a static flag)
   - If `APP_SECRET` equals the known placeholder string AND `APP_ENV=prod`, logs a `CRITICAL` level message via the injected `LoggerInterface`: *"APP_SECRET is set to the development placeholder — sessions are cryptographically insecure"*
   - Does NOT throw or crash; just warns loudly so it appears in monitoring

2. Add a `bin/console app:check-secrets` command (or extend `make guardrail`) that exits non-zero when `APP_SECRET` is the placeholder in prod env. Wire this into the CI/CD build check step.

3. Document in `README.md` under a new "Security: Required Secrets" section:
   - `APP_SECRET` must be a random 32+ byte hex string, injected by the cluster operator as a Kubernetes secret and overriding the `.env` default
   - The k8s Deployment patch in bink8s must add an env var from a new secret (cluster operator action, not in this repo)

4. Rotate the existing placeholder: generate a secure value (`bin/console secret:generate-keys` or `openssl rand -hex 32`) and document as the `.env.local` requirement for local dev.

---

## Relevant files (all issues)
- `src/Service/PocStateService.php` — split this
- `src/Controller/Api/AbstractApiController.php` — update injections
- `config/packages/framework.yaml` — session handler
- `infra/docker/app/php.ini` — remove stale session.save_path
- `docker-compose.yaml` — add SESSION_DSN
- `.env` — add SESSION_DSN placeholder, document APP_SECRET
- `README.md` — required env/secret documentation
- `composer.json` — add doctrine/dbal

## Verification
1. `make phpunit` passes after service split — zero test regressions
2. `make js-test` still green (no frontend impact)
3. `make guardrail` + `make compose-smoke-oidc` passes end-to-end with PdoSessionHandler wired
4. A pod restart in local docker-desktop (kill + recreate the app container) no longer drops the session
5. `APP_SECRET=local-dev-placeholder-not-a-real-secret APP_ENV=prod php bin/console cache:clear` triggers the CRITICAL log warning

## Decisions & constraints
- `bink8s-cluster-management` is readonly; Issues 2 and 3 each require a follow-up operator action there (inject `SESSION_DSN` and `APP_SECRET` via new k8s secrets). The kiwi repo can only document these dependencies and add guard-rails.
- Issue 1 keeps the session-backed approach for now; DB migration (Doctrine entities, migrations) is a Phase 2 that becomes much easier once the domain services have clean boundaries.
- No Doctrine ORM added yet — `doctrine/dbal` only, scoped to `PdoSessionHandler`. ORM is a separate decision.
