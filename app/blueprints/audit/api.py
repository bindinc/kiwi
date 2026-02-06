from __future__ import annotations

from flask import Blueprint, request

from db.repositories.audit_events import AuditEventsRepository


BLUEPRINT_NAME = "audit_events_api"
URL_PREFIX = "/audit-events"

audit_events_api_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
_audit_repo = AuditEventsRepository()


@audit_events_api_bp.get("")
def list_audit_events() -> tuple[dict, int]:
    person_id = request.args.get("personId")
    request_id = request.args.get("requestId")

    limit_value = request.args.get("limit")
    try:
        limit = int(limit_value) if limit_value else 50
    except ValueError:
        limit = 50
    limit = max(1, min(limit, 200))

    cursor_value = request.args.get("cursor")
    cursor = None
    if cursor_value:
        try:
            cursor = int(cursor_value)
        except ValueError:
            cursor = None

    events, next_cursor = _audit_repo.list_events(
        person_id=person_id,
        request_id=request_id,
        limit=limit,
        cursor=cursor,
    )

    return {
        "events": events,
        "nextCursor": next_cursor,
    }, 200
