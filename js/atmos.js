// CPU copy of the atmosphere integral in glsl_post.js (ATMO). Used once per change of sun or haze
// to get the colour of direct sunlight and of the ambient sky light, so every shader is lit consistently.
const Rg = 6360e3, Ra = 6420e3, SUN_I = 20, bR = [5.8e-6, 13.5e-6, 33.1e-6], bM = 21e-6, bO = [.65e-6, 1.881e-6, .085e-6];
function rsi(o, d, r) { const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r, h = b * b - c; if (h < 0) return [1e9, -1e9]; const q = Math.sqrt(h); return [-b - q, -b + q] }
const dens = h => [Math.exp(-h / 8000), Math.exp(-h / 1200), Math.max(0, 1 - Math.abs(h - 25000) / 15000)];
function sunOD(p, s) { const t = rsi(p, s, Ra)[1], dt = t / 6, od = [0, 0, 0]; for (let i = 0; i < 6; i++) { const k = (i + .5) * dt, q = [p[0] + s[0] * k, p[1] + s[1] * k, p[2] + s[2] * k], d = dens(Math.hypot(q[0], q[1], q[2]) - Rg); od[0] += d[0] * dt; od[1] += d[1] * dt; od[2] += d[2] * dt } return od }
const ext = (ol, haze) => [0, 1, 2].map(c => Math.exp(-(bR[c] * ol[0] + bM * haze * 1.1 * ol[1] + bO[c] * ol[2])));
export function atmo(rd, sun, haze) {
  const ro = [0, Rg + 250, 0]; let tmax = rsi(ro, rd, Ra)[1]; const tg = rsi(ro, rd, Rg); if (tg[0] > 0 && tg[0] < 1e8) tmax = Math.min(tmax, tg[0]);
  const od = [0, 0, 0], sR = [0, 0, 0], sM = [0, 0, 0]; let tp = 0;
  for (let i = 0; i < 20; i++) {
    const f = (i + 1) / 20, tc = tmax * f * f, dt = tc - tp, k = tp + dt * .5, p = [ro[0] + rd[0] * k, ro[1] + rd[1] * k, ro[2] + rd[2] * k]; tp = tc;
    const d = dens(Math.hypot(p[0], p[1], p[2]) - Rg).map(v => v * dt); od[0] += d[0]; od[1] += d[1]; od[2] += d[2];
    const gs = rsi(p, sun, Rg); if (gs[0] > 0 && gs[0] < 1e8) continue;
    const so = sunOD(p, sun), tr = ext([so[0] + od[0], so[1] + od[1], so[2] + od[2]], haze);
    for (let c = 0; c < 3; c++) { sR[c] += tr[c] * d[0]; sM[c] += tr[c] * d[1] }
  }
  const mu = rd[0] * sun[0] + rd[1] * sun[1] + rd[2] * sun[2], pR = 3 / (16 * Math.PI) * (1 + mu * mu), g = .76, pM = 3 / (8 * Math.PI) * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  return [0, 1, 2].map(c => SUN_I * (sR[c] * bR[c] * (pR + .03) + sM[c] * bM * haze * (pM + .03)))
}
// Direct sunlight reaching the ground, already divided by pi for Lambert shading
export function sunLight(sun, haze) {
  const p = [0, Rg + 250, 0], gs = rsi(p, sun, Rg); if (gs[0] > 0 && gs[0] < 1e8) return [0, 0, 0];
  return ext(sunOD(p, sun), haze).map(v => v * SUN_I / Math.PI)
}
// Sky irradiance on flat ground, divided by pi
export function skyAmbient(sun, haze) {
  const E = [0, 0, 0], els = [.09, .26, .52, .87, 1.31], dEl = [.17, .2, .3, .4, .44], nAz = 8;
  els.forEach((el, i) => { for (let a = 0; a < nAz; a++) { const az = (a + .5) / nAz * 6.2832, rd = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], L = atmo(rd, sun, haze), w = Math.sin(el) * Math.cos(el) * dEl[i] * 6.2832 / nAz; E[0] += L[0] * w; E[1] += L[1] * w; E[2] += L[2] * w } });
  return E.map(v => v / Math.PI)
}
// Sun position for a given clock hour (latitude 54 N, late spring). +x is east, -z is north.
export function sunDir(hour) {
  const lat = 54 * Math.PI / 180, dec = 14 * Math.PI / 180, H = (hour - 12) * 15 * Math.PI / 180;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H), el = Math.asin(sinEl);
  const y = -Math.sin(H) * Math.cos(dec), x = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H);   // east, north components
  const l = Math.hypot(x, y) || 1, ce = Math.cos(el);
  return [-y / l * ce * -1, sinEl, -x / l * ce]
}
