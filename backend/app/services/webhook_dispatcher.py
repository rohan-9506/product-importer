import json
import time

import requests

from ..extensions import db
from ..models import Webhook


def dispatch_webhooks(event_type: str, payload: dict):
    webhooks = Webhook.query.filter_by(event_type=event_type, is_enabled=True).all()
    for webhook in webhooks:
        start = time.perf_counter()
        try:
            response = requests.post(
                webhook.url,
                data=json.dumps(payload),
                headers={"Content-Type": "application/json"},
                timeout=5,
            )
            webhook.last_response_code = response.status_code
        except requests.RequestException:
            webhook.last_response_code = None
        finally:
            webhook.last_response_ms = int((time.perf_counter() - start) * 1000)
    db.session.commit()

