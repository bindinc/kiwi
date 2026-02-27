from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Json
except ModuleNotFoundError:  # pragma: no cover - runtime dependency guard
    psycopg = None
    dict_row = None
    Json = None

from .settings import (
    get_mutation_database_url,
    get_mutation_max_age_hours,
    get_mutation_max_attempts,
    get_mutation_retention_delta,
    is_mutation_store_enabled,
)

LOGGER = logging.getLogger(__name__)

TERMINAL_STATUSES = {"delivered", "failed", "cancelled"}
RETRYABLE_STATUSES = {"queued", "retry_scheduled"}


class MutationStoreDisabledError(RuntimeError):
    pass


class MutationNotFoundError(RuntimeError):
    pass


class MutationConflictError(RuntimeError):
    pass


def ensure_store_enabled() -> None:
    if not is_mutation_store_enabled():
        raise MutationStoreDisabledError("Mutation store is disabled")



def _database_url() -> str:
    database_url = get_mutation_database_url()
    if not database_url:
        raise RuntimeError("MUTATION_DATABASE_URL is required when mutation store is enabled")
    return database_url



def _connect() -> psycopg.Connection:
    if psycopg is None or dict_row is None:
        raise RuntimeError("psycopg is required for mutation store support")
    return psycopg.connect(_database_url(), row_factory=dict_row)



def _utc_now() -> datetime:
    return datetime.now(UTC)



def _coerce_cursor(raw_cursor: str | None) -> int:
    if raw_cursor is None:
        return 0
    try:
        parsed = int(raw_cursor)
    except (TypeError, ValueError):
        return 0
    return max(0, parsed)



def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return 25
    try:
        parsed = int(limit)
    except (TypeError, ValueError):
        return 25
    return max(1, min(200, parsed))



def _to_envelope(row: dict[str, Any]) -> dict[str, Any]:
    request_container = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    request_payload = (
        request_container.get("request")
        if isinstance(request_container.get("request"), dict)
        else {}
    )

    return {
        "id": str(row["id"]),
        "commandType": row["command_type"],
        "status": row["status"],
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "orderingKey": row["ordering_key"],
        "attemptCount": int(row.get("attempt_count") or 0),
        "maxAttempts": int(row.get("max_attempts") or 0),
        "nextAttemptAt": row["next_attempt_at"].isoformat() if row.get("next_attempt_at") else None,
        "customerId": row.get("customer_id"),
        "subscriptionId": row.get("subscription_id"),
        "failureClass": row.get("failure_class"),
        "lastHttpStatus": row.get("last_http_status"),
        "lastErrorCode": row.get("last_error_code"),
        "lastErrorMessage": row.get("last_error_message"),
        "createdByUser": row.get("created_by_user"),
        "createdByRoles": list(row.get("created_by_roles") or []),
        "requestPayload": request_payload,
    }



def build_signup_ordering_key(payload: dict[str, Any]) -> str:
    recipient = payload.get("recipient") if isinstance(payload.get("recipient"), dict) else {}

    person_id = recipient.get("personId")
    if person_id not in (None, ""):
        return f"customer:{int(person_id)}"

    person_payload = recipient.get("person") if isinstance(recipient.get("person"), dict) else {}
    identity_parts = [
        str(person_payload.get("lastName", "")).strip().lower(),
        str(person_payload.get("postalCode", "")).strip().upper(),
        str(person_payload.get("houseNumber", "")).strip(),
        str(person_payload.get("birthday", "")).strip(),
    ]
    identity_seed = "|".join(identity_parts)
    identity_hash = hashlib.sha256(identity_seed.encode("utf-8")).hexdigest()
    return f"identity:{identity_hash}"



def _record_event(
    connection: psycopg.Connection,
    *,
    mutation_id: uuid.UUID,
    event_type: str,
    previous_status: str | None,
    next_status: str | None,
    attempt_count: int | None,
    error_code: str | None = None,
    error_message: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO mutation_events (
                mutation_id,
                event_type,
                previous_status,
                next_status,
                attempt_count,
                error_code,
                error_message,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                mutation_id,
                event_type,
                previous_status,
                next_status,
                attempt_count,
                error_code,
                error_message,
                Json(metadata or {}),
            ),
        )



