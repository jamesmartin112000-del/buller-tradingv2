import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckIcon,
  XIcon,
  Loader2Icon,
  SearchIcon,
  CreditCardIcon,
  RefreshCwIcon,
  WalletIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  ImageIcon,
  ExternalLinkIcon } from
'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  cacheLocalRecord,
  db,
  uid as genId,
  removeLocalRecord,
  subscribe,
  type PaymentProof,
  type WalletAddress } from
'../../lib/db/store';
import {
  deleteWalletAddress,
  saveWalletAddress } from
'../../lib/admin/walletManagement';
import { fsSubscribe } from '../../lib/backend/docStore';
import {
  listPayments,
  approvePayment,
  rejectPayment } from
'../../lib/payments/paymentService';
const TABS = ['pending', 'verified', 'rejected', 'all'] as const;
type Tab = (typeof TABS)[number];
const statusStyle: Record<string, string> = {
  pending: 'bg-warn/15 text-warn border-warn/30',
  verified: 'bg-buy/15 text-buy border-buy/30',
  rejected: 'bg-sell/15 text-sell border-sell/30'
};
// Loose store access — walletAddresses is a runtime collection keyed by name.
const store = db as any;
const NETWORK_PRESETS = ['USDT • TRC20', 'USDT • BEP20', 'USDT • ERC20'];
/**
 * Admin Payments — ONE unified, Firestore-backed review screen.
 *
 * Reads the same `paymentProofs` collection the user submission flow writes
 * to (via lib/payments/paymentService). The dead Supabase "legacy payment
 * records" section has been removed — Supabase is gone and it always errored.
 */
