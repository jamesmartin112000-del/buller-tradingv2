import React, { useEffect, useState } from 'react';
import { GlobeIcon } from 'lucide-react';
interface SessionDef {
  key: string;
  label: string;
  city: string;
  /** UTC open/close in minutes from midnight */
  openMin: number;
  closeMin: number;
}
// Standard FX session windows in UTC.
const SESSIONS: SessionDef[] = [
{
  key: 'asia',
  label: 'Asian',
  city: 'Tokyo',
  openMin: 0,
  closeMin: 9 * 60
},
{
  key: 'london',
  label: 'London',
  city: 'London',
  openMin: 7 * 60,
  closeMin: 16 * 60
},
{
  key: 'ny',
  label: 'New York',
  city: 'New York',
  openMin: 12 * 60,
  closeMin: 21 * 60
}];

function nowUtcMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}
function fmtCountdown(mins: number): string {
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}
export function SessionTracker() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const cur = nowUtcMinutes(now);
  return (
    <div className="space-y-2">
      {SESSIONS.map((s) => {
        const active = cur >= s.openMin && cur < s.closeMin;
        const countdown = active ?
        fmtCountdown(s.closeMin - cur) :
        fmtCountdown(s.openMin - cur);
        return (
          <div
            key={s.key}
            className="flex items-center justify-between rounded border border-line bg-bg-700 px-2.5 py-2">
            
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-buy animate-pulse' : 'bg-ink-dim'}`}
                aria-hidden="true" />
              
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">
                  {s.label}
                </div>
                <div className="text-3xs text-ink-dim truncate">{s.city}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-3xs uppercase tracking-wider font-bold ${active ? 'text-buy' : 'text-ink-dim'}`}>
                
                {active ? 'Open' : 'Closed'}
              </div>
              <div className="font-mono text-2xs text-ink-muted">
                {active ? 'Closes in' : 'Opens in'} {countdown}
              </div>
            </div>
          </div>);

      })}
    </div>);

}