// ============================================================
// Unified God-Signal engine: fuses the 7-subsystem weighted
// vote (God Signal) with the hidden-indicator trap detection
// (Trap Detector) into ONE verdict with entry / SL / multi-TP.
// ============================================================
import type { Asset, PriceData, TCandle } from './market';
import { calcATR, calcEMA, calcMACD, calcRSI, makeCandles } from './market';

export type Direction = 'BUY' | 'SELL' | 'NEUTRAL';

export interface SubSignal {
  name: string;
  status: 'bullish' | 'bearish' | 'neutral';
  weight: number;
  detail: string;
}

export interface HiddenIndicator {
  name: string;
  value: string;
  isWarning: boolean;
  detail: string;
}

export interface CandlePattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  detail: string;
}

export interface CandlePrediction {
  next: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  probability: number;
  detail: string;
}

export interface RealDirection {
  market: Direction;
  institutional: Direction;
  aligned: boolean;
  note: string;
}

export interface PerfectCandle {
  isPerfect: boolean;
  side: Direction;
  detail: string;
}

export interface TpLevels {
  tp1: number;
  tp2: number;
  tp3: number;
  tp4: number;
  tp5: number;
  tp6: number;
}

export interface GodVerdict {
  symbolId: string;
  name: string;
  type: string;
  price: number;
  source: string;
  direction: Direction;
  confidence: number;
  score: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  tpLevels: TpLevels | null;
  reason: string;
  entryStatus: string;
  rsi: number;
  ema9: number;
  ema21: number;
  ema50: number;
  atr: number;
  macdHist: number;
  instRatio: number;
  subSignals: SubSignal[];
  trap: {
    type: 'BULL_TRAP' | 'BEAR_TRAP' | 'NO_TRAP';
    confidence: number;
    reason: string;
  };
  hiddenIndicators: HiddenIndicator[];
  candlePatterns: CandlePattern[];
  prediction: CandlePrediction;
  realDirection: RealDirection;
  perfectCandle: PerfectCandle;
  ts: number;
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0,
    sy = 0,
    sxy = 0,
    sx2 = 0,
    sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxy += xs[i] * ys[i];
    sx2 += xs[i] * xs[i];
    sy2 += ys[i] * ys[i];
  }
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  return den === 0 ? 0 : (n * sxy - sx * sy) / den;
}

