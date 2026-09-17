import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { BookOpenIcon, LayersIcon, ShieldAlertIcon } from 'lucide-react';
import type { DomAnalysis, Level2Entry } from '../../lib/institutional/types';

interface DomPanelProps {
  analysis: DomAnalysis;
}

export function DomPanel({ analysis }: DomPanelProps) {
  const { snapshot } = analysis;
  const maxSize = Math.max(1, ...snapshot.bids.map((level) => level.size), ...snapshot.asks.map((level) => level.size));
  return (
    <Box component="section" aria-label="Depth of market" className="h-full rounded-md border border-line bg-bg-600 p-3">
      <Group justify="space-between" mb="sm">
        <Group gap={6}>
          <BookOpenIcon size={14} className="text-blue-trade" aria-hidden="true" />
          <Text component="h3" size="10px" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
            Depth of market
          </Text>
        </Group>
        <Text ff="monospace" size="xs" fw={700} c={snapshot.imbalance >= 0 ? '#00c853' : '#ff1744'}>
          {(snapshot.imbalance * 100).toFixed(1)}%
        </Text>
      </Group>
      <SimpleGrid cols={2} spacing={8}>
        <Stack gap={3}>
          <BookHeader label="Bid" />
          {snapshot.bids.slice(0, 7).map((level) =>
          <BookLevel key={`bid-${level.price}`} level={level} max={maxSize} />
          )}
        </Stack>
        <Stack gap={3}>
          <BookHeader label="Ask" />
          {snapshot.asks.slice(0, 7).map((level) =>
          <BookLevel key={`ask-${level.price}`} level={level} max={maxSize} />
          )}
        </Stack>
      </SimpleGrid>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Status icon={LayersIcon} label="Stacked book" active={analysis.stackedBook} />
        <Status icon={ShieldAlertIcon} label="Spoofing watch" active={analysis.spoofingAlert} warning />
      </div>
      <Text size="10px" mt="sm" c="dimmed">
        Modeled L2 from verified OHLC volume. Confirm entries against a broker order book.
      </Text>
    </Box>);

}

function BookHeader({ label }: {label: string;}) {
  return (
    <Group justify="space-between" px={4}>
      <Text size="9px" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="9px" tt="uppercase" c="dimmed">Price / Size</Text>
    </Group>);

}

function BookLevel({ level, max }: {level: Level2Entry;max: number;}) {
  const isBid = level.type === 'bid';
  const color = isBid ? '#00c853' : '#ff1744';
  return (
    <Box className="relative overflow-hidden rounded-sm border border-line bg-bg-800 px-2 py-1.5">
      <Box
        className="absolute inset-y-0 right-0 opacity-15"
        style={{ width: `${level.size / max * 100}%`, background: color }} />
      
      <Group justify="space-between" gap={4} wrap="nowrap" className="relative z-10">
        <Text ff="monospace" size="10px" fw={700} c={color}>{formatPrice(level.price)}</Text>
        <Text ff="monospace" size="10px" c="white">{formatSize(level.size)}</Text>
      </Group>
    </Box>);

}

function Status({
  icon: Icon,
  label,
  active,
  warning





}: {icon: typeof LayersIcon;label: string;active: boolean;warning?: boolean;}) {
  const color = active ? warning ? '#ffab00' : '#00c853' : '#555570';
  return (
    <Group gap={5} className="rounded-sm border border-line bg-bg-800 p-2" wrap="nowrap">
      <Icon size={12} color={color} aria-hidden="true" />
      <Text size="9px" c={active ? color : 'dimmed'} fw={700} truncate>{label}</Text>
    </Group>);

}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSize(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}