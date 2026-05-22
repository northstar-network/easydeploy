# Getting started

This guide walks through the full easydeploy workflow from a blank project to a live production deployment. The example project is a Node.js notes app called `notes-app`.

## 1. Open the main menu

Open Claude Code in your project root and type:

```
/easydeploy
```

easydeploy inspects your project state and presents only the options that apply. On a fresh project with no Docker configuration and no git repository, you will see:

![easydeploy first run](../img/1%20-%20easydeploy%20first%20run%20.png)

Select **Set up project** to Dockerize your project.

---

## 2. Docker setup — choose a local hostname

The `ea-docker-setup` skill reads your project files, detects your tech stack, and generates a `Dockerfile` and `docker-compose.yml`. The only thing it asks you is the local hostname your app should be accessible at:

![Ask for local hostname](../img/2%20-%20ask%20for%20local%20hostname.png)

Press **ok** to accept the default (`notes-app.localhost`) or type a custom hostname. The skill then builds your Docker image.

---

## 3. Docker setup complete — start the project

Once the build succeeds, easydeploy asks if you want to start the project immediately:

![Docker setup complete](../img/3%20-%20docker%20setup%20complete%20ask%20for%20run.png)

Select **Yes, start it** to launch the containers right away.

---

## 4. Project is running

The `ea-docker-run` skill starts your containers and confirms the app is live:

![Project is running](../img/4%20-%20project%20is%20running.png)

Your app is now accessible at `http://notes-app.localhost` in your browser.

---

## 5. GitHub setup — choose a repository name

Back in the easydeploy menu, select **Set up GitHub**. The `ea-github-setup` skill detects that no git repository exists and starts the creation flow. First, it asks for a repository name:

![Ask for GitHub repository name](../img/5%20-%20ask%20for%20github%20repository%20name.png)

Press **ok** to use the default (derived from your project folder name) or type a custom name.

---

## 6. Provide your GitHub username

Next, the skill asks for your GitHub username so it can generate the repository creation link:

![Ask for GitHub username](../img/6%20-%20ask%20for%20github%20username.png)

---

## 7. Create the repository

The skill generates a link and asks you to open it. The link takes you to the permission manager, which creates the repository under `northstar-network` on your behalf:

![Repository created](../img/7%20-%20micro-service%20repository%20creation%20after%20llink.png)

Once the repository is created, copy the SSH URL shown on the page and paste it back into Claude Code to continue.

---

## 8. Code committed and pushed

The `ea-github-commit` skill initialises git, generates a commit message, and pushes your project to GitHub:

![Pushed to GitHub](../img/8%20-%20pushed%20to%20github.png)

Your code is now on `github.com/northstar-network/notes-app`.

---

## 9. Database and migration setup

When you run `/deploy-setup`, the skill automatically calls `ea-migrationdb-setup` to detect any database usage. It configures Docker Compose to manage the database and sets up a migration system:

![Database setup complete](../img/9%20-%20database%20setup%20complete.png)

In this example, the skill detected SQLite, added a persistent volume to Docker Compose, and set up Raw SQL file migrations. The exact output depends on your project's stack.

---

## 10. Deploy to production

Run `/deploy` (or select **Deploy to production** from the easydeploy menu). The skill reviews your code, commits any pending changes, pushes to `main`, and triggers the GitHub Actions pipeline:

![Deploy triggered](../img/10%20-%20deployed%20triggered.png)

GitHub Actions runs the pipeline in order:
1. **migrate** — applies database migrations on the server
2. **deploy** — pulls the latest code and restarts containers

Track the live run at the GitHub Actions link shown in Claude Code.

---

## What's next?

- Every subsequent deployment: type `/deploy` — it handles code review, commit, push, and pipeline trigger automatically
- To restart containers locally after a reboot: `/docker-run`
- For the full skill reference: [Skills overview](skills/overview.md)
