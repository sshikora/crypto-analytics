import NodeCache from 'node-cache';
import { getLatestRiskSummary } from '../repositories/coinMetricsRepository';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { fitGarch11, garchForecastVariance } from '../models/garch';
import { informationCriteria, ljungBox, normalQqPoints, standardizedResiduals, TestResult } from '../models/garchDiagnostics';
import { fitHar, harForecastVariance, HarFit } from '../models/har';
import { LinearDependenceError } from '../models/linearRegression';
import { ewmaVariance, rollingVolatility } from '../models/realizedVolatility';
import { logReturns, moments, periodsPerYear, simpleReturns } from '../models/returns';
import {
  filteredHistoricalTailRisk,
  fitFilteredModel,
  fitStudentT,
  historicalTailRisk,
  normalTailRisk,
  studentTTailRisk,
  TailRisk,
  VarMethod,
} from '../models/valueAtRisk';
import { conditionalCoverageTest, christoffersenTest, kupiecTest, varExceptions } from '../models/varBacktest';

const cache = new NodeCache({ stdTTL: 3600 });

// Stored summaries carry the version that computed them. Bump this whenever the summary's fields or definitions
// change, so the API recomputes instead of serving rows in the old shape until the nightly job rewrites them.
export const RISK_SUMMARY_VERSION = 3;

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 365;
const REALIZED_WINDOWS = [7, 30, 90];
const EWMA_DECAY = 0.94;
const FORECAST_HORIZONS = [1, 7, 30];
// The 30-day component uses the first 30 returns, so this leaves 90 observations to estimate 4 coefficients
const MIN_HAR_RETURNS = 120;
const VAR_WINDOW = 180;
const VAR_CONFIDENCE = [0.95, 0.99];
const VAR_METHODS: VarMethod[] = ['historical', 'normal', 'studentT', 'filteredHistorical'];
const MIN_BACKTEST_DAYS = 60;
const BACKTEST_SIGNIFICANCE = 0.05;
const MIN_GARCH_RETURNS = 120;
const LJUNG_BOX_LAGS = 10;
const COIN_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

export interface RealizedVolatility {
  windowDays: number;
  annualizedVolatility: number | null;
}

export interface VolatilityForecast {
  model: string;
  coefficients: Omit<HarFit, 'rSquared' | 'nobs'>;
  rSquared: number;
  observations: number;
  horizons: { days: number; annualizedVolatility: number }[];
}

export interface VarBacktest {
  days: number;
  exceptions: number;
  expectedExceptions: number;
  kupiecPValue: number;
  christoffersenPValue: number;
  conditionalCoveragePValue: number;
  passes: boolean;
}

export interface ValueAtRiskSummary {
  windowDays: number;
  studentTDegreesOfFreedom: number;
  levels: {
    confidence: number;
    methods: { method: VarMethod; valueAtRisk: number; expectedShortfall: number; backtest: VarBacktest }[];
  }[];
}

export interface GarchSummary {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  logLikelihood: number;
  aic: number;
  bic: number;
  observations: number;
  halfLifeDays: number;
  currentVolatility: number;
  longRunVolatility: number;
  conditionalVolatility: { date: string; annualizedVolatility: number }[];
  forecast: { days: number; annualizedVolatility: number }[];
  ljungBoxResiduals: TestResult;
  ljungBoxSquaredResiduals: TestResult;
  standardizedExcessKurtosis: number;
  normalQq: { theoretical: number; sample: number }[];
}

export interface RiskSummary {
  coinId: string;
  asOf: string | null;
  observations: number;
  missingDays: number;
  realizedVolatility: RealizedVolatility[];
  ewmaVolatility: number | null;
  returnDistribution: { skewness: number; excessKurtosis: number } | null;
  volatilityForecast: VolatilityForecast | null;
  valueAtRisk: ValueAtRiskSummary | null;
  garch: GarchSummary | null;
}

