import type {
  JournalSettings,
  JournalSummary,
  JournalTrade,
  MetricSummary,
  TradeDirection,
  TradeDraft } from
'../types/tradingJournal';

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  userId: '',
  startingCapital: 100,
  riskPercent: 1,
  maxDailyLossPercent: 3,
  maxTradesPerDay: 3,
  contractSize: 100,
  defaultLotSize: 0.01,
  currency: 'USD',
  defaultTimeframe: '15m',
  defaultSession: 'LONDON',
  dateFormat: 'DD/MM/YYYY',
  updatedAt: 0
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePL(
direction: TradeDirection,
entry: number,
exit: number | null,
lot: number,
contract: number)
: number {
  if (exit === null) return 0;
  const difference = direction === 'BUY' ? exit - entry : entry - exit;
  return roundMoney(difference * lot * contract);
}

export function calculateRisk(
entry: number,
stopLoss: number,
lot: number,
contract: number)
: number {
  return roundMoney(Math.abs(entry - stopLoss) * lot * contract);
}

export function calculateRR(entry: number, stopLoss: number, takeProfit: number): number {
  const riskDistance = Math.abs(entry - stopLoss);
  if (!riskDistance) return 0;
  return Math.round(Math.abs(takeProfit - entry) / riskDistance * 100) / 100;
}

export function formatRR(value: number): string {
  return `1:${value.toFixed(2)}`;
}

export function validateTrade(draft: TradeDraft): string[] {
  const errors: string[] = [];
  const numbers = [draft.entryPrice, draft.stopLoss, draft.takeProfit, draft.lotSize];
  if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) {
    errors.push('Price and lot fields must contain valid positive numbers.');
  }
  if (!draft.date || !draft.entryTime || !draft.reason.trim()) {
    errors.push('Date, entry time and reason are required.');
  }
  if (draft.direction === 'BUY' && draft.stopLoss >= draft.entryPrice) {
    errors.push('INVALID STOP LOSS — BUY stop loss must be below entry.');
  }
  if (draft.direction === 'SELL' && draft.stopLoss <= draft.entryPrice) {
    errors.push('INVALID STOP LOSS — SELL stop loss must be above entry.');
  }
  if (draft.direction === 'BUY' && draft.takeProfit <= draft.entryPrice) {
    errors.push('INVALID TAKE PROFIT — BUY take profit must be above entry.');
  }
  if (draft.direction === 'SELL' && draft.takeProfit >= draft.entryPrice) {
    errors.push('INVALID TAKE PROFIT — SELL take profit must be below entry.');
  }
  if (draft.newsDay === 'NO' && draft.newsImpact !== 'NONE') {
    errors.push('News impact must be NONE when News Day is NO.');
  }
  return errors;
}

export function calculateTrade(
draft: TradeDraft,
previousEquity: number,
settings: JournalSettings)
{
  const actualPL = calculatePL(
    draft.direction,
    draft.entryPrice,
    draft.exitPrice,
    draft.lotSize,
    settings.contractSize
  );
  const riskAmount = calculateRisk(
    draft.entryPrice,
    draft.stopLoss,
    draft.lotSize,
    settings.contractSize
  );
  const plannedRR = calculateRR(draft.entryPrice, draft.stopLoss, draft.takeProfit);
  const outcome =
  draft.exitPrice === null ?
  'OPEN' as const :
  actualPL > 0 ?
  'WIN' as const :
  actualPL < 0 ?
  'LOSS' as const :
  'BREAKEVEN' as const;
  return {
    actualPL,
    riskAmount,
    plannedRR,
    plannedRisk: roundMoney(previousEquity * (settings.riskPercent / 100)),
    riskPercentActual: previousEquity > 0 ? roundMoney(riskAmount / previousEquity * 100) : 0,
    equityAfter: roundMoney(previousEquity + actualPL),
    outcome,
    status: draft.exitPrice === null ? 'OPEN' as const : 'COMPLETED' as const
  };
}

export function recalculateEquityChain(
trades: JournalTrade[],
settings: JournalSettings)
: JournalTrade[] {
  let equity = settings.startingCapital;
  return [...trades].
  sort((a, b) => `${a.date}T${a.entryTime}`.localeCompare(`${b.date}T${b.entryTime}`) || a.createdAt - b.createdAt).
  map((trade, index) => {
    const calculated = calculateTrade(trade, equity, settings);
    equity = calculated.equityAfter;
    return { ...trade, ...calculated, tradeNo: index + 1 };
  });
}

export function metricSummary(trades: JournalTrade[]): MetricSummary {
  const completed = trades.filter((trade) => trade.status === 'COMPLETED');
  const wins = completed.filter((trade) => trade.outcome === 'WIN').length;
  const losses = completed.filter((trade) => trade.outcome === 'LOSS').length;
  const breakeven = completed.filter((trade) => trade.outcome === 'BREAKEVEN').length;
  const pl = roundMoney(completed.reduce((total, trade) => total + trade.actualPL, 0));
  return {
    trades: completed.length,
    wins,
    losses,
    breakeven,
    winRate: completed.length ? roundMoney(wins / completed.length * 100) : 0,
    pl,
    avgPL: completed.length ? roundMoney(pl / completed.length) : 0
  };
}

