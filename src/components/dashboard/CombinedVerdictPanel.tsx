import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
  Component,
  type ComponentType } from
'react';
import {
  LayersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Loader2Icon,
  TargetIcon,
  ZapIcon,
  CrosshairIcon,
  RadarIcon,
  TerminalIcon,
  BuildingIcon,
  ActivityIcon,
  WavesIcon,
  BrainIcon,
  LineChartIcon } from
'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useSelectedSymbol } from '../../context/SelectedSymbolContext';
import {
  binanceWS,
  type BinanceCandle } from
'../../lib/trading/binanceWebSocket';
import { getMarketCandles } from '../../lib/trading/marketCandles';
import {
  generateSignal,
  isCrypto,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  STOCK_SYMBOLS,
  type EngineSignal } from
'../../lib/engine/engineV5';
import {
  gatherHiddenIntel,
  scoreHiddenIntel,
  getActiveSession } from
'../../lib/engine/hiddenIntel';
import {
  buildCombinedVerdict,
  type CombinedVerdict,
  type ModuleVote,
  type Vote } from
'../../lib/engine/combinedVerdict';
import { useEngine } from '../../context/EngineContext';
import { ProgressBar } from '../ui/ProgressBar';
import type { Candle, Timeframe } from '../../lib/engine/types';

const ANALYSIS_STAGES = [
'Fetching multi-timeframe data (MN → M1)…',
'Mapping market structure & liquidity…',
'Scanning FVG / Order Blocks / FRVP…',
'Checking order flow, delta & CVD…',
'Checking news & PKT session risk…',
'Building final trade plan…'];

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
const SYMBOL_GROUPS: {
  label: string;
  options: {
    value: string;
    label: string;
  }[];
}[] = [
{
  label: 'CRYPTO',
  options: CRYPTO_SYMBOLS.map((s) => ({
    value: s,
    label: s.replace('USDT', '/USDT')
  }))
},
{
  label: 'FOREX',
  options: FOREX_SYMBOLS.map((s) => ({
    value: s,
    label: `${s.slice(0, 3)}/${s.slice(3)}`
  }))
},
{
  label: 'METALS',
  options: [
  {
    value: 'XAUUSD',
    label: 'XAU/USD (Gold)'
  },
  {
    value: 'XAGUSD',
    label: 'XAG/USD (Silver)'
  }]

},
{
  label: 'STOCKS',
  options: STOCK_SYMBOLS.map((s) => ({
    value: s,
    label: s
  }))
}];

// EngineContext supplies key-free live candles for these (no Binance needed).
const CONTEXT_PAIR_IDS = new Set([
'XAUUSD',
'EURUSD',
'GBPUSD',
'USDJPY',
'USDCHF',
'AUDUSD',
'USDCAD',
'NZDUSD']
);
const CONTEXT_TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
/** Map the panel symbol + timeframe onto an EngineContext pair id / timeframe. */
function contextPairId(symbol: string): string | null {
  if (CONTEXT_PAIR_IDS.has(symbol)) return symbol;
  return null;
}
function contextTf(tf: string): Timeframe {
  if ((CONTEXT_TFS as string[]).includes(tf)) return tf as Timeframe;
  if (tf === '30m') return '15m';
  return '1h';
}
/** Convert the EngineContext candle shape to the engineV5 BinanceCandle shape. */
function toBinanceCandles(candles: Candle[]): BinanceCandle[] {
  return candles.map((c) => ({
    timestamp: c.time,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v,
    isClosed: c.closed
  })) as BinanceCandle[];
}
function voteColor(v: Vote): string {
  return v === 'BULLISH' ?
  'text-buy' :
  v === 'BEARISH' ?
  'text-sell' :
  'text-warn';
}
function voteBg(v: Vote): string {
  return v === 'BULLISH' ?
  'border-buy/40 bg-buy/10' :
  v === 'BEARISH' ?
  'border-sell/40 bg-sell/10' :
  'border-warn/30 bg-warn/5';
}
function VoteIcon({ v }: {v: Vote;}) {
  if (v === 'BULLISH') return <TrendingUpIcon className="w-3.5 h-3.5" />;
  if (v === 'BEARISH') return <TrendingDownIcon className="w-3.5 h-3.5" />;
  return <MinusIcon className="w-3.5 h-3.5" />;
}
// Maps a module's semantic icon key onto a lucide icon (no emojis anywhere).
const MODULE_ICONS: Record<
  string,
  ComponentType<{
    className?: string;
  }>> =
{
  zap: ZapIcon,
  target: TargetIcon,
  crosshair: CrosshairIcon,
  radar: RadarIcon,
  terminal: TerminalIcon,
  building: BuildingIcon,
  activity: ActivityIcon,
  waves: WavesIcon,
  brain: BrainIcon,
  'line-chart': LineChartIcon
};
function ModuleIcon({ icon }: {icon: string;}) {
  const Cmp = MODULE_ICONS[icon] ?? LayersIcon;
  return <Cmp className="w-3.5 h-3.5 text-ink-muted" />;
}
/**
 * The unified "Final Combined Verdict" — runs the rich engineV5 engine for a
 * chosen asset, then fuses every module's decision (Engine, Signals, Trade
 * Entry, God Signal, Live Terminal, Institutional, Scalping, Big Move, Smart
 * Money, Charts) into ONE consensus trade entry shown right here on the
 * Dashboard, with a transparent per-module breakdown.
 *
 * Data sources (both key-free, automatic):
 *   • Crypto  → Binance WebSocket (live candles + subscription).
 *   • Gold / Forex → the always-on EngineContext live feed (gold-api,
 *     frankfurter, etc.) — converted in-memory, so it's instant.
 */
