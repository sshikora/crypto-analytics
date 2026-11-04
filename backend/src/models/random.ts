// numpy's SFC64 bit generator, with normal and gamma draws built on it. JavaScript has no 64-bit integers, so each
// word is held as two unsigned 32-bit halves. validation/cql_validation/monte_carlo.py uses the same conventions,
// so a seed gives the same draws in both.

const TWO_32 = 2 ** 32;
const TWO_21 = 2 ** 21;
const TWO_MINUS_53 = 2 ** -53;
const DISCARDED_OUTPUTS = 12;

export class Random {
  private aHi = 0;
  private aLo: number;
  private bHi = 0;
  private bLo: number;
  private cHi = 0;
  private cLo: number;
  private counterHi = 0;
  private counterLo = 1;
  private outHi = 0;
  private outLo = 0;
  private spare: number | null = null;

  // The seed is an integer in [0, 2^32). As the generator's author seeds it: a = b = c = seed, counter = 1, and the
  // first 12 outputs are discarded.
  constructor(seed: number) {
    this.aLo = this.bLo = this.cLo = seed >>> 0;
    for (let i = 0; i < DISCARDED_OUTPUTS; i++) this.step();
  }

  // out = a + b + counter; a = b ^ (b >> 11); b = c + (c << 3); c = rotl(c, 24) + out; counter += 1
  private step(): void {
    let lo = this.aLo + this.bLo + this.counterLo;
    const outLo = lo >>> 0;
    const outHi = (this.aHi + this.bHi + this.counterHi + Math.floor(lo / TWO_32)) >>> 0;

    const counterLo = (this.counterLo + 1) >>> 0;
    if (counterLo === 0) this.counterHi = (this.counterHi + 1) >>> 0;
    this.counterLo = counterLo;

    this.aLo = (this.bLo ^ ((this.bLo >>> 11) | (this.bHi << 21))) >>> 0;
    this.aHi = (this.bHi ^ (this.bHi >>> 11)) >>> 0;

    const { cHi, cLo } = this;
    lo = cLo + ((cLo << 3) >>> 0);
    this.bLo = lo >>> 0;
    this.bHi = (cHi + (((cHi << 3) | (cLo >>> 29)) >>> 0) + Math.floor(lo / TWO_32)) >>> 0;

    const rotatedHi = ((cHi << 24) | (cLo >>> 8)) >>> 0;
    const rotatedLo = ((cLo << 24) | (cHi >>> 8)) >>> 0;
    lo = rotatedLo + outLo;
    this.cLo = lo >>> 0;
    this.cHi = (rotatedHi + outHi + Math.floor(lo / TWO_32)) >>> 0;

    this.outHi = outHi;
    this.outLo = outLo;
  }

  nextUint64(): bigint {
    this.step();
    return (BigInt(this.outHi) << 32n) | BigInt(this.outLo);
  }

  // (x >> 11) * 2^-53 in [0, 1), numpy's Generator.random()
  uniform(): number {
    this.step();
    return (this.outHi * TWO_21 + (this.outLo >>> 11)) * TWO_MINUS_53;
  }

  // Box-Muller; each pair of uniforms gives two normals, and the second is returned by the next call
  normal(): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return z;
    }
    const radius = Math.sqrt(-2 * Math.log(1 - this.uniform()));
    const angle = 2 * Math.PI * this.uniform();
    this.spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  }

  // Marsaglia and Tsang (2000) for shape >= 1, with their squeeze
  gamma(shape: number): number {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = this.normal();
      let v = 1 + c * x;
      while (v <= 0) {
        x = this.normal();
        v = 1 + c * x;
      }
      v = v * v * v;
      const u = 1 - this.uniform();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
}
