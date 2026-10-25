import { describe, expect, it } from 'vitest';
import { leastSquares, LinearDependenceError } from './linearRegression';

describe('leastSquares', () => {
  it('recovers an exact linear relationship', () => {
    const X = [1, 2, 3, 4, 5].map(x => [1, x, x * x]);
    const y = X.map(([, x, x2]) => 2 - 3 * x + 0.5 * x2);

    const fit = leastSquares(X, y);

    fit.coefficients.forEach((c, i) => expect(c).toBeCloseTo([2, -3, 0.5][i], 10));
    expect(fit.rSquared).toBeCloseTo(1, 12);
  });

  it('matches the textbook fit and R squared for noisy data', () => {
    // y on x for (1,1), (2,3), (3,2), (4,5): slope 1.1, intercept 0, residuals -0.1, 0.8, -1.3, 0.6
    const fit = leastSquares([[1, 1], [1, 2], [1, 3], [1, 4]], [1, 3, 2, 5]);

    expect(fit.coefficients[0]).toBeCloseTo(0, 12);
    expect(fit.coefficients[1]).toBeCloseTo(1.1, 12);
    expect(fit.rSquared).toBeCloseTo(1 - 2.7 / 8.75, 12);
  });

  it('rejects regressors that are multiples of each other', () => {
    expect(() => leastSquares([[1, 2], [1, 2], [1, 2]], [1, 2, 3])).toThrow(LinearDependenceError);
  });
});
