---
name: docker-setup
description: >
  Setup and run a project with Docker. Use this skill when the user wants to
  dockerize a project, run it in a container, setup docker-compose, create a
  Dockerfile, start docker containers, or check if Docker is installed.
  Trigger phrases: "docker setup", "dockerize", "run with docker",
  "setup docker", "create dockerfile", "docker compose up", "start containers".
version: 1.0.0
---

# docker-setup

Setup a project with Docker: check dependencies, detect project type, generate missing config files, build and run containers.

## Step 1 — Check Docker dependencies

Run:

```
node .claude/skills/docker-setup/scripts/check-deps.js
```

Parse the JSON output:

- If `docker: false` → Docker is not installed. Detect the OS by running `uname -s`, then ask:

```
AskUserQuestion:
  question: "Docker is not installed. Would you like to install it now?"
  header: "Install Docker"
  options:
    - label: "Yes, install Docker"
      description: "macOS: installs Docker Desktop via Homebrew (brew install --cask docker) — Linux: runs the official get.docker.com convenience script"
    - label: "No, I'll install it myself"
      description: "Stop here — visit https://docs.docker.com/get-docker/ for manual instructions"
```

If user picks "No, I'll install it myself" → stop.

If user picks "Yes, install Docker":
- **macOS** (`uname -s` returns `Darwin`):
  - Check Homebrew is available: `brew --version`
  - If Homebrew is missing → tell the user to install Homebrew first: https://brew.sh, then stop.
  - Run: `brew install --cask docker`
  - Once complete, tell the user to open Docker Desktop at least once to finish setup, then ask them to re-run `/docker-setup` when Docker is running.
  - **Stop** (Docker Desktop requires a manual first launch before the daemon is available).
- **Linux** (`uname -s` returns `Linux`):
  - Ask for confirmation before running a remote script:
    ```
    AskUserQuestion:
      question: "This will run the official Docker install script from get.docker.com as root. Continue?"
      header: "Confirm install"
      options:
        - label: "Yes, run the script"
        - label: "Cancel"
    ```
  - If confirmed → run: `curl -fsSL https://get.docker.com | sh`
  - After install, run `docker --version` to verify, then continue to Step 2.
- **Other OS** → tell the user automatic installation is not supported on their platform, point to https://docs.docker.com/get-docker/, then stop.
- If `docker: true` and `compose: false` → Docker Compose is not available. Ask:

```
AskUserQuestion:
  question: "Docker Compose is not available. Would you like to install it?"
  header: "Docker Compose"
  options:
    - label: "Yes, install Docker Compose"
      description: "Installs the Compose plugin for Docker"
    - label: "Continue without Compose"
      description: "Use docker run only — no multi-service support"
    - label: "Cancel"
      description: "Stop here"
```

If user picks "Cancel" → stop.

If user picks "Yes, install Docker Compose":
- **macOS** (`Darwin`): Docker Desktop already bundles Compose. If it is missing, it likely means Docker Desktop is outdated. Run: `brew upgrade --cask docker`, then re-run `docker compose version` to verify. If it still fails → tell the user to reinstall Docker Desktop manually and stop.
- **Linux**:
  1. Detect the latest Compose version: `curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | grep tag_name`
  2. Download the binary:
     ```
     curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/lib/docker/cli-plugins/docker-compose
     ```
  3. Make it executable: `chmod +x /usr/local/lib/docker/cli-plugins/docker-compose`
  4. Verify: `docker compose version`
  5. If verification passes → set `composeAvailable = true` and continue.
  6. If it fails → tell the user to check the install manually at https://docs.docker.com/compose/install/ and stop.
- **Other OS** → point to https://docs.docker.com/compose/install/ and stop.

If user picks "Continue without Compose" → set `composeAvailable = false` and continue.

Store in context: `composeAvailable = true/false`.

## Step 2 — Check for nsnrouting

Check whether the `nsnrouting` Docker container is already running or installed.

Run:

```bash
docker ps -a --filter "label=com.docker.compose.project=nsnrouting" --format "{{.Names}}"
```

- If the output is **non-empty** (at least one container found) → continue to Step 3.
- If the output is **empty** → the container does not exist. Determine the OS-appropriate install path:
  - **macOS**: `$HOME/.nsnrouting`
  - **Linux**: `$HOME/.nsnrouting`
  - **Windows**: `$env:USERPROFILE\.nsnrouting`

  Then ask:

```
AskUserQuestion:
  question: "To make your app accessible in a browser, we need a small component called an **routing controller** — think of it as a traffic director that receives requests and forwards them to the right app. Without it, your app will run but won't be reachable. Would you like to install it now? (It only needs to be installed once per machine.)"
  header: "Routing"
  options:
    - label: "Yes, install it"
      description: "Installs nsnrouting into <installPath> and starts it — takes about a minute"
    - label: "No, skip"
      description: "Continue without it — your app won't be reachable via a URL"
    - label: "Cancel"
      description: "Stop here"
```

