import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  LayersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowUpRightIcon } from
'lucide-react';
import {
  fetchPrice,
  fetchKlines,
  fmtNum,
  type Asset,
  type TCandle } from
'../../lib/terminal/market';
import { generateVerdict } from '../../lib/terminal/engine';
import {
  higherTimeframes,
  qualifyHigherTf,
  type HigherTfSetup } from
'../../lib/terminal/opportunity';
interface Props {
  asset: Asset;
  /** The user's currently-selected timeframe id (from SelectedSymbolContext). */
  selectedTf: string;
}
const POLL_MS = 30000;
/**
 * Scans the timeframes ABOVE the user's selection for genuinely strong,
 * clear setups and surfaces them as SUGGESTIONS — clearly distinct from
 * the active-timeframe trade plan. Renders quietly when nothing qualifies.
 */
export function HigherTfGrid({ asset, selectedTf }: Props) {
  const [setups, setSetups] = useState<HigherTfSetup[]>([]);
  const [scanned, setScanned] = useState(false);
  const cache = useRef<Record<string, TCandle[]>>({});
  const lastRun = useRef(0);
  const scan = useCallback(async () => {
    const higher = higherTimeframes(selectedTf, 3);
    if (!higher.length) {
      setSetups([]);
      setScanned(true);
      return;
    }
    try {
      const pd = await fetchPrice(asset.id);
      const results = await Promise.all(
        higher.map(async (tf) => {
          const key = `${asset.id}_${tf.tvInterval}`;
          let cc = await fetchKlines(asset, tf.tvInterval, 300);
          if (!cc || cc.length < 20) cc = cache.current[key] || [];
          if (!cc.length) return null;
          cache.current[key] = cc;
          const priceData = pd ?? {
            price: cc[cc.length - 1].close,
            volume: cc[cc.length - 1].volume,
            source: 'klines'
          };
          const verdict = generateVerdict(asset, priceData, cc);
          return qualifyHigherTf(tf.id, tf.label, verdict);
        })
      );
      setSetups(results.filter((r): r is HigherTfSetup => r !== null));
    } catch {

      /* keep the last set on transient failure */} finally {
      setScanned(true);
    }
  }, [asset, selectedTf]);
  useEffect(() => {
    setScanned(false);
    setSetups([]);
    // Debounce so rapid asset/timeframe changes don't spam the providers.
    let interval: number | null = null;
    const run = () => {
      if (document.hidden || Date.now() - lastRun.current < POLL_MS - 500) return;
      lastRun.current = Date.now();
      void scan();
    };
    const debounce = window.setTimeout(() => {
      lastRun.current = Date.now();
      void scan();
    }, 400);
    const start = () => {
      if (document.hidden || interval !== null) return;
      run();
      interval = window.setInterval(run, POLL_MS);
    };
    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(debounce);
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scan]);
  if (higherTimeframes(selectedTf, 3).length === 0) return null;
  return (
    <section
      aria-label="Higher timeframe opportunities"
      className="rounded-md border border-brand/25 bg-bg-700 p-2 lg:p-3">
      
      <div className="mb-2 flex items-center gap-2 px-1">
        <LayersIcon className="h-3.5 w-3.5 text-brand" />
        <h3 className="text-2xs font-bold uppercase tracking-[0.18em] text-ink">
          Higher-Timeframe Opportunities
        </h3>
      </div>
      <p className="mb-2.5 px-1 text-3xs leading-relaxed text-ink-dim">
        Detected on a timeframe higher than your selection — consider these for
        a larger, longer-hold move.
      </p>

      {setups.length > 0 ?
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {setups.map((s) =>
        <SetupCard key={s.tfId} setup={s} />
        )}
        </div> :

      <div className="px-1 text-3xs text-ink-dim">
          {scanned ?
        'No higher-timeframe setups right now — only high-conviction (≥75% · 1:2+ R:R) moves are shown.' :
        'Scanning higher timeframes…'}
        </div>
      }
    </section>);

}
function SetupCard({ setup: s }: {setup: HigherTfSetup;}) {
  const isBuy = s.direction === 'BUY';
  const dirColor = isBuy ? 'text-buy' : 'text-sell';
  const DirIcon = isBuy ? TrendingUpIcon : TrendingDownIcon;
  const tone = isBuy ? 'border-buy/30 bg-buy/5' : 'border-sell/30 bg-sell/5';
  return (
    <div className={`rounded-md border p-2.5 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-brand">
          <ArrowUpRightIcon className="h-2.5 w-2.5" />
          {s.tfLabel}
        </span>
        <span
          className={`flex items-center gap-1 font-mono text-sm font-black ${dirColor}`}>
          
          <DirIcon className="h-4 w-4" />
          {s.direction}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-3xs text-ink-muted">
        <span>{s.confidence}% conviction</span>
        <span className="text-warn">R:R 1:{s.rr}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-3xs">
        <Lvl label="Entry" value={fmtNum(s.entry)} tone="ink" />
        <Lvl label="SL" value={fmtNum(s.sl)} tone="sell" />
        <Lvl label="TP" value={fmtNum(s.tp)} tone="buy" />
      </div>
    </div>);

}
function Lvl({
  label,
  value,
  tone




}: {label: string;value: string;tone: 'buy' | 'sell' | 'ink';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="rounded border border-line bg-bg-800 px-1.5 py-1">
      <div className="text-3xs uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className={`font-bold ${color}`}>${value}</div>
    </div>);

}