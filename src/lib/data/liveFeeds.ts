import type {
  MarketBias,
  NewsCategory,
  NewsFeedResponse,
  NewsHeadline,
  NewsImpact } from
'./newsSources';
import { LIVE_NEWS_SOURCES } from './newsSources';
import type {
  CalendarFeedResponse,
  EconomicEvent,
  EconomicImpact } from
'./economicCalendar';
import { toFetchSignal, type AbortSignalLike } from '../utils/abortController';

const PROXIES = [
(url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
(url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
(url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
(url: string) => `https://r.jina.ai/${url}`];


const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const NEWS_CACHE_MS = 4 * 60_000;
const CALENDAR_CACHE_MS = 9 * 60_000;
let newsMemoryCache: NewsFeedResponse | null = null;
let calendarMemoryCache: CalendarFeedResponse | null = null;

async function fetchApiFeed<T>(path: string, signal?: AbortSignalLike): Promise<T> {
  const response = await fetch(path, {
    signal: signal ? toFetchSignal(signal) : undefined,
    headers: { Accept: 'application/json' }
  });
  const payload = (await response.json().catch(() => ({}))) as T & {error?: string;};
  if (!response.ok) throw new Error(payload.error || 'Live feed is temporarily unavailable.');
  return payload;
}

interface ParsedFeedItem {
  title: string;
  link: string;
  description: string;
  published: string;
}

async function fetchTextWithFallback(
url: string,
signal?: AbortSignalLike,
validate?: (text: string) => boolean)
: Promise<string> {
  let lastError: unknown = null;
  for (const makeUrl of PROXIES) {
    try {
      const response = await withRequestTimeout(
        fetch(makeUrl(url), {
          signal: signal ? toFetchSignal(signal) : undefined,
          headers: { Accept: 'application/xml,text/xml,text/plain,*/*' }
        }),
        7_000
      );
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const text = await response.text();
      if (text.trim() && (!validate || validate(text))) return text;
      lastError = new Error('Proxy returned an unreadable feed.');
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All free proxy sources failed.');
}

function withRequestTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Feed source timed out.')), timeoutMs);
    request.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function xmlDocument(text: string): XMLDocument | null {
  const document = new DOMParser().parseFromString(text, 'text/xml');
  return document.querySelector('parsererror') ? null : document;
}

function textFrom(element: Element, selectors: string): string {
  return element.querySelector(selectors)?.textContent?.trim() || '';
}

function linkFrom(element: Element): string {
  const candidates = Array.from(element.querySelectorAll('link'));
  const alternate = candidates.find((candidate) =>
  !candidate.getAttribute('rel') || candidate.getAttribute('rel') === 'alternate'
  );
  return alternate?.getAttribute('href')?.trim() || alternate?.textContent?.trim() || '';
}

function parseFeed(text: string): ParsedFeedItem[] {
  const document = xmlDocument(text);
  if (!document) return [];
  return Array.from(document.querySelectorAll('item, entry')).
  slice(0, 40).
  map((item) => ({
    title: textFrom(item, 'title'),
    link: linkFrom(item),
    description: textFrom(item, 'description, summary, content'),
    published: textFrom(item, 'pubDate, published, updated, dc\\:date')
  })).
  filter((item) => item.title);
}

function stripMarkup(value: string): string {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return (parsed.body.textContent || value).replace(/\s+/g, ' ').trim();
}

function inferCategory(title: string, source: string): NewsCategory {
  const value = `${title} ${source}`.toLowerCase();
  if (/bitcoin|crypto|ethereum|btc|eth|blockchain/.test(value)) return 'CRYPTO';
  if (/gold|xau|oil|commodity|silver/.test(value)) return 'COMMODITIES';
  if (/fed|ecb|boj|boe|central bank|rate decision/.test(value)) return 'CENTRAL BANKS';
  if (/inflation|cpi|ppi|prices/.test(value)) return 'INFLATION';
  if (/jobs|payroll|employment|unemployment|labor/.test(value)) return 'LABOR';
  if (/war|tariff|sanction|geopolit/.test(value)) return 'GEOPOLITICS';
  if (/forex|currency|dollar|euro|yen|pound|usd|eur|jpy|gbp/.test(value)) return 'FOREX';
  return 'MACRO';
}

function inferImpact(title: string): NewsImpact {
  const value = title.toLowerCase();
  if (/breaking|rate decision|nonfarm|nfp|cpi|inflation|fomc|war|emergency|crash/.test(value)) return 'high';
  if (/fed|ecb|boj|boe|jobs|gdp|yield|tariff|sanction|opec/.test(value)) return 'medium';
  return 'low';
}

function inferBias(title: string): MarketBias {
  const value = title.toLowerCase();
  const bullish = /rally|rise|gain|surge|bull|record high|beats|stronger/.test(value);
  const bearish = /fall|drop|slump|bear|selloff|misses|weaker|risk-off/.test(value);
  if (bullish && bearish) return 'mixed';
  if (bullish) return 'bullish';
  if (bearish) return 'bearish';
  return 'neutral';
}

function affectedPairs(category: NewsCategory): string[] {
  if (category === 'CRYPTO') return ['BTCUSDT', 'ETHUSDT'];
  if (category === 'COMMODITIES') return ['XAUUSD', 'XAGUSD'];
  if (category === 'FOREX' || category === 'CENTRAL BANKS') return ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];
  return ['XAUUSD', 'DXY'];
}

function toHeadline(item: ParsedFeedItem, source: string, fallbackUrl: string): NewsHeadline {
  const category = inferCategory(item.title, source);
  const impact = inferImpact(item.title);
  const time = Date.parse(item.published);
  return {
    id: `${source}:${item.link || item.title}`,
    time: Number.isFinite(time) ? time : Date.now(),
    source,
    sourceUrl: item.link || fallbackUrl,
    category,
    impact,
    impactReason: `${impact.toUpperCase()} keyword-derived market relevance`,
    headline: stripMarkup(item.title),
    body: stripMarkup(item.description).slice(0, 360) || 'Open the publisher source for the full report.',
    pairs: affectedPairs(category),
    marketBias: inferBias(item.title),
    marketContext: 'Publisher headline context only; confirm against live price and market structure.',
    confirmationRequired: 'Confirm liquidity, structure and order flow before taking a trade.'
  };
}

export async function fetchLiveNews(signal?: AbortSignalLike): Promise<NewsFeedResponse> {
  if (newsMemoryCache && Date.now() - newsMemoryCache.fetchedAt < NEWS_CACHE_MS) {
    return newsMemoryCache;
  }
  try {
    const response = await fetchApiFeed<NewsFeedResponse>('/api/news', signal);
    if (response.items?.length) {
      newsMemoryCache = response;
      return response;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('[feeds] Cached news API unavailable; using browser fallback');
  }

  const results = await Promise.allSettled(
    LIVE_NEWS_SOURCES.map(async (source) => {
      const text = await fetchTextWithFallback(
        source.url,
        signal,
        (candidate) => parseFeed(candidate).length > 0
      );
      const items = parseFeed(text).map((item) => toHeadline(item, source.name, source.url));
      if (!items.length) throw new Error('No readable RSS items returned.');
      return { source, items };
    })
  );

  const sourceStatus = results.map((result, index) => ({
    source: LIVE_NEWS_SOURCES[index].name,
    ok: result.status === 'fulfilled',
    itemCount: result.status === 'fulfilled' ? result.value.items.length : 0,
    ...(result.status === 'rejected' ?
    { message: result.reason instanceof Error ? result.reason.message : 'Source unavailable' } :
    {})
  }));
  const seen = new Set<string>();
  const items = results.
  flatMap((result) => result.status === 'fulfilled' ? result.value.items : []).
  filter((item) => {
    const key = item.headline.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).
  sort((a, b) => b.time - a.time);

  if (!items.length) throw new Error('All live news sources are temporarily unavailable.');
  const response = { items, fetchedAt: Date.now(), sourceStatus };
  newsMemoryCache = response;
  return response;
}

function calendarImpact(value: string): EconomicImpact {
  const normalized = value.toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('medium')) return 'medium';
  return 'low';
}

function currencyMeta(currency: string) {
  const map: Record<string, {country: string;flag: string;affected: string[];}> = {
    USD: { country: 'United States', flag: '🇺🇸', affected: ['XAUUSD', 'DXY', 'EURUSD'] },
    EUR: { country: 'Eurozone', flag: '🇪🇺', affected: ['EURUSD', 'XAUUSD'] },
    GBP: { country: 'United Kingdom', flag: '🇬🇧', affected: ['GBPUSD', 'XAUUSD'] },
    JPY: { country: 'Japan', flag: '🇯🇵', affected: ['USDJPY', 'XAUUSD'] },
    CAD: { country: 'Canada', flag: '🇨🇦', affected: ['USDCAD'] },
    AUD: { country: 'Australia', flag: '🇦🇺', affected: ['AUDUSD'] },
    NZD: { country: 'New Zealand', flag: '🇳🇿', affected: ['NZDUSD'] },
    CHF: { country: 'Switzerland', flag: '🇨🇭', affected: ['USDCHF'] }
  };
  return map[currency] || { country: currency, flag: '🌐', affected: [currency] };
}

function zonedDateTimeToUtc(
year: number,
month: number,
day: number,
hour: number,
minute: number,
timeZone: string)
: number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(guess));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
  Number(parts.find((part) => part.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute')
  );
  return guess - (representedAsUtc - guess);
}

function parseCalendarTimestamp(dateValue: string, timeValue: string): number {
  const match = dateValue.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (!match) return Date.parse(`${dateValue} ${timeValue}`);
  const [, month, day, year] = match;
  const normalizedTime = timeValue.trim().toLowerCase();
  if (!normalizedTime || normalizedTime === 'all day' || normalizedTime === 'tentative') {
    return zonedDateTimeToUtc(Number(year), Number(month), Number(day), 12, 0, 'America/New_York');
  }
  const clock = normalizedTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
  if (!clock) {
    return zonedDateTimeToUtc(Number(year), Number(month), Number(day), 12, 0, 'America/New_York');
  }
  let hour = Number(clock[1]) % 12;
  if (clock[3] === 'pm') hour += 12;
  return zonedDateTimeToUtc(
    Number(year),
    Number(month),
    Number(day),
    hour,
    Number(clock[2]),
    'America/New_York'
  );
}

function parseCalendar(text: string): EconomicEvent[] {
  const document = xmlDocument(text);
  if (!document) return [];
  return Array.from(document.querySelectorAll('event')).map((element, index) => {
    const currency = textFrom(element, 'country, currency').toUpperCase() || 'USD';
    const meta = currencyMeta(currency);
    const title = textFrom(element, 'title, event') || 'Economic event';
    const date = textFrom(element, 'date');
    const time = textFrom(element, 'time');
    const timestamp = parseCalendarTimestamp(date, time);
    const sourceUrl = textFrom(element, 'url') || CALENDAR_URL;
    return {
      id: `${currency}:${date}:${time}:${title}:${index}`,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      country: meta.country,
      currency,
      flag: meta.flag,
      event: title,
      category: 'Economic calendar',
      impact: calendarImpact(textFrom(element, 'impact')),
      previous: textFrom(element, 'previous') || '—',
      forecast: textFrom(element, 'forecast') || '—',
      actual: textFrom(element, 'actual') || undefined,
      affected: meta.affected,
      source: 'Forex Factory / Fair Economy',
      sourceUrl
    };
  });
}

export async function fetchLiveCalendar(signal?: AbortSignalLike): Promise<CalendarFeedResponse> {
  if (calendarMemoryCache && Date.now() - calendarMemoryCache.fetchedAt < CALENDAR_CACHE_MS) {
    return calendarMemoryCache;
  }
  try {
    const response = await fetchApiFeed<CalendarFeedResponse>('/api/calendar', signal);
    if (response.events?.length) {
      calendarMemoryCache = response;
      return response;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('[feeds] Cached calendar API unavailable; using browser fallback');
  }

  const text = await fetchTextWithFallback(
    CALENDAR_URL,
    signal,
    (candidate) => parseCalendar(candidate).length > 0
  );
  const events = parseCalendar(text).sort((a, b) => a.timestamp - b.timestamp);
  if (!events.length) throw new Error('The weekly calendar feed returned no readable events.');
  const response = {
    events,
    fetchedAt: Date.now(),
    source: 'Forex Factory / Fair Economy weekly XML'
  };
  calendarMemoryCache = response;
  return response;
}