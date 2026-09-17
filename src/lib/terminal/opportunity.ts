// ============================================================
// Opportunity detectors layered on top of the REAL kline +
// GodVerdict path. Pure & self-contained — no EngineContext.
//   • detectBigMove  → flags a genuine, imminent large move on
//                       the SELECTED timeframe (volatility
//                       expansion + conviction + a real footprint).
//   • higherTimeframes → the timeframes above the user's selection,
//                        used to surface higher-TF setups.
// ============================================================
import { calcATR, TIMEFRAMES, type Asset, type TCandle } from './market';
import type { GodVerdict } from './engine';

export interface BigMoveAlert {
  direction: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  /** Volatility expansion ratio (recent ATR ÷ baseline ATR). */
  expansion: number;
  /** Plain-language list of what triggered the alert. */
  triggers: string[];
  /** One-line rationale. */
  rationale: string;
}

/**
 * Detect a REAL big move forming on the selected timeframe.
 *
 * Fires only when several genuine conditions stack up so it never
 * fires on noise:
 *   1. A non-neutral, high-conviction verdict (≥72%).
 *   2. Volatility EXPANSION — recent ATR ≥ ~1.6× the longer baseline.
 *   3. At least one corroborating footprint: a detected trap, a
 *      strong volume spike, or very strong expansion (≥2×).
 */
export function detectBigMove(
verdict: GodVerdict | null,
candles: TCandle[])
: BigMoveAlert | null {
  if (!verdict) return null;
  if (verdict.direction === 'NEUTRAL') return null;
  if (verdict.confidence < 72) return null;
  if (!candles || candles.length < 30) return null;

  const baseATR = calcATR(candles, 20);
  const recentATR = calcATR(candles.slice(-8), 5);
  const expansion = baseATR > 0 ? recentATR / baseATR : 1;

  // Volume spike — last candle vs the average of the prior 20.
  const vols = candles.map((c) => c.volume || 0);
  const last = vols[vols.length - 1] || 0;
  const prior = vols.slice(-21, -1);
  const avgVol = prior.length ?
  prior.reduce((a, b) => a + b, 0) / prior.length :
  0;
  const volSpike = avgVol > 0 ? last / avgVol : 1;

  const hasTrap = verdict.trap.type !== 'NO_TRAP';
  const strongVol = volSpike >= 1.8;
  const bigExpansion = expansion >= 1.6;
  const hugeExpansion = expansion >= 2;

  // Need the conviction gate PLUS a real volatility footprint.
  const footprints = [hasTrap, strongVol, bigExpansion].filter(Boolean).length;
  const qualifies =
  bigExpansion && footprints >= 2 ||
  hugeExpansion ||
  hasTrap && bigExpansion;
  if (!qualifies) return null;

  const triggers: string[] = [];
  triggers.push(`ATR expansion ${expansion.toFixed(1)}×`);
  if (hasTrap)
  triggers.push(
    `${verdict.trap.type.replace('_', ' ').toLowerCase()} ${verdict.trap.confidence}%`
  );
  if (strongVol) triggers.push(`volume ${volSpike.toFixed(1)}×`);

  return {
    direction: verdict.direction,
    confidence: verdict.confidence,
    entry: verdict.entry,
    sl: verdict.sl,
    tp: verdict.tp,
    rr: verdict.rr,
    expansion,
    triggers,
    rationale: `Volatility is expanding ${expansion.toFixed(1)}× into a ${verdict.confidence}% ${verdict.direction} setup${
    hasTrap ?
    ` with a ${verdict.trap.type.replace('_', ' ').toLowerCase()}` :
    ''}${
    strongVol ? ` and a ${volSpike.toFixed(1)}× volume surge` : ''} — a large move is building.`
  };
}

/**
 * The timeframes ABOVE the user's current selection (max 3), used to
 * scan for higher-TF opportunities. Returns [] when already at the top.
 */
export function higherTimeframes(
selectedId: string,
max = 3)
: typeof TIMEFRAMES {
  const idx = TIMEFRAMES.findIndex((t) => t.id === selectedId);
  if (idx < 0) return [];
  return TIMEFRAMES.slice(idx + 1, idx + 1 + max);
}

export interface HigherTfSetup {
  tfId: string;
  tfLabel: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
}

/** Keep only genuinely strong & clear higher-TF verdicts. */
export function qualifyHigherTf(
tfId: string,
tfLabel: string,
verdict: GodVerdict)
: HigherTfSetup | null {
  if (verdict.direction === 'NEUTRAL') return null;
  if (verdict.confidence < 75) return null;
  if (verdict.rr < 2) return null;
  return {
    tfId,
    tfLabel,
    direction: verdict.direction,
    confidence: verdict.confidence,
    entry: verdict.entry,
    sl: verdict.sl,
    tp: verdict.tp,
    rr: verdict.rr
  };
}