import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, sanitizePublicApiError } from './_lib/http';
import type {
  MarketBias,
  NewsCategory,
  NewsFeedResponse,
  NewsHeadline,
  NewsImpact } from
'../lib/data/newsSources';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 9000;
const SERVER_CACHE_MS = 5 * 60 * 1000;

interface SourceResult {
  source: string;
  items: NewsHeadline[];
  message?: string;
}

let cachedFeed: NewsFeedResponse | null = null;
let cachedUntil = 0;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function decodeXml(value: string): string {
  return value.
  replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').
  replace(/&nbsp;/gi, ' ').
  replace(/&amp;/gi, '&').
  replace(/&quot;/gi, '"').
  replace(/&#39;|&apos;/gi, "'").
  replace(/&lt;/gi, '<').
  replace(/&gt;/gi, '>').
  replace(/<[^>]+>/g, ' ').
  replace(/\s+/g, ' ').
  trim();
}

function xmlTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  );
  return match ? decodeXml(match[1]) : '';
}

function inferCategory(input: string): NewsCategory {
  const value = input.toLowerCase();
  if (/fed|fomc|powell|ecb|lagarde|boj|boe|central bank|interest rate/.test(value)) return 'CENTRAL BANKS';
  if (/cpi|inflation|pce|consumer price|producer price/.test(value)) return 'INFLATION';
  if (/nfp|payroll|jobs report|unemployment|jobless/.test(value)) return 'LABOR';
  if (/bitcoin|btc|ethereum|eth|crypto|solana|xrp|blockchain/.test(value)) return 'CRYPTO';
  if (/gold|silver|oil|crude|opec|brent|commodity/.test(value)) return 'COMMODITIES';
  if (/war|conflict|sanction|missile|ceasefire|geopolit/.test(value)) return 'GEOPOLITICS';
  if (/forex|currency|dollar|euro|sterling|yen|yuan|exchange rate/.test(value)) return 'FOREX';
  return 'MACRO';
}

function inferImpact(input: string): {impact: NewsImpact;reason: string;} {
  const value = input.toLowerCase();
  if (/rate decision|fomc|nonfarm|\bnfp\b|\bcpi\b|inflation report|central bank decision|intervention|war|sanction/.test(value)) {
    return { impact: 'high', reason: 'Policy, inflation, labor or geopolitical language can reprice rates, currencies and risk assets quickly.' };
  }
  if (/gdp|pmi|retail sales|jobless|unemployment|speech|minutes|oil|opec|regulation|etf/.test(value)) {
    return { impact: 'medium', reason: 'The topic can shift rate expectations, growth expectations or sector risk sentiment.' };
  }
  return { impact: 'low', reason: 'No major scheduled macro or policy catalyst was detected in the published headline.' };
}

function inferBias(input: string): MarketBias {
  const value = input.toLowerCase();
  const positive = /rally|rise|gain|surge|beat|stronger|approval|inflow|easing|rate cut/.test(value);
  const negative = /fall|drop|loss|plunge|miss|weaker|ban|outflow|tightening|rate hike|war/.test(value);
  if (positive && negative) return 'mixed';
  if (positive) return 'bullish';
  if (negative) return 'bearish';
  return 'neutral';
}

function inferPairs(input: string, category: NewsCategory): string[] {
  const value = input.toLowerCase();
  const pairs: string[] = [];
  if (/bitcoin|\bbtc\b/.test(value)) pairs.push('BTCUSD');
  if (/ethereum|\beth\b/.test(value)) pairs.push('ETHUSD');
  if (/solana|\bsol\b/.test(value)) pairs.push('SOLUSD');
  if (/gold|xau/.test(value)) pairs.push('XAUUSD');
  if (/euro|ecb|\beur\b/.test(value)) pairs.push('EURUSD');
  if (/sterling|pound|boe|\bgbp\b/.test(value)) pairs.push('GBPUSD');
  if (/yen|boj|japan|\bjpy\b/.test(value)) pairs.push('USDJPY');
  if (/canada|cad|oil|crude|opec/.test(value)) pairs.push('USDCAD');
  if (/australia|aud/.test(value)) pairs.push('AUDUSD');
  if (/swiss|chf/.test(value)) pairs.push('USDCHF');
  if (/fed|fomc|dollar|usd|cpi|payroll|nfp|inflation/.test(value)) pairs.push('EURUSD', 'XAUUSD', 'BTCUSD');
  if (!pairs.length && category === 'CRYPTO') pairs.push('BTCUSD', 'ETHUSD');
  if (!pairs.length) pairs.push('DXY', 'XAUUSD');
  return Array.from(new Set(pairs)).slice(0, 5);
}

function marketContext(category: NewsCategory, bias: MarketBias): string {
  const direction = bias === 'neutral' ? 'No clear directional language is present.' : `Published language currently reads ${bias}.`;
  const mechanism: Record<NewsCategory, string> = {
    'CENTRAL BANKS': 'Rate-path surprises usually move the relevant currency first, then gold and crypto through yields and USD liquidity.',
    INFLATION: 'A hotter or cooler confirmed release can shift yields and USD expectations; compare actual data with consensus before acting.',
    LABOR: 'Labor surprises can reprice the rate path, affecting USD pairs, gold and risk assets.',
    FOREX: 'Currency impact depends on which economy is affected and whether the news changes relative rate expectations.',
    CRYPTO: 'Crypto headlines can change risk appetite and flows, but price, volume and market structure must confirm follow-through.',
    COMMODITIES: 'Supply, demand and geopolitical changes can affect gold, oil and commodity-linked currencies.',
    GEOPOLITICS: 'Risk-off flows may support safe havens, but reactions can reverse quickly when facts change.',
    MACRO: 'Broad growth or liquidity implications may affect USD, gold, equities and crypto together.'
  };
  return `${direction} ${mechanism[category]}`;
}

