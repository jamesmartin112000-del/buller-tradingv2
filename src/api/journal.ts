import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'./_lib/firebaseAdmin';
import type {
  JournalSettings,
  JournalTrade,
  TradeDraft } from
'../types/tradingJournal';
import {
  DEFAULT_JOURNAL_SETTINGS,
  calculateTrade,
  recalculateEquityChain,
  validateTrade } from
'../utils/calculations';

const MAX_IMPORT_ROWS = 5000;

async function loadSettings(userId: string): Promise<JournalSettings> {
  const snapshot = await adminDb.collection('journal_settings').doc(userId).get();
  return {
    ...DEFAULT_JOURNAL_SETTINGS,
    ...(snapshot.exists ? snapshot.data() : {}),
    userId
  } as JournalSettings;
}

async function loadTrades(userId: string): Promise<JournalTrade[]> {
  const snapshot = await adminDb.collection('trades').where('userId', '==', userId).get();
  return snapshot.docs.
  map((document) => ({ id: document.id, ...document.data() }) as JournalTrade).
  sort(
    (a, b) =>
    `${a.date}T${a.entryTime}`.localeCompare(`${b.date}T${b.entryTime}`) ||
    a.createdAt - b.createdAt
  );
}

function targetUserId(
caller: Awaited<ReturnType<typeof verifyAuthenticatedRequest>>,
requested: unknown)
{
  if (!requested || requested === caller.uid) return caller.uid;
  if (caller.role !== 'admin' && caller.role !== 'super_admin') {
    throw new HttpError(403, 'You cannot access another user’s journal.');
  }
  return String(requested);
}

async function writeAudit(input: {
  userId: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
}) {
  await adminDb.collection('audit_logs').add({ ...input, timestamp: Date.now() });
}

async function persistChain(userId: string, chain: JournalTrade[]) {
  const batch = adminDb.batch();
  chain.forEach((trade) => {
    batch.set(adminDb.collection('trades').doc(trade.id), trade, { merge: true });
  });
  await batch.commit();
}

