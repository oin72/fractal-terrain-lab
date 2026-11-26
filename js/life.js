// Game logic ported from the original lab: animals and birds, the hunter (walk / hunt), craft flight,
// tornado capture, footstep particles. Rendering is separate; this file only fills state.
import { S, $ } from './state.js';
import { gh, surf, outside } from './terrain.js';
import { gun, voice, animCall } from './audio.js';

// Animals: wander, predators chase prey, tornado lifts and throws them; death mode makes kills permanent until a random respawn
export const AT = [
  { sp: .022, au: .0029, mh: 1.15, pal: [[.85, .8, .72], [1, 1, 1], [.4, .33, .28]] },
  { sp: .03, au: .0036, mh: 2.6, pal: [[.63, .44, .25], [.9, .82, .7], [.25, .17, .1]] },
  { sp: .038, au: .0034, mh: 1.3, pred: [0], pal: [[.85, .45, .16], [1, 1, 1], [.2, .12, .08]] },
  { sp: .042, au: .0042, mh: 1.9, pred: [0, 1], pal: [[.43, .45, .5], [.8, .82, .85], [.12, .13, .15]] },
  { sp: .06, au: .002, mh: 1.2, fly: 1, alt: [.05, .12], pred: [0], circ: 1, pal: [[.42, .3, .2], [.88, .82, .7], [.18, .13, .09]] },
  { sp: .05, au: .0018, mh: 1.6, fly: 1, alt: [.09, .22], pred: [0, 2], circ: 1, pal: [[.3, .19, .11], [.95, .94, .92], [.12, .08, .05]] },
  { sp: .035, au: .0016, mh: .8, fly: 1, alt: [.003, .02], pal: [[.45, .36, .28], [.93, .42, .18], [.14, .1, .08]] },
  { sp: .07, au: .008, mh: 5, fly: 1, alt: [.12, .3], pred: [1, 3], pal: [[.4, .12, .1], [.62, .24, .13], [.14, .06, .05]] }];
export const HUNTER_PAL = [[.35, .42, .25], [.9, .45, .1], [.18, .14, .1]];
// Craft: distinct flight styles (speed, cruise height, bob, turn rate, bank, sway) and world size
export const CRAFT = [
  { sp: 1, cl: .07, aa: 0, ap: 1, tg: 1, bk: .5, sw: 0, cu: .012, pal: [[.92, .93, .95], [.85, .2, .18], [.2, .22, .26]] },
  { sp: 2.2, cl: .2, aa: .04, ap: 2.2, tg: 2.2, bk: .25, sw: 0, dash: 1, cu: .011, pal: [[.62, .66, .74], [.25, .8, .9], [.25, .28, .34]] },
  { sp: .22, cl: .16, aa: .08, ap: 11, tg: .25, bk: 0, sw: .12, cu: .009, pal: [[.85, .25, .2], [.95, .78, .2], [.5, .33, .2]] },
  { sp: 1.6, cl: .13, aa: .1, ap: 7, tg: 1.3, bk: .7, sw: 0, cu: .004, pal: [[.12, .28, .7], [.8, .15, .12], [.1, .1, .12]] },
  { sp: .45, cl: .11, aa: .015, ap: 3.5, tg: .35, bk: .08, sw: .22, cu: .012, pal: [[.42, .27, .15], [.93, .88, .75], [.1, .1, .1]] },
  { sp: .85, cl: .15, aa: .07, ap: 14, tg: .55, bk: .6, sw: 0, circ: 1, cu: .003, pal: [[.36, .23, .13], [.96, .95, .92], [.15, .1, .06]] },
  { sp: 1.1, cl: .14, aa: .08, ap: 9, tg: .6, bk: .8, sw: 0, cu: .008, pal: [[.4, .13, .1], [.6, .22, .12], [.14, .06, .05]] }];
