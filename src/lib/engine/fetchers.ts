import { createAbortController, toFetchSignal } from '../utils/abortController';
import type { Price } from './types';
import { COINGECKO_MAP, FOREX_PAIRS } from './pairs';

/**
 * Fetch helper that:
 * - disables ALL caching (browser + CDN)
 * - adds cache-buster
 * - times out after `timeoutMs`
 * - retries with exponential backoff
 */
async function freshFetch(
url: string,
opts: {timeoutMs?: number;retries?: number;} = {})
: Promise<Response | null> {
  const { timeoutMs = 8000, retries = 2 } = opts;
  const buster = `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = createAbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url + buster, {
        cache: 'no-store',
        signal: toFetchSignal(controller.signal),
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          pragma: 'no-cache'
        }
      });
      clearTimeout(timer);
      if (res.ok) return res;
    } catch (e) {
      clearTimeout(timer);
    }
    if (attempt < retries)
    await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
  }
  return null;
}

/**
 * Build a Price object from a single mid price plus optional 24h stats.
 */
function buildPrice(
mid: number,
src: string,
opts: {
  spreadBps?: number;
  high24?: number;
  low24?: number;
  chng?: number;
  vol24?: number;
} = {})
: Partial<Price> {
  const { spreadBps = 1.5, high24, low24, chng = 0, vol24 = 0 } = opts;
  const s = mid * (spreadBps / 10000);
  return {
    bid: +(mid - s / 2).toFixed(4),
    ask: +(mid + s / 2).toFixed(4),
    mid: +mid.toFixed(4),
    high24: high24 ?? mid * 1.005,
    low24: low24 ?? mid * 0.995,
    vol24,
    chng,
    ts: Date.now(),
    src,
    open: true
  };
}

/**
 * GOLD (XAU/USD) — robust multi-source fallback chain.
 *
 * Sources tried in order (all free, no API key required):
 *   1. Swissquote public BBO — direct XAU/USD bid and ask
 *   2. gold-api.com — direct XAU spot
 *   3. Binance PAXGUSDT — physical-gold-backed proxy
 *   4. Binance XAUUSDT — direct XAU pair where available
 *   5. CoinGecko pax-gold
 *   6. metals.live — secondary spot quote endpoint
 *
 * Each source is independent — if one rate-limits or fails, we move on.
 */
export async function fetchGold(): Promise<Partial<Price> | null> {
  // --- 1. Swissquote public XAU/USD BBO (real bid/ask, no key) ---
  try {
    const r = await freshFetch(
      'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
      { timeoutMs: 5000, retries: 1 }
    );
    if (r) {
      const d = await r.json();
      const rows = Array.isArray(d) ? d : [d];
      const profiles = rows.flatMap((row: any) =>
      Array.isArray(row?.spreadProfilePrices) ? row.spreadProfilePrices : []
      );
      const quote =
      profiles.find(
        (profile: any) =>
        Number.isFinite(+profile?.bid) && Number.isFinite(+profile?.ask)
      ) ?? profiles[0];
      const bid = +quote?.bid;
      const ask = +quote?.ask;
      const mid = (bid + ask) / 2;
      if (bid > 100 && ask > bid && mid < 100000) {
        return {
          ...buildPrice(mid, 'swissquote.com'),
          bid,
          ask,
          mid
        };
      }
    }
  } catch {}

  // --- 2. gold-api.com (direct XAU spot) ---
  try {
    const r = await freshFetch('https://api.gold-api.com/price/XAU', {
      timeoutMs: 5000,
      retries: 1
    });
    if (r) {
      const d = await r.json();
      const p = +d?.price;
      if (p && p > 100 && p < 100000) {
        return buildPrice(p, 'gold-api.com', { spreadBps: 1.5 });
      }
    }
  } catch {}

  // --- 3. Binance PAXGUSDT (PAX Gold — pegged 1:1 to troy oz XAU) ---
  try {
    const r = await freshFetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT',
      { timeoutMs: 5000, retries: 1 }
    );
    if (r) {
      const t = await r.json();
      const p = +t?.lastPrice;
      if (p && p > 100 && p < 100000) {
        return buildPrice(p, 'binance:PAXG', {
          spreadBps: 1.5,
          high24: +t.highPrice || undefined,
          low24: +t.lowPrice || undefined,
          chng: +t.priceChangePercent || 0,
          vol24: +t.quoteVolume || 0
        });
      }
    }
  } catch {}

  // --- 4. Binance XAUUSDT (direct, where listed) ---
  try {
    const r = await freshFetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=XAUUSDT',
      { timeoutMs: 5000, retries: 1 }
    );
    if (r) {
      const t = await r.json();
      const p = +t?.lastPrice;
      if (p && p > 100 && p < 100000) {
        return buildPrice(p, 'binance:XAU', {
          spreadBps: 1.5,
          high24: +t.highPrice || undefined,
          low24: +t.lowPrice || undefined,
          chng: +t.priceChangePercent || 0,
          vol24: +t.quoteVolume || 0
        });
      }
    }
  } catch {}

  // --- 5. CoinGecko pax-gold ---
  try {
    const r = await freshFetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true',
      { timeoutMs: 6000, retries: 1 }
    );
    if (r) {
      const d = await r.json();
      const p = +d?.['pax-gold']?.usd;
      if (p && p > 100 && p < 100000) {
        return buildPrice(p, 'coingecko:PAXG', {
          spreadBps: 1.5,
          chng: +d['pax-gold']?.usd_24h_change || 0,
          vol24: +d['pax-gold']?.usd_24h_vol || 0
        });
      }
    }
  } catch {}

  // --- 6. metals.live spot gold ---
  try {
    const r = await freshFetch('https://api.metals.live/v1/spot/gold', {
      timeoutMs: 5000,
      retries: 1
    });
    if (r) {
      const d = await r.json();
      // metals.live returns an array like [{ "2024-01-15": 2050.23 }]
      let p: number | null = null;
      if (Array.isArray(d) && d.length) {
        const last = d[d.length - 1];
        if (typeof last === 'object') {
          const v = Object.values(last)[0];
          if (typeof v === 'number') p = v;
        } else if (typeof last === 'number') {
          p = last;
        }
      } else if (typeof d?.price === 'number') {
        p = d.price;
      }
      if (p && p > 100 && p < 100000) {
        return buildPrice(p, 'metals.live', { spreadBps: 1.5 });
      }
    }
  } catch {}

  return null;
}

export async function fetchForex(): Promise<Record<string, Partial<Price>>> {
  const out: Record<string, Partial<Price>> = {};
  await Promise.all(
    FOREX_PAIRS.map(async (fp) => {
      // Primary: frankfurter.dev (free, no key)
      const res = await freshFetch(
        `https://api.frankfurter.dev/v1/latest?base=${fp.from}&symbols=${fp.to}`,
        { timeoutMs: 7000, retries: 1 }
      );
      if (res) {
        try {
          const d = await res.json();
          const rate = d?.rates?.[fp.to];
          if (rate) {
            const p = +rate;
            const s = p * 0.00012;
            out[fp.id] = {
              bid: +(p - s / 2).toFixed(5),
              ask: +(p + s / 2).toFixed(5),
              mid: p,
              high24: p * 1.002,
              low24: p * 0.998,
              vol24: 0,
              chng: 0,
              ts: Date.now(),
              src: 'frankfurter.dev',
              open: true
            };
            return;
          }
        } catch {}
      }
      // Fallback: exchangerate.host (free, no key)
      const fb = await freshFetch(
        `https://api.exchangerate.host/latest?base=${fp.from}&symbols=${fp.to}`,
        { timeoutMs: 6000, retries: 1 }
      );
      if (fb) {
        try {
          const d = await fb.json();
          const rate = d?.rates?.[fp.to];
          if (rate) {
            const p = +rate;
            const s = p * 0.00012;
            out[fp.id] = {
              bid: +(p - s / 2).toFixed(5),
              ask: +(p + s / 2).toFixed(5),
              mid: p,
              high24: p * 1.002,
              low24: p * 0.998,
              vol24: 0,
              chng: 0,
              ts: Date.now(),
              src: 'exchangerate.host',
              open: true
            };
          }
        } catch {}
      }
    })
  );
  return out;
}

