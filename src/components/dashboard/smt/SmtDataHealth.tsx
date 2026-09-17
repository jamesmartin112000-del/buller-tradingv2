import type { ReactNode } from 'react';
import { Card, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  CheckCircle2Icon,
  DatabaseZapIcon,
  ShieldCheckIcon,
  TriangleAlertIcon } from
'lucide-react';
import type { ScanResult } from '../../../lib/types';

interface SmtDataHealthProps {
  summary: ScanResult['summary'];
}

export function SmtDataHealth({ summary }: SmtDataHealthProps) {
  const unavailable = summary.totalTimeframes - summary.availableTimeframes;
  const health =
  summary.totalTimeframes === 0 ?
  0 :
  summary.availableTimeframes / summary.totalTimeframes * 100;

  return (
    <Card
      component="section"
      aria-labelledby="data-health-title"
      padding="lg"
      radius="md"
      withBorder
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      
      <Group gap="xs" mb="md">
        <DatabaseZapIcon size={17} color="var(--brand)" aria-hidden />
        <Text id="data-health-title" size="sm" fw={800} tt="uppercase" lts="0.08em">
          Data health
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <HealthMetric
          icon={<CheckCircle2Icon size={16} />}
          label="Operational"
          value={`${summary.availableTimeframes}/${summary.totalTimeframes}`}
          color="var(--buy)" />
        
        <HealthMetric
          icon={<TriangleAlertIcon size={16} />}
          label="Partial feeds"
          value={String(unavailable)}
          color={unavailable ? 'var(--warn)' : 'var(--text2)'} />
        
        <HealthMetric
          icon={<ShieldCheckIcon size={16} />}
          label="SMT divergences"
          value={String(summary.totalDivergences)}
          color="var(--brand)" />
        
      </SimpleGrid>

      <Stack gap={6} mt="md">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Cross-asset feed coverage</Text>
          <Text size="xs" ff="monospace" fw={700}>{Math.round(health)}%</Text>
        </Group>
        <Progress value={health} color={health === 100 ? 'green' : 'orange'} size="sm" />
        <Text size="xs" c="dimmed" lh={1.5}>
          Missing timeframes remain score-neutral. Each Gold/DXY pair is evaluated independently, so a partial feed cannot suppress valid votes elsewhere.
        </Text>
      </Stack>
    </Card>);

}

function HealthMetric({
  icon,
  label,
  value,
  color





}: {icon: ReactNode;label: string;value: string;color: string;}) {
  return (
    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg3)' }}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={3}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
          <Text size="xl" ff="monospace" fw={800} style={{ color }}>{value}</Text>
        </Stack>
        <span style={{ color }} aria-hidden>{icon}</span>
      </Group>
    </div>);

}