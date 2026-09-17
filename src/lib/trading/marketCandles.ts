// ============================================================
// UNIFIED ZERO-KEY REALTIME CANDLE PROVIDER
// ------------------------------------------------------------
// One feed for EVERY asset class — no API keys, ever:
//
//   • CRYPTO        → Binance public klines + live WebSocket
//   • FOREX         → Yahoo Finance v8 chart  (EURUSD=X …)
//   • METALS        → Yahoo Finance v8 chart  (GC=F gold, SI=F silver …)
//   • COMMODITIES   → Yahoo Finance v8 chart  (CL=F oil, NG=F gas …)
//   • INDICES       → Yahoo Finance v8 chart  (^GSPC, ^IXIC …)
//   • STOCKS        → Yahoo Finance v8 chart  (AAPL, TSLA …)
//
// Returns REAL OHLC candles in the same BinanceCandle shape the rest of
// the engine + chart already consume. Yahoo's chart endpoint is blocked
// by browser CORS, so we route every request through a rotating chain of
// public, key-free CORS relays and try both Yahoo hosts (query1/query2).
// Successful pulls are cached so a transient relay failure never blanks
// the chart — we serve the last good candles while retrying.
// ============================================================

import { isCrypto } from '../engine/engineV5';
import { createAbortController, toFetchSignal } from '../utils/abortController';
import { binanceWS, type BinanceCandle } from './binanceWebSocket';

export type { BinanceCandle };

export interface MarketCandleSource {
  provider: 'Binance' | 'Yahoo Finance';
  ticker: string;
  label: string;
  isProxy: boolean;
  delayed: boolean;
}

export interface MarketCandleSnapshot {
  candles: BinanceCandle[];
  source: MarketCandleSource;
  marketTimestamp: number;
}

// ── Binance proxy tickers for non-crypto assets ────────────
// PAXG/USDT is a liquid tokenized-gold proxy, not the raw OTC XAU/USD spot
// market. Callers receive explicit source metadata so the UI never presents
// proxy candles as direct spot data.
const BINANCE_PROXY: Record<string, string> = {
  XAUUSD: 'PAXGUSDT'
};

/** Binance natively supports these kline intervals. */
const BINANCE_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

function binanceProxy(symbol: string): string | null {
  const p = BINANCE_PROXY[symbol];
  return p ?? null;
}

// ── Symbol → Yahoo ticker mapping ──────────────────────────
// Anything not crypto resolves to a Yahoo Finance ticker.
const YAHOO_TICKERS: Record<string, string> = {
  // Forex
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'CAD=X',
  NZDUSD: 'NZDUSD=X',
  USDCHF: 'CHF=X',
  // Metals
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  XPTUSD: 'PL=F',
  XPDUSD: 'PA=F',
  HGUSD: 'HG=F',
  // Commodities
  WTIUSD: 'CL=F',
  BRENTUSD: 'BZ=F',
  NATGAS: 'NG=F',
  CORN: 'ZC=F',
  WHEAT: 'ZW=F',
  COFFEE: 'KC=F',
  // Indices
  SPX: '^GSPC',
  NDX: '^IXIC',
  DJI: '^DJI',
  RUT: '^RUT',
  VIX: '^VIX',
  FTSE: '^FTSE',
  DAX: '^GDAXI',
  NIKKEI: '^N225',
  DXY: 'DX-Y.NYB'
};

/** Resolve the Yahoo ticker for a non-crypto symbol (stocks map 1:1). */
function yahooTicker(symbol: string): string {
  return YAHOO_TICKERS[symbol] ?? symbol;
}

