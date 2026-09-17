import { firebaseAuth } from '../firebase';
import {
  fsCommitBatch,
  fsGet,
  fsList,
  fsSet,
  fsSubscribe,
  fsSubscribeDoc,
  where,
  type BatchOperation,
  type Unsubscribe } from
'../backend/docStore';
import { removeTradeScreenshot } from '../r2Upload';
import type {
  JournalPayload,
  JournalSettings,
  JournalTrade,
  TradeDraft } from
'../../types/tradingJournal';
import {
  DEFAULT_JOURNAL_SETTINGS,
  calculateTrade,
  recalculateEquityChain,
  validateTrade } from
'../../utils/calculations';

const MAX_IMPORT_ROWS = 5000;

function requireOwnUser(userId?: string) {
  const current = firebaseAuth.currentUser;
  if (!current) throw new Error('Please sign in again to access your journal.');
  if (userId && userId !== current.uid) {
    throw new Error('You cannot access another user’s journal.');
  }
  return current.uid;
}

async function loadSettings(userId: string): Promise<JournalSettings> {
  const saved = await fsGet<JournalSettings>('journal_settings', userId);
  return {
    ...DEFAULT_JOURNAL_SETTINGS,
    ...(saved || {}),
    userId
  };
}

async function loadTrades(userId: string): Promise<JournalTrade[]> {
  const rows = await fsList<JournalTrade>('trades', [where('userId', '==', userId)]);
  return rows.sort(
    (a, b) =>
    `${a.date}T${a.entryTime}`.localeCompare(`${b.date}T${b.entryTime}`) ||
    a.createdAt - b.createdAt
  );
}

function chainOperations(chain: JournalTrade[]): BatchOperation[] {
  return chain.map((trade) => ({
    type: 'set',
    path: 'trades',
    id: trade.id,
    data: trade as unknown as Record<string, unknown>,
    merge: true
  }));
}

function auditOperation(
userId: string,
action: string,
entity: string,
details: Record<string, unknown>)
: BatchOperation {
  const id = `audit_${Date.now()}_${crypto.randomUUID()}`;
  return {
    type: 'set',
    path: 'audit_logs',
    id,
    data: {
      id,
      userId,
      actor: firebaseAuth.currentUser?.email || userId,
      action,
      entity,
      ...details,
      timestamp: Date.now()
    },
    merge: false
  };
}

async function payloadFor(userId: string): Promise<JournalPayload> {
  const [settings, trades] = await Promise.all([
  loadSettings(userId),
  loadTrades(userId)]
  );
  return { settings, trades };
}

export async function loadJournal(userId?: string): Promise<JournalPayload> {
  return payloadFor(requireOwnUser(userId));
}

export function subscribeJournal(
userId: string,
callback: (payload: JournalPayload) => void,
onError?: (error: Error) => void)
: Unsubscribe {
  const uid = requireOwnUser(userId);
  let settings: JournalSettings = { ...DEFAULT_JOURNAL_SETTINGS, userId: uid };
  let trades: JournalTrade[] = [];
  let settingsReady = false;
  let tradesReady = false;
  const emit = () => {
    if (!settingsReady || !tradesReady) return;
    callback({ settings, trades: recalculateEquityChain(trades, settings) });
  };
  const unsubscribeSettings = fsSubscribeDoc<JournalSettings>(
    'journal_settings',
    uid,
    (next) => {
      settings = { ...DEFAULT_JOURNAL_SETTINGS, ...(next || {}), userId: uid };
      settingsReady = true;
      emit();
    },
    onError
  );
  const unsubscribeTrades = fsSubscribe<JournalTrade>(
    'trades',
    (next) => {
      trades = next.sort(
        (a, b) =>
        `${a.date}T${a.entryTime}`.localeCompare(`${b.date}T${b.entryTime}`) ||
        a.createdAt - b.createdAt
      );
      tradesReady = true;
      emit();
    },
    [where('userId', '==', uid)],
    onError
  );
  return () => {
    unsubscribeSettings();
    unsubscribeTrades();
  };
}

