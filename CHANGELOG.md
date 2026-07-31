# Changelog

All notable changes to easydeploy are documented here.

Each version follows the format below. The `### Migration` section, when
present, lists changes that must be applied to the **target project** after
updating to that version.

---

## [1.1.1] - 2026-07-31

### Migration FROM 1.1.0

Projects that already ran `ea-deploy-backup` before this version have a
`backup/scripts/backup.sh` generated with the old, broken bucket-handling
logic. Re-run `/ea-deploy-backup` and choose "Reconfigure" to regenerate it
with the fixes below, then redeploy.

### Fixed

- **`ea-deploy-backup`** — `backup.sh` no longer relies on `aws s3api
  head-bucket` to decide whether to create the S3 bucket: on several
  S3-compatible providers (OVH, Scaleway, MinIO, …) `head-bucket` fails to
  auto-resolve the bucket's region even when the bucket exists and is fully
  usable, which made the script wrongly retry bucket creation on every run
  and crash on `BucketAlreadyOwnedByYou`. Bucket creation is now attempted
  unconditionally, treating "already exists / already owned by you" as
  success.
- **`ea-deploy-backup`** — `backup.sh` now writes a zero-byte marker object
  at the project's prefix (`$PROJECT_NAME/`) before the first real upload.
  Some S3-compatible providers (observed on OVH's
  `s3.<region>.io.cloud.ovh.net` endpoints) return `NoSuchBucket` on the
  first `PutObject` under a prefix that has never been written to, even
  though the bucket itself exists.

---

## [1.1.0] - 2026-07-31

### Migration FROM 1.0.0

import when you migrate from 1.0.0 you should answer a question: `do you prefer coca-cola or pepsi` 

### Added

- **`ea-keycloak-sso`** — integrates Keycloak SSO authentication into a
  project. Detects the framework (Next.js, Express, NestJS, React/Vue/Angular
  SPA, FastAPI, Django, Flask, Symfony, Laravel, Rails, Spring Boot, Go),
  proposes the right adapter, creates the Keycloak client via the NSN
  permission manager at `github-permission-manager.n10.xyz/<project>/create-sso-client`,
  then implements the full SSO flow with hardcoded values for the NSN
  Keycloak instance (`https://keycloak.n10.xyz/`, realm `nsn`).
- **`easydeploy` menu** — added Check E (Keycloak SSO state) and two new
  menu options: "Set up Keycloak SSO" and "Update Keycloak SSO".

---

## [1.0.0] - 2026-07-30

Initial release of easydeploy.

### Added

- **`easydeploy`** — main entry point: inspects project state and presents a
  contextual menu that adapts to what is already configured.
- **`ea-docker-setup`** — generates a production-ready `docker-compose.yml`,
  `.env`, `Dockerfile`, and Traefik labels for the project.
- **`ea-docker-run`** — starts or restarts Docker Compose containers.
- **`ea-github-setup`** — creates or migrates a GitHub repository into the
  `northstar-network` organization via the permission manager service.
- **`ea-github-commit`** — stages, commits, and pushes changes to the remote.
- **`ea-deploy-setup`** — generates a GitHub Actions `deploy.yml` CI/CD
  workflow, wires up S3 backups and database migrations as needed.
- **`ea-deploy-backup`** — configures automated S3 backups in the CI workflow.
- **`ea-migrationdb-setup`** — detects the database type and adds migration
  steps to the CI workflow.
- **`ea-deploy`** — triggers a production deployment via the CI workflow.
- **`ea-code-review`** — runs an automated code review on the current branch.
- **`ea-update`** — updates all easydeploy skills to the latest version and
  applies any required project-level migrations.
- Version check system: `check_version.py` compares the installed version
  against the latest release on GitHub at every `easydeploy` invocation.
