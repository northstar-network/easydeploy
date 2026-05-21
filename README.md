# easydeploy

Claude Code skills for Docker-based project setup, deployment, and GitHub configuration within the `northstar-network` organization.

## Skills

| Skill | Commande | Description |
|-------|----------|-------------|
| `easydeploy` | `/easydeploy` | Point d'entrée principal — vérifie l'état du projet et orchestre les autres skills dans le bon ordre |
| `docker-setup` | `/docker-setup` | Vérifie Docker, détecte le type de projet, génère Dockerfile/compose, build les containers |
| `docker-run` | `/docker-run` | Démarre les containers d'un projet déjà configuré avec Docker |
| `github-setup` | `/github-setup` | Vérifie et configure le remote GitHub vers `northstar-network` — crée ou migre le repo |
| `github-commit` | `/github-commit` | Pull, résout les conflits, commit et push — gère les clés SSH et les droits d'accès |
| `code-review` | `/code-review` | Analyse le diff en cours — détecte les failles de sécurité et erreurs fatales, propose des correctifs |
| `deploy-setup` | `/deploy-setup` | Génère le workflow GitHub Actions CI/CD — gère le premier déploiement et délègue la config DB à `migrationdb-setup` |
| `deploy` | `/deploy` | Vérifie la CI, fait une review du code et push pour déclencher le pipeline de déploiement |
| `migrationdb-setup` | `/migrationdb-setup` | Détecte la DB et le framework, ajoute un job `migrate` obligatoire avant chaque deploy dans la CI |
| `migrationdb` | `/migrationdb` | Premier déploiement uniquement — dump la DB locale dans `migrations/`, commit le dump dans git et push pour déclencher la CI |

## Flows

### Flow local : `/easydeploy`

```
1. docker-setup    — vérifie / génère la config Docker et build le projet
2. docker-run      — démarre les containers
3. github-setup    — vérifie le remote, crée ou migre le repo sur northstar-network
                      └─ github-commit — commit et push le code si nécessaire
```

### Flow CI/CD : `/deploy`

```
/deploy
  ├── deploy-setup (si .github/workflows/deploy.yml absent)
  │     └── migrationdb-setup (si DB détectée)
  └── github-commit
        └── code-review
```

### Flow premier déploiement avec DB

```
1. /deploy-setup   — génère la CI
2. /migrationdb-setup — ajoute le job migrate dans la CI
3. /migrationdb    — dump local → commit dans git → push
                      └─ CI : restore dump depuis checkout + migrations de schéma
4. /deploy         — déploiements suivants : migrations de schéma uniquement
```

## Installation

```bash
./install.sh /path/to/your-project
```

L'installateur :
- Copie les skills dans `.claude/skills/` du projet cible
- Fusionne les permissions nécessaires dans `.claude/settings.json`

## Requirements

- Node.js 18+
- Claude Code CLI ou extension VSCode
- Docker Desktop (ou Docker Engine + Compose plugin)
- Accès à `northstar-network` sur GitHub (géré via `github-permission-manager.n10.xyz`)

## Usage

Ouvrir une session Claude Code dans votre projet et taper :

```
/easydeploy
```

Le skill orchestre automatiquement l'ensemble du processus. Chaque skill peut aussi être utilisé indépendamment.

---

## Référence des skills

### `/docker-setup`
1. Vérifie que Docker et Docker Compose sont installés
2. Lit les fichiers du projet pour détecter le stack (Node.js, Python, Go, PHP, Java…)
3. Génère le `Dockerfile` et le `docker-compose.yml` si absents
4. Build l'image Docker
5. Configure le routing via `nsnrouting` (Traefik)

### `/docker-run`
1. Vérifie que `nsnrouting` tourne
2. Démarre les containers avec `docker compose up -d`
3. Affiche l'URL d'accès au projet

### `/github-setup`
1. Détecte si un `.git` existe et si le remote pointe vers `northstar-network`
2. **Scénario A** — Pas de git : crée le repo via le gestionnaire de permissions, puis `git init` + remote
3. **Scénario B** — Remote déjà NSN : rien à faire
4. **Scénario C** — Remote existant ailleurs : crée un repo NSN et migre le remote
5. Délègue le commit/push à `/github-commit`

### `/github-commit`
1. Pull les derniers changements depuis le remote
2. Résout les conflits fichier par fichier avec propositions (garder local / garder remote / merge intelligent)
3. Invoque `/code-review` avant de commiter
4. `git add -A` → génère un message de commit automatique (confirmation utilisateur) → `git commit` → `git push`
5. En cas d'erreur d'accès : vérifie/crée la clé SSH, guide l'ajout sur GitHub, génère un lien de demande d'accès

