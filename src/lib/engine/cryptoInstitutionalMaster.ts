import type { BinanceCandle } from '../trading/binanceWebSocket';

export const CRYPTO_TIMEFRAMES = [
'1m',
'5m',
'15m',
'30m',
'1h',
'4h',
'1d'] as
const;

export type CryptoTimeframe = (typeof CRYPTO_TIMEFRAMES)[number];
export type CryptoDirection =
'STRONG BUY' |
'BUY' |
'NEUTRAL' |
'SELL' |
'STRONG SELL';
export type CryptoEngineStatus = 'BUY' | 'SELL' | 'NEUTRAL' | 'UNAVAILABLE';
export type CryptoCandleSets = Partial<Record<CryptoTimeframe, BinanceCandle[]>>;

export interface CryptoTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
  closeTime: number;
}

export interface CryptoDepthLevel {
  price: number;
  quantity: number;
  notional: number;
}

export interface CryptoDepth {
  bids: CryptoDepthLevel[];
  asks: CryptoDepthLevel[];
}

export interface CryptoAggregateTrade {
  price: number;
  quantity: number;
  quoteValue: number;
  time: number;
  buyerMaker: boolean;
}

export interface CryptoFearGreed {
  value: number;
  classification: string;
  timestamp: number;
}

export type CryptoEngineId =
'whale' |
'liquidity-grab' |
'trap' |
'order-flow' |
'fear-greed' |
'liquidation' |
'ghost-wick' |
'institutional-candle' |
'market-structure' |
'smart-money';

export interface CryptoEngineResult {
  id: CryptoEngineId;
  name: string;
  weight: number;
  buyScore: number;
  sellScore: number;
  status: CryptoEngineStatus;
  reason: string;
  source: string;
}

export interface CryptoTrap {
  timeframe: CryptoTimeframe;
  kind: 'BULL TRAP' | 'BEAR TRAP' | 'CLEAR' | 'UNAVAILABLE';
  action: 'BUY' | 'SELL' | null;
  level: number | null;
}

export interface CryptoLiquidity {
  above: CryptoDepthLevel[];
  below: CryptoDepthLevel[];
  target: number | null;
  targetSide: 'ABOVE' | 'BELOW' | null;
  latestGrab: 'BUY-SIDE SWEPT' | 'SELL-SIDE SWEPT' | 'NONE';
}

export interface CryptoWhaleStats {
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  largeBuyUsd: number;
  largeSellUsd: number;
  netUsd: number;
  largeTradeCount: number;
  thresholdUsd: number;
  largestTradeUsd: number;
}

export interface CryptoOrderFlow {
  buyPercent: number;
  sellPercent: number;
  deltaUsd: number;
  takerBuyUsd: number;
  takerSellUsd: number;
}

export interface CryptoCandleSecret {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  wbr: number;
  bodyPct: number;
  ghost: 'BUY' | 'SELL' | 'NO';
  trap: 'BULL' | 'BEAR' | 'NO';
  phase: 'STR-BUY' | 'STR-SELL' | 'ACC' | 'DIST' | 'BUY' | 'SELL';
}

export interface CryptoEntry {
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  stopPercent: number;
  targets: Array<{label: string;price: number;rr: number;}>;
}

export interface CryptoPathStep {
  label: string;
  level: number;
  tone: 'current' | 'grab' | 'rejection' | 'sweep' | 'final';
}

export interface CryptoInstitutionalAnalysis {
  symbol: string;
  direction: CryptoDirection;
  confidence: number;
  buyScore: number;
  sellScore: number;
  netScore: number;
  activeScore: number;
  verdict: string;
  price: number;
  ticker: CryptoTicker;
  fearGreed: CryptoFearGreed | null;
  whale: CryptoWhaleStats;
  orderFlow: CryptoOrderFlow;
  liquidity: CryptoLiquidity;
  traps: CryptoTrap[];
  engines: CryptoEngineResult[];
  candleSecrets: CryptoCandleSecret[];
  entry: CryptoEntry | null;
  path: CryptoPathStep[];
  evidence: string[];
  analyzedAt: number;
}