def _find_existing_by_client_request_id(
    connection: psycopg.Connection,
    client_request_id: uuid.UUID,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM mutation_jobs
            WHERE client_request_id = %s
            LIMIT 1
            """,
            (client_request_id,),
        )
        return cursor.fetchone()



def enqueue_mutation(
    *,
    command_type: str,
    ordering_key: str,
    request_payload: dict[str, Any],
    customer_id: int | None,
    subscription_id: int | None,
    created_by_user: str | None,
    created_by_roles: list[str] | None,
    client_request_id: str | None,
) -> dict[str, Any]:
    ensure_store_enabled()

    mutation_id = uuid.uuid4()
    now = _utc_now()
    max_attempts = get_mutation_max_attempts()
    expires_at = now + get_mutation_retention_delta()

    parsed_client_request_id: uuid.UUID | None = None
    if client_request_id:
        try:
            parsed_client_request_id = uuid.UUID(str(client_request_id))
        except ValueError:
            parsed_client_request_id = None

    payload = {
        "request": request_payload,
        "customerId": customer_id,
        "subscriptionId": subscription_id,
    }

    with _connect() as connection:
        with connection.transaction():
            if parsed_client_request_id is not None:
                existing = _find_existing_by_client_request_id(connection, parsed_client_request_id)
                if existing:
                    return _to_envelope(existing)

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO mutation_jobs (
                        id,
                        command_type,
                        ordering_key,
                        payload,
                        status,
                        attempt_count,
                        max_attempts,
                        next_attempt_at,
                        created_by_user,
                        created_by_roles,
                        customer_id,
                        subscription_id,
                        client_request_id,
                        created_at,
                        updated_at,
                        expires_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        'queued',
                        0,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    RETURNING *
                    """,
                    (
                        mutation_id,
                        command_type,
                        ordering_key,
                        Json(payload),
                        max_attempts,
                        now,
                        created_by_user,
                        created_by_roles or [],
                        customer_id,
                        subscription_id,
                        parsed_client_request_id,
                        now,
                        now,
                        expires_at,
                    ),
                )
                created = cursor.fetchone()

            _record_event(
                connection,
                mutation_id=mutation_id,
                event_type="queued",
                previous_status=None,
                next_status="queued",
                attempt_count=0,
                metadata={
                    "commandType": command_type,
                    "orderingKey": ordering_key,
                },
            )

    return _to_envelope(created)



def list_mutations(
    *,
    status_filter: str | None,
    customer_id: int | None,
    created_by_user: str | None,
    limit: int | None,
    cursor: str | None,
) -> dict[str, Any]:
    ensure_store_enabled()

    safe_limit = _normalize_limit(limit)
    safe_cursor = _coerce_cursor(cursor)

    conditions: list[str] = []
    parameters: list[Any] = []

    if status_filter:
        conditions.append("status = %s")
        parameters.append(status_filter)

    if customer_id is not None:
        conditions.append("customer_id = %s")
        parameters.append(int(customer_id))

    if created_by_user:
        conditions.append("created_by_user = %s")
        parameters.append(created_by_user)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT *
        FROM mutation_jobs
        {where_clause}
        ORDER BY created_at DESC
        OFFSET %s
        LIMIT %s
    """

    with _connect() as connection:
        with connection.cursor() as cursor_handle:
            cursor_handle.execute(query, (*parameters, safe_cursor, safe_limit + 1))
            rows = cursor_handle.fetchall()

    has_more = len(rows) > safe_limit
    items = rows[:safe_limit]

    return {
        "items": [_to_envelope(item) for item in items],
        "nextCursor": str(safe_cursor + safe_limit) if has_more else None,
    }



def get_mutation(mutation_id: str) -> dict[str, Any]:
    ensure_store_enabled()

    try:
        parsed = uuid.UUID(mutation_id)
    except ValueError as error:
        raise MutationNotFoundError("Mutation not found") from error

    with _connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM mutation_jobs WHERE id = %s", (parsed,))
            row = cursor.fetchone()
            if not row:
                raise MutationNotFoundError("Mutation not found")

            cursor.execute(
                """
                SELECT
                    event_type,
                    previous_status,
                    next_status,
                    attempt_count,
                    error_code,
                    error_message,
                    metadata,
                    created_at
                FROM mutation_events
                WHERE mutation_id = %s
                ORDER BY created_at DESC
                """,
                (parsed,),
            )
            events = cursor.fetchall()

    payload = _to_envelope(row)
    payload["events"] = [
        {
            "eventType": item.get("event_type"),
            "previousStatus": item.get("previous_status"),
            "nextStatus": item.get("next_status"),
            "attemptCount": item.get("attempt_count"),
            "errorCode": item.get("error_code"),
            "errorMessage": item.get("error_message"),
            "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
            "createdAt": item.get("created_at").isoformat() if item.get("created_at") else None,
        }
        for item in events
    ]
    return payload



def summarize_mutations(*, customer_id: int | None, created_by_user: str | None) -> dict[str, Any]:
    ensure_store_enabled()

    conditions: list[str] = []
    parameters: list[Any] = []

    if customer_id is not None:
        conditions.append("customer_id = %s")
        parameters.append(int(customer_id))

    if created_by_user:
        conditions.append("created_by_user = %s")
        parameters.append(created_by_user)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT status, COUNT(*)::int AS total
        FROM mutation_jobs
        {where_clause}
        GROUP BY status
    """

    with _connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            rows = cursor.fetchall()

    counts = {"queued": 0, "dispatching": 0, "retry_scheduled": 0, "delivered": 0, "failed": 0, "cancelled": 0}
    total = 0
    for row in rows:
        status = str(row.get("status"))
        count = int(row.get("total") or 0)
        counts[status] = count
        total += count

    counts["total"] = total
    counts["pending"] = counts.get("queued", 0) + counts.get("dispatching", 0) + counts.get("retry_scheduled", 0)
    return counts



