import type { RetailSentiment } from '../../../lib/engine/goldInstitutionalSniper';
import { createAbortController, toFetchSignal } from '../../../lib/utils/abortController';

export async function fetchMyfxbookSentiment(): Promise<RetailSentiment | null> {
  const source = 'https://www.myfxbook.com/community/outlook/XAUUSD';
  const candidates = [
  `https://api.allorigins.win/raw?url=${encodeURIComponent(source)}`,
  `https://corsproxy.io/?url=${encodeURIComponent(source)}`];


  for (const url of candidates) {
    const controller = createAbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: toFetchSignal(controller.signal)
      });
      if (!response.ok) continue;

      const text = (await response.text()).replace(/<[^>]+>/g, ' ');
      const shortMatch =
      text.match(/([\d.]+)\s*%\s*(?:of[^.]{0,80})?(?:going\s+)?short/i) ??
      text.match(/short(?:s| positions)?[^%\d]{0,30}([\d.]+)\s*%/i);
      const longMatch =
      text.match(/([\d.]+)\s*%\s*(?:of[^.]{0,80})?(?:going\s+)?long/i) ??
      text.match(/long(?:s| positions)?[^%\d]{0,30}([\d.]+)\s*%/i);
      const shortPct = shortMatch ? Number(shortMatch[1]) : Number.NaN;
      const longPct = longMatch ?
      Number(longMatch[1]) :
      Number.isFinite(shortPct) ?
      100 - shortPct :
      Number.NaN;

      if (
      Number.isFinite(shortPct) &&
      Number.isFinite(longPct) &&
      shortPct >= 0 &&
      shortPct <= 100 &&
      longPct >= 0 &&
      longPct <= 100)
      {
        return {
          shortPct,
          longPct,
          source: 'Myfxbook'
        };
      }
    } catch {

      // Try the next public CORS relay.
    } finally {window.clearTimeout(timer);
    }
  }

  return null;
}