import { NextResponse } from "next/server";
import {
  isAuthConfigured,
  isPublicSignupAllowed,
  signUp,
  signupInviteConfigured,
} from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/passwordPolicy";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this environment" },
      { status: 503 },
    );
  }

  if (!isPublicSignupAllowed()) {
    return NextResponse.json(
      { error: "Public signup is disabled on this environment" },
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
        { error: "Email and password are required" },
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

    await signUp(email, password, inviteCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    signupEnabled: isPublicSignupAllowed(),
    inviteRequired: signupInviteConfigured(),
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });
}
