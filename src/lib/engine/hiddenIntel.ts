// ============================================================
// HIDDEN INTELLIGENCE + TIME THEORY — TE v5.0 ULTIMATE
// Pure-scraping institutional data layer (no API keys required).
// All network access goes through a public CORS proxy and degrades
// gracefully: if a source is unreachable, its status becomes "error"
// and the engine simply ignores it (technical analysis still runs).
// ============================================================

import { createAbortController, toFetchSignal } from '../utils/abortController';

export type SourceStatus = 'connecting' | 'connected' | 'error';

// ─── SESSION / TIME THEORY (ICT KILL ZONES) ───
export type SessionQuality = 'ULTRA' | 'HIGH' | 'MODERATE' | 'LOW';

export interface ActiveSession {
  name: string;
  quality: SessionQuality;
  /** Score bias contributed by the active session. */
  bias: number;
}

/**
 * Returns the active ICT session for the current time (converted to EST,
 * UTC-5). Kill zones get the strongest bias.
 */
export function getActiveSession(now: Date = new Date()): ActiveSession {
  // Convert to EST (UTC-5). Minutes since midnight EST.
  const estHours = (now.getUTCHours() - 5 + 24) % 24;
  const mins = estHours * 60 + now.getUTCMinutes();
  const within = (
  startH: number,
  startM: number,
  endH: number,
  endM: number) =>
  {
    const s = startH * 60 + startM;
    const e = endH * 60 + endM;
    if (s <= e) return mins >= s && mins < e;
    // wraps past midnight
    return mins >= s || mins < e;
  };

  // Order matters — most specific / highest-quality zones first.
  if (within(10, 0, 11, 0))
  return { name: 'Silver Bullet', quality: 'ULTRA', bias: 20 };
  if (within(9, 30, 10, 30))
  return { name: 'NY Open · Kill Zone', quality: 'ULTRA', bias: 20 };
  if (within(15, 0, 16, 0))
  return { name: 'NY Power Hour', quality: 'ULTRA', bias: 20 };
  if (within(2, 0, 5, 0))
  return { name: 'London Open', quality: 'HIGH', bias: 10 };
  if (within(10, 30, 12, 0))
  return { name: 'London Close', quality: 'HIGH', bias: 10 };
  if (within(16, 0, 17, 0))
  return { name: 'NY Close', quality: 'HIGH', bias: 10 };
  if (within(19, 0, 24, 0) || within(0, 0, 2, 0))
  return { name: 'Asian Session', quality: 'MODERATE', bias: 0 };
  return { name: 'Off-Hours', quality: 'LOW', bias: -10 };
}

// ─── CORS PROXY HELPER ───
const PROXIES = [
(u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
(u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`];


async function proxyFetch(
url: string,
timeoutMs = 9000)
: Promise<string | null> {
  for (const build of PROXIES) {
    const controller = createAbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(build(url), {
        cache: 'no-store',
        signal: toFetchSignal(controller.signal)
      });
      clearTimeout(timer);
      if (res.ok) {
        const txt = await res.text();
        if (txt && txt.length > 0) return txt;
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

// ─── SENTIMENT SCORING (lightweight lexicon) ───
const BULL_WORDS = [
'surge',
'jump',
'gain',
'rally',
'bullish',
'buy',
'upgrade',
'positive',
'growth',
'profit',
'beat',
'rise',
'higher',
'boost',
'soar',
'climb'];

const BEAR_WORDS = [
'drop',
'fall',
'decline',
'bearish',
'sell',
'downgrade',
'negative',
'loss',
'miss',
'crash',
'lower',
'cut',
'risk',
'fear',
'plunge',
'slump'];


export function scoreSentiment(text: string): number {
  if (!text) return 0;
  const l = text.toLowerCase();
  let s = 0;
  BULL_WORDS.forEach((w) => {
    if (l.includes(w)) s += 0.15;
  });
  BEAR_WORDS.forEach((w) => {
    if (l.includes(w)) s -= 0.15;
  });
  return Math.max(-1, Math.min(1, s));
}

// ─── RESULT SHAPES ───
export interface CongressTrade {
  politician: string;
  ticker: string;
  transaction: 'Purchase' | 'Sale';
}
export interface InsiderTrade {
  insider: string;
  transactionType: 'BUY' | 'SELL' | 'OTHER';
  shares: number;
}
export interface WhaleAlert {
  symbol: string;
  amount: string;
  toExchange: boolean;
  fromExchange: boolean;
}
export interface NewsResult {
  count: number;
  sentiment: number;
}
export interface EcoEvent {
  event: string;
  impact: 'High' | 'Medium' | 'Low';
  time: string;
}

export interface HiddenIntel {
  congress: {status: SourceStatus;items: CongressTrade[];};
  insider: {status: SourceStatus;items: InsiderTrade[];};
  whale: {status: SourceStatus;items: WhaleAlert[];};
  news: {status: SourceStatus;value: NewsResult;};
  economic: {status: SourceStatus;items: EcoEvent[];};
  session: ActiveSession;
}

function baseTicker(symbol: string): string {
  return symbol.replace('USDT', '').replace('USD', '').replace('/', '');
}

// ─── 1. CONGRESS (QuiverQuant public page scrape) ───
async function scrapeCongress(
symbol: string)
: Promise<HiddenIntel['congress']> {
  const t = baseTicker(symbol);
  try {
    const html = await proxyFetch(
      `https://www.quiverquant.com/congresstrading/${t}`
    );
    if (!html) return { status: 'error', items: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items: CongressTrade[] = [];
    doc.querySelectorAll('table tr, .trade-row').forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        const txt = (cells[2]?.textContent || '').toLowerCase();
        items.push({
          politician: (cells[0]?.textContent || 'Unknown').trim().slice(0, 40),
          ticker: t,
          transaction:
          txt.includes('buy') || txt.includes('purchase') ?
          'Purchase' :
          'Sale'
        });
      }
    });
    return {
      status: items.length > 0 ? 'connected' : 'error',
      items: items.slice(0, 5)
    };
  } catch {
    return { status: 'error', items: [] };
  }
}