- "Yes, install it":

  **Check port 80 availability first** — before downloading anything:

  Run:
  ```bash
  lsof -iTCP:80 -sTCP:LISTEN -n -P
  ```

  - If output is **empty** → port is free, proceed to download below.
  - If output is **non-empty** → something is already using port 80. nsnrouting requires port 80 exclusively and its configuration must not be modified. Check if it is a Docker container:
    ```bash
    docker ps --format "{{.ID}}\t{{.Names}}\t{{.Ports}}" | grep ":80->"
    ```
    Then ask:
    ```
    AskUserQuestion:
      question: "Port 80 is already in use by <process or container name>. nsnrouting needs port 80 exclusively — this cannot be changed. Would you like to stop the conflicting service?"
      header: "Port 80 conflict"
      options:
        - label: "Yes, stop it"
          description: "Stops the service currently using port 80"
        - label: "No, cancel"
          description: "Setup cannot continue — port 80 must be free for nsnrouting to work"
    ```
    - "No, cancel" → stop. Tell the user to free port 80 and re-run `/docker-setup`.
    - "Yes, stop it":
      - If it is a **Docker container** → `docker stop <container_id>`, then proceed to download below.
      - If it is a **non-Docker process** (nginx, apache, system service, etc.) → tell the user the process name and PID, explain they need to stop it manually (e.g. `sudo systemctl stop <service>`), then stop. Do not attempt to kill arbitrary system processes.

  **Download and start nsnrouting:**

  - First check if git is available: `git --version`
  - If git is available → run `git clone https://github.com/northstar-network/nsnrouting <installPath>`, then:
    ```bash
    cd <installPath> && make start-local
    ```
    Continue to Step 3.
  - If git is **not** available → fall back to downloading the zip:
    1. Run: `curl -fsSL https://github.com/northstar-network/nsnrouting/archive/refs/heads/main.zip -o /tmp/nsnrouting.zip`
    2. If `curl` is not available, try: `wget -q https://github.com/northstar-network/nsnrouting/archive/refs/heads/main.zip -O /tmp/nsnrouting.zip`
    3. If neither `curl` nor `wget` is available → tell the user to install git or curl, then stop.
    4. Extract: `unzip -q /tmp/nsnrouting.zip -d /tmp/`
    5. Move: `mv /tmp/nsnrouting-main <installPath>`
    6. Clean up: `rm /tmp/nsnrouting.zip`
    7. Start: `cd <installPath> && make start-local`
    8. Continue to Step 3.

- "No, skip" → continue to Step 3.
- "Cancel" → stop.

## Step 3 — Inspect the project

Run:

```
node .claude/skills/docker-setup/scripts/check-docker-files.js
```

This returns:
```json
{
  "projectRoot": "/path/to/project",
  "projectName": "my-project",
  "hasDockerfile": false,
  "hasCompose": false,
  "composeFile": null,
  "files": ["package.json", "src", "README.md", ...]
}
```

Then **read the project files yourself** to understand the stack:
- If `package.json` exists → read it (check `scripts.start`, `scripts.dev`, main framework)
- If `requirements.txt` or `pyproject.toml` exists → read it (check framework: Flask, Django, FastAPI…)
- If `go.mod` exists → read it
- If `composer.json` exists → read it
- If `pom.xml` or `build.gradle` exists → read it
- If only static files (html, css, js) → it's a static site

From this, determine:
- `projectType`: node | python | go | php | java | ruby | rust | static | unknown
- `suggestedPort`: the default port for that framework (Node/3000, Python/8000, Go/8080, PHP/80, Java/8080, static/80)
- `startCommand`: the command to start the app inside the container (e.g. `node index.js`, `python app.py`, `./main`)

If `projectType` is `unknown` after reading the files → ask:

```
AskUserQuestion:
  question: "What language or framework is this project using?"
  header: "Project type"
  options:
    - label: "Node.js"
    - label: "Python"
    - label: "Go"
    - label: "PHP"
    - label: "Java"
    - label: "Other / I'll describe it"
```

## Step 4 — Configuration

If a `docker-compose.yml` is already present, read it and check that it is correctly configured for Traefik + nsnrouting:
- The service has `traefik.enable=true` in its labels
- The service has a `traefik.http.routers.*` label with a `Host()` rule using `${TRAEFIK_HOSTNAME}`
- The service is connected to the `proxy` network
- The `proxy` network is declared as `external: true` at the bottom
- The service has **no `ports:` key**

Also check whether a `.env` file exists and contains a `TRAEFIK_HOSTNAME=` entry.

