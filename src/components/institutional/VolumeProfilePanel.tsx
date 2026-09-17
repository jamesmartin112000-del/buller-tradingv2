import { Box, Group, Stack, Text } from '@mantine/core';
import { BarChart3Icon } from 'lucide-react';
import type { VolumeProfile } from '../../lib/institutional/types';

interface VolumeProfilePanelProps {
  profile: VolumeProfile;
}

export function VolumeProfilePanel({ profile }: VolumeProfilePanelProps) {
  const levels = [
  { label: 'VAH', value: profile.vah, color: '#ff1744', note: 'Value area high' },
  { label: 'POC', value: profile.poc, color: '#ffab00', note: 'Maximum accepted volume' },
  { label: 'VAL', value: profile.val, color: '#00c853', note: 'Value area low' }];

  return (
    <Box component="section" aria-label="Volume profile" className="h-full rounded-md border border-line bg-bg-600 p-3">
      <Group justify="space-between" mb="sm">
        <Group gap={6}>
          <BarChart3Icon size={14} className="text-warn" aria-hidden="true" />
          <Text component="h3" size="10px" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
            Volume profile
          </Text>
        </Group>
        <Text size="9px" tt="uppercase" fw={700} c="#ffab00">
          {profile.sessionType.replace(/([A-Z])/g, ' $1')}
        </Text>
      </Group>
      <Stack gap={7}>
        {levels.map((level) =>
        <Group
          key={level.label}
          justify="space-between"
          wrap="nowrap"
          className="rounded-sm border border-line bg-bg-800 px-2.5 py-2">
          
            <div className="min-w-0">
              <Text size="9px" tt="uppercase" fw={800} c={level.color}>{level.label}</Text>
              <Text size="9px" c="dimmed" truncate>{level.note}</Text>
            </div>
            <Text ff="monospace" size="sm" fw={800} c="white" className="numeric-value">{formatPrice(level.value)}</Text>
          </Group>
        )}
      </Stack>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="VA width" value={formatPrice(profile.valueAreaWidth)} />
        <Metric label="HV nodes" value={String(profile.highVolumeNodes.length)} />
        <Metric label="LV zones" value={String(profile.lowVolumeNodes.length)} />
      </div>
    </Box>);

}

function Metric({ label, value }: {label: string;value: string;}) {
  return (
    <div className="min-w-0 rounded-sm border border-line bg-bg-800 p-2 text-center">
      <Text size="8px" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text ff="monospace" size="xs" fw={800} c="white" mt={2} className="numeric-value">{value}</Text>
    </div>);

}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}