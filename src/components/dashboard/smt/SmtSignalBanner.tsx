import {
  Badge,
  Box,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon } from
'@mantine/core';
import {
  ActivityIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  MinusIcon } from
'lucide-react';
import type { FinalSignal, ScanResult } from '../../../lib/types';

interface SmtSignalBannerProps {
  summary: ScanResult['summary'];
}

const SIGNAL_CONFIG: Record<
  FinalSignal,
  {color: string;label: string;description: string;}> =
{
  STRONG_BUY: {
    color: 'var(--buy)',
    label: 'Strong buy confluence',
    description: 'Multiple weighted timeframes show bullish SMT alignment.'
  },
  BUY: {
    color: 'var(--buy)',
    label: 'Buy confluence',
    description: 'Bullish SMT has meaningful multi-timeframe support.'
  },
  WEAK_BUY: {
    color: 'var(--buy)',
    label: 'Early bullish read',
    description: 'Limited bullish SMT evidence is present; wait for confirmation.'
  },
  NEUTRAL: {
    color: 'var(--text2)',
    label: 'No active confluence',
    description: 'The weighted SMT vote is balanced or no divergence is active.'
  },
  WEAK_SELL: {
    color: 'var(--sell)',
    label: 'Early bearish read',
    description: 'Limited bearish SMT evidence is present; wait for confirmation.'
  },
  SELL: {
    color: 'var(--sell)',
    label: 'Sell confluence',
    description: 'Bearish SMT has meaningful multi-timeframe support.'
  },
  STRONG_SELL: {
    color: 'var(--sell)',
    label: 'Strong sell confluence',
    description: 'Multiple weighted timeframes show bearish SMT alignment.'
  }
};

export function SmtSignalBanner({ summary }: SmtSignalBannerProps) {
  const config = SIGNAL_CONFIG[summary.finalSignal];
  const isBuy = summary.finalSignal.includes('BUY');
  const isSell = summary.finalSignal.includes('SELL');
  const SignalIcon = isBuy ?
  ArrowUpRightIcon :
  isSell ?
  ArrowDownRightIcon :
  MinusIcon;
  const strength = Math.min(100, Math.abs(summary.confluenceScore) / 21 * 100);

  return (
    <Card
      component="section"
      aria-labelledby="smt-final-signal"
      padding="lg"
      radius="md"
      withBorder
      style={{
        background: 'var(--card)',
        borderColor: config.color,
        borderWidth: 1
      }}>
      
      <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
        <Group gap="md" align="flex-start">
          <ThemeIcon
            size={48}
            radius="md"
            variant="light"
            color={isBuy ? 'green' : isSell ? 'red' : 'gray'}>
            
            <SignalIcon size={25} aria-hidden />
          </ThemeIcon>
          <Stack gap={4}>
            <Group gap="xs" wrap="wrap">
              <Text
                id="smt-final-signal"
                size="xl"
                fw={800}
                style={{ color: config.color }}>
                
                {config.label}
              </Text>
              <Badge variant="outline" color={isBuy ? 'green' : isSell ? 'red' : 'gray'}>
                {summary.finalSignal.replace('_', ' ')}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {config.description}
            </Text>
          </Stack>
        </Group>

        <Box miw={240} maw={360} style={{ flex: '1 1 280px' }}>
          <Group justify="space-between" mb={6}>
            <Group gap={6}>
              <ActivityIcon size={14} aria-hidden />
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Weighted score
              </Text>
            </Group>
            <Text size="lg" fw={800} ff="monospace" style={{ color: config.color }}>
              {summary.confluenceScore > 0 ? '+' : ''}
              {summary.confluenceScore}
            </Text>
          </Group>
          <Progress
            value={strength}
            color={isBuy ? 'green' : isSell ? 'red' : 'gray'}
            size="sm"
            radius="xl"
            aria-label={`Signal strength ${Math.round(strength)} percent`} />
          
          <Group justify="space-between" mt={8} gap="xs">
            <Text size="xs" c="dimmed">
              Buy: {summary.buyTimeframes.join(', ') || 'none'}
            </Text>
            <Text size="xs" c="dimmed">
              Sell: {summary.sellTimeframes.join(', ') || 'none'}
            </Text>
          </Group>
        </Box>
      </Group>
    </Card>);

}