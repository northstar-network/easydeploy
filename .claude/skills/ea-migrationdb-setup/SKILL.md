---
name: ea-migrationdb-setup
description: >
  Detect database usage in the project, ensure it is managed by docker-compose,
  and set up a migration system if none exists. Can be invoked directly or by
  the ea-deploy-setup skill.
  Trigger phrases: "migration setup", "setup database", "setup migrations",
  "configure database", "add migration system", "database setup",
  "ea-migrationdb-setup".
version: 1.0.0
---

# ea-migrationdb-setup

Inspect the project to detect database usage, verify docker-compose integration,
and ensure a migration system is in place for deployments.

---

## Step 1 — Detect database usage

Read the project files to determine whether a database is used. analyse the files yourself:

**Files to read (if they exist):**
- `docker-compose.yml` — look for services using images: `postgres`, `mysql`,
  `mariadb`, `mongo`, `mongodb`, `redis`
- `package.json` — look for dependencies: `pg`, `mysql`, `mysql2`, `mongoose`,
  `mongodb`, `redis`, `ioredis`, `prisma`, `@prisma/client`, `typeorm`,
  `sequelize`, `knex`, `better-sqlite3`, `sqlite3`
- `requirements.txt` / `pyproject.toml` — look for: `psycopg2`, `psycopg`,
  `pymysql`, `mysqlclient`, `pymongo`, `motor`, `redis`, `sqlalchemy`,
  `databases`, `tortoise-orm`
- `go.mod` — look for: `gorm.io/driver/postgres`, `gorm.io/driver/mysql`,
  `go.mongodb.org/mongo-driver`, `github.com/go-redis/redis`,
  `github.com/lib/pq`, `github.com/jackc/pgx`
- `composer.json` — look for: `illuminate/database`, `doctrine/dbal`,
  `mongodb/mongodb`
- `.env`, `.env.example`, `.env.local`, `.env.sample` — look for variables:
  `DATABASE_URL`, `DB_HOST`, `DB_NAME`, `POSTGRES_*`, `MYSQL_*`, `MONGO_*`,
  `REDIS_*`, `MONGODB_URI`
- `config/database.yml` (Rails), `prisma/schema.prisma`,
  `alembic.ini`, `knexfile.js`, `knexfile.ts`, `.sequelizerc`

From your analysis, store in context:
- `dbDetected`: `true` or `false`
- `dbType`: `postgres | mysql | mariadb | mongodb | redis | sqlite | unknown`
- `dbInDockerCompose`: `true` or `false`
- `projectType`: `node | python | go | php | ruby | other`

**If `dbDetected = false`** → display:

```
No database detected in this project. Nothing to set up.
```

Then stop.

---

## Step 2 — Verify docker-compose integration

If `dbInDockerCompose = true` → skip to Step 4.

If `dbInDockerCompose = false`:

### SQLite special case

If `dbType = sqlite`:

SQLite is a file-based database — it has no server and does not need a
dedicated Docker service. However, in production the database file must
survive container restarts, and SQLite is generally not suitable for
multi-container deployments. Ask:

```
AskUserQuestion:
  question: "Your project uses SQLite, which is a simple file-based database.
             It works fine for local development but is not recommended for
             production — it can't handle multiple containers and the data is
             lost if the container is recreated without a volume.
             How would you like to handle this?"
  header: "SQLite in production"
  options:
    - label: "Keep SQLite, add a persistent volume (recommended)"
      description: "Mounts the SQLite file as a named volume so data survives container restarts — simple and works great for most projects"
    - label: "Migrate to PostgreSQL"
      description: "I'll add a PostgreSQL service to docker-compose and update the project config to use it — only needed for high-traffic or multi-container setups"
    - label: "Leave it as-is"
      description: "No changes — continue to migration system setup"
```

- **"Keep SQLite, add a persistent volume"** → detect the SQLite file path
  from the project config (e.g. `DATABASE_URL=file:./dev.db`, or
  `db.sqlite3`, or `database.sqlite`). Add a named volume for the directory
  containing the SQLite file in `docker-compose.yml`:
  ```yaml
  volumes:
    - sqlite_data:/app/<directory-containing-db-file>
  ```
  Add `sqlite_data:` under the top-level `volumes:` key. Then skip to Step 4.

