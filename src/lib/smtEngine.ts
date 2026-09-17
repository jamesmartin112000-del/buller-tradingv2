import type {
  FinalSignal,
  MarketDataCollection,
  OhlcCandle,
  ScanResult,
  SMTDivergence,
  Timeframe,
  TimeframeResult } from
'./types';

const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  '15m': 1,
  '1h': 2,
  '4h': 3,
  '1d': 4,
  '1w': 5,
  '1mo': 6
};

const DEFAULT_TIMEFRAMES: Timeframe[] = [
'15m',
'1h',
'4h',
'1d',
'1w',
'1mo'];


export function scanTimeframe(
goldCandles: OhlcCandle[],
dxyCandles: OhlcCandle[],
lookback = 2)
: SMTDivergence[] {
  if (goldCandles.length === 0 || dxyCandles.length === 0) return [];

  const { gold, dxy } = alignCandles(goldCandles, dxyCandles);
  if (gold.length < lookback * 2 + 1) return [];

  const divergences: SMTDivergence[] = [];
  const goldHighs = findSwingHighs(gold, lookback);
  const goldLows = findSwingLows(gold, lookback);
  const dxyHighs = findSwingHighs(dxy, lookback);
  const dxyLows = findSwingLows(dxy, lookback);

  if (goldHighs.length >= 2 && dxyHighs.length >= 2) {
    const goldFirst = goldHighs.at(-2);
    const goldSecond = goldHighs.at(-1);
    const dxyFirst = dxyHighs.at(-2);
    const dxySecond = dxyHighs.at(-1);

    if (
    goldFirst !== undefined &&
    goldSecond !== undefined &&
    dxyFirst !== undefined &&
    dxySecond !== undefined &&
    Math.abs(goldFirst - dxyFirst) <= lookback * 2 &&
    Math.abs(goldSecond - dxySecond) <= lookback * 2 &&
    gold[goldSecond].high < gold[goldFirst].high &&
    dxy[dxySecond].high > dxy[dxyFirst].high)
    {
      divergences.push({
        type: 'BEARISH_SMT',
        direction: 'SELL',
        signal:
        'Bearish SMT: Gold formed a lower high while DXY formed a higher high.',
        gold_high_1: gold[goldFirst].high,
        gold_high_2: gold[goldSecond].high,
        dxy_high_1: dxy[dxyFirst].high,
        dxy_high_2: dxy[dxySecond].high
      });
    }
  }

  if (goldLows.length >= 2 && dxyLows.length >= 2) {
    const goldFirst = goldLows.at(-2);
    const goldSecond = goldLows.at(-1);
    const dxyFirst = dxyLows.at(-2);
    const dxySecond = dxyLows.at(-1);

    if (
    goldFirst !== undefined &&
    goldSecond !== undefined &&
    dxyFirst !== undefined &&
    dxySecond !== undefined &&
    Math.abs(goldFirst - dxyFirst) <= lookback * 2 &&
    Math.abs(goldSecond - dxySecond) <= lookback * 2 &&
    gold[goldSecond].low > gold[goldFirst].low &&
    dxy[dxySecond].low < dxy[dxyFirst].low)
    {
      divergences.push({
        type: 'BULLISH_SMT',
        direction: 'BUY',
        signal:
        'Bullish SMT: Gold held a higher low while DXY formed a lower low.',
        gold_low_1: gold[goldFirst].low,
        gold_low_2: gold[goldSecond].low,
        dxy_low_1: dxy[dxyFirst].low,
        dxy_low_2: dxy[dxySecond].low
      });
    }
  }

  return divergences;
}

export function fullScan(
goldData: MarketDataCollection,
dxyData: MarketDataCollection,
timeframes: Timeframe[] = DEFAULT_TIMEFRAMES)
: ScanResult {
  const timeframesResult = {} as Record<Timeframe, TimeframeResult>;
  let totalDivergences = 0;

  timeframes.forEach((timeframe) => {
    const gold = goldData[timeframe];
    const dxy = dxyData[timeframe];
    const goldOk = gold?.status === 'ok' && gold.candles.length > 0;
    const dxyOk = dxy?.status === 'ok' && dxy.candles.length > 0;
    const aligned =
    goldOk && dxyOk ?
    alignCandles(gold.candles, dxy.candles) :
    { gold: [], dxy: [] };
    const alignedReady = aligned.gold.length >= 5;
    const correlation = checkInverseCorrelation(
      aligned.gold.slice(-10).map((candle) => candle.close),
      aligned.dxy.slice(-10).map((candle) => candle.close)
    );
    const divergences =
    alignedReady ? scanTimeframe(gold.candles, dxy.candles) : [];
    const latestMarketTimestamp = Math.min(
      gold?.marketTimestamp ?? Number.POSITIVE_INFINITY,
      dxy?.marketTimestamp ?? Number.POSITIVE_INFINITY
    );

    totalDivergences += divergences.length;
    timeframesResult[timeframe] = {
      timeframe,
      dataStatus: goldOk && dxyOk && alignedReady ? 'ok' : 'partial',
      goldCandles: gold?.candles.length ?? 0,
      dxyCandles: dxy?.candles.length ?? 0,
      goldSource: gold?.source,
      dxySource: dxy?.source,
      latestMarketTimestamp: Number.isFinite(latestMarketTimestamp) ?
      latestMarketTimestamp :
      null,
      stale: Boolean(gold?.isStale || dxy?.isStale),
      inverseConfirmed: correlation !== null && correlation < -0.3,
      correlation,
      divergences
    };
  });

  const { score, buyTimeframes, sellTimeframes, signal } =
  calculateConfluenceScore(timeframesResult);

  return {
    timestamp: new Date().toISOString(),
    timeframes: timeframesResult,
    summary: {
      totalTimeframes: timeframes.length,
      availableTimeframes: Object.values(timeframesResult).filter(
        (result) => result.dataStatus === 'ok'
      ).length,
      totalDivergences,
      buyTimeframes,
      sellTimeframes,
      finalSignal: signal,
      confluenceScore: score
    }
  };
}

