# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [unreleased]

### Added
- Add a reusable Subscription API personsearch client on top of `ppa_base_url` that reuses the existing HUP/WebAbo bearer-token flow, including retry-on-`401` behavior, so the later KIWI customer-search migration can switch to the upstream backend in phases.
- Add a multi-credential Subscription API personsearch service that fans out searches only over HUP credentials with `client_search: "yes"` and merges those credential-scoped result sets for KIWI customer search.
- Add a personsearch result normalizer that maps subscription API search hits onto the KIWI person model, including credential context, badge-ready mandant resolution, and empty KIWI collections for fields that will be hydrated in later phases.
- Add an aggregated `/api/v1/persons` search path that merges normalized Subscription API personsearch results across eligible credentials while keeping the existing frontend request shape intact.
- Add a subscription-api detail hydration path for `GET /api/v1/persons/{id}` that loads `/public/persons/{personid}` with explicit credential context and maps the upstream person payload back onto the KIWI customer model.
- Add subscription-api order hydration for selected customers so `GET /api/v1/persons/{id}` enriches the detail response with `/public/orders?customerPersonId=...` results instead of loading subscriptions during search.

### Changed
- Parse mandant and person-lookup metadata from named HUP credentials, expose that context on Webabo offer responses, and carry the same credential context through subscription queue payloads so upcoming API-backed person retrieval can switch over without another contract change.
- Render AVROTROS and KRO-NCRV logo badges for werfsleutels and subscription person lookups based on HUP credential `client` metadata, while keeping `client_search` available for the later full API-backed person lookup flow.
- Let subscription person badges prefer `divisionId` when available and otherwise fall back to `mandant`, while preserving the existing HMC -> AVROTROS and KRONCRV -> KRO-NCRV branding rules.
- Switch `GET /api/v1/persons` to the new subscription-api aggregator when searchable HUP credentials are configured, while keeping a local cached-result fallback for customer selection until the dedicated detail hydration route lands in the next phase.
- Keep subscription-api customers readonly in unsupported detail actions by hiding legacy edit/editorial buttons and blocking customer edits, article orders, and delivery-remark mutations while those data domains still lack upstream API coverage.
- Carry a selected subscription-api person's hydrated snapshot through the subscription workflow so queued requests stay stateless, preserve credential context, and can reuse the selected customer's primary IBAN when it is already available via `ppa_base_url`.

### Fixed
- Keep `Klant Zoeken` working when the upstream `personsearch` endpoint returns `HTTP 500` for `divisionid`-filtered requests by searching each enabled credential without that broken filter and still returning partial results when one credential fails.
- Preserve badge and workflow mandant context from the configured HUP credential even when upstream search results expose numeric `divisionId` codes instead of the expected brand keys.
- Show the same AVROTROS and KRO-NCRV mandant badges in the regular `Klant Zoeken` result list that subscription role search results already render.
- Keep subscription-api customer selection stateless by letting the detailcall carry `credentialKey` and merge hydrated detail fields with the cached search result instead of depending on pod-local lookup state.
- Keep subscription-api customer detail usable when order enrichment fails by returning the hydrated person data with an empty `subscriptions` list instead of failing the whole selection flow.

## [v1.0.14]

### Changed
- Let the HUP/Webabo integration read named credential sets from `hup.credentials`, keep legacy single-credential config as a fallback, sync werfsleutel offers by looping over every configured credential, and persist each offer's `credentialKey` so queued subscription requests can reuse the matching credential downstream.
- Drive subscription channel combinations from Webabo `GET /offers/salescodecombinations` per cached offer credential/product and let agents add multiple subscriptions or memberships in one signup flow.
- Refine the werfsleutel selection cards so completed items no longer show a redundant `Compleet` badge and title, remove the extra success toast on offer selection, and align price, sales code, and channel badges more consistently across multiple selections.

### Fixed
- Prefer HUP password credentials over cached refresh tokens when acquiring access tokens, so named credential sets recover more reliably after token expiry.

## [v1.0.13]

### Fixed
- Make `/app-logout` explicitly reject `GET` requests with `405 Method Not Allowed` and `Allow: POST`, while keeping the CSRF-protected `POST` logout flow intact.

## [v1.0.12]

