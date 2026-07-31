---
name: ea-github-setup
description: >
  Configure or migrate a GitHub repository to the northstar-network organization.
  Checks if a git configuration exists, verifies it belongs to northstar-network,
  and either creates a new repo or migrates an existing one.
  Trigger phrases: "github setup", "setup github", "create repo", "configure git",
  "migrate to northstar", "push to github", "configurer git", "créer un repo",
  "ea-github-setup".
version: 1.0.0
---

# ea-github-setup

Check the git configuration of the current project and ensure it is linked to the
`northstar-network` GitHub organization. Creates a new repo or migrates an existing one as needed.

## Step 1 — Check for .git

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

- If the command **fails or returns nothing** → no `.git` directory found. Go to **[Scenario A — No git]**.
- If it returns `true` → a git repo exists. Continue to Step 2.

## Step 2 — Check the remote

Run:

```bash
git remote get-url origin 2>/dev/null
```

- If the command **returns nothing or errors** → no remote configured. Go to **[Scenario A — No git]** (treat same as no repo: we need to create one on NSN and wire it up).
- If the URL contains `github.com/northstar-network/` or `github.com:northstar-network/` → Go to **[Scenario B — Already configured]**.
- Otherwise → Go to **[Scenario C — Migration]**.

Store the detected URL as `existingRemoteUrl`.

---

## Step 3 — Determine repo name

This step applies to **Scenarios A and C**.

### Deduce from context

Get the project folder name:

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Sanitize it for GitHub:
- Lowercase
- Replace spaces and underscores with `-`
- Remove characters that are not `a-z`, `0-9`, `-`, `.`
- Truncate to 100 characters

Store as `suggestedName`.

For **Scenario C**, also extract the current repo name from `existingRemoteUrl` as a second suggestion.

### Ask the user

Ask as a plain text message — **do NOT use AskUserQuestion**. Output exactly:

---
**What should the GitHub repository be named?**

Default: `<suggestedName>`

Examples: `my-app` · `api-server` · `front-end`

✏️ Type your answer below, or confirm with "ok" to use the default.

---

Wait for the user's reply in the chat. Do not present any choices or buttons.
If the user confirms without typing a custom value (e.g. "ok", "yes", "oui") → use `<suggestedName>`.
Otherwise → use what they typed.

**Validate the name**: must match `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$` and must not be empty.
If invalid → explain the constraint and ask again.

Store as `projectName`.

---

## Step 4 — Determine GitHub username

Try to detect in order:

1. Run `git config --get github.user` → if non-empty, use it as `detectedUsername`.
2. If empty, run `git config --get user.email` → extract the part before `@` as `detectedUsername`.
3. If still empty → `detectedUsername` is blank.

Ask as a plain text message — **do NOT use AskUserQuestion**.

If `detectedUsername` is not empty, output exactly:

---
**What is your GitHub username?**

Default: `<detectedUsername>`

Examples: `john-doe` · `jdoe` · `johnsmith42`

✏️ Type your answer below, or confirm with "ok" to use the default.

---

If the user confirms without typing → use `<detectedUsername>`.
Otherwise → use what they typed.

If `detectedUsername` is empty, output exactly:

---
**What is your GitHub username?**

Examples: `john-doe` · `jdoe` · `johnsmith42`

✏️ Type your answer below.

---

Wait for the user's reply in the chat. Do not present any choices or buttons.
Store as `githubUsername`.

---

## Step 5 — Generate the permission link

Build the link:

```
https://github-permission-manager.n10.xyz/<projectName>/<githubUsername>/create
```

Store as `permissionLink`.

---

## Scenario A — No git (create from scratch)

The project has no git history and no remote. Create the GitHub repo first, then initialize git locally and connect it.

### A.1 — Present the creation link

Display:

```
To create the repository in the northstar-network organization, open this link:

[<permissionLink>](<permissionLink>)

The service will create the repository and provide you with its URL.
```

### A.2 — Ask for the repo URL

Once the user has submitted the request and the repo is created, the external service provides a repo URL. Ask as a plain text message — **do NOT use AskUserQuestion**. Output exactly:

---
**What is the repository URL?**

Default: `git@github.com:northstar-network/<projectName>.git`

Examples: `git@github.com:northstar-network/my-app.git`

