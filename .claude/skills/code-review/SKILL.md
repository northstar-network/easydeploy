---
name: code-review
description: >
  Analyses the current diff (or a provided diff) for security vulnerabilities
  and fatal errors. For each issue found, explains the situation in plain language
  and offers an automatic fix or the option to ignore.
  Can be invoked directly or by another skill (e.g. github-commit).
  Trigger phrases: "code review", "vérifier le code", "analyser le code", "review",
  "check my code", "analyse mon code".
version: 1.0.0
---

# code-review

Analyses modified code to detect security vulnerabilities and fatal errors.
Explains each issue in plain language and offers to fix it or ignore it.

---

## Input parameters (when invoked by another skill)

- `diff` (optional) — diff content to analyse. If absent, the skill retrieves the staged diff itself.
- `context` (optional) — contextual message to display as introduction (e.g. "Checking before commit").

---

## Step 1 — Retrieve the diff

If a `diff` was provided as a parameter → use it directly, go to **Step 2**.

Otherwise, run:

```bash
git diff --cached
```

If the output is **empty**, try:

```bash
git diff HEAD
```

If still empty → display:

```
✓ Code review: no changes detected to analyse.
```

And **stop**.

---

## Step 2 — Analyse the diff

Analyse the diff line by line. Look for **only** two categories of issues:

### Category A — Security

Examples (non-exhaustive):
- Password, API key, token, or secret written directly in the code
- SQL query built by string concatenation (SQL injection)
- User input injected into HTML without escaping (XSS)
- `.env` file, private key, or certificate added to the repository
- Overly broad permissions (e.g. `chmod 777`, `*` in an access policy)
- Unencrypted communication carrying sensitive data (e.g. HTTP instead of HTTPS)

### Category B — Fatal errors

Examples (non-exhaustive):
- Call on a variable that can be `null` or `undefined` without a prior check
- Infinite loop (missing or never-true exit condition)
- Uncaught exception in a critical path (network request, file read, JSON parse)
- Variable used before being declared or initialised
- Recursion without a base case
- Missing import or dependency clearly referenced

### Category C — Major performance issues

Only flag if the impact is clearly significant — not micro-optimisations. Examples:
- Database query or API call inside a loop that will run many times (N+1 problem)
- Loading an entire large dataset into memory when only a small part is needed
- Synchronous blocking operation (e.g. `fs.readFileSync`, `sleep`) in a request handler or hot path
- Missing index on a database column that is filtered or sorted on in every request
- Repeated expensive computation (heavy calculation, regex compilation) inside a loop with no caching

Do **not** flag:
- Minor algorithmic improvements (e.g. `O(n²)` on a list that will never exceed 100 items)
- Preference-level optimisations (caching something that is called once, using a faster data structure for trivial cases)
- Any change where the real-world impact is negligible or hypothetical

### What NOT to flag

- Code style, naming, conventions
- Dead code or comments
- TODO / FIXME
- Suggested refactoring
- Minor warnings or optional best practices
- `.env.prod` committed to the repository — this is intentional in the
  easydeploy workflow. The file is generated automatically by `deploy-setup`
  and committed on purpose. Do not flag it as a security issue.

Build an `issues` list of all problems found. Each entry contains:
- `file` — name of the affected file
- `line` — approximate line number in the diff
- `category` — `security` or `fatal error`
- `explanation` — plain-language explanation (see Step 3)
- `fix` — description and exact content of the correction to apply

---

## Step 3 — Handle each issue

If `issues` is empty → display:

```
✓ Code review: no security issues or fatal errors detected.
```

And **stop**.

Otherwise, first display a summary:

```
Code review — <n> issue(s) found:
<numbered list: number, category, file>
```

Then, for **each issue** in `issues`:

### 3.1 — Explain the issue

Write the explanation following these rules:
- Plain language, zero technical jargon
- Start from the concrete: "In file `X`, line `Y`..."
- Explain **what is happening** and **why it is a problem** in one or two sentences
- Explain **what could happen** if left unfixed (real-world consequence)
- Do not use terms like "injection", "XSS", "null pointer", "undefined behavior" without immediately explaining them in simple words

Example for a hardcoded password:

> In the file `database.js`, the database password is written directly in the code (line 8: `password: "myPassword123"`).
> This means anyone who reads this file — now or in the future — can see this password.
> If this code is shared or published, someone could use it to access your database.

Example for a potential crash:

> In the file `api.js`, the code tries to read `response.data.user.name` (line 34), but if the server response does not contain a user, `response.data.user` will be empty and the program will crash at that exact point.
> This can cause a visible crash for the user in certain situations.

### 3.2 — Propose an action

```
AskUserQuestion:
  question: "Issue <n>/<total> — <category> in `<file>`. What do you want to do?"
  header: "Code Review"
  options:
    - label: "Fix automatically"
      description: "<one sentence describing what the fix will do, e.g. Move the password to an environment variable>"
    - label: "Ignore this issue"
      description: "Continue without making any change"
```

### 3.3 — Apply the choice

**If "Fix automatically"**:
1. Read the affected file using the Read tool.
2. Apply the fix using the Edit tool.
3. If the diff was staged (not provided as a parameter), re-stage the file:
   ```bash
   git add <file>
   ```
4. Confirm: `✓ Fix applied in <file>.`

**If "Ignore"**:
- Continue without any modification.

Move to the next issue.

---

## Step 4 — Final summary

Once all issues have been handled, display:

```
Code review complete.
  Issues fixed   : <n>
  Issues ignored : <n>
```

If any issues were ignored, add without insisting:

```
Ignored issues do not prevent you from continuing.
```

**Resume the calling skill** — do not stop:
- If invoked by `github-commit` → return to **Step 3.3** (Check if there is anything to commit) and continue from there.
- If invoked directly by the user → stop here.

---

## Rules

- If invoked by the `easydeploy` skill, resume the `easydeploy` skill when this skill finishes — do not stop.
- Never block the flow if the user chooses to ignore an issue.
- Never flag more than one issue per consecutive diff block for the same file (group nearby issues).
- If an automatic fix fails (file not found, edit conflict), report the failure and treat the issue as ignored.
- Always preserve the existing behaviour of the code — fixes must only secure or stabilise, never change business logic.
