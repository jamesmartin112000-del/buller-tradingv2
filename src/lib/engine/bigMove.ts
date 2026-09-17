// Big Move engine — long-holding position trading (24h to 30 days)
// Targets 1000-3000+ pips on 1h/4h/Daily timeframes.
//
// 7-FILTER SYSTEM (different from scalping):
//   1. HTF Trend (Daily EMA 50/200) — anchors to the dominant trend
//   2. Institutional Zone (Premium/Discount based on Daily mid)
//   3. Major Liquidity Sweep — significant stop hunt detected
//   4. AMD Phase Detection (Accumulation/Manipulation/Distribution)
//   5. Multi-TF Divergence (4h + Daily RSI alignment)
//   6. Order Flow Extreme (≥70% one side = institutional accumulation)
//   7. Major Pattern / Candlestick Confirmation
//
// Final: 6/7 filters + 85% confidence required. TP1/TP2/TP3 pyramid exits.

import type { Analysis, Candle, Price, Timeframe } from './types';
import type {
  BigMoveStrategyId,
  BigMoveStrategyDef } from
'../data/bigMoveStrategies';
import { BIG_MOVE_STRATEGIES } from '../data/bigMoveStrategies';
import { calcATR, calcEMA, calcRSI } from './indicators';
import { detectLiquidityGrab } from './smc';
import { detectCandlestickPatterns } from './patterns';

export type BigMoveFilterId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface BigMoveFilterResult {
  id: BigMoveFilterId;
  name: string;
  passed: boolean;
  reason: string;
  detail: string;
}

export type AMDPhase =
'ACCUMULATION' |
'MANIPULATION' |
'DISTRIBUTION' |
'MARKDOWN' |
'MARKUP' |
'NEUTRAL';

export interface BigMoveSignal {
  id: string;
  pair: string;
  ts: number;
  timeframe: '1h' | '4h' | '1d';
  hasSignal: boolean;
  dir: 'BUY' | 'SELL' | 'NO_TRADE';
  confidence: number;
  // Pyramid TP system
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  rr: string;
  pipTarget: string;
  holdTime: string;
  price: number;
  filters: BigMoveFilterResult[];
  filtersPassed: number;
  filtersTotal: 7;
  rejectionReason?: string;
  amdPhase: AMDPhase;
  zone: 'PREMIUM' | 'DISCOUNT' | 'FAIR_VALUE';
  active: Array<{
    id: BigMoveStrategyId;
    name: string;
    score: number;
    dir: 'BUY' | 'SELL';
  }>;
  buyPct: number;
  sellPct: number;
  patterns: Array<{
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    status: string;
  }>;
  liquidityLevel: number; // 1-4 from the pyramid
  log: Array<{time: string;msg: string;tone?: 'ok' | 'fail' | 'warn';}>;
  strategyFilter: 'AUTO' | BigMoveStrategyId;
}

export interface BigMoveEngineInput {
  pair: string;
  price: Price;
  candles: Record<Timeframe, Candle[]>;
  analysis: Analysis;
  timeframe: '1h' | '4h' | '1d';
  strategyFilter: 'AUTO' | BigMoveStrategyId;
}

