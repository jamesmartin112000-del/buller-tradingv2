import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { PAIRS_LIST } from '../../lib/engine/pairs';
import { fmtPrice } from '../../lib/engine/format';
export function PairSelector() {
  const eng = useEngine();
  return (
    <div className="rounded-md border border-line bg-bg-600 p-2 sm:overflow-x-auto sm:scrollbar-thin">
      <div className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 sm:flex sm:min-w-max">
        {PAIRS_LIST.map((p) => {
          const ps = eng.pairs[p.id];
          const active = eng.currentPair === p.id;
          const chng = ps?.price.chng || 0;
          const chngColor =
          chng > 0 ? 'text-buy' : chng < 0 ? 'text-sell' : 'text-ink-dim';
          return (
            <button
              key={p.id}
              onClick={() => eng.switchPair(p.id)}
              className={`flex flex-col items-start px-2.5 py-1.5 rounded text-left transition-colors border ${active ? 'bg-brand/15 border-brand text-ink' : 'bg-bg-700 border-line text-ink-muted hover:bg-bg-500 hover:text-ink hover:border-line-strong'}`}>
              
              <span className="text-[11px] font-semibold leading-tight">
                {p.label}
              </span>
              <span className="numeric-value mt-0.5 font-mono text-[10px] leading-tight">
                {fmtPrice(p.id, ps?.price.mid)}
              </span>
              {chng !== 0 &&
              <span className={`numeric-value font-mono text-[9px] ${chngColor}`}>
                  {chng > 0 ? '+' : ''}
                  {chng.toFixed(2)}%
                </span>
              }
            </button>);

        })}
      </div>
    </div>);

}