export const WPN = [
  { n: "Pistol", rng: .4, cd: .45, spr: .012, pel: 1, pal: [[.25, .25, .28], [.7, .6, .3], [.15, .15, .18]] }, { n: "Rifle", rng: 1.6, cd: 1, spr: .003, pel: 1, pal: [[.45, .3, .18], [.7, .6, .3], [.18, .19, .22]] },
  { n: "Shotgun", rng: .3, cd: .9, spr: .06, pel: 7, pal: [[.4, .26, .15], [.7, .6, .3], [.2, .2, .24]] }, { n: "Bow", rng: 2, cd: .8, spr: .006, pel: 1, proj: 1, spd: .9, pal: [[.5, .33, .15], [.9, .9, .85], [.3, .3, .3]] },
  { n: "Machine gun", rng: .8, cd: .09, spr: .03, pel: 1, pal: [[.22, .25, .2], [.6, .5, .2], [.12, .13, .15]] }];
const HINT0 = "Drag to look · wheel or pinch to zoom · Fly: autopilot follows the terrain; ←/→ steer, ↑/↓ speed, or drag to take over";
let setZoom = () => { };
export const bindZoom = f => setZoom = f;
const seaY = () => S.sea * S.hs;

function placeAn(a) {
  const sy = seaY(); for (let k = 0; k < 40; k++) {
    const x = Math.random() - .5, z = Math.random() - .5;
    if (outside(x, z, .04)) continue; if (gh(x, z) > sy + .012) { a.x = x; a.z = z; a.y = gh(x, z); if (AT[a.t].fly) { a.fh = AT[a.t].alt[0] + Math.random() * (AT[a.t].alt[1] - AT[a.t].alt[0]); a.y += a.fh } return }
  } a.st = "dead"; a.rt = S.TM + 1.5
}
export function animStep(dt) {
  if (!S.Hn || !$("ae").checked) return; const TM = S.TM, AN = S.AN, TW = S.TW, HU = S.HU;
  const N = +$("an").value, on = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => $("a" + i).checked), tot = on.reduce((s, i) => s + +$("p" + i).value, 0) || 1, dm = $("dm").checked, sy = seaY();
  for (let i = 0; i < 8; i++) {
    const sh = on.includes(i) ? +$("p" + i).value / tot : 0, tx = on.includes(i) ? Math.round(sh * 100) + "%" : "off"; if ($("q" + i).textContent != tx) $("q" + i).textContent = tx;
    const l = AN.filter(a => a.t == i), want = Math.round(N * sh);
    while (l.length > want) AN.splice(AN.indexOf(l.pop()), 1);
    while (l.length < want) { const a = { id: S.AID++, t: i, st: "alive", h: Math.random() * 6.28, x: 0, z: 0, y: 0, mv: 1, pau: 0, stun: 0, eat: 0, rt: 0 }; placeAn(a); AN.push(a); l.push(a) }
  }
  const al = AN.filter(a => a.st == "alive");
  for (const a of AN) {
    if (a.st == "dead") { if (a.fh > 0) { a.fh = Math.max(0, a.fh - .25 * dt); a.y = gh(a.x, a.z) + a.fh } if (TM >= a.rt) { a.st = "alive"; placeAn(a) } continue }
    if (a.st == "carried") {
      if (!TW || TW[4] < .2 || TM > a.cT || a.cy > TW[3] - TW[2]) { const g = Math.random() * 6.28, s = .15 + Math.random() * .45; a.vx = Math.cos(g) * s; a.vz = Math.sin(g) * s; a.vy = .08 + Math.random() * .25; a.st = "thrown"; continue }
      a.ca += dt * (4 + 3 * (1 - a.cr / .09)); a.cr = Math.max(.012, a.cr - dt * .02); a.cy += dt * .1; a.x = TW[0] + Math.cos(a.ca) * a.cr; a.z = TW[1] + Math.sin(a.ca) * a.cr; a.y = gh(a.x, a.z) + a.cy; continue
    }
    if (a.st == "thrown") {
      a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt; a.vy -= .7 * dt;
      if (outside(a.x, a.z, .02) || a.y <= gh(a.x, a.z)) {
        let g = 0; while (outside(a.x, a.z, .03) && g++ < 200) { a.x *= .95; a.z *= .95 } a.y = gh(a.x, a.z);
        if (dm) { a.st = "dead"; a.rt = TM + 3 + Math.random() * 10 } else { a.st = "alive"; a.stun = TM + 1; if (a.y <= sy + .004) placeAn(a) }
      } continue
    }
    const T = AT[a.t]; let sp = T.sp, tgt = null, bd = 1e9;
    if (TW && TW[4] > .3) { const dx = a.x - TW[0], dz = a.z - TW[1]; if (dx * dx + dz * dz < .0081) { a.st = "carried"; a.ca = Math.atan2(dz, dx); a.cr = Math.hypot(dx, dz); a.cT = TM + 2 + Math.random() * 3; a.cy = 0; continue } }
    if (TM < a.stun) { a.mv = 0; continue }
    if (HU.on) { const dx = a.x - HU.x, dz = a.z - HU.z; if (dx * dx + dz * dz < .0036) { a.pau = 0; a.fear = TM + 1 } }
    if (T.fly) { birdStep(a, T, dt, al, dm); continue }
    if (T.pred) {
      for (const b of al) { if (b.st != "alive" || !T.pred.includes(b.t)) continue; const d = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d < bd) { bd = d; tgt = b } }
      if (tgt && bd < .0036) {
        a.h = Math.atan2(tgt.z - a.z, tgt.x - a.x); sp *= 1.8;
        if (bd < .000025) { a.stun = TM + 1.6; a.eat = TM + 1.6; if (dm) { tgt.st = "dead"; tgt.rt = TM + 4 + Math.random() * 10 } else tgt.h += 3.14; continue }
      } else tgt = null
    } else {
      for (const b of al) { if (b.st != "alive" || !AT[b.t].pred || !AT[b.t].pred.includes(a.t)) continue; const d = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d < bd) { bd = d; tgt = b } }
      if (tgt && bd < .0016) { a.h = Math.atan2(a.z - tgt.z, a.x - tgt.x); sp *= 2.1 } else tgt = null
    }
    if (!tgt) {
      // herds and packs: steer towards the group, match its heading, keep a body length apart
      if (a.t == 1 || a.t == 3) { let cx = 0, cz = 0, hx = 0, hz = 0, n = 0; for (const b of al) { if (b === a || b.t != a.t) continue; const d2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d2 < .02) { cx += b.x; cz += b.z; hx += Math.cos(b.h); hz += Math.sin(b.h); n++; if (d2 < .00012) a.h += Math.sin(Math.atan2(a.z - b.z, a.x - b.x) - a.h) * dt * 2 } } if (n) { a.h += Math.sin(Math.atan2(cz / n - a.z, cx / n - a.x) - a.h) * dt * .6; a.h += Math.sin(Math.atan2(hz, hx) - a.h) * dt * .7 } }
      // wandering is a slowly drifting turn rate, not a jitter
      a.wv = (a.wv || 0) * (1 - Math.min(1, dt * 1.2)) + (Math.random() - .5) * dt * 5; a.h += a.wv * dt * 1.4; if (TM > a.pau && Math.random() < dt * .25) a.pau = TM + 1 + Math.random() * (a.t == 1 ? 7 : a.t == 2 ? 2 : 3); if (TM < a.pau) { a.mv = 0; a.v = 0; a.gz = a.t < 2 && Math.sin(TM * .6 + a.id * 2.3) > -.4 ? 1 : 0; a.y = gh(a.x, a.z); continue }
    }
    a.mv = 1; a.gz = 0; if (a.fear > TM && HU.on) { a.h = Math.atan2(a.z - HU.z, a.x - HU.x); sp *= 2 } else if (!tgt) sp *= .42;
    a.v = (a.v || 0) + (sp - (a.v || 0)) * Math.min(1, dt * 2.5); sp = a.v; if (a.t) a.ph = (a.ph || 0) + dt * (2 + 170 * sp);
    if (a.t == 0) sp *= 2.2 * Math.max(0, Math.sin(TM * 8 + a.id * 3)); else if (a.t == 2 && tgt) sp *= bd > .0004 ? .55 : 1.5;
    const nx = a.x + Math.cos(a.h) * sp * dt, nz = a.z + Math.sin(a.h) * sp * dt;
    const W = S.W; if (outside(nx, nz, .03) || gh(nx, nz) <= sy + .01 || (W && W.on && W.bld.some(b => (b.x - nx) ** 2 + (b.z - nz) ** 2 < b.r * b.r))) { a.h += (a.wv > 0 ? 1 : -1) * (1.2 + Math.random()); a.v *= .5 } else { a.x = nx; a.z = nz }
    a.y = gh(a.x, a.z); { const fy = gh(a.x + Math.cos(a.h) * .004, a.z + Math.sin(a.h) * .004); a.pt = (a.pt || 0) + (Math.max(-.55, Math.min(.55, Math.atan((fy - a.y) / .004) * .85)) - (a.pt || 0)) * Math.min(1, dt * 5) } if (a.y <= sy + .006) placeAn(a); animCall(a)
  }
}
// Birds (hawk, eagle, robin, dragon): flying animals with their own altitude bands; hawk/eagle/dragon stoop on prey
function birdStep(a, T, dt, al, dm) {
  const TM = S.TM, h0 = a.h; a.fh = a.fh || 0; let tg = null, bd = 1e9, sp = T.sp;
  if (T.pred) for (const b of al) { if (b.st != "alive" || !T.pred.includes(b.t)) continue; const d = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d < bd) { bd = d; tg = b } }
  if (tg && bd < .01) {
    const w = Math.atan2(tg.z - a.z, tg.x - a.x); a.h += Math.atan2(Math.sin(w - a.h), Math.cos(w - a.h)) * Math.min(1, dt * 3); sp *= 1.8; a.fh = Math.max(.002, a.fh - (.04 + Math.sqrt(bd) * .5) * dt);
    if (bd < .00015 && a.fh < .012) { a.stun = TM + 3; a.eat = TM + 2; if (dm) { tg.st = "dead"; tg.dd = TM; tg.mv = 0; tg.rt = TM + 4 + Math.random() * 10; voice(tg.t, .9, 1) } }
  } else { a.h += (Math.sin(TM * .3 + a.id) * .4 + (T.circ ? (a.id % 2 ? .5 : -.5) : (Math.random() - .5) * .8)) * dt; const alt = T.alt[0] + (T.alt[1] - T.alt[0]) * (.5 + .5 * Math.sin(TM * .15 + a.id * 2)); a.fh += (alt - a.fh) * Math.min(1, dt * .8) }
  const nx = a.x + Math.cos(a.h) * sp * dt, nz = a.z + Math.sin(a.h) * sp * dt;
  if (outside(nx, nz, .03)) a.h = Math.atan2(-a.z, -a.x) + (Math.random() - .5) * .8; else { a.x = nx; a.z = nz }
  // raptors soar on fixed wings and only flap to chase; small birds flap in bursts; all bank into their turns
  a.gl = tg && bd < .01 ? 0 : T.circ ? (Math.sin(TM * .5 + a.id * 1.7) > .75 ? 0 : 1) : a.t == 6 ? (Math.sin(TM * 3.1 + a.id) > .2 ? 0 : 1) : 0;
  const dh = Math.atan2(Math.sin(a.h - h0), Math.cos(a.h - h0)) / Math.max(dt, .004); a.bk = (a.bk || 0) + (Math.max(-.8, Math.min(.8, dh * .9)) - (a.bk || 0)) * Math.min(1, dt * 3);
  a.mv = 1; a.y = gh(a.x, a.z) + a.fh; animCall(a)
}

