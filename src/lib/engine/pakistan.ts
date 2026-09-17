import type { Candle, Timeframe, PakistanState } from './types';
import { fmt } from './pairs';

export function runPak(
pairId: string,
candles: Record<Timeframe, Candle[]>)
: PakistanState {
  const r: PakistanState = {
    session: 'waiting',
    rh: 0,
    rl: 0,
    brk: null,
    enty: null,
    sl: 0,
    tp: 0,
    desc: 'Waiting for 10:00 AM PKT session'
  };
  const ct = new Date();
  if (ct.getUTCDay() === 0 || ct.getUTCDay() === 6) {
    r.desc = 'Weekend — markets closed';
    r.session = 'closed';
    return r;
  }
  const cs = candles['1h'];
  if (!cs || cs.length < 3) {
    r.desc = 'Loading data...';
    return r;
  }
  const ts = ct.getTime();
  const t2 = new Date(ct);
  t2.setUTCHours(0, 0, 0, 0);
  const dt = t2.getTime();
  const t10 = dt + 5 * 3600000;
  const t11 = t10 + 3600000;
  const c10 = cs.find((c) => c.time === t10);

  if (ts < t10) {
    r.desc = 'Next session opens at 10:00 AM PKT';
    r.session = 'pre-session';
  } else if (c10 && !c10.closed) {
    r.desc = '10:00 AM candle currently forming';
    r.session = 'forming';
  } else if (c10 && c10.closed && ts < t11) {
    r.rh = c10.h;
    r.rl = c10.l;
    r.session = 'range-set';
    r.desc = `Range locked: ${fmt(pairId, c10.h)} / ${fmt(pairId, c10.l)}. Awaiting 11:00 AM breakout`;
  } else if (ts >= t11 && c10) {
    r.rh = c10.h;
    r.rl = c10.l;
    r.session = 'breakout';
    const post = cs.filter((c) => c.time >= t11);
    for (const c of post) {
      if (c.h > c10.h + (c10.h - c10.l) * 0.05) {
        r.brk = { dir: 'bullish', p: c.h };
        break;
      }
      if (c.l < c10.l - (c10.h - c10.l) * 0.05) {
        r.brk = { dir: 'bearish', p: c.l };
        break;
      }
    }
    if (r.brk) {
      const rg = c10.h - c10.l;
      r.enty = { dir: r.brk.dir, p: r.brk.dir === 'bullish' ? c10.h : c10.l };
      r.sl = r.brk.dir === 'bullish' ? c10.l - rg * 0.3 : c10.h + rg * 0.3;
      r.tp = r.brk.dir === 'bullish' ? c10.h + rg * 2 : c10.l - rg * 2;
      r.desc = `${r.brk.dir.toUpperCase()} breakout confirmed. Entry @ ${fmt(pairId, r.enty.p)}`;
    } else {
      r.desc = 'Inside 10AM range — no breakout yet';
    }
  }
  return r;
}