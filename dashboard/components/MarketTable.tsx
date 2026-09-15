import { Sparkline } from "@/components/Sparkline";
import { pct, usd, usdCompact } from "@/lib/format";
import type { MarketCoin } from "@/lib/types";

type MarketTableProps = {
  coins: MarketCoin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MarketTable({ coins, selectedId, onSelect }: MarketTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-200">Markets</h2>
        <p className="text-xs text-zinc-500">Live CoinGecko prices · 7-day sparkline</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-2 font-medium">Asset</th>
              <th className="px-4 py-2 font-medium text-right">Price</th>
              <th className="px-4 py-2 font-medium text-right">24h</th>
              <th className="px-4 py-2 font-medium text-right">Market cap</th>
              <th className="px-4 py-2 font-medium">7d</th>
            </tr>
          </thead>
          <tbody>
            {coins.map((coin) => {
              const change = coin.price_change_percentage_24h ?? 0;
              const up = change >= 0;
              const selected = coin.id === selectedId;

              return (
                <tr
                  key={coin.id}
                  onClick={() => onSelect(coin.id)}
                  className={`cursor-pointer border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/50 ${
                    selected ? "bg-zinc-800/80" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coin.image}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full"
                      />
                      <div>
                        <div className="font-medium text-zinc-100">{coin.name}</div>
                        <div className="text-xs uppercase text-zinc-500">
                          {coin.symbol}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-100">
                    {usdCompact(coin.current_price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      up ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {pct(change)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">
                    {usd(coin.market_cap, 0)}
                  </td>
                  <td className="px-4 py-3">
                    <Sparkline data={coin.sparkline_in_7d?.price ?? []} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
