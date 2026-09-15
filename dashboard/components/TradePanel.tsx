import { usd, usdCompact } from "@/lib/format";
import type { MarketCoin } from "@/lib/types";

type TradePanelProps = {
  coin: MarketCoin | null;
  cash: number;
  heldAmount: number;
  quantity: string;
  error: string | null;
  onQuantityChange: (value: string) => void;
  onBuy: () => void;
  onSell: () => void;
};

export function TradePanel({
  coin,
  cash,
  heldAmount,
  quantity,
  error,
  onQuantityChange,
  onBuy,
  onSell,
}: TradePanelProps) {
  const qty = Number(quantity);
  const estimate =
    coin && Number.isFinite(qty) && qty > 0 ? qty * coin.current_price : 0;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Paper trade</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Simulated fills at the live CoinGecko price. No real orders are sent.
      </p>

      {!coin ? (
        <p className="mt-6 text-sm text-zinc-400">Select a coin from the market table.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coin.image} alt="" className="h-6 w-6 rounded-full" />
              <span className="font-medium text-zinc-100">{coin.name}</span>
            </div>
            <span className="font-mono text-sm text-zinc-200">
              {usdCompact(coin.current_price)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400">
            <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
              Cash
              <div className="mt-1 font-mono text-sm text-zinc-100">{usd(cash)}</div>
            </div>
            <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
              Held
              <div className="mt-1 font-mono text-sm text-zinc-100">
                {heldAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })}{" "}
                {coin.symbol.toUpperCase()}
              </div>
            </div>
          </div>

          <label className="block text-xs text-zinc-400">
            Quantity
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-cyan-500"
              placeholder="0.00"
            />
          </label>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Estimated total</span>
            <span className="font-mono text-zinc-100">{usd(estimate)}</span>
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onBuy}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              Buy
            </button>
            <button
              type="button"
              onClick={onSell}
              className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-rose-400"
            >
              Sell
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
