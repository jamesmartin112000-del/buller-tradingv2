import { estimateDelta } from './deltaFootprint';
import type { InstitutionalCandle, VolumeImprint } from './types';

export function calculateVI(
candles: InstitutionalCandle[],
period = 12)
: VolumeImprint {
  if (candles.length < Math.min(period + 1, 3)) return emptyImprint();
  const recent = candles.slice(-Math.min(period, candles.length));
  const last = recent.at(-1)!;
  const deltas = recent.map(estimateDelta);
  const delta = deltas.at(-1) ?? 0;
  const deltaMA = average(deltas);
  const volumes = recent.map((candle) => candle.volume);
  const volume = last.volume;
  const volumeMA = average(volumes);
  const volumeStd = Math.sqrt(average(volumes.map((item) => (item - volumeMA) ** 2)));
  const range = Math.max(last.high - last.low, Number.EPSILON);
  const closeLocation = (last.close - last.low) / range;
  const askVolume = last.volume * (0.35 + closeLocation * 0.3);
  const bidVolume = last.volume - askVolume;
  const imbalance = last.volume ? (askVolume - bidVolume) / last.volume : 0;
  const lastThreeRange = average(recent.slice(-3).map((candle) => candle.high - candle.low));
  const averageRange = average(recent.map((candle) => candle.high - candle.low));
  const volumePressure = volumeMA > 0 ? Math.min(1.5, volume / volumeMA) : 0;
  const compression = Math.max(0, 1 - lastThreeRange / Math.max(averageRange, Number.EPSILON));
  const absorption = Math.round(Math.min(100, compression * 70 + Math.max(0, volumePressure - 1) * 60));
  const reference = candles[Math.max(0, candles.length - recent.length - 1)];
  const priceChange = last.close - reference.close;
  const deltaChange = delta - (deltas[0] ?? 0);
  const divergence =
  priceChange > 0 && deltaChange < -Math.abs(deltaMA) * 0.5 ||
  priceChange < 0 && deltaChange > Math.abs(deltaMA) * 0.5;
  const divergenceType = !divergence ? null : priceChange > 0 ? 'bearish' : 'bullish';
  const spikeDetected = volume > volumeMA + volumeStd * 2.5;
  const spikeIntensity = spikeDetected ?
  Math.min(10, Math.round((volume - volumeMA) / Math.max(volumeStd, 1))) :
  0;

  return {
    delta,
    deltaMA,
    volume,
    volumeMA,
    imbalance: Math.round(imbalance * 100) / 100,
    absorption,
    divergence,
    divergenceType,
    spikeDetected,
    spikeIntensity
  };
}

export function analyzeViTrend(
candles: InstitutionalCandle[],
period = 12)
: 'accumulation' | 'distribution' | 'neutral' {
  if (candles.length < period + 2) return 'neutral';
  const results = candles.
  slice(-5).
  map((_, index, slice) => calculateVI(candles.slice(0, candles.length - slice.length + index + 1), period));
  const absorption = average(results.map((result) => result.absorption));
  const imbalance = average(results.map((result) => result.imbalance));
  if (absorption > 60 && imbalance <= 0.1) return 'accumulation';
  if (absorption > 60 && imbalance > 0.2) return 'distribution';
  return 'neutral';
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function emptyImprint(): VolumeImprint {
  return {
    delta: 0,
    deltaMA: 0,
    volume: 0,
    volumeMA: 0,
    imbalance: 0,
    absorption: 0,
    divergence: false,
    divergenceType: null,
    spikeDetected: false,
    spikeIntensity: 0
  };
}