// ── Timeframe → Yahoo (interval, range) ────────────────────
// Yahoo supports 1m/2m/5m/15m/30m/60m/90m/1d/1wk/1mo. There is no native
// 4h, so we request 60m over a longer range and aggregate into 4h buckets.
// Ranges are kept generous so every timeframe returns well over the 40
// candles the trap engine needs to run.
function yahooParams(tf: string): {
  interval: string;
  range: string;
  aggregate?: number;
} {
  switch (tf) {
    case '1m':
      return { interval: '1m', range: '1d' };
    case '5m':
      return { interval: '5m', range: '5d' };
    case '15m':
      return { interval: '15m', range: '1mo' };
    case '30m':
      return { interval: '30m', range: '1mo' };
    case '1h':
      return { interval: '60m', range: '3mo' };
    case '4h':
      return { interval: '60m', range: '6mo', aggregate: 4 };
    case '1d':
      return { interval: '1d', range: '2y' };
    case '1w':
      return { interval: '1wk', range: '10y' };
    case '1mo':
      return { interval: '1mo', range: 'max' };
    default:
      return { interval: '60m', range: '3mo' };
  }
}

// ── CORS-friendly fetch chain (zero key) ───────────────────
// Yahoo's chart endpoint blocks browser CORS, so we try a rotating chain
// of public, key-free relays. Order matters: the most reliable relays go
// first. We also alternate the underlying Yahoo host (query1/query2) so a
// single host hiccup doesn't take us down.
function buildCandidates(yahooUrl1: string, yahooUrl2: string): string[] {
  const enc1 = encodeURIComponent(yahooUrl1);
  const enc2 = encodeURIComponent(yahooUrl2);
  return [
  // allorigins is the most consistently CORS-open relay
  `https://api.allorigins.win/raw?url=${enc1}`,
  `https://corsproxy.io/?url=${enc1}`,
  `https://thingproxy.freeboard.io/fetch/${yahooUrl1}`,
  `https://api.codetabs.com/v1/proxy/?quest=${yahooUrl1}`,
  // retry against query2 host through the relays
  `https://api.allorigins.win/raw?url=${enc2}`,
  `https://corsproxy.io/?url=${enc2}`,
  // last resort: direct (works in some environments / native fetch)
  yahooUrl1,
  yahooUrl2];

}

async function fetchJson(
candidates: string[],
timeoutMs = 9000)
: Promise<any | null> {
  for (const candidate of candidates) {
    const controller = createAbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(candidate, {
        cache: 'no-store',
        signal: toFetchSignal(controller.signal)
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text) continue;
      // Some relays wrap the payload as text — parse defensively.
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }
      // allorigins sometimes returns { contents: "<json string>" }
      if (json && typeof json.contents === 'string') {
        try {
          json = JSON.parse(json.contents);
        } catch {}
      }
      if (json?.chart?.result?.length) return json;
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Aggregate consecutive real 1h OHLC bars into real-data 4h bars. */
function aggregateCandles(
src: BinanceCandle[],
group: number)
: BinanceCandle[] {
  if (group <= 1) return src;
  const out: BinanceCandle[] = [];
  for (let i = 0; i < src.length; i += group) {
    const slice = src.slice(i, i + group);
    if (!slice.length) continue;
    out.push({
      timestamp: slice[0].timestamp,
      open: slice[0].open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((s, c) => s + (c.volume || 0), 0),
      isClosed: slice[slice.length - 1].isClosed
    });
  }
  return out;
}

/** Parse a Yahoo v8 chart response into BinanceCandle[]. */
function parseYahoo(json: any): BinanceCandle[] {
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0];
  if (!ts.length || !q) return [];
  const candles: BinanceCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    // Missing Yahoo bars are omitted. Never forward-fill or manufacture OHLC.
    if (
    [o, h, l, c].some((value) => value == null || !Number.isFinite(+value)))
    {
      continue;
    }
    candles.push({
      open: +o,
      high: +h,
      low: +l,
      close: +c,
      volume: +(q.volume?.[i] ?? 0),
      timestamp: ts[i] * 1000,
      isClosed: true
    });
  }
  return candles;
}

interface CacheEntry {
  candles: BinanceCandle[];
  ts: number;
}
const yahooCache = new Map<string, CacheEntry>();
// In-flight de-dupe so rapid re-renders don't fire parallel relay storms.
const inflight = new Map<string, Promise<BinanceCandle[]>>();

