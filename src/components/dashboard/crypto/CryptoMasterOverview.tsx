import React from 'react';
import {
  Badge,
  Box,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text } from
'@mantine/core';
import {
  ActivityIcon,
  BrainCircuitIcon,
  MinusIcon,
  ShieldAlertIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WavesIcon } from
'lucide-react';
import {
  formatCompactUsd,
  formatCryptoPrice,
  type CryptoInstitutionalAnalysis } from
'../../../lib/engine/cryptoInstitutionalMaster';
interface CryptoMasterOverviewProps {
  analysis: CryptoInstitutionalAnalysis;
  currentPrice: number;
}
export function CryptoMasterOverview({
  analysis,
  currentPrice
}: CryptoMasterOverviewProps) {
  return (
    <Stack gap="sm">
      <WhaleCard analysis={analysis} />
      <BiasCard analysis={analysis} />
      <OrderFlowCard analysis={analysis} />
      <LiquidityCard analysis={analysis} currentPrice={currentPrice} />
      <TrapCard analysis={analysis} />
    </Stack>);

}
function WhaleCard({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  const { whale } = analysis;
  const signalColor =
  whale.signal === 'BULLISH' ?
  '#00ff88' :
  whale.signal === 'BEARISH' ?
  '#ff4444' :
  '#a78bfa';
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-[#a78bfa]/25 bg-[#a78bfa]/[0.035]">
      
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <BrainCircuitIcon size={15} className="text-[#a78bfa]" />
          <Box>
            <Text size="xs" fw={800} tt="uppercase">
              Whale Activity · Smart-Money Tape
            </Text>
            <Text size="xs" c="dimmed">
              Binance aggregate trades · ≥$1M, or ≥100 BTC on BTC/USDT
            </Text>
          </Box>
        </Group>
        <Badge color="violet" variant="light" size="xs">
          Proxy
        </Badge>
      </Group>

      <SimpleGrid
        cols={{
          base: 2,
          sm: 4
        }}
        spacing="xs"
        mt="sm">
        
        <Metric
          label="Large buys"
          value={formatCompactUsd(whale.largeBuyUsd)}
          tone="buy" />
        
        <Metric
          label="Large sells"
          value={formatCompactUsd(whale.largeSellUsd)}
          tone="sell" />
        
        <Metric
          label="Net flow"
          value={`${whale.netUsd >= 0 ? '+' : '-'}${formatCompactUsd(Math.abs(whale.netUsd))}`}
          tone={
          whale.netUsd > 0 ? 'buy' : whale.netUsd < 0 ? 'sell' : undefined
          } />
        
        <Metric
          label="Large trades"
          value={whale.largeTradeCount}
          tone="purple" />
        
      </SimpleGrid>

      <Group
        justify="space-between"
        mt="xs"
        className="rounded border border-white/5 bg-black/20 px-3 py-2">
        
        <Text size="xs" c="dimmed">
          Directional large-trade pressure
        </Text>
        <Text size="xs" fw={900} c={signalColor}>
          {whale.signal}
        </Text>
      </Group>
    </Card>);

}
function BiasCard({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  const tone = directionTone(analysis.direction);
  return (
    <Card radius="md" padding="md" className={`border ${tone.panel}`}>
      <Group justify="space-between" align="flex-start" gap="xs" wrap="wrap">
        <Box className="min-w-0">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={1.2}>
            Institutional Bias · {analysis.symbol.replace('USDT', '/USDT')}
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
          <Text size="xs" c="dimmed">active-vote confidence</Text>
        </Box>
      </Group>

      <Progress
        value={analysis.confidence}
        color={tone.color}
        size="sm"
        radius="xl"
        mt="sm"
        aria-label={`Crypto bias confidence ${analysis.confidence}%`} />
      
      <SimpleGrid cols={3} spacing="xs" mt="sm">
        <Metric label="Buy score" value={analysis.buyScore} tone="buy" />
        <Metric label="Sell score" value={analysis.sellScore} tone="sell" />
        <Metric
          label="Net score"
          value={`${analysis.netScore > 0 ? '+' : ''}${analysis.netScore}`} />
        
      </SimpleGrid>
      <Text size="xs" c="dimmed" mt="xs">
        Strong beyond ±25 · Directional beyond ±15 · Otherwise neutral
      </Text>
    </Card>);

}
function OrderFlowCard({
  analysis


}: {analysis: CryptoInstitutionalAnalysis;}) {
  const { orderFlow, fearGreed } = analysis;
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <ActivityIcon size={15} className="text-yellow-400" />
          <Box>
            <Text size="xs" fw={800} tt="uppercase">
              Institutional Order Flow
            </Text>
            <Text size="xs" c="dimmed">
              Taker-side CVD proxy from the latest Binance aggregate trades
            </Text>
          </Box>
        </Group>
        <Badge color="yellow" variant="light" size="xs">
          Real trades
        </Badge>
      </Group>

      <Group justify="space-between" gap="xs" wrap="nowrap" mt="sm">
        <Text size="xs" fw={800} c="#00ff88" className="numeric-value font-mono">
          Buy {orderFlow.buyPercent.toFixed(1)}%
        </Text>
        <Text size="xs" fw={800} c="#ff4444" className="numeric-value font-mono">
          Sell {orderFlow.sellPercent.toFixed(1)}%
        </Text>
      </Group>
      <Box
        mt={5}
        className="flex h-2.5 overflow-hidden rounded-full bg-white/5"
        role="img"
        aria-label={`Taker buy pressure ${orderFlow.buyPercent.toFixed(1)} percent, taker sell pressure ${orderFlow.sellPercent.toFixed(1)} percent`}>
        
        <Box
          className="h-full bg-[#00ff88]"
          style={{
            width: `${orderFlow.buyPercent}%`
          }} />
        
        <Box
          className="h-full bg-[#ff4444]"
          style={{
            width: `${orderFlow.sellPercent}%`
          }} />
        
      </Box>

      <SimpleGrid
        cols={{
          base: 1,
          sm: 3
        }}
        spacing="xs"
        mt="sm">
        
        <Metric
          label="Taker buys"
          value={formatCompactUsd(orderFlow.takerBuyUsd)}
          tone="buy" />
        
        <Metric
          label="Taker sells"
          value={formatCompactUsd(orderFlow.takerSellUsd)}
          tone="sell" />
        
        <Metric
          label="CVD delta"
          value={`${orderFlow.deltaUsd >= 0 ? '+' : '-'}${formatCompactUsd(Math.abs(orderFlow.deltaUsd))}`}
          tone={orderFlow.deltaUsd >= 0 ? 'buy' : 'sell'} />
        
      </SimpleGrid>

      <Group
        justify="space-between"
        mt="xs"
        className="rounded border border-yellow-400/15 bg-yellow-400/5 px-3 py-2">
        
        <Text size="xs" c="dimmed">
          Fear & Greed · broad crypto market
        </Text>
        <Text
          size="xs"
          fw={800}
          c={
          !fearGreed ?
          'dimmed' :
          fearGreed.value < 20 ?
          '#00ff88' :
          fearGreed.value > 80 ?
          '#ff4444' :
          '#ffd700'
          }>
          
          {fearGreed ?
          `${fearGreed.value} · ${fearGreed.classification}` :
          'Unavailable · no score applied'}
        </Text>
      </Group>
    </Card>);

}
function LiquidityCard({ analysis, currentPrice }: CryptoMasterOverviewProps) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <WavesIcon size={15} className="text-yellow-400" />
          <Box>
            <Text size="xs" fw={800} tt="uppercase">
              Liquidity Levels · Order-Book Walls
            </Text>
            <Text size="xs" c="dimmed">
              Largest visible notionals in the Binance depth snapshot
            </Text>
          </Box>
        </Group>
        <Badge color="yellow" variant="light" size="xs">
          Top 100
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
        <LiquidityColumn
          label="Above · Ask walls"
          levels={analysis.liquidity.above}
          currentPrice={currentPrice}
          tone="sell" />
        
        <LiquidityColumn
          label="Below · Bid walls"
          levels={analysis.liquidity.below}
          currentPrice={currentPrice}
          tone="buy" />
        
      </SimpleGrid>

      <Group
        justify="space-between"
        gap="xs"
        wrap="wrap"
        mt="sm"
        className="min-w-0 rounded border border-yellow-400/15 bg-yellow-400/5 px-3 py-2">
        
        <Text size="xs" c="dimmed">Nearest selected wall</Text>
        <Text size="xs" fw={800} c="#ffd700" className="numeric-value font-mono">
          {analysis.liquidity.target ?
          `${formatCryptoPrice(analysis.liquidity.target)} · ${analysis.liquidity.targetSide}` :
          'No verified level'}
        </Text>
      </Group>
    </Card>);

}
function LiquidityColumn({
  label,
  levels,
  currentPrice,
  tone





}: {label: string;levels: CryptoInstitutionalAnalysis['liquidity']['above'];currentPrice: number;tone: 'buy' | 'sell';}) {
  return (
    <Box>
      <Text size="xs" fw={800} c={tone === 'buy' ? '#00ff88' : '#ff4444'}>
        {label}
      </Text>
      <Stack gap={4} mt={6}>
        {levels.length ?
        levels.map((level) =>
        <Group
          key={`${tone}-${level.price}`}
          justify="space-between"
          gap="xs"
          wrap="nowrap"
          className="min-w-0 rounded border border-white/5 bg-white/[0.025] px-2 py-1.5">
          
              <Box className="min-w-0">
                <Text size="xs" fw={700} className="numeric-value font-mono">
                  ${formatCryptoPrice(level.price)}
                </Text>
                <Text size="xs" c="dimmed">
                  <Text span className="numeric-value font-mono">{formatCompactUsd(level.notional)}</Text> visible
                </Text>
              </Box>
              <Text size="xs" c="dimmed" className="numeric-value font-mono">
                {((level.price - currentPrice) / currentPrice * 100).toFixed(2)}%
              </Text>
            </Group>
        ) :

        <Text size="xs" c="dimmed">
            No visible wall in snapshot
          </Text>
        }
      </Stack>
    </Box>);

}
function TrapCard({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  const actionable = analysis.traps.find((trap) => trap.action);
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <ShieldAlertIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Trap Detector · Seven Timeframes
        </Text>
      </Group>
      <SimpleGrid
        cols={{
          base: 2,
          sm: 7
        }}
        spacing="xs"
        mt="sm">
        
        {analysis.traps.map((trap) =>
        <Box
          key={trap.timeframe}
          ta="center"
          className="rounded border border-white/5 bg-white/[0.025] px-1 py-2">
          
            <Text size="xs" fw={800} className="font-mono">
              {trap.timeframe.toUpperCase()}
            </Text>
            <Text
            size="xs"
            fw={700}
            c={
            trap.kind === 'BEAR TRAP' ?
            '#00ff88' :
            trap.kind === 'BULL TRAP' ?
            '#ff4444' :
            'dimmed'
            }
            mt={2}>
            
              {trap.kind}
            </Text>
            {trap.level &&
          <Text size="xs" c="dimmed" className="numeric-value font-mono">
                ${formatCryptoPrice(trap.level)}
              </Text>
          }
          </Box>
        )}
      </SimpleGrid>
      <Text
        size="xs"
        ta="center"
        fw={700}
        mt="sm"
        c={
        actionable?.action === 'BUY' ?
        '#00ff88' :
        actionable?.action === 'SELL' ?
        '#ff4444' :
        'dimmed'
        }>
        
        {actionable ?
        `${actionable.timeframe.toUpperCase()} ${actionable.kind} → ${actionable.action}` :
        'No actionable completed trap'}
      </Text>
    </Card>);

}
function Metric({
  label,
  value,
  tone




}: {label: string;value: string | number;tone?: 'buy' | 'sell' | 'purple';}) {
  const color =
  tone === 'buy' ?
  '#00ff88' :
  tone === 'sell' ?
  '#ff4444' :
  tone === 'purple' ?
  '#a78bfa' :
  '#eeeeee';
  return (
    <Box className="rounded border border-white/10 bg-black/20 px-2.5 py-2">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="sm" fw={900} c={color} className="numeric-value font-mono">
        {value}
      </Text>
    </Box>);

}
function DirectionIcon({
  direction


}: {direction: CryptoInstitutionalAnalysis['direction'];}) {
  if (direction.includes('BUY')) {
    return <TrendingUpIcon size={22} className="text-[#00ff88]" />;
  }
  if (direction.includes('SELL')) {
    return <TrendingDownIcon size={22} className="text-[#ff4444]" />;
  }
  return <MinusIcon size={22} className="text-[#888]" />;
}
function directionTone(direction: CryptoInstitutionalAnalysis['direction']) {
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