from flask import Blueprint, current_app, request, session

from services import teams_presence_sync

BLUEPRINT_NAME = "agent_status_api"
URL_PREFIX = "/agent-status"
SESSION_STATUS_KEY = "kiwi_agent_status"
DEFAULT_STATUS = "ready"
ALLOWED_STATUSES = {"ready", "break", "offline", "busy", "acw"}

agent_status_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def get_current_status() -> str:
    current_status = session.get(SESSION_STATUS_KEY)
    if isinstance(current_status, str) and current_status in ALLOWED_STATUSES:
        return current_status
    return DEFAULT_STATUS


@agent_status_bp.get("")
def read_agent_status() -> tuple[dict, int]:
    local_status = get_current_status()
    teams_presence = teams_presence_sync.fetch_teams_presence_status(session, current_app.config)

    teams_status = teams_presence.get("status")
    teams_status_is_supported = isinstance(teams_status, str) and teams_status in ALLOWED_STATUSES

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
    requested_status = payload.get("status")

    if requested_status not in ALLOWED_STATUSES:
        return (
            {
                "error": "Invalid agent status",
                "allowed_statuses": sorted(ALLOWED_STATUSES),
            },
            400,
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