- **"Migrate to PostgreSQL"** → set `dbType = postgres`, continue to Step 3
  (the postgres template will be used to add the service). After Step 3,
  also update the `DATABASE_URL` in `.env` to point to the new PostgreSQL
  service, and update `package.json` / `requirements.txt` if the SQLite
  driver needs to be replaced by a PostgreSQL driver. Display a note:
  ```
  ⚠️  Don't forget to update your ORM/database config to use PostgreSQL.
  The DATABASE_URL in .env now points to the new Docker service.
  ```

- **"Leave it as-is"** → skip to Step 4.

---

### Server-based databases (postgres, mysql, mariadb, mongodb, redis)

Check whether a `docker-compose.yml` file exists at the project root.

- **If it does not exist** → display:

  ```
  No docker-compose.yml found. Run /ea-docker-setup first to containerize
  the project, then re-run /ea-migrationdb-setup to add the database.
  ```

  Then stop.

- **If it exists** → continue to Step 3.

---

## Step 3 — Add DB service to docker-compose

Show the user what will be added, then ask:

```
AskUserQuestion:
  question: "Your project uses a <dbType> database but it is not managed by
             Docker Compose yet. This is required for the app to work in
             production — without it, the database won't start on the server.
             Should I add a <dbType> service to your docker-compose.yml?"
  header: "Add DB service"
  options:
    - label: "Yes, add it"
      description: "Adds a <dbType> service with the correct environment variables and a persistent volume"
    - label: "No, skip"
      description: "Leave docker-compose as-is and continue to migration setup"
```

If "No, skip" → continue to Step 4.

If "Yes, add it":

Add the appropriate service block to `docker-compose.yml`. Use the templates
below — adapt variable names to match what already exists in the project's
`.env` or source files.

**postgres:**
```yaml
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME:-app}
      POSTGRES_USER: ${DB_USER:-app}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secret}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - proxy
```

**mysql / mariadb:**
```yaml
  db:
    image: mysql:8          # or mariadb:11
    environment:
      MYSQL_DATABASE: ${DB_NAME:-app}
      MYSQL_USER: ${DB_USER:-app}
      MYSQL_PASSWORD: ${DB_PASSWORD:-secret}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-rootsecret}
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - proxy
```

**mongodb:**
```yaml
  db:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-app}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-secret}
      MONGO_INITDB_DATABASE: ${MONGO_DB:-app}
    volumes:
      - db_data:/data/db
    networks:
      - proxy
```

**redis:**
```yaml
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - proxy
```

Also:
- Add `db_data:` (or `redis_data:`) under the top-level `volumes:` key.
- Add `depends_on: [db]` (or `depends_on: [redis]`) to the app service.
- Update `.env` with the missing variables (`DB_HOST=db`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, `DB_PASSWORD`) — if `.env` does not exist, create it.
- If `DATABASE_URL` is used in the project, update or add it in `.env` using
  the format appropriate to `dbType`:
  - postgres: `DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}`
  - mysql: `DATABASE_URL=mysql://${DB_USER}:${DB_PASSWORD}@db:3306/${DB_NAME}`
  - mongodb: `DATABASE_URL=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@db:27017/${MONGO_DB}`

After writing the files, ask:

```
AskUserQuestion:
  question: "Do you have existing data in your current database that needs
             to be imported into the new Docker container?"
  header: "Existing data"
  options:
    - label: "Yes, migrate my data"
      description: "I'll dump the existing database and import it automatically into the new container"
    - label: "No, start fresh"
      description: "The database will start empty — migrations will build the schema"
```

If "Yes, migrate my data":

**3a — Collect old connection info**

From the files read in Step 1 (`.env`, `.env.example`, config files, source
code), extract the old connection credentials: `OLD_HOST`, `OLD_PORT`,
`OLD_DB`, `OLD_USER`, `OLD_PASSWORD`.

