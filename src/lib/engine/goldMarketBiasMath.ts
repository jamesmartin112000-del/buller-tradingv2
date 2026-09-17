import type { BinanceCandle } from '../trading/binanceWebSocket';

export function candleReturns(candles: BinanceCandle[]): number[] {
  const result: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    result.push(
      (candles[index].close - candles[index - 1].close) /
      candles[index - 1].close
    );
  }
  return result;
}

export function pearsonCorrelation(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  if (size < 5) return Number.NaN;
  const a = left.slice(-size);
  const b = right.slice(-size);
  const meanA = a.reduce((sum, value) => sum + value, 0) / size;
  const meanB = b.reduce((sum, value) => sum + value, 0) / size;
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  for (let index = 0; index < size; index += 1) {
    const deltaA = a[index] - meanA;
    const deltaB = b[index] - meanB;
    numerator += deltaA * deltaB;
    denominatorA += deltaA ** 2;
    denominatorB += deltaB ** 2;
  }
  return numerator / Math.sqrt(denominatorA * denominatorB);
}

export function emaLast(values: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  return values.
  slice(1).
  reduce(
    (current, value) => value * multiplier + current * (1 - multiplier),
    values[0] ?? 0
  );
}

export function rsiLast(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;else
    losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  return averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
}

export function averageTrueRange(
candles: BinanceCandle[],
period = 14)
: number {
  const sample = candles.slice(-(period + 1));
  if (sample.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < sample.length; index += 1) {
    total += Math.max(
      sample[index].high - sample[index].low,
      Math.abs(sample[index].high - sample[index - 1].close),
      Math.abs(sample[index].low - sample[index - 1].close)
    );
  }
  return total / (sample.length - 1);
}

export function roundMarketValue(value: number): number {
  return Math.round(value * 100) / 100;
}