export function genBigMoveSignal(input: BigMoveEngineInput): BigMoveSignal {
  const { pair, price, candles, analysis: a, timeframe, strategyFilter } = input;
  const cp =
  price.mid ||
  candles['1d']?.slice(-1)[0]?.c ||
  candles['1h']?.slice(-1)[0]?.c ||
  0;
  const dailyCandles = candles['1d'] || [];
  const h4Candles = candles['4h'] || [];
  const h1Candles = candles['1h'] || [];
  const refCandles =
  timeframe === '1d' ?
  dailyCandles :
  timeframe === '4h' ?
  h4Candles :
  h1Candles;

  const atr = calcATR(candles) || cp * 0.005;
  // Big move ATR is bigger — use daily-scale
  const dailyAtr = calculateDailyATR(dailyCandles) || atr * 5;

  // === Detect AMD phase ===
  const amdPhase = detectAMDPhase(dailyCandles, refCandles);

  // === Detect zone (Premium/Discount) ===
  const zone = detectZone(dailyCandles, cp);

  // === Score strategies ===
  const scored = [
  scoreAMDLiquidityRun(candles, a, amdPhase),
  scoreICT2022(candles, a),
  scoreWeeklyBreakoutRetest(candles, a),
  scoreCentralBankPlay(a),
  scoreOBStackFVG(candles, a)];


  let buyScore = 0;
  let sellScore = 0;
  const active: BigMoveSignal['active'] = [];
  scored.forEach((s) => {
    if (s.dir === 'NEUTRAL' || s.score === 0) return;
    if (strategyFilter !== 'AUTO' && s.def.id !== strategyFilter) return;
    if (s.dir === 'BUY') buyScore += s.score;
    if (s.dir === 'SELL') sellScore += s.score;
    active.push({ id: s.def.id, name: s.def.name, score: s.score, dir: s.dir });
  });

  let rawDir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (buyScore >= 30 && buyScore >= sellScore + 10) rawDir = 'BUY';else
  if (sellScore >= 30 && sellScore >= buyScore + 10) rawDir = 'SELL';

  // === Run 7 filters ===
  const filters = runBigMoveFilters(rawDir, candles, a, amdPhase, zone, cp);
  const filtersPassed = filters.filter((f) => f.passed).length;

  let confidence = Math.min(95, Math.round(filtersPassed * 14.3));
  const stratStrength = Math.max(buyScore, sellScore);
  if (stratStrength > 50) confidence = Math.min(95, confidence + 3);
  if (stratStrength > 70) confidence = Math.min(95, confidence + 2);

  let dir: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
  let hasSignal = false;
  let rejectionReason: string | undefined;

  if (rawDir === 'NEUTRAL') {
    rejectionReason = 'No institutional confluence — wait for setup';
  } else if (filtersPassed < 6) {
    rejectionReason = `Only ${filtersPassed}/7 filters passed (min 6 for big move)`;
  } else if (confidence < 85) {
    rejectionReason = `Confidence ${confidence}% below 85% big-move threshold`;
  } else {
    dir = rawDir as 'BUY' | 'SELL';
    hasSignal = true;
  }

  // === Entry / SL / TP1 / TP2 / TP3 (pyramid) ===
  let entry: number | null = null;
  let sl: number | null = null;
  let tp1: number | null = null;
  let tp2: number | null = null;
  let tp3: number | null = null;
  let rr = '—';
  let liquidityLevel = 1;

  if (hasSignal && dir !== 'NO_TRADE') {
    entry = +cp.toFixed(8);
    // Wider SL for big moves
    const slDist = dailyAtr * 1.5;
    sl =
    dir === 'BUY' ?
    +(entry - slDist).toFixed(8) :
    +(entry + slDist).toFixed(8);
    // Pyramid TPs at 3x, 6x, 12x of slDist (≈ 1:3, 1:6, 1:12)
    const r = Math.abs(entry - sl);
    if (dir === 'BUY') {
      tp1 = +(entry + r * 3).toFixed(8);
      tp2 = +(entry + r * 6).toFixed(8);
      tp3 = +(entry + r * 12).toFixed(8);
    } else {
      tp1 = +(entry - r * 3).toFixed(8);
      tp2 = +(entry - r * 6).toFixed(8);
      tp3 = +(entry - r * 12).toFixed(8);
    }
    rr = `1:3 / 1:6 / 1:12`;
    // Choose liquidity level based on timeframe
    liquidityLevel = timeframe === '1d' ? 4 : timeframe === '4h' ? 3 : 2;
  }

  const pipTarget = hasSignal ?
  timeframe === '1d' ?
  '2000-3000+ pips' :
  timeframe === '4h' ?
  '1000-2000 pips' :
  '500-1000 pips' :
  '—';
  const holdTime = hasSignal ?
  timeframe === '1d' ?
  '7-30 days' :
  timeframe === '4h' ?
  '3-14 days' :
  '24h-3 days' :
  '—';

  // Order flow snapshot
  const buyPct = a.of?.buyPct ?? 50;
  const sellPct = a.of?.sellPct ?? 50;

  // Patterns — use daily candles when available
  const patternSource = dailyCandles.length >= 20 ? dailyCandles : refCandles;
  const cps = detectCandlestickPatterns(patternSource).slice(0, 4);
  const patterns: BigMoveSignal['patterns'] = cps.map((p) => {
    let status = 'detected';
    if (hasSignal) {
      if (dir === 'BUY' && p.type === 'bullish') status = 'confirmed';else
      if (dir === 'SELL' && p.type === 'bearish') status = 'confirmed';
    }
    if (p.type === 'neutral') status = 'indecision';
    return { name: p.name, type: p.type, status };
  });

  // Log
  const tStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const log: BigMoveSignal['log'] = [];
  log.push({
    time: tStr,
    msg: `INIT :: Big Move analysis · ${pair} ${timeframe.toUpperCase()} · Target 1000-3000+ pips`
  });
  log.push({
    time: tStr,
    msg: `ZONE :: ${zone} · AMD Phase: ${amdPhase}`
  });
  log.push({
    time: tStr,
    msg: `STRAT :: Raw direction ${rawDir} (Buy ${buyScore} · Sell ${sellScore})`
  });
  filters.forEach((f) => {
    log.push({
      time: tStr,
      msg: `FILTER ${f.id} [${f.name}] :: ${f.reason}`,
      tone: f.passed ? 'ok' : 'fail'
    });
  });
  log.push({
    time: tStr,
    msg: `FILTERS :: ${filtersPassed}/7 passed · ${confidence}% confidence`,
    tone: filtersPassed >= 6 ? 'ok' : 'warn'
  });

  if (hasSignal) {
    log.push({
      time: tStr,
      msg: `DECISION :: ${dir} big move signal generated`,
      tone: 'ok'
    });
    log.push({
      time: tStr,
      msg: `PYRAMID :: Entry ${entry?.toFixed(5)} · SL ${sl?.toFixed(5)} · TP1 ${tp1?.toFixed(5)} · TP2 ${tp2?.toFixed(5)} · TP3 ${tp3?.toFixed(5)}`
    });
    log.push({
      time: tStr,
      msg: `TARGET :: ${pipTarget} · Hold ${holdTime} · Liquidity Level ${liquidityLevel}`
    });
  } else {
    log.push({
      time: tStr,
      msg: `DECISION :: ✗ NO BIG MOVE — ${rejectionReason}`,
      tone: 'fail'
    });
    log.push({
      time: tStr,
      msg: 'ADVICE :: Big moves take patience. Wait 1-7 days for clean setup.',
      tone: 'warn'
    });
  }

  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    pair,
    ts: Date.now(),
    timeframe,
    hasSignal,
    dir,
    confidence,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    rr,
    pipTarget,
    holdTime,
    price: cp,
    filters,
    filtersPassed,
    filtersTotal: 7,
    rejectionReason,
    amdPhase,
    zone,
    active,
    buyPct,
    sellPct,
    patterns,
    liquidityLevel,
    log,
    strategyFilter
  };
}

