import { NextResponse } from "next/server";
import {
  changePassword,
  getSessionUser,
  isAuthConfigured,
} from "@/lib/auth";
import { clearFailedAttempts, lockKeyForEmail } from "@/lib/authLockout";
import { validatePassword } from "@/lib/passwordPolicy";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this environment" },
      { status: 503 },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await changePassword(user.sub, currentPassword, newPassword);
    await clearFailedAttempts(lockKeyForEmail(user.email));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to change password";
    const status = message.includes("incorrect") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
