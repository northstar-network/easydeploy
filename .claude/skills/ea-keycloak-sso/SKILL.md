---
name: ea-keycloak-sso
description: >
  Integrate Keycloak SSO authentication into a project. Analyzes the project
  stack, proposes the best integration strategy, creates the Keycloak client
  via the NSN permission manager, then implements the full SSO flow.
  Trigger phrases: "keycloak sso", "add sso", "integrate keycloak", "setup authentication",
  "ajouter l'authentification", "sso keycloak", "configurer keycloak", "ea-keycloak-sso".
version: 1.0.0
---

# ea-keycloak-sso

Analyze the project stack and integrate Keycloak SSO authentication using the
most appropriate adapter. Hardcoded values:
- Keycloak URL: `https://keycloak.n10.xyz/`
- Realm: `nsn`

---

## Step 1 — Collect project name

Run:

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Store as `projectName`. This is used to build the SSO client creation URL.

---

## Step 2 — Analyze the project stack

Read the following files if they exist to understand the stack:
- `package.json` — detect Node.js framework (Next.js, Express, NestJS, Fastify, React SPA, Vue, Angular, etc.)
- `requirements.txt` / `pyproject.toml` / `setup.py` — detect Python framework (Django, Flask, FastAPI)
- `composer.json` — detect PHP framework (Symfony, Laravel)
- `go.mod` — detect Go framework (Gin, Echo, Fiber, etc.)
- `Gemfile` — detect Ruby framework (Rails, Sinatra)
- `pom.xml` / `build.gradle` — detect Java framework (Spring Boot)
- `docker-compose.yml` — detect services and environment variable names
- `.env` — detect existing env variable patterns

Also look for existing auth-related files:
- Any file containing `passport`, `auth`, `oauth`, `oidc`, `jwt`, `session` in its name
- Imports of auth libraries in the source code

Store findings as:
- `projectType`: node | python | go | php | ruby | java | static | unknown
- `framework`: the specific framework (nextjs | express | nestjs | react-spa | fastapi | django | flask | symfony | laravel | gin | rails | spring | etc.)
- `hasExistingAuth`: true | false (whether an auth system is already in place)
- `existingAuthLib`: name of detected auth library, or null

---

## Step 3 — Determine the integration strategy

Based on `framework`, choose the recommended approach from the table below:

| Framework | Recommended approach | Package(s) to add |
|---|---|---|
| `nextjs` | NextAuth.js with Keycloak provider | `next-auth` |
| `express` | keycloak-connect middleware | `keycloak-connect`, `express-session` |
| `nestjs` | Passport + OpenID Connect | `@nestjs/passport`, `passport`, `passport-openidconnect` |
| `react-spa` / `vue` / `angular` | Keycloak JS adapter (client-side) | `keycloak-js` |
| `fastapi` | python-keycloak + python-jose | `python-keycloak`, `python-jose[cryptography]`, `httpx` |
| `django` | mozilla-django-oidc | `mozilla-django-oidc` |
| `flask` | Authlib OIDC | `authlib`, `requests` |
| `symfony` | nbgrp/keycloak-security-bundle | `nbgrp/keycloak-security-bundle` |
| `laravel` | Socialite Keycloak provider | `laravel/socialite`, `socialiteproviders/keycloak` |
| `rails` | OmniAuth Keycloak | `omniauth-keycloak` |
| `spring` | Spring Security OAuth2 | (config in `application.yml`) |
| `gin` / `echo` / `fiber` | coreos/go-oidc | `github.com/coreos/go-oidc/v3` |
| `unknown` | Generic OpenID Connect | depends on detected language |

If `framework` is `unknown` → ask:

```
AskUserQuestion:
  question: "I could not detect the framework used in this project. Which best describes it?"
  header: "Framework"
  options:
    - label: "Node.js (Express / Fastify)"
      description: "Uses keycloak-connect middleware"
    - label: "React / Vue / Angular SPA"
      description: "Uses the Keycloak JS adapter in the browser"
    - label: "Python (FastAPI / Flask / Django)"
      description: "Uses python-keycloak or mozilla-django-oidc"
    - label: "PHP (Symfony / Laravel)"
      description: "Uses a Symfony bundle or Socialite provider"
```

