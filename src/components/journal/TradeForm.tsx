import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  FileButton,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput } from
'@mantine/core';
import { CameraIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import {
  EMOTIONS,
  LOT_SIZES,
  MISTAKES,
  NEWS_IMPACTS,
  QUALITIES,
  SESSIONS,
  SETUPS,
  TIMEFRAMES } from
'../../data/journalOptions';
import {
  removeTradeScreenshot,
  uploadTradeScreenshot } from
'../../lib/r2Upload';
import type {
  JournalSettings,
  JournalTrade,
  TradeDraft } from
'../../types/tradingJournal';
import { validateTrade } from '../../utils/calculations';

interface TradeFormProps {
  settings: JournalSettings;
  editing?: JournalTrade | null;
  duplicate?: JournalTrade | null;
  saving: boolean;
  onSave: (draft: TradeDraft, id?: string) => Promise<boolean>;
  onCancel: () => void;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function localTime() {
  return new Date().toTimeString().slice(0, 5);
}
function initialDraft(settings: JournalSettings): TradeDraft {
  return {
    date: localDate(), entryTime: localTime(), exitTime: '', direction: 'BUY',
    timeframe: settings.defaultTimeframe, session: settings.defaultSession,
    setup: SETUPS[0], newsDay: 'NO', newsImpact: 'NONE',
    lotSize: settings.defaultLotSize, entryPrice: 0, stopLoss: 0, takeProfit: 0,
    exitPrice: null, ruleCheck: 'YES', emotion: 'Calm', mistake: 'None',
    quality: 'A', reason: '', screenshotUrl: null, screenshotPath: null
  };
}

export function TradeForm({ settings, editing, duplicate, saving, onSave, onCancel }: TradeFormProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<TradeDraft>(() => initialDraft(settings));
  const [uploading, setUploading] = useState(false);
  const originalPathRef = useRef<string | null>(null);

  useEffect(() => {
    const source = editing || duplicate;
    if (!source) {
      setDraft(initialDraft(settings));
      originalPathRef.current = null;
      return;
    }
    setDraft({
      ...source,
      date: duplicate ? localDate() : source.date,
      entryTime: duplicate ? localTime() : source.entryTime,
      exitTime: duplicate ? '' : source.exitTime,
      exitPrice: duplicate ? null : source.exitPrice,
      screenshotUrl: duplicate ? null : source.screenshotUrl,
      screenshotPath: duplicate ? null : source.screenshotPath
    });
    originalPathRef.current = source.screenshotPath || null;
  }, [editing, duplicate, settings]);

  const patch = <K extends keyof TradeDraft,>(key: K, value: TradeDraft[K]) =>
  setDraft((current) => ({ ...current, [key]: value }));

  const upload = async (file: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const uploaded = await uploadTradeScreenshot(user.uid, file);
      if (draft.screenshotPath && draft.screenshotPath !== originalPathRef.current) {
        await removeTradeScreenshot(draft.screenshotPath);
      }
      setDraft((current) => ({
        ...current,
        screenshotUrl: uploaded.url,
        screenshotPath: uploaded.path
      }));
      toast.success(`Screenshot compressed to ${Math.ceil(uploaded.size / 1024)}KB`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Screenshot upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = { ...draft, newsImpact: draft.newsDay === 'NO' ? 'NONE' as const : draft.newsImpact };
    const errors = validateTrade(normalized);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    const saved = await onSave(normalized, editing?.id);
    if (saved) onCancel();
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text size="xs" c="#e2bf76" fw={700} tt="uppercase">XAUUSD / GOLD ONLY</Text>
            <Text fw={800} size="lg">{editing ? 'Edit trade' : duplicate ? 'Duplicate trade' : 'Record trade'}</Text>
          </div>
          <Button
            type="button"
            variant="subtle"
            color="gray"
            onClick={onCancel}
            leftSection={<XIcon size={16} />}>
            
            Cancel
          </Button>
        </Group>

        <Group grow align="flex-start">
          <TextInput label="Date" type="date" value={draft.date} onChange={(e) => patch('date', e.currentTarget.value)} required />
          <TextInput label="Entry time" type="time" value={draft.entryTime} onChange={(e) => patch('entryTime', e.currentTarget.value)} required />
          <TextInput label="Exit time" type="time" value={draft.exitTime} onChange={(e) => patch('exitTime', e.currentTarget.value)} />
        </Group>
        <Group grow align="flex-start">
          <Select label="Direction" data={['BUY', 'SELL']} value={draft.direction} onChange={(v) => patch('direction', (v || 'BUY') as TradeDraft['direction'])} allowDeselect={false} />
          <Select label="Timeframe" data={[...TIMEFRAMES]} value={draft.timeframe} onChange={(v) => patch('timeframe', v || settings.defaultTimeframe)} allowDeselect={false} />
          <Select label="Session" data={[...SESSIONS]} value={draft.session} onChange={(v) => patch('session', v || settings.defaultSession)} allowDeselect={false} />
        </Group>
        <Select label="Setup" data={[...SETUPS]} searchable value={draft.setup} onChange={(v) => patch('setup', v || SETUPS[0])} allowDeselect={false} />
        <Group grow align="flex-start">
          <Select label="News day" data={['YES', 'NO']} value={draft.newsDay} onChange={(v) => {
            const newsDay = (v || 'NO') as TradeDraft['newsDay'];
            setDraft((current) => ({ ...current, newsDay, newsImpact: newsDay === 'NO' ? 'NONE' : 'HIGH' }));
          }} allowDeselect={false} />
          <Select label="News impact" data={draft.newsDay === 'NO' ? ['NONE'] : [...NEWS_IMPACTS]} value={draft.newsImpact} disabled={draft.newsDay === 'NO'} onChange={(v) => patch('newsImpact', (v || 'NONE') as TradeDraft['newsImpact'])} allowDeselect={false} />
          <Select label="Lot size" data={LOT_SIZES.map(String)} value={String(draft.lotSize)} onChange={(v) => patch('lotSize', Number(v))} allowDeselect={false} />
        </Group>
        <Group grow align="flex-start">
          <NumberInput label="Entry price" decimalScale={2} value={draft.entryPrice || ''} onChange={(v) => patch('entryPrice', Number(v))} required hideControls />
          <NumberInput label="Stop loss" decimalScale={2} value={draft.stopLoss || ''} onChange={(v) => patch('stopLoss', Number(v))} required hideControls />
          <NumberInput label="Take profit" decimalScale={2} value={draft.takeProfit || ''} onChange={(v) => patch('takeProfit', Number(v))} required hideControls />
          <NumberInput label="Exit price" decimalScale={2} value={draft.exitPrice ?? ''} onChange={(v) => patch('exitPrice', v === '' ? null : Number(v))} hideControls />
        </Group>
        <Group grow align="flex-start">
          <Select label="Rule check" data={['YES', 'NO']} value={draft.ruleCheck} onChange={(v) => patch('ruleCheck', (v || 'YES') as TradeDraft['ruleCheck'])} allowDeselect={false} />
          <Select label="Emotion" data={[...EMOTIONS]} value={draft.emotion} onChange={(v) => patch('emotion', v || 'Neutral')} allowDeselect={false} />
          <Select label="Mistake" data={[...MISTAKES]} searchable value={draft.mistake} onChange={(v) => patch('mistake', v || 'None')} allowDeselect={false} />
          <Select label="Quality" data={[...QUALITIES]} value={draft.quality} onChange={(v) => patch('quality', (v || 'B') as TradeDraft['quality'])} allowDeselect={false} />
        </Group>
        <Textarea label="Reason of trade" value={draft.reason} onChange={(e) => patch('reason', e.currentTarget.value)} minRows={3} maxLength={1200} required />

        {draft.screenshotUrl &&
        <Group align="center">
            <a href={draft.screenshotUrl} target="_blank" rel="noopener noreferrer">
              <img src={draft.screenshotUrl} alt="Trade screenshot preview" className="h-24 w-36 rounded border border-line object-contain" />
            </a>
            <Button variant="outline" color="red" leftSection={<Trash2Icon size={16} />} onClick={async () => {
            try {
              if (draft.screenshotPath && draft.screenshotPath !== originalPathRef.current) {
                await removeTradeScreenshot(draft.screenshotPath);
              }
              setDraft((current) => ({ ...current, screenshotUrl: null, screenshotPath: null }));
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Screenshot could not be removed.');
            }
          }}>Remove</Button>
          </Group>
        }
        <Group justify="space-between" wrap="wrap">
          <FileButton onChange={upload} accept="image/png,image/jpeg">
            {(props) => <Button {...props} variant="outline" color="yellow" loading={uploading} leftSection={<CameraIcon size={16} />}>{draft.screenshotUrl ? 'Replace screenshot' : 'Add screenshot'}</Button>}
          </FileButton>
          <Button type="submit" color="yellow" loading={saving || uploading} leftSection={<SaveIcon size={16} />}>Save trade</Button>
        </Group>
      </Stack>
    </form>);

}