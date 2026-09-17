import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useScreenInit } from '../useScreenInit.js';
import type { BinanceCandle } from '../lib/trading/binanceWebSocket';
import {
  getMarketCandles,
  subscribeMarketCandles } from
'../lib/trading/marketCandles';
import {
  generateSignal,
  detectFVG,
  detectLiquiditySweeps,
  findSwingPoints,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  STOCK_SYMBOLS,
  type EngineSignal } from
'../lib/engine/engineV5';
import { EngineChart } from '../components/engine/EngineChart';
import {
  gatherHiddenIntel,
  scoreHiddenIntel,
  getActiveSession,
  type HiddenIntel,
  type SourceStatus } from
'../lib/engine/hiddenIntel';
type LogType = 'buy' | 'sell' | 'info' | 'warn' | 'big';
interface LogLine {
  id: number;
  type: LogType;
  text: string;
}
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const ANALYSIS_STAGES = [
'Fetching multi-timeframe data',
'Mapping market structure',
'Scanning liquidity',
'Checking order flow and CVD',
'Checking market news',
'Building trade plan'] as
const;
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

function dirText(d: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'): string {
  return d === 'BULLISH' ?
  'text-[#22c55e]' :
  d === 'BEARISH' ?
  'text-[#ef4444]' :
  'text-[#eab308]';
}
export function EngineDashboard() {
  useScreenInit();
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h');
  const [candles, setCandles] = useState<BinanceCandle[]>([]);
  const [live, setLive] = useState<BinanceCandle | null>(null);
  const [signal, setSignal] = useState<EngineSignal | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [ticker, setTicker] = useState({
    price: 0,
    changePct: 0,
    high: 0,
    low: 0,
    volume: 0
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [intel, setIntel] = useState<HiddenIntel | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const candlesRef = useRef<BinanceCandle[]>([]);
  const intelRef = useRef<HiddenIntel | null>(null);
  const intelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const logIdRef = useRef(0);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const log = useCallback((type: LogType, text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => {
      const next = [
      ...prev,
      {
        id: logIdRef.current++,
        type,
        text: `[${time}] ${text}`
      }];

      return next.slice(-100);
    });
  }, []);
  useEffect(() => {
    if (consoleRef.current)
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => {
    if (!analyzing) return;
    const timer = window.setInterval(() => {
      setAnalysisStage((current) => Math.min(current + 1, ANALYSIS_STAGES.length - 1));
      setAnalysisProgress((current) => Math.min(current + 15, 92));
    }, 850);
    return () => window.clearInterval(timer);
  }, [analyzing]);
  const runAnalysis = useCallback(
    (data: BinanceCandle[]) => {
      const h = intelRef.current;
      const hidden = h ? scoreHiddenIntel(h) : null;
      const session = h?.session ?? getActiveSession();
      const sig = generateSignal(data, {
        hiddenScore: hidden?.score ?? 0,
        hiddenReasons: hidden?.reasons ?? [],
        timeBias: session.bias,
        sessionName: session.name,
        sessionQuality: session.quality
      });
      if (!sig) {
        log('warn', 'Insufficient data for analysis');
        return;
      }
      setSignal(sig);
      // Console mirror of the vanilla engine output.
      if (sig.amd.phase !== 'UNKNOWN')
      log(
        'info',
        `AMD :: ${sig.amd.phase} detected (conf ${sig.amd.confidence}%)`
      );
      const fvgs = detectFVG(data);
      if (fvgs.length) {
        const f = fvgs[fvgs.length - 1];
        log(
          'info',
          `ICT :: ${f.type === 'bullish' ? 'Bullish' : 'Bearish'} FVG @ ${f.top.toFixed(2)} — ${f.bottom.toFixed(2)}`
        );
      }
      const sweeps = detectLiquiditySweeps(data, findSwingPoints(data));
      if (sweeps.length) {
        const s = sweeps[sweeps.length - 1];
        log(
          s.type === 'bullish' ? 'buy' : 'sell',
          `LIQ :: Sweep ${s.type === 'bullish' ? 'below' : 'above'} ${s.price.toFixed(2)} → ${s.type === 'bullish' ? 'reversal confirmed' : 'rejection confirmed'}`
        );
      }
      const dir = sig.direction;
      const lc: LogType =
      dir === 'BULLISH' ? 'buy' : dir === 'BEARISH' ? 'sell' : 'info';
      log(
        lc,
        `SIGNAL :: ${dir === 'BULLISH' ? 'BUY' : dir === 'BEARISH' ? 'SELL' : 'NEUTRAL'} @ ${sig.entry} SL ${sig.sl} TP ${sig.tp} RR 1:${sig.rr}`
      );
      const of = sig.orderFlow;
      log(
        'big',
        `BIG PLAYERS :: ${of.regime === 'STRONG_BUYING' ? 'Institutions accumulating ↑' : of.regime === 'STRONG_SELLING' ? 'Institutions distributing ↓' : 'Neutral'}`
      );
      log(
        'info',
        `OF :: ${of.regime.replace('_', ' ')} (Buy ${of.buyPressure}% / Sell ${of.sellPressure}%)`
      );
      log(
        lc,
        `PRIORITY :: ${dir} ${sig.confidence}% — ${sig.strategyStack.bullishCount}/${sig.strategyStack.strategies.length} strategies confirmed`
      );
    },
    [log]
  );
  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisProgress(6);
    setAnalysisStage(0);
    setLogs([]);
    setSignal(null);
    setConnected(false);
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    log('info', 'BULLER TRADING market engine');
    log('info', `Analyzing: ${symbol} (${timeframe})`);
    log('info', `${new Date().toLocaleString()}`);
    try {
      log('info', 'Fetching fresh zero-key market candles…');
      const data = await getMarketCandles(symbol, timeframe);
      setAnalysisProgress(24);
      setAnalysisStage(1);
      if (!data || data.length < 30) {
        log(
          'warn',
          'Could not load enough candles. The provider will retry automatically.'
        );
        return;
      }
      const snapshot = data.slice(-300);
      candlesRef.current = snapshot;
      setCandles(snapshot);
      const latest = snapshot[snapshot.length - 1];
      setTicker({
        price: latest.close,
        changePct:
        snapshot.length > 1 ?
        (latest.close - snapshot[0].open) / snapshot[0].open * 100 :
        0,
        high: Math.max(...snapshot.map((c) => c.high)),
        low: Math.min(...snapshot.map((c) => c.low)),
        volume: snapshot.reduce((sum, c) => sum + (c.volume || 0), 0)
      });
      log('info', `Loaded ${snapshot.length} real candles`);
      setAnalysisProgress(52);
      setAnalysisStage(3);
      // Scrape hidden institutional intelligence (graceful — never blocks).
      log(
        'info',
        'Scraping hidden intelligence (Congress · Insider · Whale · News · Economic)…'
      );
      const session = getActiveSession();
      log('big', `Session :: ${session.name} [${session.quality}]`);
      setAnalysisProgress(70);
      setAnalysisStage(4);
      try {
        const h = await gatherHiddenIntel(symbol);
        intelRef.current = h;
        setIntel(h);
        const hs = scoreHiddenIntel(h);
        log(
          hs.score > 0 ? 'buy' : hs.score < 0 ? 'sell' : 'info',
          `HIDDEN :: net score ${hs.score >= 0 ? '+' : ''}${hs.score} (${[h.congress, h.insider, h.whale, h.news, h.economic].filter((s: any) => s.status === 'connected').length}/5 sources live)`
        );
      } catch {
        log(
          'warn',
          'Hidden intel sources unavailable — running on technicals only.'
        );
      }
      setAnalysisProgress(88);
      setAnalysisStage(5);
      runAnalysis(snapshot);
      log('info', 'Analysis complete');
      setAnalysisProgress(100);
      setConnected(true);
      // Refresh hidden intel every 60s and re-score.
      if (intelTimerRef.current) clearInterval(intelTimerRef.current);
      intelTimerRef.current = setInterval(async () => {
        try {
          const h = await gatherHiddenIntel(symbol);
          intelRef.current = h;
          setIntel(h);
          if (candlesRef.current.length) runAnalysis(candlesRef.current);
        } catch {

          /* ignore */}
      }, 60000);
      // Live updates work for crypto, Gold, forex, indices and stocks.
      unsubRef.current = subscribeMarketCandles(symbol, timeframe, (c) => {
        setLive(c);
        setTicker((prev) => ({
          ...prev,
          price: c.close
        }));
        const arr = candlesRef.current.slice();
        const last = arr[arr.length - 1];
        if (last && last.timestamp === c.timestamp) arr[arr.length - 1] = c;else
        {
          arr.push(c);
          if (arr.length > 300) arr.shift();
        }
        candlesRef.current = arr;
        setCandles(arr.slice());
        if (c.isClosed) runAnalysis(arr);
      });
    } catch (err: unknown) {
      log(
        'warn',
        `Error: ${err instanceof Error ? err.message : 'unknown market error'}`
      );
    } finally {
      window.setTimeout(() => setAnalyzing(false), 250);
    }
  }, [symbol, timeframe, log, runAnalysis]);
  // Auto-analyze on first mount.
  useEffect(() => {
    const t = setTimeout(() => analyze(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (intelTimerRef.current) clearInterval(intelTimerRef.current);
    };
  }, []);
  const priceDec = ticker.price < 1 ? 5 : 2;
  const bigPlayer =
  signal && (
  signal.orderFlow.regime === 'STRONG_BUYING' ||
  signal.orderFlow.regime === 'STRONG_SELLING');
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0e17] text-[#f1f5f9] font-sans">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#111827] border-b border-[#1e293b] z-10">
        <div className="text-lg font-extrabold text-[#3b82f6]">
          TE <span className="text-[#94a3b8] text-xs font-normal">v5.0</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-[#1a1f2e] text-[#f1f5f9] border border-[#1e293b] rounded-md px-3 py-1.5 text-sm cursor-pointer focus:outline-none focus:border-[#3b82f6]"
            aria-label="Select symbol">
            
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
            className="bg-[#1a1f2e] text-[#f1f5f9] border border-[#1e293b] rounded-md px-3 py-1.5 text-sm cursor-pointer focus:outline-none focus:border-[#3b82f6]"
            aria-label="Select timeframe">
            
            {TIMEFRAMES.map((tf) =>
            <option key={tf} value={tf}>
                {tf}
              </option>
            )}
          </select>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors disabled:opacity-60">
            
            {analyzing ? 'ANALYZING…' : 'ANALYZE NOW'}
          </button>
          <span
            className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
            title={connected ? 'Connected' : 'Disconnected'}
            aria-label={connected ? 'Connected' : 'Disconnected'} />
          
          <button
            onClick={() => setShowSettings(true)}
            className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors text-xs font-bold leading-none px-1.5 py-1 border border-[#1e293b] rounded"
            title="Optional API keys"
            aria-label="Settings">
            
            API
          </button>
        </div>
      </header>

      {analyzing &&
      <div className="border-b border-[#1e293b] bg-[#0f1623] px-4 py-2" role="status" aria-live="polite">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-semibold text-[#cbd5e1]">{ANALYSIS_STAGES[analysisStage]}</span>
            <span className="font-mono text-[#3b82f6]">{analysisProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1e293b]">
            <div
            className="h-full rounded-full bg-[#3b82f6] transition-[width] duration-500 ease-out"
            style={{ width: `${analysisProgress}%` }} />
          
          </div>
        </div>
      }

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] overflow-hidden">
        {/* CHART */}
        <div className="relative bg-[#0a0e17] border-r border-[#1e293b] min-h-[300px]">
          <EngineChart candles={candles} live={live} />
        </div>

        {/* ANALYSIS PANEL */}
        <div className="flex flex-col gap-1.5 p-2 overflow-y-auto bg-[#111827]">
          {/* CONSOLE */}
          <div className="bg-[#000814] border border-[#1e3a5f] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-[#0a1628] px-3 py-2 border-b border-[#1e3a5f]">
              <span className="font-mono text-xs text-[#3b82f6]">
                REAL ENGINE CONSOLE
              </span>
              <span className="bg-[#22c55e] text-black px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                LIVE
              </span>
            </div>
            <div
              ref={consoleRef}
              className="p-2.5 font-mono text-[11px] h-44 overflow-y-auto leading-relaxed">
              
              {logs.map((l) =>
              <div
                key={l.id}
                className={
                l.type === 'buy' ?
                'text-[#22c55e]' :
                l.type === 'sell' ?
                'text-[#ef4444]' :
                l.type === 'warn' ?
                'text-[#eab308]' :
                l.type === 'big' ?
                'text-[#8b5cf6] font-bold' :
                'text-[#3b82f6]'
                }>
                
                  {l.text}
                </div>
              )}
            </div>
          </div>

          {/* SIGNAL BOX */}
          <div className="bg-[#1a1f2e] border border-[#1e293b] rounded-lg p-3">
            <div className="flex justify-between items-center font-bold mb-2">
              <span>SIGNAL</span>
              <span
                className={
                signal ? dirText(signal.direction) : 'text-[#94a3b8]'
                }>
                
                {signal ? signal.direction : 'WAITING'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <SignalRow label="Entry" value={signal?.entry ?? '--'} />
              <SignalRow label="Stop Loss" value={signal?.sl ?? '--'} />
              <SignalRow label="Take Profit" value={signal?.tp ?? '--'} />
              <SignalRow
                label="R:R Ratio"
                value={signal ? `1:${signal.rr}` : '--'} />
              
              <SignalRow
                label="Confidence"
                value={signal ? `${signal.confidence}%` : '--'} />
              
              <SignalRow label="Risk Level" value={signal?.riskLevel ?? '--'} />
            </div>
          </div>

          {/* SCORE METER */}
          <div className="grid grid-cols-3 gap-1.5">
            <ScorePill label="Technical" value={signal?.technicalScore} />
            <ScorePill label="Hidden" value={signal?.hiddenScore} />
            <ScorePill label="Total" value={signal?.totalScore} emphasize />
          </div>

          {/* HIDDEN INTELLIGENCE */}
          <div className="bg-[#1a1f2e] border border-[#1e293b] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs text-[#94a3b8] font-semibold">
                HIDDEN INTELLIGENCE
              </h4>
              <span className="text-[10px] text-[#64748b] font-mono">
                {intel?.session.name ?? '—'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <IntelCard
                icon=""
                label="CONGRESS"
                status={intel?.congress.status}
                value={
                intel?.congress.items.length ?
                `${intel.congress.items[0].politician} · ${intel.congress.items[0].transaction}` :
                'No trades'
                } />
              
              <IntelCard
                icon=""
                label="INSIDER"
                status={intel?.insider.status}
                value={
                intel?.insider.items.length ?
                `${intel.insider.items.length} filings` :
                'No filings'
                } />
              
              <IntelCard
                icon=""
                label="WHALE"
                status={intel?.whale.status}
                value={
                intel?.whale.items.length ?
                `${intel.whale.items[0].amount} BTC${intel.whale.items[0].toExchange ? ' → exch' : ''}` :
                'No alerts'
                } />
              
              <IntelCard
                icon=""
                label="SENTIMENT"
                status={intel?.news.status}
                value={
                intel?.news.status === 'connected' ?
                `${(intel.news.value.sentiment * 100).toFixed(0)}% · ${intel.news.value.count} hdl` :
                '—'
                } />
              
              <IntelCard
                icon=""
                label="ECONOMIC"
                status={intel?.economic.status}
                value={
                intel?.economic.items.length ?
                `${intel.economic.items[0].impact}: ${intel.economic.items[0].event}` :
                'No events'
                } />
              
              <IntelCard
                icon=""
                label="TIME ZONE"
                status={intel ? 'connected' : 'connecting'}
                value={
                intel ?
                `${intel.session.name} [${intel.session.quality}]` :
                '—'
                } />
              
            </div>
          </div>

          {/* SIGNAL REASONS */}
          {signal && signal.reasons.length > 0 &&
          <div className="bg-[#1a1f2e] border border-[#1e293b] rounded-lg p-2.5">
              <h4 className="text-xs text-[#94a3b8] font-semibold mb-1.5">
                SIGNAL REASONS
              </h4>
              <ul className="space-y-0.5">
                {signal.reasons.map((r, i) =>
              <li
                key={i}
                className="text-[11px] text-[#cbd5e1] leading-snug">
                
                    → {r}
                  </li>
              )}
              </ul>
            </div>
          }

          {/* BIG PLAYER ALERT */}
          {bigPlayer &&
          <div className="bg-[#8b5cf6] text-white text-center py-2.5 rounded-lg font-extrabold animate-pulse">
              BIG PLAYER DETECTED —{' '}
              {signal!.orderFlow.regime === 'STRONG_BUYING' ?
            'AGGRESSIVE ACCUMULATION' :
            'AGGRESSIVE DISTRIBUTION'}
            </div>
          }

          {/* DETECTION CARDS */}
          <div className="grid grid-cols-2 gap-1.5">
            <DetectionCard
              title="AMD Phase"
              value={
              signal ?
              `${signal.amd.phase} (${signal.amd.confidence}%)` :
              '--'
              }
              tone={signal ? amdTone(signal.amd.phase) : 'neutral'} />
            
            <DetectionCard
              title="SMC/ICT"
              value={smcText(signal)}
              tone={smcTone(signal)} />
            
            <DetectionCard
              title="Trap Detection"
              value={trapText(signal)}
              tone={trapTone(signal)} />
            
            <DetectionCard
              title="Order Flow"
              value={
              signal ?
              `Buy ${signal.orderFlow.buyPressure}% / Sell ${signal.orderFlow.sellPressure}% · ${signal.orderFlow.regime.replace('_', ' ')}` :
              '--'
              }
              tone={
              signal ?
              parseFloat(signal.orderFlow.buyPressure) > 55 ?
              'bull' :
              parseFloat(signal.orderFlow.sellPressure) > 55 ?
              'bear' :
              'neutral' :
              'neutral'
              } />
            
            <DetectionCard
              title="Hidden Candle"
              value={hiddenText(signal)}
              tone={hiddenTone(signal)} />
            
            <DetectionCard
              title="Next Candle"
              value={
              signal ?
              `${signal.prediction.direction} ${signal.prediction.confidence}% · H:${signal.prediction.predictedHigh} L:${signal.prediction.predictedLow}` :
              '--'
              }
              tone={
              signal ?
              signal.prediction.direction === 'BULLISH' ?
              'bull' :
              signal.prediction.direction === 'BEARISH' ?
              'bear' :
              'neutral' :
              'neutral'
              } />
            
          </div>

          {/* STRATEGY STACK */}
          <div className="bg-[#1a1f2e] border border-[#1e293b] rounded-lg p-2.5">
            <h4 className="text-xs text-[#94a3b8] font-semibold mb-1.5">
              10-Strategy Signal Stack
            </h4>
            <div className="flex flex-col gap-1">
              {signal ?
              signal.strategyStack.strategies.map((s) =>
              <div
                key={s.name}
                className="flex justify-between gap-2 px-2 py-1 bg-white/[0.02] rounded text-[11px]">
                
                    <span className="text-[#94a3b8]">{s.name}</span>
                    <span
                  className={
                  s.signal === 'BULLISH' ?
                  'text-[#22c55e] font-bold text-right' :
                  s.signal === 'BEARISH' ?
                  'text-[#ef4444] text-right' :
                  'text-[#eab308] text-right'
                  }>
                  
                      {s.signal} — {s.reason}
                    </span>
                  </div>
              ) :

              <div className="text-[11px] text-[#64748b] py-2 text-center">
                  Awaiting analysis…
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      {/* TICKER BAR */}
      <div className="flex items-center gap-5 px-4 py-1.5 bg-[#111827] border-t border-[#1e293b] font-mono text-xs">
        <span className="text-[#f1f5f9] font-bold">
          {symbol} {ticker.price ? `$${ticker.price.toFixed(priceDec)}` : '--'}
        </span>
        <span
          className={
          ticker.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
          }>
          
          {ticker.price ?
          `${ticker.changePct >= 0 ? '+' : ''}${ticker.changePct.toFixed(2)}%` :
          '--'}
        </span>
        <span className="text-[#94a3b8]">
          H: {ticker.high ? `$${ticker.high.toFixed(priceDec)}` : '--'}
        </span>
        <span className="text-[#94a3b8]">
          L: {ticker.low ? `$${ticker.low.toFixed(priceDec)}` : '--'}
        </span>
        <span className="text-[#94a3b8]">
          Vol: {ticker.volume ? `${(ticker.volume / 1000).toFixed(1)}K` : '--'}
        </span>
        {intel &&
        <span className="ml-auto text-[#8b5cf6] font-semibold">
            {intel.session.name} [{intel.session.quality}]
          </span>
        }
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>);

}
// ─── settings modal (optional API keys — scraping is the default) ───
function SettingsModal({ onClose }: {onClose: () => void;}) {
  const KEYS = [
  {
    id: 'finnhub',
    label: 'Finnhub'
  },
  {
    id: 'twelvedata',
    label: 'TwelveData'
  },
  {
    id: 'quiver',
    label: 'QuiverQuant'
  },
  {
    id: 'secapi',
    label: 'SEC API'
  },
  {
    id: 'whalealert',
    label: 'Whale Alert'
  },
  {
    id: 'marketaux',
    label: 'MarketAux'
  }];

  const [vals, setVals] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('te_ak') || '{}');
    } catch {
      return {};
    }
  });
  const save = () => {
    localStorage.setItem('te_ak', JSON.stringify(vals));
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true">
      
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#111827] border border-[#1e293b] rounded-xl p-5">
        
        <h2 className="text-base font-bold text-[#3b82f6] text-center mb-1">
          Optional API Keys
        </h2>
        <p className="text-[11px] text-[#94a3b8] text-center mb-4 leading-relaxed">
          Default mode is <span className="text-[#22c55e]">pure scraping</span>{' '}
          — no keys required. Add keys only if you want a fallback when public
          scraping is rate-limited.
        </p>
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
          {KEYS.map((k) =>
          <div key={k.id}>
              <label className="block text-[11px] text-[#94a3b8] mb-1">
                {k.label}
              </label>
              <input
              type="text"
              value={vals[k.id] || ''}
              onChange={(e) =>
              setVals((p) => ({
                ...p,
                [k.id]: e.target.value
              }))
              }
              placeholder={`${k.label} API key (optional)`}
              className="w-full bg-[#1a1f2e] border border-[#1e293b] rounded-md px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#3b82f6]" />
            
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-[#94a3b8] border border-[#1e293b] hover:text-[#f1f5f9]">
            
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb]">
            
            Save
          </button>
        </div>
      </div>
    </div>);

}
// ─── hidden-intel presentational helpers ───
function statusColor(s?: SourceStatus): string {
  return s === 'connected' ?
  'bg-[#22c55e]' :
  s === 'error' ?
  'bg-[#ef4444]' :
  'bg-[#eab308] animate-pulse';
}
function IntelCard({
  icon,
  label,
  status,
  value





}: {icon: string;label: string;status?: SourceStatus;value: string;}) {
  return (
    <div className="bg-[#0f1623] border border-[#1e293b] rounded-md p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor(status)}`} />
        <span className="text-[12px]">{icon}</span>
        <span className="text-[9px] tracking-wider text-[#64748b] font-bold">
          {label}
        </span>
      </div>
      <p className="text-[11px] text-[#cbd5e1] leading-snug truncate">
        {status === 'connecting' ? 'Scraping…' : value}
      </p>
    </div>);

}
function ScorePill({
  label,
  value,
  emphasize




}: {label: string;value?: number;emphasize?: boolean;}) {
  const v = value ?? 0;
  const color =
  value === undefined ?
  'text-[#64748b]' :
  v > 0 ?
  'text-[#22c55e]' :
  v < 0 ?
  'text-[#ef4444]' :
  'text-[#eab308]';
  return (
    <div
      className={`rounded-md p-2 text-center border ${emphasize ? 'border-[#8b5cf6]/50 bg-[#8b5cf6]/10' : 'border-[#1e293b] bg-[#1a1f2e]'}`}>
      
      <div className="text-[9px] tracking-wider text-[#64748b] font-bold uppercase">
        {label}
      </div>
      <div className={`text-base font-extrabold ${color}`}>
        {value === undefined ? '--' : `${v > 0 ? '+' : ''}${v}`}
      </div>
    </div>);

}
// ─── small presentational helpers ───
function SignalRow({ label, value }: {label: string;value: string;}) {
  return (
    <div className="flex justify-between px-2 py-1 bg-white/[0.03] rounded text-[13px]">
      <span className="text-[#94a3b8]">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>);

}
type Tone = 'bull' | 'bear' | 'neutral';
function toneClass(t: Tone): string {
  return t === 'bull' ?
  'text-[#22c55e]' :
  t === 'bear' ?
  'text-[#ef4444]' :
  'text-[#eab308]';
}
function DetectionCard({
  title,
  value,
  tone




}: {title: string;value: string;tone: Tone;}) {
  return (
    <div className="bg-[#1a1f2e] border border-[#1e293b] rounded-md p-2">
      <h4 className="text-[11px] text-[#94a3b8] mb-1">{title}</h4>
      <p
        className={`text-[12px] font-semibold leading-snug ${toneClass(tone)}`}>
        
        {value}
      </p>
    </div>);

}
function amdTone(phase: string): Tone {
  if (phase === 'ACCUMULATION' || phase === 'MARKUP') return 'bull';
  if (phase === 'DISTRIBUTION' || phase === 'MARKDOWN') return 'bear';
  return 'neutral';
}
function smcText(s: EngineSignal | null): string {
  if (!s) return '--';
  const parts: string[] = [];
  if (s.fvgs.length)
  parts.push(
    `FVG: ${s.fvgs[s.fvgs.length - 1].type === 'bullish' ? 'Bullish ↑' : 'Bearish ↓'}`
  );
  if (s.orderBlocks.length)
  parts.push(
    `OB: ${s.orderBlocks[s.orderBlocks.length - 1].type === 'bullish' ? 'Bullish ↑' : 'Bearish ↓'}`
  );
  if (s.sweeps.length)
  parts.push(
    `Sweep: ${s.sweeps[s.sweeps.length - 1].type === 'bullish' ? 'Bullish ↑' : 'Bearish ↓'}`
  );
  return parts.length ? parts.join(' · ') : 'No significant SMC signals';
}
function smcTone(s: EngineSignal | null): Tone {
  const t = smcText(s);
  return t.includes('Bullish') ?
  'bull' :
  t.includes('Bearish') ?
  'bear' :
  'neutral';
}
function trapText(s: EngineSignal | null): string {
  if (!s) return '--';
  if (s.traps.length) {
    const t = s.traps[s.traps.length - 1];
    return `${t.type} (${t.confidence}% conf)`;
  }
  return 'No traps detected';
}
function trapTone(s: EngineSignal | null): Tone {
  if (!s || !s.traps.length) return 'bull';
  return s.traps[s.traps.length - 1].type.includes('BEAR') ? 'bull' : 'bear';
}
function hiddenText(s: EngineSignal | null): string {
  if (!s) return '--';
  if (!s.hiddenPatterns.length) return 'No hidden patterns';
  const h = s.hiddenPatterns[s.hiddenPatterns.length - 1];
  return `${h.type.replace(/_/g, ' ').toLowerCase()} (${h.strength})`;
}
function hiddenTone(s: EngineSignal | null): Tone {
  if (!s || !s.hiddenPatterns.length) return 'neutral';
  return s.hiddenPatterns[s.hiddenPatterns.length - 1].type.includes('BULLISH') ?
  'bull' :
  'bear';
}
export default EngineDashboard;