export function generateVerdict(
asset: Asset,
priceData: PriceData,
candlesIn: TCandle[])
: GodVerdict {
  const cp = priceData.price;
  const candles =
  candlesIn && candlesIn.length >= 20 ? candlesIn : makeCandles(cp, 40);
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const rsi = calcRSI(closes, 14);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, Math.min(50, closes.length));
  const macd = calcMACD(closes);
  const atr = calcATR(candles, 14) || cp * 0.01;

  // Institutional flow (buy-volume ratio over last 20)
  const recent = candles.slice(-20);
  let bv = 0,
    tv = 0;
  recent.forEach((c) => {
    const v = c.volume || 1000;
    tv += v;
    if (c.close > c.open) bv += v;else
    if (c.close === c.open) bv += v * 0.5;
  });
  const instRatio = tv > 0 ? bv / tv : 0.5;
  const imbalance = (instRatio - 0.5) * 200; // -100..100

  // ── 7 sub-systems (God Signal) ──
  const above = cp > ema21 && ema21 > ema50;
  const below = cp < ema21 && ema21 < ema50;
  const lastVol = volumes[volumes.length - 1] || 0;
  const avgVol =
  volumes.slice(-20).reduce((a, b) => a + b, 0) /
  Math.max(1, Math.min(20, volumes.length));

  const subSignals: SubSignal[] = [
  {
    name: 'RSI Momentum',
    status:
    rsi > 70 ?
    'bearish' :
    rsi < 30 ?
    'bullish' :
    rsi > 55 ?
    'bullish' :
    rsi < 45 ?
    'bearish' :
    'neutral',
    weight: 18,
    detail: `RSI ${rsi.toFixed(1)}`
  },
  {
    name: 'EMA Trend',
    status: above ? 'bullish' : below ? 'bearish' : 'neutral',
    weight: 20,
    detail: above ?
    'Stacked bullish' :
    below ?
    'Stacked bearish' :
    'Mixed EMAs'
  },
  {
    name: 'MACD',
    status:
    macd.hist > 0 && macd.macd > macd.signal ?
    'bullish' :
    macd.hist < 0 && macd.macd < macd.signal ?
    'bearish' :
    'neutral',
    weight: 15,
    detail: `Hist ${macd.hist.toFixed(4)}`
  },
  {
    name: 'Order Flow',
    status:
    imbalance > 5 ? 'bullish' : imbalance < -5 ? 'bearish' : 'neutral',
    weight: 15,
    detail: `Imbalance ${imbalance.toFixed(1)}%`
  },
  {
    name: 'Institutional',
    status:
    instRatio > 0.55 ? 'bullish' : instRatio < 0.45 ? 'bearish' : 'neutral',
    weight: 14,
    detail: `${Math.round(instRatio * 100)}% buy vol`
  },
  {
    name: 'Volume Profile',
    status:
    lastVol > avgVol * 1.1 ?
    cp >= closes[closes.length - 2] ?
    'bullish' :
    'bearish' :
    'neutral',
    weight: 10,
    detail: lastVol > avgVol * 1.1 ? 'Volume expansion' : 'Volume normal'
  },
  {
    name: 'Trend Slope',
    status: ema9 > ema21 ? 'bullish' : ema9 < ema21 ? 'bearish' : 'neutral',
    weight: 8,
    detail: ema9 > ema21 ? 'EMA9 > EMA21' : 'EMA9 < EMA21'
  }];


  let raw = 0,
    maxScore = 0;
  for (const s of subSignals) {
    maxScore += s.weight;
    if (s.status === 'bullish') raw += s.weight;else
    if (s.status === 'bearish') raw -= s.weight;
  }
  const score = Math.round(50 + raw / maxScore * 50); // 0..100
  let direction: Direction =
  score >= 60 ? 'BUY' : score <= 40 ? 'SELL' : 'NEUTRAL';

  // ── Hidden trap indicators (Trap Detector) ──
  const hiddenIndicators: HiddenIndicator[] = [];

  // CVD proxy (buy vol - sell vol over 20)
  let cvd = 0;
  recent.forEach((c) => {
    const v = c.volume || 1000;
    if (c.close >= c.open) cvd += v;else
    cvd -= v;
  });
  const priceUp = cp > closes[Math.max(0, closes.length - 20)];
  const cvdWarn = cvd < 0 && priceUp;
  hiddenIndicators.push({
    name: 'CVD (Volume Delta)',
    value: cvd.toFixed(0),
    isWarning: cvdWarn,
    detail: cvdWarn ?
    'Price UP, CVD DOWN — divergence' :
    cvd > 0 ?
    'Buying pressure' :
    'Selling pressure'
  });

  // Taker ratio proxy
  const takerWarn = priceUp && instRatio < 0.45;
  hiddenIndicators.push({
    name: 'Taker Buy Ratio',
    value: `${Math.round(instRatio * 100)}%`,
    isWarning: takerWarn,
    detail: takerWarn ?
    'Fake buying — price up, taker low' :
    instRatio > 0.55 ?
    'Real buying' :
    'Neutral'
  });

  // Volume spike
  const recentVol = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const volRatio = avgVol > 0 ? recentVol / avgVol : 1;
  const volWarn = volRatio > 2.5 && cp > highs[highs.length - 2];
  hiddenIndicators.push({
    name: 'Volume Spike',
    value: `${volRatio.toFixed(2)}x`,
    isWarning: volWarn,
    detail: volWarn ?
    'Spike — likely fake breakout' :
    volRatio > 1.5 ?
    'Above average' :
    'Normal'
  });

  // Liquidity sweep
  const lastHigh = Math.max(...highs.slice(-10));
  const lastLow = Math.min(...lows.slice(-10));
  let sweep = 'NONE';
  if (highs[highs.length - 1] >= lastHigh && cp < lastHigh) sweep = 'HIGH';else
  if (lows[lows.length - 1] <= lastLow && cp > lastLow) sweep = 'LOW';
  hiddenIndicators.push({
    name: 'Liquidity Sweep',
    value: sweep,
    isWarning: sweep !== 'NONE',
    detail:
    sweep === 'HIGH' ?
    'Highs swept — bull trap risk' :
    sweep === 'LOW' ?
    'Lows swept — bear trap risk' :
    'No sweep'
  });

  // RSI divergence
  const rsiPrev = calcRSI(closes.slice(0, -5), 14);
  const rsiDiv = priceUp && rsi < rsiPrev;
  hiddenIndicators.push({
    name: 'RSI Divergence',
    value: rsiDiv ? 'Bearish' : 'None',
    isWarning: rsiDiv,
    detail: rsiDiv ? 'Price up, RSI down — divergence' : 'No divergence'
  });

  // Price-volume correlation
  const n = Math.min(20, closes.length);
  const corr = pearson(closes.slice(-n), volumes.slice(-n));
  const corrWarn = corr < -0.5 && priceUp;
  hiddenIndicators.push({
    name: 'Price-Vol Correlation',
    value: corr.toFixed(2),
    isWarning: corrWarn,
    detail: corrWarn ?
    'Negative — no real demand' :
    corr > 0.5 ?
    'Healthy' :
    'Weak'
  });

  // ── Trap scoring ──
  const bullTrap =
  (takerWarn ? 25 : 0) + (
  cvdWarn ? 20 : 0) + (
  volWarn ? 20 : 0) + (
  sweep === 'HIGH' ? 20 : 0) + (
  rsiDiv ? 15 : 0);
  const bearTrap =
  (cp < lastLow && instRatio > 0.55 ? 25 : 0) + (
  cvd > 0 && !priceUp ? 20 : 0) + (
  sweep === 'LOW' ? 25 : 0) + (
  corr > 0.5 && !priceUp ? 15 : 0);
  const warnCount = hiddenIndicators.filter((h) => h.isWarning).length;

  let trapType: 'BULL_TRAP' | 'BEAR_TRAP' | 'NO_TRAP' = 'NO_TRAP';
  let trapConf = 0;
  let trapReason = 'No manipulation pattern detected.';
  if (bullTrap >= 45 && bullTrap >= bearTrap) {
    trapType = 'BULL_TRAP';
    trapConf = Math.min(100, bullTrap + (volRatio > 3 ? 10 : 0));
    trapReason = `Bull trap risk: price pushed up but ${warnCount} hidden signals show weak/fake demand. Smart money likely distributing.`;
  } else if (bearTrap >= 45 && bearTrap > bullTrap) {
    trapType = 'BEAR_TRAP';
    trapConf = Math.min(100, bearTrap + (volRatio > 3 ? 10 : 0));
    trapReason = `Bear trap risk: price pushed down but hidden signals show accumulation. Smart money likely buying.`;
  }

  // ── Fuse: downgrade direction if trap contradicts it ──
  let finalDir = direction;
  let fuseNote = '';
  if (trapType === 'BULL_TRAP' && direction === 'BUY') {
    finalDir = 'NEUTRAL';
    fuseNote = ' BUY downgraded — Bull Trap detected, wait for confirmation.';
  } else if (trapType === 'BEAR_TRAP' && direction === 'SELL') {
    finalDir = 'NEUTRAL';
    fuseNote = ' SELL downgraded — Bear Trap detected, wait for confirmation.';
  } else if (trapType === 'BEAR_TRAP' && direction === 'NEUTRAL') {
    finalDir = 'BUY';
    fuseNote = ' Bear Trap implies upside reversal — bias shifted BUY.';
  } else if (trapType === 'BULL_TRAP' && direction === 'NEUTRAL') {
    finalDir = 'SELL';
    fuseNote = ' Bull Trap implies downside reversal — bias shifted SELL.';
  }

  const confidence =
  finalDir === 'NEUTRAL' ?
  Math.max(trapConf, Math.abs(score - 50)) :
  Math.abs(score - 50) * 2;

  // ── Entry / SL / multi-TP ──
  const isBuy = finalDir === 'BUY';
  const isSell = finalDir === 'SELL';
  const entry = cp;
  const sl = isBuy ?
  entry - atr * 1.2 :
  isSell ?
  entry + atr * 1.2 :
  entry - atr * 1.2;
  const tp = isBuy ?
  entry + atr * 2.4 :
  isSell ?
  entry - atr * 2.4 :
  entry + atr * 2.4;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rr = risk > 0 ? Math.round(reward / risk * 10) / 10 : 0;

  const tpLevels: TpLevels | null = isBuy ?
  {
    tp1: entry + atr * 0.6,
    tp2: entry + atr * 1.2,
    tp3: entry + atr * 1.8,
    tp4: entry + atr * 2.4,
    tp5: entry + atr * 3.6,
    tp6: entry + atr * 4.8
  } :
  isSell ?
  {
    tp1: entry - atr * 0.6,
    tp2: entry - atr * 1.2,
    tp3: entry - atr * 1.8,
    tp4: entry - atr * 2.4,
    tp5: entry - atr * 3.6,
    tp6: entry - atr * 4.8
  } :
  null;

  const activeCount = subSignals.filter((s) => s.status !== 'neutral').length;
  const reason =
  `${finalDir} · score ${score}/100 from ${activeCount}/7 active sub-systems` + (
  trapType !== 'NO_TRAP' ?
  ` · ${trapType.replace('_', ' ')} ${trapConf}%` :
  '') +
  fuseNote;

  const entryStatus =
  finalDir === 'NEUTRAL' ?
  'HOLD — No clean entry' :
  confidence >= 60 ?
  'ACTIVE — Enter now' :
  'WAIT — Confirm on 1m/5m';

  // ── Candlestick patterns (last 1–3 candles) ──
  const candlePatterns = detectCandlePatterns(candles);

  // ── Next-candle predictor ──
  const lastPatternBias = candlePatterns.reduce(
    (acc, p) =>
    acc + (p.type === 'bullish' ? 1 : p.type === 'bearish' ? -1 : 0),
    0
  );
  let predScore = 0;
  if (above) predScore += 2;else
  if (below) predScore -= 2;
  if (ema9 > ema21) predScore += 1;else
  if (ema9 < ema21) predScore -= 1;
  if (rsi > 55) predScore += 1;else
  if (rsi < 45) predScore -= 1;
  if (macd.hist > 0) predScore += 1;else
  if (macd.hist < 0) predScore -= 1;
  if (imbalance > 5) predScore += 1;else
  if (imbalance < -5) predScore -= 1;
  if (cvd > 0) predScore += 1;else
  if (cvd < 0) predScore -= 1;
  predScore += lastPatternBias;
  const predMax = 8;
  const next: CandlePrediction['next'] =
  predScore >= 2 ? 'BULLISH' : predScore <= -2 ? 'BEARISH' : 'NEUTRAL';
  const probability = Math.min(
    95,
    Math.max(50, Math.round(50 + Math.abs(predScore) / predMax * 45))
  );
  const predBits: string[] = [];
  if (above) predBits.push('EMAs stacked up');else
  if (below) predBits.push('EMAs stacked down');
  if (macd.hist > 0) predBits.push('MACD+');else
  if (macd.hist < 0) predBits.push('MACD−');
  if (cvd > 0) predBits.push('CVD buying');else
  if (cvd < 0) predBits.push('CVD selling');
  if (candlePatterns[0]) predBits.push(candlePatterns[0].name);
  const prediction: CandlePrediction = {
    next,
    probability,
    detail:
    (predBits.slice(0, 3).join(' · ') || 'Mixed signals') +
    ` → next candle likely ${next === 'BULLISH' ? 'green' : next === 'BEARISH' ? 'red' : 'indecisive'}`
  };

  // ── Real market move vs institutional (smart-money) direction ──
  const marketDir: Direction = priceUp ?
  'BUY' :
  cp < closes[Math.max(0, closes.length - 20)] ?
  'SELL' :
  'NEUTRAL';
  let instScore = 0;
  if (instRatio > 0.55) instScore += 1;else
  if (instRatio < 0.45) instScore -= 1;
  if (cvd > 0) instScore += 1;else
  if (cvd < 0) instScore -= 1;
  if (sweep === 'HIGH')
  instScore -= 1; // highs swept ⇒ distribution
  else if (sweep === 'LOW') instScore += 1; // lows swept ⇒ accumulation
  const institutionalDir: Direction =
  instScore >= 1 ? 'BUY' : instScore <= -1 ? 'SELL' : 'NEUTRAL';
  const aligned = marketDir === institutionalDir;
  let realNote: string;
  if (marketDir === 'BUY' && institutionalDir === 'SELL') {
    realNote =
    'Price pushing UP but institutions distributing (CVD down / weak taker / highs swept) — real direction SELL · likely BULL TRAP.';
  } else if (marketDir === 'SELL' && institutionalDir === 'BUY') {
    realNote =
    'Price dropping but institutions accumulating (CVD up / lows swept) — real direction BUY · likely BEAR TRAP.';
  } else if (aligned && institutionalDir !== 'NEUTRAL') {
    realNote = `Price and smart money agree — genuine ${institutionalDir} move, no hidden divergence.`;
  } else {
    realNote = 'No clear institutional commitment — wait for confirmation.';
  }
  const realDirection: RealDirection = {
    market: marketDir,
    institutional: institutionalDir,
    aligned,
    note: realNote
  };

  // ── Perfect entry candle ──
  const lastC = candles[candles.length - 1];
  const bodyOk = lastC ? Math.abs(lastC.close - lastC.open) > atr * 0.4 : false;
  const volOk = lastVol > avgVol;
  const confirmingPattern = candlePatterns.find((p) =>
  finalDir === 'BUY' ?
  p.type === 'bullish' :
  finalDir === 'SELL' ?
  p.type === 'bearish' :
  false
  );
  const isPerfect =
  finalDir !== 'NEUTRAL' &&
  finalDir === institutionalDir &&
  !!confirmingPattern &&
  bodyOk &&
  volOk &&
  confidence >= 55;
  const perfectCandle: PerfectCandle = {
    isPerfect,
    side: finalDir,
    detail: isPerfect ?
    `Perfect ${finalDir} candle — ${confirmingPattern!.name}, strong body, volume confirmation, aligned with smart money.` :
    finalDir === 'NEUTRAL' ?
    'No directional bias — waiting for a clean setup.' :
    `Waiting for perfect ${finalDir} candle (need confirming pattern + body + volume + institutional alignment).`
  };

  return {
    symbolId: asset.id,
    name: asset.name,
    type: asset.type,
    price: cp,
    source: priceData.source,
    direction: finalDir,
    confidence: Math.min(100, Math.round(confidence)),
    score,
    entry,
    sl,
    tp,
    rr,
    tpLevels,
    reason,
    entryStatus,
    rsi: Math.round(rsi * 10) / 10,
    ema9,
    ema21,
    ema50,
    atr,
    macdHist: macd.hist,
    instRatio: Math.round(instRatio * 100),
    subSignals,
    trap: {
      type: trapType,
      confidence: Math.round(trapConf),
      reason: trapReason
    },
    hiddenIndicators,
    candlePatterns,
    prediction,
    realDirection,
    perfectCandle,
    ts: Date.now()
  };
}

