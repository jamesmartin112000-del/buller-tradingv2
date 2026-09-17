import type {
  BigTrade,
  InstitutionalCandle,
  PriceZone,
  WhaleAnalysis } from
'./types';

export function detectBigTrades(
candles: InstitutionalCandle[],
thresholdMultiplier = 2.5)
: BigTrade[] {
  if (candles.length < 20) return [];
  const baseline = candles.slice(0, -1);
  const average = baseline.reduce((sum, candle) => sum + candle.volume, 0) / baseline.length;
  const deviation = Math.sqrt(
    baseline.reduce((sum, candle) => sum + (candle.volume - average) ** 2, 0) /
    baseline.length
  );
  const threshold = average + deviation * thresholdMultiplier;
  return candles.slice(-80).flatMap((candle, index, recent): BigTrade[] => {
    const range = candle.high - candle.low;
    const body = candle.close - candle.open;
    if (candle.volume < threshold || range <= 0 || Math.abs(body) / range < 0.2) return [];
    const side = body > 0 ? 'buy' : 'sell';
    const sameLevelCount = recent.
    slice(Math.max(0, index - 3), index).
    filter((previous) => Math.abs(previous.close - candle.close) < range * 0.5).length;
    const type =
    sameLevelCount >= 2 ? 'iceberg' : side === 'buy' ? 'accumulation' : 'distribution';
    const significance = Math.max(
      1,
      Math.min(10, Math.round((candle.volume - average) / Math.max(deviation, 1) * 1.5))
    );
    return [{
      timestamp: candle.timestamp,
      price: candle.close,
      volume: candle.volume,
      side,
      significance,
      type,
      description: `${significance >= 8 ? 'Exceptional' : significance >= 5 ? 'Large' : 'Elevated'} ${side}-side ${type} near ${round(candle.close)}`
    }];
  });
}

export function analyzeWhaleActivity(candles: InstitutionalCandle[]): WhaleAnalysis {
  const bigTrades = detectBigTrades(candles);
  if (!bigTrades.length) {
    return {
      bigTrades: [],
      accumulationZones: [],
      distributionZones: [],
      whaleBias: 'neutral',
      recentActivity: 'low'
    };
  }
  const recent = bigTrades.slice(-5);
  const buyVolume = recent.filter((trade) => trade.side === 'buy').reduce((sum, trade) => sum + trade.volume, 0);
  const sellVolume = recent.filter((trade) => trade.side === 'sell').reduce((sum, trade) => sum + trade.volume, 0);
  const whaleBias = buyVolume > sellVolume * 1.4 ? 'bullish' : sellVolume > buyVolume * 1.4 ? 'bearish' : 'neutral';
  const newestTimestamp = candles.at(-1)?.timestamp ?? Date.now();
  const recentCount = bigTrades.filter((trade) => newestTimestamp - trade.timestamp <= 6 * 60 * 60 * 1000).length;
  return {
    bigTrades,
    accumulationZones: buildPriceZones(bigTrades.filter((trade) => trade.side === 'buy')),
    distributionZones: buildPriceZones(bigTrades.filter((trade) => trade.side === 'sell')),
    whaleBias,
    recentActivity: recentCount > 5 ? 'high' : recentCount > 2 ? 'moderate' : 'low'
  };
}

function buildPriceZones(trades: BigTrade[]): PriceZone[] {
  const clusters: Array<{price: number;volume: number;count: number;}> = [];
  trades.forEach((trade) => {
    const cluster = clusters.find((item) => Math.abs(item.price - trade.price) < trade.price * 0.001);
    if (cluster) {
      cluster.price = (cluster.price * cluster.count + trade.price) / (cluster.count + 1);
      cluster.volume += trade.volume;
      cluster.count += 1;
    } else {
      clusters.push({ price: trade.price, volume: trade.volume, count: 1 });
    }
  });
  const maxVolume = Math.max(1, ...clusters.map((cluster) => cluster.volume));
  return clusters.
  sort((a, b) => b.volume - a.volume).
  slice(0, 5).
  map((cluster) => ({
    priceLow: round(cluster.price * 0.9995),
    priceHigh: round(cluster.price * 1.0005),
    volume: cluster.volume,
    tradeCount: cluster.count,
    strength: Math.max(1, Math.round(cluster.volume / maxVolume * 10))
  }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}