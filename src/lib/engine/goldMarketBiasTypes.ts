import type { BinanceCandle } from '../trading/binanceWebSocket';
import type { MarketCandleSource } from '../trading/marketCandles';

export const GOLD_BIAS_TIMEFRAMES = [
'1mo',
'1w',
'1d',
'4h',
'1h',
'15m',
'1m'] as
const;

export const DXY_BIAS_TIMEFRAMES = [
'1mo',
'1w',
'1d',
'4h',
'1h',
'15m'] as
const;

export type GoldBiasTimeframe = (typeof GOLD_BIAS_TIMEFRAMES)[number];
export type DxyBiasTimeframe = (typeof DXY_BIAS_TIMEFRAMES)[number];
export type GoldBiasDirection = 'BUY' | 'SELL' | 'NEUTRAL';
export type TrendDirection = 'bullish' | 'bearish' | 'neutral';
export type StructureDirection = 'HH/HL' | 'LH/LL' | 'RANGE';

export interface GoldCandleInput {
  candles: BinanceCandle[];
  source: MarketCandleSource;
}

export type GoldCandleInputs = Partial<
  Record<GoldBiasTimeframe, GoldCandleInput>>;

export type DxyCandleInputs = Partial<Record<DxyBiasTimeframe, GoldCandleInput>>;

export interface GoldTimeframeBias {
  timeframe: GoldBiasTimeframe;
  available: boolean;
  candleCount: number;
  price: number | null;
  direction: TrendDirection;
  structure: StructureDirection | null;
  ema20: number | null;
  ema50: number | null;
  rsi: number | null;
  structureScore: number;
  emaScore: number;
  rsiScore: number;
  liquidityScore: number;
  score: number;
  maxScore: number;
  liquidity: GoldLiquidityEvent | null;
  source: MarketCandleSource | null;
  lastCandleAt: number | null;
  reason: string;
}

export interface GoldLiquidityEvent {
  direction: 'BUY' | 'SELL';
  level: number;
  timestamp: number;
  label: 'SELL-SIDE SWEEP' | 'BUY-SIDE SWEEP';
}

export interface GoldBosResult {
  direction: GoldBiasDirection;
  level: number | null;
  timestamp: number | null;
}

export interface GoldFvgResult {
  direction: 'BUY' | 'SELL';
  low: number;
  high: number;
  timestamp: number;
}

export interface GoldDxyCheck {
  timeframe: DxyBiasTimeframe;
  status: 'CONFIRMED' | 'CONFLICT' | 'NEUTRAL' | 'UNAVAILABLE';
  goldDirection: TrendDirection | 'unavailable';
  dxyDirection: TrendDirection | 'unavailable';
  correlation: number | null;
  score: number;
  reason: string;
}

export interface GoldTradePlan {
  direction: Exclude<GoldBiasDirection, 'NEUTRAL'>;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
}

export interface GoldConfirmationStep {
  number: number;
  title: string;
  state: 'pass' | 'wait' | 'unavailable';
  detail: string;
}

export interface GoldMarketBiasAnalysis {
  symbol: 'XAUUSD';
  direction: GoldBiasDirection;
  confidence: number;
  score: number;
  maxScore: number;
  currentPrice: number;
  timeframes: Record<GoldBiasTimeframe, GoldTimeframeBias>;
  dxyChecks: GoldDxyCheck[];
  liquidity: GoldLiquidityEvent | null;
  bos: GoldBosResult;
  fvg: GoldFvgResult | null;
  tradePlan: GoldTradePlan | null;
  confirmationSteps: GoldConfirmationStep[];
  reasons: string[];
  sources: MarketCandleSource[];
  marketTimestamp: number;
  analyzedAt: number;
}