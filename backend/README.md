# UGVoice Backend

FastAPI and SQLAlchemy API for UGVoice.

## Local development

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and configure the database and service keys.
4. Run `uvicorn main:app --reload --port 9000`.

The API health endpoint is available at `/health`.

## Deployment

- Vercel uses `vercel.json` and remote Hugging Face inference.
- Run `python deploy_setup.py` against the production database before serving traffic.
- Set `UGVOICE_ADMIN_PASSWORD` before seeding a new database so the configured primary administrator can be created securely.
