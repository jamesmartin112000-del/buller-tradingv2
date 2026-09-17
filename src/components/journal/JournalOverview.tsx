import React, { useMemo } from 'react';
import { Box, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { JournalSettings, JournalTrade } from '../../types/tradingJournal';
import { dailyPerformance, summarizeJournal } from '../../utils/calculations';

export function JournalOverview({ trades, settings }: {trades: JournalTrade[];settings: JournalSettings;}) {
  const summary = useMemo(() => summarizeJournal(trades, settings), [trades, settings]);
  const days = useMemo(() => dailyPerformance(trades), [trades]);
  const equityPoints = [settings.startingCapital, ...trades.map((trade) => trade.equityAfter)];
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        <Metric label="Current equity" value={`$${summary.currentEquity.toFixed(2)}`} tone={summary.netPL >= 0 ? 'positive' : 'negative'} />
        <Metric label="Net P/L" value={`${summary.netPL >= 0 ? '+' : ''}$${summary.netPL.toFixed(2)}`} tone={summary.netPL >= 0 ? 'positive' : 'negative'} />
        <Metric label="Total trades" value={String(summary.trades)} />
        <Metric label="Win rate" value={`${summary.winRate.toFixed(1)}%`} />
        <Metric label="Profit factor" value={summary.profitFactor === null ? '∞' : summary.profitFactor.toFixed(2)} />
        <Metric label="Max drawdown" value={`$${summary.maxDrawdown.toFixed(2)}`} tone="negative" />
        <Metric label="Average win" value={`$${summary.averageWin.toFixed(2)}`} tone="positive" />
        <Metric label="Average loss" value={`-$${summary.averageLoss.toFixed(2)}`} tone="negative" />
        <Metric label="Rule compliance" value={`${summary.ruleCompliance.toFixed(1)}%`} />
        <Metric label="Discipline score" value={`${summary.disciplineScore}/100`} />
        <Metric label="Risk score" value={`${summary.riskScore}/100`} />
        <Metric label="Month status" value={summary.status} tone={summary.status === 'LOSS' ? 'negative' : summary.status === 'PROFITABLE' ? 'positive' : undefined} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <ChartCard title="Equity curve" values={equityPoints} labels={equityPoints.map((_, index) => String(index))} />
        <ChartCard title="Daily P/L" values={days.map((day) => day.pl)} labels={days.map((day) => day.date.slice(5))} zeroLine />
      </SimpleGrid>
    </Stack>);

}

function Metric({ label, value, tone }: {label: string;value: string;tone?: 'positive' | 'negative';}) {
  return (
    <Card padding="sm" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
      <Text size="xs" c="#92998e" tt="uppercase">{label}</Text>
      <Text mt={4} fw={800} ff="monospace" c={tone === 'positive' ? '#56b887' : tone === 'negative' ? '#e07171' : '#f3f1e9'}>{value}</Text>
    </Card>);

}

function ChartCard({ title, values, labels, zeroLine }: {title: string;values: number[];labels: string[];zeroLine?: boolean;}) {
  const width = 700;
  const height = 210;
  const min = Math.min(...values, zeroLine ? 0 : Infinity);
  const max = Math.max(...values, zeroLine ? 0 : -Infinity);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 24 + index / Math.max(1, values.length - 1) * (width - 48);
    const y = 18 + (max - value) / range * (height - 48);
    return `${x},${y}`;
  }).join(' ');
  const zeroY = 18 + (max - 0) / range * (height - 48);
  return (
    <Card padding="md" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
      <Title order={3} size="sm" c="#f3f1e9">{title}</Title>
      <Box mt="sm" style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} style={{ minWidth: 520, width: '100%' }}>
          {zeroLine && <line x1="20" x2={width - 20} y1={zeroY} y2={zeroY} stroke="rgba(226,191,118,.25)" />}
          {values.length > 1 && <polyline fill="none" stroke="#e2bf76" strokeWidth="2" points={points} />}
          {values.map((value, index) => {
            const [x, y] = points.split(' ')[index].split(',');
            return <circle key={`${labels[index]}-${index}`} cx={x} cy={y} r="3" fill={value >= 0 ? '#56b887' : '#e07171'}><title>{labels[index]}: {value.toFixed(2)}</title></circle>;
          })}
        </svg>
      </Box>
    </Card>);

}