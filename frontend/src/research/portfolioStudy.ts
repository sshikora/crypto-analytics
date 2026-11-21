// Averages over the six rebalancing schedules from validation/data/portfolio_backtest_summary.csv and _periods.csv;
// the test checks they match
export interface PortfolioResult {
  universe: 'top20' | 'top20WithoutTron';
  strategy: string;
  annualizedVolatility: number;
  maxDrawdown: number;
  effectiveHoldings: number;
  turnover: number;
  // Realized over forecast daily volatility per rebalance: the mean and the worst
  meanRatio: number;
  worstRatio: number;
}

export const PORTFOLIO_RESULTS: PortfolioResult[] = [
  { universe: 'top20', strategy: 'minVarianceSample', annualizedVolatility: 0.212157, maxDrawdown: 0.199624, effectiveHoldings: 2.12741, turnover: 0.166972, meanRatio: 1.14347, worstRatio: 3.11627 },
  { universe: 'top20', strategy: 'minVarianceConstantCorrelation', annualizedVolatility: 0.21333, maxDrawdown: 0.184544, effectiveHoldings: 1.96726, turnover: 0.174874, meanRatio: 1.08615, worstRatio: 3.11407 },
  { universe: 'top20', strategy: 'minVarianceIdentity', annualizedVolatility: 0.21451, maxDrawdown: 0.184168, effectiveHoldings: 3.57099, turnover: 0.161308, meanRatio: 0.923332, worstRatio: 1.48227 },
  { universe: 'top20', strategy: 'minVarianceCap20', annualizedVolatility: 0.275063, maxDrawdown: 0.200832, effectiveHoldings: 6.09807, turnover: 0.173827, meanRatio: 1.01393, worstRatio: 1.68132 },
  { universe: 'top20', strategy: 'minVarianceCap10', annualizedVolatility: 0.355095, maxDrawdown: 0.289261, effectiveHoldings: 10.8698, turnover: 0.175034, meanRatio: 1.04412, worstRatio: 1.90265 },
  { universe: 'top20', strategy: 'riskParity', annualizedVolatility: 0.351965, maxDrawdown: 0.265297, effectiveHoldings: 13.2211, turnover: 0.109676, meanRatio: 0.996299, worstRatio: 1.723 },
  { universe: 'top20', strategy: 'inverseVolatility', annualizedVolatility: 0.386337, maxDrawdown: 0.290448, effectiveHoldings: 16.0963, turnover: 0.108441, meanRatio: 1.00803, worstRatio: 1.74521 },
  { universe: 'top20', strategy: 'capWeight', annualizedVolatility: 0.400575, maxDrawdown: 0.30257, effectiveHoldings: 1.95627, turnover: 0.00328816, meanRatio: 0.941866, worstRatio: 1.59603 },
  { universe: 'top20', strategy: 'equalWeight', annualizedVolatility: 0.461622, maxDrawdown: 0.356601, effectiveHoldings: 20, turnover: 0.100674, meanRatio: 1.00632, worstRatio: 1.70283 },
  { universe: 'top20', strategy: 'maxSharpe', annualizedVolatility: 0.540826, maxDrawdown: 0.414562, effectiveHoldings: 3.13028, turnover: 0.488859, meanRatio: 0.984018, worstRatio: 1.44429 },
  { universe: 'top20WithoutTron', strategy: 'minVarianceSample', annualizedVolatility: 0.26125, maxDrawdown: 0.20689, effectiveHoldings: 3.08837, turnover: 0.230868, meanRatio: 0.983073, worstRatio: 1.85458 },
  { universe: 'top20WithoutTron', strategy: 'minVarianceConstantCorrelation', annualizedVolatility: 0.25631, maxDrawdown: 0.203173, effectiveHoldings: 2.93693, turnover: 0.225789, meanRatio: 0.918042, worstRatio: 1.78732 },
  { universe: 'top20WithoutTron', strategy: 'minVarianceIdentity', annualizedVolatility: 0.280796, maxDrawdown: 0.219575, effectiveHoldings: 4.54049, turnover: 0.218282, meanRatio: 0.959227, worstRatio: 1.65468 },
  { universe: 'top20WithoutTron', strategy: 'minVarianceCap20', annualizedVolatility: 0.33745, maxDrawdown: 0.250592, effectiveHoldings: 6.12401, turnover: 0.217037, meanRatio: 1.04609, worstRatio: 1.75331 },
  { universe: 'top20WithoutTron', strategy: 'minVarianceCap10', annualizedVolatility: 0.39341, maxDrawdown: 0.323801, effectiveHoldings: 10.8326, turnover: 0.205118, meanRatio: 1.05648, worstRatio: 1.91521 },
  { universe: 'top20WithoutTron', strategy: 'riskParity', annualizedVolatility: 0.407968, maxDrawdown: 0.304949, effectiveHoldings: 15.3994, turnover: 0.126311, meanRatio: 1.01043, worstRatio: 1.7278 },
  { universe: 'top20WithoutTron', strategy: 'inverseVolatility', annualizedVolatility: 0.434643, maxDrawdown: 0.325693, effectiveHoldings: 17.4855, turnover: 0.120175, meanRatio: 1.01985, worstRatio: 1.76315 },
  { universe: 'top20WithoutTron', strategy: 'capWeight', annualizedVolatility: 0.405848, maxDrawdown: 0.305395, effectiveHoldings: 1.90466, turnover: 0.00386048, meanRatio: 0.940051, worstRatio: 1.59752 },
  { universe: 'top20WithoutTron', strategy: 'equalWeight', annualizedVolatility: 0.482556, maxDrawdown: 0.372592, effectiveHoldings: 20, turnover: 0.114473, meanRatio: 1.00855, worstRatio: 1.68528 },
  { universe: 'top20WithoutTron', strategy: 'maxSharpe', annualizedVolatility: 0.642128, maxDrawdown: 0.416934, effectiveHoldings: 3.2797, turnover: 0.482986, meanRatio: 0.97241, worstRatio: 1.39927 },
];

