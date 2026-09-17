import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { JournalSettings, JournalTrade } from '../../types/tradingJournal';
import { dailyPerformance } from '../../utils/calculations';

export function DailyControlCalendar({
  trades,
  settings,
  month




}: {trades: JournalTrade[];settings: JournalSettings;month: string;}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const byDay = useMemo(() => new Map(dailyPerformance(trades).map((day) => [day.date, day])), [trades]);
  const [year, monthIndex] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDay = new Date(year, monthIndex - 1, 1).getDay();
  const selected = selectedDate ? byDay.get(selectedDate) : undefined;
  const lossLimit = settings.startingCapital * (settings.maxDailyLossPercent / 100);
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div><Title order={2} size="lg">Monthly control calendar</Title><Text size="sm" c="dimmed">Select a date to review that day’s trades.</Text></div>
        <Badge variant="outline" color="yellow">{new Date(`${month}-02`).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</Badge>
      </Group>
      <SimpleGrid cols={7} spacing={6} verticalSpacing={6}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => <Text key={day} ta="center" size="xs" c="dimmed" fw={700}>{day}</Text>)}
        {Array.from({ length: firstDay }).map((_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const data = byDay.get(date);
          const lossStop = !!data && data.pl <= -lossLimit;
          const tradeLimit = !!data && data.rows.length >= settings.maxTradesPerDay;
          return (
            <Card
              key={date}
              component="button"
              type="button"
              onClick={() => setSelectedDate(date)}
              padding="xs"
              radius="md"
              mih={96}
              style={{
                background: data ? '#0c3526' : '#08281c',
                border: `1px solid ${lossStop ? 'rgba(224,113,113,.65)' : 'rgba(226,191,118,.24)'}`,
                textAlign: 'left'
              }}>
              
              <Text fw={800}>{day}</Text>
              {data && <>
                <Text mt={6} size="xs" fw={800} c={data.pl >= 0 ? 'green' : 'red'}>{data.pl >= 0 ? '+' : ''}${data.pl.toFixed(2)}</Text>
                <Text size="xs" c="dimmed">{data.rows.length}/{settings.maxTradesPerDay} trades</Text>
                <Text size="10px" c={lossStop ? 'red' : tradeLimit ? 'yellow' : data.pl >= 0 ? 'green' : 'red'}>{lossStop ? 'TRADING STOP' : tradeLimit ? 'LIMIT REACHED' : data.pl >= 0 ? 'WIN DAY' : 'LOSS DAY'}</Text>
              </>}
            </Card>);

        })}
      </SimpleGrid>

      <Modal opened={!!selectedDate} onClose={() => setSelectedDate(null)} title={selectedDate || ''} centered size="lg">
        {selected ?
        <Stack>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <DayMetric label="Taken" value={`${selected.rows.length}/${settings.maxTradesPerDay}`} />
              <DayMetric label="Remaining" value={String(Math.max(0, settings.maxTradesPerDay - selected.rows.length))} />
              <DayMetric label="Daily P/L" value={`$${selected.pl.toFixed(2)}`} />
              <DayMetric label="Rule violations" value={String(selected.rows.filter((trade) => trade.ruleCheck === 'NO').length)} />
            </SimpleGrid>
            {selected.rows.map((trade) => <Card key={trade.id} padding="sm" withBorder><Group justify="space-between"><Text fw={700}>Trade {trade.tradeNo} · {trade.direction} · {trade.setup}</Text><Text fw={800} c={trade.actualPL >= 0 ? 'green' : 'red'}>${trade.actualPL.toFixed(2)}</Text></Group></Card>)}
          </Stack> :
        <Text c="dimmed">No trades recorded for this date.</Text>}
      </Modal>
    </Stack>);

}
function DayMetric({ label, value }: {label: string;value: string;}) {
  return <Card padding="sm" withBorder><Text size="xs" c="dimmed">{label}</Text><Text fw={800}>{value}</Text></Card>;
}