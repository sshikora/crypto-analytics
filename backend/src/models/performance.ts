import { leastSquares } from './linearRegression';
import { mean } from './returns';

// Return, drawdown and beta metrics on daily closes, matching validation/cql_validation/performance.py.
// Returns are simple returns and the risk-free rate is taken as 0.

export interface DatedPrice {
  date: string;
  price: number;
}

export interface Drawdowns {
  maxDrawdown: number;
  peakDate: string;
  troughDate: string;
  recoveryDate: string | null;
  currentDrawdown: number;
  longestDrawdownDays: number;
}

// Geometric: (last / first) ^ (periods per year / returns) - 1
export function annualizedReturn(prices: number[], periodsPerYear: number): number {
  return (prices[prices.length - 1] / prices[0]) ** (periodsPerYear / (prices.length - 1)) - 1;
}

export function sharpeRatio(returns: number[], periodsPerYear: number): number {
  const mu = mean(returns);
  const sd = Math.sqrt(returns.reduce((s, r) => s + (r - mu) ** 2, 0) / (returns.length - 1));
  return (mu / sd) * Math.sqrt(periodsPerYear);
}

// Downside deviation is sqrt(mean(min(r, 0)^2)) over every return, with a target of 0
export function sortinoRatio(returns: number[], periodsPerYear: number): number {
  const downside = Math.sqrt(mean(returns.map(r => Math.min(r, 0) ** 2)));
  return (mean(returns) / downside) * Math.sqrt(periodsPerYear);
}

// Drawdown is price / running peak - 1. The longest drawdown is the most consecutive days the price spent below
// a previous high.
export function drawdowns(series: DatedPrice[]): Drawdowns {
  let peak = series[0].price;
  let trough = 0;
  let maxDrawdown = 0;
  let longest = 0;
  let streak = 0;
  for (let i = 1; i < series.length; i++) {
    peak = Math.max(peak, series[i].price);
    const drawdown = series[i].price / peak - 1;
    streak = drawdown < 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      trough = i;
    }
  }

  let peakIndex = 0;
  for (let i = 1; i <= trough; i++) if (series[i].price > series[peakIndex].price) peakIndex = i;
  const recovery = series.findIndex((p, i) => i > trough && p.price >= series[peakIndex].price);

  return {
    maxDrawdown,
    peakDate: series[peakIndex].date,
    troughDate: series[trough].date,
    recoveryDate: recovery === -1 ? null : series[recovery].date,
    currentDrawdown: series[series.length - 1].price / peak - 1,
    longestDrawdownDays: longest,
  };
}

// OLS slope of the coin's returns on Bitcoin's, with their correlation
export function betaTo(coin: number[], benchmark: number[]): { beta: number; correlation: number } {
  const { coefficients, rSquared } = leastSquares(benchmark.map(x => [1, x]), coin);
  const slope = coefficients[1];
  return { beta: slope, correlation: Math.sign(slope) * Math.sqrt(rSquared) };
}

// Each return is dated by the close it ends on
export function worstDays(series: DatedPrice[], count: number): { date: string; return: number }[] {
  return series
    .slice(1)
    .map((p, i) => ({ date: p.date, return: p.price / series[i].price - 1 }))
    .sort((a, b) => a.return - b.return)
    .slice(0, count);
}

export function worstWeek(series: DatedPrice[]): { startDate: string; endDate: string; return: number } {
  let worst = { startDate: series[0].date, endDate: series[7].date, return: series[7].price / series[0].price - 1 };
  for (let i = 1; i + 7 < series.length; i++) {
    const weekly = series[i + 7].price / series[i].price - 1;
    if (weekly < worst.return) worst = { startDate: series[i].date, endDate: series[i + 7].date, return: weekly };
  }
  return worst;
}
