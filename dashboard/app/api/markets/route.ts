import { NextResponse } from "next/server";
import { WATCHLIST_IDS } from "@/lib/types";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?" +
  new URLSearchParams({
    vs_currency: "usd",
    ids: WATCHLIST_IDS.join(","),
    order: "market_cap_desc",
    sparkline: "true",
    price_change_percentage: "24h",
  }).toString();

export async function GET() {
  try {
    const response = await fetch(COINGECKO_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "crypto-trading-dashboard/1.0",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch market data from CoinGecko" },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach CoinGecko" },
      { status: 502 },
    );
  }
}
