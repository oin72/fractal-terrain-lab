// Settlements and transport: villages, farms, windmills and fishing towns with people; roads, farm tracks and a
// railway routed over the terrain; cars, buses, trains, boats, ships and planes that use them.
// buildWorld() grades the heightmap along roads and under buildings and paints a ground texture the terrain shader reads.
import { S, $ } from './state.js';
import { HN, gh, ghLand, outside, mulberry } from './terrain.js';

export const MU = .002;                       // world units per metre for the building and vehicle meshes
const GR = 128, ROUT = .016, PER = .012, STEP = .003, K = HN - 1;
const TY = { road: 150, dirt: 190, rail: 230 }, HWID = { road: .0062, dirt: .0034, rail: .0046 };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
const seaY = () => S.sea * S.hs;
const WALLS = [[.93, .91, .86], [.88, .82, .7], [.75, .72, .68], [.86, .74, .68], [.7, .45, .36], [.8, .84, .86]];
const CARS = [[.75, .1, .1], [.1, .25, .6], [.85, .85, .87], [.12, .12, .14], [.55, .58, .6], [.9, .75, .15], [.15, .4, .25]];

let key = "", dirtyAt = 0;
// Rebuild when the terrain, sea level or the options change (waits for sliders to settle)
export function worldTick(dt) {
  if (!S.Hraw) return;
  const k = [S.rawVer, S.hs, S.sea, $("bld").checked, $("tpr").checked].join("|");
  if (k != key) { key = k; dirtyAt = S.TM + (S.W ? .3 : 0) }
  if (dirtyAt && S.TM >= dirtyAt) { dirtyAt = 0; buildWorld() }
  if (S.W) step(dt)
}
export const blocked = (x, z) => { const W = S.W; if (!W || !W.blk || Math.abs(x) > .5 || Math.abs(z) > .5) return false; return W.blk[Math.round((z + .5) * K) * HN + Math.round((x + .5) * K)] > 0 };

