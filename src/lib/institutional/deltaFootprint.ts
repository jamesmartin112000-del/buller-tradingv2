import type {
  DeltaAnalysis,
  FootprintCandle,
  InstitutionalCandle,
  PriceLevel } from
'./types';

export function estimateDelta(candle: InstitutionalCandle): number {
  const range = candle.high - candle.low;
  if (range <= 0 || candle.volume <= 0) return 0;
  const body = candle.close - candle.open;
  const closeLocation = ((candle.close - candle.low) / range - 0.5) * 2;
  const pressure = Math.max(-1, Math.min(1, body / range * 0.65 + closeLocation * 0.35));
  return Math.round(candle.volume * pressure * 0.6);
}

export function generateFootprint(
candle: InstitutionalCandle,
previousCumulativeDelta = 0)
: FootprintCandle {
  const range = candle.high - candle.low;
  if (range <= 0) {
    return {
      ...candle,
      priceLevels: [],
      totalDelta: 0,
      cumulativeDelta: previousCumulativeDelta,
      maxDelta: 0,
      minDelta: 0,
      pvp: candle.close,
      bidVolume: candle.volume / 2,
      askVolume: candle.volume / 2,
      imbalance: 0
    };
  }

  const totalEstimatedDelta = estimateDelta(candle);
  const levels: PriceLevel[] = [];
  const step = range / 10;
  const weights = Array.from({ length: 10 }, (_, index) => {
    const price = candle.low + step * (index + 0.5);
    return 1.25 - Math.abs(price - candle.close) / range * 0.5;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let allocatedDelta = 0;
  for (let index = 0; index < 10; index += 1) {
    const price = candle.low + step * (index + 0.5);
    const levelVolume = candle.volume / 10;
    const delta = index === 9 ?
    totalEstimatedDelta - allocatedDelta :
    Math.round(totalEstimatedDelta * (weights[index] / weightTotal));
    allocatedDelta += delta;
    const askVolume = Math.max(0, Math.round((levelVolume + delta) / 2));
    const bidVolume = Math.max(0, Math.round(levelVolume - askVolume));
    levels.push({
      price: round(price),
      bidVolume,
      askVolume,
      delta,
      totalVolume: bidVolume + askVolume,
      trades: Math.max(1, Math.round(levelVolume / 100))
    });
  }

  const totalVolume = levels.reduce((sum, level) => sum + level.totalVolume, 0);
  const bidVolume = levels.reduce((sum, level) => sum + level.bidVolume, 0);
  const askVolume = levels.reduce((sum, level) => sum + level.askVolume, 0);
  const pvp = [...levels].sort((a, b) => b.totalVolume - a.totalVolume)[0]?.price ?? candle.close;
  return {
    ...candle,
    priceLevels: levels,
    totalDelta: allocatedDelta,
    cumulativeDelta: previousCumulativeDelta + allocatedDelta,
    maxDelta: Math.max(...levels.map((level) => level.delta)),
    minDelta: Math.min(...levels.map((level) => level.delta)),
    pvp,
    bidVolume,
    askVolume,
    imbalance: totalVolume ? (askVolume - bidVolume) / totalVolume : 0
  };
}

export function buildFootprints(candles: InstitutionalCandle[]): FootprintCandle[] {
  let cumulative = 0;
  return candles.map((candle) => {
    const footprint = generateFootprint(candle, cumulative);
    cumulative = footprint.cumulativeDelta;
    return footprint;
  });
}

export function analyzeDelta(
candles: InstitutionalCandle[],
lookback = 10)
: DeltaAnalysis {
  if (candles.length < 3) return emptyDelta();
  const footprints = buildFootprints(candles);
  const effectiveLookback = Math.min(lookback, footprints.length - 1);
  const recent = footprints.slice(-effectiveLookback);
  const previous = footprints.slice(-(effectiveLookback + 3), -effectiveLookback);
  const currentDelta = recent.at(-1)?.totalDelta ?? 0;
  const cumulativeDelta = recent.reduce((sum, footprint) => sum + footprint.totalDelta, 0);
  const referenceIndex = Math.max(0, candles.length - effectiveLookback - 1);
  const priceChange = candles.at(-1)!.close - candles[referenceIndex].close;
  const deltaDivergence =
  priceChange > 0 && cumulativeDelta < 0 || priceChange < 0 && cumulativeDelta > 0;
  const divergenceType = !deltaDivergence ?
  null :
  priceChange > 0 ?
  'bearish' :
  'bullish';
  const previousDelta = previous.reduce((sum, footprint) => sum + footprint.totalDelta, 0);
  const flipDirection =
  currentDelta > 0 && previousDelta < 0 ?
  'up' :
  currentDelta < 0 && previousDelta > 0 ?
  'down' :
  null;
  const volumeWindow = candles.slice(-10);
  const averageVolume =
  volumeWindow.reduce((sum, candle) => sum + candle.volume, 0) /
  Math.max(1, volumeWindow.length);
  const absorptionDetected = candles.slice(-3).some((candle) => {
    const range = candle.high - candle.low;
    return candle.volume > averageVolume * 1.5 && range > 0 && Math.abs(candle.close - candle.open) < range * 0.3;
  });
  const last = footprints.at(-1)!;
  const previousFootprint = footprints.at(-2)!;
  const exhaustionDetected =
  Math.sign(last.totalDelta) !== Math.sign(previousFootprint.totalDelta) &&
  Math.abs(last.totalDelta) < Math.abs(previousFootprint.totalDelta) * 0.7;

  return {
    currentDelta,
    cumulativeDelta,
    deltaDivergence,
    divergenceType,
    deltaFlip: flipDirection !== null,
    flipDirection,
    absorptionDetected,
    exhaustionDetected
  };
}

function emptyDelta(): DeltaAnalysis {
  return {
    currentDelta: 0,
    cumulativeDelta: 0,
    deltaDivergence: false,
    divergenceType: null,
    deltaFlip: false,
    flipDirection: null,
    absorptionDetected: false,
    exhaustionDetected: false
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}