### Added
- Add the `sc-187755` queue-first subscription ordering flow with PostgreSQL-backed `subscription_orders` and `outbox_events`, idempotency on `submissionId`, order status lookup endpoints, and a frontend queue infobox.
- Add a dedicated subscription queue display formatter plus PHPUnit and frontend coverage so queued order summaries render consistently across the workflow UI.

### Changed
- Normalize subscription signup payloads into explicit recipient, requester, offer, subscription, and contact-entry snapshots before queueing, so downstream processing and status views can rely on a stable queued contract.
- Refine the queue infobox layout and queued-order summary rendering so agent, requester, recipient, and offer details stay readable during the subscription workflow.

## [v1.0.11]

### Added
- Add a Webabo-backed offer cache flow with a dedicated HUP token provider, Doctrine cache entity/repository, and the `app:webabo:sync-offers` console command so Kiwi can import available offers into PostgreSQL instead of querying the external API during each user interaction.

### Changed
- Route `/api/v1/webabo/offers` is now the single backend offer endpoint for both subscription signup and winback contexts, backed by the same Webabo PostgreSQL offer cache and warmed automatically during local Compose startup when external credentials are available.
- Keep the werfsleutel suggestions picker querying the internal catalog API for typed searches beyond the locally seeded list, and fall back to all configured channels when upstream offer metadata does not yet expose channel restrictions.
- Align the HUP token flow with the live Webabo integration by using confidential-client authentication on the token request, including the legacy `PPA:` Basic credential fallback and corrected `PARADISE` realm example URLs.

### Fixed
- Repair the JSON formatting in `client_secrets.example.json` so local tooling can safely parse the HUP/Webabo example structure.

## [v1.0.10]

### Fixed
- Accept Microsoft Entra issuer metadata that uses the documented `{tenantid}` placeholder so valid tenant-specific ID tokens are no longer rejected during callback validation.
- Keep OIDC ID token validation compatible with providers that publish JWKS keys without an `alg`, while only allowing safe signing algorithms from provider metadata, Microsoft Entra `RS256`, or a narrow asymmetric fallback allowlist.

## [v1.0.9]

### Removed
- Remove the obsolete werfsleutel barcode reference docs from `assets/` and `docs/` now that barcode generation and management no longer live in the active Symfony runtime.

### Fixed
- Validate OIDC ID tokens against provider JWKS before trusting nonce, issuer, audience, expiry, or roles, and harden login redirect targets to safe relative paths only.
- Default Teams presence sync off unless explicitly enabled, keep presence scopes out of the default authorization request, drop refresh-token storage from the persisted session token, and reject expired session tokens in the auth and API readers.
- Harden logout to require a POST request with CSRF validation and serve Swagger UI from local vendored `public/vendor/swagger-ui-dist` assets instead of an unpinned remote CDN.

## [v1.0.8]

### Added
- Add a Symfony migration contract matrix and PHPUnit coverage for public/protected route behavior, OIDC helper logic, forwarded-prefix handling, and core API workflows.
- Add PostgreSQL-backed Symfony sessions for `sc-187732` by wiring Doctrine DBAL/ORM, a PDO session handler, bootstrap/cleanup console commands, local Compose PostgreSQL, and callback regression coverage while documenting the remaining cluster follow-up for a future 3-replica rollout.
- Add a pull-request workflow that validates the production build, PHPUnit, Node tests, and `script/check` for the Symfony-first runtime.

### Changed
- Replace the Flask runtime with a Symfony 7.4 LTS application on FrankenPHP while keeping the existing GHCR image contract, port `8000`, `/kiwi` and `/kiwi-preview` reverse-proxy prefixes, `/auth/callback` callback path, and the local fallback OIDC flow intact.
- Upgrade the KIWI runtime baseline to PHP 8.4 and Symfony 7.4 LTS across Composer constraints, Docker runtime, CI validation, and developer documentation.
- Port the existing page/API contract to Symfony controllers and services, including session-backed POC state, catalog and workflow endpoints, Teams presence sync, prefix-aware asset/login/logout URL generation, and provider logout fallback to `/logged-out`.
- Keep local Docker Compose and image publishing contracts stable while switching the app container to a Composer-built FrankenPHP image and preserving `make compose-smoke-oidc` as the required OIDC regression check.
- Commit `.env` as the default Symfony dev configuration, keep `.env.local` as the local-only override, retain `.env.test` for PHPUnit, and normalize Docker Compose around a dev-first Symfony container at `/app` with explicit `dev` and `prod` Docker targets.
- Make the OIDC runtime resolver accept both the documented secret file mount and the existing Flux-mounted file path so local Compose and cluster deployments keep working through the same entrypoint flow.
- Adopt Symfony AssetMapper with `assets/` as the only frontend source directory, compile production assets during the Docker prod build, move Node tests to `tests/frontend/`, and stop tracking `public/assets/` plus `app/static/assets/` as hand-managed source trees.
- Record the `app/static/assets/js` slice-classification audit and no-move decision for non-slice JS modules in `plan/app-js-to-slices-checklist.md`.