// ---------- Fly-through ----------
export function zoomCraft() { setZoom(.0084 / CRAFT[+$("cr").value].cu) }
export function toggleFly() {
  if (!S.Hn) return; if (S.GAME && S.stopGame) S.stopGame(); if (S.LAND && S.stopLander) S.stopLander(); if (S.HUNT) { stopHunt(); return } S.fly = !S.fly; $("fb").textContent = S.fly ? "■ Stop flying" : "✈ Fly through";
  if (S.fly) { S.cam = { x: 0, z: -.3, yaw: 0, pit: .2, y: gh(0, -.3) + .09 }; zoomCraft() } else setZoom(1)
}
// Tornado vs craft: suction inside 0.25, capture inside 0.07, spiral up the funnel, then ejected in a random direction
function moveCraft(c, dt, sp, t) {
  const TW = S.TW, T = TW && TW[4] > .3 ? TW : null; c.tw = c.tw || 0;
  if (c.tw == 0 && T && t > (c.cd || 0)) {
    const dx = T[0] - c.x, dz = T[1] - c.z, d = Math.hypot(dx, dz) || 1e-3;
    if (d < .25) { c.x += dx / d * (1 - d / .25) * .5 * dt; c.z += dz / d * (1 - d / .25) * .5 * dt }
    if (d < .07) { c.tw = 1; c.ca = Math.atan2(c.z - T[1], c.x - T[0]); c.cr = Math.max(d, .03); c.t0 = t; c.tE = t + 3500 + Math.random() * 2500 }
  }
  if (c.tw == 1) {
    if (!T || t > c.tE) { const g = Math.random() * 6.283, v = .25 + Math.random() * .3; c.vx = Math.cos(g) * v; c.vz = Math.sin(g) * v; c.tw = 2; c.tE = t + 2200; c.cd = t + 9000; c.yaw = Math.atan2(c.vx, c.vz) }
    else { c.ca += dt * (4 + .2 / c.cr); c.cr = Math.max(.015, c.cr - dt * .012); c.x = T[0] + Math.cos(c.ca) * c.cr; c.z = T[1] + Math.sin(c.ca) * c.cr; c.yaw = -c.ca; c.bank = Math.atan2(Math.sin(t / 130), Math.cos(t / 130)) }
  }
  else if (c.tw == 2) { const k = Math.pow(.4, dt); c.x += c.vx * dt; c.z += c.vz * dt; c.vx *= k; c.vz *= k; c.bank = Math.atan2(Math.sin(t / 130), Math.cos(t / 130)) * Math.max(0, (c.tE - t) / 2200); if (t > c.tE) c.tw = 0 }
  else { c.x += Math.sin(c.yaw) * sp * dt; c.z += Math.cos(c.yaw) * sp * dt }
}
export function flyTick(dt, t) {
  const keys = S.keys, cr = CRAFT[+$("cr").value], sp = +$("spd").value * cr.sp, c = S.cam, TW = S.TW;
  let turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); if (turn) S.manual = t;
  if (t - S.manual > 2500) turn = cr.circ ? Math.sign(Math.sin(t / 16000)) * .6 : Math.sin(t / 3000) * .35 + (cr.dash && Math.sin(t / 900) > .85 ? Math.sign(Math.sin(t / 1700)) * 1.5 : 0);
  const r = Math.hypot(c.x, c.z), lm = .36;
  if (r > lm) { let d = Math.atan2(-c.x, -c.z) - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); const k = Math.min(1, (r - lm) * 12); turn = Math.max(-1, Math.min(1, d * 2)) * k + turn * (1 - k) }
  c.yaw += turn * dt * 1.1 * cr.tg; c.bank = (c.bank || 0) + (turn * cr.bk + cr.sw * Math.sin(t / 800) - (c.bank || 0)) * Math.min(1, dt * 4); moveCraft(c, dt, sp, t);
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), top = Math.max(gh(c.x, c.z), gh(c.x + fx * .06, c.z + fz * .06), gh(c.x + fx * .14, c.z + fz * .14));
  const y0 = c.y;
  c.y += ((c.tw == 1 && TW ? TW[2] + (TW[3] - TW[2]) * (.15 + .7 * Math.min(1, (t - c.t0) / 3500)) : top + cr.cl + cr.aa * Math.sin(t / 1000 * 6.283 / cr.ap)) - c.y) * Math.min(1, dt * 3);
  // nose follows the climb or descent (not for the balloon or the ship)
  c.pitch = (c.pitch || 0) + ((cr.bk > .2 && !c.tw ? Math.max(-.5, Math.min(.5, Math.atan2((c.y - y0) / Math.max(dt, .004), sp + .03))) : 0) - (c.pitch || 0)) * Math.min(1, dt * 3)
}

