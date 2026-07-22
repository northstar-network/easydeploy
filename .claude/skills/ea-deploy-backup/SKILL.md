---
name: ea-deploy-backup
description: >
  Sets up automated daily backups (database and/or assets) to an S3-compatible
  bucket for a project. Adds a dedicated `<projectName>-backup-cron` container
  running a cron schedule, and wires the required S3 secrets into the GitHub
  Actions deploy workflow. Can be invoked directly on an existing project, or
  automatically right after `ea-deploy-setup`.
  Trigger phrases: "backup", "sauvegarde", "backup setup", "setup backup",
  "deploy backup", "configurer les backups", "sauvegarder la base de données",
  "ea-deploy-backup".
version: 1.0.0
---

# ea-deploy-backup

Configures automated daily backups of the project's database and/or asset
volumes to a shared S3-compatible bucket, running from a dedicated
`<projectName>-backup-cron` container on a daily cron schedule (02:00
Europe/Paris), with a 7-day retention.

---

## Step 1 — Check prerequisites

### 1.1 — docker-compose.yml must exist

```bash
ls docker-compose.yml 2>/dev/null
```

- Absent → display:
  ```
  No docker-compose.yml found. Run /ea-docker-setup first, then re-run /deploy-backup.
  ```
  Stop.
- Present → continue.

### 1.2 — CI workflow must exist

Backups are deployed and fed their S3 credentials through the GitHub Actions
workflow, so it must already exist.

```bash
ls .github/workflows/deploy.yml 2>/dev/null
```

- Absent → display:
  ```
  No CI workflow found. Run /ea-deploy-setup first, then re-run /deploy-backup.
  ```
  Stop.
- Present → continue.

### 1.3 — Already configured?

```bash
cat .easydeploy 2>/dev/null
```

- Contains a line matching `backup-setup@*` → ask:
  ```
  AskUserQuestion:
    question: "Backups already appear to be configured for this project. What would you like to do?"
    header: "Backup exists"
    options:
      - label: "Reconfigure"
        description: "Re-run detection and regenerate the backup container, scripts, and CI wiring"
      - label: "Cancel"
        description: "Stop here — keep the existing backup setup"
  ```
  - "Cancel" → stop.
  - "Reconfigure" → continue.
- No such line → continue.

---

## Step 2 — Project name

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Store as `projectName`.

---

## Step 3 — Detect what to back up

### 3.1 — Database engine(s)

Read `docker-compose.yml`. For every service whose `image:` matches one of
`postgres`, `mysql`, `mariadb`, `mongo`/`mongodb`, `redis`, record:

- `serviceName` (the compose service key, e.g. `db`, `redis`)
- `dbType`: `postgres | mysql | mariadb | mongodb | redis`

#### SQLite (no dedicated service)

A project can use SQLite without any database service in `docker-compose.yml`
— `ea-migrationdb-setup` handles this case by adding a named volume for the
directory containing the SQLite file, mounted directly on the app service
(no separate container). Detect this case even when no server-based DB was
found above:

- Look for evidence of SQLite usage: `DATABASE_URL=file:...` in `.env`, a
  `knexfile.js`/`.ts` with `client: 'sqlite3'`, a Prisma `datasource` with
  `provider = "sqlite"`, or a `.db` / `.sqlite` / `.sqlite3` file path
  referenced in the source code.
- If found, read the source/config to resolve the SQLite file's directory
  path inside the container (e.g. `path.join(__dirname, 'data', 'notes.db')`
  with the app rooted at `/app` → `/app/data`).
- Match that directory against the app service's `volumes:` mount targets in
  `docker-compose.yml`. The named volume mounted there is the SQLite data
  volume — record it as a `dbServices` entry:
  - `serviceName`: `sqlite` (synthetic — there is no real compose service)
  - `dbType`: `sqlite`
  - `volumeName`: the matched named volume
- This volume is now "claimed" by the database — exclude it from the asset
  volume candidates in 3.2, even though it will still end up backed up (as
  part of the database, not as an asset).
- If SQLite usage is suspected but the file's directory doesn't match any
  named volume (e.g. it lives on the anonymous source bind mount), skip it —
  there is nothing separate to reliably snapshot; do not guess.

Store the list as `dbServices` (can be empty, or contain more than one entry).

### 3.2 — Asset volumes

Read the main app service's `volumes:` list in `docker-compose.yml`. Exclude:

- the source bind mount (`.:/app` or equivalent)
- dependency volumes (`/app/node_modules`, `/app/vendor`, `/app/.venv`,
  `/app/vendor/bundle`, `/app/.gradle`, `/app/target`)
