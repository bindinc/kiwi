# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
### Added
- Added UV support
- Added Flux v2 GitOps cluster definitions under `clusters/`
- Added blue/green deployment resources with active and preview services
- Documented local and production deployment steps in the GitOps guide

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