### Removed
- Remove the legacy customer-subscription action bridge module by deleting `getLegacyFunction`, `callLegacy`, and `registerCustomerSubscriptionActions`, so `app/static/assets/js/app/index.js` now relies on slice-owned handlers.
- Remove `app/static/assets/js/app/legacy-loader.js` by inlining `ensureRuntimeScriptsLoaded` into the app entrypoint that owns bootstrap orchestration.
- Archive the last Flask-only runtime on `archive/kiwi-flask-runtime`, remove the legacy Flask source tree plus Python tests from the active repo, and replace the fallback OIDC smoke check's Python dependency with Node.

### Fixed
- Keep the Symfony OIDC browser flow compatible with fallback Keycloak by sending space-delimited scopes in the authorization redirect and registering a dedicated `OidcUser` provider so authenticated sessions survive the post-callback page load.
- Load the main and static-page ES module entrypoints through Symfony importmaps and expose hashed legacy runtime script URLs from Twig so nested frontend assets keep resolving behind `/kiwi` and `/kiwi-preview`.

## [v1.0.7]

### Added
- Add `/api/v1/status` endpoint with API status and rate limit snapshot.
- Add a local Docker Compose preflight check that validates `client_secrets.json` before the app starts.
- Add a local fallback Keycloak realm for Docker Compose with seeded Kiwi roles and test users.
- Add fallback OIDC test user `donny` with no Kiwi roles for access-denied testing.
- Add OIDC runtime mode resolution and container entrypoint scripts for external vs fallback secrets.
- Add a `make compose-smoke-oidc` smoke test for fallback OIDC token/role validation.
- Add agent workday stats to the status menu, including active session time and handled call count.
- Add `/api/v1/agent-status` API with optional Microsoft Teams presence sync for Entra sessions.
- Add authenticated `/api/v1` POC API blueprints for bootstrap, customer domain flows, subscriptions, article workflows, catalog data, call queue/session controls, debug reset, and current-user context.
- Add server-side session-backed POC state and catalog services plus API integration tests that verify auth guarding and core workflow behavior.
- Add dynamically generated Swagger/OpenAPI endpoints at `/api/v1/swagger.json` and `/api/v1/swagger` to reflect all registered Kiwi v1 API routes.

### Changed
- Replaced the remaining monolithic frontend flow with module-first architecture: `app/static/assets/js/app/index.js` now owns bootstrap/runtime orchestration and legacy state is centralized in `app/static/assets/js/app/legacy-app-state.js`.
- Completed the slice migration across core domains: app shell, localization, bootstrap/state, customer search/detail/contact history, subscription role/workflow flows, winback, article search/order, delivery remarks/date picker, werfsleutel, and call/queue/agent/disposition/debug.
- Removed migration-era compatibility layers after slice ownership stabilized: deleted `legacy-loader.js`, deleted `legacy-actions-customer-subscription.js`, removed proxy/facade wrappers, and replaced `window` fallback lookups with explicit dependency wiring.
- Standardized UI interaction handling on delegated `data-action` routing and added maintainability guardrails via `script/check` plus `docs/ACTION_ROUTER_CONVENTIONS.md`.
- Reorganized frontend JS asset layout into clearer module folders (`app/`, `i18n/`, and temporary `legacy/` during transition), then removed obsolete legacy files and updated template script references.
- Expanded i18n coverage from templates to dynamic runtime UI: added full English parity, profile locale switching, translated remaining runtime strings, and switched formatting to active-locale date/time/currency behavior.
- Modernized local development and OIDC behavior with fail-fast preflight checks, automatic fallback mode when `client_secrets.json` is missing, local `/kiwi-oidc/` routing, mode-aware scopes, and health-check gated startup ordering.
- Updated agent status UX/backend behavior: avatar-style status menu, persistent backend status updates, Teams sync guardrails, expanded status set, and call-transition-based auto status changes.
- Shifted frontend data flows away from mock/localStorage behavior to authenticated `/api/v1` endpoints, while reducing duplicated frontend domain state in favor of bootstrap/API sources of truth.
- Tightened API platform consistency by validating numeric inputs with structured `400` responses, standardizing server-generated IDs/timestamps, and clarifying route boundaries for persons/subscriptions/workflow actions.
- Consolidated offer/workflow behavior: unified offer retrieval under `/api/v1/webabo/offers`, improved werfsleutel search/picker UX, and redesigned subscription signup around explicit `recipient`/`requester` roles with duplicate-detection safeguards.

