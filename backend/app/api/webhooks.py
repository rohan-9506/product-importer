import time

import requests
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Webhook

webhooks_bp = Blueprint("webhooks", __name__)


@webhooks_bp.get("/")
def list_webhooks():
    webhooks = Webhook.query.order_by(Webhook.created_at.desc()).all()
    return jsonify([w.to_dict() for w in webhooks])


@webhooks_bp.post("/")
def create_webhook():
    payload = request.get_json() or {}
    webhook = Webhook(
        name=payload["name"],
        url=payload["url"],
        event_type=payload["event_type"],
        is_enabled=payload.get("is_enabled", True),
    )
    db.session.add(webhook)
    db.session.commit()
    return jsonify(webhook.to_dict()), 201


@webhooks_bp.put("/<int:webhook_id>")
def update_webhook(webhook_id: int):
    webhook = Webhook.query.get_or_404(webhook_id)
    payload = request.get_json() or {}
    for field in ["name", "url", "event_type", "is_enabled"]:
        if field in payload:
            setattr(webhook, field, payload[field])
    db.session.commit()
    return jsonify(webhook.to_dict())


@webhooks_bp.delete("/<int:webhook_id>")
def delete_webhook(webhook_id: int):
    webhook = Webhook.query.get_or_404(webhook_id)
    db.session.delete(webhook)
    db.session.commit()
    return ("", 204)


@webhooks_bp.post("/<int:webhook_id>/test")
def test_webhook(webhook_id: int):
    webhook = Webhook.query.get_or_404(webhook_id)
    payload = request.get_json() or {}
    start = time.perf_counter()
    try:
        response = requests.post(
            webhook.url,
            json=payload or {"event": webhook.event_type, "test": True},
            timeout=10,
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        webhook.last_response_code = response.status_code
        webhook.last_response_ms = elapsed_ms
        db.session.commit()
        return jsonify({"status_code": response.status_code, "elapsed_ms": elapsed_ms})
    except requests.RequestException as exc:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        webhook.last_response_code = None
        webhook.last_response_ms = elapsed_ms
        db.session.commit()
        return jsonify({"error": str(exc), "elapsed_ms": elapsed_ms}), 502

