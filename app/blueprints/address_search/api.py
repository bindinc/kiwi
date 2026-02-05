from flask import Blueprint

BLUEPRINT_NAME = "address_search_api"
URL_PREFIX = "/address-search"

address_search_api_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
