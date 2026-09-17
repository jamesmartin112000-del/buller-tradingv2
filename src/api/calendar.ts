import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, sanitizePublicApiError } from './_lib/http';
import type {
  CalendarFeedResponse,
  EconomicEvent,
  EconomicImpact } from
'../lib/data/economicCalendar';

const SOURCE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CACHE_MS = 10 * 60 * 1000;
let cachedFeed: CalendarFeedResponse | null = null;
let cachedUntil = 0;

const COUNTRY: Record<string, {country: string;flag: string;}> = {
  USD: { country: 'United States', flag: '🇺🇸' },
  EUR: { country: 'Eurozone', flag: '🇪🇺' },
  GBP: { country: 'United Kingdom', flag: '🇬🇧' },
  JPY: { country: 'Japan', flag: '🇯🇵' },
  CAD: { country: 'Canada', flag: '🇨🇦' },
  AUD: { country: 'Australia', flag: '🇦🇺' },
  CHF: { country: 'Switzerland', flag: '🇨🇭' },
  NZD: { country: 'New Zealand', flag: '🇳🇿' },
  CNY: { country: 'China', flag: '🇨🇳' }
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function value(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function category(title: string): string {
  const lower = title.toLowerCase();
  if (/rate|central bank|fomc|speech|press conference/.test(lower)) return 'Central bank';
  if (/cpi|pce|inflation|price/.test(lower)) return 'Inflation';
  if (/employment|payroll|job|unemployment/.test(lower)) return 'Labor';
  if (/gdp|growth/.test(lower)) return 'Growth';
  if (/pmi|production|manufacturing/.test(lower)) return 'Business activity';
  if (/retail|consumer|confidence/.test(lower)) return 'Consumer';
  return 'Macro';
}

function affected(currency: string): string[] {
  const map: Record<string, string[]> = {
    USD: ['DXY', 'EURUSD', 'XAUUSD', 'BTCUSD'],
    EUR: ['EURUSD', 'EURGBP'],
    GBP: ['GBPUSD', 'EURGBP'],
    JPY: ['USDJPY', 'EURJPY'],
    CAD: ['USDCAD'],
    AUD: ['AUDUSD'],
    CHF: ['USDCHF'],
    NZD: ['NZDUSD'],
    CNY: ['USDCNH', 'XAUUSD']
  };
  return map[currency] || [currency];
}

function impact(raw: string): EconomicImpact {
  const lower = raw.toLowerCase();
  if (lower.includes('high')) return 'high';
  if (lower.includes('medium')) return 'medium';
  return 'low';
}

export default async function calendar(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    // This is public macro data, so it must not fail because a Firebase Admin
    // credential or user profile is unavailable.
    if (cachedFeed && Date.now() < cachedUntil) {
      response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
      return response.status(200).json(cachedFeed);
    }
    const upstream = await fetch(SOURCE_URL, {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json', 'User-Agent': 'BullerTrading/1.0' }
    });
    if (!upstream.ok) throw new HttpError(502, 'Economic calendar provider is temporarily unavailable.');
    const payload = await upstream.json();
    if (!Array.isArray(payload)) throw new HttpError(502, 'Economic calendar provider returned an invalid response.');
    const events: EconomicEvent[] = payload.map((raw, index) => {
      const item = record(raw);
      const currency = String(item.country || '').toUpperCase();
      const location = COUNTRY[currency] || { country: currency || 'Global', flag: '🌐' };
      const timestamp = new Date(String(item.date || '')).getTime();
      const title = String(item.title || 'Economic event');
      return {
        id: `calendar-${currency}-${timestamp}-${index}`,
        timestamp,
        country: location.country,
        currency,
        flag: location.flag,
        event: title,
        category: category(title),
        impact: impact(String(item.impact || '')),
        previous: value(item.previous),
        forecast: value(item.forecast),
        actual: value(item.actual) === '—' ? undefined : value(item.actual),
        affected: affected(currency),
        source: 'Forex Factory calendar feed',
        sourceUrl: SOURCE_URL
      };
    }).filter((event) => Number.isFinite(event.timestamp)).
    sort((a, b) => a.timestamp - b.timestamp);
    if (!events.length) throw new HttpError(502, 'No verified economic events were returned by the provider.');
    const feed = {
      events,
      fetchedAt: Date.now(),
      source: 'Forex Factory calendar feed via FairEconomy'
    } satisfies CalendarFeedResponse;
    cachedFeed = feed;
    cachedUntil = Date.now() + CACHE_MS;
    response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return response.status(200).json(feed);
  } catch (error) {
    const safe = sanitizePublicApiError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}