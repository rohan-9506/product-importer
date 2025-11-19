from flask import Blueprint, jsonify

from ..models import ImportJob

jobs_bp = Blueprint("jobs", __name__)


@jobs_bp.get("/<string:job_id>")
def get_job(job_id: str):
    job = ImportJob.query.filter_by(job_id=job_id).first_or_404()
    return jsonify(job.to_dict())

