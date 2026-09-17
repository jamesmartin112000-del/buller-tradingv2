import type {
  AssetType,
  MarketDataCollection,
  MarketDataResult,
  OhlcCandle,
  Timeframe } from
'./types';
import { getMarketCandleSnapshot } from './trading/marketCandles';

export const SMT_TIMEFRAMES: Timeframe[] = [
'15m',
'1h',
'4h',
'1d',
'1w',
'1mo'];


const CACHE_TTL_MS = 60_000;
const MINIMUM_CANDLES = 5;

interface CacheEntry {
  result: MarketDataResult;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

const ASSET_SYMBOLS: Record<AssetType, string> = {
  GOLD: 'XAUUSD=X',
  DXY: 'DXY'
};

export async function fetchOhlc(
asset: AssetType,
timeframe: Timeframe,
forceRefresh = false)
: Promise<MarketDataResult> {
  const cacheKey = `${asset}:${timeframe}`;
  const cached = cache.get(cacheKey);

  if (
  !forceRefresh &&
  cached &&
  Date.now() - cached.fetchedAt < CACHE_TTL_MS)
  {
    return cached.result;
  }

  try {
    const requestedTimeframe = timeframe === '4h' ? '1h' : timeframe;
    const snapshot = await getMarketCandleSnapshot(
      ASSET_SYMBOLS[asset],
      requestedTimeframe
    );

    let candles = (snapshot?.candles ?? []).map<OhlcCandle>((candle) => ({
      timestamp: Math.floor(candle.timestamp / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));

    if (timeframe === '4h') candles = resampleTo4h(candles);

    const marketTimestamp = snapshot?.marketTimestamp;
    const isStale = marketTimestamp ?
    Date.now() - marketTimestamp > staleAfterMs(timeframe) :
    true;
    const status: MarketDataResult['status'] =
    candles.length >= MINIMUM_CANDLES && !isStale ?
    'ok' :
    candles.length > 0 ?
    'partial' :
    'unavailable';

    const result: MarketDataResult = {
      asset,
      timeframe,
      candles,
      status,
      source: snapshot?.source.label,
      marketTimestamp,
      isStale,
      error:
      status === 'unavailable' ?
      `${asset} ${timeframe} market data is temporarily unavailable.` :
      isStale ?
      `${asset} ${timeframe} candles are stale.` :
      status === 'partial' ?
      `Only ${candles.length} candles were returned.` :
      undefined
    };

    cache.set(cacheKey, { result, fetchedAt: Date.now() });
    return result;
  } catch (caught) {
    const result: MarketDataResult = {
      asset,
      timeframe,
      candles: [],
      status: 'unavailable',
      error:
      caught instanceof Error ? caught.message : 'Market data request failed.'
    };
    cache.set(cacheKey, { result, fetchedAt: Date.now() });
    return result;
  }
}

export async function fetchAllMarketData(
timeframes: Timeframe[] = SMT_TIMEFRAMES,
forceRefresh = false)
: Promise<{
  gold: MarketDataCollection;
  dxy: MarketDataCollection;
}> {
  const settled = await Promise.all(
    timeframes.flatMap((timeframe) => [
    fetchOhlc('GOLD', timeframe, forceRefresh),
    fetchOhlc('DXY', timeframe, forceRefresh)]
    )
  );

  const gold: MarketDataCollection = {};
  const dxy: MarketDataCollection = {};

  settled.forEach((result) => {
    if (result.asset === 'GOLD') gold[result.timeframe] = result;else
    dxy[result.timeframe] = result;
  });

  return { gold, dxy };
}

export function clearMarketDataCache(): void {
  cache.clear();
}

function staleAfterMs(timeframe: Timeframe): number {
  const limits: Record<Timeframe, number> = {
    '15m': 3 * 24 * 60 * 60 * 1000,
    '1h': 3 * 24 * 60 * 60 * 1000,
    '4h': 3 * 24 * 60 * 60 * 1000,
    '1d': 5 * 24 * 60 * 60 * 1000,
    '1w': 14 * 24 * 60 * 60 * 1000,
    '1mo': 45 * 24 * 60 * 60 * 1000
  };
  return limits[timeframe];
}

function resampleTo4h(candles: OhlcCandle[]): OhlcCandle[] {
  if (candles.length === 0) return [];

  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const groups = new Map<number, OhlcCandle[]>();
  const fourHoursInSeconds = 4 * 60 * 60;

  sorted.forEach((candle) => {
    const bucket = Math.floor(candle.timestamp / fourHoursInSeconds);
    const group = groups.get(bucket) ?? [];
    group.push(candle);
    groups.set(bucket, group);
  });

  return Array.from(groups.values()).map((group) => ({
    timestamp: group[0].timestamp,
    open: group[0].open,
    high: Math.max(...group.map((candle) => candle.high)),
    low: Math.min(...group.map((candle) => candle.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, candle) => sum + candle.volume, 0)
  }));
}