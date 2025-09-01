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
  add(o) { return new Rat(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o) { return new Rat(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(o) { return new Rat(this.num * o.num, this.den * o.den); }
  div(o) { return new Rat(this.num * o.den, this.den * o.num); }
  toString() { return this.den === 1n ? this.num.toString() : `${this.num}/${this.den}`; }
}

function charToDigit(ch) {
  const code = ch.codePointAt(0);
  if (code >= 48 && code <= 57) return BigInt(code - 48);
  if (code >= 65 && code <= 90) return BigInt(code - 55);
  if (code >= 97 && code <= 122) return BigInt(code - 87);
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
function polyScale(a, s) { return a.map(c => c.mul(s)); }
function polyMulLinear(a, xj) {
  const out = new Array(a.length + 1).fill(null).map(() => new Rat(0n));
  const negXj = new Rat(-xj, 1n);
  for (let d = 0; d < a.length; d++) {
    out[d]   = out[d].add(a[d].mul(negXj));
    out[d+1] = out[d+1].add(a[d]);
  }
  return out;
}

function interpolate(points) {
  const k = points.length;
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

function combinations(arr, k) {
  const res = [];
  const idx = [];
  function backtrack(start, depth) {
    if (depth === k) {
      res.push(idx.slice());
      return;
    }
    for (let i = start; i <= arr.length - (k - depth); i++) {
      idx[depth] = arr[i];
      backtrack(i + 1, depth + 1);
    }
  }
  backtrack(0, 0);
  return res;
}

(async function main() {
  const fs = require("fs");
  const raw = fs.readFileSync("input.json", "utf8");
  const input = JSON.parse(raw);
  const k = input.keys.k;

  const pts = [];
  for (const key of Object.keys(input)) {
    if (key === "keys") continue;
    const x = Number(key);
    const base = Number(input[key].base);
    const y = parseInBase(String(input[key].value), base);
    pts.push({ x, y });
  }
  pts.sort((a, b) => a.x - b.x);

  const freq = new Map();
  const rep = new Map();
  const idxs = combinations([...pts.keys()], k);
  for (const idxset of idxs) {
    const chosen = idxset.map(i => pts[i]);
    const coeff = interpolate(chosen);
    const a0 = coeff[0].toString();
    if (!freq.has(a0)) { freq.set(a0, 0); rep.set(a0, idxset.slice()); }
    freq.set(a0, freq.get(a0) + 1);
  }

  let bestVal = null, bestCount = -1;
  for (const [val, count] of freq.entries()) {
    if (count > bestCount) { bestCount = count; bestVal = val; }
  }

  console.log(`Most frequent a0: ${bestVal} (count=${bestCount})`);

  // Reconstruct polynomial from a representative subset
  const subset = rep.get(bestVal);
  const chosen = subset.map(i => pts[i]);
  const coeff = interpolate(chosen);

  function evalPolyAt(coeff, x) {
    let acc = new Rat(0n);
    let pow = new Rat(1n);
    const X = new Rat(BigInt(x), 1n);
    for (const c of coeff) {
      acc = acc.add(c.mul(pow));
      pow = pow.mul(X);
    }
    return acc;
  }

  // Check which points fit exactly
  const fits = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const val = evalPolyAt(coeff, p.x);
    // Compare as exact rationals
    const target = new Rat(BigInt(p.y), 1n);
    const matches = val.num === target.num && val.den === target.den;
    if (matches) fits.push(i);
  }
  console.log(`Fits points (0-based indices): ${JSON.stringify(fits)}`);
})();


