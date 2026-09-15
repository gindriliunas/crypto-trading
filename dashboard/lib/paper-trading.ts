import {
  STARTING_CASH,
  STORAGE_KEY,
  type Holding,
  type MarketCoin,
  type Portfolio,
  type Trade,
  type TradeResult,
} from "./types";

export function emptyPortfolio(): Portfolio {
  return { cash: STARTING_CASH, holdings: [], trades: [] };
}

const EMPTY_PORTFOLIO: Portfolio = emptyPortfolio();

function readStoredPortfolio(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PORTFOLIO;

    const parsed = JSON.parse(raw) as Portfolio;
    if (
      typeof parsed.cash !== "number" ||
      !Array.isArray(parsed.holdings) ||
      !Array.isArray(parsed.trades)
    ) {
      return EMPTY_PORTFOLIO;
    }

    return parsed;
  } catch {
    return EMPTY_PORTFOLIO;
  }
}

let snapshot: Portfolio = EMPTY_PORTFOLIO;
let snapshotLoaded = false;

const listeners = new Set<() => void>();

export function savePortfolio(portfolio: Portfolio): void {
  snapshot = portfolio;
  snapshotLoaded = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  listeners.forEach((listener) => listener());
}

export function subscribePortfolio(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPortfolioSnapshot(): Portfolio {
  if (!snapshotLoaded && typeof window !== "undefined") {
    snapshot = readStoredPortfolio();
    snapshotLoaded = true;
  }
  return snapshot;
}

export function getServerPortfolioSnapshot(): Portfolio {
  return EMPTY_PORTFOLIO;
}

function roundMoney(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function makeTrade(
  side: Trade["side"],
  coin: Pick<MarketCoin, "id" | "symbol" | "name">,
  quantity: number,
  price: number,
): Trade {
  return {
    id: crypto.randomUUID(),
    side,
    coinId: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    quantity,
    price,
    total: roundMoney(quantity * price),
    timestamp: Date.now(),
  };
}

export function buy(
  portfolio: Portfolio,
  coin: Pick<MarketCoin, "id" | "symbol" | "name">,
  quantity: number,
  price: number,
): TradeResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be greater than 0" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Price is unavailable" };
  }

  const total = roundMoney(quantity * price);
  if (total > portfolio.cash + 1e-8) {
    return { ok: false, error: "Not enough cash" };
  }

  const holdings = [...portfolio.holdings];
  const index = holdings.findIndex((holding) => holding.id === coin.id);

  if (index >= 0) {
    const current = holdings[index];
    const amount = current.amount + quantity;
    holdings[index] = {
      ...current,
      amount,
      avgCost: (current.avgCost * current.amount + total) / amount,
    };
  } else {
    holdings.push({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      amount: quantity,
      avgCost: price,
    });
  }

  return {
    ok: true,
    portfolio: {
      cash: roundMoney(portfolio.cash - total),
      holdings,
      trades: [makeTrade("buy", coin, quantity, price), ...portfolio.trades],
    },
  };
}

export function sell(
  portfolio: Portfolio,
  coin: Pick<MarketCoin, "id" | "symbol" | "name">,
  quantity: number,
  price: number,
): TradeResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be greater than 0" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Price is unavailable" };
  }

  const index = portfolio.holdings.findIndex((holding) => holding.id === coin.id);
  if (index < 0) {
    return { ok: false, error: "You do not hold this coin" };
  }

  const current = portfolio.holdings[index];
  if (quantity > current.amount + 1e-8) {
    return { ok: false, error: "Not enough coins to sell" };
  }

  const total = roundMoney(quantity * price);
  const remaining = current.amount - quantity;
  const holdings: Holding[] =
    remaining <= 1e-10
      ? portfolio.holdings.filter((_, i) => i !== index)
      : portfolio.holdings.map((holding, i) =>
          i === index ? { ...holding, amount: remaining } : holding,
        );

  return {
    ok: true,
    portfolio: {
      cash: roundMoney(portfolio.cash + total),
      holdings,
      trades: [makeTrade("sell", coin, quantity, price), ...portfolio.trades],
    },
  };
}

export function portfolioStats(
  portfolio: Portfolio,
  prices: Record<string, number>,
) {
  const holdingsValue = portfolio.holdings.reduce((sum, holding) => {
    return sum + holding.amount * (prices[holding.id] ?? 0);
  }, 0);
  const cost = portfolio.holdings.reduce(
    (sum, holding) => sum + holding.amount * holding.avgCost,
    0,
  );

  return {
    cash: portfolio.cash,
    holdingsValue,
    total: portfolio.cash + holdingsValue,
    cost,
    pnl: holdingsValue - cost,
    pnlPercent: cost > 0 ? ((holdingsValue - cost) / cost) * 100 : 0,
  };
}
