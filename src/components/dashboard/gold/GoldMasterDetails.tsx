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
  DatabaseIcon,
  MapIcon } from
'lucide-react';
import { formatPrice } from '../../../lib/engine/goldInstitutionalSniper';
import type { GoldSniperAnalysis } from '../../../lib/engine/goldInstitutionalSniper';
interface GoldMasterDetailsProps {
  analysis: GoldSniperAnalysis;
  hasLiveQuote: boolean;
  bid: number | null;
  ask: number | null;
  displayedPrice: number;
  spread: number | null;
  quoteSource?: string;
}
export function GoldMasterDetails({
  analysis,
  hasLiveQuote,
  bid,
  ask,
  displayedPrice,
  spread,
  quoteSource
}: GoldMasterDetailsProps) {
  return (
    <Stack gap="sm">
      <PriceSourceCard
        hasLiveQuote={hasLiveQuote}
        bid={bid}
        ask={ask}
        displayedPrice={displayedPrice}
        spread={spread}
        quoteSource={quoteSource}
        primaryTimeframe={analysis.primaryTimeframe} />
      
      <CandleSecretTable analysis={analysis} />
      <MarketPath analysis={analysis} />
      <EvidenceLog analysis={analysis} />
    </Stack>);

}
function PriceSourceCard({
  hasLiveQuote,
  bid,
  ask,
  displayedPrice,
  spread,
  quoteSource,
  primaryTimeframe


}: Omit<GoldMasterDetailsProps, 'analysis'> & {primaryTimeframe: string;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-yellow-400/15 bg-white/[0.025]">
      
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Group gap="xs" wrap="nowrap" className="min-w-0">
          <ActivityIcon size={15} className="shrink-0 text-yellow-400" />
          <Text size="xs" fw={800} tt="uppercase" c="dimmed">
            {hasLiveQuote ? 'Live Gold Quote' : 'Latest Real OHLC Close'}
          </Text>
        </Group>
        <Badge
          size="xs"
          color={hasLiveQuote ? 'green' : 'yellow'}
          variant={hasLiveQuote ? 'dot' : 'light'}>
          
          {hasLiveQuote ? 'Live quote' : `Real ${primaryTimeframe} close`}
        </Badge>
      </Group>

      <Text mt="xs" fw={900} size="xl" c="#ffd700" className="numeric-value font-mono">
        ${formatPrice(displayedPrice)}
      </Text>

      {hasLiveQuote ?
      <SimpleGrid cols={3} spacing={5} mt="sm">
          <Metric label="Bid" value={bid ? `${formatPrice(bid)}` : '—'} />
          <Metric label="Ask" value={ask ? `${formatPrice(ask)}` : '—'} />
          <Metric
          label="Spread"
          value={spread !== null ? `$${spread.toFixed(2)}` : '—'} />
        
        </SimpleGrid> :

      <Box
        mt="sm"
        className="rounded border border-yellow-400/15 bg-yellow-400/5 px-3 py-2">
        
          <Text size="xs" c="dimmed">
            Bid/ask is currently unavailable. This value is the latest verified
            close from the real {primaryTimeframe} candle feed, not a BBO quote.
          </Text>
        </Box>
      }

      <Text size="xs" c="dimmed" mt="xs">
        {hasLiveQuote ?
        `Quote source: ${quoteSource || 'public Gold quote feed'}` :
        'Source: unified public real-candle feed'}
      </Text>
    </Card>);

}
function CandleSecretTable({ analysis }: {analysis: GoldSniperAnalysis;}) {
  const mobileMetrics = (candle: GoldSniperAnalysis['candleSecrets'][number]) => [
  { label: 'Open', value: candle.open.toFixed(2) },
  { label: 'Close', value: candle.close.toFixed(2) },
  { label: 'High', value: candle.high.toFixed(2) },
  { label: 'Low', value: candle.low.toFixed(2) },
  { label: 'WBR', value: `${candle.wbr.toFixed(1)}x` },
  { label: 'Body', value: `${candle.bodyPct.toFixed(1)}%` }];


  return (
    <Card
      radius="md"
      padding="md"
      className="min-w-0 border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs" mb="xs" wrap="nowrap">
        <CandlestickChartIcon size={15} className="shrink-0 text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Candle Secret Data · Last 10 ({analysis.primaryTimeframe})
        </Text>
      </Group>

      <Stack gap={6} className="sm:hidden">
        {analysis.candleSecrets.map((candle, index) =>
        <Box
          key={`${candle.timestamp}-${index}`}
          className="min-w-0 rounded border border-white/5 bg-black/20 px-2.5 py-2">
          
            <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
              <Text size="xs" c="dimmed">Candle</Text>
              <Text size="xs" fw={800} className="numeric-value font-mono">
                {index - 9}
              </Text>
            </Group>
            <SimpleGrid cols={2} spacing={5}>
              {mobileMetrics(candle).map((metric) =>
            <Group
              key={metric.label}
              justify="space-between"
              gap={4}
              wrap="nowrap"
              className="min-w-0 rounded bg-white/[0.025] px-2 py-1">
              
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
        <Table
          striped
          highlightOnHover
          withRowBorders={false}
          horizontalSpacing="xs"
          verticalSpacing={6}
          className="min-w-[720px] whitespace-nowrap text-xs">
          
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
                <Table.Td>{candle.open.toFixed(2)}</Table.Td>
                <Table.Td c={candle.close >= candle.open ? '#00ff88' : '#ff4444'}>{candle.close.toFixed(2)}</Table.Td>
                <Table.Td>{candle.high.toFixed(2)}</Table.Td>
                <Table.Td>{candle.low.toFixed(2)}</Table.Td>
                <Table.Td>{candle.wbr.toFixed(1)}x</Table.Td>
                <Table.Td>{candle.bodyPct.toFixed(1)}%</Table.Td>
                <Table.Td c={candle.ghost === 'NO' ? 'dimmed' : candle.ghost === 'BUY' ? '#00ff88' : '#ff4444'}>{candle.ghost}</Table.Td>
                <Table.Td c={candle.trap === 'NO' ? 'dimmed' : candle.trap === 'BEAR' ? '#00ff88' : '#ff4444'}>{candle.trap}</Table.Td>
                <Table.Td fw={700}>{candle.phase}</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>);

}
function MarketPath({ analysis }: {analysis: GoldSniperAnalysis;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs">
        <MapIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Market Path Prediction
        </Text>
      </Group>
      {analysis.marketPath.length ?
      <SimpleGrid
        cols={{
          base: 1,
          sm: 5
        }}
        spacing="xs"
        mt="sm">
        
          {analysis.marketPath.map((step, index) =>
        <Box
          key={step.label}
          className={`relative rounded border px-2 py-2 ${step.tone === 'final' ? 'border-[#00ff88]/35 bg-[#00ff88]/5' : step.tone === 'grab' ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-white/10 bg-white/[0.025]'}`}>
          
              <Text size="xs" c="dimmed">
                {index + 1}
              </Text>
              <Text size="xs" fw={800} c="#ffd700" className="numeric-value font-mono">
                ${formatPrice(step.level)}
              </Text>
              <Text size="xs" c="dimmed">
                {step.label}
              </Text>
            </Box>
        )}
        </SimpleGrid> :

      <Text size="xs" c="dimmed" mt="sm">
          Waiting for verified liquidity levels.
        </Text>
      }
    </Card>);

}
function EvidenceLog({ analysis }: {analysis: GoldSniperAnalysis;}) {
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
function Metric({ label, value }: {label: string;value: string | number;}) {
  return (
    <Box className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-2 sm:px-2.5">
      <Text size="xs" c="dimmed" tt="uppercase">{label}</Text>
      <Text size="sm" fw={900} c="#eee" className="numeric-value font-mono">
        {value}
      </Text>
    </Box>);

}