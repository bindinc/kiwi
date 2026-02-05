from flask import Blueprint

BLUEPRINT_NAME = "settings_personal"
URL_PREFIX = "/personal"

personal_settings_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
