from flask import Flask, render_template


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    @app.route("/")
    def index() -> str:
        return render_template("base/index.html")

    return app


app = create_app()
