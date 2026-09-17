import type { PairDef, Timeframe } from './types';

export const PAIRS_LIST: PairDef[] = [
{
  id: 'XAUUSD',
  label: 'XAU/USD',
  type: 'commodity',
  decimals: 2,
  source: 'gold-api',
  pip: 0.01
},
{
  id: 'EURUSD',
  label: 'EUR/USD',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'GBPUSD',
  label: 'GBP/USD',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'USDJPY',
  label: 'USD/JPY',
  type: 'forex',
  decimals: 3,
  source: 'frankfurter',
  pip: 0.01
},
{
  id: 'USDCHF',
  label: 'USD/CHF',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'AUDUSD',
  label: 'AUD/USD',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'USDCAD',
  label: 'USD/CAD',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'NZDUSD',
  label: 'NZD/USD',
  type: 'forex',
  decimals: 5,
  source: 'frankfurter',
  pip: 0.0001
},
{
  id: 'BTCUSD',
  label: 'BTC',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.1
},
{
  id: 'ETHUSD',
  label: 'ETH',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'SOLUSD',
  label: 'SOL',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'XRPUSD',
  label: 'XRP',
  type: 'crypto',
  decimals: 4,
  source: 'coingecko',
  pip: 0.0001
},
{
  id: 'ADAUSD',
  label: 'ADA',
  type: 'crypto',
  decimals: 4,
  source: 'coingecko',
  pip: 0.0001
},
{
  id: 'DOGEUSD',
  label: 'DOGE',
  type: 'crypto',
  decimals: 5,
  source: 'coingecko',
  pip: 0.00001
},
{
  id: 'AVAXUSD',
  label: 'AVAX',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'DOTUSD',
  label: 'DOT',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'LINKUSD',
  label: 'LINK',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'MATICUSD',
  label: 'MATIC',
  type: 'crypto',
  decimals: 4,
  source: 'coingecko',
  pip: 0.0001
},
{
  id: 'UNIUSD',
  label: 'UNI',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'LTCUSD',
  label: 'LTC',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'BCHUSD',
  label: 'BCH',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'APTUSD',
  label: 'APT',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'SUIUSD',
  label: 'SUI',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'ARBUSD',
  label: 'ARB',
  type: 'crypto',
  decimals: 4,
  source: 'coingecko',
  pip: 0.0001
},
{
  id: 'OPUSD',
  label: 'OP',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'INJUSD',
  label: 'INJ',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'NEARUSD',
  label: 'NEAR',
  type: 'crypto',
  decimals: 2,
  source: 'coingecko',
  pip: 0.01
},
{
  id: 'FETUSD',
  label: 'FET',
  type: 'crypto',
  decimals: 4,
  source: 'coingecko',
  pip: 0.0001
},
{
  id: 'PEPEUSD',
  label: 'PEPE',
  type: 'crypto',
  decimals: 8,
  source: 'coingecko',
  pip: 0.00000001
},
{
  id: 'SHIBUSD',
  label: 'SHIB',
  type: 'crypto',
  decimals: 8,
  source: 'coingecko',
  pip: 0.00000001
}];


export const COINGECKO_MAP: Record<string, string> = {
  BTCUSD: 'bitcoin',
  ETHUSD: 'ethereum',
  SOLUSD: 'solana',
  XRPUSD: 'ripple',
  ADAUSD: 'cardano',
  DOGEUSD: 'dogecoin',
  AVAXUSD: 'avalanche-2',
  DOTUSD: 'polkadot',
  LINKUSD: 'chainlink',
  MATICUSD: 'matic-network',
  UNIUSD: 'uniswap',
  LTCUSD: 'litecoin',
  BCHUSD: 'bitcoin-cash',
  APTUSD: 'aptos',
  SUIUSD: 'sui',
  ARBUSD: 'arbitrum',
  OPUSD: 'optimism',
  INJUSD: 'injective-protocol',
  NEARUSD: 'near',
  FETUSD: 'fetch-ai',
  PEPEUSD: 'pepe',
  SHIBUSD: 'shiba-inu'
};

export const FOREX_PAIRS: Array<{id: string;from: string;to: string;}> = [
{ id: 'EURUSD', from: 'EUR', to: 'USD' },
{ id: 'GBPUSD', from: 'GBP', to: 'USD' },
{ id: 'USDJPY', from: 'USD', to: 'JPY' },
{ id: 'USDCHF', from: 'USD', to: 'CHF' },
{ id: 'AUDUSD', from: 'AUD', to: 'USD' },
{ id: 'USDCAD', from: 'USD', to: 'CAD' },
{ id: 'NZDUSD', from: 'NZD', to: 'USD' }];


export const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
export const TF_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000
};

export function findPair(id: string): PairDef | undefined {
  return PAIRS_LIST.find((p) => p.id === id);
}

export function fmt(pairId: string, v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v)) return '---';
  const p = findPair(pairId);
  const d = p?.decimals ?? 2;
  return v.toFixed(d);
}