// ============================================================
// INSTITUTIONAL TRADING ENGINE v5.0 — REAL ANALYSIS ENGINE
// Self-contained TypeScript port of the standalone vanilla app.js.
// Operates on BinanceCandle[] (open/high/low/close/volume/timestamp).
// ============================================================
import type { BinanceCandle } from '../trading/binanceWebSocket';

export type Dir = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

// ─── BASIC INDICATORS ───
export function sma(data: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(data: number[], period: number): number[] {
  const out: number[] = [];
  const mult = 2 / (period + 1);
  let e = data[0] ?? 0;
  out.push(e);
  for (let i = 1; i < data.length; i++) {
    e = (data[i] - e) * mult + e;
    out.push(e);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return closes.map(() => 50);
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++)
  changes.push(closes[i] - closes[i - 1]);
  const gains = changes.map((c) => c > 0 ? c : 0);
  const losses = changes.map((c) => c < 0 ? -c : 0);
  const avgGain = [gains.slice(0, period).reduce((a, b) => a + b, 0) / period];
  const avgLoss = [losses.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < gains.length; i++) {
    avgGain.push(
      (avgGain[avgGain.length - 1] * (period - 1) + gains[i]) / period
    );
    avgLoss.push(
      (avgLoss[avgLoss.length - 1] * (period - 1) + losses[i]) / period
    );
  }
  const out = avgGain.map((g, i) =>
  avgLoss[i] === 0 ? 100 : 100 - 100 / (1 + g / avgLoss[i])
  );
  while (out.length < closes.length) out.unshift(50);
  return out;
}

export function bollinger(closes: number[], period = 20, std = 2) {
  const mid = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    let count = 0;
    for (let j = Math.max(0, i - period + 1); j <= i; j++) {
      sumSq += Math.pow(closes[j] - m, 2);
      count++;
    }
    const sd = Math.sqrt(sumSq / count);
    upper.push(m + std * sd);
    lower.push(m - std * sd);
  }
  return { upper, middle: mid, lower };
}

export function atr(candles: BinanceCandle[], period = 14): number[] {
  if (candles.length < 2) return candles.map(() => 0);
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const out: number[] = [];
  let first = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(first);
  for (let i = period; i < tr.length; i++) {
    out.push((out[out.length - 1] * (period - 1) + tr[i]) / period);
  }
  while (out.length < candles.length) out.unshift(out[0] || 0);
  return out;
}

// ─── SMART MONEY CONCEPTS ───
export interface Swing {
  index: number;
  type: 'high' | 'low';
  price: number;
  time: number;
}

export function findSwingPoints(
candles: BinanceCandle[],
lookback = 5)
: Swing[] {
  const swings: Swing[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh)
    swings.push({
      index: i,
      type: 'high',
      price: candles[i].high,
      time: candles[i].timestamp
    });
    if (isLow)
    swings.push({
      index: i,
      type: 'low',
      price: candles[i].low,
      time: candles[i].timestamp
    });
  }
  return swings;
}

export interface FVG {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  index: number;
}

export function detectFVG(candles: BinanceCandle[]): FVG[] {
  const out: FVG[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev = candles[i - 2];
    const curr = candles[i];
    if (prev.high < curr.low)
    out.push({ type: 'bullish', top: curr.low, bottom: prev.high, index: i });
    if (prev.low > curr.high)
    out.push({ type: 'bearish', top: prev.low, bottom: curr.high, index: i });
  }
  return out;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  time: number;
}

export function detectOrderBlocks(
candles: BinanceCandle[],
swings: Swing[])
: OrderBlock[] {
  const out: OrderBlock[] = [];
  for (const s of swings) {
    const idx = s.index;
    if (idx < 1 || idx >= candles.length) continue;
    const ob = candles[idx - 1];
    if (s.type === 'low' && ob.close < ob.open) {
      out.push({ type: 'bullish', top: ob.high, bottom: ob.low, time: s.time });
    } else if (s.type === 'high' && ob.close > ob.open) {
      out.push({ type: 'bearish', top: ob.high, bottom: ob.low, time: s.time });
    }
  }
  return out;
}

export interface Sweep {
  type: 'bullish' | 'bearish';
  price: number;
  time: number;
}

export function detectLiquiditySweeps(
candles: BinanceCandle[],
swings: Swing[])
: Sweep[] {
  const out: Sweep[] = [];
  for (let i = 5; i < candles.length - 1; i++) {
    for (const s of swings) {
      if (s.type !== 'low' || s.index > i) continue;
      if (candles[i].low < s.price * 0.999 && candles[i].close > s.price) {
        out.push({
          type: 'bullish',
          price: s.price,
          time: candles[i].timestamp
        });
        break;
      }
    }
    for (const s of swings) {
      if (s.type !== 'high' || s.index > i) continue;
      if (candles[i].high > s.price * 1.001 && candles[i].close < s.price) {
        out.push({
          type: 'bearish',
          price: s.price,
          time: candles[i].timestamp
        });
        break;
      }
    }
  }
  return out;
}

