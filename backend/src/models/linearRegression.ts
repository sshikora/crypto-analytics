// Raised when a regressor is a combination of the others, as happens when a price never moves
export class LinearDependenceError extends Error {
  constructor() {
    super('Regressors are linearly dependent');
    this.name = 'LinearDependenceError';
  }
}

export interface LeastSquaresFit {
  coefficients: number[];
  rSquared: number;
}

// Ordinary least squares by Householder QR, which avoids squaring the condition number as the normal equations do.
// X holds one row per observation and should include a column of ones for an intercept.
export function leastSquares(X: number[][], y: number[]): LeastSquaresFit {
  const n = X.length;
  const k = X[0].length;
  const a = X.map(row => row.slice());
  const b = y.slice();

  for (let j = 0; j < k; j++) {
    let norm = 0;
    for (let i = j; i < n; i++) norm += a[i][j] ** 2;
    norm = Math.sqrt(norm);

    // Reflect column j onto -sign(a[j][j]) * norm * e_j, choosing the sign that avoids cancellation
    const alpha = a[j][j] > 0 ? -norm : norm;
    const v = [a[j][j] - alpha];
    for (let i = j + 1; i < n; i++) v.push(a[i][j]);
    const vv = v.reduce((s, x) => s + x * x, 0);
    if (vv === 0) continue;

    for (let c = j; c < k; c++) {
      let dot = 0;
      for (let i = j; i < n; i++) dot += v[i - j] * a[i][c];
      const scale = (2 * dot) / vv;
      for (let i = j; i < n; i++) a[i][c] -= scale * v[i - j];
    }
    let dot = 0;
    for (let i = j; i < n; i++) dot += v[i - j] * b[i];
    const scale = (2 * dot) / vv;
    for (let i = j; i < n; i++) b[i] -= scale * v[i - j];
  }

  const largestPivot = Math.max(...a.slice(0, k).map((row, j) => Math.abs(row[j])));
  const coefficients = new Array<number>(k).fill(0);
  for (let j = k - 1; j >= 0; j--) {
    if (Math.abs(a[j][j]) <= 1e-12 * largestPivot) {
      throw new LinearDependenceError();
    }
    let sum = b[j];
    for (let c = j + 1; c < k; c++) sum -= a[j][c] * coefficients[c];
    coefficients[j] = sum / a[j][j];
  }

  // After the reflections, b[k..n-1] holds the residuals in the rotated basis, so their squares sum to the SSR
  let ssr = 0;
  for (let i = k; i < n; i++) ssr += b[i] ** 2;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - yMean) ** 2, 0);

  return { coefficients, rSquared: 1 - ssr / sst };
}
