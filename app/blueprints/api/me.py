from flask import Blueprint

from blueprints.api.common import get_current_user_context

BLUEPRINT_NAME = "me_api"

me_bp = Blueprint(BLUEPRINT_NAME, __name__)


@me_bp.get("/me")
def read_current_user() -> tuple[dict, int]:
    context = get_current_user_context()
    return context, 200