Map the answer to a `framework` value and continue.

Store `integrationStrategy` as a short description of the chosen approach.
Store `packagesToAdd` as the list of packages to install.

---

## Step 4 — Present the plan

Display a plain text summary — **do NOT use AskUserQuestion** yet. Show:

```
Here is the proposed SSO integration plan for <projectName>:

Stack detected:   <framework>
Approach:         <integrationStrategy>
Package(s):       <packagesToAdd>

Files that will be created or modified:
<list the specific files based on the framework — see per-framework details in Step 6>

Environment variables that will be added to .env:
  KEYCLOAK_URL=https://keycloak.n10.xyz/
  KEYCLOAK_REALM=nsn
  KEYCLOAK_CLIENT_ID=<will be provided by the NSN permission manager>
  KEYCLOAK_CLIENT_SECRET=<will be provided by the NSN permission manager>
```

If `hasExistingAuth = true`, also show:

```
⚠️  An existing auth system was detected (<existingAuthLib>).
    The SSO integration will be added alongside it — existing auth code will not be removed.
```

Then ask:

```
AskUserQuestion:
  question: "Does this integration plan work for you?"
  header: "SSO plan"
  options:
    - label: "Yes, proceed"
      description: "Continue to create the Keycloak client and implement the integration"
    - label: "No, cancel"
      description: "Stop here — no changes will be made"
```

- "No, cancel" → stop.
- "Yes, proceed" → continue to Step 5.

---

## Step 5 — Create the Keycloak client

### 5.1 — Build the permission link

```
https://github-permission-manager.n10.xyz/<projectName>/create-sso-client
```

Store as `ssoPermissionLink`.

### 5.2 — Ask the user to open the link

Display as plain text — **do NOT use AskUserQuestion**:

---
**Create the Keycloak SSO client**

Open the following link to create the SSO client for this project in the NSN Keycloak instance:

[<ssoPermissionLink>](<ssoPermissionLink>)

The service will create the client and provide you with a **Client ID** and a **Client Secret**.

✏️ Once you have them, paste the Client ID below.

---

Wait for the user's reply. Store as `keycloakClientId`.

### 5.3 — Ask for the Client Secret

Display as plain text — **do NOT use AskUserQuestion**:

---
**Client Secret**

✏️ Now paste the Client Secret provided by the link.

---

Wait for the user's reply. Store as `keycloakClientSecret`.

---

## Step 6 — Implement the integration

### 6.1 — Update environment variables

If a `.env` file exists, read it. Add the following lines (do not overwrite existing content):

```
KEYCLOAK_URL=https://keycloak.n10.xyz/
KEYCLOAK_REALM=nsn
KEYCLOAK_CLIENT_ID=<keycloakClientId>
KEYCLOAK_CLIENT_SECRET=<keycloakClientSecret>
```

If no `.env` exists, create it with these four lines.

Display:

```
✓ .env updated with Keycloak credentials
```

### 6.2 — Install packages

Install the packages listed in `packagesToAdd` using the right package manager:

- **Node.js**: detect yarn (`yarn.lock`) or npm (`package-lock.json`) or pnpm (`pnpm-lock.yaml`), then run:
  - yarn: `yarn add <packages>`
  - npm: `npm install <packages>`
  - pnpm: `pnpm add <packages>`
- **Python**: run `pip install <packages>` and append each to `requirements.txt`
  (if `pyproject.toml` exists, add to `[project.dependencies]` instead)
- **PHP/Composer**: run `composer require <packages>`
- **Ruby**: append each `gem '<package>'` to `Gemfile`, then run `bundle install`
- **Go**: run `go get <packages>`
- **Java/Spring**: add the Spring Security OAuth2 dependencies to `pom.xml` or `build.gradle`

If the package installation fails → show the error, then continue with the file generation (the user can install manually).

Display:

```
✓ Packages installed
```

### 6.3 — Generate integration code

