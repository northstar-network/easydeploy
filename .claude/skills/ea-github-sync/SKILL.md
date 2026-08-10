---
name: ea-github-sync
description: >
  Switch to the main branch and pull the latest changes from GitHub.
  Resolves merge conflicts automatically wherever possible; only asks the
  user when the conflict is genuinely ambiguous. Safely sets aside any
  in-progress work before switching.
  Trigger phrases: "get the latest version", "sync", "pull from main",
  "update from GitHub", "récupérer la dernière version", "mettre à jour".
version: 1.0.0
---

# ea-github-sync — get the latest version from GitHub

This skill downloads the most recent changes from GitHub onto the user's
computer, switches to the main version if needed, and resolves any
conflicts as automatically as possible. In-progress work is safely set
aside before anything is changed.

---

## Step 1 — Pre-flight checks

Run all checks silently.

### Check A — Working tree state

```bash
git status --porcelain 2>/dev/null
```

Store as `workingTree`. Empty → no unsaved changes.

### Check B — Current and default branch

```bash
git branch --show-current 2>/dev/null
```

Store as `currentBranch`.

```bash
git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}'
```

Store as `defaultBranch`. On failure, default to `main`.

---

## Step 2 — Set aside in-progress work (if needed)

Only run this step if `currentBranch != defaultBranch` AND `workingTree`
is not empty.

Inform the user:
> "You have in-progress work on a separate copy. I'll set it aside
> safely before switching to the main version."

```bash
git stash push -m "ea-sync: in-progress work backup"
```

Store `stashed = true`. On error → tell the user:
> "I couldn't set aside your in-progress work. Please save or discard
> your changes manually, then try again."
Then stop.

---

## Step 3 — Switch to the main version (if needed)

Only run this step if `currentBranch != defaultBranch`.

```bash
git checkout <defaultBranch>
```

On error → if `stashed = true`, restore the stash first:

```bash
git stash pop
```

Then tell the user:
> "I couldn't switch to the main version. Your in-progress work has
> been restored."
Then stop.

---

## Step 4 — Pull the latest changes

```bash
git pull --rebase origin <defaultBranch> 2>&1
```

Branch on the result:

- **Exit code 0, no conflict output** → no conflicts. Go to Step 6.
- **Exit code 0, output contains "rewinding head"/"applying"** → rebase
  applied cleanly. Go to Step 6.
- **Exit code non-zero or output contains "CONFLICT"** →
  conflicts detected. Go to Step 5.
- **Other error (network, auth)** → surface the error and tell the user:
  > "I couldn't reach GitHub. Check your internet connection or run the
  > GitHub setup from the main menu, then try again."
  If `stashed = true`, run `git rebase --abort` then restore the stash:
  ```bash
  git rebase --abort 2>/dev/null
  git stash pop
  ```
  Then stop.

---

## Step 5 — Resolve conflicts (loop)

A rebase can stop multiple times — once per commit that has conflicts.
Repeat the following block until `git rebase --continue` exits cleanly
with no remaining conflicts (i.e., no `CONFLICT` in output and exit
code 0), or until an unrecoverable error occurs.

**Each iteration:**

1. Get the list of conflicted files in this round:

   ```bash
   git diff --name-only --diff-filter=U 2>/dev/null
   ```

2. For each conflicted file, apply the resolution process below.

3. After all files in this round are resolved, continue the rebase:

   ```bash
   git rebase --continue 2>&1
   ```

   - Exit code 0, no `CONFLICT` → rebase is done. Go to Step 6.
   - Exit code 0, output still contains `CONFLICT` → another commit has
     conflicts. Loop back to step 1 of this block.
   - Exit code non-zero (and not a conflict) → unrecoverable error.
     Run `git rebase --abort`, restore the stash if needed, and tell
     the user:
     > "I wasn't able to finish applying the latest changes. Your work
     > has been restored to how it was before. Please contact support."
     Then stop.

### Resolution process (per file)

Read the file with the `Read` tool. Identify every conflict block
delimited by `<<<<<<< `, `=======`, and `>>>>>>> `.

For each block, apply the first matching rule:

**Rule 1 — One side is empty (a deletion vs. an addition)**
Take the non-empty side without asking. Stage and continue.

**Rule 2 — Both sides add different content to the same location**
(Neither side deleted anything; both add distinct lines.)
Combine them: place the local version first, then the incoming version.
Stage and continue.

**Rule 3 — Both sides modify the same existing lines**
Read both versions. Evaluate which is more complete, more correct, or more
recent in context. Pick the better one. Stage and continue.
Write a one-line note in chat explaining the choice (e.g., "Kept the
incoming version of the page title because it is more recent."), using
plain language, no git jargon.

**Rule 4 — Deletion vs. modification**
(One side deleted content that the other side modified.)
This is genuinely ambiguous. Ask the user via `AskUserQuestion`:

```
AskUserQuestion:
  header: "One change conflicts"
  question: "Two different versions of '<filename>' conflict. One version removes a section; the other updates it. Which should we keep?"
  options:
    - label: "Keep the updated section (Recommended)"
      description: "Keep the version that changed the content."
    - label: "Remove the section"
      description: "Use the version that removed it entirely."
    - label: "Show me both versions"
      description: "I'll display both in chat so you can decide."
```

If "Show me both" → display both versions in a plain-language summary
(not raw code), then ask again (same two-option form without "Show me
both").

**Rule 5 — Unclear or complex conflict**
If none of the rules above match clearly, prefer the **incoming** (remote)
version as the safer default for a sync operation, and note this in chat:
> "I couldn't determine which version was better, so I applied the
> latest version from GitHub."

After resolving each block, write the file (without any conflict markers)
using the `Edit` or `Write` tool, then:

```bash
git add <filename>
```

---

## Step 6 — Summary

### If no conflicts occurred

If `currentBranch == defaultBranch` (was already on main):
> "✓ Your project is up to date with the latest version from GitHub."

If we switched branches:
> "✓ The main version is now up to date with the latest from GitHub."

If `stashed = true`:
> "Your in-progress work is still set aside. To resume it, type
> \"restore my work in progress\" in the chat."

### If conflicts were auto-resolved

List each resolved file with one plain-language sentence explaining
what was done. Then:
> "✓ All conflicts were resolved automatically. Your project is up to
> date."

### If the user resolved one or more conflicts manually

> "✓ Done. The latest changes from GitHub are now applied, including
> the conflicts you helped resolve."

---

## Rules

- **No git jargon in user-facing messages.** Do not use the words
  "branch", "commit", "merge", "rebase", "stash", "HEAD", "checkout",
  or "staging area" when talking to the user. Use plain equivalents:
  "main version" for the default branch, "separate working copy" for
  feature branches, "set aside" for stash, "in-progress work" for
  uncommitted changes, "latest changes" for the remote state.
- **Auto-resolve first, ask last.** Only show `AskUserQuestion` for
  Rule 4 (deletion vs. modification). For all other conflict types,
  resolve silently and note the decision in chat.
- **Never use `git push --force`.**
- **Never use `git rebase --skip`** to discard commits without showing
  the user what was skipped.
- **Always restore the stash** before stopping on any error.
- **Language — English only.** All generated content (conflict notes,
  summaries, messages) must be in English.
