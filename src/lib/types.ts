export interface OhlcCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type AssetType = 'GOLD' | 'DXY';

export type Timeframe = '15m' | '1h' | '4h' | '1d' | '1w' | '1mo';

export type MarketDataStatus = 'ok' | 'partial' | 'unavailable';

export type FinalSignal =
'STRONG_BUY' |
'BUY' |
'WEAK_BUY' |
'NEUTRAL' |
'WEAK_SELL' |
'SELL' |
'STRONG_SELL';

export interface MarketDataResult {
  asset: AssetType;
  timeframe: Timeframe;
  candles: OhlcCandle[];
  status: MarketDataStatus;
  source?: string;
  marketTimestamp?: number;
  isStale?: boolean;
  error?: string;
}

export interface SMTDivergence {
  type: 'BULLISH_SMT' | 'BEARISH_SMT';
  direction: 'BUY' | 'SELL';
  signal: string;
  gold_low_1?: number;
  gold_low_2?: number;
  dxy_low_1?: number;
  dxy_low_2?: number;
  gold_high_1?: number;
  gold_high_2?: number;
  dxy_high_1?: number;
  dxy_high_2?: number;
}

export interface TimeframeResult {
  timeframe: Timeframe;
  dataStatus: 'ok' | 'partial';
  goldCandles: number;
  dxyCandles: number;
  goldSource?: string;
  dxySource?: string;
  latestMarketTimestamp: number | null;
  stale: boolean;
  inverseConfirmed: boolean;
  correlation: number | null;
  divergences: SMTDivergence[];
}

export interface ScanResult {
  timestamp: string;
  timeframes: Record<Timeframe, TimeframeResult>;
  summary: {
    totalTimeframes: number;
    availableTimeframes: number;
    totalDivergences: number;
    buyTimeframes: Timeframe[];
    sellTimeframes: Timeframe[];
    finalSignal: FinalSignal;
    confluenceScore: number;
  };
}

export type MarketDataCollection = Partial<
  Record<Timeframe, MarketDataResult>>;