export function groupedMetrics(
trades: JournalTrade[],
field: keyof Pick<JournalTrade, 'session' | 'timeframe' | 'setup' | 'emotion' | 'mistake' | 'quality' | 'newsImpact' | 'ruleCheck'>)
: Record<string, MetricSummary> {
  const groups: Record<string, JournalTrade[]> = {};
  trades.forEach((trade) => {
    const key = String(trade[field]);
    groups[key] = [...(groups[key] || []), trade];
  });
  return Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, metricSummary(rows)]));
}

export function dailyPerformance(trades: JournalTrade[]) {
  const groups: Record<string, JournalTrade[]> = {};
  trades.forEach((trade) => {
    groups[trade.date] = [...(groups[trade.date] || []), trade];
  });
  return Object.entries(groups).
  sort(([a], [b]) => a.localeCompare(b)).
  map(([date, rows]) => ({ date, rows, ...metricSummary(rows) }));
}

export function summarizeJournal(
trades: JournalTrade[],
settings: JournalSettings)
: JournalSummary {
  const base = metricSummary(trades);
  const wins = trades.filter((trade) => trade.actualPL > 0).map((trade) => trade.actualPL);
  const losses = trades.filter((trade) => trade.actualPL < 0).map((trade) => trade.actualPL);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let peak = settings.startingCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  trades.forEach((trade) => {
    peak = Math.max(peak, trade.equityAfter);
    const drawdown = peak - trade.equityAfter;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, peak ? drawdown / peak * 100 : 0);
  });
  const ruleViolations = trades.filter((trade) => trade.ruleCheck === 'NO').length;
  const days = dailyPerformance(trades);
  const overtradingIncidents = days.filter((day) => day.rows.length > settings.maxTradesPerDay).length;
  const riskViolations = trades.filter((trade) => trade.riskPercentActual > settings.riskPercent).length;
  const behavioralMistakes = trades.filter((trade) =>
  ['Revenge Trade', 'FOMO', 'Oversized Position', 'Removed SL', 'Moved SL'].includes(trade.mistake)
  ).length;
  const disciplineScore = Math.max(
    0,
    Math.round(100 - ruleViolations * 8 - overtradingIncidents * 15 - behavioralMistakes * 6)
  );
  const riskScore = Math.max(
    0,
    Math.round(100 - riskViolations * 10 - ruleViolations * 5 - overtradingIncidents * 10)
  );
  const currentEquity = trades.at(-1)?.equityAfter ?? settings.startingCapital;
  const netPL = roundMoney(currentEquity - settings.startingCapital);
  return {
    ...base,
    startingCapital: settings.startingCapital,
    currentEquity,
    netPL,
    returnPercent: settings.startingCapital ? roundMoney(netPL / settings.startingCapital * 100) : 0,
    lossRate: base.trades ? roundMoney(base.losses / base.trades * 100) : 0,
    profitFactor: grossLoss ? Math.round(grossProfit / grossLoss * 100) / 100 : grossProfit ? null : 0,
    averageWin: wins.length ? roundMoney(grossProfit / wins.length) : 0,
    averageLoss: losses.length ? roundMoney(grossLoss / losses.length) : 0,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    maxDrawdown: roundMoney(maxDrawdown),
    maxDrawdownPercent: roundMoney(maxDrawdownPercent),
    ruleCompliance: trades.length ? roundMoney((trades.length - ruleViolations) / trades.length * 100) : 100,
    ruleViolations,
    overtradingIncidents,
    disciplineScore,
    riskScore,
    status: netPL > 0 ? 'PROFITABLE' : netPL < 0 ? 'LOSS' : 'BREAKEVEN'
  };
}

export function assertCalculationSample(): boolean {
  const result = calculateTrade(
    {
      date: '2026-09-07', entryTime: '09:00', exitTime: '10:00', direction: 'BUY',
      timeframe: '15m', session: 'LONDON', setup: 'Liquidity Sweep', newsDay: 'NO',
      newsImpact: 'NONE', lotSize: 0.01, entryPrice: 3470.2, stopLoss: 3468.9,
      takeProfit: 3473, exitPrice: 3472.8, ruleCheck: 'YES', emotion: 'Calm',
      mistake: 'None', quality: 'A+', reason: 'Sample calculation validation'
    },
    100,
    { ...DEFAULT_JOURNAL_SETTINGS, userId: 'sample' }
  );
  return result.actualPL === 2.6 && result.riskAmount === 1.3 && result.plannedRR === 2.15 && result.equityAfter === 102.6 && result.outcome === 'WIN';
}