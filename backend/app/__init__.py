from dotenv import load_dotenv
from flask import Flask

from .config import get_config
from .extensions import cors, db, migrate
from .api import register_blueprints
from .celery_app import celery, make_celery


def create_app(config_name: str | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    configuration = get_config(config_name)
    app.config.from_object(configuration)

    # Force eager mode for Render free tier
    app.config["CELERY_TASK_ALWAYS_EAGER"] = True
    app.config["CELERY_TASK_EAGER_PROPAGATES"] = True

    _register_extensions(app)
    register_blueprints(app)
    make_celery(app)

    with app.app_context():
        from .extensions import db
        db.create_all()

    return app



def create_celery_app(app: Flask | None = None):
    """
    Create a Celery app that shares configuration with Flask.
    """
    app = app or create_app()
    return make_celery(app)


def _register_extensions(app: Flask):
    cors.init_app(app, resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}})
    db.init_app(app)
    migrate.init_app(app, db)

