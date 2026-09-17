import type { Candle, Timeframe } from './types';
import { TFS, TF_MS } from './pairs';

export function makeCandle(
candles: Record<Timeframe, Candle[]>,
price: number,
vol = 0,
time?: number)
{
  const t = time ?? Date.now();
  TFS.forEach((tf) => {
    const interval = TF_MS[tf];
    const ct = Math.floor(t / interval) * interval;
    const arr = candles[tf];
    if (!arr) return;
    if (!arr.length || arr[arr.length - 1].time !== ct) {
      if (arr.length > 1) arr[arr.length - 1].closed = true;
      arr.push({
        time: ct,
        o: price,
        h: price,
        l: price,
        c: price,
        v: vol || 1,
        closed: false
      });
    } else {
      const x = arr[arr.length - 1];
      x.h = Math.max(x.h, price);
      x.l = Math.min(x.l, price);
      x.c = price;
      x.v += vol || 1;
    }
    if (arr.length > 500) arr.splice(0, arr.length - 500);
  });
}

export function seedCandles(
candles: Record<Timeframe, Candle[]>,
price: number)
{
  const t = Date.now();
  TFS.forEach((tf) => {
    const interval = TF_MS[tf];
    const arr = candles[tf];
    if (!arr || arr.length > 0) return;
    // Generate semi-realistic seed candles with small random walk
    let p = price * 0.985;
    for (let i = 50; i > 0; i--) {
      const ts = Math.floor((t - i * interval) / interval) * interval;
      const drift = (Math.random() - 0.48) * price * 0.004;
      const o = p;
      const c = p + drift;
      const h = Math.max(o, c) + Math.random() * price * 0.002;
      const l = Math.min(o, c) - Math.random() * price * 0.002;
      arr.push({
        time: ts,
        o,
        h,
        l,
        c,
        v: Math.random() * 100 + 50,
        closed: true
      });
      p = c;
    }
    // Last seed candle reflects current price
    const last = arr[arr.length - 1];
    last.c = price;
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
    last.closed = false;
  });
}

export function emptyCandleMap(): Record<Timeframe, Candle[]> {
  return {
    '1m': [],
    '5m': [],
    '15m': [],
    '1h': [],
    '4h': [],
    '1d': []
  };
}