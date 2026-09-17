import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearMarketDataCache,
  fetchAllMarketData,
  SMT_TIMEFRAMES } from
'../lib/marketData';
import { fullScan, type ScanResults } from '../lib/smtEngine';
import type { Timeframe } from '../lib/types';

interface UseSmtScannerOptions {
  timeframes?: Timeframe[];
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

interface UseSmtScannerReturn {
  data: ScanResults | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  clearCache: () => void;
}

export function useSmtScanner(
options: UseSmtScannerOptions = {})
: UseSmtScannerReturn {
  const {
    timeframes = SMT_TIMEFRAMES,
    autoRefresh = true,
    refreshIntervalMs = 120_000
  } = options;
  const timeframesKey = timeframes.join('|');
  const stableTimeframes = useMemo(
    () => timeframesKey ? timeframesKey.split('|') as Timeframe[] : [],
    [timeframesKey]
  );
  const [data, setData] = useState<ScanResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);

  const runScan = useCallback(
    async (forceRefresh: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const requestId = ++requestRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const { gold, dxy } = await fetchAllMarketData(
          stableTimeframes,
          forceRefresh
        );
        const results = fullScan(gold, dxy, stableTimeframes);

        if (!mountedRef.current || requestId !== requestRef.current) return;
        if (results.summary.availableTimeframes === 0) {
          setError(
            'Gold and DXY feeds are temporarily unavailable across all timeframes.'
          );
          return;
        }

        setData(results);
        setLastUpdated(new Date());
      } catch (caught) {
        if (!mountedRef.current || requestId !== requestRef.current) return;
        setError(caught instanceof Error ? caught.message : 'SMT scan failed.');
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current && requestId === requestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [stableTimeframes]
  );

  const refresh = useCallback(async () => runScan(true), [runScan]);
  const clearCache = useCallback(() => clearMarketDataCache(), []);

  useEffect(() => {
    mountedRef.current = true;
    void runScan(false);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [runScan]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    let interval: number | null = null;
    const start = () => {
      if (document.hidden || interval !== null) return;
      interval = window.setInterval(
        () => void runScan(true),
        refreshIntervalMs
      );
    };
    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();else
      {
        void runScan(true);
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoRefresh, refreshIntervalMs, runScan]);

  return { data, isLoading, error, lastUpdated, refresh, clearCache };
}