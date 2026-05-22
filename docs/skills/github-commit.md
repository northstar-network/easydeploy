# ea-github-commit

Pulls the latest changes, resolves conflicts, runs a code review, generates a commit message, commits, and pushes. Also handles SSH key setup and repository access issues automatically.

## Trigger

```
/github-commit
```

Also called automatically by `ea-github-setup`, `ea-deploy`, and at the end of any workflow that needs to push code.

## What it does

1. **Pull with rebase** — runs `git pull --rebase`; detects conflicts, permission errors, and other failures
2. **Conflict resolution** — for each conflicted file, explains the conflict in plain language and offers options:
   - Keep your local version
   - Keep the incoming version
   - Combine both (intelligent merge)
3. **Stage all changes** — `git add -A`
4. **Code review** — calls `ea-code-review` to check for security issues and errors before committing
5. **Generate commit message** — analyzes the staged diff and proposes a message in [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `chore:`, etc.); asks for your confirmation
6. **Commit** — `git commit -m "<message>"`
7. **Push** — `git push`; if the push is rejected (non-fast-forward), retries the pull/resolve/push cycle

## Automatic error handling

### SSH permission denied

If the push fails due to a missing SSH key:
1. Detects or generates an SSH key (ed25519 preferred, RSA as fallback)
2. Displays the public key for you to add to GitHub (`github.com/settings/keys`)
3. Retries the push once you confirm the key is added

### Repository access denied

If you do not have write access to the repository:
1. Extracts the project name and your GitHub username
2. Generates an access-request link (`github-permission-manager.n10.xyz/…/request-access`)
3. Waits for you to confirm that access has been granted, then retries

## Prerequisites

- Git initialized with a remote configured (run `ea-github-setup` first if not)
