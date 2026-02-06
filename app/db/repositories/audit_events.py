"""Repository for centralized operational audit events."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from db.repositories.base import RepositoryBase


class AuditEventsRepository(RepositoryBase):
    """Persistence for audit timeline entries."""

    def append_event(
        self,
        event_type: str,
        actor_id: str | None,
        entity_type: str,
        entity_id: str,
        request_id: str | None,
        correlation_id: str | None,
        before_redacted: dict[str, Any] | None,
        after_redacted: dict[str, Any] | None,
        metadata_json: dict[str, Any] | None = None,
    ) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO audit_events (
                    event_type,
                    actor_id,
                    entity_type,
                    entity_id,
                    request_id,
                    correlation_id,
                    before_redacted,
                    after_redacted,
                    metadata_json
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING event_id
                """,
                (
                    event_type,
                    actor_id,
                    entity_type,
                    entity_id,
                    request_id,
                    correlation_id,
                    before_redacted,
                    after_redacted,
                    metadata_json or {},
                ),
            ).fetchone()

        return int(row["event_id"])

    def list_events(
        self,
        *,
        person_id: str | None = None,
        request_id: str | None = None,
        limit: int = 50,
        cursor: int | None = None,
    ) -> tuple[list[dict[str, Any]], int | None]:
        where_clauses = ["TRUE"]
        params: dict[str, Any] = {"limit": limit}

        if person_id:
            where_clauses.append("entity_type = 'person' AND entity_id = %(person_id)s")
            params["person_id"] = person_id

        if request_id:
            where_clauses.append("request_id = %(request_id)s")
            params["request_id"] = request_id

        if cursor is not None:
            where_clauses.append("event_id < %(cursor)s")
            params["cursor"] = cursor

        where_statement = " AND ".join(where_clauses)

        query = f"""
            SELECT *
            FROM audit_events
            WHERE {where_statement}
            ORDER BY event_id DESC
            LIMIT %(limit)s
        """

        with self.connection() as connection:
            rows = connection.execute(query, params).fetchall()

        events = [dict(row) for row in rows]
        next_cursor = events[-1]["event_id"] if len(events) == limit else None
        return events, next_cursor

    def delete_older_than(self, cutoff: datetime) -> int:
        with self.connection() as connection:
            row = connection.execute(
                """
                WITH deleted_rows AS (
                    DELETE FROM audit_events
                    WHERE occurred_at < %s
                    RETURNING event_id
                )
                SELECT COUNT(*) AS deleted_count FROM deleted_rows
                """,
                (cutoff,),
            ).fetchone()

        return int(row["deleted_count"])
