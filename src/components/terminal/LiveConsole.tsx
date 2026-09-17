import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
  createElement } from
'react';
import {
  DownloadIcon,
  Trash2Icon,
  SearchIcon,
  ArrowDownToLineIcon,
  TerminalIcon } from
'lucide-react';
import {
  ALL_ASSETS,
  fetchPrice,
  fetchKlines,
  makeCandles,
  type Asset } from
'../../lib/terminal/market';
import { generateVerdict } from '../../lib/terminal/engine';
// ============================================================
// Professional live trading console — color-coded, filterable,
// exportable. Driven by the SAME real engine (generateVerdict)
// + real prices (fetchPrice) used across the terminal, so every
// log line reflects genuine engine output. Fully self-contained.
// ============================================================
type LogType =
'INFO' |
'SIGNAL' |
'ALERT' |
'BUY' |
'SELL' |
'PRIORITY' |
'ERROR' |
'SYSTEM';
interface LogEntry {
  id: number;
  ts: number;
  type: LogType;
  msg: string;
}
const LOG_TYPES: LogType[] = [
'INFO',
'SIGNAL',
'ALERT',
'BUY',
'SELL',
'PRIORITY',
'ERROR',
'SYSTEM'];

const TYPE_COLOR: Record<LogType, string> = {
  INFO: '#7dd3fc',
  SIGNAL: '#c084fc',
  ALERT: '#fbbf24',
  BUY: '#22e08a',
  SELL: '#ff5c6c',
  PRIORITY: '#ffd24d',
  ERROR: '#ff4444',
  SYSTEM: '#5ee0a0'
};
// Rotating watchlist across asset classes for a lively, real feed.
const WATCH_IDS = [
'BTCUSDT',
'ETHUSDT',
'SOLUSDT',
'EURUSD',
'GBPUSD',
'XAU',
'AAPL',
'NVDA'];

