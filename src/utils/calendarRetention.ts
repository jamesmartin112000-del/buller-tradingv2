import type { EconomicEvent } from '../lib/data/economicCalendar';

const STORAGE_KEY = 'buller_cached_calendar';

interface CachedCalendar {
  fetchedAt: number;
  events: EconomicEvent[];
}

export function loadCachedCalendar(): CachedCalendar | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCalendar;
    if (!Array.isArray(parsed.events) || !Number.isFinite(parsed.fetchedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedCalendar(events: EconomicEvent[], fetchedAt = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt, events }));
  } catch {

    // Live calendar stays usable if local storage is unavailable.
  }}