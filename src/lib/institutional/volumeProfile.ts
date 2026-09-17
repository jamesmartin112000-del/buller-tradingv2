import type {
  HvnNode,
  InstitutionalCandle,
  LvnNode,
  VolumeProfile } from
'./types';

interface VolumeNode {
  price: number;
  volume: number;
}

const EMPTY_PROFILE: VolumeProfile = {
  poc: 0,
  vah: 0,
  val: 0,
  valueAreaWidth: 0,
  highVolumeNodes: [],
  lowVolumeNodes: [],
  totalVolume: 0,
  sessionType: 'balanced'
};

export function calculateVolumeProfile(
candles: InstitutionalCandle[],
valueAreaPercent = 68)
: VolumeProfile {
  if (!candles.length) return EMPTY_PROFILE;
  const distribution = buildDistribution(candles);
  if (!distribution.length) {
    const last = candles[candles.length - 1];
    return { ...EMPTY_PROFILE, poc: last.close, vah: last.high, val: last.low };
  }

  const pocIndex = distribution.reduce(
    (best, node, index) => node.volume > distribution[best].volume ? index : best,
    0
  );
  const poc = distribution[pocIndex].price;
  const totalVolume = distribution.reduce((sum, node) => sum + node.volume, 0);
  const target = totalVolume * (valueAreaPercent / 100);
  let accumulated = distribution[pocIndex].volume;
  let upper = pocIndex + 1;
  let lower = pocIndex - 1;
  let vah = poc;
  let val = poc;

  while (accumulated < target && (lower >= 0 || upper < distribution.length)) {
    const upperVolume = distribution[upper]?.volume ?? -1;
    const lowerVolume = distribution[lower]?.volume ?? -1;
    if (upperVolume >= lowerVolume && upper < distribution.length) {
      accumulated += upperVolume;
      vah = distribution[upper].price;
      upper += 1;
    } else if (lower >= 0) {
      accumulated += lowerVolume;
      val = distribution[lower].price;
      lower -= 1;
    }
  }

  const average = totalVolume / distribution.length;
  const deviation = Math.sqrt(
    distribution.reduce((sum, node) => sum + (node.volume - average) ** 2, 0) /
    distribution.length
  );
  const highVolumeNodes: HvnNode[] = distribution.
  filter((node) => node.volume > average + deviation * 0.5).
  map((node) => ({
    price: node.price,
    volume: node.volume,
    isPoc: node.price === poc,
    type: node.price > poc ? 'resistance' : node.price < poc ? 'support' : 'neutral'
  })).
  sort((a, b) => b.volume - a.volume).
  slice(0, 8);
  const lowVolumeNodes = buildLowVolumeNodes(distribution, average - deviation * 0.5);
  const first = candles[0];
  const last = candles[candles.length - 1];
  const width = Math.max(vah - val, Number.EPSILON);
  const displacement = Math.abs(last.close - first.open);
  const pocDislocation = Math.abs(poc - first.open);
  const sessionType =
  displacement > width * 0.6 ?
  'trending' :
  pocDislocation > width * 0.3 && Math.abs(last.close - poc) > width * 0.3 ?
  'doubleDistribution' :
  'balanced';

  return {
    poc: roundPrice(poc),
    vah: roundPrice(vah),
    val: roundPrice(val),
    valueAreaWidth: roundPrice(vah - val),
    highVolumeNodes,
    lowVolumeNodes,
    totalVolume,
    sessionType
  };
}

function buildDistribution(candles: InstitutionalCandle[]): VolumeNode[] {
  const lows = candles.map((candle) => candle.low);
  const highs = candles.map((candle) => candle.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = Math.max(max - min, Math.abs(max) * 0.0001, 0.01);
  const step = range / 80;
  const buckets = new Map<number, number>();

  candles.forEach((candle) => {
    const candleRange = Math.max(candle.high - candle.low, step);
    const levelCount = Math.max(1, Math.ceil(candleRange / step));
    const volumePerLevel = candle.volume / levelCount;
    for (let i = 0; i < levelCount; i += 1) {
      const price = Math.min(candle.high, candle.low + (i + 0.5) * step);
      const key = Math.round((price - min) / step);
      buckets.set(key, (buckets.get(key) ?? 0) + volumePerLevel);
    }
  });

  return [...buckets.entries()].
  map(([key, volume]) => ({ price: min + key * step, volume })).
  filter((node) => node.volume > 0).
  sort((a, b) => a.price - b.price);
}

function buildLowVolumeNodes(nodes: VolumeNode[], threshold: number): LvnNode[] {
  const result: LvnNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    if (nodes[index].volume >= threshold) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < nodes.length && nodes[index].volume < threshold) index += 1;
    const slice = nodes.slice(start, index);
    result.push({
      priceLow: roundPrice(slice[0].price),
      priceHigh: roundPrice(slice[slice.length - 1].price),
      gapVolume: slice.reduce((sum, node) => sum + node.volume, 0),
      expectedMoveSpeed: slice.length > 2 ? 'veryFast' : 'fast'
    });
  }
  return result.slice(0, 8);
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quickVolumeLevels(candles: InstitutionalCandle[]) {
  const profile = calculateVolumeProfile(candles);
  return { support: profile.val, resistance: profile.vah, pivot: profile.poc };
}