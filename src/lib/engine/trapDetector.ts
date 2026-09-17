// ============================================================
// REAL BULL TRAP / BEAR TRAP DETECTOR
// ------------------------------------------------------------
// Runs on REAL candles (BinanceCandle[]) for whatever asset the
// user selects. A "trap" = a fake breakout that sweeps liquidity
// beyond a real swing level, then fails and closes back inside the
// range — trapping breakout traders before reversing.
//
//   • BULL TRAP  → price fakes ABOVE a swing high (traps buyers),
//                  then rejects and closes back below → bearish.
//   • BEAR TRAP  → price fakes BELOW a swing low (traps sellers),
//                  then rejects and closes back above → bullish.
//
// Every signal is validated by SEVERAL independent confirmation
// modules, each casting its own vote with a confidence. Only a
// strong stack of confirmations produces a high-conviction verdict,
// so the result is real and perfect rather than a single guess.
// ============================================================
import type { BinanceCandle } from '../trading/binanceWebSocket';
import {
  findSwingPoints,
  analyzeOrderFlow,
  detectAMD,
  detectFVG,
  detectOrderBlocks,
  type Swing } from
'./engineV5';

export type TrapKind = 'BULL TRAP' | 'BEAR TRAP' | 'NO TRAP';

/** A single confirmation module's vote on the trap thesis. */
export interface TrapModuleVote {
  id: string;
  name: string;
  /** Lucide icon key (mapped in the panel — no emojis). */
  icon: string;
  /** Does this module CONFIRM the trap, REJECT it, or stay NEUTRAL? */
  verdict: 'CONFIRM' | 'NEUTRAL' | 'REJECT';
  /** 0-100 conviction of this module. */
  confidence: number;
  /** Short human-readable rationale. */
  detail: string;
}

export interface TrapResult {
  kind: TrapKind;
  /** 0-100 final conviction. */
  confidence: number;
  /** Confirmation strength bucket for the headline badge. */
  strength: 'VERY STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  /** The liquidity level that was swept (price). */
  level: number;
  /** Index into the supplied candle array where the trap printed. */
  trapIndex: number;
  /** Number of modules that confirmed vs total scored. */
  confirmations: number;
  totalModules: number;
  /** What the trap implies for the next move. */
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** Plain-language headline. */
  headline: string;
  /** Per-module breakdown ("how each module voted"). */
  modules: TrapModuleVote[];
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;else
    loss -= d;
  }
  const ag = gain / period;
  const al = loss / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Find the most recent, strongest trap event in the candle series and
 * validate it with a full stack of confirmation modules.
 */