If all conditions are met → skip to Step 6 (build).

If any condition is missing → update the compose file and/or `.env` to add what is missing (ask for the hostname if `TRAEFIK_HOSTNAME` is absent from `.env`), then write the updated files.

A `docker-compose.yml` is **always** generated — it is not optional.

For the Dockerfile, decide yourself based on what you read in Step 3 — **never ask the user**:

- If `hasDockerfile=true` → reuse it, use `build: .` in the compose file.
- If `hasDockerfile=false`, reason about whether a custom build is needed:
  - **Official image is sufficient** (no custom build steps, no source code to copy) → use `image: <official>` directly in the compose file, do not generate a Dockerfile. Examples: a pure static site served by nginx, a database, a ready-made service.
  - **Custom build is needed** (source code to install, compile, or bundle) → generate a Dockerfile and use `build: .` in the compose file. Examples: a Node.js app, a Python app, a Go binary, a PHP app with Composer dependencies.

Always use **development mode**: source code is always mounted as a volume from the host. No need to ask.

Ask for the Traefik hostname as a plain text message — **do NOT use AskUserQuestion**. Output exactly:

---
**What hostname should Traefik use for this service?**

Default: `<projectName>.localhost`

Examples: `myapp.localhost` · `api.localhost` · `myapp.example.com`

✏️ Type your answer below, or confirm with "ok" to use the default.

---

Wait for the user's reply in the chat. Do not present any choices or buttons.
If the user confirms without typing a custom value (e.g. "ok", "yes", "oui") → use `<projectName>.localhost`.
Otherwise → use what they typed.

Store: `traefikHostname`.

If a `.env` file already exists in `projectRoot`, read it and check if `TRAEFIK_HOSTNAME` is already set:
- If set → use its current value as `traefikHostname` (do not ask again).
- If missing → append `TRAEFIK_HOSTNAME=<traefikHostname>` to the existing `.env`.
- If no `.env` exists → it will be created in Step 5.

## Step 5 — Generate files

Based on `projectType`, `suggestedPort`, and `startCommand`, compose the file contents yourself.

### Dockerfile

Only generate a Dockerfile if you determined in Step 4 that a custom build is needed (source code to install, compile, or bundle). Use a simple dev-friendly image — no multi-stage builds.

**node:**
```dockerfile
FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE <port>
CMD ["npm", "run", "dev"]   # or "npm start" if no dev script
```

**python:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE <port>
CMD ["python", "<entrypoint>"]
```

**go:**
```dockerfile
FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
EXPOSE <port>
CMD ["go", "run", "."]
```

**php:**
```dockerfile
FROM php:8.3-apache
EXPOSE 80
```

Adapt to what you actually read from the project files (real entrypoint, real port, real start command). Since source code is mounted as a volume, do **not** add a `COPY . .` instruction — the code will be injected at runtime.

### docker-compose.yml

Traffic is routed through Traefik running in `nsnrouting`. **No `ports:` key** — Traefik handles all routing via the `proxy` network.

Use `build: .` if a Dockerfile was generated or already exists. Use `image: <official>` if an official image is sufficient.

```yaml
services:
  <projectName>:
    build: .                     # or: image: <official> if no Dockerfile
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.<projectName>.rule=Host(`${TRAEFIK_HOSTNAME}`)"
      - "traefik.http.routers.<projectName>.entrypoints=${TRAEFIK_ENTRYPOINT:-web}"
      - "traefik.http.routers.<projectName>.tls=${TRAEFIK_TLS:-false}"
      - "traefik.http.services.<projectName>.loadbalancer.server.port=<suggestedPort>"
    volumes:
      - .:/app
      - <deps-volume>            # see dependency volume table below
    networks:
      - proxy
    restart: unless-stopped

networks:
  proxy:
    external: true
```

### .env

Always generate a `.env` file (or append to the existing one) with:

```env
TRAEFIK_HOSTNAME=<traefikHostname>
TRAEFIK_ENTRYPOINT=web
TRAEFIK_TLS=false
```

If a `.env` already exists, only add the missing lines — do not overwrite existing content.

### .easydeploy

Always write a `.easydeploy` file at `projectRoot` containing the skill version used for this setup:

```
docker-setup@1.0.0
```

If the file already exists, overwrite it — it always reflects the version of the last setup run.

**Dependency volume by project type** — add the matching anonymous volume to prevent the host mount from overwriting packages installed inside the image:

| Project type | Volume to add          |
|--------------|------------------------|
| node         | `/app/node_modules`    |
| php          | `/app/vendor`          |
| python       | `/app/.venv`           |
| ruby         | `/app/vendor/bundle`   |
| java         | `/app/.gradle`         |
| rust         | `/app/target`          |
| go           | *(none needed)*        |
| static       | *(none needed)*        |

If the project type has no dependency directory, omit that line entirely.

Rules:
- Never add a `ports:` key.
- Always include `.:/app` in `volumes:` to mount source code from the host.
- Replace `<projectName>`, `<traefikHostname>`, and `<suggestedPort>` with actual values.

Write files to `projectRoot` using the Write tool.

## Step 6 — Build

Run from `projectRoot`:

```bash
docker compose build
```

If build fails (non-zero exit):
- Show the last 20 lines of output
- Ask:
  ```
  AskUserQuestion:
    question: "The build failed. What would you like to do?"
    header: "Build error"
    options:
      - label: "Retry"
      - label: "Show full logs"
      - label: "Cancel"
  ```
  - "Retry" → re-run Step 6
  - "Show full logs" → show all build output, then ask again (Retry / Cancel)

## Step 7 — Register hostname

So the browser can find the app at `http://<traefikHostname>`, the machine needs to know that address points to itself.

