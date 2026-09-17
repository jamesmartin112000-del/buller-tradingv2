import type { Candle } from './types';

export interface ChartPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: 'medium' | 'strong';
  target?: number;
  neckline?: number;
  description: string;
}

export interface FibLevels {
  '0.0': number;
  '0.236': number;
  '0.382': number;
  '0.5': number;
  '0.618': number;
  '0.786': number;
  '1.0': number;
  '1.272': number;
  '1.414': number;
  '1.618': number;
}

/**
 * Detects classic chart patterns: double tops/bottoms, head & shoulders,
 * triangles, wedges, and flags. Returns the highest-conviction matches.
 */
export function detectChartPatterns(candles: Candle[]): ChartPattern[] {
  if (!candles || candles.length < 20) return [];
  const out: ChartPattern[] = [];
  out.push(...detectDoubleTopBottom(candles));
  out.push(...detectHeadAndShoulders(candles));
  out.push(...detectTriangles(candles));
  out.push(...detectWedges(candles));
  out.push(...detectFlags(candles));
  // Order: strong first
  return out.sort((a, b) => a.strength === 'strong' ? -1 : 1).slice(0, 6);
}

function detectDoubleTopBottom(
candles: Candle[],
tolerance = 0.015)
: ChartPattern[] {
  const out: ChartPattern[] = [];
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const peaks: {p: number;i: number;}[] = [];
  const troughs: {p: number;i: number;}[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (
    highs[i] > highs[i - 1] &&
    highs[i] > highs[i - 2] &&
    highs[i] > highs[i + 1] &&
    highs[i] > highs[i + 2])

    peaks.push({ p: highs[i], i });
    if (
    lows[i] < lows[i - 1] &&
    lows[i] < lows[i - 2] &&
    lows[i] < lows[i + 1] &&
    lows[i] < lows[i + 2])

    troughs.push({ p: lows[i], i });
  }

  // Double Top — only check most recent pairs
  for (let i = 0; i < peaks.length - 1; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const diff = Math.abs(peaks[i].p - peaks[j].p) / peaks[i].p;
      if (diff < tolerance && peaks[j].i - peaks[i].i > 3) {
        const between = lows.slice(peaks[i].i, peaks[j].i);
        if (!between.length) continue;
        const neckline = Math.min(...between);
        out.push({
          name: 'Double Top',
          type: 'bearish',
          strength: diff < tolerance * 0.5 ? 'strong' : 'medium',
          neckline,
          target: neckline - (peaks[i].p - neckline),
          description:
          'Two matching peaks — bearish reversal on neckline break'
        });
        break;
      }
    }
  }

  // Double Bottom
  for (let i = 0; i < troughs.length - 1; i++) {
    for (let j = i + 1; j < troughs.length; j++) {
      const diff = Math.abs(troughs[i].p - troughs[j].p) / troughs[i].p;
      if (diff < tolerance && troughs[j].i - troughs[i].i > 3) {
        const between = highs.slice(troughs[i].i, troughs[j].i);
        if (!between.length) continue;
        const neckline = Math.max(...between);
        out.push({
          name: 'Double Bottom',
          type: 'bullish',
          strength: diff < tolerance * 0.5 ? 'strong' : 'medium',
          neckline,
          target: neckline + (neckline - troughs[i].p),
          description:
          'Two matching troughs — bullish reversal on neckline break'
        });
        break;
      }
    }
  }
  return out;
}

function detectHeadAndShoulders(
candles: Candle[],
tolerance = 0.02)
: ChartPattern[] {
  const out: ChartPattern[] = [];
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const peaks: {p: number;i: number;}[] = [];
  const troughs: {p: number;i: number;}[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (
    highs[i] > highs[i - 1] &&
    highs[i] > highs[i - 2] &&
    highs[i] > highs[i + 1] &&
    highs[i] > highs[i + 2])

    peaks.push({ p: highs[i], i });
    if (
    lows[i] < lows[i - 1] &&
    lows[i] < lows[i - 2] &&
    lows[i] < lows[i + 1] &&
    lows[i] < lows[i + 2])

    troughs.push({ p: lows[i], i });
  }

  for (let i = 0; i < peaks.length - 2; i++) {
    const left = peaks[i];
    const head = peaks[i + 1];
    const right = peaks[i + 2];
    if (head.p > left.p && head.p > right.p) {
      const lrDiff = Math.abs(left.p - right.p) / left.p;
      if (lrDiff < tolerance) {
        const low1 = Math.min(...lows.slice(left.i, head.i));
        const low2 = Math.min(...lows.slice(head.i, right.i));
        const neckline = Math.min(low1, low2);
        out.push({
          name: 'Head & Shoulders',
          type: 'bearish',
          strength: 'strong',
          neckline,
          target: neckline - (head.p - neckline),
          description:
          'Classic top reversal — break of neckline confirms downtrend'
        });
        break;
      }
    }
  }

  for (let i = 0; i < troughs.length - 2; i++) {
    const left = troughs[i];
    const head = troughs[i + 1];
    const right = troughs[i + 2];
    if (head.p < left.p && head.p < right.p) {
      const lrDiff = Math.abs(left.p - right.p) / left.p;
      if (lrDiff < tolerance) {
        const high1 = Math.max(...highs.slice(left.i, head.i));
        const high2 = Math.max(...highs.slice(head.i, right.i));
        const neckline = Math.max(high1, high2);
        out.push({
          name: 'Inverse Head & Shoulders',
          type: 'bullish',
          strength: 'strong',
          neckline,
          target: neckline + (neckline - head.p),
          description:
          'Classic bottom reversal — break of neckline confirms uptrend'
        });
        break;
      }
    }
  }
  return out;
}

