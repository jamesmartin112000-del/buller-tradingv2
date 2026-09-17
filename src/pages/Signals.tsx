import React, { useMemo, useState } from 'react';
import { useEngine } from '../context/EngineContext';
import { fmtPrice, fmtRelative } from '../lib/engine/format';
import { findPair, PAIRS_LIST } from '../lib/engine/pairs';
import { ProgressBar } from '../components/ui/ProgressBar';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ZapIcon,
  ShieldAlertIcon } from
'lucide-react';
type Filter = 'ALL' | 'BUY' | 'SELL';
export function Signals() {
  const eng = useEngine();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pairFilter, setPairFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    return eng.signals.filter((s) => {
      if (filter !== 'ALL' && s.dir !== filter) return false;
      if (pairFilter !== 'ALL' && s.pair !== pairFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
        !s.pair.toLowerCase().includes(q) &&
        !s.reason.toLowerCase().includes(q) &&
        !s.strategiesUsed.some((x) => x.toLowerCase().includes(q)))

        return false;
      }
      return true;
    });
  }, [eng.signals, filter, pairFilter, query]);
  const stats = useMemo(() => {
    const all = eng.signals;
    return {
      total: all.length,
      buy: all.filter((s) => s.dir === 'BUY').length,
      sell: all.filter((s) => s.dir === 'SELL').length,
      avgConf: all.length ?
      Math.round(all.reduce((sum, s) => sum + s.str, 0) / all.length) :
      0
    };
  }, [eng.signals]);
  return (
    <div className="p-3 lg:p-4 space-y-3 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ZapIcon className="w-5 h-5 text-brand" /> Signal Feed
          </h1>
          <p className="text-2xs text-ink-muted mt-1">
            Live signal stream from the 10-strategy engine. Updates every 5–8s
            as new data arrives.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-2xs">
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Buys" value={stats.buy} tone="buy" />
          <StatPill label="Sells" value={stats.sell} tone="sell" />
          <StatPill label="Avg Conf" value={`${stats.avgConf}%`} />
        </div>
      </div>

      {/* Filters — stack on mobile so nothing gets squeezed */}
      <div className="bg-bg-600 border border-line rounded-md p-2.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="flex items-center gap-1.5 bg-bg-700 border border-line rounded px-2.5 py-2 sm:py-1.5 w-full sm:flex-1 sm:min-w-[180px]">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            placeholder="Search by pair, strategy, reason..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-xs outline-none flex-1 text-ink placeholder:text-ink-dim min-w-0" />
          
        </div>

        <div className="flex gap-2 sm:gap-1 w-full sm:w-auto">
          <div className="flex gap-1 bg-bg-700 border border-line rounded p-0.5 flex-1 sm:flex-initial">
            {(['ALL', 'BUY', 'SELL'] as Filter[]).map((f) =>
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 sm:py-1 text-2xs font-semibold rounded ${filter === f ? f === 'BUY' ? 'bg-buy text-white' : f === 'SELL' ? 'bg-sell text-white' : 'bg-brand text-white' : 'text-ink-muted hover:text-ink'}`}>
              
                {f}
              </button>
            )}
          </div>

          <select
            value={pairFilter}
            onChange={(e) => setPairFilter(e.target.value)}
            className="bg-bg-700 border border-line rounded px-2 py-1.5 text-xs text-ink outline-none flex-1 sm:flex-initial min-w-0">
            
            <option value="ALL">All Pairs</option>
            {PAIRS_LIST.map((p) =>
            <option key={p.id} value={p.id}>
                {p.label}
              </option>
            )}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {filtered.length === 0 ?
        <div className="bg-bg-600 border border-line rounded-md p-8 text-center text-2xs text-ink-muted">
            <FilterIcon className="w-5 h-5 mx-auto mb-2 text-ink-dim" />
            No actionable signals match these filters yet. The engine emits
            BUY/SELL signals when ≥35% confidence threshold is reached.
          </div> :

        filtered.map((s) => {
          const open = openId === s.id;
          const isBuy = s.dir === 'BUY';
          const color = isBuy ? 'text-buy' : 'text-sell';
          const border = isBuy ? 'border-l-buy' : 'border-l-sell';
          const Icon = isBuy ? TrendingUpIcon : TrendingDownIcon;
          const pair = findPair(s.pair);
          return (
            <div
              key={s.id}
              className={`bg-bg-600 border border-line border-l-4 ${border} rounded-md overflow-hidden`}>
              
                <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-start sm:items-center gap-2 sm:gap-3 px-3 py-2.5 hover:bg-bg-500 transition-colors text-left">
                
                  <Icon
                  className={`w-4 h-4 ${color} shrink-0 mt-0.5 sm:mt-0`} />
                
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {pair?.label}
                      </span>
                      <span className={`font-mono text-xs ${color} font-bold`}>
                        {s.dir}
                      </span>
                      <span className="text-2xs text-ink-muted hidden sm:inline">
                        @ {fmtPrice(s.pair, s.price)}
                      </span>
                      <span className="text-2xs font-mono bg-bg-700 border border-line rounded px-1.5 py-0.5">
                        {Math.min(100, s.str)}%
                      </span>
                      {s.trapDir &&
                    <span
                      className={`text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${s.trapDir === 'BULL_TRAP' ? 'text-sell border-sell/40 bg-sell/10' : 'text-buy border-buy/40 bg-buy/10'}`}>
                      
                          <ShieldAlertIcon className="w-2.5 h-2.5" />
                          {s.trapDir.replace('_', ' ')}
                        </span>
                    }
                    </div>
                    <div className="text-2xs text-ink-muted mt-0.5 truncate font-mono">
                      {s.reason}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-2xs text-ink-dim">
                      {fmtRelative(s.ts)}
                    </div>
                    {open ?
                  <ChevronUpIcon className="w-3.5 h-3.5 text-ink-muted" /> :

                  <ChevronDownIcon className="w-3.5 h-3.5 text-ink-muted" />
                  }
                  </div>
                </button>

                {open &&
              <div className="border-t border-line p-3 bg-bg-700/50 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-2xs uppercase tracking-wider text-ink-dim">
                          Confidence Score
                        </span>
                        <span
                      className={`font-mono text-xs font-bold ${color}`}>
                      
                          {Math.min(100, s.str)}%
                        </span>
                      </div>
                      <ProgressBar
                    value={Math.min(100, s.str)}
                    tone={isBuy ? 'green' : 'red'}
                    height={6} />
                  
                    </div>
                    {s.traps && s.traps.length > 0 &&
                <div
                  className={
                  'md:col-span-2 border rounded p-3 ' + (
                  s.trapDir === 'BULL_TRAP' ?
                  'bg-sell/10 border-sell/30' :
                  s.trapDir === 'BEAR_TRAP' ?
                  'bg-buy/10 border-buy/30' :
                  'bg-warn/10 border-warn/30')
                  }>
                  
                        <div
                    className={
                    'text-2xs uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1 ' + (
                    s.trapDir === 'BULL_TRAP' ?
                    'text-sell' :
                    s.trapDir === 'BEAR_TRAP' ?
                    'text-buy' :
                    'text-warn')
                    }>
                    
                          <ShieldAlertIcon className="w-3 h-3" />
                          Manipulation / Trap warning
                        </div>
                        <ul className="space-y-1">
                          {s.traps.map((t, i) =>
                    <li
                      key={i}
                      className="text-2xs text-ink leading-relaxed">
                      
                              › {t}
                            </li>
                    )}
                        </ul>
                      </div>
                }
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-ink-dim mb-2">
                        Entry Details
                      </div>
                      <div className="space-y-1 text-xs font-mono">
                        <Row
                      label="Entry"
                      value={fmtPrice(
                        s.pair,
                        isBuy ? s.buy.entry : s.sell.entry
                      )} />
                    
                        <Row
                      label="Stop Loss"
                      value={fmtPrice(s.pair, isBuy ? s.buy.sl : s.sell.sl)}
                      tone={isBuy ? 'sell' : 'buy'} />
                    
                        <Row
                      label="Take Profit"
                      value={fmtPrice(s.pair, isBuy ? s.buy.tp : s.sell.tp)}
                      tone={isBuy ? 'buy' : 'sell'} />
                    
                        <Row
                      label="R:R"
                      value={`1 : ${isBuy ? s.buy.rr : s.sell.rr}`} />
                    
                        <Row
                      label="Priority"
                      value={`${isBuy ? s.buy.priority : s.sell.priority}/100`} />
                    
                      </div>
                    </div>
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-ink-dim mb-2">
                        Big Players · {s.bigPlayers.dir}
                      </div>
                      <p className="text-2xs text-ink-muted leading-relaxed">
                        {s.bigPlayers.desc}
                      </p>
                    </div>
                    {s.confs && s.confs.length > 0 &&
                <div className="md:col-span-2">
                        <div className="text-2xs uppercase tracking-wider text-ink-dim mb-2">
                          Weighted breakdown — {s.confs.length} confirmations
                        </div>
                        <div className="space-y-1.5">
                          {[...s.confs].
                    sort((a, b) => b.w - a.w).
                    slice(0, 8).
                    map((c, i) => {
                      const bull =
                      c.t.includes('BULLISH') ||
                      c.t.includes('BUY') ||
                      c.t.includes('DISCOUNT') ||
                      c.t.includes('OVERSOLD') ||
                      c.t.includes('SUPPORT');
                      const tone = bull ? 'green' : 'red';
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2">
                          
                                  <span className="text-2xs font-mono uppercase tracking-wider text-ink-muted w-20 shrink-0 truncate">
                                    {c.s}
                                  </span>
                                  <div className="flex-1">
                                    <ProgressBar
                              value={c.w}
                              max={45}
                              tone={tone}
                              height={4} />
                            
                                  </div>
                                  <span className="text-2xs font-mono text-ink-dim w-7 text-right shrink-0">
                                    {c.w}
                                  </span>
                                </div>);

                    })}
                        </div>
                      </div>
                }
                    <div className="md:col-span-2">
                      <div className="text-2xs uppercase tracking-wider text-ink-dim mb-2">
                        Strategies triggered ({s.strategiesUsed.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.strategiesUsed.map((x, i) =>
                    <span
                      key={i}
                      className="text-2xs bg-bg-800 border border-line text-ink-muted px-2 py-0.5 rounded">
                      
                            {x}
                          </span>
                    )}
                      </div>
                    </div>
                  </div>
              }
              </div>);

        })
        }
      </div>
    </div>);

}
function StatPill({
  label,
  value,
  tone




}: {label: string;value: number | string;tone?: 'buy' | 'sell';}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="bg-bg-600 border border-line rounded px-2 py-1.5 min-w-[60px]">
      <div className="text-3xs uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className={`font-mono font-bold ${color}`}>{value}</div>
    </div>);

}
function Row({
  label,
  value,
  tone




}: {label: string;value: string;tone?: 'buy' | 'sell';}) {
  const c =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`${c} font-bold`}>{value}</span>
    </div>);

}