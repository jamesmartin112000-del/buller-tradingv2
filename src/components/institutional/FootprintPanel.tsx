import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Columns3Icon } from 'lucide-react';
import type { DeltaAnalysis, FootprintCandle } from '../../lib/institutional/types';

interface FootprintPanelProps {
  footprints: FootprintCandle[];
  delta: DeltaAnalysis;
}

export function FootprintPanel({ footprints, delta }: FootprintPanelProps) {
  const latest = footprints.at(-1);
  const levels = latest?.priceLevels.slice().reverse().slice(0, 8) ?? [];
  const maxVolume = Math.max(1, ...levels.map((level) => level.totalVolume));
  return (
    <Box component="section" aria-label="Delta footprint" className="h-full rounded-md border border-line bg-bg-600 p-3">
      <Group justify="space-between" mb="sm" gap="sm">
        <Group gap={6}>
          <Columns3Icon size={14} className="text-purple-trade" aria-hidden="true" />
          <Text component="h3" size="10px" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
            Delta footprint
          </Text>
        </Group>
        <Text ff="monospace" size="xs" fw={800} c={delta.currentDelta >= 0 ? '#00c853' : '#ff1744'} className="numeric-value">
          {signed(delta.currentDelta)}
        </Text>
      </Group>
      <Group justify="space-between" px={5} mb={4}>
        <Text size="9px" c="dimmed" tt="uppercase">Bid</Text>
        <Text size="9px" c="dimmed" tt="uppercase">Price</Text>
        <Text size="9px" c="dimmed" tt="uppercase">Ask</Text>
      </Group>
      <Stack gap={3}>
        {levels.map((level) => {
          const buyWidth = level.askVolume / maxVolume * 100;
          const sellWidth = level.bidVolume / maxVolume * 100;
          return (
            <SimpleGrid key={level.price} cols={3} spacing={3}>
              <Box className="relative overflow-hidden rounded-sm border border-sell/20 bg-bg-800 px-1.5 py-1 text-right">
                <Box className="absolute inset-y-0 right-0 bg-sell/15" style={{ width: `${sellWidth}%` }} />
                <Text className="numeric-value relative" ff="monospace" size="10px" c="#ff8098">{formatSize(level.bidVolume)}</Text>
              </Box>
              <Text ta="center" ff="monospace" size="10px" fw={700} c="white" py={4} className="numeric-value">
                {formatPrice(level.price)}
              </Text>
              <Box className="relative overflow-hidden rounded-sm border border-buy/20 bg-bg-800 px-1.5 py-1">
                <Box className="absolute inset-y-0 left-0 bg-buy/15" style={{ width: `${buyWidth}%` }} />
                <Text className="numeric-value relative" ff="monospace" size="10px" c="#6ee7a0">{formatSize(level.askVolume)}</Text>
              </Box>
            </SimpleGrid>);

        })}
      </Stack>
      {!levels.length && <Text size="xs" c="dimmed">Footprint requires a valid candle range.</Text>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Cumulative" value={signed(delta.cumulativeDelta)} />
        <Metric label="Flip" value={delta.deltaFlip ? delta.flipDirection ?? 'yes' : 'none'} />
        <Metric label="Divergence" value={delta.divergenceType ?? 'none'} />
      </div>
    </Box>);

}

function Metric({ label, value }: {label: string;value: string;}) {
  return (
    <div className="min-w-0 rounded-sm border border-line bg-bg-800 p-2">
      <Text size="8px" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text ff="monospace" size="10px" fw={700} c="white" mt={2} className="numeric-value">{value}</Text>
    </div>);

}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}
function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatSize(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}