// ─── 2. INSIDER (SEC EDGAR full-text search) ───
async function scrapeInsider(symbol: string): Promise<HiddenIntel['insider']> {
  const t = baseTicker(symbol);
  try {
    const raw = await proxyFetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${t}%22&forms=4`
    );
    if (!raw) return { status: 'error', items: [] };
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      return { status: 'error', items: [] };
    }
    const hits = json?.hits?.hits || [];
    const items: InsiderTrade[] = hits.slice(0, 5).map((h: any) => {
      const desc = (h?._source?.display_names?.[0] || 'Insider') as string;
      return {
        insider: desc.slice(0, 40),
        transactionType: 'OTHER' as const,
        shares: 0
      };
    });
    return {
      status: items.length > 0 ? 'connected' : 'error',
      items
    };
  } catch {
    return { status: 'error', items: [] };
  }
}

// ─── 3. WHALE (blockchain.info unconfirmed BTC transactions) ───
async function scrapeWhale(): Promise<HiddenIntel['whale']> {
  try {
    const raw = await proxyFetch(
      'https://blockchain.info/unconfirmed-transactions?format=json'
    );
    if (!raw) return { status: 'error', items: [] };
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      return { status: 'error', items: [] };
    }
    const txs: any[] = json?.txs || [];
    const items: WhaleAlert[] = [];
    for (const tx of txs) {
      const btc =
      (tx?.out?.reduce((s: number, o: any) => s + (o.value || 0), 0) || 0) /
      1e8;
      if (btc > 5) {
        const addrs = (tx?.out || []).
        map((o: any) => (o.addr || '').toLowerCase()).
        join(' ');
        items.push({
          symbol: 'BTC',
          amount: btc.toFixed(2),
          toExchange: /exchange|binance|coinbase|kraken/.test(addrs),
          fromExchange: false
        });
      }
      if (items.length >= 5) break;
    }
    return {
      status: items.length > 0 ? 'connected' : 'error',
      items
    };
  } catch {
    return { status: 'error', items: [] };
  }
}

// ─── 4. NEWS SENTIMENT (Google News headlines) ───
async function scrapeNews(symbol: string): Promise<HiddenIntel['news']> {
  const t = baseTicker(symbol);
  try {
    const html = await proxyFetch(
      `https://news.google.com/rss/search?q=${t}+stock+OR+crypto&hl=en-US&gl=US&ceid=US:en`
    );
    if (!html) return { status: 'error', value: { count: 0, sentiment: 0 } };
    const doc = new DOMParser().parseFromString(html, 'text/xml');
    const titles = Array.from(doc.querySelectorAll('item > title')).
    map((n) => n.textContent || '').
    slice(0, 12);
    if (titles.length === 0)
    return { status: 'error', value: { count: 0, sentiment: 0 } };
    const avg =
    titles.reduce((s, tt) => s + scoreSentiment(tt), 0) / titles.length;
    return {
      status: 'connected',
      value: { count: titles.length, sentiment: avg }
    };
  } catch {
    return { status: 'error', value: { count: 0, sentiment: 0 } };
  }
}

