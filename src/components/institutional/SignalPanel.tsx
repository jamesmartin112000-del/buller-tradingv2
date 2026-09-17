import { Box, Group, Progress, Stack, Text } from '@mantine/core';
import { ActivityIcon, ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';
import type {
  TradeFormulaResult,
  TradeSignal } from
'../../lib/institutional/types';

interface SignalPanelProps {
  signal: TradeSignal;
  formula: TradeFormulaResult | null;
}

export function SignalPanel({ signal, formula }: SignalPanelProps) {
  const isBuy = signal.direction === 'BUY';
  const isSell = signal.direction === 'SELL';
  const tone = isBuy ? '#00c853' : isSell ? '#ff1744' : '#ffab00';
  const Icon = isBuy ? ArrowUpIcon : isSell ? ArrowDownIcon : MinusIcon;
  return (
    <Box
      component="section"
      aria-label="Primary institutional signal"
      className="rounded-md border bg-bg-700 p-3 sm:p-4"
      style={{ borderColor: `${tone}66`, boxShadow: `inset 3px 0 0 ${tone}` }}>
      
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap={5}>
          <Group gap={8}>
            <Box className="rounded-md p-1.5" style={{ background: `${tone}18` }}>
              <Icon size={20} color={tone} aria-hidden="true" />
            </Box>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts="0.12em">
                Institutional verdict
              </Text>
              <Text
                component="h2"
                ff="monospace"
                fw={900}
                c={tone}
                className="text-2xl sm:text-3xl leading-none">
                
                {signal.direction}
              </Text>
            </div>
          </Group>
          <Text size="xs" c="dimmed">
            {signal.asset} · {signal.analysis.session.toUpperCase()} session · strength {signal.strength}/3
          </Text>
        </Stack>
        <Stack gap={2} align="flex-end">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts="0.1em">
            Reference entry
          </Text>
          <Text ff="monospace" fw={800} className="numeric-value text-2xl" c="white">
            {formatPrice(signal.entryPrice)}
          </Text>
          <Text size="xs" ff="monospace" c="dimmed" className="numeric-value">
            R:R {signal.riskRewardRatio.toFixed(1)}
          </Text>
        </Stack>
      </Group>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Score label="Absorption" value={formula?.absorptionScore ?? 0} color="#2979ff" />
        <Score label="Aggression" value={formula?.aggressionScore ?? 0} color="#ffab00" />
        <Score label="Delta flip" value={formula?.deltaFlipScore ?? 0} color={tone} />
      </div>
      <Group justify="space-between" mt="md" gap="xs" wrap="wrap">
        <Group gap={6} wrap="nowrap" className="min-w-0">
          <ActivityIcon size={14} color={tone} className="shrink-0" aria-hidden="true" />
          <Text size="xs" fw={700} c={tone} tt="uppercase">
            {formula?.signal.replaceAll('_', ' ') ?? 'Awaiting formula'}
          </Text>
        </Group>
        <Text ff="monospace" size="sm" fw={800} c="white" className="numeric-value">
          {signal.confidence}% confidence
        </Text>
      </Group>
    </Box>);

}

function Score({ label, value, color }: {label: string;value: number;color: string;}) {
  return (
    <div>
      <Group justify="space-between" mb={5}>
        <Text size="10px" c="dimmed" tt="uppercase" fw={700} lts="0.08em">
          {label}
        </Text>
        <Text size="xs" ff="monospace" fw={800} c="white" className="numeric-value">
          {value}/100
        </Text>
      </Group>
      <Progress value={value} color={color} size={5} radius="xs" />
    </div>);

}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}