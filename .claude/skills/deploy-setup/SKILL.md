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

Invoke the `migrationdb-setup` skill.

It will detect whether the project has a database. If so, it adds a mandatory `migrate` job
before the `deploy` job in the workflow just created.

Wait for `migrationdb-setup` to complete before continuing.

---

## Step 5 — Summary

Display:

```
✓ deploy-setup complete

  Project : <projectName>
  CI file : .github/workflows/deploy.yml
  Server  : <serverPath>
```

---

## Rules

- **Never** hardcode secrets or credentials in the workflow file — always use `${{ secrets.* }}`.
- **Always** include the first-deploy guard (`if [ ! -d ... ]`) in the `deploy` job SSH script.
- **Never** add the first-deploy guard in the `migrate` job SSH script — `migrationdb-setup` handles that guard itself when writing the migrate job.
- If writing the file fails, show the raw error and stop.
