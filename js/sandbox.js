// Open-world sandbox: walk, drive, sail, fly and ride the train through the landscape, talk to people, build and
// remove things, change the weather and time. The 20 game styles in games.js run on top of it.
import { S, $ } from './state.js';
import { gh, ghLand, outside, surf } from './terrain.js';
import { MU, pathAt } from './world.js';
import { stats } from './renderer.js';
import { gun, voice } from './audio.js';
import { AT, stopHunt } from './life.js';
import { GAMES } from './games.js';

let G = null, setZoom = () => { }, hint0 = "";
export const bindSandbox = z => setZoom = z;
const KEYS = ["e", "b", "x", "enter", " ", "r", "q", "n", "[", "]", "1", "2", "3", "4", "f", "a", "d", "w", "s", "arrowleft", "arrowright"];
const BUILD = [["house0", .013, "Cottage"], ["house1", .013, "Town house"], ["house2", .014, "Long house"], ["barn", .017, "Barn"], ["windmill", .011, "Windmill"], ["silo", .007, "Silo"], ["tower", .008, "Tower"], ["tent", .006, "Tent"], ["crate", .003, "Crate"], ["rock", .004, "Rock"], ["flag", .002, "Flag"], ["tree", .006, "Tree"]];
const NAMES = { house0: "Cottage", house1: "Town house", house2: "Long house", church: "Church", barn: "Barn", silo: "Grain silo", windmill: "Windmill", lighthouse: "Lighthouse", jetty: "Jetty", station: "Railway station", tower: "Tower", tent: "Tent", crate: "Crate", rock: "Rock", flag: "Flag" };
const TALK = ["Lovely spot, isn't it?", "The train's due any minute.", "Mind the road, the buses don't hang about.", "They say a storm is coming in off the sea.", "The fishing's been good this week.", "You can borrow any car you like round here.", "The mill grinds when the wind gets up.", "Seen any deer up on the hill?", "Fancy a game? Open Options and pick one."];
const WX = ["off", "rain", "snow", "storm", "tornado"];
export const seaY = () => S.sea * S.hs;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fire = id => $(id).dispatchEvent(new Event("input"));

