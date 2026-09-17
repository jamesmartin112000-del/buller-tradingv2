import React from 'react';
import {
  RocketIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ZapIcon } from
'lucide-react';
import { fmtNum } from '../../lib/terminal/market';
import type { BigMoveAlert } from '../../lib/terminal/opportunity';
interface Props {
  alert: BigMoveAlert | null;
  assetLabel: string;
  tfLabel: string;
}
/**
 * High-visibility "BIG MOVE INCOMING" banner. Renders nothing unless a
 * genuine big move has been detected on the selected asset + timeframe.
 */
export function BigMoveGrid({ alert, assetLabel, tfLabel }: Props) {
  if (!alert) return null;
  const isBuy = alert.direction === 'BUY';
  const dirColor = isBuy ? 'text-buy' : 'text-sell';
  const DirIcon = isBuy ? TrendingUpIcon : TrendingDownIcon;
  return (
    <section
      aria-label="Big move incoming alert"
      className="relative overflow-hidden rounded-md border border-gold/50 bg-bg-700 p-3 lg:p-4">
      
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-gold/50 bg-gold/15">
            <RocketIcon className="h-4 w-4 text-gold" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold">
                Big Move Incoming
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-gold">
                <ZapIcon className="h-2.5 w-2.5" />
                {assetLabel} · {tfLabel}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-3xs leading-relaxed text-ink-muted">
              {alert.rationale}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div
              className={`flex items-center justify-end gap-1.5 font-mono text-2xl font-black ${dirColor}`}>
              
              <DirIcon className="h-5 w-5" />
              {alert.direction}
            </div>
            <div className="font-mono text-2xs text-ink-muted">
              {alert.confidence}% conviction · R:R 1:{alert.rr}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2 font-mono text-2xs">
        <Plan label="Entry" value={fmtNum(alert.entry)} tone="ink" />
        <Plan label="Stop" value={fmtNum(alert.sl)} tone="sell" />
        <Plan label="Target" value={fmtNum(alert.tp)} tone="buy" />
      </div>

      <div className="relative mt-2 flex flex-wrap gap-1.5">
        {alert.triggers.map((t) =>
        <span
          key={t}
          className="rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-gold">
          
            {t}
          </span>
        )}
      </div>
    </section>);

}
function Plan({
  label,
  value,
  tone




}: {label: string;value: string;tone: 'buy' | 'sell' | 'ink';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="rounded border border-gold/25 bg-bg-800/60 p-2">
      <div className="text-3xs uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className={`font-bold ${color}`}>${value}</div>
    </div>);

}