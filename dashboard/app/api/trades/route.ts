import { NextResponse } from "next/server";
import { getSessionUser, isAuthConfigured } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { buy, sell } from "@/lib/paper-trading";
import {
  getOrCreatePortfolio,
  saveUserPortfolio,
} from "@/lib/portfolio-store";
import type { MarketCoin } from "@/lib/types";

type TradeBody = {
  side?: "buy" | "sell";
  quantity?: number;
  price?: number;
  coin?: Pick<MarketCoin, "id" | "symbol" | "name">;
};

export async function POST(request: Request) {
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

  try {
    const body = (await request.json()) as TradeBody;
    if (!body.side || !body.coin || body.quantity == null || body.price == null) {
      return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
    }

    const portfolio = await getOrCreatePortfolio(user.sub);
    const result =
      body.side === "buy"
        ? buy(portfolio, body.coin, Number(body.quantity), Number(body.price))
        : sell(portfolio, body.coin, Number(body.quantity), Number(body.price));

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await saveUserPortfolio(user.sub, result.portfolio);
    return NextResponse.json(result.portfolio);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to place trade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