async function getYahooCandles(
symbol: string,
tf: string)
: Promise<BinanceCandle[]> {
  const key = `${symbol}_${tf}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const { interval, range, aggregate } = yahooParams(tf);
    const ticker = encodeURIComponent(yahooTicker(symbol));
    const path = `/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    const url1 = `https://query1.finance.yahoo.com${path}`;
    const url2 = `https://query2.finance.yahoo.com${path}`;
    const json = await fetchJson(buildCandidates(url1, url2));
    let candles = parseYahoo(json);
    if (aggregate) candles = aggregateCandles(candles, aggregate);
    if (candles.length) {
      // mark the most recent candle as still forming (live)
      candles[candles.length - 1] = {
        ...candles[candles.length - 1],
        isClosed: false
      };
      yahooCache.set(key, { candles, ts: Date.now() });
      return candles;
    }
    // Fetch failed — serve the last good snapshot so the chart never blanks.
    const cached = yahooCache.get(key);
    return cached ? cached.candles : [];
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

// ── Public, asset-class-agnostic API ───────────────────────

/** Fetch real candles plus honest provider/ticker metadata. */
export async function getMarketCandleSnapshot(
symbol: string,
timeframe: string)
: Promise<MarketCandleSnapshot | null> {
  if (isCrypto(symbol)) {
    const candles = await binanceWS.getLatestData(symbol, timeframe);
    return candles?.length ?
    snapshot(candles, {
      provider: 'Binance',
      ticker: symbol,
      label: `Binance ${symbol}`,
      isProxy: false,
      delayed: false
    }) :
    null;
  }

  const proxy = binanceProxy(symbol);
  if (proxy && BINANCE_INTERVALS.has(timeframe)) {
    const candles = await binanceWS.getLatestData(proxy, timeframe);
    if (candles?.length) {
      return snapshot(candles, {
        provider: 'Binance',
        ticker: proxy,
        label: 'Binance PAXG/USDT tokenized-gold proxy',
        isProxy: true,
        delayed: false
      });
    }
  }

  const candles = await getYahooCandles(symbol, timeframe);
  if (!candles.length) return null;
  const ticker = yahooTicker(symbol);
  return snapshot(candles, {
    provider: 'Yahoo Finance',
    ticker,
    label:
    symbol === 'XAUUSD' ?
    'Yahoo GC=F COMEX Gold futures proxy · delayed' :
    symbol === 'DXY' ?
    'Yahoo DX-Y.NYB · ICE U.S. Dollar Index · delayed' :
    `Yahoo ${ticker} · delayed`,
    isProxy: symbol === 'XAUUSD',
    delayed: true
  });
}

/** Fetch the latest real candles for ANY symbol/timeframe. */
export async function getMarketCandles(
symbol: string,
timeframe: string)
: Promise<BinanceCandle[] | null> {
  const result = await getMarketCandleSnapshot(symbol, timeframe);
  return result?.candles ?? null;
}

/**
 * Subscribe to realtime candle updates for ANY symbol.
 *  - Crypto → native Binance WebSocket ticks.
 *  - Everything else → polls Yahoo (default 15s) and emits the newest
 *    candle whenever it changes, keeping the chart live.
 * Returns an unsubscribe function.
 */
function snapshot(
candles: BinanceCandle[],
source: MarketCandleSource)
: MarketCandleSnapshot {
  return {
    candles,
    source,
    marketTimestamp: candles.at(-1)?.timestamp ?? Date.now()
  };
}

export function subscribeMarketCandles(
symbol: string,
timeframe: string,
cb: (c: BinanceCandle) => void,
pollMs = 15000)
: () => void {
  if (isCrypto(symbol)) {
    return binanceWS.subscribe(symbol, timeframe, cb);
  }
  // Gold (Binance proxy): stream live ticks over the Binance WebSocket so
  // the candle keeps printing in real time on every timeframe.
  const proxy = binanceProxy(symbol);
  if (proxy && BINANCE_INTERVALS.has(timeframe)) {
    return binanceWS.subscribe(proxy, timeframe, cb);
  }
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = async () => {
    if (stopped) return;
    const candles = await getYahooCandles(symbol, timeframe);
    if (!stopped && candles.length) cb(candles[candles.length - 1]);
    if (!stopped) timer = setTimeout(tick, pollMs);
  };
  timer = setTimeout(tick, pollMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}