import { useState } from 'react';
import { KeyRoundIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  cacheLocalRecord,
  generateMasterKey,
  persistRecord,
  uid,
  type MasterKey } from
'../../lib/db/store';
import {
  durationToHours,
  formatValidityHours,
  MAX_VALIDITY_HOURS,
  MIN_VALIDITY_HOURS,
  type ValidityUnit } from
'../../utils/validity';
import { Button } from '../ui/Button';

interface Props {
  email: string;
  adminEmail: string;
  onClose: () => void;
}

export function MasterKeyIssueModal({ email, adminEmail, onClose }: Props) {
  const [amount, setAmount] = useState(7);
  const [unit, setUnit] = useState<ValidityUnit>('days');
  const [saving, setSaving] = useState(false);
  const validityHours = durationToHours(amount, unit);

  const create = async () => {
    if (!Number.isFinite(validityHours) || validityHours < MIN_VALIDITY_HOURS || validityHours > MAX_VALIDITY_HOURS) {
      toast.error('Validity must be between 1 minute and 10 years.');
      return;
    }
    setSaving(true);
    try {
      const key = generateMasterKey();
      const record: MasterKey = {
        id: uid('mk'),
        key,
        email: email.trim().toLowerCase(),
        validityHours,
        validityDays: Math.max(1, Math.ceil(validityHours / 24)),
        used: false,
        createdAt: Date.now(),
        createdBy: adminEmail
      };
      await persistRecord('masterKeys', record);
      cacheLocalRecord('masterKeys', record);
      await navigator.clipboard?.writeText(key).catch(() => undefined);
      toast.success(`Master key created for ${formatValidityHours(validityHours)} and copied`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Master key could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="issue-key-title" className="w-full max-w-md rounded-md border border-line bg-bg-700 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="issue-key-title" className="font-bold">Generate Master Gate Key</h3>
            <p className="mt-1 break-all font-mono text-xs text-ink-muted">{email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-dim hover:bg-bg-600 hover:text-ink"><XIcon className="h-4 w-4" /></button>
        </div>

        <div className="rounded border border-line bg-bg-600 p-3">
          <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-ink-muted">Validity</label>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <input type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="min-w-0 rounded border border-line bg-bg-700 px-3 py-2 text-sm outline-none focus:border-brand" />
            <select value={unit} onChange={(event) => setUnit(event.target.value as ValidityUnit)} className="rounded border border-line bg-bg-700 px-3 py-2 text-sm outline-none focus:border-brand">
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="months">Months</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0.25, 0.5, 1, 5, 12, 24, 48, 168, 720].map((hours) =>
            <button key={hours} type="button" onClick={() => {setAmount(hours < 1 ? hours * 60 : hours);setUnit(hours < 1 ? 'minutes' : 'hours');}} className={`rounded border px-2 py-1 text-2xs font-bold ${validityHours === hours ? 'border-brand bg-brand text-white' : 'border-line bg-bg-700 text-ink-muted hover:border-brand/50'}`}>{formatValidityHours(hours)}</button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Access starts when the user activates this key and remains valid for <strong className="text-brand">{formatValidityHours(validityHours)}</strong>.</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon={<KeyRoundIcon className="h-4 w-4" />} onClick={() => void create()} disabled={saving}>{saving ? 'Generating…' : 'Generate & Copy'}</Button>
        </div>
      </div>
    </div>);

}