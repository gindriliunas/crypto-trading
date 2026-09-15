export type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap: number;
  sparkline_in_7d?: { price: number[] };
};

export type Holding = {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  avgCost: number;
};

export type Trade = {
  id: string;
  side: "buy" | "sell";
  coinId: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
};

export type Portfolio = {
  cash: number;
  holdings: Holding[];
  trades: Trade[];
};

export type TradeResult =
  | { ok: true; portfolio: Portfolio }
  | { ok: false; error: string };

export const STARTING_CASH = 10_000;
export const STORAGE_KEY = "paper-portfolio";

export const WATCHLIST_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "ripple",
  "cardano",
  "dogecoin",
  "polkadot",
  "chainlink",
] as const;
