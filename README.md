# easydeploy

Claude Code skills for Docker-based project setup and deployment.

## Skills

| Skill | Description |
|-------|-------------|
| `/docker-setup` | Vérifie Docker, détecte le type de projet, génère Dockerfile/compose, build et démarre les containers |

## Installation

```bash
./install.sh /path/to/your-project
```

The installer:
- Copies skills into `.claude/skills/` of the target project
- Merges Docker-related permissions into `.claude/settings.json`

## Requirements

- Node.js 18+
- Claude Code CLI or VSCode extension
- Docker Desktop (or Docker Engine + Compose plugin)

## Usage

Open a Claude Code session in your project and type:

```
/docker-setup
```

The skill will:
1. Check if Docker and Docker Compose are installed
2. Read your project files to detect the stack (Node.js, Python, Go, PHP, Java…)
3. Ask what to generate (Dockerfile, docker-compose.yml) and in which mode (dev/prod)
4. Show you the generated content before writing anything
5. Build the Docker image
6. Start the containers and confirm everything is running
