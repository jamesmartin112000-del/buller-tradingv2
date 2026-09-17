import { Badge, Card, Divider, Group, Stack, Text } from '@mantine/core';
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  DatabaseIcon,
  LinkIcon,
  UnlinkIcon } from
'lucide-react';
import type { SMTDivergence, TimeframeResult } from '../../../lib/types';

interface SmtTimeframeCardProps {
  result: TimeframeResult;
}

const TIMEFRAME_LABELS: Record<TimeframeResult['timeframe'], string> = {
  '15m': '15 minute',
  '1h': '1 hour',
  '4h': '4 hour',
  '1d': 'Daily',
  '1w': 'Weekly',
  '1mo': 'Monthly'
};

export function SmtTimeframeCard({ result }: SmtTimeframeCardProps) {
  const firstSignal = result.divergences[0]?.direction;
  const accent =
  firstSignal === 'BUY' ?
  'var(--buy)' :
  firstSignal === 'SELL' ?
  'var(--sell)' :
  'var(--border)';

  return (
    <Card
      component="article"
      padding="md"
      radius="md"
      withBorder
      style={{
        height: '100%',
        background: 'var(--card)',
        borderColor: accent
      }}>
      
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Text size="sm" fw={800}>
              {TIMEFRAME_LABELS[result.timeframe]}
            </Text>
            <Text size="xs" ff="monospace" c="dimmed">
              {result.timeframe.toUpperCase()} structure
            </Text>
          </div>
          <Badge
            size="sm"
            variant="light"
            color={result.dataStatus === 'ok' ? 'green' : 'orange'}>
            
            {result.dataStatus === 'ok' ?
            'Data ready' :
            result.stale ?
            'Stale' :
            'Partial'}
          </Badge>
        </Group>

        <Group gap="lg">
          <Group gap={5}>
            <DatabaseIcon size={13} color="var(--text2)" aria-hidden />
            <Text size="xs" c="dimmed">
              Gold <Text span ff="monospace" c="white">{result.goldCandles}</Text>
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            DXY <Text span ff="monospace" c="white">{result.dxyCandles}</Text>
          </Text>
        </Group>

        <Group gap={6}>
          {result.inverseConfirmed ?
          <LinkIcon size={14} color="var(--buy)" aria-hidden /> :

          <UnlinkIcon size={14} color="var(--warn)" aria-hidden />
          }
          <Text
            size="xs"
            fw={600}
            style={{
              color: result.inverseConfirmed ? 'var(--buy)' : 'var(--warn)'
            }}>
            
            {result.correlation === null ?
            'Correlation unavailable' :
            result.inverseConfirmed ?
            `Inverse confirmed · ${result.correlation.toFixed(2)}` :
            `Weak inverse · ${result.correlation.toFixed(2)}`}
          </Text>
        </Group>

        <Divider color="var(--border)" />

        {result.divergences.length ?
        <Stack gap={8}>
            {result.divergences.map((divergence) =>
          <DivergenceRead
            key={`${result.timeframe}-${divergence.type}`}
            divergence={divergence} />

          )}
          </Stack> :

        <Text size="xs" c="dimmed">
            {result.dataStatus === 'ok' ?
          'No active swing divergence.' :
          'Awaiting both Gold and DXY feeds.'}
          </Text>
        }

        {(result.goldSource || result.dxySource) &&
        <Stack gap={2}>
            <Text size="xs" c="dimmed" lineClamp={2} title={`${result.goldSource ?? ''} · ${result.dxySource ?? ''}`}>
              {result.goldSource ?? 'Gold unavailable'} · {result.dxySource ?? 'DXY unavailable'}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              Latest candle:{' '}
              {result.latestMarketTimestamp ?
            new Date(result.latestMarketTimestamp).toLocaleString() :
            'unavailable'}
            </Text>
          </Stack>
        }
      </Stack>
    </Card>);

}

function DivergenceRead({ divergence }: {divergence: SMTDivergence;}) {
  const isBuy = divergence.direction === 'BUY';
  const Icon = isBuy ? ArrowUpRightIcon : ArrowDownRightIcon;
  const firstGold = isBuy ? divergence.gold_low_1 : divergence.gold_high_1;
  const secondGold = isBuy ? divergence.gold_low_2 : divergence.gold_high_2;
  const firstDxy = isBuy ? divergence.dxy_low_1 : divergence.dxy_high_1;
  const secondDxy = isBuy ? divergence.dxy_low_2 : divergence.dxy_high_2;

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        border: `1px solid ${isBuy ? 'rgba(0,200,83,.3)' : 'rgba(255,23,68,.3)'}`,
        background: isBuy ? 'var(--buy-dim)' : 'var(--sell-dim)'
      }}>
      
      <Group gap={6} mb={4}>
        <Icon
          size={15}
          color={isBuy ? 'var(--buy)' : 'var(--sell)'}
          aria-hidden />
        
        <Text
          size="xs"
          fw={800}
          tt="uppercase"
          style={{ color: isBuy ? 'var(--buy)' : 'var(--sell)' }}>
          
          {isBuy ? 'Bullish SMT' : 'Bearish SMT'}
        </Text>
      </Group>
      <Group gap={4} wrap="wrap">
        <Text size="xs" c="dimmed">Gold</Text>
        <Text size="xs" c="dimmed" className="numeric-value font-mono">
          {formatPrice(firstGold)} → {formatPrice(secondGold)}
        </Text>
        <Text size="xs" c="dimmed">· DXY</Text>
        <Text size="xs" c="dimmed" className="numeric-value font-mono">
          {formatPrice(firstDxy)} → {formatPrice(secondDxy)}
        </Text>
      </Group>
    </div>);

}

function formatPrice(value?: number): string {
  if (value === undefined) return '—';
  return value >= 1000 ? value.toFixed(2) : value.toFixed(3);
}