// ─── AMD PHASE DETECTION ───
export interface AMDResult {
  phase: string;
  confidence: number;
}

export function detectAMD(candles: BinanceCandle[]): AMDResult {
  if (candles.length < 50) return { phase: 'UNKNOWN', confidence: 0 };
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const recent = candles.slice(-20);
  const recentCloses = recent.map((c) => c.close);
  const recentVolumes = recent.map((c) => c.volume);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const latest50 = e50[e50.length - 1];
  const latest200 = e200.length > 0 ? e200[e200.length - 1] : latest50;
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentAvgVol =
  recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const volRatio = recentAvgVol / (avgVol || 1);
  const priceChange =
  (recentCloses[recentCloses.length - 1] / recentCloses[0] - 1) * 100;
  const ranges = recent.map((c) => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;

  let phase = 'UNKNOWN';
  let confidence = 0;

  if (
  Math.abs(priceChange) < 3 &&
  volRatio < 0.8 &&
  latest50 <= latest200 * 1.02)
  {
    phase = 'ACCUMULATION';
    confidence = Math.min(
      95,
      50 + (1 - volRatio) * 30 + (3 - Math.abs(priceChange)) * 5
    );
  }
  if (Math.abs(priceChange) > 2 && volRatio > 1.3) {
    const avgWick =
    recent.
    map(
      (c) =>
      Math.abs(c.high - Math.max(c.open, c.close)) +
      Math.abs(c.low - Math.min(c.open, c.close))
    ).
    reduce((a, b) => a + b, 0) / recent.length;
    const avgBody =
    recent.map((c) => Math.abs(c.close - c.open)).reduce((a, b) => a + b, 0) /
    recent.length;
    const wickToBody = avgWick / (avgBody || 0.001);
    if (wickToBody > 1.5) {
      phase = 'MANIPULATION';
      confidence = Math.min(95, 50 + (volRatio - 1) * 20 + wickToBody * 10);
    }
  }
  if (priceChange > 0 && volRatio > 1.0 && latest50 > latest200 * 1.03) {
    const avgUpperWick =
    recent.
    map((c) => c.high - Math.max(c.open, c.close)).
    reduce((a, b) => a + b, 0) / recent.length;
    if (avgUpperWick > avgRange * 0.4 || volRatio > 1.5) {
      phase = 'DISTRIBUTION';
      confidence = Math.min(95, 50 + volRatio * 15);
    }
  }
  if (confidence < 30) {
    if (priceChange > 5) {
      phase = 'MARKUP';
      confidence = 60;
    } else if (priceChange < -5) {
      phase = 'MARKDOWN';
      confidence = 60;
    } else {
      phase = 'RANGE';
      confidence = 50;
    }
  }
  return { phase, confidence: Math.round(confidence) };
}

// ─── TRAP DETECTION ───
export interface Trap {
  type: 'BEAR TRAP' | 'BULL TRAP';
  price: number;
  time: number;
  confidence: number;
}

export function detectTraps(candles: BinanceCandle[], swings: Swing[]): Trap[] {
  const out: Trap[] = [];
  for (let i = 10; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];
    if (
    prev2.low < prev.low &&
    prev.low < curr.low &&
    curr.close > prev.close)
    {
      for (const s of swings) {
        if (
        s.type === 'low' &&
        Math.abs(prev.low - s.price) / s.price < 0.005)
        {
          out.push({
            type: 'BEAR TRAP',
            price: s.price,
            time: curr.timestamp,
            confidence: Math.round(
              Math.min(
                90,
                50 + Math.abs(curr.close - prev.low) / prev.low * 500
              )
            )
          });
          break;
        }
      }
    }
    if (
    prev2.high > prev.high &&
    prev.high > curr.high &&
    curr.close < prev.close)
    {
      for (const s of swings) {
        if (
        s.type === 'high' &&
        Math.abs(prev.high - s.price) / s.price < 0.005)
        {
          out.push({
            type: 'BULL TRAP',
            price: s.price,
            time: curr.timestamp,
            confidence: Math.round(
              Math.min(
                90,
                50 + Math.abs(prev.high - curr.close) / curr.close * 500
              )
            )
          });
          break;
        }
      }
    }
  }
  return out;
}

// ─── HIDDEN CANDLE PATTERNS ───
export interface HiddenPattern {
  type: string;
  strength: 'STRONG' | 'MODERATE';
  time: number;
}

