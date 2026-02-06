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

### Changed
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

### Fixed
- Correct the README local setup command to copy `client_secrets.example.json` to `client_secrets.json`.
- Make menu logout terminate local session and attempt OIDC provider logout before landing on a logged-out page.

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
