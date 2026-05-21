# migrationdb

Prépare le premier déploiement de la base de données. Dump la DB locale dans `migrations/`, commit le dump dans git, puis push pour déclencher la CI qui le restaure automatiquement sur le serveur.

> Ce skill est conçu pour le **premier déploiement uniquement**. Les déploiements suivants utilisent les migrations de schéma directement via la CI, sans intervention manuelle.

## Usage

```
/migrationdb
```

## Prérequis

Avant d'utiliser ce skill :
1. La CI doit exister : `/deploy-setup`
2. Le job `migrate` doit être configuré dans la CI : `/migrationdb-setup`

## Ce que fait ce skill

### 1. Vérification des prérequis

- Vérifie que `.github/workflows/deploy.yml` existe
- Vérifie que le job `migrate` est présent dans la CI

### 2. Détection de la DB locale

Lit `docker-compose.yml` pour identifier le service de base de données et son type.
Lit `.env` ou `.env.local` pour les informations de connexion.

### 3. Confirmation utilisateur

Demande confirmation avant toute opération — le restore sur le serveur écrase les données existantes.

### 4. Dump de la DB locale

Crée le dossier `migrations/` et génère le dump :

| DB | Commande | Fichier produit |
|----|----------|-----------------|
| PostgreSQL | `docker compose exec -T <service> pg_dump -U <user> <db>` | `migrations/dump.sql` |
| MySQL / MariaDB | `docker compose exec -T <service> mysqldump -u <user> -p<pass> <db>` | `migrations/dump.sql` |
| MongoDB | `docker compose exec <service> mongodump --db <db> --archive` | `migrations/dump.archive` |

### 5. Commit et push via `/github-commit`

Le dump est commité dans git et pushé sur `main`. Le push déclenche la CI GitHub Actions qui :

1. Clone le repo sur le serveur (premier déploiement)
2. Pull → le dump est maintenant dans le checkout
3. Détecte `migrations/dump.sql` (ou `.archive`) et le restaure
4. Exécute les migrations de schéma
5. Lance le job `deploy`

## Cycle de vie du dump

```
/migrationdb
  ├── Crée    : migrations/dump.sql  (local)
  ├── Commit  : git add -f migrations/dump.sql
  └── Push → CI
        ├── git clone + git pull (dump présent dans le checkout)
        ├── Restore depuis migrations/dump.sql
        └── Exécute les migrations de schéma

Après succès de la CI :
  └── Supprimer migrations/dump.sql et commiter la suppression (/deploy)
```

## Après le premier déploiement

Une fois la CI exécutée avec succès, supprimer le dump du repo :

```
1. Supprimer migrations/dump.sql  (ou .archive)
2. Lancer /deploy pour commiter la suppression et redéployer
```

Tant que le fichier reste dans git, la CI le restaurera à chaque deploy (idempotent mais inutile).

## Sécurité

- Le dump contient des données de votre base locale — ne l'utiliser que dans un repo **privé**
- Les mots de passe de DB ne sont jamais écrits dans un fichier distinct
- Après le premier deploy réussi, supprimer le dump du repo dès que possible

## Skills associés

| Skill | Relation |
|-------|----------|
| `/migrationdb-setup` | Doit être exécuté avant — configure le job CI qui restaure le dump |
| `/deploy-setup` | Doit être exécuté avant — crée la CI de base |
| `/github-commit` | Invoqué pour commiter le dump et pusher |
| `/deploy` | Utiliser après le premier deploy pour supprimer le dump du repo |
