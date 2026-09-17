// ============================================================
// Shared multi-asset market layer for the God Signal Terminal.
// Zero-API-key price fetching + indicators. Reused by the
// unified terminal and the Dashboard embed.
// ============================================================

export type AssetType =
'crypto' |
'forex' |
'stocks' |
'indices' |
'commodities' |
'metals' |
'bonds';

export interface SymbolDef {
  id: string;
  name: string;
  tvId: string;
}

export interface Asset extends SymbolDef {
  type: AssetType;
}

export interface TCandle {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  ts: number;
}

export interface PriceData {
  price: number;
  volume?: number;
  source: string;
}

export const SYMBOLS: Record<AssetType, SymbolDef[]> = {
  crypto: [
  { id: 'BTCUSDT', name: 'Bitcoin', tvId: 'BINANCE:BTCUSDT' },
  { id: 'ETHUSDT', name: 'Ethereum', tvId: 'BINANCE:ETHUSDT' },
  { id: 'SOLUSDT', name: 'Solana', tvId: 'BINANCE:SOLUSDT' },
  { id: 'XRPUSDT', name: 'Ripple', tvId: 'BINANCE:XRPUSDT' },
  { id: 'BNBUSDT', name: 'BNB', tvId: 'BINANCE:BNBUSDT' },
  { id: 'ADAUSDT', name: 'Cardano', tvId: 'BINANCE:ADAUSDT' },
  { id: 'DOGEUSDT', name: 'Dogecoin', tvId: 'BINANCE:DOGEUSDT' },
  { id: 'DOTUSDT', name: 'Polkadot', tvId: 'BINANCE:DOTUSDT' },
  { id: 'LINKUSDT', name: 'Chainlink', tvId: 'BINANCE:LINKUSDT' },
  { id: 'AVAXUSDT', name: 'Avalanche', tvId: 'BINANCE:AVAXUSDT' },
  { id: 'MATICUSDT', name: 'Polygon', tvId: 'BINANCE:MATICUSDT' },
  { id: 'ATOMUSDT', name: 'Cosmos', tvId: 'BINANCE:ATOMUSDT' },
  { id: 'NEARUSDT', name: 'NEAR', tvId: 'BINANCE:NEARUSDT' },
  { id: 'APTUSDT', name: 'Aptos', tvId: 'BINANCE:APTUSDT' },
  { id: 'SUIUSDT', name: 'Sui', tvId: 'BINANCE:SUIUSDT' },
  { id: 'INJUSDT', name: 'Injective', tvId: 'BINANCE:INJUSDT' },
  { id: 'ARBUSDT', name: 'Arbitrum', tvId: 'BINANCE:ARBUSDT' },
  { id: 'OPUSDT', name: 'Optimism', tvId: 'BINANCE:OPUSDT' },
  { id: 'AAVEUSDT', name: 'Aave', tvId: 'BINANCE:AAVEUSDT' }],

  forex: [
  { id: 'EURUSD', name: 'EUR/USD', tvId: 'FX:EURUSD' },
  { id: 'GBPUSD', name: 'GBP/USD', tvId: 'FX:GBPUSD' },
  { id: 'USDJPY', name: 'USD/JPY', tvId: 'FX:USDJPY' },
  { id: 'USDCHF', name: 'USD/CHF', tvId: 'FX:USDCHF' },
  { id: 'AUDUSD', name: 'AUD/USD', tvId: 'FX:AUDUSD' },
  { id: 'USDCAD', name: 'USD/CAD', tvId: 'FX:USDCAD' },
  { id: 'NZDUSD', name: 'NZD/USD', tvId: 'FX:NZDUSD' },
  { id: 'EURGBP', name: 'EUR/GBP', tvId: 'FX:EURGBP' },
  { id: 'EURJPY', name: 'EUR/JPY', tvId: 'FX:EURJPY' },
  { id: 'GBPJPY', name: 'GBP/JPY', tvId: 'FX:GBPJPY' },
  { id: 'AUDJPY', name: 'AUD/JPY', tvId: 'FX:AUDJPY' },
  { id: 'EURCHF', name: 'EUR/CHF', tvId: 'FX:EURCHF' }],

  metals: [
  { id: 'XAU', name: 'Gold (XAU/USD)', tvId: 'OANDA:XAUUSD' },
  { id: 'XAG', name: 'Silver (XAG/USD)', tvId: 'OANDA:XAGUSD' },
  { id: 'XPT', name: 'Platinum', tvId: 'TVC:PLATINUM' },
  { id: 'XPD', name: 'Palladium', tvId: 'TVC:PALLADIUM' }],

  stocks: [
  { id: 'AAPL', name: 'Apple', tvId: 'NASDAQ:AAPL' },
  { id: 'MSFT', name: 'Microsoft', tvId: 'NASDAQ:MSFT' },
  { id: 'NVDA', name: 'NVIDIA', tvId: 'NASDAQ:NVDA' },
  { id: 'GOOGL', name: 'Alphabet', tvId: 'NASDAQ:GOOGL' },
  { id: 'AMZN', name: 'Amazon', tvId: 'NASDAQ:AMZN' },
  { id: 'META', name: 'Meta', tvId: 'NASDAQ:META' },
  { id: 'TSLA', name: 'Tesla', tvId: 'NASDAQ:TSLA' },
  { id: 'AMD', name: 'AMD', tvId: 'NASDAQ:AMD' },
  { id: 'COIN', name: 'Coinbase', tvId: 'NASDAQ:COIN' },
  { id: 'PLTR', name: 'Palantir', tvId: 'NASDAQ:PLTR' }],

  indices: [
  { id: '^GSPC', name: 'S&P 500', tvId: 'TVC:SPX' },
  { id: '^IXIC', name: 'NASDAQ', tvId: 'NASDAQ:IXIC' },
  { id: '^DJI', name: 'Dow Jones', tvId: 'DJ:DJI' },
  { id: '^VIX', name: 'VIX', tvId: 'TVC:VIX' },
  { id: '^FTSE', name: 'FTSE 100', tvId: 'TVC:UKX' },
  { id: '^GDAXI', name: 'DAX 40', tvId: 'XETRA:DAX' },
  { id: '^N225', name: 'Nikkei 225', tvId: 'TVC:NI225' }],

  commodities: [
  { id: 'CL=F', name: 'Crude Oil', tvId: 'NYMEX:CL1!' },
  { id: 'BZ=F', name: 'Brent Oil', tvId: 'ICEEUR:BRN1!' },
  { id: 'NG=F', name: 'Natural Gas', tvId: 'NYMEX:NG1!' },
  { id: 'ZC=F', name: 'Corn', tvId: 'CBOT:ZC1!' },
  { id: 'ZW=F', name: 'Wheat', tvId: 'CBOT:ZW1!' },
  { id: 'KC=F', name: 'Coffee', tvId: 'ICEUS:KC1!' }],

  bonds: [
  { id: '^TNX', name: '10Y Treasury', tvId: 'TVC:TNX' },
  { id: '^TYX', name: '30Y Treasury', tvId: 'TVC:TYX' },
  { id: 'TLT', name: '20Y Bond ETF', tvId: 'NASDAQ:TLT' }]

};

