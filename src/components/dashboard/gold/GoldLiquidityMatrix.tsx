import {
  Badge,
  Box,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text } from
'@mantine/core';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CrosshairIcon,
  ShieldCheckIcon } from
'lucide-react';
import { formatPrice } from '../../../lib/engine/goldInstitutionalSniper';
import type {
  GoldSniperAnalysis,
  LiquidityStrength,
  RankedLiquidityLevel } from
'../../../lib/engine/goldInstitutionalSniper';

interface GoldLiquidityMatrixProps {
  analysis: GoldSniperAnalysis;
  currentPrice: number;
}

export function GoldLiquidityMatrix({
  analysis,
  currentPrice
}: GoldLiquidityMatrixProps) {
  const { nextHunt, powerLevels, timeframes } = analysis.liquidity;
  const quoteOffset = currentPrice - analysis.currentPrice;
  const adjusted = (value: number) => value + quoteOffset;

  return (
    <Box mt="md" pt="md" className="border-t border-white/5">
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Box>
          <Group gap={6}>
            <CrosshairIcon size={14} className="text-yellow-400" aria-hidden="true" />
            <Text size="xs" fw={800} tt="uppercase">
              All-TF Liquidity Intelligence · 1m–4h
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mt={3}>
            Closed-candle sweeps · ATR-normalized pools · higher-TF weighted
          </Text>
        </Box>
        <Badge size="xs" variant="light" color="yellow" className="numeric-value">
          {timeframes.filter((item) => item.available).length}/6 TF live
        </Badge>
      </Group>

      {nextHunt ?
      <Box
        mt="sm"
        className={`rounded-md border p-3 ${
        nextHunt.direction === 'BUY' ?
        'border-[#00ff88]/30 bg-[#00ff88]/5' :
        'border-[#ff4444]/30 bg-[#ff4444]/5'}`
        }>
        
          <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Next probable liquidity hunt
              </Text>
              <Group gap="xs" mt={4} wrap="wrap">
                {nextHunt.direction === 'BUY' ?
              <ArrowUpIcon size={20} className="shrink-0 text-[#00ff88]" aria-hidden="true" /> :

              <ArrowDownIcon size={20} className="shrink-0 text-[#ff4444]" aria-hidden="true" />
              }
                <Text size="lg" fw={900} c={nextHunt.direction === 'BUY' ? '#00ff88' : '#ff4444'}>
                  {nextHunt.direction} →{' '}
                  <Text span className="numeric-value font-mono">
                    ${formatPrice(adjusted(nextHunt.level))}
                  </Text>
                </Text>
                <Badge size="xs" variant="light" color={nextHunt.moveSize === 'BIG' ? 'yellow' : 'gray'}>
                  {nextHunt.moveSize} MOVE
                </Badge>
              </Group>
            </Box>
            <Box ta="right">
              <Text
              size="lg"
              fw={900}
              c={nextHunt.confidence >= 75 ? '#ffd700' : '#d0d0d0'}
              className="numeric-value font-mono">
              
                {nextHunt.confidence}%
              </Text>
              <Text size="xs" c="dimmed">
                weighted confidence
              </Text>
            </Box>
          </Group>
          <Progress
          value={nextHunt.confidence}
          color={nextHunt.direction === 'BUY' ? 'green' : 'red'}
          size="xs"
          radius="xl"
          mt="xs"
          aria-label={`Next ${nextHunt.direction.toLowerCase()} hunt confidence ${nextHunt.confidence}%`} />
        
          <Group justify="space-between" gap="xs" wrap="wrap" mt="xs">
            <Text size="xs" c="dimmed">{nextHunt.reason}</Text>
            <Group gap={3} wrap="wrap">
              <Text size="xs" c="dimmed">Invalidation:</Text>
              <Text size="xs" c="dimmed" className="numeric-value font-mono">
                {nextHunt.invalidation === null ?
              'pending' :
              `${formatPrice(adjusted(nextHunt.invalidation))}`}
              </Text>
            </Group>
          </Group>
        </Box> :

      <Text size="xs" c="dimmed" mt="sm">
          No confirmed all-timeframe hunt alignment yet.
        </Text>
      }

      <SimpleGrid
        cols={{ base: 2, sm: 3, lg: 6 }}
        spacing="xs"
        mt="sm"
        aria-label="Liquidity hunt analysis by timeframe">
        
        {timeframes.map((item) =>
        <Box
          key={item.timeframe}
          className="min-h-[183px] min-w-0 w-full rounded border border-white/5 bg-black/20 p-2">
          
            <Group justify="space-between" gap={4} wrap="nowrap">
              <Text size="xs" fw={900} className="numeric-value font-mono">
                {item.timeframe.toUpperCase()}
              </Text>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.available ? 'bg-[#00ff88]' : 'bg-[#666]'}`} aria-label={item.available ? 'available' : 'unavailable'} />
            </Group>
            {!item.available ?
          <Text size="xs" c="dimmed" mt="sm">Feed unavailable</Text> :

          <Stack gap={5} mt={7}>
                <LevelLine label="BSL" level={item.buySide} quoteOffset={quoteOffset} />
                <LevelLine label="SSL" level={item.sellSide} quoteOffset={quoteOffset} />
                <Box pt={5} className="min-w-0 border-t border-white/5">
                  <Text size="xs" c="dimmed">Last hunt</Text>
                  <Text size="xs" fw={700} c={item.lastHunt?.reaction === 'BUY' ? '#00ff88' : item.lastHunt?.reaction === 'SELL' ? '#ff4444' : 'dimmed'}>
                    {item.lastHunt ?
                <>
                        {item.lastHunt.side === 'BUY-SIDE' ? 'BSL' : 'SSL'} @{' '}
                        <Text span className="numeric-value font-mono">
                          {formatPrice(item.lastHunt.level + quoteOffset)}
                        </Text>{' '}
                        → {item.lastHunt.reaction}
                      </> :
                'No fresh sweep'}
                  </Text>
                </Box>
                <Box className="min-w-0">
                  <Group justify="space-between" gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">Next</Text>
                    <Text
                  size="xs"
                  fw={900}
                  c={item.nextHunt?.direction === 'BUY' ? '#00ff88' : item.nextHunt?.direction === 'SELL' ? '#ff4444' : 'dimmed'}
                  className="numeric-value font-mono">
                  
                      {item.nextHunt ? `${item.nextHunt.direction} ${item.nextHunt.confidence}%` : 'SCANNING'}
                    </Text>
                  </Group>
                  {item.nextHunt &&
              <Text size="xs" c="dimmed" ta="right" className="numeric-value font-mono">
                      ${formatPrice(item.nextHunt.level + quoteOffset)} · {item.nextHunt.moveSize}
                    </Text>
              }
                </Box>
              </Stack>
          }
          </Box>
        )}
      </SimpleGrid>

      <Box mt="sm">
        <Group gap={6}>
          <ShieldCheckIcon size={14} className="text-yellow-400" aria-hidden="true" />
          <Text size="xs" fw={800} tt="uppercase">
            Strongest exact levels · all timeframes
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" mt="xs">
          {powerLevels.length ?
          powerLevels.map((level, index) =>
          <Group
            key={`${level.side}-${level.price}-${index}`}
            justify="space-between"
            gap="xs"
            wrap="nowrap"
            className="rounded border border-white/5 bg-white/[0.025] px-2 py-1.5">
            
                <Box className="min-w-0">
                  <Text
                size="xs"
                fw={800}
                c={level.side === 'BUY-SIDE' ? '#ff7777' : '#66ffaa'}>
                
                    {level.side === 'BUY-SIDE' ? 'BSL ABOVE' : 'SSL BELOW'}
                  </Text>
                  <Text size="xs" fw={800} className="numeric-value font-mono">
                    ${formatPrice(adjusted(level.price))}
                  </Text>
                </Box>
                <Box ta="right" className="min-w-0">
                  <Badge
                size="xs"
                variant="light"
                color={strengthColor(level.strength)}>
                
                    {level.strength} {level.score}
                  </Badge>
                  <Text size="xs" c="dimmed" mt={2}>
                    {level.timeframes.map((tf) => tf.toUpperCase()).join(' · ')}
                  </Text>
                </Box>
              </Group>
          ) :

          <Text size="xs" c="dimmed">
              No verified cross-timeframe pools.
            </Text>
          }
        </SimpleGrid>
      </Box>

      <Text size="xs" c="dimmed" mt="sm">
        Hunt direction is a weighted market scenario, not a guaranteed trade signal.
        Confirm structure and risk before entry.
      </Text>
    </Box>);

}

function LevelLine({
  label,
  level,
  quoteOffset




}: {label: string;level: RankedLiquidityLevel | null;quoteOffset: number;}) {
  return (
    <Group justify="space-between" gap={4} wrap="nowrap" className="min-w-0">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" fw={700} className="numeric-value font-mono">
        {level ? `${formatPrice(level.price + quoteOffset)}` : '—'}
      </Text>
    </Group>);

}

function strengthColor(strength: LiquidityStrength): string {
  if (strength === 'POWER') return 'yellow';
  if (strength === 'STRONG') return 'orange';
  return 'gray';
}