// =============================================================================
// AMD PHASE DETECTION
// =============================================================================

function detectAMDPhase(daily: Candle[], ref: Candle[]): AMDPhase {
  if (daily.length < 14) {
    // Fallback to ref-tf detection
    if (ref.length < 20) return 'NEUTRAL';
    return detectAMDFromCandles(ref);
  }
  return detectAMDFromCandles(daily);
}

function detectAMDFromCandles(candles: Candle[]): AMDPhase {
  const last14 = candles.slice(-14);
  const closes = last14.map((c) => c.c);
  const highs = last14.map((c) => c.h);
  const lows = last14.map((c) => c.l);
  const range = Math.max(...highs) - Math.min(...lows);
  const avgClose = closes.reduce((s, c) => s + c, 0) / closes.length;
  const stdDev = Math.sqrt(
    closes.reduce((s, c) => s + Math.pow(c - avgClose, 2), 0) / closes.length
  );
  const isRanging = stdDev / avgClose < 0.015; // <1.5% volatility = ranging

  if (isRanging) {
    // Check for HH/HL (accumulation) or LH/LL (distribution)
    const firstHalf = last14.slice(0, 7);
    const secondHalf = last14.slice(7);
    const firstLow = Math.min(...firstHalf.map((c) => c.l));
    const secondLow = Math.min(...secondHalf.map((c) => c.l));
    const firstHigh = Math.max(...firstHalf.map((c) => c.h));
    const secondHigh = Math.max(...secondHalf.map((c) => c.h));

    if (secondLow > firstLow) return 'ACCUMULATION';
    if (secondHigh < firstHigh) return 'DISTRIBUTION';
    return 'NEUTRAL';
  }

  // Trending — check direction
  const last5 = last14.slice(-5);
  const trendUp = last5[last5.length - 1].c > last5[0].c * 1.005;
  const trendDown = last5[last5.length - 1].c < last5[0].c * 0.995;

  // Check for manipulation: long wick at recent extreme
  const last = last14[last14.length - 1];
  const body = Math.abs(last.c - last.o);
  const upperWick = last.h - Math.max(last.o, last.c);
  const lowerWick = Math.min(last.o, last.c) - last.l;
  const recentHigh = Math.max(...last14.slice(0, -1).map((c) => c.h));
  const recentLow = Math.min(...last14.slice(0, -1).map((c) => c.l));
  if (last.l < recentLow && lowerWick > body * 2 && last.c > last.o) {
    return 'MANIPULATION';
  }
  if (last.h > recentHigh && upperWick > body * 2 && last.c < last.o) {
    return 'MANIPULATION';
  }

  if (trendUp) return 'MARKUP';
  if (trendDown) return 'MARKDOWN';
  return 'NEUTRAL';
}

