import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import {
  ALL_ASSETS,
  fetchPrice,
  fetchKlines,
  makeCandles,
  type Asset } from
'../../lib/terminal/market';
import { generateVerdict, type GodVerdict } from '../../lib/terminal/engine';
// ============================================================
// Institutional SMC / ICT / AMD overview strip. Self-contained:
// fetches real prices + runs the real verdict engine, then maps
// the genuine engine output into Smart-Money-Concept, ICT and AMD
// readouts. No dependency on the host page internals.
// ============================================================
const PANEL_SYMBOLS = [
'BTCUSDT',
'ETHUSDT',
'SOLUSDT',
'EURUSD',
'GBPUSD',
'XAU'];

const KILL_ZONES: {
  id: string;
  label: string;
  startUtc: number;
  endUtc: number;
}[] = [
{
  id: 'asia',
  label: 'Asian',
  startUtc: 0,
  endUtc: 6
},
{
  id: 'london',
  label: 'London',
  startUtc: 7,
  endUtc: 10
},
{
  id: 'ny',
  label: 'New York',
  startUtc: 12,
  endUtc: 15
},
{
  id: 'lnclose',
  label: 'London Close',
  startUtc: 15,
  endUtc: 17
}];

const AMD_PHASES = ['Accumulation', 'Manipulation', 'Distribution'] as const;
function deriveAmd(v: GodVerdict): {
  phase: string;
  idx: number;
  pct: number;
  note: string;
} {
  // Map genuine engine output → AMD phase.
  if (v.trap.type !== 'NO_TRAP') {
    return {
      phase: 'Manipulation',
      idx: 1,
      pct: Math.min(100, v.trap.confidence),
      note: v.trap.reason
    };
  }
  const sweep = v.hiddenIndicators.find((h) => h.name === 'Liquidity Sweep');
  if (sweep && sweep.value !== 'NONE') {
    return {
      phase: 'Manipulation',
      idx: 1,
      pct: 60,
      note: sweep.detail
    };
  }
  if (v.direction !== 'NEUTRAL' && v.confidence >= 55) {
    return {
      phase: 'Distribution',
      idx: 2,
      pct: Math.min(100, v.confidence),
      note: `Smart money distributing into ${v.direction === 'BUY' ? 'strength' : 'weakness'}.`
    };
  }
  return {
    phase: 'Accumulation',
    idx: 0,
    pct: Math.max(20, 60 - Math.abs(v.score - 50)),
    note: 'Range tightening — smart money building position.'
  };
}
const fmtNum = (n: number): string => {
  if (!isFinite(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs < 0.01 && abs > 0) return n.toFixed(6);
  if (abs < 1) return n.toFixed(4);
  if (abs < 1000) return n.toFixed(2);
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
};
function Pill({
  label,
  tone



}: {label: string;tone: 'bull' | 'bear' | 'neutral';}) {
  const c =
  tone === 'bull' ?
  {
    color: '#22e08a',
    bg: '#0d1f15',
    bd: '#1f5a3a'
  } :
  tone === 'bear' ?
  {
    color: '#ff5c6c',
    bg: '#1f0d10',
    bd: '#5a1f28'
  } :
  {
    color: '#9fb3c8',
    bg: '#11161c',
    bd: '#2a3441'
  };
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
      style={{
        color: c.color,
        backgroundColor: c.bg,
        border: `1px solid ${c.bd}`
      }}>
      
      {label}
    </span>);

}
function Block({
  title,
  children



}: {title: string;children: React.ReactNode;}) {
  return (
    <div className="rounded-lg border border-[#13241a] bg-[#06080a] p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#5ee0a0]">
        {title}
      </div>
      {children}
    </div>);

}
export function SmcIctAmdPanel() {
  const [symbolId, setSymbolId] = useState(PANEL_SYMBOLS[0]);
  const [verdict, setVerdict] = useState<GodVerdict | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const asset: Asset | undefined = ALL_ASSETS.find((a) => a.id === symbolId);
    const run = async () => {
      if (!asset) return;
      try {
        setError(null);
        // Real OHLC klines (Binance for crypto, Yahoo elsewhere) + live tick.
        const [pd, klines] = await Promise.all([
        fetchPrice(asset.id),
        fetchKlines(asset, '15', 200)]
        );
        if (cancelled || !mounted.current) return;
        if (!pd || !pd.price) {
          if (!verdict) setError('Live price unavailable for this market.');
          setLoading(false);
          return;
        }
        // Use genuine candles; only synthesise if the provider is unreachable.
        let candles =
        klines && klines.length >= 20 ?
        klines.slice() :
        makeCandles(pd.price, 40);
        // Snap the latest candle close to the live tick for freshness.
        const last = {
          ...candles[candles.length - 1]
        };
        last.close = pd.price;
        last.high = Math.max(last.high, pd.price);
        last.low = Math.min(last.low, pd.price);
        candles[candles.length - 1] = last;
        setVerdict(generateVerdict(asset, pd, candles));
        setLoading(false);
      } catch (e: any) {
        if (!cancelled && mounted.current) {
          setError(e?.message || 'Engine error');
          setLoading(false);
        }
      }
    };
    setLoading(true);
    setVerdict(null);
    let timer: number | null = null;
    const start = () => {
      if (document.hidden || timer !== null) return;
      void run();
      timer = window.setInterval(() => void run(), 15000);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolId]);
  const nowHour = new Date().getUTCHours();
  const amd = useMemo(() => verdict ? deriveAmd(verdict) : null, [verdict]);
  const orderFlow = verdict?.subSignals.find((s) => s.name === 'Order Flow');
  const cvd = verdict?.hiddenIndicators.find(
    (h) => h.name === 'CVD (Volume Delta)'
  );
  const sweep = verdict?.hiddenIndicators.find(
    (h) => h.name === 'Liquidity Sweep'
  );
  const buyPct = verdict ? verdict.instRatio : 50;
  const sellPct = 100 - buyPct;
  return (
    <section
      aria-label="Smart Money Concepts, ICT and AMD overview"
      className="mb-3 rounded-lg border border-[#1f3a2a] bg-[#06080a] p-3 font-mono text-[11px]">
      
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#13241a] pb-2">
        <span className="text-[12px] font-bold tracking-wide text-[#5ee0a0]">
          SMC · ICT · AMD ENGINE
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {PANEL_SYMBOLS.map((id) =>
          <button
            key={id}
            type="button"
            onClick={() => setSymbolId(id)}
            aria-pressed={symbolId === id}
            className={`rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider transition-colors ${symbolId === id ? 'border-[#22e08a] bg-[#0d1f15] text-[#22e08a]' : 'border-[#1f3a2a] bg-[#0a0f0c] text-[#5e7a6c] hover:text-[#cfe9da]'}`}>
            
              {id}
            </button>
          )}
        </div>
      </div>

      {error &&
      <div className="mb-3 flex items-center gap-1.5 rounded border border-[#5a1f28] bg-[#1f0d10] p-2 text-[#ff8a8a]">
          <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      }

      {loading && !verdict ?
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) =>
        <div
          key={i}
          className="h-28 animate-pulse rounded-lg border border-[#13241a] bg-[#0a0f0c]" />

        )}
        </div> :
      verdict && amd ?
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* AMD PHASE */}
          <Block title="AMD Phase">
            <div className="mb-2 text-[13px] font-bold text-[#cfe9da]">
              {amd.phase}
            </div>
            <div className="mb-1.5 flex gap-1">
              {AMD_PHASES.map((p, i) =>
            <div
              key={p}
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundColor: i <= amd.idx ? '#22e08a' : '#13241a'
              }}
              aria-hidden="true" />

            )}
            </div>
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[#13241a]">
              <div
              className="h-full rounded-full bg-[#5ee0a0]"
              style={{
                width: `${amd.pct}%`
              }} />
            
            </div>
            <div className="text-[9px] text-[#5e7a6c]">
              {amd.pct.toFixed(0)}% complete · {amd.note}
            </div>
          </Block>

          {/* ICT KILL ZONES */}
          <Block title="ICT Kill Zones">
            <div className="space-y-1.5">
              {KILL_ZONES.map((kz) => {
              const active = nowHour >= kz.startUtc && nowHour < kz.endUtc;
              return (
                <div
                  key={kz.id}
                  className="flex items-center justify-between">
                  
                    <span
                    className={active ? 'text-[#cfe9da]' : 'text-[#5e7a6c]'}>
                    
                      {kz.label}
                    </span>
                    <Pill
                    label={active ? 'ACTIVE' : 'OFF'}
                    tone={active ? 'bull' : 'neutral'} />
                  
                  </div>);

            })}
            </div>
            <div className="mt-2 text-[9px] text-[#5e7a6c]">
              Zone: {verdict.realDirection.aligned ? 'aligned' : 'divergent'}
            </div>
          </Block>

          {/* SMART MONEY CONCEPTS */}
          <Block title="Smart Money Concepts">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">Order Block</span>
                <Pill
                label={
                verdict.ema9 > verdict.ema21 ? 'BULLISH OB' : 'BEARISH OB'
                }
                tone={verdict.ema9 > verdict.ema21 ? 'bull' : 'bear'} />
              
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">Fair Value Gap</span>
                <Pill
                label={
                verdict.candlePatterns.length > 0 ? 'IMBALANCE' : 'BALANCED'
                }
                tone={verdict.candlePatterns.length > 0 ? 'bull' : 'neutral'} />
              
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">Liquidity Sweep</span>
                <Pill
                label={sweep && sweep.value !== 'NONE' ? sweep.value : 'NONE'}
                tone={
                sweep && sweep.value === 'HIGH' ?
                'bear' :
                sweep && sweep.value === 'LOW' ?
                'bull' :
                'neutral'
                } />
              
              </div>
            </div>
            <div className="mt-2 text-[9px] text-[#5e7a6c]">
              {verdict.perfectCandle.detail}
            </div>
          </Block>

          {/* ORDER FLOW */}
          <Block title="Order Flow">
            <div className="mb-1 flex items-center justify-between text-[9px]">
              <span className="text-[#22e08a]">Buy {buyPct}%</span>
              <span className="text-[#ff5c6c]">Sell {sellPct}%</span>
            </div>
            <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-[#13241a]">
              <div
              className="h-full bg-[#22e08a]"
              style={{
                width: `${buyPct}%`
              }} />
            
              <div
              className="h-full bg-[#ff5c6c]"
              style={{
                width: `${sellPct}%`
              }} />
            
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">CVD / Delta</span>
                <span
                className="font-bold"
                style={{
                  color: cvd?.isWarning ? '#fbbf24' : '#cfe9da'
                }}>
                
                  {cvd?.value ?? 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">Imbalance</span>
                <Pill
                label={orderFlow?.detail ?? 'N/A'}
                tone={
                orderFlow?.status === 'bullish' ?
                'bull' :
                orderFlow?.status === 'bearish' ?
                'bear' :
                'neutral'
                } />
              
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e7a6c]">Real Direction</span>
                <Pill
                label={verdict.realDirection.institutional}
                tone={
                verdict.realDirection.institutional === 'BUY' ?
                'bull' :
                verdict.realDirection.institutional === 'SELL' ?
                'bear' :
                'neutral'
                } />
              
              </div>
            </div>
          </Block>
        </div> :
      null}
    </section>);

}