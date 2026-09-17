import { Box, Card, Group, SimpleGrid, Text } from '@mantine/core';
import { GaugeIcon } from 'lucide-react';
import type {
  EngineResult,
  GoldSniperAnalysis } from
'../../../lib/engine/goldInstitutionalSniper';
export function GoldEngineAudit({
  analysis


}: {analysis: GoldSniperAnalysis;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-white/10 bg-white/[0.02]">
      
      <Group gap="xs" mb="sm">
        <GaugeIcon size={15} className="text-yellow-400" />
        <Text size="xs" fw={800} tt="uppercase">
          Twelve-Engine Weighted Audit
        </Text>
      </Group>
      <SimpleGrid
        cols={{
          base: 1,
          sm: 2,
          xl: 4
        }}
        spacing="xs">
        
        {analysis.engines.map((engine) =>
        <EngineTile key={engine.id} engine={engine} />
        )}
      </SimpleGrid>
    </Card>);

}
function EngineTile({ engine }: {engine: EngineResult;}) {
  const tone =
  engine.status === 'BUY' ?
  'border-[#00ff88]/25 bg-[#00ff88]/5' :
  engine.status === 'SELL' ?
  'border-[#ff4444]/25 bg-[#ff4444]/5' :
  'border-white/10 bg-white/[0.02]';
  const color =
  engine.status === 'BUY' ?
  '#00ff88' :
  engine.status === 'SELL' ?
  '#ff4444' :
  engine.status === 'UNAVAILABLE' ?
  '#666' :
  '#aaa';
  return (
    <Box className={`rounded border p-2.5 ${tone}`}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={800} truncate>
          {engine.name}
        </Text>
        <Text size="xs" fw={900} c={color} className="font-mono">
          {engine.status === 'BUY' ?
          `+${engine.buyScore} BUY` :
          engine.status === 'SELL' ?
          `+${engine.sellScore} SELL` :
          engine.status}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mt={5}>
        {engine.reason}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Weight {engine.weight}
      </Text>
    </Box>);

}