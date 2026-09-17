import type { BinanceCandle } from '../trading/marketCandles';

export type SniperDirection =
'STRONG BUY' |
'BUY' |
'NEUTRAL' |
'SELL' |
'STRONG SELL';

export type EngineId =
'ghost-wick' |
'institutional-candle' |
'accumulation' |
'inside-bar' |
'engulfing' |
'pin-bar' |
'fib' |
'order-block' |
'liquidity-grab' |
'trap' |
'sentiment' |
'mss';

export interface RetailSentiment {
  longPct: number;
  shortPct: number;
  source: 'Myfxbook';
}

export interface EngineResult {
  id: EngineId;
  name: string;
  weight: number;
  buyScore: number;
  sellScore: number;
  status: 'BUY' | 'SELL' | 'NEUTRAL' | 'UNAVAILABLE';
  reason: string;
}

export interface TrapAnalysis {
  timeframe: string;
  kind: 'BULL TRAP' | 'BEAR TRAP' | 'CLEAR' | 'UNAVAILABLE';
  action: 'BUY' | 'SELL' | null;
  level: number | null;
}

export type LiquiditySide = 'BUY-SIDE' | 'SELL-SIDE';
export type LiquidityStrength = 'POWER' | 'STRONG' | 'WATCH';
export type HuntMoveSize = 'BIG' | 'SMALL';

export interface RankedLiquidityLevel {
  price: number;
  side: LiquiditySide;
  score: number;
  strength: LiquidityStrength;
  touches: number;
  distance: number;
  timeframes: string[];
}

export interface LiquidityHuntEvent {
  side: LiquiditySide;
  reaction: 'BUY' | 'SELL';
  level: number;
  timestamp: number;
  strength: LiquidityStrength;
}

export interface LiquidityHuntForecast {
  direction: 'BUY' | 'SELL';
  targetSide: LiquiditySide;
  level: number;
  confidence: number;
  moveSize: HuntMoveSize;
  invalidation: number | null;
  reason: string;
  timeframe: string;
}

export interface TimeframeLiquidityAnalysis {
  timeframe: string;
  available: boolean;
  atr: number | null;
  buySide: RankedLiquidityLevel | null;
  sellSide: RankedLiquidityLevel | null;
  lastHunt: LiquidityHuntEvent | null;
  nextHunt: LiquidityHuntForecast | null;
}

export interface LiquidityAnalysis {
  above: number[];
  below: number[];
  target: number | null;
  targetSide: 'ABOVE' | 'BELOW' | null;
  latestGrab: 'BUY-SIDE SWEPT' | 'SELL-SIDE SWEPT' | 'NONE';
  timeframes: TimeframeLiquidityAnalysis[];
  powerLevels: RankedLiquidityLevel[];
  nextHunt: LiquidityHuntForecast | null;
}

export interface CandleSecret {
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  wbr: number;
  bodyPct: number;
  ghost: 'BUY' | 'SELL' | 'NO';
  trap: 'BULL' | 'BEAR' | 'NO';
  phase: 'STR-BUY' | 'STR-SELL' | 'ACC' | 'DIST' | 'BUY' | 'SELL';
}

export interface MarketPathStep {
  label: string;
  level: number;
  tone: 'current' | 'grab' | 'trap' | 'sweep' | 'final';
}

export interface GoldSniperAnalysis {
  direction: SniperDirection;
  confidence: number;
  buyScore: number;
  sellScore: number;
  netScore: number;
  activeScore: number;
  verdict: string;
  engines: EngineResult[];
  liquidity: LiquidityAnalysis;
  traps: TrapAnalysis[];
  candleSecrets: CandleSecret[];
  marketPath: MarketPathStep[];
  evidence: string[];
  currentPrice: number;
  primaryTimeframe: string;
  analyzedAt: number;
}

export type CandleSets = Record<string, BinanceCandle[]>;

interface CandleShape {
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bullish: boolean;
  bodyPct: number;
  upperRatio: number;
  lowerRatio: number;
}

const ENGINE_WEIGHTS: Record<EngineId, number> = {
  'ghost-wick': 8,
  'inside-bar': 4,
  engulfing: 6,
  'institutional-candle': 8,
  accumulation: 5,
  'pin-bar': 5,
  fib: 3,
  'order-block': 4,
  'liquidity-grab': 7,
  trap: 6,
  sentiment: 4,
  mss: 5
};

const ENGINE_NAMES: Record<EngineId, string> = {
  'ghost-wick': 'Ghost Wick Detector',
  'institutional-candle': 'Institutional Candle',
  accumulation: 'Accumulation / Distribution',
  'inside-bar': 'Inside Bar Breakout',
  engulfing: 'Engulfing Pattern',
  'pin-bar': 'Pin Bar Entry',
  fib: '50% Fib Retracement',
  'order-block': 'Order Block Bounce',
  'liquidity-grab': 'Liquidity Grab',
  trap: 'Bull / Bear Trap',
  sentiment: 'Sentiment Contrarian',
  mss: 'MSS / ChoCh'
};

