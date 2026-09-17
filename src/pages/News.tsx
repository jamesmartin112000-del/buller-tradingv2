import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NewspaperIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  ShuffleIcon,
  AlertOctagonIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshCwIcon,
  ZapIcon,
  ExternalLinkIcon,
  ShieldAlertIcon } from
'lucide-react';
import type { NewsCategory, NewsHeadline } from '../lib/data/newsSources';
import { LIVE_NEWS_SOURCES } from '../lib/data/newsSources';
import { fetchLiveNews } from '../lib/data/liveFeeds';
import { fmtRelative } from '../lib/engine/format';
import {
  createAbortController,
  type AbortControllerLike } from
'../lib/utils/abortController';
import {
  loadCurrentWeekNews,
  mergeAndSaveCurrentWeekNews } from
'../utils/newsRetention';

type Cat = NewsCategory | 'ALL';
type FeedMode = 'all' | 'breaking';
type SourceStatus = {source: string;ok: boolean;itemCount: number;message?: string;};

const CATEGORIES: Cat[] = [
'ALL',
'CENTRAL BANKS',
'INFLATION',
'LABOR',
'FOREX',
'CRYPTO',
'COMMODITIES',
'GEOPOLITICS',
'MACRO'];


const isBreaking = (n: NewsHeadline) =>
n.impact === 'high' && Date.now() - n.time < 45 * 60_000;

export function News() {
  const [cat, setCat] = useState<Cat>('ALL');
  const [impact, setImpact] = useState<'ALL' | 'high' | 'medium' | 'low'>('ALL');
  const [mode, setMode] = useState<FeedMode>('all');
  const [items, setItems] = useState<NewsHeadline[]>(() => loadCurrentWeekNews());
  const [sourceStatus, setSourceStatus] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(() => loadCurrentWeekNews().length === 0);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);
  const controllerRef = useRef<AbortControllerLike | null>(null);
  const hasItemsRef = useRef(items.length > 0);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = createAbortController();
    controllerRef.current = controller;
    if (!hasItemsRef.current) setLoading(true);
    try {
      const response = await fetchLiveNews(controller.signal);
      setItems((current) => mergeAndSaveCurrentWeekNews(current, response.items));
      hasItemsRef.current = response.items.length > 0;
      setSourceStatus(response.sourceStatus);
      setUpdated(new Date(response.fetchedAt));
      setError('');
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof Error ?
        caught.message :
        'Live news sources are temporarily unavailable.'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 5 * 60_000);
    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [load]);

  const filtered = useMemo(() => {
    return items.
    filter((n) => {
      if (mode === 'breaking' && !isBreaking(n)) return false;
      if (cat !== 'ALL' && n.category !== cat) return false;
      if (impact !== 'ALL' && n.impact !== impact) return false;
      return true;
    }).
    sort((a, b) => b.time - a.time);
  }, [items, cat, impact, mode]);

  const breakingCount = useMemo(() => items.filter(isBreaking).length, [items]);

  return (
    <div className="p-3 lg:p-4 space-y-3 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <NewspaperIcon className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-bold tracking-tight">Market News</h1>
        <span
          className={`text-3xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${loading ? 'bg-warn/15 text-warn' : error ? 'bg-sell/15 text-sell' : 'bg-buy/15 text-buy'}`}>
          
          {loading ? 'SYNCING' : error ? 'DEGRADED' : 'LIVE'}
        </span>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded border border-line bg-bg-700 px-2 py-1 text-3xs font-bold uppercase tracking-wider text-ink-muted hover:text-ink hover:border-line-strong transition-colors">
          
          <RefreshCwIcon className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        {updated &&
        <span className="text-3xs text-ink-dim font-mono ml-auto">
            Live headlines updated at{' '}
            {updated.toLocaleTimeString('en-PK', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit'
          })}{' '}
            PKT
          </span>
        }
      </div>
      <p className="text-2xs text-ink-muted leading-relaxed">
        Live forex and crypto headlines fetched every 30s from attributed sources only —
        every card links back to the original publisher. Impact and bias tags are
        keyword-derived context, not a trade signal. Headlines are kept for the current
        calendar week, then reset.
      </p>
      {error &&
      <div className="bg-sell/10 border border-sell/30 rounded-md px-3 py-2 flex flex-wrap items-center gap-2 text-2xs text-sell" role="alert">
          <ShieldAlertIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">
            {error} — {items.length ? 'showing cached verified headlines from this device.' : 'no cached headlines are available yet.'}
          </span>
          <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded border border-sell/40 px-2 py-1 font-bold uppercase tracking-wider hover:bg-sell/10 disabled:opacity-50">
          
            Retry
          </button>
        </div>
      }

      {/* Filters */}
      <div className="bg-bg-600 border border-line rounded-md p-2.5 space-y-2">
        <div className="flex flex-wrap gap-1">
          {(
          [
          ['all', 'All News'],
          ['breaking', `Breaking (${breakingCount})`]] as
          Array<[FeedMode, string]>).
          map(([m, label]) =>
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded border ${mode === m ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink'}`}>
            
              {m === 'breaking' && <ZapIcon className="w-3 h-3" />}
              {label}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) =>
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-2 py-1 text-3xs font-semibold rounded uppercase border ${cat === c ? 'bg-bg-500 text-ink border-line-strong' : 'bg-bg-700 text-ink-dim border-line hover:text-ink'}`}>
            
              {c}
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(['ALL', 'high', 'medium', 'low'] as const).map((i) =>
          <button
            key={i}
            onClick={() => setImpact(i)}
            className={`px-2 py-1 text-2xs font-semibold rounded uppercase border ${impact === i ? 'bg-bg-500 text-ink border-line-strong' : 'bg-bg-700 text-ink-dim border-line hover:text-ink'}`}>
            
              {i === 'ALL' ? 'Any Impact' : i + ' impact'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* Headlines */}
        <div className="space-y-2">
          {filtered.map((n) =>
          <NewsCard key={n.id} n={n} />
          )}
          {filtered.length === 0 &&
          <div className="bg-bg-600 border border-line rounded-md p-6 text-center text-2xs text-ink-muted">
              {loading ?
            'Fetching live headlines…' :
            items.length === 0 ?
            'No verified headlines yet this week. Sources are unreachable — nothing fabricated is shown.' :
            'No headlines match these filters.'}
            </div>
          }
        </div>

        {/* Sources sidebar */}
        <div className="space-y-2">
          <div className="bg-bg-600 border border-line rounded-md p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-2">
              Live Sources
            </div>
            <ul className="space-y-1.5">
              {LIVE_NEWS_SOURCES.map((s) => {
                const status = sourceStatus.find((st) => st.source === s.name);
                const ok = status?.ok ?? null;
                return (
                  <li key={s.name} className="bg-bg-700 border border-line rounded px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${ok === null ? 'bg-warn' : ok ? 'bg-buy dot-pulse' : 'bg-sell'}`} />
                      
                      <span className="text-2xs font-semibold text-ink">{s.name}</span>
                      <span className="ml-auto text-3xs text-ink-dim font-mono">
                        {status ? `${status.itemCount} items` : 'checking…'}
                      </span>
                    </div>
                    <div className="text-3xs text-ink-muted mt-1 leading-relaxed">
                      {s.coverage}
                    </div>
                  </li>);

              })}
            </ul>
            <p className="text-3xs text-ink-dim mt-2 leading-relaxed">
              No API keys, no fabricated fallback. If a source fails it is reported here
              honestly instead of being silently replaced.
            </p>
          </div>
          <div className="bg-brand/5 border border-brand/25 rounded-md p-3">
            <div className="text-2xs uppercase tracking-[0.18em] text-brand font-bold mb-1.5">
              Weekly retention
            </div>
            <p className="text-3xs text-ink-muted leading-relaxed">
              Headlines are kept on this device for the current calendar week (Monday →
              Sunday) so nothing is missed between visits, then the cache resets
              automatically at the start of the next week.
            </p>
          </div>
        </div>
      </div>
    </div>);

}

