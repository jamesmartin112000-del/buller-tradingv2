import React, { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput } from
'@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  CopyIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon } from
'lucide-react';
import type { JournalTrade } from '../../types/tradingJournal';
import { formatRR } from '../../utils/calculations';

interface JournalTableProps {
  trades: JournalTrade[];
  saving: boolean;
  onEdit: (trade: JournalTrade) => void;
  onDuplicate: (trade: JournalTrade) => void;
  onDelete: (id: string) => Promise<boolean>;
}

type SortKey = 'date' | 'tradeNo' | 'actualPL' | 'quality';

export function JournalTable({ trades, saving, onEdit, onDuplicate, onDelete }: JournalTableProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [outcome, setOutcome] = useState<string | null>('ALL');
  const [sort, setSort] = useState<SortKey>('date');
  const [details, setDetails] = useState<JournalTrade | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JournalTrade | null>(null);

  const rows = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return trades.
    filter((trade) => outcome === 'ALL' || trade.outcome === outcome).
    filter((trade) =>
    !needle ||
    [trade.id, trade.date, trade.direction, trade.session, trade.setup, trade.emotion, trade.mistake, trade.reason].
    some((value) => String(value).toLowerCase().includes(needle))
    ).
    sort((a, b) => {
      if (sort === 'actualPL') return b.actualPL - a.actualPL;
      if (sort === 'tradeNo') return b.tradeNo - a.tradeNo;
      if (sort === 'quality') return a.quality.localeCompare(b.quality);
      return `${b.date}T${b.entryTime}`.localeCompare(`${a.date}T${a.entryTime}`);
    });
  }, [debouncedQuery, outcome, sort, trades]);

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          label="Search trades"
          placeholder="ID, setup, reason, emotion..."
          leftSection={<SearchIcon size={16} />}
          style={{ flex: '1 1 260px' }} />
        
        <Select label="Outcome" data={['ALL', 'WIN', 'LOSS', 'BREAKEVEN', 'OPEN']} value={outcome} onChange={setOutcome} allowDeselect={false} w={170} />
        <Select label="Sort" data={[
        { value: 'date', label: 'Newest date' },
        { value: 'tradeNo', label: 'Trade number' },
        { value: 'actualPL', label: 'Highest P/L' },
        { value: 'quality', label: 'Quality' }]
        } value={sort} onChange={(value) => setSort((value || 'date') as SortKey)} allowDeselect={false} w={180} />
      </Group>

      <ScrollArea type="auto" offsetScrollbars>
        <Table striped highlightOnHover miw={1900} stickyHeader>
          <Table.Thead>
            <Table.Tr>
              {['Trade ID', 'Date', '#', 'Direction', 'TF', 'Session', 'Setup', 'News', 'Lot', 'Entry', 'SL', 'TP', 'Exit', 'Risk', 'RR', 'P/L', 'Equity', 'Outcome', 'Rule', 'Emotion', 'Mistake', 'Quality', 'Actions'].map((heading) => <Table.Th key={heading}>{heading}</Table.Th>)}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((trade) =>
            <Table.Tr key={trade.id}>
                <Table.Td><Text ff="monospace" size="xs">{trade.id.slice(0, 8)}</Text></Table.Td>
                <Table.Td>{trade.date}</Table.Td>
                <Table.Td>{trade.tradeNo}</Table.Td>
                <Table.Td><Badge color={trade.direction === 'BUY' ? 'green' : 'red'} variant="light">{trade.direction}</Badge></Table.Td>
                <Table.Td>{trade.timeframe}</Table.Td>
                <Table.Td>{trade.session}</Table.Td>
                <Table.Td>{trade.setup}</Table.Td>
                <Table.Td>{trade.newsDay === 'YES' ? trade.newsImpact : 'NO'}</Table.Td>
                <Table.Td>{trade.lotSize.toFixed(2)}</Table.Td>
                <Table.Td>{trade.entryPrice.toFixed(2)}</Table.Td>
                <Table.Td>{trade.stopLoss.toFixed(2)}</Table.Td>
                <Table.Td>{trade.takeProfit.toFixed(2)}</Table.Td>
                <Table.Td>{trade.exitPrice?.toFixed(2) || 'OPEN'}</Table.Td>
                <Table.Td>${trade.riskAmount.toFixed(2)}</Table.Td>
                <Table.Td>{formatRR(trade.plannedRR)}</Table.Td>
                <Table.Td c={trade.actualPL >= 0 ? 'green' : 'red'} fw={700}>{trade.actualPL >= 0 ? '+' : ''}${trade.actualPL.toFixed(2)}</Table.Td>
                <Table.Td>${trade.equityAfter.toFixed(2)}</Table.Td>
                <Table.Td>{trade.outcome}</Table.Td>
                <Table.Td>{trade.ruleCheck}</Table.Td>
                <Table.Td>{trade.emotion}</Table.Td>
                <Table.Td>{trade.mistake}</Table.Td>
                <Table.Td>{trade.quality}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="subtle" color="gray" aria-label="View details" onClick={() => setDetails(trade)}><EyeIcon size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="yellow" aria-label="Edit trade" onClick={() => onEdit(trade)}><PencilIcon size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="blue" aria-label="Duplicate trade" onClick={() => onDuplicate(trade)}><CopyIcon size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label="Delete trade" onClick={() => setPendingDelete(trade)}><Trash2Icon size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {!rows.length && <Text ta="center" c="dimmed" py="xl">No trades match this view.</Text>}

      <Modal opened={!!details} onClose={() => setDetails(null)} title="Trade details" size="lg" centered>
        {details &&
        <Stack>
            <Group justify="space-between"><Text c="dimmed">Instrument</Text><Text fw={700}>{details.instrument}</Text></Group>
            <Group justify="space-between"><Text c="dimmed">Reason</Text><Text maw={420} ta="right">{details.reason}</Text></Group>
            <Group justify="space-between"><Text c="dimmed">Created</Text><Text>{new Date(details.createdAt).toLocaleString()}</Text></Group>
            {details.screenshotUrl && <a href={details.screenshotUrl} target="_blank" rel="noopener noreferrer"><img src={details.screenshotUrl} alt="Trade screenshot" className="max-h-96 w-full rounded border border-line object-contain" /></a>}
          </Stack>
        }
      </Modal>

      <Modal opened={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Permanently delete trade?" centered>
        <Stack>
          <Text>Are you sure you want to permanently delete this trade?</Text>
          <Text size="sm" c="dimmed">The journal entry will be removed and the equity chain recalculated. The audit log remains permanently.</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setPendingDelete(null)}>Cancel</Button><Button color="red" loading={saving} onClick={async () => {
              if (pendingDelete && (await onDelete(pendingDelete.id))) setPendingDelete(null);
            }}>Delete permanently</Button></Group>
        </Stack>
      </Modal>
    </Stack>);

}