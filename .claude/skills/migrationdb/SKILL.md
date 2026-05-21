---
name: migrationdb
description: >
  First-deploy database seeding: dumps the local database into the migrations/ folder,
  commits it to git, then pushes to trigger the CI pipeline which restores it automatically.
  Only useful for the first deployment — subsequent deploys use schema migrations only.
  Trigger phrases: "migrationdb", "migrer la base de données", "migrate database",
  "copier la db en prod", "dump initial", "initialiser la db en prod".
version: 1.0.0
---

# migrationdb

Prépare le premier déploiement de la base de données. Dump la DB locale dans `migrations/`,
commit le dump dans git, puis push pour déclencher la CI. Le job `migrate` de la CI détecte
le dump dans le checkout et le restaure automatiquement sur le serveur.

Ce skill est conçu pour le **premier déploiement uniquement**. Les déploiements suivants
utilisent les migrations de schéma directement via la CI.

---

## Step 1 — Vérification des prérequis

### 1.1 — CI workflow

```bash
ls .github/workflows/deploy.yml 2>/dev/null
```

Si absent → afficher :

```
⚠ No CI workflow found. Run deploy-setup first, then migrationdb-setup.
```

Arrêter.

### 1.2 — Job migrate

Lire `.github/workflows/deploy.yml` et vérifier la présence d'un job `migrate:`.

Si absent → afficher :

```
⚠ No migrate job found in the CI workflow. Run migrationdb-setup first.
```

Arrêter.

---

## Step 2 — Détection de la DB locale

Lire `docker-compose.yml` et chercher un service dont l'image contient :
`postgres`, `mysql`, `mariadb`, `mongodb`, `mongo`.

Stocker le premier résultat en `dbType` et `dbService`.

Si aucun service trouvé :

```
AskUserQuestion:
  question: "No database service was detected in docker-compose.yml. What database are you using?"
  header: "Database type"
  options:
    - label: "PostgreSQL"
    - label: "MySQL / MariaDB"
    - label: "MongoDB"
    - label: "Cancel"
```

Demander le nom du service en texte libre (défaut : `db`).

---

## Step 3 — Informations de connexion locales

Lire `.env` (ou `.env.local` si absent). Extraire :

| Variable | Défaut |
|---|---|
| `DB_DATABASE` / `POSTGRES_DB` / `MYSQL_DATABASE` / `MONGO_INITDB_DATABASE` | `app` |
| `DB_USERNAME` / `POSTGRES_USER` / `MYSQL_USER` | `app` |
| `DB_PASSWORD` / `POSTGRES_PASSWORD` / `MYSQL_PASSWORD` | *(vide)* |

Stocker en `dbName`, `dbUser`, `dbPassword`.

---

## Step 4 — Confirmation utilisateur

```
AskUserQuestion:
  question: "This will dump your local database, commit it to git, and push to trigger the CI. The CI will restore it on the server on first deploy. Continue?"
  header: "First-deploy dump"
  options:
    - label: "Yes, create and commit the dump"
      description: "Dumps local DB into migrations/, commits it and pushes to trigger CI"
    - label: "No, cancel"
      description: "Stop here — no data will be moved"
```

- "No, cancel" → arrêter.
- "Yes" → continuer.

---

## Step 5 — Création du dump local

Créer le dossier `migrations/` si absent :

```bash
mkdir -p migrations
```

### PostgreSQL

```bash
docker compose exec -T <dbService> pg_dump -U <dbUser> <dbName> > migrations/dump.sql
```

### MySQL / MariaDB

```bash
docker compose exec -T <dbService> mysqldump -u <dbUser> -p<dbPassword> <dbName> > migrations/dump.sql
```

### MongoDB

```bash
docker compose exec <dbService> mongodump --db <dbName> --archive > migrations/dump.archive
```

Si la commande échoue → afficher l'erreur brute et arrêter.

Stocker le nom du fichier en `dumpFile` (`dump.sql` ou `dump.archive`).

Afficher :

```
✓ Local database dumped to migrations/<dumpFile>
```

---

## Step 6 — Commit et push

Invoquer le skill `github-commit` pour stager, commiter et pusher le dump.

Le push déclenche la CI GitHub Actions qui :
1. Clone le repo sur le serveur si c'est le premier déploiement
2. Détecte le dump dans `migrations/<dumpFile>` via le checkout git
3. Restaure la base de données
4. Exécute les migrations de schéma
5. Démarre les containers

---

## Step 7 — Résumé

Afficher :

```
✓ First-deploy migration prepared

  Dump      : migrations/<dumpFile>
  Status    : committed and pushed — CI will restore on server

After the CI has run successfully:
  1. Delete migrations/<dumpFile>
  2. Run /deploy to commit the deletion
```

---

## Rules

- **Never** skip the prerequisite check — the CI must have a `migrate` job to pick up the dump.
- **Always** use `github-commit` for the push — never push directly.
- The dump file must be removed from git after the first successful deploy — remind the user in the summary.
- If the dump command fails, show the raw output and stop — never commit an empty or partial dump.