export function detectHiddenPatterns(
candles: BinanceCandle[])
: HiddenPattern[] {
  const out: HiddenPattern[] = [];
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i];
    const c1 = candles[i - 1];
    const c2 = candles[i - 2];
    const c3 = candles[i - 3];
    // Silent Army
    if (c.close > c.open && c1.close > c1.open && c2.close > c2.open) {
      const resistance = Math.max(c3.high, c2.high, c1.high);
      if (c.close > resistance && c.high > resistance)
      out.push({
        type: 'SILENT_ARMY_BULLISH',
        strength: 'STRONG',
        time: c.timestamp
      });
    }
    if (c.close < c.open && c1.close < c1.open && c2.close < c2.open) {
      const support = Math.min(c3.low, c2.low, c1.low);
      if (c.close < support && c.low < support)
      out.push({
        type: 'SILENT_ARMY_BEARISH',
        strength: 'STRONG',
        time: c.timestamp
      });
    }
    // Liquidity Leech
    const body = Math.abs(c.close - c.open);
    const wick = c.high - c.low;
    if (wick > body * 4 && wick > 0) {
      const volSma =
      candles.
      slice(Math.max(0, i - 20), i).
      reduce((s, x) => s + x.volume, 0) / Math.min(20, i);
      if (c.volume < volSma * 0.7) {
        const bull = c.close > c.open;
        out.push({
          type: bull ? 'LIQUIDITY_LEECH_BULLISH' : 'LIQUIDITY_LEECH_BEARISH',
          strength: 'MODERATE',
          time: c.timestamp
        });
      }
    }
    // Echo Rejection
    const midC2 = (c2.high + c2.low) / 2;
    if (
    c1.low < midC2 &&
    c1.close > midC2 &&
    c2.low < midC2 &&
    c2.close > midC2)

    out.push({
      type: 'ECHO_REJECTION_BULLISH',
      strength: 'MODERATE',
      time: c.timestamp
    });
    if (
    c1.high > midC2 &&
    c1.close < midC2 &&
    c2.high > midC2 &&
    c2.close < midC2)

    out.push({
      type: 'ECHO_REJECTION_BEARISH',
      strength: 'MODERATE',
      time: c.timestamp
    });
  }
  return out;
}

// ─── ORDER FLOW ───
export interface OrderFlow {
  buyPressure: string;
  sellPressure: string;
  imbalance: string;
  regime: string;
  volRegime: string;
}

export function analyzeOrderFlow(candles: BinanceCandle[]): OrderFlow {
  if (candles.length < 20)
  return {
    buyPressure: '0',
    sellPressure: '0',
    imbalance: '0',
    regime: 'UNKNOWN',
    volRegime: 'UNKNOWN'
  };
  const recent = candles.slice(-20);
  let totalBuy = 0;
  let totalSell = 0;
  for (const c of recent) {
    const range = c.high - c.low || 1;
    if (c.close > c.open) {
      const b = c.volume * (1 - (c.high - c.close) / range);
      totalBuy += b;
      totalSell += c.volume - b;
    } else {
      const s = c.volume * (1 - (c.close - c.low) / range);
      totalSell += s;
      totalBuy += c.volume - s;
    }
  }
  const total = totalBuy + totalSell || 1;
  const buyPct = totalBuy / total * 100;
  const sellPct = totalSell / total * 100;
  const imbalance = (totalBuy - totalSell) / total * 100;
  let regime = 'NEUTRAL';
  if (imbalance > 20) regime = 'STRONG_BUYING';else
  if (imbalance > 10) regime = 'BUYING';else
  if (imbalance < -20) regime = 'STRONG_SELLING';else
  if (imbalance < -10) regime = 'SELLING';
  const a = atr(candles);
  const lastAtr = a[a.length - 1] || 0;
  const avgAtr =
  a.slice(-20).reduce((x, y) => x + y, 0) / Math.min(20, a.length);
  const volRegime =
  lastAtr > avgAtr * 1.3 ?
  'HIGH_VOL' :
  lastAtr < avgAtr * 0.7 ?
  'LOW_VOL' :
  'NORMAL_VOL';
  return {
    buyPressure: buyPct.toFixed(1),
    sellPressure: sellPct.toFixed(1),
    imbalance: imbalance.toFixed(1),
    regime,
    volRegime
  };
}

// ─── NEXT CANDLE PREDICTION ───
export interface Prediction {
  direction: Dir | 'UNKNOWN';
  confidence: number;
  predictedHigh: string;
  predictedLow: string;
  reasons: string[];
}

