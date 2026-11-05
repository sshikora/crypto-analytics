import NodeCache from 'node-cache';
import { getLatestSignals } from '../repositories/coinMetricsRepository';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { roundTrips, shuffledPrices, strategyReturns, walkForward } from '../models/backtest';
import { drawdowns } from '../models/performance';
import { Random } from '../models/random';
import { periodsPerYear } from '../models/returns';
import { deflatedSharpe, impliedTrials, periodSharpe, probabilisticSharpe } from '../models/sharpeInference';
import { crossoverPositions } from '../models/signals';

// Bump whenever the stored summary's fields or definitions change, so the API stops serving rows in the old shape
export const SIGNALS_VERSION = 1;

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 365;
// The grid, windows and cost studied in validation/notebooks/backtest.ipynb
const SHORTS = [1, 5, 10, 20];
const LONGS = [20, 30, 50, 100];
const GRID = SHORTS.flatMap(short => LONGS.filter(long => short < long).map(long => ({ short, long })));
// Every crossover is evaluated from the first close at which the slowest average exists
const START = Math.max(...LONGS) - 1;
const TRAIN = 120;
const TEST = 30;
const COST = 0.0015;
const SHUFFLES = 200;
const SEED = 20_261_106;
// Enough closes for one training window and one 30-day test
const MIN_PRICES = START + TRAIN + TEST + 1;
const COIN_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

export interface CrossoverVariant {
  short: number;
  long: number;
  // 1 while the short average is above the long one, 0 otherwise
  position: number;
  // Close at which the current state began; null if it held for the whole year
  since: string | null;
  sharpe: number;
  totalReturn: number;
  trades: number;
  timeInMarket: number;
}

export interface PerformanceLine {
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
}

export interface SignalSummary {
  coinId: string;
  asOf: string;
  cost: number;
  evaluatedFrom: string;
  observations: number;
  variants: CrossoverVariant[];
  impliedTrials: number;
  best: { short: number; long: number; sharpe: number; probabilisticSharpe: number; deflatedSharpe: number };
  holding: PerformanceLine;
  walkForward: {
    from: string;
    days: number;
    strategy: PerformanceLine;
    holding: PerformanceLine;
    timeInMarket: number;
    trades: number;
    closedTrades: number;
    winRate: number | null;
    // A trend rule often loses small on most trades and gains on a few, so the trade still open matters as much
    openTrade: { since: string; return: number } | null;
    folds: { from: string; short: number; long: number }[];
    equity: { date: string; strategy: number; holding: number }[];
  };
  timingPValue: number;
  shuffles: number;
}

const compound = (net: number[]) => net.reduce((growth, r) => growth * (1 + r), 1) - 1;

function equityCurve(net: number[]): number[] {
  const curve = [1];
  for (const r of net) curve.push(curve[curve.length - 1] * (1 + r));
  return curve;
}

function performanceLine(net: number[], annual: number, dates: string[]): PerformanceLine {
  const curve = equityCurve(net);
  return {
    sharpe: periodSharpe(net) * annual,
    totalReturn: compound(net),
    maxDrawdown: drawdowns(curve.map((price, i) => ({ date: dates[i], price }))).maxDrawdown,
  };
}

// The close at which the current state began, counting only changes once both averages exist
function since(positions: number[], long: number, dates: string[]): string | null {
  for (let k = positions.length - 1; k >= long; k--) {
    if (positions[k] !== positions[k - 1]) return dates[k];
  }
  return null;
}

function bestSharpe(closes: number[]): number {
  return Math.max(...GRID.map(({ short, long }) => periodSharpe(strategyReturns(closes, crossoverPositions(closes, short, long), COST).slice(START))));
}