// ─── Candlestick pattern detection ────────────────────────
function detectCandlePatterns(candles: TCandle[]): CandlePattern[] {
  const out: CandlePattern[] = [];
  if (!candles || candles.length < 3) return out;
  const c1 = candles[candles.length - 1]; // current
  const c2 = candles[candles.length - 2]; // previous
  const c3 = candles[candles.length - 3];

  const body = (c: TCandle) => Math.abs(c.close - c.open);
  const range = (c: TCandle) => c.high - c.low || 1e-9;
  const upperWick = (c: TCandle) => c.high - Math.max(c.open, c.close);
  const lowerWick = (c: TCandle) => Math.min(c.open, c.close) - c.low;
  const isBull = (c: TCandle) => c.close > c.open;
  const isBear = (c: TCandle) => c.close < c.open;

  const b1 = body(c1);
  const r1 = range(c1);
  const up1 = upperWick(c1);
  const lo1 = lowerWick(c1);

  if (b1 <= r1 * 0.1) {
    if (lo1 > r1 * 0.6)
    out.push({
      name: 'Dragonfly Doji',
      type: 'bullish',
      strength: 65,
      detail: 'Long lower wick — buyers rejected lows.'
    });else
    if (up1 > r1 * 0.6)
    out.push({
      name: 'Gravestone Doji',
      type: 'bearish',
      strength: 65,
      detail: 'Long upper wick — sellers rejected highs.'
    });else

    out.push({
      name: 'Doji',
      type: 'neutral',
      strength: 40,
      detail: 'Indecision — equal open/close.'
    });
  }

  if (b1 <= r1 * 0.35 && lo1 >= b1 * 2 && up1 <= b1) {
    out.push({
      name: isBull(c1) ? 'Hammer' : 'Hanging Man',
      type: isBull(c1) ? 'bullish' : 'bearish',
      strength: 70,
      detail: 'Long lower wick rejection of lows.'
    });
  }

  if (b1 <= r1 * 0.35 && up1 >= b1 * 2 && lo1 <= b1) {
    out.push({
      name: isBear(c1) ? 'Shooting Star' : 'Inverted Hammer',
      type: isBear(c1) ? 'bearish' : 'bullish',
      strength: 70,
      detail: 'Long upper wick rejection of highs.'
    });
  }

  if (b1 >= r1 * 0.9) {
    out.push({
      name: isBull(c1) ? 'Bullish Marubozu' : 'Bearish Marubozu',
      type: isBull(c1) ? 'bullish' : 'bearish',
      strength: 75,
      detail: 'Full-body candle — strong conviction.'
    });
  }

  if (isBull(c1) && isBear(c2) && c1.close >= c2.open && c1.open <= c2.close) {
    out.push({
      name: 'Bullish Engulfing',
      type: 'bullish',
      strength: 85,
      detail: 'Current green body engulfs prior red.'
    });
  } else if (
  isBear(c1) &&
  isBull(c2) &&
  c1.open >= c2.close &&
  c1.close <= c2.open)
  {
    out.push({
      name: 'Bearish Engulfing',
      type: 'bearish',
      strength: 85,
      detail: 'Current red body engulfs prior green.'
    });
  }

  if (
  isBear(c3) &&
  body(c2) <= range(c2) * 0.4 &&
  isBull(c1) &&
  c1.close > (c3.open + c3.close) / 2)
  {
    out.push({
      name: 'Morning Star',
      type: 'bullish',
      strength: 80,
      detail: 'Bearish → indecision → bullish reversal.'
    });
  } else if (
  isBull(c3) &&
  body(c2) <= range(c2) * 0.4 &&
  isBear(c1) &&
  c1.close < (c3.open + c3.close) / 2)
  {
    out.push({
      name: 'Evening Star',
      type: 'bearish',
      strength: 80,
      detail: 'Bullish → indecision → bearish reversal.'
    });
  }

  if (
  isBull(c1) &&
  isBull(c2) &&
  isBull(c3) &&
  c1.close > c2.close &&
  c2.close > c3.close)
  {
    out.push({
      name: 'Three White Soldiers',
      type: 'bullish',
      strength: 78,
      detail: 'Three rising green candles.'
    });
  } else if (
  isBear(c1) &&
  isBear(c2) &&
  isBear(c3) &&
  c1.close < c2.close &&
  c2.close < c3.close)
  {
    out.push({
      name: 'Three Black Crows',
      type: 'bearish',
      strength: 78,
      detail: 'Three falling red candles.'
    });
  }

  if ((up1 > b1 * 2.5 || lo1 > b1 * 2.5) && b1 <= r1 * 0.4) {
    const bullPin = lo1 > up1;
    out.push({
      name: bullPin ? 'Bullish Pin Bar' : 'Bearish Pin Bar',
      type: bullPin ? 'bullish' : 'bearish',
      strength: 68,
      detail: bullPin ? 'Rejection from below.' : 'Rejection from above.'
    });
  }

  const seen = new Set<string>();
  return out.
  filter((p) => seen.has(p.name) ? false : (seen.add(p.name), true)).
  slice(0, 4);
}