export function predictNextCandle(candles: BinanceCandle[]): Prediction {
  if (candles.length < 30)
  return {
    direction: 'UNKNOWN',
    confidence: 0,
    predictedHigh: '0',
    predictedLow: '0',
    reasons: ['Insufficient data']
  };
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const r = rsi(closes);
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const bb = bollinger(closes);
  const a = atr(candles);
  const last = candles.length - 1;
  const prev = last - 1;
  const lastClose = closes[last];
  const lastEma9 = e9[last];
  const lastEma21 = e21[last];
  const lastAtr = a[last] || candles[last].high - candles[last].low;
  const lastRSI = r[last];
  const prevRSI = r[prev];
  const volMomentum =
  volumes[last] / (volumes.slice(-10).reduce((x, y) => x + y, 0) / 10);
  const aboveEma9 = lastClose > lastEma9;
  const aboveEma21 = lastClose > lastEma21;
  const emaCross = e9[last] > e21[last] !== e9[prev] > e21[prev];
  const lastBody = Math.abs(candles[last].close - candles[last].open);
  const lastUpperWick =
  candles[last].high - Math.max(candles[last].open, candles[last].close);
  const lastLowerWick =
  Math.min(candles[last].open, candles[last].close) - candles[last].low;

  let bullishScore = 50;
  let bearishScore = 50;
  const reasons: string[] = [];

  if (lastRSI < 30) {
    bullishScore += 15;
    reasons.push('Oversold RSI');
  } else if (lastRSI > 70) {
    bearishScore += 15;
    reasons.push('Overbought RSI');
  }
  if (lastRSI > prevRSI && lastRSI < 50) {
    bullishScore += 5;
    reasons.push('RSI rising from low');
  } else if (lastRSI < prevRSI && lastRSI > 50) {
    bearishScore += 5;
    reasons.push('RSI falling from high');
  }
  if (aboveEma9 && aboveEma21) {
    bullishScore += 10;
    reasons.push('Price above EMAs');
  } else if (!aboveEma9 && !aboveEma21) {
    bearishScore += 10;
    reasons.push('Price below EMAs');
  }
  if (emaCross && e9[last] > e21[last]) {
    bullishScore += 8;
    reasons.push('Golden cross');
  } else if (emaCross && e9[last] < e21[last]) {
    bearishScore += 8;
    reasons.push('Death cross');
  }
  const bbUpper = bb.upper[last];
  const bbLower = bb.lower[last];
  const bbMid = bb.middle[last];
  if (bbLower !== null && lastClose < bbLower) {
    bullishScore += 12;
    reasons.push('Below Bollinger lower');
  } else if (bbUpper !== null && lastClose > bbUpper) {
    bearishScore += 12;
    reasons.push('Above Bollinger upper');
  }
  if (
  bbMid !== null &&
  bbLower !== null &&
  lastClose < bbMid &&
  lastClose > bbLower)
  {
    bullishScore += 5;
    reasons.push('Below mid Bollinger');
  } else if (
  bbMid !== null &&
  bbUpper !== null &&
  lastClose > bbMid &&
  lastClose < bbUpper)
  {
    bearishScore += 5;
    reasons.push('Above mid Bollinger');
  }
  if (volMomentum > 1.5 && candles[last].close > candles[last].open) {
    bullishScore += 8;
    reasons.push('High volume bullish');
  } else if (volMomentum > 1.5 && candles[last].close < candles[last].open) {
    bearishScore += 8;
    reasons.push('High volume bearish');
  }
  if (
  lastLowerWick > lastBody * 2 &&
  lastClose > (candles[last].high + candles[last].low) / 2)
  {
    bullishScore += 8;
    reasons.push('Long lower wick rejection');
  }
  if (
  lastUpperWick > lastBody * 2 &&
  lastClose < (candles[last].high + candles[last].low) / 2)
  {
    bearishScore += 8;
    reasons.push('Long upper wick rejection');
  }
  let bullCount = 0;
  let bearCount = 0;
  for (let j = last; j > Math.max(0, last - 5); j--) {
    if (candles[j].close > candles[j].open) bullCount++;else
    if (candles[j].close < candles[j].open) bearCount++;
  }
  if (bullCount >= 4) {
    bearishScore += 10;
    reasons.push('5+ bullish candles (exhaustion)');
  }
  if (bearCount >= 4) {
    bullishScore += 10;
    reasons.push('5+ bearish candles (exhaustion)');
  }
  const atrPercent = lastAtr / lastClose * 100;
  if (atrPercent > 3) {
    if (bullishScore > bearishScore) bullishScore += 5;else
    bearishScore += 5;
    reasons.push('High volatility');
  }

  let direction: Dir;
  let confidence: number;
  let primary: string[];
  if (bullishScore > bearishScore) {
    direction = 'BULLISH';
    confidence = Math.min(95, bullishScore);
    primary = reasons.slice(0, 3);
  } else if (bearishScore > bullishScore) {
    direction = 'BEARISH';
    confidence = Math.min(95, bearishScore);
    primary = reasons.slice(-3).reverse();
  } else {
    direction = 'NEUTRAL';
    confidence = 50;
    primary = ['Mixed signals'];
  }
  const dec = lastClose < 1 ? 5 : 2;
  const predictedHigh = (
  lastClose +
  lastAtr * (direction === 'BULLISH' ? 0.7 : 0.3)).
  toFixed(dec);
  const predictedLow = (
  lastClose -
  lastAtr * (direction === 'BEARISH' ? 0.7 : 0.3)).
  toFixed(dec);
  return {
    direction,
    confidence: Math.round(confidence),
    predictedHigh,
    predictedLow,
    reasons: primary
  };
}

