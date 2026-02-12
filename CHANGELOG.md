# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Add a PostgreSQL-backed mutation outbox implementation under `app/services/mutations` with schema bootstrap, retry classification, downstream dispatcher, and a dedicated worker entrypoint (`python -m services.mutations.worker`).
- Add authenticated mutation workbox APIs under `/api/v1/mutations` for listing, summary, detail, retry, and cancel operations.
- Add local Docker Compose services for `postgres` and `mutation-worker`, including mutation outbox environment wiring.
- Add in-app mutation workbox UI elements in the right panel and customer-level pending/failed mutation status badges.
- Add mutation outbox documentation in `docs/MUTATION_OUTBOX.md` and local enablement notes in `README.md`.
- Add unit tests for mutation classifier behavior and feature-flagged async enqueue responses.

### Changed
- Document the `app/static/assets/js` slice-classification audit in `plan/app-js-to-slices-checklist.md`, confirming `app/static/assets/js/app/slices` as the canonical slice directory and recording a no-move decision for non-slice JS modules.
- Remove the legacy customer-subscription action bridge module (`app/static/assets/js/app/legacy-actions-customer-subscription.js`) by deleting `getLegacyFunction`, `callLegacy`, and `registerCustomerSubscriptionActions`; `app/static/assets/js/app/index.js` now relies on slice-owned handlers (`close-form` in app-shell and caller-identification actions in call-session).
- Remove `app/static/assets/js/app/legacy-loader.js` by inlining `ensureRuntimeScriptsLoaded` into `app/static/assets/js/app/index.js`, so runtime script loading now lives in the entrypoint that owns bootstrap orchestration.
- Convert subscription phase-1 mutation routes (`/api/v1/workflows/subscription-signup`, `/api/v1/subscriptions/<...>`, and `/api/v1/subscriptions/<customer_id>/deceased-actions`) to return async `202` mutation envelopes when `MUTATION_STORE_ENABLED=true`.

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
- Consolidated offer/workflow behavior: unified offer retrieval under `/api/v1/catalog/offers`, improved werfsleutel search/picker UX, and redesigned subscription signup around explicit `recipient`/`requester` roles with duplicate-detection safeguards.

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
