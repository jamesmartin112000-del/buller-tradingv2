import React, { useEffect, useRef } from 'react';
import type { BinanceCandle } from '../../lib/trading/binanceWebSocket';
import type { TrapResult } from '../../lib/engine/trapDetector';
interface Props {
  candles: BinanceCandle[];
  trap: TrapResult | null;
  height?: number;
  timeframe?: string;
}
// TradingView-style palette
const COL = {
  bg: '#0c0e16',
  grid: '#1b1e2b',
  gridStrong: '#222637',
  axisText: '#6b7280',
  bull: '#26a69a',
  bear: '#ef5350',
  bullVol: 'rgba(38,166,154,0.32)',
  bearVol: 'rgba(239,83,80,0.32)',
  last: '#5b8def',
  trapBull: '#ef5350',
  trapBear: '#26a69a'
};
function decimalsFor(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 2;
  if (price >= 1) return 4;
  return 6;
}
function fmtTime(ts: number, tf?: string): string {
  const d = new Date(ts);
  const intraday = !tf || ['1m', '5m', '15m', '30m', '1h'].includes(tf);
  if (intraday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
/**
 * Professional, TradingView-style candlestick chart. Renders the real OHLC
 * candles for the selected asset on a clean dark grid with price + time
 * axes and a volume sub-pane, then OVERLAYS the detected trap: the swept
 * liquidity level (dashed line + price pill), the trap candle (highlight
 * band + marker ring) and a BULL TRAP / BEAR TRAP label pill placed exactly
 * on the candle where the fake breakout printed.
 */
export function TrapCandleChart({
  candles,
  trap,
  height = 320,
  timeframe
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = parent.clientWidth;
      const cssH = height;
      if (cssW <= 0) return;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, cssW, cssH);
      if (!candles || candles.length === 0) {
        ctx.fillStyle = COL.axisText;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Loading real market data…', cssW / 2, cssH / 2);
        return;
      }
      // Window the data so the trap candle stays visible.
      const COUNT = 80;
      const total = candles.length;
      const startGlobal = Math.max(0, total - COUNT);
      const data = candles.slice(startGlobal);
      const trapLocal =
      trap && trap.trapIndex >= startGlobal ?
      trap.trapIndex - startGlobal :
      -1;
      const padding = {
        l: 6,
        r: 66,
        t: 12,
        b: 22
      };
      const w = cssW - padding.l - padding.r;
      const chartH = cssH - padding.t - padding.b;
      const priceH = chartH * 0.8;
      const volTop = padding.t + priceH + 6;
      const volH = chartH * 0.18;
      const highs = data.map((c) => c.high);
      const lows = data.map((c) => c.low);
      let max = Math.max(...highs);
      let min = Math.min(...lows);
      if (trap && trap.level) {
        max = Math.max(max, trap.level);
        min = Math.min(min, trap.level);
      }
      // Breathing room top/bottom so wicks don't kiss the edges.
      const pad = (max - min) * 0.06 || max * 0.01;
      max += pad;
      min -= pad;
      const range = max - min || max * 0.01;
      const dec = decimalsFor((max + min) / 2);
      const candleW = w / data.length;
      const bodyW = Math.max(1, Math.min(14, candleW * 0.7));
      const yOf = (price: number) =>
      padding.t + (max - price) / range * priceH;
      // ── Grid + price axis ──
      ctx.font = '9px JetBrains Mono, monospace';
      const ROWS = 5;
      for (let i = 0; i <= ROWS; i++) {
        const y = padding.t + priceH / ROWS * i;
        ctx.strokeStyle = COL.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.l, y);
        ctx.lineTo(padding.l + w, y);
        ctx.stroke();
        const price = max - range / ROWS * i;
        ctx.fillStyle = COL.axisText;
        ctx.textAlign = 'left';
        ctx.fillText(price.toFixed(dec), padding.l + w + 6, y + 3);
      }
      // Vertical grid + time axis (every ~6 candles)
      const step = Math.max(1, Math.floor(data.length / 8));
      ctx.textAlign = 'center';
      for (let i = 0; i < data.length; i += step) {
        const x = padding.l + i * candleW + candleW / 2;
        ctx.strokeStyle = COL.grid;
        ctx.beginPath();
        ctx.moveTo(x, padding.t);
        ctx.lineTo(x, padding.t + priceH);
        ctx.stroke();
        ctx.fillStyle = COL.axisText;
        ctx.fillText(fmtTime(data[i].timestamp, timeframe), x, cssH - 7);
      }
      // ── Candles + volume ──
      const volMax = Math.max(...data.map((c) => c.volume || 0), 1);
      data.forEach((c, i) => {
        const x = padding.l + i * candleW + candleW / 2;
        const bull = c.close >= c.open;
        const color = bull ? COL.bull : COL.bear;
        // Volume
        const vh = (c.volume || 0) / volMax * (volH - 2);
        ctx.fillStyle = bull ? COL.bullVol : COL.bearVol;
        ctx.fillRect(x - bodyW / 2, volTop + (volH - vh), bodyW, vh);
        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yOf(c.high));
        ctx.lineTo(Math.round(x) + 0.5, yOf(c.low));
        ctx.stroke();
        // Body
        ctx.fillStyle = color;
        const bodyTop = Math.min(yOf(c.open), yOf(c.close));
        const bodyH = Math.max(1, Math.abs(yOf(c.close) - yOf(c.open)));
        ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
      });
      // helper: pill label
      const pill = (
      text: string,
      x: number,
      y: number,
      bg: string,
      fg = '#fff',
      align: CanvasTextAlign = 'left') =>
      {
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        const tw = ctx.measureText(text).width;
        const px = 5;
        const wpill = tw + px * 2;
        let bx = x;
        if (align === 'center') bx = x - wpill / 2;
        if (align === 'right') bx = x - wpill;
        ctx.fillStyle = bg;
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(bx + r, y - 8);
        ctx.arcTo(bx + wpill, y - 8, bx + wpill, y + 8, r);
        ctx.arcTo(bx + wpill, y + 8, bx, y + 8, r);
        ctx.arcTo(bx, y + 8, bx, y - 8, r);
        ctx.arcTo(bx, y - 8, bx + wpill, y - 8, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.textAlign = 'left';
        ctx.fillText(text, bx + px, y + 3);
      };
      // ── Trap overlay ──
      if (trap && trap.kind !== 'NO TRAP' && trap.level) {
        const isBull = trap.kind === 'BULL TRAP';
        const accent = isBull ? COL.trapBull : COL.trapBear;
        const levelY = yOf(trap.level);
        // Swept liquidity level
        ctx.strokeStyle = accent;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.l, levelY);
        ctx.lineTo(padding.l + w, levelY);
        ctx.stroke();
        ctx.setLineDash([]);
        // Level pill (left)
        pill(
          `${isBull ? 'SWEPT HIGH' : 'SWEPT LOW'} ${trap.level.toFixed(dec)}`,
          padding.l + 4,
          levelY,
          accent
        );
        // Highlight + marker on the trap candle
        if (trapLocal >= 0) {
          const tx = padding.l + trapLocal * candleW + candleW / 2;
          const tc = data[trapLocal];
          ctx.fillStyle = isBull ?
          'rgba(239,83,80,0.10)' :
          'rgba(38,166,154,0.10)';
          ctx.fillRect(tx - candleW / 2, padding.t, candleW, priceH);
          // Marker ring on the swept extreme
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          const markY = isBull ? yOf(tc.high) : yOf(tc.low);
          ctx.beginPath();
          ctx.arc(tx, markY, 6, 0, Math.PI * 2);
          ctx.stroke();
          // Trap label pill above/below
          const labelY = isBull ? yOf(tc.high) - 16 : yOf(tc.low) + 18;
          pill(
            isBull ? '▼ BULL TRAP' : '▲ BEAR TRAP',
            tx,
            labelY,
            accent,
            '#fff',
            'center'
          );
        }
      }
      // ── Last price line + pill ──
      const last = data[data.length - 1];
      const lastY = yOf(last.close);
      ctx.strokeStyle = COL.last;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.l, lastY);
      ctx.lineTo(padding.l + w, lastY);
      ctx.stroke();
      ctx.setLineDash([]);
      // price tag in the right gutter
      ctx.fillStyle = COL.last;
      ctx.fillRect(padding.l + w, lastY - 8, padding.r, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(last.close.toFixed(dec), padding.l + w + 5, lastY + 3);
    };
    draw();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    });
    ro.observe(parent);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [candles, trap, height, timeframe]);
  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Professional candlestick chart with bull/bear trap detection overlay"
        style={{
          height,
          width: '100%',
          display: 'block'
        }} />
      
    </div>);

}