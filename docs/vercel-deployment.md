# Vercel deployment

UGVoice deploys as one Vercel Services project:

- Vite/React frontend at `/`
- FastAPI backend at `/api`
- Remote Hugging Face inference; no model files are downloaded by Vercel
- External pooled PostgreSQL
- Direct browser uploads to DigitalOcean Spaces

## 1. Import the repository

Import `MosesHitanghu/UGVOICE` into Vercel. In project settings, select the
`Services` framework preset. The root `vercel.json` defines both services, so do
not set `frontend` or `backend` as the project root.

## 2. Configure PostgreSQL

Use a pooled PostgreSQL URL from a Vercel Marketplace provider, Neon, Supabase,
or an externally hosted PostgreSQL database. Add `DATABASE_URL` to Production,
Preview, and Development as appropriate. Keep preview and production databases
separate when possible.

Run schema setup once against each new database from a trusted workstation:

```bash
cd backend
DATABASE_URL="postgresql://..." UGVOICE_CREATE_DATABASE=false python deploy_setup.py
```

Do not run production database setup automatically for every preview build.

## 3. Configure Hugging Face

The local `backend/.env` currently contains a non-empty
`HF_UGVOICE_TOKEN`, but ignored files are never uploaded to Vercel. Add the token
as an encrypted Vercel variable named `HF_TOKEN`. It needs Inference Providers
permission. Never create a `VITE_` variable containing this token.

Set:

```text
UGVOICE_ML_PROVIDER=huggingface
HF_TOKEN=<secret>
HF_INFERENCE_TIMEOUT_SECONDS=25
HF_INFERENCE_MAX_ATTEMPTS=2
HF_ENABLE_EMBEDDINGS=true
```

Model IDs are configurable through `HF_SENTIMENT_MODEL`, `HF_SUMMARY_MODEL`, and
`HF_EMBEDDING_MODEL`. The defaults are shown by `/api/ml/status` without exposing
the token.

Each saved feedback records provider, inference mode, exact model IDs, latency,
and any fallback tasks. This makes remote model use auditable during a
presentation. BERTopic remains available only in the optional local ML
environment; the Vercel API does not claim to run BERTopic.

## 4. Configure direct uploads

Add the Spaces variables from `vercel.env.example`. Configure the Space's CORS
policy to allow `PUT` from the production and preview Vercel origins with these
request headers:

```text
Content-Type
x-amz-acl
```

The browser requests a short-lived signed URL from `/api/storage/presign`, sends
the file directly to Spaces, then sends only the resulting public URL to
FastAPI. This avoids Vercel's function request-body limit. Local development
continues to use multipart uploads through FastAPI.

## 5. Required environment variables

Copy the keys from `vercel.env.example` into Vercel Project Settings. Use
encrypted values for database credentials, Hugging Face, Spaces, and the
database setup token.

The frontend automatically uses `/api` in production, so
`VITE_API_BASE_URL` is optional. It can be set to `/api` explicitly if desired.

## 6. Verify

After deploying, verify:

```text
/api/health
/api/health/ready
/api/ml/status
/api/docs
```

Submit feedback and inspect its API response. A successful remote analysis has
`inference_provider = huggingface`, `inference_mode = remote-api`, model fields
prefixed with `huggingface:`, and `inference_fallback_used = false`. If a model
or token is unavailable, the request still succeeds using labelled fallbacks.

## Optional local presentation mode

Install `backend/requirements-ml.txt` and set:

```text
UGVOICE_ML_PROVIDER=local
UGVOICE_ML_ENABLED=true
```

This mode executes the local Transformers, SentenceTransformers, and BERTopic
pipeline for a technical demonstration. Do not install these dependencies in
the Vercel service.
