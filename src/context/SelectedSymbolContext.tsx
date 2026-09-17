import React, { useMemo, useState, createContext, useContext } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { AssetType } from '../lib/terminal/market';
import { SYMBOLS } from '../lib/terminal/market';
/**
 * Single source of truth for the asset the user is analysing.
 * Persisted to localStorage so the selection survives route
 * navigation AND full page reloads (fixes the "selection resets"
 * bug where each page kept its own local useState).
 */
interface SelectedSymbolCtx {
  marketType: AssetType;
  symbolId: string;
  timeframe: string;
  setMarketType: (t: AssetType) => void;
  setSymbol: (id: string) => void;
  setTimeframe: (tf: string) => void;
  /** Reset the global selection back to the Gold defaults. */
  reset: () => void;
}
const DEFAULT_MARKET: AssetType = 'metals';
const DEFAULT_SYMBOL = 'XAU';
const DEFAULT_TF = '15';
const Ctx = createContext<SelectedSymbolCtx | null>(null);
export function SelectedSymbolProvider({
  children


}: {children: React.ReactNode;}) {
  // Versioned keys intentionally migrate the previous BTC-first defaults to
  // the requested Gold-first experience without overwriting later choices.
  const [marketType, setMarketTypeRaw] = useLocalStorage<AssetType>(
    'gst.marketType.v2',
    DEFAULT_MARKET
  );
  const [symbolId, setSymbolId] = useLocalStorage<string>(
    'gst.symbolId.v2',
    DEFAULT_SYMBOL
  );
  const [timeframe, setTimeframe] = useLocalStorage<string>(
    'gst.timeframe.v2',
    DEFAULT_TF
  );
  const setMarketType = (t: AssetType) => {
    setMarketTypeRaw(t);
    // Snap the active symbol to the first symbol of the new market
    // if the current symbol does not belong to that market.
    const inMarket = SYMBOLS[t].some((s) => s.id === symbolId);
    if (!inMarket && SYMBOLS[t][0]) setSymbolId(SYMBOLS[t][0].id);
  };
  const reset = () => {
    setMarketTypeRaw(DEFAULT_MARKET);
    setSymbolId(DEFAULT_SYMBOL);
    setTimeframe(DEFAULT_TF);
  };
  const value = useMemo<SelectedSymbolCtx>(
    () => ({
      marketType,
      symbolId,
      timeframe,
      setMarketType,
      setSymbol: setSymbolId,
      setTimeframe,
      reset
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketType, symbolId, timeframe]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useSelectedSymbol() {
  const ctx = useContext(Ctx);
  if (!ctx)
  throw new Error(
    'useSelectedSymbol must be used within SelectedSymbolProvider'
  );
  return ctx;
}