export interface CryptoAnalysisInput {
  symbol: string;
  ticker: CryptoTicker;
  candles: CryptoCandleSets;
  depth: CryptoDepth;
  trades: CryptoAggregateTrade[];
  fearGreed: CryptoFearGreed | null;
}

const WEIGHTS: Record<CryptoEngineId, number> = {
  whale: 10,
  'liquidity-grab': 8,
  trap: 8,
  'order-flow': 7,
  'fear-greed': 6,
  liquidation: 7,
  'ghost-wick': 6,
  'institutional-candle': 5,
  'market-structure': 6,
  'smart-money': 8
};

const NAMES: Record<CryptoEngineId, string> = {
  whale: 'Whale Accumulation',
  'liquidity-grab': 'Liquidity Grab',
  trap: 'Bull / Bear Trap',
  'order-flow': 'CVD / Order Flow',
  'fear-greed': 'Fear & Greed Contrarian',
  liquidation: 'Liquidation Hunt Proxy',
  'ghost-wick': 'Ghost Wick',
  'institutional-candle': 'Institutional Candle',
  'market-structure': 'Market Structure',
  'smart-money': 'Smart Money Positioning'
};

export function analyzeCryptoInstitutionalMaster(
input: CryptoAnalysisInput)
: CryptoInstitutionalAnalysis {
  const primary = input.candles['1m'] ?? [];
  if (primary.length < 30) {
    throw new Error('At least 30 real Binance 1m candles are required.');
  }

  const price = input.ticker.lastPrice || primary.at(-1)!.close;
  const traps = CRYPTO_TIMEFRAMES.map((timeframe) =>
  detectTrap(input.candles[timeframe], timeframe)
  );
  const orderFlow = analyzeTrades(input.trades);
  const whale = analyzeWhales(input.trades, input.symbol);
  const liquidity = analyzeLiquidity(input.depth, primary, price);
  const current = primary.at(-1)!;
  const currentShape = candleShape(current);
  const engines: CryptoEngineResult[] = [];

  const add = (
  id: CryptoEngineId,
  status: CryptoEngineStatus,
  reason: string,
  source: string) =>
  {
    const score = status === 'BUY' || status === 'SELL' ? WEIGHTS[id] : 0;
    engines.push({
      id,
      name: NAMES[id],
      weight: WEIGHTS[id],
      buyScore: status === 'BUY' ? score : 0,
      sellScore: status === 'SELL' ? score : 0,
      status,
      reason,
      source
    });
  };

  if (whale.signal === 'BULLISH') {
    add(
      'whale',
      'BUY',
      `${formatCompactUsd(whale.largeBuyUsd)} large taker buys exceed large sells by ${formatCompactUsd(Math.abs(whale.netUsd))}.`,
      'Binance aggregate trades · ≥$1M or ≥100 BTC filter'
    );
  } else if (whale.signal === 'BEARISH') {
    add(
      'whale',
      'SELL',
      `${formatCompactUsd(whale.largeSellUsd)} large taker sells exceed large buys by ${formatCompactUsd(Math.abs(whale.netUsd))}.`,
      'Binance aggregate trades · ≥$1M or ≥100 BTC filter'
    );
  } else {
    add(
      'whale',
      'NEUTRAL',
      whale.largeTradeCount ?
      `${whale.largeTradeCount} verified large trades are directionally balanced.` :
      'No ≥$1M trade (or ≥100 BTC trade on BTC/USDT) appears in the fetched window.',
      'Binance aggregate trades · whale-flow proxy'
    );
  }

  if (liquidity.latestGrab === 'SELL-SIDE SWEPT') {
    add(
      'liquidity-grab',
      'BUY',
      'Price swept the prior 1m range low and closed back above it.',
      'Binance 1m OHLC'
    );
  } else if (liquidity.latestGrab === 'BUY-SIDE SWEPT') {
    add(
      'liquidity-grab',
      'SELL',
      'Price swept the prior 1m range high and closed back below it.',
      'Binance 1m OHLC'
    );
  } else {
    add(
      'liquidity-grab',
      'NEUTRAL',
      'No completed break-and-reclaim is present on the latest 1m candle.',
      'Binance 1m OHLC'
    );
  }

  const actionableTrap = traps.find((trap) => trap.action);
  if (actionableTrap?.action === 'BUY') {
    add(
      'trap',
      'BUY',
      `${actionableTrap.timeframe} bear trap reclaimed ${formatCryptoPrice(actionableTrap.level)}.`,
      'Binance multi-timeframe OHLC'
    );
  } else if (actionableTrap?.action === 'SELL') {
    add(
      'trap',
      'SELL',
      `${actionableTrap.timeframe} bull trap rejected ${formatCryptoPrice(actionableTrap.level)}.`,
      'Binance multi-timeframe OHLC'
    );
  } else {
    add(
      'trap',
      'NEUTRAL',
      'No actionable completed trap across the seven requested timeframes.',
      'Binance multi-timeframe OHLC'
    );
  }

  if (orderFlow.buyPercent >= 60) {
    add(
      'order-flow',
      'BUY',
      `${orderFlow.buyPercent.toFixed(0)}% taker-buy notional; CVD proxy ${formatSignedUsd(orderFlow.deltaUsd)}.`,
      'Binance aggregate trades'
    );
  } else if (orderFlow.sellPercent >= 60) {
    add(
      'order-flow',
      'SELL',
      `${orderFlow.sellPercent.toFixed(0)}% taker-sell notional; CVD proxy ${formatSignedUsd(orderFlow.deltaUsd)}.`,
      'Binance aggregate trades'
    );
  } else {
    add(
      'order-flow',
      'NEUTRAL',
      `Taker flow is balanced at ${orderFlow.buyPercent.toFixed(0)}% buy / ${orderFlow.sellPercent.toFixed(0)}% sell.`,
      'Binance aggregate trades'
    );
  }

  if (!input.fearGreed) {
    add(
      'fear-greed',
      'UNAVAILABLE',
      'Fear & Greed is unavailable; no sentiment points were applied.',
      'Alternative.me'
    );
  } else if (input.fearGreed.value < 20) {
    add(
      'fear-greed',
      'BUY',
      `Extreme Fear at ${input.fearGreed.value} creates a contrarian buy vote.`,
      'Alternative.me Crypto Fear & Greed'
    );
  } else if (input.fearGreed.value > 80) {
    add(
      'fear-greed',
      'SELL',
      `Extreme Greed at ${input.fearGreed.value} creates a contrarian sell vote.`,
      'Alternative.me Crypto Fear & Greed'
    );
  } else {
    add(
      'fear-greed',
      'NEUTRAL',
      `${input.fearGreed.classification} at ${input.fearGreed.value}; contrarian extremes are inactive.`,
      'Alternative.me Crypto Fear & Greed'
    );
  }

  const liquidationProxy = detectLiquidationHunt(primary);
  add(
    'liquidation',
    liquidationProxy.status,
    liquidationProxy.reason,
    'Binance wick + volume proxy · not direct liquidation prints'
  );

  if (currentShape.lowerRatio >= 2.5 && current.close > current.open) {
    add(
      'ghost-wick',
      'BUY',
      `Bullish lower wick/body ratio is ${currentShape.lowerRatio.toFixed(1)}x.`,
      'Binance 1m OHLC'
    );
  } else if (currentShape.upperRatio >= 2.5 && current.close < current.open) {
    add(
      'ghost-wick',
      'SELL',
      `Bearish upper wick/body ratio is ${currentShape.upperRatio.toFixed(1)}x.`,
      'Binance 1m OHLC'
    );
  } else {
    add(
      'ghost-wick',
      'NEUTRAL',
      `Maximum wick/body ratio is ${Math.max(currentShape.upperRatio, currentShape.lowerRatio).toFixed(1)}x; 2.5x is required.`,
      'Binance 1m OHLC'
    );
  }

  const averageVolume = mean(primary.slice(-21, -1).map((item) => item.volume));
  const volumeRatio = current.volume / Math.max(averageVolume, Number.EPSILON);
  if (currentShape.bodyPct >= 55 && volumeRatio >= 1.25) {
    add(
      'institutional-candle',
      current.close >= current.open ? 'BUY' : 'SELL',
      `${currentShape.bodyPct.toFixed(0)}% body with ${volumeRatio.toFixed(1)}x average volume.`,
      'Binance 1m OHLC + volume'
    );
  } else {
    add(
      'institutional-candle',
      'NEUTRAL',
      `${currentShape.bodyPct.toFixed(0)}% body and ${volumeRatio.toFixed(1)}x volume do not meet both thresholds.`,
      'Binance 1m OHLC + volume'
    );
  }

  const structure = analyzeStructure(input.candles);
  add(
    'market-structure',
    structure.status,
    structure.reason,
    'Binance multi-timeframe OHLC · MSS/ChoCh model'
  );

  const smartMoney = analyzeSmartMoney(input.trades, primary);
  add(
    'smart-money',
    smartMoney.status,
    smartMoney.reason,
    'Binance aggregate-trade persistence + price-response proxy'
  );

  const buyScore = engines.reduce((sum, engine) => sum + engine.buyScore, 0);
  const sellScore = engines.reduce((sum, engine) => sum + engine.sellScore, 0);
  const netScore = buyScore - sellScore;
  const activeScore = buyScore + sellScore;
  const confidence = activeScore ?
  Math.min(100, Math.round(Math.abs(netScore) / activeScore * 100)) :
  0;
  const direction = directionFromScore(netScore);

  return {
    symbol: input.symbol,
    direction,
    confidence,
    buyScore,
    sellScore,
    netScore,
    activeScore,
    verdict: verdictFor(direction),
    price,
    ticker: input.ticker,
    fearGreed: input.fearGreed,
    whale,
    orderFlow,
    liquidity,
    traps,
    engines,
    candleSecrets: buildCandleSecrets(primary),
    entry: buildEntry(direction, price, primary, liquidity),
    path: buildPath(price, liquidity),
    evidence: engines.
    filter((engine) => engine.status === 'BUY' || engine.status === 'SELL').
    map((engine) => `${engine.name}: ${engine.reason}`),
    analyzedAt: Date.now()
  };
}

