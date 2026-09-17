import type { InstitutionalCandle, VwapResult } from './types';

export function calculateVWAP(candles: InstitutionalCandle[]): VwapResult {
  if (!candles.length) return emptyVwap();
  let weightedPrice = 0;
  let totalVolume = 0;
  candles.forEach((candle) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    weightedPrice += typicalPrice * candle.volume;
    totalVolume += candle.volume;
  });
  const vwap = totalVolume > 0 ? weightedPrice / totalVolume : candles.at(-1)!.close;
  const variance =
  candles.reduce((sum, candle) => sum + (candle.close - vwap) ** 2, 0) /
  candles.length;
  const deviationUnit = Math.sqrt(variance);
  const currentPrice = candles.at(-1)!.close;
  const deviation = deviationUnit > 0 ? (currentPrice - vwap) / deviationUnit : 0;
  const priceRelative = deviation > 0.1 ? 'above' : deviation < -0.1 ? 'below' : 'at';
  return {
    vwap: round(vwap),
    upperBand1: round(vwap + deviationUnit),
    lowerBand1: round(vwap - deviationUnit),
    upperBand2: round(vwap + deviationUnit * 2),
    lowerBand2: round(vwap - deviationUnit * 2),
    upperBand3: round(vwap + deviationUnit * 3),
    lowerBand3: round(vwap - deviationUnit * 3),
    priceRelative,
    deviation: Math.round(deviation * 100) / 100
  };
}

export function checkVwapTrend(
candles: InstitutionalCandle[],
lookback = 20)
: 'bullish' | 'bearish' | 'neutral' {
  if (candles.length < 3) return 'neutral';
  const recent = candles.slice(-Math.min(lookback, candles.length));
  const vwap = calculateVWAP(candles).vwap;
  const above = recent.filter((candle) => candle.close > vwap).length / recent.length;
  return above > 0.7 ? 'bullish' : above < 0.3 ? 'bearish' : 'neutral';
}

function emptyVwap(): VwapResult {
  return {
    vwap: 0,
    upperBand1: 0,
    lowerBand1: 0,
    upperBand2: 0,
    lowerBand2: 0,
    upperBand3: 0,
    lowerBand3: 0,
    priceRelative: 'at',
    deviation: 0
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}