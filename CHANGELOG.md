# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
- Migrate Item 8 winback/deceased/restitution-transfer workflows from legacy `app.js` into `assets/js/app/slices/winback-slice.js`, register Item 8 router actions in that slice, and remove those action mappings from the legacy customer/subscription bridge.
- Migrate Item 7 subscription workflows (create/edit customer, resend magazine, editorial complaint, subscription edit) from legacy `app.js` into `assets/js/app/slices/subscription-workflow-slice.js`, register those actions in the new slice, and remove Item 7 handlers from the legacy customer/subscription action bridge.
- Migrate customer detail, subscription rendering, and contact-history timeline UI from `app.js` into dedicated Item 6 slices (`assets/js/app/slices/customer-detail-slice.js`, `assets/js/app/slices/contact-history-slice.js`), with delegated action routing (`select-customer`, `toggle-timeline-item`, `change-contact-history-page`) and legacy global compatibility wrappers.
- Migrate customer search, result rendering, and pagination workflows from legacy `app.js` into a dedicated `assets/js/app/slices/customer-search-slice.js`, register Item 5 actions directly in the slice, and remove those action mappings from the legacy customer/subscription bridge.
- Implement Werfsleutel checklist item 3 by replacing the bridge-only `app/static/assets/js/app/slices/werfsleutel.js` handlers with catalog/picker/channel domain logic, wiring `app.js` subscription flow to the slice bridge API, and adding focused slice tests.
- Extract localization/static i18n/locale-switching logic into `assets/js/app/slices/localization-slice.js`, expose those helpers through the legacy global bridge, and move profile language toggles to delegated `data-action="localization.set-locale"` handlers.
- Extract bootstrap/state initialization and persistence shell logic from `app/static/assets/js/app.js` into `app/static/assets/js/app/slices/bootstrap-slice.js`, and wire legacy bootstrap calls through slice-backed wrappers.
- Migrate customer/subscription/winback UI events from inline HTML handlers to delegated `data-action` contracts, including generated `app.js` markup (search results, pagination, subscription actions, duplicate checks, contact history paging, and winback offer selection) with new router registrations in `assets/js/app/legacy-actions-customer-subscription.js`.
- Start `app.js` modularization with a new ES-module entrypoint (`assets/js/app/index.js`), shared router/state/service foundation files, and a legacy bootstrap bridge that preserves current runtime behavior while future slices migrate off global handlers.
- Refactor article-sale, delivery-remark, delivery-calendar, and werfsleutel picker/channel UI interactions into dedicated app-module slices with delegated `data-action` handlers, replacing in-scope inline/generated handlers while preserving existing legacy workflow behavior.
- Refactor call session, hold/resume, queue, ACW/disposition, debug, and agent-status UI triggers into dedicated app action slices, and migrate those scoped `index.html`/generated `app.js` handlers from inline events to delegated `data-action` routing.
- Move call/queue/agent-status/disposition/debug implementation blocks out of `app.js` into `assets/js/app/call-agent-runtime.js`, load that runtime before `app.js`, and replace the generic legacy string-bridge with explicit runtime client calls in the migrated slices.
- Move subscription role/person form helpers, duplicate-check flow, and role-selection payload builders out of `app.js` into `assets/js/app/subscription-role-runtime.js`, then register the Item 4 delegated actions through a dedicated `subscription-role` slice/runtime client.
- Finalize JS modularization guardrails with a new `script/check` command (`no-inline-handler`, `no-duplicate-top-level-function`), remove now-unneeded module-shell globals/shims (`window.kiwiApp`, `kiwi:legacy-ready`, delivery picker listener sentinels on `window`), and document action-router conventions in `docs/ACTION_ROUTER_CONVENTIONS.md`.
- Add full English i18n coverage via `app/static/assets/js/i18n/en.js` (matching the current `nl` keyset), register `en` in the i18n runtime, and add profile-menu language switching (`NL`/`EN`) with immediate UI re-translation and locale-aware date/time/currency formatting.
- Localize remaining dynamic `app.js` UI strings (toasts, confirms, search/result states, queue/debug labels, subscription/article rendering labels, and contact-history labels), add missing `nl`/`en` translation keys, and remove hardcoded `nl-NL` date formatting in favor of active app locale.
- Make `app/templates/base/index.html` fully i18n-backed by translating static text/placeholder/title literals through `window.i18n`, and add matching `indexHtml` keys in `app/static/assets/js/i18n/nl.js`.
- Add explicit `data-i18n`, `data-i18n-placeholder`, and `data-i18n-title` bindings across `app/templates/base/index.html`, with `app.js` using these attributes as the primary static-page i18n source and literal scanning only as fallback.
- Move delivery remark preset phrases out of inline `onclick` string literals in `app/templates/base/index.html` and resolve them via `delivery.remarkPresets` keys in `app/static/assets/js/i18n/nl.js`.
- Add i18n translation coverage for `app/templates/base/logged_out.html` and `app/templates/base/access_denied.html` using explicit `data-i18n` bindings and a shared `static-page-i18n.js` translator loader.
- Refactor the Flask blueprint layout with a registry and versioned API base blueprint.
- Make `make compose-up` fail fast with actionable guidance when local OIDC prerequisites are not met.
- Make missing `client_secrets.json` automatically activate local fallback OIDC instead of failing startup.
- Add local gateway routing for fallback OIDC under `/kiwi-oidc/`.
- Configure fallback Keycloak hostname/backchannel handling so browser redirects stay on the public local URL.
- Make OIDC scopes mode-aware: fallback defaults to `openid email profile`, external keeps `openid email profile User.Read`.
- Gate local startup on health checks so `app` waits for fallback OIDC readiness and `gateway` waits for a healthy app.
- Redesign the header status indicator to an avatar badge style and extend its menu with status selection and logout.
- Persist agent status changes through the backend and sync with Teams only when Graph permissions and Entra issuer checks pass.
- Expand Kiwi status options to align with Teams presence states (available, busy, do-not-disturb, be-right-back, away, offline).
- Update default external OIDC scopes to include Graph presence scopes (`Presence.Read`, `Presence.ReadWrite`).
- Sync Avaya call start to Teams `InACall` activity by using Graph session presence APIs for call-state updates.
- Restrict automatic status changes to call transitions only: enter call -> `in_call`, leave call -> restore prior external/manual status.
- Refactor `app.js`, `article-search.js`, and `delivery-date-picker.js` to remove mock/localStorage backend behavior and use authenticated `/api/v1` endpoints with a shared frontend API client.
- Expand API unit tests to cover all migrated `/api/v1` POC endpoints, including catalog, customer, subscription, workflow, queue/session, debug-reset, and agent-status auth guards.
- Validate numeric query/body inputs across `/api/v1` endpoints and return structured `400` API errors instead of `500` for malformed values.
- Generate workflow subscription/article-order IDs from server-side counters and use timezone-aware UTC timestamps.
- Remove remaining frontend mock domain duplication for service numbers, werfsleutel channels/catalog fallbacks, and queue generation fallback so bootstrap/API remains the source of truth.
- Consolidate werfsleutels and winback offers into one atomic endpoint `GET /api/v1/catalog/offers` and update frontend consumers accordingly.
- Move subscription mutation endpoints from the customers namespace to `/api/v1/subscriptions/...` to keep `/api/v1/persons` focused on person resources.
- Rename subscription action routes to `POST /api/v1/subscriptions/{customer_id}/{subscription_id}/complaint` and `POST /api/v1/subscriptions/{customer_id}/{subscription_id}`.
- Make the "Nieuw abonnement" werfsleutel search call `/api/v1/catalog/offers` during typing and Enter selection instead of only filtering a local in-memory list.
- Rework the "Nieuw abonnement" werfsleutel picker to a keyboard-first local-first flow with stale-while-revalidate catalog sync, inline status summary, and allowed-only channel selection without a blocking confirmation modal.
- Redesign the new subscription workflow to always resolve two roles (`recipient` and `requester`) and persist ID-only linkage with `recipientPersonId` and `requesterPersonId`.
- Hard-switch `POST /api/v1/workflows/subscription-signup` away from `customerId/customer` to `recipient/requester` payload objects, including `sameAsRecipient` requester resolution.
- Update the frontend subscription form to support recipient and requester/payer selection or inline person creation without storing a relation-type enum.
- Add a local-first, throttled background duplicate-person check in subscription create mode for both recipient and requester, with collapsed advisory UI, expandable matches, and a submit-time non-blocking confirmation guard.
- Auto-enable "Zelfde persoon als ontvanger" when recipient and requester resolve to the same existing person while the checkbox is manually unchecked, and canonicalize submit payload as `sameAsRecipient` for this edge case.

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