function analyzeWhales(
trades: CryptoAggregateTrade[],
symbol: string)
: CryptoWhaleStats {
  const thresholdUsd = 1_000_000;
  const large = trades.filter(
    (trade) =>
    trade.quoteValue >= thresholdUsd ||
    symbol === 'BTCUSDT' && trade.quantity >= 100
  );
  const largeBuyUsd = sum(
    large.filter((trade) => !trade.buyerMaker).map((trade) => trade.quoteValue)
  );
  const largeSellUsd = sum(
    large.filter((trade) => trade.buyerMaker).map((trade) => trade.quoteValue)
  );
  const netUsd = largeBuyUsd - largeSellUsd;
  const total = largeBuyUsd + largeSellUsd;
  const dominance = total ? Math.abs(netUsd) / total : 0;
  return {
    signal: dominance < 0.2 ? 'NEUTRAL' : netUsd > 0 ? 'BULLISH' : 'BEARISH',
    largeBuyUsd,
    largeSellUsd,
    netUsd,
    largeTradeCount: large.length,
    thresholdUsd,
    largestTradeUsd: large.length ?
    Math.max(...large.map((trade) => trade.quoteValue)) :
    0
  };
}

function analyzeTrades(trades: CryptoAggregateTrade[]): CryptoOrderFlow {
  const takerBuyUsd = sum(
    trades.
    filter((trade) => !trade.buyerMaker).
    map((trade) => trade.quoteValue)
  );
  const takerSellUsd = sum(
    trades.filter((trade) => trade.buyerMaker).map((trade) => trade.quoteValue)
  );
  const total = takerBuyUsd + takerSellUsd;
  const buyPercent = total ? takerBuyUsd / total * 100 : 50;
  return {
    buyPercent,
    sellPercent: 100 - buyPercent,
    deltaUsd: takerBuyUsd - takerSellUsd,
    takerBuyUsd,
    takerSellUsd
  };
}