Write or update the files needed for the chosen framework. Use the values:
- `KEYCLOAK_URL` / `process.env.KEYCLOAK_URL` / `os.environ["KEYCLOAK_URL"]` / etc.
- `KEYCLOAK_REALM` / `process.env.KEYCLOAK_REALM` / etc.
- `KEYCLOAK_CLIENT_ID` / `process.env.KEYCLOAK_CLIENT_ID` / etc.
- `KEYCLOAK_CLIENT_SECRET` / `process.env.KEYCLOAK_CLIENT_SECRET` / etc.

Always read from environment variables — never hardcode credentials in source files.

---

#### Next.js (`nextjs`)

Write `auth.ts` (or `auth.js`) at the project root (or `src/auth.ts` if a `src/` directory exists):

```typescript
import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: `${process.env.KEYCLOAK_URL}realms/${process.env.KEYCLOAK_REALM}`,
    }),
  ],
})
```

Write `app/api/auth/[...nextauth]/route.ts` (create directories if needed):

```typescript
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

Also add to `.env.local` (create if not exists, in addition to `.env`):

```
AUTH_SECRET=<generate a random 32-char hex string using: openssl rand -hex 32>
NEXTAUTH_URL=http://localhost:3000
```

Run `openssl rand -hex 32` to generate `AUTH_SECRET`.

---

#### Express.js (`express`)

Write `src/keycloak.js` (or `keycloak.js` at project root if no `src/` directory):

```javascript
const session = require("express-session")
const Keycloak = require("keycloak-connect")

const memoryStore = new session.MemoryStore()

const keycloak = new Keycloak({ store: memoryStore }, {
  "realm": process.env.KEYCLOAK_REALM,
  "auth-server-url": process.env.KEYCLOAK_URL,
  "ssl-required": "external",
  "resource": process.env.KEYCLOAK_CLIENT_ID,
  "credentials": {
    "secret": process.env.KEYCLOAK_CLIENT_SECRET,
  },
  "confidential-port": 0,
})

module.exports = { keycloak, memoryStore }
```

Find the main Express app file (usually `app.js`, `index.js`, or `server.js`) and add
the session and keycloak middleware registration after other middleware:

```javascript
const { keycloak, memoryStore } = require("./src/keycloak") // adjust path

app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
}))

app.use(keycloak.middleware())
```

Also add to `.env`:

```
SESSION_SECRET=<generate a random 32-char hex string using: openssl rand -hex 32>
```

Run `openssl rand -hex 32` to generate `SESSION_SECRET`.

---

#### NestJS (`nestjs`)

Write `src/auth/auth.module.ts`:

```typescript
import { Module } from "@nestjs/common"
import { PassportModule } from "@nestjs/passport"
import { KeycloakStrategy } from "./keycloak.strategy"

@Module({
  imports: [PassportModule.register({ defaultStrategy: "openidconnect" })],
  providers: [KeycloakStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
```

Write `src/auth/keycloak.strategy.ts`:

```typescript
import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy, Client, Issuer } from "openid-client"

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, "openidconnect") {
  constructor() {
    super({
      client: undefined, // initialized in onModuleInit
      params: { scope: "openid profile email" },
      passReqToCallback: false,
    })
  }

  async validate(tokenset: any, userinfo: any): Promise<any> {
    return userinfo
  }

  static async create(): Promise<KeycloakStrategy> {
    const issuerUrl = `${process.env.KEYCLOAK_URL}realms/${process.env.KEYCLOAK_REALM}`
    const keycloakIssuer = await Issuer.discover(issuerUrl)
    const client = new keycloakIssuer.Client({
      client_id: process.env.KEYCLOAK_CLIENT_ID!,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      redirect_uris: [`${process.env.APP_URL || "http://localhost:3000"}/auth/callback`],
      response_types: ["code"],
    })
    // Store client on instance — see NestJS Passport docs for full factory setup
    return new KeycloakStrategy()
  }
}
```

---

#### React / Vue / Angular SPA (`react-spa`, `vue`, `angular`)

Write `src/keycloak.ts` (or `src/keycloak.js`):

```typescript
import Keycloak from "keycloak-js"

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || process.env.REACT_APP_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM || process.env.REACT_APP_KEYCLOAK_REALM || "nsn",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || process.env.REACT_APP_KEYCLOAK_CLIENT_ID || "",
})

