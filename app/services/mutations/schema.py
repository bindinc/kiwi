from __future__ import annotations

import logging

try:
    import psycopg
except ModuleNotFoundError:  # pragma: no cover - runtime dependency guard
    psycopg = None

from .settings import get_mutation_database_url, is_mutation_store_enabled

LOGGER = logging.getLogger(__name__)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS mutation_jobs (
    id UUID PRIMARY KEY,
    command_type TEXT NOT NULL,
    ordering_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    first_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    last_error_code TEXT,
    last_error_message TEXT,
    last_http_status INTEGER,
    failure_class TEXT,
    created_by_user TEXT,
    created_by_roles TEXT[] NOT NULL DEFAULT '{}',
    customer_id BIGINT,
    subscription_id BIGINT,
    client_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS mutation_events (
    id BIGSERIAL PRIMARY KEY,
    mutation_id UUID NOT NULL REFERENCES mutation_jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    previous_status TEXT,
    next_status TEXT,
    attempt_count INTEGER,
    error_code TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mutation_jobs_client_request_id_unique
ON mutation_jobs (client_request_id)
WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mutation_jobs_status_next_attempt_idx
ON mutation_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS mutation_jobs_ordering_key_created_at_idx
ON mutation_jobs (ordering_key, created_at);

CREATE INDEX IF NOT EXISTS mutation_jobs_customer_created_at_idx
ON mutation_jobs (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mutation_jobs_created_by_user_created_at_idx
ON mutation_jobs (created_by_user, created_at DESC);

CREATE INDEX IF NOT EXISTS mutation_events_mutation_id_created_at_idx
ON mutation_events (mutation_id, created_at DESC);
"""


def ensure_mutation_schema() -> None:
    if psycopg is None:
        raise RuntimeError("psycopg is required for mutation store support")

    database_url = get_mutation_database_url()
    if not database_url:
        raise RuntimeError("MUTATION_DATABASE_URL is required when mutation store is enabled")

    with psycopg.connect(database_url, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(SCHEMA_SQL)


def ensure_mutation_schema_if_enabled() -> None:
    if not is_mutation_store_enabled():
        return

    ensure_mutation_schema()
    LOGGER.info("Mutation outbox schema verified")
