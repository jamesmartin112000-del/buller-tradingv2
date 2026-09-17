import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  TargetIcon,
  ZapIcon,
  CheckCircle2Icon,
  ClockIcon,
  ShieldIcon } from
'lucide-react';
import { useEngine } from '../../context/EngineContext';
import { fmtPrice } from '../../lib/engine/format';
import type { EntryPlan } from '../../lib/engine/types';
/**
 * Live multi-entry confirmation panel.
 * Shows 3 staggered entry plans (aggressive / standard / conservative) with
 * live confirmation badges + toast alerts when an entry zone activates.
 */
export function MultiEntryPanel() {
  const eng = useEngine();
  const ps = eng.pairs[eng.currentPair];
  const sig = ps?.analysis.lastSignal;
  const pid = eng.currentPair;
  const prevConfirmedRef = useRef<Record<string, boolean>>({});
  const entries = sig?.entries || [];
  const dir = sig?.dir || 'HOLD';
  const isBuy = dir === 'BUY' || dir === 'WATCH_BUY';
  const isSell = dir === 'SELL' || dir === 'WATCH_SELL';
  const accent = isBuy ? 'buy' : isSell ? 'sell' : null;
  // Fire alert toast when an entry transitions to confirmed
  useEffect(() => {
    entries.forEach((e) => {
      const key = `${pid}-${e.label}-${dir}`;
      const wasConfirmed = prevConfirmedRef.current[key];
      if (e.confirmed && !wasConfirmed) {
        toast.success(`${dir} ${e.label.toUpperCase()} entry confirmed`, {
          description: `${pid} @ ${fmtPrice(pid, e.entry)} · R:R 1:${e.rr}`,
          duration: 6000
        });
      }
      prevConfirmedRef.current[key] = e.confirmed;
    });
  }, [entries, pid, dir]);
  if (!entries.length || !accent) {
    return (
      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
          <TargetIcon className="w-3 h-3" />
          Live Entry Plan · 3-Tier System
        </div>
        <div className="text-xs text-ink-muted">
          Engine is scanning for confluence. Entries appear when directional
          bias forms (≥35% score) with at least one strong confirmation.
        </div>
      </div>);

  }
  const accentColor = accent === 'buy' ? 'text-buy' : 'text-sell';
  const accentBorder = accent === 'buy' ? 'border-l-buy' : 'border-l-sell';
  return (
    <div
      className={`bg-bg-600 border border-line border-l-4 ${accentBorder} rounded-md p-4`}>
      
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim">
          <TargetIcon className="w-3 h-3" />
          Live Entry Plan · 3-Tier System
        </div>
        <div
          className={`text-2xs font-bold ${accentColor} flex items-center gap-1.5`}>
          
          <span className="w-1.5 h-1.5 rounded-full bg-current dot-pulse" />
          {dir.replace('_', ' ')} · current {fmtPrice(pid, sig?.price || 0)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {entries.map((e) =>
        <EntryTier key={e.label} entry={e} pid={pid} isBuy={isBuy} />
        )}
      </div>

      <div className="mt-3 text-2xs text-ink-dim leading-relaxed flex items-start gap-1.5">
        <ShieldIcon className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Aggressive = market entry now. Standard waits for a small pullback.
          Conservative targets the deepest pullback for best R:R. Alerts trigger
          automatically when each entry zone is reached.
        </span>
      </div>
    </div>);

}
function EntryTier({
  entry,
  pid,
  isBuy




}: {entry: EntryPlan;pid: string;isBuy: boolean;}) {
  const slColor = isBuy ? 'text-sell' : 'text-buy';
  const tpColor = isBuy ? 'text-buy' : 'text-sell';
  const labelMap: Record<
    EntryPlan['label'],
    {
      icon: typeof ZapIcon;
      tone: string;
    }> =
  {
    aggressive: {
      icon: ZapIcon,
      tone: 'text-warn'
    },
    standard: {
      icon: TargetIcon,
      tone: 'text-blue-trade'
    },
    conservative: {
      icon: ShieldIcon,
      tone: 'text-purple-trade'
    }
  };
  const meta = labelMap[entry.label];
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      className={`bg-bg-700 border rounded-md p-3 transition-colors ${entry.confirmed ? isBuy ? 'border-buy/50 bg-buy/5' : 'border-sell/50 bg-sell/5' : 'border-line'}`}>
      
      <div className="flex items-center justify-between mb-2">
        <div
          className={`flex items-center gap-1.5 text-2xs uppercase tracking-wider font-bold ${meta.tone}`}>
          
          <Icon className="w-3 h-3" />
          {entry.label}
        </div>
        <AnimatePresence>
          {entry.confirmed ?
          <motion.div
            key="confirmed"
            initial={{
              scale: 0.5,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.5,
              opacity: 0
            }}
            className={`flex items-center gap-1 text-2xs font-bold ${isBuy ? 'text-buy' : 'text-sell'}`}>
            
              <CheckCircle2Icon className="w-3 h-3" />
              READY
            </motion.div> :

          <motion.div
            key="waiting"
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="flex items-center gap-1 text-2xs text-ink-dim">
            
              <ClockIcon className="w-3 h-3" />
              WAIT
            </motion.div>
          }
        </AnimatePresence>
      </div>

      <div className="space-y-1 text-2xs font-mono">
        <Row label="Entry" value={fmtPrice(pid, entry.entry)} bold />
        <Row label="SL" value={fmtPrice(pid, entry.sl)} colored={slColor} />
        <Row label="TP1" value={fmtPrice(pid, entry.tp1)} colored={tpColor} />
        <Row label="TP2" value={fmtPrice(pid, entry.tp2)} colored={tpColor} />
        <Row label="TP3" value={fmtPrice(pid, entry.tp3)} colored={tpColor} />
        <div className="flex justify-between pt-1 border-t border-line/60 mt-1.5">
          <span className="text-ink-muted">R:R</span>
          <span className="text-warn font-bold">1 : {entry.rr}</span>
        </div>
      </div>

      <div className="mt-2 text-3xs text-ink-dim leading-relaxed">
        {entry.trigger}
      </div>
    </motion.div>);

}
function Row({
  label,
  value,
  colored,
  bold





}: {label: string;value: string;colored?: string;bold?: boolean;}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`${colored || 'text-ink'} ${bold ? 'font-bold' : ''}`}>
        {value}
      </span>
    </div>);

}