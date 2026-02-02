import os

from flask import Flask, render_template


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


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    @app.route("/")
    def index() -> str:
        return render_template("base/index.html")

    # Get prefix from environment variable (for container configuration)
    prefix = os.environ.get("APPLICATION_PREFIX", "")

    # Wrap app with prefix middleware
    app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix=prefix)

    return app


app = create_app()