function analyzeLiquidity(
depth: CryptoDepth,
candles: BinanceCandle[],
price: number)
: CryptoLiquidity {
  const above = [...depth.asks].
  filter((level) => level.price > price).
  sort((a, b) => b.notional - a.notional).
  slice(0, 4).
  sort((a, b) => a.price - b.price);
  const below = [...depth.bids].
  filter((level) => level.price < price).
  sort((a, b) => b.notional - a.notional).
  slice(0, 4).
  sort((a, b) => b.price - a.price);
  const last = candles.at(-1)!;
  const prior = candles.slice(-25, -1);
  const priorHigh = Math.max(...prior.map((candle) => candle.high));
  const priorLow = Math.min(...prior.map((candle) => candle.low));
  const latestGrab: CryptoLiquidity['latestGrab'] =
  last.low < priorLow && last.close > priorLow ?
  'SELL-SIDE SWEPT' :
  last.high > priorHigh && last.close < priorHigh ?
  'BUY-SIDE SWEPT' :
  'NONE';
  const nearestAbove = above[0]?.price ?? null;
  const nearestBelow = below[0]?.price ?? null;
  const aboveDistance =
  nearestAbove === null ? Number.POSITIVE_INFINITY : nearestAbove - price;
  const belowDistance =
  nearestBelow === null ? Number.POSITIVE_INFINITY : price - nearestBelow;
  const target = aboveDistance < belowDistance ? nearestAbove : nearestBelow;
  return {
    above,
    below,
    target,
    targetSide:
    target === null ? null : target === nearestAbove ? 'ABOVE' : 'BELOW',
    latestGrab
  };
}

