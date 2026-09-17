import type { Candle, Timeframe } from './types';

export function calcEMA(arr: number[], n: number): number {
  if (!arr || arr.length < n) return arr?.[arr.length - 1] ?? 0;
  const k = 2 / (n + 1);
  let e = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

export function calcRSI(arr: number[], n = 14): number {
  if (!arr || arr.length < n + 1) return 50;
  let g = 0,
    l = 0;
  for (let i = arr.length - n; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    if (d > 0) g += d;else
    l -= d;
  }
  const ag = g / n,
    al = l / n;
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

export function calcMACD(arr: number[]) {
  if (!arr || arr.length < 26) return { m: 0, s: 0, h: 0 };
  const e12 = calcEMA(arr, 12);
  const e26 = calcEMA(arr, 26);
  const m = e12 - e26;
  return { m, s: m * 0.9, h: m - m * 0.9 };
}

export function calcATR(candles: Record<Timeframe, Candle[]>): number {
  const cs = candles['1h'];
  if (!cs || cs.length < 7) return 0;
  const atrs: number[] = [];
  for (let i = 1; i < cs.length; i++) {
    atrs.push(
      Math.max(
        cs[i].h - cs[i].l,
        Math.abs(cs[i].h - cs[i - 1].c),
        Math.abs(cs[i].l - cs[i - 1].c)
      )
    );
  }
  return atrs.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, atrs.length);
}

export function calcBB(candles: Record<Timeframe, Candle[]>) {
  const cs = candles['5m'];
  if (!cs || cs.length < 20) return { upper: 0, mid: 0, lower: 0 };
  const prices = cs.slice(-20).map((c) => c.c);
  const avg = prices.reduce((a, b) => a + b, 0) / 20;
  const variance = prices.reduce((s, p) => s + (p - avg) ** 2, 0) / 20;
  const std = Math.sqrt(variance);
  return { upper: avg + 2 * std, mid: avg, lower: avg - 2 * std };
}

// ============================================================
// ===== ADVANCED INDICATORS (ADDITIVE — port from strategies)
// ============================================================

/** RSI full array (not just last value) — for divergence + multi-bar checks. */
export function calcRSIArray(arr: number[], n = 14): number[] {
  if (!arr || arr.length < n + 1) return [];
  const out: number[] = [];
  let g = 0,
    l = 0;
  for (let i = 1; i <= n; i++) {
    const d = arr[i] - arr[i - 1];
    if (d > 0) g += d;else
    l -= d;
  }
  let ag = g / n,
    al = l / n;
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = n + 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n;
    al = (al * (n - 1) + (d < 0 ? -d : 0)) / n;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}

/** Stochastic %K / %D — momentum oscillator (0–100). */
export function calcStochastic(
candles: Candle[],
kPeriod = 14,
dPeriod = 3,
smooth = 3)
: {k: number;d: number;} | null {
  if (!candles || candles.length < kPeriod + dPeriod + smooth) return null;
  const ks: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const win = candles.slice(i - kPeriod + 1, i + 1);
    const h = Math.max(...win.map((c) => c.h));
    const l = Math.min(...win.map((c) => c.l));
    const c = candles[i].c;
    ks.push(h === l ? 50 : (c - l) / (h - l) * 100);
  }
  const kSmooth: number[] = [];
  for (let i = smooth - 1; i < ks.length; i++) {
    kSmooth.push(
      ks.slice(i - smooth + 1, i + 1).reduce((a, b) => a + b, 0) / smooth
    );
  }
  if (kSmooth.length < dPeriod) return null;
  const dVals: number[] = [];
  for (let i = dPeriod - 1; i < kSmooth.length; i++) {
    dVals.push(
      kSmooth.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) /
      dPeriod
    );
  }
  return {
    k: Number(kSmooth[kSmooth.length - 1].toFixed(2)),
    d: Number(dVals[dVals.length - 1].toFixed(2))
  };
}

/** Stochastic RSI — RSI normalized to a 0–100 stochastic scale. */
export function calcStochRSI(
prices: number[],
rsiPeriod = 14,
kPeriod = 3,
dPeriod = 3)
: {k: number;d: number;} | null {
  const rsi = calcRSIArray(prices, rsiPeriod);
  if (rsi.length < kPeriod + dPeriod) return null;
  const ks: number[] = [];
  for (let i = kPeriod - 1; i < rsi.length; i++) {
    const win = rsi.slice(i - kPeriod + 1, i + 1);
    const mn = Math.min(...win);
    const mx = Math.max(...win);
    ks.push(mx === mn ? 50 : (rsi[i] - mn) / (mx - mn) * 100);
  }
  if (ks.length < dPeriod) return null;
  const d = ks.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
  return { k: Number(ks[ks.length - 1].toFixed(2)), d: Number(d.toFixed(2)) };
}

