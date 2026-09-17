import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Alert, Box, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { RotateCcwIcon, ShieldAlertIcon } from 'lucide-react';
import {
  analyzeCryptoInstitutionalMaster,
  type CryptoInstitutionalAnalysis } from
'../../lib/engine/cryptoInstitutionalMaster';
import { binanceWS } from '../../lib/trading/binanceWebSocket';
import {
  createAbortController,
  type AbortControllerLike } from
'../../lib/utils/abortController';
import { CryptoEngineAudit } from './crypto/CryptoEngineAudit';
import { CryptoMasterDetails } from './crypto/CryptoMasterDetails';
import { CryptoMasterHeader } from './crypto/CryptoMasterHeader';
import { CryptoMasterOverview } from './crypto/CryptoMasterOverview';
import {
  cryptoPairLabel,
  fetchActiveBinanceUsdtPairs,
  fetchCryptoMarketData,
  normalizeCryptoSymbol } from
'./crypto/cryptoMarketData';
const AUTO_REFRESH_SECONDS = 30;
const DEFAULT_PAIR = 'BTCUSDT';
export type CryptoPanelStatus =
'initializing' |
'fetching' |
'live' |
'error' |
'reset';
export function CryptoInstitutionalMaster() {
  const [selectedPair, setSelectedPair] = useState(DEFAULT_PAIR);
  const [activePairs, setActivePairs] = useState<string[]>([]);
  const [customPair, setCustomPair] = useState('');
  const [customPairError, setCustomPairError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CryptoInstitutionalAnalysis | null>(
    null
  );
  const [status, setStatus] = useState<CryptoPanelStatus>('initializing');
  const [warning, setWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [resetting, setResetting] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const analysisRef = useRef<CryptoInstitutionalAnalysis | null>(null);
  const abortRef = useRef<AbortControllerLike | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const resettingRef = useRef(false);
  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);
  useEffect(() => {
    const controller = createAbortController();
    void fetchActiveBinanceUsdtPairs(controller.signal).
    then((pairs) => {
      if (mountedRef.current) setActivePairs(pairs);
    }).
    catch(() => {

      // Ticker validation remains available if exchangeInfo is blocked.
    });return () => controller.abort();
  }, []);
  const refresh = useCallback(
    async (manual = false) => {
      if (resettingRef.current) return;
      abortRef.current?.abort();
      const controller = createAbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      setStatus('fetching');
      setWarning(null);
      try {
        const input = await fetchCryptoMarketData(
          selectedPair,
          controller.signal
        );
        if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== requestRef.current)
        {
          return;
        }
        const nextAnalysis = analyzeCryptoInstitutionalMaster(input);
        analysisRef.current = nextAnalysis;
        setAnalysis(nextAnalysis);
        setLivePrice(null);
        setStatus('live');
        setCountdown(AUTO_REFRESH_SECONDS);
        const unavailable = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'].filter(
          (timeframe) =>
          !input.candles[timeframe as keyof typeof input.candles]?.length
        );
        const notes: string[] = [];
        if (unavailable.length) {
          notes.push(`OHLC unavailable for ${unavailable.join(', ')}`);
        }
        if (!input.fearGreed) {
          notes.push('Fear & Greed unavailable; no sentiment score applied');
        }
        if (manual && notes.length === 0) {
          notes.push('Fresh Binance snapshots loaded');
        }
        setWarning(notes.length ? `${notes.join('. ')}.` : null);
      } catch (caught) {
        if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== requestRef.current)
        {
          return;
        }
        const message =
        caught instanceof Error ? caught.message : 'Crypto analysis failed.';
        setStatus('error');
        setWarning(
          analysisRef.current ?
          `${message} Last verified ${selectedPair} analysis remains visible.` :
          message
        );
      }
    },
    [selectedPair]
  );
  useEffect(() => {
    let refreshTimer: number | null = null;
    let countdownTimer: number | null = null;
    const stop = () => {
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      if (countdownTimer !== null) window.clearInterval(countdownTimer);
      refreshTimer = null;
      countdownTimer = null;
    };
    const start = () => {
      if (document.visibilityState !== 'visible' || refreshTimer !== null) return;
      refreshTimer = window.setInterval(
        () => void refresh(),
        AUTO_REFRESH_SECONDS * 1000
      );
      countdownTimer = window.setInterval(() => {
        setCountdown((value) => value > 0 ? value - 1 : 0);
      }, 1000);
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
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, restartToken]);
  useEffect(() => {
    if (!analysis || analysis.symbol !== selectedPair) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void binanceWS.getLatestData(selectedPair, '1m').then((candles) => {
      if (!active) return;
      const latest = candles?.at(-1);
      if (latest?.close) setLivePrice(latest.close);
      unsubscribe = binanceWS.subscribe(selectedPair, '1m', (candle) => {
        if (active && candle.close > 0) setLivePrice(candle.close);
      });
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [selectedPair, analysis]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      abortRef.current?.abort();
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);
  const switchPair = useCallback(
    (rawPair: string) => {
      const normalized = normalizeCryptoSymbol(rawPair);
      if (!normalized || normalized === selectedPair) return;
      requestRef.current += 1;
      abortRef.current?.abort();
      analysisRef.current = null;
      setAnalysis(null);
      setLivePrice(null);
      setWarning(null);
      setCustomPairError(null);
      setCountdown(AUTO_REFRESH_SECONDS);
      setStatus('initializing');
      setSelectedPair(normalized);
    },
    [selectedPair]
  );
  const submitCustomPair = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const normalized = normalizeCryptoSymbol(customPair);
      if (!normalized.endsWith('USDT') || normalized.length <= 4) {
        const message = 'Enter a Binance USDT spot pair such as BTC/USDT.';
        setStatus('error');
        setWarning(message);
        setCustomPairError(message);
        return;
      }
      if (activePairs.length > 0 && !activePairs.includes(normalized)) {
        const message = `${cryptoPairLabel(normalized)} is not an active Binance USDT spot pair.`;
        setStatus('error');
        setWarning(message);
        setCustomPairError(message);
        return;
      }
      setCustomPair('');
      setCustomPairError(null);
      if (normalized === selectedPair) {
        void refresh(true);
      } else {
        switchPair(normalized);
      }
    },
    [activePairs, customPair, refresh, selectedPair, switchPair]
  );
  const reset = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    resettingRef.current = true;
    analysisRef.current = null;
    setAnalysis(null);
    setLivePrice(null);
    setWarning(null);
    setStatus('reset');
    setResetting(true);
    setCountdown(AUTO_REFRESH_SECONDS);
    setCustomPair('');
    setCustomPairError(null);
    setSelectedPair(DEFAULT_PAIR);
    resetTimerRef.current = window.setTimeout(() => {
      resettingRef.current = false;
      setResetting(false);
      setStatus('initializing');
      setRestartToken((value) => value + 1);
    }, 2000);
  }, []);
  const loading = status === 'fetching' || status === 'initializing';
  const displayedPrice =
  livePrice && livePrice > 0 ? livePrice : analysis?.price ?? 0;
  return (
    <Card
      component="section"
      aria-labelledby="crypto-master-heading"
      radius="md"
      padding="md"
      className="border border-brand/25 bg-bg-700">
      
      <Stack gap="sm">
        <CryptoMasterHeader
          selectedPair={selectedPair}
          activePairs={activePairs}
          customPair={customPair}
          customPairError={customPairError}
          countdown={countdown}
          status={status}
          loading={loading}
          resetting={resetting}
          onPairChange={switchPair}
          onCustomPairChange={(pair) => {
            setCustomPair(pair);
            setCustomPairError(null);
          }}
          onCustomPairSubmit={submitCustomPair}
          onRefresh={() => void refresh(true)}
          onReset={reset} />
        

        {warning &&
        <Alert
          color={
          status === 'error' ?
          'red' :
          status === 'live' ?
          'green' :
          'yellow'
          }
          icon={<ShieldAlertIcon size={16} />}
          role={status === 'error' ? 'alert' : 'status'}>
          
            <Text size="xs">{warning}</Text>
          </Alert>
        }

        {!analysis && loading ?
        <CryptoSkeleton /> :
        !analysis ?
        <EmptyState resetting={resetting} /> :

        <>
            <SimpleGrid
            cols={{
              base: 1,
              xl: 2
            }}
            spacing="sm">
            
              <CryptoMasterOverview
              analysis={analysis}
              currentPrice={displayedPrice} />
            
              <CryptoMasterDetails
              analysis={analysis}
              displayedPrice={displayedPrice}
              hasLiveWebSocketPrice={Boolean(livePrice)} />
            
            </SimpleGrid>
            <CryptoEngineAudit analysis={analysis} />
          </>
        }

        <Group
          justify="space-between"
          gap="xs"
          wrap="wrap"
          className="border-t border-white/5 pt-2">
          
          <Text size="xs" c="dimmed">
            Real sources: Binance spot ticker, depth, aggregate trades, seven
            OHLC timeframes and validated 1m WebSocket
          </Text>
          <Text size="xs" c="dimmed">
            Alternative.me sentiment · Proxies labeled · Auto 30s
          </Text>
        </Group>
      </Stack>
    </Card>);

}
function EmptyState({ resetting }: {resetting: boolean;}) {
  return (
    <Card
      radius="md"
      padding="xl"
      className="border border-white/10 bg-white/[0.02]">
      
      <Stack align="center" gap="xs">
        {resetting ?
        <RotateCcwIcon size={24} className="text-yellow-400" /> :

        <ShieldAlertIcon size={24} className="text-red-400" />
        }
        <Text fw={800} c={resetting ? '#ffd700' : '#ff4444'}>
          {resetting ? 'RESET' : 'PAIR FEED UNAVAILABLE'}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {resetting ?
          'Crypto state cleared. BTC/USDT restarts automatically in 2 seconds.' :
          'Choose an active Binance USDT spot pair. No synthetic candles or fabricated flows are shown.'}
        </Text>
      </Stack>
    </Card>);

}
function CryptoSkeleton() {
  return (
    <SimpleGrid
      cols={{
        base: 1,
        xl: 2
      }}
      spacing="sm"
      role="status">
      
      {Array.from({
        length: 6
      }).map((_, index) =>
      <Box
        key={index}
        className="h-40 animate-pulse rounded-md border border-white/5 bg-white/[0.025]" />

      )}
      <span className="sr-only">Loading real Binance crypto analysis</span>
    </SimpleGrid>);

}