// ---------- helpers shared with games.js ----------
export const E = () => stats.emis;
export function say(t, s = 3) { G.msg = t; G.msgT = S.TM + s }
// random dry point inside the tile, optionally at a distance r0..r1 from a point
export function land(from, r0 = 0, r1 = .5) {
  for (let n = 0; n < 400; n++) { let x, z; if (from) { const a = Math.random() * 6.28, r = r0 + Math.random() * (r1 - r0); x = from.x + Math.cos(a) * r; z = from.z + Math.sin(a) * r } else { x = Math.random() * .84 - .42; z = Math.random() * .84 - .42 } if (!outside(x, z, .05) && Math.abs(x) < .45 && Math.abs(z) < .45 && ghLand(x, z) > seaY() + .004) return { x, z, y: gh(x, z) } }
  return { x: 0, z: 0, y: gh(0, 0) }
}
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const fwd = () => [Math.sin(G.yaw), Math.cos(G.yaw)];
export function spark(x, y, z, col, n = 10, sp = .02, life = .7, size = .0008) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, v = sp * (.3 + Math.random()); G.parts.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, l: life, m: life, c: col, s: size }) } }
export function tracer(a, b, col = [6, 5.6, 4]) { G.tr.push({ a, b, t: .14, c: col }) }
// shoot along the facing direction: returns the target hit (nearest inside the cone), and draws the shot
export function fireAt(list, range, cone = .12, sound = 1) {
  const f = fwd(), o = [G.x, G.y + .0045, G.z]; let best = null, bd = range; gun(sound);
  for (const t of list) { const dx = t.x - G.x, dz = t.z - G.z, d = Math.hypot(dx, dz); if (d > bd || d < 1e-5) continue; if ((dx * f[0] + dz * f[1]) / d > Math.cos(cone)) { bd = d; best = t } }
  tracer(o, best ? [best.x, (best.y || gh(best.x, best.z)) + .003, best.z] : [o[0] + f[0] * range, o[1], o[2] + f[1] * range]); return best
}
// walk something towards a point over dry land
export function go(e, tx, tz, sp, dt) {
  const w = Math.atan2(tz - e.z, tx - e.x); e.h = (e.h == null ? w : e.h) + Math.atan2(Math.sin(w - e.h), Math.cos(w - e.h)) * Math.min(1, dt * 6);
  const nx = e.x + Math.cos(e.h) * sp * dt, nz = e.z + Math.sin(e.h) * sp * dt; if (!outside(nx, nz, .01) && ghLand(nx, nz) > seaY() - .001) { e.x = nx; e.z = nz } else e.h += dt * 3;
  e.y = gh(e.x, e.z); e.ph = (e.ph || 0) + dt * sp * 620
}
export const person = (D, e, sc = 1) => D.imp.push(e.x, e.y == null ? gh(e.x, e.z) : e.y, e.z, .0013 * sc, e.h || 0, 9, e.ph || 0, 0, 0, 0, 0, e.seed || 0);
export const wolf = (D, e, kind = 3) => D.imp.push(e.x, e.y == null ? gh(e.x, e.z) : e.y, e.z, AT[kind].au * .45, e.h || 0, kind, e.ph || 0, 0, 0, e.pt || 0, 0, 0);
export const prop = (D, m, x, y, z, h = 0, tint = [1, 1, 1], sc = 1, pit = 0, roll = 0) => (D.props[m] || (D.props[m] = [])).push(x, y, z, MU * sc, h, pit, roll, 0, tint[0], tint[1], tint[2], 0);
export function beacon(D, p, c = [.2, 1, .45], h = .09, pulse = 1) { const e = E() * (2 + 2.5 * pulse * (.6 + .4 * Math.sin(S.TM * 5))), y = p.y == null ? gh(p.x, p.z) : p.y; D.fxr.push([[p.x, y, p.z], [p.x, y + h, p.z], 2.5, [c[0] * e, c[1] * e, c[2] * e, 1]]); D.fx.push(p.x, y, p.z, .007, c[0], c[1], c[2], .9, 1) }
export const glow = (D, x, y, z, c, size = .0012, k = 3) => D.fx.push(x, y, z, size, c[0] * E() * k, c[1] * E() * k, c[2] * E() * k, 1, 3);
export function hoop(D, c, yaw, R, col, k = 4) { const e = E() * k, r = [Math.cos(yaw), -Math.sin(yaw)]; let p = null; for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.2832, q = [c.x + r[0] * Math.cos(a) * R, c.y + Math.sin(a) * R, c.z + r[1] * Math.cos(a) * R]; if (p) D.fxr.push([p, q, 3, [col[0] * e, col[1] * e, col[2] * e, 1]]); p = q } }
export const line = (D, a, b, col, w = 2, k = 3) => D.fxr.push([a, b, w, [col[0] * E() * k, col[1] * E() * k, col[2] * E() * k, 1]]);
export const bar = (v, n = 10) => "█".repeat(Math.round(clamp(v, 0, 1) * n)) + "░".repeat(n - Math.round(clamp(v, 0, 1) * n));
export function finish(g, text, won) { if (g.over) return; g.over = text; g.won = !!won; voice(won ? 6 : 3, 1) }
export function setControl(id, v) { const e = $(id); if (e.type == "checkbox") { if (e.checked != v) { e.checked = v; fire(id) } } else if (e.value != v) { e.value = v; fire(id) } }
const water = (x, z) => ghLand(x, z) < seaY() - .0012;
const hitBld = (x, z, m = .75) => { const W = S.W; return !!(W && W.on && W.bld.some(b => b.r > .003 && b.m != "jetty" && (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r * m) ** 2)) };
const onRoad = (x, z) => { const W = S.W; if (!W || !W.tex || Math.abs(x) > .5 || Math.abs(z) > .5) return false; const o = (Math.round((z + .5) * 1023) * 1024 + Math.round((x + .5) * 1023)) * 4; return W.tex[o + 1] > 140 && W.tex[o + 1] < 210 && W.tex[o] > 150 };

