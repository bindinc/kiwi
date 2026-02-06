from flask import Blueprint

BLUEPRINT_NAME = "api_v1"
API_V1_PREFIX = "/api/v1"

api_v1_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=API_V1_PREFIX)


def register_api_blueprint(child: Blueprint, **kwargs) -> None:
    # Flask freezes a blueprint once it has been registered at least once.
    # During unit tests create_app() can run multiple times, so we treat
    # duplicate child registrations as idempotent no-ops.
    child_names = {blueprint.name for blueprint, _ in api_v1_bp._blueprints}  # pylint: disable=protected-access
    if child.name in child_names:
        return

    if getattr(api_v1_bp, "_got_registered_once", False):
        return

    api_v1_bp.register_blueprint(child, **kwargs)


__all__ = ["API_V1_PREFIX", "BLUEPRINT_NAME", "api_v1_bp", "register_api_blueprint"]
