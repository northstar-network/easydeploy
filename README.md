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

## Flow orchestré par `/easydeploy`

```
1. Docker setup    — vérifie / génère la config Docker et build le projet
2. Docker run      — démarre les containers
3. GitHub setup    — vérifie le remote, crée ou migre le repo sur northstar-network
                      └─ github-commit — commit et push le code si nécessaire
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

Le skill orchestre automatiquement l'ensemble du processus. Chaque skill peut aussi être utilisé indépendamment :

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
1. Identifie la branche cible (`main` ou `master`)
2. Pull les derniers changements depuis le remote
3. Résout les conflits fichier par fichier avec propositions (garder local / garder remote / merge intelligent)
4. `git add -A` → génère un message de commit automatique (confirmation utilisateur) → `git commit` → `git push`
5. En cas d'erreur d'accès : vérifie/crée la clé SSH, guide l'ajout sur GitHub, génère un lien de demande d'accès
