import { analyzeWhaleActivity } from './bigTradeDetector';
import { analyzeDelta } from './deltaFootprint';
import { analyzeDom } from './domOrderBook';
import { calculateOhlcLevels } from './ohlcLevels';
import { calculateATR, detectSniperEntry } from './sniperEntry';
import { calculateTradeFormula } from './tradeFormula';
import type {
  FullAnalysisSummary,
  InstitutionalCandle,
  KeyLevel,
  TradeSignal } from
'./types';
import { calculateVI } from './viCalculator';
import { calculateVolumeProfile } from './volumeProfile';
import { calculateVWAP, checkVwapTrend } from './vwapCalculator';

export function fifteenStepAnalysis(
goldCandles: InstitutionalCandle[],
dxyCandles: InstitutionalCandle[])
: TradeSignal {
  const lastPrice = goldCandles.at(-1)?.close ?? 0;
  const trend = checkVwapTrend(goldCandles);
  const session = detectSession();
  const profile = calculateVolumeProfile(goldCandles);
  const ohlc = calculateOhlcLevels(goldCandles);
  const dom = analyzeDom(goldCandles);
  const delta = analyzeDelta(goldCandles);
  const whale = analyzeWhaleActivity(goldCandles);
  const vi = calculateVI(goldCandles);
  const formula = calculateTradeFormula(goldCandles);
  const sniper = detectSniperEntry(goldCandles);
  const vwap = calculateVWAP(goldCandles);
  let bullish = 0;
  let bearish = 0;

  if (formula.signal.includes('BUY')) bullish += formula.signal === 'STRONG_BUY' ? 3 : formula.signal === 'BUY' ? 2 : 1;
  if (formula.signal.includes('SELL')) bearish += formula.signal === 'STRONG_SELL' ? 3 : formula.signal === 'SELL' ? 2 : 1;
  if (whale.whaleBias === 'bullish') bullish += 2;
  if (whale.whaleBias === 'bearish') bearish += 2;
  if (delta.flipDirection === 'up') bullish += 2;
  if (delta.flipDirection === 'down') bearish += 2;
  if (delta.divergenceType === 'bullish') bullish += 1;
  if (delta.divergenceType === 'bearish') bearish += 1;
  if (vi.divergenceType === 'bullish') bullish += 1;
  if (vi.divergenceType === 'bearish') bearish += 1;
  if (dom.absorption?.side === 'buy') bullish += 1;
  if (dom.absorption?.side === 'sell') bearish += 1;
  if (trend === 'bullish') bullish += 1;
  if (trend === 'bearish') bearish += 1;
  if (lastPrice < profile.val) bullish += 1;
  if (lastPrice > profile.vah) bearish += 1;

  const dxyTrend = checkVwapTrend(dxyCandles);
  if (dxyCandles.length) {
    if (dxyTrend === 'bearish') bullish += 1;
    if (dxyTrend === 'bullish') bearish += 1;
  }

  const difference = bullish - bearish;
  const minimumVotes = Math.max(bullish, bearish) >= 3;
  const direction: TradeSignal['direction'] =
  minimumVotes && difference >= 2 ? 'BUY' : minimumVotes && difference <= -2 ? 'SELL' : 'HOLD';
  const strength: 1 | 2 | 3 = Math.abs(difference) >= 5 ? 3 : Math.abs(difference) >= 3 ? 2 : 1;
  const atr = calculateATR(goldCandles);
  const stopDistance = Math.max(atr * 0.45, lastPrice * 0.0005);
  const alignedSniper = sniper?.direction === direction ? sniper : null;
  const entryPrice = alignedSniper?.entryPrice ?? lastPrice;
  const sign = direction === 'BUY' ? 1 : direction === 'SELL' ? -1 : 0;
  const stopLoss = sign ? entryPrice - sign * stopDistance : entryPrice;
  const target1 = sign ? entryPrice + sign * stopDistance * 1.5 : entryPrice;
  const target2 = sign ? entryPrice + sign * stopDistance * 2.5 : entryPrice;
  const target3 = sign ? entryPrice + sign * stopDistance * 4 : entryPrice;
  const levelCandidates: KeyLevel[] = [
  { price: profile.poc, type: 'poc', strength: 5 },
  { price: profile.vah, type: 'resistance', strength: 4 },
  { price: profile.val, type: 'support', strength: 4 },
  { price: vwap.vwap, type: 'vwap', strength: 4 },
  { price: ohlc.dailyHigh, type: 'dailyHigh', strength: 3 },
  { price: ohlc.dailyLow, type: 'dailyLow', strength: 3 }];

  const levels = levelCandidates.filter((level) => level.price > 0);
  const reasons = buildReasons(
    formula.signal.replaceAll('_', ' '),
    formula.confidence,
    delta.deltaFlip ? `Delta flipped ${delta.flipDirection}` : null,
    delta.deltaDivergence ? `${delta.divergenceType} delta divergence` : null,
    dom.absorption ? `${dom.absorption.side}-side DOM absorption at ${dom.absorption.price}` : null,
    whale.whaleBias !== 'neutral' ? `${whale.whaleBias} whale activity` : null,
    vi.absorption > 60 ? `VI absorption ${vi.absorption}%` : null,
    alignedSniper ? `Sniper checklist confirmed · R:R ${alignedSniper.riskReward}` : null,
    dxyCandles.length ? `DXY confirmation: ${dxyTrend}` : null
  );
  const summary: FullAnalysisSummary = {
    trend,
    session,
    volumeProfile: `POC ${profile.poc} · VAH ${profile.vah} · VAL ${profile.val} · ${profile.sessionType}`,
    deltaStatus: delta.deltaFlip ?
    `Flipped ${delta.flipDirection}` :
    delta.deltaDivergence ?
    `${delta.divergenceType} divergence` :
    'No active anomaly',
    domStatus: dom.absorption ?
    `${dom.absorption.side} absorption` :
    dom.stackedBook ?
    'Stacked liquidity' :
    'Balanced book',
    whaleActivity: `${whale.whaleBias} · ${whale.recentActivity}`,
    formulaScore: formula.totalScore,
    confluenceCount: bullish + bearish
  };
  const winningVotes = direction === 'BUY' ? bullish : direction === 'SELL' ? bearish : Math.max(bullish, bearish);
  return {
    timestamp: Date.now(),
    asset: 'XAUUSD',
    direction,
    strength,
    entryPrice: round(entryPrice),
    stopLoss: round(stopLoss),
    takeProfit1: round(target1),
    takeProfit2: round(target2),
    takeProfit3: round(target3),
    riskRewardRatio: sign ? 2.5 : 0,
    confidence: Math.min(100, Math.round(winningVotes / Math.max(1, bullish + bearish + 3) * 100)),
    reasons,
    levels,
    analysis: summary
  };
}

function detectSession(): FullAnalysisSummary['session'] {
  const hour = new Date().getUTCHours();
  if (hour < 8) return 'asia';
  if (hour < 12) return 'london';
  if (hour < 16) return 'overlap';
  if (hour < 21) return 'ny';
  return 'overlap';
}

function buildReasons(...reasons: Array<string | null>): string[] {
  return reasons.filter((reason): reason is string => Boolean(reason));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}