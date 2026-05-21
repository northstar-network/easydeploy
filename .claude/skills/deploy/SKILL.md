---
name: deploy
description: >
  Deploys the project to production. Checks that the CI workflow exists (runs deploy-setup
  if not), then runs a code review and pushes the code via github-commit.
  Trigger phrases: "deploy", "déployer", "push en prod", "envoyer en production",
  "deploy to production", "mettre en prod".
version: 1.0.0
---

# deploy

Ensures the CI is configured, reviews the code, then commits and pushes to trigger the
GitHub Actions deployment pipeline.

---

## Step 1 — Check if the CI workflow exists

Run:

```bash
ls .github/workflows/deploy.yml 2>/dev/null
```

- **File absent** → the project has no CI configured. Tell the user:

  > No CI workflow found. Running deploy-setup first.

  Invoke the `deploy-setup` skill. Wait for it to complete, then continue to Step 2.

- **File found** → continue to Step 2.

---

## Step 2 — Review and push

Invoke the `github-commit` skill.

The `github-commit` skill handles the full sequence:
- Pull latest changes and resolve any conflicts
- Run a code review (`code-review` skill) before committing
- Generate a commit message and ask for confirmation
- Commit and push

Wait for `github-commit` to complete.

---

## Step 3 — Deployment summary

Once `github-commit` has pushed successfully, display:

```
✓ Deploy triggered

Your changes have been pushed to main.
GitHub Actions will now run the deployment pipeline:
```

Then read `.github/workflows/deploy.yml` to check whether a `migrate` job is present.

- **If `migrate` job found:**

  ```
    1. migrate — runs database migrations on the server
    2. deploy  — pulls the code and restarts containers
  ```

- **If no `migrate` job:**

  ```
    1. deploy — pulls the code and restarts containers
  ```

Then append:

```
Track the deployment at:
https://github.com/northstar-network/<projectName>/actions
```

To get `projectName`, run:

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

---

## Rules

- **Never** push without first ensuring the CI workflow exists — always check in Step 1.
- **Never** invoke `github-commit` if `deploy-setup` failed or was cancelled — stop instead.
- The code review is handled inside `github-commit` — do not invoke `code-review` separately.
