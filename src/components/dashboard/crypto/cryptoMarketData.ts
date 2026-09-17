import type { BinanceCandle } from '../../../lib/trading/binanceWebSocket';
import {
  createAbortController,
  toFetchSignal,
  type AbortSignalLike } from
'../../../lib/utils/abortController';
import {
  CRYPTO_TIMEFRAMES,
  type CryptoAggregateTrade,
  type CryptoAnalysisInput,
  type CryptoCandleSets,
  type CryptoDepth,
  type CryptoFearGreed,
  type CryptoTicker } from
'../../../lib/engine/cryptoInstitutionalMaster';

const BINANCE_HOSTS = ['https://api.binance.com', 'https://api1.binance.com'];
const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1';
const REQUEST_TIMEOUT_MS = 10_000;

interface RawTicker {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  quoteVolume?: string;
  closeTime?: number;
}

interface RawDepth {
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
}

interface RawAggregateTrade {
  p?: string;
  q?: string;
  T?: number;
  m?: boolean;
}

interface RawExchangeSymbol {
  symbol?: string;
  status?: string;
  quoteAsset?: string;
  isSpotTradingAllowed?: boolean;
}

interface RawExchangeInfo {
  symbols?: RawExchangeSymbol[];
}

interface RawFearGreed {
  data?: Array<{
    value?: string;
    value_classification?: string;
    timestamp?: string;
  }>;
}

let activePairsCache: {pairs: string[];timestamp: number;} | null = null;
let fearGreedCache: {value: CryptoFearGreed;timestamp: number;} | null = null;

