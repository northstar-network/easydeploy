---
name: ea-restore
description: >
  Restores a production database backup, either into the developer's local
  docker-compose database (for debugging) or back onto the production server
  (e.g. after a bad migration or data-loss incident). Never runs the
  compose-managed `backup-cron` service locally, and never triggers the
  production restore itself — that step is always a manual click in the
  GitHub Actions UI.
  Trigger phrases: "restore backup", "restore locally", "restore to production",
  "restaurer la prod en local", "restaurer en production", "sync prod to local",
  "pull prod data", "récupérer les données de prod", "restaurer la base",
  "ea-restore".
version: 1.0.0
---

# ea-restore

Restores a chosen dated database backup produced by `ea-deploy-backup`, either onto the
developer's local machine or back onto the production server. Database only — asset
volumes are out of scope.

---

## Step 1 — Check prerequisites

### 1.1 — Backups must already be configured

```bash
cat .easydeploy 2>/dev/null
```

- No line matching `backup-setup@*` → display:
  ```
  No backup configuration found for this project. Run ea-deploy-backup first, then re-run ea-restore.
  ```
  Stop.
- Present → continue.

### 1.2 — Project name

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Store as `projectName`.

### 1.3 — Re-detect what can be restored

Read `docker-compose.yml` and re-run the exact same `dbServices` detection as
`ea-deploy-backup` Step 3.1 — image match for `postgres` / `mysql` / `mariadb` /
`mongo`/`mongodb` / `redis`, plus the SQLite volume-claim heuristic (no dedicated
service; resolved via the app's mounted volumes). For each entry, also record its
`DB_HOST` / `DB_PORT` (or the sqlite `volumeName`) exactly as `ea-deploy-backup` Step 5
wrote them into the `backup-cron` service's `environment:` block in `docker-compose.yml`
— read them from there rather than guessing.

- `dbServices` empty → display:
  ```
  No database found to restore in docker-compose.yml.
  ```
  Stop.
- Otherwise → continue. If more than one `dbServices` entry exists, ask which one via
  `AskUserQuestion` (single-select) before continuing; store as `dbEntry`.

---

## Step 2 — Ask which target

```
AskUserQuestion:
  question: "Where do you want to restore this backup?"
  header: "Restore target"
  options:
    - label: "Locally (dev machine)"
      description: "Load the backup into your local docker-compose database, for debugging"
    - label: "Production server"
      description: "Restore the backup back onto the live server"
```

- "Locally (dev machine)" → go to **Branch A**.
- "Production server" → go to **Branch B**.

---

## Branch A — Restore locally

### A.1 — Safety confirmation

```
AskUserQuestion:
  question: "This will overwrite your LOCAL dev database with a copy of PRODUCTION data (which may include real user data). Continue?"
  header: "Overwrite local DB"
  options:
    - label: "Continue"
      description: "Overwrite the local dev database with the chosen production backup"
    - label: "Cancel"
      description: "Stop here — do not restore anything"
```

"Cancel" → stop.

### A.2 — Local S3 credentials

```bash
cat .env.backup.local 2>/dev/null
```

If the file is missing, or missing any of `S3_BACKUP_ACCESS_KEY` /
`S3_BACKUP_SECRET_KEY` / `S3_BACKUP_BUCKET` / `S3_BACKUP_ENDPOINT`:

Collect the 4 values via a **plain chat message** — do **not** use `AskUserQuestion` for
this (mirrors `ea-migrationdb-setup`'s pattern for one-off credential collection).
Explain these are the same values already configured as GitHub repo secrets (`Settings →
Secrets and variables → Actions`); `S3_BACKUP_ENDPOINT` may be left blank for plain AWS
S3. **Never fabricate or guess these values.**

Write (or update) `.env.backup.local` at the project root:

```
S3_BACKUP_ACCESS_KEY=<value>
S3_BACKUP_SECRET_KEY=<value>
S3_BACKUP_BUCKET=<value>
S3_BACKUP_ENDPOINT=<value or empty>
```

Ensure `.gitignore` contains `.env.backup.local` (append if missing, create the file if
it doesn't exist) — never commit these credentials.

### A.3 — Build a throwaway restore image

**Never use `docker compose build/run/up backup-cron` locally** — `backup-cron` carries
`profiles: ["backup"]` specifically so it never starts on a dev machine (see
`ea-deploy-backup` Rules). Instead build the same `backup/Dockerfile` directly, bypassing
the compose service entirely:

```bash
docker build -t <projectName>-restore-tmp ./backup
```

### A.4 — List available backups

Run an ephemeral container off that image (plain `docker run --rm`, never `docker
compose run`) to list dated DB backups in the bucket:

```bash
docker run --rm --env-file .env.backup.local -e PROJECT_NAME=<projectName> \
  <projectName>-restore-tmp sh -c '
  export AWS_ACCESS_KEY_ID="$S3_BACKUP_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_BACKUP_SECRET_KEY"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
  if [ -n "$S3_BACKUP_ENDPOINT" ]; then
    aws --endpoint-url "$S3_BACKUP_ENDPOINT" s3 ls "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/" | grep db-backup
  else
    aws s3 ls "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/" | grep db-backup
  fi
'
```

Parse the `YYYY-MM-DD` dates out of the `db-backup-<date>.tar.gz` filenames.

- No dates found → display `No database backups found in the bucket for this project.`
  and stop.
- If the user already named a date in their request, use it (skip asking).
- Otherwise present the most recent 10 via `AskUserQuestion` (single-select, most recent
  first, the top one labelled "(latest)"). Store as `chosenDate`.

### A.5 — Run the restore

Attach to the external `proxy` network (already used by the app/db services — see
`ea-docker-setup`) so the container can resolve the target DB service by name. Bind-mount
`backup/scripts` read-only (same scripts the compose service would use) and, only for a
sqlite `dbEntry`, bind-mount its volume **read-write** (no `:ro` — this container is not
the compose service, so there's no shared mount config to edit):

```bash
docker run --rm \
  --network proxy \
  --env-file .env --env-file .env.backup.local \
  -e PROJECT_NAME=<projectName> -e DB_HOST=<dbEntry.DB_HOST> -e DB_PORT=<dbEntry.DB_PORT> \
  -v "$(pwd)/backup/scripts:/scripts:ro" \
  [-v <dbEntry.volumeName>:/backup-src-db/<dbEntry.volumeName>] \
  <projectName>-restore-tmp \
  bash /scripts/restore.sh db <chosenDate> --yes
```

Include the `-v <volumeName>:/backup-src-db/<volumeName>` line only for a sqlite
`dbEntry`; omit it for network-based engines. `--env-file .env` supplies the local
`DB_NAME`/`DB_USER`/`DB_PASSWORD` (same variable names `ea-migrationdb-setup` already
uses for local dev). Relay `restore.sh`'s own output as it runs — it already handles
per-engine nuances (e.g. Redis needs a service restart after the file lands, sqlite stops
and restarts the app service itself).

### A.6 — Clean up

```bash
docker rmi <projectName>-restore-tmp
```

### A.7 — Summary

```
✓ Restored production backup from <chosenDate> into the local <dbEntry.dbType> database.
```

---

## Branch B — Restore to production

### B.1 — Extra-strong safety confirmation

```
AskUserQuestion:
  question: "This will OVERWRITE THE LIVE PRODUCTION DATABASE with the backup from <chosenDate>. Any data written after that date will be permanently lost. This cannot be undone except by restoring an even newer backup. Are you sure?"
  header: "Overwrite production"
  options:
    - label: "Yes, overwrite production"
      description: "Restore <chosenDate>'s backup onto the live server, replacing current production data"
    - label: "Cancel"
      description: "Stop here — do not touch production"
```

"Cancel" → stop. Ask this **before** listing/choosing a date is fine, but the date must
be named explicitly in the confirmation text (re-ask if the user changes their mind on
the date afterward).

### B.2 — List available backups

Same mechanism as Branch A.4 (throwaway `docker build`/`docker run`, never `docker
compose run backup-cron`) — run from the developer's machine, it only needs S3 read
access. Collect `.env.backup.local` the same way as A.2 if not already present. Store the
chosen date as `chosenDate`.

### B.3 — Scaffold the restore workflow

```bash
cat .github/workflows/restore.yml 2>/dev/null
```

If it doesn't already exist, create `.github/workflows/restore.yml`. Read
`.github/workflows/deploy.yml` first and reuse its exact `<serverPath>` (the directory
`cd`'d into in the `deploy`/`migrate` jobs, set by `ea-deploy-setup` to
`/var/www/project/<projectName>`) — do not guess it independently.

```yaml
name: Restore backup

on:
  workflow_dispatch:
    inputs:
      date:
        description: "Backup date to restore (YYYY-MM-DD)"
        required: true

jobs:
  restore:
    name: Restore database backup
    runs-on: ubuntu-latest

    steps:
      - name: Restore on server
        uses: appleboy/ssh-action@v1.2.0
        env:
          S3_BACKUP_ACCESS_KEY: ${{ secrets.S3_BACKUP_ACCESS_KEY }}
          S3_BACKUP_SECRET_KEY: ${{ secrets.S3_BACKUP_SECRET_KEY }}
          S3_BACKUP_BUCKET: ${{ secrets.S3_BACKUP_BUCKET }}
          S3_BACKUP_ENDPOINT: ${{ secrets.S3_BACKUP_ENDPOINT }}
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          envs: S3_BACKUP_ACCESS_KEY,S3_BACKUP_SECRET_KEY,S3_BACKUP_BUCKET,S3_BACKUP_ENDPOINT
          script: |
            cd <serverPath>
            git pull origin main
            docker compose run --rm backup-cron /scripts/restore.sh db ${{ github.event.inputs.date }} --yes
```

Replace `<serverPath>` with the value read from `deploy.yml`. The `env:`/`envs:` pairing
forwards the S3 secrets into the SSH session exactly like `ea-deploy-backup` Step 6.1
already does for the `deploy` job — `appleboy/ssh-action`'s `envs:` only forwards
variables that already exist in the runner's own environment.

If a sqlite `dbEntry` is present, also check the `<volumeName>:/backup-src-db/<volumeName>`
mount on the `backup-cron` service in `docker-compose.yml`: if suffixed `:ro`, drop the
suffix (this is the one prerequisite `ea-deploy-backup` left as a TODO — sqlite restore
cannot write through a read-only mount). This is a real, committed change to
`docker-compose.yml`, unlike Branch A which never touches it.

### B.4 — Commit and push

Invoke the `ea-github-commit` skill to commit and push `.github/workflows/restore.yml`
(and the `docker-compose.yml` sqlite mount fix, if made). The workflow is inert until
manually run — `workflow_dispatch` never fires on push.

### B.5 — Hand off to the human

**Do not trigger the workflow from chat.** Display:

```
✓ Restore workflow ready: .github/workflows/restore.yml

To actually restore <chosenDate>'s backup onto production:
  1. Open the repo on GitHub → Actions tab
  2. Select "Restore backup" in the left sidebar
  3. Click "Run workflow", enter the date: <chosenDate>
  4. Click "Run workflow" to confirm

Watch the run's log for the result. This step must be triggered manually — restoring
production data is not something this skill will do on your behalf.
```

### B.6 — Summary

Confirm whether the workflow was newly created or already existed, and repeat the manual
trigger instructions above.

---

## Rules

- **Never** fabricate or guess S3 credentials — collect them from the user (Branch A.2 /
  B.2) or read them from the gitignored local file. Same rule as `ea-deploy-backup`.
- **Never** commit `.env.backup.local`.
- **Never** run the compose `backup-cron` service locally (`docker compose run/up
  backup-cron` on a dev machine) — `profiles: ["backup"]` exists specifically to keep it
  out of local dev (`ea-deploy-backup` Rules). Branch A always builds/runs a throwaway
  image instead (`docker build`/`docker run`), never the compose service.
- **Never** trigger the production `workflow_dispatch` run itself, via `gh` CLI, the
  GitHub API, or any other means — only scaffold and commit the workflow file. The human
  always clicks "Run workflow" in the GitHub Actions UI.
- Scope is DB-only — do not extend to asset volumes unless explicitly asked; that would
  also require addressing the asset volumes' `:ro` mount on `backup-cron`, which this
  skill does not touch.
- If `docker-compose.yml` or `.easydeploy`'s `backup-setup@*` line is missing, stop and
  direct the user to `ea-deploy-backup` — do not create backup infrastructure here.