### `/code-review`
1. Récupère le diff stagé (`git diff --cached`) ou le diff complet (`git diff HEAD`)
2. Analyse le code pour détecter : failles de sécurité, erreurs fatales, problèmes de performance majeurs
3. Pour chaque problème : explique en langage simple et propose un correctif automatique ou l'option d'ignorer
4. Résume les problèmes corrigés / ignorés avant de reprendre le skill appelant

### `/deploy-setup`
1. Vérifie si `.github/workflows/deploy.yml` existe déjà (demande confirmation avant d'écraser)
2. Détecte le nom du projet et l'URL du remote git
3. Génère la CI avec guard de premier déploiement (`git clone` si le répertoire n'existe pas encore sur le serveur)
4. Invoque `/migrationdb-setup` pour détecter la DB et ajouter le job de migration si nécessaire

Secrets GitHub à configurer dans `Settings → Secrets and variables → Actions` :

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | IP ou domaine du serveur de production |
| `SSH_USERNAME` | Utilisateur SSH sur le serveur |
| `SSH_PRIVATE_KEY` | Contenu de la clé privée SSH |
| `SSH_PORT` | Port SSH (optionnel, défaut : 22) |

### `/deploy`
1. Vérifie que `.github/workflows/deploy.yml` existe — lance `/deploy-setup` si absent
2. Invoque `/github-commit` (qui enchaîne : pull → résolution conflits → code review → commit → push)
3. Affiche le pipeline CI qui va s'exécuter et le lien vers GitHub Actions

### `/migrationdb-setup`
1. Détecte la DB et le service applicatif dans `docker-compose.yml`
2. Identifie le framework de migration (Laravel, Django, Rails, Phoenix, Prisma, Sequelize…) et le dossier conventionnel des fichiers de migration
3. Génère la commande de migration via `docker compose exec -T <appService> <cmd>` — les migrations tournent dans le container, pas sur l'hôte
4. Ajoute un job `migrate` **obligatoire** avant `deploy` dans la CI
5. Le job `migrate` gère deux cas :
   - **Premier déploiement** : détecte un dump commité par `/migrationdb` dans `migrations/` (checkout git) et le restaure via `docker compose exec`
   - **Tous les déploiements** : exécute les migrations de schéma via `docker compose exec`

Les fichiers de migration du framework (`database/migrations/`, `priv/repo/migrations/`…) sont commités dans git et appliqués automatiquement par la CI à chaque push.

| Fichier détecté | Framework | Commande | Dossier migrations |
|-----------------|-----------|----------|--------------------|
| `artisan` | Laravel | `php artisan migrate --force` | `database/migrations/` |
| `manage.py` | Django | `python manage.py migrate` | `<app>/migrations/` |
| `Gemfile` + gem `rails` | Rails | `bundle exec rails db:migrate` | `db/migrate/` |
| `mix.exs` + dep `ecto` | Elixir/Phoenix | `mix ecto.migrate` | `priv/repo/migrations/` |
| `prisma/schema.prisma` | Prisma | `npx prisma migrate deploy` | `prisma/migrations/` |
| `package.json` + `sequelize-cli` | Sequelize | `npx sequelize-cli db:migrate` | `migrations/` |

### `/migrationdb`

> Uniquement pour le **premier déploiement** — les suivants utilisent les migrations de schéma via la CI.

1. Vérifie que la CI et le job `migrate` sont en place (prérequis)
2. Détecte la DB locale dans `docker-compose.yml`
3. Dump la DB locale dans `migrations/dump.sql` (ou `.archive` pour MongoDB)
4. Demande les infos SSH du serveur
5. Transfère le dump dans `/tmp/easydeploy_migrations/` sur le serveur (hors du répertoire du projet pour éviter le conflit avec `git clone`)
6. Invoque `/github-commit` pour pusher et déclencher la CI
7. La CI restore le dump, le supprime, puis exécute les migrations de schéma

Formats de dump supportés :

| DB | Outil | Fichier |
|----|-------|---------|
| PostgreSQL | `pg_dump` / `psql` | `dump.sql` |
| MySQL / MariaDB | `mysqldump` / `mysql` | `dump.sql` |
| MongoDB | `mongodump` / `mongorestore` | `dump.archive` |
