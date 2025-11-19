import csv
from decimal import Decimal
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from ..celery_app import celery
from ..extensions import db
from ..models import ImportJob, Product, Webhook
from ..services.webhook_dispatcher import dispatch_webhooks


@celery.task(name="import_products_job")
def import_products_job(job_id: str):
    job = ImportJob.query.filter_by(job_id=job_id).first()
    if not job:
        return

    job.status = "processing"
    job.processed_rows = 0
    db.session.commit()

    csv_path = Path(job.file_path)
    if not csv_path.exists():
        job.status = "failed"
        job.error_message = "Uploaded file not found"
        db.session.commit()
        return

    dispatch_webhooks("product.import.started", {"job_id": job.job_id, "filename": job.filename})

    try:
        total_rows = _count_rows(csv_path)
        job.total_rows = total_rows
        db.session.commit()

        with csv_path.open("r", newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            batch = []
            for row in reader:
                batch.append(_transform_row(row))
                if len(batch) >= 1000:
                    _upsert_batch(batch)
                    batch = []
                    job.processed_rows = (job.processed_rows or 0) + 1000
                    db.session.commit()
            if batch:
                _upsert_batch(batch)
                job.processed_rows = (job.processed_rows or 0) + len(batch)
                db.session.commit()

        job.status = "completed"
        db.session.commit()
        dispatch_webhooks("product.import.completed", {"job_id": job.job_id, "filename": job.filename})
    except Exception as exc:  # noqa: BLE001
        job.status = "failed"
        job.error_message = str(exc)
        db.session.commit()
        dispatch_webhooks(
            "product.import.failed",
            {"job_id": job.job_id, "filename": job.filename, "error": str(exc)},
        )
        raise


def _count_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8") as handle:
        return sum(1 for _ in handle) - 1  # discount header


def _transform_row(row: dict) -> dict:
    sku = row.get("sku") or row.get("SKU") or row.get("Sku")
    if not sku:
        raise ValueError("SKU column is required")
    return {
        "sku": sku.strip(),
        "sku_normalized": Product.normalize_sku(sku),
        "name": row.get("name") or row.get("Name") or "",
        "description": row.get("description") or row.get("Description"),
        "price": _safe_decimal(row.get("price") or row.get("Price")),
        "is_active": _parse_bool(row.get("is_active") or row.get("active") or "true"),
    }


def _upsert_batch(batch: list[dict]):
    if not batch:
        return
    stmt = insert(Product).values(batch)
    update_cols = {
        "sku": stmt.excluded.sku,
        "name": stmt.excluded.name,
        "description": stmt.excluded.description,
        "price": stmt.excluded.price,
        "is_active": stmt.excluded.is_active,
        "sku_normalized": stmt.excluded.sku_normalized,
    }
    stmt = stmt.on_conflict_do_update(index_elements=["sku_normalized"], set_=update_cols)
    db.session.execute(stmt)
    db.session.commit()


def _safe_decimal(value):
    try:
        return Decimal(str(value)) if value not in (None, "", "null") else None
    except Exception:  # noqa: BLE001
        return None


def _parse_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "active"}