// =============================================================================
// ZONE DETECTION (Premium / Discount / Fair Value)
// =============================================================================

function detectZone(
daily: Candle[],
cp: number)
: 'PREMIUM' | 'DISCOUNT' | 'FAIR_VALUE' {
  if (daily.length < 20) return 'FAIR_VALUE';
  const last30 = daily.slice(-30);
  const high = Math.max(...last30.map((c) => c.h));
  const low = Math.min(...last30.map((c) => c.l));
  const range = high - low;
  if (range === 0) return 'FAIR_VALUE';
  const position = (cp - low) / range;
  if (position > 0.65) return 'PREMIUM';
  if (position < 0.35) return 'DISCOUNT';
  return 'FAIR_VALUE';
}

function calculateDailyATR(daily: Candle[]): number {
  if (daily.length < 7) return 0;
  const trs: number[] = [];
  for (let i = 1; i < daily.length; i++) {
    trs.push(
      Math.max(
        daily[i].h - daily[i].l,
        Math.abs(daily[i].h - daily[i - 1].c),
        Math.abs(daily[i].l - daily[i - 1].c)
      )
    );
  }
  return trs.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, trs.length);
}

// =============================================================================
// 7-FILTER SYSTEM
// =============================================================================

function runBigMoveFilters(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>,
a: Analysis,
amdPhase: AMDPhase,
zone: 'PREMIUM' | 'DISCOUNT' | 'FAIR_VALUE',
cp: number)
: BigMoveFilterResult[] {
  return [
  filterDailyTrend(dir, candles),
  filterInstitutionalZone(dir, zone),
  filterMajorLiquiditySweep(dir, candles),
  filterAMDPhase(dir, amdPhase),
  filterMultiTFDivergence(dir, candles),
  filterOrderFlowExtreme(dir, a),
  filterMajorPattern(dir, candles)];

}

