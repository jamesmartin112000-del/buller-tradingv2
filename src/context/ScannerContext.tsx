import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  createContext,
  useContext } from
'react';
import { useEngine } from './EngineContext';
import { genScalpSignal, type ScalpSignal } from '../lib/engine/scalp';
import { genBigMoveSignal, type BigMoveSignal } from '../lib/engine/bigMove';
import { useLocalStorage } from '../hooks/useLocalStorage';
/**
 * ScannerContext — runs the Scalping AND Big-Move auto-scanners as
 * GLOBAL background workers that survive route changes.
 *
 * Previously each page owned its own setInterval, which meant switching
 * from Scalping → Big Move would unmount the Scalping component and
 * silently kill its scan loop. This context lifts both loops to the
 * application root so:
 *
 *   • Auto-scan stays running when the user navigates anywhere.
 *   • Both engines can be active simultaneously.
 *   • State persists across reload via localStorage.
 *   • A single "Reset" call refreshes every engine + clears feeds.
 */
const SCALP_PAIRS = [
'XAUUSD',
'EURUSD',
'GBPUSD',
'USDJPY',
'BTCUSD',
'ETHUSD',
'SOLUSD'];

const BIG_MOVE_PAIRS = [
'XAUUSD',
'EURUSD',
'GBPUSD',
'USDJPY',
'AUDUSD',
'BTCUSD',
'ETHUSD'];

export type ScalpTF = '1m' | '5m';
export type BigMoveTF = '1h' | '4h' | '1d';
interface ScannerConfig {
  scalpAuto: boolean;
  bigMoveAuto: boolean;
  scalpTF: ScalpTF;
  bigMoveTF: BigMoveTF;
  scalpStrategy: string;
  bigMoveStrategy: string;
}
interface ScannerState extends ScannerConfig {
  scalpFeed: ScalpSignal[];
  bigMoveFeed: BigMoveSignal[];
  setScalpAuto: (v: boolean) => void;
  setBigMoveAuto: (v: boolean) => void;
  setScalpTF: (v: ScalpTF) => void;
  setBigMoveTF: (v: BigMoveTF) => void;
  setScalpStrategy: (v: string) => void;
  setBigMoveStrategy: (v: string) => void;
  clearScalpFeed: () => void;
  clearBigMoveFeed: () => void;
  pushScalp: (sig: ScalpSignal) => void;
  pushBigMove: (sig: BigMoveSignal) => void;
  resetAll: () => void;
}
const DEFAULTS: ScannerConfig = {
  scalpAuto: false,
  bigMoveAuto: false,
  scalpTF: '1m',
  bigMoveTF: '4h',
  scalpStrategy: 'AUTO',
  bigMoveStrategy: 'AUTO'
};
const Ctx = createContext<ScannerState | null>(null);
export function ScannerProvider({ children }: {children: React.ReactNode;}) {
  const eng = useEngine();
  const [config, setConfig] = useLocalStorage<ScannerConfig>(
    'te.scanner.cfg',
    DEFAULTS
  );
  const [scalpFeed, setScalpFeed] = useState<ScalpSignal[]>([]);
  const [bigMoveFeed, setBigMoveFeed] = useState<BigMoveSignal[]>([]);
  const scalpIdx = useRef(0);
  const bigIdx = useRef(0);
  const engRef = useRef(eng);
  engRef.current = eng;
  const cfgRef = useRef(config);
  cfgRef.current = config;
  // === Scalp scanner loop ====================================
  useEffect(() => {
    if (!config.scalpAuto) return;
    const tick = () => {
      const e = engRef.current;
      const cfg = cfgRef.current;
      const scanPair = SCALP_PAIRS[scalpIdx.current % SCALP_PAIRS.length];
      scalpIdx.current++;
      const sp = e.pairs[scanPair];
      if (!sp || !sp.price.mid) return;
      try {
        const sig = genScalpSignal({
          pair: scanPair,
          price: sp.price,
          candles: sp.candles,
          analysis: sp.analysis,
          timeframe: cfg.scalpTF,
          strategyFilter: cfg.scalpStrategy as any
        });
        setScalpFeed((prev) => [sig, ...prev].slice(0, 24));
      } catch {}
    };
    let id: number | null = null;
    const start = () => {
      if (document.hidden || id !== null) return;
      tick();
      id = window.setInterval(tick, 12000);
    };
    const stop = () => {
      if (id !== null) window.clearInterval(id);
      id = null;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config.scalpAuto]);
  // === Big Move scanner loop ================================
  useEffect(() => {
    if (!config.bigMoveAuto) return;
    const tick = () => {
      const e = engRef.current;
      const cfg = cfgRef.current;
      const scanPair = BIG_MOVE_PAIRS[bigIdx.current % BIG_MOVE_PAIRS.length];
      bigIdx.current++;
      const sp = e.pairs[scanPair];
      if (!sp || !sp.price.mid) return;
      try {
        const sig = genBigMoveSignal({
          pair: scanPair,
          price: sp.price,
          candles: sp.candles,
          analysis: sp.analysis,
          timeframe: cfg.bigMoveTF,
          strategyFilter: cfg.bigMoveStrategy as any
        });
        setBigMoveFeed((prev) => [sig, ...prev].slice(0, 24));
      } catch {}
    };
    let id: number | null = null;
    const start = () => {
      if (document.hidden || id !== null) return;
      tick();
      id = window.setInterval(tick, 20000);
    };
    const stop = () => {
      if (id !== null) window.clearInterval(id);
      id = null;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config.bigMoveAuto]);
  const value = useMemo<ScannerState>(
    () => ({
      ...config,
      scalpFeed,
      bigMoveFeed,
      setScalpAuto: (v) =>
      setConfig({
        ...cfgRef.current,
        scalpAuto: v
      }),
      setBigMoveAuto: (v) =>
      setConfig({
        ...cfgRef.current,
        bigMoveAuto: v
      }),
      setScalpTF: (v) =>
      setConfig({
        ...cfgRef.current,
        scalpTF: v
      }),
      setBigMoveTF: (v) =>
      setConfig({
        ...cfgRef.current,
        bigMoveTF: v
      }),
      setScalpStrategy: (v) =>
      setConfig({
        ...cfgRef.current,
        scalpStrategy: v
      }),
      setBigMoveStrategy: (v) =>
      setConfig({
        ...cfgRef.current,
        bigMoveStrategy: v
      }),
      clearScalpFeed: () => setScalpFeed([]),
      clearBigMoveFeed: () => setBigMoveFeed([]),
      pushScalp: (sig) => setScalpFeed((p) => [sig, ...p].slice(0, 24)),
      pushBigMove: (sig) => setBigMoveFeed((p) => [sig, ...p].slice(0, 24)),
      resetAll: () => {
        setScalpFeed([]);
        setBigMoveFeed([]);
        scalpIdx.current = 0;
        bigIdx.current = 0;
        engRef.current.refresh();
      }
    }),
    [config, scalpFeed, bigMoveFeed, setConfig]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useScanner() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useScanner must be used within ScannerProvider');
  return ctx;
}