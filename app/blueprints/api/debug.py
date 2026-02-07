from flask import Blueprint, session

from services import poc_state

BLUEPRINT_NAME = "debug_api"
URL_PREFIX = "/debug"

debug_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@debug_bp.post("/reset-poc-state")
def reset_poc_state() -> tuple[dict, int]:
    state = poc_state.reset_state(session)
    return {
        "status": "ok",
        "message": "POC state reset",
        "customers": state.get("customers", []),
        "call_queue": state.get("call_queue", {}),
        "call_session": state.get("call_session", {}),
    }, 200
