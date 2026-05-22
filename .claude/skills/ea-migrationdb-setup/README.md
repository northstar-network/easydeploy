# migrationdb-setup

Detects database usage in a project, ensures the database is managed by
Docker Compose, and sets up a migration system if none exists.

## What it does

1. **Detect database** — reads project files (`package.json`, `requirements.txt`,
   `go.mod`, `.env`, `docker-compose.yml`, etc.) to determine whether the
   project uses a database and which type (PostgreSQL, MySQL, MongoDB, Redis…).

2. **Verify Docker Compose integration** — checks whether the database service
   is already declared in `docker-compose.yml`. If not, offers to add it with
   the correct image, environment variables, and persistent volume.

3. **Data migration guidance** — if the user has an existing database to move
   into Docker, shows the exact `pg_dump` / `mysqldump` / `mongodump` command
   to export data and how to restore it once the container is running.

4. **Detect migration system** — looks for Prisma, Knex, Sequelize, TypeORM,
   Alembic, Django migrations, Rails ActiveRecord, golang-migrate, or plain
   SQL files.

5. **Create migration system** — if none is found, picks the best fit for the
   project (based on language and existing dependencies) and creates the
   necessary config files and folder structure.

## Supported databases

| Database | Docker image used |
|---|---|
| PostgreSQL | `postgres:16-alpine` |
| MySQL | `mysql:8` |
| MariaDB | `mariadb:11` |
| MongoDB | `mongo:7` |
| Redis | `redis:7-alpine` |

## Supported migration systems

| Language / Framework | System created |
|---|---|
| Node.js + Prisma already installed | Prisma migrate |
| Node.js + TypeScript | Knex.js |
| Node.js + JavaScript | Knex.js |
| Python + Django | Django built-in |
| Python (no Django) | Alembic |
| Ruby on Rails | Rails ActiveRecord |
| Go | golang-migrate |
| Other | Raw SQL files in `db/migrations/` |

## Invocation

**Directly by the user:**
```
/migration-setup
```

**By another skill (`deploy-setup`):**
```
Invoke the `migrationdb-setup` skill.
```

## Prerequisites

- `docker-compose.yml` must already exist (run `/docker-setup` first if not).
- The project must be at the root of the working directory.

## What it does NOT do

- Does not create a `docker-compose.yml` from scratch — use `/docker-setup` for that.
- Does not run dump or restore commands automatically — only shows the commands.
- Does not install packages automatically (`npm install`, `pip install`, etc.)
  — shows the command and lets the user run it.
- Does not modify the CI workflow — that is handled by `deploy-setup`.