function confirmationRequired(pairs: string[]): string {
  return `Not a trade signal. Confirm on live price for ${pairs.join(', ')} with structure, volume, spread and event outcome before any entry.`;
}

function makeItem(input: {
  id: string;
  time: number;
  source: string;
  sourceUrl: string;
  headline: string;
  body: string;
}): NewsHeadline | null {
  if (!input.headline || !Number.isFinite(input.time)) return null;
  const combined = `${input.headline} ${input.body}`;
  const category = inferCategory(combined);
  const pairs = inferPairs(combined, category);
  const { impact, reason } = inferImpact(combined);
  const bias = inferBias(combined);
  return {
    ...input,
    category,
    impact,
    impactReason: reason,
    pairs,
    marketBias: bias,
    marketContext: marketContext(category, bias),
    confirmationRequired: confirmationRequired(pairs)
  };
}

async function fetchRss(input: {
  source: string;
  url: string;
  defaultPublisher: string;
}): Promise<SourceResult> {
  const response = await fetch(input.url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'BullerTrading/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  if (!/<rss|<feed/i.test(xml)) throw new Error('Upstream did not return an RSS feed');
  const items = xml.
  split(/<item(?:\s[^>]*)?>/i).
  slice(1).
  map((entry, index) => {
    const headline = xmlTag(entry, 'title');
    const sourceUrl = xmlTag(entry, 'link') || xmlTag(entry, 'guid');
    const publishedAt = Date.parse(xmlTag(entry, 'pubDate') || xmlTag(entry, 'updated'));
    const publisher = xmlTag(entry, 'source') || xmlTag(entry, 'dc:creator') || input.defaultPublisher;
    const description = xmlTag(entry, 'description') || `Published by ${publisher}. Open the original report to verify full context.`;
    return makeItem({
      id: `${input.source.toLowerCase().replace(/\W+/g, '-')}-${publishedAt}-${index}`,
      time: publishedAt,
      source: publisher,
      sourceUrl,
      headline,
      body: description.slice(0, 420)
    });
  }).
  filter((item): item is NewsHeadline => item !== null);
  if (!items.length) throw new Error('Upstream RSS feed contained no valid items');
  return { source: input.source, items };
}

function fetchYahooFinance(): Promise<SourceResult> {
  return fetchRss({
    source: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/rss/?s=XAUUSD',
    defaultPublisher: 'Yahoo Finance'
  });
}

function fetchForexLive(): Promise<SourceResult> {
  return fetchRss({
    source: 'ForexLive',
    url: 'https://www.forexlive.com/feed/news',
    defaultPublisher: 'ForexLive'
  });
}

function fetchCoinDesk(): Promise<SourceResult> {
  return fetchRss({
    source: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    defaultPublisher: 'CoinDesk'
  });
}

function fetchFinviz(): Promise<SourceResult> {
  return fetchRss({
    source: 'Finviz',
    url: 'https://finviz.com/rss.ashx',
    defaultPublisher: 'Finviz'
  });
}

export default async function news(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    // Public market headlines do not require a user-profile lookup. Keeping
    // this route independent from Firebase Admin prevents an unrelated service
    // credential issue from taking the verified news feed offline.
    if (cachedFeed && Date.now() < cachedUntil) {
      response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
      return response.status(200).json(cachedFeed);
    }

    const sources = [
    { name: 'Yahoo Finance', request: fetchYahooFinance() },
    { name: 'ForexLive', request: fetchForexLive() },
    { name: 'CoinDesk', request: fetchCoinDesk() },
    { name: 'Finviz', request: fetchFinviz() }];

    const settled = await Promise.allSettled(sources.map((source) => source.request));
    const sourceStatus: NewsFeedResponse['sourceStatus'] = [];
    const combined: NewsHeadline[] = [];
    settled.forEach((result, index) => {
      const source = sources[index].name;
      if (result.status === 'fulfilled') {
        combined.push(...result.value.items);
        sourceStatus.push({ source, ok: true, itemCount: result.value.items.length });
      } else {
        console.warn(`[news] ${source} failed`, result.reason);
        sourceStatus.push({ source, ok: false, itemCount: 0, message: 'Source temporarily unavailable.' });
      }
    });
    if (!sourceStatus.some((status) => status.ok)) throw new HttpError(502, 'All verified news sources are temporarily unavailable.');
    const cutoff = Date.now() - WEEK_MS;
    const seen = new Set<string>();
    const impactRank: Record<NewsImpact, number> = { high: 3, medium: 2, low: 1 };
    const items = combined.
    filter((item) => item.time >= cutoff && item.sourceUrl && !seen.has(`${item.source}:${item.headline.toLowerCase()}`) && seen.add(`${item.source}:${item.headline.toLowerCase()}`)).
    sort((a, b) => impactRank[b.impact] - impactRank[a.impact] || b.time - a.time).
    slice(0, 160);
    if (!items.length) throw new HttpError(502, 'Verified news sources returned no current headlines.');
    const feed = { items, fetchedAt: Date.now(), sourceStatus } satisfies NewsFeedResponse;
    cachedFeed = feed;
    cachedUntil = Date.now() + SERVER_CACHE_MS;
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return response.status(200).json(feed);
  } catch (error) {
    const safe = sanitizePublicApiError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}