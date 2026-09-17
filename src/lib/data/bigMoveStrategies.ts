// Big Move (position trading) strategy definitions — targets 1000-3000+ pips
// over 24h to 30 days. Used by lib/engine/bigMove.ts and pages/BigMove.tsx.

export type BigMoveStrategyId =
'AMD_LIQUIDITY_RUN' |
'ICT_2022_MODEL' |
'WEEKLY_BREAKOUT_RETEST' |
'CENTRAL_BANK_PLAY' |
'OB_STACK_FVG_RUN';

export interface BigMoveStrategyDef {
  id: BigMoveStrategyId;
  name: string;
  short: string;
  targetPips: string;
  holdTime: string;
  accuracy: number;
  minRR: string;
  steps: string[];
  secret: string;
}

export const BIG_MOVE_STRATEGIES: BigMoveStrategyDef[] = [
{
  id: 'AMD_LIQUIDITY_RUN',
  name: 'AMD Liquidity Run',
  short: 'AMD Run',
  targetPips: '1000-2000',
  holdTime: '3-14 days',
  accuracy: 90,
  minRR: '1:10',
  steps: [
  'Detect 14+ days of Daily consolidation (Accumulation or Distribution)',
  'Mark clear range boundaries (high and low)',
  'Wait for price to sweep below/above range (Manipulation phase)',
  'Daily candle MUST close back INSIDE the range',
  'Next 4h candle confirms direction after sweep',
  'Entry at 4h confirmation close',
  'SL: 100-150 pips beyond swept level',
  'TP1: 500p · TP2: 1000p · TP3: 2000+p (trailing)'],

  secret:
  'Banks catch every retail stop before the real move. A false breakout with a long wick = your signal.'
},
{
  id: 'ICT_2022_MODEL',
  name: 'ICT 2022 Model',
  short: 'ICT 2022',
  targetPips: '1500-3000',
  holdTime: '5-14 days',
  accuracy: 90,
  minRR: '1:15',
  steps: [
  'Weekly chart: identify direction with EMA 50/200',
  'Find Daily FVG aligned with weekly direction',
  'Find 4h FVG inside the Daily FVG',
  'Price sweeps below/above the 4h FVG with long wick',
  'Entry: next 4h close in direction of Daily FVG',
  'SL: opposite end of 4h FVG (50-100 pips)',
  'TP: next weekly liquidity (6+ months old highs/lows)'],

  secret:
  'Institutions leave FVGs as gaps. They ALWAYS return to fill them before continuing the real move.'
},
{
  id: 'WEEKLY_BREAKOUT_RETEST',
  name: 'Weekly Breakout + Retest',
  short: 'Wk B+R',
  targetPips: '2000-3000',
  holdTime: '7-30 days',
  accuracy: 87,
  minRR: '1:20',
  steps: [
  'Identify 12+ weeks of consolidation on Weekly',
  'Wait for Weekly close above resistance or below support',
  'DO NOT enter on breakout — wait for retest',
  'Retest with reversal candle (engulfing, hammer, shooting star)',
  'Entry: weekly close of reversal candle',
  'SL: opposite side of consolidation range',
  'TP: range height × 1.5 (min) to × 3 (ideal)'],

  secret:
  'Markets break out → retest → run. ~90% of breakouts retest within 2-3 weeks. Patience is the edge.'
},
{
  id: 'CENTRAL_BANK_PLAY',
  name: 'Central Bank / Fundamental',
  short: 'CB Play',
  targetPips: '1000-3000',
  holdTime: '3-14 days',
  accuracy: 85,
  minRR: '1:10',
  steps: [
  'Monitor FOMC, NFP, CPI, ECB, BOJ, BOE',
  'Check interest rate differentials',
  'Identify policy divergence (hawkish vs dovish)',
  'Stronger economy + higher rates = stronger currency',
  'Entry: 24-48h BEFORE the news event',
  'Exit 50% 2h before news, ride 50% after',
  'SL: 100-200 pips (wider for news trades)'],

  secret:
  'A single FOMC statement can create 2000+ pip moves in a week. This is how hedge funds trade.'
},
{
  id: 'OB_STACK_FVG_RUN',
  name: 'OB Stack + FVG Run',
  short: 'OB Stack',
  targetPips: '1000-2000',
  holdTime: '5-21 days',
  accuracy: 87,
  minRR: '1:8',
  steps: [
  'Find 3+ consecutive Order Blocks on Daily (all same direction)',
  'Measure total height of the OB stack',
  'Identify any FVG between OB levels',
  'Wait for price to enter the FVG zone',
  '4h reversal candle inside FVG = trigger',
  'Entry at 4h reversal close',
  'SL: below lowest OB / above highest OB',
  'TP: OB stack height × 2 (min) to × 3 (ideal)'],

  secret:
  'Stacked OBs = institutions building massive positions. Bigger the stack, bigger the move.'
}];


// === AMD PHASES (Wyckoff-style accumulation/distribution) ===
export const AMD_PHASES = {
  ACCUMULATION: {
    name: 'ACCUMULATION',
    direction: 'BULLISH_BIAS',
    description: 'Range-bound with higher lows — institutions accumulating',
    action: 'Prepare for BIG MOVE UP',
    entryTiming: 'Last 3-5 days of phase'
  },
  MANIPULATION: {
    name: 'MANIPULATION',
    direction: 'REVERSAL',
    description: 'False breakout / shakeout — retail stops hit',
    action: 'THIS IS THE ENTRY ZONE',
    entryTiming: 'Immediately after sweep closes back in range'
  },
  DISTRIBUTION: {
    name: 'DISTRIBUTION',
    direction: 'BEARISH_BIAS',
    description: 'Range-bound with lower highs — institutions distributing',
    action: 'Prepare for BIG MOVE DOWN',
    entryTiming: 'Last 3-5 days of phase'
  },
  MARKDOWN: {
    name: 'MARKDOWN',
    direction: 'BEARISH_TREND',
    description: 'Strong downtrend with momentum',
    action: 'Ride trend, add on pullbacks',
    entryTiming: 'Pullback to 4h EMA'
  },
  MARKUP: {
    name: 'MARKUP',
    direction: 'BULLISH_TREND',
    description: 'Strong uptrend with momentum',
    action: 'Ride trend, add on pullbacks',
    entryTiming: 'Pullback to 4h EMA'
  }
} as const;

// === LIQUIDITY PYRAMID (institutional target levels) ===
export const LIQUIDITY_PYRAMID = [
{
  level: 1,
  name: 'Retail Liquidity',
  tf: '1h',
  pips: '200-300',
  desc: 'Day trader stops'
},
{
  level: 2,
  name: 'Trader Liquidity',
  tf: '4h',
  pips: '500-800',
  desc: 'Swing trader stops'
},
{
  level: 3,
  name: 'Institutional Liquidity',
  tf: 'Daily',
  pips: '1000-1500',
  desc: 'Hedge fund stops'
},
{
  level: 4,
  name: 'Bank Liquidity',
  tf: 'Weekly',
  pips: '2000-3000+',
  desc: 'Central bank stops'
}];


export function findBigMoveStrategy(
id: BigMoveStrategyId)
: BigMoveStrategyDef | undefined {
  return BIG_MOVE_STRATEGIES.find((s) => s.id === id);
}