// ---------- avatar modes ----------
export function setMode(m, o = {}) {
  if (G.train) { G.train.manual = false; G.train = null }
  if (m == "boat" && !water(G.x, G.z)) { let best = null; for (let r = .01; r < .7 && !best; r += .01) for (let a = 0; a < 6.28; a += .3) { const x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r; if (water(x, z) && !outside(x, z, .02)) { best = [x, z]; break } } if (!best) { say("No water to sail on here"); return false } G.x = best[0]; G.z = best[1] }
  if (m == "train") { const W = S.W, t = W && W.trains[0]; if (!t) { say("There is no railway on this map"); return false } G.train = t; t.manual = true }
  G.mode = m; G.v = m == "plane" ? .16 : 0; G.vy = 0; G.pt = 0; G.bank = 0; G.coff = 0; G.cd = { foot: .03, car: .055, boat: .07, plane: .1, train: .13 }[m];
  G.veh = o.m || { car: "car", boat: "fishingBoat", plane: "lightPlane" }[m]; G.tint = o.tint || { car: [.8, .1, .1], boat: [.15, .3, .5], plane: [.9, .85, .2] }[m];
  if (m == "plane") G.y = Math.max(G.y, gh(G.x, G.z) + .05); return true
}
function leaveVehicle() {
  if (G.mode == "car" || G.mode == "boat") G.parked.push({ m: G.veh, tint: G.tint, x: G.x, y: G.y, z: G.z, h: Math.PI / 2 - G.yaw, k: G.mode });
  const f = fwd(), sx = G.x + f[1] * .006, sz = G.z - f[0] * .006; if (G.mode == "boat") { const p = land({ x: G.x, z: G.z }, 0, .08); G.x = p.x; G.z = p.z } else if (G.mode != "plane" || G.y - gh(G.x, G.z) < .01) { G.x = sx; G.z = sz }
  setMode("foot")
}

