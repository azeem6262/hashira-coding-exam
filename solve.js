"use strict";


function bigintAbs(a) { return a < 0n ? -a : a; }
function bigintGcd(a, b) {
  a = bigintAbs(a); b = bigintAbs(b);
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}


class Rat {
  constructor(num, den = 1n) {
    if (den === 0n) throw new Error("Zero denominator");
    if (den < 0n) { num = -num; den = -den; }
    if (num === 0n) { this.num = 0n; this.den = 1n; return; }
    const g = bigintGcd(num, den);
    this.num = num / g;
    this.den = den / g;
  }
  static fromBigInt(x) { return new Rat(x, 1n); }
  add(o) { return new Rat(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o) { return new Rat(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(o) { return new Rat(this.num * o.num, this.den * o.den); }
  div(o) { return new Rat(this.num * o.den, this.den * o.num); }
  toString() { return this.den === 1n ? this.num.toString() : `${this.num}/${this.den}`; }
}


function charToDigit(ch) {
  const code = ch.codePointAt(0);
  if (code >= 48 && code <= 57) return BigInt(code - 48);        // 0-9
  if (code >= 65 && code <= 90) return BigInt(code - 55);         // A-Z
  if (code >= 97 && code <= 122) return BigInt(code - 87);        // a-z
  throw new Error(`Invalid digit '${ch}'`);
}
function parseInBase(str, base) {
  const B = BigInt(base);
  let val = 0n;
  for (const ch of str.trim()) {
    const d = charToDigit(ch);
    if (d >= B) throw new Error(`Digit '${ch}' not valid for base ${base}`);
    val = val * B + d;
  }
  return val;
}


function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(null).map(() => new Rat(0n));
  for (let i = 0; i < n; i++) {
    const ai = i < a.length ? a[i] : new Rat(0n);
    const bi = i < b.length ? b[i] : new Rat(0n);
    out[i] = ai.add(bi);
  }
  return out;
}
function polyScale(a, s) {
  return a.map(c => c.mul(s));
}
function polyMulLinear(a, xj) {
  const out = new Array(a.length + 1).fill(null).map(() => new Rat(0n));
  const negXj = new Rat(-xj, 1n);
  for (let d = 0; d < a.length; d++) {
    out[d]   = out[d].add(a[d].mul(negXj)); // * (-xj)
    out[d+1] = out[d+1].add(a[d]);          // * x
  }
  return out;
}



function interpolate(points) {
  const k = points.length;           // degree m = k-1
  let coeff = new Array(k).fill(null).map(() => new Rat(0n));
  const X = points.map(p => BigInt(p.x));
  const Y = points.map(p => new Rat(BigInt(p.y), 1n));

  for (let i = 0; i < k; i++) {
    let basis = [ new Rat(1n) ];
    let denom = new Rat(1n);
    for (let j = 0; j < k; j++) if (j !== i) {
      basis = polyMulLinear(basis, X[j]);
      denom = denom.mul(new Rat(X[i] - X[j], 1n));
    }
    const scale = Y[i].div(denom);
    coeff = polyAdd(coeff, polyScale(basis, scale));
  }
  return coeff;
}

(async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);

  const n = input.keys.n;
  const k = input.keys.k;
  if (k < 1 || n < k) throw new Error("Invalid n,k");

  const pts = [];
  for (const key of Object.keys(input)) {
    if (key === "keys") continue;
    const x = Number(key);
    const base = Number(input[key].base);
    const y = parseInBase(String(input[key].value), base);
    pts.push({ x, y });
  }
  pts.sort((a, b) => a.x - b.x);
  const chosen = pts.slice(0, k);

  const coeff = interpolate(chosen);

  const m = k - 1;
  console.log(JSON.stringify({
    degree: m,
    used_points: chosen.map(p => ({ x: p.x, y: p.y.toString() })),
    coefficients_asc: coeff.map(c => c.toString()), // a0..am
    pretty: coeff.slice().reverse().map((c, idx) => {
      const deg = m - idx;
      const s = c.toString();
      if (deg === 0) return `${s}`;
      if (deg === 1) return `${s}*x`;
      return `${s}*x^${deg}`;
    }).join(" + ")
  }, null, 2));
})().catch(e => {
  console.error(e);
  process.exit(1);
});
