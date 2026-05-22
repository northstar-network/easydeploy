# ea-code-review

Analyzes code changes for security vulnerabilities, fatal errors, and major performance issues. For each problem found, explains it in plain language and offers an automatic fix or the option to ignore.

## Trigger

```
/code-review
```

Also called automatically by `ea-github-commit` before every commit.

## What it checks

### Security issues

- Hardcoded passwords, API keys, tokens, and secrets
- SQL injection (string concatenation in queries)
- XSS (unescaped user input rendered as HTML)
- Sensitive files accidentally tracked (`.env`, private keys, certificates)
- Overly broad permissions (`chmod 777`, wildcard IAM policies)
- Unencrypted communication (HTTP instead of HTTPS for sensitive data)

### Fatal errors

- Null / undefined access without a prior check
- Infinite loops
- Uncaught exceptions in critical paths
- Variables used before declaration
- Recursion without a base case
- Missing imports or dependencies

### Major performance issues

- N+1 queries (database or API calls inside a loop)
- Loading entire datasets into memory
- Synchronous blocking in request handlers
- Missing indexes on columns used for filtering or sorting
- Repeated expensive computation inside a loop

## What it ignores

The skill does **not** flag:
- Code style, naming conventions, or formatting
- Dead code or stale comments
- TODO / FIXME markers
- Suggested refactoring or architectural improvements
- Minor optimizations with negligible impact
- `.env.prod` (intentional in the easydeploy workflow)

## How it works

1. **Retrieves the diff** — uses `git diff --cached` (staged changes) or `git diff HEAD` if nothing is staged; accepts an optional `diff` parameter when called by another skill
2. **Analyzes the diff** — scans line by line for the categories above
3. **For each issue found**:
   - Identifies the file and line
   - Explains what is happening and why it is a problem
   - Describes the real-world consequence
   - Asks: **fix automatically** or **ignore**
   - If fix is chosen: reads the file, applies the minimal safe change, and re-stages it
4. **Summary** — reports how many issues were fixed and how many were ignored

## Prerequisites

- A git repository with changes (staged or unstaged)