export default keycloak
```

Also add to `.env` the Vite/CRA prefixed variants:

- If Vite detected (`vite.config.*` present): add `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` (no secret — public client)
- If Create React App detected (`react-scripts` in `package.json`): add `REACT_APP_KEYCLOAK_URL`, `REACT_APP_KEYCLOAK_REALM`, `REACT_APP_KEYCLOAK_CLIENT_ID`

Do **not** add `KEYCLOAK_CLIENT_SECRET` to `.env` for SPA projects — SPAs use public clients (no secret).

---

#### FastAPI (`fastapi`)

Write `app/auth/keycloak.py` (or `keycloak.py` at project root if no `app/` directory):

```python
import os
from keycloak import KeycloakOpenID

keycloak_openid = KeycloakOpenID(
    server_url=os.environ["KEYCLOAK_URL"],
    client_id=os.environ["KEYCLOAK_CLIENT_ID"],
    realm_name=os.environ["KEYCLOAK_REALM"],
    client_secret_key=os.environ["KEYCLOAK_CLIENT_SECRET"],
)

async def get_current_user(token: str):
    return keycloak_openid.decode_token(
        token,
        key=keycloak_openid.public_key(),
        options={"verify_signature": True, "verify_aud": False, "exp": True},
    )
```

---

#### Django (`django`)

Find `settings.py` and append:

```python
# Keycloak SSO via mozilla-django-oidc
AUTHENTICATION_BACKENDS = (
    "mozilla_django_oidc.auth.OIDCAuthenticationBackend",
)

OIDC_RP_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID")
OIDC_RP_CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET")
OIDC_RP_SIGN_ALGO = "RS256"

_keycloak_base = f"{os.environ.get('KEYCLOAK_URL', '')}realms/{os.environ.get('KEYCLOAK_REALM', 'nsn')}/protocol/openid-connect"
OIDC_OP_JWKS_ENDPOINT = f"{_keycloak_base}/certs"
OIDC_OP_AUTHORIZATION_ENDPOINT = f"{_keycloak_base}/auth"
OIDC_OP_TOKEN_ENDPOINT = f"{_keycloak_base}/token"
OIDC_OP_USER_ENDPOINT = f"{_keycloak_base}/userinfo"

LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"
```

Also add `"mozilla_django_oidc"` to `INSTALLED_APPS`.

Find `urls.py` and add:

```python
path("oidc/", include("mozilla_django_oidc.urls")),
```

---

#### Flask (`flask`)

Write `auth.py` at project root (or `app/auth.py` if an `app/` package exists):

```python
import os
from authlib.integrations.flask_client import OAuth

oauth = OAuth()

def init_app(app):
    oauth.init_app(app)
    keycloak_base = f"{os.environ['KEYCLOAK_URL']}realms/{os.environ['KEYCLOAK_REALM']}/protocol/openid-connect"
    oauth.register(
        name="keycloak",
        client_id=os.environ["KEYCLOAK_CLIENT_ID"],
        client_secret=os.environ["KEYCLOAK_CLIENT_SECRET"],
        server_metadata_url=f"{os.environ['KEYCLOAK_URL']}realms/{os.environ['KEYCLOAK_REALM']}/.well-known/openid-configuration",
        client_kwargs={"scope": "openid profile email"},
    )
```

---

#### Symfony (`symfony`)

Create or append to `config/packages/keycloak_security.yaml`:

```yaml
nbgrp_keycloak_security:
    keycloak_base_url: '%env(KEYCLOAK_URL)%'
    realm: '%env(KEYCLOAK_REALM)%'
    client_id: '%env(KEYCLOAK_CLIENT_ID)%'
    client_secret: '%env(KEYCLOAK_CLIENT_SECRET)%'
