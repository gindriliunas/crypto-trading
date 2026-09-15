import { pct, qty, usd, usdCompact } from "@/lib/format";
import type { Holding } from "@/lib/types";

type PortfolioProps = {
  holdings: Holding[];
  prices: Record<string, number>;
  onReset: () => void;
};

export function Portfolio({ holdings, prices, onReset }: PortfolioProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Holdings</h2>
          <p className="text-xs text-zinc-500">Marked to live prices vs average cost</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>

      {holdings.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No open positions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2 font-medium">Asset</th>
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Avg cost</th>
                <th className="px-4 py-2 font-medium text-right">Value</th>
                <th className="px-4 py-2 font-medium text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => {
                const price = prices[holding.id] ?? 0;
                const value = holding.amount * price;
                const cost = holding.amount * holding.avgCost;
                const pnl = value - cost;
                const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                const up = pnl >= 0;

                return (
                  <tr key={holding.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{holding.name}</div>
                      <div className="text-xs uppercase text-zinc-500">{holding.symbol}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">
                      {qty(holding.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">
                      {usdCompact(holding.avgCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-100">
                      {usd(value)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        up ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {usd(pnl)} ({pct(pnlPercent)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
