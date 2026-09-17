import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  Component } from
'react';
import {
  RefreshCwIcon,
  RotateCcwIcon,
  Loader2Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  CheckCircle2Icon,
  XCircleIcon,
  MinusIcon,
  CrosshairIcon,
  ActivityIcon,
  TargetIcon,
  WavesIcon,
  LineChartIcon,
  TerminalIcon,
  BuildingIcon,
  ShieldAlertIcon } from
'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useSelectedSymbol } from '../../context/SelectedSymbolContext';
import { type BinanceCandle } from '../../lib/trading/binanceWebSocket';
import {
  getMarketCandles,
  subscribeMarketCandles } from
'../../lib/trading/marketCandles';
import {
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  STOCK_SYMBOLS } from
'../../lib/engine/engineV5';
import {
  detectTrap,
  type TrapResult,
  type TrapModuleVote } from
'../../lib/engine/trapDetector';
import { TrapCandleChart } from './TrapCandleChart';
const TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];
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
  },
  {
    value: 'XPTUSD',
    label: 'XPT/USD (Platinum)'
  },
  {
    value: 'HGUSD',
    label: 'Copper'
  }]

},
{
  label: 'COMMODITIES',
  options: [
  {
    value: 'WTIUSD',
    label: 'WTI Crude Oil'
  },
  {
    value: 'BRENTUSD',
    label: 'Brent Crude'
  },
  {
    value: 'NATGAS',
    label: 'Natural Gas'
  },
  {
    value: 'WHEAT',
    label: 'Wheat'
  },
  {
    value: 'COFFEE',
    label: 'Coffee'
  }]

},
{
  label: 'INDICES',
  options: [
  {
    value: 'SPX',
    label: 'S&P 500'
  },
  {
    value: 'NDX',
    label: 'Nasdaq'
  },
  {
    value: 'DJI',
    label: 'Dow Jones'
  },
  {
    value: 'VIX',
    label: 'VIX'
  },
  {
    value: 'FTSE',
    label: 'FTSE 100'
  },
  {
    value: 'DAX',
    label: 'DAX'
  },
  {
    value: 'NIKKEI',
    label: 'Nikkei 225'
  }]

},
{
  label: 'STOCKS',
  options: STOCK_SYMBOLS.map((s) => ({
    value: s,
    label: s
  }))
}];

const MODULE_ICONS: Record<
  string,
  ComponentType<{
    className?: string;
  }>> =
{
  crosshair: CrosshairIcon,
  activity: ActivityIcon,
  target: TargetIcon,
  waves: WavesIcon,
  'line-chart': LineChartIcon,
  terminal: TerminalIcon,
  building: BuildingIcon
};
/**
 * REAL Bull Trap / Bear Trap Detector for the Dashboard.
 *
 * Pulls live candles for whatever asset the user selects (Binance WS for
 * crypto, the key-free EngineContext feed for Gold/Forex), runs the
 * multi-confirmation trap engine, and shows the verdict ON a real
 * candlestick chart with the swept level + trap candle marked, plus a
 * transparent "how each module voted" breakdown.
 */