```

---

#### Laravel (`laravel`)

Append to `config/services.php` (inside the return array):

```php
"keycloak" => [
    "client_id"     => env("KEYCLOAK_CLIENT_ID"),
    "client_secret" => env("KEYCLOAK_CLIENT_SECRET"),
    "redirect"      => env("APP_URL") . "/auth/callback/keycloak",
    "base_url"      => env("KEYCLOAK_URL") . "realms/" . env("KEYCLOAK_REALM") . "/protocol/openid-connect",
    "realm"         => env("KEYCLOAK_REALM"),
],
```

---

#### Rails (`rails`)

Append to `config/initializers/omniauth.rb` (create if not exists):

```ruby
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :keycloak_openid, ENV["KEYCLOAK_CLIENT_ID"], ENV["KEYCLOAK_CLIENT_SECRET"],
    client_options: {
      site:          ENV["KEYCLOAK_URL"],
      realm:         ENV["KEYCLOAK_REALM"],
    }
end
```

---

#### Spring Boot (`spring`)

Append to `src/main/resources/application.yml`:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          keycloak:
            client-id: ${KEYCLOAK_CLIENT_ID}
            client-secret: ${KEYCLOAK_CLIENT_SECRET}
            scope: openid,profile,email
        provider:
          keycloak:
            issuer-uri: ${KEYCLOAK_URL}realms/${KEYCLOAK_REALM}
```

---

#### Go — gin / echo / fiber (`gin`, `echo`, `fiber`)

Write `internal/auth/keycloak.go` (or `auth/keycloak.go`):

```go
package auth

import (
    "context"
    "os"

    "github.com/coreos/go-oidc/v3/oidc"
    "golang.org/x/oauth2"
)

var (
    Provider *oidc.Provider
    Config   oauth2.Config
)

func Init() error {
    issuerURL := os.Getenv("KEYCLOAK_URL") + "realms/" + os.Getenv("KEYCLOAK_REALM")
    provider, err := oidc.NewProvider(context.Background(), issuerURL)
    if err != nil {
        return err
    }
    Provider = provider
    Config = oauth2.Config{
        ClientID:     os.Getenv("KEYCLOAK_CLIENT_ID"),
        ClientSecret: os.Getenv("KEYCLOAK_CLIENT_SECRET"),
        Endpoint:     provider.Endpoint(),
        RedirectURL:  os.Getenv("APP_URL") + "/auth/callback",
        Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
    }
    return nil
}
```

---

After writing all files, display:

```
✓ SSO integration code written
```

---

## Step 7 — Update .env.example / .env.prod

If a `.env.example` or `.env.dist` file exists, add the Keycloak variables with empty values (no credentials):

```
KEYCLOAK_URL=https://keycloak.n10.xyz/
KEYCLOAK_REALM=nsn
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
```

If `.env.prod` exists, add the same variables with the actual credentials (same as `.env`).

---

## Step 8 — Summary

Display:

```
✓ ea-keycloak-sso complete

  Project      : <projectName>
  Framework    : <framework>
  Approach     : <integrationStrategy>
  Keycloak URL : https://keycloak.n10.xyz/
  Realm        : nsn
  Client ID    : <keycloakClientId>

Next steps:
<list 2–3 framework-specific next steps the developer should take, e.g.:
- "Wrap protected routes with keycloak.protect() middleware"
- "Add the /auth/callback route to your router"
- "Run the dev server and test login at your app URL"
>
```

---

## Rules

- **Never** hardcode `keycloakClientId` or `keycloakClientSecret` directly in source files — always reference environment variables.
- **Never** commit credentials to git — always add them to `.env` (which should be in `.gitignore`).
- **Always** read existing files before modifying them — never overwrite user code without reading it first.
- **Always** present the full plan (Step 4) before making any changes.
- **Always** show the `ssoPermissionLink` as a clickable markdown link.
- For SPA projects: do **not** use a client secret — Keycloak public clients do not have one.
- If package installation fails, do not stop — generate the files anyway and tell the user to install manually.
- If any file write fails, show the raw error before continuing.
- If invoked by another skill, resume that skill when this skill finishes — do not stop.
