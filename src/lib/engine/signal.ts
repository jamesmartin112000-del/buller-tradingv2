import type {
  Analysis,
  Candle,
  Timeframe,
  Signal,
  Confirmation,
  Price,
  EntryPlan } from
'./types';
import {
  calcATR,
  calcBB,
  calcStochastic,
  calcStochRSI,
  calcADX,
  calcIchimoku,
  calcVolumeProfile,
  calcMACDCross } from
'./indicators';
import { detectLiquidityGrab } from './smc';
import { detectCandlestickPatterns } from './patterns';
import { detectChartPatterns } from './chartPatterns';

export function genSignal(
pair: string,
price: Price,
candles: Record<Timeframe, Candle[]>,
a: Analysis)
: Signal | null {
  if (!price || !price.mid) return null;
  const cp = price.mid;
  const atr = calcATR(candles) || cp * 0.003;

  // Real executions fill at the ask (buy) and bid (sell), not the mid.
  // Guard against missing / zero / inverted quotes — fall back to mid.
  const buyPx =
  typeof price.ask === 'number' &&
  isFinite(price.ask) &&
  price.ask > 0 &&
  price.ask >= cp * 0.95 &&
  price.ask <= cp * 1.05 ?
  price.ask :
  cp;
  const sellPx =
  typeof price.bid === 'number' &&
  isFinite(price.bid) &&
  price.bid > 0 &&
  price.bid >= cp * 0.95 &&
  price.bid <= cp * 1.05 ?
  price.bid :
  cp;

  const sig: Signal = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    pair,
    ts: Date.now(),
    price: cp,
    dir: 'NEUTRAL',
    str: 0,
    buy: {
      active: false,
      conf: 0,
      entry: buyPx,
      sl: buyPx - atr * 1.5,
      tp: buyPx + atr * 3,
      rr: 2,
      reasons: [],
      priority: 0
    },
    sell: {
      active: false,
      conf: 0,
      entry: sellPx,
      sl: sellPx + atr * 1.5,
      tp: sellPx - atr * 3,
      rr: 2,
      reasons: [],
      priority: 0
    },
    confs: [],
    action: 'HOLD',
    reason: 'Analyzing...',
    priority: { dir: 'NEUTRAL', score: 0, desc: '' },
    bigPlayers: { dir: 'NEUTRAL', desc: '' },
    strategiesUsed: []
  };

  const { mtf, amd, ict, of, trends: tr, vol, pak, sup, res } = a;
  const lg = detectLiquidityGrab(candles);
  const bb = calcBB(candles);
  const confs: Confirmation[] = [];
  const strategies: string[] = [];

  // === ADVANCED INDICATORS (on 1h candles) ===
  const cs1h = candles['1h'] || [];
  const cs15m = candles['15m'] || [];
  const closes1h = cs1h.map((c) => c.c);
  const stochastic = calcStochastic(cs1h);
  const stochRsi = calcStochRSI(closes1h);
  const adx = calcADX(cs1h);
  const ichimoku = calcIchimoku(cs1h);
  const volProfile = calcVolumeProfile(cs1h);
  const macdCross = calcMACDCross(closes1h);

  // === CANDLESTICK & CHART PATTERNS ===
  const candlePatterns = detectCandlestickPatterns(
    cs15m.length >= 20 ? cs15m : cs1h
  );
  const chartPatterns = detectChartPatterns(cs1h);

  // 1. MTF
  if (tr.align > 50) {
    confs.push({ t: 'MTF_ALIGN_BULLISH', w: 30, s: 'mtf' });
    strategies.push('MTF Alignment: 3/3 Bullish');
  } else if (tr.align < -50) {
    confs.push({ t: 'MTF_ALIGN_BEARISH', w: 30, s: 'mtf' });
    strategies.push('MTF Alignment: 3/3 Bearish');
  }

  // 2. AMD
  if (amd.phase === 'ACCUMULATION') {
    confs.push({ t: 'AMD_ACCUMULATION', w: 35, s: 'amd' });
    strategies.push('AMD: Smart Money Accumulating');
  } else if (amd.phase === 'MANIPULATION' && amd.manip?.dir === 'bullish') {
    confs.push({ t: 'AMD_MANIP_BULLISH', w: 40, s: 'manip' });
    strategies.push('AMD: Bear Trap = BUY Signal');
  } else if (amd.phase === 'MANIPULATION' && amd.manip?.dir === 'bearish') {
    confs.push({ t: 'AMD_MANIP_BEARISH', w: 40, s: 'manip' });
    strategies.push('AMD: Bull Trap = SELL Signal');
  } else if (amd.phase === 'DISTRIBUTION' && amd.dist?.dir === 'bullish') {
    confs.push({ t: 'AMD_DIST_BULLISH', w: 30, s: 'amd' });
    strategies.push('AMD: Distribution UP = Bullish');
  } else if (amd.phase === 'DISTRIBUTION' && amd.dist?.dir === 'bearish') {
    confs.push({ t: 'AMD_DIST_BEARISH', w: 30, s: 'amd' });
    strategies.push('AMD: Distribution DOWN = Bearish');
  }

  // 3. ICT
  if (ict.zone === 'discount') {
    confs.push({ t: 'ICT_DISCOUNT_ZONE', w: 25, s: 'ict' });
    strategies.push('ICT: Price at Discount Zone (Buy Zone)');
  } else if (ict.zone === 'premium') {
    confs.push({ t: 'ICT_PREMIUM_ZONE', w: 25, s: 'ict' });
    strategies.push('ICT: Price at Premium Zone (Sell Zone)');
  }
  if (ict.fvgs?.some((f) => f.t === 'bullish_fvg')) {
    confs.push({ t: 'BULLISH_FVG', w: 20, s: 'fvg' });
    strategies.push('ICT: Bullish Fair Value Gap');
  }
  if (ict.fvgs?.some((f) => f.t === 'bearish_fvg')) {
    confs.push({ t: 'BEARISH_FVG', w: 20, s: 'fvg' });
    strategies.push('ICT: Bearish Fair Value Gap');
  }

  // 4. Order Flow
  if (of.imb === 'strong_buying') {
    confs.push({ t: 'OF_STRONG_BUYING', w: 30, s: 'orderflow' });
    strategies.push('Order Flow: Strong Buying Pressure');
  } else if (of.imb === 'strong_selling') {
    confs.push({ t: 'OF_STRONG_SELLING', w: 30, s: 'orderflow' });
    strategies.push('Order Flow: Strong Selling Pressure');
  }

  // 5. RSI
  ;(Object.entries(mtf || {}) as Array<[Timeframe, any]>).forEach(([tf, d]) => {
    if (d?.rsiVal < 30) {
      confs.push({ t: `RSI_OVERSOLD_${tf}`, w: 20, s: 'rsi' });
      strategies.push(`RSI: Oversold ${tf} (${d.rsiVal})`);
    } else if (d?.rsiVal > 70) {
      confs.push({ t: `RSI_OVERBOUGHT_${tf}`, w: 20, s: 'rsi' });
      strategies.push(`RSI: Overbought ${tf} (${d.rsiVal})`);
    }
  });

  // 6. Pakistan
  if (pak?.brk?.dir === 'bullish') {
    confs.push({ t: 'PAK_10AM_BULLISH', w: 35, s: 'pakistan' });
    strategies.push('Pakistan 10AM: Bullish Breakout');
  } else if (pak?.brk?.dir === 'bearish') {
    confs.push({ t: 'PAK_10AM_BEARISH', w: 35, s: 'pakistan' });
    strategies.push('Pakistan 10AM: Bearish Breakout');
  }

  // 7. Liquidity Grab
  if (lg.signal === 'BUY') {
    confs.push({ t: 'LIQUIDITY_GRAB_BULLISH', w: 45, s: 'liquidity' });
    strategies.push('Liquidity Grab: Swept Low + Reversal = BUY');
  } else if (lg.signal === 'SELL') {
    confs.push({ t: 'LIQUIDITY_GRAB_BEARISH', w: 45, s: 'liquidity' });
    strategies.push('Liquidity Grab: Swept High + Reversal = SELL');
  }

  // 8. Bollinger
  if (bb.lower && cp <= bb.lower * 1.001 && tr.medium?.dir === 'bullish') {
    confs.push({ t: 'BB_LOWER_TOUCH_BULLISH', w: 20, s: 'bb' });
    strategies.push('Bollinger: Lower Band Touch + Bullish Trend');
  }
  if (bb.upper && cp >= bb.upper * 0.999 && tr.medium?.dir === 'bearish') {
    confs.push({ t: 'BB_UPPER_TOUCH_BEARISH', w: 20, s: 'bb' });
    strategies.push('Bollinger: Upper Band Touch + Bearish Trend');
  }

  // 9. S/R
  if (sup?.length && Math.abs(cp - sup[0].p) / cp * 100 < 0.3) {
    confs.push({ t: 'AT_STRONG_SUPPORT', w: 25, s: 'sr' });
    strategies.push('Near Strong Support Level');
  }
  if (res?.length && Math.abs(cp - res[0].p) / cp * 100 < 0.3) {
    confs.push({ t: 'AT_STRONG_RESISTANCE', w: 25, s: 'sr' });
    strategies.push('Near Strong Resistance Level');
  }

  // 10. Volatility
  if (vol?.regime === 'low') {
    confs.push({ t: 'LOW_VOL_EXPANSION_EXPECTED', w: 15, s: 'vol' });
    strategies.push('Low Volatility: Expansion Expected');
  }
  if (vol?.regime === 'extreme') {
    confs.push({ t: 'EXTREME_VOL_REVERSAL', w: 20, s: 'vol' });
    strategies.push('Extreme Volatility: Reversal Possible');
  }

  // ============================================================
  // === NEW STRATEGIES — Advanced indicators + pattern engines ==
  // ============================================================

  // 11. Stochastic — oversold/overbought
  if (stochastic) {
    if (stochastic.k < 20 && stochastic.d < 20) {
      confs.push({ t: 'STOCH_OVERSOLD_BULLISH', w: 18, s: 'stoch' });
      strategies.push(
        `Stochastic: Oversold (${stochastic.k.toFixed(0)}/${stochastic.d.toFixed(0)})`
      );
    } else if (stochastic.k > 80 && stochastic.d > 80) {
      confs.push({ t: 'STOCH_OVERBOUGHT_BEARISH', w: 18, s: 'stoch' });
      strategies.push(
        `Stochastic: Overbought (${stochastic.k.toFixed(0)}/${stochastic.d.toFixed(0)})`
      );
    }
  }

  // 12. Stochastic RSI cross
  if (stochRsi) {
    if (stochRsi.k < 20) {
      confs.push({ t: 'STOCHRSI_OVERSOLD_BULLISH', w: 15, s: 'stochrsi' });
      strategies.push(`StochRSI: Oversold (${stochRsi.k.toFixed(0)})`);
    } else if (stochRsi.k > 80) {
      confs.push({ t: 'STOCHRSI_OVERBOUGHT_BEARISH', w: 15, s: 'stochrsi' });
      strategies.push(`StochRSI: Overbought (${stochRsi.k.toFixed(0)})`);
    }
  }

  // 13. ADX — strong trend confirmation
  if (adx && adx.adx > 25) {
    if (adx.direction === 'bullish') {
      confs.push({ t: 'ADX_STRONG_BULLISH_TREND', w: 22, s: 'adx' });
      strategies.push(`ADX: Strong Bullish Trend (${adx.adx.toFixed(0)})`);
    } else {
      confs.push({ t: 'ADX_STRONG_BEARISH_TREND', w: 22, s: 'adx' });
      strategies.push(`ADX: Strong Bearish Trend (${adx.adx.toFixed(0)})`);
    }
  }

  // 14. Ichimoku Cloud
  if (ichimoku) {
    if (ichimoku.priceAboveCloud && ichimoku.cloudBullish) {
      confs.push({ t: 'ICHIMOKU_BULLISH_CLOUD', w: 20, s: 'ichimoku' });
      strategies.push('Ichimoku: Price Above Bullish Cloud');
    } else if (ichimoku.priceBelowCloud && ichimoku.cloudBearish) {
      confs.push({ t: 'ICHIMOKU_BEARISH_CLOUD', w: 20, s: 'ichimoku' });
      strategies.push('Ichimoku: Price Below Bearish Cloud');
    }
  }

  // 15. Volume spike
  if (volProfile?.spike) {
    const rsi1h = mtf?.['1h']?.rsiVal;
    if (typeof rsi1h === 'number' && rsi1h < 35) {
      confs.push({ t: 'VOL_SPIKE_BULLISH', w: 18, s: 'volume' });
      strategies.push(`Volume Spike (${volProfile.ratio}x) + Oversold`);
    } else if (typeof rsi1h === 'number' && rsi1h > 65) {
      confs.push({ t: 'VOL_SPIKE_BEARISH', w: 18, s: 'volume' });
      strategies.push(`Volume Spike (${volProfile.ratio}x) + Overbought`);
    }
  }

  // 16. MACD crossover
  if (macdCross === 'bullish') {
    confs.push({ t: 'MACD_BULLISH_CROSS', w: 22, s: 'macd' });
    strategies.push('MACD: Bullish Crossover');
  } else if (macdCross === 'bearish') {
    confs.push({ t: 'MACD_BEARISH_CROSS', w: 22, s: 'macd' });
    strategies.push('MACD: Bearish Crossover');
  }

  // 17. Candlestick patterns
  const strongBullCandle = candlePatterns.find(
    (p) =>
    p.type === 'bullish' && (
    p.strength === 'very_strong' || p.strength === 'strong')
  );
  const strongBearCandle = candlePatterns.find(
    (p) =>
    p.type === 'bearish' && (
    p.strength === 'very_strong' || p.strength === 'strong')
  );
  if (strongBullCandle) {
    const w = strongBullCandle.strength === 'very_strong' ? 28 : 20;
    confs.push({ t: 'CANDLE_BULLISH_PATTERN', w, s: 'candle' });
    strategies.push(
      `Candle: ${strongBullCandle.name} (${strongBullCandle.strength})`
    );
  }
  if (strongBearCandle) {
    const w = strongBearCandle.strength === 'very_strong' ? 28 : 20;
    confs.push({ t: 'CANDLE_BEARISH_PATTERN', w, s: 'candle' });
    strategies.push(
      `Candle: ${strongBearCandle.name} (${strongBearCandle.strength})`
    );
  }

  // 18. Chart patterns
  const strongBullChart = chartPatterns.find(
    (p) => p.type === 'bullish' && p.strength === 'strong'
  );
  const strongBearChart = chartPatterns.find(
    (p) => p.type === 'bearish' && p.strength === 'strong'
  );
  if (strongBullChart) {
    confs.push({ t: 'CHART_BULLISH_PATTERN', w: 25, s: 'chart' });
    strategies.push(`Chart: ${strongBullChart.name}`);
  }
  if (strongBearChart) {
    confs.push({ t: 'CHART_BEARISH_PATTERN', w: 25, s: 'chart' });
    strategies.push(`Chart: ${strongBearChart.name}`);
  }

  sig.confs = confs;
  sig.strategiesUsed = strategies;

  // ============================================================
  // === SCORING ================================================
  // ============================================================

  let bc = 0,
    sc = 0;
  const br: Confirmation[] = [];
  const srArr: Confirmation[] = [];
  confs.forEach((c) => {
    const isBull =
    c.t.includes('BULLISH') ||
    c.t.includes('BUY') ||
    c.t === 'ICT_DISCOUNT_ZONE' ||
    c.t === 'OF_STRONG_BUYING' ||
    c.t.startsWith('RSI_OVERSOLD') ||
    c.t === 'AT_STRONG_SUPPORT' ||
    c.t === 'LOW_VOL_EXPANSION_EXPECTED' ||
    c.t === 'AMD_ACCUMULATION' ||
    c.t === 'BB_LOWER_TOUCH_BULLISH' ||
    c.t === 'STOCH_OVERSOLD_BULLISH' ||
    c.t === 'STOCHRSI_OVERSOLD_BULLISH' ||
    c.t === 'ADX_STRONG_BULLISH_TREND' ||
    c.t === 'ICHIMOKU_BULLISH_CLOUD' ||
    c.t === 'VOL_SPIKE_BULLISH' ||
    c.t === 'MACD_BULLISH_CROSS' ||
    c.t === 'CANDLE_BULLISH_PATTERN' ||
    c.t === 'CHART_BULLISH_PATTERN';
    const isBear =
    c.t.includes('BEARISH') ||
    c.t.includes('SELL') ||
    c.t === 'ICT_PREMIUM_ZONE' ||
    c.t === 'OF_STRONG_SELLING' ||
    c.t.startsWith('RSI_OVERBOUGHT') ||
    c.t === 'AT_STRONG_RESISTANCE' ||
    c.t === 'EXTREME_VOL_REVERSAL' ||
    c.t === 'BB_UPPER_TOUCH_BEARISH' ||
    c.t === 'STOCH_OVERBOUGHT_BEARISH' ||
    c.t === 'STOCHRSI_OVERBOUGHT_BEARISH' ||
    c.t === 'ADX_STRONG_BEARISH_TREND' ||
    c.t === 'ICHIMOKU_BEARISH_CLOUD' ||
    c.t === 'VOL_SPIKE_BEARISH' ||
    c.t === 'MACD_BEARISH_CROSS' ||
    c.t === 'CANDLE_BEARISH_PATTERN' ||
    c.t === 'CHART_BEARISH_PATTERN';
    if (isBull) {
      bc += c.w;
      br.push(c);
    }
    if (isBear) {
      sc += c.w;
      srArr.push(c);
    }
  });

  const rr = Math.round(atr * 3 / (atr * 1.5 || 1) * 10) / 10;
  sig.buy = {
    active: bc >= 25,
    conf: Math.min(bc, 100),
    entry: buyPx,
    sl: buyPx - atr * 1.5,
    tp: buyPx + atr * 3,
    rr,
    reasons: br.map((r) => r.t),
    priority: bc
  };
  sig.sell = {
    active: sc >= 25,
    conf: Math.min(sc, 100),
    entry: sellPx,
    sl: sellPx + atr * 1.5,
    tp: sellPx - atr * 3,
    rr,
    reasons: srArr.map((r) => r.t),
    priority: sc
  };

  // Big Players
  let bpDir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let bpDesc = 'No clear institutional signal detected';
  if (amd.phase === 'ACCUMULATION') {
    bpDir = 'BUY';
    bpDesc =
    'Big players ACCUMULATING. Price suppressed for institutional buying. Expect upward breakout.';
  } else if (amd.phase === 'DISTRIBUTION' && amd.dist?.dir === 'bullish') {
    bpDir = 'BUY';
    bpDesc =
    'Big players distributing into strength. Selling into rallies — trail tight.';
  } else if (amd.phase === 'DISTRIBUTION' && amd.dist?.dir === 'bearish') {
    bpDir = 'SELL';
    bpDesc = 'Big players distributing aggressively. Expect continued decline.';
  } else if (amd.phase === 'MANIPULATION' && amd.manip?.dir === 'bullish') {
    bpDir = 'BUY';
    bpDesc =
    'Bear trap engineered by institutions. Fake breakdown, real direction = UP.';
  } else if (amd.phase === 'MANIPULATION' && amd.manip?.dir === 'bearish') {
    bpDir = 'SELL';
    bpDesc =
    'Bull trap engineered by institutions. Fake breakout, real direction = DOWN.';
  } else if (lg.signal === 'BUY') {
    bpDir = 'BUY';
    bpDesc =
    'Liquidity swept below. Stops hunted, accumulation begun. Real direction: UP.';
  } else if (lg.signal === 'SELL') {
    bpDir = 'SELL';
    bpDesc =
    'Liquidity swept above. Stops hunted, distribution begun. Real direction: DOWN.';
  }
  sig.bigPlayers = { dir: bpDir, desc: bpDesc };

  // Final
  let finalDir: Signal['dir'] = 'HOLD';
  let finalScore = 0;
  let finalDesc = 'HOLD';
  if (bc >= sc + 15 && bc >= 35) {
    finalDir = 'BUY';
    finalScore = bc;
    finalDesc = br.
    slice(0, 3).
    map((r) => r.t).
    join(' → ');
  } else if (sc >= bc + 15 && sc >= 35) {
    finalDir = 'SELL';
    finalScore = sc;
    finalDesc = srArr.
    slice(0, 3).
    map((r) => r.t).
    join(' → ');
  } else {
    if (bpDir === 'BUY' && bc > 25) {
      finalDir = 'BUY';
      finalScore = bc;
      finalDesc = br.
      slice(0, 3).
      map((r) => r.t).
      join(' → ');
    } else if (bpDir === 'SELL' && sc > 25) {
      finalDir = 'SELL';
      finalScore = sc;
      finalDesc = srArr.
      slice(0, 3).
      map((r) => r.t).
      join(' → ');
    } else {
      finalDir = bc > sc ? 'WATCH_BUY' : sc > bc ? 'WATCH_SELL' : 'HOLD';
      finalScore = Math.max(bc, sc);
      finalDesc = `Buy ${bc}% / Sell ${sc}% — Conflicted`;
    }
  }

  // Cap at 100% — confidence is a probability, not a raw weighted sum.
  finalScore = Math.min(100, Math.max(0, finalScore));

  // === TRAP / MANIPULATION DETECTION ===
  const traps: string[] = [];
  let trapDir: 'BULL_TRAP' | 'BEAR_TRAP' | null = null;

  if (amd.phase === 'MANIPULATION') {
    if (amd.manip?.dir === 'bullish') {
      traps.push('Bear trap detected — fake breakdown, real direction UP');
      trapDir = 'BEAR_TRAP';
    } else if (amd.manip?.dir === 'bearish') {
      traps.push('Bull trap detected — fake breakout, real direction DOWN');
      trapDir = 'BULL_TRAP';
    }
  }

  if (finalDir === 'BUY' && ict.zone === 'premium') {
    traps.push(
      'Caution: BUY signal at PREMIUM zone — likely retail bull trap before institutional sell-off'
    );
    if (!trapDir) trapDir = 'BULL_TRAP';
  }
  if (finalDir === 'SELL' && ict.zone === 'discount') {
    traps.push(
      'Caution: SELL signal at DISCOUNT zone — likely retail bear trap before institutional buy-up'
    );
    if (!trapDir) trapDir = 'BEAR_TRAP';
  }

  if (lg.signal === 'BUY') {
    traps.push(
      'Stop hunt below low — liquidity swept, smart money reversing UP'
    );
    if (!trapDir) trapDir = 'BEAR_TRAP';
  } else if (lg.signal === 'SELL') {
    traps.push(
      'Stop hunt above high — liquidity swept, smart money reversing DOWN'
    );
    if (!trapDir) trapDir = 'BULL_TRAP';
  }

  if (finalDir === 'BUY' && of.imb === 'strong_selling' && finalScore > 40) {
    traps.push(
      'Bullish signal but selling pressure dominant — verify before entry'
    );
  }
  if (finalDir === 'SELL' && of.imb === 'strong_buying' && finalScore > 40) {
    traps.push(
      'Bearish signal but buying pressure dominant — verify before entry'
    );
  }

  const rsi1h = (mtf as any)?.['1h']?.rsiVal;
  if (finalDir === 'BUY' && typeof rsi1h === 'number' && rsi1h > 75) {
    traps.push(`RSI 1h overbought at ${rsi1h.toFixed(0)} — chasing entry risky`);
  }
  if (finalDir === 'SELL' && typeof rsi1h === 'number' && rsi1h < 25) {
    traps.push(`RSI 1h oversold at ${rsi1h.toFixed(0)} — short entry risky`);
  }

  sig.traps = traps;
  sig.trapDir = trapDir;

  sig.dir = finalDir;
  sig.str = finalScore;
  sig.action = finalDir;
  sig.reason = finalDesc;
  sig.priority = { dir: finalDir, score: finalScore, desc: finalDesc };
  sig.buy.conf = Math.min(100, sig.buy.conf);
  sig.sell.conf = Math.min(100, sig.sell.conf);

  // ============================================================
  // === MULTI-ENTRY PLAN =======================================
  // ============================================================
  // Build 3 staggered entry plans:
  //   • Aggressive: market entry now (highest fill rate, weaker R:R)
  //   • Standard: pullback to mid-zone (atr * 0.5 against direction)
  //   • Conservative: deeper pullback to OB/support (atr * 1.0 against)
  //
  // Each marks "confirmed" only when enough confluence supports it AND
  // current price has reached the trigger zone.
  sig.entries = buildEntryPlans(
    finalDir,
    cp,
    buyPx,
    sellPx,
    atr,
    finalScore,
    sup,
    res
  );

  // Compact pattern + indicator snapshots for the UI
  sig.candlePatterns = candlePatterns.slice(0, 5).map((p) => ({
    name: p.name,
    type: p.type,
    strength: p.strength
  }));
  sig.chartPatterns = chartPatterns.map((p) => ({
    name: p.name,
    type: p.type,
    strength: p.strength,
    target: p.target
  }));
  sig.advIndicators = {
    stochastic,
    stochRsi,
    adx: adx ?
    { adx: adx.adx, trend: adx.trend, direction: adx.direction } :
    null,
    ichimoku: ichimoku ?
    {
      cloudBullish: ichimoku.cloudBullish,
      priceAboveCloud: ichimoku.priceAboveCloud
    } :
    null,
    volume: volProfile ?
    { ratio: volProfile.ratio, spike: volProfile.spike } :
    null,
    macdCross
  };

  return sig;
}

