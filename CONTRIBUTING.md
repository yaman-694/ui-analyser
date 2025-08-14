## Contributing to UI Analyzer

Thanks for your interest in improving this project. This guide explains how to set up your environment, make changes safely, and submit a high-quality pull request.

### Repo layout (monorepo)
- apps/frontend: Next.js 15 + Clerk auth (UI)
- apps/api: Express + TypeScript + MongoDB + Redis (REST API)
- apps/agent: FastAPI + Playwright + LLM (OpenAI or Gemini) (analysis engine)
- docker-compose.yml: local infra (MongoDB, Redis, API, Agent, Caddy)

---

## Prerequisites
- Node.js >= 18 and npm (repo specifies npm@11 in package.json)
- Python 3.13 for the agent
- Docker and Docker Compose (for local infra and/or full stack)
- Accounts/keys:
	- Clerk (publishable key, PEM private key, webhook secret)
	- LLM provider: OPENAI_API_KEY or GOOGLE_API_KEY (choose one)
	- Optional PSI_API_KEY for Lighthouse metrics via PageSpeed Insights

---

## Local setup
1) Fork and clone the repo
2) Install JS deps at the repo root
```bash
npm i
```
3) Create a .env in the repo root and set at least:
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- NEXT_PUBLIC_BASE_URL (e.g., http://localhost:3000)
- NEXT_PUBLIC_API_URL (e.g., http://localhost:3001)
- API_PORT=3001 (optional)
- MONGODB_URI=mongodb://localhost:27017/ui-analyzer
- REDIS_HOST=localhost
- REDIS_PORT=6379
- ANALYZER_API_URL=http://localhost:8000
- CLIENT_URLS=http://localhost:3000
- CLERK_SECRET_KEY
- WEBHOOK_SECRET
- For the agent: OPENAI_API_KEY or GOOGLE_API_KEY, and optionally PSI_API_KEY

4) Start infra (MongoDB, Redis). You can also run the agent in Docker:
```bash
docker compose up -d database redis agent
```

5) Start apps in dev (Turbo runs workspace scripts):
```bash
npm run dev
```

Frontend will run on :3000, API on :3001, Agent on :8000 (if not using Docker, see below).

Run the agent locally instead of Docker:
```bash
cd apps/agent
python -m pip install -r requirements.txt
python -m playwright install --with-deps chromium
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Development workflow
- Small, focused branches from main: feature/<short-name>, fix/<short-name>
- Keep PRs scoped; split large changes
- Update README and this guide if behavior or setup changes
- Avoid breaking API contracts; if necessary, coordinate a versioned route

Commit messages (Conventional Commits):
- feat: add new user credits cache
- fix: handle PSI timeout gracefully
- chore: bump dependencies
- docs: update README env section
- refactor: extract analyzer config
- test: add controller edge cases
- perf: reduce screenshot memory use
- build: dockerize API stage

---

## Code style and quality gates
Run these before committing and again before opening a PR.

At repo root (Turbo proxies to workspaces):
```bash
npm run lint
npm run check-types
npm run build
```

Per app specifics
- Frontend/API (TypeScript):
	- ESLint and TypeScript must pass
	- Prefer Prettier formatting (npm run format at root)
- Agent (Python):
	- Format with black
	- Lint with flake8
	- Type-check with mypy when adding/modifying typed modules

Optional Python commands (run inside apps/agent):
```bash
python -m pip install -r requirements.txt
python -m pip install black flake8 mypy
black src
flake8 src
mypy src
```

Docker smoke test (optional):
```bash
docker compose up -d --build
curl -s http://localhost:3001/health | cat
curl -s http://localhost:8000/health | cat
```

---

## Testing guidance
Tests are minimal today. If you add logic (controllers, middleware, analyzers), include small tests:
- API: prefer lightweight unit/integration tests for controllers/middleware
- Agent: prefer pytest for utility logic; keep Playwright-heavy tests targeted

Focus on:
- Happy path + 1–2 edge cases
- Input validation failures
- Timeout/error surfaces

---

## API and contracts
- Public API base: /api/v1
- Don’t change response shapes for existing routes without discussion
- If adding routes, document request/response in README and ensure frontend changes are coordinated

---

## Database and credits
- Mongoose models live in apps/api/src/model
- Credits updates are batched and cached in Redis—respect that pattern
- For model changes, note any migration/backfill plan in the PR description

---

## Security and secrets
- Never commit secrets or real keys
- Use environment variables and .env (ignored)
- For vulnerabilities, open a private GitHub security advisory rather than a public issue

---

## Questions or help
Open a GitHub issue with context (what you tried, logs, OS). For security, use private advisories.