If any value is missing or ambiguous, ask the user as a plain text message —
do NOT use AskUserQuestion. List only the missing fields, one per line:

---
**Some connection details for your current database could not be found.**
Please provide the missing values:

- Host (e.g. `localhost` or `db.example.com`): ?
- Port (e.g. `5432`): ?
- Database name: ?
- Username: ?
- Password: ?

✏️ Reply with the values above.

---

Wait for the user's reply before continuing.

**3b — Start the new DB container**

Run:
```bash
docker compose up -d db
```

Wait up to 30 seconds for the container to be ready by polling:

```bash
# postgres
docker compose exec db pg_isready -U ${DB_USER}

# mysql / mariadb
docker compose exec db mysqladmin ping -u${DB_USER} -p${DB_PASSWORD} --silent

# mongodb
docker compose exec db mongosh --eval "db.adminCommand('ping')" --quiet

# redis
docker compose exec redis redis-cli ping
```

Poll every 3 seconds. If not ready after 30 seconds, display an error and stop.

**3c — Dump and restore**

Run the dump and pipe it directly into the new container — no intermediate file
needed.

**postgres:**
```bash
pg_dump -h <OLD_HOST> -p <OLD_PORT> -U <OLD_USER> -d <OLD_DB> -F c \
  | docker compose exec -T db pg_restore -U ${DB_USER} -d ${DB_NAME} --no-owner --no-acl
```

**mysql / mariadb:**
```bash
mysqldump -h <OLD_HOST> -P <OLD_PORT> -u <OLD_USER> -p<OLD_PASSWORD> <OLD_DB> \
  | docker compose exec -T db mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}
```

**mongodb:**
```bash
mongodump --uri="mongodb://<OLD_USER>:<OLD_PASSWORD>@<OLD_HOST>:<OLD_PORT>/<OLD_DB>" \
  --archive \
  | docker compose exec -T db mongorestore \
      --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost/${MONGO_DB}" \
      --archive
```

Replace `<OLD_*>` placeholders with the values collected in 3a.

If the command fails (non-zero exit):
- Show the last 20 lines of output.
- Ask:
  ```
  AskUserQuestion:
    question: "The data import failed. What would you like to do?"
    header: "Import error"
    options:
      - label: "Retry"
        description: "Try the import again"
      - label: "Skip import"
        description: "Continue without importing data — the database will be empty"
      - label: "Cancel"
        description: "Stop here"
  ```
  - "Retry" → re-run step 3c.
  - "Skip import" → continue to Step 4.
  - "Cancel" → stop.

If the command succeeds → display:

```
✓ Data imported successfully into the new Docker database.
```

---

## Step 4 — Detect migration system

Read the project files again to detect an existing migration system:

| System | Evidence to look for |
|--------|----------------------|
| Prisma | `prisma/schema.prisma` exists; `prisma/migrations/` directory |
| TypeORM | `src/migrations/` or `migrations/` directory + `typeorm` in package.json |
| Sequelize | `.sequelizerc` exists, or `migrations/` directory + `sequelize-cli` in package.json |
| Knex | `knexfile.js` or `knexfile.ts` exists, or `knex` in package.json with a `migrations/` dir |
| Alembic | `alembic.ini` exists; `alembic/versions/` directory |
| Django | Any `*/migrations/__init__.py` inside an app directory |
| Rails ActiveRecord | `db/migrate/` directory with `*.rb` files |
| golang-migrate | `db/migrations/` or `migrations/` directory containing `*.sql` files with numeric prefixes |
| Raw SQL | `db/migrations/` or `migrations/` directory with plain `.sql` files |

Store in context:
- `migrationSystem`: name of the detected system, or `none`
- `migrateCommand`: the command used to run migrations (see Step 5 table for reference)

If `migrationSystem` is not `none` → skip to Step 6.

---

## Step 5 — Create migration system

No migration system was found. Choose the best fit automatically based on
`projectType` and the tools already present in the project:

