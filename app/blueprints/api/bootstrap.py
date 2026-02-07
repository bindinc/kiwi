from flask import Blueprint, session

from services import poc_catalog, poc_state

BLUEPRINT_NAME = "bootstrap_api"

bootstrap_bp = Blueprint(BLUEPRINT_NAME, __name__)


@bootstrap_bp.get("/bootstrap")
def read_bootstrap_state() -> tuple[dict, int]:
    state = poc_state.get_state_copy(session)

    payload = {
        "customers": state.get("customers", []),
        "call_queue": state.get("call_queue", {}),
        "call_session": state.get("call_session", {}),
        "last_call_session": state.get("last_call_session"),
        "catalog": poc_catalog.get_catalog_bootstrap(),
    }

    return payload, 200
