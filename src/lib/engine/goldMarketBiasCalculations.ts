import type { BinanceCandle } from '../trading/binanceWebSocket';
import type { MarketCandleSource } from '../trading/marketCandles';
import {
  averageTrueRange,
  candleReturns,
  emaLast,
  pearsonCorrelation,
  roundMarketValue,
  rsiLast } from
'./goldMarketBiasMath';
import {
  GOLD_BIAS_TIMEFRAMES,
  type DxyBiasTimeframe,
  type GoldBiasDirection,
  type GoldBiasTimeframe,
  type GoldBosResult,
  type GoldCandleInput,
  type GoldConfirmationStep,
  type GoldDxyCheck,
  type GoldFvgResult,
  type GoldLiquidityEvent,
  type GoldTimeframeBias,
  type GoldTradePlan,
  type StructureDirection,
  type TrendDirection } from
'./goldMarketBiasTypes';

export const GOLD_TIMEFRAME_WEIGHTS: Record<GoldBiasTimeframe, number> = {
  '1mo': 3,
  '1w': 3,
  '1d': 2.5,
  '4h': 2,
  '1h': 1.5,
  '15m': 1,
  '1m': 0.5
};

export function analyzeGoldTimeframe(
timeframe: GoldBiasTimeframe,
input: GoldCandleInput | undefined)
: GoldTimeframeBias {
  const candles = input?.candles ?? [];
  if (candles.length < 30) {
    return {
      timeframe,
      available: false,
      candleCount: candles.length,
      price: candles.at(-1)?.close ?? null,
      direction: 'neutral',
      structure: null,
      ema20: null,
      ema50: null,
      rsi: null,
      structureScore: 0,
      emaScore: 0,
      rsiScore: 0,
      liquidityScore: 0,
      score: 0,
      maxScore: 7,
      liquidity: null,
      source: input?.source ?? null,
      lastCandleAt: candles.at(-1)?.timestamp ?? null,
      reason: `Only ${candles.length} real candles available; 30 required.`
    };
  }

  const closes = candles.map((candle) => candle.close);
  const price = closes.at(-1)!;
  const structure = detectStructure(candles);
  const structureScore =
  structure === 'HH/HL' ? 2 : structure === 'LH/LL' ? -2 : 0;
  const ema20 = emaLast(closes, 20);
  const ema50 = emaLast(closes, 50);
  const emaScore =
  price > ema20 && ema20 > ema50 ? 2 : price < ema20 && ema20 < ema50 ? -2 : 0;
  const rsi = rsiLast(closes);
  const rsiScore = rsi >= 55 ? 1 : rsi <= 45 ? -1 : 0;
  const liquidity = detectLiquiditySweep(candles);
  const liquidityScore =
  liquidity?.direction === 'BUY' ?
  2 :
  liquidity?.direction === 'SELL' ?
  -2 :
  0;
  const score = structureScore + emaScore + rsiScore + liquidityScore;
  const direction: TrendDirection =
  score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';

  return {
    timeframe,
    available: true,
    candleCount: candles.length,
    price,
    direction,
    structure,
    ema20,
    ema50,
    rsi: roundMarketValue(rsi),
    structureScore,
    emaScore,
    rsiScore,
    liquidityScore,
    score,
    maxScore: 7,
    liquidity,
    source: input?.source ?? null,
    lastCandleAt: candles.at(-1)?.timestamp ?? null,
    reason: `${structure} · EMA ${emaScore > 0 ? 'bullish' : emaScore < 0 ? 'bearish' : 'mixed'} · RSI ${rsi.toFixed(1)}${liquidity ? ` · ${liquidity.label}` : ''}`
  };
}

