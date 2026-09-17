import { useEffect, useState, useCallback } from 'react';
import { fsSubscribeDoc } from '../backend/docStore';
import {
  db,
  subscribe,
  cacheLocalRecord,
  type Collection,
  type ContentBlock } from
'./store';

type CollectionMap = {
  users: ReturnType<typeof db.list<'users'>>;
  accessRequests: ReturnType<typeof db.list<'accessRequests'>>;
  chatMessages: ReturnType<typeof db.list<'chatMessages'>>;
  chatThreads: ReturnType<typeof db.list<'chatThreads'>>;
  notifications: ReturnType<typeof db.list<'notifications'>>;
  content: ReturnType<typeof db.list<'content'>>;
  logs: ReturnType<typeof db.list<'logs'>>;
  payments: ReturnType<typeof db.list<'payments'>>;
  paymentProofs: ReturnType<typeof db.list<'paymentProofs'>>;
  walletAddresses: ReturnType<typeof db.list<'walletAddresses'>>;
  devices: ReturnType<typeof db.list<'devices'>>;
  masterKeys: ReturnType<typeof db.list<'masterKeys'>>;
  plans: ReturnType<typeof db.list<'plans'>>;
};

/**
 * Reactive hook — re-renders the component whenever the collection changes,
 * including changes from other tabs.
 */
export function useCollection<C extends Collection>(col: C): CollectionMap[C] {
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = subscribe(col, () => force((n) => n + 1));
    return unsub;
  }, [col]);
  return db.list(col) as CollectionMap[C];
}

/**
 * Read public admin-editable content from Firestore directly. The local cache
 * provides instant rendering; the confirmed cloud value then becomes the
 * source of truth on logged-out and logged-in screens alike.
 */
export function useContent(id: string, fallback = ''): string {
  const blocks = useCollection('content');
  const cached = blocks.find((block) => block.id === id)?.value;
  const [remote, setRemote] = useState<{id: string;value?: string;} | null>(null);

  useEffect(() => {
    setRemote(null);
    return fsSubscribeDoc<ContentBlock>(
      'content',
      id,
      (block) => {
        setRemote({ id, value: block?.value });
        if (block) cacheLocalRecord('content', block);
      },
      (error) => console.warn(`[content] ${id} unavailable`, error)
    );
  }, [id]);

  if (remote?.id === id) return remote.value ?? fallback;
  return cached ?? fallback;
}

/** Notifications scoped to a recipient (admin or a specific user email). */
export function useNotifications(target: 'admin' | string) {
  const all = useCollection('notifications');
  const [, refreshLocalState] = useState(0);
  useEffect(() => {
    const refresh = () => refreshLocalState((value) => value + 1);
    window.addEventListener('buller-notification-read', refresh);
    return () => window.removeEventListener('buller-notification-read', refresh);
  }, []);
  return all.
  filter((n) => {
    if (target === 'admin') return n.target === 'admin' || n.target === 'broadcast';
    return n.target === 'user' && n.targetEmail === target || n.target === 'broadcast';
  }).
  map((notification) => {
    if (notification.target !== 'broadcast') return notification;
    try {
      return localStorage.getItem(`buller.notification.read.${notification.id}`) === '1' ?
      { ...notification, read: true } :
      notification;
    } catch {
      return notification;
    }
  });
}

export function useUnreadCount(target: 'admin' | string) {
  return useNotifications(target).filter((n) => !n.read).length;
}

/** Helper to mark a notification read. */
export function useMarkRead() {
  return useCallback((id: string) => {
    const notification = db.get('notifications', id);
    if (notification?.target === 'broadcast') {
      try {
        localStorage.setItem(`buller.notification.read.${id}`, '1');
        window.dispatchEvent(new Event('buller-notification-read'));
      } catch {}
      return;
    }
    db.update('notifications', id, { read: true });
  }, []);
}