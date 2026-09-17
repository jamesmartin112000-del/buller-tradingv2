import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { CheckIcon, CrosshairIcon, ShieldIcon, TargetIcon } from 'lucide-react';
import type { SniperEntry, TradeSignal } from '../../lib/institutional/types';

interface TradePlanProps {
  signal: TradeSignal;
  sniper: SniperEntry | null;
}

export function TradePlan({ signal, sniper }: TradePlanProps) {
  const actionable = signal.direction !== 'HOLD';
  const targets = [
  { label: 'Entry', value: signal.entryPrice, tone: '#e8e8f0', icon: CrosshairIcon },
  { label: 'Target 1', value: signal.takeProfit1, tone: '#00c853', icon: TargetIcon },
  { label: 'Target 2', value: signal.takeProfit2, tone: '#00c853', icon: TargetIcon },
  { label: 'Target 3', value: signal.takeProfit3, tone: '#00c853', icon: TargetIcon },
  { label: 'Stop', value: signal.stopLoss, tone: '#ff1744', icon: ShieldIcon }];

  return (
    <Box component="section" aria-label="Execution plan" className="rounded-md border border-line bg-bg-600 p-3">
      <Group justify="space-between" mb="sm" gap="sm" wrap="wrap">
        <div>
          <Text size="10px" c="dimmed" tt="uppercase" fw={700} lts="0.12em">
            Execution map
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            ATR-adjusted levels · target 2 anchors displayed R:R
          </Text>
        </div>
        <Group gap={5}>
          <CheckIcon size={13} color={sniper ? '#00c853' : '#8888a0'} aria-hidden="true" />
          <Text size="xs" fw={700} c={sniper ? '#00c853' : 'dimmed'}>
            {sniper ? 'Sniper checklist ready' : 'Confirmation pending'}
          </Text>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing={8}>
        {targets.map(({ label, value, tone, icon: Icon }) =>
        <Stack
          key={label}
          gap={4}
          className="min-w-0 rounded-md border border-line bg-bg-800 p-2.5">
          
            <Group gap={5} wrap="nowrap">
              <Icon size={12} color={tone} aria-hidden="true" />
              <Text size="9px" c="dimmed" tt="uppercase" fw={700} lts="0.08em">
                {label}
              </Text>
            </Group>
            <Text ff="monospace" fw={800} size="sm" c={actionable ? tone : 'dimmed'} className="numeric-value">
              {formatPrice(value)}
            </Text>
          </Stack>
        )}
      </SimpleGrid>
    </Box>);

}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}