export const MARKET_TABS: {type: AssetType;label: string;}[] = [
{ type: 'crypto', label: 'Crypto' },
{ type: 'forex', label: 'Forex' },
{ type: 'metals', label: 'Metals' },
{ type: 'stocks', label: 'Stocks' },
{ type: 'indices', label: 'Indices' },
{ type: 'commodities', label: 'Commodities' },
{ type: 'bonds', label: 'Bonds' }];


export const ALL_ASSETS: Asset[] = [];
(Object.entries(SYMBOLS) as [AssetType, SymbolDef[]][]).forEach(
  ([type, arr]) => {
    arr.forEach((s) => ALL_ASSETS.push({ ...s, type }));
  }
);

export function findAsset(id: string): Asset | undefined {
  return ALL_ASSETS.find((a) => a.id === id);
}

export interface MarketStatus {
  open: boolean;
  label: 'OPEN' | 'CLOSED';
  detail: string;
}

/**
 * Real market open/closed status by asset class, computed from the
 * current UTC time. Crypto is 24/7. Forex & metals trade Sun 22:00 →
 * Fri 22:00 UTC. Stocks/indices follow the US cash session
 * (13:30–20:00 UTC, Mon–Fri). Commodities/bonds use a broad
 * Mon–Fri 13:00–21:00 UTC window. DST is approximated.
 */
