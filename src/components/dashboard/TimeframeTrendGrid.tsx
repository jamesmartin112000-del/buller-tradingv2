import React from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon } from
'@mantine/core';
import {
  AlertTriangleIcon,
  BarChart3Icon,
  Clock3Icon,
  MinusIcon,
  RefreshCwIcon,
  TrendingDownIcon,
  TrendingUpIcon } from
'lucide-react';
import type { GoldMarketAnalysisState } from '../../hooks/useGoldMarketAnalysis';
import type {
  GoldBiasDirection,
  GoldBiasTimeframe,
  GoldTimeframeBias,
  TrendDirection } from
'../../lib/engine/goldMarketBias';
import type { MarketCandleSource } from '../../lib/trading/marketCandles';
type TrendTone = TrendDirection | 'unavailable';
interface TimeframeDefinition {
  label: string;
  key: GoldBiasTimeframe;
}
interface TimeframeTrendGridProps {
  market: GoldMarketAnalysisState;
}
const TIMEFRAMES: TimeframeDefinition[] = [
{
  label: 'MN1',
  key: '1mo'
},
{
  label: 'W1',
  key: '1w'
},
{
  label: 'D1',
  key: '1d'
},
{
  label: 'H4',
  key: '4h'
},
{
  label: 'H1',
  key: '1h'
},
{
  label: 'M15',
  key: '15m'
},
{
  label: 'M1',
  key: '1m'
}];