// ─── 10-STRATEGY SIGNAL STACK ───
export interface StrategyResult {
  name: string;
  signal: Dir;
  reason: string;
}
export interface StackResult {
  strategies: StrategyResult[];
  finalSignal: Dir;
  confidence: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}

export function analyzeStrategyStack(candles: BinanceCandle[]): StackResult {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];
  const r = rsi(closes);
  const lastRSI = r[r.length - 1];
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const bb = bollinger(closes);
  const a = atr(candles);
  const lastAtr = a[a.length - 1] || 0;
  const strategies: StrategyResult[] = [];
  let bull = 0;
  let bear = 0;
  let neut = 0;

  // 1. MTF Alignment
  const score =
  (lastClose > e9[e9.length - 1] ? 1 : 0) + (
  lastClose > e21[e21.length - 1] ? 1 : 0) + (
  lastClose > e50[e50.length - 1] ? 1 : 0);
  if (score >= 2) {
    strategies.push({
      name: 'MTF Alignment',
      signal: 'BULLISH',
      reason: `${score}/3 EMAs bullish`
    });
    bull++;
  } else if (score <= 1) {
    strategies.push({
      name: 'MTF Alignment',
      signal: 'BEARISH',
      reason: `${score}/3 EMAs bearish`
    });
    bear++;
  } else {
    strategies.push({
      name: 'MTF Alignment',
      signal: 'NEUTRAL',
      reason: 'Mixed timeframes'
    });
    neut++;
  }

  // 2. RSI Momentum
  if (lastRSI < 30) {
    strategies.push({
      name: 'RSI Momentum',
      signal: 'BULLISH',
      reason: `Oversold: ${lastRSI.toFixed(1)}`
    });
    bull++;
  } else if (lastRSI > 70) {
    strategies.push({
      name: 'RSI Momentum',
      signal: 'BEARISH',
      reason: `Overbought: ${lastRSI.toFixed(1)}`
    });
    bear++;
  } else if (lastRSI > 50) {
    strategies.push({
      name: 'RSI Momentum',
      signal: 'BULLISH',
      reason: `RSI bullish: ${lastRSI.toFixed(1)}`
    });
    bull++;
  } else {
    strategies.push({
      name: 'RSI Momentum',
      signal: 'BEARISH',
      reason: `RSI bearish: ${lastRSI.toFixed(1)}`
    });
    bear++;
  }

  // 3. Bollinger Bands
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbMid = bb.middle[bb.middle.length - 1];
  if (bbLower !== null && lastClose < bbLower) {
    strategies.push({
      name: 'Bollinger Bands',
      signal: 'BULLISH',
      reason: 'Below lower band'
    });
    bull++;
  } else if (bbUpper !== null && lastClose > bbUpper) {
    strategies.push({
      name: 'Bollinger Bands',
      signal: 'BEARISH',
      reason: 'Above upper band'
    });
    bear++;
  } else if (bbMid !== null && lastClose < bbMid) {
    strategies.push({
      name: 'Bollinger Bands',
      signal: 'BULLISH',
      reason: 'Below midline'
    });
    bull++;
  } else {
    strategies.push({
      name: 'Bollinger Bands',
      signal: 'BEARISH',
      reason: 'Above midline'
    });
    bear++;
  }

  // 4. S/R Levels
  const recentHigh = Math.max(...candles.slice(-20).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-20).map((c) => c.low));
  const distHigh = (recentHigh - lastClose) / lastClose * 100;
  const distLow = (lastClose - recentLow) / lastClose * 100;
  if (distLow < 1) {
    strategies.push({
      name: 'S/R Levels',
      signal: 'BULLISH',
      reason: 'Near support'
    });
    bull++;
  } else if (distHigh < 1) {
    strategies.push({
      name: 'S/R Levels',
      signal: 'BEARISH',
      reason: 'Near resistance'
    });
    bear++;
  } else if (distLow < distHigh) {
    strategies.push({
      name: 'S/R Levels',
      signal: 'BULLISH',
      reason: 'Closer to support'
    });
    bull++;
  } else {
    strategies.push({
      name: 'S/R Levels',
      signal: 'BEARISH',
      reason: 'Closer to resistance'
    });
    bear++;
  }

  // 5. Volume Spike
  const volumes = candles.map((c) => c.volume);
  const avgVol = volumes.slice(-20).reduce((a2, b2) => a2 + b2, 0) / 20;
  const volRatio = volumes[volumes.length - 1] / (avgVol || 1);
  const lastBull =
  candles[candles.length - 1].close > candles[candles.length - 1].open;
  if (volRatio > 1.5 && lastBull) {
    strategies.push({
      name: 'Volume Spike',
      signal: 'BULLISH',
      reason: `${volRatio.toFixed(1)}x vol`
    });
    bull++;
  } else if (volRatio > 1.5 && !lastBull) {
    strategies.push({
      name: 'Volume Spike',
      signal: 'BEARISH',
      reason: `${volRatio.toFixed(1)}x vol`
    });
    bear++;
  } else {
    strategies.push({
      name: 'Volume Spike',
      signal: 'NEUTRAL',
      reason: `Normal: ${volRatio.toFixed(1)}x`
    });
    neut++;
  }

  // 6. EMA Crossover
  const e9p = e9[e9.length - 2];
  const e21p = e21[e21.length - 2];
  const e9c = e9[e9.length - 1];
  const e21c = e21[e21.length - 1];
  if (e9p <= e21p && e9c > e21c) {
    strategies.push({
      name: 'EMA Crossover',
      signal: 'BULLISH',
      reason: 'Golden cross 9/21'
    });
    bull++;
  } else if (e9p >= e21p && e9c < e21c) {
    strategies.push({
      name: 'EMA Crossover',
      signal: 'BEARISH',
      reason: 'Death cross 9/21'
    });
    bear++;
  } else if (e9c > e21c) {
    strategies.push({
      name: 'EMA Crossover',
      signal: 'BULLISH',
      reason: '9 EMA above 21'
    });
    bull++;
  } else {
    strategies.push({
      name: 'EMA Crossover',
      signal: 'BEARISH',
      reason: '9 EMA below 21'
    });
    bear++;
  }

  // 7. ATR Volatility
  const atrPct = lastAtr / lastClose * 100;
  strategies.push({
    name: 'ATR Volatility',
    signal: 'NEUTRAL',
    reason: `${atrPct.toFixed(2)}% range`
  });
  neut++;

  // 8. Trend Strength
  const trend = candles.slice(-20);
  const upDays = trend.filter((c) => c.close > c.open).length;
  const tr = upDays / 20;
  if (tr > 0.65) {
    strategies.push({
      name: 'Trend Strength',
      signal: 'BULLISH',
      reason: `${upDays}/20 bullish`
    });
    bull++;
  } else if (tr < 0.35) {
    strategies.push({
      name: 'Trend Strength',
      signal: 'BEARISH',
      reason: `${upDays}/20 bullish`
    });
    bear++;
  } else {
    strategies.push({
      name: 'Trend Strength',
      signal: 'NEUTRAL',
      reason: `${upDays}/20 bullish`
    });
    neut++;
  }

  // 9. Price Action
  const lc = candles[candles.length - 1];
  const pc = candles[candles.length - 2];
  if (lc.close > lc.open && pc.close < pc.open) {
    strategies.push({
      name: 'Price Action',
      signal: 'BULLISH',
      reason: lc.close > pc.high ? 'Bullish engulfing' : 'Green after red'
    });
    bull++;
  } else if (lc.close < lc.open && pc.close > pc.open) {
    strategies.push({
      name: 'Price Action',
      signal: 'BEARISH',
      reason: lc.close < pc.low ? 'Bearish engulfing' : 'Red after green'
    });
    bear++;
  } else {
    strategies.push({
      name: 'Price Action',
      signal: 'NEUTRAL',
      reason: 'Indecision candle'
    });
    neut++;
  }

  // 10. Order Flow
  const of = analyzeOrderFlow(candles);
  if (parseFloat(of.buyPressure) > 60) {
    strategies.push({
      name: 'Order Flow',
      signal: 'BULLISH',
      reason: `Buy ${of.buyPressure}%`
    });
    bull++;
  } else if (parseFloat(of.sellPressure) > 60) {
    strategies.push({
      name: 'Order Flow',
      signal: 'BEARISH',
      reason: `Sell ${of.sellPressure}%`
    });
    bear++;
  } else {
    strategies.push({
      name: 'Order Flow',
      signal: 'NEUTRAL',
      reason: `Balanced ${of.buyPressure}/${of.sellPressure}`
    });
    neut++;
  }

  const total = bull + bear + neut;
  const finalSignal: Dir =
  bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
  const confidence = Math.round(Math.max(bull, bear) / total * 100);
  return {
    strategies,
    finalSignal,
    confidence,
    bullishCount: bull,
    bearishCount: bear,
    neutralCount: neut
  };
}

