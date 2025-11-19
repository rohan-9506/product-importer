from flask import Blueprint

from .products import products_bp
from .uploads import uploads_bp
from .jobs import jobs_bp
from .webhooks import webhooks_bp


def register_blueprints(app):
    api_bp = Blueprint("api", __name__, url_prefix="/api")
    api_bp.register_blueprint(products_bp, url_prefix="/products")
    api_bp.register_blueprint(uploads_bp, url_prefix="/uploads")
    api_bp.register_blueprint(jobs_bp, url_prefix="/jobs")
    api_bp.register_blueprint(webhooks_bp, url_prefix="/webhooks")
    app.register_blueprint(api_bp)

