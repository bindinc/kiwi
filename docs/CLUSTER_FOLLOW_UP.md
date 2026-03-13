# Cluster Follow-up For SC-187732

This repository documents, but does not apply, the cluster work still needed to complete the production side of `sc-187732`.

## Scope

The Symfony application in this repository now supports PostgreSQL-backed sessions for replica-safe OIDC state. The remaining cluster-side rollout belongs in the GitOps/configuration flow outside this repository.

## Required cluster changes

- inject `APP_SECRET` into both Kiwi tracks from a stable Kubernetes secret
- inject `SESSION_DB_*` from the existing `kiwi-db-rw` consumer secret
- set `sessionAffinity: None` on both Kiwi services
- run `php bin/console app:sessions:bootstrap` once per environment before the cutover
- keep `prod` on 3 replicas per active and preview track during the acceptance rollout
- add a scheduled `php bin/console app:sessions:cleanup` job in the cluster config repo

## Acceptance rollout notes

- validate login/logout behavior against 3 replicas instead of 2
- confirm that no sticky-session or client-to-pod affinity is required
- keep rollback limited to manifest/image revert; the session table and any archived legacy table can remain in PostgreSQL