export function analyzeGoldDxyRelationship(
timeframe: DxyBiasTimeframe,
goldInput: GoldCandleInput | undefined,
dxyInput: GoldCandleInput | undefined,
goldBias: GoldTimeframeBias)
: GoldDxyCheck {
  if (
  !goldInput ||
  !dxyInput ||
  goldInput.candles.length < 20 ||
  dxyInput.candles.length < 20)
  {
    return {
      timeframe,
      status: 'UNAVAILABLE',
      goldDirection: goldBias.available ? goldBias.direction : 'unavailable',
      dxyDirection: 'unavailable',
      correlation: null,
      score: 0,
      reason:
      'Matching real Gold/DXY candles are unavailable; no SMT vote applied.'
    };
  }

  const dxyDirection = simpleDirection(dxyInput.candles);
  const goldDirection = goldBias.direction;
  const correlation = pearsonCorrelation(
    candleReturns(goldInput.candles.slice(-40)),
    candleReturns(dxyInput.candles.slice(-40))
  );
  const inverseAligned =
  goldDirection === 'bullish' && dxyDirection === 'bearish' ||
  goldDirection === 'bearish' && dxyDirection === 'bullish';
  const conflict =
  goldDirection !== 'neutral' &&
  dxyDirection !== 'neutral' &&
  goldDirection === dxyDirection;
  const status = inverseAligned ?
  'CONFIRMED' :
  conflict ?
  'CONFLICT' :
  'NEUTRAL';
  const score = inverseAligned ?
  goldDirection === 'bullish' ?
  1 :
  -1 :
  conflict ?
  goldDirection === 'bullish' ?
  -1 :
  1 :
  0;
  const roundedCorrelation = Number.isFinite(correlation) ?
  roundMarketValue(correlation) :
  null;
  const correlationLabel =
  roundedCorrelation !== null ? ` Return correlation ${roundedCorrelation}.` : '';

  return {
    timeframe,
    status,
    goldDirection,
    dxyDirection,
    correlation: roundedCorrelation,
    score,
    reason: inverseAligned ?
    `Inverse alignment confirmed: Gold ${goldDirection}, DXY ${dxyDirection}.${correlationLabel}` :
    conflict ?
    `Inverse-correlation conflict: Gold and DXY are both ${goldDirection}; treat as SMT warning.${correlationLabel}` :
    `Gold/DXY structure is mixed; no correlation score applied.${correlationLabel}`
  };
}

export function detectGoldBos(candles: BinanceCandle[]): GoldBosResult {
  if (candles.length < 22)
  return { direction: 'NEUTRAL', level: null, timestamp: null };
  const latest = candles.at(-1)!;
  const prior = candles.slice(-22, -2);
  const priorHigh = Math.max(...prior.map((candle) => candle.high));
  const priorLow = Math.min(...prior.map((candle) => candle.low));
  if (latest.close > priorHigh)
  return { direction: 'BUY', level: priorHigh, timestamp: latest.timestamp };
  if (latest.close < priorLow)
  return { direction: 'SELL', level: priorLow, timestamp: latest.timestamp };
  return { direction: 'NEUTRAL', level: null, timestamp: latest.timestamp };
}

export function detectGoldFvg(candles: BinanceCandle[]): GoldFvgResult | null {
  for (
  let index = candles.length - 1;
  index >= Math.max(2, candles.length - 40);
  index -= 1)
  {
    const left = candles[index - 2];
    const right = candles[index];
    if (right.low > left.high) {
      return {
        direction: 'BUY',
        low: left.high,
        high: right.low,
        timestamp: right.timestamp
      };
    }
    if (right.high < left.low) {
      return {
        direction: 'SELL',
        low: right.high,
        high: left.low,
        timestamp: right.timestamp
      };
    }
  }
  return null;
}

export function buildGoldTradePlan(
direction: GoldBiasDirection,
entry: number,
candles: BinanceCandle[],
liquidity: GoldLiquidityEvent | null)
: GoldTradePlan | null {
  if (direction === 'NEUTRAL' || candles.length < 15) return null;
  const atr = averageTrueRange(candles);
  if (!atr) return null;
  const recent = candles.slice(-20);
  const structural =
  direction === 'BUY' ?
  Math.min(...recent.map((candle) => candle.low)) :
  Math.max(...recent.map((candle) => candle.high));
  const anchor =
  liquidity?.direction === direction ? liquidity.level : structural;
  const stopLoss =
  direction === 'BUY' ?
  Math.min(anchor, entry - atr * 0.8) - atr * 0.15 :
  Math.max(anchor, entry + atr * 0.8) + atr * 0.15;
  const risk = Math.abs(entry - stopLoss);
  if (!risk || !Number.isFinite(risk)) return null;
  return {
    direction,
    entry,
    stopLoss,
    takeProfit: direction === 'BUY' ? entry + risk * 2 : entry - risk * 2,
    riskReward: 2
  };
}

