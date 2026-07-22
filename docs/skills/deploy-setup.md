# ea-deploy-setup

Generates the GitHub Actions CI/CD workflow that deploys your project to production on every push to `main`. Automatically detects databases and sets up the migration pipeline.

## Trigger

```
/deploy-setup
```

Also triggered automatically by `ea-deploy` when no CI workflow exists yet.

## What it does

1. **Checks for existing CI** — if `.github/workflows/deploy.yml` already exists, asks before overwriting
2. **Collects project info** — project name and git remote URL
3. **Generates the workflow** — creates `.github/workflows/deploy.yml` with:
   - Trigger on push to `main`
   - A `deploy` job that SSH-es into the server and runs the update commands
   - A first-deploy guard: if the project directory does not exist on the server, it clones the repo; otherwise it pulls
4. **Calls `ea-migrationdb-setup`** — detects database usage and configures the migration pipeline (see below)
5. **Creates `.env.prod`** — reads your current `.env` and generates a production override file with:
   - `TRAEFIK_HOSTNAME=<project-name>.easydeploy.tech`
   - `TRAEFIK_ENTRYPOINT=websecure`
   - `TRAEFIK_TLS=true`
6. **Updates README** — adds a Deployment section with the production URL
7. **Calls `ea-deploy-backup`** — automatically sets up daily S3 backups (see [backup-setup.md](backup-setup.md))

## Generated files

| File | Description |
|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD workflow |
| `.env.prod` | Production environment overrides (committed intentionally — contains no secrets) |

## Required GitHub secrets

Before the pipeline can run, configure these secrets in your repository at `Settings → Secrets and variables → Actions`:

| Secret | Description |
|---|---|
| `SSH_HOST` | IP address or domain of the production server |
| `SSH_USERNAME` | SSH username on the server |
| `SSH_PRIVATE_KEY` | Contents of the private SSH key |
| `SSH_PORT` | SSH port (optional — defaults to 22) |

---

## Database and migrations

`ea-deploy-setup` delegates database detection and migration setup to `ea-migrationdb-setup`. You can also run this skill independently:

```
/migrationdb-setup
```

### What it does

1. **Detects database usage** — reads project files (`docker-compose.yml`, `package.json`, `requirements.txt`, `go.mod`, `composer.json`, `.env`, config files) to determine if a database is used and what type
2. **Ensures DB is in Docker Compose** — if a database is detected but not in `docker-compose.yml`, adds the service with the right image, environment variables, and a persistent volume
3. **Updates `.env`** — adds `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
4. **Detects or creates a migration system** — identifies the framework already in use (Prisma, TypeORM, Sequelize, Knex, Alembic, Django, Rails, golang-migrate, or raw SQL), or sets one up based on the project language
5. **Creates the initial migration** — generates the first migration capturing the current schema
6. **Adds a `migrate` job to the CI** — inserts a `migrate` job before `deploy` in the workflow; the `deploy` job gets `needs: [migrate]`

### Supported databases

PostgreSQL, MySQL, MariaDB, MongoDB, Redis, SQLite

### Supported migration frameworks

| Framework detected | Language | Migration command |
|---|---|---|
| Prisma | Node.js | `npx prisma migrate deploy` |
| Sequelize CLI | Node.js | `npx sequelize-cli db:migrate` |
| Knex.js | Node.js | `npx knex migrate:latest` |
| Alembic | Python | `alembic upgrade head` |
| Django | Python | `python manage.py migrate` |
| ActiveRecord | Ruby on Rails | `bundle exec rails db:migrate` |
| golang-migrate | Go | `migrate -path /migrations -database … up` |
| Raw SQL files | Any | `npm run migrate` (or equivalent) |

All migration commands run **inside the container** via `docker compose exec -T` — nothing runs on the host machine.

## Prerequisites

- `docker-compose.yml` must exist (run `ea-docker-setup` first)
- Git remote configured to `northstar-network` (run `ea-github-setup` first)
