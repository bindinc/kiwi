"""Repository for detailed outbound job attempt history."""

from __future__ import annotations

from db.repositories.base import RepositoryBase


class OutboundJobAttemptsRepository(RepositoryBase):
    """Persistence logic for attempt diagnostics."""

    def start_attempt(self, job_id: int, attempt_no: int) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO outbound_job_attempts (
                    job_id,
                    attempt_no,
                    started_at,
                    outcome
                )
                VALUES (%s, %s, NOW(), 'running')
                RETURNING attempt_id
                """,
                (job_id, attempt_no),
            ).fetchone()

        return int(row["attempt_id"])

    def finish_attempt(
        self,
        attempt_id: int,
        outcome: str,
        error_code: str | None = None,
        error_message_redacted: str | None = None,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                UPDATE outbound_job_attempts
                SET
                    finished_at = NOW(),
                    outcome = %s,
                    error_code = %s,
                    error_message_redacted = %s
                WHERE attempt_id = %s
                """,
                (outcome, error_code, error_message_redacted, attempt_id),
            )

    def delete_for_old_terminal_jobs(self, cutoff) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                WITH deleted_rows AS (
                    DELETE FROM outbound_job_attempts attempts
                    USING outbound_jobs jobs
                    WHERE attempts.job_id = jobs.job_id
                    AND jobs.status IN ('succeeded', 'dead_letter')
                    AND jobs.completed_at < %s
                    RETURNING attempts.attempt_id
                )
                SELECT COUNT(*) AS deleted_count FROM deleted_rows
                """,
                (cutoff,),
            ).fetchone()

        return int(row["deleted_count"])
