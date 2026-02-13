# Mutation Outbox

Kiwi supports a pending-first mutation mode for subscription changes.

## How it works

1. API endpoints accept subscription mutations and enqueue a command in PostgreSQL.
2. API responds with `202 Accepted` and a mutation envelope.
3. Background worker claims queued mutations and dispatches them to the downstream API.
4. Failed retries are rescheduled with backoff until a limit is hit.
5. Terminal failures stay visible in `/api/v1/mutations` and the in-app workbox.

## Feature flags

- `MUTATION_STORE_ENABLED`
- `MUTATION_DATABASE_URL`
- `MUTATION_MAX_ATTEMPTS` (default: `20`)
- `MUTATION_MAX_AGE_HOURS` (default: `24`)
- `MUTATION_WORKER_BATCH_SIZE` (default: `10`)
- `MUTATION_TARGET_BASE_URL`
- `MUTATION_DISPATCH_DRY_RUN`

## Local Docker Compose defaults

- Compose file: `docker-compose.yaml`
- Local PostgreSQL service: `postgres` (`postgres:16-alpine`)
- Local mutation worker service: `mutation-worker`
- Default local `MUTATION_STORE_ENABLED`: `true`
- Default local `MUTATION_DATABASE_URL`: `postgresql://kiwi:kiwi@postgres:5432/kiwi`

To recreate the local PostgreSQL volume from scratch:

```bash
make compose-reset-db
```

## Worker

Run once:

```bash
python -m services.mutations.worker --once
```

Run continuously:

```bash
python -m services.mutations.worker
```

## Retry and escalation

- Retryable failures: connection/timeouts and HTTP `408/425/429/500/502/503/504`.
- Escalation threshold: first hit of either
  - `attempt_count >= MUTATION_MAX_ATTEMPTS`
  - mutation age `>= MUTATION_MAX_AGE_HOURS`
- Escalated items are marked `failed` for manual follow-up.

## Retention

The outbox stores mutation history for 12 months by default (`MUTATION_RETENTION_DAYS=365`).
