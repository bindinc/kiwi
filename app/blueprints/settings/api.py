from flask import Blueprint

BLUEPRINT_NAME = "settings_api"
URL_PREFIX = "/settings"

settings_api_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
