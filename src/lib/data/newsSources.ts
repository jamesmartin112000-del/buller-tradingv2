export type NewsCategory =
'CENTRAL BANKS' |
'INFLATION' |
'LABOR' |
'FOREX' |
'CRYPTO' |
'COMMODITIES' |
'GEOPOLITICS' |
'MACRO';

export type NewsImpact = 'high' | 'medium' | 'low';
export type MarketBias = 'bullish' | 'bearish' | 'mixed' | 'neutral';

export interface NewsHeadline {
  id: string;
  time: number;
  source: string;
  sourceUrl: string;
  category: NewsCategory;
  impact: NewsImpact;
  impactReason: string;
  headline: string;
  body: string;
  pairs: string[];
  marketBias: MarketBias;
  marketContext: string;
  confirmationRequired: string;
}

export interface NewsFeedResponse {
  items: NewsHeadline[];
  fetchedAt: number;
  sourceStatus: Array<{
    source: string;
    ok: boolean;
    itemCount: number;
    message?: string;
  }>;
}

export const LIVE_NEWS_SOURCES = [
{
  name: 'Yahoo Finance',
  url: 'https://finance.yahoo.com/rss/?s=XAUUSD',
  coverage: 'Gold, commodities and broader market reporting'
},
{
  name: 'ForexLive',
  url: 'https://www.forexlive.com/feed/news',
  coverage: 'Realtime forex, central-bank and macro reporting'
},
{
  name: 'CoinDesk',
  url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  coverage: 'Publisher-direct crypto and digital-asset reporting'
},
{
  name: 'Finviz',
  url: 'https://finviz.com/rss.ashx',
  coverage: 'Economy, equities and cross-market headlines'
}] as
const;