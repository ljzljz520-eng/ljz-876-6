"""Flask application factory for the children's coding quest platform."""
from __future__ import annotations

import os

from flask import Flask

from . import routes_auth, routes_child, routes_parent, routes_teacher
from .auth import load_logged_in_user
from .db import close_db, init_db


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
        DATABASE=os.environ.get(
            "DATABASE_PATH",
            os.path.join(os.getcwd(), "instance", "coding_quest.sqlite3"),
        ),
    )
    if test_config:
        app.config.update(test_config)

    app.teardown_appcontext(close_db)
    app.before_request(load_logged_in_user)
    app.cli.command("init-db")(init_db_command)

    app.register_blueprint(routes_auth.bp)
    app.register_blueprint(routes_child.bp)
    app.register_blueprint(routes_parent.bp)
    app.register_blueprint(routes_teacher.bp)

    @app.context_processor
    def inject_helpers():
        from .levels import CONCEPT_LABELS
        return {"CONCEPT_LABELS": CONCEPT_LABELS}

    @app.template_filter("stars")
    def stars_filter(value: int) -> str:
        value = int(value or 0)
        return "★" * value + "☆" * (3 - value)

    with app.app_context():
        init_db()

    return app


def init_db_command() -> None:
    init_db()
    print("数据库已初始化。")
