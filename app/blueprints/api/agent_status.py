from flask import Blueprint, current_app, request, session

from blueprints.api.common import api_error, require_api_access
from services import teams_presence_sync

BLUEPRINT_NAME = "agent_status_api"
URL_PREFIX = "/agent-status"
SESSION_STATUS_KEY = "kiwi_agent_status"
DEFAULT_STATUS = "ready"
SUPPORTED_STATUSES = {"ready", "busy", "dnd", "brb", "away", "offline", "acw", "in_call"}
STATUS_ALIASES = {"break": "away"}


def normalize_status(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    normalized = STATUS_ALIASES.get(normalized, normalized)
    if normalized in SUPPORTED_STATUSES:
        return normalized
    return None

agent_status_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@agent_status_bp.before_request
def enforce_api_access():
    return require_api_access()


def get_current_status() -> str:
    current_status = normalize_status(session.get(SESSION_STATUS_KEY))
    if current_status:
        return current_status
    return DEFAULT_STATUS


@agent_status_bp.get("")
def read_agent_status() -> tuple[dict, int]:
    local_status = get_current_status()
    teams_presence = teams_presence_sync.fetch_teams_presence_status(session, current_app.config)

    teams_status = normalize_status(teams_presence.get("status"))
    teams_status_is_supported = bool(teams_status)

    resolved_status = teams_status if teams_status_is_supported else local_status
    source = "teams" if teams_status_is_supported else "local"

    if resolved_status != local_status:
        session[SESSION_STATUS_KEY] = resolved_status

    return (
        {
            "status": resolved_status,
            "source": source,
            "teams_sync": teams_presence,
        },
        200,
    )


@agent_status_bp.post("")
def update_agent_status() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    requested_status = normalize_status(payload.get("status"))

    if not requested_status:
        return api_error(
            400,
            "invalid_payload",
            "status must be one of the supported agent statuses",
            details={"allowed_statuses": sorted(SUPPORTED_STATUSES | set(STATUS_ALIASES))},
        )

    previous_status = get_current_status()
    session[SESSION_STATUS_KEY] = requested_status

    teams_sync_result = teams_presence_sync.sync_kiwi_status_to_teams(
        requested_status, session, current_app.config
    )

    return (
        {
            "status": requested_status,
            "previous_status": previous_status,
            "teams_sync": teams_sync_result,
        },
        200,
    )