export function TrapDetectorPanel() {
  const { reset: resetGlobalSymbol } = useSelectedSymbol();
  const [symbol, setSymbol] = useLocalStorage<string>(
    'trap.symbol.v2',
    'XAUUSD'
  );
  const [timeframe, setTimeframe] = useLocalStorage<string>(
    'trap.timeframe.v2',
    '1h'
  );
  const [candles, setCandles] = useState<BinanceCandle[]>([]);
  const [trap, setTrap] = useState<TrapResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'crypto' | 'context' | null>(null);
  const candlesRef = useRef<BinanceCandle[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);
  const isCryptoSym = useMemo(() => CRYPTO_SYMBOLS.includes(symbol), [symbol]);
  const compute = useCallback((data: BinanceCandle[]) => {
    if (!data || data.length < 40) {
      setError('Loading market data… trap scan will run automatically.');
      return;
    }
    setError(null);
    setCandles(data);
    setTrap(detectTrap(data));
  }, []);
  // ── Unified zero-key realtime feed (every asset class) ──
  // Crypto streams over Binance WebSocket; forex, metals, commodities,
  // indices and stocks stream real OHLC candles from Yahoo's keyless
  // chart feed (polled live). One path, real candles for any symbol.
  const analyze = useCallback(async () => {
    setTrap(null);
    setAnalyzing(true);
    setError(null);
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    try {
      const data = await getMarketCandles(symbol, timeframe);
      if (!data || data.length < 40) {
        setError('Loading market data… retrying automatically.');
        setAnalyzing(false);
        return;
      }
      const snapshot = data.slice(-300);
      candlesRef.current = snapshot;
      compute(snapshot);
      setSource(isCryptoSym ? 'crypto' : 'context');
      unsubRef.current = subscribeMarketCandles(symbol, timeframe, (c) => {
        const arr = candlesRef.current.slice();
        const last = arr[arr.length - 1];
        if (last && last.timestamp === c.timestamp) arr[arr.length - 1] = c;else
        {
          arr.push(c);
          if (arr.length > 300) arr.shift();
        }
        candlesRef.current = arr;
        compute(arr);
      });
    } catch (err: any) {
      setError(err?.message || 'Trap scan failed — retrying.');
    } finally {
      setAnalyzing(false);
    }
  }, [symbol, timeframe, isCryptoSym, compute]);
  useEffect(() => {
    const t = setTimeout(() => analyze(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);
  const symbolLabel = useMemo(() => {
    for (const g of SYMBOL_GROUPS) {
      const o = g.options.find((x) => x.value === symbol);
      if (o) return o.label;
    }
    return symbol;
  }, [symbol]);
  return (
    <section
      aria-label="Bull trap and bear trap detector"
      className="bg-bg-700 border border-brand/30 rounded-md p-3 lg:p-4 brand-glow">
      
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlertIcon className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-bold tracking-tight">
            Bull Trap & Bear Trap Detector
          </h2>
          <span className="text-3xs uppercase tracking-[0.18em] text-ink-dim bg-brand/10 border border-brand/20 rounded px-1.5 py-0.5">
            Real candle scan
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
              Live price
            </span>
          }
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            aria-label="Select asset to scan for traps"
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
            {analyzing ? 'Scanning…' : 'Re-scan'}
          </button>
          <button
            onClick={() => {
              setSymbol('XAUUSD');
              setTimeframe('1h');
              setCandles([]);
              setTrap(null);
              setError(null);
              resetGlobalSymbol();
            }}
            aria-label="Reset trap scan to XAU/USD"
            title="Reset trap scan to XAU/USD"
            className="inline-flex items-center gap-1.5 border border-line bg-bg-800 text-ink-muted hover:text-ink px-2 py-1.5 rounded-md text-2xs font-semibold transition-colors">
            
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {!candles.length && error ?
      <div className="text-2xs text-warn bg-warn/10 border border-warn/30 rounded-md px-3 py-2.5">
          {error}
        </div> :
      !candles.length ?
      <TrapSkeleton /> :

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* LEFT — verdict + chart */}
          <div className="lg:col-span-3 space-y-3">
            <TrapVerdict
            trap={trap}
            symbolLabel={symbolLabel}
            timeframe={timeframe} />
          
            <div className="rounded-md border border-line bg-bg-800 p-2">
              <div className="text-3xs uppercase tracking-[0.18em] text-ink-dim mb-1.5 px-1">
                Live candles · {symbolLabel} · {timeframe}
              </div>
              <TrapCandleChart
              candles={candles}
              trap={trap}
              timeframe={timeframe} />
            
            </div>
          </div>
          {/* RIGHT — module breakdown */}
          <div className="lg:col-span-2">
            <div className="text-3xs uppercase tracking-[0.18em] text-ink-dim mb-2">
              How each module voted
              {trap && trap.kind !== 'NO TRAP' &&
            <span className="ml-1 text-ink-muted">
                  · {trap.confirmations}/{trap.totalModules} confirm
                </span>
            }
            </div>
            <div className="space-y-2">
              {trap?.modules.length ?
            trap.modules.map((m) =>
            <TrapModuleCard key={m.id} module={m} />
            ) :

            <div className="text-2xs text-ink-dim bg-bg-800 border border-line rounded-md px-3 py-3">
                  No trap candidate in range — modules will vote the moment a
                  fake breakout prints.
                </div>
            }
            </div>
          </div>
        </div>
      }
    </section>);

}
function TrapVerdict({
  trap,
  symbolLabel,
  timeframe




}: {trap: TrapResult | null;symbolLabel: string;timeframe: string;}) {
  if (!trap) return <TrapHeroSkeleton />;
  const noTrap = trap.kind === 'NO TRAP';
  const isBull = trap.kind === 'BULL TRAP';
  const tone = noTrap ?
  'border-warn/30 bg-warn/5' :
  isBull ?
  'border-sell/40 bg-sell/10' :
  'border-buy/40 bg-buy/10';
  const color = noTrap ? 'text-warn' : isBull ? 'text-sell' : 'text-buy';
  return (
    <div className={`rounded-md border p-3 lg:p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-3xs uppercase tracking-[0.18em] text-ink-dim mb-1">
            Trap scan · {symbolLabel} · {timeframe}
          </div>
          <div
            className={`flex items-center gap-2 text-2xl font-extrabold ${color}`}>
            
            {noTrap ?
            <MinusIcon className="w-5 h-5" /> :
            isBull ?
            <TrendingDownIcon className="w-5 h-5" /> :

            <TrendingUpIcon className="w-5 h-5" />
            }
            {trap.kind}
            {!noTrap &&
            <span className="numeric-value font-mono text-base font-bold text-ink-muted">
                {trap.confidence}%
              </span>
            }
          </div>
          <div className="text-2xs text-ink-muted mt-1 max-w-md leading-snug">
            {trap.headline}
          </div>
        </div>
        {!noTrap &&
        <div className="flex flex-col items-end gap-1.5">
            <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-3xs font-bold uppercase tracking-wider ${color} ${tone}`}>
            
              {trap.strength}
            </span>
            <span
            className={`inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider ${trap.bias === 'BULLISH' ? 'text-buy' : 'text-sell'}`}>
            
              {trap.bias === 'BULLISH' ?
            <TrendingUpIcon className="w-3 h-3" /> :

            <TrendingDownIcon className="w-3 h-3" />
            }
              Next move {trap.bias}
            </span>
          </div>
        }
      </div>
      {!noTrap &&
      <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat
            label="Swept level"
            value={trap.level.toFixed(trap.level > 100 ? 2 : 4)} />
          
            <MiniStat
            label="Confirmations"
            value={`${trap.confirmations}/${trap.totalModules}`} />
          
            <MiniStat label="Conviction" value={`${trap.confidence}%`} />
          </div>
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-800">
              <div
              className={isBull ? 'h-full bg-sell' : 'h-full bg-buy'}
              style={{
                width: `${trap.confidence}%`
              }} />
            
            </div>
          </div>
        </>
      }
    </div>);

}
function MiniStat({ label, value }: {label: string;value: string;}) {
  return (
    <div className="rounded-md border border-line bg-bg-800 px-2.5 py-2">
      <div className="text-3xs uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className="numeric-value mt-0.5 font-mono text-sm font-bold text-ink">{value}</div>
    </div>);

}
function TrapModuleCard({ module: m }: {module: TrapModuleVote;}) {
  const Icon = MODULE_ICONS[m.icon] ?? ActivityIcon;
  const tone =
  m.verdict === 'CONFIRM' ?
  'border-buy/30 bg-buy/5' :
  m.verdict === 'REJECT' ?
  'border-sell/30 bg-sell/5' :
  'border-line bg-bg-800';
  const vColor =
  m.verdict === 'CONFIRM' ?
  'text-buy' :
  m.verdict === 'REJECT' ?
  'text-sell' :
  'text-warn';
  return (
    <div className={`rounded-md border p-2.5 ${tone}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-2xs font-bold text-ink">{m.name}</span>
        </div>
        <span
          className={`numeric-value inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider ${vColor}`}>
          
          {m.verdict === 'CONFIRM' ?
          <CheckCircle2Icon className="w-3 h-3" /> :
          m.verdict === 'REJECT' ?
          <XCircleIcon className="w-3 h-3" /> :

          <MinusIcon className="w-3 h-3" />
          }
          {m.verdict} · {m.confidence}%
        </span>
      </div>
      <p className="text-3xs text-ink-muted leading-snug">{m.detail}</p>
    </div>);

}
function TrapHeroSkeleton() {
  return <div className="h-28 w-full rounded-md bg-bg-800 animate-pulse" />;
}
function TrapSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-pulse">
      <div className="lg:col-span-3 space-y-3">
        <div className="h-28 w-full rounded-md bg-bg-800" />
        <div className="h-64 w-full rounded-md bg-bg-800" />
      </div>
      <div className="lg:col-span-2 space-y-2">
        {Array.from({
          length: 5
        }).map((_, i) =>
        <div key={i} className="h-14 rounded-md bg-bg-800" />
        )}
      </div>
    </div>);

}