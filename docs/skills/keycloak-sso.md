# ea-keycloak-sso

Integrates Keycloak SSO authentication into your project. Detects the framework, proposes the right integration strategy, creates the Keycloak client via the NSN permission manager, and implements the full SSO flow.

## Trigger

```
/ea-keycloak-sso
```

Also accessible from the `/easydeploy` menu under "Set up Keycloak SSO" or "Update Keycloak SSO".

## Keycloak instance

| Setting | Value |
|---|---|
| URL | `https://keycloak.n10.xyz/` |
| Realm | `nsn` |

## Supported frameworks

| Framework | Integration approach |
|---|---|
| Next.js | NextAuth.js with Keycloak provider |
| Express.js | keycloak-connect middleware |
| NestJS | Passport + OpenID Connect |
| React / Vue / Angular SPA | Keycloak JS adapter (public client) |
| FastAPI | python-keycloak |
| Django | mozilla-django-oidc |
| Flask | Authlib OIDC |
| Symfony | nbgrp/keycloak-security-bundle |
| Laravel | Socialite Keycloak provider |
| Rails | omniauth-keycloak |
| Spring Boot | Spring Security OAuth2 |
| Go (Gin / Echo / Fiber) | coreos/go-oidc |

## Flow

1. **Analyzes the project** — reads `package.json`, `requirements.txt`, `composer.json`, etc. to detect the framework and any existing auth setup.
2. **Presents a plan** — shows which packages will be installed and which files will be created or modified. Asks for confirmation before making any changes.
3. **Creates the Keycloak client** — asks you to open the NSN permission manager at `https://github-permission-manager.n10.xyz/<projectName>/create-sso-client` to create the client. You paste back the Client ID and Client Secret it provides.
4. **Implements the integration** — installs packages, writes the auth configuration files, and updates `.env` with the credentials.

## Environment variables added

```
KEYCLOAK_URL=https://keycloak.n10.xyz/
KEYCLOAK_REALM=nsn
KEYCLOAK_CLIENT_ID=<provided by permission manager>
KEYCLOAK_CLIENT_SECRET=<provided by permission manager>
```

> **Note for SPA projects** (React / Vue / Angular): these use a Keycloak *public* client, so no `KEYCLOAK_CLIENT_SECRET` is needed or written.

## Prerequisites

- The NSN permission manager at `github-permission-manager.n10.xyz` must be accessible (internet connection required).
- The project must already have a name identifiable from the folder or `git rev-parse --show-toplevel`.
