# deploy

Point d'entrée pour déployer un projet en production. Vérifie que la CI est configurée, fait une review du code, puis push pour déclencher le pipeline GitHub Actions.

## Usage

```
/deploy
```

## Ce que fait ce skill

### 1. Vérification de la CI

Vérifie si `.github/workflows/deploy.yml` existe.

- **Absent** → invoque `/deploy-setup` automatiquement pour créer la CI, puis continue
- **Présent** → continue directement

### 2. Review et push

Invoque `/github-commit` qui enchaîne :

1. Pull des derniers changements (résolution de conflits si nécessaire)
2. Review du code via `/code-review` (sécurité, erreurs fatales, performances)
3. Génération du message de commit (confirmation utilisateur)
4. `git commit` + `git push` → déclenche la CI

### 3. Résumé du pipeline

Après le push, affiche le pipeline qui va s'exécuter :

- **Sans DB** : `deploy` uniquement
- **Avec DB** : `migrate → deploy` (les migrations s'exécutent en premier, obligatoirement)

Affiche également le lien direct vers GitHub Actions pour suivre le déploiement.

## Flow complet

```
/deploy
  ├── /deploy-setup   (si CI absente)
  │     └── /migrationdb-setup  (si DB détectée)
  └── /github-commit
        └── /code-review
```

## Pipeline GitHub Actions déclenché

```
push → main
  ├── migrate   (si job présent — migrations de schéma, ou restore dump au premier déploiement)
  └── deploy    (SSH : git pull + docker compose up)
```

## Skills associés

| Skill | Relation |
|-------|----------|
| `/deploy-setup` | Invoqué si `.github/workflows/deploy.yml` est absent |
| `/github-commit` | Invoqué pour la review, le commit et le push |
| `/code-review` | Invoqué par `github-commit` avant le commit |

## Prérequis

- Dépôt git avec remote `origin` configuré vers `northstar-network`
- Secrets GitHub configurés (voir `/deploy-setup`)
- `.env.prod` présent sur le serveur de production