function move(dt) {
  const k = S.keys, fw = G.auto ? 1 : (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), st = (k.d ? 1 : 0) - (k.a ? 1 : 0), tn = (k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0), sy = seaY();
  if (G.mode == "foot") {
    G.yaw += (tn + (G.turn ? st : 0)) * dt * 2.2; const sf = surf(G.x, G.z), ground = G.floor ? G.floor(G.x, G.z, G.y) : gh(G.x, G.z); G.sw = sf == 3 && G.y <= sy + .0005 ? 1 : 0;
    const run = G.sneak ? (k.shift ? .45 : 1) : k.shift ? 1.8 : 1, sp = (G.sw ? .009 : .017) * run * (G.spd || 1) * (fw || (st && !G.turn) ? 1 : 0), sx = G.turn ? 0 : st, vx = Math.sin(G.yaw) * fw + Math.cos(G.yaw) * sx, vz = Math.cos(G.yaw) * fw - Math.sin(G.yaw) * sx, m = Math.hypot(vx, vz) || 1;
    const nx = G.x + vx / m * sp * dt, nz = G.z + vz / m * sp * dt; if (!outside(nx, nz, .015) && !hitBld(nx, nz)) { G.x = nx; G.z = nz }
    G.mv = sp > 0 ? 1 : 0; G.ph += G.mv ? dt * (G.sw ? 4 : 10) * run : 0;
    const on = G.y <= ground + 1e-5; if (G.jump && G.hit[" "] && on) { G.vy = .036; voice(6, .4) }
    if (G.jump) { G.vy -= .13 * dt; G.y += G.vy * dt; const g2 = G.floor ? G.floor(G.x, G.z, G.y) : gh(G.x, G.z); if (G.y <= g2) { G.y = g2; G.vy = 0 } } else G.y += (ground - G.y) * Math.min(1, dt * 14)
  } else if (G.mode == "car") {
    const road = onRoad(G.x, G.z), wet = water(G.x, G.z); G.v += (fw * (fw < 0 ? .03 : .05) - G.v * (road ? .36 : .8) - (wet ? G.v * 3 : 0)) * dt * 1.6; G.yaw += (st || tn) * dt * 1.9 * clamp(G.v / .03, -1, 1);
    const nx = G.x + Math.sin(G.yaw) * G.v * dt, nz = G.z + Math.cos(G.yaw) * G.v * dt;
    if (outside(nx, nz, .012) || hitBld(nx, nz, .85) || ghLand(nx, nz) < sy - .004) { G.v *= -.3 } else { G.x = nx; G.z = nz } G.y = gh(G.x, G.z); G.road = road
  } else if (G.mode == "boat") {
    G.v += (fw * .03 - G.v * .5) * dt * 1.5; G.yaw += (st || tn) * dt * 1.1 * clamp(G.v / .02 + .15 * Math.sign(fw || 1), -1, 1);
    const nx = G.x + Math.sin(G.yaw) * G.v * dt, nz = G.z + Math.cos(G.yaw) * G.v * dt; if (water(nx, nz) && Math.abs(nx) < 2.4 && Math.abs(nz) < 2.4) { G.x = nx; G.z = nz } else G.v *= -.25; G.y = sy
  } else if (G.mode == "plane") {
    const pin = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0), rl = st || tn; G.bank += (rl * .9 - G.bank) * Math.min(1, dt * 2.5); G.yaw += G.bank * dt * 1.4; G.pt += (pin * .6 - G.pt) * Math.min(1, dt * 2);
    G.v += ((k.shift ? .28 : k.control ? .08 : .16) - G.v) * dt * .8; G.x += Math.sin(G.yaw) * Math.cos(G.pt) * G.v * dt; G.z += Math.cos(G.yaw) * Math.cos(G.pt) * G.v * dt; G.y += Math.sin(G.pt) * G.v * dt;
    const r = Math.hypot(G.x, G.z); if (r > 1.6) { const w = Math.atan2(-G.x, -G.z); G.yaw += Math.atan2(Math.sin(w - G.yaw), Math.cos(w - G.yaw)) * dt * 2 }
    const g = gh(G.x, G.z) + .0025; if (G.y < g) { G.y = g; G.pt = Math.max(G.pt, 0); G.ground = 1 } else G.ground = 0; G.y = Math.min(G.y, 1.3)
  } else if (G.mode == "train") {
    const t = G.train; t.v = clamp((t.v || 0) + (fw * .04 - (t.v || 0) * .3) * dt, -.09, .09); t.s = clamp(t.s + t.v * dt, .2, t.p.len - .01); t.d = 1; t.wait = 0;
    const a = pathAt(t.p, t.s, 1, 0); G.x = a.x; G.z = a.z; G.y = a.y; G.yaw = Math.PI / 2 - a.h
  }
}

