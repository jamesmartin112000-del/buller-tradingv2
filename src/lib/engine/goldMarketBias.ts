import {
  analyzeGoldDxyRelationship,
  analyzeGoldTimeframe,
  buildGoldConfirmationSteps,
  buildGoldReasons,
  buildGoldTradePlan,
  detectGoldBos,
  detectGoldFvg,
  GOLD_TIMEFRAME_WEIGHTS,
  latestGoldLiquidity,
  roundGoldScore,
  uniqueGoldSources } from
'./goldMarketBiasCalculations';
import {
  DXY_BIAS_TIMEFRAMES,
  GOLD_BIAS_TIMEFRAMES,
  type GoldBiasDirection,
  type GoldCandleInputs,
  type DxyCandleInputs,
  type GoldMarketBiasAnalysis,
  type GoldTimeframeBias,
  type GoldBiasTimeframe } from
'./goldMarketBiasTypes';

export * from './goldMarketBiasTypes';

/**
 * Pure, deterministic Gold bias model. It performs no I/O and never creates,
 * fills or guesses candles. Missing evidence remains unavailable and carries
 * no score.
 */
export function analyzeGoldMarketBias(
goldInputs: GoldCandleInputs,
dxyInputs: DxyCandleInputs)
: GoldMarketBiasAnalysis {
  const timeframes = {} as Record<GoldBiasTimeframe, GoldTimeframeBias>;
  let weightedScore = 0;
  let weightedMax = 0;

  GOLD_BIAS_TIMEFRAMES.forEach((timeframe) => {
    const bias = analyzeGoldTimeframe(timeframe, goldInputs[timeframe]);
    timeframes[timeframe] = bias;
    if (bias.available) {
      const weight = GOLD_TIMEFRAME_WEIGHTS[timeframe];
      weightedScore += bias.score * weight;
      weightedMax += bias.maxScore * weight;
    }
  });

  const dxyChecks = DXY_BIAS_TIMEFRAMES.map((timeframe) =>
  analyzeGoldDxyRelationship(
    timeframe,
    goldInputs[timeframe],
    dxyInputs[timeframe],
    timeframes[timeframe]
  )
  );
  const dxyScore = dxyChecks.reduce((total, check) => total + check.score, 0);
  const dxyMax = dxyChecks.filter(
    (check) => check.status !== 'UNAVAILABLE'
  ).length;
  const score = weightedScore + dxyScore;
  const maxScore = weightedMax + dxyMax;
  const normalized = maxScore ? score / maxScore : 0;
  const direction: GoldBiasDirection =
  normalized >= 0.18 ? 'BUY' : normalized <= -0.18 ? 'SELL' : 'NEUTRAL';
  const confidence = maxScore ?
  Math.min(100, Math.round(Math.abs(score) / maxScore * 100)) :
  0;

  const executionCandles = goldInputs['1m']?.candles ?? [];
  const fallbackCandles = goldInputs['15m']?.candles ?? [];
  const planningCandles =
  executionCandles.length >= 30 ? executionCandles : fallbackCandles;
  if (!planningCandles.length) {
    throw new Error('Real XAUUSD OHLC candles are unavailable.');
  }

  const currentPrice = planningCandles.at(-1)!.close;
  const bos = detectGoldBos(planningCandles);
  const fvg = detectGoldFvg(planningCandles);
  const liquidity = latestGoldLiquidity(timeframes);
  const tradePlan = buildGoldTradePlan(
    direction,
    currentPrice,
    planningCandles,
    liquidity
  );
  const reasons = buildGoldReasons(timeframes, dxyChecks, direction);
  const confirmationSteps = buildGoldConfirmationSteps(
    direction,
    timeframes,
    dxyChecks,
    liquidity,
    bos,
    fvg
  );
  const sources = uniqueGoldSources([
  ...Object.values(goldInputs),
  ...Object.values(dxyInputs)]
  );
  const timestamps = Object.values(timeframes).
  map((item) => item.lastCandleAt ?? 0).
  filter(Boolean);
  const marketTimestamp = timestamps.length ? Math.max(...timestamps) : 0;

  return {
    symbol: 'XAUUSD',
    direction,
    confidence,
    score: roundGoldScore(score),
    maxScore: roundGoldScore(maxScore),
    currentPrice,
    timeframes,
    dxyChecks,
    liquidity,
    bos,
    fvg,
    tradePlan,
    confirmationSteps,
    reasons,
    sources,
    marketTimestamp,
    analyzedAt: marketTimestamp
  };
}