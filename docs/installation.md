# Installation

## Option 1 — Automated (recommended)

From the easydeploy repository root, run:

```bash
./install.sh /path/to/your-project
```

Replace `/path/to/your-project` with the absolute path to the project you want to deploy.

The installer:
1. Copies all skill directories into `.claude/skills/` inside your project
2. Merges the required Claude Code permissions into `.claude/settings.json` (creates the file if it does not exist)

## Option 2 — Manual

If you prefer to install without running a script, copy the skill files directly:

1. Copy the `.claude/` folder from this repository into your project root
2. If your project already has a `.claude/settings.json`, manually merge the `permissions` block from easydeploy's `settings.json` into yours

### Files added to your project

Either way, your project will end up with:

```
your-project/
└── .claude/
    ├── settings.json              ← permissions merged here
    └── skills/
        ├── easydeploy/
        ├── ea-docker-setup/
        ├── ea-docker-run/
        ├── ea-github-setup/
        ├── ea-github-commit/
        ├── ea-code-review/
        ├── ea-deploy-setup/
        ├── ea-migrationdb-setup/
        └── ea-deploy/
```

The skill files are safe to commit to your project's repository — they contain no secrets.

## Verify the installation

Open Claude Code in your project and type:

```
/easydeploy
```

You should see the main menu with options based on your project's current state. If the command is not recognised, make sure Claude Code is opened at the root of the project (the directory that contains `.claude/`).

## Updating

To update skills in a project after pulling new changes from this repository, run the install script again:

```bash
./install.sh /path/to/your-project
```

The installer overwrites existing skill files and re-merges settings.