- any volume already identified as a DB data volume (`db_data`, `redis_data`,
  or the SQLite volume claimed in 3.1, …)

Every remaining **named volume** mounted on the app service is a candidate
asset volume.

- Zero candidates → `assetVolumes = []`.
- One candidate → use it directly, `assetVolumes = [<name>]`.
- More than one → ask:
  ```
  AskUserQuestion:
    question: "Which volume(s) should be included in the daily asset backup?"
    header: "Asset volumes"
    multiSelect: true
    options:
      - label: "<volume 1>"
        description: "Mounted at <mount path> on <appService>"
      - label: "<volume 2>"
        description: "..."
  ```
  Store selection as `assetVolumes`.

### 3.3 — Nothing to back up

If `dbServices` is empty AND `assetVolumes` is empty → display:

```
No database or asset volume found to back up in docker-compose.yml.
```

Stop.

---

## Step 4 — Generate the backup image and scripts

Create the `backup/` directory at the project root.

### 4.1 — `backup/Dockerfile`

Pick the Alpine packages needed based on `dbServices` — only add what is
actually detected:

| `dbType` | Alpine package | Notes |
|---|---|---|
| postgres | `postgresql-client` | provides `pg_dump` / `pg_restore` |
| mysql / mariadb | `mariadb-client` | provides `mysqldump` / `mysql`, wire-compatible with both |
| mongodb | `mongodb-tools` | `mongodump` / `mongorestore` — best-effort: Alpine's package may lag behind the latest MongoDB wire protocol |
| redis | `redis` | provides `redis-cli` |
| sqlite | `sqlite` | provides the `sqlite3` CLI, used for a safe hot `.backup` |

```dockerfile
FROM alpine:3.20

RUN apk add --no-cache bash aws-cli tzdata coreutils <db-packages>

ENV TZ=Europe/Paris

CMD ["crond", "-f", "-l", "2"]
```

Replace `<db-packages>` with the space-separated list resolved from the table
above (only for detected `dbServices`; always include `aws-cli`, `bash`,
`tzdata`, and `coreutils` regardless).

`coreutils` is required even though Alpine ships a `date` applet already —
BusyBox's `date` does not understand GNU relative-date syntax like
`-d "-7 days"`, which the retention cleanup in `backup.sh` (4.3) depends on.
Installing `coreutils` provides GNU `date` and takes priority on `$PATH`.

**Do not `COPY` `crontab` or `scripts/` into the image.** They are bind-mounted
from the host in Step 5 instead — same convention as the app service's own
source code (see `ea-docker-setup`: source is always mounted as a volume,
never baked into the image). This means a `git pull` on the server is enough
to pick up script or schedule changes; only a real Dockerfile change (e.g. a
new package) requires rebuilding the image. Baking scripts into the image
with `COPY` would make them stale on every deploy unless the image is
explicitly rebuilt, which normal deploys in this project never do.

### 4.2 — `backup/crontab`

```
0 2 * * * bash /scripts/backup.sh >> /var/log/backup.log 2>&1
```

Invoke via `bash /scripts/backup.sh`, not `/scripts/backup.sh` directly — the
script arrives on the server through a bind mount and git does not reliably
preserve the executable bit across all clone/checkout paths.

### 4.3 — `backup/scripts/backup.sh`

Write a bash script that:

1. Computes `DATE=$(date +%F)` and a staging directory `STAGING=/tmp/backup-$DATE`, `mkdir -p "$STAGING"`.
2. Maps the `S3_BACKUP_*` variables onto the names the `aws` CLI actually
   reads for credentials — it does **not** recognize `S3_BACKUP_ACCESS_KEY` /
   `S3_BACKUP_SECRET_KEY` on its own, only `AWS_ACCESS_KEY_ID` /
   `AWS_SECRET_ACCESS_KEY` (and a region, or it errors even when an
   `--endpoint-url` is given):
   ```bash
   export AWS_ACCESS_KEY_ID="$S3_BACKUP_ACCESS_KEY"
   export AWS_SECRET_ACCESS_KEY="$S3_BACKUP_SECRET_KEY"
   export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
   ```
   Then defines an `aws_cmd` helper that adds `--endpoint-url
   "$S3_BACKUP_ENDPOINT"` only when that variable is non-empty (so plain AWS
   S3 still works with no endpoint set):
   ```bash
   aws_cmd() {
     if [ -n "$S3_BACKUP_ENDPOINT" ]; then
       aws --endpoint-url "$S3_BACKUP_ENDPOINT" "$@"
     else
       aws "$@"
     fi
   }
   ```
