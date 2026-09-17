import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ZapIcon,
  TargetIcon,
  ShieldAlertIcon,
  RefreshCwIcon,
  RadarIcon,
  ActivityIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  CandlestickChartIcon,
  Building2Icon,
  CheckCircle2Icon,
  CircleDashedIcon } from
'lucide-react';
import { useSelectedSymbol } from '../../context/SelectedSymbolContext';
import {
  SYMBOLS,
  MARKET_TABS,
  TIMEFRAMES,
  findAsset,
  fetchPrice,
  fetchKlines,
  makeCandles,
  fmtNum,
  getMarketStatus } from
'../../lib/terminal/market';
import type { TCandle, Asset } from '../../lib/terminal/market';
import { generateVerdict } from '../../lib/terminal/engine';
import type { GodVerdict } from '../../lib/terminal/engine';
import { detectBigMove } from '../../lib/terminal/opportunity';
import { TradingViewChart } from './TradingViewChart';
import { BigMoveGrid } from './BigMoveGrid';
import { HigherTfGrid } from './HigherTfGrid';
const POLL_MS = 15000;
export function GodSignalTerminal() {
  const {
    marketType,
    symbolId,
    timeframe,
    setMarketType,
    setSymbol,
    setTimeframe
  } = useSelectedSymbol();
  const asset = findAsset(symbolId) || findAsset('BTCUSDT')!;
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[2];
  const [verdict, setVerdict] = useState<GodVerdict | null>(null);
  const [candles, setCandles] = useState<TCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realData, setRealData] = useState(false);
  // Real OHLC klines cached per asset+timeframe. Refreshed on every poll so
  // the analysis runs on genuine market candles, never synthetic data.
  const candleCache = useRef<Record<string, TCandle[]>>({});
  const fetchData = useCallback(async () => {
    const cacheKey = `${asset.id}_${tf.tvInterval}`;
    try {
      // Pull the live last price AND the real historical klines in parallel.
      const [pd, klines] = await Promise.all([
      fetchPrice(asset.id),
      fetchKlines(asset, tf.tvInterval, 300)]
      );
      // Prefer freshly-fetched real klines; otherwise reuse the last good set.
      let cc: TCandle[] | null =
      klines && klines.length >= 20 ? klines : candleCache.current[cacheKey];
      const isReal = !!(klines && klines.length >= 20);
      setRealData(isReal);
      if (!cc || cc.length < 20) {
        // No real candles available yet (rare provider outage) — seed once so
        // the panel still renders. This is clearly flagged as non-live below.
        cc = makeCandles(pd?.price ?? cc?.[cc.length - 1]?.close ?? 0, 60);
      } else {
        // Snap the most recent candle's close to the live tick for freshness.
        cc = cc.slice();
        if (pd?.price) {
          const last = {
            ...cc[cc.length - 1]
          };
          last.close = pd.price;
          last.high = Math.max(last.high, pd.price);
          last.low = Math.min(last.low, pd.price);
          cc[cc.length - 1] = last;
        }
      }
      candleCache.current[cacheKey] = cc.slice(-300);
      const cacheKeys = Object.keys(candleCache.current);
      if (cacheKeys.length > 12) {
        cacheKeys.slice(0, cacheKeys.length - 12).forEach((key) => {
          delete candleCache.current[key];
        });
      }
      const priceData = pd ?? {
        price: cc[cc.length - 1].close,
        volume: cc[cc.length - 1].volume,
        source: isReal ? 'klines' : 'fallback'
      };
      setVerdict(generateVerdict(asset, priceData, cc));
      setCandles(cc);
      setLastUpdate(new Date());
    } catch {

      /* ignore — keep the last verdict on screen */} finally {
      setLoading(false);
    }
  }, [asset, tf.tvInterval]);
  useEffect(() => {
    setLoading(true);
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (document.visibilityState !== 'visible' || timer !== null) return;
      timer = window.setInterval(fetchData, POLL_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchData();
        start();
      } else stop();
    };
    if (document.visibilityState === 'visible') void fetchData();
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchData]);
  const dirColor =
  verdict?.direction === 'BUY' ?
  'text-buy' :
  verdict?.direction === 'SELL' ?
  'text-sell' :
  'text-warn';
  const symbolsForMarket = SYMBOLS[marketType] || [];
  // Real big-move detection on the SELECTED timeframe — fires only on a
  // genuine volatility expansion + high-conviction setup + real footprint.
  const bigMove = useMemo(
    () => detectBigMove(verdict, candles),
    [verdict, candles]
  );
  return (
    <div className="space-y-3">
      {/* ── STATUS BAR ── */}
      <StatusStrip
        verdict={verdict}
        asset={asset}
        tf={tf.label}
        loading={loading}
        realData={realData} />
      

      {/* ── CONTROLS ── */}
      <div className="bg-bg-600 border border-line rounded-md p-2 space-y-2">
        {/* Market tabs */}
        <div className="flex flex-wrap gap-1.5">
          {MARKET_TABS.map((m) =>
          <button
            key={m.type}
            onClick={() => setMarketType(m.type)}
            className={`px-2.5 py-1 rounded text-2xs font-bold uppercase tracking-wider border transition-colors ${marketType === m.type ? 'bg-brand/15 border-brand text-brand' : 'bg-bg-700 border-line text-ink-muted hover:text-ink hover:border-line-strong'}`}>
            
              {m.label}
            </button>
          )}
        </div>

        {/* Symbol + timeframe row */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={symbolId}
            onChange={(e) => setSymbol(e.target.value)}
            className="cursor-pointer rounded border border-line bg-bg-700 px-2 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none">
            
            {symbolsForMarket.map((s) =>
            <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            )}
          </select>

          <div className="flex gap-1">
            {TIMEFRAMES.map((t) =>
            <button
              key={t.id}
              onClick={() => setTimeframe(t.id)}
              className={`px-2 py-1 rounded text-2xs font-mono border transition-colors ${timeframe === t.id ? 'bg-brand/15 border-brand text-brand' : 'bg-bg-700 border-line text-ink-muted hover:text-ink'}`}>
              
                {t.label}
              </button>
            )}
          </div>

          <button
            onClick={fetchData}
            className="ml-auto flex items-center gap-1.5 rounded border border-line bg-bg-700 px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-ink-muted hover:text-ink hover:border-line-strong transition-colors">
            
            <RefreshCwIcon
              className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            
            Refresh
          </button>
        </div>
      </div>

      {/* ── BIG MOVE INCOMING (selected timeframe) ── */}
      <BigMoveGrid alert={bigMove} assetLabel={asset.id} tfLabel={tf.label} />

      {/* ── CHART + DETAILS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
        <div className="min-w-0 space-y-3">
          {/* Full-size, responsive live chart. Tall on every device;
            fills its sized wrapper (autosize handles width). */}
          <div className="h-[60vh] min-h-[440px] lg:h-[74vh] xl:h-[78vh] w-full">
            <TradingViewChart
              key={`${asset.tvId}-${tf.tvInterval}`}
              tvId={asset.tvId}
              interval={tf.tvInterval}
              height="100%" />
            
          </div>

          {/* SIGNAL MATRIX */}
          {verdict &&
          <div className="bg-bg-600 border border-line rounded-md p-3">
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <RadarIcon className="w-3 h-3 text-brand" />
                Signal Matrix · 7 Sub-Systems
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {verdict.subSignals.map((s, i) =>
              <div
                key={i}
                className={`rounded p-2 border ${s.status === 'bullish' ? 'bg-buy/10 border-buy/30' : s.status === 'bearish' ? 'bg-sell/10 border-sell/30' : 'bg-bg-700 border-line'}`}>
                
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-ink-muted">{s.name}</span>
                      <span
                    className={`w-2 h-2 rounded-full ${s.status === 'bullish' ? 'bg-buy' : s.status === 'bearish' ? 'bg-sell' : 'bg-warn'}`} />
                  
                    </div>
                    <div className="text-2xs text-ink mt-1 font-mono">
                      {s.detail}
                    </div>
                    <div className="text-3xs text-ink-dim mt-0.5">
                      Weight {s.weight}%
                    </div>
                  </div>
              )}
              </div>
            </div>
          }
        </div>

        {/* RIGHT: trade plan + trap + hidden data */}
        {verdict &&
        <div className="space-y-3">
            {/* TRADE PLAN */}
            <div
            className={`bg-bg-600 border border-line border-l-4 rounded-md p-3 ${verdict.direction === 'BUY' ? 'border-l-buy' : verdict.direction === 'SELL' ? 'border-l-sell' : 'border-l-warn'}`}>
            
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <TargetIcon className="w-3 h-3" />
                Trade Plan
              </div>
              <div className="flex items-end justify-between">
                <span className={`font-mono text-3xl font-bold ${dirColor}`}>
                  {verdict.direction}
                </span>
                <span className="font-mono text-sm text-ink">
                  {verdict.confidence}%
                </span>
              </div>
              <div className="h-1 mt-2 bg-bg-800 rounded-sm overflow-hidden">
                <div
                className={`h-full ${verdict.direction === 'BUY' ? 'bg-buy' : verdict.direction === 'SELL' ? 'bg-sell' : 'bg-warn'}`}
                style={{
                  width: `${Math.min(100, verdict.confidence)}%`
                }} />
              
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-2xs">
                <Level label="Entry" value={fmtNum(verdict.entry)} tone="ink" />
                <Level label="Stop" value={fmtNum(verdict.sl)} tone="sell" />
                <Level label="Target" value={fmtNum(verdict.tp)} tone="buy" />
              </div>
              <div className="text-3xs text-ink-dim mt-2 leading-relaxed">
                {verdict.reason}
              </div>
            </div>

            {/* MULTI-TP */}
            {verdict.tpLevels &&
          <div className="bg-bg-600 border border-line rounded-md p-3">
                <div className="text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                  Multi-TP Targets · R:R 1:{verdict.rr}
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-2xs">
                  {(['tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'tp6'] as const).map(
                (k, idx) =>
                <div key={k} className="flex justify-between">
                        <span className="text-ink-dim">TP{idx + 1}</span>
                        <span className="text-buy">
                          ${fmtNum(verdict.tpLevels![k])}
                        </span>
                      </div>

              )}
                </div>
              </div>
          }

            {/* TRAP */}
            <div
            className={`rounded-md p-3 border ${verdict.trap.type === 'BULL_TRAP' ? 'bg-sell/10 border-sell/40 border-l-4 border-l-sell' : verdict.trap.type === 'BEAR_TRAP' ? 'bg-buy/10 border-buy/40 border-l-4 border-l-buy' : 'bg-bg-600 border-line'}`}>
            
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] font-bold">
                  <ShieldAlertIcon
                  className={`w-3.5 h-3.5 ${verdict.trap.type === 'BULL_TRAP' ? 'text-sell' : verdict.trap.type === 'BEAR_TRAP' ? 'text-buy' : 'text-ink-dim'}`} />
                
                  <span
                  className={
                  verdict.trap.type === 'BULL_TRAP' ?
                  'text-sell' :
                  verdict.trap.type === 'BEAR_TRAP' ?
                  'text-buy' :
                  'text-ink-muted'
                  }>
                  
                    {verdict.trap.type === 'NO_TRAP' ?
                  'No Trap' :
                  verdict.trap.type.replace('_', ' ') + ' Detected'}
                  </span>
                </div>
                {verdict.trap.type !== 'NO_TRAP' &&
              <span className="font-mono text-2xs text-ink">
                    {verdict.trap.confidence}%
                  </span>
              }
              </div>
              <div className="text-3xs text-ink-muted leading-relaxed">
                {verdict.trap.reason}
              </div>
            </div>

            {/* HIDDEN INDICATORS */}
            <div className="bg-bg-600 border border-line rounded-md p-3">
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <ActivityIcon className="w-3 h-3 text-brand" />
                Hidden Indicators
              </div>
              <div className="space-y-1.5">
                {verdict.hiddenIndicators.map((h, i) =>
              <div
                key={i}
                className={`flex items-center justify-between rounded px-2 py-1 border ${h.isWarning ? 'bg-sell/10 border-sell/30' : 'bg-bg-700 border-line'}`}>
                
                    <div className="min-w-0">
                      <div className="text-2xs text-ink truncate">{h.name}</div>
                      <div className="text-3xs text-ink-dim truncate">
                        {h.detail}
                      </div>
                    </div>
                    <span
                  className={`font-mono text-2xs font-bold shrink-0 ml-2 ${h.isWarning ? 'text-sell' : 'text-buy'}`}>
                  
                      {h.value}
                    </span>
                  </div>
              )}
              </div>
            </div>

            {/* TECHNICALS */}
            <div className="bg-bg-600 border border-line rounded-md p-3">
              <div className="text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                Technicals
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-2xs">
                <Tech
                label="RSI"
                value={`${verdict.rsi}`}
                tone={
                verdict.rsi > 70 ? 'sell' : verdict.rsi < 30 ? 'buy' : 'ink'
                } />
              
                <Tech label="ATR" value={fmtNum(verdict.atr)} tone="ink" />
                <Tech label="EMA9" value={fmtNum(verdict.ema9)} tone="ink" />
                <Tech label="EMA21" value={fmtNum(verdict.ema21)} tone="ink" />
                <Tech label="EMA50" value={fmtNum(verdict.ema50)} tone="ink" />
                <Tech
                label="Inst"
                value={`${verdict.instRatio}%`}
                tone={
                verdict.instRatio > 52 ?
                'buy' :
                verdict.instRatio < 48 ?
                'sell' :
                'ink'
                } />
              
              </div>
            </div>
          </div>
        }
      </div>

      {/* ── INTELLIGENCE GRID: prediction · patterns · real direction · confirmed entry ── */}
      {verdict &&
      <div className="bg-bg-700 border border-line rounded-md p-2 lg:p-3">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2 px-1">
            <RadarIcon className="w-3 h-3 text-brand" />
            Hidden Intelligence · Complete Read
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* NEXT CANDLE PREDICTOR */}
            <div className="bg-bg-600 border border-line rounded-md p-3">
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <CandlestickChartIcon className="w-3 h-3 text-brand" />
                Next Candle Predictor
              </div>
              <div className="flex items-end justify-between">
                <span
                className={`font-mono text-2xl font-bold ${verdict.prediction.next === 'BULLISH' ? 'text-buy' : verdict.prediction.next === 'BEARISH' ? 'text-sell' : 'text-warn'}`}>
                
                  {verdict.prediction.next}
                </span>
                <span className="font-mono text-sm text-ink">
                  {verdict.prediction.probability}%
                </span>
              </div>
              <div className="h-1 mt-2 bg-bg-800 rounded-sm overflow-hidden">
                <div
                className={`h-full ${verdict.prediction.next === 'BULLISH' ? 'bg-buy' : verdict.prediction.next === 'BEARISH' ? 'bg-sell' : 'bg-warn'}`}
                style={{
                  width: `${verdict.prediction.probability}%`
                }} />
              
              </div>
              <div className="text-3xs text-ink-muted mt-2 leading-relaxed">
                {verdict.prediction.detail}
              </div>
            </div>

            {/* CANDLESTICK PATTERNS */}
            <div className="bg-bg-600 border border-line rounded-md p-3">
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <CandlestickChartIcon className="w-3 h-3 text-brand" />
                Candlestick Patterns
              </div>
              {verdict.candlePatterns.length > 0 ?
            <div className="space-y-1.5">
                  {verdict.candlePatterns.map((p, i) =>
              <div
                key={i}
                className={`flex items-center justify-between rounded px-2 py-1 border ${p.type === 'bullish' ? 'bg-buy/10 border-buy/30' : p.type === 'bearish' ? 'bg-sell/10 border-sell/30' : 'bg-bg-700 border-line'}`}>
                
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                    className={`w-2 h-2 rounded-full shrink-0 ${p.type === 'bullish' ? 'bg-buy' : p.type === 'bearish' ? 'bg-sell' : 'bg-warn'}`} />
                  
                        <div className="min-w-0">
                          <div className="text-2xs text-ink truncate">
                            {p.name}
                          </div>
                          <div className="text-3xs text-ink-dim truncate">
                            {p.detail}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-2xs font-bold shrink-0 ml-2 text-ink">
                        {p.strength}%
                      </span>
                    </div>
              )}
                </div> :

            <div className="text-3xs text-ink-dim">
                  No strong pattern on the current candle.
                </div>
            }
            </div>

            {/* REAL DIRECTION — MARKET vs INSTITUTIONS */}
            <div
            className={`rounded-md p-3 border ${!verdict.realDirection.aligned && verdict.realDirection.institutional !== 'NEUTRAL' ? 'bg-warn/10 border-warn/40 border-l-4 border-l-warn' : 'bg-bg-600 border-line'}`}>
            
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                <Building2Icon className="w-3 h-3 text-brand" />
                Real Direction · Market vs Institutions
              </div>
              <div className="space-y-1.5">
                <DirRow
                label="Market move"
                dir={verdict.realDirection.market} />
              
                <DirRow
                label="Institutions"
                dir={verdict.realDirection.institutional} />
              
                <div className="flex justify-between items-center pt-1 border-t border-line/50">
                  <span className="text-2xs text-ink-muted">Status</span>
                  <span
                  className={`text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${verdict.realDirection.aligned ? 'bg-buy/15 text-buy' : 'bg-warn/15 text-warn'}`}>
                  
                    {verdict.realDirection.aligned ? 'Aligned' : 'Divergence'}
                  </span>
                </div>
              </div>
              <div className="text-3xs text-ink-muted mt-2 leading-relaxed">
                {verdict.realDirection.note}
              </div>
            </div>

            {/* CONFIRMED ENTRY · PERFECT CANDLE */}
            <div
            className={`rounded-md p-3 border ${verdict.perfectCandle.isPerfect ? verdict.perfectCandle.side === 'BUY' ? 'bg-buy/10 border-buy/40 border-l-4 border-l-buy' : 'bg-sell/10 border-sell/40 border-l-4 border-l-sell' : 'bg-bg-600 border-line'}`}>
            
              <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
                {verdict.perfectCandle.isPerfect ?
              <CheckCircle2Icon
                className={`w-3 h-3 ${verdict.perfectCandle.side === 'BUY' ? 'text-buy' : 'text-sell'}`} /> :


              <CircleDashedIcon className="w-3 h-3 text-ink-dim" />
              }
                Confirmed Entry · Perfect Candle
              </div>
              <div
              className={`font-mono text-lg font-bold ${verdict.perfectCandle.isPerfect ? verdict.perfectCandle.side === 'BUY' ? 'text-buy' : 'text-sell' : 'text-ink-muted'}`}>
              
                {verdict.perfectCandle.isPerfect ?
              `PERFECT ${verdict.perfectCandle.side} CANDLE` :
              'Waiting for perfect candle'}
              </div>
              <div className="text-3xs text-ink-dim mt-1 font-mono uppercase tracking-wider">
                {verdict.entryStatus}
              </div>
              {verdict.direction !== 'NEUTRAL' &&
            <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-2xs">
                  <Level
                label="Entry"
                value={fmtNum(verdict.entry)}
                tone="ink" />
              
                  <Level label="Stop" value={fmtNum(verdict.sl)} tone="sell" />
                  <Level label="Target" value={fmtNum(verdict.tp)} tone="buy" />
                </div>
            }
              <div className="text-3xs text-ink-muted mt-2 leading-relaxed">
                {verdict.perfectCandle.detail}
              </div>
            </div>
          </div>
        </div>
      }

      {/* ── HIGHER-TIMEFRAME OPPORTUNITY SUGGESTIONS ── */}
      <HigherTfGrid asset={asset} selectedTf={timeframe} />

      <div className="flex flex-wrap justify-between gap-2 text-3xs text-ink-dim font-mono px-1">
        <span>
          Sources: TradingView · Binance · Yahoo · currency-api — zero API keys
        </span>
        <span>
          {verdict?.source ? `Live via ${verdict.source}` : '—'} ·{' '}
          {lastUpdate ? lastUpdate.toLocaleTimeString() : 'loading'}
        </span>
      </div>
    </div>);

}
function StatusStrip({
  verdict,
  asset,
  tf,
  loading,
  realData






}: {verdict: GodVerdict | null;asset: Asset;tf: string;loading: boolean;realData: boolean;}) {
  const dir = verdict?.direction || 'NEUTRAL';
  const dirColor =
  dir === 'BUY' ? 'text-buy' : dir === 'SELL' ? 'text-sell' : 'text-warn';
  const market = getMarketStatus(asset.type);
  return (
    <div className="sticky top-2 z-10 bg-bg-700 border border-line rounded-md px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2">
          <ZapIcon className="w-4 h-4 text-brand" />
          <span className="font-bold text-ink text-sm">BULLER TRADING Signal</span>
          <span className="text-3xs uppercase tracking-wider bg-brand/15 text-brand px-1.5 py-0.5 rounded">
            {loading ? 'SYNC' : 'LIVE'}
          </span>
          <span
            title={
            realData ?
            'Analysis is running on real market OHLC candles' :
            'Live data source warming up — showing a temporary estimate'
            }
            className={`text-3xs uppercase tracking-wider px-1.5 py-0.5 rounded border ${realData ? 'bg-buy/10 border-buy/30 text-buy' : 'bg-warn/10 border-warn/30 text-warn'}`}>
            
            {realData ? 'Real OHLC' : 'Warming up'}
          </span>
        </div>

        {/* Real market open/closed status for the selected asset class */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${market.open ? 'bg-buy/10 border-buy/30' : 'bg-sell/10 border-sell/30'}`}
          title={market.detail}>
          
          <span
            className={`w-1.5 h-1.5 rounded-full ${market.open ? 'bg-buy dot-pulse' : 'bg-sell'}`} />
          
          <span
            className={`text-3xs uppercase tracking-wider font-bold ${market.open ? 'text-buy' : 'text-sell'}`}>
            
            {market.label}
          </span>
          <span className="hidden sm:inline text-3xs text-ink-dim">
            {market.detail}
          </span>
        </div>

        <div className="font-mono text-2xs text-ink-muted">
          {asset.name} <span className="text-ink-dim">({asset.id})</span> · {tf}
        </div>

        <div className="font-mono text-sm">
          <span className="text-ink-dim text-2xs">Price </span>
          <span className="text-ink font-bold">${fmtNum(verdict?.price)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold ${dirColor}`}>{dir}</span>
          <span className="font-mono text-2xs text-ink-muted">
            {verdict?.confidence ?? 0}%
          </span>
        </div>

        <div className="font-mono text-2xs flex items-center gap-3">
          <span className="text-ink-dim">
            E <span className="text-ink">${fmtNum(verdict?.entry)}</span>
          </span>
          <span className="text-ink-dim">
            SL <span className="text-sell">${fmtNum(verdict?.sl)}</span>
          </span>
          <span className="text-ink-dim">
            TP <span className="text-buy">${fmtNum(verdict?.tp)}</span>
          </span>
          {verdict?.rr ?
          <span className="text-ink-dim">
              R:R <span className="text-warn">1:{verdict.rr}</span>
            </span> :
          null}
        </div>

        {verdict && verdict.trap.type !== 'NO_TRAP' &&
        <span
          className={`text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${verdict.trap.type === 'BULL_TRAP' ? 'bg-sell/15 text-sell' : 'bg-buy/15 text-buy'}`}>
          
            {verdict.trap.type.replace('_', ' ')} {verdict.trap.confidence}%
          </span>
        }

        <span className="font-mono text-3xs text-ink-dim ml-auto">
          {verdict?.entryStatus}
        </span>
      </div>
    </div>);

}
function Level({
  label,
  value,
  tone




}: {label: string;value: string;tone: 'buy' | 'sell' | 'ink';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="bg-bg-700 border border-line rounded p-1.5">
      <div className="text-3xs text-ink-dim uppercase">{label}</div>
      <div className={`font-bold ${color}`}>${value}</div>
    </div>);

}
function DirRow({ label, dir }: {label: string;dir: string;}) {
  const color =
  dir === 'BUY' ? 'text-buy' : dir === 'SELL' ? 'text-sell' : 'text-warn';
  const Icon =
  dir === 'BUY' ?
  TrendingUpIcon :
  dir === 'SELL' ?
  TrendingDownIcon :
  MinusIcon;
  return (
    <div className="flex justify-between items-center text-2xs">
      <span className="text-ink-muted">{label}</span>
      <span className={`flex items-center gap-1 font-bold ${color}`}>
        <Icon className="w-3 h-3" />
        {dir}
      </span>
    </div>);

}
function Tech({
  label,
  value,
  tone




}: {label: string;value: string;tone: 'buy' | 'sell' | 'ink';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="flex justify-between">
      <span className="text-ink-dim">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>);

}