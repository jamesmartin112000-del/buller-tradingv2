import { useState, type ReactNode } from 'react';
import { PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { useContent } from '../../lib/db/hooks';
import { persistRecord, type ContentBlock } from '../../lib/db/store';
import {
  parsePublicLinks,
  type PublicManagedLink } from
'../common/PublicManagedLinks';
import { Button } from '../ui/Button';

interface Props {
  adminEmail: string;
}

const NEW_LINK: Omit<PublicManagedLink, 'id'> = {
  title: '',
  description: '',
  url: '',
  category: 'social',
  enabled: true,
  startsAt: '',
  endsAt: ''
};

export function ManagedLinksTab({ adminEmail }: Props) {
  const raw = useContent('public.links', '[]');
  const [draft, setDraft] = useState<PublicManagedLink[] | null>(null);
  const [saving, setSaving] = useState(false);
  const links = draft ?? parsePublicLinks(raw);

  const update = (id: string, patch: Partial<PublicManagedLink>) => {
    setDraft(links.map((link) => link.id === id ? { ...link, ...patch } : link));
  };

  const add = () => {
    setDraft([
    ...links,
    { ...NEW_LINK, id: `link_${Date.now().toString(36)}` }]
    );
  };

  const save = async () => {
    const invalid = links.find(
      (link) => !link.title.trim() || !/^https?:\/\//i.test(link.url.trim())
    );
    if (invalid) return toast.error('Every link needs a title and a valid http(s) URL.');
    setSaving(true);
    try {
      const record: ContentBlock = {
        id: 'public.links',
        value: JSON.stringify(links),
        updatedAt: Date.now(),
        updatedBy: adminEmail
      };
      await persistRecord('content', record);
      setDraft(null);
      toast.success('Public links updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Links could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg-600 p-4">
        <div>
          <h2 className="text-sm font-bold">Social, Event & Promotional Links</h2>
          <p className="mt-1 text-xs text-ink-muted">Enabled links appear automatically in the public footer. Dates are optional.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={add}>Add link</Button>
          <Button variant="primary" size="sm" icon={<SaveIcon className="h-3.5 w-3.5" />} disabled={saving || draft === null} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>

      {links.map((link) =>
      <div key={link.id} className="rounded-md border border-line bg-bg-600 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Display name" value={link.title} onChange={(value) => update(link.id, { title: value })} placeholder="Instagram" />
            <Field label="URL" value={link.url} onChange={(value) => update(link.id, { url: value })} placeholder="https://..." />
            <div>
              <Label>Category</Label>
              <select value={link.category} onChange={(event) => update(link.id, { category: event.target.value as PublicManagedLink['category'] })} className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="social">Social</option><option value="referral">Referral</option><option value="event">Event</option><option value="promotion">Promotion</option><option value="resource">Resource</option>
              </select>
            </div>
            <Field label="Description" value={link.description || ''} onChange={(value) => update(link.id, { description: value })} placeholder="Optional public tooltip" />
            <Field label="Starts at" type="datetime-local" value={link.startsAt || ''} onChange={(value) => update(link.id, { startsAt: value })} />
            <Field label="Ends at" type="datetime-local" value={link.endsAt || ''} onChange={(value) => update(link.id, { endsAt: value })} />
            <label className="flex min-h-10 items-center gap-2 self-end rounded border border-line bg-bg-700 px-3 text-xs text-ink-muted">
              <input type="checkbox" checked={link.enabled} onChange={(event) => update(link.id, { enabled: event.target.checked })} className="accent-brand" /> Visible on website
            </label>
            <Button variant="secondary" className="self-end" icon={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => setDraft(links.filter((item) => item.id !== link.id))}>Remove</Button>
          </div>
        </div>
      )}

      {!links.length && <div className="rounded-md border border-dashed border-line bg-bg-600 p-10 text-center text-xs text-ink-dim">No public links configured. Add Instagram, Facebook, WhatsApp, referrals, events or promotions.</div>}
    </div>);

}

function Label({ children }: {children: ReactNode;}) {
  return <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-ink-muted">{children}</label>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {label: string;value: string;onChange: (value: string) => void;placeholder?: string;type?: string;}) {
  return <div><Label>{label}</Label><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-sm outline-none focus:border-brand" /></div>;
}