/** ADX — trend strength (0–100). >25 = strong trend. */
export function calcADX(
candles: Candle[],
period = 14)
: {
  adx: number;
  plusDI: number;
  minusDI: number;
  trend: 'strong' | 'weak';
  direction: 'bullish' | 'bearish';
} | null {
  if (!candles || candles.length < period * 2) return null;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    tr.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
    const up = c.h - p.h;
    const dn = p.l - c.l;
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
  }
  const smooth = (arr: number[], n: number) => {
    if (arr.length < n) return [] as number[];
    const r = [arr.slice(0, n).reduce((a, b) => a + b, 0) / n];
    for (let i = n; i < arr.length; i++)
    r.push((r[r.length - 1] * (n - 1) + arr[i]) / n);
    return r;
  };
  const sTR = smooth(tr, period);
  const sPlus = smooth(plusDM, period);
  const sMinus = smooth(minusDM, period);
  if (!sTR.length) return null;
  const plusDI = sPlus.map((v, i) => sTR[i] === 0 ? 0 : v / sTR[i] * 100);
  const minusDI = sMinus.map((v, i) => sTR[i] === 0 ? 0 : v / sTR[i] * 100);
  const dx = plusDI.map((v, i) => {
    const sum = v + minusDI[i];
    return sum === 0 ? 0 : Math.abs(v - minusDI[i]) / sum * 100;
  });
  const adxArr = smooth(dx, period);
  if (!adxArr.length) return null;
  const adx = adxArr[adxArr.length - 1];
  const pD = plusDI[plusDI.length - 1];
  const mD = minusDI[minusDI.length - 1];
  return {
    adx: Number(adx.toFixed(2)),
    plusDI: Number(pD.toFixed(2)),
    minusDI: Number(mD.toFixed(2)),
    trend: adx >= 25 ? 'strong' : 'weak',
    direction: pD > mD ? 'bullish' : 'bearish'
  };
}

/** Ichimoku Cloud — full system (Tenkan/Kijun/Senkou A&B/Chikou). */
export function calcIchimoku(candles: Candle[]) {
  if (!candles || candles.length < 52) return null;
  const last = candles[candles.length - 1];
  const slice = (n: number) => {
    const win = candles.slice(-n);
    return {
      h: Math.max(...win.map((c) => c.h)),
      l: Math.min(...win.map((c) => c.l))
    };
  };
  const t = slice(9);
  const k = slice(26);
  const tenkan = (t.h + t.l) / 2;
  const kijun = (k.h + k.l) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const sb = slice(52);
  const senkouB = (sb.h + sb.l) / 2;
  const cloudBullish = senkouA > senkouB;
  const priceAboveCloud = last.c > Math.max(senkouA, senkouB);
  const priceBelowCloud = last.c < Math.min(senkouA, senkouB);
  return {
    tenkan,
    kijun,
    senkouA,
    senkouB,
    chikou: last.c,
    cloudBullish,
    cloudBearish: !cloudBullish,
    priceAboveCloud,
    priceBelowCloud,
    priceInCloud: !priceAboveCloud && !priceBelowCloud
  };
}

/** Volume analysis — spike detection vs 20-bar SMA. */
export function calcVolumeProfile(candles: Candle[]): {
  ratio: number;
  spike: boolean;
  aboveAverage: boolean;
  current: number;
  average: number;
} | null {
  if (!candles || candles.length < 21) return null;
  const vols = candles.map((c) => c.v);
  const current = vols[vols.length - 1];
  const avg = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ratio = avg === 0 ? 1 : current / avg;
  return {
    current,
    average: avg,
    ratio: Number(ratio.toFixed(2)),
    spike: ratio > 1.5,
    aboveAverage: ratio > 1
  };
}

/** OBV — On-Balance Volume cumulative + trend. */
export function calcOBV(
candles: Candle[])
: {current: number;trend: 'bullish' | 'bearish' | 'neutral';} | null {
  if (!candles || candles.length < 21) return null;
  let obv = 0;
  const arr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].c > candles[i - 1].c) obv += candles[i].v;else
    if (candles[i].c < candles[i - 1].c) obv -= candles[i].v;
    arr.push(obv);
  }
  const trend =
  arr[arr.length - 1] > arr[arr.length - 20] ?
  'bullish' :
  arr[arr.length - 1] < arr[arr.length - 20] ?
  'bearish' :
  'neutral';
  return { current: arr[arr.length - 1], trend };
}

/** VWAP — Volume-Weighted Average Price. */
export function calcVWAP(candles: Candle[]): number | null {
  if (!candles || candles.length < 1) return null;
  let vp = 0,
    v = 0;
  for (const c of candles) {
    const tp = (c.h + c.l + c.c) / 3;
    vp += tp * c.v;
    v += c.v;
  }
  return v === 0 ? null : Number((vp / v).toFixed(6));
}

/** Pivot Points (standard) — daily S/R reference. */
export function calcPivots(candle: Candle) {
  const { h, l, c } = candle;
  const pp = (h + l + c) / 3;
  const r = h - l;
  return {
    pp,
    r1: 2 * pp - l,
    r2: pp + r,
    r3: pp + 2 * r,
    s1: 2 * pp - h,
    s2: pp - r,
    s3: pp - 2 * r
  };
}

/** MACD crossover detection from recent close arrays. */
export function calcMACDCross(arr: number[]): 'bullish' | 'bearish' | null {
  if (!arr || arr.length < 28) return null;
  // Build last two MACD values
  const buildMACD = (slice: number[]) => {
    const e12 = calcEMA(slice, 12);
    const e26 = calcEMA(slice, 26);
    return e12 - e26;
  };
  const curr = buildMACD(arr);
  const prev = buildMACD(arr.slice(0, -1));
  // Signal line approximated as 0.9x macd (consistent with calcMACD)
  const currSig = curr * 0.9;
  const prevSig = prev * 0.9;
  if (prev < prevSig && curr > currSig) return 'bullish';
  if (prev > prevSig && curr < currSig) return 'bearish';
  return null;
}