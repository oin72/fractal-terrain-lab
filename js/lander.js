// Lander game: fly a thrust-and-gravity craft over the fractal landscape and set it down gently on lit pads.
// Two styles share the same physics: "modern" (quad-thruster craft, full renderer) and "retro"
// (faceted craft, low resolution, flat shading, limited colours).
import { S, $ } from './state.js';
import { gh, ghLand, outside } from './terrain.js';
import { gun, voice } from './audio.js';

const G = .03, THRUST = .06, U_SIZE = .0016, PAD_R = .009, M = 400;   // M: metres per world unit
const HINT = "Lander: hold Space (or ●) to fire the engines · W/S or ↑/↓ tilt forward/back · A/D or ←/→ tilt sideways · drag to look around · R restarts. Land slowly and upright on the lit pad.";
let setZoom = () => { }, onStyle = () => { }, hint0 = "";
export const bindLander = (zoomFn, styleFn) => { setZoom = zoomFn; onStyle = styleFn };
const seaY = () => S.sea * S.hs;
const slopeAt = (x, z) => { const y = gh(x, z), e = .006; return Math.hypot(gh(x + e, z) - y, gh(x, z + e) - y) / e };

// Pads go on the flattest dry spots, spread apart
function makePads() {
  const c = []; for (let k = 0; k < 2500; k++) { const x = Math.random() * .84 - .42, z = Math.random() * .84 - .42; if (outside(x, z, .05) || ghLand(x, z) < seaY() + .006) continue; if (S.TR && $("tr").checked && S.TR.some(t => Math.hypot(t[0] - x, t[2] - z) < .035)) continue; let s = slopeAt(x, z); for (let a = 0; a < 6.28; a += 1.05) s = Math.max(s, slopeAt(x + Math.cos(a) * PAD_R, z + Math.sin(a) * PAD_R)); c.push([x, z, s]) }
  c.sort((a, b) => a[2] - b[2]); const pads = [];
  for (const p of c) { if (pads.length >= 6) break; if (pads.every(q => Math.hypot(q.x - p[0], q.z - p[1]) > .16)) pads.push({ x: p[0], z: p[1], y: gh(p[0], p[1]) }) }
  if (!pads.length) pads.push({ x: 0, z: 0, y: gh(0, 0) });
  return pads
}
function spawn(L, pad) { Object.assign(L, { x: pad.x, z: pad.z, y: pad.y, vx: 0, vy: 0, vz: 0, tf: 0, tr: 0, thr: 0, fuel: 100, state: "landed", onPad: true, t: 0, msg: "", msgT: 0 }) }
export function startLander() {
  if (!S.Hn) return;
  const pads = makePads(), L = S.LD = { pads, home: 0, target: pads.length > 1 ? 1 : 0, score: 0, crashes: 0, parts: [] };
  spawn(L, pads[0]); L.msg = "Take off, then land on the lit pad"; L.msgT = S.TM + 4;
  S.LAND = true; S.fly = true; S.cam = { x: L.x, y: L.y, z: L.z, yaw: Math.atan2(pads[L.target].x - L.x, pads[L.target].z - L.z), pit: .32 };
  S.stopLander = stopLander; setZoom(1); hint0 = $("hint").textContent; $("hint").textContent = HINT;
  $("lb").textContent = "■ Stop lander"; $("pad").style.display = "flex"; onStyle()
}
export function stopLander() {
  if (!S.LAND) return; S.LAND = false; S.fly = false; S.FX = null; S.FXR = null; S.stopLander = null;
  $("lb").textContent = "🚀 Lander"; $("pad").style.display = "none"; $("hud").textContent = ""; $("hint").textContent = hint0; setZoom(1); onStyle()
}
export const retro = () => S.LAND && $("lm").value == "retro";

// Craft axes, built the same way as the creature vertex shader so effects line up with the model
function axes(L) {
  const th = S.cam.yaw, ex = [Math.sin(th), 0, Math.cos(th)], ez = [-Math.cos(th), 0, Math.sin(th)], p = -L.tf, r = -L.tr, cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
  const X = [ex[0] * cp, sp, ex[2] * cp], y2 = [-ex[0] * sp, cp, -ex[2] * sp];
  return { X, Y: [y2[0] * cr + ez[0] * sr, y2[1] * cr, y2[2] * cr + ez[2] * sr], Z: [ez[0] * cr - y2[0] * sr, -y2[1] * sr, ez[2] * cr - y2[2] * sr] }
}
function burst(L, n, col, sp, life, size, kind) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, v = sp * (.3 + Math.random()); L.parts.push({ x: L.x, y: L.y + U_SIZE, z: L.z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, l: life * (.5 + Math.random()), m: life, c: col, s: size * (.5 + Math.random()), k: kind }) } }