const TRAP_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h'];

const TIMEFRAME_WEIGHT: Record<string, number> = {
  '1m': 1,
  '5m': 1.12,
  '15m': 1.28,
  '30m': 1.42,
  '1h': 1.68,
  '4h': 2
};

interface LiquidityPoint {
  price: number;
  index: number;
  timestamp: number;
}

interface TimeframeLiquidityResult {
  analysis: TimeframeLiquidityAnalysis;
  levels: RankedLiquidityLevel[];
}

export function analyzeGoldInstitutionalSniper(
candleSets: CandleSets,
primaryTimeframe = '1m',
sentiment: RetailSentiment | null = null)
: GoldSniperAnalysis {
  const candles = closedCandles(candleSets[primaryTimeframe] ?? []);
  if (candles.length < 30) {
    throw new Error('At least 30 closed real Gold candles are required for analysis.');
  }

  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const beforePrevious = candles.at(-3)!;
  const currentShape = shape(current);
  const liquidity = findLiquidity(candles, current.close);
  const multiTimeframeLiquidity = analyzeMultiTimeframeLiquidity(
    candleSets,
    current.close
  );
  const traps = TRAP_TIMEFRAMES.map((timeframe) =>
  detectTrap(closedCandles(candleSets[timeframe] ?? []), timeframe)
  );
  const results: EngineResult[] = [];

  const add = (
  id: EngineId,
  status: EngineResult['status'],
  reason: string,
  score = status === 'NEUTRAL' || status === 'UNAVAILABLE' ?
  0 :
  ENGINE_WEIGHTS[id]) =>
  {
    results.push({
      id,
      name: ENGINE_NAMES[id],
      weight: ENGINE_WEIGHTS[id],
      buyScore: status === 'BUY' ? score : 0,
      sellScore: status === 'SELL' ? score : 0,
      status,
      reason
    });
  };

  if (currentShape.lowerRatio >= 2.5 && currentShape.bullish) {
    add(
      'ghost-wick',
      'BUY',
      `Lower wick/body ratio is ${currentShape.lowerRatio.toFixed(1)}x with a bullish close.`
    );
  } else if (currentShape.upperRatio >= 2.5 && !currentShape.bullish) {
    add(
      'ghost-wick',
      'SELL',
      `Upper wick/body ratio is ${currentShape.upperRatio.toFixed(1)}x with a bearish close.`
    );
  } else {
    add(
      'ghost-wick',
      'NEUTRAL',
      'No directional wick/body ratio at or above 2.5x.'
    );
  }

  const candleStrength =
  currentShape.bodyPct > 75 ?
  'VERY STRONG' :
  currentShape.bodyPct > 55 ?
  'STRONG' :
  currentShape.bodyPct > 30 ?
  'MODERATE' :
  'WEAK';
  if (candleStrength === 'VERY STRONG') {
    add(
      'institutional-candle',
      currentShape.bullish ? 'BUY' : 'SELL',
      `${candleStrength} ${currentShape.bullish ? 'bullish' : 'bearish'} body at ${currentShape.bodyPct.toFixed(1)}% of range.`,
      8
    );
  } else if (candleStrength === 'STRONG') {
    add(
      'institutional-candle',
      currentShape.bullish ? 'BUY' : 'SELL',
      `${candleStrength} ${currentShape.bullish ? 'bullish' : 'bearish'} body at ${currentShape.bodyPct.toFixed(1)}% of range.`,
      4
    );
  } else {
    add(
      'institutional-candle',
      'NEUTRAL',
      `${candleStrength} body at ${currentShape.bodyPct.toFixed(1)}% of range.`
    );
  }

  const pressure = volumePressure(candles.slice(-20));
  if (pressure.buyPct >= 60) {
    add(
      'accumulation',
      'BUY',
      `Directional volume proxy shows ${pressure.buyPct.toFixed(0)}% accumulation.`
    );
  } else if (pressure.sellPct >= 60) {
    add(
      'accumulation',
      'SELL',
      `Directional volume proxy shows ${pressure.sellPct.toFixed(0)}% distribution.`
    );
  } else {
    add(
      'accumulation',
      'NEUTRAL',
      `Volume proxy is balanced: ${pressure.buyPct.toFixed(0)}% buy / ${pressure.sellPct.toFixed(0)}% sell.`
    );
  }

  const insideBar =
  previous.high <= beforePrevious.high && previous.low >= beforePrevious.low;
  if (insideBar && current.close > previous.high) {
    add(
      'inside-bar',
      'BUY',
      'Inside-bar high broke with a close above the range.'
    );
  } else if (insideBar && current.close < previous.low) {
    add(
      'inside-bar',
      'SELL',
      'Inside-bar low broke with a close below the range.'
    );
  } else {
    add(
      'inside-bar',
      'NEUTRAL',
      insideBar ?
      'Inside bar is active; breakout remains pending.' :
      'No completed inside-bar breakout.'
    );
  }

  const bullishEngulf =
  previous.close < previous.open &&
  current.close > current.open &&
  current.open <= previous.close &&
  current.close >= previous.open;
  const bearishEngulf =
  previous.close > previous.open &&
  current.close < current.open &&
  current.open >= previous.close &&
  current.close <= previous.open;
  if (bullishEngulf) {
    add(
      'engulfing',
      'BUY',
      'Bullish body fully engulfed the previous bearish body.'
    );
  } else if (bearishEngulf) {
    add(
      'engulfing',
      'SELL',
      'Bearish body fully engulfed the previous bullish body.'
    );
  } else {
    add('engulfing', 'NEUTRAL', 'No full body engulfing pattern.');
  }

  const atr = averageTrueRange(candles);
  const nearBelow =
  liquidity.below[0] !== undefined &&
  Math.abs(current.low - liquidity.below[0]) <= atr * 0.5;
  const nearAbove =
  liquidity.above[0] !== undefined &&
  Math.abs(current.high - liquidity.above[0]) <= atr * 0.5;
  if (
  currentShape.lowerRatio >= 2.5 &&
  currentShape.bodyPct <= 40 &&
  nearBelow)
  {
    add(
      'pin-bar',
      'BUY',
      'Small-body bullish pin bar rejected liquidity below.'
    );
  } else if (
  currentShape.upperRatio >= 2.5 &&
  currentShape.bodyPct <= 40 &&
  nearAbove)
  {
    add(
      'pin-bar',
      'SELL',
      'Small-body bearish pin bar rejected liquidity above.'
    );
  } else {
    add('pin-bar', 'NEUTRAL', 'No small-body 2.5x pin bar at nearby liquidity.');
  }

  const swingWindow = candles.slice(-30);
  const swingHigh = Math.max(...swingWindow.map((c) => c.high));
  const swingLow = Math.min(...swingWindow.map((c) => c.low));
  const fibMid = (swingHigh + swingLow) / 2;
  const fibNear = Math.abs(current.close - fibMid) <= Math.max(atr * 0.35, 0.12);
  const trend = trendDirection(candleSets);
  if (fibNear && trend !== 'NEUTRAL') {
    add(
      'fib',
      trend === 'BULLISH' ? 'BUY' : 'SELL',
      `Price is testing the 50% retracement at ${formatPrice(fibMid)} with ${trend.toLowerCase()} structure.`
    );
  } else {
    add(
      'fib',
      'NEUTRAL',
      `50% retracement is ${formatPrice(fibMid)}; no aligned test is active.`
    );
  }

  const priorThree = candles.slice(-4, -1);
  const threeBearish = priorThree.every((c) => c.close < c.open);
  const threeBullish = priorThree.every((c) => c.close > c.open);
  if (
  threeBearish &&
  current.close > current.open &&
  current.close > previous.high)
  {
    add(
      'order-block',
      'BUY',
      'Three bearish candles formed demand before bullish displacement.'
    );
  } else if (
  threeBullish &&
  current.close < current.open &&
  current.close < previous.low)
  {
    add(
      'order-block',
      'SELL',
      'Three bullish candles formed supply before bearish displacement.'
    );
  } else {
    add(
      'order-block',
      'NEUTRAL',
      'No confirmed three-candle order-block reversal.'
    );
  }

  const priorRange = candles.slice(-24, -2);
  const priorHigh = Math.max(...priorRange.map((c) => c.high));
  const priorLow = Math.min(...priorRange.map((c) => c.low));
  const sellSideGrab = current.low < priorLow && current.close > priorLow;
  const buySideGrab = current.high > priorHigh && current.close < priorHigh;
  if (sellSideGrab) {
    add(
      'liquidity-grab',
      'BUY',
      'Sell-side liquidity broke and closed back above the swing low.'
    );
  } else if (buySideGrab) {
    add(
      'liquidity-grab',
      'SELL',
      'Buy-side liquidity broke and closed back below the swing high.'
    );
  } else {
    add('liquidity-grab', 'NEUTRAL', 'No fresh swing break and reclaim.');
  }

  const actionableTrap = traps.find((trap) => trap.action);
  if (actionableTrap?.action === 'BUY') {
    add(
      'trap',
      'BUY',
      `${actionableTrap.timeframe.toUpperCase()} bear trap closed back above support.`
    );
  } else if (actionableTrap?.action === 'SELL') {
    add(
      'trap',
      'SELL',
      `${actionableTrap.timeframe.toUpperCase()} bull trap closed back below resistance.`
    );
  } else {
    add(
      'trap',
      'NEUTRAL',
      'No actionable trap across the six requested timeframes.'
    );
  }

  if (!sentiment) {
    add(
      'sentiment',
      'UNAVAILABLE',
      'Myfxbook could not be reached; no sentiment score was applied.'
    );
  } else if (sentiment.shortPct >= 60) {
    add(
      'sentiment',
      'BUY',
      `${sentiment.shortPct.toFixed(0)}% retail shorts create a contrarian buy bias.`
    );
  } else if (sentiment.longPct >= 60) {
    add(
      'sentiment',
      'SELL',
      `${sentiment.longPct.toFixed(0)}% retail longs create a contrarian sell bias.`
    );
  } else {
    add(
      'sentiment',
      'NEUTRAL',
      `Retail positioning is balanced: ${sentiment.longPct.toFixed(0)}% long / ${sentiment.shortPct.toFixed(0)}% short.`
    );
  }

  const structureRange = candles.slice(-44, -2);
  const structureHigh = Math.max(...structureRange.map((c) => c.high));
  const structureLow = Math.min(...structureRange.map((c) => c.low));
  if (current.close > structureHigh && previous.close <= structureHigh) {
    add('mss', 'BUY', 'Bullish MSS/ChoCh closed above established structure.');
  } else if (current.close < structureLow && previous.close >= structureLow) {
    add('mss', 'SELL', 'Bearish MSS/ChoCh closed below established structure.');
  } else {
    add('mss', 'NEUTRAL', 'No fresh close beyond established market structure.');
  }

  const buyScore = results.reduce((sum, item) => sum + item.buyScore, 0);
  const sellScore = results.reduce((sum, item) => sum + item.sellScore, 0);
  const netScore = buyScore - sellScore;
  const activeScore = buyScore + sellScore;
  const confidence =
  activeScore > 0 ?
  Math.min(100, Math.round(Math.abs(netScore) / activeScore * 100)) :
  0;
  const direction = directionFromNet(netScore);
  const completedLiquidity: LiquidityAnalysis = {
    ...liquidity,
    latestGrab: sellSideGrab ?
    'SELL-SIDE SWEPT' :
    buySideGrab ?
    'BUY-SIDE SWEPT' :
    'NONE',
    timeframes: multiTimeframeLiquidity.timeframes,
    powerLevels: multiTimeframeLiquidity.powerLevels,
    nextHunt: multiTimeframeLiquidity.nextHunt
  };

  return {
    direction,
    confidence,
    buyScore,
    sellScore,
    netScore,
    activeScore,
    verdict: verdictFor(direction),
    engines: results,
    liquidity: completedLiquidity,
    traps,
    candleSecrets: buildCandleSecrets(candles),
    marketPath: buildMarketPath(current.close, completedLiquidity),
    evidence: results.
    filter((item) => item.status === 'BUY' || item.status === 'SELL').
    map((item) => `${item.name}: ${item.reason}`),
    currentPrice: current.close,
    primaryTimeframe,
    analyzedAt: Date.now()
  };
}

