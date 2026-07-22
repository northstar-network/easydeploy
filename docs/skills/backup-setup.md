# ea-deploy-backup

Sets up automated daily backups of the project's database and/or asset volumes to a shared S3-compatible bucket.

## Trigger

```
/deploy-backup
```

Also invoked automatically by `ea-deploy-setup` right after the CI workflow is created.

## What it does

1. **Checks prerequisites** — `docker-compose.yml` and `.github/workflows/deploy.yml` must already exist
2. **Detects what to back up** — reads `docker-compose.yml` for database services (PostgreSQL, MySQL, MariaDB, MongoDB, Redis) and asset volumes mounted on the app service
3. **Generates a `backup/` directory**:
   - `Dockerfile` — Alpine image with `aws-cli`, the matching DB client tools, and cron
   - `crontab` — `0 2 * * *` (daily at 02:00, `TZ=Europe/Paris`)
   - `scripts/backup.sh` — dumps DB(s) and/or tars asset volumes, uploads to S3, prunes anything older than 7 days
   - `scripts/restore.sh` — downloads and restores a given date's backup (requires `--yes`)
4. **Adds a `backup-cron` service** to `docker-compose.yml`, container name `<projectName>-backup-cron`, with `profiles: ["backup"]` so it never runs during local development
5. **Wires S3 secrets into the CI workflow** — forwards 4 GitHub secrets into the SSH deploy step, writes them to a gitignored `.env.backup` at deploy time, and starts the container with `--profile backup`
6. **Updates README** — adds a Backups section with schedule, retention, required secrets, and restore commands

## Generated files

| File | Description |
|---|---|
| `backup/Dockerfile` | Backup image (aws-cli + DB clients + cron) |
| `backup/crontab` | Daily schedule at 02:00 Europe/Paris |
| `backup/scripts/backup.sh` | Dump/tar + upload + 7-day retention cleanup |
| `backup/scripts/restore.sh` | Manual restore from a given date |

## Required GitHub secrets

Configured once at `Settings → Secrets and variables → Actions` — shared across all projects using the same bucket:

| Secret | Description |
|---|---|
| `S3_BACKUP_ACCESS_KEY` | Access key for the backup bucket |
| `S3_BACKUP_SECRET_KEY` | Secret key for the backup bucket |
| `S3_BACKUP_BUCKET` | Bucket name (shared across projects) |
| `S3_BACKUP_ENDPOINT` | S3-compatible endpoint URL (leave empty for AWS S3) |

These credentials are never committed — they flow from the GitHub secret store, through the SSH deploy step's environment, into a gitignored `.env.backup` file regenerated on every deploy.

## Bucket layout

Backups are namespaced by project inside a single shared bucket:

```
s3://<bucket>/<projectName>/db-backup-YYYY-MM-DD.tar.gz
s3://<bucket>/<projectName>/assets-backup-YYYY-MM-DD.tar.gz
```

Retention: 7 days, enforced by `backup.sh` deleting older dated objects under the project's own prefix after each run.

## Restoring

```bash
docker compose run --rm backup-cron /scripts/restore.sh db 2026-07-20 --yes
docker compose run --rm backup-cron /scripts/restore.sh assets 2026-07-20 --yes
```

## Prerequisites

- `docker-compose.yml` must exist (run `ea-docker-setup` first)
- `.github/workflows/deploy.yml` must exist (run `ea-deploy-setup` first)
- The 4 GitHub secrets above must be configured before the next deploy