✏️ Type your answer below, or confirm with "ok" to use the default.

---

Wait for the user's reply in the chat. Do not present any choices or buttons.
If the user confirms without typing → use `git@github.com:northstar-network/<projectName>.git`.
Otherwise → use what they pasted.

Store as `repoUrl`.

### A.3 — Initialize git locally

Run:

```bash
git init
```

If the command fails (non-zero exit) → show the error and stop.

Display:

```
✓ Git repository initialized locally.
```

### A.4 — Connect to the remote

Run:

```bash
git remote add origin <repoUrl>
```

If the command fails (non-zero exit) → show the error and stop.

Display:

```
✓ Remote configured.

  Remote: <repoUrl>
```

### A.5 — Initial commit

Rename the local branch to `main`:

```bash
git branch -M main
```

Stage all project files:

```bash
git add -A
```

If either command fails (non-zero exit) → show the error and stop.

Display:

```
✓ All files staged for initial commit.
```

Then invoke the `ea-github-commit` skill to create the initial commit and push all files to the remote.

Display final summary after ea-github-commit completes:

```
✓ Done

  Repository: <repoUrl>
```

---

## Scenario B — Already configured

The remote already points to `northstar-network`. Nothing to do.

Extract the repo name from the remote URL and display:

```
✓ This project is already linked to northstar-network.

  Remote: <existingRemoteUrl>
  Repo:   https://github.com/northstar-network/<repoName>

No changes needed.
```

Stop.

---

## Scenario C — Migration

The project has a remote that is not `northstar-network`. We create a new NSN repo and update the remote.

### C.1 — Show the current situation

Display:

```
This project is currently linked to a remote outside northstar-network:

  Current remote: <existingRemoteUrl>

To migrate it, we'll create a new repository in northstar-network and update your local remote.
```

### C.2 — Go to Step 3 (repo name) and Step 4 (username) if not done yet

Use the current repo name from `existingRemoteUrl` as the first suggestion in Step 3.

### C.3 — Present the link

Display:

```
Open this link to request the new repository in northstar-network:

[<permissionLink>](<permissionLink>)

Once the repo is created on GitHub, confirm below.
```

### C.4 — Wait for confirmation

```
AskUserQuestion:
  question: "Have you opened the link and submitted the repo creation request?"
  header: "Repo creation"
  options:
    - label: "Yes, it's created — update my remote"
      description: "Updates your local git remote to point to northstar-network"
    - label: "I'll do it later"
      description: "Stop here — re-run /ea-github-setup once the repo is created"
    - label: "Cancel"
      description: "Stop here without doing anything"
```

- "I'll do it later" or "Cancel" → stop.
- "Yes, it's created — update my remote" → proceed to C.5.

### C.5 — Update the remote

Run:

```bash
git remote set-url origin git@github.com:northstar-network/<projectName>.git
```

Confirm it succeeded:

```bash
git remote get-url origin
```

Display:

```
✓ Remote updated.

  Old remote: <existingRemoteUrl>
  New remote: git@github.com:northstar-network/<projectName>.git
```

### C.6 — Optional push

```
AskUserQuestion:
  question: "Would you like to push your current branch to the new remote now?"
  header: "Push"
  options:
    - label: "Yes, push now"
      description: "Runs the ea-github-commit skill to pull, commit and push"
    - label: "No, I'll do it myself"
      description: "Stop here — run /ea-github-commit when ready"
```

If "Yes" → invoke the `ea-github-commit` skill.

If "No" → display final summary and stop:

```
✓ Migration complete

  Repository: https://github.com/northstar-network/<projectName>
  Remote:     git@github.com:northstar-network/<projectName>.git
```

---

## Rules

- If invoked by the `easydeploy` skill, resume the `easydeploy` skill when this skill finishes — do not stop.
- **Never** run `git push --force` without explicit user confirmation.
- **Never** run `git remote remove` or `git remote rename` without explicit user confirmation.
- **Never** skip name validation — an invalid GitHub repo name will cause the link to fail.
- Always show the full `permissionLink` as a clickable markdown link.
- If any git command fails, show the raw error output before stopping.
- **Language — English only:** All output from this skill must be in English. This applies to all messages shown to the user, error messages, and any other text produced. If the user writes in another language, understand them but always reply and generate output in English.
