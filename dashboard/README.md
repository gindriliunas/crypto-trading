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

Optional: copy `.env.example` to `.env.local` and set Cognito + `DATABASE_URL` to exercise account history locally (RDS must be reachable from your machine; the Terraform RDS instance is private to the VPC by default).

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

## ECS (Fargate)

Root Terraform deploys Cognito, RDS (private subnets), Secrets Manager (`DATABASE_URL`), and one Fargate task behind an HTTP ALB. The task receives Cognito env vars and the DB secret automatically.

After deploy, use Terraform output `dashboard_url`.