// ---------- free-roam interaction ----------
function nearest(list, r, f = o => o) { let best = null, bd = r; for (const o of list) { const p = f(o), d = Math.hypot(p.x - G.x, p.z - G.z); if (d < bd) { bd = d; best = o } } return best }
function interact() {
  const W = S.W;
  if (G.mode != "foot") { if (G.mode == "plane" && !G.ground) { say("Land first (fly low and level)"); return } if (Math.abs(G.v) > .02) { say("Stop first"); return } leaveVehicle(); say("On foot"); return }
  const pk = nearest(G.parked, .014); if (pk) { G.parked.splice(G.parked.indexOf(pk), 1); G.x = pk.x; G.z = pk.z; G.yaw = Math.PI / 2 - pk.h; setMode(pk.k, pk); say("Driving. E to get out"); return }
  if (W && W.on) {
    const car = nearest(W.cars, .016, c => pathAt(c.p, c.s, c.d, .0029)); if (car && $("tpr").checked) { const a = pathAt(car.p, car.s, car.d, .0029); W.cars.splice(W.cars.indexOf(car), 1); G.x = a.x; G.z = a.z; G.yaw = Math.PI / 2 - a.h; setMode("car", { m: car.m, tint: car.tint }); say(car.m == "bus" ? "You are driving the bus. W/S and A/D, E to get out" : "You took the car. W/S and A/D, E to get out"); return }
    const bt = nearest(W.boats, .03); if (bt && $("tpr").checked) { W.boats.splice(W.boats.indexOf(bt), 1); G.x = bt.x; G.z = bt.z; G.yaw = Math.PI / 2 - bt.h; setMode("boat", { m: bt.m, tint: bt.tint }); say("Sailing. W/S and A/D, E to go ashore"); return }
    const tr = W.trains[0]; if (tr && $("tpr").checked) { const a = pathAt(tr.p, tr.s, tr.d, 0); if (Math.hypot(a.x - G.x, a.z - G.z) < .03) { setMode("train"); say("Driving the train. W forward, S back, E to get off"); return } }
    const pp = nearest(W.people, .012); if (pp) { pp.pau = 4; pp.h = Math.atan2(G.z - pp.z, G.x - pp.x); say("“" + TALK[Math.floor(Math.random() * TALK.length)] + "”", 4); voice(6, .6); return }
    const b = nearest(W.bld, .03); if (b && Math.hypot(b.x - G.x, b.z - G.z) < b.r + .006) { if (b.m == "windmill") { b.mill = b.mill ? 0 : 1; say(b.mill ? "Windmill sails released" : "Windmill brake on") } else say(NAMES[b.m] || "Building"); return }
  }
  const an = nearest(S.AN.filter(a => a.st == "alive"), .02); if (an) { an.fear = S.TM + 3; an.pau = 0; say("The " + ["rabbit", "deer", "fox", "wolf", "hawk", "eagle", "robin", "dragon"][an.t] + " bolts"); voice(an.t, .8); return }
  say("Nothing to use here. Walk up to a car, boat, train, person or building")
}
// place the selected item in front of the player; returns the record
export function place(name, r) {
  const f = fwd(), x = G.x + f[0] * (r + .008), z = G.z + f[1] * (r + .008), W = S.W;
  if (outside(x, z, .02) || ghLand(x, z) < seaY() + .001) { say("Can't build there"); return null }
  if (name == "tree") { if (!S.TR || !S.SK) { say("Turn Trees on first"); return null } S.TR.push([x, gh(x, z), z, .8 + Math.random() * .4, Math.floor(Math.random() * S.SK.length)]); return { m: "tree" } }
  if (!W || !W.on) { say("Turn on Buildings in Options first"); return null } if (hitBld(x, z, 1)) { say("Too close to another building"); return null }
  const b = { m: name, x, z, y: gh(x, z), h: Math.atan2(-f[1], -f[0]), r, tint: [[.93, .91, .86], [.88, .82, .7], [.86, .74, .68], [.7, .45, .36]][Math.floor(Math.random() * 4)], seed: Math.random(), user: 1 }; if (name == "windmill") b.mill = 1; W.bld.push(b); voice(6, .5); return b
}
function removeNear() {
  const W = S.W, b = W && W.on && nearest(W.bld, .03); if (b && Math.hypot(b.x - G.x, b.z - G.z) < b.r + .012) { W.bld.splice(W.bld.indexOf(b), 1); spark(b.x, b.y + .004, b.z, [.5, .45, .4, 0], 16, .02, 1, .0016); say((NAMES[b.m] || "Building") + " removed"); return "bld" }
  if (S.TR) { let bi = -1, bd = .016; S.TR.forEach((t, i) => { const d = Math.hypot(t[0] - G.x, t[2] - G.z); if (d < bd) { bd = d; bi = i } }); if (bi >= 0) { const t = S.TR[bi]; S.TR.splice(bi, 1); spark(t[0], t[1] + .004, t[2], [.2, .4, .1, 0], 14, .02, 1, .0014); say("Tree felled"); return "tree" } }
  say("Nothing close enough to remove"); return null
}
function free() {
  const h = G.hit;
  if (h.e) interact();
  if (h["1"]) { if (G.mode != "foot") leaveVehicle() } if (h["2"]) setMode("car") && say("Car. W/S drive, A/D steer"); if (h["3"]) setMode("boat") && say("Boat. W/S and A/D"); if (h["4"]) setMode("plane") && say("Plane. S pulls up, W dives, A/D bank, Shift faster, Ctrl slower");
  if (G.mode == "foot") { if (h.b) { G.item = (G.item + 1) % BUILD.length; say("Build: " + BUILD[G.item][2] + " (Enter to place)") } if (h.enter) { const it = BUILD[G.item]; if (place(it[0], it[1])) say(it[2] + " placed") } if (h.x) removeNear() }
  if (h.n) { const i = (WX.indexOf($("wx").value) + 1) % WX.length; setControl("wx", WX[i]); say("Weather: " + $("wx").selectedOptions[0].textContent) }
  if (h["["] || h["]"]) { setControl("tod", String(((+$("tod").value + (h["]"] ? 1 : 23)) % 24).toFixed(2))); say("Time " + $("todv").textContent) }
}