function buildWorld() {
  const Hn = S.Hn; Hn.set(S.Hraw); S.heightVer++; S.TR = null;
  const bOn = $("bld").checked, tOn = $("tpr").checked, tex = new Uint8Array(HN * HN * 4), blk = new Uint8Array(HN * HN);
  const W = S.W = { ver: (S.W ? S.W.ver : 0) + 1, tex, blk, paths: [], bld: [], people: [], cars: [], trains: [], boats: [], ships: [], planes: [], sites: [], on: bOn || tOn };
  if (!W.on) return;
  const rnd = mulberry(S.seed * 31 + 7), hs = S.hs, sy = seaY(), cell = 1 / (GR - 1), N = GR * GR;
  // ---- coarse survey grid: height, slope, water, outside the tile ----
  const gy = new Float32Array(N), gs = new Float32Array(N), gw = new Uint8Array(N), go = new Uint8Array(N), gx = i => i * cell - .5;
  for (let j = 0; j < GR; j++) for (let i = 0; i < GR; i++) { const k = j * GR + i, y = ghLand(gx(i), gx(j)); gy[k] = y; gw[k] = y < sy + .0015 ? 1 : 0; go[k] = outside(gx(i), gx(j), .035) ? 1 : 0 }
  for (let j = 0; j < GR; j++) for (let i = 0; i < GR; i++) { const a = gy[j * GR + Math.min(GR - 1, i + 1)] - gy[j * GR + Math.max(0, i - 1)], b = gy[Math.min(GR - 1, j + 1) * GR + i] - gy[Math.max(0, j - 1) * GR + i]; gs[j * GR + i] = Math.hypot(a, b) / (2 * cell) }
  const flat = (i, j, r) => { let m = 0, n = 0; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= GR || y >= GR) return 9; const k = y * GR + x; if (gw[k] || go[k]) return 9; m += gs[k]; n++ } return m / n };
  const wet = (i, j, r) => { let n = 0; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < GR && y < GR && gw[y * GR + x]) n++ } return n };
  const rel = y => (y / hs - S.sea) / Math.max(.01, 1 - S.sea);
  // ---- sites ----
  const cand = { town: [], village: [], farm: [], mill: [] };
  for (let n = 0; n < 2600; n++) {
    const i = 6 + Math.floor(rnd() * (GR - 12)), j = 6 + Math.floor(rnd() * (GR - 12)), k = j * GR + i; if (gw[k] || go[k]) continue; const t = rel(gy[k]), f2 = flat(i, j, 2);
    if (f2 < 2) { const c = wet(i, j, 6), f = flat(i, j, 1); if (c >= 10 && c < 110) cand.town.push([f - c * .004, i, j]) }
    if (f2 < 2 && t < .6 && !wet(i, j, 5)) { const f = flat(i, j, 5); if (f < 2) { cand.village.push([f, i, j]); if (t > .03 && t < .5) cand.farm.push([f + rnd() * .15, i, j]) } }
    if (t > .15 && t < .7 && f2 < 2) { let top = true; for (let a = 0; a < 8; a++) { const x = i + Math.round(Math.cos(a * .785) * 6), y = j + Math.round(Math.sin(a * .785) * 6); if (x < 0 || y < 0 || x >= GR || y >= GR || gy[y * GR + x] > gy[k]) top = false } if (top) cand.mill.push([-gy[k], i, j]) }
  }
  const pick = (kind, n, sep) => { cand[kind].sort((a, b) => a[0] - b[0]); let got = 0; for (const c of cand[kind]) { if (got >= n) break; const x = gx(c[1]), z = gx(c[2]); if (W.sites.every(s => Math.hypot(s.x - x, s.z - z) > sep)) { W.sites.push({ k: kind, x, z, i: c[1], j: c[2], id: W.sites.length }); got++ } } };
  pick("town", 2, .3); pick("village", 2, .26); pick("farm", 4, .13); pick("mill", 3, .12);
  // settlements sit on a levelled shelf cut into the land
  const pad = (x, z, r, keep) => {
    const tg = ghLand(x, z) / hs, m = Math.ceil(r * 2 * K), ci = Math.round((x + .5) * K), cj = Math.round((z + .5) * K);
    for (let j = Math.max(0, cj - m); j <= Math.min(K, cj + m); j++) for (let i = Math.max(0, ci - m); i <= Math.min(K, ci + m); i++) { const d = Math.hypot(i / K - .5 - x, j / K - .5 - z), w = ss(2 * r, r, d), o = j * HN + i; Hn[o] += (tg - Hn[o]) * w; if (!keep && d < r * 1.4) blk[o] = 1 }
  };
  for (const s of W.sites) if (s.k != "mill") pad(s.x, s.z, s.k == "farm" ? .03 : .05, 1);
  const main = W.sites.filter(s => s.k == "town" || s.k == "village"); if (main.length < 2) for (const s of W.sites) if (s.k == "farm" && main.length < 3) main.push(s);

  // ---- routes: least-cost paths over the survey grid ----
  const D = new Float32Array(HN * HN).fill(ROUT), T = new Float32Array(HN * HN), PT = new Uint8Array(HN * HN), occ = new Uint8Array(N);
  const route = (src, isGoal, hx, ks) => {
    const g = new Float32Array(N).fill(1e30), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
    const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (; ;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m == i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return t };
    const c = k => go[k] ? 1e4 : (1 + (gs[k] * ks) ** 2) * (gw[k] ? 30 : 1) * (occ[k] ? .4 : 1);
    g[src] = 0; push(0, src);
    while (heap.length) {
      const [, k] = pop(); if (done[k]) continue; done[k] = 1;
      if (isGoal(k)) { const out = []; for (let q = k; q >= 0; q = from[q]) out.push(q); return out.reverse() }
      const i = k % GR, j = (k / GR) | 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const x = i + a, y = j + b; if (x < 1 || y < 1 || x >= GR - 1 || y >= GR - 1) continue; const q = y * GR + x; if (done[q]) continue; const ng = g[k] + (a && b ? 1.414 : 1) * (c(k) + c(q)) * .5; if (ng < g[q]) { g[q] = ng; from[q] = k; push(ng + hx(x, y), q) } }
    }
    return null
  };
  const addPath = (cells, ty, a, b) => {
    if (!cells || cells.length < 3) return null; for (const k of cells) occ[k] = 1;
    let pts = cells.map(k => [gx(k % GR), gx((k / GR) | 0)]);
    for (let n = 0; n < 3; n++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; o.push([p[0] * .75 + q[0] * .25, p[1] * .75 + q[1] * .25], [p[0] * .25 + q[0] * .75, p[1] * .25 + q[1] * .75]) } o.push(pts[pts.length - 1]); pts = o }
    const resample = pts => { const rs = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], l = Math.hypot(q[0] - p[0], q[1] - p[1]); let d = STEP - acc; while (d <= l) { rs.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l]); d += STEP } acc = (acc + l) % STEP } return rs };
    // grid routes zig-zag: relax the line so roads sweep rather than wiggle
    let rs = resample(pts); const sw = ty == "rail" ? 12 : ty == "road" ? 8 : 5;
    for (let n = 0; n < 10; n++) { const o = rs.map(p => p.slice()); for (let i = 1; i < rs.length - 1; i++) { const m = Math.min(sw, i, rs.length - 1 - i); let sx = 0, sz = 0; for (let q = i - m; q <= i + m; q++) { sx += rs[q][0]; sz += rs[q][1] } o[i] = [sx / (2 * m + 1), sz / (2 * m + 1)] } rs = o }
    rs = resample(rs);
    // height profile: follow the land, smoothed, never below the water line
    const w = ty == "rail" ? 16 : ty == "road" ? 7 : 3, lo = sy + .0016; let y = rs.map(p => Math.max(lo, ghLand(p[0], p[1])));
    for (let n = 0; n < 3; n++) { const o = y.slice(); for (let i = 0; i < y.length; i++) { let s = 0, c = 0; for (let q = Math.max(0, i - w); q <= Math.min(y.length - 1, i + w); q++) { s += y[q]; c++ } o[i] = Math.max(lo, s / c) } y = o }
    const cum = [0]; for (let i = 1; i < rs.length; i++) cum.push(cum[i - 1] + Math.hypot(rs[i][0] - rs[i - 1][0], rs[i][1] - rs[i - 1][1]));
    const P = { ty, pts: rs, y, cum, len: cum[cum.length - 1], a, b, id: W.paths.length }; W.paths.push(P);
    for (let i = 1; i < rs.length; i++) {
      const p = rs[i - 1], q = rs[i], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1e-9, m = Math.ceil(ROUT * K) + 1;
      const i0 = Math.max(0, Math.floor((Math.min(p[0], q[0]) + .5) * K) - m), i1 = Math.min(K, Math.ceil((Math.max(p[0], q[0]) + .5) * K) + m), j0 = Math.max(0, Math.floor((Math.min(p[1], q[1]) + .5) * K) - m), j1 = Math.min(K, Math.ceil((Math.max(p[1], q[1]) + .5) * K) + m);
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const px = ii / K - .5, pz = j / K - .5, t = Math.max(0, Math.min(1, ((px - p[0]) * dx + (pz - p[1]) * dz) / l2)), d = Math.hypot(px - p[0] - dx * t, pz - p[1] - dz * t), o = j * HN + ii;
        if (d < D[o]) { D[o] = d; T[o] = (y[i - 1] + (y[i] - y[i - 1]) * t) / hs; PT[o] = TY[ty]; const ph = (cum[i - 1] + Math.sqrt(l2) * t) / PER * 6.2832; tex[o * 4 + 1] = TY[ty]; tex[o * 4 + 2] = 127.5 + 127 * Math.cos(ph); tex[o * 4 + 3] = 127.5 + 127 * Math.sin(ph) }
      }
    }
    return P
  };
  const cellOf = s => s.j * GR + s.i, hTo = s => (x, y) => Math.hypot(x - s.i, y - s.j);
  if (tOn && main.length > 1) {
    // roads: a minimum spanning tree between the main settlements plus one extra link for a loop
    const inT = [main[0]], edges = [];
    while (inT.length < main.length) { let best = null; for (const a of inT) for (const b of main) if (!inT.includes(b)) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (!best || d < best[0]) best = [d, a, b] } edges.push(best); inT.push(best[2]) }
    if (main.length > 2) { let best = null; for (const a of main) for (const b of main) if (a.id < b.id && !edges.some(e => (e[1] == a && e[2] == b) || (e[1] == b && e[2] == a))) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (!best || d < best[0]) best = [d, a, b] } if (best) edges.push(best) }
    for (const [, a, b] of edges) addPath(route(cellOf(a), k => k == cellOf(b), hTo(b), 2.5), "road", a.id, b.id);
    // railway between the two settlements furthest apart, with its own gentler route
    let far = null; for (const a of main) for (const b of main) if (a.id < b.id) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (!far || d > far[0]) far = [d, a, b] }
    if (far) { const off = s => { for (let n = 0; n < 30; n++) { const a = rnd() * 6.28, i = s.i + Math.round(Math.cos(a) * 9), j = s.j + Math.round(Math.sin(a) * 9); if (flat(i, j, 1) < 2) return { i, j, x: gx(i), z: gx(j) } } return s }, A = off(far[1]), B = off(far[2]); occ.fill(0); const P = addPath(route(cellOf(A), k => k == cellOf(B), hTo(B), 4.5), "rail", far[1].id, far[2].id); if (P) W.rail = P; for (const p of W.paths) if (p.ty == "road") for (const q of p.pts) occ[Math.round((q[1] + .5) * (GR - 1)) * GR + Math.round((q[0] + .5) * (GR - 1))] = 1 }
    // farm and windmill tracks join the nearest road
    for (const s of W.sites) if (!main.includes(s)) addPath(route(cellOf(s), k => occ[k] == 1 && k != cellOf(s), () => 0, 2.5), "dirt", s.id, -1)
  }
  const nearRoad = (x, z, m) => { const o = Math.round((z + .5) * K) * HN + Math.round((x + .5) * K); return D[o] < m };

  // ---- buildings: each gets a levelled pad ----
  const put = (m, x, z, h, r, tint, road = .011) => {
    if (Math.abs(x) > .46 || Math.abs(z) > .46 || outside(x, z, .03) || ghLand(x, z) < sy + .003 || nearRoad(x, z, road)) return null;
    if (W.bld.some(b => Math.hypot(b.x - x, b.z - z) < b.r + r)) return null;
    const e = .008, y0 = ghLand(x, z); if (Math.hypot(ghLand(x + e, z) - y0, ghLand(x, z + e) - y0) / e > 1.1) return null;
    pad(x, z, r); const b = { m, x, z, h, r, tint: tint || [1, 1, 1], seed: rnd() }; W.bld.push(b); return b
  };
  const waterDir = s => { let best = null; for (let a = 0; a < 6.28; a += .2) for (let d = .01; d < .12; d += .004) { const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d; if (ghLand(x, z) < sy - .001) { if (!best || d < best[0]) best = [d, a]; break } } return best };
  if (bOn) for (const s of W.sites) {
    const wall = () => WALLS[Math.floor(rnd() * WALLS.length)];
    if (s.k == "village") {
      put("church", s.x + .022, s.z + .02, rnd() * 6.28, .019);
      for (let n = 0, got = 0; n < 140 && got < 15; n++) { const a = rnd() * 6.28, d = .018 + rnd() * .075, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d; if (put("house" + Math.floor(rnd() * 3), x, z, Math.atan2(s.z - z, s.x - x) + (rnd() - .5) * .5, .013, wall())) got++ }
    } else if (s.k == "town") {
      const wd = waterDir(s); if (!wd) continue; const dx = Math.cos(wd[1]), dz = Math.sin(wd[1]); s.wd = [dx, dz];
      const shore = (x, z) => { for (let d = 0; d < .14; d += .001) if (ghLand(x + dx * d, z + dz * d) < sy) return [x + dx * d, z + dz * d]; return null };
      for (let n = 0, got = 0; n < 140 && got < 11; n++) { const u = (rnd() - .5) * .16, v = rnd() * .06 - .012, x = s.x - dz * u - dx * v, z = s.z + dx * u - dz * v; if (put("house" + Math.floor(rnd() * 2), x, z, wd[1] + (rnd() - .5) * .3, .012, wall())) got++ }
      const sp = shore(s.x, s.z); if (sp) { W.bld.push({ m: "jetty", x: sp[0] - dx * .004, z: sp[1] - dz * .004, y: sy, h: wd[1], r: 0, tint: [1, 1, 1], seed: 0 }); s.jetty = [sp[0] + dx * .046, sp[1] + dz * .046] }
      for (const sg of [1, -1]) { const lp = shore(s.x - dz * .1 * sg, s.z + dx * .1 * sg); if (lp && put("lighthouse", lp[0] - dx * .012, lp[1] - dz * .012, 0, .008, null, .008)) break }
    } else if (s.k == "farm") {
      const a = rnd() * 6.28, c = Math.cos(a), sn = Math.sin(a);
      put(rnd() < .5 ? "house2" : "house0", s.x + c * .016, s.z + sn * .016, a + 1.57, .013, wall()); put("barn", s.x - c * .02, s.z - sn * .02, a, .017); put("silo", s.x - c * .02 + sn * .022, s.z - sn * .02 - c * .022, 0, .007);
      // fields: rectangles of crop rows painted on the ground
      for (let f = 0; f < 3; f++) {
        const fa = a + (f - 1) * 2.1 + .9, d = .07 + rnd() * .02, cx = s.x + Math.cos(fa) * d, cz = s.z + Math.sin(fa) * d, ha = .03 + rnd() * .015, hb = .022 + rnd() * .012, th = a + (rnd() < .5 ? 0 : 1.57), ct = Math.cos(th), st = Math.sin(th), m = Math.ceil((ha + hb) * K), ci = Math.round((cx + .5) * K), cj = Math.round((cz + .5) * K), g = 50 + 30 * Math.floor(rnd() * 3);
        for (let j = Math.max(0, cj - m); j <= Math.min(K, cj + m); j++) for (let i = Math.max(0, ci - m); i <= Math.min(K, ci + m); i++) {
          const px = i / K - .5 - cx, pz = j / K - .5 - cz, u = px * ct + pz * st, v = -px * st + pz * ct, e = Math.min(ha - Math.abs(u), hb - Math.abs(v)), o = j * HN + i; if (e <= 0 || blk[o] || D[o] < .009) continue;
          const k = Math.round((j / K) * (GR - 1)) * GR + Math.round((i / K) * (GR - 1)); if (gw[k] || go[k] || gs[k] > .9 || rel(gy[k]) > .55) continue;
          const ph = v / PER * 6.2832; tex[o * 4] = 255 * Math.min(1, e / .003); tex[o * 4 + 1] = g; tex[o * 4 + 2] = 127.5 + 127 * Math.cos(ph); tex[o * 4 + 3] = 127.5 + 127 * Math.sin(ph); blk[o] = 1
        }
      }
    } else { const b = put("windmill", s.x + .012, s.z + .008, rnd() * 6.28, .011, null, .008); if (b) b.mill = 1 }
  }
  // stations where the railway ends
  if (bOn && W.rail) for (const e of [0, 1]) { const P = W.rail, i = e ? P.pts.length - 12 : 11, p = P.pts[i], q = P.pts[i + 1], h = Math.atan2(q[1] - p[1], q[0] - p[0]), nx = -Math.sin(h), nz = Math.cos(h), x = p[0] + nx * .0105, z = p[1] + nz * .0105; if (ghLand(x, z) > sy) W.bld.push({ m: "station", x, z, y: P.y[i], h: h + Math.PI, r: .02, tint: [1, 1, 1], seed: rnd() }) }
  // ---- grade the land along every route, then finish the ground texture ----
  for (let o = 0; o < HN * HN; o++) if (D[o] < ROUT) { const hw = PT[o] == TY.road ? HWID.road : PT[o] == TY.rail ? HWID.rail : HWID.dirt; Hn[o] += (T[o] - Hn[o]) * ss(ROUT * .97, hw * 1.25, D[o]); tex[o * 4] = 255 * (1 - D[o] / ROUT); tex[o * 4 + 1] = PT[o]; if (D[o] < hw * 1.5) blk[o] = 1 }
  for (const b of W.bld) if (b.y == null) b.y = ghLand(b.x, b.z);

  // ---- people ----
  if (bOn) for (const s of W.sites) { const n = s.k == "village" ? 9 : s.k == "town" ? 7 : s.k == "farm" ? 2 : 1; for (let i = 0; i < n; i++) W.people.push({ s, x: s.x + (rnd() - .5) * .03, z: s.z + (rnd() - .5) * .03, h: rnd() * 6.28, tx: s.x, tz: s.z, pau: rnd() * 4, seed: rnd(), ph: rnd() * 6, mv: 0 }) }
  // ---- vehicles ----
  if (tOn) {
    const roads = W.paths.filter(p => p.ty == "road");
    if (roads.length) {
      for (let i = 0; i < 16; i++) { const p = roads[i % roads.length]; W.cars.push({ p, s: rnd() * p.len, d: rnd() < .5 ? 1 : -1, v: .028 + rnd() * .016, m: "car", tint: CARS[Math.floor(rnd() * CARS.length)], wait: 0 }) }
      for (let i = 0; i < 3; i++) { const p = roads[i % roads.length]; W.cars.push({ p, s: rnd() * p.len, d: 1, v: .02, m: "bus", tint: [[.8, .1, .08], [.1, .45, .25], [.9, .9, .9]][i], wait: 0 }) }
      for (const p of W.paths) if (p.ty == "dirt" && rnd() < .5) W.cars.push({ p, s: rnd() * p.len, d: 1, v: .012, m: "car", tint: [.2, .45, .15], wait: 0, local: 1 })
    }
    if (W.rail) W.trains.push({ p: W.rail, s: .1, d: 1, v: 0, wait: 3, tint: [.12, .3, .55] });
    const water = (x, z) => !outside(x, z, .012) && ghLand(x, z) < sy - .0025, homes = W.sites.filter(s => s.jetty).map(s => s.jetty);
    for (let n = 0; n < 300 && homes.length < 3; n++) { const x = rnd() - .5, z = rnd() - .5; if (water(x, z)) homes.push([x, z]) }
    W.water = water;
    homes.forEach((hm, i) => { if (!water(hm[0], hm[1])) return; for (let b = 0; b < 2; b++) W.boats.push({ hm, x: hm[0], z: hm[1], h: rnd() * 6.28, tx: hm[0], tz: hm[1], v: 0, m: b || i > 1 ? "sailBoat" : "fishingBoat", tint: b ? [.95, .95, .95] : [[.15, .3, .5], [.6, .15, .1], [.2, .45, .35]][i % 3], seed: rnd() * 9, pau: rnd() * 3 }) });
    for (let i = 0; i < 2; i++) W.ships.push({ a: rnd() * 6.28, r: i ? 1.3 : 1.05, d: i ? -1 : 1, tint: i ? [.12, .2, .35] : [.5, .12, .1], seed: i * 3 });
    for (let i = 0; i < 2; i++) W.planes.push({ m: "airliner", a: rnd() * 6.28, off: (rnd() - .5) * .8, t0: rnd() * 60, T: 70 + rnd() * 30, tint: [.95, .95, .97] });
    W.planes.push({ m: "lightPlane", a: 0, tint: [.9, .85, .2] })
  }
}