### Fixed
- Correct the README local setup command to copy `client_secrets.example.json` to `client_secrets.json`.
- Make menu logout terminate local session and attempt OIDC provider logout before landing on a logged-out page.
- Prefix frontend API requests with the active script root (`/kiwi` or `/kiwi-preview`) so API calls resolve correctly behind the local gateway path.
- Clear selected werfsleutel/channel state when a barcode scan resolves to no match or an inactive offer, preventing stale submissions.
- Restore API fallback for Enter-based non-barcode werfsleutel lookups when the local cache misses, and clear stale selection when operators type a new query.
- Make `POST /api/v1/workflows/subscription-signup` atomic by validating both roles before creating new persons, preventing partial state writes on error responses.
- Remove hidden requester create-form controls when `sameAsRecipient` is enabled so browser required-field validation no longer blocks valid submit paths.

## [v1.0.6]

### Changed
- Build the OIDC redirect URI from the request host and prefix to avoid per-environment overrides.

## [v1.0.5]

### Added
- Add Docker Compose local HTTPS gateway flow for OIDC development.
- Add Docker Compose wiring for local OIDC client_secrets.json usage.
- Add GitHub Actions workflow to build and push GHCR images on version tag pushes.
- Add Makefile target to build a local `kiwi:dev` image from the app Dockerfile.
- Add OIDC login flow with role-based access control and a dedicated access denied page.
- Add unit tests for OIDC auth helpers.

### Changed
- Document local-only overlay usage and route production deployments to the cluster config repo.
- Generate local Docker Compose TLS certs automatically via a dedicated service.
- Document GHCR image publishing and local `kiwi:dev` builds in the README.
- Move Python dependency definitions to `pyproject.toml` for uv installs.
- Bump Alpine base images to 3.19 to unlock newer build tooling.
- Bump the app runtime to Python 3.12.
- Convert auth helpers into a dedicated `app/auth` package.

### Removed
- Remove the production Kustomize overlay under `infra/k8s/overlays/prod`.
- Remove Kubernetes/Helm manifests, scripts, and GitOps docs to focus on Docker Compose.

### Fixed
- Install Alpine build dependencies needed for cryptography/cffi during image builds.
- Mount OIDC client secrets under `/run/secrets` to avoid bind-mount conflicts in Docker Desktop.

## [v1.0.4]

### Changed
- Changed version number again in html for testing auto tagging

## [v1.0.3]

### Changed
- Changed version number in html for testing auto tagging

## [v1.0.2]

### Added
- Added version number to html

## [v1.0.1]

### Changed
- changed background color

## [v1.0.0]

### Added
- Added UV support
- Added Flux v2 GitOps cluster definitions under `clusters/`
- Added blue/green deployment resources with active and preview services
- Documented local and production deployment steps in the GitOps guide
- Documented organization-owned repo bootstrap settings for Flux
- Expanded blue/green deployment explanations in docs and README
- Added blue/green glossary to the GitOps guide
- Moved cluster GitOps configuration to the bink8s-cluster-management repo

### Changed
- centralized deploy config in `infra/k8s/base/deploy.env` for scripts and kustomize
- fail fast when both local and prod targets are provided to Make
- pin add-on Helm chart versions via `infra/k8s/base/deploy.env`
- Update deploy-addons script to install Gateway API, NGINX Gateway Fabric, and cert-manager CRDs
- Pin the NGINX Gateway Fabric chart version and require the --confirm-prod flag for production installs
- Remove ingress-nginx chart artifacts and references in deploy config
- Configure cert-manager values for CRDs, add Gateway API ACME issuers, and install the issuer chart during addons
- Update deploy-app to wait for all kiwi deployments after applying kustomize overlays

### Fixed
