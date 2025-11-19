from datetime import datetime

from ..extensions import db


class Webhook(db.Model):
    __tablename__ = "webhooks"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    url = db.Column(db.String(512), nullable=False)
    event_type = db.Column(db.String(64), nullable=False)
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)
    last_response_code = db.Column(db.Integer, nullable=True)
    last_response_ms = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "event_type": self.event_type,
            "is_enabled": self.is_enabled,
            "last_response_code": self.last_response_code,
            "last_response_ms": self.last_response_ms,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

