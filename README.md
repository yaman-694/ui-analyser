## UI Analyzer

AI-powered website UI analysis platform. Monorepo with:

- apps/frontend: Next.js 15 + Clerk auth
- apps/api: Express + TypeScript (MongoDB + Redis)
- apps/agent: FastAPI + Playwright + LLM (OpenAI or Gemini)
- docker-compose + Caddy for local/edge reverse proxy

### What it does
- Captures desktop and mobile screenshots with Playwright
- Optionally fetches Lighthouse metrics via PageSpeed Insights (PSI)
- Uses an LLM to evaluate UX/UI heuristics and returns actionable issues

---

## Quick links
- API base: http://localhost:3001/api/v1
- Agent base: http://localhost:8000
- Frontend: http://localhost:3000
- Health: API /health, Agent /health

---

## Prerequisites
- Node.js >= 18 (repo uses npm@11)
- Python 3.13 (for agent) with ability to install Playwright Chromium
- Docker (recommended) and Docker Compose
- MongoDB and Redis (Docker services are provided)
- Clerk account for auth (publishable + secret + webhook secret)
- One LLM provider:
	- OpenAI: OPENAI_API_KEY
	- or Google Gemini: GOOGLE_API_KEY
- Optional: PSI_API_KEY (Google PageSpeed Insights) for Lighthouse metrics

---

## Environment variables
Create a .env at the repo root (docker-compose reads it; Turbo also forwards some envs).

- Frontend
	- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Clerk publishable key
	- NEXT_PUBLIC_BASE_URL: e.g., http://localhost:3000
	- NEXT_PUBLIC_API_URL: API origin, e.g., http://localhost:3001

- API (apps/api)
	- API_PORT: default 3001
	- MONGODB_URI: e.g., mongodb://localhost:27017/ui-analyzer
	- REDIS_HOST: default localhost (redis in Docker: redis)
	- REDIS_PORT: default 6379
	- REDIS_PASSWORD: optional
	- ANALYZER_API_URL: e.g., http://localhost:8000 (or http://agent:8000 in Docker)
	- CLIENT_URL or CLIENT_URLS: allowed CORS origins (comma-separated in production)
	- CLERK_PEM_PRIVATE_KEY: used by auth middleware verifyToken
	- WEBHOOK_SECRET: Clerk webhook (Svix) secret for /api/v1/webhook/clerk

- Agent (apps/agent)
	- OPENAI_API_KEY or GOOGLE_API_KEY (choose one provider)
	- LIGHTHOUSE_MODE: psi (default) or disabled
	- PSI_API_KEY: optional, enables Lighthouse metrics via PSI

Note: The agent defaults to OpenAI. If using OpenAI, set OPENAI_API_KEY. To switch to Gemini, change ai_provider in apps/agent/src/config/config.py and set GOOGLE_API_KEY.

---

## Run with Docker (recommended)
This starts MongoDB, Redis, API, Agent, and Caddy (reverse proxy).

```bash
# 1) Ensure your .env has required keys (see above)
# 2) Start the stack
docker compose up -d --build

# 3) Visit services
# Frontend (if you run it separately): http://localhost:3000
# API: http://localhost:3001/health
# Agent: http://localhost:8000/health
```

Notes
- docker-compose wires API -> Agent via ANALYZER_API_URL=http://agent:8000
- Caddy reverse-proxies api.uianalyzer.in -> api:3001 (binds :80/:443). Adjust Caddyfile for your domain.

---

## Local development (Turbo monorepo)
You can mix Docker for infra (DB/Redis/Agent) with local Node/Next dev.

```bash
# 0) Install dependencies at repo root
npm i

# 1) Start infra with Docker (Mongo + Redis) and (optionally) the Agent
docker compose up -d database redis agent

# 2) In another terminal, run apps in dev
npm run dev

# Apps
# - apps/frontend: Next.js dev on :3000
# - apps/api: Express on :3001
# - apps/agent: use Docker container on :8000 (or run locally; see below)
```

Run the agent locally instead of Docker
```bash
# Python 3.13 venv (uv or venv/pip). With uv (optional):
# pipx/uv users: uv venv && uv pip install -r apps/agent/requirements.txt

cd apps/agent
python -m pip install -r requirements.txt
python -m playwright install --with-deps chromium

# Start dev server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Make sure NEXT_PUBLIC_API_URL points to the API and ANALYZER_API_URL in API points to the agent.

---

## API
- Base: /api/v1
- Health: GET /health -> { status: 'ok' }
- Analyze UI: POST /api/v1/ai/analyze-ui (auth required)
	- Headers: Authorization: Bearer <Clerk token>
	- Body: { url: string }
	- Response (success):
		- success: true
		- data: { url, loadTime, performanceScore?, issues[], screenshots: { desktop, mobile } }
	- Response (errors): mapped from agent errors (VALIDATION_ERROR, TIMEOUT_ERROR, etc.)

Credits and users
- Clerk webhook: POST /api/v1/webhook/clerk (Svix headers required)
- User: GET /api/v1/user/get-current-user (auth required)
- Credits are stored in MongoDB with Redis caching and batched updates.

---

## Agent (FastAPI)
- Endpoint: POST /analyze
	- Body: { url: HttpUrl, save_screenshots?: boolean }
	- Returns issues list, loadTime, optional Lighthouse metrics, and screenshots (base64 + temp file paths)
- Health: GET /health
- Screenshots are taken for desktop and mobile; if mobile fails, desktop is used as fallback.
- Lighthouse via PSI if PSI_API_KEY is set; otherwise Lighthouse is marked unavailable.
- AI provider: OpenAI (gpt-4o) by default or Gemini; configure in src/config/config.py and env vars.

---

## Frontend (Next.js)
- Auth: Clerk (middleware protects routes)
- Analyze flow: form -> /analyze?url=…
- For https://example.com, the page shows built-in dummy results for demo.
- Configure NEXT_PUBLIC_API_URL to reach the API.

---

## CORS and auth
- In dev, all origins are allowed; in production, set CLIENT_URLS (comma-separated) or CLIENT_URL for the API.
- API expects a Bearer token from Clerk (verifyToken uses CLERK_PEM_PRIVATE_KEY).

---

## Project scripts
At repo root
- npm run dev: turbo run dev (apps in watch mode)
- npm run build: turbo run build
- npm run start: turbo run start
- npm run lint: turbo run lint
- npm run check-types: turbo run check-types

Per app
- apps/api: npm run dev | build | start
- apps/frontend: npm run dev | build | start
- apps/agent: run uvicorn (see above) or Docker

---

## Webhooks (Clerk)
- Point Clerk webhooks to: POST {API_ORIGIN}/api/v1/webhook/clerk
- Use the same WEBHOOK_SECRET in both Clerk and your API .env

---

## Troubleshooting
- Playwright/Chromium crashes in Docker: the compose sets shm_size: 1g and disables sandbox flags; ensure agent has internet.
- 401 Unauthorized: ensure Authorization header is present (Clerk) and CLERK_PEM_PRIVATE_KEY is set.
- CORS in production: set CLIENT_URLS with your frontend origin(s).
- No Lighthouse metrics: set PSI_API_KEY or set LIGHTHOUSE_MODE=disabled to suppress.
- Mongo/Redis connectivity: confirm MONGODB_URI/REDIS_HOST/REDIS_PORT and that containers are running.

---

## Contributing
See CONTRIBUTING.md.
