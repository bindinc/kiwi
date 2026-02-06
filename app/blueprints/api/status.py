from datetime import datetime, timezone

from flask import Blueprint

from db.pool import get_pool, ping_database
from db.repositories.outbound_jobs import OutboundJobsRepository

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


def build_db_snapshot() -> dict:
    pool = get_pool()
    if pool is None:
        return {"enabled": False, "healthy": False}

    return {"enabled": True, "healthy": ping_database()}


def build_queue_snapshot() -> dict:
    pool = get_pool()
    if pool is None:
        return {"enabled": False, "healthy": False, "queued": 0, "processing": 0, "dead_letter": 0}

    repository = OutboundJobsRepository()
    try:
        counters = repository.build_health_snapshot()
    except Exception:
        return {
            "enabled": True,
            "healthy": False,
            "queued": 0,
            "processing": 0,
            "dead_letter": 0,
        }

    return {
        "enabled": True,
        "healthy": True,
        "queued": counters["queued"],
        "processing": counters["processing"],
        "dead_letter": counters["dead_letter"],
    }


@status_bp.get("/status")
def status() -> tuple[dict, int]:
    payload = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db": build_db_snapshot(),
        "queue": build_queue_snapshot(),
        "rate_limit": build_rate_limit_snapshot(),
    }
    return payload, 200
