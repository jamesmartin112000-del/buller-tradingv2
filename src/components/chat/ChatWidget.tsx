import React, { useEffect, useMemo, useState, useRef, lazy, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DownloadIcon,
  FileIcon,
  HeadphonesIcon,
  Loader2Icon,
  PaperclipIcon,
  SendIcon,
  UserRoundIcon,
  XIcon } from
'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { uploadChatAttachment, classifyAttachment } from '../../lib/r2Upload';
import { useCollection, useContent } from '../../lib/db/hooks';
import { db, uid, type ChatMessage } from '../../lib/db/store';
import { ChatFab3D } from './ChatFab3D';
interface GuestIdentity {
  name: string;
  email: string;
}
const GUEST_IDENTITY_KEY = 'te.support.guest';
export function ChatWidget() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(
    readGuestIdentity
  );
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guestNameRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const allMessages = useCollection('chatMessages');
  const allThreads = useCollection('chatThreads');
  const welcome = useContent(
    'support.welcome',
    'Hi! How can we help today? Our team typically replies within a few hours.'
  );
  const position = useContent('chat.position', 'bottom-right');
  const sizeKey = useContent('chat.size', 'md');
  const offsetX = parseInt(useContent('chat.offsetX', '20'), 10) || 20;
  const offsetY = parseInt(useContent('chat.offsetY', '20'), 10) || 20;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const activeIdentity = user ?
  {
    name: user.name,
    email: normalizeEmail(user.email)
  } :
  guestIdentity;
  const threadId = activeIdentity?.email || '';
  const myThread = allThreads.find((thread) => thread.id === threadId);
  const messages = useMemo(
    () =>
    threadId ?
    allMessages.
    filter((message) => message.threadId === threadId).
    sort((a, b) => a.createdAt - b.createdAt) :
    [],
    [allMessages, threadId]
  );
  const unread = myThread?.unreadForUser || 0;
  useEffect(() => {
    const openSupport = () => setOpen(true);
    window.addEventListener('buller-open-chat', openSupport);
    return () => window.removeEventListener('buller-open-chat', openSupport);
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (!activeIdentity) {
        guestNameRef.current?.focus();
        return;
      }
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, messages.length, activeIdentity]);
  useEffect(() => {
    if (!open || !myThread || myThread.unreadForUser === 0) return;
    db.update('chatThreads', myThread.id, {
      unreadForUser: 0
    });
    allMessages.
    filter(
      (message) =>
      message.threadId === threadId &&
      message.from === 'admin' &&
      !message.read
    ).
    forEach((message) => {
      db.update('chatMessages', message.id, {
        read: true
      });
    });
  }, [allMessages, myThread, open, threadId]);
  if (authLoading || isAdmin) return null;
  const isLeft = position === 'bottom-left';
  const sizes: Record<
    string,
    {
      w: string;
      h: string;
    }> =
  {
    sm: {
      w: 'w-[300px]',
      h: 'h-[440px]'
    },
    md: {
      w: 'w-[360px]',
      h: 'h-[500px]'
    },
    lg: {
      w: 'w-[420px]',
      h: 'h-[600px]'
    }
  };
  const size = sizes[sizeKey] || sizes.md;
  const saveGuestIdentity = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = guestName.trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(guestEmail);
    if (name.length < 2) {
      setGuestError('Please enter your name using at least 2 characters.');
      return;
    }
    if (!isValidEmail(email)) {
      setGuestError('Please enter a valid email address.');
      return;
    }
    const identity = {
      name: name.slice(0, 80),
      email
    };
    try {
      window.localStorage.setItem(GUEST_IDENTITY_KEY, JSON.stringify(identity));
    } catch {

      // The chat remains usable when private browsing blocks local storage.
    }setGuestIdentity(identity);
    setGuestName('');
    setGuestEmail('');
    setGuestError(null);
  };
  const resetGuestIdentity = () => {
    try {
      window.localStorage.removeItem(GUEST_IDENTITY_KEY);
    } catch {

      // Ignore unavailable storage; in-memory state is still cleared.
    }setGuestIdentity(null);
    setGuestName('');
    setGuestEmail('');
    setGuestError(null);
    setDraft('');
  };
  const persist = (
  text: string,
  attachment?: {
    url: string;
    type: 'image' | 'video' | 'file';
    name: string;
  }) =>
  {
    if (!activeIdentity || !threadId) {
      setGuestError('Please add your name and email before sending a message.');
      return false;
    }
    const now = Date.now();
    const preview = text || (attachment ? `Attachment: ${attachment.name}` : '');
    const message: ChatMessage = {
      id: uid('msg'),
      threadId,
      from: 'user',
      authorName: activeIdentity.name,
      text,
      createdAt: now,
      read: false,
      ...(attachment ?
      {
        attachmentUrl: attachment.url,
        attachmentType: attachment.type,
        attachmentName: attachment.name
      } :
      {})
    };
    db.insert('chatMessages', message);
    if (myThread) {
      db.update('chatThreads', threadId, {
        lastMessage: preview,
        lastAt: now,
        unreadForAdmin: (myThread.unreadForAdmin || 0) + 1,
        status: 'open'
      });
    } else {
      db.insert('chatThreads', {
        id: threadId,
        userName: activeIdentity.name,
        userEmail: activeIdentity.email,
        lastMessage: preview,
        lastAt: now,
        unreadForAdmin: 1,
        unreadForUser: 0,
        status: 'open'
      });
    }
    db.insert('notifications', {
      id: uid('nt'),
      target: 'admin',
      title: `New message from ${activeIdentity.name}`,
      body: preview.slice(0, 120),
      kind: 'chat',
      read: false,
      createdAt: now,
      link: '/app/admin'
    });
    return true;
  };
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (persist(text)) setDraft('');
  };
  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeIdentity) return;
    setUploading(true);
    const toastId = toast.loading('Uploading attachment…');
    try {
      const result = await uploadChatAttachment(activeIdentity.email, file, (progress) => {
        toast.loading(`Uploading attachment… ${progress}%`, { id: toastId });
      });
      if (!result.ok || !result.url) {
        toast.error(result.error || 'Upload failed. Please try again.', {
          id: toastId
        });
        return;
      }
      persist(draft.trim(), {
        url: result.url,
        type: result.kind || classifyAttachment(file),
        name: file.name
      });
      setDraft('');
      toast.success('Attachment sent', {
        id: toastId
      });
    } catch {
      toast.error('Attachment could not be uploaded. Please try again.', {
        id: toastId
      });
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <ChatFab3D
        open={open}
        unread={unread}
        onClick={() => setOpen((value) => !value)}
        side={isLeft ? 'left' : 'right'}
        offsetX={offsetX}
        offsetY={offsetY} />
      

      <AnimatePresence>
        {open &&
        <motion.section
          initial={{
            opacity: 0,
            y: 20,
            scale: 0.95
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.95
          }}
          transition={{
            duration: 0.2
          }}
          style={{
            [isLeft ? 'left' : 'right']: offsetX,
            bottom: offsetY + 64
          }}
          className={`fixed z-[10010] max-w-[calc(100vw-2.5rem)] ${size.w} ${size.h} max-h-[calc(100vh-7rem)] bg-bg-700 border border-line rounded-md shadow-2xl flex flex-col overflow-hidden`}
          role="dialog"
          aria-modal="false"
          aria-labelledby="support-chat-title">
          
            <header className="bg-bg-800 border-b border-line p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                <HeadphonesIcon className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div id="support-chat-title" className="text-sm font-bold">
                  Support
                </div>
                <div className="text-2xs text-ink-muted flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-buy" />
                  Usually responds within a few hours
                </div>
              </div>
              {!user && guestIdentity &&
            <button
              type="button"
              onClick={resetGuestIdentity}
              className="text-2xs text-ink-muted hover:text-ink underline underline-offset-2">
              
                  Change details
                </button>
            }
              <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-bg-700 text-ink-muted hover:text-ink"
              aria-label="Close support chat">
              
                <XIcon className="w-4 h-4" />
              </button>
            </header>

            {!activeIdentity ?
          <GuestOnboarding
            name={guestName}
            email={guestEmail}
            error={guestError}
            nameRef={guestNameRef}
            onNameChange={setGuestName}
            onEmailChange={setGuestEmail}
            onSubmit={saveGuestIdentity} /> :


          <>
                <div
              className="flex-1 overflow-y-auto p-3 space-y-2 bg-bg-900/40"
              aria-live="polite">
              
                  {messages.length === 0 &&
              <div className="bg-bg-700 border border-line rounded-lg p-3 text-xs text-ink-muted leading-relaxed max-w-[85%]">
                      <div className="text-2xs font-bold text-brand mb-1">
                        Support team
                      </div>
                      {welcome}
                    </div>
              }
                  {messages.map((message) =>
              <div
                key={message.id}
                className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                      <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${message.from === 'user' ? 'bg-brand text-white' : 'bg-bg-700 border border-line text-ink'}`}>
                  
                        {message.from === 'admin' &&
                  <div className="text-2xs font-bold opacity-80 mb-0.5">
                            {message.authorName} · Support
                          </div>
                  }
                        {message.attachmentUrl &&
                  <ChatAttachment
                    url={message.attachmentUrl}
                    type={message.attachmentType}
                    name={message.attachmentName} />

                  }
                        {message.text &&
                  <div className="text-xs whitespace-pre-wrap leading-relaxed">
                            {message.text}
                          </div>
                  }
                        <div className="text-3xs opacity-60 mt-1 font-mono">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                        </div>
                      </div>
                    </div>
              )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-line p-2.5 flex items-center gap-2 bg-bg-800">
                  <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                className="hidden"
                onChange={onPickFile}
                aria-label="Choose a support attachment" />
              
                  <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 rounded text-ink-muted hover:text-brand hover:bg-bg-700 disabled:opacity-40 transition-colors shrink-0"
                aria-label="Attach a file"
                title="Send a picture, video or document">
                
                    {uploading ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <PaperclipIcon className="w-4 h-4" />
                }
                  </button>
                  <label htmlFor="support-message" className="sr-only">
                    Support message
                  </label>
                  <input
                id="support-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                maxLength={2000}
                placeholder="Type your message…"
                className="flex-1 min-w-0 bg-bg-700 border border-line rounded px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              
                  <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || uploading}
                className="bg-brand text-white px-3 py-2 rounded disabled:opacity-40 hover:bg-brand/90 transition-colors shrink-0"
                aria-label="Send message">
                
                    <SendIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
          }
          </motion.section>
        }
      </AnimatePresence>
    </>);

}
function GuestOnboarding({
  name,
  email,
  error,
  nameRef,
  onNameChange,
  onEmailChange,
  onSubmit








}: {name: string;email: string;error: string | null;nameRef: React.RefObject<HTMLInputElement>;onNameChange: (value: string) => void;onEmailChange: (value: string) => void;onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;}) {
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-bg-900/40">
      <div className="w-11 h-11 rounded-full bg-brand/10 border border-brand/25 flex items-center justify-center mb-4">
        <UserRoundIcon className="w-5 h-5 text-brand" />
      </div>
      <h3 className="text-base font-bold text-ink">Contact support</h3>
      <p className="text-xs text-ink-muted leading-relaxed mt-1.5 mb-5">
        No account is required. Add your details once so you can send a message
        and revisit the same conversation on this device.
      </p>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="support-guest-name"
            className="block text-xs font-medium text-ink mb-1.5">
            
            Name
          </label>
          <input
            ref={nameRef}
            id="support-guest-name"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="name"
            maxLength={80}
            className="w-full bg-bg-700 border border-line rounded px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Your name" />
          
        </div>
        <div>
          <label
            htmlFor="support-guest-email"
            className="block text-xs font-medium text-ink mb-1.5">
            
            Email
          </label>
          <input
            id="support-guest-email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete="email"
            inputMode="email"
            className="w-full bg-bg-700 border border-line rounded px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="you@example.com" />
          
          <p className="mt-1.5 text-2xs text-ink-dim">
            Used only to identify your support conversation.
          </p>
        </div>
        {error &&
        <div
          role="alert"
          className="bg-sell/10 border border-sell/30 text-sell text-xs rounded px-3 py-2">
          
            {error}
          </div>
        }
        <button
          type="submit"
          className="w-full bg-brand hover:bg-brand/90 text-white rounded px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40">
          
          Start conversation
        </button>
      </form>
    </div>);

}
export function ChatAttachment({
  url,
  type,
  name




}: {url: string;type?: 'image' | 'video' | 'file';name?: string;}) {
  if (type === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-1.5">
        
        <img
          src={url}
          alt={name || 'Support attachment'}
          className="rounded-md max-h-52 w-auto object-cover border border-black/20"
          loading="lazy"
          decoding="async" />
        
      </a>);

  }
  if (type === 'video') {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="rounded-md max-h-52 w-full mb-1.5 border border-black/20"
        aria-label={name || 'Support video attachment'} />);


  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mb-1.5 rounded-md bg-black/15 hover:bg-black/25 px-2.5 py-2 transition-colors">
      
      <FileIcon className="w-4 h-4 shrink-0" />
      <span className="text-2xs truncate flex-1 max-w-[180px]">
        {name || 'Download file'}
      </span>
      <DownloadIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
    </a>);

}
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
function readGuestIdentity(): GuestIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GUEST_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const email =
    typeof parsed.email === 'string' ? normalizeEmail(parsed.email) : '';
    if (name.length < 2 || !isValidEmail(email)) return null;
    return {
      name: name.slice(0, 80),
      email
    };
  } catch {
    return null;
  }
}