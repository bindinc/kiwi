from flask import Flask
from flask_oidc import OpenIDConnect

from blueprints.address_search import address_search_api_bp, address_search_pages_bp
from blueprints.api import api_v1_bp, register_api_blueprint
from blueprints.api.agent_status import agent_status_bp
from blueprints.api.status import status_bp
from blueprints.home import create_main_blueprint
from blueprints.settings import settings_api_bp, settings_pages_bp


def register_blueprints(app: Flask, oidc: OpenIDConnect) -> None:
    register_api_blueprint(status_bp)
    register_api_blueprint(agent_status_bp)
    register_api_blueprint(settings_api_bp)
    register_api_blueprint(address_search_api_bp)

    app.register_blueprint(create_main_blueprint(oidc))
    app.register_blueprint(api_v1_bp)
    app.register_blueprint(settings_pages_bp)
    app.register_blueprint(address_search_pages_bp)
