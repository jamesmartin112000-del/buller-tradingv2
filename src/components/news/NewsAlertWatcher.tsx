import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { db, uid } from '../../lib/db/store';
import type { EconomicEvent } from '../../lib/data/economicCalendar';
import { fetchLiveCalendar, fetchLiveNews } from '../../lib/data/liveFeeds';

const ALERT_KEY = 'te.newsAlerts.fired.v2';
const POLL_MS = 60_000;
const LEAD_MS = 5 * 60_000;
const KEEP_MS = 7 * 24 * 60 * 60_000;

interface FiredItem {
  key: string;
  time: number;
}

function loadFired(): Map<string, number> {
  try {
    const raw = localStorage.getItem(ALERT_KEY);
    const items = raw ? JSON.parse(raw) as FiredItem[] : [];
    const cutoff = Date.now() - KEEP_MS;
    return new Map(items.filter((item) => item.time >= cutoff).map((item) => [item.key, item.time]));
  } catch {
    return new Map();
  }
}

function saveFired(items: Map<string, number>) {
  try {
    const cutoff = Date.now() - KEEP_MS;
    const values = Array.from(items.entries()).
    filter(([, time]) => time >= cutoff).
    slice(-300).
    map(([key, time]) => ({ key, time }));
    localStorage.setItem(ALERT_KEY, JSON.stringify(values));
  } catch {

    // Alerts still work during this session if storage is unavailable.
  }}

function pushAlert(title: string, body: string, kind: 'warn' | 'info') {
  db.insert('notifications', {
    id: uid('ntf'),
    target: 'broadcast',
    title,
    body,
    kind,
    read: false,
    createdAt: Date.now()
  });
  toast(title, { description: body });
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function eventLabel(event: EconomicEvent): string {
  return new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export function NewsAlertWatcher() {
  const fired = useRef(loadFired());
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default')
    {
      void Notification.requestPermission().catch(() => {});
    }

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      const now = Date.now();
      const [calendarResult, newsResult] = await Promise.allSettled([
      fetchLiveCalendar(),
      fetchLiveNews()]
      );
      if (cancelled) return;

      if (calendarResult.status === 'fulfilled') {
        for (const event of calendarResult.value.events) {
          if (event.impact !== 'high') continue;
          const delta = event.timestamp - now;
          if (delta > LEAD_MS || delta < -30_000) continue;
          const key = `event:${event.id}`;
          if (fired.current.has(key)) continue;
          fired.current.set(key, now);
          pushAlert(
            `High-impact event in ${Math.max(0, Math.round(delta / 60_000))} min`,
            `${event.flag} ${event.event} · ${eventLabel(event)} · ${event.currency}`,
            'warn'
          );
        }
      }

      if (newsResult.status === 'fulfilled') {
        for (const item of newsResult.value.items) {
          if (item.impact !== 'high' || item.time < mountedAt.current - 10 * 60_000) continue;
          const key = `news:${item.source}:${item.headline}`;
          if (fired.current.has(key)) continue;
          fired.current.set(key, now);
          pushAlert(
            `Breaking: ${item.headline}`,
            `${item.source} · ${item.category} · Context only, confirm on live price.`,
            'info'
          );
        }
      }
      saveFired(fired.current);
    };

    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (document.hidden || timer !== null) return;
      timer = window.setInterval(() => void tick(), POLL_MS);
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();else
      {
        void tick();
        start();
      }
    };

    if (!document.hidden) void tick();
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}