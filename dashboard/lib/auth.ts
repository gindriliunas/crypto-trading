import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, isDatabaseConfigured } from "@/lib/db";

export const AUTH_COOKIE = "paper_id_token";

export type AuthUser = {
  sub: string;
  email: string;
};

function jwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET) && isDatabaseConfigured();
}

export async function ensureUsersTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function signUp(email: string, password: string) {
  await ensureUsersTable();
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new Error("An account with this email already exists");
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
    [id, email, passwordHash],
  );
}

export async function signIn(email: string, password: string) {
  await ensureUsersTable();
  const result = await query<{ id: string; email: string; password_hash: string }>(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error("Invalid email or password");
  }

  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifyIdToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!sub || !email) {
    throw new Error("Token missing user claims");
  }
  return { sub, email };
}

export async function getSessionUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;

  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
