---
name: ea-update
description: >
  Updates easydeploy skills to the latest version. Triggered automatically
  when the version check detects a mismatch between the installed version
  and the latest version available on GitHub.
version: 1.0.0
---

# ea-update

---

## Step 1 — Update the skills

Run the update script:

```bash
python3 .claude/skills/ea-update/update_skills.py
```

If the script exits with a non-zero code, show the error and stop.

Parse the output:
- `OLD_VERSION=<v>` → store as `oldVersion`
- `NEW_VERSION=<v>` → store as `newVersion`
- `UPDATED_SKILLS=<a,b,c>` → store as `updatedSkills`

---

## Step 2 — Read the changelog

Fetch the CHANGELOG from GitHub:

```
https://raw.githubusercontent.com/northstar-network/easydeploy/master/CHANGELOG.md
```

Extract all `## [x.y.z]` sections where the version is **strictly greater
than `oldVersion`** and **less than or equal to `newVersion`**. Store as
`relevantSections`.

If the fetch fails or no sections match, skip steps 3 and 4.

---

## Step 3 — Detect required project changes

Read `relevantSections` and identify any `### Migration` blocks. These
describe changes that must be applied to the **target project** (not to the
skills themselves).

For each migration instruction found, inspect the current project to
determine whether the change is already in place or still needs to be
applied. Use file reads, `grep`, or other non-destructive checks — do not
modify anything yet.

Build a list `pendingMigrations`: instructions that are not yet applied in
this project.

---

## Step 4 — Report and act

Display a summary:

```
✓ easydeploy updated: <oldVersion> → <newVersion>

Updated skills:
  → <skill1>
  → <skill2>
  ...

<relevantSections content>
```

If `pendingMigrations` is non-empty, present them to the user:

```
AskUserQuestion:
  question: "The following changes are required in this project after the update. Apply them now?"
  header: "Migrations"
  options:
    - label: "Yes, apply now"
      description: "Claude will apply each pending change to the project"
    - label: "Skip for now"
      description: "I'll handle it manually"
```

- "Yes, apply now" → apply each pending migration change to the project, then
  report what was done.
- "Skip for now" → list the pending changes so the user can apply them later,
  then stop.

If `pendingMigrations` is empty and `relevantSections` exists, display:

```
✓ No project changes required for this update.
```

---

## Rules

- Never delete local skills that are **not** present in the remote repo.
- Never apply migrations without user confirmation.
- If invoked by the `easydeploy` skill, return to it after completion.
- **Language — English only:** All output from this skill must be in English. This applies to all messages shown to the user, changelog summaries, error messages, and any other text produced. If the user writes in another language, understand them but always reply and generate output in English.
