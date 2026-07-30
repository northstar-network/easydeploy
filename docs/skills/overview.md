# Skills overview

## All skills

| Skill | Trigger | Purpose |
|---|---|---|
| [`easydeploy`](../../.claude/skills/easydeploy/) | `/easydeploy` | Main entry point — inspects project state and presents a contextual menu |
| [`ea-docker-setup`](docker-setup.md) | `/docker-setup` | Detects project type, generates Dockerfile + docker-compose.yml, builds image |
| [`ea-docker-run`](docker-run.md) | `/docker-run` | Starts containers via `docker compose up -d` |
| [`ea-github-setup`](github-setup.md) | `/github-setup` | Creates or migrates the GitHub repo to `northstar-network` |
| [`ea-github-commit`](github-commit.md) | `/github-commit` | Pulls, resolves conflicts, runs code review, commits and pushes |
| [`ea-code-review`](code-review.md) | `/code-review` | Scans diff for security vulnerabilities, fatal errors, and performance issues |
| [`ea-deploy-setup`](deploy-setup.md) | `/deploy-setup` | Generates the GitHub Actions CI/CD workflow; delegates DB setup to `ea-migrationdb-setup` and backup setup to `ea-deploy-backup` |
| [`ea-migrationdb-setup`](deploy-setup.md#database-and-migrations) | `/migrationdb-setup` | Detects DB usage, adds DB service to Compose, initialises migration system |
| [`ea-deploy-backup`](backup-setup.md) | `/deploy-backup` | Sets up daily S3 backups (DB and/or assets) via a dedicated cron container |
| [`ea-restore`](restore.md) | `/ea-restore` | Restores a dated DB backup, locally or to production |
| [`ea-deploy`](deploy.md) | `/deploy` | Ensures CI exists, reviews code, pushes to trigger the production pipeline |

---

## Skill dependencies

```
/easydeploy
  ├── ea-docker-setup
  │     └── (optionally calls ea-docker-run at the end)
  ├── ea-docker-run
  └── ea-github-setup
        └── ea-github-commit
              └── ea-code-review

/deploy
  ├── ea-deploy-setup (if .github/workflows/deploy.yml is missing)
  │     ├── ea-migrationdb-setup
  │     └── ea-deploy-backup
  └── ea-github-commit
        └── ea-code-review

/ea-restore (standalone — requires ea-deploy-backup already configured)
  └── ea-github-commit (production branch only, to push the restore workflow)
```

---

## Typical execution order

Starting from a blank project:

| Step | Skill | What happens |
|---|---|---|
| 1 | `ea-docker-setup` | Project containerized, image built |
| 2 | `ea-docker-run` | Containers started, app accessible locally |
| 3 | `ea-github-setup` | Git initialized, repo created on GitHub, code pushed |
| 4 | `ea-deploy-setup` | CI workflow generated, DB and migrations configured, S3 backups set up |
| 5 | `ea-deploy` | Code reviewed, pushed, pipeline triggered |

After the initial setup, day-to-day usage is just `/deploy`.