3. **If `dbServices` is non-empty** — for each entry, dump into `$STAGING/<serviceName>.<ext>` using the matching command:

   | `dbType` | Dump command |
   |---|---|
   | postgres | `PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -F c -f "$STAGING/<serviceName>.dump"` |
   | mysql / mariadb | `mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$STAGING/<serviceName>.sql"` |
   | mongodb | `mongodump --uri="mongodb://$MONGO_USER:$MONGO_PASSWORD@$DB_HOST:${DB_PORT:-27017}/$MONGO_DB" --archive="$STAGING/<serviceName>.archive"` |
   | redis | `redis-cli -h "$DB_HOST" -p "${DB_PORT:-6379}" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} --rdb "$STAGING/<serviceName>.rdb"` |
   | sqlite | no network connection — the file is on the mounted volume (`/backup-src-db/<volumeName>`, see Step 5). Glob for db files and hot-copy each with `sqlite3`'s `.backup` command so a concurrent writer can't corrupt the snapshot: `for f in /backup-src-db/<volumeName>/*.db /backup-src-db/<volumeName>/*.sqlite /backup-src-db/<volumeName>/*.sqlite3; do [ -f "$f" ] || continue; sqlite3 "$f" ".backup '$STAGING/$(basename "$f")'"; done` |

   Then archive and upload:
   ```bash
   tar czf "/tmp/db-backup-$DATE.tar.gz" -C "$STAGING" .
   aws_cmd s3 cp "/tmp/db-backup-$DATE.tar.gz" "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/db-backup-$DATE.tar.gz"
   ```
4. **If `assetVolumes` is non-empty** — tar the mounted source paths (mounted
   read-only at `/backup-src/<volumeName>` — see Step 5) and upload:
   ```bash
   tar czf "/tmp/assets-backup-$DATE.tar.gz" -C /backup-src .
   aws_cmd s3 cp "/tmp/assets-backup-$DATE.tar.gz" "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/assets-backup-$DATE.tar.gz"
   ```
5. **Retention (7 days)** — after uploading, delete objects under this
   project's prefix older than `BACKUP_RETENTION_DAYS` (default 7):
   ```bash
   CUTOFF=$(date -d "-${BACKUP_RETENTION_DAYS:-7} days" +%F)
   aws_cmd s3 ls "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/" | awk '{print $4}' | while read -r key; do
     fdate=$(echo "$key" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
     if [ -n "$fdate" ] && [ "$fdate" \< "$CUTOFF" ]; then
       aws_cmd s3 rm "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/$key"
     fi
   done
   ```
6. Clean up the staging directory and local tarballs: `rm -rf "$STAGING" /tmp/db-backup-$DATE.tar.gz /tmp/assets-backup-$DATE.tar.gz`.

Only include the blocks (3), (4) that apply based on what was detected in
Step 3 — do not write dead code for a database or asset backup that isn't
configured.

### 4.4 — `backup/scripts/restore.sh`

Write a companion restore script, usage:

```
restore.sh <db|assets> <YYYY-MM-DD> --yes
```

- Requires the literal `--yes` flag — refuse to run without it (this
  overwrites live data). Without it, print usage and exit 1.