function NewsCard({ n }: {n: NewsHeadline;}) {
  const ImpactIcon =
  n.impact === 'high' ? AlertOctagonIcon : n.impact === 'medium' ? AlertCircleIcon : InfoIcon;
  const impactColor =
  n.impact === 'high' ? 'text-sell' : n.impact === 'medium' ? 'text-warn' : 'text-blue-trade';
  const BiasIcon =
  n.marketBias === 'bullish' ?
  TrendingUpIcon :
  n.marketBias === 'bearish' ?
  TrendingDownIcon :
  n.marketBias === 'mixed' ?
  ShuffleIcon :
  MinusIcon;
  const biasColor =
  n.marketBias === 'bullish' ?
  'text-buy' :
  n.marketBias === 'bearish' ?
  'text-sell' :
  'text-ink-muted';
  return (
    <div
      className={`bg-bg-600 border border-line rounded-md p-3 hover:border-line-strong transition-colors ${isBreaking(n) ? 'border-l-2 border-l-sell' : ''}`}>
      
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <ImpactIcon className={`w-3.5 h-3.5 ${impactColor}`} />
        <span className="text-3xs font-bold uppercase tracking-wider text-ink-muted">
          {n.source}
        </span>
        {isBreaking(n) &&
        <span className="text-3xs font-bold uppercase tracking-wider text-sell bg-sell/15 border border-sell/30 px-1.5 py-0.5 rounded">
            BREAKING
          </span>
        }
        <span className="text-3xs bg-bg-800 border border-line text-ink-muted px-1.5 py-0.5 rounded font-mono">
          {n.category}
        </span>
        <span className="ml-auto text-3xs text-ink-dim text-right">
          {fmtRelative(n.time)}
          <span className="block text-3xs text-ink-dim/70 font-mono">
            {new Date(n.time).toLocaleString('en-PK', {
              timeZone: 'Asia/Karachi'
            })}{' '}
            PKT
          </span>
        </span>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-ink">{n.headline}</h3>
      <p className="text-2xs text-ink-muted mt-1 leading-relaxed">{n.body}</p>

      <div className="mt-2 pt-2 border-t border-line/50 space-y-1.5">
        <div className="flex items-center gap-2 text-2xs">
          <BiasIcon className={`w-3 h-3 ${biasColor}`} />
          <span className={`uppercase font-bold ${biasColor}`}>{n.marketBias}</span>
          <span className="text-ink-dim">·</span>
          <span className="text-ink-dim">{n.impactReason}</span>
        </div>
        <p className="text-3xs text-ink-muted leading-relaxed">{n.marketContext}</p>
        <p className="text-3xs text-warn/90 leading-relaxed">{n.confirmationRequired}</p>
        <div className="flex items-center gap-2 pt-0.5">
          <div className="flex gap-1 flex-wrap">
            {n.pairs.map((p) =>
            <span
              key={p}
              className="text-3xs bg-bg-800 border border-line text-ink-muted px-1.5 py-0.5 rounded font-mono">
              
                {p}
              </span>
            )}
          </div>
          {n.sourceUrl &&
          <a
            href={n.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-3xs font-semibold text-brand hover:underline">
            
              Source <ExternalLinkIcon className="w-3 h-3" />
            </a>
          }
        </div>
      </div>
    </div>);

}