export async function saveTrade(
trade: TradeDraft,
id?: string,
userId?: string,
_override = false)
: Promise<JournalPayload> {
  const uid = requireOwnUser(userId);
  const settings = await loadSettings(uid);
  const errors = validateTrade(trade);
  if (errors.length) throw new Error(errors.join(' '));

  const existingTrades = await loadTrades(uid);
  const existing = id ? existingTrades.find((row) => row.id === id) : undefined;
  const sameDay = existingTrades.filter((row) => row.date === trade.date && row.id !== id);
  const dayPL = sameDay.reduce((sum, row) => sum + row.actualPL, 0);
  const lossLimit = settings.startingCapital * (settings.maxDailyLossPercent / 100);
  if (sameDay.length >= settings.maxTradesPerDay) {
    throw new Error('DAILY TRADE LIMIT REACHED');
  }
  if (dayPL <= -lossLimit) {
    throw new Error('MAXIMUM DAILY LOSS REACHED — TRADING STOP');
  }

  const tradeId = id || `trade_${Date.now()}_${crypto.randomUUID()}`;
  const now = Date.now();
  const provisional: JournalTrade = {
    ...trade,
    screenshotUrl: trade.screenshotUrl || null,
    screenshotPath: trade.screenshotPath || null,
    id: tradeId,
    userId: uid,
    tradeNo: existing?.tradeNo || existingTrades.length + 1,
    instrument: 'XAUUSD / GOLD',
    month: trade.date.slice(0, 7),
    day: Number(trade.date.slice(8, 10)),
    ...calculateTrade(trade, settings.startingCapital, settings),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const chain = recalculateEquityChain(
    [...existingTrades.filter((row) => row.id !== tradeId), provisional],
    settings
  );
  await fsCommitBatch([
  ...chainOperations(chain),
  auditOperation(uid, existing ? 'TRADE_UPDATED' : 'TRADE_CREATED', 'trade', {
    tradeId
  })]
  );
  return { settings, trades: chain };
}

export async function deleteTrade(id: string, userId?: string): Promise<JournalPayload> {
  const uid = requireOwnUser(userId);
  const [settings, existingTrades] = await Promise.all([
  loadSettings(uid),
  loadTrades(uid)]
  );
  const existing = existingTrades.find((trade) => trade.id === id);
  if (!existing) throw new Error('Trade not found.');
  const chain = recalculateEquityChain(
    existingTrades.filter((trade) => trade.id !== id),
    settings
  );
  await fsCommitBatch([
  { type: 'delete', path: 'trades', id },
  ...chainOperations(chain),
  auditOperation(uid, 'TRADE_DELETED', 'trade', { tradeId: id })]
  );
  if (existing.screenshotPath) {
    await removeTradeScreenshot(existing.screenshotPath).catch((error) => {
      console.warn('[journal] screenshot cleanup failed', error);
    });
  }
  return { settings, trades: chain };
}

export async function saveJournalSettings(
patch: Partial<JournalSettings>,
userId?: string)
: Promise<JournalPayload> {
  const uid = requireOwnUser(userId);
  const current = await loadSettings(uid);
  const next: JournalSettings = {
    ...current,
    ...patch,
    userId: uid,
    currency: 'USD',
    updatedAt: Date.now()
  };
  const chain = recalculateEquityChain(await loadTrades(uid), next);
  await fsCommitBatch([
  {
    type: 'set',
    path: 'journal_settings',
    id: uid,
    data: { id: uid, ...next },
    merge: false
  },
  {
    type: 'set',
    path: 'users',
    id: uid,
    data: { startingCapital: next.startingCapital, updatedAt: Date.now() },
    merge: true
  },
  ...chainOperations(chain),
  auditOperation(uid, 'JOURNAL_SETTINGS_UPDATED', 'journal_settings', {})]
  );
  return { settings: next, trades: chain };
}

export async function resetJournal(userId?: string): Promise<JournalPayload> {
  const uid = requireOwnUser(userId);
  const [settings, trades] = await Promise.all([
  loadSettings(uid),
  loadTrades(uid)]
  );
  await fsCommitBatch([
  ...trades.map<BatchOperation>((trade) => ({
    type: 'delete',
    path: 'trades',
    id: trade.id
  })),
  auditOperation(uid, 'JOURNAL_RESET', 'journal', { tradeCount: trades.length })]
  );
  return { settings, trades: [] };
}

export async function restoreJournal(
trades: JournalTrade[],
userId?: string)
: Promise<JournalPayload> {
  const uid = requireOwnUser(userId);
  if (!Array.isArray(trades) || trades.length > MAX_IMPORT_ROWS) {
    throw new Error('Backup file is invalid or too large.');
  }
  const settings = await loadSettings(uid);
  const cleaned = trades.map((trade) => {
    const draft: TradeDraft = {
      date: String(trade.date),
      entryTime: String(trade.entryTime),
      exitTime: String(trade.exitTime || ''),
      direction: trade.direction,
      timeframe: String(trade.timeframe),
      session: String(trade.session),
      setup: String(trade.setup),
      newsDay: trade.newsDay,
      newsImpact: trade.newsImpact,
      lotSize: Number(trade.lotSize),
      entryPrice: Number(trade.entryPrice),
      stopLoss: Number(trade.stopLoss),
      takeProfit: Number(trade.takeProfit),
      exitPrice: trade.exitPrice === null ? null : Number(trade.exitPrice),
      ruleCheck: trade.ruleCheck,
      emotion: String(trade.emotion),
      mistake: String(trade.mistake),
      quality: trade.quality,
      reason: String(trade.reason),
      screenshotUrl: trade.screenshotUrl || null,
      screenshotPath: trade.screenshotPath || null
    };
    const errors = validateTrade(draft);
    if (errors.length) throw new Error(`Invalid backup row: ${errors.join(' ')}`);
    return {
      ...trade,
      ...draft,
      id: String(trade.id || `trade_${Date.now()}_${crypto.randomUUID()}`),
      userId: uid,
      instrument: 'XAUUSD / GOLD' as const,
      month: draft.date.slice(0, 7),
      day: Number(draft.date.slice(8, 10)),
      createdAt: Number(trade.createdAt || Date.now()),
      updatedAt: Date.now()
    };
  });
  const previous = await loadTrades(uid);
  const chain = recalculateEquityChain(cleaned, settings);
  const restoredIds = new Set(chain.map((trade) => trade.id));
  await fsCommitBatch([
  ...previous.
  filter((trade) => !restoredIds.has(trade.id)).
  map<BatchOperation>((trade) => ({
    type: 'delete',
    path: 'trades',
    id: trade.id
  })),
  ...chainOperations(chain),
  auditOperation(uid, 'JOURNAL_RESTORED', 'journal', {
    previousCount: previous.length,
    restoredCount: chain.length
  })]
  );
  return { settings, trades: chain };
}