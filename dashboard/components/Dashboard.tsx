"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { MarketTable } from "@/components/MarketTable";
import { Portfolio } from "@/components/Portfolio";
import { TradeHistory } from "@/components/TradeHistory";
import { TradePanel } from "@/components/TradePanel";
import { pct, timeAgo, usd } from "@/lib/format";
import {
  buy,
  emptyPortfolio,
  getPortfolioSnapshot,
  getServerPortfolioSnapshot,
  portfolioStats,
  savePortfolio,
  sell,
  subscribePortfolio,
} from "@/lib/paper-trading";
import type { MarketCoin, Portfolio as PortfolioState } from "@/lib/types";

type AuthState = {
  configured: boolean;
  email: string | null;
};

export function Dashboard() {
  const [markets, setMarkets] = useState<MarketCoin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const localPortfolio = useSyncExternalStore(
    subscribePortfolio,
    getPortfolioSnapshot,
    getServerPortfolioSnapshot,
  );
  const [remotePortfolio, setRemotePortfolio] = useState<PortfolioState | null>(
    null,
  );
  const [auth, setAuth] = useState<AuthState>({
    configured: false,
    email: null,
  });
  const [quantity, setQuantity] = useState("");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busyTrade, setBusyTrade] = useState(false);

  const signedIn = Boolean(auth.email);
  const portfolio = signedIn ? (remotePortfolio ?? emptyPortfolio()) : localPortfolio;

  const refreshAuth = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const payload = (await response.json()) as {
      configured?: boolean;
      user?: { email?: string } | null;
    };
    const next: AuthState = {
      configured: Boolean(payload.configured),
      email: payload.user?.email ?? null,
    };
    setAuth(next);

    if (next.email) {
      const portfolioResponse = await fetch("/api/portfolio");
      if (portfolioResponse.ok) {
        setRemotePortfolio((await portfolioResponse.json()) as PortfolioState);
      } else {
        setRemotePortfolio(emptyPortfolio());
      }
    } else {
      setRemotePortfolio(null);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/markets");
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load market data");
        }
        setMarkets(payload as MarketCoin[]);
        setLastUpdated(new Date());
        setLoadError(null);
        setSelectedId((current) => current ?? payload[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load market data",
          );
        }
      }
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const prices = useMemo(
    () =>
      Object.fromEntries(markets.map((coin) => [coin.id, coin.current_price])) as Record<
        string,
        number
      >,
    [markets],
  );

  const selected = markets.find((coin) => coin.id === selectedId) ?? null;
  const heldAmount = selected
    ? (portfolio.holdings.find((holding) => holding.id === selected.id)?.amount ?? 0)
    : 0;
  const stats = portfolioStats(portfolio, prices);
  const up = stats.pnl >= 0;

  async function applyTrade(side: "buy" | "sell") {
    if (!selected) return;

    if (signedIn) {
      setBusyTrade(true);
      setTradeError(null);
      try {
        const response = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side,
            quantity: Number(quantity),
            price: selected.current_price,
            coin: {
              id: selected.id,
              symbol: selected.symbol,
              name: selected.name,
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Trade failed");
        }
        setRemotePortfolio(payload as PortfolioState);
        setQuantity("");
      } catch (error) {
        setTradeError(error instanceof Error ? error.message : "Trade failed");
      } finally {
        setBusyTrade(false);
      }
      return;
    }

    const result =
      side === "buy"
        ? buy(portfolio, selected, Number(quantity), selected.current_price)
        : sell(portfolio, selected, Number(quantity), selected.current_price);

    if (!result.ok) {
      setTradeError(result.error);
      return;
    }

    savePortfolio(result.portfolio);
    setTradeError(null);
    setQuantity("");
  }

  async function resetPortfolio() {
    if (!window.confirm("Reset paper portfolio to $10,000 and clear trades?")) return;

    if (signedIn) {
      const response = await fetch("/api/portfolio/reset", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setTradeError(payload.error ?? "Reset failed");
        return;
      }
      setRemotePortfolio(payload as PortfolioState);
      setTradeError(null);
      setQuantity("");
      return;
    }

    savePortfolio(emptyPortfolio());
    setTradeError(null);
    setQuantity("");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <AuthPanel
        configured={auth.configured}
        email={auth.email}
        onAuthChange={() => {
          void refreshAuth();
        }}
      />

      <header className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Paper trading</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Crypto dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {lastUpdated
              ? `Prices updated ${timeAgo(lastUpdated)} · refreshes every 30s`
              : "Loading live prices…"}
            {signedIn
              ? " · account history in RDS"
              : " · guest mode uses this browser only"}
          </p>
          {loadError ? <p className="mt-1 text-sm text-rose-400">{loadError}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Portfolio" value={usd(stats.total)} />
          <Stat label="Cash" value={usd(stats.cash)} />
          <Stat
            label="Unrealized P&L"
            value={`${usd(stats.pnl)} (${pct(stats.pnlPercent)})`}
            tone={up ? "up" : "down"}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <MarketTable coins={markets} selectedId={selectedId} onSelect={setSelectedId} />
        <TradePanel
          coin={selected}
          cash={portfolio.cash}
          heldAmount={heldAmount}
          quantity={quantity}
          error={tradeError}
          onQuantityChange={(value) => {
            setQuantity(value);
            setTradeError(null);
          }}
          onBuy={() => {
            void applyTrade("buy");
          }}
          onSell={() => {
            void applyTrade("sell");
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Portfolio
          holdings={portfolio.holdings}
          prices={prices}
          onReset={() => {
            void resetPortfolio();
          }}
        />
        <TradeHistory trades={portfolio.trades} />
      </div>

      {busyTrade ? (
        <p className="text-center text-xs text-zinc-500">Saving trade…</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  const color =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-zinc-100";

  return (
    <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${color}`}>{value}</div>
    </div>
  );
}
