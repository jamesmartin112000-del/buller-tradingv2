// ============================================================
// ALL-STRATEGIES-COMBINED Signal Engine — runs 22 strategies
// (core technical, patterns, hidden, secret, smart money, ML)
// on REAL Binance candle data. Weighted scoring → optimal
// entry, ATR+S/R based SL/TP, RR≥1.5 filter. Zero API keys.
// ============================================================
import { binanceWS, type BinanceCandle } from './binanceWebSocket';

export interface TradeSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2: number;
  confidence: number;
  strategyCount: number;
  totalStrategies: number;
  strategiesUsed: string[];
  confirmationSignals: string[];
  timestamp: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  riskReward: number;
}

export interface NoSignalResult {
  reason: string;
  buyScore: number;
  sellScore: number;
  checked: number;
}

interface StratResult {
  name: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  confidence: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  reason: string;
}

// — strategy weights (hidden/secret highest, as specified) —
const WEIGHTS: Record<string, number> = {
  'Technical Indicators': 1.0,
  'Support & Resistance': 1.2,
  'Trend Analysis': 1.3,
  Momentum: 0.9,
  'Volume Analysis': 1.1,
  'Pattern Recognition': 1.4,
  'Harmonic Levels': 1.5,
  Fibonacci: 1.2,
  Divergence: 1.6,
  'Hidden Alpha · Microstructure': 1.8,
  'Hidden Beta · Liquidity Sweep': 1.7,
  'Hidden Gamma · Cross-TF Deviation': 1.9,
  'Secret Delta · Pattern Memory': 2.0,
  'Secret Epsilon · Whale Flow': 1.9,
  'Smart Money Concept': 1.6,
  'Market Maker Flow': 1.7,
  'Order Flow': 1.5,
  'Sentiment Proxy': 1.1,
  'Time-Based (Session)': 1.0,
  'Volatility Regime': 1.2,
  'MACD Cross': 1.0,
  'Ichimoku Cloud': 1.3
};
export const TOTAL_STRATEGIES = Object.keys(WEIGHTS).length;

// ─── indicator helpers (pure, on real candles) ───
function sma(v: number[], p: number): number {
  if (v.length < p) return v[v.length - 1] ?? 0;
  return v.slice(-p).reduce((a, b) => a + b, 0) / p;
}
function ema(v: number[], p: number): number {
  if (v.length < p) return sma(v, p);
  const k = 2 / (p + 1);
  let e = sma(v.slice(0, p), p);
  for (let i = p; i < v.length; i++) e = (v[i] - e) * k + e;
  return e;
}
function rsiSeries(closes: number[], p = 14): number[] {
  const out: number[] = [];
  if (closes.length < p + 1) return out;
  let g = 0,
    l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d;else
    l -= d;
  }
  let ag = g / p,
    al = l / p;
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}
function atr(c: BinanceCandle[], p = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    trs.push(
      Math.max(
        c[i].high - c[i].low,
        Math.abs(c[i].high - c[i - 1].close),
        Math.abs(c[i].low - c[i - 1].close)
      )
    );
  }
  return ema(trs, p);
}
function srLevels(c: BinanceCandle[]): {sup: number[];res: number[];} {
  const sup: number[] = [];
  const res: number[] = [];
  for (let i = 5; i < c.length - 5; i++) {
    const w = c.slice(i - 5, i + 6);
    if (c[i].low === Math.min(...w.map((x) => x.low))) sup.push(c[i].low);
    if (c[i].high === Math.max(...w.map((x) => x.high))) res.push(c[i].high);
  }
  return { sup: sup.slice(-12), res: res.slice(-12) };
}
function imbalance(c: BinanceCandle[], n = 20): number {
  const r = c.slice(-n);
  const up = r.filter((d) => d.close > d.open).reduce((s, d) => s + d.volume, 0);
  const dn = r.filter((d) => d.close < d.open).reduce((s, d) => s + d.volume, 0);
  const t = up + dn;
  return t === 0 ? 0 : (up - dn) / t;
}

