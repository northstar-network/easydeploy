# easydeploy

Claude Code skills that take a project from raw source code to a live production URL — Docker setup, GitHub configuration, CI/CD pipeline, and deployment — all driven by natural language inside Claude Code.

## Quick start

```bash
./install.sh /path/to/your-project
```

Then open Claude Code in your project and type:

```
/easydeploy
```

The skill inspects your project state and guides you through every step.

## Documentation

- [Prerequisites](docs/prerequisites.md) — what you need before starting
- [Installation](docs/installation.md) — how to install easydeploy into a project
- [Getting started](docs/getting-started.md) — step-by-step walkthrough with screenshots
- [Skills reference](docs/skills/overview.md) — all skills, what they do, and how to trigger them
- [FAQ](docs/faq.md) — common issues and solutions

## Skills at a glance

| Skill | Trigger | What it does |
|---|---|---|
| `easydeploy` | `/easydeploy` | Main entry point — inspects project state and orchestrates all other skills |
| `ea-docker-setup` | `/docker-setup` | Detects project type, generates Dockerfile + docker-compose.yml, builds containers |
| `ea-docker-run` | `/docker-run` | Starts containers for an already-configured project |
| `ea-github-setup` | `/github-setup` | Creates or migrates the GitHub repo to `northstar-network` |
| `ea-github-commit` | `/github-commit` | Pulls, resolves conflicts, reviews code, commits and pushes |
| `ea-code-review` | `/code-review` | Scans staged changes for security issues and fatal errors |
| `ea-deploy-setup` | `/deploy-setup` | Generates the GitHub Actions CI/CD workflow |
| `ea-migrationdb-setup` | `/migrationdb-setup` | Detects DB usage, adds DB service to Compose, sets up migration system |
| `ea-deploy` | `/deploy` | Reviews code, pushes, and triggers the production pipeline |

## Workflow overview

```
Local setup
  /easydeploy
    ├── ea-docker-setup   — Dockerfile, docker-compose.yml, build
    ├── ea-docker-run     — docker compose up -d
    └── ea-github-setup   — git init, create repo, push
          └── ea-github-commit

Production deployment
  /deploy
    ├── ea-deploy-setup (if CI missing)
    │     └── ea-migrationdb-setup
    └── ea-github-commit
          └── ea-code-review
```
