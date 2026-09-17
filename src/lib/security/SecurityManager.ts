// AZHAAD Security Manager v1.0
//
// Layered frontend protection. IMPORTANT CAVEAT — pure-frontend security can
// only deter casual users. Determined attackers can always view source / disable
// JS in the browser. Real protection requires server-side enforcement which is
// outside the scope of this client app. This module is "make-life-harder"
// armor, not invulnerability.
//
// Design principles applied here:
//   1. NEVER clear the page on DevTools detection — causes false positives on
//      large monitors, mobile devices, browser extensions. Instead emit a
//      warning toast + log.
//   2. NEVER block copy/paste in input/textarea/contenteditable — would break
//      Journal, Calculators, AI Assistant, login forms.
//   3. Lock screen on inactivity (15min) with simple "Resume Session" confirm.
//   4. Browser fingerprint stored on first load; mismatch fires a warning but
//      does NOT force-logout (avoids false positives when users change browser
//      settings, install extensions, switch monitors).
//   5. All settings can be disabled via localStorage flags for development.

import { generateFingerprint } from './fingerprint';

export type SecurityEventType =
'RIGHT_CLICK' |
'BLOCKED_KEY' |
'DEVTOOLS_SUSPECT' |
'FINGERPRINT_MISMATCH' |
'COPY_BLOCKED' |
'INACTIVITY_LOCK' |
'UNLOCK_FAIL' |
'UNLOCK_OK' |
'RAPID_REQUESTS' |
'HEADLESS_SUSPECT';

export interface SecurityEvent {
  type: SecurityEventType;
  detail: string;
  ts: number;
}

export interface SecurityCallbacks {
  onToast: (message: string, tone?: 'warn' | 'fail') => void;
  onLock: () => void;
  onEvent: (event: SecurityEvent) => void;
}

interface Config {
  blockRightClick: boolean;
  blockKeyboardShortcuts: boolean;
  blockTextSelection: boolean;
  detectDevTools: boolean;
  inactivityLockMs: number;
  fingerprintCheck: boolean;
  antiScraping: boolean;
}

const DEFAULT_CONFIG: Config = {
  blockRightClick: true,
  blockKeyboardShortcuts: true,
  blockTextSelection: false, // OFF by default — too aggressive
  detectDevTools: true,
  inactivityLockMs: 15 * 60 * 1000, // 15 minutes
  fingerprintCheck: true,
  antiScraping: true
};