// position, heading and slope at distance s along a path (lane > 0 shifts to the left of travel)
export function pathAt(P, s, dir = 1, lane = 0) {
  s = Math.max(0, Math.min(P.len - 1e-6, s)); const i = Math.min(P.pts.length - 2, Math.floor(s / STEP)), a = P.pts[i], b = P.pts[i + 1], t = (s - P.cum[i]) / ((P.cum[i + 1] - P.cum[i]) || 1);
  let tx = (b[0] - a[0]) * dir, tz = (b[1] - a[1]) * dir; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  const x = a[0] + (b[0] - a[0]) * t - tz * lane, z = a[1] + (b[1] - a[1]) * t + tx * lane;
  return { x, z, y: gh(x, z), h: Math.atan2(tz, tx), pit: Math.atan2((P.y[i + 1] - P.y[i]) * dir, STEP) }
}
function step(dt) {
  const W = S.W, TM = S.TM; if (!W.on) return;
  for (const c of W.cars) {
    if (c.wait > 0) { c.wait -= dt; continue }
    c.s += c.d * c.v * dt;
    if (c.s <= 0 || c.s >= c.p.len) {
      const end = c.s <= 0 ? c.p.a : c.p.b, opts = c.local ? [] : W.paths.filter(q => q.ty == "road" && q != c.p && (q.a == end || q.b == end));
      if (opts.length) { const q = opts[Math.floor(Math.random() * opts.length)]; c.p = q; c.d = q.a == end ? 1 : -1; c.s = c.d > 0 ? 0 : q.len } else { c.d = -c.d; c.s = Math.max(0, Math.min(c.p.len, c.s)) }
      if (c.m == "bus" || c.local) c.wait = 3 + Math.random() * 3
    }
  }
  for (const t of W.trains) {
    if (t.manual) continue;
    if (t.wait > 0) { t.wait -= dt; t.v = 0; continue }
    const L = t.p.len, toEnd = t.d > 0 ? L - .03 - t.s : t.s - .03 - 5 * .0395, vmax = .07; t.v = Math.min(vmax, t.v + dt * .012, Math.sqrt(Math.max(0, toEnd) * .03) + .002); t.s += t.d * t.v * dt;
    if (toEnd <= .002) { t.d = -t.d; t.wait = 5; t.v = 0 }
  }
  for (const b of W.boats) {
    if (b.pau > 0) { b.pau -= dt; b.v *= 1 - dt; } else {
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d < .008) { b.pau = b.m == "fishingBoat" ? 4 + Math.random() * 8 : 1; for (let n = 0; n < 12; n++) { const a = Math.random() * 6.28, r = .03 + Math.random() * .2, x = b.hm[0] + Math.cos(a) * r, z = b.hm[1] + Math.sin(a) * r; let ok = true; for (let q = 0; q <= 8; q++) if (!W.water(b.x + (x - b.x) * q / 8, b.z + (z - b.z) * q / 8)) ok = false; if (ok) { b.tx = x; b.tz = z; break } } }
      else { const w = Math.atan2(dz, dx); b.h += Math.atan2(Math.sin(w - b.h), Math.cos(w - b.h)) * Math.min(1, dt * .9); b.v += ((b.m == "sailBoat" ? .011 : .008) - b.v) * dt * .5 }
    }
    const nx = b.x + Math.cos(b.h) * b.v * dt, nz = b.z + Math.sin(b.h) * b.v * dt; if (W.water(nx, nz)) { b.x = nx; b.z = nz } else { b.h += dt * 1.2; b.v *= .9 }
  }
  for (const s of W.ships) s.a += s.d * dt * .004;
  for (const p of W.people) {
    if (p.pau > 0) { p.pau -= dt; p.mv = 0; continue }
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    if (d < .002) {
      p.pau = Math.random() < .5 ? 0 : 1 + Math.random() * 6; let x, z;
      for (let n = 0; n < 10; n++) { const near = W.paths.filter(q => q.ty != "rail" && (q.a == p.s.id || q.b == p.s.id)); if (near.length && Math.random() < .7) { const q = near[Math.floor(Math.random() * near.length)], s = (q.a == p.s.id ? 0 : q.len) + (q.a == p.s.id ? 1 : -1) * Math.random() * Math.min(.09, q.len), a = pathAt(q, s, 1, (Math.random() < .5 ? 1 : -1) * .0075); x = a.x; z = a.z } else { const a = Math.random() * 6.28, r = Math.random() * .06; x = p.s.x + Math.cos(a) * r; z = p.s.z + Math.sin(a) * r } if (ghLand(x, z) > seaY() + .001 && !W.bld.some(b => Math.hypot(b.x - x, b.z - z) < b.r * .8)) { p.tx = x; p.tz = z; break } }
    } else { const w = Math.atan2(dz, dx); p.h += Math.atan2(Math.sin(w - p.h), Math.cos(w - p.h)) * Math.min(1, dt * 5); p.x += Math.cos(p.h) * .0026 * dt; p.z += Math.sin(p.h) * .0026 * dt; p.mv = 1; p.ph += dt * 7 }
  }
}