function buildEntryPlans(
dir: Signal['dir'],
cp: number,
buyPx: number,
sellPx: number,
atr: number,
score: number,
sup: Analysis['sup'],
res: Analysis['res'])
: EntryPlan[] {
  if (
  dir !== 'BUY' &&
  dir !== 'SELL' &&
  dir !== 'WATCH_BUY' &&
  dir !== 'WATCH_SELL')
  {
    return [];
  }
  const isBuy = dir === 'BUY' || dir === 'WATCH_BUY';
  const sign = isBuy ? 1 : -1;
  // Execution price: asks fill buys, bids fill sells.
  const px = isBuy ? buyPx : sellPx;

  // Aggressive entry uses the real execution price; pullbacks derived from ATR
  const aggressiveEntry = px;
  const standardEntry = px - sign * atr * 0.4;

  let conservativeEntry: number;
  if (isBuy) {
    const supLevel = sup?.[0]?.p;
    conservativeEntry =
    supLevel != null ? Math.max(px - atr * 1.0, supLevel) : px - atr * 1.0;
  } else {
    const resLevel = res?.[0]?.p;
    conservativeEntry =
    resLevel != null ? Math.min(px + atr * 1.0, resLevel) : px + atr * 1.0;
  }

  const slDist = atr * 1.5;
  const mk = (
  entry: number,
  label: EntryPlan['label'],
  trigger: string,
  mult: number)
  : EntryPlan => {
    const sl = isBuy ? entry - slDist : entry + slDist;
    const risk = Math.abs(entry - sl);
    return {
      label,
      entry,
      sl,
      tp1: isBuy ? entry + risk * 2 : entry - risk * 2,
      tp2: isBuy ? entry + risk * 4 : entry - risk * 4,
      tp3: isBuy ? entry + risk * 6 * mult : entry - risk * 6 * mult,
      rr: Number((6 * mult).toFixed(1)),
      trigger,
      confirmed: isReached(cp, entry, isBuy, label) && score >= 35
    };
  };

  return [
  mk(
    aggressiveEntry,
    'aggressive',
    'Market entry — enter now at current price',
    1
  ),
  mk(
    standardEntry,
    'standard',
    isBuy ?
    'Pullback to mid-zone — wait for retest' :
    'Pullback to mid-zone — wait for retest',
    1.25
  ),
  mk(
    conservativeEntry,
    'conservative',
    isBuy ?
    'Deep pullback to support / OB — best R:R' :
    'Deep pullback to resistance / OB — best R:R',
    1.5
  )];

}

function isReached(
cp: number,
entry: number,
isBuy: boolean,
label: EntryPlan['label'])
: boolean {
  // Aggressive entry is always "ready" by definition (market price)
  if (label === 'aggressive') return true;
  // Standard / conservative: confirmed when price touches the entry zone
  const tol = Math.abs(entry) * 0.0008;
  if (isBuy) return cp <= entry + tol;
  return cp >= entry - tol;
}