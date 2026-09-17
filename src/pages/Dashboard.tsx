import React from 'react';
import { Link } from 'react-router-dom';
import {
  ZapIcon,
  AlertTriangleIcon,
  ActivityIcon,
  RadarIcon,
  LayersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  GaugeIcon } from
'lucide-react';
import { useEngine, useCurrentPair } from '../context/EngineContext';
import { useUserAccount } from '../context/UserAccountContext';
import { findPair } from '../lib/engine/pairs';
import { fmtPrice, fmtPct } from '../lib/engine/format';
import { useGoldMarketAnalysis } from '../hooks/useGoldMarketAnalysis';
import { GodSignalTerminal } from '../components/terminal/GodSignalTerminal';
import { PriceTicker } from '../components/common/PriceTicker';
import { AuthorBadge } from '../components/common/AuthorBadge';
import { Card } from '../components/ui/Card';
import { SessionTracker } from '../components/dashboard/SessionTracker';
import { AmdPhasePanel } from '../components/dashboard/AmdPhasePanel';
import { OrderFlowPanel } from '../components/dashboard/OrderFlowPanel';
import { CombinedVerdictPanel } from '../components/dashboard/CombinedVerdictPanel';
import { TrapDetectorPanel } from '../components/dashboard/TrapDetectorPanel';
import { GoldInstitutionalSniper } from '../components/dashboard/GoldInstitutionalSniper';
import { CryptoInstitutionalMaster } from '../components/dashboard/CryptoInstitutionalMaster';
import { TimeframeTrendGrid } from '../components/dashboard/TimeframeTrendGrid';
import { GoldSniperWorkspace } from '../components/dashboard/GoldSniperWorkspace';
import { DashboardSectionNav } from '../components/dashboard/DashboardSectionNav';
import { InstitutionalDashboard } from '../components/institutional/InstitutionalDashboard';

const QUICK_LINKS = [
{
  to: '/app/signals',
  label: 'Signals',
  icon: ZapIcon
},
{
  to: '/app/god-signal',
  label: 'BULLER Signal',
  icon: RadarIcon
}];

