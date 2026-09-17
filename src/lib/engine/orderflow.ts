import type { Candle, Timeframe, OrderFlowState } from './types';

// We synthesize order flow from price/volume changes since we don't have real ticks
export function analyzeOF(
candles: Record<Timeframe, Candle[]>)
: OrderFlowState {
  const r: OrderFlowState = {
    delta: 0,
    buyPct: 50,
    sellPct: 50,
    imb: 'neutral'
  };
  const cs = candles['5m'];
  if (!cs || cs.length < 20) return r;
  const recent = cs.slice(-30);
  let bv = 0,
    sv = 0;
  recent.forEach((c) => {
    const range = Math.max(c.h - c.l, 0.0001);
    const closePos = (c.c - c.l) / range; // 0 = bottom, 1 = top
    const buyShare = closePos;
    const sellShare = 1 - closePos;
    bv += c.v * buyShare;
    sv += c.v * sellShare;
  });
  r.delta = bv - sv;
  const total = bv + sv || 1;
  r.buyPct = Math.round(bv / total * 100);
  r.sellPct = 100 - r.buyPct;
  if (r.buyPct > 65) r.imb = 'strong_buying';else
  if (r.buyPct > 55) r.imb = 'buying';else
  if (r.sellPct > 65) r.imb = 'strong_selling';else
  if (r.sellPct > 55) r.imb = 'selling';
  return r;
}