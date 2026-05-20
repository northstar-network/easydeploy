---
name: github-commit
description: >
  Pull the latest code, resolve conflicts intelligently, then add, commit and push.
  Handles SSH key setup and repo access requests if permission errors occur.
  Can be invoked by other skills or directly by the user.
  Trigger phrases: "commit", "push", "commit and push", "save my changes",
  "envoyer le code", "commiter", "pousser le code".
version: 1.0.0
---

# github-commit

Pull the latest changes from the remote, resolve any conflicts, then commit and push local changes.

---

## Step 1 — Pull latest changes

Run:

```bash
git pull --rebase
```

Analyse the output:

- **Success** (exit code 0, no `CONFLICT` in output) → go to **Step 3**.
- **Conflicts detected** (`CONFLICT` appears in output) → go to **Step 2**.
- **Permission / authentication error** (output contains `Permission denied`, `Repository not found`, `403`, `fatal: Authentication failed`, `ERROR: Repository not found`) → go to **Step 4**, then return to **Step 1** after resolution.
- **Other error** → show the raw output and stop.

---

## Step 2 — Resolve conflicts

### 2.1 — List conflicted files

Run:

```bash
git diff --name-only --diff-filter=U
```

Store the list as `conflictedFiles`.

Display a simple, reassuring message — no technical jargon:

```
Deux personnes ont modifié les mêmes fichiers en même temps.
Pas de panique, on va régler ça ensemble, fichier par fichier.

Fichiers concernés (<n>) :
<list of files>
```

### 2.2 — Resolve each file

For **each file** in `conflictedFiles`:

**Read the full file content** using the Read tool.

Identify every conflict block delimited by:

```
<<<<<<< HEAD
<local version>
=======
<remote version>
>>>>>>> <commit or branch>
```

For each conflict block:

**Explain the situation in plain language**, as if talking to someone who has never used git. Do not use technical terms like "HEAD", "merge", "branch", "commit", "remote", or "diff". Instead, describe concretely what each version contains and why there is a disagreement. Example:

> Dans le fichier `config.js`, deux modifications différentes ont été faites sur la même ligne.
> - **Votre version** : le port est réglé sur 3000
> - **La version reçue** : le port est réglé sur 8080
> Laquelle voulez-vous garder ?

Build 1 to 3 proposals depending on complexity:

| Proposal | When to suggest |
|---|---|
| **Garder ma version** | The local version is more relevant or more recent |
| **Garder la version reçue** | The incoming version is more complete or supersedes the local one |
| **Combiner les deux** | Both versions bring something useful — propose a merged result that keeps both contributions |

Describe each option in a single plain sentence focused on the content, not the git mechanics.

Ask:

```
AskUserQuestion:
  question: "Fichier <filename> — désaccord <n>/<total>. Quelle version voulez-vous garder ?"
  header: "Désaccord"
  options:
    - label: "Garder ma version"
      description: "<one plain sentence describing what the local version contains>"
    - label: "Garder la version reçue"
      description: "<one plain sentence describing what the incoming version contains>"
    - label: "Combiner les deux"      ← only if applicable
      description: "<one plain sentence describing the combined result>"
    - label: "Me montrer les deux versions"
      description: "Afficher le contenu des deux versions avant de choisir"
```

If "Me montrer les deux versions" → display both versions in plain readable form (not raw git markers), then ask again.

Apply the chosen resolution:
- Rewrite the file with the chosen content in place of the conflict block.
- Do **not** leave any `<<<<<<<`, `=======`, or `>>>>>>>` markers in the file.

Once all blocks in a file are resolved, move to the next file in `conflictedFiles`.

### 2.3 — Stage resolved files

Once all files are resolved, run:

```bash
git add <each resolved file>
```

Then go to **Step 3**.

---

## Step 3 — Add, commit and push

### 3.1 — Stage all changes

Run:

```bash
git add -A
```

### 3.2 — Check if there is anything to commit

Run:

```bash
git diff --cached --stat
```

- If the output is **empty** → tell the user there is nothing to commit and stop.
- Otherwise → use the output to generate the commit message.

### 3.3 — Generate commit message

Analyse `git diff --cached --stat` output and the list of changed files.

Build a concise commit message following conventional commits format:
- `feat:` — new file or feature added
- `fix:` — bug fix or error correction
- `chore:` — config, tooling, or maintenance change
- `docs:` — documentation only
- `refactor:` — code restructure without behavior change

Keep the subject line under 72 characters. If multiple types of changes are present, pick the dominant one.

Present to the user:

```
AskUserQuestion:
  question: "Proposed commit message — confirm or edit?"
  header: "Commit message"
  options:
    - label: "<generated message>"
      description: "Use this message as-is (Recommended)"
    - label: "I'll type a different message"
      description: "Enter a custom commit message"
```

