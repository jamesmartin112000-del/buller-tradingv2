import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { ActivityIcon, GlobeIcon } from 'lucide-react';
export function StatusBar() {
  const eng = useEngine();
  const ps = eng.pairs[eng.currentPair];
  const a = ps?.analysis;
  const trend = a?.trends.short.dir || 'neutral';
  const align = a?.trends.align || 0;
  const trendColor =
  trend === 'bullish' ?
  'text-buy' :
  trend === 'bearish' ?
  'text-sell' :
  'text-ink-muted';
  const alignColor =
  align > 0 ? 'text-buy' : align < 0 ? 'text-sell' : 'text-ink-muted';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 bg-bg-600 border border-line rounded-md text-2xs">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${ps?.price.open ? 'bg-buy dot-pulse' : 'bg-sell'}`} />
        
        <span className="font-bold tracking-wider">
          {ps?.price.open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>
      <div className="flex items-center gap-1 text-ink-dim">
        <GlobeIcon className="w-3 h-3" />
        <span className="font-mono">{ps?.price.src || 'loading'}</span>
      </div>
      <div className="text-ink-dim">
        Trend{' '}
        <span className={`${trendColor} font-bold uppercase ml-1`}>
          {trend}
        </span>
      </div>
      <div className="text-ink-dim">
        MTF{' '}
        <span className={`${alignColor} font-mono font-bold ml-1`}>
          {align}
        </span>
      </div>
      <div className="text-ink-dim">
        Zone{' '}
        <span className="text-ink font-bold uppercase ml-1">
          {a?.ict.zone || '-'}
        </span>
      </div>
      <div className="text-ink-dim">
        Killzone{' '}
        <span className="text-purple-trade font-bold uppercase ml-1">
          {(a?.ict.killzone || '-').replace('_', ' ')}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-purple-trade">
        <ActivityIcon className="w-3 h-3" />
        <span className="uppercase tracking-wider font-bold">
          PKT · {a?.pak.session || 'waiting'}
        </span>
      </div>
    </div>);

}