export function summarizeSignals(coinId: string, prices: StoredPrice[]): SignalSummary | null {
  if (prices.length < MIN_PRICES) return null;

  const closes = prices.map(p => p.price);
  const dates = prices.map(p => p.date);
  const annual = Math.sqrt(periodsPerYear(prices.map(p => p.timestamp)));

  const positions = GRID.map(({ short, long }) => crossoverPositions(closes, short, long));
  const evaluated = positions.map(p => strategyReturns(closes, p, COST).slice(START));
  const sharpes = evaluated.map(periodSharpe);
  const bestIndex = sharpes.indexOf(Math.max(...sharpes));
  // A crossover that never traded has no correlation with the others, so only the ones that did count
  const traded = evaluated.filter(r => r.some(x => x !== r[0]));
  const implied = traded.length > 1 ? impliedTrials(traded) : 1;

  const variants = GRID.map(({ short, long }, i): CrossoverVariant => {
    const held = positions[i].slice(START, -1);
    return {
      short,
      long,
      position: positions[i][positions[i].length - 1],
      since: since(positions[i], long, dates),
      sharpe: sharpes[i] * annual,
      totalReturn: compound(evaluated[i]),
      trades: roundTrips(held, evaluated[i]).length,
      timeInMarket: held.reduce((s, x) => s + x, 0) / held.length,
    };
  });

  const evaluatedDates = dates.slice(START);
  const holdingNet = strategyReturns(closes, closes.map(() => 1), COST).slice(START);

  const wf = walkForward(closes, positions, { start: START, train: TRAIN, test: TEST, cost: COST });
  const first = START + TRAIN;
  const testDates = dates.slice(first);
  const wfHolding = strategyReturns(closes.slice(first), closes.slice(first).map(() => 1), COST);
  const trips = roundTrips(wf.positions, wf.returns);
  const closed = trips.filter(t => !t.open);
  const open = trips.find(t => t.open);
  const strategyCurve = equityCurve(wf.returns);
  const holdingCurve = equityCurve(wfHolding);

  const random = new Random(SEED);
  const actual = sharpes[bestIndex];
  let asGood = 0;
  for (let k = 0; k < SHUFFLES; k++) {
    if (bestSharpe(shuffledPrices(closes, random)) >= actual) asGood++;
  }

  return {
    coinId,
    asOf: dates[dates.length - 1],
    cost: COST,
    evaluatedFrom: dates[START],
    observations: evaluated[0].length,
    variants,
    impliedTrials: implied,
    best: {
      ...GRID[bestIndex],
      sharpe: actual * annual,
      probabilisticSharpe: probabilisticSharpe(evaluated[bestIndex], 0),
      deflatedSharpe: deflatedSharpe(evaluated[bestIndex], sharpes, implied),
    },
    holding: performanceLine(holdingNet, annual, evaluatedDates),
    walkForward: {
      from: dates[first],
      days: wf.returns.length,
      strategy: performanceLine(wf.returns, annual, testDates),
      holding: performanceLine(wfHolding, annual, testDates),
      timeInMarket: wf.positions.reduce((s, x) => s + x, 0) / wf.positions.length,
      trades: trips.length,
      closedTrades: closed.length,
      winRate: closed.length ? closed.filter(t => t.return > 0).length / closed.length : null,
      openTrade: open ? { since: testDates[open.start], return: open.return } : null,
      folds: wf.chosen.map((variant, k) => ({ from: dates[first + k * TEST], ...GRID[variant] })),
      equity: strategyCurve.map((strategy, i) => ({ date: testDates[i], strategy, holding: holdingCurve[i] })),
    },
    timingPValue: (1 + asGood) / (1 + SHUFFLES),
    shuffles: SHUFFLES,
  };
}

export async function computeSignals(coinId: string, now = Date.now()): Promise<SignalSummary | null> {
  const start = new Date(now - HISTORY_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  return summarizeSignals(coinId, await getDailyPrices(coinId, start));
}

const cache = new NodeCache({ stdTTL: 3600 });

// The timing test reruns the whole search on 200 shuffles, too slow for a request, so only the nightly
// compute-metrics job computes signals. Null for a coin it hasn't covered yet; the Signals tab then says so.
export async function getSignals(coinId: string): Promise<SignalSummary | null> {
  if (!COIN_ID_PATTERN.test(coinId)) {
    throw new Error('Invalid coin id');
  }

  const cached = cache.get<SignalSummary>(coinId);
  if (cached) return cached;

  const stored = await getLatestSignals(coinId);
  const summary = stored?.version === SIGNALS_VERSION ? stored.signals : null;
  if (summary) cache.set(coinId, summary);
  return summary;
}
