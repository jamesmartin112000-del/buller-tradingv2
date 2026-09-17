import React from 'react';
import type { OrderFlowState } from '../../lib/engine/types';
const IMB_LABEL: Record<OrderFlowState['imb'], string> = {
  strong_buying: 'Strong Buying',
  buying: 'Buying',
  neutral: 'Balanced',
  selling: 'Selling',
  strong_selling: 'Strong Selling'
};
export function OrderFlowPanel({ of }: {of: OrderFlowState;}) {
  const buy = Math.max(0, Math.min(100, Math.round(of.buyPct)));
  const sell = Math.max(0, Math.min(100, Math.round(of.sellPct)));
  const isBuySide = of.imb === 'strong_buying' || of.imb === 'buying';
  const isSellSide = of.imb === 'strong_selling' || of.imb === 'selling';
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-2xs font-mono">
          <span className="numeric-value font-bold text-buy">{buy}% Buy</span>
          <span className="numeric-value font-bold text-sell">{sell}% Sell</span>
        </div>
        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg-800"
          role="img"
          aria-label={`Buy pressure ${buy}%, sell pressure ${sell}%`}>
          
          <div
            className="h-full bg-buy transition-all duration-500"
            style={{
              width: `${buy}%`
            }} />
          
          <div
            className="h-full bg-sell transition-all duration-500"
            style={{
              width: `${sell}%`
            }} />
          
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-line bg-bg-700 px-2.5 py-2">
          <div className="text-3xs uppercase tracking-wider text-ink-dim">
            CVD / Delta
          </div>
          <div
            className={`numeric-value font-mono text-sm font-bold ${of.delta > 0 ? 'text-buy' : of.delta < 0 ? 'text-sell' : 'text-ink'}`}>
            
            {of.delta > 0 ? '+' : ''}
            {of.delta.toFixed(0)}
          </div>
        </div>
        <div className="rounded border border-line bg-bg-700 px-2.5 py-2">
          <div className="text-3xs uppercase tracking-wider text-ink-dim">
            Pressure
          </div>
          <div
            className={`text-sm font-bold ${isBuySide ? 'text-buy' : isSellSide ? 'text-sell' : 'text-ink-muted'}`}>
            
            {IMB_LABEL[of.imb]}
          </div>
        </div>
      </div>
    </div>);

}