import { analyzeDelta } from './deltaFootprint';
import { analyzeDom } from './domOrderBook';
import { calculateOhlcLevels } from './ohlcLevels';
import { calculateTradeFormula } from './tradeFormula';
import type { InstitutionalCandle, SniperCondition, SniperEntry } from './types';
import { calculateVolumeProfile } from './volumeProfile';
import { calculateVWAP } from './vwapCalculator';

export function detectSniperEntry(candles: InstitutionalCandle[]): SniperEntry | null {
  if (candles.length < 20) return null;
  const formula = calculateTradeFormula(candles);
  const profile = calculateVolumeProfile(candles);
  const delta = analyzeDelta(candles);
  const dom = analyzeDom(candles);
  const vwap = calculateVWAP(candles);
  const levels = calculateOhlcLevels(candles);
  const lastPrice = candles.at(-1)!.close;
  const isBuy = formula.signal.includes('BUY');
  const isSell = formula.signal.includes('SELL');
  const dailyRange = Math.max(levels.dailyHigh - levels.dailyLow, Number.EPSILON);
  const conditions: SniperCondition[] = [
  {
    name: 'Formula signal',
    met: isBuy || isSell,
    details: `${formula.signal.replaceAll('_', ' ')} · ${formula.confidence}% confidence`
  },
  {
    name: 'Volume profile location',
    met: isBuy ? lastPrice <= profile.poc : isSell ? lastPrice >= profile.poc : false,
    details:
    lastPrice < profile.val ?
    'Below value area low' :
    lastPrice > profile.vah ?
    'Above value area high' :
    'Inside value area'
  },
  {
    name: 'Delta confirmation',
    met: delta.deltaFlip || delta.deltaDivergence,
    details: delta.deltaFlip ?
    `Delta flipped ${delta.flipDirection}` :
    delta.deltaDivergence ?
    `${delta.divergenceType} divergence` :
    'No confirmed flip'
  },
  {
    name: 'DOM absorption',
    met: dom.absorption !== null,
    details: dom.absorption ?
    `${dom.absorption.side}-side absorption at ${dom.absorption.price}` :
    'No active absorption'
  },
  {
    name: 'VWAP location',
    met: isBuy ? vwap.priceRelative !== 'above' : isSell ? vwap.priceRelative !== 'below' : false,
    details: `Price ${vwap.priceRelative} VWAP · ${vwap.deviation} sigma`
  },
  {
    name: 'Daily extreme proximity',
    met: isBuy ?
    Math.abs(lastPrice - levels.dailyLow) / dailyRange < 0.25 :
    isSell ?
    Math.abs(lastPrice - levels.dailyHigh) / dailyRange < 0.25 :
    false,
    details: isBuy ?
    `Daily low ${levels.dailyLow}` :
    isSell ?
    `Daily high ${levels.dailyHigh}` :
    'Direction not confirmed'
  }];

  if (!isBuy && !isSell || conditions.filter((condition) => condition.met).length < 3) {
    return null;
  }
  const atr = calculateATR(candles);
  const stopDistance = Math.max(atr * 0.45, lastPrice * 0.0005);
  const direction = isBuy ? 'BUY' : 'SELL';
  const sign = isBuy ? 1 : -1;
  return {
    ready: true,
    direction,
    entryPrice: round(lastPrice),
    stopLoss: round(lastPrice - sign * stopDistance),
    target1: round(lastPrice + sign * stopDistance * 1.5),
    target2: round(lastPrice + sign * stopDistance * 2.5),
    target3: round(lastPrice + sign * stopDistance * 4),
    riskReward: 2.5,
    conditions
  };
}

export function calculateATR(candles: InstitutionalCandle[], period = 14): number {
  if (candles.length < 2) return 0;
  const ranges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  const recent = ranges.slice(-Math.min(period, ranges.length));
  return recent.reduce((sum, range) => sum + range, 0) / Math.max(1, recent.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}