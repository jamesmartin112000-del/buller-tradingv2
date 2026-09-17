import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEngine } from '../../context/EngineContext';
import { useScanner } from '../../context/ScannerContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOutIcon,
  MenuIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  WifiIcon,
  WifiOffIcon } from
'lucide-react';
import { toast } from 'sonner';
import { NotificationBell } from './NotificationBell';
interface TopBarProps {
  onMenu?: () => void;
}
export function TopBar({ onMenu }: TopBarProps) {
  const { user, logout } = useAuth();
  const eng = useEngine();
  const nav = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  // Force a 1Hz re-render so "last update" labels stay live without
  // depending on the engine reducer ticking.
  const [, setNow] = useState(0);
  useEffect(() => {
    let interval: number | null = null;
    const start = () => {
      if (document.hidden || interval !== null) return;
      interval = window.setInterval(() => setNow((n) => n + 1), 1000);
    };
    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  // Consider a source "effectively live" if it has returned OK within
  // the last 60s, regardless of whether its current dispatched status is
  // momentarily 'pending' (a retry in flight). This eliminates the bug
  // where one flaky source (typically Alpha Vantage's demo forex feed)
  // pinned the whole engine to PARTIAL even when 2/3 sources were live.
  const FRESH_WINDOW_MS = 60000;
  const now = Date.now();
  const sourceKeys = ['gold', 'forex', 'crypto'] as const;
  const liveCount = sourceKeys.reduce((acc, k) => {
    const s = eng.apiStatus[k];
    const lastOk = eng.apiLastOk[k];
    const fresh = lastOk && now - lastOk < FRESH_WINDOW_MS;
    return acc + (s === 'ok' || fresh ? 1 : 0);
  }, 0);
  const offline = !eng.online;
  const handleRefresh = async () => {
    if (refreshing) return;
    if (offline) {
      toast.error('You are offline — reconnect before refreshing market data');
      return;
    }
    setRefreshing(true);
    try {
      await eng.refresh();
      toast.success('Market data refreshed');
    } catch {
      toast.error('Refresh failed — automatic retries are still active');
    } finally {
      setRefreshing(false);
    }
  };
  const handleLogout = () => {
    logout();
    nav('/');
  };
  // 2/3 or 3/3 fresh sources = LIVE (the engine has enough data to trade).
  // 1/3 = PARTIAL. 0/3 = CONNECTING (cold start) unless we're offline.
  const label = offline ?
  'OFFLINE' :
  liveCount >= 2 ?
  'LIVE' :
  liveCount === 1 ?
  'PARTIAL' :
  'CONNECTING';
  const tone = offline ?
  'text-sell' :
  liveCount >= 2 ?
  'text-buy' :
  liveCount === 1 ?
  'text-warn' :
  'text-sell';
  return (
    <header className="h-14 bg-bg-800 border-b border-line flex items-center px-3 lg:px-5 gap-3 sticky top-0 z-30">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation menu"
        className="lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
        
        <MenuIcon className="w-5 h-5" />
      </button>

      <div className="hidden md:flex items-center gap-2 flex-1 max-w-md bg-bg-700 border border-line rounded-md px-3 py-1.5">
        <SearchIcon className="w-3.5 h-3.5 text-ink-dim" />
        <input
          type="search"
          aria-label="Search pair, signal, or news"
          placeholder="Search pair, signal, news..."
          className="h-8 min-h-0 bg-transparent text-xs text-ink placeholder:text-ink-dim outline-none flex-1" />
        
        <kbd className="text-[10px] text-ink-dim border border-line px-1 rounded">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {/* Per-source status dots with last-update tooltips */}
        <div className="hidden md:flex items-center gap-1.5 text-2xs">
          <StatusDot
            label="Gold"
            status={eng.apiStatus.gold}
            lastOk={eng.apiLastOk.gold} />
          
          <StatusDot
            label="FX"
            status={eng.apiStatus.forex}
            lastOk={eng.apiLastOk.forex} />
          
          <StatusDot
            label="Crypto"
            status={eng.apiStatus.crypto}
            lastOk={eng.apiLastOk.crypto} />
          
        </div>

        <div className={`flex items-center gap-1.5 text-2xs ${tone}`}>
          {!offline && liveCount >= 2 ?
          <WifiIcon className="w-3.5 h-3.5" /> :

          <WifiOffIcon className="w-3.5 h-3.5" />
          }
          <span className="font-mono uppercase tracking-wider font-bold">
            {label}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || offline}
          aria-label={
          refreshing ? 'Refreshing market data' : 'Refresh market data'
          }
          className="text-ink-muted hover:text-ink p-1.5 rounded hover:bg-bg-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title="Force refresh all data">
          
          <RefreshCwIcon
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          
        </button>

        <ResetButton />

        <NotificationBell />

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-line">
          <div className="w-7 h-7 rounded-full border border-brand bg-brand/15 flex items-center justify-center text-brand text-2xs font-bold uppercase">
            {(user?.name || 'U')[0]}
          </div>
          <div className="leading-tight">
            <div className="text-xs text-ink font-medium">
              {user?.name || 'Trader'}
            </div>
            <div className="text-2xs text-ink-dim uppercase tracking-wider">
              {user?.role || 'user'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded text-ink-muted transition-colors hover:bg-bg-700 hover:text-sell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:h-11 sm:w-11">
          
          <LogOutIcon className="w-4 h-4" />
        </button>
      </div>
    </header>);

}
function ResetButton() {
  const scanner = useScanner();
  const [spinning, setSpinning] = useState(false);
  const handleReset = () => {
    if (spinning) return;
    setSpinning(true);
    scanner.resetAll();
    toast.success('All engines reset · feeds cleared');
    setTimeout(() => setSpinning(false), 800);
  };
  return (
    <button
      onClick={handleReset}
      className="text-ink-muted hover:text-warn p-1.5 rounded hover:bg-bg-700 transition-colors"
      title="Reset · clear all feeds and re-fetch market data">
      
      <RotateCcwIcon className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
    </button>);

}
function StatusDot({
  label,
  status,
  lastOk




}: {label: string;status: 'ok' | 'err' | 'pending';lastOk: number;}) {
  const c =
  status === 'ok' ? 'bg-buy' : status === 'err' ? 'bg-sell' : 'bg-warn';
  const ago = lastOk ? Math.round((Date.now() - lastOk) / 1000) : null;
  const title =
  status === 'ok' ?
  `${label}: live · updated ${ago}s ago` :
  status === 'err' ?
  `${label}: failed — retrying automatically` :
  `${label}: connecting…`;
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-700 border border-line"
      title={title}>
      
      <span
        className={`w-1.5 h-1.5 rounded-full ${c} ${status === 'ok' ? 'dot-pulse' : ''}`} />
      
      <span className="text-3xs text-ink-muted font-mono uppercase">
        {label}
      </span>
    </div>);

}