**If `traefikHostname` ends with `.localhost` on macOS (Darwin):**
- Run `sw_vers -productVersion` to get the macOS version.
- If version ≥ 13 → `.localhost` resolves natively. Skip this step entirely.
- If version < 13 → proceed below.

**All other cases** (non-`.localhost` hostname, Linux, Windows, old macOS):

Check if the entry already exists:

```bash
grep -q "<traefikHostname>" /etc/hosts
```

- If found → skip (already registered), continue to Step 8.
- If not found → ask:

```
AskUserQuestion:
  question: "To open your app at http://<traefikHostname> once it's running, your machine needs to know that address points to itself. This means adding one line to your hosts file — a small system file used as a local address book. It requires admin rights (you'll be asked for your password). Do it now?"
  header: "Hosts file"
  options:
    - label: "Yes, add it"
      description: "Adds '127.0.0.1 <traefikHostname>' to /etc/hosts — needs your password once"
    - label: "No, I'll do it manually"
      description: "Add '127.0.0.1 <traefikHostname>' to /etc/hosts yourself"
```

- "Yes, add it":
  - **macOS / Linux**: run `echo "127.0.0.1 <traefikHostname>" | sudo tee -a /etc/hosts`
    - If the command **succeeds** → continue to Step 8.
    - If the command **fails** (permission denied, sudo not available, non-zero exit) → display this block verbatim, prominently formatted:

      ```
      ⚠️  Action required — run this command in your terminal:

          sudo sh -c 'echo "127.0.0.1 <traefikHostname>" >> /etc/hosts'

      Your app won't be reachable at http://<traefikHostname> until this is done.
      ```

      Then ask:
      ```
      AskUserQuestion:
        question: "Have you run the command above in your terminal?"
        header: "Hosts file"
        options:
          - label: "Yes, done"
            description: "Continue to the summary"
          - label: "I'll do it later"
            description: "Continue anyway — the URL won't work until the command is run"
      ```
      Continue to Step 8 regardless of the answer.
  - **Windows**: run `Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 <traefikHostname>"`
    - If the command **fails** (requires admin) → display this block verbatim, prominently formatted:

      ```
      ⚠️  Action required — run this in PowerShell as Administrator:

          Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 <traefikHostname>"

      Your app won't be reachable at http://<traefikHostname> until this is done.
      ```

      Then ask:
      ```
      AskUserQuestion:
        question: "Have you run the command above in PowerShell as Administrator?"
        header: "Hosts file"
        options:
          - label: "Yes, done"
            description: "Continue to the summary"
          - label: "I'll do it later"
            description: "Continue anyway — the URL won't work until the command is run"
      ```
      Continue to Step 8 regardless of the answer.
- "No, I'll do it manually" → show the line to add and continue to Step 8.

Continue to Step 8.

## Step 8 — Summary (build only)

Display:

```
✓ Build complete

Your project is ready to run.
Use /run (or your run skill) to start the containers.

Once running, your app will be accessible at: http://<traefikHostname>
```

Then ask:

```
AskUserQuestion:
  question: "Would you like to start the project now?"
  header: "Run"
  options:
    - label: "Yes, start it"
      description: "Runs the docker-run skill to start the containers"
    - label: "No, I'll do it later"
      description: "You can start it later with /docker-run"
```

- "Yes, start it" → invoke the `docker-run` skill.
- "No, I'll do it later" → stop.

## Rules

- If invoked by the `easydeploy` skill, resume the `easydeploy` skill when this skill finishes — do not stop.
- **Never** run `docker compose down` or `docker rm` without explicit user confirmation.
- **Never** modify an existing `docker-compose.yml` without showing a diff first.
- **Never** modify the port or network configuration of nsnrouting — port 80 and the `proxy` network are fixed and must not be changed under any circumstance.
- **Always** run scripts from `projectRoot` (cwd), not from the skill folder.
