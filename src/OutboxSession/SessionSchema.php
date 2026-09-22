<?php

declare(strict_types=1);

namespace App\OutboxSession;

use Doctrine\DBAL\Connection;

/** Explicit additive migration; web requests never create or alter tables. */
final class SessionSchema
{
    public function __construct(private readonly Connection $db) {}

    public function migrate(): void
    {
        $this->db->transactional(function (): void {
            $this->db->executeQuery("SELECT pg_advisory_xact_lock(hashtext('kiwi-outbox-session-schema'))");
            $this->db->executeStatement(<<<'SQL'
CREATE TABLE IF NOT EXISTS customer_outbox_sessions (
    id BIGSERIAL PRIMARY KEY,
    tenant TEXT NOT NULL,
    customer_key TEXT NOT NULL,
    customer_reference JSONB NOT NULL,
    creator TEXT NOT NULL,
    contributors JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('pending','paused','ready','processing','completed','failed','uncertain','cancelled')),
    available_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    changes JSONB NOT NULL DEFAULT '[]',
    base_customers JSONB NOT NULL DEFAULT '[]',
    preview_customers JSONB NOT NULL DEFAULT '[]',
    progress JSONB NOT NULL DEFAULT '[]'
)
SQL);
            $this->db->executeStatement("ALTER TABLE customer_outbox_sessions ADD COLUMN IF NOT EXISTS contributor_labels JSONB NOT NULL DEFAULT '{}'");
            $this->db->executeStatement("CREATE UNIQUE INDEX IF NOT EXISTS one_open_customer_outbox_session ON customer_outbox_sessions (tenant, customer_key) WHERE status IN ('pending','paused')");
            $this->db->executeStatement('CREATE INDEX IF NOT EXISTS customer_outbox_session_dispatch ON customer_outbox_sessions(status, available_at)');
            $this->db->executeStatement(<<<'SQL'
CREATE TABLE IF NOT EXISTS customer_outbox_receipts (
    tenant TEXT NOT NULL,
    actor TEXT NOT NULL,
    request_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    session_id BIGINT NOT NULL REFERENCES customer_outbox_sessions(id),
    response JSONB NOT NULL,
    PRIMARY KEY (tenant, actor, request_key)
)
SQL);
            $this->db->executeStatement(<<<'SQL'
CREATE TABLE IF NOT EXISTS customer_outbox_audit (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES customer_outbox_sessions(id),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    revision INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
)
SQL);
        });
    }
}