function shape(candle: BinanceCandle): CandleShape {
  const rawBody = Math.abs(candle.close - candle.open);
  const body = Math.max(rawBody, Number.EPSILON);
  const range = Math.max(candle.high - candle.low, Number.EPSILON);
  const upperWick = Math.max(
    0,
    candle.high - Math.max(candle.open, candle.close)
  );
  const lowerWick = Math.max(
    0,
    Math.min(candle.open, candle.close) - candle.low
  );
  return {
    body,
    range,
    upperWick,
    lowerWick,
    bullish: candle.close >= candle.open,
    bodyPct: rawBody / range * 100,
    upperRatio: upperWick / body,
    lowerRatio: lowerWick / body
  };
}

function volumePressure(candles: BinanceCandle[]) {
  const hasVolume = candles.some((c) => c.volume > 0);
  let buy = 0;
  let sell = 0;
  candles.forEach((c) => {
    const candleShape = shape(c);
    const proxy = hasVolume ?
    Math.max(c.volume, 0) :
    candleShape.range * (1 + candleShape.bodyPct / 100);
    if (c.close >= c.open) buy += proxy;else
    sell += proxy;
  });
  const total = buy + sell;
  return total > 0 ?
  { buyPct: buy / total * 100, sellPct: sell / total * 100 } :
  { buyPct: 50, sellPct: 50 };
}

