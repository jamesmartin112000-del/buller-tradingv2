import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon } from
'@mantine/core';
import {
  Clock3Icon,
  CrosshairIcon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldAlertIcon } from
'lucide-react';
import { useEngine } from '../../context/EngineContext';
import { getMarketCandles } from '../../lib/trading/marketCandles';
import { analyzeGoldInstitutionalSniper } from '../../lib/engine/goldInstitutionalSniper';
import type {
  CandleSets,
  GoldSniperAnalysis } from
'../../lib/engine/goldInstitutionalSniper';
import { GoldMasterOverview } from './gold/GoldMasterOverview';
import { GoldMasterDetails } from './gold/GoldMasterDetails';
import { GoldEngineAudit } from './gold/GoldEngineAudit';
import { fetchMyfxbookSentiment } from './gold/fetchMyfxbookSentiment';
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h'] as const;
const AUTO_REFRESH_SECONDS = 30;
const MANUAL_DEBOUNCE_MS = 200;
export type GoldPanelStatus =
'initializing' |
'fetching' |
'live' |
'error' |
'reset';
export function GoldInstitutionalSniper() {
  const engine = useEngine();
  const quote = engine.pairs.XAUUSD?.price;
  const [analysis, setAnalysis] = useState<GoldSniperAnalysis | null>(null);
  const [status, setStatus] = useState<GoldPanelStatus>('initializing');
  const [warning, setWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [resetting, setResetting] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const manualRef = useRef(0);
  const analysisRef = useRef<GoldSniperAnalysis | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const resettingRef = useRef(false);
  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);
  const refresh = useCallback(async (manual = false) => {
    if (resettingRef.current) return;
    const now = Date.now();
    if (manual && now - manualRef.current < MANUAL_DEBOUNCE_MS) return;
    if (manual) manualRef.current = now;
    const requestId = ++requestRef.current;
    setStatus('fetching');
    setWarning(null);
    try {
      const [settled, sentiment] = await Promise.all([
      Promise.allSettled(
        TIMEFRAMES.map((timeframe) => getMarketCandles('XAUUSD', timeframe))
      ),
      fetchMyfxbookSentiment()]
      );
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const candleSets: CandleSets = {};
      const failed: string[] = [];
      settled.forEach((result, index) => {
        const timeframe = TIMEFRAMES[index];
        if (result.status === 'fulfilled' && result.value) {
          const closed = result.value.filter((candle) => candle.isClosed !== false);
          if (closed.length >= 30) {
            candleSets[timeframe] = closed.slice(-300);
            return;
          }
        }
        failed.push(timeframe);
      });
      const primaryTimeframe = TIMEFRAMES.find(
        (timeframe) => candleSets[timeframe]?.length >= 30
      );
      if (!primaryTimeframe) {
        throw new Error('Closed real Gold OHLC candles are temporarily unavailable.');
      }
      setAnalysis(
        analyzeGoldInstitutionalSniper(candleSets, primaryTimeframe, sentiment)
      );
      setCountdown(AUTO_REFRESH_SECONDS);
      setStatus('live');
      const notes: string[] = [];
      if (failed.length) notes.push(`OHLC unavailable for ${failed.join(', ')}`);
      if (!sentiment) {
        notes.push('Myfxbook sentiment unavailable; no proxy score applied');
      }
      if (notes.length) {
        setWarning(`${notes.join('. ')}. Automatic retry remains active.`);
      }
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const message =
      caught instanceof Error ? caught.message : 'Gold analysis failed.';
      setStatus('error');
      setWarning(
        analysisRef.current ?
        `${message} Last verified analysis remains visible.` :
        message
      );
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      requestRef.current += 1;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, [refresh]);
  const reset = useCallback(() => {
    requestRef.current += 1;
    resettingRef.current = true;
    analysisRef.current = null;
    setAnalysis(null);
    setWarning(null);
    setStatus('reset');
    setResetting(true);
    setCountdown(AUTO_REFRESH_SECONDS);
    resetTimerRef.current = window.setTimeout(() => {
      resettingRef.current = false;
      setResetting(false);
      void refresh();
    }, 2000);
  }, [refresh]);
  const loading = status === 'fetching' || status === 'initializing';
  const hasLiveQuote =
  Boolean(quote?.bid && quote?.ask) &&
  quote!.bid > 0 &&
  quote!.ask > quote!.bid;
  const displayedPrice = hasLiveQuote ?
  quote!.mid || (quote!.bid + quote!.ask) / 2 :
  analysis?.currentPrice || 0;
  const spread = hasLiveQuote ? quote!.ask - quote!.bid : null;
  return (
    <Card
      component="section"
      aria-labelledby="gold-master-heading"
      radius="md"
      padding="md"
      className="border border-brand/25 bg-bg-700">
      
      <Stack gap="sm">
        <GoldMasterHeader
          status={status}
          source={hasLiveQuote ? quote?.src : undefined}
          countdown={countdown}
          loading={loading}
          resetting={resetting}
          onRefresh={() => void refresh(true)}
          onReset={reset} />
        

        {warning &&
        <Alert
          color={status === 'error' ? 'red' : 'yellow'}
          icon={<ShieldAlertIcon size={16} />}
          role={status === 'error' ? 'alert' : 'status'}>
          
            <Text size="xs">{warning}</Text>
          </Alert>
        }

        {!analysis && loading ?
        <MasterSkeleton /> :
        !analysis ?
        <EmptyState resetting={resetting} /> :

        <>
            <SimpleGrid
            cols={{
              base: 1,
              xl: 2
            }}
            spacing="sm">
            
              <GoldMasterOverview
              analysis={analysis}
              currentPrice={displayedPrice} />
            
              <GoldMasterDetails
              analysis={analysis}
              hasLiveQuote={hasLiveQuote}
              bid={hasLiveQuote ? quote!.bid : null}
              ask={hasLiveQuote ? quote!.ask : null}
              displayedPrice={displayedPrice}
              spread={spread}
              quoteSource={hasLiveQuote ? quote?.src : undefined} />
            
            </SimpleGrid>
            <GoldEngineAudit analysis={analysis} />
          </>
        }

        <Group
          justify="space-between"
          gap="xs"
          wrap="wrap"
          className="border-t border-white/5 pt-2">
          
          <Text size="xs" c="dimmed">
            Quote chain: Swissquote BBO primary with existing free fallbacks
          </Text>
          <Text size="xs" c="dimmed">
            OHLC: unified public feed · confirmed closed bars · Auto refresh 30s
          </Text>
        </Group>
      </Stack>
    </Card>);

}
interface GoldMasterHeaderProps {
  status: GoldPanelStatus;
  source?: string;
  countdown: number;
  loading: boolean;
  resetting: boolean;
  onRefresh: () => void;
  onReset: () => void;
}
function GoldMasterHeader({
  status,
  source,
  countdown,
  loading,
  resetting,
  onRefresh,
  onReset
}: GoldMasterHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Box>
        <Group gap="xs" wrap="wrap">
          <ThemeIcon variant="light" color="yellow" size="sm">
            <CrosshairIcon size={15} aria-hidden="true" />
          </ThemeIcon>
          <Text
            component="h2"
            id="gold-master-heading"
            fw={800}
            size="sm"
            c="#ffd700">
            
            Gold Institutional Master
          </Text>
          <Badge color="yellow" variant="light" size="xs">
            XAU/USD
          </Badge>
          <StatusBadge status={status} source={source} />
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Twelve weighted engines · six timeframes · closed-candle liquidity
          hunts and trap intelligence
        </Text>
      </Box>

      <Group gap="xs">
        <Group gap={5} className="font-mono text-ink-muted">
          <Clock3Icon size={12} aria-hidden="true" />
          <Text size="xs" c="dimmed">
            {countdown}s
          </Text>
        </Group>
        <Button
          size="compact-xs"
          color="yellow"
          variant="light"
          leftSection={
          loading ?
          <Loader2Icon size={14} className="animate-spin" /> :

          <RefreshCwIcon size={14} />

          }
          onClick={onRefresh}
          disabled={loading || resetting}>
          
          Refresh
        </Button>
        <Button
          size="compact-xs"
          color="red"
          variant="subtle"
          leftSection={<RotateCcwIcon size={14} />}
          onClick={onReset}
          disabled={resetting}>
          
          Reset
        </Button>
      </Group>
    </Group>);

}
function StatusBadge({
  status,
  source



}: {status: GoldPanelStatus;source?: string;}) {
  const meta: Record<
    GoldPanelStatus,
    {
      color: string;
      label: string;
    }> =
  {
    initializing: {
      color: 'yellow',
      label: 'Initializing'
    },
    fetching: {
      color: 'yellow',
      label: 'Fetching'
    },
    live: {
      color: 'green',
      label: source ? `Live quote · ${source}` : 'Live OHLC'
    },
    error: {
      color: 'red',
      label: 'API error'
    },
    reset: {
      color: 'gray',
      label: 'Reset'
    }
  };
  return (
    <Badge
      size="xs"
      color={meta[status].color}
      variant="light"
      leftSection={
      status === 'fetching' ?
      <Loader size={8} color="yellow" /> :

      <span className="block h-1.5 w-1.5 rounded-full bg-current" />

      }>
      
      {meta[status].label}
    </Badge>);

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
          {resetting ? 'RESET' : 'FEED UNAVAILABLE'}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {resetting ?
          'State cleared. Real feeds restart automatically in 2 seconds.' :
          'The panel will retry automatically; no synthetic candles are shown.'}
        </Text>
      </Stack>
    </Card>);

}
function MasterSkeleton() {
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
      <span className="sr-only">Loading real Gold market analysis</span>
    </SimpleGrid>);

}