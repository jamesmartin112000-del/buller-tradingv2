import type { JournalSettings, JournalSummary, JournalTrade } from '../../types/tradingJournal';

const TRADE_HEADERS: (keyof JournalTrade)[] = [
'id', 'date', 'tradeNo', 'direction', 'timeframe', 'session', 'setup', 'newsDay',
'newsImpact', 'lotSize', 'entryPrice', 'stopLoss', 'takeProfit', 'exitPrice',
'riskAmount', 'plannedRR', 'actualPL', 'equityAfter', 'outcome', 'ruleCheck',
'emotion', 'mistake', 'quality', 'reason', 'screenshotUrl', 'status'];


function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportCsv(trades: JournalTrade[], month: string) {
  const csv = [
  TRADE_HEADERS.join(','),
  ...trades.map((trade) =>
  TRADE_HEADERS.map((header) => escapeCsvCell(trade[header])).join(',')
  )].
  join('\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `buller-journal-${month}.csv`);
}

export async function exportExcel(trades: JournalTrade[], summary: JournalSummary, month: string) {
  const imported = (await import('xlsx')) as typeof import('xlsx') & {
    default?: typeof import('xlsx');
  };
  const XLSX = imported.utils ? imported : imported.default;
  if (!XLSX?.utils?.book_new || !XLSX.utils.json_to_sheet || !XLSX.writeFile) {
    throw new Error('Excel export is unavailable. Please use CSV export instead.');
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trades), 'Trades');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      Object.entries(summary).map(([metric, value]) => ({ metric, value }))
    ),
    'Monthly Summary'
  );
  XLSX.writeFile(workbook, `buller-journal-${month}.xlsx`);
}

export function exportBackup(trades: JournalTrade[], settings: JournalSettings) {
  download(
    new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), settings, trades }, null, 2)], {
      type: 'application/json'
    }),
    `buller-journal-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
}

export async function parseBackup(file: File): Promise<JournalTrade[]> {
  const parsed = JSON.parse(await file.text()) as {version?: number;trades?: JournalTrade[];};
  if (parsed.version !== 1 || !Array.isArray(parsed.trades)) {
    throw new Error('This is not a valid BULLER TRADING journal backup.');
  }
  return parsed.trades;
}