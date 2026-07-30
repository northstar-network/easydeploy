# ea-restore

Restores a chosen dated database backup produced by `ea-deploy-backup`, either onto the
developer's local machine or back onto the production server. Database only — asset
volumes are out of scope.

## Trigger

```
/ea-restore
```

Also matches "restore locally", "restore to production", "restaurer la prod en local",
"restaurer en production", "sync prod to local", "pull prod data".

## What it does

1. **Checks prerequisites** — `.easydeploy` must already have a `backup-setup@*` line
   (run `ea-deploy-backup` first if not); re-detects which database(s) can be restored
   from `docker-compose.yml`
2. **Asks where to restore** — locally (dev machine) or to production
3. **Lists available backups** in the shared S3 bucket for this project and lets you
   pick a date
4. Restores the chosen backup

## Restoring locally

- Confirms the overwrite (local dev DB will be replaced with a copy of production data)
- Collects S3 read credentials once, stored in a gitignored `.env.backup.local`
- Builds a **throwaway** image from `backup/Dockerfile` and runs it with a plain `docker
  run` — it never starts the compose-managed `backup-cron` service, which is
  intentionally kept out of local development (`profiles: ["backup"]`)
- Runs `restore.sh` against your local `db` service over the shared `proxy` network

## Restoring to production

- Confirms the overwrite with an explicit "this cannot be undone" warning
- Scaffolds `.github/workflows/restore.yml` (a `workflow_dispatch` workflow) if it
  doesn't already exist, reusing the same SSH and S3 secrets already wired into
  `deploy.yml`
- Commits and pushes the workflow file
- **Does not trigger the run itself** — restoring production data always requires a
  human to open GitHub → Actions → "Restore backup" → "Run workflow" and enter the date

## Generated/modified files

| File | Description |
|---|---|
| `.env.backup.local` | Gitignored S3 read credentials for local restores |
| `.github/workflows/restore.yml` | `workflow_dispatch` job that restores a backup on the server via SSH (production restores only) |

## Prerequisites

- `ea-deploy-backup` must already be configured (`backup-setup@*` in `.easydeploy`)
- The 4 `S3_BACKUP_*` GitHub secrets must already exist for production restores
- Docker must be running locally for local restores
