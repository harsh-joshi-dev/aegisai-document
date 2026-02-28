# Deploying Aegis AI on Render

## Architecture on Render

| Service | Type | Description |
|---------|------|-------------|
| **aegis-backend** | Web Service (Node) | Express API server |
| **aegis-worker** | Background Worker | BullMQ document processor |
| **aegis-frontend** | Static Site | React SPA (Vite build) |
| **aegis-db** | PostgreSQL 16 | Primary database with pgvector |
| **aegis-redis** | Redis | Job queue for BullMQ |

---

## Quick Start (Blueprint)

1. Push this repo to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect your repo and select the branch.
4. Render reads `render.yaml` and creates all services automatically.
5. Set the required environment variables (see below).
6. Deploy.

---

## Environment Variables

After the blueprint creates your services, configure these on each service:

### Required (Backend + Worker)

| Variable | Where to set | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Auto-linked | Provided by Render PostgreSQL |
| `REDIS_URL` | Auto-linked | Provided by Render Redis |
| `SESSION_SECRET` | Auto-generated | Random string for session signing |
| `OPENAI_API_KEY` | Manual | Your OpenAI API key |
| `GOOGLE_CLIENT_ID` | Manual | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Manual | Google OAuth client secret |

### Required (Backend only)

| Variable | Notes |
|----------|-------|
| `FRONTEND_URL` | Auto-linked from frontend service URL |
| `CORS_ORIGIN` | Same as `FRONTEND_URL` |
| `BACKEND_URL` | Your backend service URL (e.g. `https://aegis-backend.onrender.com`) |

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth 2.0 Client ID.
3. Add authorized redirect URI: `https://<your-backend>.onrender.com/api/auth/google/callback`
4. Add authorized JavaScript origin: `https://<your-frontend>.onrender.com`
5. Copy Client ID and Client Secret to Render env vars.

### Frontend

The frontend Static Site uses rewrite rules in `render.yaml` to proxy `/api/*` requests to the backend. Set `VITE_API_URL` to empty string `""` (default) so the frontend uses relative URLs.

If your backend is on a different domain, set `VITE_API_URL` to the full backend URL.

### Optional

| Variable | Purpose |
|----------|---------|
| `GOOGLE_PLACES_API_KEY` | Service provider search |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `FROM_EMAIL` | Email notifications |
| `SARVAM_API_KEY` | Indian language AI (voice/vision) |
| `ULI_BASE_URL` / `ULI_CLIENT_ID` / `ULI_CLIENT_SECRET` | ULI SME lending integration |
| `FIELD_ENCRYPTION_KEY` | Field-level encryption (auto-generated) |

---

## Post-Deployment Checklist

- [ ] Verify `/health` returns `{ "status": "ok" }` on the backend
- [ ] Database auto-migrates on first backend startup (schema created via `initializeDatabase()`)
- [ ] Google OAuth callback URL matches your backend URL
- [ ] Frontend loads and redirects to login page
- [ ] Upload a test document to verify end-to-end flow
- [ ] Check worker logs to confirm BullMQ is processing jobs

---

## pgvector Note

Render's managed PostgreSQL does **not** include pgvector by default. The app gracefully handles this — vector search falls back to text-based search. If you need vector similarity search:

1. Use Render's PostgreSQL with the pgvector add-on (if available), or
2. Use an external PostgreSQL provider with pgvector (e.g. Supabase, Neon), or
3. The app works fully without it — just without semantic vector search.

---

## Scaling

- **Backend**: Scale horizontally via Render's instance count.
- **Worker**: Scale independently. Add more worker instances for higher document processing throughput.
- **Frontend**: Render CDN handles scaling automatically for static sites.
- **Database**: Upgrade the PostgreSQL plan as data grows.
- **Redis**: Upgrade if job queues grow large.

---

## Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL (requires Docker)
cd apps/backend && docker compose -f docker-compose.dev.yml up -d

# Copy env file
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your local values

# Start both frontend and backend
npm run dev
```

---

## Docker (On-Premise / Self-Hosted)

Docker files are included for on-premise deployment:

- `apps/backend/Dockerfile.onprem` — Backend image
- `apps/web/Dockerfile` — Frontend image (nginx)
- `apps/web/nginx.conf` — nginx config with API proxy
- `apps/backend/docker-compose.onprem.yml` — Full stack compose

```bash
cd apps/backend
docker compose -f docker-compose.onprem.yml up --build
```
