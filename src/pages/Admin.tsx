import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  createElement,
  Component } from
'react';
import {
  ShieldIcon,
  UsersIcon,
  KeyRoundIcon,
  MessageCircleIcon,
  FileTextIcon,
  BellIcon,
  TerminalIcon,
  LayoutDashboardIcon,
  CheckIcon,
  XIcon,
  Trash2Icon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  SearchIcon,
  CircleIcon,
  EyeIcon,
  MailIcon,
  MonitorIcon,
  CreditCardIcon,
  IdCardIcon,
  PaperclipIcon,
  Loader2Icon,
  PaletteIcon,
  ImageIcon,
  UploadCloudIcon,
  DownloadIcon,
  LinkIcon,
  ZapIcon } from
'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useEngine } from '../context/EngineContext';
import { useCollection, useContent } from '../lib/db/hooks';
import {
  cacheLocalRecord,
  db,
  uid,
  generateMasterKey,
  getFirestoreSyncStatus,
  removeLocalRecord,
  subscribeFirestoreSyncStatus,
  type FirestoreSyncStatus,
  type DBUser,
  type AccessRequest,
  type ChatMessage,
  type ChatThread,
  type ContentBlock,
  type Notification,
  type Plan,
  persistRecord,
  deletePersistentRecord } from
'../lib/db/store';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ChatAttachment } from '../components/chat/ChatWidget';
import {
  deleteFile,
  uploadChatAttachment,
  uploadFile,
  classifyAttachment } from
'../lib/r2Upload';
import {
  KycReviewTab,
  MasterKeysTab,
  DevicesTab,
  ValidityControl } from
'../components/admin/AdminAccountTabs';
import { AdminPayments } from './admin/AdminPayments';
import { subscribePendingRequests } from '../lib/backend/deviceLockService';
import { DeviceAccessRequests } from '../components/admin/DeviceAccessRequests';
import { exportUsersExcel } from '../lib/admin/exportUsers';
import {
  deleteManagedUser,
  saveManagedUser } from
'../lib/admin/userManagement';
import { grantManagedUserValidity, setManagedUserStatus } from '../lib/admin/accountManagement';
import { validatePassword } from '../lib/backend/auth';
import { ManagedLinksTab } from '../components/admin/ManagedLinksTab';
import { MasterKeyIssueModal } from '../components/admin/MasterKeyIssueModal';
import { durationToHours, formatValidityHours, type ValidityUnit } from '../utils/validity';
type TabId =
'overview' |
'users' |
'demos' |
'requests' |
'kyc' |
'payments' |
'plans' |
'mkeys' |
'devices' |
'chat' |
'content' |
'branding' |
'links' |
'broadcast' |
'logs';
const TABS: {
  id: TabId;
  label: string;
  icon: any;
}[] = [
{
  id: 'overview',
  label: 'Overview',
  icon: LayoutDashboardIcon
},
{
  id: 'users',
  label: 'Users',
  icon: UsersIcon
},
{
  id: 'demos',
  label: 'Free Demo',
  icon: ZapIcon
},
{
  id: 'requests',
  label: 'Access',
  icon: KeyRoundIcon
},
{
  id: 'kyc',
  label: 'KYC Review',
  icon: ShieldIcon
},
{
  id: 'payments',
  label: 'Payments',
  icon: KeyRoundIcon
},
{
  id: 'plans',
  label: 'Plans',
  icon: LayoutDashboardIcon
},
{
  id: 'mkeys',
  label: 'Master Keys',
  icon: KeyRoundIcon
},
{
  id: 'devices',
  label: 'Devices',
  icon: TerminalIcon
},
{
  id: 'chat',
  label: 'Chat Support',
  icon: MessageCircleIcon
},
{
  id: 'content',
  label: 'Content',
  icon: FileTextIcon
},
{
  id: 'branding',
  label: 'Branding',
  icon: PaletteIcon
},
{
  id: 'links',
  label: 'Social & Links',
  icon: LinkIcon
},
{
  id: 'broadcast',
  label: 'Notifications',
  icon: BellIcon
},
{
  id: 'logs',
  label: 'System Logs',
  icon: TerminalIcon
}];