def request_retry(*, mutation_id: str, requested_by: str | None) -> dict[str, Any]:
    ensure_store_enabled()

    parsed = uuid.UUID(mutation_id)
    now = _utc_now()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM mutation_jobs WHERE id = %s FOR UPDATE",
                    (parsed,),
                )
                row = cursor.fetchone()
                if not row:
                    raise MutationNotFoundError("Mutation not found")

                current_status = str(row.get("status"))
                if current_status not in {"failed", "cancelled", "retry_scheduled", "queued"}:
                    raise MutationConflictError("Mutation cannot be retried in current state")

                cursor.execute(
                    """
                    UPDATE mutation_jobs
                    SET status = 'queued',
                        next_attempt_at = %s,
                        completed_at = NULL,
                        updated_at = %s,
                        cancel_reason = NULL
                    WHERE id = %s
                    RETURNING *
                    """,
                    (now, now, parsed),
                )
                updated = cursor.fetchone()

            _record_event(
                connection,
                mutation_id=parsed,
                event_type="retry_requested",
                previous_status=current_status,
                next_status="queued",
                attempt_count=int(updated.get("attempt_count") or 0),
                metadata={"requestedBy": requested_by},
            )

    return _to_envelope(updated)



def request_cancel(*, mutation_id: str, requested_by: str | None, reason: str | None) -> dict[str, Any]:
    ensure_store_enabled()

    parsed = uuid.UUID(mutation_id)
    now = _utc_now()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM mutation_jobs WHERE id = %s FOR UPDATE",
                    (parsed,),
                )
                row = cursor.fetchone()
                if not row:
                    raise MutationNotFoundError("Mutation not found")

                current_status = str(row.get("status"))
                if current_status in TERMINAL_STATUSES:
                    raise MutationConflictError("Mutation is already terminal")

                cursor.execute(
                    """
                    UPDATE mutation_jobs
                    SET status = 'cancelled',
                        cancel_reason = %s,
                        completed_at = %s,
                        updated_at = %s
                    WHERE id = %s
                    RETURNING *
                    """,
                    (reason, now, now, parsed),
                )
                updated = cursor.fetchone()

            _record_event(
                connection,
                mutation_id=parsed,
                event_type="cancel_requested",
                previous_status=current_status,
                next_status="cancelled",
                attempt_count=int(updated.get("attempt_count") or 0),
                metadata={"requestedBy": requested_by, "reason": reason},
            )

    return _to_envelope(updated)



