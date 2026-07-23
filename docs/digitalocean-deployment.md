# DigitalOcean App Platform deployment

The repository contains a deployable App Platform specification at
`.do/app.yaml`. It creates these components:

- `web`: Vite/React static site served through DigitalOcean's CDN.
- `api`: lightweight FastAPI web service mounted at `/api`.
- `database-setup`: pre-deploy schema and Uganda reference-data job.
- `ugvoice-db`: production PostgreSQL database.

The production database in the specification is billable. Review the selected
database and application instance plans before creating the app.

## 1. Create a Space

Create a DigitalOcean Space for post thumbnails and PDF attachments. Enable its
CDN if public assets should use the CDN hostname. Generate a Spaces access key,
then add these encrypted runtime variables to the `api` component:

| Variable | Example |
| --- | --- |
| `SPACES_REGION` | `fra1` |
| `SPACES_BUCKET` | `ugvoice-production` |
| `SPACES_KEY` | Spaces access-key ID |
| `SPACES_SECRET` | Spaces secret key |
| `SPACES_CDN_ENDPOINT` | `https://ugvoice-production.fra1.cdn.digitaloceanspaces.com` |

The app specification intentionally does not contain placeholder credentials.
Until these variables are configured, upload requests return HTTP 503 rather
than writing data to ephemeral application storage.

## 2. Create the application

Connect DigitalOcean App Platform to the `MosesHitanghu/UGVOICE` GitHub
repository and create the app using `.do/app.yaml`, or run:

```bash
doctl apps create --spec .do/app.yaml
```

The `/api` route is trimmed by App Platform before it reaches FastAPI. For
example, `/api/users` reaches the backend's `/users` route. The frontend is built
with `VITE_API_BASE_URL=/api`, keeping browser requests same-origin.

## 3. Add secrets

Add these as encrypted runtime variables on the API component:

- `SPACES_KEY`
- `SPACES_SECRET`
- `UGVOICE_DB_SETUP_TOKEN`
- `HF_TOKEN` only if an ML component is enabled

Do not store secret values in `.do/app.yaml` or commit a `.env` file.

## 4. Verify the deployment

Check the following endpoints after deployment:

```text
/api/health
/api/health/ready
/api/docs
```

`/api/health` is used for container liveness. `/api/health/ready` additionally
checks PostgreSQL connectivity.

## Database lifecycle

`database-setup` runs `backend/deploy_setup.py` before each deployment. The
operation is idempotent and applies the existing schema compatibility functions
plus Uganda reference data. Web-service startup does not alter schema in cloud
deployments, avoiding migration races when multiple instances start.

The backend reads DigitalOcean's bindable `DATABASE_URL`. Local development
continues to use the existing localhost connection when that variable is absent.

## ML deployment

The API installs `requirements.txt`, which excludes PyTorch, Transformers, and
BERTopic. It uses lightweight summary and sentiment fallbacks, keeping image
size, startup time, and memory use appropriate for App Platform.

Advanced ML dependencies are in `requirements-ml.txt`. Run them in a separate
worker or job with more memory and set `UGVOICE_ML_ENABLED=true` only on that
component. Do not enable the full ML stack on the 1 GB API service.

## Scaling

Start with one `apps-s-1vcpu-1gb` API instance. After observing database and API
metrics, increase instance count or enable autoscaling. The database pool defaults
to five persistent connections plus five overflow connections per API instance;
adjust `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` before scaling to many instances.
