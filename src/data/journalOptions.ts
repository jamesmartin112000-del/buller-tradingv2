export const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D'] as const;
export const SESSIONS = ['ASIA', 'LONDON', 'NEW YORK', 'LONDON / NEW YORK OVERLAP'] as const;
export const SETUPS = [
'Liquidity Sweep',
'Market Structure Break',
'Change of Character',
'Break of Structure',
'Order Block',
'Fair Value Gap',
'Support/Resistance',
'Trend Continuation',
'Trend Reversal',
'Breakout',
'Breakout Retest',
'Rejection',
'Supply/Demand',
'Momentum',
'Pullback',
'Other'] as
const;
export const LOT_SIZES = [0.01, 0.02, 0.03, 0.04, 0.05, 0.1, 0.2, 0.3, 0.5, 1] as const;
export const EMOTIONS = [
'Calm', 'Confident', 'Neutral', 'Hesitant', 'Fearful', 'Greedy', 'Angry',
'Revenge', 'FOMO', 'Overconfident', 'Tired', 'Distracted'] as
const;
export const MISTAKES = [
'None', 'Early Entry', 'Late Entry', 'Oversized Position', 'Moved SL',
'Removed SL', 'Chased Price', 'Revenge Trade', 'FOMO', 'Overtrading',
'Ignored Setup', 'Ignored News', 'Ignored Risk', 'Premature Exit',
'No Confirmation', 'Other'] as
const;
export const QUALITIES = ['A+', 'A', 'B', 'C', 'D'] as const;
export const NEWS_IMPACTS = ['HIGH', 'MEDIUM', 'LOW'] as const;