function closedCandles(candles: BinanceCandle[]): BinanceCandle[] {
  const unique = new Map<number, BinanceCandle>();
  candles.forEach((candle) => {
    const valid =
    candle.isClosed !== false &&
    Number.isFinite(candle.timestamp) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close);
    if (valid) unique.set(candle.timestamp, candle);
  });
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function analyzeMultiTimeframeLiquidity(
candleSets: CandleSets,
currentPrice: number)
: Pick<LiquidityAnalysis, 'timeframes' | 'powerLevels' | 'nextHunt'> {
  const results = TRAP_TIMEFRAMES.map((timeframe) =>
  analyzeTimeframeLiquidity(
    closedCandles(candleSets[timeframe] ?? []),
    timeframe,
    currentPrice
  )
  );
  const timeframes = results.map((result) => result.analysis);
  const powerLevels = mergePowerLevels(
    results.flatMap((result) => result.levels),
    currentPrice
  );
  const forecasts = timeframes.flatMap((item) =>
  item.nextHunt ? [item.nextHunt] : []
  );
  if (!forecasts.length) return { timeframes, powerLevels, nextHunt: null };

  const directionWeight = (direction: 'BUY' | 'SELL') =>
  forecasts.
  filter((forecast) => forecast.direction === direction).
  reduce(
    (sum, forecast) =>
    sum + forecast.confidence * (TIMEFRAME_WEIGHT[forecast.timeframe] ?? 1),
    0
  );
  const buyWeight = directionWeight('BUY');
  const sellWeight = directionWeight('SELL');
  const direction: 'BUY' | 'SELL' = buyWeight >= sellWeight ? 'BUY' : 'SELL';
  const aligned = forecasts.filter((forecast) => forecast.direction === direction);
  const selected = [...aligned].sort(
    (a, b) =>
    b.confidence * (TIMEFRAME_WEIGHT[b.timeframe] ?? 1) -
    a.confidence * (TIMEFRAME_WEIGHT[a.timeframe] ?? 1)
  )[0];
  const totalWeight = buyWeight + sellWeight;
  const agreement = totalWeight ?
  Math.max(buyWeight, sellWeight) / totalWeight :
  0;
  const coverage = timeframes.filter((item) => item.available).length / TRAP_TIMEFRAMES.length;
  const confidence = Math.round(
    Math.min(
      94,
      selected.confidence * 0.55 + agreement * 30 + coverage * 15
    )
  );

  return {
    timeframes,
    powerLevels,
    nextHunt: {
      ...selected,
      confidence,
      moveSize:
      selected.moveSize === 'BIG' ||
      aligned.some(
        (forecast) =>
        forecast.moveSize === 'BIG' &&
        (TIMEFRAME_WEIGHT[forecast.timeframe] ?? 1) >= 1.68
      ) ?
      'BIG' :
      'SMALL',
      reason: `${aligned.length}/${forecasts.length} timeframe hunts align ${direction}; ${selected.timeframe.toUpperCase()} carries the strongest weighted target.`
    }
  };
}

