"""Repository for durable outbound integration jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from db.repositories.base import RepositoryBase


TERMINAL_JOB_STATUSES = ("succeeded", "dead_letter")


class OutboundJobsRepository(RepositoryBase):
    """Persistence logic for queue jobs."""

    def enqueue_job(
        self,
        request_id: str,
        job_type: str,
        ordering_key: str,
        payload_json: dict[str, Any],
        max_attempts: int,
    ) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO outbound_jobs (
                    request_id,
                    job_type,
                    ordering_key,
                    payload_json,
                    max_attempts,
                    status,
                    next_attempt_at
                )
                VALUES (%s, %s, %s, %s, %s, 'queued', NOW())
                RETURNING job_id
                """,
                (request_id, job_type, ordering_key, payload_json, max_attempts),
            ).fetchone()

        return int(row["job_id"])

    def claim_jobs(
        self,
        worker_id: str,
        limit: int,
        lock_seconds: int,
        now_utc: datetime,
    ) -> list[dict[str, Any]]:
        with self.connection() as connection:
            rows = connection.execute(
                """
                WITH candidate_jobs AS (
                    SELECT j.job_id
                    FROM outbound_jobs j
                    WHERE (
                        (j.status = 'queued' AND j.next_attempt_at <= %(now)s)
                        OR (j.status = 'processing' AND j.locked_until < %(now)s)
                    )
                    AND (j.locked_until IS NULL OR j.locked_until < %(now)s)
                    AND NOT EXISTS (
                        SELECT 1
                        FROM outbound_jobs earlier
                        WHERE earlier.ordering_key = j.ordering_key
                        AND earlier.created_at < j.created_at
                        AND earlier.status IN ('queued', 'processing')
                    )
                    ORDER BY j.next_attempt_at ASC, j.created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT %(limit)s
                )
                UPDATE outbound_jobs j
                SET
                    status = 'processing',
                    locked_by = %(worker_id)s,
                    locked_until = %(now)s + make_interval(secs => %(lock_seconds)s),
                    updated_at = %(now)s
                FROM candidate_jobs c
                WHERE j.job_id = c.job_id
                RETURNING j.*
                """,
                {
                    "worker_id": worker_id,
                    "limit": limit,
                    "lock_seconds": lock_seconds,
                    "now": now_utc,
                },
            ).fetchall()

        return [dict(row) for row in rows]

    def increment_attempt_count(self, job_id: int) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                UPDATE outbound_jobs
                SET
                    attempt_count = attempt_count + 1,
                    updated_at = NOW()
                WHERE job_id = %s
                RETURNING attempt_count
                """,
                (job_id,),
            ).fetchone()

        return int(row["attempt_count"])

    def mark_succeeded(self, job_id: int) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                UPDATE outbound_jobs
                SET
                    status = 'succeeded',
                    locked_by = NULL,
                    locked_until = NULL,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE job_id = %s
                """,
                (job_id,),
            )

    def schedule_retry(
        self,
        job_id: int,
        next_attempt_at: datetime,
        error_code: str,
        error_message_redacted: str,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                UPDATE outbound_jobs
                SET
                    status = 'queued',
                    next_attempt_at = %s,
                    locked_by = NULL,
                    locked_until = NULL,
                    last_error_code = %s,
                    last_error_message_redacted = %s,
                    updated_at = NOW()
                WHERE job_id = %s
                """,
                (next_attempt_at, error_code, error_message_redacted, job_id),
            )

    def mark_dead_letter(self, job_id: int, error_code: str, error_message_redacted: str) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                UPDATE outbound_jobs
                SET
                    status = 'dead_letter',
                    locked_by = NULL,
                    locked_until = NULL,
                    last_error_code = %s,
                    last_error_message_redacted = %s,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE job_id = %s
                """,
                (error_code, error_message_redacted, job_id),
            )

    def build_health_snapshot(self) -> dict[str, Any]:
        with self.connection() as connection:
            counters = connection.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE status = 'queued') AS queued,
                    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
                    COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter
                FROM outbound_jobs
                """
            ).fetchone()

        return {
            "queued": int(counters["queued"]),
            "processing": int(counters["processing"]),
            "dead_letter": int(counters["dead_letter"]),
        }

    def delete_terminal_older_than(self, cutoff: datetime) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                WITH deleted_rows AS (
                    DELETE FROM outbound_jobs
                    WHERE status IN ('succeeded', 'dead_letter')
                    AND completed_at < %s
                    RETURNING job_id
                )
                SELECT COUNT(*) AS deleted_count FROM deleted_rows
                """,
                (cutoff,),
            ).fetchone()

        return int(row["deleted_count"])