- Exports the same `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
  `AWS_DEFAULT_REGION` mapping as `backup.sh` (4.3) before defining `aws_cmd`
  — the CLI needs it here too.
- Downloads the matching archive:
  ```bash
  aws_cmd s3 cp "s3://$S3_BACKUP_BUCKET/$PROJECT_NAME/<type>-backup-<date>.tar.gz" "/tmp/restore.tar.gz"
  ```
- **`db` restore** — extract to a temp dir, then for each file restore with
  the matching command:

  | `dbType` | Restore command |
  |---|---|
  | postgres | `PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --clean "<serviceName>.dump"` |
  | mysql / mariadb | `mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "<serviceName>.sql"` |
  | mongodb | `mongorestore --uri="mongodb://$MONGO_USER:$MONGO_PASSWORD@$DB_HOST:${DB_PORT:-27017}/$MONGO_DB" --archive="<serviceName>.archive" --drop` |
  | redis | copy `<serviceName>.rdb` into the Redis data volume and restart the `redis` service so it reloads it on boot (an active Redis instance cannot load an RDB file live) |
  | sqlite | stop the app service first (`docker compose stop <appService>` — SQLite can't be safely swapped while the app has it open), then copy the extracted file(s) over `/backup-src-db/<volumeName>/`, then restart the app service |

- **`assets` restore** — extract the tarball directly over
  `/backup-src/` (which must be the same volume mount as in Step 5, so the
  restore container needs the volume mounted read-write — see Step 5 note).

Use the same `aws_cmd` helper as `backup.sh`.

---

## Step 5 — Add the service to docker-compose.yml

Read `docker-compose.yml` and add:

```yaml
  backup-cron:
    container_name: <projectName>-backup-cron
    build: ./backup
    profiles: ["backup"]
    environment:
      - S3_BACKUP_ACCESS_KEY=${S3_BACKUP_ACCESS_KEY}
      - S3_BACKUP_SECRET_KEY=${S3_BACKUP_SECRET_KEY}
      - S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET}
      - S3_BACKUP_ENDPOINT=${S3_BACKUP_ENDPOINT}
      - PROJECT_NAME=<projectName>
      - BACKUP_RETENTION_DAYS=7
      # + the DB connection vars matching what was detected, e.g.:
      - DB_HOST=<serviceName>
      - DB_PORT=<port>
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
    volumes:
      - <assetVolume>:/backup-src/<assetVolume>:ro      # one line per asset volume, repeat for each
      - <sqliteVolume>:/backup-src-db/<sqliteVolume>:ro # one line per sqlite dbServices entry, repeat for each
      - ./backup/scripts:/scripts:ro
      - ./backup/crontab:/etc/crontabs/root:ro
    networks:
      - proxy
    restart: unless-stopped
```

Adapt the DB environment block to the actual variables already used by the
project (from `ea-migrationdb-setup`): use `MONGO_USER` / `MONGO_PASSWORD` /
`MONGO_DB` for mongodb, no password vars for a plain redis without auth. Set
`DB_HOST` to the compose service name of the database (e.g. `db`, `redis`) so
DNS resolution works over the `proxy` network. For a `sqlite` entry, omit the
`DB_HOST`/`DB_USER`/`DB_PASSWORD` lines entirely — only the volume mount is
needed, there is no network connection to make.

**Important:** `profiles: ["backup"]` means this container never starts on a
plain local `docker compose up` — it only starts in production, when the
deploy script explicitly passes `--profile backup` (Step 6).

If asset or sqlite restore needs to be possible later, mount those volumes
read-write instead of read-only if the user is expected to restore via this
same container — default to read-only for the daily backup job; note in the
Step 10 summary that a manual `docker compose run` with a writable mount is
needed to actually execute `restore.sh assets` or `restore.sh db` (sqlite
case).

---

## Step 6 — Wire S3 secrets into the CI workflow

Read `.github/workflows/deploy.yml`.

### 6.1 — Expose the secrets to the runner, then forward them over SSH

`appleboy/ssh-action`'s `envs:` input only forwards environment variables
that already exist in the **job runner's own environment** — it does not
read `secrets.*` directly. Two additions are required on the `deploy` job's
step, both needed together:

1. An `env:` block on the step, mapping each GitHub secret into a runner env var:

```yaml
        env:
          S3_BACKUP_ACCESS_KEY: ${{ secrets.S3_BACKUP_ACCESS_KEY }}
          S3_BACKUP_SECRET_KEY: ${{ secrets.S3_BACKUP_SECRET_KEY }}
          S3_BACKUP_BUCKET: ${{ secrets.S3_BACKUP_BUCKET }}
          S3_BACKUP_ENDPOINT: ${{ secrets.S3_BACKUP_ENDPOINT }}
```

2. The `envs:` input inside `with:`, naming those same variables so
   `appleboy/ssh-action` forwards them into the SSH session:

```yaml
          envs: S3_BACKUP_ACCESS_KEY,S3_BACKUP_SECRET_KEY,S3_BACKUP_BUCKET,S3_BACKUP_ENDPOINT
```

Without the `env:` block, `envs:` has nothing to forward and the variables
arrive empty on the server — they must already exist as repository secrets
(see Step 9).

### 6.2 — Write a non-committed `.env.backup` at deploy time

In the `script:` block, right before the `docker compose ... up -d` line,
insert:

```bash
            cat > .env.backup <<EOF
            S3_BACKUP_ACCESS_KEY=$S3_BACKUP_ACCESS_KEY
            S3_BACKUP_SECRET_KEY=$S3_BACKUP_SECRET_KEY
            S3_BACKUP_BUCKET=$S3_BACKUP_BUCKET
            S3_BACKUP_ENDPOINT=$S3_BACKUP_ENDPOINT
            EOF
