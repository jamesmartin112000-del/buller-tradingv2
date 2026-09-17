// Extracted from docs/Complete-Prompt-institutional-trading-engine.md (lines ~3737-3799)

export interface StrategyDef {
  rank: number;
  tier: 1 | 2 | 3;
  name: string;
  code: string;
  market: string;
  timing: string;
  winRate: number;
  confidence: 'HIGHEST' | 'HIGH' | 'MED-HIGH' | 'MED';
  setup: string[];
  why: string;
}

export const STRATEGIES: StrategyDef[] = [
{
  rank: 1,
  tier: 1,
  name: 'London Killzone Breakout',
  code: 'LONDON_KILLZONE_BREAKOUT',
  market: 'Forex Majors · EUR/USD, GBP/USD, USD/JPY',
  timing: '07:00–10:00 GMT · 12:00–15:00 PKT',
  winRate: 72,
  confidence: 'HIGHEST',
  setup: [
  'Mark 1H candle range 07:00–08:00 GMT (London first hour)',
  'Wait for breakout above/below the range',
  'Entry on retest of breakout level',
  'SL: 1.5x ATR beyond breakout level',
  'TP1: 1x range projection (close 50%) · TP2: 1.5x range'],

  why: 'London open = biggest liquidity injection of the day. Institutions execute real orders here.'
},
{
  rank: 2,
  tier: 1,
  name: 'FVG + Order Block Combo',
  code: 'FVG_ORDERBLOCK_ENTRY',
  market: 'ALL pairs · 4H zone, 15M entry',
  timing: 'Any session',
  winRate: 73,
  confidence: 'HIGH',
  setup: [
  'Wait for impulsive move on 4H (large candle with imbalance)',
  'Mark the FVG (gap between candle wicks)',
  'Mark the Order Block (candle BEFORE the impulse)',
  'Wait for price to retrace into FVG',
  'Entry at midpoint of FVG or at OB level',
  'SL below FVG low (longs) / above FVG high (shorts) · TP: next 4H swing'],

  why: 'Markets hate inefficiency → they always return to fill gaps. OB = level where institutions originally entered.'
},
{
  rank: 3,
  tier: 1,
  name: 'CVD Divergence + Liquidity Sweep',
  code: 'CVD_DIVERGENCE_LIQUIDITY_SWEEP',
  market: 'ALL · tick data CVD',
  timing: 'Any (best during sessions)',
  winRate: 68,
  confidence: 'HIGH',
  setup: [
  'Watch CVD (cumulative bid vs ask volume)',
  'BULLISH: price LL but CVD HL → buying pressure building',
  'BEARISH: price HH but CVD LH → selling pressure building',
  'Entry after sweep of swing low/high + CVD divergence',
  'SL below recent swing · TP: next liquidity level'],

  why: 'Price can be manipulated, volume cannot. Delta reveals true intent.'
},
{
  rank: 4,
  tier: 2,
  name: '5-Min Opening Range Breakout',
  code: '5MIN_ORB_INSTITUTIONAL',
  market: 'Futures (ES, NQ), Gold, BTC',
  timing: 'First 5 min of London (07:00) / NY (13:30) GMT',
  winRate: 75,
  confidence: 'HIGH',
  setup: [
  'Mark HIGH and LOW of first 5-min candle after session open',
  'Place buy stop at high, sell stop at low',
  'First to trigger = direction',
  'Wait for retrace to entry level',
  'SL: opposite side of 5-min range · TP: 2x range projection'],

  why: 'First 5 minutes = where institutions execute. They show their hand in the first candle.'
},
{
  rank: 5,
  tier: 2,
  name: 'Premium/Discount Retracement',
  code: 'PREMIUM_DISCOUNT_SWING',
  market: 'ALL · Daily range + 1H entry',
  timing: 'Any',
  winRate: 70,
  confidence: 'MED-HIGH',
  setup: [
  'Draw 30-day HIGH and LOW (monthly range)',
  'Calculate 50% midpoint',
  'Above midpoint = Premium (SELL zone) · Below = Discount (BUY zone)',
  'If price in DISCOUNT + daily trend UP → BUY at midpoint',
  'SL: monthly low/high · TP: opposite side of zone'],

  why: 'Institutions buy discount, sell premium. Retail does the opposite and gets trapped.'
},
{
  rank: 6,
  tier: 2,
  name: 'News Flow Insider',
  code: 'NEWS_FLOW_INSIDER',
  market: 'ALL · High-impact news',
  timing: 'NFP, CPI, FOMC, Interest Rates',
  winRate: 80,
  confidence: 'HIGH',
  setup: [
  'Monitor @WSJfed, UnusualWhales option flow, Binance spoof orders',
  'If 3+ sources agree on direction 30 min BEFORE news → trade',
  'Entry: 5 min before news (confident) OR 5 sec after spike (unsure)',
  'SL: 1x ATR · TP: 3x ATR'],

  why: 'Bloomberg vol 3x normal 20 min before NFP = institutions know. Follow them.'
},
{
  rank: 7,
  tier: 3,
  name: 'NY Power Hour',
  code: 'NY_LIQUIDITY_SWEEP',
  market: 'Forex + Crypto + Gold',
  timing: '13:30–15:00 GMT · 18:30–20:00 PKT',
  winRate: 68,
  confidence: 'MED',
  setup: [
  'Note HIGH/LOW of 13:30 GMT candle',
  'Place buy stop above / sell stop below',
  'SL: opposite side of 5-min range · TP: full daily ATR'],

  why: 'NY = highest volume of the day. US data (NFP, CPI) drops at 13:30 GMT.'
},
{
  rank: 8,
  tier: 3,
  name: 'Asian Fakeout Fade',
  code: 'ASIAN_FAKEOUT_FADE',
  market: 'EUR/USD, GBP/USD, Gold, BTC',
  timing: '00:00–05:00 GMT · 05:00–10:00 PKT',
  winRate: 70,
  confidence: 'MED',
  setup: [
  'If Asian session makes strong move (50+ pips EUR/USD) → fakeout',
  'Entry: opposite direction at London open',
  'SL: Asian extreme · TP: same size as fakeout'],

  why: 'Asia = thin liquidity. Big moves in Asia are manipulation; London reverses them.'
},
{
  rank: 9,
  tier: 3,
  name: 'Iceberg Order Detection',
  code: 'ICEBERG_SNIFFER_REVERSAL',
  market: 'BTC, ETH, Gold, Forex Majors',
  timing: 'Any · Level 2 DOM required',
  winRate: 73,
  confidence: 'MED',
  setup: [
  'Watch order book for replenishing bid/ask walls',
  'Bid wall moves up 1 tick after each fill = institution accumulating',
  'Limit order 0.5% behind iceberg · SL: 1x ATR · TP: full ATR projection'],

  why: 'Retail sees small orders. Institutions buy millions in small chunks. Then price explodes.'
},
{
  rank: 10,
  tier: 3,
  name: 'Open Interest Spike',
  code: 'POSITION_SIZING_LIQUIDITY',
  market: 'Crypto (BTC, ETH)',
  timing: 'Any · Binance/Bybit OI data',
  winRate: 65,
  confidence: 'MED',
  setup: [
  'Monitor OI on Binance/Bybit/Coinglass',
  'OI +10% in 1h + flat price → institutions adding → expect explosion',
  'OI –10% + flat → institutions exiting → expect crash',
  'SL: 1x ATR · TP: 3x ATR'],

  why: 'OI shows real money flowing. Price can lie, OI cannot.'
}];