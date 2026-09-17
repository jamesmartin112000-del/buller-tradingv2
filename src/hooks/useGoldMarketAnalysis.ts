import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeGoldMarketBias,
  DXY_BIAS_TIMEFRAMES,
  GOLD_BIAS_TIMEFRAMES,
  type DxyCandleInputs,
  type GoldCandleInputs,
  type GoldMarketBiasAnalysis } from
'../lib/engine/goldMarketBias';
import { getMarketCandleSnapshot } from '../lib/trading/marketCandles';

export type GoldMarketAnalysisStatus = 'loading' | 'live' | 'partial' | 'error';

export interface GoldMarketAnalysisState {
  analysis: GoldMarketBiasAnalysis | null;
  status: GoldMarketAnalysisStatus;
  loading: boolean;
  error: string | null;
  warnings: string[];
  unavailableGold: string[];
  unavailableDxy: string[];
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const REFRESH_MS = 30_000;

export function useGoldMarketAnalysis(): GoldMarketAnalysisState {
  const [analysis, setAnalysis] = useState<GoldMarketBiasAnalysis | null>(null);
  const [status, setStatus] = useState<GoldMarketAnalysisStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unavailableGold, setUnavailableGold] = useState<string[]>([]);
  const [unavailableDxy, setUnavailableDxy] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const analysisRef = useRef<GoldMarketBiasAnalysis | null>(null);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!analysisRef.current) setStatus('loading');
    setFetching(true);
    setError(null);

    try {
      const [goldResults, dxyResults] = await Promise.all([
      Promise.allSettled(
        GOLD_BIAS_TIMEFRAMES.map((timeframe) =>
        getMarketCandleSnapshot('XAUUSD', timeframe)
        )
      ),
      Promise.allSettled(
        DXY_BIAS_TIMEFRAMES.map((timeframe) =>
        getMarketCandleSnapshot('DXY', timeframe)
        )
      )]
      );
      if (!mountedRef.current || requestId !== requestRef.current) return;

      const goldInputs: GoldCandleInputs = {};
      const dxyInputs: DxyCandleInputs = {};
      const missingGold: string[] = [];
      const missingDxy: string[] = [];

      goldResults.forEach((result, index) => {
        const timeframe = GOLD_BIAS_TIMEFRAMES[index];
        if (result.status === 'fulfilled' && result.value?.candles.length) {
          goldInputs[timeframe] = {
            candles: result.value.candles.slice(-500),
            source: result.value.source
          };
        } else {
          missingGold.push(timeframe);
        }
      });
      dxyResults.forEach((result, index) => {
        const timeframe = DXY_BIAS_TIMEFRAMES[index];
        if (result.status === 'fulfilled' && result.value?.candles.length) {
          dxyInputs[timeframe] = {
            candles: result.value.candles.slice(-500),
            source: result.value.source
          };
        } else {
          missingDxy.push(timeframe);
        }
      });

      if (!goldInputs['1m'] && !goldInputs['15m']) {
        throw new Error(
          'Real XAUUSD execution candles are temporarily unavailable.'
        );
      }

      const next = analyzeGoldMarketBias(goldInputs, dxyInputs);
      const nextWarnings: string[] = [];
      if (missingGold.length) {
        nextWarnings.push(`Gold OHLC unavailable: ${missingGold.join(', ')}`);
      }
      if (missingDxy.length) {
        nextWarnings.push(
          `DXY OHLC unavailable: ${missingDxy.join(', ')}; no missing SMT votes were inferred`
        );
      }
      const executionTimestamp = next.timeframes['1m'].lastCandleAt;
      if (
      executionTimestamp &&
      Date.now() - executionTimestamp > 10 * 60 * 1000)
      {
        nextWarnings.push('Latest real 1m Gold candle is stale; execution remains locked');
      }

      setAnalysis(next);
      setUnavailableGold(missingGold);
      setUnavailableDxy(missingDxy);
      setWarnings(nextWarnings);
      setLastUpdated(Date.now());
      setStatus(nextWarnings.length ? 'partial' : 'live');
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const message =
      caught instanceof Error ? caught.message : 'Gold analysis failed.';
      setError(
        analysisRef.current ?
        `${message} Last verified real-market analysis remains visible.` :
        message
      );
      setStatus('error');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) {
        setFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null || document.visibilityState !== 'visible') return;
      timer = window.setInterval(() => void refresh(), REFRESH_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') void refresh();
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  return {
    analysis,
    status,
    loading: fetching,
    error,
    warnings,
    unavailableGold,
    unavailableDxy,
    lastUpdated,
    refresh
  };
}