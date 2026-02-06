CREATE TABLE IF NOT EXISTS operation_requests (
    request_id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json JSONB,
    error_json JSONB,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operation_requests_status_created
    ON operation_requests (status, created_at);

CREATE TABLE IF NOT EXISTS outbound_jobs (
    job_id BIGSERIAL PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES operation_requests (request_id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    ordering_key TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by TEXT,
    locked_until TIMESTAMPTZ,
    last_error_code TEXT,
    last_error_message_redacted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbound_jobs_status_next_attempt
    ON outbound_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_outbound_jobs_ordering_key_created
    ON outbound_jobs (ordering_key, created_at);

CREATE TABLE IF NOT EXISTS outbound_job_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES outbound_jobs (job_id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    outcome TEXT NOT NULL,
    error_code TEXT,
    error_message_redacted TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_job_attempts_job_id
    ON outbound_job_attempts (job_id, started_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
    event_id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    actor_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    request_id TEXT,
    correlation_id TEXT,
    before_redacted JSONB,
    after_redacted JSONB,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_events_request_id_occurred
    ON audit_events (request_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity_occurred
    ON audit_events (entity_type, entity_id, occurred_at DESC);
