import React, { useEffect, useState } from 'react';
import { Button, Card, Group, NumberInput, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { SaveIcon } from 'lucide-react';
import { LOT_SIZES, SESSIONS, TIMEFRAMES } from '../../data/journalOptions';
import type { JournalSettings as JournalSettingsType } from '../../types/tradingJournal';

export function JournalSettings({
  settings,
  saving,
  onSave




}: {settings: JournalSettingsType;saving: boolean;onSave: (settings: Partial<JournalSettingsType>) => Promise<boolean>;}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const patch = <K extends keyof JournalSettingsType,>(key: K, value: JournalSettingsType[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Card padding="lg" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
      <Stack gap="lg">
        <div><Title order={2} size="lg">Journal settings</Title><Text size="sm" c="dimmed">Risk, discipline and XAUUSD contract defaults are applied to every calculation.</Text></div>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <NumberInput label="Starting capital (USD)" min={1} decimalScale={2} value={draft.startingCapital} onChange={(value) => patch('startingCapital', Number(value))} />
          <NumberInput label="Risk per trade (%)" min={0.01} max={100} decimalScale={2} value={draft.riskPercent} onChange={(value) => patch('riskPercent', Number(value))} />
          <NumberInput label="Maximum daily loss (%)" min={0.1} max={100} decimalScale={2} value={draft.maxDailyLossPercent} onChange={(value) => patch('maxDailyLossPercent', Number(value))} />
          <NumberInput label="Maximum trades per day" min={1} max={20} value={draft.maxTradesPerDay} onChange={(value) => patch('maxTradesPerDay', Number(value))} />
          <NumberInput label="Contract size (oz per 1.00 lot)" min={1} value={draft.contractSize} onChange={(value) => patch('contractSize', Number(value))} />
          <Select label="Default lot size" data={LOT_SIZES.map(String)} value={String(draft.defaultLotSize)} onChange={(value) => patch('defaultLotSize', Number(value))} allowDeselect={false} />
          <Select label="Currency" data={['USD']} value={draft.currency} allowDeselect={false} />
          <Select label="Default timeframe" data={[...TIMEFRAMES]} value={draft.defaultTimeframe} onChange={(value) => patch('defaultTimeframe', value || '15m')} allowDeselect={false} />
          <Select label="Default session" data={[...SESSIONS]} value={draft.defaultSession} onChange={(value) => patch('defaultSession', value || 'LONDON')} allowDeselect={false} />
          <Select label="Date format" data={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} value={draft.dateFormat} onChange={(value) => patch('dateFormat', value || 'DD/MM/YYYY')} allowDeselect={false} />
        </SimpleGrid>
        <Group justify="flex-end"><Button color="yellow" loading={saving} leftSection={<SaveIcon size={16} />} onClick={() => void onSave(draft)}>Save settings</Button></Group>
      </Stack>
    </Card>);

}