export function normalizeCryptoSymbol(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function cryptoPairLabel(symbol: string): string {
  return symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}/USDT` : symbol;
}

export async function fetchActiveBinanceUsdtPairs(
signal?: AbortSignalLike)
: Promise<string[]> {
  if (
  activePairsCache &&
  Date.now() - activePairsCache.timestamp < 30 * 60 * 1000)
  {
    return activePairsCache.pairs;
  }
  const data = await fetchBinanceJson<RawExchangeInfo>(
    '/api/v3/exchangeInfo',
    signal
  );
  const pairs = (data.symbols ?? []).
  filter(
    (item) =>
    item.status === 'TRADING' &&
    item.quoteAsset === 'USDT' &&
    item.isSpotTradingAllowed !== false &&
    Boolean(item.symbol)
  ).
  map((item) => item.symbol!).
  sort();
  if (!pairs.length) {
    throw new Error('Binance returned no active USDT spot pairs.');
  }
  activePairsCache = { pairs, timestamp: Date.now() };
  return pairs;
}

export async function fetchCryptoMarketData(
symbolInput: string,
signal?: AbortSignalLike)
: Promise<CryptoAnalysisInput> {
  const symbol = normalizeCryptoSymbol(symbolInput);
  if (!symbol || !symbol.endsWith('USDT') || symbol.length <= 4) {
    throw new Error(
      'Enter an active Binance USDT spot pair, for example BTC/USDT.'
    );
  }

  const [
  exchangeInfo,
  tickerRaw,
  depthRaw,
  tradesRaw,
  klineResults,
  fearGreed] =
  await Promise.all([
  fetchBinanceJson<RawExchangeInfo>(
    `/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`,
    signal
  ).catch(() => null),
  fetchBinanceJson<RawTicker>(
    `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    signal
  ),
  fetchBinanceJson<RawDepth>(
    `/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=100`,
    signal
  ),
  fetchBinanceJson<RawAggregateTrade[]>(
    `/api/v3/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=1000`,
    signal
  ),
  Promise.allSettled(
    CRYPTO_TIMEFRAMES.map((timeframe) =>
    fetchBinanceJson<unknown[][]>(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&limit=120`,
      signal
    )
    )
  ),
  fetchFearGreed(signal)]
  );

  const listed = exchangeInfo?.symbols?.[0];
  if (
  listed && (
  listed.status !== 'TRADING' ||
  listed.quoteAsset !== 'USDT' ||
  listed.isSpotTradingAllowed === false))
  {
    throw new Error(
      `${cryptoPairLabel(symbol)} is not an active Binance USDT spot pair.`
    );
  }
  if (!tickerRaw.lastPrice || Number(tickerRaw.lastPrice) <= 0) {
    throw new Error(
      `${cryptoPairLabel(symbol)} is invalid, unavailable, or delisted on Binance spot.`
    );
  }

  const candles: CryptoCandleSets = {};
  klineResults.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const parsed = parseKlines(result.value);
    if (parsed.length >= 30) {
      candles[CRYPTO_TIMEFRAMES[index]] = parsed;
    }
  });
  if (!candles['1m']?.length) {
    throw new Error(
      `Real Binance 1m candles are unavailable for ${cryptoPairLabel(symbol)}.`
    );
  }

  return {
    symbol,
    ticker: parseTicker(symbol, tickerRaw),
    depth: parseDepth(depthRaw),
    trades: parseTrades(tradesRaw),
    candles,
    fearGreed
  };
}

async function fetchBinanceJson<T>(
path: string,
externalSignal?: AbortSignalLike)
: Promise<T> {
  let lastError: Error | null = null;
  for (const host of BINANCE_HOSTS) {
    if (externalSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const controller = createAbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );
    try {
      const response = await fetch(`${host}${path}`, {
        cache: 'no-store',
        signal: toFetchSignal(controller.signal)
      });
      if (!response.ok) {
        const message =
        response.status === 400 ?
        'Invalid or delisted Binance symbol.' :
        `Binance request failed (${response.status}).`;
        throw new Error(message);
      }
      return (await response.json()) as T;
    } catch (caught) {
      if (externalSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      lastError =
      caught instanceof Error ? caught : new Error('Binance request failed.');
    } finally {
      window.clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    }
  }
  throw lastError ?? new Error('Binance public API is unavailable.');
}

async function fetchFearGreed(
signal?: AbortSignalLike)
: Promise<CryptoFearGreed | null> {
  if (fearGreedCache && Date.now() - fearGreedCache.timestamp < 5 * 60 * 1000) {
    return fearGreedCache.value;
  }
  const controller = createAbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(FEAR_GREED_URL, {
      cache: 'no-store',
      signal: toFetchSignal(controller.signal)
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as RawFearGreed;
    const item = raw.data?.[0];
    const value = Number(item?.value);
    if (!Number.isFinite(value)) return null;
    const parsed = {
      value,
      classification: item?.value_classification || 'Unknown',
      timestamp: Number(item?.timestamp || 0) * 1000
    };
    fearGreedCache = { value: parsed, timestamp: Date.now() };
    return parsed;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function parseTicker(symbol: string, raw: RawTicker): CryptoTicker {
  return {
    symbol,
    lastPrice: Number(raw.lastPrice || 0),
    priceChangePercent: Number(raw.priceChangePercent || 0),
    highPrice: Number(raw.highPrice || 0),
    lowPrice: Number(raw.lowPrice || 0),
    quoteVolume: Number(raw.quoteVolume || 0),
    closeTime: Number(raw.closeTime || Date.now())
  };
}

function parseDepth(raw: RawDepth): CryptoDepth {
  const parse = (levels: Array<[string, string]> | undefined) =>
  (levels ?? []).
  map(([rawPrice, rawQuantity]) => {
    const price = Number(rawPrice);
    const quantity = Number(rawQuantity);
    return { price, quantity, notional: price * quantity };
  }).
  filter(
    (level) =>
    Number.isFinite(level.price) &&
    Number.isFinite(level.quantity) &&
    level.price > 0 &&
    level.quantity > 0
  );
  return { bids: parse(raw.bids), asks: parse(raw.asks) };
}

function parseTrades(raw: RawAggregateTrade[]): CryptoAggregateTrade[] {
  return (raw ?? []).
  map((trade) => {
    const price = Number(trade.p || 0);
    const quantity = Number(trade.q || 0);
    return {
      price,
      quantity,
      quoteValue: price * quantity,
      time: Number(trade.T || 0),
      buyerMaker: Boolean(trade.m)
    };
  }).
  filter((trade) => trade.price > 0 && trade.quantity > 0);
}

function parseKlines(raw: unknown[][]): BinanceCandle[] {
  return (raw ?? []).
  map((item) => ({
    timestamp: Number(item[0]),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]),
    isClosed: Date.now() >= Number(item[6])
  })).
  filter(
    (candle) =>
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.close > 0
  );
}