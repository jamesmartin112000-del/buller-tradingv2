import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeWhaleActivity } from '../lib/institutional/bigTradeDetector';
import { analyzeDelta, buildFootprints } from '../lib/institutional/deltaFootprint';
import { analyzeDom } from '../lib/institutional/domOrderBook';
import { fifteenStepAnalysis } from '../lib/institutional/fifteenStepAnalysis';
import { fetchBothInstitutionalAssets } from '../lib/institutional/marketDataEngine';
import { detectSniperEntry } from '../lib/institutional/sniperEntry';
import { calculateTradeFormula } from '../lib/institutional/tradeFormula';
import type {
  DeltaAnalysis,
  DomAnalysis,
  FootprintCandle,
  InstitutionalCandle,
  InstitutionalDataSource,
  InstitutionalTimeframe,
  SniperEntry,
  TradeFormulaResult,
  TradeSignal,
  VolumeImprint,
  VolumeProfile,
  WhaleAnalysis } from
'../lib/institutional/types';
import { calculateVI } from '../lib/institutional/viCalculator';
import { calculateVolumeProfile } from '../lib/institutional/volumeProfile';

export interface InstitutionalDashboardState {
  goldCandles: InstitutionalCandle[];
  dxyCandles: InstitutionalCandle[];
  signal: TradeSignal | null;
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  lastUpdated: number | null;
  source: InstitutionalDataSource | null;
  allAnalyses: {
    volumeProfile: VolumeProfile | null;
    delta: DeltaAnalysis | null;
    dom: DomAnalysis | null;
    whale: WhaleAnalysis | null;
    vi: VolumeImprint | null;
    formula: TradeFormulaResult | null;
    sniper: SniperEntry | null;
    footprints: FootprintCandle[];
  };
}

const EMPTY_ANALYSES: InstitutionalDashboardState['allAnalyses'] = {
  volumeProfile: null,
  delta: null,
  dom: null,
  whale: null,
  vi: null,
  formula: null,
  sniper: null,
  footprints: []
};

export function useInstitutionalDashboard(
timeframe: InstitutionalTimeframe = '1h',
autoRefresh = true,
refreshInterval = 120_000)
{
  const [state, setState] = useState<InstitutionalDashboardState>({
    goldCandles: [],
    dxyCandles: [],
    signal: null,
    isLoading: true,
    error: null,
    warnings: [],
    lastUpdated: null,
    source: null,
    allAnalyses: EMPTY_ANALYSES
  });
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = false;
    setState((previous) => ({
      ...previous,
      signal: null,
      error: null,
      warnings: [],
      lastUpdated: null,
      allAnalyses: EMPTY_ANALYSES
    }));
  }, [timeframe]);

  const analyze = useCallback(
    async (forceRefresh = false) => {
      const requestId = ++requestRef.current;
      setState((previous) => ({ ...previous, isLoading: true, error: null }));
      try {
        const { gold, dxy } = await fetchBothInstitutionalAssets(timeframe, forceRefresh);
        if (!mountedRef.current || requestId !== requestRef.current) return;
        if (!gold.candles.length) {
          throw new Error('Verified Gold candles are temporarily unavailable.');
        }
        const volumeProfile = calculateVolumeProfile(gold.candles);
        const delta = analyzeDelta(gold.candles);
        const dom = analyzeDom(gold.candles);
        const whale = analyzeWhaleActivity(gold.candles);
        const vi = calculateVI(gold.candles);
        const formula = calculateTradeFormula(gold.candles);
        const sniper = detectSniperEntry(gold.candles);
        const footprints = buildFootprints(gold.candles).slice(-5);
        const signal = fifteenStepAnalysis(gold.candles, dxy.candles);
        const warnings: string[] = [];
        if (!dxy.candles.length) warnings.push('DXY confirmation unavailable; no inverse-correlation vote was inferred.');
        if (gold.source?.isProxy) warnings.push(`Gold source is a disclosed proxy: ${gold.source.label}.`);
        if (gold.source?.delayed) warnings.push('Gold source is delayed; execution should be confirmed with a broker feed.');
        hasDataRef.current = true;
        setState({
          goldCandles: gold.candles,
          dxyCandles: dxy.candles,
          signal,
          isLoading: false,
          error: null,
          warnings,
          lastUpdated: Date.now(),
          source: gold.source,
          allAnalyses: { volumeProfile, delta, dom, whale, vi, formula, sniper, footprints }
        });
      } catch (caught) {
        if (!mountedRef.current || requestId !== requestRef.current) return;
        const message = caught instanceof Error ? caught.message : 'Institutional analysis failed.';
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: hasDataRef.current ?
          `${message} Last verified analysis remains visible.` :
          message
        }));
      }
    },
    [timeframe]
  );

  useEffect(() => {
    mountedRef.current = true;
    void analyze();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [analyze]);

  useEffect(() => {
    if (!autoRefresh) return;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (document.visibilityState !== 'visible' || timer !== null) return;
      timer = window.setInterval(() => void analyze(true), refreshInterval);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void analyze(true);
        start();
      } else stop();
    };
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [analyze, autoRefresh, refreshInterval]);

  return { ...state, refresh: () => analyze(true) };
}