export function TimeframeTrendGrid({ market }: TimeframeTrendGridProps) {
  const analysis = market.analysis;
  const direction = analysis?.direction ?? 'NEUTRAL';
  const lowerConflict = Boolean(
    analysis &&
    direction !== 'NEUTRAL' &&
    (['15m', '1m'] as const).some((timeframe) => {
      const entry = analysis.timeframes[timeframe];
      return (
        entry.available &&
        entry.direction !== 'neutral' &&
        entry.direction !== (direction === 'BUY' ? 'bullish' : 'bearish'));

    })
  );
  const statusColor =
  market.status === 'live' ?
  'green' :
  market.status === 'error' ?
  'red' :
  'yellow';
  return (
    <Card
      component="section"
      aria-labelledby="timeframe-trend-heading"
      radius="md"
      padding="md"
      className="border border-brand/25 bg-bg-700">
      
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="xs">
            <ThemeIcon variant="light" color="yellow" size="sm">
              <BarChart3Icon size={15} aria-hidden="true" />
            </ThemeIcon>
            <Box>
              <Text
                component="h2"
                id="timeframe-trend-heading"
                size="sm"
                fw={900}
                c="#ffd700"
                tt="uppercase"
                lts={1.2}>
                
                Timeframe Trend Grid
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Shared Gold bias · real OHLC only · structure, EMA, RSI, sweeps
                and DXY
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Badge size="sm" variant="light" color={statusColor}>
              {market.loading ? 'Fetching real OHLC' : market.status}
            </Badge>
            <Badge size="sm" variant="light" color={directionColor(direction)} className="numeric-value">
              Shared bias · {direction}
              {analysis ? ` ${analysis.confidence}%` : ''}
            </Badge>
            <Button
              size="compact-xs"
              color="yellow"
              variant="subtle"
              leftSection={<RefreshCwIcon size={13} />}
              onClick={() => void market.refresh()}
              loading={market.loading}>
              
              Refresh
            </Button>
          </Group>
        </Group>

        {market.error &&
        <Alert
          color="red"
          variant="light"
          icon={<AlertTriangleIcon size={15} />}
          role="alert">
          
            <Text size="xs">{market.error}</Text>
          </Alert>
        }
        {market.warnings.length > 0 &&
        <Alert
          color="yellow"
          variant="light"
          icon={<AlertTriangleIcon size={15} />}
          role="status">
          
            <Text size="xs">{market.warnings.join('. ')}</Text>
          </Alert>
        }

        <Box className="min-w-0 pb-1 sm:overflow-x-auto">
          <SimpleGrid
            cols={{ base: 2, sm: 7 }}
            spacing="xs"
            className="sm:min-w-[980px]"
            aria-label="Gold real-market timeframe direction and structure">
            
            {TIMEFRAMES.map((timeframe) =>
            <TimeframeCell
              key={timeframe.key}
              label={timeframe.label}
              entry={analysis?.timeframes[timeframe.key]}
              loading={market.loading && !analysis} />

            )}
          </SimpleGrid>
        </Box>

        <Group gap="xs" align="stretch" grow wrap="wrap">
          <Box className="min-w-[250px] rounded-md border border-white/10 bg-white/[0.025] px-3 py-2">
            <Text size="xs" fw={800} c={directionTextColor(direction)}>
              SHARED BIAS: {direction}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {analysis?.reasons[0] ??
              'Waiting for sufficient real Gold candles; no direction is inferred.'}
            </Text>
          </Box>
          <Alert
            color={lowerConflict ? 'yellow' : 'gray'}
            variant="light"
            icon={<AlertTriangleIcon size={15} />}
            className="min-w-[250px] flex-1">
            
            <Text size="xs" fw={700}>
              {lowerConflict ?
              'M15/M1 conflicts with the shared higher-timeframe direction — execution remains a wait.' :
              analysis ?
              `${analysis.dxyChecks.filter((check) => check.status === 'CONFIRMED').length} Gold/DXY inverse checks confirmed; unavailable checks carry zero score.` :
              'DXY checks stay unavailable until matching real candles arrive.'}
            </Text>
          </Alert>
        </Group>

        <Group
          justify="space-between"
          gap="xs"
          wrap="wrap"
          className="border-t border-white/5 pt-2">
          
          <Text size="xs" c="dimmed">
            Sources: {sourceSummary(analysis?.sources)}
          </Text>
          <Group gap={5}>
            <Clock3Icon
              size={12}
              className="text-gray-500"
              aria-hidden="true" />
            
            <Text size="xs" c="dimmed">
              Market candle {formatTimestamp(analysis?.marketTimestamp)} ·
              refreshed {formatTimestamp(market.lastUpdated)}
            </Text>
          </Group>
        </Group>
      </Stack>
    </Card>);

}
function TimeframeCell({
  label,
  entry,
  loading




}: {label: string;entry: GoldTimeframeBias | undefined;loading: boolean;}) {
  const tone: TrendTone = entry?.available ? entry.direction : 'unavailable';
  const DirectionIcon =
  tone === 'bullish' ?
  TrendingUpIcon :
  tone === 'bearish' ?
  TrendingDownIcon :
  MinusIcon;
  const stateLabel = loading ?
  'FETCHING' :
  tone === 'bullish' ?
  'BUY' :
  tone === 'bearish' ?
  'SELL' :
  entry?.available ?
  'NEUTRAL' :
  'UNAVAILABLE';
  return (
    <Box
      className={`min-h-[146px] rounded-md border p-3 ${tonePanelClass(tone)}`}
      aria-label={`${label}: ${stateLabel}`}>
      
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={900} className="font-mono" c="#f5f5f5">
          {label}
        </Text>
        <DirectionIcon
          size={15}
          className={toneIconClass(tone)}
          aria-hidden="true" />
        
      </Group>
      <Text size="sm" fw={900} mt={8} c={toneTextColor(tone)}>
        {stateLabel}
      </Text>
      <Text size="xs" c="dimmed" mt={5}>
        Structure: {entry?.structure ?? 'Not available'}
      </Text>
      <Group gap={3} wrap="nowrap" mt={2}>
        <Text size="xs" c="dimmed">Score:</Text>
        <Text size="xs" c="dimmed" className="numeric-value font-mono">
          {entry?.available ?
          `${entry.score > 0 ? '+' : ''}${entry.score}/7` :
          '—'}
        </Text>
      </Group>
      <Group gap={3} wrap="nowrap" mt={2}>
        <Text size="xs" c="dimmed">RSI:</Text>
        <Text size="xs" c="dimmed" className="numeric-value font-mono">
          {entry?.rsi ?? '—'}
        </Text>
      </Group>
      <Text
        size="xs"
        c="dimmed"
        mt={2}
        lineClamp={1}
        title={entry?.source?.label}>
        
        {entry?.source?.label ?? (loading ? 'Connecting…' : 'No source')}
      </Text>
    </Box>);

}
function sourceSummary(sources: MarketCandleSource[] | undefined): string {
  if (!sources?.length) return 'waiting for real feeds';
  return sources.map((source) => source.label).join(' · ');
}
function formatTimestamp(value: number | null | undefined): string {
  return value && Number.isFinite(value) ?
  new Date(value).toLocaleString() :
  'unavailable';
}
function directionColor(direction: GoldBiasDirection): string {
  if (direction === 'BUY') return 'green';
  if (direction === 'SELL') return 'red';
  return 'yellow';
}
function directionTextColor(direction: GoldBiasDirection): string {
  if (direction === 'BUY') return '#00ff88';
  if (direction === 'SELL') return '#ff4444';
  return '#ffd43b';
}
function toneTextColor(tone: TrendTone): string {
  if (tone === 'bullish') return '#00ff88';
  if (tone === 'bearish') return '#ff4444';
  if (tone === 'neutral') return '#ffd43b';
  return '#888';
}
function tonePanelClass(tone: TrendTone): string {
  if (tone === 'bullish') return 'border-[#00ff88]/25 bg-[#00ff88]/5';
  if (tone === 'bearish') return 'border-[#ff4444]/25 bg-[#ff4444]/5';
  if (tone === 'neutral') return 'border-yellow-400/20 bg-yellow-400/5';
  return 'border-white/10 bg-white/[0.02]';
}
function toneIconClass(tone: TrendTone): string {
  if (tone === 'bullish') return 'text-[#00ff88]';
  if (tone === 'bearish') return 'text-[#ff4444]';
  if (tone === 'neutral') return 'text-yellow-400';
  return 'text-gray-500';
}