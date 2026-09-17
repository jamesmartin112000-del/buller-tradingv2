// ============================================================
// COMBINED VERDICT ENGINE
// Fuses the decision, analysis and final result of EVERY trading
// module (Engine v5, Signals, Trade Entry, God Signal, Live Terminal,
// Institutional, Scalping, Big Move, Smart Money, Charts) into ONE
// consensus trade entry. Pure, self-contained — derives every module's
// "vote" from a single rich EngineSignal so the Dashboard can show one
// perfect combined trade entry for any asset.
// ============================================================
import type { EngineSignal } from './engineV5';

export type Vote = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface ModuleVote {
  /** Module display name (matches the sidebar tools). */
  id: string;
  name: string;
  icon: string;
  /** This module's directional vote. */
  vote: Vote;
  /** 0-100 conviction for this module. */
  confidence: number;
  /** Short, human readable explanation of the decision. */
  summary: string;
  /** Relative weight in the consensus (higher = more influence). */
  weight: number;
}

export interface CombinedFinal {
  direction: Vote;
  /** 0-100 consensus confidence. */
  confidence: number;
  entry: string;
  sl: string;
  tp: string;
  rr: string;
  riskLevel: string;
  /** Agreement ratio of modules backing the winning side (0-100). */
  agreement: number;
  bullishModules: number;
  bearishModules: number;
  neutralModules: number;
  /** Plain-language final call. */
  verdict: string;
}

export interface CombinedVerdict {
  final: CombinedFinal;
  modules: ModuleVote[];
}

