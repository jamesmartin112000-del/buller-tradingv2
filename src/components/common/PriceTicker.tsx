import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { PAIRS_LIST } from '../../lib/engine/pairs';
import { fmtPrice } from '../../lib/engine/format';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
export function PriceTicker() {
  const eng = useEngine();
  const items = PAIRS_LIST.filter((p) => eng.pairs[p.id]?.price.mid > 0).slice(
    0,
    16
  );
  return (
    <div className="overflow-hidden bg-bg-800 border-y border-line">
      <div className="flex animate-[scroll_60s_linear_infinite] whitespace-nowrap py-2">
        {[...items, ...items].map((p, idx) => {
          const ps = eng.pairs[p.id];
          const chng = ps?.price.chng || 0;
          const positive = chng >= 0;
          return (
            <div
              key={`${p.id}-${idx}`}
              className="flex items-center gap-2 px-5 border-r border-line">
              
              <span className="text-2xs text-ink-muted font-semibold">
                {p.label}
              </span>
              <span className="font-mono text-xs text-ink">
                {fmtPrice(p.id, ps.price.mid)}
              </span>
              <span
                className={`flex items-center text-2xs font-mono ${positive ? 'text-buy' : 'text-sell'}`}>
                
                {positive ?
                <TrendingUpIcon className="w-3 h-3" /> :

                <TrendingDownIcon className="w-3 h-3" />
                }
                {Math.abs(chng).toFixed(2)}%
              </span>
            </div>);

        })}
      </div>
      <style>{`@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>);

}