export function AdminPayments() {
  const { user } = useAuth();
  return (
    <div className="w-full min-h-screen bg-bg-800 p-4 md:p-6">
      <header className="flex items-center gap-2 mb-5">
        <CreditCardIcon className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-bold text-ink">Payment Management</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WalletManager />
        </div>
        <div className="lg:col-span-2">
          <PaymentReview adminId={user?.uid} />
        </div>
      </div>
    </div>);

}
// ---------- Crypto wallet manager ----------
function WalletManager() {
  const [wallets, setWallets] = useState<WalletAddress[]>([]);
  const [network, setNetwork] = useState(NETWORK_PRESETS[0]);
  const [address, setAddress] = useState('');
  const [editingWallet, setEditingWallet] = useState<WalletAddress | null>(null);
  const [savingWallet, setSavingWallet] = useState(false);
  const refresh = useCallback(() => {
    setWallets(store.list('walletAddresses') as WalletAddress[] || []);
  }, []);
  useEffect(() => {
    refresh();
    const unsubLocal = subscribe('walletAddresses' as any, refresh);
    const unsubCloud = fsSubscribe<WalletAddress>(
      'wallet_addresses',
      (rows) => {
        rows.forEach((wallet) => cacheLocalRecord('walletAddresses', wallet));
        setWallets(
          [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        );
      },
      [],
      (error) => console.warn('[admin-payments] Wallet list unavailable', error)
    );
    return () => {
      unsubLocal();
      unsubCloud();
    };
  }, [refresh]);
  const add = async () => {
    if (!network.trim() || !address.trim()) {
      toast.error('Enter both a network and a wallet address.');
      return;
    }
    setSavingWallet(true);
    try {
      const record: WalletAddress = {
        id: editingWallet?.id || genId('wallet'),
        network: network.trim(),
        address: address.trim(),
        createdAt: editingWallet?.createdAt || Date.now()
      };
      const saved = await saveWalletAddress(record);
      cacheLocalRecord('walletAddresses', saved);
      setAddress('');
      setEditingWallet(null);
      toast.success(editingWallet ? 'Wallet permanently updated' : 'Wallet permanently saved');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wallet could not be saved.');
    } finally {
      setSavingWallet(false);
    }
  };
  const remove = async (id: string) => {
    setSavingWallet(true);
    try {
      await deleteWalletAddress(id);
      removeLocalRecord('walletAddresses', id);
      if (editingWallet?.id === id) {
        setEditingWallet(null);
        setAddress('');
      }
      toast.success('Wallet permanently removed');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wallet could not be removed.');
    } finally {
      setSavingWallet(false);
    }
  };
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <WalletIcon className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-bold text-ink">Crypto Wallets</h2>
        <span className="ml-auto text-2xs text-ink-dim">
          {wallets.length} active
        </span>
      </div>

      {wallets.length === 0 ?
      <p className="text-2xs text-ink-muted">
          No wallets yet. Users see a default placeholder until you add one.
        </p> :

      <ul className="space-y-2">
          {wallets.map((w) =>
        <li
          key={w.id}
          className="flex items-center gap-2 bg-bg-800 border border-line rounded px-3 py-2">
          
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-bold uppercase tracking-wider text-brand">
                  {w.network}
                </p>
                <p className="text-xs font-mono text-ink break-all">
                  {w.address}
                </p>
              </div>
              <button
            type="button"
            onClick={() => {
              setEditingWallet(w);
              setNetwork(w.network);
              setAddress(w.address);
            }}
            disabled={savingWallet}
            className="text-ink-dim hover:text-brand transition-colors shrink-0 disabled:opacity-50"
            aria-label={`Edit ${w.network} wallet`}
            title="Edit wallet">
            
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
            type="button"
            onClick={() => void remove(w.id)}
            disabled={savingWallet}
            className="text-ink-dim hover:text-sell transition-colors shrink-0 disabled:opacity-50"
            aria-label="Remove wallet"
            title="Remove wallet">
            
                <Trash2Icon className="w-4 h-4" />
              </button>
            </li>
        )}
        </ul>
      }

      <div className="border-t border-line pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold block">
            {editingWallet ? 'Edit wallet' : 'Add wallet'}
          </label>
          {editingWallet &&
          <button
            type="button"
            onClick={() => {
              setEditingWallet(null);
              setAddress('');
            }}
            className="ml-auto text-3xs font-semibold text-ink-dim hover:text-ink">
            
              Cancel
            </button>
          }
        </div>
        <div className="flex flex-wrap gap-2">
          {NETWORK_PRESETS.map((n) =>
          <button
            key={n}
            type="button"
            onClick={() => setNetwork(n)}
            className={`px-2.5 py-1 rounded text-2xs font-semibold border transition-colors ${network === n ? 'bg-brand text-bg-900 border-brand' : 'bg-bg-800 text-ink-muted border-line hover:text-ink'}`}>
            
              {n}
            </button>
          )}
        </div>
        <Input
          placeholder="Network (e.g. USDT • TRC20)"
          value={network}
          onChange={(e) => setNetwork(e.target.value)} />
        
        <Input
          placeholder="Wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)} />
        
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          disabled={savingWallet}
          onClick={() => void add()}
          icon={
          savingWallet ?
          <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

          <PlusIcon className="w-3.5 h-3.5" />

          }>
          
          {editingWallet ? 'Update wallet' : 'Add wallet'}
        </Button>
      </div>
    </Card>);

}
// ---------- Unified payment review ----------
function PaymentReview({ adminId }: {adminId?: string;}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PaymentProof[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setRows(listPayments('all'));
  }, []);
  // Live: re-read whenever the Firestore-synced paymentProofs collection
  // changes (same tab, other tab, or another device via Firestore sync).
  useEffect(() => {
    refresh();
    const unsub = subscribe('paymentProofs', refresh);
    return unsub;
  }, [refresh]);
  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === 'pending').length,
      verified: rows.filter((r) => r.status === 'verified').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
      all: rows.length
    }),
    [rows]
  );
  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? rows : rows.filter((r) => r.status === tab);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(
      (r) =>
      r.email?.toLowerCase().includes(q) ||
      (r.userName || '').toLowerCase().includes(q) ||
      (r.txid || '').toLowerCase().includes(q)
    );
  }, [rows, tab, search]);
  const approve = async (p: PaymentProof) => {
    setBusy(p.id);
    try {
      const res = await approvePayment(p.id, { adminId });
      if (res.ok) toast.success(res.message);else
      toast.error(res.message);
    } catch (err: any) {
      toast.error(err?.message || 'Approve failed');
    } finally {
      setBusy(null);
      refresh();
    }
  };
  const reject = async (p: PaymentProof) => {
    const note = window.prompt(
      'Reason for rejection (sent to the user):',
      'Payment not received / proof unclear'
    );
    if (note === null) return;
    setBusy(p.id);
    try {
      const res = await rejectPayment(p.id, {
        adminId,
        adminNotes: note
      });
      if (res.ok) toast.success(res.message);else
      toast.error(res.message);
    } catch (err: any) {
      toast.error(err?.message || 'Reject failed');
    } finally {
      setBusy(null);
      refresh();
    }
  };
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-bold text-ink">Submitted Payments</h2>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={refresh}
          icon={<RefreshCwIcon className="w-3.5 h-3.5" />}>
          
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) =>
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-brand text-white' : 'bg-bg-600 text-ink-muted hover:text-ink border border-line'}`}>
          
            {t} ({counts[t]})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 bg-bg-700 border border-line rounded-md px-3 py-1.5">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email / name / txid…"
            className="bg-transparent text-sm text-ink placeholder:text-ink-dim outline-none w-44" />
          
        </div>
      </div>

      {filtered.length === 0 ?
      <p className="text-center text-ink-muted text-sm py-10">
          No {tab} payments found.
        </p> :

      <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) =>
        <li
          key={p.id}
          className="bg-bg-800 border border-line rounded-md p-3 flex flex-col gap-2">
          
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {p.userName || p.email}
                  </p>
                  {p.userName &&
              <p className="text-2xs text-ink-muted truncate">
                      {p.email}
                    </p>
              }
                  <p className="text-2xs text-ink-dim">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
              className={`px-2 py-0.5 rounded text-2xs font-bold uppercase border shrink-0 ${statusStyle[p.status] || ''}`}>
              
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <Field label="Plan" value={p.plan} />
                <Field
              label="Amount"
              value={`${p.amount} ${p.currency || 'USDT'}`} />
            
                <Field label="Network" value={p.network || '—'} />
                <Field label="Method" value={p.paymentMethod || 'crypto'} />
                <Field label="WhatsApp" value={p.whatsapp || '—'} />
                <Field
              label="Validity"
              value={
              p.validityDaysGranted ?
              `${p.validityDaysGranted} days` :
              '—'
              } />
            
              </div>

              {p.txid &&
          <p className="text-2xs text-ink-muted break-all">
                  TXID: <span className="font-mono text-ink">{p.txid}</span>
                </p>
          }

              {p.walletAddress &&
          <p className="text-2xs text-ink-muted break-all">
                  Wallet:{' '}
                  <span className="font-mono text-ink">{p.walletAddress}</span>
                </p>
          }

              {p.proofUrl &&
          <a
            href={p.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block rounded border border-line overflow-hidden">
            
                  <img
              src={p.proofUrl}
              alt={`Payment proof from ${p.email}`}
              className="w-full max-h-40 object-contain bg-bg-900" />
            
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-bg-900/80 text-2xs text-ink-muted rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLinkIcon className="w-3 h-3" /> Open
                  </span>
                </a>
          }

              {p.adminNotes &&
          <p className="text-2xs text-ink-muted">
                  Admin note: <span className="text-ink">{p.adminNotes}</span>
                </p>
          }

              {p.status === 'pending' &&
          <div className="flex gap-2 pt-1">
                  <Button
              variant="success"
              size="sm"
              className="flex-1"
              disabled={busy === p.id}
              onClick={() => approve(p)}
              icon={
              busy === p.id ?
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

              <CheckIcon className="w-3.5 h-3.5" />

              }>
              
                    Approve
                  </Button>
                  <Button
              variant="danger"
              size="sm"
              className="flex-1"
              disabled={busy === p.id}
              onClick={() => reject(p)}
              icon={<XIcon className="w-3.5 h-3.5" />}>
              
                    Reject
                  </Button>
                </div>
          }
            </li>
        )}
        </ul>
      }
    </Card>);

}
function Field({ label, value }: {label: string;value: string;}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-ink-dim">{label}</p>
      <p className="text-ink capitalize truncate">{value}</p>
    </div>);

}