// F1 — Daily EMA 50/200 trend
function filterDailyTrend(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>)
: BigMoveFilterResult {
  const daily = candles['1d'] || [];
  if (daily.length < 50) {
    // Fallback to 4h
    const h4 = candles['4h'] || [];
    if (h4.length < 50) {
      return {
        id: 1,
        name: 'Daily Trend',
        passed: dir !== 'NEUTRAL',
        reason: 'Insufficient HTF candles — using strategy bias',
        detail: 'Need 50+ daily candles for full check'
      };
    }
  }
  const source = daily.length >= 50 ? daily : candles['4h'];
  const closes = source.map((c) => c.c);
  const ema50 = calcEMA(closes, 50);
  const ema200 = closes.length >= 200 ? calcEMA(closes, 200) : ema50 * 0.98;
  const last = closes[closes.length - 1];
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (last > ema50 && ema50 > ema200) trend = 'BULLISH';else
  if (last < ema50 && ema50 < ema200) trend = 'BEARISH';
  const aligned =
  dir === 'BUY' && trend === 'BULLISH' ||
  dir === 'SELL' && trend === 'BEARISH';
  return {
    id: 1,
    name: 'Daily Trend',
    passed: aligned,
    reason: aligned ?
    `${trend.toLowerCase()} daily trend confirmed` :
    `Daily trend is ${trend.toLowerCase()} — big move likely fails against it`,
    detail: `EMA50 ${ema50.toFixed(5)} · EMA200 ${ema200.toFixed(5)}`
  };
}

