from flask import Blueprint

BLUEPRINT_NAME = "api_v1"
API_V1_PREFIX = "/api/v1"

api_v1_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=API_V1_PREFIX)


def register_api_blueprint(child: Blueprint, **kwargs) -> None:
    api_v1_bp.register_blueprint(child, **kwargs)


__all__ = ["API_V1_PREFIX", "BLUEPRINT_NAME", "api_v1_bp", "register_api_blueprint"]
