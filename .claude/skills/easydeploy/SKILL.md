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

Entry point that checks the project state and routes the user to the right skill.

The current expected setup version is: `docker-setup@1.0.0`

## Step 1 — Check project setup state

Look for a `.easydeploy` file in the project root (the directory where Claude Code is running).

```bash
cat .easydeploy
```

Three possible outcomes:

---

### A — File not found

The project has never been set up with easydeploy. Tell the user:

> This project hasn't been set up yet.

Then ask:

```
AskUserQuestion:
  question: "This project hasn't been set up with easydeploy yet. Would you like to set it up now?"
  header: "Setup"
  options:
    - label: "Yes, set it up"
      description: "Runs the docker-setup skill to configure and build the project"
    - label: "No, cancel"
      description: "Stop here"
```

- "Yes, set it up" → invoke the `docker-setup` skill, then continue to **Step 2**.
- "No, cancel" → stop.

---

### B — File found, version matches `docker-setup@1.0.0`

The project is up to date. Tell the user:

> This project is ready to run.

Continue to **Step 2**.

---

### C — File found, version does not match `docker-setup@1.0.0`

The project was set up with an older version of easydeploy. Tell the user the current version found and the expected version:

> This project was set up with **<found version>** but the current version is **docker-setup@1.0.0**. A new setup is recommended.

Then ask:

```
AskUserQuestion:
  question: "This project's setup is outdated. Would you like to re-run the setup to bring it up to date?"
  header: "Update setup"
  options:
    - label: "Yes, re-run setup"
      description: "Runs docker-setup again — your existing files will be updated"
    - label: "Run anyway"
      description: "Skip the update and start the project as-is"
    - label: "Cancel"
      description: "Stop here"
```

- "Yes, re-run setup" → invoke the `docker-setup` skill, then continue to **Step 2**.
- "Run anyway" → continue to **Step 2**.
- "Cancel" → stop.

---

## Step 2 — Run the project

Ask:

```
AskUserQuestion:
  question: "Would you like to start the project now?"
  header: "Run"
  options:
    - label: "Yes, start it"
      description: "Runs the docker-run skill to start the containers"
    - label: "No, cancel"
      description: "Stop here"
```

- "Yes, start it" → invoke the `docker-run` skill, then continue to **Step 3**.
- "No, cancel" → stop.

---

## Step 3 — Check GitHub configuration

Check whether the project is already linked to the `northstar-network` GitHub organization.

Run:

```bash
git remote get-url origin 2>/dev/null
```

- If the URL contains `github.com/northstar-network/` or `github.com:northstar-network/` → already configured. Stop.
- Otherwise (no remote, or remote pointing elsewhere) → ask:

```
AskUserQuestion:
  question: "This project is not linked to northstar-network on GitHub. Would you like to set it up now?"
  header: "GitHub"
  options:
    - label: "Yes, set up GitHub"
      description: "Runs the github-setup skill to create or migrate the repository"
    - label: "No, skip"
      description: "Stop here without GitHub configuration"
```

- "Yes, set up GitHub" → invoke the `github-setup` skill.
- "No, skip" → stop.
