import { NextResponse } from "next/server";
import {
  isAuthConfigured,
  isPasswordResetEnabled,
  resetPassword,
  signupInviteConfigured,
} from "@/lib/auth";
import { clearFailedAttempts, lockKeyForEmail } from "@/lib/authLockout";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/passwordPolicy";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this environment" },
      { status: 503 },
    );
  }

  if (!isPasswordResetEnabled()) {
    return NextResponse.json(
      {
        error:
          "Password reset requires SIGNUP_INVITE_CODE (operator-approved recovery)",
      },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      inviteCode?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const inviteCode = body.inviteCode;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and new password are required" },
        { status: 400 },
      );
    }

    if (signupInviteConfigured() && !inviteCode?.trim()) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 },
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await resetPassword(email, password, inviteCode);
    await clearFailedAttempts(lockKeyForEmail(email));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset password";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    resetEnabled: isPasswordResetEnabled(),
    inviteRequired: signupInviteConfigured(),
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });
}