export function buildGoldConfirmationSteps(
direction: GoldBiasDirection,
timeframes: Record<GoldBiasTimeframe, GoldTimeframeBias>,
dxyChecks: GoldDxyCheck[],
liquidity: GoldLiquidityEvent | null,
bos: GoldBosResult,
fvg: GoldFvgResult | null)
: GoldConfirmationStep[] {
  const htf = [
  timeframes['1mo'],
  timeframes['1w'],
  timeframes['1d'],
  timeframes['4h']];

  const availableHtf = htf.filter((item) => item.available);
  const alignedHtf =
  direction === 'NEUTRAL' ?
  0 :
  availableHtf.filter(
    (item) =>
    item.direction === (direction === 'BUY' ? 'bullish' : 'bearish')
  ).length;
  const confirmedDxy = dxyChecks.filter(
    (check) => check.status === 'CONFIRMED'
  ).length;
  const conflictedDxy = dxyChecks.filter(
    (check) => check.status === 'CONFLICT'
  ).length;
  const availableDxy = dxyChecks.filter(
    (check) => check.status !== 'UNAVAILABLE'
  ).length;

  return [
  {
    number: 1,
    title: 'HTF bias · MN/W1/D1/H4',
    state:
    availableHtf.length < 2 ?
    'unavailable' :
    alignedHtf >= 3 ?
    'pass' :
    'wait',
    detail:
    availableHtf.length < 2 ?
    'Not enough real higher-timeframe Gold candles.' :
    `${alignedHtf}/${availableHtf.length} available HTFs align with ${direction}.`
  },
  {
    number: 2,
    title: 'Liquidity sweep',
    state: !liquidity ?
    'wait' :
    liquidity.direction === direction ?
    'pass' :
    'wait',
    detail: liquidity ?
    `${liquidity.label} at ${liquidity.level.toFixed(2)} supports ${liquidity.direction}.` :
    'No fresh break-and-reclaim appears in the real OHLC window.'
  },
  {
    number: 3,
    title: 'Gold vs DXY · SMT / inverse check',
    state: !availableDxy ?
    'unavailable' :
    confirmedDxy > conflictedDxy ?
    'pass' :
    'wait',
    detail: !availableDxy ?
    'Matching DXY OHLC is unavailable; no relationship is inferred.' :
    `${confirmedDxy} inverse confirmations · ${conflictedDxy} SMT conflicts across ${availableDxy} matching HTFs.`
  },
  {
    number: 4,
    title: 'M1 market structure shift / BOS',
    state:
    bos.timestamp === null ?
    'unavailable' :
    bos.direction === direction ?
    'pass' :
    'wait',
    detail:
    bos.direction === 'NEUTRAL' ?
    'No M1 close beyond the prior 20-candle range.' :
    `M1 ${bos.direction} break at ${bos.level?.toFixed(2)}.`
  },
  {
    number: 5,
    title: 'M1 fair value gap',
    state: !fvg ? 'wait' : fvg.direction === direction ? 'pass' : 'wait',
    detail: fvg ?
    `${fvg.direction} imbalance from ${fvg.low.toFixed(2)} to ${fvg.high.toFixed(2)}.` :
    'No active three-candle imbalance in the latest real M1 window.'
  }];

}

export function latestGoldLiquidity(
timeframes: Record<GoldBiasTimeframe, GoldTimeframeBias>)
: GoldLiquidityEvent | null {
  return (
    GOLD_BIAS_TIMEFRAMES.map((timeframe) => timeframes[timeframe].liquidity).
    filter((event): event is GoldLiquidityEvent => Boolean(event)).
    sort((a, b) => b.timestamp - a.timestamp)[0] ?? null);

}