function analyzeTimeframeLiquidity(
candles: BinanceCandle[],
timeframe: string,
displayPrice: number)
: TimeframeLiquidityResult {
  if (candles.length < 30) {
    return {
      analysis: {
        timeframe,
        available: false,
        atr: null,
        buySide: null,
        sellSide: null,
        lastHunt: null,
        nextHunt: null
      },
      levels: []
    };
  }

  const sample = candles.slice(-180);
  const candlePrice = sample.at(-1)!.close;
  const atr = Math.max(averageTrueRange(sample), candlePrice * 0.00005);
  const tolerance = Math.max(atr * 0.22, candlePrice * 0.00004);
  const highs: LiquidityPoint[] = [];
  const lows: LiquidityPoint[] = [];
  for (let index = 2; index < sample.length - 2; index++) {
    const window = sample.slice(index - 2, index + 3);
    const candle = sample[index];
    if (candle.high === Math.max(...window.map((item) => item.high))) {
      highs.push({ price: candle.high, index, timestamp: candle.timestamp });
    }
    if (candle.low === Math.min(...window.map((item) => item.low))) {
      lows.push({ price: candle.low, index, timestamp: candle.timestamp });
    }
  }

  const levels = [
  ...rankLiquidityPoints(
    highs.filter((point) => point.price > candlePrice),
    'BUY-SIDE',
    timeframe,
    sample.length,
    candlePrice,
    atr,
    tolerance
  ),
  ...rankLiquidityPoints(
    lows.filter((point) => point.price < candlePrice),
    'SELL-SIDE',
    timeframe,
    sample.length,
    candlePrice,
    atr,
    tolerance
  )];

  const buySide = bestLevel(levels, 'BUY-SIDE');
  const sellSide = bestLevel(levels, 'SELL-SIDE');
  const lastHunt = findLatestHunt(sample, atr);
  const nextHunt = forecastTimeframeHunt(
    timeframe,
    candlePrice,
    atr,
    buySide,
    sellSide,
    lastHunt
  );
  const displayOffset = displayPrice - candlePrice;
  const mapLevel = (level: RankedLiquidityLevel | null) =>
  level ? { ...level, price: level.price + displayOffset } : null;
  const mappedBuySide = mapLevel(buySide);
  const mappedSellSide = mapLevel(sellSide);
  const mappedLastHunt = lastHunt ?
  { ...lastHunt, level: lastHunt.level + displayOffset } :
  null;
  const mappedNextHunt = nextHunt ?
  {
    ...nextHunt,
    level: nextHunt.level + displayOffset,
    invalidation:
    nextHunt.invalidation === null ?
    null :
    nextHunt.invalidation + displayOffset
  } :
  null;

  return {
    analysis: {
      timeframe,
      available: true,
      atr,
      buySide: mappedBuySide,
      sellSide: mappedSellSide,
      lastHunt: mappedLastHunt,
      nextHunt: mappedNextHunt
    },
    levels: levels.map((level) => ({
      ...level,
      price: level.price + displayOffset,
      distance: Math.abs(level.price + displayOffset - displayPrice)
    }))
  };
}