export function Dashboard() {
  const { dbUser } = useUserAccount();
  const eng = useEngine();
  const current = useCurrentPair();
  const goldMarket = useGoldMarketAnalysis();
  const awaitingApproval =
  !!dbUser &&
  dbUser.role !== 'admin' &&
  dbUser.role !== 'super_admin' &&
  !dbUser.validityExpiresAt &&
  dbUser.kyc?.status !== 'approved';
  const pairDef = findPair(eng.currentPair);
  const price = current?.price;
  const analysis = current?.analysis;
  // Live market overview derived from the real signal feed.
  const signals = eng.signals;
  const buyCount = signals.filter((s) => s.dir === 'BUY').length;
  const sellCount = signals.filter((s) => s.dir === 'SELL').length;
  const avgConf = signals.length ?
  Math.round(signals.reduce((sum, s) => sum + s.str, 0) / signals.length) :
  0;
  const apiOnline =
  eng.online && (
  eng.apiStatus.gold === 'ok' ||
  eng.apiStatus.crypto === 'ok' ||
  eng.apiStatus.forex === 'ok');
  const change = price?.chng ?? 0;
  const changePositive = change >= 0;
  return (
    <div className="w-full bg-bg">
      <PriceTicker />

      <div className="p-3 lg:p-4 space-y-3 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <header className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <GaugeIcon className="w-5 h-5 text-brand" />
              BULLER TRADING Dashboard
            </h1>
            <p className="text-2xs text-ink-muted mt-1">
              Professional gold-market intelligence, disciplined planning and performance control.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider ${apiOnline ? 'border-buy/30 bg-buy/10 text-buy' : 'border-warn/30 bg-warn/10 text-warn'}`}>
              
              <span
                className={`h-2 w-2 rounded-full ${apiOnline ? 'bg-buy animate-pulse' : 'bg-warn'}`}
                aria-hidden="true" />
              
              {apiOnline ? 'Live' : 'Reconnecting'}
            </span>
            <AuthorBadge />
          </div>
        </header>

        <DashboardSectionNav />

        {awaitingApproval &&
        <div className="bg-warn/10 border border-warn/30 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-warn shrink-0" />
            <div className="text-2xs uppercase tracking-wider font-bold text-warn">
              Awaiting admin approval
            </div>
            <div className="text-2xs text-ink-muted truncate">
              · KYC and payment must be verified before live signals unlock.
            </div>
          </div>
        }

        {/* Institutional order flow is the first analytical surface on the dashboard. */}
        <div id="buller-b1-order-flow" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <InstitutionalDashboard />
        </div>

        {/* One real-OHLC Gold analysis drives both surfaces so they cannot disagree. */}
        <div id="buller-b2-timeframes" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <TimeframeTrendGrid market={goldMarket} />
        </div>

        {/* Five-step entry confirmation consumes the exact same typed result. */}
        <GoldSniperWorkspace market={goldMarket} />

        {/* Final combined verdict — every module merged into one trade entry */}
        <div id="buller-b5-verdict" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <CombinedVerdictPanel />
        </div>

        {/* Gold-only deterministic institutional sniper analysis */}
        <div id="buller-b6-gold-master" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <GoldInstitutionalSniper />
        </div>

        {/* Separate BTC-first institutional system for active Binance USDT spot pairs */}
        <div id="buller-b7-crypto-master" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <CryptoInstitutionalMaster />
        </div>

        {/* Real Bull Trap / Bear Trap detector on live candles */}
        <div id="buller-b8-traps" className="scroll-mt-[128px] lg:scroll-mt-[86px]">
          <TrapDetectorPanel />
        </div>

        {/* Market overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <OverviewStat
            label="Active Signals"
            value={signals.length}
            icon={<LayersIcon className="w-3.5 h-3.5" />} />
          
          <OverviewStat
            label="Buy Bias"
            value={buyCount}
            tone="buy"
            icon={<TrendingUpIcon className="w-3.5 h-3.5" />} />
          
          <OverviewStat
            label="Sell Bias"
            value={sellCount}
            tone="sell"
            icon={<TrendingDownIcon className="w-3.5 h-3.5" />} />
          
          <OverviewStat
            label="Avg Confidence"
            value={`${avgConf}%`}
            icon={<GaugeIcon className="w-3.5 h-3.5" />} />
          
        </div>

        {/* Quick links into the core categories */}
        <nav aria-label="Core trading tools">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_LINKS.map((q) =>
            <Link
              key={q.to}
              to={q.to}
              className="group flex flex-col items-center gap-1.5 rounded-md border border-line bg-bg-600 px-2 py-3 text-center transition-colors hover:border-brand/40 hover:bg-bg-500">
              
                <q.icon className="w-4 h-4 text-ink-muted group-hover:text-brand transition-colors" />
                <span className="text-2xs font-semibold text-ink-muted group-hover:text-ink truncate w-full">
                  {q.label}
                </span>
              </Link>
            )}
          </div>
        </nav>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* Unified signal centerpiece */}
          <div
            id="buller-b9-unified-signal"
            className="scroll-mt-[128px] rounded-md border border-line bg-bg-700 p-2 lg:scroll-mt-[86px] lg:p-3 xl:col-span-2">
            
            <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-2">
              <ZapIcon className="w-3 h-3 text-brand" />
              BULLER TRADING Signal · Unified Intelligence
            </div>
            <GodSignalTerminal />
          </div>

          {/* Side intelligence column */}
          <div className="space-y-3">
            <Card
              title={`${pairDef?.label ?? eng.currentPair} · Live`}
              icon={<ActivityIcon className="w-3 h-3" />}
              action={
              price?.mid ?
              <span
                className={`font-mono text-2xs font-bold ${changePositive ? 'text-buy' : 'text-sell'}`}>
                
                    {fmtPct(change)}
                  </span> :
              undefined
              }>
              
              <div className="font-mono text-2xl font-bold text-ink">
                {fmtPrice(eng.currentPair, price?.mid)}
              </div>
              <div className="mt-1 flex items-center gap-3 text-2xs text-ink-muted font-mono">
                <span>H {fmtPrice(eng.currentPair, price?.high24)}</span>
                <span>L {fmtPrice(eng.currentPair, price?.low24)}</span>
              </div>
            </Card>

            <Card title="AMD Phase" icon={<LayersIcon className="w-3 h-3" />}>
              {analysis ?
              <AmdPhasePanel amd={analysis.amd} /> :

              <PanelSkeleton />
              }
            </Card>

            <Card title="Order Flow" icon={<GaugeIcon className="w-3 h-3" />}>
              {analysis ?
              <OrderFlowPanel of={analysis.of} /> :

              <PanelSkeleton />
              }
            </Card>

            <Card
              title="Session Tracker"
              icon={<ActivityIcon className="w-3 h-3" />}>
              
              <SessionTracker />
            </Card>
          </div>
        </div>
      </div>
    </div>);

}
function OverviewStat({
  label,
  value,
  tone,
  icon





}: {label: string;value: number | string;tone?: 'buy' | 'sell';icon?: React.ReactNode;}) {
  const color =
  tone === 'buy' ? 'text-buy' : tone === 'sell' ? 'text-sell' : 'text-ink';
  return (
    <div className="bg-bg-600 border border-line rounded-md px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-3xs uppercase tracking-wider text-ink-dim">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>);

}
function PanelSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-2 w-full rounded bg-bg-800" />
      <div className="h-2 w-3/4 rounded bg-bg-800" />
      <div className="h-8 w-full rounded bg-bg-800" />
    </div>);

}