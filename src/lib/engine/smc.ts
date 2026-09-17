import type { Candle, Timeframe, AMDState, ICTState } from './types';

export function detectAMD(candles: Record<Timeframe, Candle[]>): AMDState {
  const r: AMDState = {
    phase: 'NEUTRAL',
    conf: 0,
    desc: 'Analyzing market phase...'
  };
  const cs = candles['1h'];
  if (!cs || cs.length < 15) return r;
  const l20 = cs.slice(-20);
  const rh = Math.max(...l20.map((c) => c.h));
  const rl = Math.min(...l20.map((c) => c.l));
  const rs = rh - rl;
  const rp = rs / ((rh + rl) / 2 || 1) * 100;
  if (rp < 1.5 && l20.length >= 15) {
    const lc = cs[cs.length - 1];
    if (lc.h > rh + rs * 0.3) {
      r.phase = 'MANIPULATION';
      r.conf = 75;
      r.desc =
      'Bull Trap. Fake breakout above accumulation zone. Institutions distributing.';
      r.manip = { dir: 'bearish' };
    } else if (lc.l < rl - rs * 0.3) {
      r.phase = 'MANIPULATION';
      r.conf = 75;
      r.desc =
      'Bear Trap. Fake breakdown below accumulation. Institutions accumulating.';
      r.manip = { dir: 'bullish' };
    } else {
      r.phase = 'ACCUMULATION';
      r.conf = Math.min(100, (1.5 - rp) * 50 + 30);
      r.desc = 'Smart money accumulating position. Price range tightening.';
    }
  } else if (l20.length >= 10) {
    const fa = l20.slice(0, 5).reduce((s, c) => s + c.c, 0) / 5;
    const sa = l20.slice(-5).reduce((s, c) => s + c.c, 0) / 5;
    const mp = (sa - fa) / fa * 100;
    if (Math.abs(mp) > 1) {
      r.phase = 'DISTRIBUTION';
      r.conf = Math.min(100, Math.abs(mp) * 30 + 20);
      r.dist = { dir: mp > 0 ? 'bullish' : 'bearish' };
      r.desc = `Smart money distributing ${mp > 0 ? 'into strength (uptrend)' : 'into weakness (downtrend)'}`;
    }
  }
  return r;
}

export function detectICT(candles: Record<Timeframe, Candle[]>): ICTState {
  const r: ICTState = { fvgs: [], zone: 'neutral', killzone: 'off_peak' };
  const cs = candles['1h'];
  if (!cs || cs.length < 10) return r;
  const recent = cs.slice(-15);
  const prices = recent.map((c) => c.c);
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i + 1].l > recent[i - 1].h)
    r.fvgs.push({ t: 'bullish_fvg', h: recent[i + 1].l, l: recent[i - 1].h });
    if (recent[i + 1].h < recent[i - 1].l)
    r.fvgs.push({ t: 'bearish_fvg', h: recent[i - 1].l, l: recent[i + 1].h });
  }
  const ct = new Date();
  const ph = (ct.getUTCHours() + 5) % 24;
  if (ph >= 12 && ph < 14) r.killzone = 'london_open';else
  if (ph >= 17 && ph < 19) r.killzone = 'ny_open';else
  if (ph >= 20 || ph < 2) r.killzone = 'asia_session';
  const cp = prices[prices.length - 1];
  const h = Math.max(...recent.map((c) => c.h));
  const l = Math.min(...recent.map((c) => c.l));
  const m = (h + l) / 2;
  if (cp > m * 1.002) r.zone = 'premium';else
  if (cp < m * 0.998) r.zone = 'discount';
  return r;
}

export interface LiquidityGrab {
  signal: 'BUY' | 'SELL' | null;
  desc: string;
  conf: number;
  level?: number;
}

export function detectLiquidityGrab(
candles: Record<Timeframe, Candle[]>)
: LiquidityGrab {
  const r: LiquidityGrab = { signal: null, desc: '', conf: 0 };
  const cs = candles['1h'];
  if (!cs || cs.length < 25) return r;
  const recent = cs.slice(-25);
  const sh: {p: number;i: number;time: number;}[] = [];
  const sl: {p: number;i: number;time: number;}[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (
    recent[i].h > recent[i - 1].h &&
    recent[i].h > recent[i - 2].h &&
    recent[i].h > recent[i + 1].h &&
    recent[i].h > recent[i + 2].h)

    sh.push({ p: recent[i].h, i, time: recent[i].time });
    if (
    recent[i].l < recent[i - 1].l &&
    recent[i].l < recent[i - 2].l &&
    recent[i].l < recent[i + 1].l &&
    recent[i].l < recent[i + 2].l)

    sl.push({ p: recent[i].l, i, time: recent[i].time });
  }
  if (!sh.length || !sl.length) return r;
  const lastHigh = sh[sh.length - 1];
  const lastLow = sl[sl.length - 1];
  const last3 = recent.slice(-3);

  if (lastLow) {
    const lowLevel = lastLow.p;
    const brokeBelow = last3.some((c) => c.l < lowLevel);
    const closedAbove = last3[last3.length - 1]?.c > lowLevel;
    if (brokeBelow && closedAbove) {
      r.signal = 'BUY';
      r.conf = 80;
      r.level = lowLevel;
      r.desc =
      'Bullish liquidity grab. Price swept below swing low, trapping shorts, then reversed. Institutions accumulated.';
    }
  }
  if (lastHigh) {
    const highLevel = lastHigh.p;
    const brokeAbove = last3.some((c) => c.h > highLevel);
    const closedBelow = last3[last3.length - 1]?.c < highLevel;
    if (brokeAbove && closedBelow) {
      r.signal = 'SELL';
      r.conf = 80;
      r.level = highLevel;
      r.desc =
      'Bearish liquidity grab. Price swept above swing high, trapping longs, then reversed. Institutions distributed.';
    }
  }
  return r;
}