// Nelder-Mead simplex optimizer for unconstrained minimization
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  maxIter = 600,
  tol = 1e-8
): number[] {
  const n = x0.length;
  const simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const v = x0.slice();
    v[i] += v[i] !== 0 ? Math.abs(v[i]) * 0.1 : 0.1;
    simplex.push(v);
  }

  let fvals = simplex.map(f);

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort vertices by function value
    const order = fvals.map((v, i) => i).sort((a, b) => fvals[a] - fvals[b]);
    const s = order.map(i => simplex[i].slice());
    const fv = order.map(i => fvals[i]);
    for (let i = 0; i <= n; i++) {
      simplex[i] = s[i];
      fvals[i] = fv[i];
    }

    if (fvals[n] - fvals[0] < tol) break;

    // Centroid of all but worst
    const centroid = new Array(n).fill(0) as number[];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    }

    // Reflect
    const xr = centroid.map((c, j) => c + (c - simplex[n][j]));
    const fr = f(xr);

    if (fr < fvals[0]) {
      // Expand
      const xe = centroid.map((c, j) => c + 2 * (xr[j] - c));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; fvals[n] = fe; }
      else { simplex[n] = xr; fvals[n] = fr; }
    } else if (fr < fvals[n - 1]) {
      simplex[n] = xr; fvals[n] = fr;
    } else {
      // Contract
      const xc = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c));
      const fc = f(xc);
      if (fc < fvals[n]) {
        simplex[n] = xc; fvals[n] = fc;
      } else {
        // Shrink
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[0].map((b, j) => b + 0.5 * (simplex[i][j] - b));
          fvals[i] = f(simplex[i]);
        }
      }
    }
  }

  return simplex[0];
}