export function getMarketStatus(
type: AssetType,
now: Date = new Date())
: MarketStatus {
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (type === 'crypto') {
    return { open: true, label: 'OPEN', detail: '24/7 · Crypto never sleeps' };
  }

  if (type === 'forex' || type === 'metals') {
    // Open Sunday 22:00 UTC through Friday 22:00 UTC
    let open = true;
    if (day === 6)
    open = false; // Saturday
    else if (day === 0 && mins < 22 * 60)
    open = false; // Sun before 22:00
    else if (day === 5 && mins >= 22 * 60) open = false; // Fri after 22:00
    return {
      open,
      label: open ? 'OPEN' : 'CLOSED',
      detail: open ? 'FX session live' : 'Weekend · FX closed'
    };
  }

  // Stocks / indices — US cash session 13:30–20:00 UTC
  if (type === 'stocks' || type === 'indices') {
    const weekday = day >= 1 && day <= 5;
    const inSession = mins >= 13 * 60 + 30 && mins < 20 * 60;
    const open = weekday && inSession;
    return {
      open,
      label: open ? 'OPEN' : 'CLOSED',
      detail: open ?
      'US cash session' :
      weekday ?
      'Outside US hours' :
      'Weekend · market closed'
    };
  }

  // Commodities / bonds — broad Mon–Fri 13:00–21:00 UTC window
  const weekday = day >= 1 && day <= 5;
  const inSession = mins >= 13 * 60 && mins < 21 * 60;
  const open = weekday && inSession;
  return {
    open,
    label: open ? 'OPEN' : 'CLOSED',
    detail: open ?
    'Session live' :
    weekday ?
    'Outside hours' :
    'Weekend · closed'
  };
}

export const TIMEFRAMES = [
{ id: '1', label: '1m', tvInterval: '1' },
{ id: '5', label: '5m', tvInterval: '5' },
{ id: '15', label: '15m', tvInterval: '15' },
{ id: '60', label: '1h', tvInterval: '60' },
{ id: '240', label: '4h', tvInterval: '240' },
{ id: '1D', label: '1D', tvInterval: '1D' },
{ id: '1W', label: '1W', tvInterval: '1W' }];


// ─── DATA FETCHERS (ZERO API KEY) ─────────────────────────

/** Real-time spot for metals via gold-api.com (no key, 24/7 spot). */
async function fetchMetalSpot(id: string): Promise<PriceData | null> {
  try {
    const r = await fetch(`https://api.gold-api.com/price/${id.toUpperCase()}`);
    if (r.ok) {
      const d = await r.json();
      if (d?.price) return { price: +d.price, source: 'gold-api.com' };
    }
  } catch {

    /* ignore */}
  return null;
}

