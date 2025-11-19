from celery import Celery

celery = Celery(__name__)


def make_celery(app):
    """
    Configure Celery to use the Flask app's settings and return the shared instance.
    """
    celery.conf.broker_url = app.config["CELERY_BROKER_URL"]
    celery.conf.result_backend = app.config.get("CELERY_RESULT_BACKEND")
    celery.conf.update(app.config.get("CELERY", {}))

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return super().__call__(*args, **kwargs)

    celery.Task = ContextTask
    celery.autodiscover_tasks(["app.tasks"])
    return celery

