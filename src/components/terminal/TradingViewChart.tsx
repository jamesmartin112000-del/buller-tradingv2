import React, { useEffect, useRef, createElement } from 'react';
let tvScriptLoading: Promise<void> | null = null;
function loadTradingView(): Promise<void> {
  if ((window as any).TradingView) return Promise.resolve();
  if (tvScriptLoading) return tvScriptLoading;
  tvScriptLoading = new Promise<void>((resolve) => {
    const existing = document.getElementById(
      'tv-script'
    ) as HTMLScriptElement | null;
    if (existing) {
      const t = setInterval(() => {
        if ((window as any).TradingView) {
          clearInterval(t);
          resolve();
        }
      }, 150);
      return;
    }
    const script = document.createElement('script');
    script.id = 'tv-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  return tvScriptLoading;
}
interface Props {
  tvId: string;
  interval: string;
  /** Pixel height, or '100%' to fill the parent (use a sized wrapper). */
  height?: number | string;
  className?: string;
}
/**
 * Embedded TradingView advanced chart. Re-mounts whenever the
 * symbol or interval changes. Uses a unique container id per
 * instance so multiple charts (terminal + dashboard) coexist.
 */
export function TradingViewChart({
  tvId,
  interval,
  height = 520,
  className
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const idRef = useRef(`tv-chart-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    let cancelled = false;
    loadTradingView().then(() => {
      const TV = (window as any).TradingView;
      if (cancelled || !TV || !containerRef.current) return;
      try {
        containerRef.current.innerHTML = '';
        widgetRef.current = new TV.widget({
          container_id: idRef.current,
          symbol: tvId,
          interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0a0a0f',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          details: true,
          studies: [
          'RSI@tv-basicstudies',
          'MAExp@tv-basicstudies',
          'MACD@tv-basicstudies'],

          autosize: true,
          backgroundColor: '#0a0a0f'
        });
      } catch {

        /* ignore */}
    });
    return () => {
      cancelled = true;
      try {
        if (widgetRef.current) widgetRef.current.remove();
      } catch {

        /* ignore */}
      widgetRef.current = null;
    };
  }, [tvId, interval]);
  return (
    <div
      id={idRef.current}
      ref={containerRef}
      className={`w-full h-full overflow-hidden rounded-md border border-line bg-bg-800 ${className || ''}`}
      style={{
        height
      }}>
      
      <div className="flex h-full items-center justify-center text-2xs text-ink-dim">
        Loading TradingView chart…
      </div>
    </div>);

}