| Project type | Chosen system | Logic |
|---|---|---|
| Node + `prisma` in package.json | Prisma migrate | Already installed |
| Node + TypeScript (no Prisma) | Knex.js | Lightweight, SQL-first |
| Node + JavaScript | Knex.js | Lightweight, SQL-first |
| Python + Django detected | Django built-in | Already available |
| Python (no Django) | Alembic | Standard SQLAlchemy tool |
| Ruby on Rails | ActiveRecord | Already built-in |
| Go | golang-migrate | Standard community tool |
| Other | Raw SQL files | Framework-agnostic |

Ask the user before creating anything:

```
AskUserQuestion:
  question: "No migration system was found. Based on your project, I'll set up
             <chosen system>. This will create the config files and folder
             structure needed to manage your database schema over time."
  header: "Create migrations"
  options:
    - label: "Yes, set it up"
      description: "Creates: <list the specific files and folders that will be created>"
    - label: "No, skip"
      description: "Leave the project as-is — you can set this up manually later"
```

If "No, skip" → stop.

If "Yes, set it up":

**Detect the app service name** — read `docker-compose.yml` and identify the
main application service (the one that runs the app code, not `db` or `redis`).
Store it as `appService`. Ensure the container is running:

```bash
docker compose up -d <appService>
```

Then create the migration system inside the running container:

### Prisma
- If `prisma/schema.prisma` does not exist, run:
  ```bash
  docker compose exec <appService> npx prisma init --datasource-provider <dbType>
  ```
- Set `migrateCommand` to
  `docker compose exec <appService> npx prisma migrate deploy`.

### Knex.js
- If `knex` is not in `package.json`, install it in the container:
  ```bash
  docker compose exec <appService> npm install knex
  ```
- Write `knexfile.js` directly on disk (source is mounted as a volume):
  ```js
  module.exports = {
    client: '<pg|mysql|sqlite3>',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
    },
  };
  ```
- Create `migrations/` directory with a `.gitkeep` file.
- Add a `migrate` script to `package.json`: `"migrate": "knex migrate:latest"`.
- Set `migrateCommand` to
  `docker compose exec <appService> npm run migrate`.

### Alembic
- If `alembic` is not in `requirements.txt` / `pyproject.toml`, install it
  in the container:
  ```bash
  docker compose exec <appService> pip install alembic
  ```
- Run inside the container:
  ```bash
  docker compose exec <appService> alembic init alembic
  ```
- Update `alembic/env.py` (written to disk by the command above, visible
  immediately because of the volume mount) to read `DATABASE_URL` from the
  environment — replace the `sqlalchemy.url` line with:
  ```python
  import os
  config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
  ```
- Set `migrateCommand` to
  `docker compose exec <appService> alembic upgrade head`.

### Django built-in
- No setup needed — Django migrations are built-in.
- Set `migrateCommand` to
  `docker compose exec <appService> python manage.py migrate`.

### Rails ActiveRecord
- No setup needed — ActiveRecord is built-in.
- Set `migrateCommand` to
  `docker compose exec <appService> bundle exec rails db:migrate`.

### golang-migrate
- Create `db/migrations/` directory with a `.gitkeep` file.
- Install golang-migrate in the container:
  ```bash
  docker compose exec <appService> sh -c \
    "go install -tags '<dbType>' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"
  ```
  Replace `<dbType>` with the driver tag matching the database
  (`postgres`, `mysql`, `sqlite3`…).
- Set `migrateCommand` to:
  ```
  docker compose exec <appService> migrate \
    -path db/migrations -database "$DATABASE_URL" up
  ```

### Raw SQL files
- Create `db/migrations/` directory.
- Create `db/migrations/001_init.sql` with a comment placeholder:
  ```sql
  -- Migration 001: initial schema
  -- Add your CREATE TABLE statements here
  ```
- Create a `Makefile` (or append to it if one exists) with a `migrate` target
  that applies all `.sql` files in order using `psql` / `mysql` run inside
  the DB container, e.g.:
  ```makefile
  migrate:
  	for f in db/migrations/*.sql; do \
  		docker compose exec -T db psql -U $${DB_USER} -d $${DB_NAME} -f /dev/stdin < $$f; \
  	done
  ```