// ---------- Hunter: walk/run on land, swim in water; hitscan weapons and a bow with arrows ----------
function kill(a) { voice(a.t, .9, 1); a.st = "dead"; a.dd = S.TM; a.mv = 0; a.rt = S.TM + 4 + Math.random() * 10; S.HU.kills++ }
function fire() {
  const H = S.HU, Wp = WPN[H.wp]; if (H.walk) return; gun(H.wp); H.cool = Wp.cd; H.flash = .12; H.rec = 1; const O = [H.x, H.y + .0047, H.z];
  for (let i = 0; i < Wp.pel; i++) {
    const a = H.yaw + (Math.random() - .5) * 2 * Wp.spr, b = -(H.pit - H.tilt) + (Math.random() - .5) * 2 * Wp.spr, d = [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)];
    if (Wp.proj) { S.ARR.push({ p: O.slice(), v: d.map(c => c * Wp.spd), t: 6 }); continue }
    let best = null, bt = Wp.rng;
    for (const an of S.AN) {
      if (an.st != "alive") continue; const T = AT[an.t], P = [an.x - O[0], an.y + T.au * T.mh * .5 - O[1], an.z - O[2]], t = P[0] * d[0] + P[1] * d[1] + P[2] * d[2];
      if (t <= 0 || t > bt) continue; if (P[0] * P[0] + P[1] * P[1] + P[2] * P[2] - t * t < Math.pow(Math.max(.004, T.au * T.mh * .7), 2)) { bt = t; best = an }
    }
    let end = bt; for (let s = .01; s < bt; s += .02) if (O[1] + d[1] * s < gh(O[0] + d[0] * s, O[2] + d[2] * s)) { end = s; best = null; break }
    if (best) kill(best); S.TRC.push({ a: O.slice(), b: [O[0] + d[0] * end, O[1] + d[1] * end, O[2] + d[2] * end], t: .12 })
  }
}
export function tryFire() { if (S.HUNT && S.HU.cool <= 0) fire() }
// Footsteps: grass flecks, sand dust + prints, rock chips, water splash + ripple, snow puffs + prints
function emitStep(H, sf) {
  const y = H.y, PTL = S.PTL, mk = (c, n, s, vy) => { for (let i = 0; i < n; i++) PTL.push({ k: 10, x: H.x + (Math.random() - .5) * .006, y, z: H.z + (Math.random() - .5) * .006, vx: (Math.random() - .5) * .012, vy: vy * (.5 + Math.random()), vz: (Math.random() - .5) * .012, l: .7, m: .7, c, s }) },
    ring = (k, l, s) => PTL.push({ k, x: H.x, y, z: H.z, vx: 0, vy: 0, vz: 0, l, m: l, c: null, s });
  if (sf == 0) mk([90, 160, 60], 3, .0008, .012); else if (sf == 1) { mk([222, 204, 158], 4, .0014, .008); ring(12, 9, .0025) }
  else if (sf == 2) mk([130, 125, 118], 2, .0007, .012); else if (sf == 3) { mk([210, 230, 245], 5, .0008, .02); ring(11, 1.4, .003) }
  else { mk([250, 252, 255], 4, .0012, .01); ring(12, 9, .0025) }
  if (PTL.length > 400) PTL.splice(0, PTL.length - 400)
}
// Tornado vs hunter: suction inside 0.12, capture inside 0.04, spiral up, then thrown to a random land spot; parachute opens on the way down
function hFly(H, dt) {
  const TW = S.TW, TM = S.TM, T = TW && TW[4] > .3 ? TW : null, sy = seaY();
  if (!H.tw) {
    if (!T || TM < (H.cd || 0)) return; const dx = T[0] - H.x, dz = T[1] - H.z, d = Math.hypot(dx, dz) || 1e-3;
    if (d < .12) { H.x += dx / d * (1 - d / .12) * .03 * dt; H.z += dz / d * (1 - d / .12) * .03 * dt }
    if (d < .04) { H.tw = 1; H.ca = Math.atan2(H.z - T[1], H.x - T[0]); H.cr = Math.max(d, .015); H.t0 = TM; H.tE = TM + 3 + Math.random() * 2; H.chute = 0 } return
  }
  H.mv = 0;
  if (H.tw == 1) {
    if (!T || TM > H.tE) {
      let tx = 0, tz = 0; for (let k = 0; k < 80; k++) { const a = (Math.random() - .5) * .8, b = (Math.random() - .5) * .8; if (!outside(a, b, .06) && gh(a, b) > sy + .012) { tx = a; tz = b; break } }
      H.f = { x0: H.x, y0: H.y, z0: H.z, x1: tx, z1: tz, y1: gh(tx, tz), pk: .05 + Math.random() * .08, T: 4 + Math.random() * 2, t: 0 }; H.tw = 2; return
    }
    H.ca += dt * (4 + .1 / H.cr); H.cr = Math.max(.012, H.cr - dt * .006); H.x = T[0] + Math.cos(H.ca) * H.cr; H.z = T[1] + Math.sin(H.ca) * H.cr;
    H.y = gh(H.x, H.z) + Math.min((TM - H.t0) * .05, (T[3] - T[2]) * .7); H.yaw = -H.ca; return
  }
  const f = H.f; f.t += dt; const u = Math.min(1, f.t / f.T); H.x = f.x0 + (f.x1 - f.x0) * u; H.z = f.z0 + (f.z1 - f.z0) * u;
  H.y = Math.max(gh(H.x, H.z), f.y0 + (f.y1 - f.y0) * u + f.pk * 4 * u * (1 - u)); H.chute = u > .45 ? Math.min(1, (u - .45) / .1) : 0; H.yaw += dt * .3;
  if (u >= 1) { H.tw = 0; H.chute = 0; H.cd = TM + 10; H.y = gh(H.x, H.z) }
}
export function huntTick(dt) {
  const H = S.HU, k = S.keys, cam = S.cam; H.view = +$("hv").value; H.wp = +$("wp").value;
  const fw = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), st = (k.d ? 1 : 0) - (k.a ? 1 : 0), tn = (k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0), run = k.shift ? 1.8 : 1;
  H.yaw += tn * dt * 2; const sf = surf(H.x, H.z), dd = .006, sl = (gh(H.x + Math.sin(H.yaw) * dd, H.z + Math.cos(H.yaw) * dd) - gh(H.x - Math.sin(H.yaw) * dd, H.z - Math.cos(H.yaw) * dd)) / (2 * dd);
  H.sf = sf; H.sw = sf == 3; H.tilt += (Math.max(-.7, Math.min(.7, Math.atan(sl) * .8)) - H.tilt) * Math.min(1, dt * 6);
  const vx = Math.sin(H.yaw) * fw + Math.cos(H.yaw) * st, vz = Math.cos(H.yaw) * fw - Math.sin(H.yaw) * st, m = Math.hypot(vx, vz) || 1, sp = (H.sw ? .009 : .016 * [1, .8, 1.1, 1, .65][sf]) * run * (fw || st ? 1 : 0) * Math.max(.45, 1 - .3 * Math.max(0, sl)), nx = H.x + vx / m * sp * dt, nz = H.z + vz / m * sp * dt;
  if (!outside(nx, nz, .02)) { H.x = nx; H.z = nz }
  H.mv = (fw || st) ? 1 : 0; H.ph += H.mv ? dt * (H.sw ? 4 : 10) * run : 0; H.y += (gh(H.x, H.z) - H.y) * Math.min(1, dt * 14);
  H.sa = (H.sa || 0) + (H.mv ? dt * (H.sw ? 3 : 5) * run : 0); if (H.sa > 1) { H.sa = 0; emitStep(H, sf) }
  for (const p of S.PTL) { p.l -= dt; if (p.k == 10) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= .02 * dt } } S.PTL = S.PTL.filter(p => p.l > 0); H.cool -= dt; H.flash -= dt; H.rec = Math.max(0, H.rec - dt * 5);
  if ((k[" "] || H.btn) && H.cool <= 0) fire();
  for (const r of S.ARR) {
    r.p[0] += r.v[0] * dt; r.p[1] += r.v[1] * dt; r.p[2] += r.v[2] * dt; r.v[1] -= .9 * dt; r.t -= dt;
    S.TRC.push({ a: r.p.slice(), b: [r.p[0] - r.v[0] * .04, r.p[1] - r.v[1] * .04, r.p[2] - r.v[2] * .04], t: .03 });
    if (r.p[1] < gh(r.p[0], r.p[2])) r.t = 0; else for (const an of S.AN) {
      if (an.st != "alive") continue; const T = AT[an.t];
      if ((an.x - r.p[0]) ** 2 + (an.y + T.au * T.mh * .5 - r.p[1]) ** 2 + (an.z - r.p[2]) ** 2 < Math.pow(Math.max(.005, T.au * T.mh * .7), 2)) { kill(an); r.t = 0; break }
    }
  }
  S.ARR = S.ARR.filter(r => r.t > 0); S.TRC = S.TRC.filter(r => (r.t -= dt) > 0);
  hFly(H, dt); const ey = H.y + .0047, bx = H.x - Math.sin(H.yaw) * .026, bz = H.z - Math.cos(H.yaw) * .026;
  if (H.view == 1) { cam.x = H.x; cam.z = H.z; cam.y = ey + (H.mv && !H.sw ? Math.sin(H.ph * 2) * .0002 : 0); cam.pit = H.pit - H.tilt } else { cam.x = bx; cam.z = bz; cam.y = Math.max(H.y + .0098, gh(bx, bz) + .004); cam.pit = H.pit + .16 - H.tilt }
  cam.yaw = H.yaw;
  // heads-up text
  const sfn = ["grass", "sand", "rock", "water", "snow"][H.sf || 0], tx = H.walk ? "Walkthrough  ·  " + sfn : WPN[H.wp].n + "  ·  Kills: " + H.kills + "  ·  " + sfn;
  if ($("hud").textContent != tx) $("hud").textContent = tx;
  $("cross").style.display = H.walk ? "none" : "block"; $("swim").style.display = H.sw && !H.walk && H.view == 1 ? "block" : "none"
}
export function startHunt(wk) {
  if (!S.Hn) return; if (S.GAME && S.stopGame) S.stopGame(); if (S.LAND && S.stopLander) S.stopLander(); const sy = seaY(), HU = S.HU; let x = 0, z = -.2;
  for (let k = 0; k < 60; k++) { const a = (Math.random() - .5) * .7, b = (Math.random() - .5) * .7; if (!outside(a, b, .06) && gh(a, b) > sy + .012) { x = a; z = b; break } }
  S.HUNT = true; Object.assign(HU, { on: 1, walk: !!wk, x, z, y: gh(x, z), yaw: Math.random() * 6.28, pit: .15, cool: 0, flash: 0, rec: 0, ph: 0, mv: 0, sw: 0, kills: 0, moved: 0, btn: 0, tilt: 0, sf: 0, sa: 0, tw: 0, cd: 0, chute: 0 }); S.PTL = [];
  S.fly = true; S.cam = { x, z, y: HU.y + .02, yaw: HU.yaw, pit: .15 }; setZoom(+$("hv").value ? 1.5 : 1);
  $("hb").textContent = wk ? "🏹 Hunt" : "■ Stop hunting"; $("wb").textContent = wk ? "■ Stop walking" : "🚶 Walk"; $("fb").textContent = "✈ Fly through"; $("pad").style.display = "flex";
  $("hint").textContent = "Hunt: W/↑ walk · S/↓ back · A/D strafe · ←/→ turn · Shift run · drag to aim · Space or tap to fire. Water = swimming."
}
export function stopHunt() {
  S.HUNT = false; S.HU.on = 0; S.fly = false; $("hb").textContent = "🏹 Hunt"; $("wb").textContent = "🚶 Walk"; $("pad").style.display = "none"; $("hint").textContent = HINT0;
  $("hud").textContent = ""; $("cross").style.display = "none"; $("swim").style.display = "none"; setZoom(1)
}
export function bindLife() {
  $("fb").onclick = toggleFly;
  $("hb").onclick = () => { const HU = S.HU; if (!S.HUNT) startHunt(0); else if (HU.walk) { HU.walk = false; $("hb").textContent = "■ Stop hunting"; $("wb").textContent = "🚶 Walk" } else stopHunt() };
  $("wb").onclick = () => { const HU = S.HU; if (!S.HUNT) startHunt(1); else if (!HU.walk) { HU.walk = true; $("wb").textContent = "■ Stop walking"; $("hb").textContent = "🏹 Hunt" } else stopHunt() };
  $("hv").addEventListener("input", () => { if (S.HUNT) setZoom(+$("hv").value ? 1.5 : 1) });
  $("cr").addEventListener("input", () => { if (S.fly && !S.HUNT) zoomCraft() });
  $("bw").onpointerdown = () => S.keys.w = 1; $("bw").onpointerup = $("bw").onpointerleave = () => S.keys.w = 0;
  $("bf").onpointerdown = () => S.HU.btn = 1; $("bf").onpointerup = $("bf").onpointerleave = () => S.HU.btn = 0
}
