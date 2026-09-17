import React from 'react';
import { Badge, Box, Card, Group, SimpleGrid, Text } from '@mantine/core';
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  XCircleIcon } from
'lucide-react';
import type {
  CryptoEngineResult,
  CryptoInstitutionalAnalysis } from
'../../../lib/engine/cryptoInstitutionalMaster';
export function CryptoEngineAudit({
  analysis


}: {analysis: CryptoInstitutionalAnalysis;}) {
  return (
    <Card
      radius="md"
      padding="md"
      className="border border-yellow-400/15 bg-white/[0.02]">
      
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <BrainCircuitIcon size={15} className="text-yellow-400" />
          <Box>
            <Text size="xs" fw={800} tt="uppercase">
              Ten-Engine Weighted Audit
            </Text>
            <Text size="xs" c="dimmed">
              Every vote exposes its exact weight, source and reason
            </Text>
          </Box>
        </Group>
        <Badge color="yellow" variant="light" size="xs">
          Total weight 71 · Net −71 to +71
        </Badge>
      </Group>

      <SimpleGrid
        cols={{
          base: 1,
          sm: 2,
          lg: 5
        }}
        spacing="xs"
        mt="sm">
        
        {analysis.engines.map((engine) =>
        <EngineCard key={engine.id} engine={engine} />
        )}
      </SimpleGrid>
    </Card>);

}
function EngineCard({ engine }: {engine: CryptoEngineResult;}) {
  const tone =
  engine.status === 'BUY' ?
  'border-[#00ff88]/25 bg-[#00ff88]/5' :
  engine.status === 'SELL' ?
  'border-[#ff4444]/25 bg-[#ff4444]/5' :
  engine.status === 'UNAVAILABLE' ?
  'border-yellow-400/20 bg-yellow-400/5' :
  'border-white/10 bg-black/20';
  const color =
  engine.status === 'BUY' ?
  '#00ff88' :
  engine.status === 'SELL' ?
  '#ff4444' :
  engine.status === 'UNAVAILABLE' ?
  '#ffd700' :
  '#888888';
  return (
    <Box className={`rounded border p-2.5 ${tone}`}>
      <Group justify="space-between" gap={6} wrap="nowrap">
        <Text size="xs" fw={800} lineClamp={1}>
          {engine.name}
        </Text>
        <Badge
          size="xs"
          variant="light"
          color={
          engine.status === 'BUY' ?
          'green' :
          engine.status === 'SELL' ?
          'red' :
          engine.status === 'UNAVAILABLE' ?
          'yellow' :
          'gray'
          }>
          
          {engine.weight}
        </Badge>
      </Group>
      <Group gap={5} mt={5} wrap="nowrap">
        {engine.status === 'BUY' ?
        <CheckCircle2Icon size={12} color={color} /> :
        engine.status === 'SELL' ?
        <XCircleIcon size={12} color={color} /> :

        <MinusCircleIcon size={12} color={color} />
        }
        <Text size="xs" fw={800} c={color}>
          {engine.status}
        </Text>
        {(engine.buyScore > 0 || engine.sellScore > 0) &&
        <Text size="xs" c="dimmed" className="font-mono">
            {engine.buyScore > 0 ?
          `+${engine.buyScore}` :
          `-${engine.sellScore}`}
          </Text>
        }
      </Group>
      <Text size="xs" c="dimmed" mt={5} lineClamp={3}>
        {engine.reason}
      </Text>
      <Text size="xs" c="#a78bfa" mt={5} lineClamp={2}>
        {engine.source}
      </Text>
    </Box>);

}