const fmtTs = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
};
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
let logSeq = 0;
export function LiveConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<LogType>>(
    () => new Set(LOG_TYPES)
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const watchIdx = useRef(0);
  const mounted = useRef(true);
  const push = useCallback((type: LogType, msg: string) => {
    setLogs((prev) => {
      const next = [
      ...prev,
      {
        id: ++logSeq,
        ts: Date.now(),
        type,
        msg
      }];

      // keep the buffer bounded so memory stays flat over long sessions
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);
  // ── Boot banner ──────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    push('SYSTEM', 'God-Level Terminal console initialised — zero API keys.');
    push('INFO', `Watchlist armed: ${WATCH_IDS.join(', ')}`);
    push('SYSTEM', 'Polling live engine every 4s. Auto-scroll ON.');
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ── Live engine poll — emits real, color-coded log lines ──
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const id = WATCH_IDS[watchIdx.current % WATCH_IDS.length];
      watchIdx.current += 1;
      const asset: Asset | undefined = ALL_ASSETS.find((a) => a.id === id);
      if (!asset) return;
      try {
        const [pd, klines] = await Promise.all([
        fetchPrice(asset.id),
        fetchKlines(asset, '15', 120)]
        );
        if (cancelled || !mounted.current) return;
        if (!pd || !pd.price) {
          push('ERROR', `${asset.id} — live price unavailable, retrying.`);
          return;
        }
        // Real OHLC candles power the verdict; synthetic only on outage.
        let candles =
        klines && klines.length >= 20 ?
        klines.slice() :
        makeCandles(pd.price, 40);
        const lastC = {
          ...candles[candles.length - 1]
        };
        lastC.close = pd.price;
        lastC.high = Math.max(lastC.high, pd.price);
        lastC.low = Math.min(lastC.low, pd.price);
        candles[candles.length - 1] = lastC;
        const v = generateVerdict(asset, pd, candles);
        push(
          'INFO',
          `${asset.id} @ ${fmtNum(v.price)} · RSI ${v.rsi} · src:${v.source}`
        );
        if (v.direction === 'BUY') {
          push(
            'BUY',
            `${asset.id} BUY · score ${v.score}/100 · conf ${v.confidence}% · entry ${fmtNum(v.entry)} SL ${fmtNum(v.sl)} TP ${fmtNum(v.tp)} (RR ${v.rr})`
          );
        } else if (v.direction === 'SELL') {
          push(
            'SELL',
            `${asset.id} SELL · score ${v.score}/100 · conf ${v.confidence}% · entry ${fmtNum(v.entry)} SL ${fmtNum(v.sl)} TP ${fmtNum(v.tp)} (RR ${v.rr})`
          );
        } else {
          push('SIGNAL', `${asset.id} NEUTRAL · ${v.entryStatus}`);
        }
        // God-level priority alert
        if (v.direction !== 'NEUTRAL' && v.confidence >= 90 && v.rr >= 3) {
          push(
            'PRIORITY',
            `GOD-LEVEL ${v.direction} on ${asset.id} — ${v.confidence}% confidence, RR ${v.rr}. ${v.perfectCandle.isPerfect ? 'Perfect candle confirmed.' : ''}`
          );
        }
        // Trap / manipulation alerts
        if (v.trap.type !== 'NO_TRAP') {
          push(
            'ALERT',
            `${asset.id} — ${v.trap.type.replace('_', ' ')} ${v.trap.confidence}% · ${v.trap.reason}`
          );
        }
      } catch (e: any) {
        if (!cancelled && mounted.current)
        push('ERROR', `${asset.id} — ${e?.message || 'engine error'}`);
      }
    };
    let timer: number | null = null;
    const start = () => {
      if (document.hidden || timer !== null) return;
      void tick();
      timer = window.setInterval(() => void tick(), 4000);
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
  }, [push]);
  // ── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
      activeTypes.has(l.type) && (
      q === '' ||
      l.msg.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q))
    );
  }, [logs, query, activeTypes]);
  const toggleType = (t: LogType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);else
      next.add(t);
      return next;
    });
  };
  const clearConsole = () => {
    setLogs([]);
    push('SYSTEM', 'Console cleared.');
  };
  const exportCsv = () => {
    const rows = [
    ['timestamp', 'iso', 'type', 'message'],
    ...filtered.map((l) => [
    fmtTs(l.ts),
    new Date(l.ts).toISOString(),
    l.type,
    `"${l.msg.replace(/"/g, '""')}"`]
    )];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <section
      aria-label="Live trading console"
      className="mb-3 rounded-lg border border-[#1f3a2a] bg-[#06080a] font-mono text-[11px]">
      
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#13241a] px-3 py-2">
        <div className="flex items-center gap-2 text-[#5ee0a0]">
          <TerminalIcon className="h-4 w-4" aria-hidden="true" />
          <span className="text-[12px] font-bold tracking-wide">
            LIVE CONSOLE
          </span>
          <span className="rounded bg-[#0d1f15] px-1.5 py-0.5 text-[9px] text-[#22e08a]">
            ● {filtered.length} lines
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 rounded border border-[#1f3a2a] bg-[#0a0f0c] px-2 py-1">
            <SearchIcon
              className="h-3.5 w-3.5 text-[#3f6650]"
              aria-hidden="true" />
            
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs…"
              aria-label="Filter console logs"
              className="w-32 bg-transparent text-[#cfe9da] placeholder-[#3f6650] outline-none sm:w-40" />
            
          </div>

          {/* Auto-scroll */}
          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            aria-pressed={autoScroll}
            className={`flex items-center gap-1 rounded border px-2 py-1 transition-colors ${autoScroll ? 'border-[#22e08a] bg-[#0d1f15] text-[#22e08a]' : 'border-[#1f3a2a] bg-[#0a0f0c] text-[#5e7a6c] hover:text-[#cfe9da]'}`}>
            
            <ArrowDownToLineIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Auto-scroll
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 rounded border border-[#1f3a2a] bg-[#0a0f0c] px-2 py-1 text-[#7dd3fc] transition-colors hover:bg-[#0d1f15]">
            
            <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
            CSV
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={clearConsole}
            className="flex items-center gap-1 rounded border border-[#3a1f1f] bg-[#120a0a] px-2 py-1 text-[#ff8a8a] transition-colors hover:bg-[#1a0d0d]">
            
            <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#13241a] px-3 py-2">
        {LOG_TYPES.map((t) => {
          const on = activeTypes.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              aria-pressed={on}
              className="rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider transition-opacity"
              style={{
                color: TYPE_COLOR[t],
                borderColor: on ? TYPE_COLOR[t] : '#1f3a2a',
                backgroundColor: on ? `${TYPE_COLOR[t]}1a` : 'transparent',
                opacity: on ? 1 : 0.4
              }}>
              
              {t}
            </button>);

        })}
      </div>

      {/* Log stream */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto px-3 py-2 leading-relaxed"
        role="log"
        aria-live="polite">
        
        {filtered.length === 0 ?
        <div className="flex h-full items-center justify-center text-[#3f6650]">
            No log entries match the current filter.
          </div> :

        filtered.map((l) =>
        <div
          key={l.id}
          className="flex gap-2 whitespace-pre-wrap break-words">
          
              <span className="shrink-0 text-[#3f6650]">{fmtTs(l.ts)}</span>
              <span
            className="shrink-0 font-bold"
            style={{
              color: TYPE_COLOR[l.type],
              width: 64,
              display: 'inline-block'
            }}>
            
                [{l.type}]
              </span>
              <span
            style={{
              color: TYPE_COLOR[l.type]
            }}>
            
                {l.msg}
              </span>
            </div>
        )
        }
      </div>
    </section>);

}