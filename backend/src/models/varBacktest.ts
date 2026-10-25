import { chiSquareSurvival } from './distributions';
import {
  filteredHistoricalTailRisk,
  fitFilteredModel,
  fitStudentT,
  historicalTailRisk,
  normalTailRisk,
  StudentTFit,
  studentTTailRisk,
  TailRisk,
  VarMethod,
} from './valueAtRisk';

export interface TestResult {
  statistic: number;
  pValue: number;
}

// 0 * log(0) is taken as 0, as the likelihood ratios require
function xlogy(x: number, y: number): number {
  return x === 0 ? 0 : x * Math.log(y);
}

// Out of sample: each day's VaR uses only the `window` returns before it. Returns one series per alpha, where
// true marks a loss beyond that day's VaR. Each day is fitted once and reused for every alpha.
export function varExceptions(returns: number[], alphas: number[], window: number, method: VarMethod): boolean[][] {
  const hits: boolean[][] = alphas.map(() => []);
  let fit: StudentTFit | undefined;
  for (let t = window; t < returns.length; t++) {
    const sample = returns.slice(t - window, t);
    let tailRisk: (alpha: number) => TailRisk;
    if (method === 'studentT') {
      const dayFit = (fit = fitStudentT(sample, fit));
      tailRisk = alpha => studentTTailRisk(dayFit, alpha);
    } else if (method === 'filteredHistorical') {
      const model = fitFilteredModel(sample);
      tailRisk = alpha => filteredHistoricalTailRisk(model, alpha);
    } else {
      const compute = method === 'historical' ? historicalTailRisk : normalTailRisk;
      tailRisk = alpha => compute(sample, alpha);
    }

    alphas.forEach((alpha, i) => hits[i].push(returns[t] < -tailRisk(alpha).valueAtRisk));
  }
  return hits;
}

// Kupiec (1995) unconditional coverage: is the exception rate consistent with alpha?
export function kupiecTest(hits: boolean[], alpha: number): TestResult {
  const n = hits.length;
  const x = hits.filter(Boolean).length;
  const statistic =
    -2 * (xlogy(n - x, 1 - alpha) + xlogy(x, alpha)) + 2 * (xlogy(n - x, 1 - x / n) + xlogy(x, x / n));
  return { statistic, pValue: chiSquareSurvival(statistic, 1) };
}

// Christoffersen (1998) independence: does an exception make another one tomorrow more likely?
export function christoffersenTest(hits: boolean[]): TestResult {
  let n00 = 0;
  let n01 = 0;
  let n10 = 0;
  let n11 = 0;
  for (let t = 1; t < hits.length; t++) {
    if (hits[t - 1]) {
      if (hits[t]) n11++;
      else n10++;
    } else if (hits[t]) n01++;
    else n00++;
  }

  const pi0 = n00 + n01 > 0 ? n01 / (n00 + n01) : 0;
  const pi1 = n10 + n11 > 0 ? n11 / (n10 + n11) : 0;
  const pi = (n01 + n11) / (n00 + n01 + n10 + n11);
  const restricted = xlogy(n00 + n10, 1 - pi) + xlogy(n01 + n11, pi);
  const unrestricted = xlogy(n00, 1 - pi0) + xlogy(n01, pi0) + xlogy(n10, 1 - pi1) + xlogy(n11, pi1);
  const statistic = 2 * (unrestricted - restricted);
  return { statistic, pValue: chiSquareSurvival(statistic, 1) };
}

// Conditional coverage: the sum of both statistics, chi-square with 2 degrees of freedom
export function conditionalCoverageTest(hits: boolean[], alpha: number): TestResult {
  const statistic = kupiecTest(hits, alpha).statistic + christoffersenTest(hits).statistic;
  return { statistic, pValue: chiSquareSurvival(statistic, 2) };
}
