from flask import Blueprint

from .personal import personal_settings_bp

BLUEPRINT_NAME = "settings_pages"
URL_PREFIX = "/settings"

settings_pages_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
settings_pages_bp.register_blueprint(personal_settings_bp)