// ─── GENERATE SIGNAL ───
export interface EngineSignal {
  direction: Dir;
  entry: string;
  sl: string;
  tp: string;
  rr: string;
  confidence: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  strategyStack: StackResult;
  prediction: Prediction;
  amd: AMDResult;
  orderFlow: OrderFlow;
  traps: Trap[];
  hiddenPatterns: HiddenPattern[];
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  sweeps: Sweep[];
  /** Score breakdown (ULTIMATE decision matrix). */
  technicalScore: number;
  hiddenScore: number;
  timeBias: number;
  totalScore: number;
  /** Top human-readable factors driving the signal. */
  reasons: string[];
  /** Active ICT session name + quality (when supplied). */
  sessionName?: string;
  sessionQuality?: string;
}

/** Optional institutional/time-theory inputs from the hidden-intel layer. */
export interface SignalExtras {
  hiddenScore?: number;
  hiddenReasons?: string[];
  timeBias?: number;
  sessionName?: string;
  sessionQuality?: string;
}

export function generateSignal(
candles: BinanceCandle[],
extras: SignalExtras = {})
: EngineSignal | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];
  const a = atr(candles);
  const lastAtr =
  a[a.length - 1] ||
  candles[candles.length - 1].high - candles[candles.length - 1].low;
  const stack = analyzeStrategyStack(candles);
  const prediction = predictNextCandle(candles);
  const amd = detectAMD(candles);
  const of = analyzeOrderFlow(candles);
  const swings = findSwingPoints(candles);
  const traps = detectTraps(candles, swings);
  const hidden = detectHiddenPatterns(candles);
  const fvgs = detectFVG(candles);
  const orderBlocks = detectOrderBlocks(candles, swings);
  const sweeps = detectLiquiditySweeps(candles, swings);

  const dec = lastClose < 1 ? 5 : 2;

  // ─── ULTIMATE SCORE MATRIX ───
  // Technical score derived from the strategy stack + key detections.
  const reasons: string[] = [];
  let technicalScore = (stack.bullishCount - stack.bearishCount) * 5;
  reasons.push(
    `${stack.bullishCount}/${stack.strategies.length} strategies bullish`
  );
  if (amd.phase === 'ACCUMULATION' || amd.phase === 'MARKUP') {
    technicalScore += 15;
    reasons.push(`AMD: ${amd.phase}`);
  } else if (amd.phase === 'DISTRIBUTION' || amd.phase === 'MARKDOWN') {
    technicalScore -= 15;
    reasons.push(`AMD: ${amd.phase}`);
  }
  if (traps.length) {
    const lt = traps[traps.length - 1];
    if (lt.type === 'BEAR TRAP') {
      technicalScore += 20;
      reasons.push('Bear trap (bullish reversal)');
    } else {
      technicalScore -= 20;
      reasons.push('Bull trap (bearish reversal)');
    }
  }
  if (sweeps.length) {
    const ls = sweeps[sweeps.length - 1];
    technicalScore += ls.type === 'bullish' ? 15 : -15;
    reasons.push(`Liquidity sweep: ${ls.type}`);
  }
  if (hidden.length) {
    const lh = hidden[hidden.length - 1];
    technicalScore += lh.type.includes('BULLISH') ? 10 : -10;
    reasons.push(`Hidden: ${lh.type.replace(/_/g, ' ').toLowerCase()}`);
  }

  const hiddenScore = extras.hiddenScore ?? 0;
  const timeBias = extras.timeBias ?? 0;
  const totalScore = technicalScore + hiddenScore + timeBias;
  if (extras.hiddenReasons?.length) reasons.push(...extras.hiddenReasons);

  // Decision matrix overrides the raw stack direction.
  let direction: Dir =
  totalScore > 15 ? 'BULLISH' : totalScore < -15 ? 'BEARISH' : 'NEUTRAL';
  const entry = lastClose;
  let sl: number;
  let tp: number;
  let rr = '0';
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';

  const riskByAtr = (price: number) => {
    const pct = lastAtr / price * 100;
    return pct > 2.5 ? 'HIGH' : pct > 1.2 ? 'MODERATE' : 'LOW';
  };

  // ─── SMART-MONEY "HIDDEN CANDLE" STOP FINDER ───
  // Instead of a wide 10-bar extreme, anchor the stop just beyond the candle
  // institutions defended — the order block, the liquidity-sweep wick, or the
  // protective swing. This is the "hidden/secret candle": the footprint big
  // players leave when they fill orders. It yields a TIGHT stop and high RR.
  const buffer = lastAtr * 0.18; // wick-protection padding
  // Floor & ceiling keep the stop sane: not microscopic, not blown out.
  const minRisk = Math.max(lastAtr * 0.5, entry * 0.0006);
  const maxRisk = lastAtr * 2.6;
  const recent = candles.slice(-6);

  if (direction === 'BULLISH') {
    // Protective levels BELOW entry — pick the highest (tightest) one.
    const lows: number[] = [];
    const lastBullOB = [...orderBlocks].
    reverse().
    find((o) => o.type === 'bullish' && o.bottom < entry);
    if (lastBullOB) {
      lows.push(lastBullOB.bottom);
      reasons.push('SL hidden below bullish order block (smart-money demand)');
    }
    const lastBullSweep = [...sweeps].
    reverse().
    find((s) => s.type === 'bullish' && s.price < entry);
    if (lastBullSweep) {
      lows.push(lastBullSweep.price);
      reasons.push('Liquidity sweep low defended — stop tucked beneath it');
    }
    const swingLow = [...swings].
    reverse().
    find((s) => s.type === 'low' && s.price < entry);
    if (swingLow) lows.push(swingLow.price);
    lows.push(Math.min(...recent.map((c) => c.low)));
    const valid = lows.filter((v) => v < entry);
    const anchor = valid.length ? Math.max(...valid) : entry - minRisk;
    sl = anchor - buffer;
    let risk = entry - sl;
    if (risk < minRisk) sl = entry - minRisk;
    if (risk > maxRisk) sl = entry - maxRisk;
    risk = entry - sl;
    tp = entry + risk * 2;
    // Extend toward the next real resistance if it sits beyond 2R.
    const nextRes = Math.max(...candles.slice(-30).map((c) => c.high));
    if (nextRes > tp && nextRes < entry + risk * 4) tp = nextRes;
    rr = (Math.abs(tp - entry) / risk).toFixed(2);
    riskLevel = riskByAtr(entry);
  } else if (direction === 'BEARISH') {
    // Protective levels ABOVE entry — pick the lowest (tightest) one.
    const highs: number[] = [];
    const lastBearOB = [...orderBlocks].
    reverse().
    find((o) => o.type === 'bearish' && o.top > entry);
    if (lastBearOB) {
      highs.push(lastBearOB.top);
      reasons.push('SL hidden above bearish order block (smart-money supply)');
    }
    const lastBearSweep = [...sweeps].
    reverse().
    find((s) => s.type === 'bearish' && s.price > entry);
    if (lastBearSweep) {
      highs.push(lastBearSweep.price);
      reasons.push('Liquidity sweep high defended — stop tucked above it');
    }
    const swingHigh = [...swings].
    reverse().
    find((s) => s.type === 'high' && s.price > entry);
    if (swingHigh) highs.push(swingHigh.price);
    highs.push(Math.max(...recent.map((c) => c.high)));
    const valid = highs.filter((v) => v > entry);
    const anchor = valid.length ? Math.min(...valid) : entry + minRisk;
    sl = anchor + buffer;
    let risk = sl - entry;
    if (risk < minRisk) sl = entry + minRisk;
    if (risk > maxRisk) sl = entry + maxRisk;
    risk = sl - entry;
    tp = entry - risk * 2;
    const nextSup = Math.min(...candles.slice(-30).map((c) => c.low));
    if (nextSup < tp && nextSup > entry - risk * 4) tp = nextSup;
    rr = (Math.abs(entry - tp) / risk).toFixed(2);
    riskLevel = riskByAtr(entry);
  } else {
    direction = 'NEUTRAL';
    sl = lastClose - lastAtr;
    tp = lastClose + lastAtr;
    rr = '1.00';
  }

  // ─── BIG-PLAYER FOOTPRINT ───
  // Show what institutions are doing via the order-flow imbalance read.
  if (of.regime && of.regime !== 'NEUTRAL') {
    reasons.unshift(
      `Big-player footprint: ${of.regime.replace(/_/g, ' ').toLowerCase()} (buy ${of.buyPressure}% / sell ${of.sellPressure}%)`
    );
  }

  // Confidence: magnitude of the total conviction + session bonus.
  const confidence = Math.min(
    99,
    Math.abs(totalScore) + 20 + (extras.sessionQuality === 'ULTRA' ? 10 : 0)
  );

  return {
    direction,
    entry: entry.toFixed(dec),
    sl: sl.toFixed(dec),
    tp: tp.toFixed(dec),
    rr,
    confidence,
    riskLevel,
    strategyStack: stack,
    prediction,
    amd,
    orderFlow: of,
    traps,
    hiddenPatterns: hidden,
    fvgs,
    orderBlocks,
    sweeps,
    technicalScore,
    hiddenScore,
    timeBias,
    totalScore,
    reasons: reasons.slice(0, 6),
    sessionName: extras.sessionName,
    sessionQuality: extras.sessionQuality
  };
}

export const CRYPTO_SYMBOLS = [
'BTCUSDT',
'ETHUSDT',
'SOLUSDT',
'BNBUSDT',
'XRPUSDT',
'DOGEUSDT',
'LINKUSDT',
'ADAUSDT',
'AVAXUSDT',
'DOTUSDT',
'MATICUSDT',
'ATOMUSDT',
'UNIUSDT',
'LTCUSDT',
'ARBUSDT',
'OPUSDT',
'INJUSDT',
'TIAUSDT',
'SEIUSDT',
'SUIUSDT',
'APTUSDT',
'FILUSDT'];

export const FOREX_SYMBOLS = [
'EURUSD',
'GBPUSD',
'USDJPY',
'AUDUSD',
'USDCAD',
'NZDUSD',
'USDCHF'];

export const METAL_SYMBOLS = ['XAUUSD', 'XAGUSD'];
export const STOCK_SYMBOLS = [
'AAPL',
'TSLA',
'NVDA',
'MSFT',
'AMZN',
'GOOGL',
'META',
'SPY',
'QQQ'];


export function isCrypto(symbol: string): boolean {
  return CRYPTO_SYMBOLS.includes(symbol);
}