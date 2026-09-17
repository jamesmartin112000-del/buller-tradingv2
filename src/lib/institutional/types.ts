export interface InstitutionalCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type InstitutionalTimeframe =
'1m' |
'5m' |
'15m' |
'30m' |
'1h' |
'4h' |
'1d' |
'1w';

export interface Level2Entry {
  price: number;
  size: number;
  orders: number;
  type: 'bid' | 'ask';
}

export interface OrderBookSnapshot {
  timestamp: number;
  bids: Level2Entry[];
  asks: Level2Entry[];
  spread: number;
  midPrice: number;
  imbalance: number;
}

export interface AbsorptionSignal {
  price: number;
  side: 'buy' | 'sell';
  intensity: number;
  volumeAccumulated: number;
  isActive: boolean;
}

export interface DomAnalysis {
  snapshot: OrderBookSnapshot;
  absorption: AbsorptionSignal | null;
  walls: Level2Entry[];
  icebergDetection: boolean;
  stackedBook: boolean;
  spoofingAlert: boolean;
}

export interface PriceLevel {
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  totalVolume: number;
  trades: number;
}

export interface FootprintCandle {
  timestamp: number;
  priceLevels: PriceLevel[];
  open: number;
  close: number;
  high: number;
  low: number;
  totalDelta: number;
  cumulativeDelta: number;
  maxDelta: number;
  minDelta: number;
  pvp: number;
  bidVolume: number;
  askVolume: number;
  imbalance: number;
}

export interface DeltaAnalysis {
  currentDelta: number;
  cumulativeDelta: number;
  deltaDivergence: boolean;
  divergenceType: 'bullish' | 'bearish' | null;
  deltaFlip: boolean;
  flipDirection: 'up' | 'down' | null;
  absorptionDetected: boolean;
  exhaustionDetected: boolean;
}

export interface HvnNode {
  price: number;
  volume: number;
  isPoc: boolean;
  type: 'support' | 'resistance' | 'neutral';
}

export interface LvnNode {
  priceLow: number;
  priceHigh: number;
  gapVolume: number;
  expectedMoveSpeed: 'fast' | 'veryFast';
}

export interface VolumeProfile {
  poc: number;
  vah: number;
  val: number;
  valueAreaWidth: number;
  highVolumeNodes: HvnNode[];
  lowVolumeNodes: LvnNode[];
  totalVolume: number;
  sessionType: 'balanced' | 'trending' | 'doubleDistribution';
}

export interface BigTrade {
  timestamp: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell';
  significance: number;
  type: 'accumulation' | 'distribution' | 'iceberg';
  description: string;
}

export interface PriceZone {
  priceLow: number;
  priceHigh: number;
  volume: number;
  tradeCount: number;
  strength: number;
}

export interface WhaleAnalysis {
  bigTrades: BigTrade[];
  accumulationZones: PriceZone[];
  distributionZones: PriceZone[];
  whaleBias: 'bullish' | 'bearish' | 'neutral';
  recentActivity: 'high' | 'moderate' | 'low';
}

export interface VwapResult {
  vwap: number;
  upperBand1: number;
  lowerBand1: number;
  upperBand2: number;
  lowerBand2: number;
  upperBand3: number;
  lowerBand3: number;
  priceRelative: 'above' | 'below' | 'at';
  deviation: number;
}

export interface VolumeImprint {
  delta: number;
  deltaMA: number;
  volume: number;
  volumeMA: number;
  imbalance: number;
  absorption: number;
  divergence: boolean;
  divergenceType: 'bullish' | 'bearish' | null;
  spikeDetected: boolean;
  spikeIntensity: number;
}

export interface OhlcLevels {
  dailyHigh: number;
  dailyLow: number;
  dailyOpen: number;
  previousClose: number;
  weeklyHigh: number;
  weeklyLow: number;
  monthlyHigh: number;
  monthlyLow: number;
  gapUp: boolean;
  gapDown: boolean;
  gapFilled: boolean;
}

export type FormulaSignal =
'STRONG_BUY' |
'BUY' |
'WEAK_BUY' |
'NEUTRAL' |
'WEAK_SELL' |
'SELL' |
'STRONG_SELL';

export interface TradeFormulaResult {
  absorptionScore: number;
  aggressionScore: number;
  deltaFlipScore: number;
  totalScore: number;
  signal: FormulaSignal;
  confidence: number;
}

export interface SniperCondition {
  name: string;
  met: boolean;
  details: string;
}

export interface SniperEntry {
  ready: boolean;
  direction: 'BUY' | 'SELL' | null;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskReward: number;
  conditions: SniperCondition[];
}

export interface KeyLevel {
  price: number;
  type: 'support' | 'resistance' | 'poc' | 'vwap' | 'dailyHigh' | 'dailyLow';
  strength: number;
}

export interface FullAnalysisSummary {
  trend: 'bullish' | 'bearish' | 'neutral';
  session: 'asia' | 'london' | 'ny' | 'overlap';
  volumeProfile: string;
  deltaStatus: string;
  domStatus: string;
  whaleActivity: string;
  formulaScore: number;
  confluenceCount: number;
}

export interface TradeSignal {
  timestamp: number;
  asset: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  strength: 1 | 2 | 3;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  confidence: number;
  reasons: string[];
  levels: KeyLevel[];
  analysis: FullAnalysisSummary;
}

export interface InstitutionalDataSource {
  label: string;
  provider: string;
  ticker: string;
  isProxy: boolean;
  delayed: boolean;
}