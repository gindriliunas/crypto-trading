import { NextResponse } from "next/server";
import { AUTH_COOKIE, authCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", { ...authCookieOptions(0), maxAge: 0 });
  return response;
}
