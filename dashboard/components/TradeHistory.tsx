import { qty, usd, usdCompact } from "@/lib/format";
import type { Trade } from "@/lib/types";

type TradeHistoryProps = {
  trades: Trade[];
};

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-200">Trade history</h2>
        <p className="text-xs text-zinc-500">Newest first · stored in this browser</p>
      </div>

      {trades.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No simulated trades yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2 font-medium">Asset</th>
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 20).map((trade) => (
                <tr key={trade.id} className="border-b border-zinc-800/80 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {new Date(trade.timestamp).toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-xs font-semibold uppercase ${
                      trade.side === "buy" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {trade.side}
                  </td>
                  <td className="px-4 py-3 text-zinc-100">{trade.symbol}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    {qty(trade.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    {usdCompact(trade.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-100">
                    {usd(trade.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
