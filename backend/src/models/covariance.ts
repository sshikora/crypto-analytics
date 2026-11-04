// Covariance estimates from daily returns, one row per day and one column per asset. validation/cql_validation/
// portfolio.py uses the same conventions.

export interface ShrunkCovariance {
  covariance: number[][];
  // Weight on the target, between 0 and 1
  shrinkage: number;
}

function demeaned(returns: number[][]): number[][] {
  const n = returns.length;
  const p = returns[0].length;
  const means = Array.from({ length: p }, (_, j) => returns.reduce((s, row) => s + row[j], 0) / n);
  return returns.map(row => row.map((x, j) => x - means[j]));
}

function crossProduct(x: number[][], divisor: number): number[][] {
  const p = x[0].length;
  const out = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (const row of x) {
    for (let i = 0; i < p; i++) {
      for (let j = i; j < p; j++) out[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      out[i][j] /= divisor;
      out[j][i] = out[i][j];
    }
  }
  return out;
}

export function sampleCovariance(returns: number[][]): number[][] {
  return crossProduct(demeaned(returns), returns.length - 1);
}

// Ledoit and Wolf (2004): the maximum-likelihood covariance S, shrunk towards mu I with mu the average variance.
// The intensity b2 / d2 estimates the one that minimizes expected squared error, where d2 is S's squared distance from
// the target and b2 how much of that distance is sampling noise. This is scikit-learn's LedoitWolf.
export function ledoitWolf(returns: number[][]): ShrunkCovariance {
  const x = demeaned(returns);
  const n = x.length;
  const p = x[0].length;
  const s = crossProduct(x, n);
  const mu = s.reduce((sum, row, i) => sum + row[i], 0) / p;

  let d2 = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) d2 += (s[i][j] - (i === j ? mu : 0)) ** 2;
  }
  d2 /= p;

  let b2Bar = 0;
  for (const row of x) {
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) b2Bar += (row[i] * row[j] - s[i][j]) ** 2;
    }
  }
  b2Bar /= p * n * n;

  const shrinkage = d2 > 0 ? Math.min(b2Bar, d2) / d2 : 0;
  const covariance = s.map((row, i) => row.map((v, j) => (1 - shrinkage) * v + (i === j ? shrinkage * mu : 0)));
  return { covariance, shrinkage };
}

// Ledoit and Wolf, "Honey, I shrunk the sample covariance matrix" (2004): S shrunk towards the matrix that keeps each
// variance and sets every correlation to the average. Crypto coins move together, so this target keeps the common
// correlation that a multiple of the identity would remove. The intensity is (pi - rho) / gamma / n, clamped to
// [0, 1]: pi sums the sampling variances of S's entries, rho the part of that the target shares, and gamma is S's
// squared distance from the target. S divides by n, as in the authors' code.
export function constantCorrelationShrinkage(returns: number[][]): ShrunkCovariance {
  const x = demeaned(returns);
  const n = x.length;
  const p = x[0].length;
  const s = crossProduct(x, n);
  const sd = s.map((row, i) => Math.sqrt(row[i]));

  let correlationSum = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) if (i !== j) correlationSum += s[i][j] / (sd[i] * sd[j]);
  }
  const averageCorrelation = correlationSum / (p * (p - 1));
  const target = s.map((row, i) => row.map((v, j) => (i === j ? v : averageCorrelation * sd[i] * sd[j])));

  // pi[i][j] = E[(x_i x_j - s_ij)^2]; theta[i][j] = E[(x_i^2 - s_ii)(x_i x_j - s_ij)]
  let piSum = 0;
  let piDiagonal = 0;
  let thetaTerm = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let pi = 0;
      let theta = 0;
      for (const row of x) {
        const cross = row[i] * row[j] - s[i][j];
        pi += cross * cross;
        theta += (row[i] * row[i] - s[i][i]) * cross;
      }
      piSum += pi / n;
      if (i === j) piDiagonal += pi / n;
      else thetaTerm += ((sd[j] / sd[i]) * theta) / n;
    }
  }
  const rho = piDiagonal + averageCorrelation * thetaTerm;

  let gamma = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) gamma += (target[i][j] - s[i][j]) ** 2;
  }

  const shrinkage = gamma > 0 ? Math.max(0, Math.min(1, (piSum - rho) / gamma / n)) : 0;
  const covariance = s.map((row, i) => row.map((v, j) => shrinkage * target[i][j] + (1 - shrinkage) * v));
  return { covariance, shrinkage };
}
