# Dashboard

Next.js paper-trading UI. Auth is JWT + bcrypt against Azure Postgres.

- **Signed in:** portfolio and trade history stored per user in Postgres  
- **Guest / no auth env:** trades stay in browser `localStorage`

## Local development

```bash
npm install
npm run dev
```

Optional: copy `.env.example` to `.env.local`:

```bash
JWT_SECRET=dev-only-long-random-string
DATABASE_URL=postgresql://user:pass@host:5432/papertrading?sslmode=require
AUTH_COOKIE_SECURE=false
ALLOW_PUBLIC_SIGNUP=true
# or: SIGNUP_INVITE_CODE=your-invite
```

## Auth flow (brief)

1. Sign up (invite code required in Azure) or sign in with email/password  
2. Server verifies password (bcrypt), issues a JWT in httpOnly cookie `paper_id_token`  
3. Buy/sell paper trades — saved per user id in Postgres  

## Docker

```bash
docker build -t crypto-trading-dashboard .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=... \
  -e DATABASE_URL=postgresql://... \
  -e AUTH_COOKIE_SECURE=false \
  -e SIGNUP_INVITE_CODE=... \
  crypto-trading-dashboard
```

## Azure deploy

Infra and image deploy live under `../azure/` and `.github/workflows/Azure Deploy.yml`. After apply, use `terraform output dashboard_url` or https://dev.gindri.com.
