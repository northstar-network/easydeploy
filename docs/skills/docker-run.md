# ea-docker-run

Starts the project containers and confirms the app is accessible.

## Trigger

```
/docker-run
```

Also triggered automatically by `/easydeploy` when Docker is configured but containers are not running, and by `ea-docker-setup` at the end of a successful setup.

## What it does

1. **Checks project readiness** — verifies `docker-compose.yml` exists
2. **Checks nsnrouting** — if the Traefik reverse proxy is stopped, restarts it; if it is missing, guides you through installation
3. **Starts containers** — runs `docker compose up -d`
4. **Waits for healthy state** — polls every 5 seconds for up to 60 seconds until all services reach `running` or `healthy`
5. **Handles errors** — if a service exits unexpectedly, shows a summary and offers to display full logs, retry, or stop
6. **Confirms the URL** — reads the Traefik hostname from docker-compose.yml labels and displays the local URL

## Output

```
Your project is running — open it here:
http://notes-app.localhost
```

## Prerequisites

- `docker-compose.yml` must exist (run `ea-docker-setup` first if it does not)
- nsnrouting must be installed (the skill handles this automatically)
