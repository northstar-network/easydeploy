# deploy-setup

Génère le workflow GitHub Actions CI/CD pour un projet. Gère le premier déploiement sur le serveur et délègue la configuration des migrations de base de données à `migrationdb-setup`.

## Usage

```
/deploy-setup
```

Peut aussi être invoqué automatiquement par `/deploy` si aucun workflow CI n'existe.

## Ce que fait ce skill

### 1. Vérification de la CI existante

Vérifie si `.github/workflows/deploy.yml` existe déjà. Si oui, demande confirmation avant d'écraser.

### 2. Collecte des informations projet

- **Nom du projet** : détecté depuis le nom du dossier git
- **URL du remote** : lue depuis `git remote get-url origin` — utilisée pour le `git clone` au premier déploiement
- **Chemin serveur** : `/var/www/project/<projectName>` (automatique, sans interaction)

### 3. Génération du workflow CI

Génère `.github/workflows/deploy.yml` avec :

- Déclenchement sur push vers `main`
- Guard de premier déploiement : si le répertoire n'existe pas sur le serveur, `git clone` automatique avant le `git pull`
- Déploiement via SSH avec `docker compose --env-file .env.prod up -d --remove-orphans`

```yaml
jobs:
  deploy:
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.2.0
        script: |
          if [ ! -d "/var/www/project/<projectName>" ]; then
            git clone <repoUrl> /var/www/project/<projectName>
          fi
          cd /var/www/project/<projectName>
          git pull origin main
          docker compose --env-file .env.prod up -d --remove-orphans
```

### 4. Configuration des migrations (si DB détectée)

Délègue à `/migrationdb-setup` qui détecte la base de données et ajoute un job `migrate` obligatoire avant `deploy` dans la CI.

## Secrets GitHub requis

À configurer dans `Settings → Secrets and variables → Actions → New repository secret` :

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | IP ou domaine du serveur |
| `SSH_USERNAME` | Utilisateur SSH sur le serveur |
| `SSH_PRIVATE_KEY` | Contenu de la clé privée SSH (commence par `-----BEGIN`) |
| `SSH_PORT` | Port SSH — optionnel, défaut : `22` |

## Fichiers créés ou modifiés

| Fichier | Action |
|---------|--------|
| `.github/workflows/deploy.yml` | Créé (ou écrasé si confirmation) |

## Skills associés

| Skill | Relation |
|-------|----------|
| `/migrationdb-setup` | Invoqué par `deploy-setup` si une DB est détectée |
| `/deploy` | Invoque `deploy-setup` si la CI est absente |
| `/github-commit` | Utilisé ensuite par `/deploy` pour pusher |

## Prérequis

- Dépôt git initialisé avec un remote `origin` pointant vers `northstar-network`
- Fichier `docker-compose.yml` présent dans le projet
- `.env.prod` présent sur le serveur de production (géré en dehors du repo)
