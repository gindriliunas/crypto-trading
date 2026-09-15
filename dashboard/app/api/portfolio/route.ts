import { NextResponse } from "next/server";
import { getSessionUser, isAuthConfigured } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { getOrCreatePortfolio } from "@/lib/portfolio-store";

export async function GET() {
  if (!isAuthConfigured() || !isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Server portfolio storage is not configured" },
      { status: 503 },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolio = await getOrCreatePortfolio(user.sub);
  return NextResponse.json(portfolio);
}
