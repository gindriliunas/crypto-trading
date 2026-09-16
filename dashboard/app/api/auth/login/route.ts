import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authCookieOptions,
  isAuthConfigured,
  signIn,
} from "@/lib/auth";
import {
  assertNotLocked,
  clearFailedAttempts,
  lockKeyForEmail,
  recordFailedAttempt,
} from "@/lib/authLockout";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this environment" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const lockKey = lockKeyForEmail(email);
    await assertNotLocked(lockKey);

    try {
      const idToken = await signIn(email, password);
      await clearFailedAttempts(lockKey);
      const response = NextResponse.json({ ok: true });
      response.cookies.set(AUTH_COOKIE, idToken, authCookieOptions(60 * 60 * 24 * 7));
      return response;
    } catch (error) {
      await recordFailedAttempt(lockKey);
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid email or password";
    const status = message.includes("Too many failed") ? 429 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
