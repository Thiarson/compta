# Compta

A personal accounting app: sign up, verify your email, create accounts, and record income and expense transactions.

**Stack:** pnpm + Turborepo monorepo, Fastify API, React + Vite web app, PostgreSQL (Drizzle), Redis (rate limiting).

## Layout

```
apps/api/            Fastify REST API
apps/web/            React single-page app
packages/contracts/  Request/response schemas shared by API and web
packages/db/         Drizzle schema and migrations
compose.yaml         api, web, postgres, redis
```

## Prerequisites

- Node.js 24+ (`.nvmrc`) and pnpm (`corepack enable`)
- Docker
- A [Resend](https://resend.com) API key and sender address. The API won't start without `EMAIL_FROM` and `EMAIL_API_KEY`.

## Development

```bash
pnpm install

# Postgres and Redis
cp .env.example .env              # set POSTGRES_PASSWORD (letters and digits only)
docker compose up -d postgres redis

# App config
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL, JWT secrets, EMAIL_*
cp apps/web/.env.example apps/web/.env

# Migrations
echo "DATABASE_URL=postgres://postgres:<password>@localhost:5432/compta" > packages/db/.env
pnpm --filter @compta/db db:migrate

pnpm dev
```

Web runs on http://localhost:5173 and the API on http://localhost:8000. Generate secrets with `openssl rand -base64 48`.

## Commands

| Command                           | Description                |
| --------------------------------- | -------------------------- |
| `pnpm dev`                        | Start API and web          |
| `pnpm build`                      | Type-check and build       |
| `pnpm lint` / `pnpm format:check` | Lint / check formatting    |
| `pnpm test`                       | Unit and integration tests |
| `pnpm --filter web test:e2e`      | Playwright e2e tests       |

Integration and e2e tests start Postgres with Testcontainers, so Docker must be running.

## Docker Compose

Fill in `.env` (`POSTGRES_PASSWORD`, both JWT secrets, `EMAIL_FROM`, `EMAIL_API_KEY`), then:

```bash
docker compose up --build -d
```

Web: http://localhost:8080, API: http://localhost:8000.

Migrations are not run automatically. Run the migration step from the Development section once after the first start (Postgres is exposed on `127.0.0.1:5432`).

`VITE_API_URL` is fixed when the web image is built, so rebuild after changing it.

## API

Routes live under `/api/v1`: `auth` (register, login, verify email, password reset, refresh, me, logout), `accounts` and `transactions`. Schemas are in `packages/contracts`. Health checks: `/healthz` and `/readyz`.
