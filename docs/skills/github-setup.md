# ea-github-setup

Configures the GitHub repository for your project under the `northstar-network` organization. Handles three scenarios: no git at all, git with a remote that is not northstar-network, or already correctly configured.

## Trigger

```
/github-setup
```

Also triggered automatically by `/easydeploy` when the project has no git configuration or is not connected to `northstar-network`.

## Scenarios

### Scenario A — No git repository

1. Asks for a repository name (defaults to the project folder name)
2. Asks for your GitHub username
3. Generates a link to the permission manager — open it in your browser to create the repository
4. Runs `git init`, sets the remote to `git@github.com:northstar-network/<name>.git`, and renames the branch to `main`
5. Calls `ea-github-commit` to stage all files, generate a commit message, and push

### Scenario B — Already configured to northstar-network

Displays the current repository URL and stops — nothing to do.

### Scenario C — Git exists but remote points elsewhere

1. Shows the current remote URL
2. Follows the same repo name + username flow as Scenario A
3. Updates the remote: `git remote set-url origin git@github.com:northstar-network/<name>.git`
4. Offers to push the current branch (calls `ea-github-commit`)

## Output

At the end of Scenarios A and C:

```
✓ Done
Repository: git@github.com:northstar-network/notes-app.git
```

## Repository naming rules

Repository names must match `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$` — letters, numbers, dots, hyphens, and underscores only, starting with a letter or number.

## Prerequisites

- A GitHub account (see [Prerequisites](../prerequisites.md))
- The permission manager at `github-permission-manager.n10.xyz` must be accessible (internet connection required)