function detectTriangles(candles: Candle[], lookback = 30): ChartPattern[] {
  const recent = candles.slice(-lookback);
  if (recent.length < 15) return [];
  const out: ChartPattern[] = [];
  const highs = recent.map((c) => c.h);
  const lows = recent.map((c) => c.l);
  const len = recent.length;
  const highSlope = (highs[len - 1] - highs[0]) / len;
  const lowSlope = (lows[len - 1] - lows[0]) / len;
  const firstRange = highs[0] - lows[0];
  const lastRange = highs[len - 1] - lows[len - 1];
  const lastPrice = recent[len - 1].c;
  const slopeUnit = lastPrice * 0.0005;

  if (Math.abs(highSlope) < slopeUnit && lowSlope > slopeUnit * 0.5) {
    out.push({
      name: 'Ascending Triangle',
      type: 'bullish',
      strength: 'medium',
      target: highs[len - 1] + (highs[len - 1] - lows[len - 1]),
      neckline: highs[len - 1],
      description: 'Flat resistance + rising support — bullish breakout setup'
    });
  }
  if (highSlope < -slopeUnit * 0.5 && Math.abs(lowSlope) < slopeUnit) {
    out.push({
      name: 'Descending Triangle',
      type: 'bearish',
      strength: 'medium',
      target: lows[len - 1] - (highs[len - 1] - lows[len - 1]),
      neckline: lows[len - 1],
      description:
      'Flat support + falling resistance — bearish breakdown setup'
    });
  }
  if (
  Math.abs(highSlope) < slopeUnit &&
  Math.abs(lowSlope) < slopeUnit &&
  firstRange > 0 &&
  (firstRange - lastRange) / firstRange > 0.2)
  {
    out.push({
      name: 'Symmetrical Triangle',
      type: 'neutral',
      strength: 'medium',
      target: lastPrice + lastRange,
      description:
      'Converging trendlines — directional breakout pending, watch volume'
    });
  }
  return out;
}

function detectWedges(candles: Candle[], lookback = 30): ChartPattern[] {
  const recent = candles.slice(-lookback);
  if (recent.length < 15) return [];
  const out: ChartPattern[] = [];
  const highs = recent.map((c) => c.h);
  const lows = recent.map((c) => c.l);
  const len = recent.length;
  const highSlope = (highs[len - 1] - highs[0]) / len;
  const lowSlope = (lows[len - 1] - lows[0]) / len;

  if (highSlope > 0 && lowSlope > 0 && highSlope > lowSlope) {
    out.push({
      name: 'Rising Wedge',
      type: 'bearish',
      strength: 'medium',
      description:
      'Both lines rising, upper steeper — bearish reversal expected'
    });
  }
  if (highSlope < 0 && lowSlope < 0 && lowSlope < highSlope) {
    out.push({
      name: 'Falling Wedge',
      type: 'bullish',
      strength: 'medium',
      description:
      'Both lines falling, lower steeper — bullish reversal expected'
    });
  }
  return out;
}

function detectFlags(candles: Candle[], lookback = 20): ChartPattern[] {
  const recent = candles.slice(-lookback);
  if (recent.length < 10) return [];
  const out: ChartPattern[] = [];
  const closes = recent.map((c) => c.c);
  const half = Math.floor(recent.length / 2);
  const firstHalf = closes.slice(0, half);
  const secondHalf = closes.slice(half);
  if (!firstHalf.length || !secondHalf.length) return out;
  const firstMove = firstHalf[firstHalf.length - 1] - firstHalf[0];
  const secondRange = Math.max(...secondHalf) - Math.min(...secondHalf);
  const lastPrice = closes[closes.length - 1];

  if (firstMove > 0 && secondRange < Math.abs(firstMove) * 0.3) {
    out.push({
      name: 'Bullish Flag',
      type: 'bullish',
      strength: 'medium',
      target: lastPrice + firstMove,
      description: 'Strong rally + tight consolidation — continuation expected'
    });
  }
  if (firstMove < 0 && secondRange < Math.abs(firstMove) * 0.3) {
    out.push({
      name: 'Bearish Flag',
      type: 'bearish',
      strength: 'medium',
      target: lastPrice + firstMove,
      description: 'Strong drop + tight consolidation — continuation expected'
    });
  }
  return out;
}

/** Standard Fibonacci retracement + extension levels from a swing. */
export function fibonacci(high: number, low: number): FibLevels | null {
  if (high <= low) return null;
  const d = high - low;
  return {
    '0.0': high,
    '0.236': high - d * 0.236,
    '0.382': high - d * 0.382,
    '0.5': high - d * 0.5,
    '0.618': high - d * 0.618,
    '0.786': high - d * 0.786,
    '1.0': low,
    '1.272': low - d * 0.272,
    '1.414': low - d * 0.414,
    '1.618': low - d * 0.618
  };
}