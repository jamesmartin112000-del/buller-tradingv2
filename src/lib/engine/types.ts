export type PairId = string;

export interface PairDef {
  id: PairId;
  label: string;
  type: 'commodity' | 'forex' | 'crypto';
  decimals: number;
  source: string;
  pip: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  time: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  closed: boolean;
}

export interface Price {
  bid: number;
  ask: number;
  mid: number;
  high24: number;
  low24: number;
  vol24: number;
  chng: number;
  ts: number;
  src: string;
  open: boolean;
}

export interface MTFEntry {
  trend: 'bullish' | 'bearish' | 'neutral';
  str: number;
  struct: 'uptrend' | 'downtrend' | 'ranging' | 'none';
  level?: number;
  rsiVal: number;
  price: number;
  high?: number;
  low?: number;
}

export interface AMDState {
  phase: 'NEUTRAL' | 'ACCUMULATION' | 'MANIPULATION' | 'DISTRIBUTION';
  conf: number;
  desc: string;
  manip?: {dir: 'bullish' | 'bearish';};
  dist?: {dir: 'bullish' | 'bearish';};
}

export interface ICTState {
  fvgs: Array<{t: 'bullish_fvg' | 'bearish_fvg';h: number;l: number;}>;
  zone: 'premium' | 'discount' | 'neutral';
  killzone: 'london_open' | 'ny_open' | 'asia_session' | 'off_peak';
}

export interface OrderFlowState {
  delta: number;
  buyPct: number;
  sellPct: number;
  imb: 'strong_buying' | 'buying' | 'neutral' | 'selling' | 'strong_selling';
}

export interface TrendsState {
  short: {dir: string;str: number;};
  medium: {dir: string;str: number;};
  long: {dir: string;str: number;};
  align: number;
}

export interface VolatilityState {
  atr: number;
  atrPct: number;
  regime: 'low' | 'normal' | 'high' | 'extreme';
}

export interface PakistanState {
  session: string;
  rh: number;
  rl: number;
  brk: {dir: 'bullish' | 'bearish';p: number;} | null;
  enty: {dir: 'bullish' | 'bearish';p: number;} | null;
  sl: number;
  tp: number;
  desc: string;
}

export interface SRLevel {
  p: number;
  tf: Timeframe;
}

export interface Confirmation {
  t: string;
  w: number;
  s: string;
}

export interface SignalSide {
  active: boolean;
  conf: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  reasons: string[];
  priority: number;
}

/**
 * Multi-entry plan — gives the trader 3 staggered entries with progressively
 * better R:R but tighter triggers. Used for the "live entry confirmation" flow.
 */
export interface EntryPlan {
  label: 'aggressive' | 'standard' | 'conservative';
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: number;
  trigger: string;
  confirmed: boolean;
}

export interface Signal {
  id: string;
  pair: PairId;
  ts: number;
  price: number;
  dir: 'BUY' | 'SELL' | 'NEUTRAL' | 'WATCH_BUY' | 'WATCH_SELL' | 'HOLD';
  str: number;
  buy: SignalSide;
  sell: SignalSide;
  confs: Confirmation[];
  action: string;
  reason: string;
  priority: {dir: string;score: number;desc: string;};
  bigPlayers: {dir: 'BUY' | 'SELL' | 'NEUTRAL';desc: string;};
  strategiesUsed: string[];
  /** Trap / manipulation warnings derived from structural context. */
  traps?: string[];
  /** Dominant trap classification when conflict between price action and structure. */
  trapDir?: 'BULL_TRAP' | 'BEAR_TRAP' | null;
  /** 3-tier entry plan (aggressive/standard/conservative). */
  entries?: EntryPlan[];
  /** Top candlestick patterns currently detected. */
  candlePatterns?: Array<{
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    strength: string;
  }>;
  /** Top chart patterns detected. */
  chartPatterns?: Array<{
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    strength: string;
    target?: number;
  }>;
  /** Snapshot of advanced indicators (Stoch, ADX, Ichimoku, etc). */
  advIndicators?: {
    stochastic?: {k: number;d: number;} | null;
    stochRsi?: {k: number;d: number;} | null;
    adx?: {adx: number;trend: string;direction: string;} | null;
    ichimoku?: {cloudBullish: boolean;priceAboveCloud: boolean;} | null;
    volume?: {ratio: number;spike: boolean;} | null;
    macdCross?: 'bullish' | 'bearish' | null;
  };
}

export interface Analysis {
  mtf: Record<Timeframe, MTFEntry>;
  amd: AMDState;
  ict: ICTState;
  of: OrderFlowState;
  sup: SRLevel[];
  res: SRLevel[];
  trends: TrendsState;
  vol: VolatilityState;
  pak: PakistanState;
  lastSignal?: Signal;
}