function rankLiquidityPoints(
points: LiquidityPoint[],
side: LiquiditySide,
timeframe: string,
sampleLength: number,
currentPrice: number,
atr: number,
tolerance: number)
: RankedLiquidityLevel[] {
  if (!points.length) return [];
  const groups: LiquidityPoint[][] = [];
  [...points].
  sort((a, b) => a.price - b.price).
  forEach((point) => {
    const group = groups.at(-1);
    if (!group) {
      groups.push([point]);
      return;
    }
    const average =
    group.reduce((sum, item) => sum + item.price, 0) / group.length;
    if (Math.abs(point.price - average) <= tolerance) group.push(point);else
    groups.push([point]);
  });

  return groups.
  map((group) => {
    const price = group.reduce((sum, item) => sum + item.price, 0) / group.length;
    const touches = group.length;
    const latestIndex = Math.max(...group.map((item) => item.index));
    const recency = Math.max(0, 1 - (sampleLength - latestIndex) / sampleLength);
    const distanceAtr = Math.abs(price - currentPrice) / atr;
    const proximity = Math.max(0, 1 - Math.min(distanceAtr, 8) / 8);
    const timeframePower = (TIMEFRAME_WEIGHT[timeframe] ?? 1) / 2;
    const score = Math.round(
      Math.min(
        99,
        24 +
        Math.min(touches, 5) * 10 +
        recency * 18 +
        proximity * 10 +
        timeframePower * 12
      )
    );
    return {
      price,
      side,
      score,
      strength: strengthFromScore(score),
      touches,
      distance: Math.abs(price - currentPrice),
      timeframes: [timeframe]
    };
  }).
  sort((a, b) => b.score - a.score || a.distance - b.distance).
  slice(0, 4);
}

function bestLevel(
levels: RankedLiquidityLevel[],
side: LiquiditySide)
: RankedLiquidityLevel | null {
  return levels.find((level) => level.side === side) ?? null;
}

function findLatestHunt(
candles: BinanceCandle[],
atr: number)
: LiquidityHuntEvent | null {
  const start = Math.max(20, candles.length - 14);
  for (let index = candles.length - 1; index >= start; index--) {
    const prior = candles.slice(Math.max(0, index - 20), index);
    if (prior.length < 12) continue;
    const candle = candles[index];
    const priorHigh = Math.max(...prior.map((item) => item.high));
    const priorLow = Math.min(...prior.map((item) => item.low));
    const buySideSweep =
    candle.high > priorHigh + atr * 0.025 && candle.close < priorHigh;
    const sellSideSweep =
    candle.low < priorLow - atr * 0.025 && candle.close > priorLow;
    if (!buySideSweep && !sellSideSweep) continue;
    const side: LiquiditySide = buySideSweep ? 'BUY-SIDE' : 'SELL-SIDE';
    const level = buySideSweep ? priorHigh : priorLow;
    const rejection = buySideSweep ?
    (candle.high - Math.max(candle.open, candle.close)) / atr :
    (Math.min(candle.open, candle.close) - candle.low) / atr;
    const score = Math.round(Math.min(99, 58 + rejection * 24));
    return {
      side,
      reaction: buySideSweep ? 'SELL' : 'BUY',
      level,
      timestamp: candle.timestamp,
      strength: strengthFromScore(score)
    };
  }
  return null;
}

function forecastTimeframeHunt(
timeframe: string,
currentPrice: number,
atr: number,
buySide: RankedLiquidityLevel | null,
sellSide: RankedLiquidityLevel | null,
lastHunt: LiquidityHuntEvent | null)
: LiquidityHuntForecast | null {
  const candidates = [buySide, sellSide].filter(
    (level): level is RankedLiquidityLevel => level !== null
  );
  if (!candidates.length) return null;
  const attraction = (level: RankedLiquidityLevel) => {
    const distanceAtr = level.distance / atr;
    const proximity = Math.max(0, 30 - Math.min(distanceAtr, 6) * 5);
    const rotationBoost =
    lastHunt && lastHunt.side !== level.side ? 10 : lastHunt ? -4 : 0;
    return level.score + proximity + rotationBoost;
  };
  const target = [...candidates].sort((a, b) => attraction(b) - attraction(a))[0];
  const direction: 'BUY' | 'SELL' = target.side === 'BUY-SIDE' ? 'BUY' : 'SELL';
  const opposite = target.side === 'BUY-SIDE' ? sellSide : buySide;
  const distanceAtr = target.distance / atr;
  const confidence = Math.round(
    Math.min(92, 38 + target.score * 0.42 + (lastHunt ? 8 : 0))
  );
  return {
    direction,
    targetSide: target.side,
    level: target.price,
    confidence,
    moveSize:
    distanceAtr >= 1.35 ||
    target.strength === 'POWER' && (TIMEFRAME_WEIGHT[timeframe] ?? 1) >= 1.68 ?
    'BIG' :
    'SMALL',
    invalidation:
    opposite?.price ??
    currentPrice + (direction === 'BUY' ? -atr * 0.8 : atr * 0.8),
    reason: `${target.strength} ${target.side.toLowerCase()} pool, ${distanceAtr.toFixed(1)} ATR away with ${target.touches} confirmed touch${target.touches === 1 ? '' : 'es'}.`,
    timeframe
  };
}

