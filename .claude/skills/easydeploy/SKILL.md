---
name: easydeploy
description: >
  Main entry point for easydeploy. Use this skill when the user wants to
  deploy, setup, or run a project, or when they are not sure what to do.
  Trigger phrases: "easydeploy", "deploy", "setup and run", "get started",
  "how do I run this", "comment lancer", "déployer".
version: 1.0.0
---

# easydeploy

Entry point that inspects the project state and presents a contextual menu.
After each sub-skill completes, re-evaluate the project state and show the
menu again. Repeat until the user chooses to exit.

The current expected setup version is: `docker-setup@1.0.0`

---

## Step 0 — Version check

Run the version checker silently before doing anything else:

```bash
python3 .claude/skills/easydeploy/check_version.py 2>/dev/null
```

- Exit code **0** → versions match, proceed to Step 1.
- Exit code **1** (output starts with `UPDATE_NEEDED:<local>:<remote>`) →
  inform the user that an update is available and invoke the `ea-update`
  skill, then stop.
- Command fails (python3 unavailable, network error, etc.) → ignore and
  proceed to Step 1.

---

## Step 1 — Evaluate project state

Run all checks silently before showing anything to the user.

### Check A — Docker setup

```bash
cat .easydeploy 2>/dev/null
```

- File absent → `dockerState = "not-setup"`
- File contains `docker-setup@1.0.0` → `dockerState = "ready"`
- File contains another version → `dockerState = "outdated"`, store the found
  version as `foundVersion`

### Check B — Docker containers running

Only run if `dockerState` is `"ready"` or `"outdated"`:

```bash
docker compose ps --services --filter status=running 2>/dev/null
```

- Output non-empty → `dockerRunning = true`
- Output empty or command fails → `dockerRunning = false`

### Check C — Git and GitHub

```bash
ls .git 2>/dev/null
```

- `.git` absent → `githubState = "no-git"`
- `.git` present → run:
  ```bash
  git remote get-url origin 2>/dev/null
  ```
  - URL contains `github.com/northstar-network/` or
    `github.com:northstar-network/` → `githubState = "configured"`
  - Otherwise → `githubState = "not-configured"`

### Check D — CI workflow

```bash
ls .github/workflows/deploy.yml 2>/dev/null
```

- File found → `ciState = "exists"`
- File absent → `ciState = "missing"`

### Check E — Keycloak SSO

```bash
grep -s "KEYCLOAK_CLIENT_ID" .env 2>/dev/null
```

- Output non-empty (variable exists and is set) → `ssoState = "configured"`
- Output empty or file absent → `ssoState = "missing"`

### Check F — Backups

```bash
grep -s "backup-setup@" .easydeploy 2>/dev/null
```

- Output non-empty → `backupState = "configured"`
- Output empty or file absent → `backupState = "missing"`

---

## Step 2 — Build the menu

The menu is two levels deep so each `AskUserQuestion` stays within the
4-option limit. Build three category groups from the checks in Step 1,
then show the top-level category picker. When the user picks a category,
show that category's specific actions.

### Category groups

**Group A — "My project"**

Include if at least one of these conditions is true:

| Condition | Action label | Skill |
|---|---|---|
| `dockerState = "not-setup"` | "Set up the project" | `ea-docker-setup` |
| `dockerState = "outdated"` | "Update the project setup (current: `<foundVersion>`)" | `ea-docker-setup` |
| `dockerState = "ready"` AND `dockerRunning = false` | "Start the project" | `ea-docker-run` |
| `dockerState = "ready"` AND `dockerRunning = true` | "Restart the project" | `ea-docker-run` |

**Group B — "My code & GitHub"**

Include if at least one of these conditions is true:

| Condition | Action label | Skill |
|---|---|---|
| `githubState = "no-git"` or `"not-configured"` | "Connect to GitHub" | `ea-github-setup` |
| `githubState = "configured"` | "Get the latest version" | `ea-github-sync` |
| `githubState = "configured"` | "Review my code" | `ea-code-review` |
| `githubState = "configured"` | "Submit changes for review" | `ea-github-mr` |

**Group C — "Deploy & production"**

Include if at least one of these conditions is true:

| Condition | Action label | Skill |
|---|---|---|
| `dockerState = "ready"` AND `githubState = "configured"` AND `ciState = "missing"` | "Set up automatic deployment" | `ea-deploy-setup` |
| `dockerState = "ready"` AND `githubState = "configured"` AND `ciState = "exists"` | "Deploy to production" | `ea-deploy` |
| `ciState = "exists"` AND `backupState = "missing"` | "Set up backups" | `ea-deploy-backup` |
| `ciState = "exists"` AND `backupState = "configured"` | "Update backups" | `ea-deploy-backup` |
| `ssoState = "missing"` | "Set up login (SSO)" | `ea-keycloak-sso` |
| `ssoState = "configured"` | "Update login (SSO)" | `ea-keycloak-sso` |

### Top-level category picker

Build the options list with only the groups that have at least one action,
plus "Exit". Present:

```
AskUserQuestion:
  header: "easydeploy"
  question: "What would you like to do?"
  options:
    - label: "My project"              ← only if Group A has actions
      description: "Start, stop, or set up the project."
    - label: "My code & GitHub"        ← only if Group B has actions
      description: "Review code, connect to GitHub, or submit changes for review."
    - label: "Deploy & production"     ← only if Group C has actions
      description: "Deploy to production, set up backups, or configure login."
    - label: "Exit"
      description: "Stop here."
```

### Category sub-menu

When the user picks a category, collect its applicable actions (from the
tables above) and present them. Always add "Back" as the last option:

```
AskUserQuestion:
  header: "<Category name>"
  question: "Choose an action:"
  options:
    - label: <action 1>
      description: <one-line description>
    - label: <action 2>              ← only if applicable
      description: ...
    - label: <action 3>              ← only if applicable
      description: ...
    - label: "Back"
      description: "Return to the main menu."
```

**Shortcut — single action in a category:** If a category has exactly one
applicable action, skip the sub-menu and invoke that skill directly (no
extra click needed).

---

## Step 3 — Execute and loop

- If the user picks **"Exit"** → stop.
- If the user picks **"Back"** in a sub-menu → go to **Step 1**, re-evaluate
  the project state, and show the top-level menu again.
- Otherwise → invoke the corresponding skill. Wait for it to complete fully,
  then go to **Step 1** and re-evaluate the project state before showing the
  menu again.

---

## Rules

- **Always** re-evaluate all checks from Step 1 before rebuilding the menu —
  never cache the state across loops.
- **Never** skip an option because a prerequisite is not met — show all options
  the current state allows and let the user decide.
- **Never** auto-invoke a skill without the user choosing it from the menu.
- **Language — English only:** All output from this skill and every sub-skill
  it invokes must be in English. This applies to: all messages shown to the
  user, menu labels, error messages, comments in generated code, file content,
  commit messages, CI configuration, and any other text produced. If the user
  writes in another language, understand them but always reply and generate
  output in English.
