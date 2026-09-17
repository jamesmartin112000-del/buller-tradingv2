import type { Candle } from './types';

export type PatternStrength = 'weak' | 'medium' | 'strong' | 'very_strong';
export type PatternType = 'bullish' | 'bearish' | 'neutral';

export interface CandlestickPattern {
  name: string;
  type: PatternType;
  strength: PatternStrength;
  description: string;
  level?: number;
  index: number;
}

/**
 * Comprehensive candlestick pattern detection engine.
 * Ported from the strategies brief — covers single, two, and three-candle
 * formations. Returns up to the last 8 detected patterns by recency.
 */
export function detectCandlestickPatterns(
candles: Candle[])
: CandlestickPattern[] {
  if (!candles || candles.length < 4) return [];
  const out: CandlestickPattern[] = [];

  // Scan a window: last 10 candles for one/two-candle, with three-candle look-back
  const startIdx = Math.max(2, candles.length - 12);

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const c2 = candles[i - 2];
    out.push(...detectSingle(c, candles, i));
    if (prev) out.push(...detectTwo(prev, c, i));
    if (prev && c2) out.push(...detectThree(c2, prev, c, i));
  }

  // Dedupe by (name + index) — keep latest occurrences
  const seen = new Set<string>();
  const unique: CandlestickPattern[] = [];
  for (let i = out.length - 1; i >= 0; i--) {
    const key = `${out[i].name}@${out[i].index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.unshift(out[i]);
  }
  return unique.slice(-8).reverse();
}

function detectSingle(
c: Candle,
candles: Candle[],
index: number)
: CandlestickPattern[] {
  const out: CandlestickPattern[] = [];
  const body = Math.abs(c.c - c.o);
  const upper = c.h - Math.max(c.o, c.c);
  const lower = Math.min(c.o, c.c) - c.l;
  const range = c.h - c.l;
  if (range === 0) return out;
  const rb = body / range;
  const ru = upper / range;
  const rl = lower / range;
  const bullish = c.c > c.o;

  // Doji family
  if (rb < 0.05) {
    if (rl > 0.7 && ru < 0.1) {
      out.push({
        name: 'Dragonfly Doji',
        type: 'bullish',
        strength: 'strong',
        description: 'Long lower wick rejection — bullish reversal signal',
        level: c.h,
        index
      });
    } else if (ru > 0.7 && rl < 0.1) {
      out.push({
        name: 'Gravestone Doji',
        type: 'bearish',
        strength: 'strong',
        description: 'Long upper wick rejection — bearish reversal signal',
        level: c.l,
        index
      });
    } else if (ru > 0.4 && rl > 0.4) {
      out.push({
        name: 'Long-Legged Doji',
        type: 'neutral',
        strength: 'medium',
        description: 'High volatility indecision — potential turning point',
        level: c.c,
        index
      });
    } else {
      out.push({
        name: 'Doji',
        type: 'neutral',
        strength: 'weak',
        description: 'Indecision — wait for confirmation',
        level: c.c,
        index
      });
    }
  }

  // Marubozu
  if (rb > 0.9) {
    out.push({
      name: bullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
      type: bullish ? 'bullish' : 'bearish',
      strength: 'strong',
      description: bullish ?
      'Full body bullish candle — strong buying momentum' :
      'Full body bearish candle — strong selling momentum',
      level: bullish ? c.l : c.h,
      index
    });
  }

  // Hammer / Hanging Man / Shooting Star / Inverted Hammer
  if (rb < 0.4) {
    const downtrend = isDowntrend(candles, index);
    const uptrend = isUptrend(candles, index);
    if (lower > body * 2.5 && rl > 0.5 && ru < 0.2) {
      if (downtrend) {
        out.push({
          name: 'Hammer',
          type: 'bullish',
          strength: 'strong',
          description: 'Long lower wick in downtrend — bullish reversal',
          level: c.l,
          index
        });
      } else if (uptrend) {
        out.push({
          name: 'Hanging Man',
          type: 'bearish',
          strength: 'medium',
          description: 'Long lower wick in uptrend — bearish warning',
          level: c.l,
          index
        });
      }
    }
    if (upper > body * 2.5 && ru > 0.5 && rl < 0.2) {
      if (uptrend && !bullish) {
        out.push({
          name: 'Shooting Star',
          type: 'bearish',
          strength: 'strong',
          description: 'Long upper wick in uptrend — bearish reversal',
          level: c.h,
          index
        });
      } else if (downtrend && bullish) {
        out.push({
          name: 'Inverted Hammer',
          type: 'bullish',
          strength: 'medium',
          description: 'Long upper wick in downtrend — bullish reversal hint',
          level: c.l,
          index
        });
      }
    }
  }

  // Spinning Top
  if (rb < 0.3 && ru > 0.3 && rl > 0.3) {
    out.push({
      name: 'Spinning Top',
      type: 'neutral',
      strength: 'weak',
      description: 'Indecision in both directions — consolidation',
      level: c.c,
      index
    });
  }

  return out;
}

function detectTwo(p: Candle, c: Candle, index: number): CandlestickPattern[] {
  const out: CandlestickPattern[] = [];
  const pBody = Math.abs(p.c - p.o);
  const cBody = Math.abs(c.c - c.o);
  const pRange = p.h - p.l;
  const cRange = c.h - c.l;
  if (pBody === 0 || cBody === 0 || pRange === 0 || cRange === 0) return out;
  const pBull = p.c > p.o;
  const cBull = c.c > c.o;

  // Engulfing
  if (!pBull && cBull && c.o < p.c && c.c > p.o && cBody > pBody) {
    out.push({
      name: 'Bullish Engulfing',
      type: 'bullish',
      strength: 'strong',
      description:
      'Full bullish engulf of prior bearish candle — strong reversal',
      level: Math.min(p.l, c.l),
      index
    });
  }
  if (pBull && !cBull && c.o > p.c && c.c < p.o && cBody > pBody) {
    out.push({
      name: 'Bearish Engulfing',
      type: 'bearish',
      strength: 'strong',
      description:
      'Full bearish engulf of prior bullish candle — strong reversal',
      level: Math.max(p.h, c.h),
      index
    });
  }

  // Harami
  if (!pBull && cBull && c.o > p.c && c.c < p.o && cBody < pBody * 0.6) {
    if (cBody / cRange < 0.05) {
      out.push({
        name: 'Bullish Harami Cross',
        type: 'bullish',
        strength: 'strong',
        description: 'Doji inside prior bearish body — strong reversal hint',
        level: c.l,
        index
      });
    } else {
      out.push({
        name: 'Bullish Harami',
        type: 'bullish',
        strength: 'medium',
        description:
        'Small bullish body inside prior bearish — potential reversal',
        level: c.l,
        index
      });
    }
  }
  if (pBull && !cBull && c.o < p.c && c.c > p.o && cBody < pBody * 0.6) {
    if (cBody / cRange < 0.05) {
      out.push({
        name: 'Bearish Harami Cross',
        type: 'bearish',
        strength: 'strong',
        description: 'Doji inside prior bullish body — strong reversal hint',
        level: c.h,
        index
      });
    } else {
      out.push({
        name: 'Bearish Harami',
        type: 'bearish',
        strength: 'medium',
        description:
        'Small bearish body inside prior bullish — potential reversal',
        level: c.h,
        index
      });
    }
  }

  // Piercing Line / Dark Cloud Cover
  if (!pBull && cBull && c.o < p.l && c.c > (p.o + p.c) / 2 && c.c < p.o) {
    out.push({
      name: 'Piercing Line',
      type: 'bullish',
      strength: 'medium',
      description:
      'Bullish pierce into prior bearish body — reversal confirmation',
      level: c.l,
      index
    });
  }
  if (pBull && !cBull && c.o > p.h && c.c < (p.o + p.c) / 2 && c.c > p.o) {
    out.push({
      name: 'Dark Cloud Cover',
      type: 'bearish',
      strength: 'medium',
      description:
      'Bearish cloud over prior bullish body — reversal confirmation',
      level: c.h,
      index
    });
  }

  // Tweezers
  const lowDiff = Math.abs(p.l - c.l) / Math.max(p.l, c.l);
  const highDiff = Math.abs(p.h - c.h) / Math.max(p.h, c.h);
  if (lowDiff < 0.002 && !pBull && cBull) {
    out.push({
      name: 'Tweezer Bottom',
      type: 'bullish',
      strength: 'medium',
      description: 'Matching lows — double bottom reversal',
      level: c.l,
      index
    });
  }
  if (highDiff < 0.002 && pBull && !cBull) {
    out.push({
      name: 'Tweezer Top',
      type: 'bearish',
      strength: 'medium',
      description: 'Matching highs — double top reversal',
      level: c.h,
      index
    });
  }

  return out;
}

function detectThree(
c1: Candle,
c2: Candle,
c3: Candle,
index: number)
: CandlestickPattern[] {
  const out: CandlestickPattern[] = [];
  const b1 = Math.abs(c1.c - c1.o);
  const b2 = Math.abs(c2.c - c2.o);
  const b3 = Math.abs(c3.c - c3.o);
  const r1 = c1.h - c1.l;
  const r2 = c2.h - c2.l;
  const r3 = c3.h - c3.l;
  if (r1 === 0 || r2 === 0 || r3 === 0) return out;
  const d1 = b1 / r1;
  const d2 = b2 / r2;
  const d3 = b3 / r3;
  const bull1 = c1.c > c1.o;
  const bull2 = c2.c > c2.o;
  const bull3 = c3.c > c3.o;

  // Morning Star
  if (
  !bull1 &&
  d1 > 0.3 &&
  d2 < 0.3 &&
  bull3 &&
  d3 > 0.3 &&
  c3.c > (c1.o + c1.c) / 2)
  {
    if (d2 < 0.05) {
      out.push({
        name: 'Morning Doji Star',
        type: 'bullish',
        strength: 'very_strong',
        description: 'Doji middle — strongest bullish reversal pattern',
        level: Math.min(c1.l, c2.l, c3.l),
        index
      });
    } else {
      out.push({
        name: 'Morning Star',
        type: 'bullish',
        strength: 'very_strong',
        description: 'Classic bullish reversal — high reliability (70%+)',
        level: Math.min(c1.l, c2.l, c3.l),
        index
      });
    }
  }

  // Evening Star
  if (
  bull1 &&
  d1 > 0.3 &&
  d2 < 0.3 &&
  !bull3 &&
  d3 > 0.3 &&
  c3.c < (c1.o + c1.c) / 2)
  {
    if (d2 < 0.05) {
      out.push({
        name: 'Evening Doji Star',
        type: 'bearish',
        strength: 'very_strong',
        description: 'Doji middle — strongest bearish reversal pattern',
        level: Math.max(c1.h, c2.h, c3.h),
        index
      });
    } else {
      out.push({
        name: 'Evening Star',
        type: 'bearish',
        strength: 'very_strong',
        description: 'Classic bearish reversal — high reliability (70%+)',
        level: Math.max(c1.h, c2.h, c3.h),
        index
      });
    }
  }

  // Three White Soldiers
  if (
  bull1 &&
  bull2 &&
  bull3 &&
  c1.c < c2.c &&
  c2.c < c3.c &&
  c1.o < c2.o &&
  c2.o < c3.o &&
  d1 > 0.3 &&
  d2 > 0.3 &&
  d3 > 0.3)
  {
    out.push({
      name: 'Three White Soldiers',
      type: 'bullish',
      strength: 'strong',
      description: 'Three consecutive strong bullish candles — continuation',
      level: c1.l,
      index
    });
  }

  // Three Black Crows
  if (
  !bull1 &&
  !bull2 &&
  !bull3 &&
  c1.c > c2.c &&
  c2.c > c3.c &&
  c1.o > c2.o &&
  c2.o > c3.o &&
  d1 > 0.3 &&
  d2 > 0.3 &&
  d3 > 0.3)
  {
    out.push({
      name: 'Three Black Crows',
      type: 'bearish',
      strength: 'strong',
      description: 'Three consecutive strong bearish candles — continuation',
      level: c1.h,
      index
    });
  }

  // Three Inside Up / Down
  if (
  !bull1 &&
  bull2 &&
  bull3 &&
  c2.o > c1.c &&
  c2.c < c1.o &&
  c3.c > c1.o &&
  b2 < b1 * 0.6)
  {
    out.push({
      name: 'Three Inside Up',
      type: 'bullish',
      strength: 'medium',
      description: 'Harami + confirmation candle — bullish reversal',
      level: c2.l,
      index
    });
  }
  if (
  bull1 &&
  !bull2 &&
  !bull3 &&
  c2.o < c1.c &&
  c2.c > c1.o &&
  c3.c < c1.o &&
  b2 < b1 * 0.6)
  {
    out.push({
      name: 'Three Inside Down',
      type: 'bearish',
      strength: 'medium',
      description: 'Harami + confirmation candle — bearish reversal',
      level: c2.h,
      index
    });
  }

  // Three Outside Up / Down
  if (
  !bull1 &&
  bull2 &&
  bull3 &&
  c2.o < c1.c &&
  c2.c > c1.o &&
  c3.c > c2.c &&
  b2 > b1)
  {
    out.push({
      name: 'Three Outside Up',
      type: 'bullish',
      strength: 'strong',
      description: 'Engulfing + continuation — strong bullish reversal',
      level: c1.l,
      index
    });
  }
  if (
  bull1 &&
  !bull2 &&
  !bull3 &&
  c2.o > c1.c &&
  c2.c < c1.o &&
  c3.c < c2.c &&
  b2 > b1)
  {
    out.push({
      name: 'Three Outside Down',
      type: 'bearish',
      strength: 'strong',
      description: 'Engulfing + continuation — strong bearish reversal',
      level: c1.h,
      index
    });
  }

  return out;
}

function isUptrend(candles: Candle[], idx: number): boolean {
  const start = Math.max(0, idx - 5);
  const slice = candles.slice(start, idx);
  if (slice.length < 3) return false;
  return slice[slice.length - 1].c > slice[0].c;
}

function isDowntrend(candles: Candle[], idx: number): boolean {
  const start = Math.max(0, idx - 5);
  const slice = candles.slice(start, idx);
  if (slice.length < 3) return false;
  return slice[slice.length - 1].c < slice[0].c;
}

/** Summarize patterns by bullish/bearish counts. */
export function summarizePatterns(patterns: CandlestickPattern[]) {
  return {
    bullish: patterns.filter((p) => p.type === 'bullish').length,
    bearish: patterns.filter((p) => p.type === 'bearish').length,
    neutral: patterns.filter((p) => p.type === 'neutral').length,
    strongest:
    patterns.find((p) => p.strength === 'very_strong') ||
    patterns.find((p) => p.strength === 'strong') ||
    null
  };
}