export function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');
  // Counters for tab badges
  const requests = useCollection('accessRequests');
  const threads = useCollection('chatThreads');
  const pendingRequests = requests.filter((r) => r.status === 'pending' && r.requestType !== 'demo').length;
  const pendingDemos = requests.filter((r) => r.status === 'pending' && r.requestType === 'demo').length;
  const openChats = threads.reduce((acc, t) => acc + (t.unreadForAdmin || 0), 0);
  // Live pending device-change requests (Firestore-backed).
  const [pendingDevices, setPendingDevices] = useState(0);
  useEffect(() => {
    const unsub = subscribePendingRequests((rows) =>
    setPendingDevices(rows.length)
    );
    return unsub;
  }, []);
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-bg-600 border border-sell/40 rounded-md p-6 text-center">
          <ShieldIcon className="w-10 h-10 text-sell mx-auto mb-3" />
          <h2 className="text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-ink-muted mt-2">
            This panel is restricted to admin and super-admin accounts. Contact
            the BULLER TRADING administrator for elevated privileges.
          </p>
        </div>
      </div>);

  }
  return (
    <div className="p-3 lg:p-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldIcon className="w-5 h-5 text-brand" />
          <h1 className="text-xl font-bold tracking-tight">Admin Panel</h1>
          <Badge tone="brand" size="sm">
            SUPER ADMIN
          </Badge>
        </div>
        <div className="text-2xs text-ink-dim uppercase tracking-wider font-mono">
          {user.email}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const badge =
          t.id === 'demos' && pendingDemos > 0 ?
          pendingDemos :
          t.id === 'requests' && pendingRequests > 0 ?
          pendingRequests :
          t.id === 'chat' && openChats > 0 ?
          openChats :
          t.id === 'devices' && pendingDevices > 0 ?
          pendingDevices :
          null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-t-md text-xs font-semibold transition-colors border-b-2 -mb-px ${active ? 'text-brand border-brand bg-brand/5' : 'text-ink-muted border-transparent hover:text-ink hover:bg-bg-700'}`}>
              
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {badge !== null &&
              <span className="bg-sell text-white text-2xs px-1.5 rounded-full min-w-[18px] text-center">
                  {badge}
                </span>
              }
            </button>);

        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{
            opacity: 0,
            y: 6
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -6
          }}
          transition={{
            duration: 0.15
          }}>
          
          {tab === 'overview' && <OverviewTab />}
          {tab === 'users' && <UsersTab adminEmail={user.email} />}
          {tab === 'demos' && <RequestsTab adminEmail={user.email} requestType="demo" />}
          {tab === 'requests' && <RequestsTab adminEmail={user.email} requestType="access" />}
          {tab === 'kyc' && <KycReviewTab adminEmail={user.email} />}
          {tab === 'payments' && <AdminPayments />}
          {tab === 'plans' && <PlansTab adminEmail={user.email} />}
          {tab === 'mkeys' && <MasterKeysTab adminEmail={user.email} />}
          {tab === 'devices' && <DevicesTab />}
          {tab === 'chat' && <ChatSupportTab adminName={user.name} />}
          {tab === 'content' && <ContentTab adminEmail={user.email} />}
          {tab === 'branding' && <BrandingTab adminEmail={user.email} />}
          {tab === 'links' && <ManagedLinksTab adminEmail={user.email} />}
          {tab === 'broadcast' && <BroadcastTab />}
          {tab === 'logs' && <LogsTab />}
        </motion.div>
      </AnimatePresence>
    </div>);

}
// ============================================================
// OVERVIEW
// ============================================================
function OverviewTab() {
  const users = useCollection('users');
  const requests = useCollection('accessRequests');
  const threads = useCollection('chatThreads');
  const notifs = useCollection('notifications');
  const logs = useCollection('logs');
  const payments = useCollection('paymentProofs');
  const masterKeys = useCollection('masterKeys');
  const devices = useCollection('devices');
  const eng = useEngine();
  const [q, setQ] = useState('');
  const [dbStatus, setDbStatus] = useState<FirestoreSyncStatus>(
    getFirestoreSyncStatus()
  );
  useEffect(() => subscribeFirestoreSyncStatus(setDbStatus), []);
  const pending = requests.filter((r) => r.status === 'pending').length;
  const unread = notifs.filter((n) => n.target === 'admin' && !n.read).length;
  const stats = [
  {
    label: 'Total Users',
    value: users.length,
    tone: 'brand' as const
  },
  {
    label: 'Pending Requests',
    value: pending,
    tone: pending > 0 ? 'amber' as const : 'neutral' as const
  },
  {
    label: 'Open Chats',
    value: threads.filter((t) => t.status === 'open').length,
    tone: 'blue' as const
  },
  {
    label: 'Unread Alerts',
    value: unread,
    tone: 'red' as const
  }];

  // Global search across all collections
  const needle = q.trim().toLowerCase();
  const searchResults = needle ?
  {
    users: users.
    filter(
      (u) =>
      u.email.toLowerCase().includes(needle) ||
      u.name.toLowerCase().includes(needle)
    ).
    slice(0, 5),
    requests: requests.
    filter(
      (r) =>
      r.email.toLowerCase().includes(needle) ||
      r.name.toLowerCase().includes(needle) ||
      (r.whatsapp || '').toLowerCase().includes(needle)
    ).
    slice(0, 5),
    payments: payments.
    filter(
      (p) =>
      (p.email || '').toLowerCase().includes(needle) ||
      (p.userName || '').toLowerCase().includes(needle) ||
      (p.txid || '').toLowerCase().includes(needle)
    ).
    slice(0, 5),
    keys: masterKeys.
    filter(
      (k) =>
      k.email.toLowerCase().includes(needle) ||
      k.key.toLowerCase().includes(needle)
    ).
    slice(0, 5),
    devices: devices.
    filter(
      (d) =>
      d.userEmail.toLowerCase().includes(needle) ||
      d.deviceId.toLowerCase().includes(needle) ||
      (d.label || '').toLowerCase().includes(needle)
    ).
    slice(0, 5),
    chats: threads.
    filter(
      (t) =>
      t.userEmail.toLowerCase().includes(needle) ||
      t.userName.toLowerCase().includes(needle) ||
      (t.lastMessage || '').toLowerCase().includes(needle)
    ).
    slice(0, 5)
  } :
  null;
  const totalHits = searchResults ?
  searchResults.users.length +
  searchResults.requests.length +
  searchResults.payments.length +
  searchResults.keys.length +
  searchResults.devices.length +
  searchResults.chats.length :
  0;
  return (
    <div className="space-y-4">
      {/* Firebase connection status */}
      <div className={`flex flex-wrap items-center gap-2 bg-bg-600 border rounded-md px-3 py-2 ${dbStatus === 'error' ? 'border-sell/40' : 'border-buy/30'}`}>
        <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-buy animate-pulse' : dbStatus === 'connecting' ? 'bg-warn animate-pulse' : 'bg-sell'}`} />
        <span className="text-xs font-semibold">
          {dbStatus === 'connected' ?
          'Firebase Connected' :
          dbStatus === 'connecting' ?
          'Connecting to Firebase…' :
          'Firebase Sync Error'}
        </span>
        <span className="text-2xs text-ink-dim sm:ml-auto font-mono uppercase tracking-wider">
          {dbStatus === 'connected' ?
          'Authenticated realtime admin data' :
          'Refresh or check Firebase rules'}
        </span>
      </div>

      {/* Global search */}
      <div className="bg-bg-600 border border-line rounded-md p-3">
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-2 focus-within:border-brand">
          <SearchIcon className="w-4 h-4 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Global search — users, requests, payments, keys, devices, chats…"
            className="bg-transparent text-sm outline-none flex-1" />
          
          {q &&
          <button
            onClick={() => setQ('')}
            className="text-ink-dim hover:text-ink text-xs"
            title="Clear">
            
              <XIcon className="w-3.5 h-3.5" />
            </button>
          }
        </div>
        {searchResults &&
        <div className="mt-3 space-y-3 max-h-[420px] overflow-y-auto">
            {totalHits === 0 &&
          <div className="text-center text-xs text-ink-dim py-4">
                No matches across users, requests, payments, keys, devices, or
                chats.
              </div>
          }
            {searchResults.users.length > 0 &&
          <SearchGroup label={`Users (${searchResults.users.length})`}>
                {searchResults.users.map((u) =>
            <SearchHit
              key={u.id}
              title={u.name}
              sub={`${u.email} · ${u.role} · ${u.status}`} />

            )}
              </SearchGroup>
          }
            {searchResults.requests.length > 0 &&
          <SearchGroup
            label={`Access Requests (${searchResults.requests.length})`}>
            
                {searchResults.requests.map((r) =>
            <SearchHit
              key={r.id}
              title={r.name}
              sub={`${r.email} · ${r.status}${r.whatsapp ? ' · ' + r.whatsapp : ''}`} />

            )}
              </SearchGroup>
          }
            {searchResults.payments.length > 0 &&
          <SearchGroup
            label={`Payments (${searchResults.payments.length})`}>
            
                {searchResults.payments.map((p) =>
            <SearchHit
              key={p.id}
              title={`${p.userName || p.email} · ${p.amount || ''} ${p.currency || 'USDT'}`}
              sub={`${p.email} · TX ${p.txid || '—'} · ${p.status}`} />

            )}
              </SearchGroup>
          }
            {searchResults.keys.length > 0 &&
          <SearchGroup label={`Master Keys (${searchResults.keys.length})`}>
                {searchResults.keys.map((k) =>
            <SearchHit
              key={k.id}
              title={k.key}
              sub={`${k.email} · ${k.validityDays}d${k.used ? ' · used' : ''}`} />

            )}
              </SearchGroup>
          }
            {searchResults.devices.length > 0 &&
          <SearchGroup label={`Devices (${searchResults.devices.length})`}>
                {searchResults.devices.map((d) =>
            <SearchHit
              key={d.id}
              title={d.userEmail}
              sub={`${d.label || 'Device'} · ${d.status} · ${d.deviceId.slice(0, 24)}…`} />

            )}
              </SearchGroup>
          }
            {searchResults.chats.length > 0 &&
          <SearchGroup
            label={`Chat Threads (${searchResults.chats.length})`}>
            
                {searchResults.chats.map((t) =>
            <SearchHit
              key={t.id}
              title={t.userName}
              sub={`${t.userEmail} · ${t.lastMessage || '(empty)'}`} />

            )}
              </SearchGroup>
          }
          </div>
        }
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) =>
        <div
          key={s.label}
          className="bg-bg-600 border border-line rounded-md p-4">
          
            <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
              {s.label}
            </div>
            <div className="text-3xl font-extrabold font-mono">{s.value}</div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* API health */}
        <div className="bg-bg-600 border border-line rounded-md p-4">
          <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3">
            Market Data Sources
          </div>
          <div className="space-y-2">
            {(['gold', 'forex', 'crypto'] as const).map((k) => {
              const s = eng.apiStatus[k];
              const dot =
              s === 'ok' ? 'bg-buy' : s === 'err' ? 'bg-sell' : 'bg-warn';
              const last = eng.apiLastOk[k];
              return (
                <div
                  key={k}
                  className="flex items-center justify-between bg-bg-700 border border-line rounded p-2.5">
                  
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${dot} ${s === 'ok' ? 'dot-pulse' : ''}`} />
                    
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {k}
                    </span>
                  </div>
                  <div className="text-2xs text-ink-dim font-mono">
                    {last ?
                    `OK ${Math.round((Date.now() - last) / 1000)}s ago` :
                    'awaiting'}
                  </div>
                </div>);

            })}
          </div>
        </div>

        {/* Recent logs */}
        <div className="bg-bg-600 border border-line rounded-md p-4">
          <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3">
            Recent System Activity
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-2xs">
            {logs.slice(0, 8).map((l) =>
            <div key={l.id} className="flex gap-2 items-start">
                <span className="text-ink-dim shrink-0">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
                <span
                className={`shrink-0 uppercase tracking-wider ${l.level === 'error' ? 'text-sell' : l.level === 'warn' ? 'text-warn' : 'text-buy'}`}>
                
                  {l.level}
                </span>
                <span className="text-ink-muted truncate">{l.message}</span>
              </div>
            )}
            {logs.length === 0 &&
            <div className="text-ink-dim italic">No activity yet.</div>
            }
          </div>
        </div>
      </div>
    </div>);

}
function SearchGroup({
  label,
  children



}: {label: string;children: React.ReactNode;}) {
  return (
    <div>
      <div className="text-3xs uppercase tracking-wider text-ink-muted font-bold mb-1.5">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>);

}
function SearchHit({ title, sub }: {title: string;sub: string;}) {
  return (
    <div className="bg-bg-700 border border-line rounded px-3 py-2">
      <div className="text-xs font-semibold truncate">{title}</div>
      <div className="text-3xs text-ink-dim font-mono truncate">{sub}</div>
    </div>);

}
// ============================================================
// USERS
// ============================================================
function UsersTab({ adminEmail }: {adminEmail: string;}) {
  const users = useCollection('users');
  const payments = useCollection('paymentProofs');
  const devices = useCollection('devices');
  const keys = useCollection('masterKeys');
  const requests = useCollection('accessRequests');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DBUser | null>(null);
  const [validityFor, setValidityFor] = useState<DBUser | null>(null);
  const [keyFor, setKeyFor] = useState<DBUser | null>(null);
  const [viewing, setViewing] = useState<DBUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const downloadUsers = async () => {
    setExporting(true);
    try {
      await exportUsersExcel({ users, payments, devices, keys, requests });
      toast.success('User Excel workbook downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Excel export failed');
    } finally {
      setExporting(false);
    }
  };
  const filtered = users.filter(
    (u) =>
    !q ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    u.name.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex flex-wrap items-center gap-2">
        <div className="basis-full sm:basis-auto sm:flex-1 flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users…"
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={
          exporting ?
          <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

          <DownloadIcon className="w-3.5 h-3.5" />

          }
          disabled={exporting || users.length === 0}
          onClick={() => void downloadUsers()}>
          
          <span className="hidden sm:inline">Export Excel</span>
          <span className="sm:hidden">Excel</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<PlusIcon className="w-3.5 h-3.5" />}
          onClick={() => setAddOpen(true)}>
          
          <span className="hidden sm:inline">Add user</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-bg-700">
            <tr className="text-2xs uppercase tracking-wider text-ink-muted">
              <th className="text-left p-3 font-semibold">User</th>
              <th className="text-left p-3 font-semibold">Email</th>
              <th className="text-left p-3 font-semibold">Role</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Last Seen</th>
              <th className="text-right p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) =>
            <tr
              key={u.id}
              onClick={() => setViewing(u)}
              className="border-t border-line hover:bg-bg-700/50 cursor-pointer">
              
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-purple-trade flex items-center justify-center text-white text-2xs font-bold uppercase">
                      {u.name[0]}
                    </div>
                    <span className="font-semibold">{u.name}</span>
                  </div>
                </td>
                <td className="p-3 font-mono text-ink-muted">{u.email}</td>
                <td className="p-3">
                  <Badge
                  tone={
                  u.role === 'admin' || u.role === 'super_admin' ?
                  'brand' :
                  'neutral'
                  }>
                  
                    {u.role}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge
                  tone={
                  u.status === 'active' ?
                  'green' :
                  u.status === 'banned' ?
                  'red' :
                  u.status === 'locked' ?
                  'red' :
                  'amber'
                  }>
                  
                    {u.status}
                  </Badge>
                </td>
                <td className="p-3 text-ink-dim font-mono">
                  {new Date(u.lastSeen).toLocaleDateString()}
                </td>
                <td
                className="p-3 text-right space-x-1"
                onClick={(e) => e.stopPropagation()}>
                
                  <button
                  onClick={() => setViewing(u)}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-brand"
                  title="View full profile">
                  
                    <EyeIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                  onClick={() => setKeyFor(u)}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-purple-trade"
                  title="Generate master key with validity">
                  
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                  onClick={() => setValidityFor(u)}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-buy"
                  title="Set validity">
                  
                    <KeyRoundIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                  onClick={() => setEditing(u)}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-brand disabled:opacity-40"
                  title={u.role === 'super_admin' ? 'Super admin is protected' : 'Edit'}
                  disabled={u.role === 'super_admin'}>
                  
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                  onClick={async () => {
                    const unbanning = u.status === 'banned';
                    try {
                      const updated = await setManagedUserStatus(
                        u.id,
                        unbanning ? 'active' : 'banned'
                      );
                      cacheLocalRecord('users', updated);
                      db.log(
                        'info',
                        'users',
                        `${u.email} ${unbanning ? 'unbanned' : 'banned'}`
                      );
                      toast.success(
                        unbanning ?
                        `Unbanned ${u.email} — warnings cleared` :
                        `Banned ${u.email}`
                      );
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Status update failed');
                    }
                  }}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-warn"
                  title={u.status === 'banned' ? 'Unban' : 'Ban'}>
                  
                    <ShieldIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                  onClick={async () => {
                    if (!confirm(`Remove ${u.email} from the workspace? Their Firebase Auth identity will remain blocked from access.`)) return;
                    try {
                      await deleteManagedUser(u);
                      removeLocalRecord('users', u.id);
                      db.log('warn', 'users', `Removed workspace access for ${u.email}`);
                      toast.success(`Removed workspace access for ${u.email}`);
                    } catch (error) {
                      toast.error(
                        error instanceof Error ?
                        error.message :
                        'Could not delete user'
                      );
                    }
                  }}
                  className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-sell disabled:opacity-40"
                  title="Delete"
                  disabled={u.role === 'super_admin'}>
                  
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )}
            {filtered.length === 0 &&
            <tr>
                <td
                colSpan={6}
                className="p-8 text-center text-ink-dim text-xs">
                
                  No users match your search.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {addOpen && <UserFormModal onClose={() => setAddOpen(false)} />}
        {editing &&
        <UserFormModal user={editing} onClose={() => setEditing(null)} />
        }
        {validityFor &&
        <Modal title={`Validity · ${validityFor.email}`} onClose={() => setValidityFor(null)}>
            <ValidityControl user={validityFor} adminEmail={adminEmail} />
            <div className="flex justify-end mt-4"><Button variant="secondary" onClick={() => setValidityFor(null)}>Close</Button></div>
          </Modal>
        }
        {keyFor && <MasterKeyIssueModal email={keyFor.email} adminEmail={adminEmail} onClose={() => setKeyFor(null)} />}
        {viewing &&
        <UserProfileDrawer
          user={viewing}
          adminEmail={adminEmail}
          onIssueKey={() => {
            setKeyFor(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)} />

        }
      </AnimatePresence>
    </div>);

}
/**
 * Approve a user's pending device + reset the warning counter.
 *
 * Used whenever an admin "activates" a user (Users table unban, edit modal,
 * profile drawer). The DEVICE WARNING screen is driven by the devices
 * collection, NOT user status — so activating a user without flipping the
 * device record to 'allowed' left the user stuck on the warning screen.
 *
 * Picks the latest pending request ('requested' / 'unlock_request'); falls
 * back to the latest 'warned' / 'denied' record (the device that triggered
 * the warning). Enforces single-device policy unless maxDevices > 1.
 */
function clearDeviceLockFor(u: DBUser, adminEmail: string) {
  const userDevices = db.
  list('devices').
  filter((d) => d.userEmail === u.email).
  sort((a, b) => a.createdAt - b.createdAt);
  const pending = userDevices.filter(
    (d) => d.status === 'requested' || d.status === 'unlock_request'
  );
  const fallback = userDevices.filter(
    (d) => d.status === 'warned' || d.status === 'denied'
  );
  const toApprove =
  pending.length > 0 ?
  pending[pending.length - 1] :
  fallback.length > 0 ?
  fallback[fallback.length - 1] :
  null;
  if (!toApprove) {
    // Nothing to approve — still reset the warning counter.
    db.update('users', u.id, {
      deviceWarnings: 0
    });
    return;
  }
  const maxDevices = u.maxDevices || 1;
  if (maxDevices <= 1) {
    userDevices.
    filter(
      (d) => d.status === 'allowed' && d.deviceId !== toApprove.deviceId
    ).
    forEach((d) => db.remove('devices', d.id));
  }
  userDevices.
  filter((d) => d.deviceId === toApprove.deviceId && d.status !== 'allowed').
  forEach((d) =>
  db.update('devices', d.id, {
    status: 'allowed'
  })
  );
  db.update('users', u.id, {
    deviceWarnings: 0,
    activeDevices: 1,
    primaryDeviceId: toApprove.deviceId
  });
  db.insert('notifications', {
    id: uid('nt'),
    target: 'user',
    targetEmail: u.email,
    title: 'Device approved — account active',
    body: 'Aap ki device approve ho gayi hai. Ab aap asani se login kar sakte hain. / Your device has been approved. You can now use your account normally.',
    kind: 'success',
    read: false,
    createdAt: Date.now()
  });
  db.log(
    'info',
    'device',
    `Device ${toApprove.deviceId.slice(0, 16)}… approved for ${u.email} by ${adminEmail} (activate flow)`
  );
}
function UserFormModal({
  user,
  onClose



}: {user?: DBUser;onClose: () => void;}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const normalizedInitialRole = user?.role === 'admin' ? 'admin' : 'user';
  const [role, setRole] = useState<'admin' | 'user'>(normalizedInitialRole);
  const [status, setStatus] = useState<DBUser['status']>(user?.status || 'active');
  const [password, setPassword] = useState('');
  const [validityAmount, setValidityAmount] = useState(7);
  const [validityUnit, setValidityUnit] = useState<ValidityUnit>('days');
  const validityHours = durationToHours(validityAmount, validityUnit);
  const [saving, setSaving] = useState(false);
  const onSave = async () => {
    if (!email.trim() || !name.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!user) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.ok) {
        toast.error(passwordCheck.reason || 'Enter a secure password');
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await saveManagedUser({
        id: user?.id,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: user ? undefined : password,
        role,
        status
      });
      let finalUser = saved;
      if (!user && status === 'active') {
        finalUser = await grantManagedUserValidity(saved.id, validityHours, { mode: 'replace' });
      }
      cacheLocalRecord('users', finalUser);
      if (user && status === 'active' && user.status !== 'active') {
        clearDeviceLockFor(user, 'admin');
      }
      if (!user) {
        toast.success('Firebase Auth account and user profile created');
      } else {
        toast.success('User updated');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save user');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={user ? 'Edit user' : 'Add user'} onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)} />
        
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!!user} />
        
        {!user &&
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        }
        {!user && status === 'active' &&
        <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">Initial validity</label>
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <input type="number" min={1} value={validityAmount} onChange={(e) => setValidityAmount(Math.max(1, Number(e.target.value) || 1))} className="min-w-0 bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
              <select value={validityUnit} onChange={(e) => setValidityUnit(e.target.value as ValidityUnit)} className="bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option><option value="months">Months</option>
              </select>
            </div>
            <p className="mt-1 text-2xs text-ink-dim">Expires {formatValidityHours(validityHours)} after account creation.</p>
          </div>
        }
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
              
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
              
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => void onSave()}
          icon={saving ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : undefined}>
          
          {user ? 'Save changes' : 'Create user'}
        </Button>
      </div>
    </Modal>);

}
function UserProfileDrawer({
  user,
  adminEmail,
  onIssueKey,
  onClose





}: {user: DBUser;adminEmail: string;onIssueKey: () => void;onClose: () => void;}) {
  const { sendReset } = useAuth();
  const allUsers = useCollection('users');
  const allPayments = useCollection('paymentProofs');
  const allDevices = useCollection('devices');
  const allKeys = useCollection('masterKeys');
  const allRequests = useCollection('accessRequests');
  // Always re-read the user from the live collection so the drawer
  // reflects status / validity changes the admin just performed.
  const u = useMemo(
    () => allUsers.find((x) => x.id === user.id) || user,
    [allUsers, user]
  );
  const payments = useMemo(
    () =>
    allPayments.
    filter((p) => p.email === u.email).
    sort((a, b) => b.createdAt - a.createdAt),
    [allPayments, u.email]
  );
  const devices = useMemo(
    () =>
    allDevices.
    filter((d) => d.userEmail === u.email).
    sort((a, b) => b.createdAt - a.createdAt),
    [allDevices, u.email]
  );
  const keys = useMemo(
    () =>
    allKeys.
    filter((k) => k.email === u.email).
    sort((a, b) => b.createdAt - a.createdAt),
    [allKeys, u.email]
  );
  const accessReq = useMemo(
    () => allRequests.find((r) => r.email === u.email),
    [allRequests, u.email]
  );
  const now = Date.now();
  const expires = u.validityExpiresAt;
  const validityLabel = expires ?
  expires < now ?
  'EXPIRED' :
  (() => {
    const h = Math.ceil((expires - now) / 3600000);
    return h < 24 ? `${h}h left` : `${Math.ceil(h / 24)}d left`;
  })() :
  'No validity';
  const setStatus = (status: DBUser['status']) => {
    db.update('users', u.id, {
      status
    });
    // When admin ACTIVATES a user, also clear any device lock — otherwise
    // the user keeps seeing the DEVICE WARNING screen even though their
    // account status is 'active' (the warning is driven by the devices
    // collection, not user status).
    if (status === 'active') {
      const userDevices = db.
      list('devices').
      filter((d) => d.userEmail === u.email).
      sort((a, b) => a.createdAt - b.createdAt);
      // Prefer an explicit pending request; fall back to the most recent
      // warned/denied record (the device that triggered the warning).
      const pending = userDevices.filter(
        (d) => d.status === 'requested' || d.status === 'unlock_request'
      );
      const fallback = userDevices.filter(
        (d) => d.status === 'warned' || d.status === 'denied'
      );
      const toApprove =
      pending.length > 0 ?
      pending[pending.length - 1] :
      fallback.length > 0 ?
      fallback[fallback.length - 1] :
      null;
      if (toApprove) {
        const maxDevices = u.maxDevices || 1;
        // Single-device policy: drop old allowed records unless the user
        // is allowed multiple devices.
        if (maxDevices <= 1) {
          userDevices.
          filter(
            (d) =>
            d.status === 'allowed' && d.deviceId !== toApprove.deviceId
          ).
          forEach((d) => db.remove('devices', d.id));
        }
        // Approve the new device + clean up other stale pending records
        // for the same device.
        userDevices.
        filter(
          (d) =>
          d.deviceId === toApprove.deviceId && (
          d.status === 'requested' ||
          d.status === 'unlock_request' ||
          d.status === 'warned' ||
          d.status === 'denied')
        ).
        forEach((d) =>
        db.update('devices', d.id, {
          status: 'allowed'
        })
        );
        db.update('users', u.id, {
          deviceWarnings: 0,
          activeDevices: 1,
          primaryDeviceId: toApprove.deviceId
        });
        db.insert('notifications', {
          id: uid('nt'),
          target: 'user',
          targetEmail: u.email,
          title: 'Device approved — account active',
          body: 'Aap ki device approve ho gayi hai. Ab aap asani se login kar sakte hain. / Your device has been approved. You can now use your account normally.',
          kind: 'success',
          read: false,
          createdAt: Date.now()
        });
        db.log(
          'info',
          'device',
          `Device ${toApprove.deviceId.slice(0, 16)}… approved for ${u.email} via Activate by ${adminEmail}`
        );
      } else {
        // No device records to approve — still reset the warning counter
        // so the user isn't stuck one strike from a ban.
        db.update('users', u.id, {
          deviceWarnings: 0
        });
      }
    }
    db.log(
      'info',
      'users',
      `Set ${u.email} status to ${status} by ${adminEmail}`
    );
    toast.success(
      status === 'active' ?
      `Status changed to active — device approved & warnings cleared` :
      `Status changed to ${status}`
    );
  };
  const approveDevice = (device: (typeof devices)[number]) => {
    const maxDevices = u.maxDevices || 1;
    // Single-device policy: remove other allowed devices unless multi-device.
    if (maxDevices <= 1) {
      allDevices.
      filter(
        (d) =>
        d.userEmail === u.email &&
        d.status === 'allowed' &&
        d.deviceId !== device.deviceId
      ).
      forEach((d) => db.remove('devices', d.id));
    }
    // Flip this device (and any sibling records for the same deviceId) to allowed.
    allDevices.
    filter(
      (d) =>
      d.userEmail === u.email &&
      d.deviceId === device.deviceId &&
      d.status !== 'allowed'
    ).
    forEach((d) =>
    db.update('devices', d.id, {
      status: 'allowed'
    })
    );
    // Reset warnings, bind primary, and re-activate if locked/banned.
    db.update('users', u.id, {
      deviceWarnings: 0,
      activeDevices: 1,
      primaryDeviceId: device.deviceId,
      ...(u.status === 'banned' || u.status === 'locked' ?
      {
        status: 'active' as const
      } :
      {})
    });
    db.insert('notifications', {
      id: uid('nt'),
      target: 'user',
      targetEmail: u.email,
      title: 'Device approved',
      body: 'Aap ki device approve ho gayi hai — ab aap asani se login kar sakte hain. / Your device has been approved. You can now use your account normally.',
      kind: 'success',
      read: false,
      createdAt: Date.now()
    });
    db.log(
      'info',
      'device',
      `Device ${device.deviceId.slice(0, 16)}… approved for ${u.email} by ${adminEmail}`
    );
    toast.success('Device approved — user can log in now');
  };
  const sendPasswordReset = async () => {
    const res = await sendReset(u.email);
    if (res.ok) {
      toast.success(`Password reset email sent to ${u.email}`);
      db.log('info', 'users', `Sent password reset to ${u.email}`);
    } else {
      toast.error(res.error || 'Failed to send reset email');
    }
  };
  const deleteUser = async () => {
    if (!confirm(`Remove ${u.email} from the workspace? Their Firebase Auth identity will remain blocked from access.`)) return;
    try {
      await deleteManagedUser(u);
      db.remove('users', u.id);
      db.log('warn', 'users', `Removed workspace access for ${u.email}`);
      toast.success(`Removed workspace access for ${u.email}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete user');
    }
  };
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
      
      <motion.div
        initial={{
          x: '100%'
        }}
        animate={{
          x: 0
        }}
        exit={{
          x: '100%'
        }}
        transition={{
          type: 'tween',
          duration: 0.2
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-700 border-l border-brand/30 w-full max-w-2xl h-full overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-700 border-b border-line p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-purple-trade flex items-center justify-center text-white text-sm font-bold uppercase">
              {u.name[0]}
            </div>
            <div>
              <div className="font-bold text-sm">{u.name}</div>
              <div className="text-2xs text-ink-muted font-mono">{u.email}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 rounded hover:bg-bg-600">
            
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status row */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2">
              Account Status
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge
                tone={
                u.status === 'active' ?
                'green' :
                u.status === 'banned' || u.status === 'locked' ?
                'red' :
                'amber'
                }>
                
                {u.status}
              </Badge>
              <Badge
                tone={
                u.role === 'admin' || u.role === 'super_admin' ?
                'brand' :
                'neutral'
                }>
                
                {u.role}
              </Badge>
              <Badge
                tone={
                expires && expires < now ?
                'red' :
                expires ?
                'green' :
                'neutral'
                }>
                
                {validityLabel}
              </Badge>
              {u.kycApproved &&
              <Badge tone="green" size="sm">
                  KYC
                </Badge>
              }
              {u.paymentApproved &&
              <Badge tone="green" size="sm">
                  Paid
                </Badge>
              }
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['active', 'pending', 'locked', 'banned'] as const).map((s) =>
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-2.5 py-1 rounded text-2xs uppercase font-bold tracking-wider border transition-colors ${u.status === s ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink hover:border-brand/40'}`}>
                
                  {s}
                </button>
              )}
            </div>
          </div>

          {/* Profile details */}
          <div className="bg-bg-600 border border-line rounded p-3 text-xs space-y-1.5">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2">
              Profile
            </div>
            <ProfileRow label="Name" value={u.name} />
            <ProfileRow label="Email" value={u.email} mono />
            <ProfileRow
              label="WhatsApp"
              value={u.whatsapp || accessReq?.whatsapp || '—'}
              mono />
            
            <ProfileRow label="Username" value={u.username || '—'} mono />
            <ProfileRow label="Country" value={accessReq?.country || '—'} />
            <ProfileRow
              label="Experience"
              value={accessReq?.tradingExperience || '—'} />
            
            <ProfileRow
              label="Market"
              value={accessReq?.preferredMarket || '—'} />
            
            <ProfileRow
              label="Telegram"
              value={accessReq?.telegramUsername || '—'}
              mono />
            
            <ProfileRow
              label="Created"
              value={new Date(u.createdAt).toLocaleString()} />
            
            <ProfileRow
              label="Last seen"
              value={new Date(u.lastSeen).toLocaleString()} />
            
          </div>

          {/* Validity control */}
          <ValidityControl user={u} adminEmail={adminEmail} />

          {/* KYC summary */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2 flex items-center gap-1.5">
              <IdCardIcon className="w-3 h-3" /> KYC
            </div>
            {u.kyc ?
            <div className="text-xs space-y-1">
                <ProfileRow label="Status" value={u.kyc.status} />
                <ProfileRow label="Doc type" value={u.kyc.docType || '—'} />
                <ProfileRow label="Full name" value={u.kyc.fullName || '—'} />
                {u.kyc.submittedAt &&
              <ProfileRow
                label="Submitted"
                value={new Date(u.kyc.submittedAt).toLocaleString()} />

              }
              </div> :

            <div className="text-2xs text-ink-dim">Not submitted yet.</div>
            }
          </div>

          {/* Payments */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2 flex items-center gap-1.5">
              <CreditCardIcon className="w-3 h-3" /> Payment History (
              {payments.length})
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {payments.length === 0 &&
              <div className="text-2xs text-ink-dim">No payments yet.</div>
              }
              {payments.map((p) =>
              <div
                key={p.id}
                className="bg-bg-700 border border-line rounded p-2 text-2xs">
                
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                    tone={
                    p.status === 'verified' ?
                    'green' :
                    p.status === 'rejected' ?
                    'red' :
                    'amber'
                    }
                    size="sm">
                    
                      {p.status}
                    </Badge>
                    <span className="font-bold">{p.amount}</span>
                    <span className="text-ink-muted">{p.network}</span>
                    <span className="text-ink-dim ml-auto">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-mono text-3xs text-ink-dim truncate">
                    TX: {p.txid || '—'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Devices */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2 flex items-center gap-1.5">
              <MonitorIcon className="w-3 h-3" /> Devices ({devices.length}) ·
              Warnings {u.deviceWarnings || 0}/3
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {devices.length === 0 &&
              <div className="text-2xs text-ink-dim">No devices yet.</div>
              }
              {devices.map((d) =>
              <div
                key={d.id}
                className="bg-bg-700 border border-line rounded p-2 text-2xs">
                
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                    tone={
                    d.status === 'allowed' ?
                    'green' :
                    d.status === 'warned' ?
                    'amber' :
                    d.status === 'requested' ||
                    d.status === 'unlock_request' ?
                    'brand' :
                    'red'
                    }
                    size="sm">
                    
                      {d.status}
                    </Badge>
                    {u.primaryDeviceId === d.deviceId &&
                  <Badge tone="brand" size="sm">
                        Primary
                      </Badge>
                  }
                    <span className="text-ink-dim ml-auto">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                    {d.status !== 'allowed' &&
                  <button
                    onClick={() => approveDevice(d)}
                    className="text-buy hover:text-buy/80 font-bold uppercase tracking-wide text-3xs border border-buy/40 rounded px-1.5 py-0.5 hover:bg-buy/10 transition-colors">
                    
                        Approve
                      </button>
                  }
                  </div>
                  <div className="font-mono text-3xs text-ink-dim truncate">
                    {d.deviceId}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Master keys */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2 flex items-center gap-1.5">
              <KeyRoundIcon className="w-3 h-3" /> Master Keys ({keys.length})
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {keys.length === 0 &&
              <div className="text-2xs text-ink-dim">No keys issued.</div>
              }
              {keys.map((k) =>
              <div
                key={k.id}
                className="bg-bg-700 border border-line rounded p-2 text-2xs flex items-center gap-2">
                
                  <code className="font-mono text-brand flex-1 break-all">
                    {k.key}
                  </code>
                  <Badge tone={k.used ? 'green' : 'amber'} size="sm">
                    {k.used ? 'used' : 'unused'}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-bg-600 border border-line rounded p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3">
              Actions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<MailIcon className="w-3.5 h-3.5" />}
                onClick={sendPasswordReset}>
                
                Send password reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<KeyRoundIcon className="w-3.5 h-3.5" />}
                onClick={onIssueKey}>
                
                Generate master key
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2Icon className="w-3.5 h-3.5" />}
                onClick={() => void deleteUser()}>
                
                Delete account
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close drawer
              </Button>
            </div>
            <div className="text-3xs text-ink-dim mt-3 leading-relaxed">
              Password resets are sent via Firebase Authentication. The user
              receives a secure link to choose a new password — the engine never
              sees or stores passwords directly.
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>);

}
function ProfileRow({
  label,
  value,
  mono




}: {label: string;value: string;mono?: boolean;}) {
  return (
    <div className="flex gap-2">
      <div className="text-ink-muted shrink-0 w-24 text-2xs">{label}</div>
      <div
        className={`flex-1 break-all text-2xs ${mono ? 'font-mono' : ''} capitalize`}>
        
        {value}
      </div>
    </div>);

}
// ============================================================
// ACCESS REQUESTS
// ============================================================
function buildWhatsAppMessage(name: string, key: string): string {
  return `Welcome to BULLER TRADING, ${name}.

Your Master Gate Key:
${key}

Use this key to activate your account access.

Thank you.`;
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const raw = String(v ?? '');
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    if (/[",\n]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"';
    return safe;
  };
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RequestsTab({ adminEmail, requestType }: {adminEmail: string;requestType: 'access' | 'demo';}) {
  const allRequests = useCollection('accessRequests');
  const requests = allRequests.filter((request) =>
  requestType === 'demo' ? request.requestType === 'demo' : request.requestType !== 'demo'
  );
  const [filter, setFilter] = useState<'all' | AccessRequest['status']>('all');
  const [q, setQ] = useState('');
  const [acting, setActing] = useState<{
    req: AccessRequest;
    decision: 'approved' | 'denied';
  } | null>(null);
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const denied = requests.filter((r) => r.status === 'denied').length;
    const keySent = requests.filter((r) => r.keySent).length;
    return {
      total,
      pending,
      approved,
      denied,
      keySent
    };
  }, [requests]);
  const filtered = requests.
  filter((r) => filter === 'all' || r.status === filter).
  filter((r) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(needle) ||
      (r.email || '').toLowerCase().includes(needle) ||
      (r.whatsapp || '').toLowerCase().includes(needle) ||
      (r.country || '').toLowerCase().includes(needle) ||
      (r.referralCode || '').toLowerCase().includes(needle) ||
      (r.masterGateKey || '').toLowerCase().includes(needle));

  });
  const decide = (
  req: AccessRequest,
  decision: 'approved' | 'denied',
  note: string) =>
  {
    if (req.requestType === 'demo') {
      db.update('accessRequests', req.id, {
        status: decision,
        decidedAt: Date.now(),
        decidedBy: adminEmail,
        approvedBy: decision === 'approved' ? adminEmail : undefined,
        adminNote: note || undefined
      });
      db.log('info', 'demo', `${decision} Free Demo request for ${req.email}`);
      toast.success(`Demo request ${decision}`);
      setActing(null);
      return;
    }
    if (decision === 'approved') {
      // Auto-generate Master Gate Key
      const key = generateMasterKey();
      db.update('accessRequests', req.id, {
        status: 'approved',
        decidedAt: Date.now(),
        decidedBy: adminEmail,
        approvedBy: adminEmail,
        adminNote: note || undefined,
        masterGateKey: key,
        keySent: false
      });
      // Record key in masterKeys collection
      db.insert('masterKeys', {
        id: uid('mk'),
        key,
        email: req.email,
        validityDays: 30,
        used: false,
        createdAt: Date.now(),
        createdBy: adminEmail
      });
      // Update the user doc if they've already signed up; do NOT create
      // a ghost record. The Firebase UID-keyed users/{uid} doc will be
      // created by ensureUserDoc() the first time the approved user
      // signs in. The Master Gate Key is the link until then — it's
      // stored in the masterKeys collection above (keyed by email).
      const existing = db.list('users').find((u) => u.email === req.email);
      if (existing) {
        db.update('users', existing.id, {
          gateKey: key,
          status: 'active'
        });
      }
      db.insert('notifications', {
        id: uid('nt'),
        target: 'user',
        targetEmail: req.email,
        title: 'Access approved — key sent',
        body: `Hello ${req.name}, your access has been approved. Your Master Gate Key has been issued and will be delivered to your WhatsApp shortly.`,
        kind: 'success',
        read: false,
        createdAt: Date.now(),
        link: '/login'
      });
      db.log('info', 'access', `Approved ${req.email} · key ${key}`);
      toast.success(`Approved ${req.email} — key generated`);
    } else {
      db.update('accessRequests', req.id, {
        status: 'denied',
        decidedAt: Date.now(),
        decidedBy: adminEmail,
        adminNote: note || undefined
      });
      db.insert('notifications', {
        id: uid('nt'),
        target: 'user',
        targetEmail: req.email,
        title: 'Access request update',
        body: `Hello ${req.name}, after review your access request was not approved at this time. ${note ? 'Reason: ' + note : 'You may re-apply after 30 days.'}`,
        kind: 'access_request',
        read: false,
        createdAt: Date.now()
      });
      db.log('info', 'access', `Denied access for ${req.email}`);
      toast.success(`Denied ${req.email}`);
    }
    setActing(null);
  };
  const markKeySent = (req: AccessRequest) => {
    db.update('accessRequests', req.id, {
      keySent: true,
      keySentAt: Date.now()
    });
    db.log('info', 'access', `Marked key as sent for ${req.email}`);
    toast.success('Marked as sent');
  };
  const sendWhatsApp = (req: AccessRequest) => {
    if (!req.masterGateKey || !req.whatsapp) {
      toast.error('Missing WhatsApp number or master key');
      return;
    }
    const digits = req.whatsapp.replace(/[^\d]/g, '');
    const message = buildWhatsAppMessage(req.name, req.masterGateKey);
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!req.keySent) markKeySent(req);
  };
  const copyWhatsAppMessage = (req: AccessRequest) => {
    if (!req.masterGateKey) return;
    const message = buildWhatsAppMessage(req.name, req.masterGateKey);
    navigator.clipboard.writeText(message).then(
      () => toast.success('WhatsApp message copied'),
      () => toast.error('Copy failed')
    );
  };
  const exportCsv = () => {
    const header = [
    'Full Name',
    'Email',
    'WhatsApp',
    'Country',
    'Trading Experience',
    'Preferred Market',
    'Telegram',
    'Referral Code',
    'Status',
    'Master Key',
    'Key Sent',
    'Request Date',
    'Approval Date',
    'Approved By'];

    const rows = [...requests].
    sort((a, b) => b.createdAt - a.createdAt).
    map((r) => [
    r.name,
    r.email,
    r.whatsapp || '',
    r.country || '',
    r.tradingExperience || '',
    r.preferredMarket || '',
    r.telegramUsername || '',
    r.referralCode || '',
    r.status,
    r.masterGateKey || '',
    r.keySent ? 'Yes' : 'No',
    new Date(r.createdAt).toISOString(),
    r.decidedAt ? new Date(r.decidedAt).toISOString() : '',
    r.approvedBy || r.decidedBy || '']
    );
    downloadCsv(
      `access-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows]
    );
    toast.success('Excel export downloaded');
  };
  return (
    <div className="space-y-3">
      {/* Device requests remain part of the standard access workflow only. */}
      {requestType === 'access' && <DeviceAccessRequests adminEmail={adminEmail} />}

      {requestType === 'demo' &&
      <div className="rounded-md border border-brand/30 bg-brand/5 p-3 text-xs text-ink-muted">
          Demo approvals only record the review decision. Create the actual Firebase account manually from Users → Add User.
        </div>
      }

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <StatPill label="Total" value={stats.total} tone="neutral" />
        <StatPill label="Pending" value={stats.pending} tone="amber" />
        <StatPill label="Approved" value={stats.approved} tone="green" />
        <StatPill label="Rejected" value={stats.denied} tone="red" />
        <StatPill label="Key Sent" value={stats.keySent} tone="brand" />
      </div>

      <div className="bg-bg-600 border border-line rounded-md">
        <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
            Filter:
          </div>
          {(['all', 'pending', 'approved', 'denied'] as const).map((f) =>
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-2xs uppercase font-bold tracking-wider transition-colors ${filter === f ? 'bg-brand text-white' : 'bg-bg-700 text-ink-muted hover:text-ink border border-line'}`}>
            
              {f}
            </button>
          )}
          <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 flex-1 min-w-[200px] max-w-md">
            <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, WhatsApp, country..."
              className="bg-transparent text-xs outline-none flex-1" />
            
          </div>
          <div className="ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={requests.length === 0}>
              
              Download Excel
            </Button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {filtered.map((r) =>
          <AccessRequestRow
            key={r.id}
            req={r}
            onApprove={() =>
            setActing({
              req: r,
              decision: 'approved'
            })
            }
            onDeny={() =>
            setActing({
              req: r,
              decision: 'denied'
            })
            }
            onSendWhatsApp={() => sendWhatsApp(r)}
            onCopyMessage={() => copyWhatsAppMessage(r)}
            onMarkSent={() => markKeySent(r)} />

          )}
          {filtered.length === 0 &&
          <div className="p-10 text-center text-xs text-ink-dim">
              No {requestType === 'demo' ? 'Free Demo' : 'access'} requests {filter !== 'all' ? `(${filter})` : 'yet'}.
            </div>
          }
        </div>
      </div>

      <AnimatePresence>
        {acting &&
        <DecideRequestModal
          req={acting.req}
          decision={acting.decision}
          onClose={() => setActing(null)}
          onConfirm={(note) => decide(acting.req, acting.decision, note)} />

        }
      </AnimatePresence>
    </div>);

}
function StatPill({
  label,
  value,
  tone




}: {label: string;value: number;tone: 'neutral' | 'amber' | 'green' | 'red' | 'brand';}) {
  const color =
  tone === 'amber' ?
  'text-warn' :
  tone === 'green' ?
  'text-buy' :
  tone === 'red' ?
  'text-sell' :
  tone === 'brand' ?
  'text-brand' :
  'text-ink';
  return (
    <div className="bg-bg-600 border border-line rounded-md p-3">
      <div className="text-3xs uppercase tracking-wider text-ink-muted font-bold mb-1">
        {label}
      </div>
      <div className={`text-2xl font-extrabold font-mono ${color}`}>
        {value}
      </div>
    </div>);

}
function AccessRequestRow({
  req,
  onApprove,
  onDeny,
  onSendWhatsApp,
  onCopyMessage,
  onMarkSent







}: {req: AccessRequest;onApprove: () => void;onDeny: () => void;onSendWhatsApp: () => void;onCopyMessage: () => void;onMarkSent: () => void;}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-purple-trade flex items-center justify-center text-white text-sm font-bold uppercase shrink-0">
          {req.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-sm">{req.name}</span>
            {req.requestType === 'demo' && <Badge tone="brand">Free Demo</Badge>}
            <Badge
              tone={
              req.status === 'approved' ?
              'green' :
              req.status === 'denied' ?
              'red' :
              'amber'
              }>
              
              {req.status}
            </Badge>
            {req.keySent &&
            <Badge tone="brand" size="sm">
                key sent
              </Badge>
            }
            <span className="text-2xs text-ink-dim font-mono ml-auto">
              {new Date(req.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-ink-muted font-mono">{req.email}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 text-xs">
        {req.requestType === 'demo' && <DetailCell label="Full Name" value={req.name || '—'} />}
        {req.requestType === 'demo' && <DetailCell label="Email Address" value={req.email || '—'} mono />}
        <DetailCell
          label="WhatsApp Number"
          value={req.whatsapp || '—'}
          mono
          highlight={!!req.whatsapp} />
        
        {req.requestType === 'demo' && <DetailCell label="Password" value={req.passwordValidated ? 'Securely validated · not stored' : 'Not provided'} highlight={!!req.passwordValidated} />}
        {req.requestType !== 'demo' && <DetailCell label="Country" value={req.country || '—'} />}
        {req.requestType !== 'demo' && <DetailCell
          label="Experience"
          value={req.tradingExperience || '—'}
          capitalize />
        }
        {req.requestType !== 'demo' && <DetailCell
          label="Market"
          value={req.preferredMarket || '—'}
          capitalize />
        }
        {req.telegramUsername &&
        <DetailCell label="Telegram" value={req.telegramUsername} mono />
        }
        {req.referralCode &&
        <DetailCell label="Referral" value={req.referralCode} mono />
        }
      </div>

      {req.masterGateKey &&
      <div className="bg-brand/5 border border-brand/30 rounded p-2.5 mb-3 flex items-center gap-2">
          <KeyRoundIcon className="w-3.5 h-3.5 text-brand shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-3xs uppercase tracking-wider text-ink-muted font-bold">
              Master Gate Key
            </div>
            <div className="font-mono text-sm text-brand font-bold tracking-wider">
              {req.masterGateKey}
            </div>
          </div>
          <button
          onClick={() =>
          navigator.clipboard.
          writeText(req.masterGateKey!).
          then(() => toast.success('Key copied'))
          }
          className="text-2xs uppercase tracking-wider font-bold text-ink-muted hover:text-brand px-2 py-1 rounded hover:bg-bg-700">
          
            Copy
          </button>
        </div>
      }

      {req.adminNote &&
      <div className="text-2xs text-ink-dim mb-2 bg-bg-700 border border-line rounded p-2">
          <span className="uppercase tracking-wider font-bold text-ink-muted">
            Admin note:
          </span>{' '}
          {req.adminNote}
        </div>
      }

      <div className="flex gap-2 flex-wrap">
        {req.status === 'pending' &&
        <>
            <Button
            variant="primary"
            size="sm"
            icon={<CheckIcon className="w-3.5 h-3.5" />}
            onClick={onApprove}>
            
              {req.requestType === 'demo' ? 'Approve Request' : 'Approve & Generate Key'}
            </Button>
            <Button
            variant="secondary"
            size="sm"
            icon={<XIcon className="w-3.5 h-3.5" />}
            onClick={onDeny}>
            
              Reject
            </Button>
          </>
        }
        {req.status === 'approved' && req.masterGateKey &&
        <>
            <Button
            variant="primary"
            size="sm"
            icon={<SendIcon className="w-3.5 h-3.5" />}
            onClick={onSendWhatsApp}>
            
              Send WhatsApp Key
            </Button>
            <Button variant="secondary" size="sm" onClick={onCopyMessage}>
              Copy Message
            </Button>
            {!req.keySent &&
          <Button variant="secondary" size="sm" onClick={onMarkSent}>
                Mark as Sent
              </Button>
          }
          </>
        }
      </div>
    </div>);

}
function DetailCell({
  label,
  value,
  mono = false,
  capitalize = false,
  highlight = false






}: {label: string;value: string;mono?: boolean;capitalize?: boolean;highlight?: boolean;}) {
  return (
    <div
      className={`rounded p-2 border ${highlight ? 'bg-brand/5 border-brand/20' : 'bg-bg-700 border-line'}`}>
      
      <div className="text-3xs uppercase tracking-wider text-ink-muted font-bold mb-0.5">
        {label}
      </div>
      <div
        className={`text-xs text-ink break-words ${mono ? 'font-mono' : ''} ${capitalize ? 'capitalize' : ''}`}>
        
        {value}
      </div>
    </div>);

}
function DecideRequestModal({
  req,
  decision,
  onClose,
  onConfirm





}: {req: AccessRequest;decision: 'approved' | 'denied';onClose: () => void;onConfirm: (note: string) => void;}) {
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`${decision === 'approved' ? 'Approve' : 'Deny'} access request`}
      onClose={onClose}>
      
      <div className="space-y-3">
        <div className="bg-bg-700 border border-line rounded p-3 text-xs">
          <div className="font-semibold">{req.name}</div>
          <div className="text-ink-muted font-mono">{req.email}</div>
        </div>
        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
            Admin note (optional — will be included in the user notification)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
            decision === 'approved' ?
            'Welcome message, onboarding info, credentials hint…' :
            'Reason for denial (visible to the requester)…'
            }
            className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" />
          
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={decision === 'approved' ? 'primary' : 'secondary'}
          onClick={() => onConfirm(note)}>
          
          Confirm {decision === 'approved' ? 'approval' : 'denial'}
        </Button>
      </div>
    </Modal>);

}
// ============================================================
// CHAT SUPPORT
// ============================================================
function ChatSupportTab({ adminName }: {adminName: string;}) {
  const threads = useCollection('chatThreads');
  const allMessages = useCollection('chatMessages');
  const [activeId, setActiveId] = useState<string | null>(
    threads[0]?.id || null
  );
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sorted = useMemo(
    () => [...threads].sort((a, b) => b.lastAt - a.lastAt),
    [threads]
  );
  const visibleThreads = useMemo(() => {
    if (!q.trim()) return sorted;
    const needle = q.trim().toLowerCase();
    return sorted.filter(
      (t) =>
      t.userName.toLowerCase().includes(needle) ||
      t.userEmail.toLowerCase().includes(needle) ||
      (t.lastMessage || '').toLowerCase().includes(needle)
    );
  }, [sorted, q]);
  const messages = useMemo(
    () =>
    activeId ?
    allMessages.
    filter((m) => m.threadId === activeId).
    sort((a, b) => a.createdAt - b.createdAt) :
    [],
    [allMessages, activeId]
  );
  const activeThread = threads.find((t) => t.id === activeId);
  // Mark user messages read when admin opens thread
  useEffect(() => {
    if (!activeId || !activeThread) return;
    if (activeThread.unreadForAdmin === 0) return;
    db.update('chatThreads', activeId, {
      unreadForAdmin: 0
    });
    allMessages.
    filter((m) => m.threadId === activeId && m.from === 'user' && !m.read).
    forEach((m) =>
    db.update('chatMessages', m.id, {
      read: true
    })
    );
    // eslint-disable-next-line
  }, [activeId]);
  const persist = (
  text: string,
  attachment?: {
    url: string;
    type: 'image' | 'video' | 'file';
    name: string;
  }) =>
  {
    if (!activeThread) return;
    const now = Date.now();
    const preview = text || (attachment ? `📎 ${attachment.name}` : '');
    const msg: ChatMessage = {
      id: uid('msg'),
      threadId: activeThread.id,
      from: 'admin',
      authorName: adminName,
      text,
      createdAt: now,
      read: false,
      ...(attachment ?
      {
        attachmentUrl: attachment.url,
        attachmentType: attachment.type,
        attachmentName: attachment.name
      } :
      {})
    };
    db.insert('chatMessages', msg);
    db.update('chatThreads', activeThread.id, {
      lastMessage: preview,
      lastAt: now,
      unreadForUser: (activeThread.unreadForUser || 0) + 1
    });
    db.insert('notifications', {
      id: uid('nt'),
      target: 'user',
      targetEmail: activeThread.userEmail,
      title: 'Support replied',
      body: `${adminName}: ${preview.slice(0, 100)}`,
      kind: 'chat',
      read: false,
      createdAt: now
    });
  };
  const send = () => {
    if (!draft.trim() || !activeThread) return;
    persist(draft.trim());
    setDraft('');
    toast.success('Message sent');
  };
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeThread) return;
    setUploading(true);
    const tId = toast.loading('Uploading attachment…');
    try {
      const res = await uploadChatAttachment(activeThread.userEmail, file, (progress) => {
        toast.loading(`Uploading attachment… ${progress}%`, { id: tId });
      });
      if (!res.ok || !res.url) {
        toast.error(res.error || 'Upload failed', {
          id: tId
        });
        return;
      }
      persist(draft.trim(), {
        url: res.url,
        type: res.kind || classifyAttachment(file),
        name: file.name
      });
      setDraft('');
      toast.success('Attachment sent', {
        id: tId
      });
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="bg-bg-600 border border-line rounded-md grid lg:grid-cols-[280px_1fr] h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
      {/* Thread list */}
      <div className="border-r border-line overflow-y-auto flex flex-col">
        <div className="p-3 border-b border-line text-2xs uppercase tracking-wider text-ink-muted font-bold">
          Conversations ({visibleThreads.length}/{sorted.length})
        </div>
        <div className="p-2 border-b border-line">
          <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-2.5 py-1.5">
            <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search threads..."
              className="bg-transparent text-2xs outline-none flex-1" />
            
          </div>
        </div>
        {visibleThreads.map((t) =>
        <button
          key={t.id}
          onClick={() => setActiveId(t.id)}
          className={`w-full text-left p-3 border-b border-line transition-colors ${activeId === t.id ? 'bg-brand/10' : 'hover:bg-bg-700'}`}>
          
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs truncate">
                {t.userName}
              </span>
              {t.unreadForAdmin > 0 &&
            <span className="bg-sell text-white text-2xs px-1.5 rounded-full min-w-[18px] text-center">
                  {t.unreadForAdmin}
                </span>
            }
            </div>
            <div className="text-2xs text-ink-muted truncate">
              {t.lastMessage}
            </div>
            <div className="text-3xs text-ink-dim font-mono mt-1">
              {new Date(t.lastAt).toLocaleString()}
            </div>
          </button>
        )}
        {visibleThreads.length === 0 &&
        <div className="p-6 text-center text-2xs text-ink-dim">
            {sorted.length === 0 ?
          'No conversations yet. Users will appear here once they message support.' :
          'No conversations match your search.'}
          </div>
        }
      </div>

      {/* Message pane */}
      <div className="flex flex-col min-h-0">
        {activeThread ?
        <>
            <div className="p-3 border-b border-line flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">
                  {activeThread.userName}
                </div>
                <div className="text-2xs text-ink-muted font-mono">
                  {activeThread.userEmail}
                </div>
              </div>
              <button
              onClick={() => {
                db.update('chatThreads', activeThread.id, {
                  status: activeThread.status === 'open' ? 'closed' : 'open'
                });
                toast.success(
                  activeThread.status === 'open' ?
                  'Thread closed' :
                  'Thread reopened'
                );
              }}
              className="text-2xs uppercase tracking-wider font-bold text-ink-muted hover:text-ink">
              
                {activeThread.status === 'open' ? 'Close thread' : 'Reopen'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-900/30">
              {messages.map((m) =>
            <div
              key={m.id}
              className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
              
                  <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${m.from === 'admin' ? 'bg-brand text-white' : 'bg-bg-700 border border-line text-ink'}`}>
                
                    <div className="text-2xs opacity-70 mb-0.5 font-semibold">
                      {m.from === 'admin' ?
                  `${m.authorName} · Support` :
                  m.authorName}
                    </div>
                    {m.attachmentUrl &&
                <ChatAttachment
                  url={m.attachmentUrl}
                  type={m.attachmentType}
                  name={m.attachmentName} />

                }
                    {m.text &&
                <div className="text-xs whitespace-pre-wrap leading-relaxed">
                        {m.text}
                      </div>
                }
                    <div className="text-3xs opacity-60 mt-1 font-mono">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
            )}
              {messages.length === 0 &&
            <div className="text-center text-2xs text-ink-dim italic mt-10">
                  No messages in this thread yet.
                </div>
            }
            </div>

            <div className="p-3 border-t border-line flex items-center gap-2">
              <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              className="hidden"
              onChange={onPickFile} />
            
              <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded text-ink-muted hover:text-brand hover:bg-bg-700 disabled:opacity-40 transition-colors shrink-0"
              aria-label="Attach a file"
              title="Send a picture, video or document">
              
                {uploading ?
              <Loader2Icon className="w-4 h-4 animate-spin" /> :

              <PaperclipIcon className="w-4 h-4" />
              }
              </button>
              <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type a reply…"
              className="flex-1 bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
            
              <Button
              variant="primary"
              onClick={send}
              icon={<SendIcon className="w-3.5 h-3.5" />}>
              
                Send
              </Button>
            </div>
          </> :

        <div className="flex-1 flex items-center justify-center text-xs text-ink-dim">
            Select a conversation to view messages.
          </div>
        }
      </div>
    </div>);

}
// ============================================================
// BRANDING (logo + name) + CHAT WIDGET SETTINGS
// ============================================================
async function setContent(
id: string,
value: string,
adminEmail: string)
: Promise<boolean> {
  const existing = db.get('content', id);
  try {
    await persistRecord('content', {
      ...(existing || { id }),
      id,
      value,
      updatedAt: Date.now(),
      updatedBy: adminEmail
    });
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Setting could not be saved.');
    return false;
  }
}
function BrandingTab({ adminEmail }: {adminEmail: string;}) {
  const logoUrl = useContent(
    'brand.logoUrl', "/LOGO_PNG_FINAL.png"

  );
  const name = useContent('brand.name', 'BULLER TRADING');
  const version = useContent('brand.version', '');
  const subtitle = useContent('brand.subtitle', 'SYED AZHAAD HUSSAIN');
  const initials = useContent('brand.initials', 'BT');
  const logoSize = Math.min(
    160,
    Math.max(24, Number(useContent('brand.logoSize', '48')) || 48)
  );
  const chatPosition = useContent('chat.position', 'bottom-right');
  const chatSize = useContent('chat.size', 'md');
  const chatOffsetX = useContent('chat.offsetX', '20');
  const chatOffsetY = useContent('chat.offsetY', '20');
  // Local editable copies (saved on "Save changes")
  const [n, setN] = useState(name);
  const [v, setV] = useState(version);
  const [sub, setSub] = useState(subtitle);
  const [ini, setIni] = useState(initials);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setN(name);
    setV(version);
    setSub(subtitle);
    setIni(initials);
  }, [name, version, subtitle, initials]);
  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const tId = toast.loading('Uploading logo…');
    try {
      const res = await uploadFile('admin', 'branding', file, (progress) => {
        toast.loading(`Uploading logo… ${progress}%`, { id: tId });
      });
      if (!res.ok || !res.url) {
        toast.error(res.error || 'Upload failed', {
          id: tId
        });
        return;
      }
      if (await setContent('brand.logoUrl', res.url, adminEmail)) {
        if (logoUrl.includes('/uploads/')) void deleteFile(logoUrl);
        db.log('info', 'branding', 'Logo updated');
        toast.success('Logo permanently saved', { id: tId });
      } else {
        toast.error('Logo uploaded, but its setting was not saved.', { id: tId });
      }
    } finally {
      setUploading(false);
    }
  };
  const saveName = async () => {
    const saved = await Promise.all([
    setContent('brand.name', n.trim() || 'BULLER TRADING', adminEmail),
    setContent('brand.version', v.trim(), adminEmail),
    setContent('brand.subtitle', sub.trim(), adminEmail),
    setContent('brand.initials', (ini.trim() || 'BT').slice(0, 3), adminEmail)]
    );
    if (saved.every(Boolean)) {
      db.log('info', 'branding', 'BULLER TRADING brand settings updated');
      toast.success('Branding permanently saved');
    }
  };
  const updateLogoSize = (value: number) => {
    const nextSize = Math.min(160, Math.max(24, Math.round(value)));
    void setContent('brand.logoSize', String(nextSize), adminEmail);
    db.log('info', 'branding', `Global logo size set to ${nextSize}px`);
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Logo + name */}
      <div className="bg-bg-600 border border-line rounded-md p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold">Logo &amp; Brand Name</h3>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3 bg-bg-700 border border-line rounded-md p-3">
          <div className="text-2xs uppercase tracking-wider text-ink-dim w-16 shrink-0">
            Preview
          </div>
          <div className="flex items-center gap-2.5">
            {logoUrl ?
            <img
              src={logoUrl}
              alt="BULLER TRADING logo preview"
              width={logoSize}
              height={logoSize}
              className="shrink-0 object-contain"
              style={{ width: logoSize, height: logoSize }} /> :


            <div
              className="flex shrink-0 items-center justify-center rounded-md border border-brand bg-bg-800 font-extrabold text-brand"
              style={{ width: logoSize, height: logoSize }}>
              
                {ini || 'BT'}
              </div>
            }
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-ink">
                {n || 'BULLER TRADING'}{' '}
                <span className="text-ink-dim font-normal">{v}</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-brand">
                {sub}
              </div>
            </div>
          </div>
        </div>

        {/* Logo upload */}
        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
            Logo image
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={uploadLogo} />
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              icon={
              uploading ?
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

              <UploadCloudIcon className="w-3.5 h-3.5" />

              }
              onClick={() => fileRef.current?.click()}>
              
              {uploading ? 'Uploading…' : 'Upload logo'}
            </Button>
            {logoUrl &&
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (await setContent('brand.logoUrl', '', adminEmail)) {
                  if (logoUrl.includes('/uploads/')) await deleteFile(logoUrl);
                  toast.success('Logo setting permanently removed');
                }
              }}>
              
                Remove
              </Button>
            }
          </div>
          <p className="text-3xs text-ink-dim mt-1.5">
            PNG / JPG / WebP, max 5 MB. Images always use object-contain and are never cropped.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="global-logo-size" className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
              Logo size
            </label>
            <span className="font-mono text-xs text-brand">{logoSize}px</span>
          </div>
          <input
            id="global-logo-size"
            type="range"
            min={24}
            max={160}
            step={1}
            value={logoSize}
            onChange={(event) => updateLogoSize(Number(event.target.value))}
            className="w-full accent-[#e2bf76]"
            aria-valuetext={`${logoSize} pixels`} />
          
          <p className="mt-1.5 text-3xs text-ink-dim">
            Applies globally to logged-in BULLER TRADING views.
          </p>
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Brand name"
            value={n}
            onChange={(e) => setN(e.target.value)} />
          
          <Input
            label="Version label"
            value={v}
            onChange={(e) => setV(e.target.value)} />
          
        </div>
        <Input
          label="Subtitle"
          value={sub}
          onChange={(e) => setSub(e.target.value)} />
        
        <Input
          label="Initials (fallback badge, max 3)"
          value={ini}
          onChange={(e) => setIni(e.target.value)} />
        
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => void saveName()}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Chat widget settings */}
      <div className="bg-bg-600 border border-line rounded-md p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircleIcon className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold">Support Chat Widget</h3>
        </div>
        <p className="text-2xs text-ink-muted leading-relaxed">
          The support chat is always visible to signed-in users on every page.
          Control its on-screen position and size here — changes apply instantly
          across all devices.
        </p>

        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
            Position
          </label>
          <div className="flex gap-2">
            {(
            [
            {
              id: 'bottom-right',
              label: 'Bottom Right'
            },
            {
              id: 'bottom-left',
              label: 'Bottom Left'
            }] as
            const).
            map((p) =>
            <button
              key={p.id}
              onClick={() => void setContent('chat.position', p.id, adminEmail)}
              className={`px-3 py-1.5 text-2xs font-semibold rounded border ${chatPosition === p.id ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink'}`}>
              
                {p.label}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
            Panel size
          </label>
          <div className="flex gap-2">
            {(
            [
            {
              id: 'sm',
              label: 'Small'
            },
            {
              id: 'md',
              label: 'Medium'
            },
            {
              id: 'lg',
              label: 'Large'
            }] as
            const).
            map((p) =>
            <button
              key={p.id}
              onClick={() => void setContent('chat.size', p.id, adminEmail)}
              className={`px-3 py-1.5 text-2xs font-semibold rounded border ${chatSize === p.id ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink'}`}>
              
                {p.label}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
              Horizontal offset (px)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={chatOffsetX}
              onChange={(e) =>
              void setContent('chat.offsetX', e.target.value || '20', adminEmail)
              }
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
            
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
              Vertical offset (px)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={chatOffsetY}
              onChange={(e) =>
              void setContent('chat.offsetY', e.target.value || '20', adminEmail)
              }
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
            
          </div>
        </div>
        <p className="text-3xs text-ink-dim">
          Users can send pictures, videos and documents through the chat — files
          are uploaded securely and delivered to your Chat Support inbox.
        </p>
      </div>
    </div>);

}
// ============================================================
// CONTENT MANAGER
// ============================================================
function ContentTab({ adminEmail }: {adminEmail: string;}) {
  const blocks = useCollection('content');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = blocks.filter((b) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (b.id || '').toLowerCase().includes(needle) ||
      (b.value || '').toLowerCase().includes(needle));

  });
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
        <div className="text-xs text-ink-muted">
          Edit user-facing copy. Changes are live immediately across the site.
        </div>
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 flex-1 min-w-[200px] max-w-md ml-auto">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id or text..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<PlusIcon className="w-3.5 h-3.5" />}
          onClick={() => setAddOpen(true)}>
          
          New block
        </Button>
      </div>
      <div className="divide-y divide-line">
        {filtered.map((b) =>
        <div key={b.id} className="p-4">
            {editingId === b.id ?
          <EditBlock
            block={b}
            adminEmail={adminEmail}
            onDone={() => setEditingId(null)} /> :


          <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-2xs uppercase tracking-wider text-brand mb-1">
                    {b.id}
                  </div>
                  <div className="text-sm text-ink whitespace-pre-wrap">
                    {b.value}
                  </div>
                  <div className="text-3xs text-ink-dim mt-2 font-mono">
                    Updated {new Date(b.updatedAt).toLocaleString()}
                    {b.updatedBy && ` · by ${b.updatedBy}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                onClick={() => setEditingId(b.id)}
                className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-brand">
                
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                onClick={async () => {
                  if (!confirm(`Delete content block "${b.id}"?`)) return;
                  try {
                    await deletePersistentRecord('content', b.id);
                    db.log('warn', 'content', `Deleted block ${b.id}`);
                    toast.success(`Permanently deleted ${b.id}`);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ?
                      error.message :
                      'Content block could not be deleted.'
                    );
                  }
                }}
                className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-sell">
                
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
          }
          </div>
        )}
        {filtered.length === 0 &&
        <div className="p-10 text-center text-xs text-ink-dim">
            {blocks.length === 0 ?
          'No content blocks yet — click "New block" to create one.' :
          'No blocks match your search.'}
          </div>
        }
      </div>
      <AnimatePresence>
        {addOpen &&
        <AddBlockModal
          adminEmail={adminEmail}
          onClose={() => setAddOpen(false)} />

        }
      </AnimatePresence>
    </div>);

}
function EditBlock({
  block,
  adminEmail,
  onDone




}: {block: ContentBlock;adminEmail: string;onDone: () => void;}) {
  const [val, setVal] = useState(block.value);
  return (
    <div>
      <div className="font-mono text-2xs uppercase tracking-wider text-brand mb-2">
        {block.id}
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={4}
        className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-y" />
      
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="secondary" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            if (await setContent(block.id, val, adminEmail)) {
              db.log('info', 'content', `Updated block ${block.id}`);
              toast.success('Content permanently updated');
              onDone();
            }
          }}>
          
          Save
        </Button>
      </div>
    </div>);

}
function AddBlockModal({
  adminEmail,
  onClose



}: {adminEmail: string;onClose: () => void;}) {
  const [id, setId] = useState('');
  const [val, setVal] = useState('');
  return (
    <Modal title="New content block" onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Block ID (e.g. landing.feature.1.title)"
          value={id}
          onChange={(e) => setId(e.target.value)} />
        
        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
            Value
          </label>
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={4}
            className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-y" />
          
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            if (!id.trim()) return toast.error('Block ID required');
            if (db.get('content', id.trim()))
            return toast.error('A block with that ID already exists');
            if (await setContent(id.trim(), val, adminEmail)) {
              db.log('info', 'content', `Created block ${id.trim()}`);
              toast.success('Block permanently created');
              onClose();
            }
          }}>
          
          Create
        </Button>
      </div>
    </Modal>);

}
// ============================================================
// BROADCAST
// ============================================================
function BroadcastTab() {
  const notifs = useCollection('notifications');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Notification['kind']>('info');
  const [q, setQ] = useState('');
  const send = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body required');
      return;
    }
    db.insert('notifications', {
      id: uid('nt'),
      target: 'broadcast',
      title,
      body,
      kind,
      read: false,
      createdAt: Date.now()
    });
    db.log('info', 'broadcast', `Broadcast sent: ${title}`);
    toast.success('Broadcast sent to all users');
    setTitle('');
    setBody('');
  };
  const allBroadcasts = notifs.filter((n) => n.target === 'broadcast');
  const filteredBroadcasts = allBroadcasts.
  filter((n) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (n.title || '').toLowerCase().includes(needle) ||
      (n.body || '').toLowerCase().includes(needle) ||
      (n.kind || '').toLowerCase().includes(needle));

  }).
  slice(0, 50);
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3">
          Compose broadcast
        </div>
        <div className="space-y-3">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="System maintenance scheduled…" />
          
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" />
            
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Tone
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
              
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warn">Warning</option>
              <option value="error">Critical</option>
            </select>
          </div>
          <Button
            variant="primary"
            onClick={send}
            icon={<SendIcon className="w-3.5 h-3.5" />}>
            
            Send to all users
          </Button>
        </div>
      </div>

      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3 flex items-center justify-between gap-2">
          <span>
            Recent broadcasts ({filteredBroadcasts.length}/
            {allBroadcasts.length})
          </span>
        </div>
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 mb-3">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, body, tone..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredBroadcasts.map((n) =>
          <div
            key={n.id}
            className="bg-bg-700 border border-line rounded p-3">
            
              <div className="flex items-center gap-2 mb-1">
                <Badge
                tone={
                n.kind === 'success' ?
                'green' :
                n.kind === 'warn' ?
                'amber' :
                n.kind === 'error' ?
                'red' :
                'blue'
                }>
                
                  {n.kind}
                </Badge>
                <span className="font-semibold text-xs">{n.title}</span>
                <button
                onClick={() => {
                  db.remove('notifications', n.id);
                  toast.success('Broadcast removed');
                }}
                className="ml-auto text-ink-dim hover:text-sell">
                
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xs text-ink-muted leading-relaxed">
                {n.body}
              </div>
              <div className="text-3xs text-ink-dim mt-1 font-mono">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          )}
          {filteredBroadcasts.length === 0 &&
          <div className="text-center text-xs text-ink-dim py-6">
              {allBroadcasts.length === 0 ?
            'No broadcasts sent yet.' :
            'No broadcasts match your search.'}
            </div>
          }
        </div>
      </div>
    </div>);

}
// ============================================================
// LOGS
// ============================================================
function LogsTab() {
  const logs = useCollection('logs');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs.filter((l) => {
      if (level !== 'all' && l.level !== level) return false;
      if (!needle) return true;
      return (
        (l.message || '').toLowerCase().includes(needle) ||
        (l.source || '').toLowerCase().includes(needle) ||
        (l.level || '').toLowerCase().includes(needle));

    });
  }, [logs, q, level]);
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
        <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
          System Logs ({filtered.length}/{logs.length})
        </div>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as any)}
          className="bg-bg-700 border border-line rounded px-2 py-1 text-2xs uppercase font-bold tracking-wider outline-none focus:border-brand">
          
          <option value="all">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 flex-1 min-w-[200px] max-w-md">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search message, source..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Trash2Icon className="w-3.5 h-3.5" />}
          onClick={() => {
            if (confirm('Clear all logs?')) {
              db.clear('logs');
              toast.success('Logs cleared');
            }
          }}>
          
          Clear logs
        </Button>
      </div>
      <div className="font-mono text-2xs max-h-[600px] overflow-y-auto">
        {filtered.map((l) =>
        <div
          key={l.id}
          className="px-3 py-1.5 border-b border-line/50 flex gap-3 items-start hover:bg-bg-700/30">
          
            <span className="text-ink-dim shrink-0">
              {new Date(l.createdAt).toLocaleString()}
            </span>
            <span
            className={`shrink-0 uppercase tracking-wider w-12 ${l.level === 'error' ? 'text-sell' : l.level === 'warn' ? 'text-warn' : 'text-buy'}`}>
            
              {l.level}
            </span>
            <span className="shrink-0 text-purple-trade w-20 truncate">
              {l.source}
            </span>
            <span className="text-ink-muted">{l.message}</span>
          </div>
        )}
        {filtered.length === 0 &&
        <div className="p-10 text-center text-ink-dim">
            {logs.length === 0 ?
          'No logs recorded.' :
          'No logs match your search.'}
          </div>
        }
      </div>
    </div>);

}
// ============================================================
// PLANS TAB — admin CRUD over membership plans shown on Landing
// + Gate payment selector
// ============================================================
function PlansTab({ adminEmail }: {adminEmail: string;}) {
  const plans = useCollection('plans');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = useMemo(
    () =>
    [...plans].sort(
      (a, b) =>
      Number(b.featured) - Number(a.featured) || a.createdAt - b.createdAt
    ),
    [plans]
  );
  const toggleActive = async (p: Plan) => {
    try {
      await persistRecord('plans', {
        ...p,
        active: !p.active,
        updatedAt: Date.now()
      });
      db.log(
        'info',
        'plans',
        `${adminEmail} ${p.active ? 'deactivated' : 'activated'} plan ${p.name}`
      );
      toast.success(`Plan ${p.active ? 'deactivated' : 'activated'} permanently`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan could not be saved.');
    }
  };
  const remove = async (p: Plan) => {
    if (!confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return;
    try {
      await deletePersistentRecord('plans', p.id);
      db.log('warn', 'plans', `${adminEmail} deleted plan ${p.name}`);
      toast.success('Plan permanently deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan could not be deleted.');
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Membership Plans</h2>
          <p className="text-2xs text-ink-muted">
            Plans shown on the Landing pricing section and the Gate payment
            step. Toggle active to hide a plan without deleting it.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<PlusIcon className="w-3.5 h-3.5" />}
          onClick={() => setAdding(true)}>
          
          New plan
        </Button>
      </div>

      {sorted.length === 0 &&
      <div className="bg-bg-600 border border-line rounded-md p-10 text-center text-xs text-ink-dim">
          No plans yet — click "New plan" to create one.
        </div>
      }

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((p) =>
        <div
          key={p.id}
          className={`bg-bg-600 border rounded-md p-4 ${p.featured ? 'border-brand/60 brand-glow' : 'border-line'} ${!p.active ? 'opacity-60' : ''}`}>
          
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-2xs text-ink-dim mt-0.5">
                  {p.durationCount} {p.durationUnit} · max {p.maxDevices}{' '}
                  device(s)
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.featured &&
              <Badge tone="brand" size="sm">
                    FEATURED
                  </Badge>
              }
                <Badge tone={p.active ? 'green' : 'amber'} size="sm">
                  {p.active ? 'active' : 'hidden'}
                </Badge>
              </div>
            </div>
            <div className="text-2xl font-extrabold mt-2">{p.price}</div>
            <p className="text-2xs text-ink-muted mt-1 leading-relaxed">
              {p.description}
            </p>
            <ul className="mt-2 space-y-1">
              {p.features.map((f, i) =>
            <li key={i} className="flex items-start gap-1.5 text-2xs">
                  <CheckIcon className="w-3 h-3 text-brand mt-0.5 shrink-0" />
                  {f}
                </li>
            )}
            </ul>
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line">
              <button
              onClick={() => setEditing(p)}
              className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-brand"
              title="Edit">
              
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
              <button
              onClick={() => void toggleActive(p)}
              className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-buy"
              title={p.active ? 'Deactivate' : 'Activate'}>
              
                {p.active ?
              <XIcon className="w-3.5 h-3.5" /> :

              <CheckIcon className="w-3.5 h-3.5" />
              }
              </button>
              <button
              onClick={() => void remove(p)}
              className="p-1.5 rounded hover:bg-bg-700 text-ink-muted hover:text-sell ml-auto"
              title="Delete">
              
                <Trash2Icon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {adding &&
        <PlanFormModal
          adminEmail={adminEmail}
          onClose={() => setAdding(false)} />

        }
        {editing &&
        <PlanFormModal
          adminEmail={adminEmail}
          plan={editing}
          onClose={() => setEditing(null)} />

        }
      </AnimatePresence>
    </div>);

}
function PlanFormModal({
  plan,
  adminEmail,
  onClose




}: {plan?: Plan;adminEmail: string;onClose: () => void;}) {
  const [name, setName] = useState(plan?.name || '');
  const [price, setPrice] = useState(plan?.price || '');
  const [durationUnit, setDurationUnit] = useState<Plan['durationUnit']>(
    plan?.durationUnit || 'days'
  );
  const [durationCount, setDurationCount] = useState(plan?.durationCount || 30);
  const [maxDevices, setMaxDevices] = useState(plan?.maxDevices ?? 1);
  const [description, setDescription] = useState(plan?.description || '');
  const [features, setFeatures] = useState((plan?.features || []).join(', '));
  const [featured, setFeatured] = useState(plan?.featured || false);
  const [active, setActive] = useState(plan?.active ?? true);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !price.trim()) {
      toast.error('Name and price are required.');
      return;
    }
    const now = Date.now();
    const featureList = features.
    split(',').
    map((s) => s.trim()).
    filter(Boolean);
    const record: Plan = {
      ...(plan || {
        id: 'plan_' + Math.random().toString(36).slice(2, 8),
        createdAt: now
      }),
      name,
      price,
      durationUnit,
      durationCount,
      maxDevices,
      description,
      features: featureList,
      featured,
      active,
      updatedAt: now
    };
    setSaving(true);
    try {
      await persistRecord('plans', record);
      db.log('info', 'plans', `${adminEmail} ${plan ? 'updated' : 'created'} plan ${name}`);
      toast.success(`Plan permanently ${plan ? 'updated' : 'created'}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={plan ? 'Edit plan' : 'New plan'} onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Plan name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pro" />
        
        <Input
          label="Price (free text)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. $49 or PKR 12,000" />
        
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Duration count
            </label>
            <input
              type="number"
              min={1}
              value={durationCount}
              onChange={(e) =>
              setDurationCount(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
            
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Unit
            </label>
            <select
              value={durationUnit}
              onChange={(e) =>
              setDurationUnit(e.target.value as Plan['durationUnit'])
              }
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
              
              <option value="days">days</option>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
              Max devices
            </label>
            <input
              type="number"
              min={1}
              value={maxDevices}
              onChange={(e) =>
              setMaxDevices(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
            
          </div>
        </div>
        <Input
          label="Short description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line marketing copy" />
        
        <div>
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
            Features (comma-separated)
          </label>
          <textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            rows={3}
            placeholder="All 10 strategies, Priority support, …"
            className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-y" />
          
        </div>
        <div className="flex items-center gap-5 pt-1">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="accent-brand" />
            
            Featured (highlighted)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-brand" />
            
            Active (visible to users)
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save plan'}
          </Button>
        </div>
      </div>
    </Modal>);

}
// ============================================================
// MODAL PRIMITIVE
// ============================================================
function Modal({
  title,
  children,
  onClose




}: {title: string;children: React.ReactNode;onClose: () => void;}) {
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      
      <motion.div
        initial={{
          scale: 0.96,
          opacity: 0
        }}
        animate={{
          scale: 1,
          opacity: 1
        }}
        exit={{
          scale: 0.96,
          opacity: 0
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-bg-700 border border-line rounded-md w-full max-w-md p-4 sm:p-5 brand-glow">
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 rounded hover:bg-bg-600">
            
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>);

}