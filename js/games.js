// Twenty compact, original games in popular styles, all played inside the sandbox landscape.
// Each: { id, n: name, h: how to play, init(G, g), tick(G, g, dt), draw(G, g, D), status(G, g), end? }
// G is the sandbox player (position, mode, keys pressed this frame in G.hit); g is this game's own state.
import { S, $ } from './state.js';
import { gh, ghLand, outside } from './terrain.js';
import { pathAt, MU } from './world.js';
import { gun, voice } from './audio.js';
import { E, say, land, dist, fwd, spark, tracer, fireAt, go, person, wolf, prop, beacon, glow, hoop, line, bar, finish, setMode, setControl, place, seaY } from './sandbox.js';

const R = Math.random, M = 1 / MU, GRN = [.2, 1, .45], YEL = [1, .85, .2], RED = [1, .2, .15], CYA = [.2, .8, 1];
const face = (G, p) => G.yaw = Math.atan2(p.x - G.x, p.z - G.z);
const put = (G, p) => { G.x = p.x; G.z = p.z; G.y = gh(p.x, p.z) };
const mmss = t => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
const slope = (x, z) => { const e = .006, y = gh(x, z); return Math.hypot(gh(x + e, z) - y, gh(x, z + e) - y) / e };
const flat = (from, r0, r1) => { let best = null, bs = 9; for (let i = 0; i < 14; i++) { const p = land(from, r0, r1), s = slope(p.x, p.z) + (S.TR && $("tr").checked && S.TR.some(t => Math.hypot(t[0] - p.x, t[2] - p.z) < .035) ? 5 : 0); if (s < bs) { bs = s; best = p } } return best };
const ringOf = (n, r) => { const a0 = R() * 6.28, o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.283, q = { x: Math.cos(a) * r, z: Math.sin(a) * r }; q.y = gh(q.x, q.z); q.a = a; o.push(q) } return o };

