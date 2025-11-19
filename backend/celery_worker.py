from app import create_app, create_celery_app

flask_app = create_app()
celery = create_celery_app(flask_app)


if __name__ == "__main__":
    celery.start()