export function detectTrap(candles: BinanceCandle[]): TrapResult {
  const totalModules = 9;
  const empty = (
  headline: string,
  modules: TrapModuleVote[] = [])
  : TrapResult => ({
    kind: 'NO TRAP',
    confidence: 0,
    strength: 'NONE',
    level: candles.length ? candles[candles.length - 1].close : 0,
    trapIndex: candles.length - 1,
    confirmations: 0,
    totalModules,
    bias: 'NEUTRAL',
    headline,
    modules
  });

  if (candles.length < 40)
  return empty('Not enough candles yet to confirm a trap.');

  const swings = findSwingPoints(candles, 5);
  const closes = candles.map((c) => c.close);
  const avgRange = avg(candles.slice(-30).map((c) => c.high - c.low)) || 1;

  // ── 1. Locate the most recent trap candidate ──────────────
  // Scan recent candles (last 25) for a fake breakout that sweeps a
  // swing level then closes back inside the range.
  type Candidate = {
    kind: Exclude<TrapKind, 'NO TRAP'>;
    index: number;
    level: number;
    /** how far beyond the level the wick poked (in avgRange units) */
    pierce: number;
    /** how decisively it closed back inside (in avgRange units) */
    reclaim: number;
  };
  let best: Candidate | null = null;
  const scanStart = Math.max(10, candles.length - 25);
  for (let i = scanStart; i < candles.length; i++) {
    const c = candles[i];
    // Only consider swings that formed BEFORE this candle.
    for (const s of swings) {
      if (s.index >= i) continue;
      const ageOk = i - s.index <= 60;
      if (!ageOk) continue;
      if (s.type === 'high') {
        // BULL TRAP: poke above the swing high, close back below it.
        if (c.high > s.price && c.close < s.price) {
          const pierce = (c.high - s.price) / avgRange;
          const reclaim = (s.price - c.close) / avgRange;
          if (pierce > 0.05 && reclaim > 0.02) {
            const cand: Candidate = {
              kind: 'BULL TRAP',
              index: i,
              level: s.price,
              pierce,
              reclaim
            };
            if (!best || cand.index >= best.index) best = cand;
          }
        }
      } else {
        // BEAR TRAP: poke below the swing low, close back above it.
        if (c.low < s.price && c.close > s.price) {
          const pierce = (s.price - c.low) / avgRange;
          const reclaim = (c.close - s.price) / avgRange;
          if (pierce > 0.05 && reclaim > 0.02) {
            const cand: Candidate = {
              kind: 'BEAR TRAP',
              index: i,
              level: s.price,
              pierce,
              reclaim
            };
            if (!best || cand.index >= best.index) best = cand;
          }
        }
      }
    }
  }

  if (!best)
  return empty(
    'No fake breakout detected — price is respecting structure. Stand by.'
  );

  const isBull = best.kind === 'BULL TRAP';
  const bias: 'BULLISH' | 'BEARISH' = isBull ? 'BEARISH' : 'BULLISH';
  const trap = candles[best.index];
  const prior = candles.slice(Math.max(0, best.index - 20), best.index);
  const after = candles.slice(best.index + 1);
  const modules: TrapModuleVote[] = [];

  // ── MODULE 1: Liquidity Sweep (core thesis) ───────────────
  {
    const conf = clamp(45 + best.pierce * 120 + best.reclaim * 90);
    modules.push({
      id: 'liquidity',
      name: 'Liquidity Sweep',
      icon: 'crosshair',
      verdict: 'CONFIRM',
      confidence: conf,
      detail: isBull ?
      `Swept buy-side liquidity above ${best.level.toFixed(swingDec(best.level))}, then closed back below.` :
      `Swept sell-side liquidity below ${best.level.toFixed(swingDec(best.level))}, then closed back above.`
    });
  }

  // ── MODULE 2: Wick Rejection (long rejection wick) ────────
  {
    const body = Math.abs(trap.close - trap.open) || avgRange * 0.05;
    const rejWick = isBull ?
    trap.high - Math.max(trap.open, trap.close) :
    Math.min(trap.open, trap.close) - trap.low;
    const ratio = rejWick / body;
    const confirm = ratio > 1.2;
    modules.push({
      id: 'wick',
      name: 'Wick Rejection',
      icon: 'activity',
      verdict: confirm ? 'CONFIRM' : ratio > 0.6 ? 'NEUTRAL' : 'REJECT',
      confidence: clamp(40 + ratio * 28),
      detail: confirm ?
      `Long ${isBull ? 'upper' : 'lower'} rejection wick (${ratio.toFixed(1)}× body) — breakout was sold/bought into.` :
      `Rejection wick only ${ratio.toFixed(1)}× the body — weak rejection.`
    });
  }

  // ── MODULE 3: Failed Close / Reclaim ──────────────────────
  {
    const confirm = best.reclaim > 0.15;
    modules.push({
      id: 'reclaim',
      name: 'Failed Breakout',
      icon: 'target',
      verdict: confirm ? 'CONFIRM' : 'NEUTRAL',
      confidence: clamp(45 + best.reclaim * 110),
      detail: confirm ?
      `Decisive close back inside the range (${(best.reclaim * 100).toFixed(0)}% of avg range) — breakout failed.` :
      `Marginal reclaim back inside the range — needs follow-through.`
    });
  }

  // ── MODULE 4: Volume Behaviour ────────────────────────────
  {
    const avgVol = avg(prior.map((c) => c.volume)) || 1;
    const volRatio = trap.volume / avgVol;
    // A real trap usually shows a volume spike into the sweep (stops run)
    // OR a no-demand failure. Either way, abnormal volume confirms.
    const confirm = volRatio > 1.25 || volRatio < 0.6;
    modules.push({
      id: 'volume',
      name: 'Volume Profile',
      icon: 'waves',
      verdict: confirm ? 'CONFIRM' : 'NEUTRAL',
      confidence: clamp(
        volRatio > 1.25 ? 50 + (volRatio - 1) * 30 : volRatio < 0.6 ? 62 : 45
      ),
      detail:
      volRatio > 1.25 ?
      `Volume spiked ${volRatio.toFixed(1)}× into the sweep — stops were run.` :
      volRatio < 0.6 ?
      `No-demand breakout (${volRatio.toFixed(1)}× volume) — no real participation.` :
      `Volume around average (${volRatio.toFixed(1)}×) — inconclusive.`
    });
  }

  // ── MODULE 5: RSI Divergence ──────────────────────────────
  {
    const rNow = rsi(closes.slice(0, best.index + 1));
    const rPrev = rsi(closes.slice(0, Math.max(2, best.index - 5)));
    // Bull trap: price made a higher high but RSI did not (bearish div).
    // Bear trap: price made a lower low but RSI did not (bullish div).
    const diverges = isBull ?
    rNow < rPrev && rNow > 55 :
    rNow > rPrev && rNow < 45;
    const overext = isBull ? rNow > 68 : rNow < 32;
    const confirm = diverges || overext;
    modules.push({
      id: 'rsi',
      name: 'RSI Divergence',
      icon: 'line-chart',
      verdict: confirm ? 'CONFIRM' : 'NEUTRAL',
      confidence: clamp(diverges ? 68 : overext ? 60 : 45),
      detail: diverges ?
      `${isBull ? 'Bearish' : 'Bullish'} RSI divergence at the breakout (RSI ${rNow.toFixed(0)}).` :
      overext ?
      `RSI ${isBull ? 'overbought' : 'oversold'} (${rNow.toFixed(0)}) at the fake breakout.` :
      `RSI ${rNow.toFixed(0)} — no clear divergence.`
    });
  }

  // ── MODULE 6: Order Flow Regime ───────────────────────────
  {
    const window = candles.slice(0, best.index + 1);
    const of = analyzeOrderFlow(window);
    const buy = parseFloat(of.buyPressure) || 50;
    const sell = parseFloat(of.sellPressure) || 50;
    // For a bull trap we want sellers in control after the sweep.
    const confirm = isBull ? sell > 53 : buy > 53;
    modules.push({
      id: 'orderflow',
      name: 'Order Flow',
      icon: 'terminal',
      verdict: confirm ? 'CONFIRM' : sell === buy ? 'NEUTRAL' : 'REJECT',
      confidence: clamp(Math.max(buy, sell)),
      detail: `Regime ${of.regime.replace('_', ' ').toLowerCase()} · buy ${of.buyPressure}% / sell ${of.sellPressure}% ${
      confirm ?
      `→ ${isBull ? 'sellers' : 'buyers'} regaining control.` :
      '→ flow not yet aligned.'}`

    });
  }

  // ── MODULE 7: AMD Manipulation Phase + SMC context ────────
  {
    const amd = detectAMD(candles);
    const fvgs = detectFVG(candles);
    const obs = detectOrderBlocks(candles, swings);
    const lastFvg = fvgs[fvgs.length - 1];
    const lastOb = obs[obs.length - 1];
    const manip = amd.phase === 'MANIPULATION';
    const smcAligned = isBull ?
    lastFvg?.type === 'bearish' || lastOb?.type === 'bearish' :
    lastFvg?.type === 'bullish' || lastOb?.type === 'bullish';
    const confirm = manip || smcAligned;
    modules.push({
      id: 'amd',
      name: 'AMD / SMC',
      icon: 'building',
      verdict: confirm ? 'CONFIRM' : 'NEUTRAL',
      confidence: clamp(
        manip ? Math.max(60, amd.confidence) : smcAligned ? 58 : 45
      ),
      detail: manip ?
      `AMD phase MANIPULATION (${amd.confidence}%) — classic stop-hunt environment.` :
      smcAligned ?
      `SMC structure (${lastFvg ? 'FVG' : 'OB'}) aligns with a ${bias.toLowerCase()} reversal.` :
      `AMD phase ${amd.phase.toLowerCase()} — no manipulation footprint yet.`
    });
  }

  // ── MODULE 8: Engineered Liquidity (Equal Highs / Equal Lows) ──
  // Smart money hunts CLUSTERS of stops. If the swept level had 2+ swing
  // points sitting at roughly the same price (equal highs for a bull trap,
  // equal lows for a bear trap), it was an engineered liquidity pool — the
  // exact resting liquidity institutions target. This is the "hidden"
  // confirmation retail rarely maps.
  {
    const tol = avgRange * 0.35;
    const sameSide = swings.filter((s) =>
    isBull ? s.type === 'high' : s.type === 'low'
    );
    const cluster = sameSide.filter(
      (s) => Math.abs(s.price - best.level) <= tol && s.index < best.index
    );
    const pooled = cluster.length >= 2;
    modules.push({
      id: 'eql',
      name: 'Engineered Liquidity',
      icon: 'crosshair',
      verdict: pooled ? 'CONFIRM' : 'NEUTRAL',
      confidence: clamp(pooled ? 60 + (cluster.length - 2) * 10 : 44),
      detail: pooled ?
      `${cluster.length} equal ${isBull ? 'highs' : 'lows'} stacked at ${best.level.toFixed(swingDec(best.level))} — an engineered stop pool was swept.` :
      `No clustered ${isBull ? 'equal highs' : 'equal lows'} at the level — single-touch sweep only.`
    });
  }

  // ── MODULE 9: Institutional Displacement ──────────────────
  // A genuine trap is followed by DISPLACEMENT — a decisive impulse candle
  // away from the swept level (often leaving an FVG). Weak drift back is a
  // fake-out; a strong displacement candle = institutions are positioned.
  {
    const window = after.slice(0, 4);
    let bestDisp = 0;
    for (const c of window) {
      const body = Math.abs(c.close - c.open);
      const dir = c.close < c.open ? 'down' : 'up';
      const wanted = isBull ? 'down' : 'up';
      if (dir === wanted) bestDisp = Math.max(bestDisp, body / avgRange);
    }
    const confirm = bestDisp > 0.9;
    modules.push({
      id: 'displacement',
      name: 'Displacement',
      icon: 'activity',
      verdict: confirm ? 'CONFIRM' : bestDisp > 0.4 ? 'NEUTRAL' : 'REJECT',
      confidence: clamp(40 + bestDisp * 45),
      detail: confirm ?
      `Strong ${isBull ? 'bearish' : 'bullish'} displacement (${bestDisp.toFixed(1)}× avg body) confirms institutional intent after the sweep.` :
      bestDisp > 0.4 ?
      `Mild move (${bestDisp.toFixed(1)}× body) away from the level — awaiting displacement.` :
      `No displacement away from the level yet — trap unconfirmed by impulse.`
    });
  }

  // ── Aggregate ─────────────────────────────────────────────
  const confirmations = modules.filter((m) => m.verdict === 'CONFIRM').length;
  const rejects = modules.filter((m) => m.verdict === 'REJECT').length;
  const confirmConf = modules.
  filter((m) => m.verdict === 'CONFIRM').
  reduce((s, m) => s + m.confidence, 0);
  const avgConfirm = confirmations ? confirmConf / confirmations : 0;
  // Final confidence blends the breadth of confirmations with their depth,
  // penalised by any modules that actively reject the thesis.
  let confidence = clamp(
    confirmations / totalModules * 55 + avgConfirm / 100 * 45 - rejects * 8
  );

  // After-the-fact follow-through bonus: if price has already moved in the
  // expected direction since the trap printed, conviction rises.
  if (after.length) {
    const moved = after[after.length - 1].close - trap.close;
    const followed = isBull ? moved < 0 : moved > 0;
    const mag = Math.abs(moved) / avgRange;
    if (followed && mag > 0.3)
    confidence = clamp(confidence + Math.min(12, mag * 6));else
    if (!followed && mag > 0.6) confidence = clamp(confidence - 8);
  }

  // A trap needs at least the core sweep + 1 more confirmation to count.
  if (confirmations < 2) {
    return empty(
      'A liquidity poke was seen but confirmations are too weak to call a trap.',
      modules
    );
  }

  const strength: TrapResult['strength'] =
  confidence >= 85 ?
  'VERY STRONG' :
  confidence >= 70 ?
  'STRONG' :
  confidence >= 55 ?
  'MODERATE' :
  'WEAK';

  const headline = isBull ?
  `Bull trap confirmed — buyers trapped above ${best.level.toFixed(swingDec(best.level))}. Expect downside.` :
  `Bear trap confirmed — sellers trapped below ${best.level.toFixed(swingDec(best.level))}. Expect upside.`;

  return {
    kind: best.kind,
    confidence,
    strength,
    level: best.level,
    trapIndex: best.index,
    confirmations,
    totalModules,
    bias,
    headline,
    modules
  };
}

function swingDec(price: number): number {
  if (price >= 100) return 2;
  if (price >= 1) return 4;
  return 6;
}