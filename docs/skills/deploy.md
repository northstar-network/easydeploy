# ea-deploy

Production deployment entry point. Ensures the CI pipeline exists, reviews and pushes your code, and triggers the GitHub Actions workflow.

## Trigger

```
/deploy
```

Also accessible via the **Deploy to production** option in the `/easydeploy` menu.

## What it does

1. **Checks for CI workflow** — verifies `.github/workflows/deploy.yml` exists
   - If missing: calls `ea-deploy-setup` to generate it, then continues
   - If present: continues directly
2. **Calls `ea-github-commit`** — which in sequence:
   - Pulls latest changes
   - Resolves any conflicts
   - Runs `ea-code-review`
   - Generates a commit message and asks for confirmation
   - Commits and pushes to `main`
3. **Displays the deployment summary** — reads the workflow to determine the job sequence and shows the GitHub Actions link

## Output

```
✓ Deploy triggered
Your changes have been pushed to main. GitHub Actions will now run the
deployment pipeline:

  1. migrate — runs database migrations on the server
  2. deploy  — pulls the code and restarts containers

Track the deployment at:
https://github.com/northstar-network/notes-app/actions
```

If no `migrate` job is present in the workflow, only `deploy` is shown.

## Prerequisites

- Git remote configured to `northstar-network` (run `ea-github-setup` first)
- Docker setup complete (run `ea-docker-setup` first)
- GitHub secrets configured on the repository (`SSH_HOST`, `SSH_USERNAME`, `SSH_PRIVATE_KEY`, `SSH_PORT`) — see [deploy-setup](deploy-setup.md#required-github-secrets)
