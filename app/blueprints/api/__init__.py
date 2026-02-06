from flask import Blueprint

BLUEPRINT_NAME = "api_v1"
API_V1_PREFIX = "/api/v1"

api_v1_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=API_V1_PREFIX)
_registered_children: set[str] = set()


def register_api_blueprint(child: Blueprint, **kwargs) -> None:
    child_key = f"{child.name}:{kwargs.get('url_prefix')}"
    if child_key in _registered_children:
        return
    api_v1_bp.register_blueprint(child, **kwargs)
    _registered_children.add(child_key)


__all__ = ["API_V1_PREFIX", "BLUEPRINT_NAME", "api_v1_bp", "register_api_blueprint"]
