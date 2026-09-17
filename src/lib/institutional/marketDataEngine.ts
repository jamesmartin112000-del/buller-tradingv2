import {
  getMarketCandleSnapshot,
  type MarketCandleSnapshot } from
'../trading/marketCandles';
import type {
  InstitutionalCandle,
  InstitutionalDataSource,
  InstitutionalTimeframe } from
'./types';

interface MarketDataResult {
  candles: InstitutionalCandle[];
  source: InstitutionalDataSource | null;
  status: 'ok' | 'unavailable';
}

interface CacheEntry {
  result: MarketDataResult;
  fetchedAt: number;
}

const CACHE_TTL = 60_000;
const cache = new Map<string, CacheEntry>();

function adaptSnapshot(snapshot: MarketCandleSnapshot): MarketDataResult {
  return {
    candles: snapshot.candles.map(({ timestamp, open, high, low, close, volume }) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    })),
    source: {
      label: snapshot.source.label,
      provider: snapshot.source.provider,
      ticker: snapshot.source.ticker,
      isProxy: snapshot.source.isProxy,
      delayed: snapshot.source.delayed
    },
    status: 'ok'
  };
}

export async function fetchInstitutionalMarketData(
symbol: 'GOLD' | 'DXY',
interval: InstitutionalTimeframe,
forceRefresh = false)
: Promise<MarketDataResult> {
  const cacheKey = `${symbol}:${interval}`;
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.result;
  }

  const snapshot = await getMarketCandleSnapshot(
    symbol === 'GOLD' ? 'XAUUSD' : 'DXY',
    interval
  );
  const result: MarketDataResult = snapshot ?
  adaptSnapshot(snapshot) :
  { candles: [], source: null, status: 'unavailable' };
  cache.set(cacheKey, { result, fetchedAt: Date.now() });
  return result;
}

export async function fetchBothInstitutionalAssets(
interval: InstitutionalTimeframe,
forceRefresh = false)
: Promise<{gold: MarketDataResult;dxy: MarketDataResult;}> {
  const [goldResult, dxyResult] = await Promise.allSettled([
  fetchInstitutionalMarketData('GOLD', interval, forceRefresh),
  fetchInstitutionalMarketData('DXY', interval, forceRefresh)]
  );
  const unavailable: MarketDataResult = {
    candles: [],
    source: null,
    status: 'unavailable'
  };
  return {
    gold: goldResult.status === 'fulfilled' ? goldResult.value : unavailable,
    dxy: dxyResult.status === 'fulfilled' ? dxyResult.value : unavailable
  };
}