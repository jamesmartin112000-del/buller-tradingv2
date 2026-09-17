import React, {
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
  useReducer } from
'react';
import type {
  Analysis,
  Candle,
  Price,
  Signal,
  Timeframe } from
'../lib/engine/types';
import { PAIRS_LIST } from '../lib/engine/pairs';
import { emptyCandleMap, makeCandle, seedCandles } from '../lib/engine/candles';
import { analyzeMTF, calcVol, detTrends, findSR } from '../lib/engine/structure';
import { detectAMD, detectICT } from '../lib/engine/smc';
import { analyzeOF } from '../lib/engine/orderflow';
import { runPak } from '../lib/engine/pakistan';
import { genSignal } from '../lib/engine/signal';
import { fetchCoinGecko, fetchForex, fetchGold } from '../lib/engine/fetchers';
interface PairState {
  price: Price;
  candles: Record<Timeframe, Candle[]>;
  analysis: Analysis;
}
type ApiStatus = 'ok' | 'err' | 'pending';
interface EngineState {
  pairs: Record<string, PairState>;
  currentPair: string;
  signals: Signal[];
  loading: boolean;
  lastUpdate: number;
  online: boolean;
  apiStatus: {
    gold: ApiStatus;
    forex: ApiStatus;
    crypto: ApiStatus;
  };
  apiLastOk: {
    gold: number;
    forex: number;
    crypto: number;
  };
  apiErrCount: {
    gold: number;
    forex: number;
    crypto: number;
  };
}
type Action =
{
  type: 'SWITCH';
  pair: string;
} |
{
  type: 'TICK';
  pair: string;
  price: Partial<Price>;
} |
{
  type: 'ANALYZE';
  pair: string;
  analysis: Analysis;
  signal: Signal | null;
} |
{
  type: 'API_STATUS';
  key: 'gold' | 'forex' | 'crypto';
  status: ApiStatus;
} |
{
  type: 'LOADING';
  v: boolean;
} |
{
  type: 'ONLINE';
  v: boolean;
};
function emptyAnalysis(): Analysis {
  return {
    mtf: {} as any,
    amd: {
      phase: 'NEUTRAL',
      conf: 0,
      desc: 'Awaiting data'
    },
    ict: {
      fvgs: [],
      zone: 'neutral',
      killzone: 'off_peak'
    },
    of: {
      delta: 0,
      buyPct: 50,
      sellPct: 50,
      imb: 'neutral'
    },
    sup: [],
    res: [],
    trends: {
      short: {
        dir: 'neutral',
        str: 0
      },
      medium: {
        dir: 'neutral',
        str: 0
      },
      long: {
        dir: 'neutral',
        str: 0
      },
      align: 0
    },
    vol: {
      atr: 0,
      atrPct: 0,
      regime: 'normal'
    },
    pak: {
      session: 'waiting',
      rh: 0,
      rl: 0,
      brk: null,
      enty: null,
      sl: 0,
      tp: 0,
      desc: 'Waiting'
    }
  };
}
function emptyPriceFor(): Price {
  return {
    bid: 0,
    ask: 0,
    mid: 0,
    high24: 0,
    low24: 0,
    vol24: 0,
    chng: 0,
    ts: Date.now(),
    src: 'loading',
    open: false
  };
}
function initialState(): EngineState {
  const pairs: Record<string, PairState> = {};
  PAIRS_LIST.forEach((p) => {
    pairs[p.id] = {
      price: emptyPriceFor(),
      candles: emptyCandleMap(),
      analysis: emptyAnalysis()
    };
  });
  return {
    pairs,
    currentPair: 'XAUUSD',
    signals: [],
    loading: true,
    lastUpdate: 0,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    apiStatus: {
      gold: 'pending',
      forex: 'pending',
      crypto: 'pending'
    },
    apiLastOk: {
      gold: 0,
      forex: 0,
      crypto: 0
    },
    apiErrCount: {
      gold: 0,
      forex: 0,
      crypto: 0
    }
  };
}
/**
 * Decide whether an incoming signal should be PREPENDED as a fresh row
 * or REPLACED into the existing latest row for that pair.
 *
 * Without dedupe, the engine emits a new BUY/SELL row every 5 seconds
 * even when nothing has changed — which on mobile causes the expanded
 * detail card to get visually pushed off the top of the list (looks
 * like the dropdown auto-closes). We replace if:
 *   - the most recent signal for that pair is < 90s old, AND
 *   - same direction, AND
 *   - same strategy set
 */
