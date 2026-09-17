import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  deleteTrade,
  loadJournal,
  resetJournal,
  restoreJournal,
  saveJournalSettings,
  saveTrade,
  subscribeJournal } from
'../lib/journal/journalService';
import { DEFAULT_JOURNAL_SETTINGS } from '../utils/calculations';
import type {
  JournalSettings,
  JournalTrade,
  TradeDraft } from
'../types/tradingJournal';

export function useTradingJournal(userId?: string) {
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [settings, setSettings] = useState<JournalSettings>({
    ...DEFAULT_JOURNAL_SETTINGS,
    userId: userId || ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((payload: {trades: JournalTrade[];settings: JournalSettings;}) => {
    setTrades(payload.trades);
    setSettings(payload.settings);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let lastError: unknown = null;
    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          apply(await loadJournal(userId));
          return;
        } catch (caught) {
          lastError = caught;
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
          }
        }
      }
      const message =
      lastError instanceof Error ? lastError.message : 'Journal could not be loaded.';
      console.error('Journal load failed after retries', lastError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apply, userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeJournal(
      userId,
      (payload) => {
        apply(payload);
        setLoading(false);
      },
      (caught) => {
        console.error('Journal realtime sync failed', caught);
        setError(caught.message || 'Journal realtime sync failed.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [apply, userId]);

  const run = useCallback(
    async (operation: () => Promise<{trades: JournalTrade[];settings: JournalSettings;}>, success: string) => {
      setSaving(true);
      try {
        const payload = await operation();
        apply(payload);
        toast.success(success);
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The journal request failed.';
        console.error('Journal mutation failed', caught);
        toast.error(message);
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [apply]
  );

  return {
    trades,
    settings,
    loading,
    saving,
    error,
    refresh,
    saveTrade: (trade: TradeDraft, id?: string, override = false) =>
    run(() => saveTrade(trade, id, userId, override), id ? 'Trade updated' : 'Trade recorded'),
    deleteTrade: (id: string) => run(() => deleteTrade(id, userId), 'Trade permanently deleted'),
    saveSettings: (patch: Partial<JournalSettings>) =>
    run(() => saveJournalSettings(patch, userId), 'Journal settings saved'),
    reset: () => run(() => resetJournal(userId), 'Journal reset complete'),
    restore: (rows: JournalTrade[]) => run(() => restoreJournal(rows, userId), 'Journal restored')
  };
}