// Fractal terrain generation (five methods, ported from the original lab) plus
// the high-resolution heightmap the renderer and the game logic both sample.
import { S, $ } from './state.js';

export const HN = 1024, CG = 48, CX = 1.3;
export const INFO = {
  ds: "Diamond-square: the square step sets each centre to the mean of 4 corners plus noise; the diamond step sets edge midpoints from their neighbours plus noise. Noise shrinks by 2^-H each level.",
  tri: "Triangle midpoint displacement: each triangle splits into 4 via its edge midpoints. A new vertex is the mean of its edge ends plus Gaussian noise, shared (cached) between neighbours so the mesh has no cracks.",
  fbm: "fBm: eight octaves of value noise, each at double frequency and 2^-H amplitude (spectral synthesis in the spatial domain).",
  ridged: "Ridged multifractal: octaves folded with 1-|2n-1| and weighted by the previous octave, giving sharp crests and eroded-looking valleys.",
  fault: "Fault formation: hundreds of random lines split the map and one side is raised by a shrinking step (H sets the decay), then lightly smoothed."
};
export const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
let rnd;
export const hh = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + S.sd | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 };
export const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = hh(xi, yi), b = hh(xi + 1, yi), c = hh(xi, yi + 1), d = hh(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v };
// Position-keyed Gaussian noise: the same place gets the same value at any Detail level
function gH(a, b, c) { const u = hh(a * 7 + c * 131, b * 13 + c * 17 + 5), v = hh(a * 11 + c * 97 + 3, b * 5 + c * 23 + 9); return Math.sqrt(-2 * Math.log(1 - u)) * Math.cos(6.2832 * v) }

function ds(L, H) {
  const N = (1 << L) + 1, h = new Float32Array(N * N); let s = 1;
  for (const i of [0, N - 1, N * (N - 1), N * N - 1]) h[i] = gH((i % N) << (16 - L), (i / N | 0) << (16 - L), 0);
  for (let st = N - 1; st > 1; st >>= 1, s *= Math.pow(2, -H)) {
    const hf = st >> 1;
    for (let y = 0; y < N - 1; y += st) for (let x = 0; x < N - 1; x += st) h[(y + hf) * N + x + hf] = (h[y * N + x] + h[y * N + x + st] + h[(y + st) * N + x] + h[(y + st) * N + x + st]) / 4 + gH((x + hf) << (16 - L), (y + hf) << (16 - L), st << (16 - L)) * s;
    for (let y = 0; y < N; y += hf) for (let x = (y / hf) % 2 ? 0 : hf; x < N; x += st) {
      let t = 0, c = 0;
      for (const [dx, dy] of [[hf, 0], [-hf, 0], [0, hf], [0, -hf]]) { const a = x + dx, b = y + dy; if (a >= 0 && a < N && b >= 0 && b < N) { t += h[b * N + a]; c++ } }
      h[y * N + x] = t / c + gH(x << (16 - L), y << (16 - L), hf << (16 - L)) * s
    }
  }
  return { h, N }
}
function noise(L, H, ridged) {
  const N = (1 << L) + 1, h = new Float32Array(N * N), g = Math.pow(2, -H);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 1, f = 3, s = 0, w = 1;
    for (let o = 0; o < 8; o++) {
      let n = vn(x / (N - 1) * f + o * 17.3, y / (N - 1) * f + o * 9.1);
      if (ridged) { n = 1 - Math.abs(2 * n - 1); n *= n * w; w = Math.min(1, n * 2) }
      s += n * a; a *= g; f *= 2
    }
    h[y * N + x] = s
  }
  return { h, N }
}
function fault(L, H) {
  const N = (1 << L) + 1, h = new Float32Array(N * N), it = 360;
  for (let i = 0; i < it; i++) {
    const a = rnd() * 6.28318, c = Math.cos(a), s = Math.sin(a), px = rnd() * N, py = rnd() * N, d = Math.pow(2, -H * 3 * i / it);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] += ((x - px) * c + (y - py) * s > 0 ? d : -d)
  }
  for (let k = 0; k < 3; k++) { const o = h.slice(); for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; h[i] = (o[i] + o[i - 1] + o[i + 1] + o[i - N] + o[i + N]) / 5 } }
  return { h, N }
}
function tri(n, H) {
  let s = .35; const V = [[0, 0, 0]], sc = Math.pow(2, -H);
  for (let k = 0; k < 6; k++) V.push([Math.cos(k * Math.PI / 3) * .5, 0, Math.sin(k * Math.PI / 3) * .5]);
  V.forEach((v, i) => v[1] = gH(i, 99, 0) * s);
  let T = []; for (let k = 0; k < 6; k++) T.push([0, 1 + k, 1 + (k + 1) % 6]);
  for (let l = 0; l < n; l++) {
    s *= sc; const M = new Map(), NT = [];
    const mid = (a, b) => {
      const key = a < b ? a * 1e7 + b : b * 1e7 + a; let m = M.get(key);
      if (m === undefined) { m = V.length; V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2 + gH(Math.round(((V[a][0] + V[b][0]) / 2 + 1) * 32768), Math.round(((V[a][2] + V[b][2]) / 2 + 1) * 32768), l) * s, (V[a][2] + V[b][2]) / 2]); M.set(key, m) } return m
    };
    for (const t of T) { const ab = mid(t[0], t[1]), bc = mid(t[1], t[2]), ca = mid(t[2], t[0]); NT.push([t[0], ab, ca], [ab, t[1], bc], [ca, bc, t[2]], [ab, bc, ca]) }
    T = NT
  }
  return { V, T }
}

