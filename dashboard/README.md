# Crypto paper-trading dashboard

Next.js app with live CoinGecko prices and simulated buy/sell trades.

- **Signed in (Cognito):** portfolio and trade history are stored per user in **RDS Postgres**
- **Guest / local without Cognito:** trades stay in browser `localStorage`

No exchange API keys and no real orders.

## Local

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000

Optional: copy `.env.example` to `.env.local` and set Cognito + `DATABASE_URL` (RDS is private — local access needs a tunnel or temporary path).

## Auth and history

1. Sign up / sign in on the dashboard (Cognito email + password)
2. Buy/sell paper trades — saved against your Cognito user id in Postgres
3. Sign in later (any browser) to see the same cash, holdings, and trade history / P&L

## Docker

```bash
docker build -t crypto-dashboard .
docker run --rm -p 3000:3000 \
  -e COGNITO_USER_POOL_ID=... \
  -e COGNITO_CLIENT_ID=... \
  -e DATABASE_URL=... \
  -e AWS_REGION=eu-west-2 \
  crypto-dashboard
```

## App Runner

Root Terraform deploys Cognito, private RDS, NAT, Secrets Manager, ECR, and an **App Runner** service (VPC connector for RDS). The service gets Cognito env vars, `DATABASE_URL`, and `AUTH_COOKIE_SECURE=true` (HTTPS).

After deploy, use Terraform output `dashboard_url` (`https://…awsapprunner.com`).