/** Real-time-ish FX via frankfurter.dev (ECB, no key). */
async function fetchForexRate(symbolId: string): Promise<PriceData | null> {
  if (symbolId.length !== 6) return null;
  const from = symbolId.slice(0, 3).toUpperCase();
  const to = symbolId.slice(3).toUpperCase();
  try {
    const r = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`
    );
    if (r.ok) {
      const d = await r.json();
      const rate = d?.rates?.[to];
      if (rate) return { price: +rate, source: 'frankfurter.dev' };
    }
  } catch {

    /* ignore */}
  return null;
}

/** Last close from Yahoo's chart API (fresher & more CORS-friendly than /v7/quote). */
async function fetchYahooLast(symbolId: string): Promise<PriceData | null> {
  for (const host of [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com'])
  {
    try {
      const r = await noStore(
        `${host}/v8/finance/chart/${encodeURIComponent(symbolId)}?interval=1m&range=1d`,
        { 'User-Agent': 'Mozilla/5.0' }
      );
      if (r.ok) {
        const d = await r.json();
        const result = d?.chart?.result?.[0];
        // Prefer the live regularMarketPrice; fall back to the last close.
        const live = result?.meta?.regularMarketPrice;
        if (live) return { price: +live, source: 'yahoo' };
        const closes: (number | null)[] =
        result?.indicators?.quote?.[0]?.close || [];
        for (let i = closes.length - 1; i >= 0; i--) {
          if (closes[i] != null)
          return { price: +(closes[i] as number), source: 'yahoo' };
        }
      }
    } catch {

      /* try next host */}
  }
  return null;
}

/** Legacy fallback: Fawazahmed currency-api (daily-updated). */
async function fetchFawazahmed(symbolId: string): Promise<PriceData | null> {
  try {
    let r = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
    );
    if (!r.ok) {
      r = await fetch(
        'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
      );
    }
    if (r.ok) {
      const d = await r.json();
      const rates: Record<string, number> = d.usd || {};
      const t = symbolId.toLowerCase();
      const metals = ['xau', 'xag', 'xpt', 'xpd'];
      if (metals.includes(t) && rates[t])
      return { price: 1 / rates[t], source: 'forex' };
      if (symbolId.length === 6) {
        const b = symbolId.slice(0, 3).toLowerCase();
        const q = symbolId.slice(3).toLowerCase();
        if (rates[b] && rates[q])
        return { price: rates[q] / rates[b], source: 'forex' };
        if (b === 'usd' && rates[q]) return { price: rates[q], source: 'forex' };
        if (q === 'usd' && rates[b])
        return { price: 1 / rates[b], source: 'forex' };
      }
    }
  } catch {

    /* ignore */}
  return null;
}

/**
 * Live price for ANY asset, routed to the most accurate zero-key source for
 * that asset class. Previously gold/forex fell back to a daily-updated
 * currency API or Yahoo's flaky /v7/quote — which returned STALE prices
 * (e.g. gold stuck at 4,145 while the market was at 4,059), poisoning the
 * trade-entry engine. Each class now hits its real-time feed first.
 */
export async function fetchPrice(symbolId: string): Promise<PriceData | null> {
  const asset = findAsset(symbolId);
  const type = asset?.type;

  // ── Metals → gold-api.com real-time spot (XAU/XAG/XPT/XPD) ──
  if (type === 'metals') {
    const m = await fetchMetalSpot(symbolId);
    if (m) return m;
  }

  // ── Forex → frankfurter.dev live ECB rate ──
  if (type === 'forex') {
    const f = await fetchForexRate(symbolId);
    if (f) return f;
  }

  // ── Crypto → Binance 24h ticker ──
  if (type === 'crypto' || !type) {
    try {
      const r = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbolId}`
      );
      if (r.ok) {
        const d = await r.json();
        if (d && d.lastPrice) {
          return {
            price: parseFloat(d.lastPrice),
            volume: parseFloat(d.volume),
            source: 'binance'
          };
        }
      }
    } catch {

      /* ignore */}
  }

  // ── Stocks / indices / commodities / bonds → Yahoo chart (live/last close) ──
  if (
  type === 'stocks' ||
  type === 'indices' ||
  type === 'commodities' ||
  type === 'bonds')
  {
    const y = await fetchYahooLast(symbolId);
    if (y) return y;
  }

  // ── Cross-class fallbacks so the panel never goes blank ──
  return (await fetchYahooLast(symbolId)) ?? (await fetchFawazahmed(symbolId));
}

// ─── REAL OHLC KLINES (ZERO API KEY) ──────────────────────
// Maps the terminal's tvInterval ids to each provider's interval.
const BINANCE_INTERVAL: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  '1W': '1w'
};

// Yahoo has no native 4h — we approximate with 60m over a longer range.
const YAHOO_INTERVAL: Record<string, {interval: string;range: string;}> = {
  '1': { interval: '1m', range: '1d' },
  '5': { interval: '5m', range: '5d' },
  '15': { interval: '15m', range: '5d' },
  '60': { interval: '60m', range: '1mo' },
  '240': { interval: '60m', range: '3mo' },
  '1D': { interval: '1d', range: '6mo' },
  '1W': { interval: '1wk', range: '2y' }
};

/**
 * Translate an asset id into the symbol Yahoo's chart API expects.
 * Forex/metals need a suffix; stocks/indices/commodities/bonds use the id.
 */
function yahooSymbol(asset: Asset): string {
  if (asset.type === 'metals') {
    // XAU → XAUUSD=X, XAG → XAGUSD=X, etc.
    return `${asset.id}USD=X`;
  }
  if (asset.type === 'forex') {
    // 6-letter FX pair → EURUSD=X
    return `${asset.id}=X`;
  }
  return asset.id;
}