// Instances for this frame. Returns { props: {mesh: [12 floats per instance]}, imp, fx, fxr }
export function worldDraw(V, night, emis) {
  const W = S.W, out = { props: {}, imp: [], fx: [], fxr: [] }; if (!W || !W.on) return out;
  const TM = S.TM, sy = seaY(), bOn = $("bld").checked, add = (m, x, y, z, h, pit, roll, tint, seed, sc = 1) => (out.props[m] || (out.props[m] = [])).push(x, y, z, MU * sc, h, pit, roll, 0, tint[0], tint[1], tint[2], seed);
  const lamp = night > .25 || $("wx").value != "off", le = emis * 5;
  if (bOn) {
    for (const b of W.bld) {
      add(b.m, b.x, b.y, b.z, b.h, 0, 0, b.tint, b.seed);
      if (b.mill) { const c = Math.cos(b.h), s = Math.sin(b.h); add("sails", b.x + c * 2.9 * MU, b.y + 11.6 * MU, b.z + s * 2.9 * MU, b.h, 0, TM * (.5 + 1.2 * +$("wi").value * ($("wx").value == "off" ? .3 : 1)) + b.seed * 6, [1, 1, 1], 0) }
      if (b.m == "lighthouse" && night > .2) { const a = TM * .8, o = [b.x, b.y + 14.3 * MU, b.z], e = emis * night; out.fxr.push([o, [o[0] + Math.cos(a) * .3, o[1] - .004, o[2] + Math.sin(a) * .3], 7, [e * 1.2, e * 1.1, e * .8, 1]]); out.fx.push(o[0], o[1], o[2], .004, e * 8, e * 7, e * 5, 1, 3) }
    }
    let n = 0; const f = V.focus, c = V.pos;
    for (const p of W.people) { if (n >= 44) break; if (Math.min(Math.hypot(p.x - f[0], p.z - f[2]), Math.hypot(p.x - c[0], p.z - c[2])) > .32) continue; n++; out.imp.push(p.x, gh(p.x, p.z), p.z, .0011, p.h, 9, p.ph, 0, 0, 0, 0, p.seed) }
  }
  if (!$("tpr").checked) return out;
  const head = (a, len, y) => { if (lamp) out.fx.push(a.x + Math.cos(a.h) * len, a.y + y, a.z + Math.sin(a.h) * len, .0011, le, le * .9, le * .7, 1, 3) };
  for (const c of W.cars) { if (!$(c.m == "bus" ? "tb" : "tc").checked) continue; const a = pathAt(c.p, c.s, c.d, c.p.ty == "road" ? .0029 : 0); add(c.m, a.x, a.y + .0001, a.z, a.h, a.pit, 0, c.tint, 0); head(a, c.m == "bus" ? .0112 : .0045, .0017) }
  if ($("tn").checked) for (const t of W.trains) for (let i = 0; i < 5; i++) { const s = t.s - t.d * i * .0395; if (s < 0 || s > t.p.len) continue; const a = pathAt(t.p, s, t.d, 0); add(i ? "carriage" : "loco", a.x, a.y + .0004, a.z, a.h, a.pit, 0, i ? [.85, .86, .88] : t.tint, i); if (!i) head(a, .0172, .0034) }
  if ($("tbt").checked) {
    for (const b of W.boats) add(b.m, b.x, sy + Math.sin(TM * 1.3 + b.seed) * .0002, b.z, b.h, Math.sin(TM * 1.1 + b.seed) * .04, Math.sin(TM * .9 + b.seed * 2) * .06, b.tint, b.seed);
    const R = $("ring").checked ? 2.1 : 1;
    for (const s of W.ships) { const r = s.r * R, x = Math.cos(s.a) * r, z = Math.sin(s.a) * r; add("ship", x, sy + Math.sin(TM * .5 + s.seed) * .0004, z, s.a + s.d * Math.PI / 2, Math.sin(TM * .4 + s.seed) * .012, Math.sin(TM * .33) * .02, s.tint, s.seed) }
  }
  if ($("tpl").checked) for (const p of W.planes) {
    if (p.m == "airliner") {
      const u = ((TM + p.t0) % p.T) / p.T * 2 - 1, c = Math.cos(p.a), s = Math.sin(p.a), y = Math.max(.75, +$("ch").value + +$("ct").value + .12), x = c * u * 3.2 - s * p.off, z = s * u * 3.2 + c * p.off;
      add(p.m, x, y, z, p.a, .02, 0, p.tint, 0); for (const w of [-1, 1]) out.fxr.push([[x - c * .03 - s * w * .012, y, z - s * .03 + c * w * .012], [x - c * .75 - s * w * .012, y, z - s * .75 + c * w * .012], 3, [.5, .5, .52, 1].map((v, i) => i < 3 ? v * emis * (1 - night * .9) * ($("wx").value == "off" ? .8 : .08) : v)])
    } else { const a = TM * .09, r = .3, x = Math.cos(a) * r, z = Math.sin(a) * r; let g = 0; for (let q = 0; q < 6; q++) g = Math.max(g, gh(Math.cos(a + q * .2) * r, Math.sin(a + q * .2) * r)); p.y = (p.y || g + .1) + (g + .1 - (p.y || g + .1)) * .01; add(p.m, x, p.y, z, a + Math.PI / 2, 0, .35, p.tint, 0) }
  }
  return out
}