function mergePowerLevels(
levels: RankedLiquidityLevel[],
currentPrice: number)
: RankedLiquidityLevel[] {
  const tolerance = Math.max(currentPrice * 0.00008, 0.12);
  const merged: RankedLiquidityLevel[] = [];
  [...levels].
  sort((a, b) => a.price - b.price).
  forEach((level) => {
    const existing = merged.find(
      (item) =>
      item.side === level.side && Math.abs(item.price - level.price) <= tolerance
    );
    if (!existing) {
      merged.push({ ...level });
      return;
    }
    const totalTouches = existing.touches + level.touches;
    existing.price =
    (existing.price * existing.touches + level.price * level.touches) /
    totalTouches;
    existing.touches = totalTouches;
    existing.timeframes = [...new Set([...existing.timeframes, ...level.timeframes])];
    existing.score = Math.min(
      99,
      Math.max(existing.score, level.score) +
      Math.min(18, (existing.timeframes.length - 1) * 7)
    );
    existing.strength = strengthFromScore(existing.score);
    existing.distance = Math.abs(existing.price - currentPrice);
  });
  return merged.
  sort((a, b) => b.score - a.score || a.distance - b.distance).
  slice(0, 6);
}

function strengthFromScore(score: number): LiquidityStrength {
  return score >= 80 ? 'POWER' : score >= 62 ? 'STRONG' : 'WATCH';
}

function findLiquidity(
candles: BinanceCandle[],
currentPrice: number)
: Pick<LiquidityAnalysis, 'above' | 'below' | 'target' | 'targetSide'> {
  const sample = candles.slice(-100);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 4; i < sample.length - 4; i++) {
    const neighborhood = sample.slice(i - 4, i + 5);
    if (sample[i].high === Math.max(...neighborhood.map((c) => c.high))) {
      highs.push(sample[i].high);
    }
    if (sample[i].low === Math.min(...neighborhood.map((c) => c.low))) {
      lows.push(sample[i].low);
    }
  }
  const above = cluster(
    highs.filter((price) => price > currentPrice),
    0.12
  ).
  sort((a, b) => a - b).
  slice(0, 4);
  const below = cluster(
    lows.filter((price) => price < currentPrice),
    0.12
  ).
  sort((a, b) => b - a).
  slice(0, 4);
  const nearestAbove = above[0] ?? null;
  const nearestBelow = below[0] ?? null;
  const aboveDistance =
  nearestAbove === null ?
  Number.POSITIVE_INFINITY :
  nearestAbove - currentPrice;
  const belowDistance =
  nearestBelow === null ?
  Number.POSITIVE_INFINITY :
  currentPrice - nearestBelow;
  const target = aboveDistance < belowDistance ? nearestAbove : nearestBelow;
  return {
    above,
    below,
    target,
    targetSide:
    target === null ? null : target === nearestAbove ? 'ABOVE' : 'BELOW'
  };
}

function cluster(values: number[], tolerance: number): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  sorted.slice(1).forEach((value) => {
    const group = groups.at(-1)!;
    const average = group.reduce((sum, item) => sum + item, 0) / group.length;
    if (Math.abs(value - average) <= tolerance) group.push(value);else
    groups.push([value]);
  });
  return groups.map(
    (group) => group.reduce((sum, item) => sum + item, 0) / group.length
  );
}

function detectTrap(
candles: BinanceCandle[] | undefined,
timeframe: string)
: TrapAnalysis {
  if (!candles || candles.length < 24) {
    return { timeframe, kind: 'UNAVAILABLE', action: null, level: null };
  }
  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const prior = candles.slice(-24, -2);
  const resistance = Math.max(...prior.map((c) => c.high));
  const support = Math.min(...prior.map((c) => c.low));
  if (previous.high > resistance && current.close < resistance) {
    return {
      timeframe,
      kind: 'BULL TRAP',
      action: 'SELL',
      level: resistance
    };
  }
  if (previous.low < support && current.close > support) {
    return {
      timeframe,
      kind: 'BEAR TRAP',
      action: 'BUY',
      level: support
    };
  }
  return { timeframe, kind: 'CLEAR', action: null, level: null };
}

