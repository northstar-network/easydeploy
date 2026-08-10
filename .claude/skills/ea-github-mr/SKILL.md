---
name: ea-github-mr
description: >
  Submit a set of changes for review by creating a GitHub Pull Request.
  Use this when the user wants to propose changes without pushing directly
  to the main branch. Trigger phrases: "create a PR", "pull request",
  "submit for review", "ask for review", "propose my changes",
  "soumettre pour révision", "proposer mes modifications".
version: 1.1.0
---

# ea-github-mr — submit changes for review via GitHub Pull Request

This skill packages the user's work and sends it to GitHub so a reviewer
can look at it before it goes live. No extra tools or tokens are needed —
it uses the same Git connection already set up by ea-github-setup, then
gives the user a ready-to-click link to open the Pull Request on GitHub.

---

## Step 1 — Pre-flight checks

Run all checks silently before showing anything to the user.

### Check A — Working tree state

```bash
git status --porcelain 2>/dev/null
```

Store the output as `workingTree`. Empty string → no unsaved changes.

### Check B — Current branch

```bash
git branch --show-current 2>/dev/null
```

Store as `currentBranch`.

### Check C — Default branch

```bash
git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}'
```

Store as `defaultBranch`. If the command fails, default to `main`.

### Check D — GitHub repo path

```bash
git remote get-url origin 2>/dev/null
```

Parse the output to extract `<owner>/<repo>`:

- SSH format `git@github.com:owner/repo.git` → strip `git@github.com:` and `.git`
- HTTPS format `https://github.com/owner/repo.git` → strip `https://github.com/` and `.git`

Store as `repoPath` (e.g. `northstar-network/my-project`).

If parsing fails → tell the user:
> "I couldn't read the GitHub repository address. Please run the GitHub
> setup from the main menu first."
Then stop.

---

## Step 2 — Check there is something to work with

- If `workingTree` is empty AND `currentBranch == defaultBranch` →
  tell the user:
  > "There are no pending changes on the main version — nothing to submit
  > for review. Make some edits first, then come back."
  Then stop.

---

## Step 3 — Create a working copy (if needed)

Only run this step if `currentBranch == defaultBranch`.

Ask the user:

```
AskUserQuestion:
  header: "What changed?"
  question: "To submit your changes for review without touching the live version, I need to save them in a separate working copy first. In a few words, what did you change?"
  options:
    - label: "Bug fix"
      description: "Something was broken and you fixed it."
    - label: "New feature"
      description: "You added something new to the project."
    - label: "Content or wording update"
      description: "Text, images, or layout changes."
    - label: "Let me describe it"
      description: "I'll type a short description in the chat."
```

- If the user selects "Let me describe it" → ask them to type the
  description in chat. Use that text as the slug source.
- Generate a kebab-case branch name from the chosen label or typed text:
  - Strip accents, lowercase, replace spaces and punctuation with `-`,
    max 40 characters.
  - Prefix: `fix/` for bug fix, `feat/` for new feature or typed text,
    `update/` for content.
  - Examples: `fix/bug-fix`, `feat/new-feature`, `update/content-wording`,
    `feat/user-login-page`.
- Run:
  ```bash
  git checkout -b <branch>
  ```
  Update `currentBranch` to the new branch name.
- Inform the user (no git jargon):
  > "I've set up a separate working copy for this submission. Now I'll
  > review your changes before we send them."

If `currentBranch != defaultBranch`:
- Inform the user:
  > "You're already working on a separate copy. I'll pick up your changes
  > from there."

---

## Step 4 — Code review

Invoke the `ea-code-review` skill to check the changes before submitting.

---

## Step 5 — Stage and record changes

```bash
git add -A
git status --short
```

If nothing is staged (output empty) and `workingTree` was also clean at
Step 1 → tell the user:
> "There are no changes to include in this submission. Make some edits
> first, then run this again."
Stop.

Generate a short, plain-English title that describes what changed (≤ 72
characters, no git jargon). Show it to the user and ask:

