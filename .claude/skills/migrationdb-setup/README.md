# migrationdb-setup

Détecte la base de données et le framework de migration du projet, puis ajoute un job `migrate` obligatoire avant `deploy` dans la CI GitHub Actions.

Les migrations de schéma sont jouées via `docker compose exec` sur le service applicatif — les fichiers de migration suivent l'organisation conventionnelle du framework et sont commités dans git pour être appliqués automatiquement à chaque deploy.

## Usage

```
/migrationdb-setup
```

Peut aussi être invoqué automatiquement par `/deploy-setup` si une base de données est détectée.

## Ce que fait ce skill

### 1. Détection de la base de données et du service applicatif

Analyse `docker-compose.yml` pour identifier :
- Le **service DB** : service dont l'image contient `postgres`, `mysql`, `mariadb`, `mongodb`, `mongo`
- Le **service applicatif** : service avec une section `build:` ou dont le nom correspond au projet (`app`, `web`, `api`, `backend`…)

Analyse également `.env.example` ou `.env` pour les variables de connexion DB.

### 2. Détection du framework et du dossier de migrations

| Fichier détecté | Framework | Commande | Dossier des migrations |
|-----------------|-----------|----------|------------------------|
| `artisan` | Laravel | `php artisan migrate --force` | `database/migrations/` |
| `manage.py` | Django | `python manage.py migrate` | `<app>/migrations/` |
| `Gemfile` + gem `rails` | Rails | `bundle exec rails db:migrate` | `db/migrate/` |
| `mix.exs` + dep `ecto` | Elixir/Phoenix | `mix ecto.migrate` | `priv/repo/migrations/` |
| `prisma/schema.prisma` | Prisma | `npx prisma migrate deploy` | `prisma/migrations/` |
| `package.json` + `sequelize-cli` | Sequelize | `npx sequelize-cli db:migrate` | `migrations/` |

### 3. Génération de la commande exec

La migration est toujours exécutée **dans le container applicatif** via `docker compose exec` :

```bash
docker compose exec -T <appService> <migrationCommand>
```

Le restore du dump initial (si présent) est exécuté dans le **container DB** :

```bash
# PostgreSQL
docker compose exec -T <dbService> psql -U <user> <db> < migrations/dump.sql

# MySQL / MariaDB
docker compose exec -T <dbService> mysql -u <user> -p<pass> <db> < migrations/dump.sql

# MongoDB
docker compose exec -T <dbService> mongorestore --db <db> --archive < migrations/dump.archive
```

### 4. Job `migrate` ajouté dans la CI

Script SSH du job `migrate` généré :

```bash
# Premier déploiement : clone si le répertoire n'existe pas
if [ ! -d "<serverPath>" ]; then
  git clone <repoUrl> <serverPath>
fi
cd <serverPath>

# Pull → les fichiers de migration du framework sont dans le checkout
git pull origin main

# Premier déploiement avec dump : restore depuis le checkout git
if [ -f "migrations/dump.sql" ]; then
  docker compose exec -T <dbService> psql -U <user> <db> < migrations/dump.sql
fi

# Toujours : jouer les migrations de schéma via docker compose exec
docker compose exec -T <appService> php artisan migrate --force
```

## Principe de fonctionnement des migrations

```
Développeur
  ├── Crée un fichier de migration (ex: database/migrations/2026_01_01_create_users.php)
  ├── Commit + push → déclenche la CI
  └── CI : migrate job
        ├── git pull (fichier de migration présent dans le checkout)
        └── docker compose exec -T app php artisan migrate --force
              └── Applique la migration dans la DB du serveur
```

Les fichiers de migration vivent dans le dossier conventionnel du framework et sont versionnés dans git comme n'importe quel autre fichier de code.

## Comportement par déploiement

| Situation | Ce que fait le job `migrate` |
|-----------|------------------------------|
| Premier déploiement + dump dans le checkout | Clone, restore le dump via `docker compose exec`, joue les migrations de schéma |
| Premier déploiement sans dump | Clone, joue les migrations de schéma |
| Déploiements suivants (dump supprimé du repo) | Pull, joue les migrations de schéma |
| Déploiements suivants (dump encore dans le repo) | Pull, restore le dump à nouveau, joue les migrations de schéma — supprimer le dump dès que possible |

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `.github/workflows/deploy.yml` | Modifié : ajout du job `migrate` et `needs: migrate` sur `deploy` |

## Skills associés

| Skill | Relation |
|-------|----------|
| `/deploy-setup` | Invoque `migrationdb-setup` après avoir créé la CI de base |
| `/migrationdb` | Prépare le dump initial que le job `migrate` restaure au premier déploiement |

## Prérequis

- `.github/workflows/deploy.yml` doit exister (créé par `/deploy-setup`)
- Le projet doit utiliser Docker Compose pour la base de données et le service applicatif
