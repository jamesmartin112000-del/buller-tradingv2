import React from 'react';
import {
  Badge,
  Box,
  Card,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text } from
'@mantine/core';
import {
  ActivityIcon,
  CandlestickChartIcon,
  CheckCircle2Icon,
  CrosshairIcon,
  DatabaseIcon,
  MapIcon } from
'lucide-react';
import {
  formatCompactUsd,
  formatCryptoPrice,
  type CryptoInstitutionalAnalysis } from
'../../../lib/engine/cryptoInstitutionalMaster';
interface CryptoMasterDetailsProps {
  analysis: CryptoInstitutionalAnalysis;
  displayedPrice: number;
  hasLiveWebSocketPrice: boolean;
}
export function CryptoMasterDetails({
  analysis,
  displayedPrice,
  hasLiveWebSocketPrice
}: CryptoMasterDetailsProps) {
  return (
    <Stack gap="sm">
      <MarketSnapshot
        analysis={analysis}
        displayedPrice={displayedPrice}
        hasLiveWebSocketPrice={hasLiveWebSocketPrice} />
      
      <CandleSecretTable analysis={analysis} />
      <EntryCard analysis={analysis} />
      <MarketPath analysis={analysis} />
      <EvidenceLog analysis={analysis} />
    </Stack>);

}
function MarketSnapshot({
  analysis,
  displayedPrice,
  hasLiveWebSocketPrice
}: CryptoMasterDetailsProps) {
  const change = analysis.ticker.priceChangePercent;
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-yellow-400/15 bg-white/[0.025]">
      
      <Group justify="space-between" align="flex-start" gap="xs" wrap="wrap">
        <Group gap="xs" wrap="nowrap" className="min-w-0">
          <ActivityIcon size={15} className="shrink-0 text-yellow-400" />
          <Box className="min-w-0">
            <Text size="xs" fw={800} tt="uppercase">
              {hasLiveWebSocketPrice ?
              'Live Binance WebSocket Price' :
              'Latest Binance 24h Ticker Price'}
            </Text>
            <Text size="xs" c="dimmed">
              {analysis.symbol.replace('USDT', '/USDT')} · Spot market
            </Text>
          </Box>
        </Group>
        <Badge
          color={hasLiveWebSocketPrice ? 'green' : 'yellow'}
          variant={hasLiveWebSocketPrice ? 'dot' : 'light'}
          size="xs">
          
          {hasLiveWebSocketPrice ? 'Live WS' : 'REST snapshot'}
        </Badge>
      </Group>

      <Group justify="space-between" align="flex-end" gap="xs" wrap="wrap" mt="xs">
        <Text fw={900} size="xl" c="#ffd700" className="numeric-value font-mono">
          ${formatCryptoPrice(displayedPrice)}
        </Text>
        <Text
          size="sm"
          fw={900}
          c={change >= 0 ? '#00ff88' : '#ff4444'}
          className="numeric-value font-mono">
          
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}%
        </Text>
      </Group>

      <SimpleGrid
        cols={{
          base: 2,
          sm: 4
        }}
        spacing="xs"
        mt="sm">
        
        <Metric
          label="24h high"
          value={`$${formatCryptoPrice(analysis.ticker.highPrice)}`} />
        
        <Metric
          label="24h low"
          value={`$${formatCryptoPrice(analysis.ticker.lowPrice)}`} />
        
        <Metric
          label="24h quote volume"
          value={formatCompactUsd(analysis.ticker.quoteVolume)} />
        
        <Metric
          label="Snapshot time"
          value={new Date(analysis.analyzedAt).toLocaleTimeString()} />
        
      </SimpleGrid>
    </Card>);

}
function CandleSecretTable({
  analysis


}: {analysis: CryptoInstitutionalAnalysis;}) {
  const mobileMetrics = (candle: CryptoInstitutionalAnalysis['candleSecrets'][number]) => [
  { label: 'Open', value: formatCryptoPrice(candle.open) },
  { label: 'Close', value: formatCryptoPrice(candle.close) },
  { label: 'High', value: formatCryptoPrice(candle.high) },
  { label: 'Low', value: formatCryptoPrice(candle.low) },
  { label: 'WBR', value: `${candle.wbr.toFixed(1)}x` },
  { label: 'Body', value: `${candle.bodyPct.toFixed(1)}%` }];


  return (
    <Card radius="md" padding="md" className="min-w-0 border border-white/10 bg-white/[0.02]">
      <Group justify="space-between" gap="xs" mb="xs" wrap="wrap">
        <Group gap="xs" wrap="nowrap">
          <CandlestickChartIcon size={15} className="shrink-0 text-yellow-400" />
          <Text size="xs" fw={800} tt="uppercase">Candle Secret Data · Last 10 (1m)</Text>
        </Group>
        <Badge color="yellow" variant="light" size="xs">Real OHLC</Badge>
      </Group>

      <Stack gap={6} className="sm:hidden">
        {analysis.candleSecrets.map((candle, index) =>
        <Box key={`${candle.timestamp}-${index}`} className="min-w-0 rounded border border-white/5 bg-black/20 px-2.5 py-2">
            <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
              <Text size="xs" c="dimmed">Candle</Text>
              <Text size="xs" fw={800} className="numeric-value font-mono">{index - 9}</Text>
            </Group>
            <SimpleGrid cols={2} spacing={5}>
              {mobileMetrics(candle).map((metric) =>
            <Group key={metric.label} justify="space-between" gap={4} wrap="nowrap" className="min-w-0 rounded bg-white/[0.025] px-2 py-1">
                  <Text size="xs" c="dimmed">{metric.label}</Text>
                  <Text
                size="xs"
                fw={800}
                c={metric.label === 'Close' ? candle.close >= candle.open ? '#00ff88' : '#ff4444' : undefined}
                className="numeric-value font-mono">
                
                    {metric.value}
                  </Text>
                </Group>
            )}
            </SimpleGrid>
            <Group gap="xs" mt={6} wrap="wrap">
              <Text size="xs" c="dimmed">Ghost <Text span fw={700}>{candle.ghost}</Text></Text>
              <Text size="xs" c="dimmed">Trap <Text span fw={700}>{candle.trap}</Text></Text>
              <Text size="xs" c="dimmed">Phase <Text span fw={700}>{candle.phase}</Text></Text>
            </Group>
          </Box>
        )}
      </Stack>

      <ScrollArea type="auto" className="hidden sm:block">
        <Table striped highlightOnHover withRowBorders={false} horizontalSpacing="xs" verticalSpacing={6} className="min-w-[760px] whitespace-nowrap text-xs">
          <Table.Thead>
            <Table.Tr>
              {['#', 'Open', 'Close', 'High', 'Low', 'WBR', 'Body%', 'Ghost', 'Trap', 'Phase'].map((label) =>
              <Table.Th key={label}>{label}</Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {analysis.candleSecrets.map((candle, index) =>
            <Table.Tr key={`${candle.timestamp}-${index}`}>
                <Table.Td>{index - 9}</Table.Td>
                <Table.Td>{formatCryptoPrice(candle.open)}</Table.Td>
                <Table.Td c={candle.close >= candle.open ? '#00ff88' : '#ff4444'}>{formatCryptoPrice(candle.close)}</Table.Td>
                <Table.Td>{formatCryptoPrice(candle.high)}</Table.Td>
                <Table.Td>{formatCryptoPrice(candle.low)}</Table.Td>
                <Table.Td>{candle.wbr.toFixed(1)}x</Table.Td>
                <Table.Td>{candle.bodyPct.toFixed(1)}%</Table.Td>
                <Table.Td c={candle.ghost === 'BUY' ? '#00ff88' : candle.ghost === 'SELL' ? '#ff4444' : 'dimmed'}>{candle.ghost}</Table.Td>
                <Table.Td c={candle.trap === 'BEAR' ? '#00ff88' : candle.trap === 'BULL' ? '#ff4444' : 'dimmed'}>{candle.trap}</Table.Td>
                <Table.Td fw={700}>{candle.phase}</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>);

}
function EntryCard({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  const entry = analysis.entry;
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <CrosshairIcon size={15} className="text-yellow-400" />
          <Box>
            <Text size="xs" fw={800} tt="uppercase">
              Scalping / Sniper Entry
            </Text>
            <Text size="xs" c="dimmed">
              Scenario levels derived from current price, ATR and visible walls
            </Text>
          </Box>
        </Group>
        {entry &&
        <Badge
          color={entry.direction === 'LONG' ? 'green' : 'red'}
          variant="light"
          size="xs">
          
            {entry.direction}
          </Badge>
        }
      </Group>

      {entry ?
      <SimpleGrid
        cols={{
          base: 2,
          sm: 3
        }}
        spacing="xs"
        mt="sm">
        
          <Metric
          label="Entry"
          value={`$${formatCryptoPrice(entry.entry)}`}
          tone="gold" />
        
          <Metric
          label={`Stop · ${entry.stopPercent.toFixed(2)}%`}
          value={`$${formatCryptoPrice(entry.stopLoss)}`}
          tone="sell" />
        
          {entry.targets.map((target) =>
        <Metric
          key={target.label}
          label={`${target.label} · 1:${target.rr}`}
          value={`$${formatCryptoPrice(target.price)}`}
          tone="buy" />

        )}
        </SimpleGrid> :

      <Box
        mt="sm"
        className="rounded border border-white/10 bg-black/20 px-3 py-4">
        
          <Text size="xs" c="dimmed" ta="center">
            No entry is published while the weighted stack remains neutral.
          </Text>
        </Box>
      }
      <Text size="xs" c="dimmed" mt="xs">
        Analytical scenario only. Levels are not an execution guarantee or
        financial advice.
      </Text>
    </Card>);

}
function MarketPath({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <MapIcon size={15} className="text-yellow-400" />
        <Box>
          <Text size="xs" fw={800} tt="uppercase">
            Market Path Scenario
          </Text>
          <Text size="xs" c="dimmed">
            Conditional route through current visible liquidity—not a guaranteed
            prediction
          </Text>
        </Box>
      </Group>

      {analysis.path.length ?
      <SimpleGrid
        cols={{
          base: 1,
          sm: 5
        }}
        spacing="xs"
        mt="sm">
        
          {analysis.path.map((step, index) =>
        <Box
          key={`${step.label}-${index}`}
          className={`rounded border px-2 py-2 ${step.tone === 'final' ? 'border-[#00ff88]/30 bg-[#00ff88]/5' : step.tone === 'grab' ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-white/10 bg-white/[0.025]'}`}>
          
              <Text size="xs" c="dimmed">
                {index + 1}
              </Text>
              <Text size="xs" fw={800} c="#ffd700" className="numeric-value font-mono">
                ${formatCryptoPrice(step.level)}
              </Text>
              <Text size="xs" c="dimmed">
                {step.label}
              </Text>
            </Box>
        )}
        </SimpleGrid> :

      <Text size="xs" c="dimmed" mt="sm">
          Waiting for usable visible liquidity levels.
        </Text>
      }
    </Card>);

}
function EvidenceLog({ analysis }: {analysis: CryptoInstitutionalAnalysis;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <DatabaseIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Institutional Evidence Log
        </Text>
      </Group>
      <SimpleGrid
        cols={{
          base: 1,
          sm: 2
        }}
        spacing={5}
        mt="xs">
        
        {analysis.evidence.length ?
        analysis.evidence.map((item) =>
        <Group key={item} gap={6} align="flex-start" wrap="nowrap">
              <CheckCircle2Icon
            size={12}
            className="mt-0.5 shrink-0 text-[#00ff88]" />
          
              <Text size="xs" c="dimmed">
                {item}
              </Text>
            </Group>
        ) :

        <Text size="xs" c="dimmed">
            No directional engine evidence is active.
          </Text>
        }
      </SimpleGrid>
    </Card>);

}
function Metric({
  label,
  value,
  tone




}: {label: string;value: string;tone?: 'buy' | 'sell' | 'gold';}) {
  const color =
  tone === 'buy' ?
  '#00ff88' :
  tone === 'sell' ?
  '#ff4444' :
  tone === 'gold' ?
  '#ffd700' :
  '#eeeeee';
  return (
    <Box className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-2 sm:px-2.5">
      <Text size="xs" c="dimmed" tt="uppercase">{label}</Text>
      <Text size="sm" fw={900} c={color} className="numeric-value font-mono">
        {value}
      </Text>
    </Box>);

}