function detectTrap(
candles: BinanceCandle[] | undefined,
timeframe: CryptoTimeframe)
: CryptoTrap {
  if (!candles || candles.length < 24) {
    return { timeframe, kind: 'UNAVAILABLE', action: null, level: null };
  }
  const last = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const prior = candles.slice(-24, -2);
  const resistance = Math.max(...prior.map((candle) => candle.high));
  const support = Math.min(...prior.map((candle) => candle.low));
  if (previous.high > resistance && last.close < resistance) {
    return {
      timeframe,
      kind: 'BULL TRAP',
      action: 'SELL',
      level: resistance
    };
  }
  if (previous.low < support && last.close > support) {
    return {
      timeframe,
      kind: 'BEAR TRAP',
      action: 'BUY',
      level: support
    };
  }
  return { timeframe, kind: 'CLEAR', action: null, level: null };
}

function detectLiquidationHunt(candles: BinanceCandle[]): {
  status: CryptoEngineStatus;
  reason: string;
} {
  const last = candles.at(-1)!;
  const shape = candleShape(last);
  const avgVolume = mean(candles.slice(-21, -1).map((candle) => candle.volume));
  const spike = last.volume / Math.max(avgVolume, Number.EPSILON);
  if (spike >= 2 && shape.lowerRatio >= 2 && last.close > last.open) {
    return {
      status: 'BUY',
      reason: `${spike.toFixed(1)}x volume lower-wick flush suggests a long-liquidation hunt and reclaim.`
    };
  }
  if (spike >= 2 && shape.upperRatio >= 2 && last.close < last.open) {
    return {
      status: 'SELL',
      reason: `${spike.toFixed(1)}x volume upper-wick flush suggests a short-liquidation hunt and rejection.`
    };
  }
  return {
    status: 'NEUTRAL',
    reason: `No 2x-volume wick flush; direct Binance spot liquidation prints are not claimed.`
  };
}