// ─── the engine ───
export async function analyzeSignal(
symbol: string,
interval: string)
: Promise<{signal: TradeSignal | null;meta: NoSignalResult;}> {
  const candles = await binanceWS.getLatestData(symbol, interval);
  const meta: NoSignalResult = {
    reason: '',
    buyScore: 0,
    sellScore: 0,
    checked: TOTAL_STRATEGIES
  };
  if (!candles || candles.length < 100) {
    meta.reason = 'Not enough real market data yet — retrying';
    return { signal: null, meta };
  }
  const cp = candles[candles.length - 1].close;
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const a = atr(candles) || cp * 0.003;
  const { sup, res } = srLevels(candles);
  const rsiArr = rsiSeries(closes);
  const rsi = rsiArr[rsiArr.length - 1] ?? 50;
  const imb = imbalance(candles);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);

  const active: StratResult[] = [];
  const add = (
  name: string,
  signal: 'BUY' | 'SELL',
  conf: number,
  strength: StratResult['strength'],
  reason: string,
  entry = cp) =>

  active.push({
    name,
    signal,
    entryPrice: entry,
    confidence: conf,
    strength,
    reason
  });

  // 1. Technical Indicators (RSI)
  if (rsi < 32)
  add(
    'Technical Indicators',
    'BUY',
    70,
    'STRONG',
    `RSI oversold (${rsi.toFixed(0)})`
  );else
  if (rsi > 68)
  add(
    'Technical Indicators',
    'SELL',
    70,
    'STRONG',
    `RSI overbought (${rsi.toFixed(0)})`
  );

  // 2. Support & Resistance proximity
  const nearSup = sup.filter((s) => s < cp).sort((x, y) => y - x)[0];
  const nearRes = res.filter((r) => r > cp).sort((x, y) => x - y)[0];
  if (nearSup && (cp - nearSup) / cp < 0.004)
  add(
    'Support & Resistance',
    'BUY',
    65,
    'MODERATE',
    `Price at support ${nearSup.toFixed(2)}`,
    nearSup
  );
  if (nearRes && (nearRes - cp) / cp < 0.004)
  add(
    'Support & Resistance',
    'SELL',
    65,
    'MODERATE',
    `Price at resistance ${nearRes.toFixed(2)}`,
    nearRes
  );

  // 3. Trend Analysis (EMA stack)
  if (e20 > e50 && e50 > e200)
  add('Trend Analysis', 'BUY', 72, 'STRONG', 'EMA 20>50>200 bullish stack');else
  if (e20 < e50 && e50 < e200)
  add('Trend Analysis', 'SELL', 72, 'STRONG', 'EMA 20<50<200 bearish stack');

  // 4. Momentum (ROC)
  const roc =
  (cp - closes[closes.length - 11]) / closes[closes.length - 11] * 100;
  if (roc > 1.2)
  add('Momentum', 'BUY', 55, 'MODERATE', `ROC +${roc.toFixed(2)}%`);else
  if (roc < -1.2)
  add('Momentum', 'SELL', 55, 'MODERATE', `ROC ${roc.toFixed(2)}%`);

  // 5. Volume Analysis (spike + direction)
  const avgVol = sma(vols, 20);
  const lastVol = vols[vols.length - 1];
  if (lastVol > avgVol * 1.8) {
    const dir =
    candles[candles.length - 1].close > candles[candles.length - 1].open ?
    'BUY' :
    'SELL';
    add(
      'Volume Analysis',
      dir,
      60,
      'MODERATE',
      `Volume spike ${(lastVol / avgVol).toFixed(1)}x avg`
    );
  }

  // 6. Pattern Recognition (engulfing / hammer / shooting star)
  const c1 = candles[candles.length - 2];
  const c0 = candles[candles.length - 1];
  const bullEngulf =
  c0.close > c0.open &&
  c1.close < c1.open &&
  c0.close > c1.open &&
  c0.open < c1.close;
  const bearEngulf =
  c0.close < c0.open &&
  c1.close > c1.open &&
  c0.close < c1.open &&
  c0.open > c1.close;
  const body = Math.abs(c0.close - c0.open);
  const hammer =
  c0.close > c0.open &&
  c0.open - c0.low > body * 2 &&
  c0.high - c0.close < body * 0.5;
  const star =
  c0.close < c0.open &&
  c0.high - c0.open > body * 2 &&
  c0.close - c0.low < body * 0.5;
  if (bullEngulf || hammer)
  add(
    'Pattern Recognition',
    'BUY',
    68,
    'STRONG',
    bullEngulf ? 'Bullish engulfing' : 'Hammer reversal'
  );
  if (bearEngulf || star)
  add(
    'Pattern Recognition',
    'SELL',
    68,
    'STRONG',
    bearEngulf ? 'Bearish engulfing' : 'Shooting star'
  );

  // 7. Harmonic Levels (extension ratios of last swing)
  const swingHi = Math.max(...candles.slice(-60).map((c) => c.high));
  const swingLo = Math.min(...candles.slice(-60).map((c) => c.low));
  const range = swingHi - swingLo;
  const pos = range > 0 ? (cp - swingLo) / range : 0.5;
  if (pos < 0.115 + 0.05)
  add(
    'Harmonic Levels',
    'BUY',
    62,
    'MODERATE',
    'Price at harmonic 0.886 retracement zone'
  );else
  if (pos > 0.886 - 0.05 && pos < 0.95)
  add(
    'Harmonic Levels',
    'SELL',
    62,
    'MODERATE',
    'Price at harmonic extension zone'
  );

  // 8. Fibonacci (0.618 retrace)
  const fib618 = swingHi - range * 0.618;
  const fib382 = swingHi - range * 0.382;
  if (Math.abs(cp - fib618) / cp < 0.004)
  add('Fibonacci', 'BUY', 60, 'MODERATE', 'At 0.618 golden pocket', fib618);else
  if (Math.abs(cp - fib382) / cp < 0.004 && e20 < e50)
  add(
    'Fibonacci',
    'SELL',
    58,
    'MODERATE',
    '0.382 retrace in downtrend',
    fib382
  );

  // 9. Divergence (price vs RSI, regular)
  if (rsiArr.length > 30) {
    const pl1 = Math.min(...closes.slice(-30, -15)),
      pl2 = Math.min(...closes.slice(-15));
    const rl1 = Math.min(...rsiArr.slice(-30, -15)),
      rl2 = Math.min(...rsiArr.slice(-15));
    const ph1 = Math.max(...closes.slice(-30, -15)),
      ph2 = Math.max(...closes.slice(-15));
    const rh1 = Math.max(...rsiArr.slice(-30, -15)),
      rh2 = Math.max(...rsiArr.slice(-15));
    if (pl2 < pl1 && rl2 > rl1)
    add(
      'Divergence',
      'BUY',
      75,
      'STRONG',
      'Bullish RSI divergence (lower low / higher RSI low)'
    );
    if (ph2 > ph1 && rh2 < rh1)
    add(
      'Divergence',
      'SELL',
      75,
      'STRONG',
      'Bearish RSI divergence (higher high / lower RSI high)'
    );
  }

  // 10. HIDDEN ALPHA — market microstructure (vol imbalance + tick direction + hidden divergence)
  let ticksUp = 0,
    ticksDn = 0;
  for (let i = candles.length - 50; i < candles.length; i++) {
    if (i <= 0) continue;
    if (candles[i].close > candles[i - 1].close) ticksUp++;else
    if (candles[i].close < candles[i - 1].close) ticksDn++;
  }
  const tickDir = (ticksUp - ticksDn) / 50;
  if (imb > 0.35 && tickDir > 0.1)
  add(
    'Hidden Alpha · Microstructure',
    'BUY',
    85,
    'STRONG',
    `Hidden buy pressure: imbalance ${(imb * 100).toFixed(0)}%, tick dir +${(tickDir * 100).toFixed(0)}%`,
    cp * 1.0005
  );else
  if (imb < -0.35 && tickDir < -0.1)
  add(
    'Hidden Alpha · Microstructure',
    'SELL',
    85,
    'STRONG',
    `Hidden sell pressure: imbalance ${(imb * 100).toFixed(0)}%, tick dir ${(tickDir * 100).toFixed(0)}%`,
    cp * 0.9995
  );

  // 11. HIDDEN BETA — liquidity sweep + reversal
  const prevLo = Math.min(...candles.slice(-22, -2).map((c) => c.low));
  const prevHi = Math.max(...candles.slice(-22, -2).map((c) => c.high));
  const sweptLow = c1.low < prevLo && c0.close > prevLo && c0.close > c0.open;
  const sweptHigh = c1.high > prevHi && c0.close < prevHi && c0.close < c0.open;
  if (sweptLow)
  add(
    'Hidden Beta · Liquidity Sweep',
    'BUY',
    78,
    'STRONG',
    `Liquidity sweep below ${prevLo.toFixed(2)} + bullish reversal`,
    Math.max(cp, prevLo * 1.002)
  );
  if (sweptHigh)
  add(
    'Hidden Beta · Liquidity Sweep',
    'SELL',
    78,
    'STRONG',
    `Liquidity sweep above ${prevHi.toFixed(2)} + bearish reversal`,
    Math.min(cp, prevHi * 0.998)
  );

  // 12. HIDDEN GAMMA — cross-timeframe mean deviation
  const dev = (cp - e50) / e50 * 100;
  if (dev < -2.2)
  add(
    'Hidden Gamma · Cross-TF Deviation',
    'BUY',
    72,
    'MODERATE',
    `Price ${dev.toFixed(2)}% below EMA50 — mean reversion long`
  );else
  if (dev > 2.2)
  add(
    'Hidden Gamma · Cross-TF Deviation',
    'SELL',
    72,
    'MODERATE',
    `Price +${dev.toFixed(2)}% above EMA50 — mean reversion short`
  );

  // 13. SECRET DELTA — historical pattern memory (last-30 shape vs prior windows)
  if (closes.length > 220) {
    const recent = closes.slice(-30);
    const rNorm = recent.map((v) => (v - recent[0]) / recent[0]);
    let best = -1,
      bestNext = 0;
    for (let s = 0; s < closes.length - 70; s += 5) {
      const w = closes.slice(s, s + 30);
      const wNorm = w.map((v) => (v - w[0]) / w[0]);
      let dist = 0;
      for (let i = 0; i < 30; i++) dist += Math.abs(rNorm[i] - wNorm[i]);
      const simil = 1 - Math.min(dist / 0.5, 1);
      if (simil > best) {
        best = simil;
        bestNext = (closes[s + 40] - closes[s + 29]) / closes[s + 29];
      }
    }
    if (best > 0.72 && Math.abs(bestNext) > 0.004) {
      add(
        'Secret Delta · Pattern Memory',
        bestNext > 0 ? 'BUY' : 'SELL',
        Math.round(60 + best * 30),
        best > 0.85 ? 'STRONG' : 'MODERATE',
        `Historical pattern match ${(best * 100).toFixed(0)}% → next move ${(bestNext * 100).toFixed(2)}%`
      );
    }
  }

  // 14. SECRET EPSILON — whale flow proxy (large-volume candle net flow)
  const bigCandles = candles.slice(-40).filter((c) => c.volume > avgVol * 2);
  if (bigCandles.length >= 3) {
    const net = bigCandles.reduce(
      (s, c) => s + (c.close > c.open ? c.volume : -c.volume),
      0
    );
    const tot = bigCandles.reduce((s, c) => s + c.volume, 0);
    const flow = net / tot;
    if (Math.abs(flow) > 0.4)
    add(
      'Secret Epsilon · Whale Flow',
      flow > 0 ? 'BUY' : 'SELL',
      Math.round(55 + Math.abs(flow) * 40),
      Math.abs(flow) > 0.7 ? 'STRONG' : 'MODERATE',
      `Whale ${flow > 0 ? 'accumulation' : 'distribution'}: ${bigCandles.length} large prints, net ${(flow * 100).toFixed(0)}%`
    );
  }

  // 15. Smart Money Concept — premium/discount zone
  const eq = (swingHi + swingLo) / 2;
  if (cp < eq - range * 0.15)
  add(
    'Smart Money Concept',
    'BUY',
    64,
    'MODERATE',
    'Price in DISCOUNT zone (SMC buy area)'
  );else
  if (cp > eq + range * 0.15)
  add(
    'Smart Money Concept',
    'SELL',
    64,
    'MODERATE',
    'Price in PREMIUM zone (SMC sell area)'
  );

  // 16. Market Maker Flow — wick rejection ratio
  const wicks = candles.slice(-10);
  const lowerW = wicks.reduce(
    (s, c) => s + (Math.min(c.open, c.close) - c.low),
    0
  );
  const upperW = wicks.reduce(
    (s, c) => s + (c.high - Math.max(c.open, c.close)),
    0
  );
  if (lowerW > upperW * 1.8)
  add(
    'Market Maker Flow',
    'BUY',
    66,
    'MODERATE',
    'Heavy lower-wick absorption (MM buying)'
  );else
  if (upperW > lowerW * 1.8)
  add(
    'Market Maker Flow',
    'SELL',
    66,
    'MODERATE',
    'Heavy upper-wick rejection (MM selling)'
  );

  // 17. Order Flow — delta imbalance
  if (imb > 0.25)
  add(
    'Order Flow',
    'BUY',
    60,
    imb > 0.45 ? 'STRONG' : 'MODERATE',
    `Buy-side delta ${(imb * 100).toFixed(0)}%`
  );else
  if (imb < -0.25)
  add(
    'Order Flow',
    'SELL',
    60,
    imb < -0.45 ? 'STRONG' : 'MODERATE',
    `Sell-side delta ${(imb * 100).toFixed(0)}%`
  );

  // 18. Sentiment Proxy — consecutive candle streak (contrarian at extremes)
  let streak = 0;
  for (let i = candles.length - 1; i > candles.length - 9; i--) {
    if (candles[i].close > candles[i].open) streak++;else
    break;
  }
  let dnStreak = 0;
  for (let i = candles.length - 1; i > candles.length - 9; i--) {
    if (candles[i].close < candles[i].open) dnStreak++;else
    break;
  }
  if (dnStreak >= 5)
  add(
    'Sentiment Proxy',
    'BUY',
    55,
    'WEAK',
    `${dnStreak} consecutive red candles — capitulation`
  );else
  if (streak >= 5)
  add(
    'Sentiment Proxy',
    'SELL',
    55,
    'WEAK',
    `${streak} consecutive green candles — euphoria`
  );

  // 19. Time-Based (session momentum, UTC)
  const hr = new Date().getUTCHours();
  const lonNy = hr >= 12 && hr <= 16;
  if (lonNy && Math.abs(roc) > 0.6)
  add(
    'Time-Based (Session)',
    roc > 0 ? 'BUY' : 'SELL',
    56,
    'WEAK',
    'London/NY overlap momentum continuation'
  );

  // 20. Volatility Regime — Bollinger squeeze breakout
  const mid = sma(closes, 20);
  const sd = Math.sqrt(
    closes.slice(-20).reduce((s, v) => s + (v - mid) ** 2, 0) / 20
  );
  const bw = sd * 4 / mid;
  const prevCloses = closes.slice(0, -1);
  const prevMid = sma(prevCloses, 20);
  const prevSd = Math.sqrt(
    prevCloses.slice(-20).reduce((s, v) => s + (v - prevMid) ** 2, 0) / 20
  );
  if (bw < 0.02 && prevSd > 0) {
    if (cp > mid + sd)
    add(
      'Volatility Regime',
      'BUY',
      63,
      'MODERATE',
      'Squeeze breakout above upper band'
    );else
    if (cp < mid - sd)
    add(
      'Volatility Regime',
      'SELL',
      63,
      'MODERATE',
      'Squeeze breakdown below lower band'
    );
  }

  // 21. MACD cross
  const macdNow = ema(closes, 12) - ema(closes, 26);
  const macdPrev = ema(prevCloses, 12) - ema(prevCloses, 26);
  if (macdPrev <= 0 && macdNow > 0)
  add('MACD Cross', 'BUY', 62, 'MODERATE', 'MACD bullish zero-line cross');else
  if (macdPrev >= 0 && macdNow < 0)
  add('MACD Cross', 'SELL', 62, 'MODERATE', 'MACD bearish zero-line cross');

  // 22. Ichimoku — price vs cloud
  const tenkan =
  (Math.max(...candles.slice(-9).map((c) => c.high)) +
  Math.min(...candles.slice(-9).map((c) => c.low))) /
  2;
  const kijun =
  (Math.max(...candles.slice(-26).map((c) => c.high)) +
  Math.min(...candles.slice(-26).map((c) => c.low))) /
  2;
  const spanA = (tenkan + kijun) / 2;
  const spanB =
  (Math.max(...candles.slice(-52).map((c) => c.high)) +
  Math.min(...candles.slice(-52).map((c) => c.low))) /
  2;
  if (cp > Math.max(spanA, spanB) && tenkan > kijun)
  add(
    'Ichimoku Cloud',
    'BUY',
    64,
    'MODERATE',
    'Price above bullish cloud, TK cross up'
  );else
  if (cp < Math.min(spanA, spanB) && tenkan < kijun)
  add(
    'Ichimoku Cloud',
    'SELL',
    64,
    'MODERATE',
    'Price below bearish cloud, TK cross down'
  );

  // ─── weighted scoring ───
  const score = (list: StratResult[]) =>
  list.reduce((t, s) => {
    const w = WEIGHTS[s.name] || 1;
    const strengthF =
    s.strength === 'STRONG' ? 1.5 : s.strength === 'MODERATE' ? 1 : 0.5;
    return t + w * (s.confidence / 100) * strengthF;
  }, 0);
  const buys = active.filter((s) => s.signal === 'BUY');
  const sells = active.filter((s) => s.signal === 'SELL');
  const buyScore = score(buys);
  const sellScore = score(sells);
  meta.buyScore = Math.round(buyScore * 10) / 10;
  meta.sellScore = Math.round(sellScore * 10) / 10;

  let direction: 'BUY' | 'SELL' | null = null;
  if (buyScore > sellScore && buyScore > 3.2) direction = 'BUY';else
  if (sellScore > buyScore && sellScore > 3.2) direction = 'SELL';
  const winners = direction === 'BUY' ? buys : sells;
  const confidence = direction ?
  Math.min(
    Math.round((direction === 'BUY' ? buyScore : sellScore) / 14 * 100),
    100
  ) :
  0;
  if (!direction || confidence < 30) {
    meta.reason = `No consensus — BUY ${meta.buyScore} vs SELL ${meta.sellScore}. Waiting for strategies to align.`;
    return { signal: null, meta };
  }

  // ─── optimal entry: confidence-weighted average + S/R snap ───
  let wSum = 0,
    wTot = 0;
  winners.forEach((s) => {
    wSum += s.entryPrice * (s.confidence / 100);
    wTot += s.confidence / 100;
  });
  let entry = wTot > 0 ? wSum / wTot : cp;
  if (direction === 'BUY' && imb > 0.3) entry *= 1.001;
  if (direction === 'SELL' && imb < -0.3) entry *= 0.999;
  if (direction === 'BUY' && nearSup && (entry - nearSup) / entry < 0.005)
  entry = nearSup;
  if (direction === 'SELL' && nearRes && (nearRes - entry) / entry < 0.005)
  entry = nearRes;

  // ─── ANCHOR ENTRY TO THE LIVE MARKET PRICE ───
  // A "perfect entry" must be actionable at — or microscopically away from —
  // the real current price. Weighted S/R + fib levels above can otherwise pull
  // the entry several % away (the "buy from way up / sell from way down" bug).
  // Clamp the entry to a tight band around the live close so SL/TP are always
  // built off a realistic, tradeable price for every asset.
  const maxDrift = cp * 0.0025; // 0.25%
  entry = Math.max(cp - maxDrift, Math.min(cp + maxDrift, entry));
  // Never sit on the wrong side of price for the direction: a BUY entry above
  // live price (or a SELL entry below it) is unrealistic chasing — snap to live.
  if (direction === 'BUY' && entry > cp) entry = cp;
  if (direction === 'SELL' && entry < cp) entry = cp;

  // ─── risk management: ATR + S/R stop, TP 2x/3x, snap to next level ───
  // Tight "hidden candle" stop: hug the nearest defended structure level
  // (the smart-money sweep / S&R that big players protected) with a small
  // ATR buffer, instead of a wide volatility stop. Smaller risk → higher RR.
  const atrStop = direction === 'BUY' ? entry - a * 1.0 : entry + a * 1.0;
  const srStop =
  direction === 'BUY' ?
  sup.filter((s) => s < entry).sort((x, y) => y - x)[0] :
  res.filter((r) => r > entry).sort((x, y) => x - y)[0];
  let sl =
  direction === 'BUY' ?
  Math.max(atrStop, srStop != null ? srStop - a * 0.18 : atrStop) :
  Math.min(atrStop, srStop != null ? srStop + a * 0.18 : atrStop);
  if (direction === 'BUY' && sl >= entry) sl = atrStop;
  if (direction === 'SELL' && sl <= entry) sl = atrStop;
  const risk = Math.abs(entry - sl);
  let tp = direction === 'BUY' ? entry + risk * 2 : entry - risk * 2;
  let tp2 = direction === 'BUY' ? entry + risk * 3 : entry - risk * 3;
  if (direction === 'BUY') {
    const nr = res.filter((r) => r > entry).sort((x, y) => x - y)[0];
    if (nr && nr < tp) {
      tp = nr - risk * 0.3;
      tp2 = nr + risk * 0.5;
    }
  } else {
    const ns = sup.filter((s) => s < entry).sort((x, y) => y - x)[0];
    if (ns && ns > tp) {
      tp = ns + risk * 0.3;
      tp2 = ns - risk * 0.5;
    }
  }
  const rr = risk > 0 ? Math.abs(tp - entry) / risk : 0;
  if (rr < 1.5) {
    meta.reason = `Setup rejected — risk:reward ${rr.toFixed(2)} below 1.5 minimum`;
    return { signal: null, meta };
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    signal: {
      symbol,
      direction,
      entryPrice: r2(entry),
      stopLoss: r2(sl),
      takeProfit: r2(tp),
      takeProfit2: r2(tp2),
      confidence,
      strategyCount: winners.length,
      totalStrategies: TOTAL_STRATEGIES,
      strategiesUsed: winners.map((s) => s.name),
      confirmationSignals: winners.
      filter((s) => s.strength === 'STRONG').
      map((s) => s.reason),
      timestamp: Date.now(),
      strength:
      confidence >= 80 ? 'STRONG' : confidence >= 60 ? 'MODERATE' : 'WEAK',
      riskReward: Math.round(rr * 100) / 100
    },
    meta
  };
}