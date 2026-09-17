import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp } from
'lightweight-charts';
import type { BinanceCandle } from '../../lib/trading/binanceWebSocket';
interface Props {
  candles: BinanceCandle[];
  /** Latest live (possibly unclosed) candle for real-time updates. */
  live?: BinanceCandle | null;
}
/**
 * Standalone candlestick + volume chart that mirrors the vanilla engine's
 * lightweight-charts setup. Dark institutional theme, green/red candles,
 * volume histogram pinned to the bottom 15% of the pane.
 */
export function EngineChart({ candles, live }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Create chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: '#0a0e17'
        },
        textColor: '#94a3b8'
      },
      grid: {
        vertLines: {
          color: '#1e293b'
        },
        horzLines: {
          color: '#1e293b'
        }
      },
      crosshair: {
        mode: CrosshairMode.Normal
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: '#1e293b'
      },
      width: container.clientWidth,
      height: container.clientHeight
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444'
    });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume'
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0
      }
    });
    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight
      });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);
  // Set full dataset whenever the candle array reference changes (new symbol/tf).
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !candles.length) return;
    const candleData: CandlestickData[] = candles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));
    const volData: HistogramData[] = candles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'
    }));
    candleRef.current.setData(candleData);
    volumeRef.current.setData(volData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);
  // Real-time update of the latest candle.
  useEffect(() => {
    if (!live || !candleRef.current || !volumeRef.current) return;
    const t = Math.floor(live.timestamp / 1000) as UTCTimestamp;
    candleRef.current.update({
      time: t,
      open: live.open,
      high: live.high,
      low: live.low,
      close: live.close
    });
    volumeRef.current.update({
      time: t,
      value: live.volume,
      color:
      live.close >= live.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'
    });
  }, [live]);
  return <div ref={containerRef} className="w-full h-full" />;
}