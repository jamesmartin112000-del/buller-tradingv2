import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, XIcon, CheckIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useMarkRead } from '../../lib/db/hooks';
import { db } from '../../lib/db/store';
/**
 * Notification bell — shows unread count, opens dropdown with all
 * notifications targeted at the current user (or admin).
 */
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const target =
  user?.role === 'admin' || user?.role === 'super_admin' ?
  'admin' :
  user?.email || '';
  const items = useNotifications(target);
  const markRead = useMarkRead();
  const unread = items.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  const markAllRead = () => {
    items.filter((n) => !n.read).forEach((n) => markRead(n.id));
  };
  const sorted = [...items].
  sort((a, b) => b.createdAt - a.createdAt).
  slice(0, 30);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-ink-muted hover:text-ink p-1.5 rounded hover:bg-bg-700 transition-colors"
        aria-label="Notifications">
        
        <BellIcon className="w-4 h-4" />
        {unread > 0 &&
        <span className="absolute -top-0.5 -right-0.5 bg-sell text-white text-3xs font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center border border-bg-800">
            {unread > 9 ? '9+' : unread}
          </span>
        }
      </button>

      <AnimatePresence>
        {open &&
        <motion.div
          initial={{
            opacity: 0,
            y: -6,
            scale: 0.97
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: -6,
            scale: 0.97
          }}
          transition={{
            duration: 0.15
          }}
          className="absolute right-0 mt-2 w-80 bg-bg-700 border border-line rounded-md shadow-xl z-50 overflow-hidden">
          
            <div className="p-3 border-b border-line flex items-center justify-between">
              <div className="text-2xs uppercase tracking-wider font-bold text-ink-muted">
                Notifications
              </div>
              {unread > 0 &&
            <button
              onClick={markAllRead}
              className="text-2xs text-brand hover:underline font-semibold">
              
                  Mark all read
                </button>
            }
            </div>
            <div className="max-h-96 overflow-y-auto">
              {sorted.length === 0 &&
            <div className="p-8 text-center text-xs text-ink-dim">
                  No notifications yet.
                </div>
            }
              {sorted.map((n) => {
              const tone =
              n.kind === 'success' ?
              'border-l-buy' :
              n.kind === 'warn' ?
              'border-l-warn' :
              n.kind === 'error' ?
              'border-l-sell' :
              n.kind === 'access_request' ?
              'border-l-purple-trade' :
              n.kind === 'chat' ?
              'border-l-blue-trade' :
              'border-l-brand';
              return (
                <div
                  key={n.id}
                  className={`p-3 border-b border-line/50 border-l-2 ${tone} ${!n.read ? 'bg-bg-600' : ''} hover:bg-bg-600 transition-colors group`}>
                  
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold flex items-center gap-2">
                          {n.title}
                          {!n.read &&
                        <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                        }
                        </div>
                        <div className="text-2xs text-ink-muted mt-0.5 leading-relaxed">
                          {n.body}
                        </div>
                        <div className="text-3xs text-ink-dim mt-1 font-mono">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read &&
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 rounded hover:bg-bg-700 text-ink-dim hover:text-buy"
                        title="Mark read">
                        
                            <CheckIcon className="w-3 h-3" />
                          </button>
                      }
                        <button
                        onClick={() => db.remove('notifications', n.id)}
                        className="p-1 rounded hover:bg-bg-700 text-ink-dim hover:text-sell"
                        title="Dismiss">
                        
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>);

            })}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}