// F2 — Institutional zone (Premium for SELL, Discount for BUY)
function filterInstitutionalZone(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
zone: 'PREMIUM' | 'DISCOUNT' | 'FAIR_VALUE')
: BigMoveFilterResult {
  if (dir === 'BUY') {
    const passed = zone === 'DISCOUNT';
    return {
      id: 2,
      name: 'Institutional Zone',
      passed,
      reason: passed ?
      'Price in DISCOUNT zone — institutional buy zone' :
      `Price in ${zone} — not optimal for big BUY`,
      detail: `Zone: ${zone}`
    };
  }
  if (dir === 'SELL') {
    const passed = zone === 'PREMIUM';
    return {
      id: 2,
      name: 'Institutional Zone',
      passed,
      reason: passed ?
      'Price in PREMIUM zone — institutional sell zone' :
      `Price in ${zone} — not optimal for big SELL`,
      detail: `Zone: ${zone}`
    };
  }
  return {
    id: 2,
    name: 'Institutional Zone',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// F3 — Major liquidity sweep
function filterMajorLiquiditySweep(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>)
: BigMoveFilterResult {
  const lg = detectLiquidityGrab(candles);
  if (dir === 'BUY' && lg.signal === 'BUY') {
    return {
      id: 3,
      name: 'Liquidity Sweep',
      passed: true,
      reason:
      'Major bear trap — liquidity swept below, institutional reversal up',
      detail: 'Stop hunt confirmed'
    };
  }
  if (dir === 'SELL' && lg.signal === 'SELL') {
    return {
      id: 3,
      name: 'Liquidity Sweep',
      passed: true,
      reason:
      'Major bull trap — liquidity swept above, institutional reversal down',
      detail: 'Stop hunt confirmed'
    };
  }
  // Check daily candles for major wick
  const daily = candles['1d'] || [];
  if (daily.length >= 10) {
    const last10 = daily.slice(-10);
    const last = last10[last10.length - 1];
    const recentHigh = Math.max(...last10.slice(0, -1).map((c) => c.h));
    const recentLow = Math.min(...last10.slice(0, -1).map((c) => c.l));
    const body = Math.abs(last.c - last.o);
    const lowerWick = Math.min(last.o, last.c) - last.l;
    const upperWick = last.h - Math.max(last.o, last.c);
    if (
    dir === 'BUY' &&
    last.l < recentLow &&
    lowerWick > body * 2 &&
    last.c > last.o)
    {
      return {
        id: 3,
        name: 'Liquidity Sweep',
        passed: true,
        reason: 'Daily wick swept low + bullish close — major sweep',
        detail: 'Long lower wick on daily'
      };
    }
    if (
    dir === 'SELL' &&
    last.h > recentHigh &&
    upperWick > body * 2 &&
    last.c < last.o)
    {
      return {
        id: 3,
        name: 'Liquidity Sweep',
        passed: true,
        reason: 'Daily wick swept high + bearish close — major sweep',
        detail: 'Long upper wick on daily'
      };
    }
  }
  return {
    id: 3,
    name: 'Liquidity Sweep',
    passed: false,
    reason: 'No major liquidity sweep detected — big move likely premature',
    detail: 'Clean structure'
  };
}

// F4 — AMD phase
function filterAMDPhase(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
phase: AMDPhase)
: BigMoveFilterResult {
  if (dir === 'BUY') {
    const goodPhases: AMDPhase[] = ['ACCUMULATION', 'MANIPULATION', 'MARKUP'];
    const passed = goodPhases.includes(phase);
    return {
      id: 4,
      name: 'AMD Phase',
      passed,
      reason: passed ?
      `${phase} phase — favors big BUY move` :
      `${phase} phase — not optimal for big BUY`,
      detail: `Phase: ${phase}`
    };
  }
  if (dir === 'SELL') {
    const goodPhases: AMDPhase[] = ['DISTRIBUTION', 'MANIPULATION', 'MARKDOWN'];
    const passed = goodPhases.includes(phase);
    return {
      id: 4,
      name: 'AMD Phase',
      passed,
      reason: passed ?
      `${phase} phase — favors big SELL move` :
      `${phase} phase — not optimal for big SELL`,
      detail: `Phase: ${phase}`
    };
  }
  return {
    id: 4,
    name: 'AMD Phase',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// F5 — Multi-TF Divergence (4h + Daily RSI)
function filterMultiTFDivergence(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>)
: BigMoveFilterResult {
  const daily = candles['1d'] || [];
  const h4 = candles['4h'] || [];
  if (daily.length < 15 || h4.length < 15) {
    return {
      id: 5,
      name: 'Multi-TF Divergence',
      passed: dir !== 'NEUTRAL',
      reason: 'Insufficient HTF data — passed softly',
      detail: 'Need 15+ daily/4h candles'
    };
  }
  const dailyDiv = detectDivergence(daily);
  const h4Div = detectDivergence(h4);

  if (dir === 'BUY') {
    if (dailyDiv === 'bullish' || h4Div === 'bullish') {
      return {
        id: 5,
        name: 'Multi-TF Divergence',
        passed: true,
        reason: `Bullish RSI divergence on ${dailyDiv === 'bullish' ? 'Daily' : '4h'} — strong big BUY`,
        detail: `Daily: ${dailyDiv} · 4h: ${h4Div}`
      };
    }
    return {
      id: 5,
      name: 'Multi-TF Divergence',
      passed: dailyDiv !== 'bearish' && h4Div !== 'bearish',
      reason:
      dailyDiv === 'bearish' || h4Div === 'bearish' ?
      'Bearish divergence conflicts with BUY' :
      'No conflicting divergence',
      detail: `Daily: ${dailyDiv} · 4h: ${h4Div}`
    };
  }
  if (dir === 'SELL') {
    if (dailyDiv === 'bearish' || h4Div === 'bearish') {
      return {
        id: 5,
        name: 'Multi-TF Divergence',
        passed: true,
        reason: `Bearish RSI divergence on ${dailyDiv === 'bearish' ? 'Daily' : '4h'} — strong big SELL`,
        detail: `Daily: ${dailyDiv} · 4h: ${h4Div}`
      };
    }
    return {
      id: 5,
      name: 'Multi-TF Divergence',
      passed: dailyDiv !== 'bullish' && h4Div !== 'bullish',
      reason:
      dailyDiv === 'bullish' || h4Div === 'bullish' ?
      'Bullish divergence conflicts with SELL' :
      'No conflicting divergence',
      detail: `Daily: ${dailyDiv} · 4h: ${h4Div}`
    };
  }
  return {
    id: 5,
    name: 'Multi-TF Divergence',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

function detectDivergence(candles: Candle[]): 'bullish' | 'bearish' | 'none' {
  if (candles.length < 15) return 'none';
  const closes = candles.map((c) => c.c);
  const last10 = candles.slice(-10);
  const mid = Math.floor(last10.length / 2);
  const firstHalf = last10.slice(0, mid);
  const secondHalf = last10.slice(mid);
  const priceLow1 = Math.min(...firstHalf.map((c) => c.l));
  const priceLow2 = Math.min(...secondHalf.map((c) => c.l));
  const priceHigh1 = Math.max(...firstHalf.map((c) => c.h));
  const priceHigh2 = Math.max(...secondHalf.map((c) => c.h));

  const rsiSeries: number[] = [];
  for (let i = closes.length - 10; i <= closes.length; i++) {
    rsiSeries.push(calcRSI(closes.slice(0, i + 1), 14));
  }
  const rsiFirst = rsiSeries.slice(0, mid);
  const rsiSecond = rsiSeries.slice(mid);
  const rsiLow1 = Math.min(...rsiFirst);
  const rsiLow2 = Math.min(...rsiSecond);
  const rsiHigh1 = Math.max(...rsiFirst);
  const rsiHigh2 = Math.max(...rsiSecond);

  if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1) return 'bullish';
  if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1) return 'bearish';
  return 'none';
}

// F6 — Order Flow Extreme (≥70% one side)
function filterOrderFlowExtreme(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
a: Analysis)
: BigMoveFilterResult {
  const buyPct = a.of?.buyPct ?? 50;
  const sellPct = a.of?.sellPct ?? 50;
  if (dir === 'BUY') {
    const passed = buyPct >= 70;
    return {
      id: 6,
      name: 'Order Flow',
      passed,
      reason: passed ?
      `Strong buy pressure ${buyPct.toFixed(0)}% — institutional accumulation` :
      `Buy pressure only ${buyPct.toFixed(0)}% (need ≥70%)`,
      detail: `Buy ${buyPct.toFixed(0)}% / Sell ${sellPct.toFixed(0)}%`
    };
  }
  if (dir === 'SELL') {
    const passed = sellPct >= 70;
    return {
      id: 6,
      name: 'Order Flow',
      passed,
      reason: passed ?
      `Strong sell pressure ${sellPct.toFixed(0)}% — institutional distribution` :
      `Sell pressure only ${sellPct.toFixed(0)}% (need ≥70%)`,
      detail: `Buy ${buyPct.toFixed(0)}% / Sell ${sellPct.toFixed(0)}%`
    };
  }
  return {
    id: 6,
    name: 'Order Flow',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// F7 — Major candlestick / chart pattern confirmation
function filterMajorPattern(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>)
: BigMoveFilterResult {
  const source =
  (candles['1d'] || []).length >= 20 ? candles['1d'] : candles['4h'];
  if (!source || source.length < 5) {
    return {
      id: 7,
      name: 'Pattern',
      passed: false,
      reason: 'Insufficient candles for pattern detection',
      detail: 'Need 5+ HTF candles'
    };
  }
  const patterns = detectCandlestickPatterns(source);
  if (dir === 'BUY') {
    const bull = patterns.find(
      (p) =>
      p.type === 'bullish' && (
      p.strength === 'very_strong' || p.strength === 'strong')
    );
    return {
      id: 7,
      name: 'Pattern',
      passed: !!bull,
      reason: bull ?
      `${bull.name} (${bull.strength}) confirms big BUY` :
      'No strong bullish HTF pattern',
      detail: bull ? bull.name : 'None'
    };
  }
  if (dir === 'SELL') {
    const bear = patterns.find(
      (p) =>
      p.type === 'bearish' && (
      p.strength === 'very_strong' || p.strength === 'strong')
    );
    return {
      id: 7,
      name: 'Pattern',
      passed: !!bear,
      reason: bear ?
      `${bear.name} (${bear.strength}) confirms big SELL` :
      'No strong bearish HTF pattern',
      detail: bear ? bear.name : 'None'
    };
  }
  return {
    id: 7,
    name: 'Pattern',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// =============================================================================
// STRATEGY SCORERS
// =============================================================================

function scoreAMDLiquidityRun(
candles: Record<Timeframe, Candle[]>,
a: Analysis,
phase: AMDPhase)
{
  const def = BIG_MOVE_STRATEGIES[0];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no AMD setup';

  if (phase === 'MANIPULATION') {
    score = 35;
    // Direction depends on which side was swept
    const lg = detectLiquidityGrab(candles);
    if (lg.signal === 'BUY') {
      dir = 'BUY';
      reason = 'AMD Manipulation phase — bear trap below range';
    } else if (lg.signal === 'SELL') {
      dir = 'SELL';
      reason = 'AMD Manipulation phase — bull trap above range';
    }
  } else if (phase === 'ACCUMULATION') {
    score = 25;
    dir = 'BUY';
    reason = 'Late accumulation — preparing for big move up';
  } else if (phase === 'DISTRIBUTION') {
    score = 25;
    dir = 'SELL';
    reason = 'Late distribution — preparing for big move down';
  }

  return { def, score, dir, reason };
}

function scoreICT2022(candles: Record<Timeframe, Candle[]>, a: Analysis) {
  const def = BIG_MOVE_STRATEGIES[1];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no ICT setup';

  const fvg = a.ict?.fvgs?.[0];
  if (!fvg) return { def, score, dir, reason };

  // Need HTF alignment
  const daily = candles['1d'] || [];
  if (daily.length < 50) return { def, score, dir, reason };
  const ema50 = calcEMA(
    daily.map((c) => c.c),
    50
  );
  const last = daily[daily.length - 1].c;

  if (fvg.t === 'bullish_fvg' && last > ema50) {
    score = 30;
    dir = 'BUY';
    reason = 'Bullish FVG + price above Daily EMA50';
  } else if (fvg.t === 'bearish_fvg' && last < ema50) {
    score = 30;
    dir = 'SELL';
    reason = 'Bearish FVG + price below Daily EMA50';
  }

  return { def, score, dir, reason };
}

function scoreWeeklyBreakoutRetest(
candles: Record<Timeframe, Candle[]>,
a: Analysis)
{
  const def = BIG_MOVE_STRATEGIES[2];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no breakout';

  // Use daily as proxy for weekly when weekly unavailable
  const daily = candles['1d'] || [];
  if (daily.length < 30) return { def, score, dir, reason };

  const last30 = daily.slice(-30);
  const consolidation = last30.slice(0, -3);
  const recent = last30.slice(-3);
  const consHigh = Math.max(...consolidation.map((c) => c.h));
  const consLow = Math.min(...consolidation.map((c) => c.l));

  const breakUp = recent.some((c) => c.c > consHigh);
  const breakDown = recent.some((c) => c.c < consLow);
  const lastCandle = daily[daily.length - 1];

  if (breakUp && lastCandle.c > consHigh && lastCandle.c < consHigh * 1.005) {
    score = 28;
    dir = 'BUY';
    reason = 'Breakout above 30d high + retest in progress';
  } else if (
  breakDown &&
  lastCandle.c < consLow &&
  lastCandle.c > consLow * 0.995)
  {
    score = 28;
    dir = 'SELL';
    reason = 'Breakout below 30d low + retest in progress';
  }

  return { def, score, dir, reason };
}

function scoreCentralBankPlay(a: Analysis) {
  const def = BIG_MOVE_STRATEGIES[3];
  // Without a real economic calendar hook, we approximate by checking if MTF
  // alignment + strong order flow are present (typical pre-news positioning).
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no fundamental edge detected';

  const align = a.trends?.align ?? 0;
  if (align > 60 && a.of?.imb === 'strong_buying') {
    score = 22;
    dir = 'BUY';
    reason = 'MTF aligned + strong buying — likely pre-news accumulation';
  } else if (align < -60 && a.of?.imb === 'strong_selling') {
    score = 22;
    dir = 'SELL';
    reason = 'MTF aligned + strong selling — likely pre-news distribution';
  }
  return { def, score, dir, reason };
}

function scoreOBStackFVG(candles: Record<Timeframe, Candle[]>, a: Analysis) {
  const def = BIG_MOVE_STRATEGIES[4];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no OB stack';

  const fvg = a.ict?.fvgs?.[0];
  if (!fvg) return { def, score, dir, reason };

  // Need MTF trend alignment as proxy for OB stack
  const align = a.trends?.align ?? 0;
  if (fvg.t === 'bullish_fvg' && align > 40) {
    score = 25;
    dir = 'BUY';
    reason = 'Bullish FVG + aligned trends (proxy for OB stack)';
  } else if (fvg.t === 'bearish_fvg' && align < -40) {
    score = 25;
    dir = 'SELL';
    reason = 'Bearish FVG + aligned trends (proxy for OB stack)';
  }

  return { def, score, dir, reason };
}