export const SQ = [[1, 0, .5], [-1, 0, .5], [0, 1, .5], [0, -1, .5]],
  HX = [0, 1, 2, 3, 4, 5].map(k => [Math.cos((30 + 60 * k) * Math.PI / 180), Math.sin((30 + 60 * k) * Math.PI / 180), .4330127]);

// Catmull-Rom upsample of an N x N grid to HN x HN, mirrored at the borders so mirrored tiles join smoothly
function upsample(h, N) {
  const out = new Float32Array(HN * HN), tmp = new Float32Array(N * HN), s = (N - 1) / (HN - 1);
  const cr = (a, b, c, d, t) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const mi = i => i < 0 ? -i : i > N - 1 ? 2 * (N - 1) - i : i;
  for (let y = 0; y < N; y++) for (let X = 0; X < HN; X++) {
    const fx = X * s, i = Math.min(N - 2, Math.floor(fx)), t = fx - i, r = y * N;
    tmp[y * HN + X] = cr(h[r + mi(i - 1)], h[r + i], h[r + i + 1], h[r + mi(i + 2)], t)
  }
  for (let Y = 0; Y < HN; Y++) {
    const fy = Y * s, j = Math.min(N - 2, Math.floor(fy)), t = fy - j, a = mi(j - 1) * HN, b = j * HN, c = (j + 1) * HN, d = mi(j + 2) * HN;
    for (let X = 0; X < HN; X++) out[Y * HN + X] = cr(tmp[a + X], tmp[b + X], tmp[c + X], tmp[d + X], t)
  }
  return out
}
function boxBlur(h, n, r, passes) {
  const t = new Float32Array(n * n);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < n; y++) { let s = 0; const o = y * n; for (let x = -r; x <= r; x++) s += h[o + Math.min(n - 1, Math.max(0, x))]; for (let x = 0; x < n; x++) { t[o + x] = s / (2 * r + 1); s += h[o + Math.min(n - 1, x + r + 1)] - h[o + Math.max(0, x - r)] } }
    for (let x = 0; x < n; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(n - 1, Math.max(0, y)) * n + x]; for (let y = 0; y < n; y++) { h[y * n + x] = s / (2 * r + 1); s += t[Math.min(n - 1, y + r + 1) * n + x] - t[Math.max(0, y - r) * n + x] } }
  }
}
// Rasterise the hexagonal triangle mesh into the square heightmap, fill outside the hexagon by reflection
function rasterTri(M, L) {
  const out = new Float32Array(HN * HN), cov = new Uint8Array(HN * HN), K = HN - 1;
  for (const t of M.T) {
    const a = M.V[t[0]], b = M.V[t[1]], c = M.V[t[2]], den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (!den) continue;
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) + .5) * K - 1)), i1 = Math.min(K, Math.ceil((Math.max(a[0], b[0], c[0]) + .5) * K + 1)),
      j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) + .5) * K - 1)), j1 = Math.min(K, Math.ceil((Math.max(a[2], b[2], c[2]) + .5) * K + 1));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = i / K - .5, pz = j / K - .5,
        l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den, l3 = 1 - l1 - l2;
      if (l1 >= -.02 && l2 >= -.02 && l3 >= -.02) { out[j * HN + i] = l1 * a[1] + l2 * b[1] + l3 * c[1]; cov[j * HN + i] = 1 }
    }
  }
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) if (!cov[j * HN + i]) {
    let x = i / K - .5, z = j / K - .5;
    for (let n = 0; n < 3; n++) for (const e of HX) { const d = x * e[0] + z * e[1] - e[2]; if (d > 0) { x -= 2 * d * e[0]; z -= 2 * d * e[1] } }
    x *= .995; z *= .995;
    const a = Math.max(0, Math.min(K, Math.round((x + .5) * K))), b = Math.max(0, Math.min(K, Math.round((z + .5) * K)));
    out[j * HN + i] = out[b * HN + a]
  }
  boxBlur(out, HN, Math.max(1, Math.round(HN / (1 << L) / 3)), 2);
  return out
}
// Sub-grid detail: continues the fractal below the Detail level so close-up ground is never flat
function addDetail(Hn, L, H) {
  const N = 1 << L, a0 = .035 * Math.pow(2, -H * L);
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) {
    const x = i / (HN - 1), z = j / (HN - 1); let a = a0, f = 2 * N, s = 0;
    for (let o = 0; o < 3 && f < HN * .45; o++) { s += (vn(x * f + 911 + o * 37, z * f + 577 + o * 53) - .5) * 2 * a; a *= .45; f *= 2 }
    Hn[j * HN + i] += s
  }
}
function aoMap(Hn) {
  const n = 256, st = HN / n, lo = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) lo[j * n + i] = Hn[Math.min(HN - 1, j * st) * HN + Math.min(HN - 1, i * st)];
  const b1 = lo.slice(), b2 = lo.slice(); boxBlur(b1, n, 3, 2); boxBlur(b2, n, 10, 2);
  const ao = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) ao[i] = Math.max(.35, Math.min(1, 1 - Math.max(0, b1[i] - lo[i]) * 14 - Math.max(0, b2[i] - lo[i]) * 4));
  return { ao, n }
}