export function landerTick(dt) {
  const L = S.LD, k = S.keys, TM = S.TM, cam = S.cam, rt = retro();
  if (k.r) { k.r = 0; spawn(L, L.pads[L.home]); L.score = 0; L.crashes = 0 }
  const tgt = L.pads[L.target];
  if (L.state == "crash") { if (TM > L.t) spawn(L, L.pads[L.home]) }
  else {
    // tilt: keys lean the craft, and it levels itself when they are released
    const kf = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), kr = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), on = (k[" "] || S.HU.btn) && L.fuel > 0;
    L.tf += (kf * .75 - L.tf) * Math.min(1, dt * (kf ? 2.2 : 3)); L.tr += (kr * .75 - L.tr) * Math.min(1, dt * (kr ? 2.2 : 3));
    L.thr += ((on ? 1 : 0) - L.thr) * Math.min(1, dt * 9);
    if (L.state == "landed") {
      L.tf *= .8; L.tr *= .8; if (L.onPad) L.fuel = Math.min(100, L.fuel + dt * 25);
      if (on) { L.state = "fly"; L.vy = .004 }
    }
    if (L.state == "fly") {
      const A = axes(L), T = THRUST * L.thr; L.fuel = Math.max(0, L.fuel - dt * 5.5 * L.thr);
      L.vx += (A.Y[0] * T - L.vx * .12) * dt; L.vy += (A.Y[1] * T - G - L.vy * .12) * dt; L.vz += (A.Y[2] * T - L.vz * .12) * dt;
      L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt;
      const lim = .47; if (Math.abs(L.x) > lim) { L.x = Math.sign(L.x) * lim; L.vx *= -.3 } if (Math.abs(L.z) > lim) { L.z = Math.sign(L.z) * lim; L.vz *= -.3 }
      if (L.y > .7) { L.y = .7; L.vy = Math.min(L.vy, 0) }
      const g = gh(L.x, L.z);
      if (L.y <= g) {
        L.y = g; const hs = Math.hypot(L.vx, L.vz), wet = ghLand(L.x, L.z) < seaY(), tilt = Math.hypot(L.tf, L.tr), sl = slopeAt(L.x, L.z);
        const why = wet ? "Splashdown" : L.vy < -.016 ? "Too fast" : hs > .012 ? "Sliding sideways" : tilt > .3 ? "Not upright" : sl > .45 ? "Ground too steep" : "";
        if (why) {
          L.state = "crash"; L.t = TM + 2.6; L.crashes++; L.msg = why + " — crashed"; L.msgT = TM + 2.6; L.thr = 0; gun(2);
          burst(L, 22, wet ? [.7, .85, 1, 0] : [1, .42, .08, 1], .03, .9, .001, wet ? 0 : 3); burst(L, 12, [.25, .23, .2, 0], .02, 1.4, .0009, 0)
        } else {
          L.state = "landed"; L.vx = L.vy = L.vz = 0; const pi = L.pads.findIndex(p => Math.hypot(p.x - L.x, p.z - L.z) < PAD_R * 1.15); L.onPad = pi >= 0;
          if (pi == L.target) { const soft = Math.max(0, 1 - Math.abs(L.vy) / .016); L.score += 50 + Math.round(soft * 50); L.home = pi; let n; do { n = Math.floor(Math.random() * L.pads.length) } while (n == pi && L.pads.length > 1); L.target = n; L.msg = "Landed! Next pad is lit — take off when ready"; voice(6, 1) }
          else L.msg = L.onPad ? "On a pad, refuelling" : "Safe, but off the pad"; L.msgT = TM + 3.5
        }
      }
    }
  }
  // camera target follows the craft; the view itself is built in main.js
  cam.x = L.x; cam.y = L.y; cam.z = L.z;
  // ---- effects handed to the renderer: engine plumes, dust, debris, pad markers ----
  const fx = S.FX = [], fr = S.FXR = [], A = axes(L), g = gh(L.x, L.z), alt = L.y - g;
  if (L.state != "crash" && L.thr > .03) {
    const jets = rt ? [[0, .45, 0]] : [[.75, .62, 1.05], [.75, .62, -1.05], [-.75, .62, 1.05], [-.75, .62, -1.05]], col = rt ? [1, .55, .12] : [.35, .65, 1], n = rt ? 4 : 6;
    for (const j of jets) for (let i = 0; i < n; i++) {
      const d = (i + Math.random() * .6) * .42 * L.thr + .1, o = [j[0], j[1] - d, j[2]], f = 1 - i / n, e = (rt ? 9 : 16) * L.thr * f * f;
      fx.push(L.x + (A.X[0] * o[0] + A.Y[0] * o[1] + A.Z[0] * o[2]) * U_SIZE, L.y + (A.X[1] * o[0] + A.Y[1] * o[1] + A.Z[1] * o[2]) * U_SIZE, L.z + (A.X[2] * o[0] + A.Y[2] * o[1] + A.Z[2] * o[2]) * U_SIZE, U_SIZE * (rt ? .34 : .3) * (.6 + .5 * f), col[0] * e + e * .25 * f, col[1] * e + e * .25 * f, col[2] * e, 1, 3)
    }
    // exhaust wash kicks up dust or spray close to the ground
    if (alt < .012 && Math.random() < dt * 60 * L.thr) { const a = Math.random() * 6.28, wet = ghLand(L.x, L.z) < seaY(); L.parts.push({ x: L.x + Math.cos(a) * .002, y: g + .0003, z: L.z + Math.sin(a) * .002, vx: Math.cos(a) * .02, vy: .004 + Math.random() * .006, vz: Math.sin(a) * .02, l: .9, m: .9, c: wet ? [.8, .9, 1, 0] : [.5, .44, .34, 0], s: .0016, k: 0 }) }
  }
  for (const p of L.parts) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= .02 * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; const f = Math.max(0, p.l / p.m), e = p.k == 3 ? 7 * f * f : 1; fx.push(p.x, Math.max(p.y, gh(p.x, p.z)), p.z, p.s * (1.8 - f), p.c[0] * e, p.c[1] * e, p.c[2] * e, p.k == 3 ? 1 : Math.min(.7, f), p.k) }
  L.parts = L.parts.filter(p => p.l > 0); if (L.parts.length > 300) L.parts.splice(0, L.parts.length - 300);
  L.pads.forEach((p, i) => {
    const on = i == L.target, pulse = .6 + .4 * Math.sin(TM * 5), c = on ? [.2, 1, .45] : [.55, .6, .7];
    fx.push(p.x, p.y, p.z, PAD_R, .1, .1, .12, .45, 2, p.x, p.y, p.z, PAD_R, c[0], c[1], c[2], on ? .9 : .5, 1);
    for (let a = 0; a < 4; a++) { const an = a * 1.5708 + .785, e = on ? 8 * pulse : 1.5; fx.push(p.x + Math.cos(an) * PAD_R * .9, p.y + .0005, p.z + Math.sin(an) * PAD_R * .9, .0006, c[0] * e, c[1] * e, c[2] * e, 1, 3) }
    if (on) fr.push([[p.x, p.y, p.z], [p.x, p.y + .22, p.z], 2.5, [.2 * pulse * 5, 1 * pulse * 5, .45 * pulse * 5, 1]])
  });
  // ---- heads-up display ----
  const dx = tgt.x - L.x, dz = tgt.z - L.z, rel = Math.atan2(dx, dz) - cam.yaw, ar = "↑↗→↘↓↙←↖"[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
  const tx = (TM < L.msgT ? L.msg + "\n" : "") + "Score " + L.score + "  ·  Crashes " + L.crashes + "  ·  Fuel " + Math.round(L.fuel) + "%\nAltitude " + Math.max(0, alt * M).toFixed(0) + " m  ·  " + (L.vy > 0 ? "Climb " : "Descent ") + Math.abs(L.vy * M).toFixed(1) + " m/s  ·  Drift " + (Math.hypot(L.vx, L.vz) * M).toFixed(1) + " m/s\nPad " + ar + " " + (Math.hypot(dx, dz) * M).toFixed(0) + " m" + (L.fuel <= 0 ? "  ·  OUT OF FUEL" : "");
  if ($("hud").textContent != tx) $("hud").textContent = tx
}
// Instance for the creature renderer: position+size, heading/kind/phase/state, roll/pitch/throttle/gear
export function landerInstance() {
  const L = S.LD; if (!S.LAND || L.state == "crash") return null; const alt = L.y - gh(L.x, L.z), gear = Math.max(0, Math.min(1, (.05 - alt) / .025));
  return [L.x, L.y, L.z, U_SIZE, Math.PI / 2 - S.cam.yaw, retro() ? 30 : 31, 0, 0, -L.tr, -L.tf, L.thr, L.state == "landed" ? 1 : gear]
}
export const landerSize = U_SIZE;