const SETTINGS_KEY = 'az_security_settings';
const FP_KEY = 'az_fp';
const AUDIT_KEY = 'az_audit_log';

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveSecurityConfig(partial: Partial<Config>) {
  const merged = { ...loadConfig(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

export function getSecurityConfig(): Config {
  return loadConfig();
}

export class SecurityManager {
  private config: Config;
  private callbacks: SecurityCallbacks;
  private inactivityTimer: number | null = null;
  private devToolsInterval: number | null = null;
  private requestCount = 0;
  private requestResetTimer: number | null = null;
  private cleanupFns: Array<() => void> = [];
  private locked = false;

  constructor(callbacks: SecurityCallbacks) {
    this.config = loadConfig();
    this.callbacks = callbacks;
  }

  init() {
    if (this.config.blockRightClick) this.installRightClickBlock();
    if (this.config.blockKeyboardShortcuts) this.installKeyboardBlock();
    if (this.config.blockTextSelection) this.installSelectionBlock();
    if (this.config.detectDevTools) this.installDevToolsDetection();
    if (this.config.fingerprintCheck) this.verifyFingerprint();
    if (this.config.antiScraping) this.installAntiScraping();
    this.installInactivityTimer();

    this.logEvent({
      type: 'UNLOCK_OK',
      detail: 'Security manager initialized',
      ts: Date.now()
    });
  }

  destroy() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.devToolsInterval) {
      window.clearInterval(this.devToolsInterval);
      this.devToolsInterval = null;
    }
    if (this.requestResetTimer) {
      window.clearTimeout(this.requestResetTimer);
      this.requestResetTimer = null;
    }
  }

  reconfigure(partial: Partial<Config>) {
    saveSecurityConfig(partial);
    this.destroy();
    this.config = loadConfig();
    this.init();
  }

  unlock() {
    this.locked = false;
    this.resetInactivity();
    this.logEvent({
      type: 'UNLOCK_OK',
      detail: 'Session unlocked',
      ts: Date.now()
    });
  }

  isLocked() {
    return this.locked;
  }

  getAuditLog(): SecurityEvent[] {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  clearAuditLog() {
    localStorage.removeItem(AUDIT_KEY);
  }

  // === 1. Right-click block ====================================
  private installRightClickBlock() {
    const handler = (e: MouseEvent) => {
      // Allow right-click on inputs so users can paste/spellcheck
      const target = e.target as HTMLElement;
      if (this.isEditableTarget(target)) return;
      e.preventDefault();
      this.callbacks.onToast(
        '⛔ Right-click disabled · AZHAAD Terminal is protected',
        'warn'
      );
      this.logEvent({
        type: 'RIGHT_CLICK',
        detail: 'Right-click blocked on read-only area',
        ts: Date.now()
      });
      return false;
    };
    document.addEventListener('contextmenu', handler);
    this.cleanupFns.push(() =>
    document.removeEventListener('contextmenu', handler)
    );
  }

  // === 2. Keyboard shortcut block ==============================
  private installKeyboardBlock() {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = this.isEditableTarget(target);
      const key = e.key.toUpperCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // F12 — DevTools
      if (e.keyCode === 123 || key === 'F12') {
        e.preventDefault();
        this.warnBlocked('F12 (Developer Tools)');
        return;
      }
      // Ctrl+Shift+I / J / C — Inspect / Console
      if (ctrl && shift && (key === 'I' || key === 'J' || key === 'C')) {
        e.preventDefault();
        this.warnBlocked(`Ctrl+Shift+${key} (Inspect)`);
        return;
      }
      // Ctrl+U — View source
      if (ctrl && !shift && key === 'U') {
        e.preventDefault();
        this.warnBlocked('Ctrl+U (View Source)');
        return;
      }
      // Ctrl+S — Save page
      if (ctrl && !shift && key === 'S' && !isEditable) {
        e.preventDefault();
        this.warnBlocked('Ctrl+S (Save Page)');
        return;
      }
      // Ctrl+P — Print
      if (ctrl && !shift && key === 'P' && !isEditable) {
        e.preventDefault();
        this.warnBlocked('Ctrl+P (Print)');
        return;
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    this.cleanupFns.push(() =>
    document.removeEventListener('keydown', handler, {
      capture: true
    } as any)
    );
  }

  private warnBlocked(label: string) {
    this.callbacks.onToast(`⛔ ${label} blocked · activity logged`, 'warn');
    this.logEvent({
      type: 'BLOCKED_KEY',
      detail: label,
      ts: Date.now()
    });
  }

  // === 3. Text selection block (opt-in) ========================
  private installSelectionBlock() {
    const selHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (this.isEditableTarget(target)) return;
      e.preventDefault();
    };
    const copyHandler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (this.isEditableTarget(target)) return;
      // Allow signal "Copy Signal" buttons to work — they use navigator.clipboard
      // directly so they don't trigger this event.
      e.preventDefault();
      this.callbacks.onToast('⛔ Content protected · copy blocked', 'warn');
      this.logEvent({
        type: 'COPY_BLOCKED',
        detail: 'Copy blocked on read-only area',
        ts: Date.now()
      });
    };
    document.addEventListener('selectstart', selHandler);
    document.addEventListener('copy', copyHandler);
    this.cleanupFns.push(() => {
      document.removeEventListener('selectstart', selHandler);
      document.removeEventListener('copy', copyHandler);
    });
  }

  // === 4. DevTools detection (non-destructive) =================
  private installDevToolsDetection() {
    // Window size delta — large gap between outer/inner = devtools docked.
    // We use a generous threshold (300px) to reduce false positives on:
    //   - Mobile devices with virtual keyboard
    //   - Browser extensions that add side panels
    //   - Users with browser zoom set
    let warned = false;
    this.devToolsInterval = window.setInterval(() => {
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      // Ignore on small viewports (mobile)
      if (window.innerWidth < 768) return;
      const open = wDiff > 300 || hDiff > 300;
      if (open && !warned) {
        warned = true;
        this.callbacks.onToast(
          '⚠ Developer tools detected · activity logged',
          'warn'
        );
        this.logEvent({
          type: 'DEVTOOLS_SUSPECT',
          detail: `Window delta w:${wDiff} h:${hDiff}`,
          ts: Date.now()
        });
      } else if (!open) {
        warned = false;
      }
    }, 3000);
  }

  // === 5. Fingerprint check ====================================
  private async verifyFingerprint() {
    try {
      const current = await generateFingerprint();
      const stored = localStorage.getItem(FP_KEY);
      if (!stored) {
        localStorage.setItem(FP_KEY, current);
        return;
      }
      if (stored !== current) {
        this.callbacks.onToast(
          '⚠ Browser environment changed · session verified',
          'warn'
        );
        this.logEvent({
          type: 'FINGERPRINT_MISMATCH',
          detail: 'Browser fingerprint changed',
          ts: Date.now()
        });
        // NOTE: We do NOT force logout here. Fingerprints can change
        // legitimately (extension install, browser update, OS change).
        // We update to the new fingerprint after warning.
        localStorage.setItem(FP_KEY, current);
      }
    } catch {

      // silent — fingerprinting may fail on locked-down browsers
    }}

  // === 6. Anti-scraping / headless detection ===================
  private installAntiScraping() {
    const checks: string[] = [];
    if ((navigator as any).webdriver) checks.push('webdriver');
    if (!navigator.plugins || navigator.plugins.length === 0)
    checks.push('no-plugins');
    if (navigator.languages && navigator.languages.length === 0)
    checks.push('no-languages');
    // chrome.runtime check is unreliable in 2024+ — skipping

    if (checks.length >= 2) {
      this.callbacks.onToast(
        '⛔ Automated browser detected · access flagged',
        'fail'
      );
      this.logEvent({
        type: 'HEADLESS_SUSPECT',
        detail: `Signs: ${checks.join(', ')}`,
        ts: Date.now()
      });
    }

    // Rapid request throttle wrap on fetch.
    //
    // Calibrated for the actual engine traffic:
    //   gold every 8s   = ~7/min
    //   crypto every 6s = ~10/min
    //   forex every 25s = ~2.4/min
    //   watchdog retries + initial burst on focus/visibility events
    //   + user-initiated scanner ticks
    // Realistic peak with all engines polling + scanner active is ~80–120/min.
    // We only flag genuinely abusive behaviour (e.g. a scraper hammering the
    // app) and rate-limit the warning toast itself so it can NEVER spam.
    const origFetch = window.fetch;
    const self = this;
    let lastWarnTs = 0;
    window.fetch = function (...args: Parameters<typeof fetch>) {
      self.requestCount++;
      const now = Date.now();
      // Threshold raised to 300/min; warn at most once every 5 minutes.
      if (self.requestCount > 300 && now - lastWarnTs > 5 * 60 * 1000) {
        lastWarnTs = now;
        self.callbacks.onToast(
          '⚠ Unusually high request volume detected',
          'warn'
        );
        self.logEvent({
          type: 'RAPID_REQUESTS',
          detail: `${self.requestCount} requests in window`,
          ts: now
        });
      }
      if (!self.requestResetTimer) {
        self.requestResetTimer = window.setTimeout(() => {
          self.requestCount = 0;
          self.requestResetTimer = null;
        }, 60000);
      }
      return origFetch.apply(window, args);
    };
    this.cleanupFns.push(() => {
      window.fetch = origFetch;
    });
  }

  // === 7. Inactivity timer + lock ==============================
  private installInactivityTimer() {
    const reset = () => this.resetInactivity();
    const events = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart'];

    events.forEach((ev) =>
    document.addEventListener(ev, reset, { passive: true })
    );
    this.cleanupFns.push(() => {
      events.forEach((ev) => document.removeEventListener(ev, reset));
    });
    this.resetInactivity();
  }

  private resetInactivity() {
    if (this.inactivityTimer) window.clearTimeout(this.inactivityTimer);
    if (this.locked) return;
    this.inactivityTimer = window.setTimeout(() => {
      this.locked = true;
      this.callbacks.onLock();
      this.logEvent({
        type: 'INACTIVITY_LOCK',
        detail: `Locked after ${this.config.inactivityLockMs / 60000}min`,
        ts: Date.now()
      });
    }, this.config.inactivityLockMs);
  }

  // === Helpers =================================================
  private isEditableTarget(el: HTMLElement | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  private logEvent(event: SecurityEvent) {
    this.callbacks.onEvent(event);
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      const log: SecurityEvent[] = raw ? JSON.parse(raw) : [];
      log.push(event);
      // Keep last 200 events
      localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(-200)));
    } catch {

      // ignore
    }}
}