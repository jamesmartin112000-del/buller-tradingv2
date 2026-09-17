import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { fmtPrice } from '../../lib/engine/format';
import {
  CandlestickChartIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  LineChartIcon } from
'lucide-react';
/**
 * Detected candlestick + chart patterns + advanced indicator snapshot.
 * Renders on the dashboard so traders can see every confluence the engine
 * is using to score the current signal.
 */
export function PatternsPanel() {
  const eng = useEngine();
  const ps = eng.pairs[eng.currentPair];
  const sig = ps?.analysis.lastSignal;
  const pid = eng.currentPair;
  const candles = sig?.candlePatterns || [];
  const charts = sig?.chartPatterns || [];
  const adv = sig?.advIndicators;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Candlestick patterns */}
      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-3">
          <CandlestickChartIcon className="w-3 h-3" />
          Candlestick Patterns · {candles.length} active
        </div>
        {candles.length === 0 ?
        <div className="text-2xs text-ink-dim">
            No strong candlestick formations on 15m. Engine scans 30+ patterns
            continuously.
          </div> :

        <div className="space-y-1.5">
            {candles.map((p, i) =>
          <PatternRow
            key={i}
            name={p.name}
            type={p.type}
            strength={p.strength} />

          )}
          </div>
        }
      </div>

      {/* Chart patterns */}
      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-3">
          <LineChartIcon className="w-3 h-3" />
          Chart Patterns · {charts.length} active
        </div>
        {charts.length === 0 ?
        <div className="text-2xs text-ink-dim">
            No major chart patterns detected on 1h. Scanning for H&S, triangles,
            wedges, flags, double tops/bottoms.
          </div> :

        <div className="space-y-1.5">
            {charts.map((p, i) =>
          <div key={i} className="bg-bg-700 border border-line rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-ink">
                    {p.name}
                  </span>
                  <TypeBadge type={p.type} strength={p.strength} />
                </div>
                {p.target !== undefined && p.target > 0 &&
            <div className="text-2xs text-ink-muted font-mono">
                    Target: {fmtPrice(pid, p.target)}
                  </div>
            }
              </div>
          )}
          </div>
        }
      </div>

      {/* Advanced indicators snapshot — spans both columns */}
      <div className="md:col-span-2 bg-bg-600 border border-line rounded-md p-4">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-3">
          <TrendingUpIcon className="w-3 h-3" />
          Advanced Indicators · Live Snapshot
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {adv?.stochastic &&
          <IndicatorTile
            label="Stochastic"
            value={`${adv.stochastic.k.toFixed(0)} / ${adv.stochastic.d.toFixed(0)}`}
            state={
            adv.stochastic.k < 20 ?
            'oversold' :
            adv.stochastic.k > 80 ?
            'overbought' :
            'neutral'
            } />

          }
          {adv?.stochRsi &&
          <IndicatorTile
            label="Stoch RSI"
            value={`${adv.stochRsi.k.toFixed(0)} / ${adv.stochRsi.d.toFixed(0)}`}
            state={
            adv.stochRsi.k < 20 ?
            'oversold' :
            adv.stochRsi.k > 80 ?
            'overbought' :
            'neutral'
            } />

          }
          {adv?.adx &&
          <IndicatorTile
            label="ADX"
            value={`${adv.adx.adx.toFixed(0)} · ${adv.adx.direction}`}
            state={
            adv.adx.trend === 'strong' ?
            adv.adx.direction === 'bullish' ?
            'bull' :
            'bear' :
            'neutral'
            } />

          }
          {adv?.ichimoku &&
          <IndicatorTile
            label="Ichimoku"
            value={
            adv.ichimoku.priceAboveCloud ?
            'Above Cloud' :
            adv.ichimoku.cloudBullish ?
            'In Cloud' :
            'Below Cloud'
            }
            state={
            adv.ichimoku.priceAboveCloud ?
            'bull' :
            adv.ichimoku.cloudBullish ?
            'neutral' :
            'bear'
            } />

          }
          {adv?.volume &&
          <IndicatorTile
            label="Volume"
            value={`${adv.volume.ratio}x avg`}
            state={adv.volume.spike ? 'bull' : 'neutral'} />

          }
          {adv?.macdCross &&
          <IndicatorTile
            label="MACD Cross"
            value={adv.macdCross}
            state={adv.macdCross === 'bullish' ? 'bull' : 'bear'} />

          }
        </div>
      </div>
    </div>);

}
function PatternRow({
  name,
  type,
  strength




}: {name: string;type: 'bullish' | 'bearish' | 'neutral';strength: string;}) {
  return (
    <div className="bg-bg-700 border border-line rounded px-2 py-1.5 flex items-center justify-between">
      <span className="text-xs text-ink">{name}</span>
      <TypeBadge type={type} strength={strength} />
    </div>);

}
function TypeBadge({
  type,
  strength



}: {type: 'bullish' | 'bearish' | 'neutral';strength: string;}) {
  const map = {
    bullish: {
      c: 'text-buy',
      bg: 'bg-buy/10 border-buy/30',
      Icon: TrendingUpIcon
    },
    bearish: {
      c: 'text-sell',
      bg: 'bg-sell/10 border-sell/30',
      Icon: TrendingDownIcon
    },
    neutral: {
      c: 'text-ink-muted',
      bg: 'bg-bg-800 border-line',
      Icon: MinusIcon
    }
  };
  const m = map[type];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-3xs font-bold uppercase tracking-wider ${m.bg} ${m.c}`}>
      
      <m.Icon className="w-2.5 h-2.5" />
      {strength.replace('_', ' ')}
    </span>);

}
function IndicatorTile({
  label,
  value,
  state




}: {label: string;value: string;state: 'bull' | 'bear' | 'oversold' | 'overbought' | 'neutral';}) {
  const tone: Record<typeof state, string> = {
    bull: 'text-buy border-buy/30 bg-buy/5',
    bear: 'text-sell border-sell/30 bg-sell/5',
    oversold: 'text-buy border-buy/30 bg-buy/5',
    overbought: 'text-sell border-sell/30 bg-sell/5',
    neutral: 'text-ink border-line bg-bg-700'
  } as const;
  return (
    <div className={`border rounded p-2 ${tone[state]}`}>
      <div className="text-3xs uppercase tracking-wider text-ink-dim mb-0.5">
        {label}
      </div>
      <div className="font-mono text-xs font-bold capitalize">{value}</div>
    </div>);

}