// Volatilities are annualized percentages, like the GARCH model's. Windows count stored observations,
// so a gap in the history widens a window in calendar terms; missingDays reports how many days are absent.
// HAR-RV on squared daily returns. Returns null when the model can't be estimated (a price that never moves)
// or when a negative coefficient would push any forecast variance to zero or below.
function forecastVolatility(returns: number[], annualize: (perPeriod: number) => number): VolatilityForecast | null {
  const realizedVariance = returns.map(r => r * r);
  let fit: HarFit;
  try {
    fit = fitHar(realizedVariance);
  } catch (error) {
    if (error instanceof LinearDependenceError) return null;
    throw error;
  }

  const daily = harForecastVariance(fit, realizedVariance, Math.max(...FORECAST_HORIZONS));
  if (daily.some(v => v <= 0)) return null;

  return {
    model: 'HAR-RV',
    coefficients: { intercept: fit.intercept, daily: fit.daily, weekly: fit.weekly, monthly: fit.monthly },
    rSquared: fit.rSquared,
    observations: fit.nobs,
    // Each horizon's volatility comes from the average of its daily variance forecasts
    horizons: FORECAST_HORIZONS.map(days => ({
      days,
      annualizedVolatility: annualize(Math.sqrt(daily.slice(0, days).reduce((sum, v) => sum + v, 0) / days)),
    })),
  };
}

// One-day VaR and expected shortfall on the last 180 simple returns by four methods, each backtested out of sample
// on every earlier-fitted day. Null when there are too few days to backtest or the price was flat for a whole
// window, where every method's VaR is zero and the Student-t likelihood has no maximum.
function valueAtRisk(prices: StoredPrice[]): ValueAtRiskSummary | null {
  const returns = simpleReturns(prices.map(p => p.price));
  if (returns.length < VAR_WINDOW + MIN_BACKTEST_DAYS) return null;
  if (rollingVolatility(returns, VAR_WINDOW).some(v => v === 0)) return null;

  const latest = returns.slice(-VAR_WINDOW);
  const fit = fitStudentT(latest);
  const filtered = fitFilteredModel(latest);
  const tailRisk: Record<VarMethod, (alpha: number) => TailRisk> = {
    historical: alpha => historicalTailRisk(latest, alpha),
    normal: alpha => normalTailRisk(latest, alpha),
    studentT: alpha => studentTTailRisk(fit, alpha),
    filteredHistorical: alpha => filteredHistoricalTailRisk(filtered, alpha),
  };
  const alphas = VAR_CONFIDENCE.map(c => 1 - c);
  const hitsByMethod = Object.fromEntries(
    VAR_METHODS.map(method => [method, varExceptions(returns, alphas, VAR_WINDOW, method)])
  ) as Record<VarMethod, boolean[][]>;

  return {
    windowDays: VAR_WINDOW,
    studentTDegreesOfFreedom: fit.dof,
    levels: VAR_CONFIDENCE.map((confidence, i) => {
      const alpha = alphas[i];
      return {
        confidence,
        methods: VAR_METHODS.map(method => {
          const risk = tailRisk[method](alpha);
          const hits = hitsByMethod[method][i];
          const kupiec = kupiecTest(hits, alpha);
          const conditionalCoverage = conditionalCoverageTest(hits, alpha);
          return {
            method,
            ...risk,
            backtest: {
              days: hits.length,
              exceptions: hits.filter(Boolean).length,
              expectedExceptions: hits.length * alpha,
              kupiecPValue: kupiec.pValue,
              christoffersenPValue: christoffersenTest(hits).pValue,
              conditionalCoveragePValue: conditionalCoverage.pValue,
              passes: kupiec.pValue >= BACKTEST_SIGNIFICANCE && conditionalCoverage.pValue >= BACKTEST_SIGNIFICANCE,
            },
          };
        }),
      };
    }),
  };
}

