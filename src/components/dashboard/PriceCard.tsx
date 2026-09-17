import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { findPair } from '../../lib/engine/pairs';
import { fmtPrice, fmtPct } from '../../lib/engine/format';
import { ArrowDownIcon, ArrowUpIcon, BarChart2Icon } from 'lucide-react';
export function PriceCard() {
  const eng = useEngine();
  const pid = eng.currentPair;
  const ps = eng.pairs[pid];
  const pair = findPair(pid);
  const rsi = ps?.analysis.mtf['1h']?.rsiVal ?? 50;
  const rsiColor = rsi > 70 ? 'text-sell' : rsi < 30 ? 'text-buy' : 'text-ink';
  const vol = ps?.analysis.vol.regime || 'normal';
  const chng = ps?.price.chng || 0;
  const positive = chng >= 0;
  return (
    <div className="min-w-0 rounded-md border border-line bg-bg-600 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-2xs uppercase tracking-[0.18em] text-ink-dim">
            {pair?.label}
          </div>
          <div className="numeric-value font-mono text-3xl font-bold tracking-tight lg:text-4xl">
            {fmtPrice(pid, ps?.price.mid)}
          </div>
        </div>
      </div>
    </div>);

}