import NodeCache from 'node-cache';
import { getLatestScenario } from '../repositories/coinMetricsRepository';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import {
  garchBootstrapModel,
  gbmModel,
  PathModel,
  simulate,
  Simulation,
  SimulationSummary,
  studentTModel,
  summarize,
  truncate,
} from '../models/monteCarlo';
import { logReturns, periodsPerYear } from '../models/returns';
import { historicalTailRisk } from '../models/valueAtRisk';

// Bump whenever the stored scenario's fields or definitions change, so the API stops serving rows in the old shape
export const SCENARIO_VERSION = 1;

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 365;
// The window the out-of-sample 10-day VaR test in validation/notebooks/monte_carlo.ipynb used
const FIT_WINDOW = 180;
const MIN_RETURNS = 120;
const PATHS = 10_000;
const SEED = 20_261_105;
const HORIZONS = [7, 30, 90];
const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];
// Tail probabilities for VaR and ES at 95% and 99% confidence
const TAILS = [0.05, 0.01];
const DRAWDOWN_THRESHOLDS = [0.1, 0.2, 0.3, 0.5];
const DISTRIBUTION_BINS = 40;
// The distribution spans these quantiles of the simulated returns; the outer bins also count the paths beyond them
const DISTRIBUTION_RANGE = [0.005, 0.995];
const COIN_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

export type ScenarioModelName = 'garchBootstrap' | 'studentT' | 'normal';

export interface ScenarioHorizon {
  days: number;
  // Simple return over the horizon, as fractions
  mean: number;
  standardError: number;
  tailRisk: { confidence: number; valueAtRisk: number; expectedShortfall: number }[];
  drawdownProbabilities: { threshold: number; probability: number }[];
  distribution: { lower: number; upper: number; probability: number }[];
}

export interface ScenarioModel {
  model: ScenarioModelName;
  // Annualized volatility of the first simulated day, as a fraction; null when the Student-t fit has no variance
  startingVolatility: number | null;
  // Price relative to today's at the 5th, 25th, 50th, 75th and 95th percentiles, for days 1 to 90
  fan: { day: number; quantiles: number[] }[];
  horizons: ScenarioHorizon[];
}

export interface Scenario {
  coinId: string;
  asOf: string;
  startPrice: number;
  observations: number;
  paths: number;
  quantiles: number[];
  models: ScenarioModel[];
}

function terminalReturns(simulation: Simulation): number[] {
  const { paths, days, cumulative } = simulation;
  return Array.from({ length: paths }, (_, p) => Math.exp(cumulative[p * days + days - 1]) - 1);
}

function sortedQuantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (position - below) * (sorted[above] - sorted[below]);
}

function distribution(returns: number[]): ScenarioHorizon['distribution'] {
  const sorted = returns.slice().sort((a, b) => a - b);
  const low = sortedQuantile(sorted, DISTRIBUTION_RANGE[0]);
  const high = sortedQuantile(sorted, DISTRIBUTION_RANGE[1]);
  const width = (high - low) / DISTRIBUTION_BINS;
  const counts = new Array<number>(DISTRIBUTION_BINS).fill(0);
  for (const r of returns) {
    counts[Math.min(DISTRIBUTION_BINS - 1, Math.max(0, Math.floor((r - low) / width)))]++;
  }
  return counts.map((count, i) => ({ lower: low + i * width, upper: low + (i + 1) * width, probability: count / returns.length }));
}

function horizonSummary(simulation: Simulation, summary: SimulationSummary): ScenarioHorizon {
  const terminal = terminalReturns(simulation);
  return {
    days: simulation.days,
    mean: summary.mean,
    standardError: summary.standardError,
    tailRisk: TAILS.map(alpha => ({ confidence: 1 - alpha, ...historicalTailRisk(terminal, alpha) })),
    drawdownProbabilities: DRAWDOWN_THRESHOLDS.map((threshold, i) => ({
      threshold,
      probability: summary.drawdownProbabilities[i],
    })),
    distribution: distribution(terminal),
  };
}

// Paths have no drift: a past window's average return says little about the next one, and setting it to zero
// changed the out-of-sample VaR exception rates by under a percentage point
function zeroDrift(model: PathModel): PathModel {
  return model.kind === 'studentT' ? { ...model, location: 0 } : { ...model, mu: 0 };
}

function startingVariance(model: PathModel): number | null {
  if (model.kind === 'gbm') return model.sigma ** 2;
  if (model.kind === 'garchBootstrap') return model.nextVariance;
  return model.dof > 2 ? (model.scale ** 2 * model.dof) / (model.dof - 2) : null;
}

export function summarizeScenario(coinId: string, prices: StoredPrice[]): Scenario | null {
  const window = prices.slice(-(FIT_WINDOW + 1));
  const returns = logReturns(window.map(p => p.price));
  if (returns.length < MIN_RETURNS) return null;

  const annual = periodsPerYear(window.map(p => p.timestamp));
  const fitted: [ScenarioModelName, PathModel][] = [
    ['garchBootstrap', garchBootstrapModel(returns)],
    ['studentT', studentTModel(returns)],
    ['normal', gbmModel(returns)],
  ];
  const days = Math.max(...HORIZONS);

  const models = fitted.map(([model, fit]): ScenarioModel => {
    const simulation = simulate(zeroDrift(fit), { paths: PATHS, days, seed: SEED, antithetic: false });
    const horizons = HORIZONS.map(h => {
      const short = h === days ? simulation : truncate(simulation, h);
      return { short, summary: summarize(short, QUANTILES, TAILS[0], DRAWDOWN_THRESHOLDS) };
    });
    // The longest horizon is the whole simulation, so its fan covers every day
    const { fan } = horizons[horizons.length - 1].summary;
    const variance = startingVariance(fit);
    return {
      model,
      startingVolatility: variance === null ? null : Math.sqrt(variance * annual),
      fan: fan.map((quantiles, i) => ({ day: i + 1, quantiles })),
      horizons: horizons.map(({ short, summary }) => horizonSummary(short, summary)),
    };
  });

  const last = window[window.length - 1];
  return {
    coinId,
    asOf: last.date,
    startPrice: last.price,
    observations: returns.length,
    paths: PATHS,
    quantiles: QUANTILES,
    models,
  };
}

export async function computeScenario(coinId: string, now = Date.now()): Promise<Scenario | null> {
  const start = new Date(now - HISTORY_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  return summarizeScenario(coinId, await getDailyPrices(coinId, start));
}

const cache = new NodeCache({ stdTTL: 3600 });

// Simulating takes about a second per coin, too long to run on a request, so only the nightly compute-metrics job
// computes scenarios. Null for a coin it hasn't covered yet; the Scenario tab then says so.
export async function getScenario(coinId: string): Promise<Scenario | null> {
  if (!COIN_ID_PATTERN.test(coinId)) {
    throw new Error('Invalid coin id');
  }

  const cached = cache.get<Scenario>(coinId);
  if (cached) return cached;

  const stored = await getLatestScenario(coinId);
  const scenario = stored?.version === SCENARIO_VERSION ? stored.scenario : null;
  if (scenario) cache.set(coinId, scenario);
  return scenario;
}
