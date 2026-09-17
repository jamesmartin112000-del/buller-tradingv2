import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  Title } from
'@mantine/core';
import {
  BookOpenIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  PlusIcon,
  RotateCcwIcon,
  UploadIcon } from
'lucide-react';
import { toast } from 'sonner';
import { DailyControlCalendar } from '../components/journal/DailyControlCalendar';
import { JournalAnalytics } from '../components/journal/JournalAnalytics';
import { JournalOverview } from '../components/journal/JournalOverview';
import { JournalSettings } from '../components/journal/JournalSettings';
import { JournalTable } from '../components/journal/JournalTable';
import { TradeForm } from '../components/journal/TradeForm';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import { useTradingJournal } from '../hooks/useTradingJournal';
import {
  exportBackup,
  exportCsv,
  exportExcel,
  parseBackup } from
'../lib/journal/exportJournal';
import type { JournalTrade, TradeDraft } from '../types/tradingJournal';
import {
  assertCalculationSample,
  dailyPerformance,
  summarizeJournal } from
'../utils/calculations';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function Journal() {
  const { user } = useAuth();
  const journal = useTradingJournal(user?.uid);
  const [month, setMonth] = useState(currentMonth());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  const [duplicate, setDuplicate] = useState<JournalTrade | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const restoreRef = useRef<() => void>(null);

  const months = useMemo(() => {
    const values = new Set(journal.trades.map((trade) => trade.month));
    values.add(currentMonth());
    return [...values].sort().reverse().map((value) => ({
      value,
      label: new Date(`${value}-02`).toLocaleDateString('en', { month: 'long', year: 'numeric' })
    }));
  }, [journal.trades]);
  const trades = useMemo(() => journal.trades.filter((trade) => trade.month === month), [journal.trades, month]);
  const summary = useMemo(() => summarizeJournal(trades, journal.settings), [trades, journal.settings]);
  const today = new Date().toISOString().slice(0, 10);
  const todayData = dailyPerformance(journal.trades.filter((trade) => trade.date === today))[0];
  const todayPL = todayData?.pl || 0;
  const todayTrades = todayData?.rows.length || 0;
  const lossLimit = journal.settings.startingCapital * (journal.settings.maxDailyLossPercent / 100);
  const tradingStatus = todayPL <= -lossLimit ?
  'DAILY LOSS LIMIT REACHED' :
  todayTrades >= journal.settings.maxTradesPerDay ?
  'DAILY LIMIT REACHED' :
  'TRADING ALLOWED';

  const openForm = (edit?: JournalTrade, copy?: JournalTrade) => {
    setEditing(edit || null);
    setDuplicate(copy || null);
    setFormOpen(true);
  };
  const save = async (draft: TradeDraft, id?: string) => journal.saveTrade(draft, id);
  const restore = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseBackup(file);
      if (window.confirm(`Replace the current journal with ${rows.length} backup trades?`)) {
        await journal.restore(rows);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup restore failed.');
    } finally {
      restoreRef.current?.();
    }
  };
  const exportSelectedMonth = async (format: 'csv' | 'excel') => {
    if (!trades.length) {
      toast.info('No trades in the selected month to export.');
      return;
    }
    try {
      if (format === 'csv') exportCsv(trades, month);else
      await exportExcel(trades, summary, month);
      toast.success(`${format === 'csv' ? 'CSV' : 'Excel'} export downloaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Journal export failed.');
    }
  };
  const downloadBackup = () => {
    try {
      exportBackup(journal.trades, journal.settings);
      toast.success('Journal backup downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup download failed.');
    }
  };

  if (journal.loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Stack align="center"><Logo variant="circle" size={88} showText={false} /><Loader color="yellow" /><Text c="dimmed">Loading your private journal</Text></Stack></div>;
  }

  return (
    <Stack p={{ base: 'sm', md: 'md' }} gap="md" maw={1800} mx="auto">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="sm"><BookOpenIcon className="text-brand" /><Title order={1} size="h2">BULLER TRADING Journal</Title></Group>
          <Text c="dimmed" size="sm" mt={4}>XAUUSD / GOLD only · Select more, type less · Real data only</Text>
        </div>
        <Group wrap="wrap">
          <Select label="Month" data={months} value={month} onChange={(value) => setMonth(value || currentMonth())} allowDeselect={false} w={220} />
          <Button mt={24} color="yellow" leftSection={<PlusIcon size={16} />} onClick={() => openForm()}>New trade</Button>
        </Group>
      </Group>

      {!assertCalculationSample() && <Alert color="red" title="Calculation integrity check failed">Trading is disabled until the calculation layer passes its reference test.</Alert>}
      {journal.error &&
      <Alert color="red" title="Journal service">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">{journal.error}</Text>
            <Button size="xs" variant="outline" color="red" onClick={() => void journal.refresh()}>
              Retry loading
            </Button>
          </Group>
        </Alert>
      }

      <Card padding="sm" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
        <Group justify="space-between" wrap="wrap">
          <Group><Text size="xs" c="dimmed">TODAY</Text><Badge color={tradingStatus === 'TRADING ALLOWED' ? 'green' : 'red'} variant="outline">{tradingStatus}</Badge></Group>
          <Group gap="xl"><Text size="sm">Trades <b>{todayTrades}/{journal.settings.maxTradesPerDay}</b></Text><Text size="sm">Daily P/L <b className={todayPL >= 0 ? 'text-buy' : 'text-sell'}>${todayPL.toFixed(2)}</b></Text><Text size="sm">Loss limit <b>-${lossLimit.toFixed(2)}</b></Text></Group>
        </Group>
      </Card>

      <Tabs defaultValue="dashboard" variant="outline" color="yellow" keepMounted={false}>
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
          <Tabs.Tab value="trades">Trades</Tabs.Tab>
          <Tabs.Tab value="calendar">Daily control</Tabs.Tab>
          <Tabs.Tab value="analytics">Analytics</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
          <Tabs.Tab value="export">Export & reset</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="dashboard" pt="md"><JournalOverview trades={trades} settings={journal.settings} /></Tabs.Panel>
        <Tabs.Panel value="trades" pt="md"><JournalTable trades={trades} saving={journal.saving} onEdit={(trade) => openForm(trade)} onDuplicate={(trade) => openForm(undefined, trade)} onDelete={journal.deleteTrade} /></Tabs.Panel>
        <Tabs.Panel value="calendar" pt="md"><DailyControlCalendar trades={trades} settings={journal.settings} month={month} /></Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md"><JournalAnalytics trades={trades} /></Tabs.Panel>
        <Tabs.Panel value="settings" pt="md"><JournalSettings settings={journal.settings} saving={journal.saving} onSave={journal.saveSettings} /></Tabs.Panel>
        <Tabs.Panel value="export" pt="md">
          <Card padding="lg" radius="md" style={{ background: '#0c3526', border: '1px solid rgba(226,191,118,.28)' }}>
            <Stack>
              <Title order={2} size="lg">Export, backup and reset</Title>
              <Text c="dimmed" size="sm">Exports are generated from your currently selected month. Backups include your full journal.</Text>
              <Group wrap="wrap">
                <Button variant="outline" color="yellow" leftSection={<DownloadIcon size={16} />} onClick={() => void exportSelectedMonth('csv')}>Export CSV</Button>
                <Button variant="outline" color="yellow" leftSection={<FileSpreadsheetIcon size={16} />} onClick={() => void exportSelectedMonth('excel')}>Export Excel</Button>
                <Button variant="outline" color="yellow" leftSection={<FileJsonIcon size={16} />} onClick={downloadBackup}>Download JSON backup</Button>
                <FileButton onChange={restore} accept="application/json" resetRef={restoreRef}>
                  {(props) => <Button {...props} variant="outline" color="blue" leftSection={<UploadIcon size={16} />}>Restore backup</Button>}
                </FileButton>
                <Button color="red" variant="outline" leftSection={<RotateCcwIcon size={16} />} onClick={() => setResetStep(1)}>Reset journal</Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={null} size="xl" centered scrollAreaComponent={ScrollArea.Autosize}>
        <TradeForm settings={journal.settings} editing={editing} duplicate={duplicate} saving={journal.saving} onSave={save} onCancel={() => {setFormOpen(false);setEditing(null);setDuplicate(null);}} />
      </Modal>
      <Modal opened={resetStep > 0} onClose={() => setResetStep(0)} title={resetStep === 1 ? 'Reset journal?' : 'Final confirmation'} centered>
        <Stack><Text>{resetStep === 1 ? 'This will permanently remove every trade from your journal.' : 'This action cannot be undone. A permanent audit record will remain.'}</Text><Group justify="flex-end"><Button variant="default" onClick={() => setResetStep(0)}>Cancel</Button><Button color="red" loading={journal.saving} onClick={async () => {if (resetStep === 1) setResetStep(2);else if (await journal.reset()) setResetStep(0);}}>{resetStep === 1 ? 'Continue' : 'Permanently reset'}</Button></Group></Stack>
      </Modal>
    </Stack>);

}