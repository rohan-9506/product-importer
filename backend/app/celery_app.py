from celery import Celery

celery = Celery(__name__)

def make_celery(app):
    """
    Configure Celery to use the Flask app's settings and return the shared instance.
    """
    celery.conf.broker_url = app.config["CELERY_BROKER_URL"]
    celery.conf.result_backend = app.config.get("CELERY_RESULT_BACKEND")

    # IMPORTANT: load eager mode settings
    celery.conf.update(
        task_always_eager=app.config.get("CELERY_TASK_ALWAYS_EAGER", False),
        task_eager_propagates=app.config.get("CELERY_TASK_EAGER_PROPAGATES", False),
    )

    # ALSO load any extra Celery config if provided
    celery.conf.update(app.config.get("CELERY", {}))

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return super().__call__(*args, **kwargs)

    celery.Task = ContextTask

    # Autodiscover your tasks folder
    celery.autodiscover_tasks(["app.tasks"])
    return celery
