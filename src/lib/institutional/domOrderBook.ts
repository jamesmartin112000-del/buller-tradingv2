import type {
  AbsorptionSignal,
  DomAnalysis,
  InstitutionalCandle,
  Level2Entry,
  OrderBookSnapshot } from
'./types';

export function simulateOrderBook(candles: InstitutionalCandle[]): OrderBookSnapshot {
  const latest = candles.at(-1);
  if (!latest) {
    return { timestamp: Date.now(), bids: [], asks: [], spread: 0, midPrice: 0, imbalance: 0 };
  }
  const window = candles.slice(-20);
  const averageVolume = window.reduce((sum, candle) => sum + candle.volume, 0) / window.length;
  const averageRange =
  window.reduce((sum, candle) => sum + Math.max(0, candle.high - candle.low), 0) /
  window.length;
  const step = Math.max(averageRange / 20, latest.close * 0.00002, 0.01);
  const momentum = (latest.close - window[0].open) / Math.max(averageRange, step);
  const pressure = Math.max(-0.35, Math.min(0.35, momentum * 0.08));

  const makeSide = (type: 'bid' | 'ask'): Level2Entry[] =>
  Array.from({ length: 10 }, (_, index) => {
    const depthDecay = 1 - index * 0.055;
    const wave = 0.78 + (index * 17 + Math.round(latest.close * 10)) % 19 / 35;
    const directional = type === 'bid' ? 1 + pressure : 1 - pressure;
    const wallBoost = index === (type === 'bid' ? 2 : 5) ? 2.8 : 1;
    const size = Math.max(1, Math.round(averageVolume * 0.045 * depthDecay * wave * directional * wallBoost));
    return {
      price: round(latest.close + (type === 'bid' ? -1 : 1) * step * (index + 1)),
      size,
      orders: Math.max(1, Math.round(size / Math.max(20, averageVolume * 0.004))),
      type
    };
  });
  const bids = makeSide('bid');
  const asks = makeSide('ask');
  const bidVolume = bids.reduce((sum, level) => sum + level.size, 0);
  const askVolume = asks.reduce((sum, level) => sum + level.size, 0);
  return {
    timestamp: Date.now(),
    bids,
    asks,
    spread: round(asks[0].price - bids[0].price),
    midPrice: round((asks[0].price + bids[0].price) / 2),
    imbalance: (bidVolume - askVolume) / Math.max(1, bidVolume + askVolume)
  };
}

export function analyzeDom(candles: InstitutionalCandle[]): DomAnalysis {
  const snapshot = simulateOrderBook(candles);
  const levels = [...snapshot.bids, ...snapshot.asks];
  if (!levels.length) {
    return { snapshot, absorption: null, walls: [], icebergDetection: false, stackedBook: false, spoofingAlert: false };
  }
  const averageSize = levels.reduce((sum, level) => sum + level.size, 0) / levels.length;
  const walls = levels.filter((level) => level.size > averageSize * 2.25);
  const stackedBook = [snapshot.bids, snapshot.asks].some((side) =>
  side.some((_, index) =>
  index <= side.length - 3 && side.slice(index, index + 3).every((level) => level.size > averageSize * 1.15)
  )
  );
  const absorption = detectAbsorption(snapshot, averageSize);
  const icebergDetection = levels.some(
    (level) => level.orders >= 5 && level.size / level.orders > averageSize * 0.12
  );
  const spoofingAlert = walls.some((wall) => {
    const side = wall.type === 'bid' ? snapshot.bids : snapshot.asks;
    const index = side.indexOf(wall);
    const neighborAverage = ((side[index - 1]?.size ?? 0) + (side[index + 1]?.size ?? 0)) / 2;
    return neighborAverage > 0 && wall.size > neighborAverage * 3.5;
  });
  return { snapshot, absorption, walls, icebergDetection, stackedBook, spoofingAlert };
}

function detectAbsorption(
snapshot: OrderBookSnapshot,
averageSize: number)
: AbsorptionSignal | null {
  const bid = snapshot.bids.find((level) => level.size > averageSize * 2.25);
  const ask = snapshot.asks.find((level) => level.size > averageSize * 2.25);
  if (bid && snapshot.imbalance > 0.12) {
    return {
      price: bid.price,
      side: 'buy',
      intensity: Math.min(100, Math.round(Math.abs(snapshot.imbalance) * 170 + 30)),
      volumeAccumulated: bid.size,
      isActive: true
    };
  }
  if (ask && snapshot.imbalance < -0.12) {
    return {
      price: ask.price,
      side: 'sell',
      intensity: Math.min(100, Math.round(Math.abs(snapshot.imbalance) * 170 + 30)),
      volumeAccumulated: ask.size,
      isActive: true
    };
  }
  return null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}