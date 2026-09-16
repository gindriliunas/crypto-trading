# High-level design and data flows

Paper-trading dashboard: Next.js app with JWT auth, Postgres history, and CoinGecko market prices. Deployed on Azure Container Apps via Terraform and GitHub Actions.

**Live (dev):** [https://dev.gindri.com](https://dev.gindri.com)

Related: [README](../README.md) · [Cyber Essentials](./cyber-essentials.md) · [ISO 27001](./ISO27001.md) · [Firewall rules](../azure/FIREWALL_RULES.md)

---

## 1. System context

```mermaid
flowchart LR
  User[Browser]
  DNS[GoDaddy DNS<br/>dev.gindri.com]
  App[Azure Container Apps<br/>Next.js dashboard]
  DB[(Azure PostgreSQL<br/>papertrading)]
  CG[CoinGecko API]
  GH[GitHub Actions]
  ACR[Azure Container Registry]
  TF[Azure Blob<br/>Terraform state]

  User -->|HTTPS| DNS
  DNS --> App
  App -->|JWT cookie + SQL| DB
  App -->|prices, 30s cache| CG
  GH -->|build + push| ACR
  ACR -->|image pull| App
  GH -->|terraform apply| TF
```

| Actor / system | Role |
|----------------|------|
| Browser | UI, `httpOnly` JWT cookie `paper_id_token` |
| Next.js dashboard | Pages, API routes, paper-trade engine |
| Azure PostgreSQL 16 | Users, cash, holdings, trades |
| CoinGecko | Watchlist prices (server-side fetch) |
| GitHub Actions | Security scans, Terraform, image build/push |
| ACR | Dashboard container image |
| Log Analytics | Container Apps logs (30-day retention) |

---

## 2. Azure architecture (per environment)

Environments: `dev` (auto on merge to `main`), `staging` and `production` (manual workflow). Each env is an isolated resource group `crypto-trading-<env>` in `uksouth`.

```mermaid
flowchart TB
  subgraph Azure["Resource group crypto-trading-{env}"]
    CAE[Container Apps Environment]
    CA[Container App<br/>dashboard :3000]
    ACR[ACR Basic]
    PG[PostgreSQL Flexible Server<br/>B_Standard_B1ms]
    PDB[(papertrading)]
    LAW[Log Analytics]
    CAE --> CA
    CAE --> LAW
    ACR -->|pull image| CA
    CA -->|sslmode=require| PG
    PG --> PDB
  end

  Internet((Internet HTTPS)) --> CA
  AzureServices[AllowAzureServices<br/>0.0.0.0] --> PG
```

| Resource | Name pattern | Notes |
|----------|--------------|-------|
| Resource group | `crypto-trading-{env}` | All app resources |
| Container App | `crypto-trading-{env}-app` | 1–2 replicas, 0.25 vCPU / 0.5Gi, non-root |
| Container Apps Environment | `crypto-trading-{env}-cae` | Ingress on port 3000 |
| ACR | `cryptotrading{env}acr` | Image `{name}:{git-sha}` |
| Postgres | `crypto-trading-{env}-pg` | Admin `paperadmin`; DB `papertrading` |
| Log Analytics | `crypto-trading-{env}-logs` | 30-day retention |
| Key Vault | `cryptotrading{env}kv` | `database-url`, `jwt-secret`, `signup-invite-code` |
| Managed identity | `crypto-trading-{env}-uai` | Key Vault Secrets User for Container App |

**Secrets** (Azure Key Vault → Container Apps secret references via user-assigned managed identity):

| Secret | Source | Injected as |
|--------|--------|-------------|
| `database-url` | Terraform `random_password.db` → Key Vault | `DATABASE_URL` |
| `jwt-secret` | Terraform `random_password.jwt` → Key Vault | `JWT_SECRET` |
| `signup-invite-code` | Terraform `random_password.signup_invite` → Key Vault | `SIGNUP_INVITE_CODE` |
| `acr-password` | ACR admin password (CA secret value) | registry pull |

Other env: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `AUTH_COOKIE_SECURE=true`.

---

## 3. Application layers

```mermaid
flowchart TB
  subgraph Client["Browser"]
    UI[Dashboard / AuthPanel / MarketTable<br/>Portfolio / TradePanel / TradeHistory]
    LS[localStorage paper-portfolio<br/>guest fallback]
  end

  subgraph Next["Next.js Container App"]
    Pages[app/page.tsx]
    API[Route handlers]
    Auth[lib/auth.ts<br/>JWT HS256 + bcrypt]
    Engine[lib/paper-trading.ts<br/>buy / sell / stats]
    Store[lib/portfolio-store.ts]
    Pool[lib/db.ts<br/>pg Pool max 5]
  end

  subgraph Data["Persistence"]
    PG[(PostgreSQL)]
  end

  subgraph External["External"]
    CG[CoinGecko]
  end

  UI --> Pages
  UI -->|fetch JSON| API
  UI -.->|unsigned guest| LS
  API --> Auth
  API --> Engine
  API --> Store
  API -->|GET /api/markets| CG
  Auth --> Pool
  Store --> Pool
  Pool --> PG
```

### API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Liveness `{ ok: true }` |
| GET | `/api/markets` | No | CoinGecko watchlist, 30s revalidate |
| GET | `/api/auth/me` | Cookie | Session user or `{ configured, user: null }` |
| POST | `/api/auth/signup` | No | Create user (password ≥ 12; invite when configured) |
| POST | `/api/auth/login` | No | Set JWT cookie, 7-day maxAge; lockout after failures |
| POST | `/api/auth/logout` | Cookie | Clear cookie |
| GET | `/api/portfolio` | Yes | Load or create portfolio (`$10,000` start) |
| POST | `/api/trades` | Yes | Buy/sell; persist in a transaction |
| POST | `/api/portfolio/reset` | Yes | Wipe holdings/trades, restore cash |

Watchlist IDs: bitcoin, ethereum, solana, ripple, cardano, dogecoin, polkadot, chainlink.

---

## 4. Data model

```mermaid
erDiagram
  users {
    text id PK
    text email UK
    text password_hash
    timestamptz created_at
    timestamptz disabled_at
  }
  portfolios {
    text user_sub PK
    numeric cash
    timestamptz updated_at
  }
  holdings {
    text user_sub PK_FK
    text coin_id PK
    text symbol
    text name
    numeric amount
    numeric avg_cost
  }
  trades {
    text id PK
    text user_sub FK
    text side
    text coin_id
    text symbol
    text name
    numeric quantity
    numeric price
    numeric total
    timestamptz created_at
  }
  users ||--o| portfolios : "id = user_sub"
  portfolios ||--o{ holdings : has
  portfolios ||--o{ trades : has
```

Schema is created on first query (`CREATE TABLE IF NOT EXISTS`). `holdings` and `trades` cascade-delete with the portfolio. Index: `trades_user_created (user_sub, created_at DESC)`. Trade history API returns the latest 100 rows.

JWT payload: `{ sub: user.id, email }`, algorithm HS256, expiry 7 days. Cookie: `paper_id_token`, `httpOnly`, `sameSite=lax`, `secure` when `AUTH_COOKIE_SECURE=true`.

---

## 5. Data flows

### 5.1 Sign up

```mermaid
sequenceDiagram
  actor User
  participant UI as AuthPanel
  participant API as POST /api/auth/signup
  participant Auth as lib/auth
  participant DB as PostgreSQL

  User->>UI: email + password (+ invite if required)
  UI->>API: JSON body
  API->>API: trim/lower email; password ≥ 12 + complexity
  API->>Auth: signUp(email, password, inviteCode)
  Auth->>Auth: validate invite when SIGNUP_INVITE_CODE set
  Auth->>DB: ensure users table
  Auth->>DB: SELECT id WHERE email
  alt email exists
    DB-->>UI: 400 already exists
  else new user
    Auth->>Auth: bcrypt.hash(password, 10)
    Auth->>DB: INSERT users (uuid, email, hash)
    API-->>UI: 200 { ok: true }
    UI->>UI: POST /api/auth/login (auto-login)
  end
```

### 5.2 Login and session

```mermaid
sequenceDiagram
  actor User
  participant UI as AuthPanel / Dashboard
  participant Login as POST /api/auth/login
  participant Me as GET /api/auth/me
  participant Auth as lib/auth
  participant DB as PostgreSQL

  User->>UI: email + password
  UI->>Login: JSON body
  Login->>Auth: signIn(email, password)
  Auth->>DB: SELECT user by email (reject if disabled_at set)
  Auth->>Auth: bcrypt.compare; record lockout on failure
  alt invalid or locked
    Login-->>UI: 401 / 429
  else valid
    Auth->>Auth: SignJWT HS256, exp 7d
    Login-->>UI: Set-Cookie paper_id_token
  end

  UI->>Me: cookie
  Me->>Auth: verifyIdToken
  Me-->>UI: { configured, user: { email, sub } }
```

Logout: `POST /api/auth/logout` sets the cookie `maxAge=0`.

### 5.3 Market data

```mermaid
sequenceDiagram
  participant UI as Dashboard
  participant API as GET /api/markets
  participant CG as CoinGecko

  loop every ~30s (and on load)
    UI->>API: fetch /api/markets
    API->>CG: coins/markets?vs_currency=usd&ids=...
    Note over API: next.revalidate = 30
    CG-->>API: prices, 24h change, sparkline
    API-->>UI: JSON + Cache-Control s-maxage=30
    UI->>UI: mark-to-market holdings / PnL
  end
```

The browser never calls CoinGecko directly. Failures return `502`.

### 5.4 Load portfolio

```mermaid
flowchart TD
  A[Dashboard mount] --> B[GET /api/auth/me]
  B --> C{JWT valid?}
  C -->|no / guest| D[localStorage paper-portfolio<br/>or empty $10,000]
  C -->|yes| E[GET /api/portfolio]
  E --> F{row in portfolios?}
  F -->|no| G[INSERT cash = 10000]
  F -->|yes| H[SELECT holdings + last 100 trades]
  G --> I[JSON Portfolio]
  H --> I
  I --> J[Render cash, holdings, history]
```

### 5.5 Place a trade (buy / sell)

```mermaid
sequenceDiagram
  actor User
  participant UI as TradePanel
  participant API as POST /api/trades
  participant Auth as getSessionUser
  participant Store as portfolio-store
  participant Engine as paper-trading
  participant DB as PostgreSQL

  User->>UI: side, coin, quantity
  UI->>API: { side, coin, quantity, price }
  API->>Auth: cookie JWT
  alt no session
    API-->>UI: 401
  else authenticated
    API->>Store: getOrCreatePortfolio(sub)
    Store->>DB: SELECT cash / holdings / trades
    API->>Engine: buy() or sell()
    alt validation fail
      Engine-->>UI: 400 e.g. not enough cash
    else ok
      API->>Store: saveUserPortfolio in transaction
      Store->>DB: DELETE holdings+trades; UPSERT cash; INSERT rows
      API-->>UI: updated Portfolio JSON
      UI->>UI: refresh stats from live prices
    end
  end
```

Engine rules (`lib/paper-trading.ts`):

| Side | Checks | Effect |
|------|--------|--------|
| Buy | quantity > 0, price > 0, cash ≥ total | Debit cash; add/average holding; prepend trade |
| Sell | holding exists, quantity ≤ amount | Credit cash; reduce/remove holding; prepend trade |

Totals rounded to 8 decimal places. Average cost on buy: `(avgCost × amount + total) / newAmount`.

### 5.6 Reset portfolio

```mermaid
flowchart LR
  U[User] --> R[POST /api/portfolio/reset]
  R --> A{JWT?}
  A -->|no| X[401]
  A -->|yes| T[Transaction]
  T --> W[Replace with cash=10000,<br/>empty holdings and trades]
  W --> J[Return empty Portfolio]
```

### 5.7 Guest vs signed-in storage

```mermaid
flowchart LR
  subgraph Guest["No session"]
    G1[Trade in browser]
    G2[localStorage key paper-portfolio]
    G1 --> G2
  end

  subgraph SignedIn["JWT session"]
    S1[Trade via /api/trades]
    S2[(Postgres per user_sub)]
    S1 --> S2
  end

  Note1[Server storage unavailable → 503<br/>UI can still use local snapshot]
```

---

## 6. Request path in Azure

```mermaid
flowchart LR
  U[Browser] -->|TLS 1.2+| CDN[Container Apps<br/>managed cert / custom domain]
  CDN --> Ing[Ingress :443 → :3000]
  Ing --> Node[node server.js<br/>user nextjs uid 1001]
  Node -->|env DATABASE_URL| PG[(Postgres :5432 SSL)]
  Node -->|HTTPS| CG[api.coingecko.com]
```

Health: `GET /api/health` for platform probes. Postgres firewall: Azure services (`0.0.0.0`–`0.0.0.0`) plus optional CIDR — see [FIREWALL_RULES.md](../azure/FIREWALL_RULES.md).

---

## 7. CI/CD and image flow

```mermaid
flowchart LR
  feature[Feature branch] --> pr[PR to main]
  pr --> sec[Security Scans]
  pr --> plan[terraform plan vs dev]
  sec --> gate[Gate]
  plan --> gate
  gate -->|merge| push[Push main]
  push --> apply[terraform apply dev]
  apply --> build[docker build dashboard]
  build --> trivy[Trivy image]
  trivy -->|pass| acr[Push ACR :sha]
  acr --> ca[Update Container App]
  ca --> zap[OWASP ZAP DAST]
  zap --> promote[workflow_dispatch]
  promote --> stg[staging]
  stg --> prod[production]
```

Security Scans (every PR and push to `main`): Gitleaks + Trivy secrets, Trivy SCA, CodeQL (SAST), Trivy + Checkov + tfsec (IaC), Trivy container. OWASP ZAP also runs in Security Scans (soft on PR/push). **Blocking DAST** is `DAST after deploy (OWASP ZAP)` in Azure Deploy against `https://dev.gindri.com` after health checks. Deploy re-scans the image before ACR push. Secrets for the app come from Key Vault via managed identity.

---

## 8. Trust and trust boundaries

```mermaid
flowchart TB
  subgraph Public["Untrusted"]
    Browser
    CoinGecko
  end

  subgraph Edge["TLS boundary"]
    Ingress[Container Apps ingress]
  end

  subgraph App["Trusted compute"]
    Next[Next.js process]
    Secrets[Key Vault refs via MI:<br/>DATABASE_URL, JWT_SECRET]
  end

  subgraph Data["Trusted data"]
    PG[(Postgres)]
  end

  Browser -->|cookie + JSON| Ingress
  Ingress --> Next
  Secrets --> Next
  Next -->|parameterized SQL| PG
  Next -->|read-only prices| CoinGecko
```

- Passwords ≥ 12 with complexity checks; bcrypt (cost 10); JWT never includes the hash. Optional invite-gated signup; `users.disabled_at` for operator disable; login lockout after repeated failures.
- SQL via parameterized `pg` queries; schema bootstrap is static DDL.
- Runtime image: Alpine patched, npm/yarn/corepack removed, non-root `nextjs`.
- No live exchange orders; cash and fills are simulated only.