function analyzeStructure(candleSets: CryptoCandleSets): {
  status: CryptoEngineStatus;
  reason: string;
} {
  let bullish = 0;
  let bearish = 0;
  let available = 0;
  CRYPTO_TIMEFRAMES.forEach((timeframe) => {
    const candles = candleSets[timeframe];
    if (!candles || candles.length < 30) return;
    available += 1;
    const closes = candles.map((candle) => candle.close);
    const fast = emaLast(closes, 9);
    const slow = emaLast(closes, 21);
    const last = closes.at(-1)!;
    if (last > fast && fast > slow) bullish += 1;
    if (last < fast && fast < slow) bearish += 1;
  });
  if (bullish >= 4) {
    return {
      status: 'BUY',
      reason: `${bullish}/${available} available timeframes hold bullish price > EMA9 > EMA21 structure.`
    };
  }
  if (bearish >= 4) {
    return {
      status: 'SELL',
      reason: `${bearish}/${available} available timeframes hold bearish price < EMA9 < EMA21 structure.`
    };
  }
  return {
    status: available ? 'NEUTRAL' : 'UNAVAILABLE',
    reason: available ?
    `Structure is mixed: ${bullish} bullish / ${bearish} bearish across ${available} timeframes.` :
    'Multi-timeframe structure data is unavailable.'
  };
}

function analyzeSmartMoney(
trades: CryptoAggregateTrade[],
candles: BinanceCandle[])
: {status: CryptoEngineStatus;reason: string;} {
  const blocks = 5;
  const blockSize = Math.max(1, Math.floor(trades.length / blocks));
  const deltas: number[] = [];
  for (let index = 0; index < blocks; index++) {
    const slice = trades.slice(index * blockSize, (index + 1) * blockSize);
    deltas.push(
      sum(
        slice.map((trade) =>
        trade.buyerMaker ? -trade.quoteValue : trade.quoteValue
        )
      )
    );
  }
  const positive = deltas.filter((delta) => delta > 0).length;
  const negative = deltas.filter((delta) => delta < 0).length;
  const recent = candles.slice(-10);
  const priceChange =
  (recent.at(-1)!.close - recent[0].open) / recent[0].open * 100;
  if (positive >= 4 && priceChange >= -0.25) {
    return {
      status: 'BUY',
      reason: `${positive}/5 trade blocks show persistent taker buying with ${priceChange.toFixed(2)}% price response.`
    };
  }
  if (negative >= 4 && priceChange <= 0.25) {
    return {
      status: 'SELL',
      reason: `${negative}/5 trade blocks show persistent taker selling with ${priceChange.toFixed(2)}% price response.`
    };
  }
  return {
    status: 'NEUTRAL',
    reason: `Large-flow persistence is mixed (${positive} buy / ${negative} sell blocks). Exchange wallet flows are not claimed.`
  };
}

function buildCandleSecrets(candles: BinanceCandle[]): CryptoCandleSecret[] {
  return candles.slice(-10).map((candle, index, sample) => {
    const shape = candleShape(candle);
    const prior = sample.slice(0, Math.max(0, index));
    const resistance = prior.length ?
    Math.max(...prior.map((item) => item.high)) :
    null;
    const support = prior.length ?
    Math.min(...prior.map((item) => item.low)) :
    null;
    const ghost: CryptoCandleSecret['ghost'] =
    shape.lowerRatio >= 2.5 && candle.close > candle.open ?
    'BUY' :
    shape.upperRatio >= 2.5 && candle.close < candle.open ?
    'SELL' :
    'NO';
    const trap: CryptoCandleSecret['trap'] =
    resistance !== null &&
    candle.high > resistance &&
    candle.close < resistance ?
    'BULL' :
    support !== null && candle.low < support && candle.close > support ?
    'BEAR' :
    'NO';
    const hidden = shape.bodyPct < 18;
    const phase: CryptoCandleSecret['phase'] =
    shape.bodyPct > 75 ?
    candle.close >= candle.open ?
    'STR-BUY' :
    'STR-SELL' :
    hidden ?
    candle.close >= candle.open ?
    'ACC' :
    'DIST' :
    candle.close >= candle.open ?
    'BUY' :
    'SELL';
    return {
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      wbr: Math.max(shape.upperRatio, shape.lowerRatio),
      bodyPct: shape.bodyPct,
      ghost,
      trap,
      phase
    };
  });
}