export function CombinedVerdictPanel() {
  const eng = useEngine();
  const { reset: resetGlobalSymbol } = useSelectedSymbol();
  // Versioned storage migrates the former BTC default once, while preserving
  // every selection the user makes after this Gold-first release.
  const [symbol, setSymbol] = useLocalStorage<string>(
    'verdict.symbol.v2',
    'XAUUSD'
  );
  const [timeframe, setTimeframe] = useLocalStorage<string>(
    'verdict.timeframe.v2',
    '1h'
  );
  const [verdict, setVerdict] = useState<CombinedVerdict | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState('');
  const [source, setSource] = useState<'crypto' | 'context' | null>(null);
  const candlesRef = useRef<BinanceCandle[]>([]);
  const intelRef = useRef<ReturnType<typeof scoreHiddenIntel> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastComputeRef = useRef(0);
  const ctxId = useMemo(() => contextPairId(symbol), [symbol]);
  const isCryptoSym = isCrypto(symbol);
  const compute = useCallback((data: BinanceCandle[]) => {
    const session = getActiveSession();
    setSessionLabel(`${session.name} [${session.quality}]`);
    const hidden = intelRef.current;
    const sig: EngineSignal | null = generateSignal(data, {
      hiddenScore: hidden?.score ?? 0,
      hiddenReasons: hidden?.reasons ?? [],
      timeBias: session.bias,
      sessionName: session.name,
      sessionQuality: session.quality
    });
    if (!sig) {
      setError('Insufficient market data for a combined verdict.');
      return;
    }
    setError(null);
    setVerdict(buildCombinedVerdict(sig));
  }, []);
  // ── CRYPTO: live Binance WebSocket path ──
  const analyzeCrypto = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    try {
      const data = await binanceWS.getLatestData(symbol, timeframe);
      if (!data || data.length < 30) {
        setError('Loading market data… retrying automatically.');
        setAnalyzing(false);
        return;
      }
      const snapshot = data.slice(-300);
      candlesRef.current = snapshot;
      try {
        const h = await gatherHiddenIntel(symbol);
        intelRef.current = scoreHiddenIntel(h);
      } catch {
        intelRef.current = null;
      }
      compute(snapshot);
      setSource('crypto');
      unsubRef.current = binanceWS.subscribe(symbol, timeframe, (c) => {
        const arr = candlesRef.current.slice();
        const last = arr[arr.length - 1];
        if (last && last.timestamp === c.timestamp) arr[arr.length - 1] = c;else
        {
          arr.push(c);
          if (arr.length > 300) arr.shift();
        }
        candlesRef.current = arr;
        if (c.isClosed) compute(arr);
      });
    } catch (err: any) {
      setError(err?.message || 'Analysis failed — retrying.');
    } finally {
      setAnalyzing(false);
    }
  }, [symbol, timeframe, compute]);
  // ── GOLD / FOREX: live context ticks + fresh fetch on manual runs ──
  const analyzeContext = useCallback(
    async (pairId: string, forceFresh = false) => {
      if (forceFresh) setAnalyzing(true);
      setError(null);
      try {
        const ps = eng.pairs[pairId];
        const raw = ps?.candles?.[contextTf(timeframe)] ?? [];
        let data = toBinanceCandles(raw).slice(-300);
        if (forceFresh) {
          const fresh = await getMarketCandles(symbol, timeframe);
          if (fresh && fresh.length >= 30) data = fresh.slice(-300);
        }
        if (data.length < 30) {
          setError('Live feed warming up… verdict will retry automatically.');
          setSource('context');
          return;
        }
        candlesRef.current = data;
        intelRef.current = null;
        compute(data);
        setSource('context');
      } catch (caught) {
        setError(
          caught instanceof Error ?
          caught.message :
          'Live market refresh failed — retrying.'
        );
      } finally {
        if (forceFresh) setAnalyzing(false);
      }
    },
    [eng, symbol, timeframe, compute]
  );
  const analyze = useCallback(async () => {
    setVerdict(null);
    if (isCryptoSym) {
      await analyzeCrypto();
      return;
    }
    if (ctxId) {
      await analyzeContext(ctxId, true);
      return;
    }
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setSource(null);
    setError(
      `Live candles for ${symbol} aren't streaming yet. Crypto, Gold (XAU) and major forex pairs run automatically — pick one of those for a full combined verdict.`
    );
  }, [isCryptoSym, ctxId, symbol, analyzeCrypto, analyzeContext]);
  useEffect(() => {
    if (!analyzing) {
      setAnalysisStage(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAnalysisStage((current) =>
      Math.min(current + 1, ANALYSIS_STAGES.length - 1)
      );
    }, 2000);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  // Re-run whenever the asset / timeframe changes.
  useEffect(() => {
    const t = setTimeout(() => analyze(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);
  // Keep the context path fresh as the live feed ticks (throttled for speed).
  useEffect(() => {
    if (isCryptoSym || !ctxId) return;
    const now = Date.now();
    if (now - lastComputeRef.current < 2500) return;
    lastComputeRef.current = now;
    analyzeContext(ctxId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng.lastUpdate, isCryptoSym, ctxId]);
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);
  const final = verdict?.final;
  return (
    <section
      aria-label="Final combined verdict"
      className="bg-bg-700 border border-brand/30 rounded-md p-3 lg:p-4 brand-glow">
      
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <LayersIcon className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-bold tracking-tight">
            Final Combined Verdict
          </h2>
          <span className="text-3xs uppercase tracking-[0.18em] text-ink-dim bg-brand/10 border border-brand/20 rounded px-1.5 py-0.5">
            All modules merged
          </span>
          {source === 'crypto' &&
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-buy">
              <span className="h-1.5 w-1.5 rounded-full bg-buy animate-pulse" />
              Live WS
            </span>
          }
          {source === 'context' &&
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-buy">
              <span className="h-1.5 w-1.5 rounded-full bg-buy animate-pulse" />
              Live feed
            </span>
          }
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            aria-label="Select asset"
            className="bg-bg-800 text-ink border border-line rounded-md px-2 py-1.5 text-2xs focus:outline-none focus:border-brand/50">
            
            {SYMBOL_GROUPS.map((g) =>
            <optgroup key={g.label} label={g.label}>
                {g.options.map((o) =>
              <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
              )}
              </optgroup>
            )}
          </select>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            aria-label="Select timeframe"
            className="bg-bg-800 text-ink border border-line rounded-md px-2 py-1.5 text-2xs focus:outline-none focus:border-brand/50">
            
            {TIMEFRAMES.map((tf) =>
            <option key={tf} value={tf}>
                {tf}
              </option>
            )}
          </select>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand/90 text-white px-2.5 py-1.5 rounded-md text-2xs font-semibold transition-colors disabled:opacity-60">
            
            {analyzing ?
            <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

            <RefreshCwIcon className="w-3.5 h-3.5" />
            }
            {analyzing ? 'Merging…' : 'Re-run'}
          </button>
          <button
            onClick={() => {
              setSymbol('XAUUSD');
              setTimeframe('1h');
              setVerdict(null);
              setError(null);
              resetGlobalSymbol();
            }}
            aria-label="Reset analysis to XAU/USD"
            title="Reset analysis to XAU/USD"
            className="inline-flex items-center gap-1.5 border border-line bg-bg-800 text-ink-muted hover:text-ink px-2 py-1.5 rounded-md text-2xs font-semibold transition-colors">
            
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {analyzing &&
      <div className="mb-3 rounded-md border border-brand/25 bg-brand/5 px-3 py-2.5" role="status" aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-2xs text-ink-muted">
            <Loader2Icon className="h-3.5 w-3.5 animate-spin text-brand" />
            <span>{ANALYSIS_STAGES[analysisStage]}</span>
            <span className="ml-auto font-mono text-ink-dim">
              {analysisStage + 1}/{ANALYSIS_STAGES.length}
            </span>
          </div>
          <ProgressBar
          value={(analysisStage + 1) / ANALYSIS_STAGES.length * 100}
          tone="brand"
          height={4} />
        
        </div>
      }

      {!final && error ?
      <div className="text-2xs text-warn bg-warn/10 border border-warn/30 rounded-md px-3 py-2.5">
          {error}
        </div> :
      !final ?
      <VerdictSkeleton /> :

      <div className="space-y-3">
          {/* HERO — the one combined trade entry */}
          <div
          className={`rounded-md border p-3 lg:p-4 ${voteBg(final.direction)}`}>
          
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-3xs uppercase tracking-[0.18em] text-ink-dim mb-1">
                  Consensus across {verdict.modules.length} modules · {symbol} ·{' '}
                  {timeframe}
                </div>
                <div
                className={`flex items-center gap-2 text-2xl font-extrabold ${voteColor(final.direction)}`}>
                
                  <VoteIcon v={final.direction} />
                  {final.direction === 'BULLISH' ?
                'BUY' :
                final.direction === 'BEARISH' ?
                'SELL' :
                'NO TRADE'}
                  <span className="numeric-value font-mono text-base font-bold text-ink-muted">
                    {final.confidence}%
                  </span>
                </div>
                <div className="text-2xs text-ink-muted mt-1">
                  {final.verdict}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConsensusChip
                label="Agreement"
                value={`${final.agreement}%`} />
              
                <ConsensusChip label="Risk" value={final.riskLevel || '—'} />
              </div>
            </div>

            {/* Trade levels */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <LevelCard
              icon={<TargetIcon className="w-3 h-3" />}
              label="Entry"
              value={final.entry} />
            
              <LevelCard label="Stop Loss" value={final.sl} tone="sell" />
              <LevelCard label="Take Profit" value={final.tp} tone="buy" />
              <LevelCard label="R:R" value={`1:${final.rr}`} />
            </div>

            {/* Vote distribution bar */}
            <div className="mt-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-800">
                <div
                className="bg-buy"
                style={{
                  width: `${pct(final.bullishModules, verdict.modules.length)}%`
                }} />
              
                <div
                className="bg-warn"
                style={{
                  width: `${pct(final.neutralModules, verdict.modules.length)}%`
                }} />
              
                <div
                className="bg-sell"
                style={{
                  width: `${pct(final.bearishModules, verdict.modules.length)}%`
                }} />
              
              </div>
              <div className="flex items-center justify-between text-3xs text-ink-dim mt-1 font-mono">
                <span className="text-buy">{final.bullishModules} bullish</span>
                <span className="text-warn">
                  {final.neutralModules} neutral
                </span>
                <span className="text-sell">
                  {final.bearishModules} bearish
                </span>
              </div>
            </div>
          </div>

          {/* PER-MODULE BREAKDOWN */}
          <div>
            <div className="text-3xs uppercase tracking-[0.18em] text-ink-dim mb-2">
              How each module voted {sessionLabel && `· ${sessionLabel}`}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {verdict.modules.map((m) =>
            <ModuleCard key={m.id} module={m} />
            )}
            </div>
          </div>
        </div>
      }
    </section>);

}
function pct(n: number, total: number): number {
  return total ? n / total * 100 : 0;
}
function ConsensusChip({ label, value }: {label: string;value: string;}) {
  return (
    <div className="rounded-md border border-line bg-bg-800 px-2.5 py-1.5 text-center">
      <div className="text-3xs uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className="numeric-value font-mono text-sm font-bold text-ink">{value}</div>
    </div>);

}
function LevelCard({
  icon,
  label,
  value,
  tone





}: {icon?: React.ReactNode;label: string;value: string;tone?: 'buy' | 'sell';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="rounded-md border border-line bg-bg-800 px-2.5 py-2">
      <div className="flex items-center gap-1 text-3xs uppercase tracking-wider text-ink-dim">
        {icon}
        {label}
      </div>
      <div className={`numeric-value mt-0.5 font-mono text-sm font-bold ${color}`}>
        {value}
      </div>
    </div>);

}
function ModuleCard({ module: m }: {module: ModuleVote;}) {
  return (
    <div className={`rounded-md border p-2.5 ${voteBg(m.vote)}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <ModuleIcon icon={m.icon} />
          <span className="text-2xs font-bold text-ink">{m.name}</span>
        </div>
        <span
          className={`numeric-value inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider ${voteColor(m.vote)}`}>
          
          <VoteIcon v={m.vote} />
          {m.vote} · {m.confidence}%
        </span>
      </div>
      <p className="text-3xs text-ink-muted leading-snug">{m.summary}</p>
    </div>);

}
function VerdictSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-24 w-full rounded-md bg-bg-800" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Array.from({
          length: 6
        }).map((_, i) =>
        <div key={i} className="h-14 rounded-md bg-bg-800" />
        )}
      </div>
    </div>);

}