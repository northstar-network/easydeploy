---
name: docker-run
description: >
  Start a Dockerized project. Use this skill when the user wants to run,
  start, or launch a project that has already been set up with Docker.
  Trigger phrases: "run", "start", "launch", "start the project",
  "run the project", "docker up", "start containers", "lancer le projet",
  "démarrer le projet".
version: 1.0.0
---

# docker-run

Start a Dockerized project: ensure nsnrouting is running, then start the project containers.

## Step 1 — Check project is ready

Run:

```
node .claude/skills/docker-setup/scripts/check-docker-files.js
```

- If `hasCompose: false` → tell the user the project has no `docker-compose.yml` and they should run `/docker-setup` first, then stop.
- If `hasCompose: true` → store `projectRoot` and `projectName`, continue to Step 2.

## Step 2 — Check and start nsnrouting

Check whether nsnrouting is currently **running** (not just installed):

```bash
docker ps --filter "label=com.docker.compose.project=nsnrouting" --format "{{.Names}}"
```

- If **non-empty** → nsnrouting is running, continue to Step 3.
- If **empty** → nsnrouting is not running. Check if it is installed (stopped containers):

  ```bash
  docker ps -a --filter "label=com.docker.compose.project=nsnrouting" --format "{{.ID}}"
  ```

  - If **empty** → nsnrouting is not installed. Tell the user to run `/docker-setup` first to install it, then stop.
  - If **non-empty** → nsnrouting is installed but stopped. Find its working directory:

    ```bash
    docker inspect <container_id> --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}"
    ```

    Start nsnrouting from that directory:

    ```bash
    cd <workingDir> && make start-local
    ```

    Wait 5s, then re-check that at least one nsnrouting container is running. If it still doesn't come up → show the logs:

    ```bash
    docker compose -f <workingDir>/docker-compose.yml logs --tail=30
    ```

    Tell the user nsnrouting failed to start and stop.

Continue to Step 3.

## Step 3 — Start the project

Run from `projectRoot`:

```bash
docker compose up -d
```

Poll every 5s for up to 60s:

```bash
docker compose ps --format json
```

Wait for all services to reach `running` or `healthy`.

If a service reaches `exited` → run `docker compose logs --tail=30 <service>` and show the output, then ask:

```
AskUserQuestion:
  question: "A container exited unexpectedly. What would you like to do?"
  header: "Container error"
  options:
    - label: "Show full logs"
      description: "Display all logs for the failing service"
    - label: "Retry"
      description: "Run docker compose up -d again"
    - label: "Stop"
      description: "Stop here"
```

- "Show full logs" → `docker compose logs <service>`, then ask again (Retry / Stop)
- "Retry" → re-run Step 3
- "Stop" → stop

## Step 4 — Summary

Read `traefikHostname` from the `traefik.http.routers.*.rule` label in `docker-compose.yml`.
If no Traefik label is found, use `http://localhost:<port>` using the exposed port.

Display a short message followed by a markdown clickable link:

```
✓ Your project is running — open it here:

[http://<traefikHostname>](http://<traefikHostname>)
```