// ---------- start, stop, choose game ----------
export function setGame(id) {
  if (!G) return; const old = G.game; if (old && old.def.end) old.def.end(G, old);
  Object.assign(G, { auto: 0, jump: 0, floor: null, lock: 0, fp: 0, hide: 0, spd: 1, sneak: 0, turn: 0, hp: 100, game: null, cx: null, cy: null, cz: null }); $("cross").style.display = "none";
  if (G.mode != "foot") setMode("foot"); if (ghLand(G.x, G.z) < seaY()) { const p = land({ x: G.x, z: G.z }, 0, .3); G.x = p.x; G.z = p.z } G.y = gh(G.x, G.z);
  const def = id && GAMES.find(g => g.id == id); $("gm").value = def ? id : "";
  if (def) { const g = G.game = { id, def, t: 0, score: 0, over: null }; def.init(G, g); say(def.n + ": " + def.h, 9) } else say("Free roam. E use · 1 walk 2 car 3 boat 4 plane · B/Enter build · X remove · N weather · [ ] time", 9)
}
export function startSandbox(id) {
  if (!S.Hn) return; if (S.LAND && S.stopLander) S.stopLander(); if (S.HUNT) stopHunt(); if (S.fly) { S.fly = false; $("fb").textContent = "✈ Fly through" }
  setControl("bld", true); setControl("tpr", true);
  const W = S.W, s = W && W.sites.find(s => s.k == "village"), p = s ? land({ x: s.x, z: s.z }, .005, .03) : land();
  G = S.GAME = { x: p.x, z: p.z, y: p.y, yaw: 0, pit: .3, coff: 0, v: 0, vy: 0, mode: "foot", ph: 0, hit: {}, prev: {}, cd: .03, parked: [], parts: [], tr: [], item: 0, hp: 100, msg: "", msgT: 0 };
  S.fly = true; S.cam = { x: p.x, y: p.y, z: p.z, yaw: 0, pit: .3 }; S.stopGame = stopSandbox; S.HU.on = 1; setZoom(1);
  hint0 = $("hint").textContent; $("sb").textContent = "■ Leave sandbox"; $("pad").style.display = "flex"; setGame(id)
}
export function stopSandbox() {
  if (!G) return; setGame(null); if (G.train) G.train.manual = false; G = S.GAME = null; S.GD = null; S.fly = false; S.stopGame = null; S.HU.on = 0;
  $("sb").textContent = "🌍 Sandbox"; $("pad").style.display = "none"; $("hud").textContent = ""; $("cross").style.display = "none"; setZoom(1)
}

