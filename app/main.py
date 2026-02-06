import os
import uuid

from flask import Flask, g, request
from flask_oidc import OpenIDConnect
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix

import auth
from blueprints.registry import register_blueprints
from db.runtime import initialize_database


class PrefixMiddleware:
    """WSGI middleware to handle URL prefix from reverse proxy."""

    def __init__(self, app, prefix=""):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        # Check for X-Forwarded-Prefix header from gateway
        prefix = environ.get("HTTP_X_FORWARDED_PREFIX", self.prefix)
        if prefix:
            environ["SCRIPT_NAME"] = prefix
            # Strip prefix from PATH_INFO if present
            path_info = environ.get("PATH_INFO", "")
            if path_info.startswith(prefix):
                environ["PATH_INFO"] = path_info[len(prefix):] or "/"
        return self.app(environ, start_response)


APP_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CLIENT_SECRETS = os.path.join(APP_DIR, "client_secrets.json")
FALLBACK_CLIENT_SECRETS = os.path.join(os.path.dirname(APP_DIR), "client_secrets.example.json")
DEFAULT_OIDC_SCOPES = "openid email profile User.Read"


def configure_app(app: Flask) -> None:
    client_secrets_path = os.environ.get("OIDC_CLIENT_SECRETS", DEFAULT_CLIENT_SECRETS)
    if not os.path.exists(client_secrets_path) and os.path.exists(FALLBACK_CLIENT_SECRETS):
        client_secrets_path = FALLBACK_CLIENT_SECRETS
    explicit_redirect_uri = os.environ.get("OIDC_REDIRECT_URI")
    fallback_redirect_uri = auth.get_redirect_uri_from_secrets(client_secrets_path)
    callback_route = auth.get_callback_route(explicit_redirect_uri or fallback_redirect_uri)
    session_type = os.environ.get("SESSION_TYPE", "filesystem")
    session_dir = os.environ.get("SESSION_FILE_DIR", "/tmp/flask_session")
    oidc_scopes = os.environ.get("OIDC_SCOPES", DEFAULT_OIDC_SCOPES)

    app.config.update(
        SECRET_KEY=os.environ.get(
            "FLASK_SECRET_KEY", "development-secret-key-change-in-production"
        ),
        OIDC_CLIENT_SECRETS=client_secrets_path,
        OIDC_SCOPES=oidc_scopes,
        OIDC_USER_INFO_ENABLED=True,
        SESSION_TYPE=session_type,
        SESSION_FILE_DIR=session_dir,
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
        OIDC_POST_LOGOUT_REDIRECT_URI=os.environ.get("OIDC_POST_LOGOUT_REDIRECT_URI"),
    )

    if explicit_redirect_uri:
        app.config["OIDC_OVERWRITE_REDIRECT_URI"] = explicit_redirect_uri
    if callback_route:
        app.config["OIDC_CALLBACK_ROUTE"] = callback_route

    if session_type == "filesystem":
        os.makedirs(session_dir, exist_ok=True)


def configure_oidc(app: Flask, prefix: str) -> OpenIDConnect:
    oidc_base_path = auth.normalize_base_path(prefix)
    oidc = OpenIDConnect(app, prefix=oidc_base_path or None)

    @app.before_request
    def update_oidc_redirect_uri() -> None:
        if os.environ.get("OIDC_REDIRECT_URI"):
            return

        redirect_uri = auth.build_oidc_redirect_uri(request.host_url, request.script_root)
        if redirect_uri:
            app.config["OIDC_OVERWRITE_REDIRECT_URI"] = redirect_uri

    return oidc


def configure_request_correlation(app: Flask) -> None:
    """Attach correlation ids to each request/response cycle."""

    @app.before_request
    def assign_correlation_id() -> None:
        correlation_id = request.headers.get("X-Correlation-Id")
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        g.correlation_id = correlation_id

    @app.after_request
    def add_correlation_header(response):
        correlation_id = getattr(g, "correlation_id", None)
        if correlation_id:
            response.headers["X-Correlation-Id"] = correlation_id
        return response


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    configure_app(app)
    Session(app)
    initialize_database()
    configure_request_correlation(app)

    prefix = os.environ.get("APPLICATION_PREFIX", "")
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix=prefix)

    oidc = configure_oidc(app, prefix)
    register_blueprints(app, oidc)

    return app


app = create_app()