export function gen() {
  rnd = mulberry(S.seed); S.sd = S.seed;
  const m = $("m").value, H = +$("H").value, L = +$("L").value;
  let Hn;
  const norm = (get, set, n) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { const v = get(i); lo = Math.min(lo, v); hi = Math.max(hi, v) } for (let i = 0; i < n; i++) set(i, (get(i) - lo) / (hi - lo || 1)) };
  if (m == "tri") { const M = tri(L - 1, H); norm(i => M.V[i][1], (i, v) => M.V[i][1] = v, M.V.length); Hn = rasterTri(M, L) }
  else { const g = m == "ds" ? ds(L, H) : m == "fault" ? fault(L, H) : noise(L, H, m == "ridged"); norm(i => g.h[i], (i, v) => g.h[i] = v, g.h.length); Hn = upsample(g.h, g.N) }
  addDetail(Hn, L, H);
  S.hex = m == "tri"; S.edges = S.hex ? HX : SQ;
  S.Hraw = Hn; S.rawVer = (S.rawVer || 0) + 1; Hn = Hn.slice(); S.Hn = Hn; S.AO = aoMap(Hn); S.heightVer++; S.SK = null; S.TR = null;
  $("info").textContent = INFO[m]; $("seedIn").value = S.seed; shade()
}
export function shade() {
  S.hs = +$("hs").value; S.sea = +$("sea").value; S.TR = null;
  for (const id of ["H", "L", "hs", "sea"]) $(id + "v").textContent = $(id).value
}
export const outside = (x, z, m) => S.edges.some(e => x * e[0] + z * e[1] > e[2] - m);
// Land height at a point (folded into the base tile exactly as the shader does)
export function ghLand(x, z) {
  for (let n = 0; n < 3; n++) for (const e of S.edges) { const d = x * e[0] + z * e[1] - e[2]; if (d > 0) { x -= 2 * d * e[0]; z -= 2 * d * e[1] } }
  const fx = Math.max(0, Math.min(HN - 1.001, (x + .5) * (HN - 1))), fz = Math.max(0, Math.min(HN - 1.001, (z + .5) * (HN - 1))), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, H = S.Hn, o = j * HN + i;
  return (H[o] * (1 - u) * (1 - v) + H[o + 1] * u * (1 - v) + H[o + HN] * (1 - u) * v + H[o + HN + 1] * u * v) * S.hs
}
// Height of the surface you stand on: land, or the water surface where land is below sea level
export const gh = (x, z) => Math.max(ghLand(x, z), S.sea * S.hs);
// Ground type under a point: 0 grass, 1 sand, 2 rock, 3 water, 4 snow
export function surf(x, z) {
  const hs = S.hs, sn = S.sea, y = gh(x, z); if (y <= sn * hs + 1e-5) return 3;
  const t = (y / hs - sn) / (1 - sn), i = Math.floor((x + CX) / (2 * CX / CG)), j = Math.floor((z + CX) / (2 * CX / CG));
  if (S.SNOW[j * CG + i] > .5 || t > .85) return 4; return t < .07 ? 1 : t < .6 ? 0 : 2
}