export const GAMES = [
  { id: "race", n: "Racing", h: "Drive through the green gates in order and beat the two rival cars. W/S drive, A/D steer.",
    init(G, g) {
      const W = S.W, rd = W && W.paths.filter(p => p.ty == "road").sort((a, b) => b.len - a.len)[0]; g.cp = [];
      if (rd) { for (let i = 0; i < 9; i++) { const a = pathAt(rd, rd.len * (i + .3) / 9); g.cp.push({ x: a.x, z: a.z, y: a.y }) } g.cp = g.cp.concat(g.cp.slice(0, -1).reverse()) } else g.cp = ringOf(10, .3).filter(p => ghLand(p.x, p.z) > seaY());
      put(G, g.cp[0]); setMode("car"); face(G, g.cp[1]); g.i = 1; g.cum = [0]; for (let i = 1; i < g.cp.length; i++) g.cum.push(g.cum[i - 1] + dist(g.cp[i], g.cp[i - 1])); g.riv = [{ s: 0, v: .045, tint: [.1, .25, .6] }, { s: 0, v: .058, tint: [.9, .75, .15] }]
    },
    tick(G, g, dt) {
      const L = g.cum[g.cum.length - 1]; if (g.t > 2) for (const r of g.riv) r.s = Math.min(L, r.s + r.v * dt);
      if (dist(G, g.cp[g.i]) < .022) { g.i++; voice(6, .7); if (g.i >= g.cp.length) { const pl = 1 + g.riv.filter(r => r.s >= L).length; finish(g, "Finished " + ["1st", "2nd", "3rd"][pl - 1] + " in " + g.t.toFixed(1) + " s", pl == 1) } }
    },
    draw(G, g, D) {
      if (g.i < g.cp.length) beacon(D, g.cp[g.i], GRN, .12); if (g.i + 1 < g.cp.length) beacon(D, g.cp[g.i + 1], YEL, .05, 0);
      for (const r of g.riv) { let i = 1; while (i < g.cum.length - 1 && g.cum[i] < r.s) i++; const a = g.cp[i - 1], b = g.cp[i], t = (r.s - g.cum[i - 1]) / ((g.cum[i] - g.cum[i - 1]) || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; prop(D, "car", x, gh(x, z), z, Math.atan2(b.z - a.z, b.x - a.x), r.tint) }
    },
    status: (G, g) => "Gate " + Math.min(g.i, g.cp.length - 1) + "/" + (g.cp.length - 1) + "  ·  " + g.t.toFixed(1) + " s" },

  { id: "flight", n: "Flight simulator", h: "Fly through the hoops in order. S pulls the nose up, W pushes down, A/D bank, Shift faster, Ctrl slower.",
    init(G, g) { g.rings = ringOf(10, .32).map(p => ({ x: p.x, z: p.z, y: Math.max(gh(p.x, p.z), seaY()) + .05 + R() * .05, yaw: -p.a })); g.i = 0; const a = g.rings[9]; put(G, a); setMode("plane"); G.y = a.y; face(G, g.rings[0]) },
    tick(G, g, dt) { const r = g.rings[g.i]; if (Math.hypot(r.x - G.x, r.y - G.y, r.z - G.z) < .03) { g.i++; voice(6, .8); if (g.i >= g.rings.length) finish(g, "All hoops in " + g.t.toFixed(1) + " s", 1) } },
    draw(G, g, D) { if (g.i < g.rings.length) hoop(D, g.rings[g.i], g.rings[g.i].yaw, .028, GRN, 6); if (g.i + 1 < g.rings.length) hoop(D, g.rings[g.i + 1], g.rings[g.i + 1].yaw, .028, YEL, 1.5) },
    status: (G, g) => "Hoop " + g.i + "/" + g.rings.length + "  ·  " + g.t.toFixed(1) + " s  ·  Height " + Math.round((G.y - gh(G.x, G.z)) * M) + " m" },

  { id: "fps", n: "First-person shooter", h: "Shoot down 15 attack drones before they wear you down. Drag to aim, Space or click to fire, WASD to move.",
    init(G, g) { G.fp = 1; $("cross").style.display = "block"; g.dr = []; g.cool = 0; for (let i = 0; i < 5; i++) this.spawn(G, g) },
    spawn(G, g) { const a = R() * 6.28, r = .12 + R() * .1; g.dr.push({ x: G.x + Math.cos(a) * r, z: G.z + Math.sin(a) * r, hp: 2, cd: 2 + R() * 2, ph: R() * 6, h: 0 }) },
    tick(G, g, dt) {
      g.cool -= dt; if (G.hit[" "] && g.cool <= 0) { g.cool = .22; const t = fireAt(g.dr, .3, .07); if (t && --t.hp <= 0) { spark(t.x, t.y, t.z, [1, .5, .1, 1], 14, .03); g.dr.splice(g.dr.indexOf(t), 1); g.score++; if (g.score >= 15) finish(g, "Sky cleared: 15 drones down", 1); else this.spawn(G, g) } }
      for (const d of g.dr) { const w = Math.atan2(G.z - d.z, G.x - d.x) + Math.sin(S.TM * .7 + d.ph) * .9, dd = dist(d, G); d.h = w; if (dd > .05) { d.x += Math.cos(w) * .03 * dt; d.z += Math.sin(w) * .03 * dt } d.y = gh(d.x, d.z) + .012 + .005 * Math.sin(S.TM * 2 + d.ph); d.cd -= dt; if (d.cd <= 0 && dd < .12) { d.cd = 1.4 + R(); const hit = R() < .4; tracer([d.x, d.y, d.z], [G.x + (hit ? 0 : (R() - .5) * .01), G.y + .004, G.z], [6, 1, .5]); gun(0); if (hit) { G.hp -= 7; if (G.hp <= 0) finish(g, "You were shot down with " + g.score + " kills") } } }
    },
    draw(G, g, D) { for (const d of g.dr) { D.imp.push(d.x, d.y, d.z, .0016, d.h, 11, 0, 0, 0, 0, 0, 0) } },
    status: (G, g) => "Drones " + g.score + "/15  ·  Health " + bar(G.hp / 100) },

  { id: "royale", n: "Battle royale", h: "Be the last one standing. Stay inside the shrinking ring of posts. Space fires at whoever you face.",
    init(G, g) { g.c = land(); g.R = .5; g.bots = []; g.cool = 0; for (let i = 0; i < 11; i++) { const p = land(); g.bots.push({ x: p.x, z: p.z, hp: 3, cd: R() * 2, seed: R(), o: [(R() - .5) * .5, (R() - .5) * .5] }) } },
    tick(G, g, dt) {
      g.R = Math.max(.03, .5 - g.t * .0032); g.cool -= dt; const all = g.bots.concat([G]);
      if (G.hit[" "] && g.cool <= 0) { g.cool = .35; const t = fireAt(g.bots, .12, .16); if (t) t.hp-- }
      for (const b of g.bots) { let tg = null, bd = .08; for (const o of all) if (o !== b) { const d = dist(o, b); if (d < bd) { bd = d; tg = o } } b.cd -= dt;
        if (tg) { b.h = Math.atan2(tg.z - b.z, tg.x - b.x); if (b.cd <= 0) { b.cd = 1.2 + R(); const hit = R() < .3; tracer([b.x, gh(b.x, b.z) + .004, b.z], [tg.x, gh(tg.x, tg.z) + .004, tg.z], [6, 3, 1]); if (hit) { if (tg === G) G.hp -= 12; else tg.hp-- } } if (bd > .04) go(b, tg.x, tg.z, .012, dt) } else go(b, g.c.x + b.o[0] * g.R, g.c.z + b.o[1] * g.R, .014, dt);
        if (dist(b, g.c) > g.R) b.hp -= dt * .5 }
      if (dist(G, g.c) > g.R) G.hp -= dt * 8; g.bots = g.bots.filter(b => { if (b.hp > 0) return true; spark(b.x, gh(b.x, b.z) + .003, b.z, [.6, .1, .1, 0], 8); return false });
      if (G.hp <= 0) finish(g, "Eliminated. " + g.bots.length + " were left"); else if (!g.bots.length) finish(g, "Victory: last one standing", 1)
    },
    draw(G, g, D) { for (const b of g.bots) person(D, b); for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283, x = g.c.x + Math.cos(a) * g.R, z = g.c.z + Math.sin(a) * g.R, y = gh(x, z); line(D, [x, y, z], [x, y + .012, z], [.3, .6, 1], 2, 3) } },
    status: (G, g) => "Left alive " + (g.bots.length + 1) + "  ·  Health " + bar(G.hp / 100) + (dist(G, g.c) > g.R ? "  ·  OUTSIDE THE RING" : "") },

  { id: "platform", n: "Platformer", h: "Jump from platform to platform up to the flag. Space jumps, Shift runs. Fall and you go back to the last platform you reached.",
    init(G, g) {
      const b = flat(null, 0, .3); g.pl = []; let x = b.x, z = b.z, a = R() * 6.28, y = gh(x, z) + .003;
      for (let i = 0; i < 14; i++) { g.pl.push({ x, z, y }); a += (R() - .5) * 1.4; let nx = x + Math.cos(a) * .021, nz = z + Math.sin(a) * .021; if (Math.abs(nx) > .42 || Math.abs(nz) > .42) { a += 3.14; nx = x + Math.cos(a) * .021; nz = z + Math.sin(a) * .021 } x = nx; z = nz; y = Math.max(y + .0022, gh(x, z) + .003) }
      g.i = 0; g.falls = 0; G.jump = 1; G.floor = (px, pz, py) => { let f = gh(px, pz); for (const p of g.pl) if (Math.abs(px - p.x) < .0063 && Math.abs(pz - p.z) < .0063 && py >= p.y - .0016) f = Math.max(f, p.y); return f };
      put(G, g.pl[0]); G.y = g.pl[0].y; face(G, g.pl[1]); G.pit = .6; G.cd = .042
    },
    tick(G, g, dt) {
      g.pl.forEach((p, i) => { if (Math.abs(G.x - p.x) < .0063 && Math.abs(G.z - p.z) < .0063 && Math.abs(G.y - p.y) < 1e-4 && i > g.i) { g.i = i; voice(6, .5) } });
      if (g.i == g.pl.length - 1) finish(g, "Flag reached in " + g.t.toFixed(1) + " s with " + g.falls + " falls", 1);
      else if (G.y <= gh(G.x, G.z) + 1e-5 && g.t > .5) { const p = g.pl[g.i]; G.x = p.x; G.z = p.z; G.y = p.y; G.vy = 0; g.falls++ }
    },
    draw(G, g, D) { g.pl.forEach((p, i) => { prop(D, "platform", p.x, p.y, p.z); if (i == g.i + 1) glow(D, p.x, p.y + .002, p.z, GRN, .001) }); const l = g.pl[g.pl.length - 1]; prop(D, "flag", l.x, l.y, l.z, 0, [.9, .1, .1], 1.2) },
    status: (G, g) => "Platform " + (g.i + 1) + "/" + g.pl.length + "  ·  Falls " + g.falls + "  ·  " + g.t.toFixed(0) + " s" },

  { id: "survival", n: "Survival", h: "Last three days. Walk into berry bushes to eat, press E by a tree to cut wood, F lights a fire (2 wood) to stay warm at night and in the rain.",
    init(G, g) { g.food = 100; g.warm = 100; g.wood = 0; g.bush = []; g.fires = []; g.sv = $("tod").value; for (let i = 0; i < 16; i++) { const p = land(G, .01, .2); p.t = 0; g.bush.push(p) } },
    end(G, g) { setControl("tod", g.sv) },
    tick(G, g, dt) {
      const tod = (+g.sv + g.t * 24 / 90) % 24, sun = Math.sin((tod - 6) / 12 * Math.PI), night = sun < .05 ? 1 : 0, wet = $("wx").value != "off"; if (Math.floor(g.t * 2) != Math.floor((g.t - dt) * 2)) setControl("tod", tod.toFixed(2));
      g.food -= dt * 1.5; const fire = g.fires.some(f => dist(f, G) < .014); g.warm += dt * (fire ? 14 : -(.6 + 3.2 * night + (wet ? 2 : 0) + (G.sw ? 6 : 0))); g.warm = Math.min(100, g.warm); g.food = Math.max(0, g.food); g.warm = Math.max(0, g.warm);
      for (const b of g.bush) if (b.t <= g.t && dist(b, G) < .008) { b.t = g.t + 35; g.food = Math.min(100, g.food + 22); voice(6, .5); say("Berries") }
      if (G.hit.e && S.TR) { let bi = -1, bd = .014; S.TR.forEach((t, i) => { const d = Math.hypot(t[0] - G.x, t[2] - G.z); if (d < bd) { bd = d; bi = i } }); if (bi >= 0) { S.TR.splice(bi, 1); g.wood += 2; say("Wood +2") } else say("No tree close enough") }
      if (G.hit.f) { if (g.wood >= 2) { g.wood -= 2; g.fires.push({ x: G.x, z: G.z, y: G.y, t: g.t + 70 }) } else say("A fire needs 2 wood") } g.fires = g.fires.filter(f => f.t > g.t);
      G.hp = Math.max(0, Math.min(100, G.hp + dt * (g.food <= 0 || g.warm <= 0 ? -4 : 1.5))); if (G.hp <= 0) finish(g, "You lasted " + (g.t / 90).toFixed(1) + " days"); else if (g.t >= 270) finish(g, "Three days survived", 1)
    },
    draw(G, g, D) { for (const b of g.bush) if (b.t <= g.t) { D.fx.push(b.x, b.y + .0012, b.z, .0016, .08, .3, .08, 1, 0); D.fx.push(b.x, b.y + .0016, b.z, .0005, .8, .05, .15, 1, 0) } for (const f of g.fires) { const k = .7 + .3 * Math.sin(S.TM * 17 + f.x * 99); glow(D, f.x, f.y + .0012, f.z, [1, .45, .1], .0016 * k, 8); glow(D, f.x, f.y + .0026, f.z, [1, .7, .2], .0008 * k, 6) } },
    status: (G, g) => "Day " + (1 + Math.floor(g.t / 90)) + "/3  ·  Health " + bar(G.hp / 100, 6) + "  Food " + bar(g.food / 100, 6) + "  Warmth " + bar(g.warm / 100, 6) + "  ·  Wood " + g.wood },

  { id: "tower", n: "Tower defence", h: "Wolves follow the marked trail to your flag. Stand beside the trail and press E to build a tower (60 coins). Towers shoot on their own.",
    init(G, g) {
      const a = land(), b = land(a, .3, .45); g.path = []; for (let i = 0; i <= 60; i++) { const t = i / 60, w = Math.sin(t * 9.4) * .03 * Math.sin(t * 3.14), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz), x = a.x + dx * t - dz / l * w, z = a.z + dz * t + dx / l * w; g.path.push({ x, z, y: gh(x, z) }) }
      g.en = []; g.tw = []; g.coins = 150; g.lives = 10; g.wave = 0; g.left = 0; g.next = 3; put(G, { x: g.path[40].x + .016, z: g.path[40].z })
    },
    tick(G, g, dt) {
      if (!g.left && !g.en.length) { g.next -= dt; if (g.next <= 0) { if (g.wave >= 6) { finish(g, "All six waves beaten", 1); return } g.wave++; g.left = 4 + g.wave * 2; g.sp = 0; g.next = 5; say("Wave " + g.wave) } }
      if (g.left) { g.sp -= dt; if (g.sp <= 0) { g.sp = .9; g.left--; g.en.push({ s: 0, hp: 2 + g.wave * .7, x: g.path[0].x, z: g.path[0].z, ph: 0 }) } }
      for (const e of g.en) { e.s += (.9 + g.wave * .08) * dt; const i = Math.min(59, Math.floor(e.s)), t = e.s - i, a = g.path[i], b = g.path[i + 1]; e.x = a.x + (b.x - a.x) * t; e.z = a.z + (b.z - a.z) * t; e.y = gh(e.x, e.z); e.h = Math.atan2(b.z - a.z, b.x - a.x); e.ph += dt * 9; if (e.s >= 59.9) { e.hp = 0; g.lives--; voice(3, .8) } }
      if (G.hit.e) { const d = Math.min(...g.path.map(p => dist(p, G))); if (g.coins < 60) say("Not enough coins"); else if (d > .05) say("Too far from the trail"); else if (d < .008 || g.tw.some(t => dist(t, G) < .014)) say("Too close"); else { g.coins -= 60; g.tw.push({ x: G.x, z: G.z, y: G.y, cd: 0, h: 0 }) } }
      for (const t of g.tw) { t.cd -= dt; let tg = null, bd = .075; for (const e of g.en) { const d = dist(e, t); if (d < bd && e.hp > 0) { bd = d; tg = e } } if (tg) { t.h = Math.atan2(tg.z - t.z, tg.x - t.x); if (t.cd <= 0) { t.cd = .7; tracer([t.x, t.y + .017, t.z], [tg.x, tg.y + .002, tg.z]); gun(0); if (--tg.hp <= 0) { g.coins += 12; g.score++ } } } }
      g.en = g.en.filter(e => e.hp > 0); if (g.lives <= 0) finish(g, "The flag fell on wave " + g.wave)
    },
    draw(G, g, D) { for (let i = 0; i < 60; i += 2) line(D, [g.path[i].x, g.path[i].y + .0006, g.path[i].z], [g.path[i + 1].x, g.path[i + 1].y + .0006, g.path[i + 1].z], YEL, 2, 1.2); for (const e of g.en) wolf(D, e); for (const t of g.tw) prop(D, "tower", t.x, t.y, t.z, t.h); const f = g.path[60]; prop(D, "flag", f.x, f.y, f.z, 0, [.1, .4, .9], 1.5) },
    status: (G, g) => "Wave " + g.wave + "/6  ·  Coins " + g.coins + "  ·  Lives " + g.lives + "  ·  Kills " + g.score },

  { id: "artillery", n: "Turn-based strategy (artillery)", h: "Take turns to shell the enemy gun. A/D turn, W/S raise or lower the barrel, hold Space to build power and release to fire. Three hits wins. Watch the wind.",
    init(G, g) { const a = flat(null), b = flat(a, .3, .45); g.me = a; g.foe = b; put(G, a); G.lock = 1; G.hide = 1; G.cd = .07; g.yaw = Math.atan2(b.x - a.x, b.z - a.z); g.el = .7; g.pw = 0; g.turn = 0; g.hits = [0, 0]; g.sh = null; g.wind = (R() - .5) * .06; g.err = .12; g.wait = 0; g.fy = g.yaw + Math.PI },
    shoot(g, from, yaw, el, v, who) { g.sh = { x: from.x, y: from.y + .006, z: from.z, vx: Math.sin(yaw) * Math.cos(el) * v, vy: Math.sin(el) * v, vz: Math.cos(yaw) * Math.cos(el) * v, who }; gun(2) },
    tick(G, g, dt) {
      const k = S.keys; G.yaw = g.yaw; G.pit = .22;
      if (g.sh) { const s = g.sh; s.vy -= .25 * dt; s.vx += g.wind * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; G.cx = s.x; G.cy = s.y; G.cz = s.z;
        if (s.y <= gh(s.x, s.z) || Math.abs(s.x) > 1.5 || Math.abs(s.z) > 1.5) { const tg = s.who ? g.me : g.foe, d = dist(s, tg); spark(s.x, s.y, s.z, [1, .5, .1, 1], 20, .04); spark(s.x, s.y, s.z, [.3, .28, .25, 0], 12, .02, 1.5, .002); gun(2); if (d < .022) { g.hits[s.who]++; say(s.who ? "They hit you!" : "Direct hit!") } else say((s.who ? "Their shell" : "Your shell") + " missed by " + Math.round(d * M) + " m"); g.sh = null; g.turn = 1 - s.who; g.wait = 1.6; g.wind = Math.max(-.05, Math.min(.05, g.wind + (R() - .5) * .02)); if (g.hits[0] >= 3) finish(g, "Enemy gun destroyed", 1); else if (g.hits[1] >= 3) finish(g, "Your gun was destroyed") } return }
      G.cx = G.cy = G.cz = null; G.pit = .32; if (g.wait > 0) { g.wait -= dt; return }
      if (g.turn == 0) { g.yaw += ((k.d ? 1 : 0) - (k.a ? 1 : 0)) * dt * .5; g.el = Math.max(.15, Math.min(1.3, g.el + ((k.w ? 1 : 0) - (k.s ? 1 : 0)) * dt * .5)); if (k[" "]) g.pw = Math.min(1, g.pw + dt * .6); else if (g.pw > 0) { this.shoot(g, g.me, g.yaw, g.el, .2 + .45 * g.pw, 0); g.pw = 0 } }
      else { const dx = g.me.x - g.foe.x, dz = g.me.z - g.foe.z, d = Math.hypot(dx, dz), el = .8; g.fy = Math.atan2(dx, dz) + (R() - .5) * g.err; this.shoot(g, g.foe, g.fy, el, Math.sqrt(d * .25 / Math.sin(2 * el)) * (1 + (R() - .5) * g.err * 1.5), 1); g.err *= .7 }
    },
    draw(G, g, D) { prop(D, "cannon", g.me.x, g.me.y, g.me.z, Math.PI / 2 - g.yaw, [1, 1, 1], 1.4); prop(D, "barrel", g.me.x, g.me.y + .003, g.me.z, Math.PI / 2 - g.yaw, [1, 1, 1], 1.4, g.el); prop(D, "cannon", g.foe.x, g.foe.y, g.foe.z, Math.PI / 2 - g.fy, [1, 1, 1], 1.4); prop(D, "barrel", g.foe.x, g.foe.y + .003, g.foe.z, Math.PI / 2 - g.fy, [1, 1, 1], 1.4, .8); beacon(D, g.foe, RED, .05); if (g.sh) glow(D, g.sh.x, g.sh.y, g.sh.z, [1, .8, .4], .0014, 8) },
    status: (G, g) => "You " + g.hits[0] + " – " + g.hits[1] + " Enemy  ·  Barrel " + Math.round(g.el * 57.3) + "°  ·  Power " + bar(g.pw) + "  ·  Wind " + (g.wind > 0 ? "→ " : "← ") + Math.abs(g.wind * 400).toFixed(0) + "  ·  " + (g.sh ? "shell in the air" : g.turn ? "enemy turn" : "your turn") },

  { id: "city", n: "City builder", h: "Grow a town to 60 people. B picks what to build, Enter builds it in front of you. Homes add people, people pay taxes, windmills and barns earn extra.",
    cost: { house0: [100, 4], house1: [160, 7], house2: [130, 5], barn: [150, 0], windmill: [200, 0], silo: [80, 0], tower: [120, 0], tent: [30, 1], crate: [5, 0], rock: [5, 0], flag: [10, 0], tree: [10, 0] },
    list: [["house0", .013, "Cottage"], ["house1", .013, "Town house"], ["house2", .014, "Long house"], ["barn", .017, "Barn"], ["windmill", .011, "Windmill"], ["tent", .006, "Tent"], ["tree", .006, "Tree"]],
    init(G, g) { g.money = 450; g.pop = 0; g.inc = 0; g.k = 0; G.spd = 1.6 },
    tick(G, g, dt) {
      if (G.hit.b) g.k = (g.k + 1) % this.list.length;
      if (G.hit.enter) { const it = this.list[g.k], c = this.cost[it[0]]; if (g.money < c[0]) say("Not enough money (£" + c[0] + ")"); else if (place(it[0], it[1])) { g.money -= c[0]; g.pop += c[1]; g.inc += it[0] == "windmill" ? 4 : it[0] == "barn" ? 3 : 0; say(it[2] + " built") } }
      g.money += dt * (2 + g.pop * .6 + g.inc); if (g.pop >= 60) finish(g, "A town of " + g.pop + " in " + mmss(g.t), 1)
    },
    status(G, g) { const it = this.list[g.k]; return "People " + g.pop + "/60  ·  £" + Math.floor(g.money) + "  (+£" + (2 + g.pop * .6 + g.inc).toFixed(0) + "/s)  ·  Build: " + it[2] + " £" + this.cost[it[0]][0] } },

  { id: "treasure", n: "Adventure (treasure hunt)", h: "Five chests are buried. The reading tells you if you are getting warmer. Press E to dig when you think you are on top of one.",
    init(G, g) { g.ch = []; for (let i = 0; i < 5; i++) g.ch.push(land(G, .06 + i * .02, .16 + i * .05)); g.i = 0; g.last = 9; g.hint = ""; g.digs = 0 },
    tick(G, g, dt) {
      const d = dist(G, g.ch[g.i]); if (Math.abs(d - g.last) > .004) { g.hint = d < g.last ? "warmer" : "colder"; g.last = d } g.d = d;
      if (G.hit.e) { g.digs++; if (d < .012) { g.i++; g.last = 9; voice(6, 1); say("Treasure found!"); spark(G.x, G.y + .002, G.z, [1, .8, .2, 1], 16, .02); if (g.i >= 5) finish(g, "All five chests in " + mmss(g.t) + " with " + g.digs + " digs", 1) } else { say("Nothing here"); spark(G.x, G.y + .001, G.z, [.3, .22, .12, 0], 6, .01, .8, .0012) } }
    },
    draw(G, g, D) { for (let i = 0; i < g.i; i++) prop(D, "crate", g.ch[i].x, g.ch[i].y, g.ch[i].z, i, [.9, .7, .2]) },
    status: (G, g) => "Chests " + g.i + "/5  ·  " + (g.d < .012 ? "RIGHT HERE" : g.d < .03 ? "burning hot" : g.d < .07 ? "hot" : g.d < .14 ? "warm" : "cold") + ", getting " + g.hint + "  ·  " + mmss(g.t) },

  { id: "rpg", n: "Role-playing quest", h: "Talk to the elder under the yellow beam (E). Gather herbs, drive off the wolves (Space swings your weapon), then carry the message. Each task earns experience.",
    init(G, g) { g.npc = land(G, .02, .05); g.npc.seed = .37; g.npc.h = 0; g.st = 0; g.xp = 0; g.cool = 0; g.items = []; g.wolves = [] },
    tick(G, g, dt) {
      const at = dist(G, g.npc) < .012 && G.hit.e; g.cool -= dt; G.hp = Math.min(100, G.hp + dt);
      if (g.st == 0 && at) { g.st = 1; for (let i = 0; i < 5; i++) g.items.push(land(g.npc, .03, .12)); say("“Bring me five moonleaf herbs from the fields.”", 5) }
      else if (g.st == 1) { g.items = g.items.filter(p => { if (dist(p, G) > .007) return true; voice(6, .5); return false }); if (!g.items.length) { g.st = 2; say("Herbs gathered. Return to the elder") } }
      else if (g.st == 2 && at) { g.xp += 100; g.st = 3; const c = land(g.npc, .08, .16); for (let i = 0; i < 3; i++) { const p = land(c, 0, .03); p.hp = 3; g.wolves.push(p) } say("“Wolves are at the flock. Drive them off.”", 5) }
      else if (g.st == 3) { if (G.hit[" "] && g.cool <= 0) { g.cool = .5; const t = fireAt(g.wolves, .014, .9, 0); if (t) { t.hp--; spark(t.x, t.y + .002, t.z, [.7, .1, .1, 0], 5, .01) } }
        for (const w of g.wolves) { const d = dist(w, G); if (d < .12) go(w, G.x, G.z, d < .006 ? 0 : .013, dt); if (d < .007) G.hp -= dt * 9 } g.wolves = g.wolves.filter(w => w.hp > 0); if (G.hp <= 0) finish(g, "The wolves won. Level " + (1 + Math.floor(g.xp / 100))); else if (!g.wolves.length) { g.st = 4; say("Wolves gone. Return to the elder") } }
      else if (g.st == 4 && at) { g.xp += 150; g.st = 5; g.dest = land(g.npc, .25, .4); say("“Carry this message to the far beacon.”", 5) }
      else if (g.st == 5 && dist(G, g.dest) < .012) { g.xp += 150; finish(g, "Quest complete. Level " + (1 + Math.floor(g.xp / 100)) + ", " + g.xp + " XP", 1) }
    },
    draw(G, g, D) { person(D, g.npc, 1.1); if ([0, 2, 4].includes(g.st)) beacon(D, g.npc, YEL); for (const p of g.items) { glow(D, p.x, p.y + .0015, p.z, [.3, 1, .5], .0009, 5); beacon(D, p, GRN, .02, 0) } for (const w of g.wolves) wolf(D, w); if (g.wolves.length) beacon(D, g.wolves[0], RED, .04, 0); if (g.st == 5) beacon(D, g.dest, CYA, .15) },
    status: (G, g) => ["Find the elder", "Herbs left " + g.items.length, "Return to the elder", "Wolves left " + g.wolves.length, "Return to the elder", "Deliver the message"][g.st] + "  ·  Level " + (1 + Math.floor(g.xp / 100)) + "  ·  Health " + bar(G.hp / 100) },

  { id: "stealth", n: "Stealth", h: "Reach the blue beam without being seen. Guards see along the red lines. Hold Shift to creep, which halves how far they can see you.",
    init(G, g) { g.start = { x: G.x, z: G.z }; g.goal = land(G, .25, .4); g.gd = []; g.seen = 0; g.caught = 0; G.sneak = 1; for (let i = 0; i < 8; i++) { const t = (i + 1) / 9, c = { x: G.x + (g.goal.x - G.x) * t, z: G.z + (g.goal.z - G.z) * t }, a = land(c, 0, .06), b = land(a, .04, .08); g.gd.push({ x: a.x, z: a.z, a, b, to: 1, h: 0, seed: .02 + i * .001, wait: 0 }) } face(G, g.goal) },
    tick(G, g, dt) {
      const rng = S.keys.shift ? .03 : .06; let see = false;
      for (const q of g.gd) { const t = q.to ? q.b : q.a; if (q.wait > 0) { q.wait -= dt; q.h += dt * .8 } else { go(q, t.x, t.z, .007, dt); if (dist(q, t) < .004) { q.to = 1 - q.to; q.wait = 2 } } const dx = G.x - q.x, dz = G.z - q.z, d = Math.hypot(dx, dz); if (d < rng && (dx * Math.cos(q.h) + dz * Math.sin(q.h)) / (d || 1) > .82) see = true }
      g.seen = Math.max(0, g.seen + (see ? dt * 1.6 : -dt * .8)); if (g.seen >= 1) { g.seen = 0; g.caught++; put(G, g.start); voice(3, 1); say("Spotted! Back to the start") }
      if (dist(G, g.goal) < .012) finish(g, "Slipped through in " + mmss(g.t) + ", caught " + g.caught + " times", 1)
    },
    draw(G, g, D) { beacon(D, g.goal, CYA, .15); for (const q of g.gd) { person(D, q, 1.05); const y = gh(q.x, q.z) + .003; for (const s of [-.6, .6]) line(D, [q.x, y, q.z], [q.x + Math.cos(q.h + s) * .06, y, q.z + Math.sin(q.h + s) * .06], RED, 1.5, 1.5) } },
    status: (G, g) => "Distance " + Math.round(dist(G, g.goal) * M) + " m  ·  Alert " + bar(g.seen) + "  ·  Caught " + g.caught + (S.keys.shift ? "  ·  creeping" : "") },

  { id: "horror", n: "Horror", h: "It is night. Collect the six lanterns. Something follows you, but it only moves when you are not looking at it. Do not let it reach you.",
    init(G, g) { g.sv = [$("tod").value, $("wx").value]; setControl("tod", "0.50"); setControl("wx", "off"); g.lan = []; for (let i = 0; i < 6; i++) g.lan.push(land(G, .05, .25)); const p = land(G, .12, .2); g.it = { x: p.x, z: p.z, h: 0, seed: .9 }; g.n = 0 },
    end(G, g) { setControl("tod", g.sv[0]); setControl("wx", g.sv[1]) },
    tick(G, g, dt) {
      const it = g.it, dx = it.x - G.x, dz = it.z - G.z, d = Math.hypot(dx, dz), f = fwd(), looking = (dx * f[0] + dz * f[1]) / (d || 1) > .55 && d < .25; g.look = looking;
      if (!looking) { go(it, G.x, G.z, .011 + .0022 * g.n, dt); if (R() < dt * .15) voice(3, Math.min(1, .02 / d)) } if (d < .006) finish(g, "It caught you with " + g.n + " of 6 lanterns");
      g.lan = g.lan.filter(p => { if (dist(p, G) > .008) return true; g.n++; voice(6, .7); const q = land(G, .12, .2); if (dist(it, G) > .2) { it.x = q.x; it.z = q.z } return false }); if (!g.lan.length) finish(g, "All six lanterns. You escaped", 1)
    },
    draw(G, g, D) { for (const p of g.lan) { const k = .8 + .2 * Math.sin(S.TM * 9 + p.x * 50); glow(D, p.x, p.y + .003, p.z, [1, .6, .2], .0014 * k, 2.5); line(D, [p.x, p.y, p.z], [p.x, p.y + .05, p.z], [1, .6, .2], 1.5, .5) } const it = g.it, y = gh(it.x, it.z); person(D, it, 1.7); for (const s of [-1, 1]) glow(D, it.x + Math.cos(it.h) * .0006 - Math.sin(it.h) * s * .00035, y + .0079, it.z + Math.sin(it.h) * .0006 + Math.cos(it.h) * s * .00035, [1, .05, .02], .00016, 3) },
    status: (G, g) => "Lanterns " + g.n + "/6  ·  " + (g.look ? "you are watching it" : dist(g.it, G) < .05 ? "it is very close…" : "it is moving") },

  { id: "golf", n: "Sports (golf)", h: "Three holes. A/D aim, W/S change loft, hold Space to build power and release to hit. Fewest strokes wins. Water costs a stroke.",
    init(G, g) { g.hole = 0; g.str = 0; g.tot = 0; G.lock = 1; G.hide = 1; G.cd = .045; this.tee(G, g, flat(null)) },
    tee(G, g, from) { g.cup = flat(from, .12, .22); g.b = { x: from.x, z: from.z, y: gh(from.x, from.z), vx: 0, vy: 0, vz: 0, rest: 1 }; g.safe = { x: from.x, z: from.z }; g.yaw = Math.atan2(g.cup.x - from.x, g.cup.z - from.z); g.loft = .6; g.pw = 0 },
    tick(G, g, dt) {
      const k = S.keys, b = g.b; G.cx = b.x; G.cy = b.y; G.cz = b.z; G.yaw = g.yaw; G.pit = .3;
      if (b.rest) { g.yaw += ((k.d ? 1 : 0) - (k.a ? 1 : 0)) * dt * .7; g.loft = Math.max(.15, Math.min(1.1, g.loft + ((k.w ? 1 : 0) - (k.s ? 1 : 0)) * dt * .5)); if (k[" "]) g.pw = Math.min(1, g.pw + dt * .7); else if (g.pw > 0) { const v = .03 + .22 * g.pw; b.vx = Math.sin(g.yaw) * Math.cos(g.loft) * v; b.vz = Math.cos(g.yaw) * Math.cos(g.loft) * v; b.vy = Math.sin(g.loft) * v; b.rest = 0; b.y += .0002; g.pw = 0; g.str++; g.safe = { x: b.x, z: b.z }; gun(0) } return }
      for (let n = 0; n < 2; n++) { const h = dt / 2; b.vy -= .3 * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; const gy = gh(b.x, b.z);
        if (b.y <= gy) { b.y = gy; const e = .003, nx = (gh(b.x - e, b.z) - gh(b.x + e, b.z)) / (2 * e), nz = (gh(b.x, b.z - e) - gh(b.x, b.z + e)) / (2 * e); if (b.vy < -.02) { b.vy = -b.vy * .35; b.vx *= .7; b.vz *= .7 } else { b.vy = 0; b.vx += (nx * .12 - b.vx * 1.6) * h; b.vz += (nz * .12 - b.vz * 1.6) * h } } }
      const sp = Math.hypot(b.vx, b.vz), dc = dist(b, g.cup), wet = ghLand(b.x, b.z) < seaY();
      if (dc < .006 && sp < .06 && b.y - gh(b.x, b.z) < .002) { g.tot += g.str; say("Holed in " + g.str + "!"); voice(6, 1); g.hole++; g.str = 0; if (g.hole >= 3) finish(g, "Round finished in " + g.tot + " strokes (par 12)", g.tot <= 12); else this.tee(G, g, g.cup) }
      else if (wet || outside(b.x, b.z, .01)) { g.str++; say("Out of play: one stroke penalty"); Object.assign(b, { x: g.safe.x, z: g.safe.z, y: gh(g.safe.x, g.safe.z), vx: 0, vy: 0, vz: 0, rest: 1 }) }
      else if (sp < .004 && b.vy == 0) { b.vx = b.vz = 0; b.rest = 1; g.yaw = Math.atan2(g.cup.x - b.x, g.cup.z - b.z) }
    },
    draw(G, g, D) { const b = g.b; D.fx.push(b.x, b.y + .0005, b.z, .0005, 1, 1, 1, 1, 0); prop(D, "flag", g.cup.x, g.cup.y, g.cup.z, 0, [.9, .1, .1]); D.fx.push(g.cup.x, g.cup.y, g.cup.z, .005, 1, 1, 1, .9, 1); if (b.rest) line(D, [b.x, b.y + .0006, b.z], [b.x + Math.sin(g.yaw) * .03, b.y + .0006 + Math.sin(g.loft) * .012, b.z + Math.cos(g.yaw) * .03], [1, 1, 1], 1.5, 2) },
    status: (G, g) => "Hole " + Math.min(3, g.hole + 1) + "/3  ·  Strokes " + g.str + " (total " + g.tot + ")  ·  To the pin " + Math.round(dist(g.b, g.cup) * M) + " m  ·  Loft " + Math.round(g.loft * 57.3) + "°  ·  Power " + bar(g.pw) },

  { id: "runner", n: "Endless runner", h: "You run on your own and speed up. A/D change lane, Space jumps the rocks. Gold orbs score extra.",
    init(G, g) { g.a = R() * 6.28; g.lane = 0; g.lx = 0; g.ob = []; g.next = g.a + .25; G.lock = 1; g.y = 0; g.vy = 0; g.coins = 0 },
    pos(g, a, lane) { const r = .3 + lane * .008, x = Math.cos(a) * r, z = Math.sin(a) * r; return { x, z, y: gh(x, z) } },
    tick(G, g, dt) {
      const v = .03 + .0012 * g.t; g.a += v / .3 * dt; if (G.hit.a || G.hit.arrowleft) g.lane = Math.max(-1, g.lane - 1); if (G.hit.d || G.hit.arrowright) g.lane = Math.min(1, g.lane + 1); g.lx += (g.lane - g.lx) * Math.min(1, dt * 12);
      if (G.hit[" "] && g.y <= 0) { g.vy = .034; voice(6, .3) } g.vy -= .13 * dt; g.y = Math.max(0, g.y + g.vy * dt);
      while (g.next < g.a + .7) { const n = R() < .3 ? 2 : 1, used = []; for (let i = 0; i < n; i++) { let l; do l = Math.floor(R() * 3) - 1; while (used.includes(l)); used.push(l); g.ob.push({ a: g.next, lane: l, k: 0 }) } if (R() < .6) g.ob.push({ a: g.next + .04, lane: Math.floor(R() * 3) - 1, k: 1 }); g.next += Math.max(.07, .16 - g.t * .0012) + R() * .06 }
      const p = this.pos(g, g.a, -g.lx); G.x = p.x; G.z = p.z; G.y = p.y + g.y; G.yaw = -g.a; G.ph += dt * 14; G.mv = 1;
      for (const o of g.ob) { if (Math.abs(o.a - g.a) * .3 < .0045 && o.lane == g.lane && !o.hit) { if (o.k) { o.hit = 1; g.coins++; voice(6, .5) } else if (g.y < .0028) { finish(g, "Tripped after " + Math.round(g.t * 30 + g.coins * 10) + " points"); gun(2) } } }
      g.ob = g.ob.filter(o => o.a > g.a - .1 && !(o.k && o.hit))
    },
    draw(G, g, D) { for (const o of g.ob) { const p = this.pos(g, o.a, -o.lane); if (o.k) glow(D, p.x, p.y + .003, p.z, [1, .8, .2], .001, 4); else prop(D, "rock", p.x, p.y, p.z, o.a * 7, [1, 1, 1], 1.3) } for (const l of [-1.5, 1.5]) for (let i = 0; i < 14; i++) { const a = this.pos(g, g.a + i * .03 - .06, l), b = this.pos(g, g.a + i * .03 - .03, l); line(D, [a.x, a.y + .0005, a.z], [b.x, b.y + .0005, b.z], [1, 1, 1], 1.5, .8) } },
    status: (G, g) => "Score " + Math.round(g.t * 30 + g.coins * 10) + "  ·  Orbs " + g.coins + "  ·  Speed " + Math.round((.03 + .0012 * g.t) * M * 3.6) + " km/h" },

  { id: "fishing", n: "Simulation (fishing)", h: "Sail to a spot and stop. Space casts. When the float dips, press Space quickly, then hold and release Space to keep the line tension in the middle until the fish is landed. Three minutes.",
    init(G, g) { g.ok = setMode("boat"); g.st = 0; g.kg = 0; g.n = 0; g.best = 0 },
    tick(G, g, dt) {
      if (!g.ok) { finish(g, "This map has no water to fish in. Raise Sea level in Options and try again"); return } const f = fwd(), hit = G.hit[" "]; g.fl = { x: G.x + f[0] * .03, z: G.z + f[1] * .03 };
      if (g.st == 0 && hit) { if (Math.abs(G.v) > .006) say("Stop the boat first"); else { g.st = 1; g.w = 2 + R() * 6; say("Line out…") } }
      else if (g.st == 1) { if (Math.abs(G.v) > .012) { g.st = 0; say("You dragged the line in") } g.w -= dt; if (g.w <= 0) { g.st = 2; g.w = .9; voice(6, 1); say("A bite! Press Space!") } else if (hit) { g.st = 0; say("Reeled in early") } }
      else if (g.st == 2) { g.w -= dt; if (hit) { g.st = 3; g.ten = .5; g.pr = .2; g.fish = R() < .12 ? 3 + R() * 5 : .3 + R() * 2.2 } else if (g.w <= 0) { g.st = 0; say("It got away") } }
      else if (g.st == 3) { g.ten += (S.keys[" "] ? .65 : -.55) * dt + Math.sin(S.TM * (2 + g.fish)) * dt * .35 * Math.min(2, g.fish); g.ten = Math.max(0, Math.min(1, g.ten)); const ok = g.ten > .32 && g.ten < .72; g.pr += (ok ? .28 : -.25) * dt / Math.sqrt(g.fish); if (g.pr >= 1) { g.kg += g.fish; g.n++; g.best = Math.max(g.best, g.fish); g.st = 0; say("Landed a " + g.fish.toFixed(1) + " kg " + (g.fish > 3 ? "pike!" : g.fish > 1.2 ? "trout" : "perch")); voice(6, 1) } else if (g.pr <= 0 || g.ten >= 1) { g.st = 0; say(g.ten >= 1 ? "The line snapped" : "It slipped the hook") } }
      if (g.t >= 180) finish(g, g.n + " fish, " + g.kg.toFixed(1) + " kg. Best " + g.best.toFixed(1) + " kg", g.n >= 3)
    },
    draw(G, g, D) { if (g.st) { const y = seaY() + (g.st == 2 ? -.0003 : Math.sin(S.TM * 3) * .0001); D.fx.push(g.fl.x, y + .0003, g.fl.z, .0005, 1, .2, .1, 1, 0); line(D, [G.x, G.y + .006, G.z], [g.fl.x, y + .0003, g.fl.z], [1, 1, 1], 1, .6); if (g.st > 1) D.fx.push(g.fl.x, y, g.fl.z, .003 + .002 * Math.sin(S.TM * 8), 1, 1, 1, .7, 1) } },
    status: (G, g) => mmss(Math.max(0, 180 - g.t)) + " left  ·  " + g.n + " fish, " + g.kg.toFixed(1) + " kg  ·  " + (["Space to cast", "waiting for a bite…", "BITE! Press Space", "Tension " + bar(g.ten || 0) + " keep it in the middle · landed " + Math.round(Math.max(0, g.pr || 0) * 100) + "%"][g.st]) },

  { id: "horde", n: "Roguelike horde survival", h: "Hold out for three minutes. You fire on your own at the nearest wolf; just keep moving. Pick up the blue gems to level up and gain a random upgrade.",
    init(G, g) { g.en = []; g.gems = []; g.cd = 0; g.rate = .6; g.dmg = 1; g.xp = 0; g.lvl = 1; g.sp = 0 },
    tick(G, g, dt) {
      g.sp -= dt; if (g.sp <= 0) { g.sp = Math.max(.25, 1.3 - g.t * .006); const p = land(G, .13, .17); p.hp = 1 + g.t / 40; g.en.push(p) }
      for (const e of g.en) { const d = dist(e, G); go(e, G.x, G.z, d < .005 ? 0 : .0125 + g.t * .00002, dt); if (d < .006) G.hp -= dt * 14 }
      g.cd -= dt; if (g.cd <= 0 && g.en.length) { let tg = null, bd = .12; for (const e of g.en) { const d = dist(e, G); if (d < bd) { bd = d; tg = e } } if (tg) { g.cd = g.rate; tracer([G.x, G.y + .0045, G.z], [tg.x, tg.y + .002, tg.z]); gun(0); tg.hp -= g.dmg; if (tg.hp <= 0) { g.score++; g.gems.push({ x: tg.x, z: tg.z, y: tg.y }) } } }
      g.en = g.en.filter(e => e.hp > 0); g.gems = g.gems.filter(q => { if (dist(q, G) > .009) return true; g.xp++; return false });
      if (g.xp >= g.lvl * 4) { g.xp = 0; g.lvl++; const u = Math.floor(R() * 4); if (u == 0) g.rate *= .78; else if (u == 1) g.dmg += 1; else if (u == 2) G.spd *= 1.1; else G.hp = Math.min(100, G.hp + 35); say("Level " + g.lvl + ": " + ["faster fire", "more damage", "quicker feet", "healed"][u]); voice(6, .9) }
      if (G.hp <= 0) finish(g, "Overrun after " + mmss(g.t) + " and " + g.score + " kills"); else if (g.t >= 180) finish(g, "Dawn. You held out with " + g.score + " kills", 1)
    },
    draw(G, g, D) { for (const e of g.en) wolf(D, e); for (const q of g.gems) glow(D, q.x, q.y + .0012, q.z, [.2, .5, 1], .0007, 5) },
    status: (G, g) => mmss(Math.max(0, 180 - g.t)) + " to dawn  ·  Level " + g.lvl + "  ·  Kills " + g.score + "  ·  Health " + bar(G.hp / 100) },

  { id: "puzzle", n: "Puzzle (lights out)", h: "Step on a pad to flip it and the pads next to it. Light all nine. Three boards, each scrambled a little more.",
    init(G, g) { g.c = flat(G, .01, .08); g.lv = 0; g.moves = 0; g.on = -1; this.board(g); put(G, { x: g.c.x - .03, z: g.c.z }); face(G, g.c) },
    board(g) { g.s = new Array(9).fill(1); for (let n = 0; n < 3 + g.lv * 2; n++) this.flip(g, Math.floor(R() * 9)); if (g.s.every(v => v)) this.flip(g, 4) },
    flip(g, i) { const x = i % 3, y = (i / 3) | 0; for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = x + a, v = y + b; if (u >= 0 && u < 3 && v >= 0 && v < 3) g.s[v * 3 + u] ^= 1 } },
    pad(g, i) { const x = g.c.x + (i % 3 - 1) * .014, z = g.c.z + (((i / 3) | 0) - 1) * .014; return { x, z, y: gh(x, z) } },
    tick(G, g, dt) {
      let on = -1; for (let i = 0; i < 9; i++) if (dist(this.pad(g, i), G) < .005) on = i;
      if (on != g.on) { g.on = on; if (on >= 0) { this.flip(g, on); g.moves++; voice(6, .4); if (g.s.every(v => v)) { g.lv++; if (g.lv >= 3) finish(g, "All three boards solved in " + g.moves + " moves", 1); else { say("Solved! Next board"); this.board(g); g.on = on } } } }
    },
    draw(G, g, D) { for (let i = 0; i < 9; i++) { const p = this.pad(g, i), c = g.s[i] ? [.3, 1, .4] : [.5, .5, .55]; D.fx.push(p.x, p.y, p.z, .0055, c[0], c[1], c[2], .95, 1); if (g.s[i]) glow(D, p.x, p.y + .0008, p.z, [.3, 1, .4], .0016, 2.5) } },
    status: (G, g) => "Board " + Math.min(3, g.lv + 1) + "/3  ·  Lit " + g.s.filter(v => v).length + "/9  ·  Moves " + g.moves },

  { id: "snake", n: "Arcade (light trail)", h: "You never stop. A/D or the arrow keys steer. Collect orbs to grow your trail, and do not cross it or leave the land.",
    init(G, g) { const p = flat(null, 0, .2); put(G, p); G.auto = 1; G.turn = 1; G.spd = 1.25; g.tr = [{ x: G.x, z: G.z }]; g.orb = land(G, .04, .12); g.len = .1 },
    tick(G, g, dt) {
      const l = g.tr[g.tr.length - 1]; if (dist(l, G) > .0035) g.tr.push({ x: G.x, z: G.z }); while (g.tr.length * .0035 > g.len) g.tr.shift();
      if (dist(G, g.orb) < .009) { g.score++; g.len += .045; g.orb = land(G, .04, .16); voice(6, .6) }
      for (let i = 0; i < g.tr.length - 8; i++) if (dist(g.tr[i], G) < .003) finish(g, "You crossed your own trail at " + g.score + " orbs");
      if (outside(G.x, G.z, .02) || ghLand(G.x, G.z) < seaY() - .001 || (g.px != null && Math.hypot(G.x - g.px, G.z - g.pz) < 1e-6 && g.t > 1)) finish(g, "You ran out of land at " + g.score + " orbs"); g.px = G.x; g.pz = G.z
    },
    draw(G, g, D) { for (let i = 1; i < g.tr.length; i++) { const a = g.tr[i - 1], b = g.tr[i]; line(D, [a.x, gh(a.x, a.z) + .001, a.z], [b.x, gh(b.x, b.z) + .001, b.z], CYA, 4, 1 + 3 * i / g.tr.length) } beacon(D, g.orb, YEL, .06); glow(D, g.orb.x, g.orb.y + .003, g.orb.z, YEL, .0014, 5) },
    status: (G, g) => "Orbs " + g.score + "  ·  Trail " + Math.round(g.len * M) + " m" },

  { id: "taxi", n: "Driving simulation (taxi)", h: "Pick up the waiting passenger under the yellow beam, then drive to the green beam. Stop to pick up and drop off. Five fares; quicker trips pay more.",
    init(G, g) { setMode("car", { tint: [.95, .8, .1] }); g.n = 0; g.cash = 0; g.has = 0; this.fare(G, g) },
    spot(G) { const W = S.W, s = W && W.sites.length ? W.sites[Math.floor(R() * W.sites.length)] : null; return s ? land({ x: s.x, z: s.z }, .01, .04) : land(G, .1, .4) },
    fare(G, g) { g.a = this.spot(G); let n = 0; do g.b = this.spot(G); while (dist(g.a, g.b) < .15 && n++ < 30); g.a.seed = R(); g.a.h = 0; g.has = 0; g.t0 = g.t },
    tick(G, g, dt) {
      const tg = g.has ? g.b : g.a; if (dist(G, tg) < .016 && Math.abs(G.v) < .012) { if (!g.has) { g.has = 1; g.t0 = g.t; voice(6, .7); say("“" + ["The station, please.", "Quick as you can!", "Lovely day for a drive.", "Take the coast road."][Math.floor(R() * 4)] + "”") } else { const pay = 15 + Math.max(0, Math.round(40 - (g.t - g.t0) * 1.2)); g.cash += pay; g.n++; say("Fare paid: £" + pay); voice(6, 1); if (g.n >= 5) finish(g, "Shift over: £" + g.cash + " from five fares", g.cash >= 150); else this.fare(G, g) } }
    },
    draw(G, g, D) { if (!g.has) { person(D, g.a); beacon(D, g.a, YEL, .12) } else beacon(D, g.b, GRN, .14) },
    status: (G, g) => "Fare " + Math.min(5, g.n + 1) + "/5  ·  £" + g.cash + "  ·  " + (g.has ? "Drop-off " : "Pick-up ") + Math.round(dist(G, g.has ? g.b : g.a) * M) + " m" }
];
