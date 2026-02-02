import os

from flask import Flask, redirect, render_template, request, session, url_for
from flask_oidc import OpenIDConnect
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix

import auth


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


def configure_app(app: Flask) -> None:
    client_secrets_path = os.environ.get("OIDC_CLIENT_SECRETS", DEFAULT_CLIENT_SECRETS)
    explicit_redirect_uri = os.environ.get("OIDC_REDIRECT_URI")
    fallback_redirect_uri = auth.get_redirect_uri_from_secrets(client_secrets_path)
    callback_route = auth.get_callback_route(explicit_redirect_uri or fallback_redirect_uri)
    session_type = os.environ.get("SESSION_TYPE", "filesystem")
    session_dir = os.environ.get("SESSION_FILE_DIR", "/tmp/flask_session")

    app.config.update(
        SECRET_KEY=os.environ.get(
            "FLASK_SECRET_KEY", "development-secret-key-change-in-production"
        ),
        OIDC_CLIENT_SECRETS=client_secrets_path,
        OIDC_SCOPES="openid email profile User.Read",
        OIDC_USER_INFO_ENABLED=True,
        SESSION_TYPE=session_type,
        SESSION_FILE_DIR=session_dir,
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
    )

    if explicit_redirect_uri:
        app.config["OIDC_OVERWRITE_REDIRECT_URI"] = explicit_redirect_uri
    if callback_route:
        app.config["OIDC_CALLBACK_ROUTE"] = callback_route

    if session_type == "filesystem":
        os.makedirs(session_dir, exist_ok=True)


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    configure_app(app)
    Session(app)

    prefix = os.environ.get("APPLICATION_PREFIX", "")
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix=prefix)

    oidc_base_path = auth.normalize_base_path(prefix)
    oidc = OpenIDConnect(app, prefix=oidc_base_path or None)

    @app.before_request
    def update_oidc_redirect_uri() -> None:
        if os.environ.get("OIDC_REDIRECT_URI"):
            return

        redirect_uri = auth.build_oidc_redirect_uri(request.host_url, request.script_root)
        if redirect_uri:
            app.config["OIDC_OVERWRITE_REDIRECT_URI"] = redirect_uri

    @app.route("/")
    def index() -> str:
        if not oidc.user_loggedin:
            login_url = url_for("oidc_auth.login", next=request.url)
            return redirect(login_url)

        profile = session.get("oidc_auth_profile", {})
        roles = auth.get_user_roles(session)
        identity = auth.build_user_identity(profile)

        if not auth.user_has_access(roles):
            return (
                render_template(
                    "base/access_denied.html",
                    user_full_name=identity["full_name"],
                    user_email=identity["email"],
                    user_roles=roles,
                    allowed_roles=sorted(auth.ALLOWED_ROLES),
                    logout_url=url_for(
                        "oidc_auth.logout", next=url_for("index", _external=True)
                    ),
                ),
                403,
            )

        profile_image = auth.get_profile_image(session)
        return render_template(
            "base/index.html",
            user_full_name=identity["full_name"],
            user_first_name=identity["first_name"],
            user_last_name=identity["last_name"],
            user_initials=identity["initials"],
            user_profile_image=profile_image,
        )

    return app


app = create_app()
