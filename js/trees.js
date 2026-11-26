// Trees: three procedural skeleton generators (L-system, space colonisation, spline tubes),
// turned into real meshes (round branches + leaf cards) at two levels of detail.
import { S, $ } from './state.js';
import { mulberry, hh, vn, gh, outside } from './terrain.js';

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  vnorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }, vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  vrot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), x = vcross(k, v), d = vdot(k, v) * (1 - c); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d] };

// 1) L-system: stochastic string rewriting + 3D turtle (segment=[ax,ay,az,bx,by,bz,r0,r1])
function lsys(R) {
  const rules = ["F[&+F][&-F]", "FF[&+F][&-F][&/F]", "F[&+F]F[&-F]"]; let s = "F";
  for (let n = 0; n < 4; n++) s = s.replace(/F/g, () => rules[Math.floor(R() * 3)]);
  const segs = [], leaves = [], st = []; let p = [0, 0, 0], H = [0, 1, 0], L = [-1, 0, 0], U = [0, 0, 1], d = 0;
  const rt = (k, a) => { H = vrot(H, k, a); L = vrot(L, k, a); U = vrot(U, k, a) };
  for (const ch of s) {
    if (ch == "F") { const q = vadd(p, vmul(H, .1 * Math.pow(.82, d))), r = .03 * Math.pow(.62, d); segs.push([...p, ...q, r, r * .8]); p = q; H = vnorm(vadd(H, [0, .06, 0])) }
    else if (ch == "[") { st.push([p, H, L, U, d]); d++ }
    else if (ch == "]") { leaves.push(p); [p, H, L, U, d] = st.pop() }
    else { const a = (.35 + R() * .45) * (.85 + .3 * R()); if (ch == "+") rt(U, a * 1.2); else if (ch == "-") rt(U, -a * 1.2); else if (ch == "&") rt(L, a); else rt(H, 2.4 + .4 * (R() - .5)) }
  }
  leaves.push(p); return { segs, leaves }
}
// 2) Space colonisation: attraction points in a canopy ellipsoid pull nodes toward them
function scol(R) {
  const nodes = [{ p: [0, 0, 0], par: -1 }], pts = [], segs = [], leaves = [];
  for (let i = 0; i < 200; i++) { let q; do { q = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1] } while (vdot(q, q) > 1); pts.push([q[0] * .5, .85 + q[1] * .4, q[2] * .5]) }
  for (let y = .07; y < .5; y += .07) nodes.push({ p: [(R() - .5) * .01, y, (R() - .5) * .01], par: nodes.length - 1 });
  let alive = pts;
  for (let it = 0; it < 60 && alive.length && nodes.length < 380; it++) {
    const acc = new Map();
    for (const q of alive) {
      let bi = -1, bd = .09; for (let i = 0; i < nodes.length; i++) { const n = nodes[i].p, dx = q[0] - n[0], dy = q[1] - n[1], dz = q[2] - n[2], e = dx * dx + dy * dy + dz * dz; if (e < bd) { bd = e; bi = i } }
      if (bi >= 0) acc.set(bi, vadd(acc.get(bi) || [0, 0, 0], vnorm(vsub(q, nodes[bi].p))))
    }
    if (!acc.size) break; const nw = [];
    for (const [i, v] of acc) { const n = { p: vadd(nodes[i].p, vmul(vnorm(vadd(vnorm(v), [(R() - .5) * .1, 0, (R() - .5) * .1])), .05)), par: i }; nodes.push(n); nw.push(n.p) }
    alive = alive.filter(q => !nw.some(n => { const dx = q[0] - n[0], dy = q[1] - n[1], dz = q[2] - n[2]; return dx * dx + dy * dy + dz * dz < .0049 }))
  }
  const cnt = nodes.map(() => 1); for (let i = nodes.length - 1; i > 0; i--) cnt[nodes[i].par] += cnt[i];
  const rad = i => .003 + .0028 * Math.sqrt(cnt[i]);
  for (let i = 1; i < nodes.length; i++) { segs.push([...nodes[nodes[i].par].p, ...nodes[i].p, rad(nodes[i].par), rad(i)]); if (cnt[i] == 1) leaves.push(nodes[i].p) }
  return { segs, leaves }
}
// 3) Spline tubes: Catmull-Rom paths, circular cross-sections tapered base to tip
function spl(R) {
  const segs = [], leaves = [];
  const crm = (a, b, c, d, t) => b.map((_, i) => .5 * (2 * b[i] + (c[i] - a[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * t * t * t));
  function br(o, dir, len, r0, lvl) {
    const cps = [o], n = lvl ? 4 : 6; let p = o, d = dir;
    for (let i = 0; i < n; i++) { d = vnorm(vadd(d, [(R() - .5) * .8, .1 + (lvl ? 0 : .12), (R() - .5) * .8])); p = vadd(p, vmul(d, len / n)); cps.push(p) }
    const P = [cps[0], ...cps, cps[n]], pts = [], rr = u => r0 * (1 - .9 * u);
    for (let i = 0; i < n; i++) for (let m = 0; m < 3; m++) pts.push(crm(P[i], P[i + 1], P[i + 2], P[i + 3], m / 3)); pts.push(cps[n]);
    for (let i = 1; i < pts.length; i++) segs.push([...pts[i - 1], ...pts[i], rr((i - 1) / (pts.length - 1)), rr(i / (pts.length - 1))]);
    if (lvl >= 2) for (let i = 2; i <= n; i++) leaves.push(cps[i]);
    if (lvl >= 3) { leaves.push(p); return }
    for (let i = 2; i <= n; i++) if (R() < (lvl ? .6 : .9)) { const ax = vnorm(vcross(d, [R() - .5, R() - .5, R() - .5])), cd = vnorm(vadd(vrot(d, ax, .6 + .5 * R()), [0, .25, 0])); br(cps[i], cd, len * (.5 - .05 * lvl), rr(i / n) * .7, lvl + 1) }
    leaves.push(p)
  }
  br([0, 0, 0], [0, 1, 0], 1.1, .04, 0); return { segs, leaves }
}

// 12 prototype skeletons: 3 algorithms x 4 variants
export function protoGen() {
  S.SK = []; const gens = [lsys, scol, spl];
  for (let k = 0; k < 3; k++) for (let v = 0; v < 4; v++) S.SK.push(gens[k](mulberry(S.sd * 131 + k * 17 + v + 1)));
  S.treeVer++
}
function tk(x, z, i, j) { const m = $("tt").value; let k = +m; if (m == "mixed") { const n = vn(x * 3 + 700, z * 3 + 700); k = n < .42 ? 0 : n < .58 ? 1 : 2 } return k * 4 + Math.floor(hh(i + 7, j + 7) * 4) }
// Placement: jittered grid filtered by height band, slope and a fractal density field
export function treeGen() {
  S.TR = []; const hs = S.hs, sn = S.sea, n = 100, thr = .75 - .4 * $("td").value;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + hh(i, j + 900)) / n - .5, z = (j + hh(i + 900, j)) / n - .5;
    if (outside(x, z, .012)) continue;
    const y = gh(x, z), t = (y / hs - sn) / (1 - sn); if (t < .04 || t > .55) continue;
    if (Math.hypot(gh(x + .01, z) - y, gh(x, z + .01) - y) / .01 / hs > 5) continue;
    const d = .5 * vn(x * 5 + 200, z * 5 + 200) + .3 * vn(x * 10 + 300, z * 10 + 300) + .2 * vn(x * 20 + 400, z * 20 + 400);
    if (d < thr || hh(i + 500, j + 500) > .4 + (d - thr) * 4) continue;
    S.TR.push([x, y, z, (.7 + .6 * hh(i + 2, j + 2)) * (1 - .4 * t), tk(x, z, i, j)])
  }
}

