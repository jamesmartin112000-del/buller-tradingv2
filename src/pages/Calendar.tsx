import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarIcon,
  AlertOctagonIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ExternalLinkIcon } from
'lucide-react';
import type { EconomicEvent } from '../lib/data/economicCalendar';
import { fetchLiveCalendar } from '../lib/data/liveFeeds';
import {
  createAbortController,
  type AbortControllerLike } from
'../lib/utils/abortController';
import { loadCachedCalendar, saveCachedCalendar } from '../utils/calendarRetention';

export function Calendar() {
  const cachedCalendar = useMemo(() => loadCachedCalendar(), []);
  const [impact, setImpact] = useState<'ALL' | 'high' | 'medium' | 'low'>('ALL');
  const [currency, setCurrency] = useState('ALL');
  const [events, setEvents] = useState<EconomicEvent[]>(cachedCalendar?.events || []);
  const [loading, setLoading] = useState(!cachedCalendar?.events.length);
  const [updated, setUpdated] = useState<Date | null>(
    cachedCalendar ? new Date(cachedCalendar.fetchedAt) : null
  );
  const [source, setSource] = useState(cachedCalendar ? 'Cached Forex Factory feed' : '');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortControllerLike | null>(null);
  const hasEventsRef = useRef(events.length > 0);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = createAbortController();
    controllerRef.current = controller;
    if (!hasEventsRef.current) setLoading(true);
    try {
      const response = await fetchLiveCalendar(controller.signal);
      setEvents(response.events);
      hasEventsRef.current = response.events.length > 0;
      saveCachedCalendar(response.events, response.fetchedAt);
      setUpdated(new Date(response.fetchedAt));
      setSource(response.source);
      setError('');
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof Error ?
        caught.message :
        'Economic calendar source is temporarily unavailable.'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 10 * 60_000);
    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [load]);

  const grouped = useMemo(() => {
    const filtered = events.filter((event) => {
      if (impact !== 'ALL' && event.impact !== impact) return false;
      if (currency !== 'ALL' && event.currency !== currency) return false;
      return true;
    });
    const groups = new Map<string, EconomicEvent[]>();
    filtered.forEach((event) => {
      const key = pktDateKey(event.timestamp);
      groups.set(key, [...(groups.get(key) || []), event]);
    });
    groups.forEach((list) => list.sort((a, b) => a.timestamp - b.timestamp));
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events, impact, currency]);

  const currencies = useMemo(
    () => Array.from(new Set(events.map((event) => event.currency))).sort(),
    [events]
  );
  const timezone = 'Pakistan Standard Time (Asia/Karachi)';

  return (
    <div className="p-3 lg:p-4 space-y-3 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarIcon className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-bold tracking-tight">Economic Calendar</h1>
        <span
          className={`text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${loading ? 'bg-warn/15 text-warn' : error ? 'bg-sell/15 text-sell' : 'bg-buy/15 text-buy'}`}>
          
          {loading ? 'SYNCING' : error ? 'UNAVAILABLE' : 'LIVE'}
        </span>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded border border-line bg-bg-700 px-2 py-1 text-3xs font-bold uppercase tracking-wider text-ink-muted hover:text-ink hover:border-line-strong transition-colors">
          
          <RefreshCwIcon className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        {updated &&
        <span className="text-3xs text-ink-dim font-mono ml-auto">
            Verified {updated.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT
          </span>
        }
      </div>
      <p className="text-2xs text-ink-muted leading-relaxed">
        Real weekly macro events with previous, consensus forecast and reported actual.
        Times are converted to <strong className="text-ink">{timezone}</strong>.
        No generated or rotating sample events are shown.
      </p>

      {error &&
      <div className="bg-sell/10 border border-sell/30 rounded-md p-3 flex flex-wrap items-center gap-2" role="alert">
          <ShieldAlertIcon className="w-4 h-4 text-sell shrink-0" />
          <div className="flex-1">
            <div className="text-2xs font-bold text-sell">Live calendar temporarily unavailable</div>
            <p className="text-3xs text-ink-muted mt-0.5">
              {error} {events.length ? 'Showing the latest cached verified events.' : 'Nothing has been replaced with fake events.'}
            </p>
          </div>
          <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded border border-sell/40 px-2 py-1 text-2xs font-bold uppercase tracking-wider text-sell hover:bg-sell/10 disabled:opacity-50">
          
            Retry
          </button>
        </div>
      }

      <div className="bg-bg-600 border border-line rounded-md p-2.5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['ALL', 'high', 'medium', 'low'] as const).map((item) =>
          <button
            key={item}
            onClick={() => setImpact(item)}
            className={`px-2.5 py-1 text-2xs font-semibold rounded uppercase border ${impact === item ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink'}`}>
            
              {item === 'ALL' ? 'All impact' : item}
            </button>
          )}
        </div>
        <select
          aria-label="Filter by currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="bg-bg-700 border border-line rounded px-2 py-1.5 text-xs text-ink outline-none focus:border-brand">
          
          <option value="ALL">All currencies</option>
          {currencies.map((item) =>
          <option key={item} value={item}>
              {item}
            </option>
          )}
        </select>
        {source &&
        <span className="ml-auto text-3xs text-ink-dim">Source: {source}</span>
        }
      </div>

      <div className="space-y-3">
        {grouped.length === 0 &&
        <div className="bg-bg-600 border border-line rounded-md p-6 text-center text-2xs text-ink-muted">
            {loading ?
          'Fetching verified economic events…' :
          error ?
          events.length ?
          'No cached events match these filters.' :
          'No events shown because the live provider could not be verified.' :
          'No verified events match these filters.'}
          </div>
        }
        {grouped.map(([dateKey, list]) =>
        <section key={dateKey} className="space-y-1.5" aria-labelledby={`day-${dateKey}`}>
            <div className="flex items-center gap-2 mt-3">
              <h2 id={`day-${dateKey}`} className="text-sm font-bold text-ink">
                {new Date(list[0].timestamp).toLocaleDateString('en-PK', {
                timeZone: 'Asia/Karachi',
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
              </h2>
              {pktDateKey(Date.now()) === dateKey &&
            <span className="text-3xs uppercase font-bold tracking-wider text-brand bg-brand/10 border border-brand/30 px-1.5 py-0.5 rounded">
                  TODAY
                </span>
            }
            </div>
            <div className="bg-bg-600 border border-line rounded-md overflow-hidden">
              {list.map((event, index) =>
            <EventRow
              key={event.id}
              event={event}
              divided={index < list.length - 1}
              timezone={timezone} />

            )}
            </div>
          </section>
        )}
      </div>
    </div>);

}

function EventRow({
  event,
  divided,
  timezone




}: {event: EconomicEvent;divided: boolean;timezone: string;}) {
  const ImpactIcon =
  event.impact === 'high' ?
  AlertOctagonIcon :
  event.impact === 'medium' ?
  AlertCircleIcon :
  InfoIcon;
  const impactColor =
  event.impact === 'high' ?
  'text-sell' :
  event.impact === 'medium' ?
  'text-warn' :
  'text-blue-trade';
  const comparison = compareActual(event.actual, event.forecast);
  return (
    <article
      className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center ${divided ? 'border-b border-line/50' : ''} hover:bg-bg-500/50 transition-colors`}>
      
      <div className="col-span-3 sm:col-span-2 lg:col-span-1 font-mono text-ink-muted">
        <div>{new Date(event.timestamp).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })}</div>
        <div className="text-3xs text-ink-dim truncate" title={timezone}>{timezone}</div>
      </div>
      <div className="col-span-2 sm:col-span-1 text-center">
        <div className="text-base">{event.flag}</div>
        <div className="text-3xs text-ink-dim font-mono">{event.currency}</div>
      </div>
      <div className="col-span-7 sm:col-span-4 lg:col-span-5">
        <div className="flex items-center gap-1.5">
          <ImpactIcon className={`w-3 h-3 ${impactColor} shrink-0`} />
          <span className="font-medium">{event.event}</span>
        </div>
        <div className="text-3xs text-ink-dim mt-0.5">
          {event.country} · {event.category} · {event.impact.toUpperCase()} impact
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {event.affected.map((pair) =>
          <span key={pair} className="text-3xs bg-bg-800 border border-line rounded px-1 py-0.5 font-mono text-ink-muted">
              {pair}
            </span>
          )}
        </div>
      </div>
      <DataCell label="Previous" value={event.previous} />
      <DataCell label="Forecast" value={event.forecast} />
      <div className="col-span-4 sm:col-span-2 lg:col-span-1 text-right font-mono">
        <div className="text-3xs text-ink-dim">Actual</div>
        <div className={event.actual ? comparison === 'above' ? 'text-buy font-bold' : comparison === 'below' ? 'text-sell font-bold' : 'text-ink font-bold' : 'text-ink-dim'}>
          {event.actual || '—'}
        </div>
      </div>
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open source for ${event.event}`}
        className="col-span-12 mt-1 sm:mt-0 sm:col-span-1 lg:col-span-12 justify-self-end inline-flex items-center gap-1 text-3xs text-brand hover:underline">
        
        Verify source <ExternalLinkIcon className="w-3 h-3" />
      </a>
    </article>);

}

function DataCell({ label, value }: {label: string;value: string;}) {
  return (
    <div className="col-span-4 sm:col-span-2 lg:col-span-1 text-right font-mono">
      <div className="text-3xs text-ink-dim">{label}</div>
      <div className="text-ink-muted">{value}</div>
    </div>);

}

function pktDateKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
  parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function compareActual(actual?: string, forecast?: string): 'above' | 'below' | 'equal' {
  const actualNumber = Number.parseFloat(actual || '');
  const forecastNumber = Number.parseFloat(forecast || '');
  if (!Number.isFinite(actualNumber) || !Number.isFinite(forecastNumber)) return 'equal';
  if (actualNumber > forecastNumber) return 'above';
  if (actualNumber < forecastNumber) return 'below';
  return 'equal';
}