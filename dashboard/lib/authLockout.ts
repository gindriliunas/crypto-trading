import { query } from "@/lib/db";

/** Cyber Essentials: lock after no more than 10 unsuccessful attempts. */
export const MAX_FAILED_ATTEMPTS = 10;
/** Lock window in minutes after hitting the failure threshold. */
export const LOCKOUT_MINUTES = 15;

async function ensureLockoutTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_lockouts (
      lock_key TEXT PRIMARY KEY,
      failures INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function assertNotLocked(lockKey: string): Promise<void> {
  await ensureLockoutTable();
  const result = await query<{ failures: number; locked_until: Date | null }>(
    `SELECT failures, locked_until FROM auth_lockouts WHERE lock_key = $1`,
    [lockKey],
  );
  const row = result.rows[0];
  if (!row?.locked_until) return;

  const until = new Date(row.locked_until).getTime();
  if (until > Date.now()) {
    const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    throw new Error(`Too many failed attempts. Try again in ${mins} minute(s)`);
  }
}

export async function recordFailedAttempt(lockKey: string): Promise<void> {
  await ensureLockoutTable();
  const current = await query<{ failures: number; locked_until: Date | null }>(
    `SELECT failures, locked_until FROM auth_lockouts WHERE lock_key = $1`,
    [lockKey],
  );
  const row = current.rows[0];
  const stillLocked =
    row?.locked_until && new Date(row.locked_until).getTime() > Date.now();
  if (stillLocked) return;

  const resetAfterLock =
    row?.locked_until && new Date(row.locked_until).getTime() <= Date.now();
  const failures = resetAfterLock || !row ? 1 : row.failures + 1;
  const lockedUntil =
    failures >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      : null;

  await query(
    `
    INSERT INTO auth_lockouts (lock_key, failures, locked_until, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (lock_key) DO UPDATE SET
      failures = EXCLUDED.failures,
      locked_until = EXCLUDED.locked_until,
      updated_at = NOW()
    `,
    [lockKey, failures, lockedUntil],
  );
}

export async function clearFailedAttempts(lockKey: string): Promise<void> {
  await ensureLockoutTable();
  await query(`DELETE FROM auth_lockouts WHERE lock_key = $1`, [lockKey]);
}

export function lockKeyForEmail(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}