export function gameTick(dt) {
  const k = S.keys, TM = S.TM, gm = G.game; for (const q of KEYS) { G.hit[q] = k[q] && !G.prev[q]; G.prev[q] = k[q] } if (G.click || S.HU.btn && !G.pbtn) G.hit[" "] = 1; G.click = 0; G.pbtn = S.HU.btn;
  if (G.hit.q && gm) { setGame(null); return }
  if (gm && G.hit.r) { setGame(gm.id); return }
  if (!G.lock && !(gm && gm.over)) move(dt);
  if (gm) { if (!gm.over) { gm.t += dt; gm.def.tick(G, gm, dt) } } else free();
  S.HU.x = G.x; S.HU.z = G.z; S.HU.y = G.y;
  // ---- things to draw ----
  const D = S.GD = { props: {}, imp: [], fx: [], fxr: [] }, h = Math.PI / 2 - G.yaw;
  if (!G.hide) {
    if (G.mode == "foot") { if (!G.fp) D.imp.push(G.x, G.y, G.z, .0015, h, 8, G.ph, G.sw ? 1 : 0, 0, 0, 0, 0) }
    else if (G.mode == "car") { const e = .004, f = fwd(), pit = Math.atan2(gh(G.x + f[0] * e, G.z + f[1] * e) - gh(G.x - f[0] * e, G.z - f[1] * e), 2 * e), rl = Math.atan2(gh(G.x - f[1] * e, G.z + f[0] * e) - gh(G.x + f[1] * e, G.z - f[0] * e), 2 * e); prop(D, G.veh, G.x, G.y + .0001, G.z, h, G.tint, 1, pit, rl) }
    else if (G.mode == "boat") prop(D, G.veh, G.x, G.y + Math.sin(TM * 1.3) * .0002, G.z, h, G.tint, 1, Math.sin(TM * 1.1) * .04 + G.v * 2, Math.sin(TM * .9) * .05);
    else if (G.mode == "plane") prop(D, G.veh, G.x, G.y, G.z, h, G.tint, 1, G.pt, -G.bank)
  }
  for (const p of G.parked) prop(D, p.m, p.x, p.y, p.z, p.h, p.tint);
  for (const p of G.parts) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= .03 * dt; const f = Math.max(0, p.l / p.m); if (p.c[3]) D.fx.push(p.x, p.y, p.z, p.s * (1.6 - f), p.c[0] * E() * 6 * f, p.c[1] * E() * 6 * f, p.c[2] * E() * 6 * f, 1, 3); else D.fx.push(p.x, Math.max(p.y, gh(p.x, p.z)), p.z, p.s * (1.8 - f), p.c[0], p.c[1], p.c[2], Math.min(.7, f), 0) }
  G.parts = G.parts.filter(p => p.l > 0); if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
  for (const t of G.tr) { t.t -= dt; D.fxr.push([t.a, t.b, 1.6, [t.c[0] * E(), t.c[1] * E(), t.c[2] * E(), Math.min(1, t.t * 8)]]) } G.tr = G.tr.filter(t => t.t > 0);
  if (gm && gm.def.draw) gm.def.draw(G, gm, D);
  // ---- camera target ----
  const c = S.cam, eye = { foot: .0047, car: .004, boat: .005, plane: .003, train: .008 }[G.mode]; c.x = G.cx != null ? G.cx : G.x; c.z = G.cz != null ? G.cz : G.z; c.y = (G.cy != null ? G.cy : G.y) + eye; c.yaw = G.yaw + (G.mode == "foot" ? 0 : G.coff); c.pit = G.fp ? G.pit - .25 : G.pit;
  // ---- heads-up text ----
  const sp = G.mode == "foot" ? "" : "  ·  " + Math.round(Math.abs(G.mode == "train" ? G.train.v : G.v) / MU * 3.6 / 4) * 4 + " km/h";
  let tx = gm ? gm.def.n + "  ·  " + gm.def.status(G, gm) : "Sandbox  ·  " + { foot: "on foot", car: G.veh == "bus" ? "bus" : "car", boat: "boat", plane: "plane", train: "train" }[G.mode] + sp + "  ·  Build: " + BUILD[G.item][2];
  if (gm && gm.over) tx += "\n" + gm.over + "  —  R to play again · Q for free roam"; else if (TM < G.msgT) tx += "\n" + G.msg;
  if ($("hud").textContent != tx) $("hud").textContent = tx
}