// Mesh for one skeleton, normalised to unit height. Vertex: pos3, normal3, uv2, leafFlag, crownDepth
export function treeMesh(T, k, lod) {
  const R = mulberry(S.sd * 7 + k + 11), out = [];
  let top = .01; for (const s of T.segs) top = Math.max(top, s[1], s[4]); for (const q of T.leaves) top = Math.max(top, q[1]);
  const sc = 1 / top, sides = lod ? 3 : 6;
  const segs = T.segs.slice().sort((a, b) => b[6] - a[6]).slice(0, lod ? 36 : 170);
  for (const s of segs) {
    const a = [s[0], s[1], s[2]], b = [s[3], s[4], s[5]], d = vnorm(vsub(b, a)), u = vnorm(vcross(d, Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), v = vcross(d, u),
      r0 = Math.max(s[6], lod ? .006 : .0035) * (a[1] < .02 ? 1.5 : 1), r1 = Math.max(s[7], lod ? .005 : .003),
      ring = (p, r, i) => { const an = i * 6.2832 / sides, o = [u[0] * Math.cos(an) + v[0] * Math.sin(an), u[1] * Math.cos(an) + v[1] * Math.sin(an), u[2] * Math.cos(an) + v[2] * Math.sin(an)]; return [[p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r], o, i / sides] };
    for (let i = 0; i < sides; i++) {
      const A = ring(a, r0, i), B = ring(b, r1, i), C = ring(a, r0, i + 1), D = ring(b, r1, i + 1);
      for (const [q, vv] of [[A, a[1]], [B, b[1]], [C, a[1]], [C, a[1]], [B, b[1]], [D, b[1]]]) out.push(q[0][0] * sc, q[0][1] * sc, q[0][2] * sc, q[1][0], q[1][1], q[1][2], q[2] * 3, vv * sc * 8, 0, 0)
    }
  }
  // crown centre and radius drive the soft "spherical" leaf normals and the inner-crown darkening
  const cc = [0, 0, 0]; for (const q of T.leaves) { cc[0] += q[0]; cc[1] += q[1]; cc[2] += q[2] } const nl = T.leaves.length || 1; cc[0] /= nl; cc[1] /= nl; cc[2] /= nl;
  let cr = .01; for (const q of T.leaves) cr = Math.max(cr, Math.hypot(q[0] - cc[0], q[1] - cc[1], q[2] - cc[2]));
  const want = lod ? 70 : 230, st = Math.max(1, Math.ceil(T.leaves.length / want)), cards = lod ? 1 : 3, size = top * (lod ? .17 : .1);
  T.leaves.forEach((q0, li) => {
    if (li % st) return;
    for (let c = 0; c < cards; c++) {
      const l = size * (.75 + .5 * R()), q = [q0[0] + (R() - .5) * l * .9, q0[1] + (R() - .5) * l * .7, q0[2] + (R() - .5) * l * .9];
      const e1 = vnorm([R() - .5, (R() - .5) * .6, R() - .5]), e2 = vnorm(vcross(e1, [R() - .5, .6 + R(), R() - .5])), cn = vcross(e1, e2);
      let sn = vnorm([q[0] - cc[0], (q[1] - cc[1]) + cr * .35, q[2] - cc[2]]); sn = vnorm([sn[0] + cn[0] * .35, sn[1] + Math.abs(cn[1]) * .35, sn[2] + cn[2] * .35]);
      const dep = Math.min(1, Math.hypot(q[0] - cc[0], q[1] - cc[1], q[2] - cc[2]) / cr);
      for (const [a, b] of [[1, 1], [-1, 1], [-1, -1], [1, 1], [-1, -1], [1, -1]])
        out.push((q[0] + (e1[0] * a + e2[0] * b) * l) * sc, (q[1] + (e1[1] * a + e2[1] * b) * l) * sc, (q[2] + (e1[2] * a + e2[2] * b) * l) * sc, sn[0], sn[1], sn[2], a * .5 + .5, b * .5 + .5, 1, dep)
    }
  });
  return new Float32Array(out)
}
// Leaf-spray texture: a twig with a dozen leaves, drawn once on a 2D canvas
export function leafCanvas(kind) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), R = mulberry(977 + kind * 31);
  g.translate(128, 128);
  g.strokeStyle = "rgb(120,105,80)"; g.lineWidth = 3; g.lineCap = "round";
  const n = kind == 2 ? 16 : 12;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832 + R() * .5, r0 = 8 + R() * 30, len = (kind == 1 ? 58 : kind == 2 ? 46 : 52) * (.7 + .5 * R()), wd = len * (kind == 2 ? .2 : kind == 1 ? .42 : .32);
    g.save(); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(r0, 0); g.stroke();
    g.translate(r0, 0); g.rotate((R() - .5) * .7);
    const l = 150 + R() * 100 | 0; g.fillStyle = "rgb(" + (l * .93 | 0) + "," + l + "," + (l * .85 | 0) + ")";
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * .3, -wd, len * .75, -wd * .8, len, 0); g.bezierCurveTo(len * .75, wd * .8, len * .3, wd, 0, 0); g.fill();
    g.strokeStyle = "rgba(60,80,40,.55)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * .92, 0); g.stroke();
    g.strokeStyle = "rgb(120,105,80)"; g.lineWidth = 3;
    g.restore()
  }
  return c
}
