import type {
  Candle,
  Timeframe,
  MTFEntry,
  TrendsState,
  VolatilityState,
  SRLevel } from
'./types';
import { TFS } from './pairs';
import { calcEMA, calcRSI } from './indicators';

export function detStruct(prices: number[], highs: number[], lows: number[]) {
  if (!prices || prices.length < 10)
  return { type: 'ranging' as const, level: prices?.[prices.length - 1] || 0 };
  const sh: {p: number;i: number;}[] = [];
  const sl: {p: number;i: number;}[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (
    highs[i] > highs[i - 1] &&
    highs[i] > highs[i - 2] &&
    highs[i] > highs[i + 1] &&
    highs[i] > highs[i + 2])

    sh.push({ p: highs[i], i });
    if (
    lows[i] < lows[i - 1] &&
    lows[i] < lows[i - 2] &&
    lows[i] < lows[i + 1] &&
    lows[i] < lows[i + 2])

    sl.push({ p: lows[i], i });
  }
  if (sh.length < 2 || sl.length < 2)
  return { type: 'ranging' as const, level: prices[prices.length - 1] };
  const lsh = sh[sh.length - 1].p,
    psh = sh[sh.length - 2].p,
    lsl = sl[sl.length - 1].p,
    psl = sl[sl.length - 2].p;
  if (lsh > psh && lsl > psl) return { type: 'uptrend' as const, level: lsl };
  if (lsh < psh && lsl < psl) return { type: 'downtrend' as const, level: lsh };
  return { type: 'ranging' as const, level: prices[prices.length - 1] };
}

export function analyzeMTF(
candles: Record<Timeframe, Candle[]>,
fallbackPrice: number)
: Record<Timeframe, MTFEntry> {
  const result = {} as Record<Timeframe, MTFEntry>;
  TFS.forEach((tf) => {
    const cs = candles[tf];
    if (!cs || cs.length < 5) {
      result[tf] = {
        trend: 'neutral',
        str: 0,
        struct: 'none',
        rsiVal: 50,
        price: fallbackPrice
      };
      return;
    }
    const pr = cs.map((c) => c.c);
    const hi = cs.map((c) => c.h);
    const lo = cs.map((c) => c.l);
    const e9 = calcEMA(pr, 9);
    const e21 = calcEMA(pr, 21);
    const e50 = calcEMA(pr, 50);
    const rsiVal = calcRSI(pr, 14);
    const st = detStruct(pr, hi, lo);
    const cp = pr[pr.length - 1];
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let str = 0;
    if (e9 > e21 && e21 > e50) {
      trend = 'bullish';
      str = 3;
    } else if (e9 < e21 && e21 < e50) {
      trend = 'bearish';
      str = 3;
    } else if (e9 > e21) {
      trend = 'bullish';
      str = 1;
    } else {
      trend = 'bearish';
      str = 1;
    }
    if (e50 && Math.abs(cp - e50) / e50 * 100 > 2) str = Math.min(str + 1, 5);
    result[tf] = {
      trend,
      str: Math.min(str, 5),
      struct: st.type,
      level: st.level,
      rsiVal: Math.round(rsiVal * 10) / 10,
      price: cp,
      high: Math.max(...hi.slice(-20)),
      low: Math.min(...lo.slice(-20))
    };
  });
  return result;
}

export function findSR(candles: Record<Timeframe, Candle[]>) {
  const sup: SRLevel[] = [];
  const res: SRLevel[] = [];
  TFS.forEach((tf) => {
    const cs = candles[tf];
    if (!cs || cs.length < 15) return;
    const recent = cs.slice(-40);
    for (let i = 2; i < recent.length - 2; i++) {
      if (
      recent[i].l < recent[i - 1].l &&
      recent[i].l < recent[i - 2].l &&
      recent[i].l < recent[i + 1].l &&
      recent[i].l < recent[i + 2].l)

      sup.push({ p: recent[i].l, tf });
      if (
      recent[i].h > recent[i - 1].h &&
      recent[i].h > recent[i - 2].h &&
      recent[i].h > recent[i + 1].h &&
      recent[i].h > recent[i + 2].h)

      res.push({ p: recent[i].h, tf });
    }
  });
  return { sup: sup.slice(0, 3), res: res.slice(0, 3) };
}

export function detTrends(candles: Record<Timeframe, Candle[]>): TrendsState {
  const r: TrendsState = {
    short: { dir: 'neutral', str: 0 },
    medium: { dir: 'neutral', str: 0 },
    long: { dir: 'neutral', str: 0 },
    align: 0
  };
  const map: Record<'short' | 'medium' | 'long', Timeframe> = {
    short: '5m',
    medium: '1h',
    long: '1d'
  };
  (Object.entries(map) as Array<[keyof typeof map, Timeframe]>).forEach(
    ([term, tf]) => {
      const cs = candles[tf];
      if (!cs || cs.length < 10) return;
      const pr = cs.map((c) => c.c);
      const e20 = calcEMA(pr, 20);
      const e50 = calcEMA(pr, 50);
      const cp = pr[pr.length - 1];
      let up = 0,
        dn = 0;
      for (let i = 1; i < pr.length; i++) {
        if (cs[i].h > cs[i - 1].h && cs[i].l > cs[i - 1].l) up++;else
        if (cs[i].h < cs[i - 1].h && cs[i].l < cs[i - 1].l) dn++;
      }
      const total = up + dn;
      const s = total > 0 ? Math.round(Math.abs(up - dn) / total * 100) : 0;
      let dir = 'neutral';
      if (cp > e20 && e20 > e50) dir = 'bullish';else
      if (cp < e20 && e20 < e50) dir = 'bearish';else
      dir = cp > e50 ? 'mild_bullish' : 'mild_bearish';
      r[term] = { dir, str: s };
    }
  );
  const ds = [r.short.dir, r.medium.dir, r.long.dir];
  const bc = ds.filter((d) => d.includes('bullish')).length;
  const sc = ds.filter((d) => d.includes('bearish')).length;
  if (bc === 3) r.align = 100;else
  if (sc === 3) r.align = -100;else
  if (bc === 2) r.align = 50;else
  if (sc === 2) r.align = -50;
  return r;
}

export function calcVol(candles: Record<Timeframe, Candle[]>): VolatilityState {
  const r: VolatilityState = { atr: 0, atrPct: 0, regime: 'normal' };
  const cs = candles['1h'];
  if (!cs || cs.length < 7) return r;
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
  const atr =
  atrs.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, atrs.length);
  r.atr = atr;
  r.atrPct = atr / (cs[cs.length - 1].c || 1) * 100;
  if (r.atrPct < 0.3) r.regime = 'low';else
  if (r.atrPct < 1.5) r.regime = 'normal';else
  if (r.atrPct < 3) r.regime = 'high';else
  r.regime = 'extreme';
  return r;
}