function buildEntry(
direction: CryptoDirection,
price: number,
candles: BinanceCandle[],
liquidity: CryptoLiquidity)
: CryptoEntry | null {
  if (direction === 'NEUTRAL') return null;
  const isBuy = direction.includes('BUY');
  const atr = averageTrueRange(candles);
  const liquidityDistance = isBuy ?
  price - (liquidity.below[0]?.price ?? price - atr) :
  (liquidity.above[0]?.price ?? price + atr) - price;
  const risk = Math.min(
    Math.max(liquidityDistance, price * 0.001, atr * 0.45),
    Math.max(price * 0.01, atr * 1.5)
  );
  const stopLoss = isBuy ? price - risk : price + risk;
  return {
    direction: isBuy ? 'LONG' : 'SHORT',
    entry: price,
    stopLoss,
    stopPercent: risk / price * 100,
    targets: [2, 3, 5, 10].map((rr) => ({
      label: `TP${[2, 3, 5, 10].indexOf(rr) + 1}`,
      price: isBuy ? price + risk * rr : price - risk * rr,
      rr
    }))
  };
}

function buildPath(
price: number,
liquidity: CryptoLiquidity)
: CryptoPathStep[] {
  const above = liquidity.above[0]?.price;
  const below = liquidity.below[0]?.price;
  if (above === undefined && below === undefined) return [];
  const grabAbove =
  below === undefined ||
  above !== undefined && above - price < price - below;
  const grab = grabAbove ? above : below;
  if (grab === undefined) return [];
  const opposite = grabAbove ? below : above;
  const rejection = price + (price - grab) * 0.3;
  const sweep = opposite ?? rejection + (rejection - grab);
  const final = sweep + (sweep - grab) * 0.35;
  return [
  { label: 'Current', level: price, tone: 'current' },
  {
    label: `Grab ${grabAbove ? 'Above' : 'Below'}`,
    level: grab,
    tone: 'grab'
  },
  { label: 'Rejection', level: rejection, tone: 'rejection' },
  {
    label: `Sweep ${grabAbove ? 'Below' : 'Above'}`,
    level: sweep,
    tone: 'sweep'
  },
  {
    label: `Scenario ${grabAbove ? 'SELL' : 'BUY'}`,
    level: final,
    tone: 'final'
  }];

}

function candleShape(candle: BinanceCandle) {
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
    bodyPct: rawBody / range * 100,
    upperRatio: upperWick / body,
    lowerRatio: lowerWick / body
  };
}

function averageTrueRange(candles: BinanceCandle[]): number {
  const sample = candles.slice(-15);
  if (sample.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < sample.length; index++) {
    total += Math.max(
      sample[index].high - sample[index].low,
      Math.abs(sample[index].high - sample[index - 1].close),
      Math.abs(sample[index].low - sample[index - 1].close)
    );
  }
  return total / (sample.length - 1);
}

function emaLast(values: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  return values.
  slice(1).
  reduce(
    (current, value) => value * multiplier + current * (1 - multiplier),
    values[0] ?? 0
  );
}

function directionFromScore(score: number): CryptoDirection {
  if (score > 25) return 'STRONG BUY';
  if (score > 15) return 'BUY';
  if (score < -25) return 'STRONG SELL';
  if (score < -15) return 'SELL';
  return 'NEUTRAL';
}

function verdictFor(direction: CryptoDirection): string {
  if (direction === 'STRONG BUY')
  return 'High-conviction buy alignment across active crypto engines.';
  if (direction === 'BUY')
  return 'Buy bias is active; wait for execution confirmation.';
  if (direction === 'STRONG SELL')
  return 'High-conviction sell alignment across active crypto engines.';
  if (direction === 'SELL')
  return 'Sell bias is active; wait for execution confirmation.';
  return 'No decisive edge. Wait for stronger order-flow and structure alignment.';
}

function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function formatCryptoPrice(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const decimals =
  Math.abs(value) < 0.01 ?
  8 :
  Math.abs(value) < 1 ?
  6 :
  Math.abs(value) < 100 ?
  4 :
  2;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedUsd(value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatCompactUsd(Math.abs(value))}`;
}