// Each rebalance of the 90-day window, all three offsets, for the chart
export interface PortfolioPeriod {
  start: string;
  uncapped: number;
  capped: number;
  largestWeight: number;
}

export const PORTFOLIO_PERIODS: PortfolioPeriod[] = [
  { start: '2026-04-22', uncapped: 0.589886, capped: 0.478317, largestWeight: 0.86305 },
  { start: '2026-05-02', uncapped: 0.948296, capped: 0.763182, largestWeight: 0.840298 },
  { start: '2026-05-12', uncapped: 1.32079, capped: 1.41088, largestWeight: 0.56931 },
  { start: '2026-05-22', uncapped: 1.43047, capped: 1.54042, largestWeight: 0.575411 },
  { start: '2026-06-01', uncapped: 1.26322, capped: 1.43701, largestWeight: 0.467781 },
  { start: '2026-06-11', uncapped: 0.790758, capped: 0.781853, largestWeight: 0.477203 },
  { start: '2026-06-21', uncapped: 0.844239, capped: 0.852383, largestWeight: 0.510296 },
  { start: '2026-07-01', uncapped: 0.832595, capped: 0.985378, largestWeight: 0.527824 },
  { start: '2026-07-11', uncapped: 0.61186, capped: 0.928411, largestWeight: 0.520109 },
  { start: '2026-07-21', uncapped: 0.804438, capped: 0.747074, largestWeight: 0.491591 },
  { start: '2026-07-31', uncapped: 1.12401, capped: 1.36463, largestWeight: 0.518686 },
  { start: '2026-08-10', uncapped: 1.47389, capped: 1.51911, largestWeight: 0.548882 },
  { start: '2026-08-20', uncapped: 1.16072, capped: 1.68132, largestWeight: 0.546071 },
  { start: '2026-08-30', uncapped: 0.943325, capped: 1.17009, largestWeight: 0.68478 },
  { start: '2026-09-09', uncapped: 0.708855, capped: 1.03217, largestWeight: 0.730868 },
  { start: '2026-09-19', uncapped: 0.653823, capped: 1.04341, largestWeight: 0.749141 },
  { start: '2026-09-29', uncapped: 0.581304, capped: 0.666538, largestWeight: 0.758735 },
  { start: '2026-10-09', uncapped: 2.49494, capped: 0.934974, largestWeight: 0.769548 },
  { start: '2026-10-19', uncapped: 2.54773, capped: 1.24829, largestWeight: 0.77355 },
  { start: '2026-10-29', uncapped: 3.11407, capped: 1.32407, largestWeight: 0.795884 },
  { start: '2026-11-08', uncapped: 0.876833, capped: 1.31995, largestWeight: 0.480537 },
  { start: '2026-11-18', uncapped: 1.06253, capped: 0.731644, largestWeight: 0.685232 },
];