If "I'll type a different message" → ask for free text (Other).

Store as `commitMessage`.

### 3.4 — Commit

Run:

```bash
git commit -m "<commitMessage>"
```

If the commit fails → show the raw error and stop.

### 3.5 — Push

Run:

```bash
git push
```

- **Success** → display final summary and stop:

```
✓ Changes pushed successfully.

  Commit: <commitMessage>
  Remote: <git remote get-url origin>
```

- **Permission / authentication error** (same patterns as Step 1) → go to **Step 4**, then retry **Step 3.5** once after resolution.
- **Rejected (non-fast-forward)** → the remote has new commits not yet pulled. Run `git pull --rebase` again, handle any conflicts (Step 2), then retry Step 3.5.
- **Other error** → show the raw output and stop.

---

## Step 4 — SSH key and access management

### 4.1 — Check for an existing SSH key

Run:

```bash
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ls ~/.ssh/id_rsa.pub 2>/dev/null
```

- **Key found** → read its content (use the first key found). Store path as `sshKeyPath`, content as `sshPublicKey`. Go to **4.2**.
- **No key found** → generate one. Get the user email first:

  ```bash
  git config --get user.email
  ```

  If empty → ask for the email via free text.

  Then run:

  ```bash
  ssh-keygen -t ed25519 -C "<userEmail>" -f ~/.ssh/id_ed25519 -N ""
  ```

  Read the new public key:

  ```bash
  cat ~/.ssh/id_ed25519.pub
  ```

  Store as `sshPublicKey`. Go to **4.2**.

### 4.2 — Add the SSH key to GitHub

Display the public key clearly:

```
Your SSH public key (copy this entire line):

<sshPublicKey>

Add it to your GitHub account here:
https://github.com/settings/ssh/new

1. Click "New SSH key"
2. Give it a title (e.g. your machine name)
3. Paste the key above and save
```

Ask:

```
AskUserQuestion:
  question: "Have you added the SSH key to your GitHub account?"
  header: "SSH key"
  options:
    - label: "Yes, it's added — continue"
      description: "Proceed to repo access check"
    - label: "Not yet — give me a moment"
      description: "Ask me again when you've added it"
    - label: "Cancel"
      description: "Stop here"
```

- "Not yet" → ask again (loop on this question).
- "Cancel" → stop.
- "Yes" → go to **4.3**.

### 4.3 — Request access to the repository

Retrieve the project name from the remote URL:

```bash
git remote get-url origin 2>/dev/null
```

Extract `projectName` from the URL:
- SSH format `git@github.com:northstar-network/<projectName>.git` → extract `<projectName>`
- HTTPS format `https://github.com/northstar-network/<projectName>` → extract `<projectName>`

Retrieve `githubUsername`:
1. `git config --get github.user` → if non-empty, use it.
2. Otherwise, extract from `git config --get user.email` (part before `@`).
3. If still empty → ask via free text.

Present detected value for confirmation:

```
AskUserQuestion:
  question: "Confirm your GitHub username to request access."
  header: "GitHub username"
  options:
    - label: "<detectedUsername>"
      description: "Detected from your git configuration (Recommended)"
```

If `detectedUsername` is empty, or if the user picks "Other" → ask for free text input directly.

Build the access request link:

```
https://github-permission-manager.n10.xyz/<projectName>/<githubUsername>/request-access
```

Display:

```
To request access to this repository, open this link:

[<link>](<link>)

Submit the request, then wait for it to be approved before continuing.
```

Ask:

```
AskUserQuestion:
  question: "Has your access request been approved?"
  header: "Repo access"
  options:
    - label: "Yes, access granted — retry"
      description: "Attempt the git operation again"
    - label: "Not yet — I'll wait"
      description: "Ask me again when access is granted"
    - label: "Cancel"
      description: "Stop here"
```

- "Not yet" → loop on this question.
- "Cancel" → stop.
- "Yes, access granted" → return to the step that triggered Step 4 (Step 1 or Step 3.5).

---

## Rules

- **Empty remote (initial commit)** — if `git pull --rebase` fails with `couldn't find remote ref`, `no tracking information`, or `does not appear to be a git repository` (i.e. the remote exists but has no commits yet), skip the pull entirely and proceed directly to Step 3. For the push in Step 3.5, use `git push -u origin main` instead of `git push`.
- **Never** run `git push --force` without explicit user confirmation.
- **Never** delete or overwrite an SSH key that already exists — always reuse it.
- **Never** leave conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in any file after resolution.
- If the working tree is clean (`git status` shows nothing to commit), say so and stop — do not create empty commits.
- Always show the final remote URL in the success summary so the user can verify where the code was pushed.
