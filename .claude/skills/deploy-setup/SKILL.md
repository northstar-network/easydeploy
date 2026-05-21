---
name: deploy-setup
description: >
  Creates the GitHub Actions CI workflow for the project if it does not exist yet.
  Uses the nsndeploy model as a base template. Delegates database detection and
  migration CI setup to the migrationdb-setup skill.
  Trigger phrases: "deploy setup", "setup ci", "configurer la ci", "créer le workflow",
  "setup github actions", "ci deploy".
version: 1.0.0
---

# deploy-setup

Creates the GitHub Actions CI workflow for this project. Handles first-time deployments
(directory does not exist on server yet). Delegates database and migration setup to
`migrationdb-setup`.

---

## Step 1 — Check if CI already exists

Run:

```bash
ls .github/workflows/deploy.yml 2>/dev/null
```

- **File found** → ask:

```
AskUserQuestion:
  question: "A CI workflow already exists at .github/workflows/deploy.yml. What would you like to do?"
  header: "CI exists"
  options:
    - label: "Overwrite it"
      description: "Replace the existing workflow with a freshly generated one"
    - label: "Cancel"
      description: "Stop here — keep the existing workflow"
```

  - "Cancel" → stop.
  - "Overwrite it" → continue to Step 2.

- **File absent** → continue to Step 2.

---

## Step 2 — Collect project information

### 2.1 — Project name

Run:

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Store as `projectName`.

### 2.2 — Git remote URL

Run:

```bash
git remote get-url origin 2>/dev/null
```

Store as `gitRepoUrl`. If empty or command fails, set `gitRepoUrl` to
`git@github.com:northstar-network/<projectName>.git`.

### 2.3 — Server path

Set `serverPath` to `/var/www/project/<projectName>` automatically. Do not ask the user.

---

## Step 3 — Generate the base CI workflow

### 3.1 — Create the directory

Run:

```bash
mkdir -p .github/workflows
```

### 3.2 — Write the base workflow (deploy only, no migration)

Write the following content to `.github/workflows/deploy.yml`:

```yaml
name: Deploy to production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: SSH deploy
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            if [ ! -d "<serverPath>" ]; then
              git clone <gitRepoUrl> <serverPath>
            fi
            cd <serverPath>
            git pull origin main
            docker compose --env-file .env.prod up -d --remove-orphans
```

Replace `<serverPath>` and `<gitRepoUrl>` with the actual values from Step 2.

Display:

```
✓ CI workflow created at .github/workflows/deploy.yml
```

---

## Step 4 — Database and migrations

Invoke the `migrationdb-setup` skill. Wait for it to complete before continuing.

After `migrationdb-setup` finishes, check whether a migration system is in
place — either one that already existed or one that was just created. To do
this, inspect the project:

- Check for `prisma/schema.prisma` or `prisma/migrations/`
- Check for `knexfile.js` / `knexfile.ts`
- Check for `.sequelizerc` or `migrations/` + sequelize in `package.json`
- Check for `alembic.ini`
- Check for `*/migrations/__init__.py` (Django)
- Check for `db/migrate/*.rb` (Rails)
- Check for `db/migrations/*.sql` or `migrations/*.sql` (golang-migrate / raw SQL)

If **no migration system is found** → skip to Step 5, do not add a migrate job.

If **a migration system is found**:

### 4.1 — Identify the migrate command for the server

Read `docker-compose.yml` to find the main app service name (`appService`).

Map the detected migration system to the command that will run on the server
via SSH. All commands that run inside the app container must use the `-T` flag
(no TTY in SSH):

| Migration system | SSH command |
|---|---|
| Prisma | `docker compose --env-file .env.prod exec -T <appService> npx prisma migrate deploy` |
| Knex | `docker compose --env-file .env.prod exec -T <appService> npm run migrate` |
| Sequelize | `docker compose --env-file .env.prod exec -T <appService> npx sequelize-cli db:migrate` |
| Alembic | `docker compose --env-file .env.prod exec -T <appService> alembic upgrade head` |
| Django | `docker compose --env-file .env.prod exec -T <appService> python manage.py migrate` |
| Rails | `docker compose --env-file .env.prod exec -T <appService> bundle exec rails db:migrate` |
| golang-migrate | `docker compose --env-file .env.prod exec -T <appService> migrate -path db/migrations -database "$DATABASE_URL" up` |
| Raw SQL | `make migrate` |

Store as `sshMigrateCommand`.

### 4.2 — Add the migrate job to the workflow

Read `.github/workflows/deploy.yml` and make two changes:

1. **Insert** the `migrate` job before the `deploy` job:

```yaml
  migrate:
    name: Run database migrations
    runs-on: ubuntu-latest

    steps:
      - name: Run migrations via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            if [ ! -d "<serverPath>" ]; then
              git clone <gitRepoUrl> <serverPath>
            fi
            cd <serverPath>
            git pull origin main
            docker compose --env-file .env.prod up -d db
            <sshMigrateCommand>
```

2. **Add** `needs: [migrate]` to the `deploy` job so it only runs after
   migrations succeed.

Replace `<serverPath>`, `<gitRepoUrl>`, and `<sshMigrateCommand>` with the
actual values.

Display:

```
✓ migrate job added to .github/workflows/deploy.yml
```

---

## Step 5 — Create .env.prod

If `.env.prod` already exists → skip to Step 6.

Build `.env.prod` automatically from the project's current configuration:

**5.1 — Collect all variable values**

Read `docker-compose.yml` and extract every `${VAR_NAME}` and
`${VAR_NAME:-default}` reference. For each variable, resolve its value using
this priority order:

1. Value already present in `.env` (read it if it exists)
2. Default value from the docker-compose definition (`${VAR_NAME:-default}`)
3. Leave empty if no value can be found

**5.2 — Override known production values**

Apply these overrides regardless of what `.env` contains:

- Any variable holding the app hostname or Traefik hostname
  (`TRAEFIK_HOSTNAME`, `APP_URL`, `APP_HOST`, `BASE_URL`, `HOST`, or similar)
  → set to `<projectName>.easydeploy.tech`

All other variables — including database passwords, usernames, and any other
credentials — keep the values resolved in 5.1 as-is.

**5.3 — Write the file**

Write `.env.prod` at the project root with all resolved values. Do not add
`.env.prod` to `.gitignore` — the file will be committed with the project.

Display:

```
✓ .env.prod created
```


---

## Step 6 — Summary

Display:

```
✓ deploy-setup complete

  Project : <projectName>
  CI file : .github/workflows/deploy.yml
  Server  : <serverPath>
```

---

## Rules

- If invoked by the `easydeploy` skill, resume the `easydeploy` skill when this skill finishes — do not stop.
- **Never** hardcode secrets or credentials in the workflow file — always use `${{ secrets.* }}`.
- **Always** include the first-deploy guard (`if [ ! -d ... ]`) in the `deploy` job SSH script.
- **Always** add the first-deploy guard (`if [ ! -d ... ]`) in the `migrate` job SSH script — the server directory may not exist yet on first deployment.
- **Always** add `needs: [migrate]` to the `deploy` job when a migrate job is present.
- **Always** use the `-T` flag with `docker compose exec` in SSH scripts — there is no TTY in a non-interactive SSH session.
- If writing the file fails, show the raw error and stop.
