---
name: migrationdb-setup
description: >
  Detects whether the project uses a database, identifies the migration framework,
  and configures the CI workflow with a mandatory migrate job before deploy.
  The migrate job runs migrations via docker compose exec on the app service.
  On first deploy, also restores an initial dump committed by migrationdb if present.
  Called by deploy-setup. Can also be invoked directly.
  Trigger phrases: "migrationdb setup", "setup migration", "configurer les migrations",
  "ajouter les migrations à la ci".
version: 1.0.0
---

# migrationdb-setup

Détecte la base de données et le framework de migration du projet, puis configure la CI avec
un job `migrate` obligatoire avant chaque deploy.

Les migrations de schéma sont jouées via `docker compose exec` sur le service applicatif —
les fichiers de migration suivent l'organisation conventionnelle du framework et sont commités
dans git pour être appliqués automatiquement à chaque deploy.

---

## Step 1 — Détecter la base de données

### 1.1 — Lire docker-compose.yml

Si `docker-compose.yml` existe, le lire et chercher :
- Un service dont l'image contient : `postgres`, `mysql`, `mariadb`, `mongodb`, `mongo`
  → stocker le nom du service en `dbService` et le type en `dbType`
- Le service applicatif principal (celui qui n'est pas une DB, un cache ou un proxy) :
  typiquement nommé `app`, `web`, `api`, `backend`, ou déduit du nom du projet
  → stocker en `appService`

Si plusieurs services non-DB existent → choisir celui qui a une section `build:` ou dont le
nom correspond au projet.

### 1.2 — Lire les fichiers d'environnement

Si `.env.example` existe, le lire. Sinon essayer `.env`. Chercher des variables préfixées par :
`DB_`, `DATABASE_`, `POSTGRES_`, `MYSQL_`, `MONGO_`, `MONGODB_`.

Extraire `dbName`, `dbUser`, `dbPassword`.

### 1.3 — Décision

- Si un match est trouvé en 1.1 ou 1.2 → `hasDatabase = true`
- Sinon → `hasDatabase = false`

Si `hasDatabase = false` :

```
✓ No database detected — no migration job needed.
```

Arrêter.

---

## Step 2 — Détecter le framework de migration

Lire les fichiers du projet et appliquer la détection dans l'ordre suivant :

| Fichier détecté | Framework | Commande de migration | Dossier des migrations |
|---|---|---|---|
| `artisan` | Laravel | `php artisan migrate --force` | `database/migrations/` |
| `manage.py` | Django | `python manage.py migrate` | `<app>/migrations/` |
| `Gemfile` contient `rails` | Rails | `bundle exec rails db:migrate` | `db/migrate/` |
| `mix.exs` contient `ecto` | Elixir/Phoenix | `mix ecto.migrate` | `priv/repo/migrations/` |
| `prisma/schema.prisma` | Prisma | `npx prisma migrate deploy` | `prisma/migrations/` |
| `package.json` contient `sequelize-cli` | Sequelize | `npx sequelize-cli db:migrate` | `migrations/` |

Utiliser le **premier match**. Stocker en `migrationCommand` et `migrationsFolder`.

Si aucun framework n'est détecté, demander en texte libre — **ne pas utiliser AskUserQuestion** :

---
**Aucun framework de migration n'a été détecté automatiquement.**

Quelle commande doit être exécutée pour appliquer les migrations sur le serveur ?

Exemples : `php artisan migrate --force` · `python manage.py migrate` · `npx prisma migrate deploy`

✏️ Taper la commande ci-dessous.

---

Demander également le dossier des migrations en texte libre (défaut : `migrations/`).

Stocker en `migrationCommand` et `migrationsFolder`.

---

## Step 3 — Construire la commande exec

La migration doit être jouée **dans le container applicatif** via `docker compose exec`.

Construire :

```
docker compose exec -T <appService> <migrationCommand>
```

Stocker en `execMigrationCommand`.

Pour le restore du dump initial (si DB PostgreSQL, MySQL ou MongoDB), construire également
la commande exec sur le service DB :

### PostgreSQL
```bash
docker compose exec -T <dbService> psql -U <dbUser> <dbName> < migrations/dump.sql
```

### MySQL / MariaDB
```bash
docker compose exec -T <dbService> mysql -u <dbUser> -p<dbPassword> <dbName> < migrations/dump.sql
```

### MongoDB
```bash
docker compose exec -T <dbService> mongorestore --db <dbName> --archive < migrations/dump.archive
```

Stocker en `restoreCommand`. Stocker le nom du fichier de dump en `dumpFile` (`dump.sql` ou `dump.archive`).

---

## Step 4 — Mettre à jour la CI

Lire `.github/workflows/deploy.yml`.

Si le fichier n'existe pas :

```
⚠ No CI workflow found. Run deploy-setup first.
```

Arrêter.

### 4.1 — Vérifier si le job migrate existe déjà

Si le fichier contient déjà un job `migrate:` :

```
✓ A migrate job is already present in the CI workflow. No changes made.
```

Arrêter.

### 4.2 — Ajouter le job migrate

Insérer un job `migrate` avant le job `deploy` existant et ajouter `needs: migrate` sur `deploy`.

Le script du job `migrate` :
1. Clone le repo si le répertoire n'existe pas (premier déploiement)
2. Pull le code (les fichiers de migration du framework sont dans le checkout)
3. Si un dump initial est présent dans `migrations/` → le restaurer via `docker compose exec`
4. Toujours exécuter `docker compose exec <appService> <migrationCommand>`

```yaml
jobs:
  migrate:
    name: Run migrations
    runs-on: ubuntu-latest

    steps:
      - name: Run migrations via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            if [ ! -d "<serverPath>" ]; then
              git clone <gitRepoUrl> <serverPath>
            fi
            cd <serverPath>
            git pull origin main
            if [ -f "migrations/<dumpFile>" ]; then
              <restoreCommand>
            fi
            <execMigrationCommand>

  deploy:
    name: SSH deploy
    runs-on: ubuntu-latest
    needs: migrate
    # ... steps deploy inchangés
```

Remplacer `<serverPath>`, `<gitRepoUrl>`, `<dumpFile>`, `<restoreCommand>` et
`<execMigrationCommand>` par les valeurs réelles.

Lire `gitRepoUrl` et `serverPath` depuis le script SSH du job `deploy` existant.

Écrire le fichier mis à jour avec l'outil Edit.

Afficher :

```
✓ migrate job added to .github/workflows/deploy.yml

  Framework       : <framework détecté ou "custom">
  App service     : <appService>
  Migration cmd   : docker compose exec -T <appService> <migrationCommand>
  Migrations dir  : <migrationsFolder>
  First deploy    : dump restore depuis migrations/<dumpFile> si présent
  Order           : migrate → deploy (obligatoire)
```

---

## Workflow de migration par déploiement

| Situation | Ce que fait le job `migrate` |
|---|---|
| Premier déploiement + dump commité | Clone, restore le dump via `docker compose exec`, joue les migrations de schéma |
| Premier déploiement sans dump | Clone, joue les migrations de schéma |
| Déploiements suivants | Pull, joue les migrations de schéma (`docker compose exec`) |

Les fichiers de migration du framework (ex: `database/migrations/*.php` pour Laravel) sont
commités dans git et appliqués automatiquement par `<execMigrationCommand>` à chaque deploy.

---

## Rules

- **Never** add the migrate job if one already exists — always check first.
- **Never** modify the `deploy` job's SSH script — only add `needs: migrate` to it.
- **Always** use `docker compose exec -T <appService>` for the migration command — never run it directly on the host.
- **Always** use `docker compose exec -T <dbService>` for the dump restore — never on the host.
- **Always** preserve the existing content of the workflow file when editing.
- The `migrate` job must always run before `deploy` — `needs: migrate` is not optional.
- The dump restore block must always run before `execMigrationCommand` — order matters.