export default async function journalHandler(
request: VercelRequest,
response: VercelResponse)
{
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const caller = await verifyAuthenticatedRequest(request.headers.authorization);
    const action = request.method === 'GET' ? 'list' : String(request.body?.action || '');
    const userId = targetUserId(caller, request.method === 'GET' ? request.query.userId : request.body?.userId);
    const settings = await loadSettings(userId);

    if (action === 'list') {
      return response.status(200).json({ settings, trades: await loadTrades(userId) });
    }

    if (action === 'save-settings') {
      const patch = request.body?.settings as Partial<JournalSettings>;
      const next: JournalSettings = {
        ...settings,
        startingCapital: boundedNumber(patch.startingCapital, 1, 100000000, settings.startingCapital),
        riskPercent: boundedNumber(patch.riskPercent, 0.01, 100, settings.riskPercent),
        maxDailyLossPercent: boundedNumber(patch.maxDailyLossPercent, 0.1, 100, settings.maxDailyLossPercent),
        maxTradesPerDay: boundedNumber(patch.maxTradesPerDay, 1, 20, settings.maxTradesPerDay),
        contractSize: boundedNumber(patch.contractSize, 1, 10000, settings.contractSize),
        defaultLotSize: boundedNumber(patch.defaultLotSize, 0.01, 100, settings.defaultLotSize),
        currency: 'USD',
        defaultTimeframe: String(patch.defaultTimeframe || settings.defaultTimeframe),
        defaultSession: String(patch.defaultSession || settings.defaultSession),
        dateFormat: String(patch.dateFormat || settings.dateFormat),
        userId,
        updatedAt: Date.now()
      };
      await adminDb.collection('journal_settings').doc(userId).set(next, { merge: false });
      const chain = recalculateEquityChain(await loadTrades(userId), next);
      await persistChain(userId, chain);
      await writeAudit({ userId, actor: caller.email, action: 'JOURNAL_SETTINGS_UPDATED', entity: 'journal_settings', before: settings, after: next });
      return response.status(200).json({ settings: next, trades: chain });
    }

    if (action === 'save-trade') {
      const draft = request.body?.trade as TradeDraft;
      const errors = validateTrade(draft);
      if (errors.length) throw new HttpError(400, errors.join(' '));
      const existingTrades = await loadTrades(userId);
      const requestedId = request.body?.id ? String(request.body.id) : null;
      const existing = requestedId ? existingTrades.find((trade) => trade.id === requestedId) : undefined;
      const sameDay = existingTrades.filter((trade) => trade.date === draft.date && trade.id !== requestedId);
      const dayPL = sameDay.reduce((sum, trade) => sum + trade.actualPL, 0);
      const lossLimit = settings.startingCapital * (settings.maxDailyLossPercent / 100);
      const override = request.body?.override === true && (caller.role === 'admin' || caller.role === 'super_admin');
      if (!override && sameDay.length >= settings.maxTradesPerDay) {
        throw new HttpError(409, 'DAILY TRADE LIMIT REACHED');
      }
      if (!override && dayPL <= -lossLimit) {
        throw new HttpError(409, 'MAXIMUM DAILY LOSS REACHED — TRADING STOP');
      }
      const id = requestedId || adminDb.collection('trades').doc().id;
      const now = Date.now();
      const provisional: JournalTrade = {
        ...draft,
        screenshotUrl: draft.screenshotUrl || null,
        screenshotPath: draft.screenshotPath || null,
        id,
        userId,
        tradeNo: existing?.tradeNo || existingTrades.length + 1,
        instrument: 'XAUUSD / GOLD',
        month: draft.date.slice(0, 7),
        day: Number(draft.date.slice(8, 10)),
        ...calculateTrade(draft, settings.startingCapital, settings),
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      const chain = recalculateEquityChain(
        [...existingTrades.filter((trade) => trade.id !== id), provisional],
        settings
      );
      await persistChain(userId, chain);
      await writeAudit({
        userId,
        actor: caller.email,
        action: existing ? 'TRADE_UPDATED' : override ? 'TRADE_LIMIT_OVERRIDE' : 'TRADE_CREATED',
        entity: 'trade',
        before: existing || null,
        after: chain.find((trade) => trade.id === id) || provisional
      });
      return response.status(200).json({ settings, trades: chain });
    }

    if (action === 'delete-trade') {
      const id = String(request.body?.id || '');
      const existingTrades = await loadTrades(userId);
      const existing = existingTrades.find((trade) => trade.id === id);
      if (!existing) throw new HttpError(404, 'Trade not found.');
      await adminDb.collection('trades').doc(id).delete();
      const chain = recalculateEquityChain(existingTrades.filter((trade) => trade.id !== id), settings);
      await persistChain(userId, chain);
      await writeAudit({ userId, actor: caller.email, action: 'TRADE_DELETED', entity: 'trade', before: existing, after: null });
      return response.status(200).json({ settings, trades: chain });
    }

    if (action === 'reset') {
      const existingTrades = await loadTrades(userId);
      const batch = adminDb.batch();
      existingTrades.forEach((trade) => batch.delete(adminDb.collection('trades').doc(trade.id)));
      await batch.commit();
      await writeAudit({ userId, actor: caller.email, action: 'JOURNAL_RESET', entity: 'journal', before: { trades: existingTrades }, after: { trades: [] } });
      return response.status(200).json({ settings, trades: [] });
    }

    if (action === 'restore') {
      const rows = request.body?.trades as JournalTrade[];
      if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS) {
        throw new HttpError(400, 'Backup file is invalid or too large.');
      }
      const cleanRows = rows.map((row) => {
        const draft: TradeDraft = {
          date: String(row.date), entryTime: String(row.entryTime), exitTime: String(row.exitTime || ''),
          direction: row.direction, timeframe: String(row.timeframe), session: String(row.session),
          setup: String(row.setup), newsDay: row.newsDay, newsImpact: row.newsImpact,
          lotSize: Number(row.lotSize), entryPrice: Number(row.entryPrice), stopLoss: Number(row.stopLoss),
          takeProfit: Number(row.takeProfit), exitPrice: row.exitPrice === null ? null : Number(row.exitPrice),
          ruleCheck: row.ruleCheck, emotion: String(row.emotion), mistake: String(row.mistake),
          quality: row.quality, reason: String(row.reason), screenshotUrl: row.screenshotUrl || null,
          screenshotPath: row.screenshotPath || null
        };
        const errors = validateTrade(draft);
        if (errors.length) throw new HttpError(400, `Invalid backup row: ${errors.join(' ')}`);
        return {
          ...row,
          ...draft,
          id: String(row.id || adminDb.collection('trades').doc().id),
          userId,
          instrument: 'XAUUSD / GOLD' as const,
          month: draft.date.slice(0, 7),
          day: Number(draft.date.slice(8, 10)),
          createdAt: Number(row.createdAt || Date.now()),
          updatedAt: Date.now()
        };
      });
      const before = await loadTrades(userId);
      const deleteBatch = adminDb.batch();
      before.forEach((trade) => deleteBatch.delete(adminDb.collection('trades').doc(trade.id)));
      await deleteBatch.commit();
      const chain = recalculateEquityChain(cleanRows, settings);
      await persistChain(userId, chain);
      await writeAudit({ userId, actor: caller.email, action: 'JOURNAL_RESTORED', entity: 'journal', before: { count: before.length }, after: { count: chain.length } });
      return response.status(200).json({ settings, trades: chain });
    }

    throw new HttpError(400, 'Unknown journal action.');
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}