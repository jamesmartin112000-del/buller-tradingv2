import type { InstitutionalCandle, OhlcLevels } from './types';

export function calculateOhlcLevels(candles: InstitutionalCandle[]): OhlcLevels {
  if (!candles.length) return emptyLevels();
  const last = candles.at(-1)!;
  const marketDate = new Date(last.timestamp);
  const dayKey = utcDayKey(marketDate);
  const currentDay = candles.filter((candle) => utcDayKey(new Date(candle.timestamp)) === dayKey);
  const dayStart = Date.UTC(
    marketDate.getUTCFullYear(),
    marketDate.getUTCMonth(),
    marketDate.getUTCDate()
  );
  const previousDay = candles.filter((candle) => candle.timestamp < dayStart);
  const weekStart = dayStart - 7 * 24 * 60 * 60 * 1000;
  const monthStart = dayStart - 30 * 24 * 60 * 60 * 1000;
  const week = candles.filter((candle) => candle.timestamp >= weekStart);
  const month = candles.filter((candle) => candle.timestamp >= monthStart);
  const dailyHigh = maximum(currentDay, 'high', last.high);
  const dailyLow = minimum(currentDay, 'low', last.low);
  const dailyOpen = currentDay[0]?.open ?? last.open;
  const previousClose = previousDay.at(-1)?.close ?? last.open;
  const weeklyHigh = maximum(week, 'high', last.high);
  const weeklyLow = minimum(week, 'low', last.low);
  const monthlyHigh = maximum(month, 'high', last.high);
  const monthlyLow = minimum(month, 'low', last.low);
  const gapUp = dailyOpen > previousClose * 1.001;
  const gapDown = dailyOpen < previousClose * 0.999;
  const gapFilled = gapUp ? dailyLow <= previousClose : gapDown ? dailyHigh >= previousClose : true;
  return {
    dailyHigh: round(dailyHigh),
    dailyLow: round(dailyLow),
    dailyOpen: round(dailyOpen),
    previousClose: round(previousClose),
    weeklyHigh: round(weeklyHigh),
    weeklyLow: round(weeklyLow),
    monthlyHigh: round(monthlyHigh),
    monthlyLow: round(monthlyLow),
    gapUp,
    gapDown,
    gapFilled
  };
}

function maximum(
candles: InstitutionalCandle[],
key: 'high' | 'low',
fallback: number)
: number {
  return candles.length ? Math.max(...candles.map((candle) => candle[key])) : fallback;
}

function minimum(
candles: InstitutionalCandle[],
key: 'high' | 'low',
fallback: number)
: number {
  return candles.length ? Math.min(...candles.map((candle) => candle[key])) : fallback;
}

function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyLevels(): OhlcLevels {
  return {
    dailyHigh: 0,
    dailyLow: 0,
    dailyOpen: 0,
    previousClose: 0,
    weeklyHigh: 0,
    weeklyLow: 0,
    monthlyHigh: 0,
    monthlyLow: 0,
    gapUp: false,
    gapDown: false,
    gapFilled: false
  };
}