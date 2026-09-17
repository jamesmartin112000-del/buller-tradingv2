import type { NewsHeadline } from '../lib/data/newsSources';

const STORAGE_KEY = 'buller_cached_news';
const LEGACY_STORAGE_KEY = 'buller.market-news.current-week.v1';
const MAX_ITEMS = 600;

interface StoredNewsWeek {
  weekStart: number;
  items: NewsHeadline[];
}

export function startOfCurrentWeek(now = Date.now()): number {
  const date = new Date(now);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

export function loadCurrentWeekNews(now = Date.now()): NewsHeadline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as StoredNewsWeek;
    const weekStart = startOfCurrentWeek(now);
    if (stored.weekStart !== weekStart || !Array.isArray(stored.items)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return [];
    }
    localStorage.setItem(STORAGE_KEY, raw);
    return stored.items.filter(
      (item) => item.time >= weekStart && item.time <= now + 5 * 60_000
    );
  } catch {
    return [];
  }
}

export function mergeAndSaveCurrentWeekNews(
current: NewsHeadline[],
incoming: NewsHeadline[],
now = Date.now())
: NewsHeadline[] {
  const weekStart = startOfCurrentWeek(now);
  const seen = new Set<string>();
  const items = [...incoming, ...current].
  filter((item) => {
    if (item.time < weekStart || item.time > now + 5 * 60_000) return false;
    const key = `${item.source}:${item.headline.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).
  sort((a, b) => b.time - a.time).
  slice(0, MAX_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ weekStart, items }));
  } catch {

    // The live feed remains usable when storage is unavailable.
  }return items;
}