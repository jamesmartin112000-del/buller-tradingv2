// Scalping strategy definitions — short-term (1m-5m) execution playbook.
// Used by lib/engine/scalp.ts for scoring + pages/Scalping.tsx for the UI.

export interface ScalpStrategyDef {
  id: ScalpStrategyId;
  name: string;
  short: string;
  timeframe: '1m' | '5m' | '1m-5m';
  accuracy: number;
  minRR: string;
  maxHold: string;
  logic: string[];
  why: string;
}

export type ScalpStrategyId =
'FVG_IMBALANCE' |
'LIQ_GRAB_OB' |
'KILLZONE_BREAKOUT' |
'TRAP_REVERSE' |
'ORDER_FLOW_RUSH';

export const SCALP_STRATEGIES: ScalpStrategyDef[] = [
{
  id: 'FVG_IMBALANCE',
  name: 'Micro FVG + Imbalance',
  short: 'Micro FVG',
  timeframe: '1m-5m',
  accuracy: 88,
  minRR: '1:2',
  maxHold: '5-8 min',
  logic: [
  'Detect Fair Value Gap on 1m/5m chart',
  'Verify order imbalance ≥ 70% on one side',
  'Bullish FVG + buy imbalance → BUY',
  'Bearish FVG + sell imbalance → SELL',
  'Entry on retest of FVG zone with confirmation candle',
  'SL: 2-3 pips opposite side of FVG'],

  why: 'Markets always fill imbalances. FVG + dominant pressure = high-probability micro reversal.'
},
{
  id: 'LIQ_GRAB_OB',
  name: 'Liquidity Grab + OB',
  short: 'Liq Grab',
  timeframe: '5m',
  accuracy: 85,
  minRR: '1:1.5',
  maxHold: '5-10 min',
  logic: [
  'Identify 5m swing high/low (last 10 candles)',
  'Price briefly breaks the level (wick beyond)',
  'Price reverses immediately back inside range',
  'Find Order Block at the grab zone',
  'Entry on retest with confirmation candle',
  'SL beyond grab wick · TP at next liquidity level'],

  why: 'Smart money hunts retail stops then reverses. Liquidity grab = institutional fingerprint.'
},
{
  id: 'KILLZONE_BREAKOUT',
  name: 'Killzone Breakout',
  short: 'Killzone',
  timeframe: '1m-5m',
  accuracy: 82,
  minRR: '1:2',
  maxHold: '3-7 min',
  logic: [
  'Detect Pakistan 10AM session window (09:30–11:00 PKT)',
  'Mark session high/low boundaries',
  '5m candle breaking session level = trigger',
  'Switch to 1m for pullback/retest entry',
  'TP: 10-15 pips or next SR level',
  'SL: opposite side of breakout candle'],

  why: 'Pakistan 10AM = local liquidity injection. Breakouts here align with institutional flow.'
},
{
  id: 'TRAP_REVERSE',
  name: 'Trap + Reverse',
  short: 'Trap Rev',
  timeframe: '5m',
  accuracy: 86,
  minRR: '1:1.5',
  maxHold: '4-8 min',
  logic: [
  'Price breaks structural level (recent high/low)',
  'Break fails — price reverses quickly inside range',
  'Long wick on 5m candle confirms trap',
  'Enter opposite direction at trap candle close',
  'SL at trap wick extreme',
  'TP at pre-break structure'],

  why: 'Failed breakouts = trapped retail. Reversal moves are explosive because trapped traders rush to exit.'
},
{
  id: 'ORDER_FLOW_RUSH',
  name: 'Order Flow Rush',
  short: 'OF Rush',
  timeframe: '1m',
  accuracy: 90,
  minRR: '1:1',
  maxHold: '2-5 min',
  logic: [
  'Monitor real-time buy/sell volume ratio',
  'Imbalance threshold ≥ 75% one side',
  'Wait for 1m pullback/pause candle',
  'Enter at pullback end in imbalance direction',
  'Quick exit: 5-10 pips target',
  'SL: opposite side of imbalance zone'],

  why: 'Pure order flow = no lag. When 75%+ of volume hits one side, the next 2-5 candles follow.'
}];


export function findScalpStrategy(
id: ScalpStrategyId)
: ScalpStrategyDef | undefined {
  return SCALP_STRATEGIES.find((s) => s.id === id);
}