function buildCandleSecrets(candles: BinanceCandle[]): CandleSecret[] {
  return candles.slice(-10).map((candle, index, sample) => {
    const candleShape = shape(candle);
    const ghost =
    candleShape.lowerRatio >= 2.5 && candleShape.bullish ?
    'BUY' :
    candleShape.upperRatio >= 2.5 && !candleShape.bullish ?
    'SELL' :
    'NO';
    const prior = index > 1 ? sample.slice(0, index - 1) : [];
    const resistance = prior.length ?
    Math.max(...prior.map((item) => item.high)) :
    null;
    const support = prior.length ?
    Math.min(...prior.map((item) => item.low)) :
    null;
    const trap =
    resistance !== null &&
    candle.high > resistance &&
    candle.close < resistance ?
    'BULL' :
    support !== null && candle.low < support && candle.close > support ?
    'BEAR' :
    'NO';
    const hidden = candleShape.bodyPct < 18 && candleShape.range > 0;
    const phase: CandleSecret['phase'] =
    candleShape.bodyPct > 75 ?
    candleShape.bullish ?
    'STR-BUY' :
    'STR-SELL' :
    hidden ?
    candleShape.bullish ?
    'ACC' :
    'DIST' :
    candleShape.bullish ?
    'BUY' :
    'SELL';
    return {
      timestamp: candle.timestamp,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      wbr: Math.max(candleShape.upperRatio, candleShape.lowerRatio),
      bodyPct: candleShape.bodyPct,
      ghost,
      trap,
      phase
    };
  });
}

function buildMarketPath(
currentPrice: number,
liquidity: LiquidityAnalysis)
: MarketPathStep[] {
  const above = liquidity.above[0];
  const below = liquidity.below[0];
  if (above === undefined && below === undefined) return [];
  const grabAbove =
  below === undefined ||
  above !== undefined && above - currentPrice < currentPrice - below;
  const grab = grabAbove ? above : below;
  const opposite = grabAbove ? below : above;
  if (grab === undefined) return [];
  const rejection = currentPrice + (currentPrice - grab) * 0.3;
  const sweep = opposite ?? rejection + (rejection - grab);
  const final = sweep + (sweep - grab) * 0.35;
  return [
  { label: 'Current Price', level: currentPrice, tone: 'current' },
  {
    label: `Liquidity Grab ${grabAbove ? 'Above' : 'Below'}`,
    level: grab,
    tone: 'grab'
  },
  { label: 'Fake Breakout Rejection', level: rejection, tone: 'trap' },
  {
    label: `Final Sweep ${grabAbove ? 'Below' : 'Above'}`,
    level: sweep,
    tone: 'sweep'
  },
  {
    label: `Real Direction — ${grabAbove ? 'SELL' : 'BUY'}`,
    level: final,
    tone: 'final'
  }];

}

function averageTrueRange(candles: BinanceCandle[]): number {
  const sample = candles.slice(-15);
  if (sample.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < sample.length; i++) {
    total += Math.max(
      sample[i].high - sample[i].low,
      Math.abs(sample[i].high - sample[i - 1].close),
      Math.abs(sample[i].low - sample[i - 1].close)
    );
  }
  return total / (sample.length - 1);
}

function trendDirection(
candleSets: CandleSets)
: 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  let bullish = 0;
  let bearish = 0;
  ['5m', '15m', '30m', '1h', '4h'].forEach((timeframe) => {
    const candles = candleSets[timeframe] ?? [];
    if (candles.length < 20) return;
    const closes = candles.map((c) => c.close);
    const fast = emaLast(closes, 9);
    const slow = emaLast(closes, 20);
    if (closes.at(-1)! > fast && fast > slow) bullish += 1;
    if (closes.at(-1)! < fast && fast < slow) bearish += 1;
  });
  return bullish >= 3 ? 'BULLISH' : bearish >= 3 ? 'BEARISH' : 'NEUTRAL';
}

function emaLast(values: number[], period: number): number {
  if (!values.length) return 0;
  const multiplier = 2 / (period + 1);
  return values.
  slice(1).
  reduce(
    (value, item) => item * multiplier + value * (1 - multiplier),
    values[0]
  );
}

function directionFromNet(netScore: number): SniperDirection {
  if (netScore > 18) return 'STRONG BUY';
  if (netScore > 10) return 'BUY';
  if (netScore < -18) return 'STRONG SELL';
  if (netScore < -10) return 'SELL';
  return 'NEUTRAL';
}

function verdictFor(direction: SniperDirection): string {
  if (direction === 'STRONG BUY')
  return 'High-conviction buy bias across active engines.';
  if (direction === 'BUY')
  return 'Moderate buy bias; wait for entry confirmation.';
  if (direction === 'STRONG SELL')
  return 'High-conviction sell bias across active engines.';
  if (direction === 'SELL')
  return 'Moderate sell bias; wait for entry confirmation.';
  return 'No decisive edge. Preserve capital until structure confirms.';
}

export function formatPrice(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ?
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) :
  '—';
}