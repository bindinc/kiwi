"""Repository for idempotent operation request records."""

from __future__ import annotations

from typing import Any

from db.repositories.base import RepositoryBase


class OperationRequestsRepository(RepositoryBase):
    """Persistence for operation request state."""

    def create_request(
        self,
        request_id: str,
        operation_type: str,
        payload_hash: str,
        status: str,
        correlation_id: str | None = None,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO operation_requests (
                    request_id,
                    operation_type,
                    payload_hash,
                    status,
                    correlation_id
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (request_id, operation_type, payload_hash, status, correlation_id),
            )

    def get_by_request_id(self, request_id: str) -> dict[str, Any] | None:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM operation_requests WHERE request_id = %s",
                (request_id,),
            ).fetchone()

        return dict(row) if row else None

    def update_status(
        self,
        request_id: str,
        status: str,
        result_json: dict[str, Any] | None = None,
        error_json: dict[str, Any] | None = None,
        completed: bool = False,
    ) -> None:
        completed_at = self.utcnow() if completed else None

        with self.connection() as connection:
            connection.execute(
                """
                UPDATE operation_requests
                SET
                    status = %s,
                    result_json = %s,
                    error_json = %s,
                    completed_at = %s,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (status, result_json, error_json, completed_at, request_id),
            )