def claim_due_mutations(*, batch_size: int) -> list[dict[str, Any]]:
    ensure_store_enabled()

    safe_batch_size = max(1, int(batch_size))

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    WITH due AS (
                        SELECT j.id
                        FROM mutation_jobs j
                        WHERE j.status IN ('queued', 'retry_scheduled')
                          AND j.next_attempt_at <= now()
                          AND NOT EXISTS (
                              SELECT 1
                              FROM mutation_jobs prev
                              WHERE prev.ordering_key = j.ordering_key
                                AND prev.created_at < j.created_at
                                AND prev.status NOT IN ('delivered', 'failed', 'cancelled')
                          )
                        ORDER BY j.created_at
                        FOR UPDATE SKIP LOCKED
                        LIMIT %s
                    )
                    UPDATE mutation_jobs j
                    SET status = 'dispatching',
                        attempt_count = j.attempt_count + 1,
                        first_attempt_at = COALESCE(j.first_attempt_at, now()),
                        last_attempt_at = now(),
                        updated_at = now()
                    FROM due
                    WHERE j.id = due.id
                    RETURNING j.*
                    """,
                    (safe_batch_size,),
                )
                claimed = cursor.fetchall()

            for row in claimed:
                _record_event(
                    connection,
                    mutation_id=row["id"],
                    event_type="dispatch_started",
                    previous_status="queued" if int(row.get("attempt_count") or 0) == 1 else "retry_scheduled",
                    next_status="dispatching",
                    attempt_count=int(row.get("attempt_count") or 0),
                )

    return claimed



def should_escalate(job: dict[str, Any]) -> bool:
    attempt_count = int(job.get("attempt_count") or 0)
    max_attempts = int(job.get("max_attempts") or get_mutation_max_attempts())
    if attempt_count >= max_attempts:
        return True

    created_at = job.get("created_at")
    if not isinstance(created_at, datetime):
        return False

    age_limit = timedelta(hours=get_mutation_max_age_hours())
    return _utc_now() - created_at >= age_limit



def mark_delivered(*, mutation_id: uuid.UUID, http_status: int | None) -> None:
    now = _utc_now()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE mutation_jobs
                    SET status = 'delivered',
                        failure_class = NULL,
                        last_error_code = NULL,
                        last_error_message = NULL,
                        last_http_status = %s,
                        completed_at = %s,
                        updated_at = %s,
                        next_attempt_at = %s
                    WHERE id = %s
                    RETURNING attempt_count
                    """,
                    (http_status, now, now, now, mutation_id),
                )
                row = cursor.fetchone()
                attempt_count = int(row.get("attempt_count") or 0) if row else 0

            _record_event(
                connection,
                mutation_id=mutation_id,
                event_type="delivered",
                previous_status="dispatching",
                next_status="delivered",
                attempt_count=attempt_count,
                metadata={"httpStatus": http_status},
            )



def mark_retry_scheduled(
    *,
    mutation_id: uuid.UUID,
    next_attempt_at: datetime,
    failure_class: str,
    error_code: str | None,
    error_message: str | None,
    http_status: int | None,
) -> None:
    now = _utc_now()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE mutation_jobs
                    SET status = 'retry_scheduled',
                        failure_class = %s,
                        last_error_code = %s,
                        last_error_message = %s,
                        last_http_status = %s,
                        next_attempt_at = %s,
                        updated_at = %s
                    WHERE id = %s
                    RETURNING attempt_count
                    """,
                    (
                        failure_class,
                        error_code,
                        error_message,
                        http_status,
                        next_attempt_at,
                        now,
                        mutation_id,
                    ),
                )
                row = cursor.fetchone()
                attempt_count = int(row.get("attempt_count") or 0) if row else 0

            _record_event(
                connection,
                mutation_id=mutation_id,
                event_type="retry_scheduled",
                previous_status="dispatching",
                next_status="retry_scheduled",
                attempt_count=attempt_count,
                error_code=error_code,
                error_message=error_message,
                metadata={"httpStatus": http_status, "nextAttemptAt": next_attempt_at.isoformat()},
            )



def mark_failed(
    *,
    mutation_id: uuid.UUID,
    failure_class: str,
    error_code: str | None,
    error_message: str | None,
    http_status: int | None,
) -> None:
    now = _utc_now()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE mutation_jobs
                    SET status = 'failed',
                        failure_class = %s,
                        last_error_code = %s,
                        last_error_message = %s,
                        last_http_status = %s,
                        completed_at = %s,
                        updated_at = %s
                    WHERE id = %s
                    RETURNING attempt_count
                    """,
                    (
                        failure_class,
                        error_code,
                        error_message,
                        http_status,
                        now,
                        now,
                        mutation_id,
                    ),
                )
                row = cursor.fetchone()
                attempt_count = int(row.get("attempt_count") or 0) if row else 0

            _record_event(
                connection,
                mutation_id=mutation_id,
                event_type="failed",
                previous_status="dispatching",
                next_status="failed",
                attempt_count=attempt_count,
                error_code=error_code,
                error_message=error_message,
                metadata={"httpStatus": http_status, "failureClass": failure_class},
            )



def cleanup_expired_mutations() -> int:
    ensure_store_enabled()

    with _connect() as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM mutation_jobs
                    WHERE status IN ('delivered', 'failed', 'cancelled')
                      AND expires_at < now()
                    """
                )
                deleted_count = cursor.rowcount

    LOGGER.info("Deleted %s expired mutation jobs", deleted_count)
    return int(deleted_count)
