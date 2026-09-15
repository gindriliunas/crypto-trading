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

Optional: copy `.env.example` to `.env.local` and set Cognito + `DATABASE_URL` (RDS is private — local access needs a tunnel).

## Auth and history

1. Sign up / sign in (Cognito email + password)
2. Buy/sell paper trades — saved per Cognito user in Postgres
3. Sign in later to see the same history / P&L

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

## ECS Express Mode

Root Terraform deploys Cognito, private RDS, ECR, and an **ECS Express Mode** service (managed HTTPS URL + load balancing). App Runner is not used (AWS is stopping new App Runner customers).

After deploy, use Terraform output `dashboard_url`. Requires Fargate vCPU quota > 0 in the region.
