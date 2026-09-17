import { findPair } from './pairs';

export function fmtPrice(pairId: string, v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v)) return '---';
  const p = findPair(pairId);
  const d = p?.decimals ?? 2;
  return v.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
}

export function fmtPct(v: number | undefined | null, decimals = 2): string {
  if (v === undefined || v === null || isNaN(v)) return '0%';
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

export function fmtCompact(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v)) return '---';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}