export type ScanResults = ReturnType<typeof fullScan>;

function findSwingLows(candles: OhlcCandle[], lookback: number): number[] {
  const indices: number[] = [];
  for (let index = lookback; index < candles.length - lookback; index += 1) {
    let isSwing = true;
    for (
    let comparison = index - lookback;
    comparison <= index + lookback;
    comparison += 1)
    {
      if (comparison !== index && candles[comparison].low < candles[index].low) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) indices.push(index);
  }
  return indices;
}

function findSwingHighs(candles: OhlcCandle[], lookback: number): number[] {
  const indices: number[] = [];
  for (let index = lookback; index < candles.length - lookback; index += 1) {
    let isSwing = true;
    for (
    let comparison = index - lookback;
    comparison <= index + lookback;
    comparison += 1)
    {
      if (
      comparison !== index &&
      candles[comparison].high > candles[index].high)
      {
        isSwing = false;
        break;
      }
    }
    if (isSwing) indices.push(index);
  }
  return indices;
}

function alignCandles(
goldCandles: OhlcCandle[],
dxyCandles: OhlcCandle[])
: {gold: OhlcCandle[];dxy: OhlcCandle[];} {
  const gold = [...goldCandles].sort((a, b) => a.timestamp - b.timestamp);
  const dxy = [...dxyCandles].sort((a, b) => a.timestamp - b.timestamp);
  const interval = Math.min(inferInterval(gold), inferInterval(dxy));
  const tolerance = Math.max(60, interval * 0.45);
  const alignedGold: OhlcCandle[] = [];
  const alignedDxy: OhlcCandle[] = [];
  let dxyIndex = 0;

  gold.forEach((goldCandle) => {
    while (
    dxyIndex + 1 < dxy.length &&
    Math.abs(dxy[dxyIndex + 1].timestamp - goldCandle.timestamp) <=
    Math.abs(dxy[dxyIndex].timestamp - goldCandle.timestamp))
    {
      dxyIndex += 1;
    }

    const dxyCandle = dxy[dxyIndex];
    if (
    dxyCandle &&
    Math.abs(dxyCandle.timestamp - goldCandle.timestamp) <= tolerance)
    {
      alignedGold.push(goldCandle);
      alignedDxy.push(dxyCandle);
      dxyIndex += 1;
    }
  });

  return { gold: alignedGold, dxy: alignedDxy };
}

function inferInterval(candles: OhlcCandle[]): number {
  if (candles.length < 2) return Number.POSITIVE_INFINITY;
  const intervals = candles.
  slice(1).
  map((candle, index) => candle.timestamp - candles[index].timestamp).
  filter((value) => value > 0).
  sort((a, b) => a - b);
  return intervals[Math.floor(intervals.length / 2)] ?? Number.POSITIVE_INFINITY;
}

function checkInverseCorrelation(
goldClose: number[],
dxyClose: number[])
: number | null {
  const length = Math.min(goldClose.length, dxyClose.length, 10);
  if (length < 3) return null;

  const gold = goldClose.slice(-length);
  const dxy = dxyClose.slice(-length);
  const goldMean = gold.reduce((sum, value) => sum + value, 0) / length;
  const dxyMean = dxy.reduce((sum, value) => sum + value, 0) / length;
  let numerator = 0;
  let goldVariance = 0;
  let dxyVariance = 0;

  for (let index = 0; index < length; index += 1) {
    const goldDifference = gold[index] - goldMean;
    const dxyDifference = dxy[index] - dxyMean;
    numerator += goldDifference * dxyDifference;
    goldVariance += goldDifference ** 2;
    dxyVariance += dxyDifference ** 2;
  }

  const denominator = Math.sqrt(goldVariance * dxyVariance);
  return denominator === 0 ? null : numerator / denominator;
}

function calculateConfluenceScore(
timeframes: Record<Timeframe, TimeframeResult>)
: {
  score: number;
  buyTimeframes: Timeframe[];
  sellTimeframes: Timeframe[];
  signal: FinalSignal;
} {
  let score = 0;
  const buyTimeframes: Timeframe[] = [];
  const sellTimeframes: Timeframe[] = [];

  Object.entries(timeframes).forEach(([timeframeKey, result]) => {
    if (result.dataStatus !== 'ok') return;
    const timeframe = timeframeKey as Timeframe;
    const weight = TIMEFRAME_WEIGHTS[timeframe];

    result.divergences.forEach((divergence) => {
      if (divergence.direction === 'BUY') {
        score += weight;
        if (!buyTimeframes.includes(timeframe)) buyTimeframes.push(timeframe);
      } else {
        score -= weight;
        if (!sellTimeframes.includes(timeframe)) sellTimeframes.push(timeframe);
      }
    });
  });

  return {
    score,
    buyTimeframes,
    sellTimeframes,
    signal: signalFromScore(score)
  };
}

function signalFromScore(score: number): FinalSignal {
  if (score >= 6) return 'STRONG_BUY';
  if (score >= 3) return 'BUY';
  if (score >= 1) return 'WEAK_BUY';
  if (score <= -6) return 'STRONG_SELL';
  if (score <= -3) return 'SELL';
  if (score <= -1) return 'WEAK_SELL';
  return 'NEUTRAL';
}