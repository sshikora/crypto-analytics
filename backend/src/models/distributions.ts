// Probability functions for the risk models, checked against scipy in distributions.test.ts.

const EPSILON = 1e-16;
const TINY = 1e-300;
const MAX_ITERATIONS = 10_000;
const SQRT_2PI = Math.sqrt(2 * Math.PI);

// Lanczos approximation, g = 7, n = 9
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

// Series for P(a, x), which converges quickly when x < a + 1
function gammaSeries(a: number, x: number): number {
  let term = 1 / a;
  let sum = term;
  for (let n = 1; n < MAX_ITERATIONS; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

// Continued fraction for Q(a, x) by the modified Lentz method, used when x >= a + 1
function gammaContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

// Regularized lower incomplete gamma P(a, x)
export function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

// Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x), computed directly so small tails keep their precision
export function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

// Continued fraction for the incomplete beta function by the modified Lentz method
function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < MAX_ITERATIONS; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a, b)
export function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  // The continued fraction converges fastest on this side of the mean; use symmetry on the other
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

// Phi(x) = erfc(-x / sqrt 2) / 2, with erfc(z) = Q(1/2, z^2) for z >= 0
export function normalCdf(x: number): number {
  const half = 0.5 * x * x;
  return x < 0 ? 0.5 * regularizedGammaQ(0.5, half) : 0.5 * (1 + regularizedGammaP(0.5, half));
}

// Acklam's rational approximation, refined with one Halley step against normalCdf
const ACKLAM_A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const ACKLAM_B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const ACKLAM_C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const ACKLAM_D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p > 0.5) return -normalQuantile(1 - p);

  let x: number;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((ACKLAM_C[0] * q + ACKLAM_C[1]) * q + ACKLAM_C[2]) * q + ACKLAM_C[3]) * q + ACKLAM_C[4]) * q + ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * q + ACKLAM_D[1]) * q + ACKLAM_D[2]) * q + ACKLAM_D[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((ACKLAM_A[0] * r + ACKLAM_A[1]) * r + ACKLAM_A[2]) * r + ACKLAM_A[3]) * r + ACKLAM_A[4]) * r + ACKLAM_A[5]) * q) /
      (((((ACKLAM_B[0] * r + ACKLAM_B[1]) * r + ACKLAM_B[2]) * r + ACKLAM_B[3]) * r + ACKLAM_B[4]) * r + 1);
  }

  const e = normalCdf(x) - p;
  const u = e * SQRT_2PI * Math.exp(0.5 * x * x);
  return x - u / (1 + 0.5 * x * u);
}

export function studentTPdf(x: number, dof: number): number {
  return Math.exp(
    logGamma((dof + 1) / 2) - logGamma(dof / 2) - 0.5 * Math.log(dof * Math.PI) - ((dof + 1) / 2) * Math.log1p((x * x) / dof)
  );
}

export function studentTCdf(x: number, dof: number): number {
  const tail = 0.5 * regularizedIncompleteBeta(dof / 2, 0.5, dof / (dof + x * x));
  return x < 0 ? tail : 1 - tail;
}

// Newton's method on the CDF, falling back to bisection whenever a step would leave the bracket
export function studentTQuantile(p: number, dof: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (p > 0.5) return -studentTQuantile(1 - p, dof);

  let hi = Math.min(normalQuantile(p), -1e-3);
  let lo = 2 * hi;
  while (studentTCdf(lo, dof) > p) {
    hi = lo;
    lo *= 2;
  }

  let x = 0.5 * (lo + hi);
  for (let i = 0; i < 200; i++) {
    const f = studentTCdf(x, dof) - p;
    if (f > 0) hi = x;
    else lo = x;

    let next = x - f / studentTPdf(x, dof);
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    if (Math.abs(next - x) <= 4 * Number.EPSILON * Math.abs(next)) return next;
    x = next;
  }
  return x;
}

export function chiSquareSurvival(x: number, dof: number): number {
  return regularizedGammaQ(dof / 2, x / 2);
}
