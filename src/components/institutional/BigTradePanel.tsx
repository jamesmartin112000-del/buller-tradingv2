import { Box, Group, Stack, Text } from '@mantine/core';
import { CircleDollarSignIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import type { BigTrade, WhaleAnalysis } from '../../lib/institutional/types';

interface BigTradePanelProps {
  analysis: WhaleAnalysis;
}

export function BigTradePanel({ analysis }: BigTradePanelProps) {
  const trades = analysis.bigTrades.slice(-5).reverse();
  const biasColor = analysis.whaleBias === 'bullish' ? '#00c853' : analysis.whaleBias === 'bearish' ? '#ff1744' : '#8888a0';
  return (
    <Box component="section" aria-label="Large trade detection" className="h-full rounded-md border border-line bg-bg-600 p-3">
      <Group justify="space-between" mb="sm">
        <Group gap={6}>
          <CircleDollarSignIcon size={14} className="text-gold" aria-hidden="true" />
          <Text component="h3" size="10px" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
            Institutional tape
          </Text>
        </Group>
        <Text size="9px" tt="uppercase" fw={800} c={biasColor}>
          {analysis.whaleBias} · {analysis.recentActivity}
        </Text>
      </Group>
      <Stack gap={5}>
        {trades.map((trade) => <TradeRow key={`${trade.timestamp}-${trade.price}`} trade={trade} />)}
        {!trades.length &&
        <div className="rounded-sm border border-line bg-bg-800 p-3">
            <Text size="xs" c="dimmed">No three-deviation volume anomaly in the active lookback.</Text>
          </div>
        }
      </Stack>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Accumulation zones" value={analysis.accumulationZones.length} tone="#00c853" />
        <Metric label="Distribution zones" value={analysis.distributionZones.length} tone="#ff1744" />
      </div>
    </Box>);

}

function TradeRow({ trade }: {trade: BigTrade;}) {
  const isBuy = trade.side === 'buy';
  const Icon = isBuy ? TrendingUpIcon : TrendingDownIcon;
  const tone = isBuy ? '#00c853' : '#ff1744';
  return (
    <Group justify="space-between" wrap="nowrap" className="rounded-sm border border-line bg-bg-800 px-2 py-1.5">
      <Group gap={7} wrap="nowrap" className="min-w-0">
        <Icon size={12} color={tone} aria-hidden="true" />
        <div className="min-w-0">
          <Text size="9px" fw={700} c={tone} tt="uppercase">{trade.type}</Text>
          <Text size="9px" c="dimmed" truncate>{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </div>
      </Group>
      <div className="text-right">
        <Text ff="monospace" size="10px" fw={800} c="white">{formatPrice(trade.price)}</Text>
        <Text ff="monospace" size="9px" c="dimmed">{formatSize(trade.volume)} · {trade.significance}/10</Text>
      </div>
    </Group>);

}

function Metric({ label, value, tone }: {label: string;value: number;tone: string;}) {
  return (
    <div className="rounded-sm border border-line bg-bg-800 p-2">
      <Text size="8px" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text ff="monospace" size="sm" fw={800} c={tone} mt={2}>{value}</Text>
    </div>);

}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatSize(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}