function shouldReplaceLatest(prev: Signal[], next: Signal): boolean {
  const latest = prev.find((s) => s.pair === next.pair);
  if (!latest) return false;
  if (Date.now() - latest.ts > 90000) return false;
  if (latest.dir !== next.dir) return false;
  const a = (latest.strategiesUsed || []).join('|');
  const b = (next.strategiesUsed || []).join('|');
  return a === b;
}
function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case 'SWITCH':
      return {
        ...state,
        currentPair: action.pair
      };
    case 'TICK':{
        const ps = state.pairs[action.pair];
        if (!ps) return state;
        const newPrice = {
          ...ps.price,
          ...action.price
        } as Price;
        if (newPrice.mid) {
          if (!ps.candles['1h'].length) seedCandles(ps.candles, newPrice.mid);else
          makeCandle(ps.candles, newPrice.mid, 0);
        }
        return {
          ...state,
          pairs: {
            ...state.pairs,
            [action.pair]: {
              ...ps,
              price: newPrice
            }
          },
          lastUpdate: Date.now()
        };
      }
    case 'ANALYZE':{
        const ps = state.pairs[action.pair];
        if (!ps) return state;
        const updated = {
          ...ps,
          analysis: {
            ...action.analysis,
            lastSignal: action.signal || undefined
          }
        };
        let signals = state.signals;
        if (
        action.signal && (
        action.signal.dir === 'BUY' || action.signal.dir === 'SELL'))
        {
          if (shouldReplaceLatest(state.signals, action.signal)) {
            // Update the existing latest row in place (preserves position).
            signals = state.signals.map((s) =>
            s.pair === action.signal!.pair &&
            s.dir === action.signal!.dir &&
            Date.now() - s.ts < 90000 ?
            // Keep the same id so any expanded UI state stays open
            {
              ...action.signal!,
              id: s.id
            } :
            s
            );
          } else {
            signals = [action.signal, ...state.signals].slice(0, 200);
          }
        }
        return {
          ...state,
          pairs: {
            ...state.pairs,
            [action.pair]: updated
          },
          signals
        };
      }
    case 'API_STATUS':{
        const next = {
          ...state.apiStatus,
          [action.key]: action.status
        };
        const lastOk =
        action.status === 'ok' ?
        {
          ...state.apiLastOk,
          [action.key]: Date.now()
        } :
        state.apiLastOk;
        const errCount = {
          ...state.apiErrCount
        };
        if (action.status === 'err')
        errCount[action.key] = (errCount[action.key] || 0) + 1;else
        if (action.status === 'ok') errCount[action.key] = 0;
        return {
          ...state,
          apiStatus: next,
          apiLastOk: lastOk,
          apiErrCount: errCount
        };
      }
    case 'LOADING':
      return {
        ...state,
        loading: action.v
      };
    case 'ONLINE':
      return {
        ...state,
        online: action.v
      };
    default:
      return state;
  }
}
interface EngineCtx extends EngineState {
  switchPair: (pair: string) => void;
  refresh: () => Promise<void>;
}
const Ctx = createContext<EngineCtx | null>(null);
export function EngineProvider({ children }: {children: React.ReactNode;}) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef({
    gold: false,
    forex: false,
    crypto: false
  });
  const runAnalysis = (pair: string) => {
    const ps = stateRef.current.pairs[pair];
    if (!ps || !ps.price.mid) return;
    const sr = findSR(ps.candles);
    const a: Analysis = {
      mtf: analyzeMTF(ps.candles, ps.price.mid),
      amd: detectAMD(ps.candles),
      ict: detectICT(ps.candles),
      of: analyzeOF(ps.candles),
      sup: sr.sup,
      res: sr.res,
      trends: detTrends(ps.candles),
      vol: calcVol(ps.candles),
      pak: runPak(pair, ps.candles)
    };
    const sig = genSignal(pair, ps.price, ps.candles, a);
    dispatch({
      type: 'ANALYZE',
      pair,
      analysis: a,
      signal: sig
    });
  };
  const runAllAnalysis = () => {
    PAIRS_LIST.forEach((p) => runAnalysis(p.id));
  };
  const fetchGoldOnce = async () => {
    if (inFlight.current.gold) return;
    inFlight.current.gold = true;
    dispatch({
      type: 'API_STATUS',
      key: 'gold',
      status: 'pending'
    });
    try {
      const g = await fetchGold();
      if (g) {
        dispatch({
          type: 'TICK',
          pair: 'XAUUSD',
          price: g
        });
        dispatch({
          type: 'API_STATUS',
          key: 'gold',
          status: 'ok'
        });
        runAnalysis('XAUUSD');
      } else {
        dispatch({
          type: 'API_STATUS',
          key: 'gold',
          status: 'err'
        });
      }
    } finally {
      inFlight.current.gold = false;
    }
  };
  const fetchForexOnce = async () => {
    if (inFlight.current.forex) return;
    inFlight.current.forex = true;
    dispatch({
      type: 'API_STATUS',
      key: 'forex',
      status: 'pending'
    });
    try {
      const f = await fetchForex();
      const keys = Object.keys(f);
      if (keys.length) {
        keys.forEach((pair) =>
        dispatch({
          type: 'TICK',
          pair,
          price: f[pair]
        })
        );
        dispatch({
          type: 'API_STATUS',
          key: 'forex',
          status: 'ok'
        });
        keys.forEach((p) => runAnalysis(p));
      } else {
        dispatch({
          type: 'API_STATUS',
          key: 'forex',
          status: 'err'
        });
      }
    } finally {
      inFlight.current.forex = false;
    }
  };
  const fetchCryptoOnce = async () => {
    if (inFlight.current.crypto) return;
    inFlight.current.crypto = true;
    dispatch({
      type: 'API_STATUS',
      key: 'crypto',
      status: 'pending'
    });
    try {
      const c = await fetchCoinGecko();
      const keys = Object.keys(c);
      if (keys.length) {
        keys.forEach((pair) =>
        dispatch({
          type: 'TICK',
          pair,
          price: c[pair]
        })
        );
        dispatch({
          type: 'API_STATUS',
          key: 'crypto',
          status: 'ok'
        });
        keys.forEach((p) => runAnalysis(p));
      } else {
        dispatch({
          type: 'API_STATUS',
          key: 'crypto',
          status: 'err'
        });
      }
    } finally {
      inFlight.current.crypto = false;
    }
  };
  const refresh = async () => {
    dispatch({
      type: 'LOADING',
      v: true
    });
    // If an automatic poll is already active, wait for it to finish instead of
    // silently treating the user's click as a completed refresh.
    const startedAt = Date.now();
    while (
    (inFlight.current.gold ||
    inFlight.current.forex ||
    inFlight.current.crypto) &&
    Date.now() - startedAt < 10000)
    {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await Promise.all([fetchGoldOnce(), fetchForexOnce(), fetchCryptoOnce()]);
    runAllAnalysis();
    dispatch({
      type: 'LOADING',
      v: false
    });
  };
  useEffect(() => {
    type Timer = ReturnType<typeof window.setInterval>;
    let timers: Timer[] = [];
    const visible = () => document.visibilityState === 'visible';
    const safelyRun = (task: () => void | Promise<void>) => {
      if (visible() && stateRef.current.online) void task();
    };
    const stopTimers = () => {
      timers.forEach((timer) => window.clearInterval(timer));
      timers = [];
    };
    const watchdog = () => {
      const current = stateRef.current;
      const now = Date.now();
      if (!current.online || !visible()) return;
      if (!current.apiLastOk.gold || now - current.apiLastOk.gold > 30000) {
        void fetchGoldOnce();
      }
      if (!current.apiLastOk.crypto || now - current.apiLastOk.crypto > 30000) {
        void fetchCryptoOnce();
      }
      if (!current.apiLastOk.forex || now - current.apiLastOk.forex > 90000) {
        void fetchForexOnce();
      }
    };
    const startTimers = () => {
      if (timers.length || !visible()) return;
      timers = [
      window.setInterval(() => safelyRun(fetchGoldOnce), 15000),
      window.setInterval(() => safelyRun(fetchCryptoOnce), 15000),
      window.setInterval(() => safelyRun(fetchForexOnce), 60000),
      window.setInterval(
        () => safelyRun(() => runAnalysis(stateRef.current.currentPair)),
        15000
      ),
      window.setInterval(watchdog, 30000)];

    };
    const onVisibilityChange = () => {
      if (visible()) {
        startTimers();
        void refresh();
      } else {
        stopTimers();
      }
    };
    const onFocus = () => {
      if (visible()) watchdog();
    };
    const onOnline = () => {
      dispatch({ type: 'ONLINE', v: true });
      if (visible()) {
        startTimers();
        void refresh();
      }
    };
    const onOffline = () => {
      dispatch({ type: 'ONLINE', v: false });
      stopTimers();
    };
    if (visible()) {
      void refresh();
      startTimers();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      stopTimers();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // The stable mount-only scheduler reads current values from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const value = useMemo<EngineCtx>(
    () => ({
      ...state,
      switchPair: (pair) =>
      dispatch({
        type: 'SWITCH',
        pair
      }),
      refresh
    }),
    [state]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useEngine() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}
export function useCurrentPair() {
  const eng = useEngine();
  return eng.pairs[eng.currentPair];
}