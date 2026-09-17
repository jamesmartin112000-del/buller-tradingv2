// Scalping engine v2.0 — 7-Filter Trend Confirmation System
//
// PIPELINE:
//   1. Score the 5 scalp strategies (Micro FVG, Liq Grab, Killzone, Trap, Order Flow)
//   2. Determine raw direction from strategy confluence
//   3. Run the 7 filters against that raw direction
//   4. Compute final confidence from filters (each filter = 14.3 pts, cap 95)
//   5. Reject the trade if < 6/7 filters pass OR confidence < 85
//   6. Build entry/SL/TP, key levels, log, patterns

import type { Analysis, Candle, Price, Timeframe } from './types';
import type {
  ScalpStrategyId,
  ScalpStrategyDef } from
'../data/scalpingStrategies';
import { SCALP_STRATEGIES } from '../data/scalpingStrategies';
import { calcATR, calcEMA, calcRSI } from './indicators';
import { detectLiquidityGrab } from './smc';
import { detectCandlestickPatterns } from './patterns';

// === 7-FILTER SYSTEM ========================================================
export type FilterId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface FilterResult {
  id: FilterId;
  name: string;
  passed: boolean;
  reason: string;
  detail: string;
}

export interface ScalpSignal {
  id: string;
  pair: string;
  ts: number;
  timeframe: '1m' | '5m';
  // hasSignal === false means filters rejected the trade
  hasSignal: boolean;
  dir: 'BUY' | 'SELL' | 'NO_TRADE';
  confidence: number; // 0-100
  entry: number | null;
  sl: number | null;
  tp: number | null;
  rr: string;
  holdTime: string;
  price: number;
  // === 7-Filter results ===
  filters: FilterResult[];
  filtersPassed: number;
  filtersTotal: 7;
  rejectionReason?: string;
  // === Strategy alignment ===
  active: Array<{
    id: ScalpStrategyId;
    name: string;
    score: number;
    dir: 'BUY' | 'SELL';
  }>;
  // === Order flow ===
  buyPct: number;
  sellPct: number;
  imbalance: string;
  // === Patterns ===
  patterns: Array<{
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    status: string;
  }>;
  // === Key levels ===
  levels: {
    resistance: number | null;
    support: number | null;
    fvgTop: number | null;
    fvgBottom: number | null;
  };
  // === Analysis log ===
  log: Array<{time: string;msg: string;tone?: 'ok' | 'fail' | 'warn';}>;
  strategyFilter: 'AUTO' | ScalpStrategyId;
}

export interface ScalpEngineInput {
  pair: string;
  price: Price;
  candles: Record<Timeframe, Candle[]>;
  analysis: Analysis;
  timeframe: '1m' | '5m';
  strategyFilter: 'AUTO' | ScalpStrategyId;
}

