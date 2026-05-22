# Prerequisites

## Required

### GitHub account

You need a GitHub account. If you don't have one, create it at [github.com](https://github.com/join) — it's free.

### Claude Code

easydeploy runs as Claude Code skills. Install it before getting started:

- **CLI** — `npm install -g @anthropic-ai/claude-code`
- **VS Code** — Claude Code extension from the marketplace
- **JetBrains** — Claude Code plugin

You need an active Anthropic account to use Claude Code.

---

## Handled automatically

The following tools are used by the skills but you do not need to install them beforehand. If something is missing, the skill will detect it, explain what is needed, and guide you through the setup.

- **Docker** — used to containerize and run your project locally
- **nsnrouting (Traefik)** — reverse proxy that handles local `.localhost` routing; requires port 80 to be free
