## Acme Product Importer

Production-scale CSV importer for 500k+ product rows with a Flask API, Celery worker, PostgreSQL storage, and a responsive React UI.

### Features
- **CSV ingestion with progress tracking:** Upload huge files from the UI, stream to disk, and process asynchronously via Celery + Redis. Users can poll `/api/jobs/{id}` for live status updates, including processed counts and failure reasons.
- **Product management dashboard:** Filter by SKU/name/description/status, paginate results, inline create/update, and guarded delete/bulk delete actions.
- **Webhook management:** Configure multiple endpoints, toggle enablement, fire test pings, and view last response metrics. Import lifecycle events automatically fan out to subscribed hooks.
- **Deployment-ready layout:** Backend and frontend are isolated (`backend/`, `frontend/`) for straight-forward hosting on Render/Fly/Heroku + any static host/CDN.

### Tech Stack
- **Backend:** Flask, SQLAlchemy, Alembic-ready DB layer, Celery workers, Redis broker, PostgreSQL (recommended).
- **Frontend:** React + Vite + plain CSS (no utility frameworks) for a clean dashboard experience.
- **Other:** Requests for outbound webhooks, `storage/uploads` staging directory for queued CSV files.

### Local Development
1. **Backend**
   ```bash
   cd backend
   python -m venv .venv && .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env  # create and adjust credentials
   flask db upgrade      # after generating migrations
   flask run             # API on http://localhost:5000
   ```
   Run the Celery worker in a separate terminal:
   ```bash
   cd backend
   .venv\Scripts\activate
   celery -A celery_worker.celery worker --loglevel=info
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev  # http://localhost:5173
   ```
   Configure `VITE_API_URL` (or rely on the default `http://localhost:5000/api`) when pointing the UI to a remote backend.

### Deployment Notes
- Provision PostgreSQL + Redis (Render, Fly, Railway, etc.).
- Upload static React build (`npm run build`) to Netlify/Vercel or serve via Flask/NGINX.
- For Heroku/Render, ensure the worker dyno/process runs `celery -A celery_worker.celery worker` and set `FLASK_ENV=production`, `DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CORS_ORIGINS`, and `UPLOAD_FOLDER`.

### API Highlights
- `POST /api/uploads/` → accept CSV, create `ImportJob`, enqueue Celery task.
- `GET /api/jobs/{job_id}` → poll progress (status, processed rows, failure reason).
- `CRUD /api/products/` + `POST /api/products/bulk-delete` → manage catalog.
- `CRUD /api/webhooks/` + `POST /api/webhooks/{id}/test` → configure outbound hooks.

### CSV Expectations
Columns accepted: `sku`, `name`, `description`, `price`, `is_active`. Additional columns are ignored. SKUs are deduplicated case-insensitively via the `sku_normalized` index, so re-imports overwrite prior records atomically.

---
Questions or deployment blockers? Open an issue or ping me.***

