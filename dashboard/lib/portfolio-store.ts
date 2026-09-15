import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { STARTING_CASH, type Holding, type Portfolio, type Trade } from "@/lib/types";

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export async function getOrCreatePortfolio(userSub: string): Promise<Portfolio> {
  const existing = await query<{ cash: string }>(
    `SELECT cash FROM portfolios WHERE user_sub = $1`,
    [userSub],
  );

  if (existing.rowCount === 0) {
    await query(
      `INSERT INTO portfolios (user_sub, cash) VALUES ($1, $2)`,
      [userSub, STARTING_CASH],
    );
    return { cash: STARTING_CASH, holdings: [], trades: [] };
  }

  const holdingsResult = await query<{
    coin_id: string;
    symbol: string;
    name: string;
    amount: string;
    avg_cost: string;
  }>(
    `SELECT coin_id, symbol, name, amount, avg_cost
     FROM holdings
     WHERE user_sub = $1
     ORDER BY symbol ASC`,
    [userSub],
  );

  const tradesResult = await query<{
    id: string;
    side: "buy" | "sell";
    coin_id: string;
    symbol: string;
    name: string;
    quantity: string;
    price: string;
    total: string;
    created_at: Date;
  }>(
    `SELECT id, side, coin_id, symbol, name, quantity, price, total, created_at
     FROM trades
     WHERE user_sub = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userSub],
  );

  const holdings: Holding[] = holdingsResult.rows.map((row) => ({
    id: row.coin_id,
    symbol: row.symbol,
    name: row.name,
    amount: toNumber(row.amount),
    avgCost: toNumber(row.avg_cost),
  }));

  const trades: Trade[] = tradesResult.rows.map((row) => ({
    id: row.id,
    side: row.side,
    coinId: row.coin_id,
    symbol: row.symbol,
    name: row.name,
    quantity: toNumber(row.quantity),
    price: toNumber(row.price),
    total: toNumber(row.total),
    timestamp: new Date(row.created_at).getTime(),
  }));

  return {
    cash: toNumber(existing.rows[0].cash),
    holdings,
    trades,
  };
}

async function replacePortfolio(
  client: PoolClient,
  userSub: string,
  portfolio: Portfolio,
) {
  await client.query(`DELETE FROM holdings WHERE user_sub = $1`, [userSub]);
  await client.query(`DELETE FROM trades WHERE user_sub = $1`, [userSub]);
  await client.query(
    `INSERT INTO portfolios (user_sub, cash, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_sub)
     DO UPDATE SET cash = EXCLUDED.cash, updated_at = NOW()`,
    [userSub, portfolio.cash],
  );

  for (const holding of portfolio.holdings) {
    await client.query(
      `INSERT INTO holdings (user_sub, coin_id, symbol, name, amount, avg_cost)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userSub,
        holding.id,
        holding.symbol,
        holding.name,
        holding.amount,
        holding.avgCost,
      ],
    );
  }

  for (const trade of portfolio.trades) {
    await client.query(
      `INSERT INTO trades (
         id, user_sub, side, coin_id, symbol, name, quantity, price, total, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10 / 1000.0))`,
      [
        trade.id,
        userSub,
        trade.side,
        trade.coinId,
        trade.symbol,
        trade.name,
        trade.quantity,
        trade.price,
        trade.total,
        trade.timestamp,
      ],
    );
  }
}

export async function saveUserPortfolio(
  userSub: string,
  portfolio: Portfolio,
): Promise<void> {
  await withTransaction(async (client) => {
    await replacePortfolio(client, userSub, portfolio);
  });
}

export async function resetUserPortfolio(userSub: string): Promise<Portfolio> {
  const empty = {
    cash: STARTING_CASH,
    holdings: [] as Holding[],
    trades: [] as Trade[],
  };
  await saveUserPortfolio(userSub, empty);
  return empty;
}
