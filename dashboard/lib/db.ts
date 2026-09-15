import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __paperTradingPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __paperTradingSchemaReady: Promise<void> | undefined;
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalThis.__paperTradingPool) {
    globalThis.__paperTradingPool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
      max: 5,
    });
  }

  return globalThis.__paperTradingPool;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureSchema(): Promise<void> {
  if (!globalThis.__paperTradingSchemaReady) {
    globalThis.__paperTradingSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS portfolios (
          user_sub TEXT PRIMARY KEY,
          cash NUMERIC NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS holdings (
          user_sub TEXT NOT NULL REFERENCES portfolios(user_sub) ON DELETE CASCADE,
          coin_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          name TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          avg_cost NUMERIC NOT NULL,
          PRIMARY KEY (user_sub, coin_id)
        );

        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          user_sub TEXT NOT NULL REFERENCES portfolios(user_sub) ON DELETE CASCADE,
          side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
          coin_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity NUMERIC NOT NULL,
          price NUMERIC NOT NULL,
          total NUMERIC NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS trades_user_created
          ON trades (user_sub, created_at DESC);
      `);
    })();
  }

  await globalThis.__paperTradingSchemaReady;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
