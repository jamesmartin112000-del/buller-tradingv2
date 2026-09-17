import React, { useMemo } from 'react';
import { Card, ScrollArea, SimpleGrid, Table, Text, Title } from '@mantine/core';
import type { JournalTrade } from '../../types/tradingJournal';
import { groupedMetrics } from '../../utils/calculations';

const GROUPS = [
['Session analysis', 'session'],
['Timeframe analysis', 'timeframe'],
['Setup performance', 'setup'],
['Emotion analysis', 'emotion'],
['Mistake cost', 'mistake'],
['News impact', 'newsImpact'],
['Quality analysis', 'quality'],
['Rule compliance', 'ruleCheck']] as
const;

export function JournalAnalytics({ trades }: {trades: JournalTrade[];}) {
  const data = useMemo(
    () => GROUPS.map(([title, field]) => ({ title, rows: groupedMetrics(trades, field) })),
    [trades]
  );
  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }}>
      {data.map((group) =>
      <Card key={group.title} padding="md" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
          <Title order={3} size="sm" mb="sm">{group.title}</Title>
          {Object.keys(group.rows).length ?
        <ScrollArea type="auto">
              <Table striped highlightOnHover miw={560}>
                <Table.Thead><Table.Tr><Table.Th>Group</Table.Th><Table.Th>Trades</Table.Th><Table.Th>Wins</Table.Th><Table.Th>Win rate</Table.Th><Table.Th>P/L</Table.Th><Table.Th>Avg P/L</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{Object.entries(group.rows).sort((a, b) => b[1].pl - a[1].pl).map(([name, metric]) =>
              <Table.Tr key={name}><Table.Td>{name}</Table.Td><Table.Td>{metric.trades}</Table.Td><Table.Td>{metric.wins}</Table.Td><Table.Td>{metric.winRate.toFixed(1)}%</Table.Td><Table.Td c={metric.pl >= 0 ? 'green' : 'red'}>${metric.pl.toFixed(2)}</Table.Td><Table.Td>${metric.avgPL.toFixed(2)}</Table.Td></Table.Tr>
              )}</Table.Tbody>
              </Table>
            </ScrollArea> :
        <Text c="dimmed" size="sm">No completed trades in this month.</Text>}
        </Card>
      )}
    </SimpleGrid>);

}