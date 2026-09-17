import {
  Box,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text } from
'@mantine/core';
import {
  MinusIcon,
  ShieldAlertIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WavesIcon } from
'lucide-react';
import { formatPrice } from '../../../lib/engine/goldInstitutionalSniper';
import type {
  GoldSniperAnalysis,
  SniperDirection } from
'../../../lib/engine/goldInstitutionalSniper';
import { GoldLiquidityMatrix } from './GoldLiquidityMatrix';

interface GoldMasterOverviewProps {
  analysis: GoldSniperAnalysis;
  currentPrice: number;
}
export function GoldMasterOverview({
  analysis,
  currentPrice
}: GoldMasterOverviewProps) {
  return (
    <Stack gap="sm">
      <BiasCard analysis={analysis} />
      <LiquidityCard analysis={analysis} currentPrice={currentPrice} />
      <TrapGrid analysis={analysis} />
    </Stack>);

}
function BiasCard({ analysis }: {analysis: GoldSniperAnalysis;}) {
  const tone = directionTone(analysis.direction);
  return (
    <Card radius="md" padding="md" className={`border ${tone.panel}`}>
      <Group justify="space-between" align="flex-start" gap="xs" wrap="wrap">
        <Box className="min-w-0">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={1.2}>
            Institutional Daily Bias
          </Text>
          <Group gap="xs" mt={4}>
            <DirectionIcon direction={analysis.direction} />
            <Text fw={900} size="xl" className={tone.text}>
              {analysis.direction}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {analysis.verdict}
          </Text>
        </Box>
        <Box ta="right">
          <Text fw={900} size="xl" className={`numeric-value font-mono ${tone.text}`}>
            {analysis.confidence}%
          </Text>
          <Text size="xs" c="dimmed">confidence</Text>
        </Box>
      </Group>
      <Progress
        value={analysis.confidence}
        color={tone.color}
        size="sm"
        radius="xl"
        mt="sm"
        aria-label={`Bias confidence ${analysis.confidence}%`} />
      
      <SimpleGrid cols={3} spacing="xs" mt="sm">
        <Metric label="Buy score" value={analysis.buyScore} tone="buy" />
        <Metric label="Sell score" value={analysis.sellScore} tone="sell" />
        <Metric
          label="Net score"
          value={`${analysis.netScore > 0 ? '+' : ''}${analysis.netScore}`} />
        
      </SimpleGrid>
      <Text size="xs" c="dimmed" mt="xs">
        Strong: net beyond ±18 · Directional: net beyond ±10 · Otherwise neutral
      </Text>
    </Card>);

}
function LiquidityCard({ analysis, currentPrice }: GoldMasterOverviewProps) {
  const { liquidity } = analysis;
  const quoteOffset = currentPrice - analysis.currentPrice;
  const adjustedAbove = liquidity.above.map((level) => level + quoteOffset);
  const adjustedBelow = liquidity.below.map((level) => level + quoteOffset);
  const adjustedTarget =
  liquidity.target === null ? null : liquidity.target + quoteOffset;
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <WavesIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Liquidity Map · Hunt Levels
        </Text>
      </Group>
      <SimpleGrid cols={2} spacing="sm" mt="sm">
        <LiquidityColumn
          label="Liquidity Above"
          levels={adjustedAbove}
          current={currentPrice}
          tone="sell" />
        
        <LiquidityColumn
          label="Liquidity Below"
          levels={adjustedBelow}
          current={currentPrice}
          tone="buy" />
        
      </SimpleGrid>
      <Group
        justify="space-between"
        gap="xs"
        wrap="wrap"
        mt="sm"
        className="min-w-0 rounded border border-yellow-400/15 bg-yellow-400/5 px-3 py-2">
        
        <Text size="xs" c="dimmed">
          Primary-TF nearest liquidity target
        </Text>
        <Text size="xs" fw={800} c="#ffd700" className="numeric-value font-mono">
          {adjustedTarget ?
          `${formatPrice(adjustedTarget)} · ${liquidity.targetSide}` :
          'Scanning'}
        </Text>
      </Group>
      <GoldLiquidityMatrix analysis={analysis} currentPrice={currentPrice} />
    </Card>);

}
function LiquidityColumn({
  label,
  levels,
  current,
  tone





}: {label: string;levels: number[];current: number;tone: 'buy' | 'sell';}) {
  return (
    <Box>
      <Text
        size="xs"
        fw={800}
        className={tone === 'buy' ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
        
        {label}
      </Text>
      <Stack gap={4} mt={6}>
        {levels.length ?
        levels.map((level) =>
        <Group
          key={level}
          justify="space-between"
          gap={4}
          wrap="wrap"
          className="min-w-0 rounded border border-white/5 bg-white/[0.025] px-2 py-1.5">
          
              <Text size="xs" fw={700} className="numeric-value font-mono">
                ${formatPrice(level)}
              </Text>
              <Text size="xs" c="dimmed" className="numeric-value font-mono">
                {Math.abs(level - current).toFixed(2)} pts
              </Text>
            </Group>
        ) :

        <Text size="xs" c="dimmed">
            No verified levels
          </Text>
        }
      </Stack>
    </Box>);

}
function TrapGrid({ analysis }: {analysis: GoldSniperAnalysis;}) {
  const actionable = analysis.traps.find((trap) => trap.action);
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <ShieldAlertIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Trap Detector · Six Timeframes
        </Text>
      </Group>
      <SimpleGrid
        cols={{
          base: 3,
          sm: 6
        }}
        spacing="xs"
        mt="sm">
        
        {analysis.traps.map((trap) => {
          const color =
          trap.kind === 'BEAR TRAP' ?
          '#00ff88' :
          trap.kind === 'BULL TRAP' ?
          '#ff4444' :
          '#888';
          return (
            <Box
              key={trap.timeframe}
              ta="center"
              className="rounded border border-white/5 bg-white/[0.025] px-1 py-2">
              
              <Text size="xs" fw={800} className="font-mono">
                {trap.timeframe.toUpperCase()}
              </Text>
              <Text size="xs" fw={700} c={color} mt={2}>
                {trap.kind}
              </Text>
            </Box>);

        })}
      </SimpleGrid>
      <Text
        size="xs"
        c={
        actionable?.action === 'BUY' ?
        '#00ff88' :
        actionable?.action === 'SELL' ?
        '#ff4444' :
        'dimmed'
        }
        ta="center"
        mt="sm"
        fw={700}>
        
        {actionable ?
        `Actionable: ${actionable.timeframe.toUpperCase()} ${actionable.kind} → ${actionable.action}` :
        'No actionable trap · all available timeframes clear'}
      </Text>
    </Card>);

}
function Metric({
  label,
  value,
  tone




}: {label: string;value: string | number;tone?: 'buy' | 'sell';}) {
  return (
    <Box className="rounded border border-white/10 bg-black/20 px-2.5 py-2">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text
        size="sm"
        fw={900}
        c={tone === 'buy' ? '#00ff88' : tone === 'sell' ? '#ff4444' : '#eee'}
        className="numeric-value font-mono">
        
        {value}
      </Text>
    </Box>);

}
function DirectionIcon({ direction }: {direction: SniperDirection;}) {
  if (direction.includes('BUY')) {
    return <TrendingUpIcon size={22} className="text-[#00ff88]" />;
  }
  if (direction.includes('SELL')) {
    return <TrendingDownIcon size={22} className="text-[#ff4444]" />;
  }
  return <MinusIcon size={22} className="text-[#888]" />;
}
function directionTone(direction: SniperDirection) {
  if (direction.includes('BUY')) {
    return {
      panel: 'border-[#00ff88]/30 bg-[#00ff88]/5',
      text: 'text-[#00ff88]',
      color: 'green'
    };
  }
  if (direction.includes('SELL')) {
    return {
      panel: 'border-[#ff4444]/30 bg-[#ff4444]/5',
      text: 'text-[#ff4444]',
      color: 'red'
    };
  }
  return {
    panel: 'border-white/10 bg-white/[0.02]',
    text: 'text-[#888]',
    color: 'gray'
  };
}