# ea-docker-setup

Containerizes any project. Detects your tech stack, generates the missing Docker files, builds the image, and sets up local routing via Traefik.

## Trigger

```
/docker-setup
```

Also triggered automatically by `/easydeploy` when no Docker configuration is found.

## What it does

1. **Checks dependencies** — verifies Docker and Docker Compose are installed; offers to install them if missing
2. **Checks nsnrouting** — verifies the Traefik reverse proxy is installed and running; offers to install it if missing
3. **Detects the tech stack** — reads project files to identify the language and framework (Node.js, Python, Go, PHP, Java, Ruby, Rust, or static)
4. **Asks for a local hostname** — suggests `<project-name>.localhost`; you can accept or type a custom value
5. **Generates Docker files** — creates `Dockerfile` (if a custom build is needed) and `docker-compose.yml` with Traefik labels
6. **Updates `.env`** — adds or updates `TRAEFIK_HOSTNAME` with your chosen hostname
7. **Builds the image** — runs `docker compose build`; on failure, offers to retry or show full logs
8. **Registers the hostname** — adds an entry to `/etc/hosts` so the `.localhost` domain resolves (requires sudo)
9. **Generates README** — creates or updates `README.md` with project description, stack info, and getting-started instructions
10. **Offers to run** — asks if you want to start the containers immediately (calls `ea-docker-run`)

## Files produced

| File | Description |
|---|---|
| `Dockerfile` | Custom build instructions (only created if needed) |
| `docker-compose.yml` | Service definition with Traefik routing labels |
| `.env` | Contains `TRAEFIK_HOSTNAME` |
| `.easydeploy` | Marks the project as configured (`docker-setup@1.0.0`) |
| `README.md` | Created or updated with project documentation |

## Design rules

- Source code is always mounted as a volume (development mode — no rebuild needed on code change)
- No `ports:` key in docker-compose.yml — all traffic goes through Traefik
- Dependency directories are isolated in named volumes (`node_modules`, `vendor`, `.venv`, etc.) so host and container do not conflict

## Prerequisites

- Project files present at the root of the working directory
