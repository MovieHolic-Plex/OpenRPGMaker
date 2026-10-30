/**
 * Number rules the reports were calibrated with. `roundHalfEven` rounds half-to-even on the exact binary value
 * (0.125 -> 0.12, 2.675 -> 2.67), which `toFixed` gets wrong on exact ties. `formatFloat` prints the shortest
 * round-trip form with a mandatory fraction or exponent (3.0, 1e-05, 1e+16), so text renders stay byte-stable.
 */

function exactRational(x: number): { readonly num: bigint; readonly den: bigint } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const exp = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const sign = bits >> 63n === 1n ? -1n : 1n;
  const mant = exp === 0 ? frac : frac | (1n << 52n);
  const e = (exp === 0 ? 1 : exp) - 1075;
  return e >= 0 ? { num: sign * (mant << BigInt(e)), den: 1n } : { num: sign * mant, den: 1n << BigInt(-e) };
}

export function roundHalfEven(x: number, ndigits = 0): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const { num, den } = exactRational(x);
  const scale = 10n ** BigInt(Math.abs(ndigits));
  const scaledNum = ndigits >= 0 ? num * scale : num;
  const scaledDen = ndigits >= 0 ? den : den * scale;
  const neg = scaledNum < 0n;
  const absNum = neg ? -scaledNum : scaledNum;
  let q = absNum / scaledDen;
  const twiceRem = 2n * (absNum % scaledDen);
  if (twiceRem > scaledDen || (twiceRem === scaledDen && q % 2n === 1n)) q += 1n;
  const signed = neg ? -q : q;
  const out = ndigits >= 0 ? Number(`${signed}e-${ndigits}`) : Number(signed * scale);
  return out === 0 && neg ? -0 : out;
}

export function formatFloat(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Number.POSITIVE_INFINITY) return "inf";
  if (x === Number.NEGATIVE_INFINITY) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa = "", expPart] = x.toExponential().split("e");
  const exp = Number(expPart);
  if (exp < -4 || exp >= 16) {
    const sign = exp < 0 ? "-" : "+";
    return `${mantissa}e${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  const plain = x.toFixed(Math.max(0, mantissa.replace(/^-?\d\.?/, "").length - exp));
  return plain.includes(".") ? plain : `${plain}.0`;
}

/** An integer-kind number prints without a decimal point; a float-kind one prints with `formatFloat`. */
export type NumberKind = "int" | "float";

export function formatNumber(x: number, kind: NumberKind): string {
  return kind === "int" ? String(x) : formatFloat(x);
}

/** Fixed-point and percent formatting from the exact value, half-to-even on ties like `roundHalfEven`. */
export function fixed(x: number, digits: number): string {
  const r = roundHalfEven(x, digits);
  return r.toFixed(digits);
}

export function percent(x: number, digits: number): string {
  return `${fixed(x * 100, digits)}%`;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new RangeError("mean of an empty sequence");
  return fsum(xs) / xs.length;
}

export function pstdev(xs: readonly number[]): number {
  const mu = mean(xs);
  return Math.sqrt(fsum(xs.map((x) => (x - mu) ** 2)) / xs.length);
}

export function stdev(xs: readonly number[]): number {
  if (xs.length < 2) throw new RangeError("stdev needs at least two points");
  const mu = mean(xs);
  return Math.sqrt(fsum(xs.map((x) => (x - mu) ** 2)) / (xs.length - 1));
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) throw new RangeError("median of an empty sequence");
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Exact (Shewchuk) summation: long sums are correctly rounded, so means and deviations are stable to the last bit. */
export function fsum(xs: readonly number[]): number {
  const partials: number[] = [];
  for (const value of xs) {
    let x = value;
    let i = 0;
    for (const p of partials) {
      let y = p;
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y;
      const low = y - (hi - x);
      if (low !== 0) {
        partials[i] = low;
        i += 1;
      }
      x = hi;
    }
    partials.length = i;
    partials.push(x);
  }
  return partials.reduce((a, b) => a + b, 0);
}
