// ============================================================
// Binance real-time market data — ZERO API keys required.
// REST seed (public klines endpoint) + live WebSocket kline
// stream with auto-reconnect. Singleton, Map-keyed per stream.
// ============================================================

export interface BinanceCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  isClosed: boolean;
}

type StreamKey = string; // `${SYMBOL}_${interval}`

class BinanceWS {
  private connections = new Map<StreamKey, WebSocket>();
  private cache = new Map<StreamKey, BinanceCandle[]>();
  private reconnectTimers = new Map<StreamKey, ReturnType<typeof setTimeout>>();
  private listeners = new Map<StreamKey, Set<(c: BinanceCandle) => void>>();
  private seeding = new Map<StreamKey, Promise<void>>();

  private key(symbol: string, interval: string): StreamKey {
    return `${symbol.toUpperCase()}_${interval}`;
  }

  /** Seed historical candles from public REST (free, CORS-friendly). */
  private async seed(symbol: string, interval: string): Promise<void> {
    const k = this.key(symbol, interval);
    if (this.seeding.has(k)) return this.seeding.get(k)!;
    const p = (async () => {
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=500`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data: unknown[][] = await res.json();
        const candles: BinanceCandle[] = data.map((c, index) => ({
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5]),
          timestamp: Number(c[0]),
          // Binance REST includes the currently forming kline as its last item.
          // Confirmation engines must never treat that bar as completed.
          isClosed: index < data.length - 1
        }));
        this.cache.set(k, candles);
      } catch {

        /* network fail — caller handles null */} finally {
        this.seeding.delete(k);
      }
    })();
    this.seeding.set(k, p);
    return p;
  }

  /** Open (or reuse) a stream only while at least one mounted subscriber owns it. */
  connect(symbol: string, interval: string) {
    const k = this.key(symbol, interval);
    if (
    this.connections.has(k) ||
    !this.listeners.get(k)?.size ||
    document.visibilityState !== 'visible')
    {
      return;
    }
    const pendingReconnect = this.reconnectTimers.get(k);
    if (pendingReconnect) {
      clearTimeout(pendingReconnect);
      this.reconnectTimers.delete(k);
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
      );
    } catch {
      return;
    }
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        const kl = d.k;
        if (!kl) return;
        const candle: BinanceCandle = {
          open: +kl.o,
          high: +kl.h,
          low: +kl.l,
          close: +kl.c,
          volume: +kl.v,
          timestamp: kl.t,
          isClosed: !!kl.x
        };
        const arr = this.cache.get(k) || [];
        const last = arr[arr.length - 1];
        if (last && last.timestamp === candle.timestamp) {
          arr[arr.length - 1] = candle;
        } else {
          arr.push(candle);
          if (arr.length > 500) arr.splice(0, arr.length - 500);
        }
        this.cache.set(k, arr);
        this.listeners.get(k)?.forEach((listener) => {
          try {
            listener(candle);
          } catch (error) {
            console.error('Binance stream listener failed', error);
          }
        });
      } catch (error) {
        console.error('Invalid Binance stream payload', error);
      }
    };
    ws.onclose = () => {
      this.connections.delete(k);
      if (
      this.listeners.get(k)?.size &&
      document.visibilityState === 'visible')
      {
        const timer = setTimeout(() => this.connect(symbol, interval), 5000);
        this.reconnectTimers.set(k, timer);
      }
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch (error) {
        console.error('Unable to close failed Binance stream', error);
      }
    };
    this.connections.set(k, ws);
  }

  disconnect(symbol: string, interval: string, clearCachedData = false) {
    const k = this.key(symbol, interval);
    const reconnectTimer = this.reconnectTimers.get(k);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    this.reconnectTimers.delete(k);
    const ws = this.connections.get(k);
    this.connections.delete(k);
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch (error) {
        console.error('Unable to close Binance stream', error);
      }
    }
    if (clearCachedData) this.cache.delete(k);
  }

  /** Fetch a bounded snapshot. A WebSocket is opened only by subscribe(). */
  async getLatestData(
  symbol: string,
  interval: string)
  : Promise<BinanceCandle[] | null> {
    const k = this.key(symbol, interval);
    if (!this.cache.has(k) || (this.cache.get(k) || []).length < 100) {
      await this.seed(symbol, interval);
    }
    const arr = this.cache.get(k);
    return arr?.length ? arr.slice(-500) : null;
  }

  /** Subscribe to live candle ticks. The final unsubscribe closes the stream. */
  subscribe(
  symbol: string,
  interval: string,
  fn: (c: BinanceCandle) => void)
  : () => void {
    const k = this.key(symbol, interval);
    if (!this.listeners.has(k)) this.listeners.set(k, new Set());
    this.listeners.get(k)!.add(fn);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') this.connect(symbol, interval);else
      this.disconnect(symbol, interval);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.connect(symbol, interval);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const listeners = this.listeners.get(k);
      listeners?.delete(fn);
      if (!listeners?.size) {
        this.listeners.delete(k);
        this.disconnect(symbol, interval, true);
      }
    };
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const r = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`,
        { cache: 'no-store' }
      );
      const d = await r.json();
      return +d.price || 0;
    } catch {
      return 0;
    }
  }

  disconnectAll() {
    Array.from(this.connections.keys()).forEach((streamKey) => {
      const splitAt = streamKey.lastIndexOf('_');
      this.disconnect(streamKey.slice(0, splitAt), streamKey.slice(splitAt + 1));
    });
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
  }
}

export const binanceWS = new BinanceWS();