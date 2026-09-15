import { NextResponse } from "next/server";
import { getSessionUser, isAuthConfigured } from "@/lib/auth";

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json({ configured: false, user: null });
  }

  const user = await getSessionUser();
  return NextResponse.json({
    configured: true,
    user: user ? { email: user.email, sub: user.sub } : null,
  });
}