export function genScalpSignal(input: ScalpEngineInput): ScalpSignal {
  const { pair, price, candles, analysis: a, timeframe, strategyFilter } = input;
  const cp =
  price.mid ||
  candles['1h']?.slice(-1)[0]?.c ||
  candles['5m']?.slice(-1)[0]?.c ||
  0;
  const tfCandles = candles[timeframe] || [];
  const refCandles =
  tfCandles.length >= 15 ? tfCandles : candles['5m'] || candles['1h'] || [];
  const atr = calcATR(candles) || cp * 0.002;

  // === STEP 1: Score the 5 strategies ===
  const scored = [
  scoreFvgImbalance(refCandles, a),
  scoreLiquidityGrab(candles, refCandles),
  scoreKillzoneBreakout(a),
  scoreTrapReverse(refCandles),
  scoreOrderFlowRush(a)];


  let buyScore = 0;
  let sellScore = 0;
  const active: ScalpSignal['active'] = [];
  scored.forEach((s) => {
    if (s.dir === 'NEUTRAL' || s.score === 0) return;
    if (strategyFilter !== 'AUTO' && s.def.id !== strategyFilter) return;
    if (s.dir === 'BUY') buyScore += s.score;
    if (s.dir === 'SELL') sellScore += s.score;
    active.push({ id: s.def.id, name: s.def.name, score: s.score, dir: s.dir });
  });

  // === STEP 2: Determine raw direction from strategy confluence ===
  let rawDir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (buyScore >= 25 && buyScore >= sellScore + 8) rawDir = 'BUY';else
  if (sellScore >= 25 && sellScore >= buyScore + 8) rawDir = 'SELL';

  // === STEP 3: Run the 7 filters ===
  const filters = runSevenFilters(rawDir, candles, refCandles, a, cp);
  const filtersPassed = filters.filter((f) => f.passed).length;

  // === STEP 4: Confidence from filters (each = 14.3 pts, cap 95) ===
  let confidence = Math.min(95, Math.round(filtersPassed * 14.3));

  // Strategy strength bonus (small)
  const stratStrength = Math.max(buyScore, sellScore);
  if (stratStrength > 50) confidence = Math.min(95, confidence + 3);
  if (stratStrength > 70) confidence = Math.min(95, confidence + 2);

  // === STEP 5: Decision — trade or NO TRADE ===
  let dir: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
  let hasSignal = false;
  let rejectionReason: string | undefined;

  if (rawDir === 'NEUTRAL') {
    rejectionReason = 'No strategy confluence — insufficient signal';
  } else if (filtersPassed < 6) {
    rejectionReason = `Only ${filtersPassed}/7 filters passed (minimum 6 required)`;
  } else if (confidence < 85) {
    rejectionReason = `Confidence ${confidence}% below 85% threshold`;
  } else {
    dir = rawDir as 'BUY' | 'SELL';
    hasSignal = true;
  }

  // === STEP 6: Entry / SL / TP ===
  let entry: number | null = null;
  let sl: number | null = null;
  let tp: number | null = null;
  let rr = '—';

  if (hasSignal && dir !== 'NO_TRADE') {
    const slMult = timeframe === '1m' ? 0.5 : 0.6;
    const tpMult = timeframe === '1m' ? 1.0 : 1.2;
    // Slight premium/discount for entry confirmation (per spec)
    const entryOffset = atr * 0.1;
    entry =
    dir === 'BUY' ?
    +(cp + entryOffset).toFixed(8) :
    +(cp - entryOffset).toFixed(8);
    sl =
    dir === 'BUY' ?
    +(entry - atr * slMult).toFixed(8) :
    +(entry + atr * slMult).toFixed(8);
    tp =
    dir === 'BUY' ?
    +(entry + atr * tpMult).toFixed(8) :
    +(entry - atr * tpMult).toFixed(8);
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rrNum = risk > 0 ? reward / risk : 0;
    rr = `1:${rrNum.toFixed(1)}`;
  }

  const holdTime = timeframe === '1m' ? '2-5 min' : '5-10 min';

  // Order flow
  const buyPct = a.of?.buyPct ?? 50;
  const sellPct = a.of?.sellPct ?? 50;
  const imbalance =
  a.of?.imb === 'strong_buying' ?
  'Strong Buying' :
  a.of?.imb === 'strong_selling' ?
  'Strong Selling' :
  a.of?.imb === 'buying' ?
  'Buying' :
  a.of?.imb === 'selling' ?
  'Selling' :
  'Neutral';

  // Patterns
  const cps = detectCandlestickPatterns(refCandles).slice(0, 4);
  const patterns: ScalpSignal['patterns'] = cps.map((p) => {
    let status = 'detected';
    if (hasSignal) {
      if (dir === 'BUY' && p.type === 'bullish') status = 'confirmed';else
      if (dir === 'SELL' && p.type === 'bearish') status = 'confirmed';
    }
    if (p.type === 'neutral') status = 'indecision';
    return { name: p.name, type: p.type, status };
  });

  // Key levels
  const fvg = a.ict?.fvgs?.[0];
  const levels = {
    resistance: a.res?.[0]?.p ?? null,
    support: a.sup?.[0]?.p ?? null,
    fvgTop: fvg?.h ?? null,
    fvgBottom: fvg?.l ?? null
  };

  // === STEP 7: Build the terminal-style log ===
  const tStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const log: ScalpSignal['log'] = [];
  log.push({
    time: tStr,
    msg: `INIT :: 7-Filter analysis started · ${pair} ${timeframe}`
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
      msg: `DECISION :: ${dir} signal generated`,
      tone: 'ok'
    });
    log.push({
      time: tStr,
      msg: `LEVELS :: Entry ${entry?.toFixed(5)} · SL ${sl?.toFixed(5)} · TP ${tp?.toFixed(5)} · RR ${rr}`
    });
  } else {
    log.push({
      time: tStr,
      msg: `DECISION :: ✗ NO TRADE — ${rejectionReason}`,
      tone: 'fail'
    });
    log.push({
      time: tStr,
      msg: 'ADVICE :: Wait for cleaner setup aligned with all 7 filters',
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
    tp,
    rr,
    holdTime,
    price: cp,
    filters,
    filtersPassed,
    filtersTotal: 7,
    rejectionReason,
    active,
    buyPct,
    sellPct,
    imbalance,
    patterns,
    levels,
    log,
    strategyFilter
  };
}

// =============================================================================
// THE 7-FILTER SYSTEM — anchors every scalp signal to objective market reality
// =============================================================================

function runSevenFilters(
rawDir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>,
refCandles: Candle[],
a: Analysis,
cp: number)
: FilterResult[] {
  return [
  filterHTFTrend(rawDir, candles),
  filterMarketStructure(rawDir, refCandles, cp),
  filterVolumeSpike(refCandles),
  filterCandleStrength(refCandles),
  filterDivergence(rawDir, refCandles),
  filterLiquidityTrap(rawDir, candles, refCandles),
  filterSessionTiming()];

}

// FILTER 1 — HTF Trend Check (15m + 1h EMA 20 / 50) ---------------------------
function filterHTFTrend(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Record<Timeframe, Candle[]>)
: FilterResult {
  const cs1h = candles['1h'] || [];
  const closes1h = cs1h.map((c) => c.c);
  const ema20 = calcEMA(closes1h, 20);
  const ema50 = calcEMA(closes1h, 50);
  const last = closes1h[closes1h.length - 1];

  if (!ema20 || !ema50 || !last) {
    return {
      id: 1,
      name: 'HTF Trend',
      passed: dir === 'NEUTRAL' ? false : true,
      reason: 'Insufficient 1h candles for EMA — assuming neutral',
      detail: 'Need ≥50 candles'
    };
  }

  let htfTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (last > ema20 && ema20 > ema50) htfTrend = 'BULLISH';else
  if (last < ema20 && ema20 < ema50) htfTrend = 'BEARISH';

  const aligned =
  dir === 'BUY' && (htfTrend === 'BULLISH' || htfTrend === 'SIDEWAYS') ||
  dir === 'SELL' && (htfTrend === 'BEARISH' || htfTrend === 'SIDEWAYS');

  return {
    id: 1,
    name: 'HTF Trend',
    passed: aligned,
    reason: aligned ?
    `Signal aligns with ${htfTrend.toLowerCase()} 1h trend` :
    `Trading against ${htfTrend.toLowerCase()} 1h trend — REJECTED`,
    detail: `1h: ${htfTrend} · EMA20 ${ema20.toFixed(5)} · EMA50 ${ema50.toFixed(5)}`
  };
}

// FILTER 2 — Market Structure (near support for BUY / resistance for SELL) ----
function filterMarketStructure(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Candle[],
cp: number)
: FilterResult {
  if (candles.length < 10) {
    return {
      id: 2,
      name: 'Structure',
      passed: false,
      reason: 'Not enough candles to map structure',
      detail: '< 10 candles'
    };
  }
  const last10 = candles.slice(-10);
  const recentHigh = Math.max(...last10.map((c) => c.h));
  const recentLow = Math.min(...last10.map((c) => c.l));
  const range = recentHigh - recentLow;
  if (range === 0) {
    return {
      id: 2,
      name: 'Structure',
      passed: false,
      reason: 'No range — flat market',
      detail: 'Range = 0'
    };
  }
  const distToLow = (cp - recentLow) / range;
  const distToHigh = (recentHigh - cp) / range;

  if (dir === 'BUY') {
    const nearSupport = distToLow < 0.25;
    return {
      id: 2,
      name: 'Structure',
      passed: nearSupport,
      reason: nearSupport ?
      'Price near recent support — valid BUY zone' :
      'Price in mid-range — fake breakout risk',
      detail: `Distance to low: ${(distToLow * 100).toFixed(0)}% of range`
    };
  }
  if (dir === 'SELL') {
    const nearResistance = distToHigh < 0.25;
    return {
      id: 2,
      name: 'Structure',
      passed: nearResistance,
      reason: nearResistance ?
      'Price near recent resistance — valid SELL zone' :
      'Price in mid-range — fake breakout risk',
      detail: `Distance to high: ${(distToHigh * 100).toFixed(0)}% of range`
    };
  }
  return {
    id: 2,
    name: 'Structure',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// FILTER 3 — Volume Spike (current vol ≥ 1.5x avg of last 10) -----------------
function filterVolumeSpike(candles: Candle[]): FilterResult {
  if (candles.length < 11) {
    return {
      id: 3,
      name: 'Volume',
      passed: false,
      reason: 'Insufficient volume data',
      detail: '< 11 candles'
    };
  }
  const last = candles[candles.length - 1];
  const prev10 = candles.slice(-11, -1);
  const avg = prev10.reduce((s, c) => s + (c.v || 0), 0) / 10;
  if (avg === 0) {
    // Volume data not available — pass softly (some forex/gold feeds lack volume)
    return {
      id: 3,
      name: 'Volume',
      passed: true,
      reason: 'Volume data unavailable — passed by default',
      detail: 'No tick volume on this feed'
    };
  }
  const ratio = (last.v || 0) / avg;
  const passed = ratio >= 1.5;
  return {
    id: 3,
    name: 'Volume',
    passed,
    reason: passed ?
    `Volume spike confirmed at ${ratio.toFixed(1)}x average` :
    `Volume only ${ratio.toFixed(1)}x average — possible fake move`,
    detail: `Last vol ${(last.v || 0).toFixed(0)} · 10-avg ${avg.toFixed(0)}`
  };
}

// FILTER 4 — Candle Body Strength (body/range ratio ≥ 0.3) --------------------
function filterCandleStrength(candles: Candle[]): FilterResult {
  if (candles.length < 1) {
    return {
      id: 4,
      name: 'Candle Strength',
      passed: false,
      reason: 'No candle',
      detail: '—'
    };
  }
  const last = candles[candles.length - 1];
  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l;
  if (range === 0) {
    return {
      id: 4,
      name: 'Candle Strength',
      passed: false,
      reason: 'Doji / no range',
      detail: 'Range = 0'
    };
  }
  const ratio = body / range;
  const passed = ratio >= 0.3;
  const grade = ratio >= 0.6 ? 'STRONG' : ratio >= 0.3 ? 'MODERATE' : 'WEAK';
  return {
    id: 4,
    name: 'Candle Strength',
    passed,
    reason: passed ?
    `Body is ${(ratio * 100).toFixed(0)}% of range — ${grade}` :
    `Body only ${(ratio * 100).toFixed(0)}% of range — indecision`,
    detail: `${grade} candle`
  };
}

// FILTER 5 — RSI Divergence (last 10 candles) ---------------------------------
function filterDivergence(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
candles: Candle[])
: FilterResult {
  if (candles.length < 15) {
    return {
      id: 5,
      name: 'Divergence',
      passed: false,
      reason: 'Not enough candles for RSI',
      detail: '< 15 candles'
    };
  }
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
    const slice = closes.slice(0, i + 1);
    rsiSeries.push(calcRSI(slice, 14) ?? 50);
  }
  const rsiFirst = rsiSeries.slice(0, mid);
  const rsiSecond = rsiSeries.slice(mid);
  const rsiLow1 = Math.min(...rsiFirst);
  const rsiLow2 = Math.min(...rsiSecond);
  const rsiHigh1 = Math.max(...rsiFirst);
  const rsiHigh2 = Math.max(...rsiSecond);

  // Hidden bullish divergence: price LL, RSI HL → strong BUY
  // Regular bullish divergence: price LL, RSI HL works too
  const bullishDiv = priceLow2 < priceLow1 && rsiLow2 > rsiLow1;
  const bearishDiv = priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1;

  if (dir === 'BUY') {
    if (bullishDiv) {
      return {
        id: 5,
        name: 'Divergence',
        passed: true,
        reason: 'Bullish RSI divergence confirmed — strong BUY',
        detail: `Price LL · RSI HL (${rsiLow1.toFixed(0)}→${rsiLow2.toFixed(0)})`
      };
    }
    if (bearishDiv) {
      return {
        id: 5,
        name: 'Divergence',
        passed: false,
        reason: 'Bearish divergence conflicts with BUY signal',
        detail: 'Direction conflict'
      };
    }
    return {
      id: 5,
      name: 'Divergence',
      passed: true,
      reason: 'No divergence conflict — neutral',
      detail: 'Neutral RSI structure'
    };
  }
  if (dir === 'SELL') {
    if (bearishDiv) {
      return {
        id: 5,
        name: 'Divergence',
        passed: true,
        reason: 'Bearish RSI divergence confirmed — strong SELL',
        detail: `Price HH · RSI LH (${rsiHigh1.toFixed(0)}→${rsiHigh2.toFixed(0)})`
      };
    }
    if (bullishDiv) {
      return {
        id: 5,
        name: 'Divergence',
        passed: false,
        reason: 'Bullish divergence conflicts with SELL signal',
        detail: 'Direction conflict'
      };
    }
    return {
      id: 5,
      name: 'Divergence',
      passed: true,
      reason: 'No divergence conflict — neutral',
      detail: 'Neutral RSI structure'
    };
  }
  return {
    id: 5,
    name: 'Divergence',
    passed: false,
    reason: 'No direction',
    detail: '—'
  };
}

// FILTER 6 — Liquidity Trap / Stop Hunt ---------------------------------------
function filterLiquidityTrap(
dir: 'BUY' | 'SELL' | 'NEUTRAL',
allCandles: Record<Timeframe, Candle[]>,
refCandles: Candle[])
: FilterResult {
  const lg = detectLiquidityGrab(allCandles);
  if (dir === 'BUY' && lg.signal === 'BUY') {
    return {
      id: 6,
      name: 'Liquidity Trap',
      passed: true,
      reason: 'Bear trap detected — liquidity swept below, reversal up',
      detail: 'Stop hunt confirmed'
    };
  }
  if (dir === 'SELL' && lg.signal === 'SELL') {
    return {
      id: 6,
      name: 'Liquidity Trap',
      passed: true,
      reason: 'Bull trap detected — liquidity swept above, reversal down',
      detail: 'Stop hunt confirmed'
    };
  }

  // Fallback: detect simple wick rejection on the ref tf
  if (refCandles.length >= 10) {
    const last10 = refCandles.slice(-10);
    const recentHigh = Math.max(...last10.slice(0, -1).map((c) => c.h));
    const recentLow = Math.min(...last10.slice(0, -1).map((c) => c.l));
    const last = last10[last10.length - 1];
    const body = Math.abs(last.c - last.o);
    const lowerWick = Math.min(last.o, last.c) - last.l;
    const upperWick = last.h - Math.max(last.o, last.c);

    if (
    dir === 'BUY' &&
    last.l < recentLow &&
    last.c > last.o &&
    lowerWick > body)
    {
      return {
        id: 6,
        name: 'Liquidity Trap',
        passed: true,
        reason: 'Wick swept low + bullish close — trap confirmed',
        detail: 'Long lower wick rejection'
      };
    }
    if (
    dir === 'SELL' &&
    last.h > recentHigh &&
    last.c < last.o &&
    upperWick > body)
    {
      return {
        id: 6,
        name: 'Liquidity Trap',
        passed: true,
        reason: 'Wick swept high + bearish close — trap confirmed',
        detail: 'Long upper wick rejection'
      };
    }
  }

  // Clean structure (no trap) — neutral pass for clean breakouts
  return {
    id: 6,
    name: 'Liquidity Trap',
    passed: false,
    reason: 'No liquidity grab detected — possible chop',
    detail: 'Clean structure'
  };
}

// FILTER 7 — Session Timing ---------------------------------------------------
function filterSessionTiming(): FilterResult {
  const now = new Date();
  const hour = now.getUTCHours();
  // Peak overlap: London (7-11 UTC) + NY (13-16 UTC)
  const isLondon = hour >= 7 && hour <= 11;
  const isNY = hour >= 13 && hour <= 16;
  const isOverlap = hour >= 13 && hour <= 15;
  const isDeadZone = hour >= 21 || hour < 5;

  if (isOverlap) {
    return {
      id: 7,
      name: 'Session',
      passed: true,
      reason: 'London/NY overlap — peak liquidity hours',
      detail: `UTC ${hour}:00 · OVERLAP`
    };
  }
  if (isLondon || isNY) {
    return {
      id: 7,
      name: 'Session',
      passed: true,
      reason: `${isLondon ? 'London' : 'NY'} session active`,
      detail: `UTC ${hour}:00 · ${isLondon ? 'LONDON' : 'NY'}`
    };
  }
  if (isDeadZone) {
    return {
      id: 7,
      name: 'Session',
      passed: false,
      reason: 'Dead zone — low liquidity, avoid scalping',
      detail: `UTC ${hour}:00 · DEAD`
    };
  }
  return {
    id: 7,
    name: 'Session',
    passed: false,
    reason: 'Off-peak hours — reduced liquidity',
    detail: `UTC ${hour}:00 · OFF-PEAK`
  };
}

// =============================================================================
// STRATEGY SCORERS
// =============================================================================

function scoreFvgImbalance(candles: Candle[], a: Analysis) {
  const def = SCALP_STRATEGIES[0];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no FVG';

  const fvg = a.ict?.fvgs?.[0];
  if (!fvg) return { def, score, dir, reason };

  const buyPct = a.of?.buyPct ?? 50;
  const sellPct = a.of?.sellPct ?? 50;

  if (fvg.t === 'bullish_fvg' && buyPct >= 60) {
    score = 30 + Math.round((buyPct - 60) * 0.4);
    dir = 'BUY';
    reason = `Bullish FVG + ${buyPct.toFixed(0)}% buy pressure`;
  } else if (fvg.t === 'bearish_fvg' && sellPct >= 60) {
    score = 30 + Math.round((sellPct - 60) * 0.4);
    dir = 'SELL';
    reason = `Bearish FVG + ${sellPct.toFixed(0)}% sell pressure`;
  } else {
    score = 15;
    dir = fvg.t === 'bullish_fvg' ? 'BUY' : 'SELL';
    reason = `${fvg.t === 'bullish_fvg' ? 'Bullish' : 'Bearish'} FVG only`;
  }

  return { def, score, dir, reason };
}

function scoreLiquidityGrab(
allCandles: Record<Timeframe, Candle[]>,
refCandles: Candle[])
{
  const def = SCALP_STRATEGIES[1];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no grab';

  const lg = detectLiquidityGrab(allCandles);
  if (lg.signal === 'BUY') {
    score = 38;
    dir = 'BUY';
    reason = 'Liquidity swept below + reversal';
  } else if (lg.signal === 'SELL') {
    score = 38;
    dir = 'SELL';
    reason = 'Liquidity swept above + reversal';
  } else if (refCandles.length >= 10) {
    const last10 = refCandles.slice(-10);
    const recentHigh = Math.max(...last10.slice(0, -1).map((c) => c.h));
    const recentLow = Math.min(...last10.slice(0, -1).map((c) => c.l));
    const last = last10[last10.length - 1];

    if (last.l < recentLow && last.c > last.o) {
      score = 25;
      dir = 'BUY';
      reason = 'Wick swept low, bullish close';
    } else if (last.h > recentHigh && last.c < last.o) {
      score = 25;
      dir = 'SELL';
      reason = 'Wick swept high, bearish close';
    }
  }

  return { def, score, dir, reason };
}

function scoreKillzoneBreakout(a: Analysis) {
  const def = SCALP_STRATEGIES[2];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'outside killzone';

  if (a.pak?.brk?.dir === 'bullish') {
    score = 32;
    dir = 'BUY';
    reason = `PK 10AM break above ${a.pak.brk.p.toFixed(4)}`;
  } else if (a.pak?.brk?.dir === 'bearish') {
    score = 32;
    dir = 'SELL';
    reason = `PK 10AM break below ${a.pak.brk.p.toFixed(4)}`;
  }

  if (a.ict?.killzone === 'london_open' || a.ict?.killzone === 'ny_open') {
    if (dir !== 'NEUTRAL') {
      score += 8;
      reason += ` · ${a.ict.killzone === 'london_open' ? 'London' : 'NY'} killzone active`;
    }
  }

  return { def, score, dir, reason };
}

function scoreTrapReverse(candles: Candle[]) {
  const def = SCALP_STRATEGIES[3];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'no trap';

  if (candles.length < 5) return { def, score, dir, reason };

  const last3 = candles.slice(-3);
  const prev2 = candles.slice(-5, -3);

  const prevSum = prev2.reduce((s, c) => s + (c.c - c.o), 0);
  const lastSum = last3.reduce((s, c) => s + (c.c - c.o), 0);

  if (
  prevSum > 0 &&
  lastSum < 0 &&
  Math.abs(lastSum) > Math.abs(prevSum) * 0.8)
  {
    score = 30;
    dir = 'SELL';
    reason = 'Bull trap — failed breakout reversed';
  } else if (prevSum < 0 && lastSum > 0 && lastSum > Math.abs(prevSum) * 0.8) {
    score = 30;
    dir = 'BUY';
    reason = 'Bear trap — failed breakdown reversed';
  }

  const last = last3[last3.length - 1];
  const body = Math.abs(last.c - last.o);
  const upperWick = last.h - Math.max(last.o, last.c);
  const lowerWick = Math.min(last.o, last.c) - last.l;
  if (dir === 'BUY' && lowerWick > body * 2) {
    score += 8;
    reason += ' + long lower wick';
  } else if (dir === 'SELL' && upperWick > body * 2) {
    score += 8;
    reason += ' + long upper wick';
  }

  return { def, score, dir, reason };
}

function scoreOrderFlowRush(a: Analysis) {
  const def = SCALP_STRATEGIES[4];
  let score = 0;
  let dir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'flow neutral';

  const buyPct = a.of?.buyPct ?? 50;
  const sellPct = a.of?.sellPct ?? 50;

  if (buyPct >= 75) {
    score = 30 + Math.round((buyPct - 75) * 0.6);
    dir = 'BUY';
    reason = `Buy pressure ${buyPct.toFixed(0)}%`;
  } else if (sellPct >= 75) {
    score = 30 + Math.round((sellPct - 75) * 0.6);
    dir = 'SELL';
    reason = `Sell pressure ${sellPct.toFixed(0)}%`;
  } else if (a.of?.imb === 'strong_buying') {
    score = 20;
    dir = 'BUY';
    reason = 'Strong buying imbalance';
  } else if (a.of?.imb === 'strong_selling') {
    score = 20;
    dir = 'SELL';
    reason = 'Strong selling imbalance';
  }

  return { def, score, dir, reason };
}