// ─── 5. ECONOMIC CALENDAR (ForexFactory scrape) ───
async function scrapeEconomic(): Promise<HiddenIntel['economic']> {
  try {
    const html = await proxyFetch('https://www.forexfactory.com/calendar');
    if (!html) return { status: 'error', items: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items: EcoEvent[] = [];
    doc.querySelectorAll('.calendar__row, tr.calendar_row').forEach((row) => {
      const ev = row.querySelector('.calendar__event, .event');
      const im = row.querySelector('.calendar__impact, .impact');
      if (ev) {
        const ic = (im?.className || '').toLowerCase();
        const impact: EcoEvent['impact'] = /high|red/.test(ic) ?
        'High' :
        /medium|orange/.test(ic) ?
        'Medium' :
        'Low';
        items.push({
          event: (ev.textContent || '').trim().slice(0, 50),
          impact,
          time: (
          row.querySelector('.calendar__time, .time')?.textContent ||
          'All Day').
          trim()
        });
      }
    });
    return {
      status: items.length > 0 ? 'connected' : 'error',
      items: items.slice(0, 8)
    };
  } catch {
    return { status: 'error', items: [] };
  }
}

/**
 * Gather ALL hidden-intelligence sources in parallel. Every source fails
 * independently — the returned object always resolves with at least the
 * active session populated.
 */
export async function gatherHiddenIntel(symbol: string): Promise<HiddenIntel> {
  const [congress, insider, whale, news, economic] = await Promise.all([
  scrapeCongress(symbol),
  scrapeInsider(symbol),
  scrapeWhale(),
  scrapeNews(symbol),
  scrapeEconomic()]
  );
  return {
    congress,
    insider,
    whale,
    news,
    economic,
    session: getActiveSession()
  };
}

export interface HiddenScore {
  score: number;
  reasons: string[];
}

/**
 * Convert gathered hidden intel into a directional score + human reasons.
 * Congress ±15, Insider ±10/trade, Whale→exchange -10 / ←exchange +10,
 * Sentiment ±20 scaled, plus the session time-bias.
 */
export function scoreHiddenIntel(h: HiddenIntel): HiddenScore {
  let score = 0;
  const reasons: string[] = [];

  const buys = h.congress.items.filter((c) => c.transaction === 'Purchase');
  const sells = h.congress.items.filter((c) => c.transaction === 'Sale');
  if (buys.length > sells.length) {
    score += 15;
    reasons.push(`Congress: ${buys.length} buys`);
  } else if (sells.length > buys.length) {
    score -= 15;
    reasons.push(`Congress: ${sells.length} sells`);
  }

  const iBuys = h.insider.items.filter((i) => i.transactionType === 'BUY');
  const iSells = h.insider.items.filter((i) => i.transactionType === 'SELL');
  score += iBuys.length * 10 - iSells.length * 10;
  if (iBuys.length) reasons.push(`Insider buys: ${iBuys.length}`);
  if (iSells.length) reasons.push(`Insider sells: ${iSells.length}`);

  const toEx = h.whale.items.filter((w) => w.toExchange).length;
  const fromEx = h.whale.items.filter((w) => w.fromExchange).length;
  if (toEx > fromEx) {
    score -= 10;
    reasons.push('Whales → exchange (sell pressure)');
  } else if (fromEx > toEx) {
    score += 10;
    reasons.push('Whales ← exchange (accumulation)');
  } else if (h.whale.items.length > 0) {
    reasons.push(`${h.whale.items.length} whale transfers detected`);
  }

  if (
  h.news.status === 'connected' &&
  Math.abs(h.news.value.sentiment) > 0.05)
  {
    const s = Math.round(h.news.value.sentiment * 20);
    score += s;
    reasons.push(`Sentiment: ${(h.news.value.sentiment * 100).toFixed(0)}%`);
  }

  score += h.session.bias;
  if (h.session.quality === 'ULTRA') reasons.push(`${h.session.name} [ULTRA]`);else
  if (h.session.quality === 'HIGH') reasons.push(`${h.session.name}`);

  return { score, reasons };
}