```

### 6.3 — Tear down and restart the backup profile on every deploy

`docker compose down` (with no `--profile backup`) never touches a
profile-scoped service — it silently leaves `backup-cron` running untouched,
so it never picks up fresh env vars (e.g. rotated S3 secrets) on redeploy.
In **every** job that runs `docker compose down` (both `migrate` and
`deploy`), change it to:

```bash
docker compose --profile backup down
```

Then change the final compose command in the `deploy` job from:

```bash
docker compose --env-file .env.prod up -d --remove-orphans
```

to:

```bash
docker compose --env-file .env.prod --env-file .env.backup --profile backup up -d --build --remove-orphans
```

`--build` is required here: `docker compose up -d` never rebuilds an image
just because its Dockerfile changed on disk — it only builds when the image
doesn't exist yet. Without `--build`, `backup-cron` would keep running
whatever image was built on the very first deploy forever, silently ignoring
any later change to `backup/Dockerfile` (new package, base image bump, …).
Rebuilds are cheap here thanks to Docker layer caching when nothing actually
changed.

Docker Compose merges multiple `--env-file` flags; the last one wins on
conflicts, so `.env.backup` never needs to duplicate anything from
`.env.prod`.

Display:

```
✓ CI workflow updated with S3 backup secrets and backup profile
```

---

## Step 7 — .gitignore

Ensure `.env.backup` is listed in `.gitignore` (append if missing, create the
file if it does not exist). Never commit S3 credentials.

---

## Step 8 — Mark as configured

Append (or update) a line in `.easydeploy` at the project root:

```
backup-setup@1.0.0
```

Do not remove the existing `docker-setup@...` line — each feature has its own
line in this file.

---

## Step 9 — Update README

Read `README.md`. Add or update a `## Backups` section (do not modify other
sections):

```markdown
## Backups

Automated daily backups run at 02:00 (Europe/Paris) from the
`<projectName>-backup-cron` container, with a 7-day retention on S3.

- Backed up: <"database (<dbType list>)" and/or "assets (<volume list>)">
- Location: `s3://<bucket>/<projectName>/db-backup-YYYY-MM-DD.tar.gz` and/or
  `s3://<bucket>/<projectName>/assets-backup-YYYY-MM-DD.tar.gz`
- Retention: 7 days (older backups are deleted automatically after each run)

### Required GitHub secrets

Configure these once at `Settings → Secrets and variables → Actions`
(shared across all projects using the same bucket):

| Secret | Description |
|---|---|
| `S3_BACKUP_ACCESS_KEY` | Access key for the backup bucket |
| `S3_BACKUP_SECRET_KEY` | Secret key for the backup bucket |
| `S3_BACKUP_BUCKET` | Bucket name |
| `S3_BACKUP_ENDPOINT` | S3-compatible endpoint URL (leave empty for AWS S3) |

### Restoring a backup

```bash
docker compose run --rm backup-cron /scripts/restore.sh db 2026-07-20 --yes
docker compose run --rm backup-cron /scripts/restore.sh assets 2026-07-20 --yes
```
```

Display:

```
✓ README.md updated with backup info
```

---

## Step 10 — Summary

```
✓ ea-deploy-backup complete

  Project      : <projectName>
  Container    : <projectName>-backup-cron
  Database(s)  : <dbType list, or "none">
  Asset volumes: <volume list, or "none">
  Schedule     : daily at 02:00 (Europe/Paris)
  Retention    : 7 days
  Bucket path  : s3://<bucket>/<projectName>/

⚠️  Before the next deploy, add these 4 secrets to the GitHub repo
    (Settings → Secrets and variables → Actions) if not already present:
    S3_BACKUP_ACCESS_KEY, S3_BACKUP_SECRET_KEY, S3_BACKUP_BUCKET, S3_BACKUP_ENDPOINT
```

---

## Rules

- **Never** write S3 credentials into any file that gets committed — they only
  ever flow through GitHub Actions secrets → SSH session env → `.env.backup`
  (gitignored, generated fresh on every deploy).
- **Always** set `profiles: ["backup"]` on the `backup-cron` service so it
  never starts during local development.
- **Never** guess or fabricate S3 credential values — they are not something
  this skill collects; they must already exist as GitHub secrets.
- If invoked by `ea-deploy-setup`, resume `ea-deploy-setup` (and then
  `easydeploy` if that was the original caller) when this skill finishes —
  do not stop.
- If `docker-compose.yml` or the CI workflow is missing, stop and direct the
  user to the appropriate prerequisite skill — do not create them here.
- Only dump/tar the databases and volumes actually detected in Step 3 — do
  not generate placeholder logic for engines that aren't present.
