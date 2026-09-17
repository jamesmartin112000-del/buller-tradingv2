import React, { useEffect, useState } from 'react';
import {
  ShieldCheckIcon,
  InboxIcon,
  CheckIcon,
  XIcon,
  HistoryIcon } from
'lucide-react';
import {
  subscribePendingRequests,
  listAllRequests,
  approveRequest,
  rejectRequest,
  type DeviceChangeRequest } from
'../lib/backend/deviceLockService';
export default function AdminDevicePanel() {
  const [pending, setPending] = useState<DeviceChangeRequest[]>([]);
  const [history, setHistory] = useState<DeviceChangeRequest[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{
    requestId: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  // Real-time pending requests.
  useEffect(() => {
    console.log('[deviceLock] admin: subscribing to pending requests');
    const unsub = subscribePendingRequests((rows) => {
      console.log('[deviceLock] admin: pending snapshot', rows.length);
      setPending(rows);
    });
    return unsub;
  }, []);
  // History (refreshed after each action).
  const loadHistory = async () => {
    const all = await listAllRequests();
    setHistory(all.slice(0, 25));
  };
  useEffect(() => {
    loadHistory();
  }, []);
  const flash = (
  requestId: string,
  message: string,
  type: 'success' | 'error') =>
  {
    setActionStatus({
      requestId,
      message,
      type
    });
    setTimeout(() => setActionStatus(null), 3000);
  };
  const handleApprove = async (req: DeviceChangeRequest) => {
    setBusyId(req.id);
    const result = await approveRequest(req);
    flash(req.id, result.message, result.success ? 'success' : 'error');
    setBusyId(null);
    loadHistory();
  };
  const handleReject = async (req: DeviceChangeRequest) => {
    const reason = rejectReasons[req.id] || 'Admin rejected the request';
    setBusyId(req.id);
    const result = await rejectRequest(req.id, reason);
    flash(req.id, result.message, result.success ? 'success' : 'error');
    setBusyId(null);
    loadHistory();
  };
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white mb-2">
          <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
          Admin · Device Requests
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Live device-change requests. Approve to switch a user's active device;
          reject to keep their current device.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Pending Requests</p>
            <p className="text-2xl font-bold text-yellow-400">
              {pending.length}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Approved (recent)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {history.filter((r) => r.status === 'approved').length}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Rejected (recent)</p>
            <p className="text-2xl font-bold text-red-400">
              {history.filter((r) => r.status === 'rejected').length}
            </p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <InboxIcon className="w-5 h-5 text-slate-400" />
            Pending Device Change Requests
          </h2>
          {pending.length === 0 ?
          <p className="text-slate-500 text-sm">No pending requests</p> :

          <div className="overflow-x-auto">
              <table className="w-full text-xs text-left mb-2">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">User Email</th>
                    <th className="pb-2 pr-4">User ID</th>
                    <th className="pb-2 pr-4">Old Device</th>
                    <th className="pb-2 pr-4">New Device</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2 pr-4">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((req) =>
                <tr
                  key={req.id}
                  className="border-b border-slate-800/50 align-top">
                  
                      <td className="py-2 pr-4 text-slate-200">{req.email}</td>
                      <td className="py-2 pr-4 text-slate-400 font-mono">
                        {req.userId.slice(0, 10)}…
                      </td>
                      <td className="py-2 pr-4 text-slate-400 font-mono">
                        {req.currentDeviceId ?
                    req.currentDeviceId.slice(0, 10) + '…' :
                    '—'}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 font-mono">
                        {req.newDeviceId.slice(0, 10)}…
                        <span className="block text-slate-500">
                          {req.newFingerprint?.platform} ·{' '}
                          {req.newFingerprint?.screen}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-300 max-w-[180px]">
                        {req.reason}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {new Date(req.createdAt).toLocaleString()}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>

              <div className="space-y-3 mt-3">
                {pending.map((req) =>
              <div
                key={`act-${req.id}`}
                className="bg-slate-800 rounded-lg border border-yellow-700/30 p-3">
                
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-300 font-medium">
                        {req.email} · #{req.id.slice(-8)}
                      </p>
                      <span className="text-2xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>
                    <input
                  value={rejectReasons[req.id] || ''}
                  onChange={(e) =>
                  setRejectReasons((prev) => ({
                    ...prev,
                    [req.id]: e.target.value
                  }))
                  }
                  placeholder="Rejection note (optional)…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 placeholder-slate-600 mb-2" />
                
                    {actionStatus?.requestId === req.id &&
                <div
                  className={`text-xs mb-2 ${actionStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  
                        {actionStatus.message}
                      </div>
                }
                    <div className="flex gap-2">
                      <button
                    disabled={busyId === req.id}
                    onClick={() => handleApprove(req)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all text-xs font-medium disabled:opacity-50">
                    
                        <CheckIcon className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                    disabled={busyId === req.id}
                    onClick={() => handleReject(req)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all text-xs font-medium disabled:opacity-50">
                    
                        <XIcon className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
              )}
              </div>
            </div>
          }
        </div>

        {/* Request History */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <HistoryIcon className="w-4 h-4" />
            Request History
          </h2>
          {history.length === 0 ?
          <p className="text-slate-500 text-sm">No request history</p> :

          <div className="space-y-2">
              {history.map((req) =>
            <div
              key={req.id}
              className="bg-slate-800/30 rounded-lg p-3 flex items-center justify-between">
              
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 truncate">
                      {req.email} — {req.reason.slice(0, 50)}
                      {req.reason.length > 50 ? '…' : ''}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                className={`text-2xs px-2 py-1 rounded-full shrink-0 ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                
                    {req.status}
                  </span>
                </div>
            )}
            </div>
          }
        </div>
      </div>
    </div>);

}