import { detectBigTrades } from './bigTradeDetector';
import { analyzeDelta, estimateDelta } from './deltaFootprint';
import { analyzeDom } from './domOrderBook';
import type {
  FormulaSignal,
  InstitutionalCandle,
  TradeFormulaResult } from
'./types';
import { calculateVI } from './viCalculator';

export function calculateTradeFormula(
candles: InstitutionalCandle[])
: TradeFormulaResult {
  if (candles.length < 10) return emptyFormula();
  const delta = analyzeDelta(candles);
  const dom = analyzeDom(candles);
  const vi = calculateVI(candles);
  const bigTrades = detectBigTrades(candles);
  const last = candles.at(-1)!;
  const volumeWindow = candles.slice(-10);
  const averageVolume =
  volumeWindow.reduce((sum, candle) => sum + candle.volume, 0) / volumeWindow.length;
  const recentDelta = estimateDelta(last);

  let absorptionScore = vi.absorption * 0.45;
  if (dom.absorption) absorptionScore += dom.absorption.intensity * 0.35;
  if (
  Math.abs(recentDelta) < averageVolume * 0.1 &&
  last.volume > averageVolume * 1.5)
  {
    absorptionScore += 20;
  }

  let aggressionScore = Math.min(
    40,
    Math.abs(recentDelta) / Math.max(averageVolume, 1) * 80
  );
  if (bigTrades.some((trade) => trade.significance > 5)) aggressionScore += 25;
  if (last.volume > averageVolume * 2) aggressionScore += 20;
  if (last.volume > averageVolume * 3) aggressionScore += 10;
  aggressionScore += Math.min(20, Math.abs(dom.snapshot.imbalance) * 55);

  let deltaFlipScore = 0;
  if (delta.deltaFlip) deltaFlipScore += 55;
  if (delta.deltaDivergence) deltaFlipScore += 25;
  if (vi.divergence) deltaFlipScore += 15;
  if (delta.exhaustionDetected) deltaFlipScore += 15;

  absorptionScore = clamp(absorptionScore);
  aggressionScore = clamp(aggressionScore);
  deltaFlipScore = clamp(deltaFlipScore);
  const totalScore = absorptionScore + aggressionScore + deltaFlipScore;
  const reference = candles[Math.max(0, candles.length - 3)];
  const priceMove = last.close - reference.close;
  const priceDeadZone = Math.max(last.close * 0.00005, Number.EPSILON);
  const deltaDeadZone = averageVolume * 0.01;
  const priceDirection = Math.abs(priceMove) <= priceDeadZone ? 0 : priceMove > 0 ? 1 : -1;
  const deltaDirection = Math.abs(recentDelta) <= deltaDeadZone ? 0 : recentDelta > 0 ? 1 : -1;
  const domDirection = Math.abs(dom.snapshot.imbalance) <= 0.03 ? 0 : dom.snapshot.imbalance > 0 ? 1 : -1;
  const directionScore = priceDirection + deltaDirection + domDirection;
  const signal = determineSignal(totalScore, directionScore);
  const confidence = clamp(
    totalScore / 300 * 70 + Math.abs(directionScore) * 5 + (delta.deltaFlip ? 15 : 0)
  );

  return {
    absorptionScore: Math.round(absorptionScore),
    aggressionScore: Math.round(aggressionScore),
    deltaFlipScore: Math.round(deltaFlipScore),
    totalScore: Math.round(totalScore),
    signal,
    confidence: Math.round(confidence)
  };
}

function determineSignal(total: number, direction: number): FormulaSignal {
  if (direction > 0) {
    if (total >= 200) return 'STRONG_BUY';
    if (total >= 150) return 'BUY';
    if (total >= 100) return 'WEAK_BUY';
  }
  if (direction < 0) {
    if (total >= 200) return 'STRONG_SELL';
    if (total >= 150) return 'SELL';
    if (total >= 100) return 'WEAK_SELL';
  }
  return 'NEUTRAL';
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function emptyFormula(): TradeFormulaResult {
  return {
    absorptionScore: 0,
    aggressionScore: 0,
    deltaFlipScore: 0,
    totalScore: 0,
    signal: 'NEUTRAL',
    confidence: 0
  };
}