- Set `migrateCommand` to `make migrate`.

---

### Initial migration

Once the migration system is set up, create the first migration that captures
the current database schema. Run all commands inside `<appService>`.

**Context:** if data was imported in Step 3c, the Docker DB is already running
and populated — use introspection. If starting fresh, generate from the ORM
models.

#### Prisma
- If `prisma/schema.prisma` only has the `datasource` block (no models yet),
  introspect the existing DB:
  ```bash
  docker compose exec <appService> npx prisma db pull
  ```
- Then generate the initial migration:
  ```bash
  docker compose exec <appService> npx prisma migrate dev --name init
  ```
  This creates `prisma/migrations/<timestamp>_init/migration.sql`.

#### Knex.js
- Read the existing model files or source code to understand the current table
  structure.
- Write `migrations/<timestamp>_init.js` directly on disk (use `Date.now()`
  as the timestamp prefix) with `exports.up` and `exports.down` that recreate
  the full schema — write the actual tables inferred from the source code,
  no placeholder comments.
- Then run it inside the container:
  ```bash
  docker compose exec <appService> npm run migrate
  ```

#### Alembic
- Ensure `target_metadata` in `alembic/env.py` points to the SQLAlchemy
  `Base.metadata`. Read the project to find where `Base` is declared and
  add the import if missing.
- Run inside the container:
  ```bash
  docker compose exec <appService> alembic revision --autogenerate -m "init"
  ```
  This generates `alembic/versions/<hash>_init.py` from the current models.

#### Django built-in
- Run inside the container:
  ```bash
  docker compose exec <appService> python manage.py makemigrations
  ```

#### Rails ActiveRecord
- Rails tracks schema state in `db/schema.rb`. Run inside the container:
  ```bash
  docker compose exec <appService> bundle exec rails db:schema:dump
  ```
  This writes `db/schema.rb` with the current full schema.

#### golang-migrate
- Dump the schema from the DB container into the first migration file:

  **postgres:**
  ```bash
  docker compose exec db pg_dump -U ${DB_USER} --schema-only ${DB_NAME} \
    > db/migrations/000001_init.up.sql
  ```
  **mysql / mariadb:**
  ```bash
  docker compose exec db mysqldump -u${DB_USER} -p${DB_PASSWORD} \
    --no-data ${DB_NAME} > db/migrations/000001_init.up.sql
  ```
- Create an empty `db/migrations/000001_init.down.sql` (rollback can be
  filled in later).

#### Raw SQL files
- Dump the schema from the DB container directly into `db/migrations/001_init.sql`:

  **postgres:**
  ```bash
  docker compose exec db pg_dump -U ${DB_USER} --schema-only ${DB_NAME} \
    > db/migrations/001_init.sql
  ```
  **mysql / mariadb:**
  ```bash
  docker compose exec db mysqldump -u${DB_USER} -p${DB_PASSWORD} \
    --no-data ${DB_NAME} > db/migrations/001_init.sql
  ```
- If no DB is running yet, read the source code (models, entity files) and
  write the `CREATE TABLE` statements yourself.

After creating the initial migration, display:

```
✓ Initial migration created.
```

---

## Step 6 — Summary

Display a recap of everything that was done:

```
✓ Database setup complete

  Database type     : <dbType>
  Docker Compose    : <"managed by docker-compose" | "already in docker-compose" | "skipped">
  Migration system  : <migrationSystem>
  Run migrations    : <migrateCommand>

Next steps:
  1. Run /ea-docker-run to start your containers
  2. Run the following command to apply migrations:

       <migrateCommand>
```

---

## Rules

- **Never** delete existing migration files or directories.
- **Always** run package installs and migration commands inside the app
  container via `docker compose exec <appService>` — never on the host machine.
- If `docker-compose.yml` does not exist, stop and direct the user to
  `/ea-docker-setup` — do not create a new compose file here.
- Always adapt variable names to match what the project already uses.
- **Language — English only:** All output from this skill must be in English. This applies to all messages shown to the user, error messages, generated migration file content, and any other text produced. If the user writes in another language, understand them but always reply and generate output in English.
