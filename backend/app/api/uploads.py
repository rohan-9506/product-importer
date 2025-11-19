import os
import uuid

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import ImportJob
from ..tasks.import_csv import import_products_job

uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.post("/")
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    job_id = str(uuid.uuid4())
    file_path = os.path.join(upload_folder, f"{job_id}_{filename}")
    file.save(file_path)

    try:
        import_job = ImportJob(
            job_id=job_id,
            filename=filename,
            file_path=file_path,
            status="queued",
        )
        db.session.add(import_job)
        db.session.commit()          # ✅ commit is safe now
    except Exception as e:
        db.session.rollback()        # ❗ REQUIRED FIX
        return jsonify({"error": str(e)}), 400

    # Trigger Celery (eager mode will run it instantly)
    import_products_job.delay(job_id=job_id)

    return jsonify({"job_id": job_id}), 202
