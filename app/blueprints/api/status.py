from datetime import datetime, timezone

from flask import Blueprint

BLUEPRINT_NAME = "api_status"

status_bp = Blueprint(BLUEPRINT_NAME, __name__)


def build_rate_limit_snapshot() -> dict:
    return {
        "enabled": False,
        "limit": None,
        "remaining": None,
        "reset_seconds": None,
        "used": None,
    }


@status_bp.get("/status")
def status() -> tuple[dict, int]:
    payload = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rate_limit": build_rate_limit_snapshot(),
    }
    return payload, 200
