# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
### Added
- Added UV support

### Changed
- centralized deploy config in `infra/k8s/base/deploy.env` for scripts and kustomize
- fail fast when both local and prod targets are provided to Make
- pin add-on Helm chart versions via `infra/k8s/base/deploy.env`
- Update deploy-addons script to install Gateway API, NGINX Gateway Fabric, and cert-manager CRDs
- Pin the NGINX Gateway Fabric chart version and require the --confirm-prod flag for production installs
- Remove ingress-nginx chart artifacts and references in deploy config

### Fixed
