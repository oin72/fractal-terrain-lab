// Tileable noise textures generated once at start-up: a 2D RGBA detail texture and a 3D cloud-shape texture.
const h2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 };
const h3 = (x, y, z, s) => h2(x + Math.imul(z, 1013), y + Math.imul(z, 7919), s);
const sm = t => t * t * (3 - 2 * t), md = (a, n) => ((a % n) + n) % n;
function tv(x, y, P, s) { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi), x0 = md(xi, P), x1 = md(xi + 1, P), y0 = md(yi, P), y1 = md(yi + 1, P), a = h2(x0, y0, s), b = h2(x1, y0, s), c = h2(x0, y1, s), d = h2(x1, y1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v }
function fbm2(x, y, P, oct, s, ridged) { let a = .5, f = 1, t = 0, n = 0; for (let o = 0; o < oct; o++) { let v = tv(x * f, y * f, P * f, s + o * 17); if (ridged) v = 1 - Math.abs(2 * v - 1); t += a * v; n += a; a *= .5; f *= 2 } return t / n }
export function noise2D(N = 512) {
  const d = new Uint8Array(N * N * 4), c = v => Math.max(0, Math.min(255, ((v - .5) * 1.7 + .5) * 255)) | 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, o = (j * N + i) * 4;
    d[o] = c(fbm2(u * 8, v * 8, 8, 6, 1)); d[o + 1] = c(fbm2(u * 8, v * 8, 8, 6, 2));
    d[o + 2] = c(fbm2(u * 16, v * 16, 16, 4, 3, true) * .9 + .05); d[o + 3] = c(fbm2(u * 32, v * 32, 32, 4, 4))
  }
  return d
}
function tv3(x, y, z, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi), x0 = md(xi, P), x1 = md(xi + 1, P), y0 = md(yi, P), y1 = md(yi + 1, P), z0 = md(zi, P), z1 = md(zi + 1, P);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(x0, y0, z0, s), h3(x1, y0, z0, s), u), l(h3(x0, y1, z0, s), h3(x1, y1, z0, s), u), v), l(l(h3(x0, y0, z1, s), h3(x1, y0, z1, s), u), l(h3(x0, y1, z1, s), h3(x1, y1, z1, s), u), v), w)
}
function worleySet(P, s) { const p = new Float32Array(P * P * P * 3); for (let z = 0; z < P; z++) for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const o = ((z * P + y) * P + x) * 3; p[o] = h3(x, y, z, s); p[o + 1] = h3(x, y, z, s + 1); p[o + 2] = h3(x, y, z, s + 2) } return p }
function worley(x, y, z, P, pts) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let m = 9;
  for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const o = ((md(zi + c, P) * P + md(yi + b, P)) * P + md(xi + a, P)) * 3, dx = xi + a + pts[o] - x, dy = yi + b + pts[o + 1] - y, dz = zi + c + pts[o + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < m) m = d
  }
  return Math.min(1, Math.sqrt(m))
}
export function noise3D(N = 64) {
  const d = new Uint8Array(N * N * N * 2), w4 = worleySet(4, 11), w8 = worleySet(8, 21), w16 = worleySet(16, 31), c = v => Math.max(0, Math.min(255, v * 255)) | 0;
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, w = k / N, o = ((k * N + j) * N + i) * 2;
    const f = .5 * tv3(u * 4, v * 4, w * 4, 4, 5) + .3 * tv3(u * 8, v * 8, w * 8, 8, 6) + .2 * tv3(u * 16, v * 16, w * 16, 16, 7);
    const a = 1 - worley(u * 4, v * 4, w * 4, 4, w4), b = 1 - worley(u * 8, v * 8, w * 8, 8, w8), e = 1 - worley(u * 16, v * 16, w * 16, 16, w16);
    d[o] = c((f * .55 + (a * .65 + b * .35) * .6) * 1.05 - .08);
    d[o + 1] = c(b * .6 + e * .4)
  }
  return d
}