```
AskUserQuestion:
  header: "Change title"
  question: "I'll use this as the title for your submission. Does it look right?"
  options:
    - label: "Yes, use this title (Recommended)"
      description: "<generated title>"
    - label: "Let me write my own"
      description: "I'll type the title in chat."
```

If "Let me write my own" → ask the user to type the title in chat.
Store the confirmed title as `prTitle`.

Record the changes:

```bash
git commit -m "<prTitle>"
```

On SSH or permission error → tell the user:
> "I couldn't save your changes because of a permission error. Please run
> the GitHub setup from the main menu first."
Then stop.

---

## Step 6 — Build the Pull Request description

Write a short PR description in plain English using this structure:

```markdown
## What changed
<1–2 sentences explaining what this submission does, in plain language>

## Why
<One sentence: the reason for the change — a bug, a request, a new need>

## How to check it works
- [ ] <step 1 — e.g. "Go to the contact page">
- [ ] <step 2 — e.g. "Fill in the form and click Send">
- [ ] <expected result — e.g. "A confirmation message appears">
```

Store this as `prBody`.

Show the description in chat and ask:

```
AskUserQuestion:
  header: "Description"
  question: "Here's the description for your submission. Does it look right?"
  options:
    - label: "Yes, looks good (Recommended)"
      description: "Proceed with this description."
    - label: "Let me adjust it"
      description: "Tell me what to change and I'll update it."
    - label: "Cancel"
      description: "Stop here — your changes are saved but nothing has been sent yet."
```

If "Let me adjust it" → ask the user what to change, update the relevant
section(s), and show the description again before proceeding.

---

## Step 7 — Final confirmation

Show the user a plain-language summary:

```
Here's what will happen:
  • Your changes will be sent to GitHub.
  • You'll get a link to open the submission page on GitHub.
  • Nothing goes live until a reviewer approves it there.

Title: <prTitle>
```

Ask:

```
AskUserQuestion:
  header: "Send?"
  question: "Ready to send your changes to GitHub?"
  options:
    - label: "Yes, send (Recommended)"
      description: "Send the changes and get the link to open your Pull Request."
    - label: "Cancel"
      description: "Stop here — nothing is sent. Your saved changes remain safe."
```

---

## Step 8 — Push and build the PR link

Push the working copy to GitHub:

```bash
git push -u origin <currentBranch>
```

On failure (SSH, permission, auth) → surface the error and tell the user:
> "I couldn't send your changes to GitHub. Please run the GitHub setup
> from the main menu and try again."
Then stop.

Build the Pull Request creation URL:

```
https://github.com/<repoPath>/compare/<currentBranch>?expand=1
```

---

## Step 9 — Final summary

Show the user:

```
✓ Your changes have been sent to GitHub.

**To open your Pull Request:**
Click the link below, then click the green "Create pull request" button.

→ <PR creation URL>

Once you're on GitHub, you can copy-paste the title and description below
into the form before clicking "Create pull request".

**Title:**
<prTitle>

**Description:**
<prBody>

When a reviewer approves it, they'll click "Merge" to make your changes live.
```

---

## Rules

- **No git jargon in user-facing messages.** Do not use the words "branch",
  "commit", "merge", "push", "HEAD", "rebase", "stash", "checkout", or
  "staging area" when talking to the user. Use plain equivalents: "working
  copy" for branch, "record your changes" for commit, "make it live" for
  merge, "send to GitHub" for push, etc.
- **Never push directly to the default branch.** Always work on a separate
  branch and direct the user to open a PR.
- **Never use `git push --force`.**
- **Never invoke `ea-github-commit` from this skill.** The two workflows
  are separate — `ea-github-commit` pushes directly to the main branch,
  while this skill always goes through a Pull Request.
- **No GitHub CLI (`gh`) required.** Everything is done with plain `git`
  commands. The PR is opened by the user on GitHub via the provided link.
- **Language — English only.** All generated content (PR title, PR
  description, commit message, summary) must be in English, even if the
  user writes in another language.
