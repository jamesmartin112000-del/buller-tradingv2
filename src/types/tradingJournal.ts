export type TradeDirection = 'BUY' | 'SELL';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TradeStatus = 'OPEN' | 'COMPLETED';
export type YesNo = 'YES' | 'NO';

export interface JournalSettings {
  userId: string;
  startingCapital: number;
  riskPercent: number;
  maxDailyLossPercent: number;
  maxTradesPerDay: number;
  contractSize: number;
  defaultLotSize: number;
  currency: 'USD';
  defaultTimeframe: string;
  defaultSession: string;
  dateFormat: string;
  updatedAt: number;
}

export interface TradeDraft {
  date: string;
  entryTime: string;
  exitTime: string;
  direction: TradeDirection;
  timeframe: string;
  session: string;
  setup: string;
  newsDay: YesNo;
  newsImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  ruleCheck: YesNo;
  emotion: string;
  mistake: string;
  quality: 'A+' | 'A' | 'B' | 'C' | 'D';
  reason: string;
  screenshotUrl?: string | null;
  screenshotPath?: string | null;
}

export interface JournalTrade extends TradeDraft {
  id: string;
  userId: string;
  tradeNo: number;
  instrument: 'XAUUSD / GOLD';
  month: string;
  day: number;
  riskAmount: number;
  riskPercentActual: number;
  plannedRisk: number;
  plannedRR: number;
  actualPL: number;
  equityAfter: number;
  outcome: TradeOutcome;
  status: TradeStatus;
  createdAt: number;
  updatedAt: number;
}

export interface MetricSummary {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  pl: number;
  avgPL: number;
}

export interface JournalSummary extends MetricSummary {
  startingCapital: number;
  currentEquity: number;
  netPL: number;
  returnPercent: number;
  lossRate: number;
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  ruleCompliance: number;
  ruleViolations: number;
  overtradingIncidents: number;
  disciplineScore: number;
  riskScore: number;
  status: 'PROFITABLE' | 'BREAKEVEN' | 'LOSS';
}

export interface JournalPayload {
  trades: JournalTrade[];
  settings: JournalSettings;
}