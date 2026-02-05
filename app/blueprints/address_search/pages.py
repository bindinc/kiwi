from flask import Blueprint

BLUEPRINT_NAME = "address_search_pages"
URL_PREFIX = "/address-search"

address_search_pages_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