export function buildGoldReasons(
timeframes: Record<GoldBiasTimeframe, GoldTimeframeBias>,
dxyChecks: GoldDxyCheck[],
direction: GoldBiasDirection)
: string[] {
  const directional = GOLD_BIAS_TIMEFRAMES.map(
    (timeframe) => timeframes[timeframe]
  ).
  filter((item) => item.available && item.direction !== 'neutral').
  sort(
    (a, b) =>
    GOLD_TIMEFRAME_WEIGHTS[b.timeframe] -
    GOLD_TIMEFRAME_WEIGHTS[a.timeframe]
  ).
  slice(0, 4).
  map(
    (item) =>
    `${item.timeframe.toUpperCase()} ${item.direction}: ${item.reason}`
  );
  const relationship =
  dxyChecks.find((check) => check.status === 'CONFLICT') ??
  dxyChecks.find((check) => check.status === 'CONFIRMED');
  return [
  direction === 'NEUTRAL' ?
  'Weighted real-market evidence is mixed; no directional trade is unlocked.' :
  `Weighted real-market evidence favors ${direction}.`,
  ...directional,
  ...(relationship ? [relationship.reason] : [])];

}

export function uniqueGoldSources(
inputs: Array<GoldCandleInput | undefined>)
: MarketCandleSource[] {
  const sources = new Map<string, MarketCandleSource>();
  inputs.forEach((input) => {
    if (input)
    sources.set(
      `${input.source.provider}:${input.source.ticker}`,
      input.source
    );
  });
  return [...sources.values()];
}

export function roundGoldScore(value: number): number {
  return roundMarketValue(value);
}

function detectStructure(candles: BinanceCandle[]): StructureDirection {
  const swings = findSwings(candles.slice(-100));
  const highs = swings.filter((swing) => swing.type === 'high').slice(-2);
  const lows = swings.filter((swing) => swing.type === 'low').slice(-2);
  if (highs.length < 2 || lows.length < 2) return 'RANGE';
  if (highs[1].price > highs[0].price && lows[1].price > lows[0].price)
  return 'HH/HL';
  if (highs[1].price < highs[0].price && lows[1].price < lows[0].price)
  return 'LH/LL';
  return 'RANGE';
}

function findSwings(candles: BinanceCandle[]) {
  const swings: Array<{type: 'high' | 'low';price: number;}> = [];
  for (let index = 2; index < candles.length - 2; index += 1) {
    const candle = candles[index];
    const window = candles.slice(index - 2, index + 3);
    if (
    window.every((item, offset) => offset === 2 || item.high < candle.high))
    {
      swings.push({ type: 'high', price: candle.high });
    }
    if (window.every((item, offset) => offset === 2 || item.low > candle.low)) {
      swings.push({ type: 'low', price: candle.low });
    }
  }
  return swings;
}

function detectLiquiditySweep(
candles: BinanceCandle[])
: GoldLiquidityEvent | null {
  const sample = candles.slice(-45);
  for (
  let index = sample.length - 1;
  index >= Math.max(20, sample.length - 4);
  index -= 1)
  {
    const candle = sample[index];
    const prior = sample.slice(Math.max(0, index - 20), index);
    const priorHigh = Math.max(...prior.map((item) => item.high));
    const priorLow = Math.min(...prior.map((item) => item.low));
    if (candle.low < priorLow && candle.close > priorLow) {
      return {
        direction: 'BUY',
        level: priorLow,
        timestamp: candle.timestamp,
        label: 'SELL-SIDE SWEEP'
      };
    }
    if (candle.high > priorHigh && candle.close < priorHigh) {
      return {
        direction: 'SELL',
        level: priorHigh,
        timestamp: candle.timestamp,
        label: 'BUY-SIDE SWEEP'
      };
    }
  }
  return null;
}

function simpleDirection(candles: BinanceCandle[]): TrendDirection {
  const closes = candles.map((candle) => candle.close);
  const price = closes.at(-1)!;
  const fast = emaLast(closes, 20);
  const slow = emaLast(closes, 50);
  return price > fast && fast > slow ?
  'bullish' :
  price < fast && fast < slow ?
  'bearish' :
  'neutral';
}