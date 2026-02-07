from flask import Blueprint
from blueprints.api.common import require_api_access

BLUEPRINT_NAME = "api_v1"
API_V1_PREFIX = "/api/v1"

api_v1_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=API_V1_PREFIX)
_registered_children: set[str] = set()


@api_v1_bp.before_request
def enforce_api_access():
    return require_api_access()


def register_api_blueprint(child: Blueprint, **kwargs) -> None:
    child_key = f"{child.name}:{kwargs.get('url_prefix')}"
    if child_key in _registered_children:
        return
    api_v1_bp.register_blueprint(child, **kwargs)
    _registered_children.add(child_key)


__all__ = ["API_V1_PREFIX", "BLUEPRINT_NAME", "api_v1_bp", "register_api_blueprint"]