async function noStore(url: string, headers?: Record<string, string>) {
  const buster = `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  return fetch(url + buster, { cache: 'no-store', headers });
}

/** Parse a Yahoo chart payload into TCandle[]. */
function parseYahoo(d: any): TCandle[] | null {
  const result = d?.chart?.result?.[0];
  if (!result) return null;
  const ts: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0];
  if (!ts.length || !q) return null;
  const out: TCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
      ts: ts[i] * 1000
    });
  }
  return out.length ? out : null;
}

/**
 * Fetch REAL historical OHLC candles for any asset + timeframe.
 * Crypto → Binance public klines. Everything else → Yahoo chart API.
 * Returns null on failure so the caller can fall back gracefully.
 */
export async function fetchKlines(
asset: Asset,
tvInterval: string,
limit = 300)
: Promise<TCandle[] | null> {
  // ── Crypto: Binance public klines (most reliable, CORS-friendly) ──
  if (asset.type === 'crypto') {
    const bi = BINANCE_INTERVAL[tvInterval] || '15m';
    try {
      const r = await noStore(
        `https://api.binance.com/api/v3/klines?symbol=${asset.id}&interval=${bi}&limit=${limit}`
      );
      if (r.ok) {
        const data: any[] = await r.json();
        const candles: TCandle[] = data.map((c) => ({
          open: +c[1],
          high: +c[2],
          low: +c[3],
          close: +c[4],
          volume: +c[5],
          ts: c[0]
        }));
        if (candles.length >= 20) return candles;
      }
    } catch {

      /* fall through */}
  }

  // ── Everything else (forex / metals / stocks / indices / etc): Yahoo ──
  const y = YAHOO_INTERVAL[tvInterval] || { interval: '15m', range: '5d' };
  const ySym = yahooSymbol(asset);
  for (const host of [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com'])
  {
    try {
      const r = await noStore(
        `${host}/v8/finance/chart/${encodeURIComponent(ySym)}?interval=${y.interval}&range=${y.range}`,
        { 'User-Agent': 'Mozilla/5.0' }
      );
      if (r.ok) {
        const d = await r.json();
        const candles = parseYahoo(d);
        if (candles && candles.length >= 20) return candles.slice(-limit);
      }
    } catch {

      /* try next host */}
  }

  return null;
}

// ─── INDICATORS ───────────────────────────────────────────
export function calcATR(candles: TCandle[], p = 14): number {
  if (!candles || candles.length < p + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.length > 0 ?
  trs.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, trs.length) :
  0;
}

export function calcEMA(prices: number[], p: number): number {
  if (!prices || prices.length < p)
  return prices ? prices[prices.length - 1] : 0;
  const k = 2 / (p + 1);
  let ema = prices.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

export function calcRSI(prices: number[], p = 14): number {
  if (!prices || prices.length < p + 1) return 50;
  const g: number[] = [];
  const l: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    g.push(d > 0 ? d : 0);
    l.push(d < 0 ? -d : 0);
  }
  const ag = g.slice(-p).reduce((a, b) => a + b, 0) / p;
  const al = l.slice(-p).reduce((a, b) => a + b, 0) / p;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

export function calcMACD(prices: number[]): {
  macd: number;
  signal: number;
  hist: number;
} {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macd = ema12 - ema26;
  const macdSeries = prices.
  map((_, i) => {
    if (i < 26) return 0;
    const e12 = calcEMA(prices.slice(0, i + 1), 12);
    const e26 = calcEMA(prices.slice(0, i + 1), 26);
    return e12 - e26;
  }).
  filter((v) => v !== 0);
  const signal = calcEMA(macdSeries, 9);
  return { macd, signal, hist: macd - signal };
}

export function makeCandles(
price: number,
count = 40,
volatility = 0.0025)
: TCandle[] {
  const candles: TCandle[] = [];
  let p = price * (1 - volatility);
  for (let i = 0; i < count; i++) {
    const m = (Math.random() - 0.48) * price * volatility;
    const o = p;
    const c = o + m;
    candles.push({
      open: o,
      close: c,
      high: Math.max(o, c) + Math.random() * price * volatility * 0.3,
      low: Math.min(o, c) - Math.random() * price * volatility * 0.3,
      volume: Math.random() * 1000 + 500,
      ts: Date.now() - (count - i) * 300000
    });
    p = c;
  }
  // Anchor the synthesized series so the LAST close equals the real live
  // price. Without this the random walk ends at an arbitrary value and the
  // engine's entry (= last close) drifts away from the actual market price.
  const last = candles[candles.length - 1];
  if (last) {
    const delta = price - last.close;
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    // Nudge the prior candle's close toward the real price too for continuity.
    if (candles.length > 1 && Math.abs(delta) > 0) {
      const prev = candles[candles.length - 2];
      prev.close = prev.close + delta * 0.5;
      prev.high = Math.max(prev.high, prev.close);
      prev.low = Math.min(prev.low, prev.close);
      last.open = prev.close;
    }
  }
  return candles;
}

export function fmtNum(n?: number | null): string {
  if (n === undefined || n === null || isNaN(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs < 0.0001 && abs > 0) return n.toFixed(8);
  if (abs < 0.01) return n.toFixed(6);
  if (abs < 1) return n.toFixed(4);
  if (abs < 1000) return n.toFixed(2);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}