function dirFromText(t: string): Vote {
  if (t === 'BULLISH') return 'BULLISH';
  if (t === 'BEARISH') return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Build the unified per-module breakdown + consensus verdict from a single
 * EngineSignal (engineV5.generateSignal output). Every module reads a facet
 * of the same rich signal, then we aggregate by weighted vote.
 */
export function buildCombinedVerdict(sig: EngineSignal): CombinedVerdict {
  const of = sig.orderFlow;
  const buy = parseFloat(of.buyPressure) || 0;
  const sell = parseFloat(of.sellPressure) || 0;
  const lastFvg = sig.fvgs[sig.fvgs.length - 1];
  const lastOb = sig.orderBlocks[sig.orderBlocks.length - 1];
  const lastSweep = sig.sweeps[sig.sweeps.length - 1];
  const lastTrap = sig.traps[sig.traps.length - 1];
  const lastHidden = sig.hiddenPatterns[sig.hiddenPatterns.length - 1];

  const modules: ModuleVote[] = [
  // ── Engine v5 — the master technical engine direction
  {
    id: 'engine',
    name: 'Engine v5',
    icon: 'zap',
    vote: dirFromText(sig.direction),
    confidence: sig.confidence,
    summary: `Master engine ${sig.direction} · ${sig.confidence}% conviction`,
    weight: 3
  },
  // ── Signals — the 10-strategy stack consensus
  {
    id: 'signals',
    name: 'Signals',
    icon: 'target',
    vote: dirFromText(sig.strategyStack.finalSignal),
    confidence: sig.strategyStack.confidence,
    summary: `${sig.strategyStack.bullishCount}↑ / ${sig.strategyStack.bearishCount}↓ / ${sig.strategyStack.neutralCount}– across ${sig.strategyStack.strategies.length} strategies`,
    weight: 2.5
  },
  // ── Trade Entry — risk/reward quality of the proposed entry
  {
    id: 'trade-entry',
    name: 'Trade Entry',
    icon: 'crosshair',
    vote: dirFromText(sig.direction),
    confidence: clamp(parseFloat(sig.rr) * 30),
    summary: `Entry ${sig.entry} · SL ${sig.sl} · TP ${sig.tp} · RR 1:${sig.rr}`,
    weight: 1.5
  },
  // ── BULLER TRADING Signal — the unified score verdict
  {
    id: 'god-signal',
    name: 'BULLER TRADING Signal',
    icon: 'radar',
    vote:
    sig.totalScore > 0 ?
    'BULLISH' :
    sig.totalScore < 0 ?
    'BEARISH' :
    'NEUTRAL',
    confidence: clamp(Math.abs(sig.totalScore) * 8 + 40),
    summary: `Total score ${sig.totalScore > 0 ? '+' : ''}${sig.totalScore} (tech ${sig.technicalScore} · hidden ${sig.hiddenScore})`,
    weight: 2.5
  },
  // ── Live Terminal — real-time order flow regime
  {
    id: 'live-terminal',
    name: 'Live Terminal',
    icon: 'terminal',
    vote: buy > 55 ? 'BULLISH' : sell > 55 ? 'BEARISH' : 'NEUTRAL',
    confidence: clamp(Math.max(buy, sell)),
    summary: `Order flow ${of.regime.replace('_', ' ')} · Buy ${of.buyPressure}% / Sell ${of.sellPressure}%`,
    weight: 1.5
  },
  // ── Institutional — order blocks + big-player accumulation/distribution
  {
    id: 'institutional',
    name: 'Institutional',
    icon: 'building',
    vote:
    of.regime === 'STRONG_BUYING' ?
    'BULLISH' :
    of.regime === 'STRONG_SELLING' ?
    'BEARISH' :
    lastOb ?
    lastOb.type === 'bullish' ?
    'BULLISH' :
    'BEARISH' :
    'NEUTRAL',
    confidence:
    of.regime === 'STRONG_BUYING' || of.regime === 'STRONG_SELLING' ?
    80 :
    lastOb ?
    60 :
    45,
    summary:
    of.regime === 'STRONG_BUYING' ?
    'Institutions aggressively accumulating ↑' :
    of.regime === 'STRONG_SELLING' ?
    'Institutions aggressively distributing ↓' :
    lastOb ?
    `Latest order block ${lastOb.type} ` :
    'No clear institutional footprint',
    weight: 2
  },
  // ── Scalping — next-candle short-term prediction
  {
    id: 'scalping',
    name: 'Scalping',
    icon: 'activity',
    vote: dirFromText(sig.prediction.direction as string),
    confidence: sig.prediction.confidence,
    summary: `Next candle ${sig.prediction.direction} ${sig.prediction.confidence}% · H ${sig.prediction.predictedHigh} / L ${sig.prediction.predictedLow}`,
    weight: 1.5
  },
  // ── Big Move — AMD phase + macro structure shift
  {
    id: 'big-move',
    name: 'Big Move',
    icon: 'waves',
    vote: amdVote(sig.amd.phase),
    confidence: sig.amd.confidence,
    summary: `AMD phase ${sig.amd.phase} (${sig.amd.confidence}% conf)`,
    weight: 2
  },
  // ── Smart Money — sweeps, traps & hidden patterns
  {
    id: 'smart-money',
    name: 'Smart Money',
    icon: 'brain',
    vote: smartMoneyVote(lastSweep, lastTrap, lastHidden),
    confidence: smartMoneyConf(lastSweep, lastTrap, lastHidden),
    summary: smartMoneySummary(lastSweep, lastTrap, lastHidden),
    weight: 2
  },
  // ── Charts — SMC structure (FVG / order block bias)
  {
    id: 'charts',
    name: 'Charts',
    icon: 'line-chart',
    vote: chartsVote(lastFvg, lastOb),
    confidence: lastFvg || lastOb ? 60 : 45,
    summary: chartsSummary(lastFvg, lastOb),
    weight: 1.5
  }];


  // ── Weighted consensus ──
  let bullW = 0;
  let bearW = 0;
  let neutW = 0;
  let bullishModules = 0;
  let bearishModules = 0;
  let neutralModules = 0;
  for (const m of modules) {
    const w = m.weight * (m.confidence / 100);
    if (m.vote === 'BULLISH') {
      bullW += w;
      bullishModules++;
    } else if (m.vote === 'BEARISH') {
      bearW += w;
      bearishModules++;
    } else {
      neutW += w;
      neutralModules++;
    }
  }
  const totalW = bullW + bearW + neutW || 1;
  let direction: Vote = 'NEUTRAL';
  let winning = neutW;
  if (bullW > bearW && bullW >= neutW) {
    direction = 'BULLISH';
    winning = bullW;
  } else if (bearW > bullW && bearW >= neutW) {
    direction = 'BEARISH';
    winning = bearW;
  }
  const confidence = clamp(Math.round(winning / totalW * 100));
  const winningCount =
  direction === 'BULLISH' ?
  bullishModules :
  direction === 'BEARISH' ?
  bearishModules :
  neutralModules;
  const agreement = Math.round(winningCount / modules.length * 100);

  const verdict =
  direction === 'NEUTRAL' ?
  'No-trade — modules disagree, stand aside' :
  `${direction === 'BULLISH' ? 'BUY' : 'SELL'} ${sig.entry} · ${agreement}% of modules aligned`;

  return {
    final: {
      direction,
      confidence,
      entry: sig.entry,
      sl: sig.sl,
      tp: sig.tp,
      rr: sig.rr,
      riskLevel: sig.riskLevel,
      agreement,
      bullishModules,
      bearishModules,
      neutralModules,
      verdict
    },
    modules
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function amdVote(phase: string): Vote {
  if (phase === 'ACCUMULATION' || phase === 'MARKUP') return 'BULLISH';
  if (phase === 'DISTRIBUTION' || phase === 'MARKDOWN') return 'BEARISH';
  return 'NEUTRAL';
}

function smartMoneyVote(sweep: any, trap: any, hidden: any): Vote {
  if (sweep) return sweep.type === 'bullish' ? 'BULLISH' : 'BEARISH';
  if (trap) return trap.type === 'BEAR TRAP' ? 'BULLISH' : 'BEARISH';
  if (hidden) return hidden.type.includes('BULLISH') ? 'BULLISH' : 'BEARISH';
  return 'NEUTRAL';
}

function smartMoneyConf(sweep: any, trap: any, hidden: any): number {
  if (sweep) return 70;
  if (trap) return trap.confidence ?? 60;
  if (hidden) return hidden.strength === 'STRONG' ? 70 : 55;
  return 45;
}

function smartMoneySummary(sweep: any, trap: any, hidden: any): string {
  if (sweep)
  return `Liquidity sweep ${sweep.type} @ ${sweep.price?.toFixed?.(2) ?? sweep.price}`;
  if (trap) return `${trap.type} detected (${trap.confidence}% conf)`;
  if (hidden)
  return `${hidden.type.replace(/_/g, ' ').toLowerCase()} (${hidden.strength})`;
  return 'No smart-money footprint';
}

function chartsVote(fvg: any, ob: any): Vote {
  if (fvg) return fvg.type === 'bullish' ? 'BULLISH' : 'BEARISH';
  if (ob) return ob.type === 'bullish' ? 'BULLISH' : 'BEARISH';
  return 'NEUTRAL';
}

function chartsSummary(fvg: any, ob: any): string {
  const parts: string[] = [];
  if (fvg) parts.push(`FVG ${fvg.type}`);
  if (ob) parts.push(`OB ${ob.type}`);
  return parts.length ? parts.join(' · ') : 'No structural imbalance';
}