// GARCH(1,1) on daily log returns with its diagnostics. Null with too little history, or for a price that never
// moved, where the sample variance is zero and the likelihood is undefined.
function garchSummary(prices: StoredPrice[]): GarchSummary | null {
  const returns = logReturns(prices.map(p => p.price));
  if (returns.length < MIN_GARCH_RETURNS || moments(returns).standardDeviation === 0) return null;

  const fit = fitGarch11(returns);
  const ppy = periodsPerYear(prices.map(p => p.timestamp));
  const annualize = (variance: number) => Math.sqrt(variance * ppy) * 100;
  const z = standardizedResiduals(returns, fit);
  const horizon = Math.max(...FORECAST_HORIZONS);
  const daily = Array.from({ length: horizon }, (_, k) => garchForecastVariance(fit, k + 1));

  return {
    omega: fit.omega,
    alpha: fit.alpha,
    beta: fit.beta,
    persistence: fit.persistence,
    logLikelihood: fit.logLikelihood,
    ...informationCriteria(fit.logLikelihood, z.length),
    observations: z.length,
    // ln(0.5) / ln(persistence) is in data intervals; scale to days in case of gaps
    halfLifeDays: (Math.log(0.5) / Math.log(fit.persistence)) * (365.25 / ppy),
    currentVolatility: annualize(fit.variance[fit.variance.length - 1]),
    longRunVolatility: annualize(fit.longRunVariance),
    // fit.variance[i] belongs to returns[i + 1], the change ending at prices[i + 2]
    conditionalVolatility: fit.variance.map((h, i) => ({ date: prices[i + 2].date, annualizedVolatility: annualize(h) })),
    forecast: FORECAST_HORIZONS.map(days => ({
      days,
      annualizedVolatility: annualize(daily.slice(0, days).reduce((sum, v) => sum + v, 0) / days),
    })),
    ljungBoxResiduals: ljungBox(z, LJUNG_BOX_LAGS),
    ljungBoxSquaredResiduals: ljungBox(z.map(v => v * v), LJUNG_BOX_LAGS),
    standardizedExcessKurtosis: moments(z).excessKurtosis,
    normalQq: normalQqPoints(z),
  };
}

export function summarizeRisk(coinId: string, prices: StoredPrice[]): RiskSummary {
  const returns = logReturns(prices.map(p => p.price));
  const annualize = (perPeriod: number) =>
    perPeriod * Math.sqrt(periodsPerYear(prices.map(p => p.timestamp))) * 100;

  const realizedVolatility = REALIZED_WINDOWS.map(windowDays => {
    const latest = returns.length >= windowDays ? rollingVolatility(returns, windowDays)[returns.length - 1] : null;
    return { windowDays, annualizedVolatility: latest === null ? null : annualize(latest) };
  });

  const volatilityForecast = returns.length >= MIN_HAR_RETURNS ? forecastVolatility(returns, annualize) : null;

  const ewma = returns.length > 0 ? ewmaVariance(returns, EWMA_DECAY)[returns.length - 1] : null;
  const m = returns.length >= 4 ? moments(returns) : null;

  const first = prices[0];
  const last = prices[prices.length - 1];
  const expectedDays = last ? Math.round((last.timestamp - first.timestamp) / MS_PER_DAY) + 1 : 0;

  return {
    coinId,
    asOf: last?.date ?? null,
    observations: prices.length,
    missingDays: expectedDays - prices.length,
    realizedVolatility,
    ewmaVolatility: ewma === null ? null : annualize(Math.sqrt(ewma)),
    returnDistribution: m && { skewness: m.skewness, excessKurtosis: m.excessKurtosis },
    volatilityForecast,
    valueAtRisk: valueAtRisk(prices),
    garch: garchSummary(prices),
  };
}

export async function computeRiskSummary(coinId: string, now = Date.now()): Promise<RiskSummary> {
  const fromDate = new Date(now - HISTORY_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  return summarizeRisk(coinId, await getDailyPrices(coinId, fromDate));
}

// The nightly compute-metrics job stores each coin's summary, so a request normally reads one row. It computes on
// request only for a coin the job hasn't covered yet or a row written by an older version.
export async function getRiskSummary(coinId: string, now = Date.now()): Promise<RiskSummary> {
  if (!COIN_ID_PATTERN.test(coinId)) {
    throw new Error('Invalid coin id');
  }

  const cached = cache.get<RiskSummary>(coinId);
  if (cached) return cached;

  const stored = await getLatestRiskSummary(coinId);
  const summary =
    stored?.version === RISK_SUMMARY_VERSION ? stored.riskSummary : await computeRiskSummary(coinId, now);

  cache.set(coinId, summary);
  return summary;
}