export async function fetchCoinGecko(): Promise<
  Record<string, Partial<Price>>>
{
  const out: Record<string, Partial<Price>> = {};
  const ids = Object.values(COINGECKO_MAP).join(',');
  // Try CoinGecko first
  let d: any = null;
  const res = await freshFetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { timeoutMs: 8000, retries: 1 }
  );
  if (res) {
    try {
      d = await res.json();
    } catch {}
  }

  // Fallback: Binance (covers most major coins instantly)
  if (!d || Object.keys(d).length === 0) {
    const binanceRes = await freshFetch(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeoutMs: 6000, retries: 1 }
    );
    if (binanceRes) {
      try {
        const tickers: any[] = await binanceRes.json();
        const map = new Map(tickers.map((t) => [t.symbol, t]));
        Object.keys(COINGECKO_MAP).forEach((pairId) => {
          const symbol = pairId.replace('USD', 'USDT');
          const t = map.get(symbol);
          if (t) {
            const p = +t.lastPrice;
            out[pairId] = {
              bid: +t.bidPrice || p * 0.9995,
              ask: +t.askPrice || p * 1.0005,
              mid: p,
              high24: +t.highPrice || p,
              low24: +t.lowPrice || p,
              vol24: +t.quoteVolume || 0,
              chng: +t.priceChangePercent || 0,
              ts: Date.now(),
              src: 'binance.com',
              open: true
            };
          }
        });
      } catch {}
    }
    return out;
  }

  Object.entries(COINGECKO_MAP).forEach(([pair, id]) => {
    const entry = (d as any)[id];
    if (entry?.usd) {
      const p = +entry.usd;
      out[pair] = {
        bid: p * 0.9995,
        ask: p * 1.0005,
        mid: p,
        high24: p * 1.02,
        low24: p * 0.98,
        vol24: 0,
        chng: entry.usd_24h_change || 0,
        ts: Date.now(),
        src: 'coingecko',
        open: true
      };
    }
  });
  return out;
}