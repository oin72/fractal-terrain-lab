// Entry point: UI wiring, cameras (orbit, fly chase-cam, walk/hunt) and the frame loop.
import { S, $ } from './state.js';
import { gen, shade, gh } from './terrain.js';
import * as R from './renderer.js';
import { animStep, flyTick, huntTick, bindLife, bindZoom, tryFire } from './life.js';
import { weatherStep } from './weather.js';
import { audioBind, audioTick } from './audio.js';

const cv = $("c");
function setZoom(z) { S.zoom = Math.max(.4, Math.min(40, z)); $("z").value = 100 * Math.log(S.zoom / .4) / Math.log(100); $("zv").textContent = S.zoom.toFixed(2) }
bindZoom(setZoom);

// Height of whatever is under a point, for keeping the camera out of the ground
function groundAt(x, z) {
  const ring = $("ring").checked, inside = S.hex ? Math.hypot(x, z) < (ring ? 1.2 : .43) : Math.max(Math.abs(x), Math.abs(z)) < (ring ? 1.5 : .5);
  const apron = S.hex ? Math.hypot(x, z) < (ring ? 1.75 : .95) : Math.max(Math.abs(x), Math.abs(z)) < (ring ? 2 : 1);
  return inside || apron ? gh(x, z) : S.sea * S.hs
}
function view() {
  let pos, yaw, pit, tanHalf, focus, vd, orbit = false, fp = false;
  const basis = () => { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit); return { r: [cy, 0, -sy], u: [sp * sy, cp, sp * cy], f: [cp * sy, -sp, cp * cy] } };
  let b;
  if (S.fly) {
    const c = S.cam; yaw = c.yaw; pit = c.pit; tanHalf = .5 / (.95 * S.zoom); b = basis();
    if (S.HUNT) { pos = [c.x, c.y, c.z]; focus = [S.HU.x, S.HU.y, S.HU.z]; fp = S.HU.view == 1; vd = fp ? .02 : .03 }
    else { const D = .16, k = D * .52 * tanHalf; pos = [c.x - b.f[0] * D + b.u[0] * k, c.y - b.f[1] * D + b.u[1] * k, c.z - b.f[2] * D + b.u[2] * k]; focus = [c.x, gh(c.x, c.z), c.z]; vd = .2 }
  } else {
    orbit = true; yaw = S.yaw; pit = S.pit; tanHalf = .3; b = basis(); const d = 1.44 / S.zoom, ty = gh(0, 0) + .01;
    pos = [-b.f[0] * d, ty - b.f[1] * d, -b.f[2] * d]; focus = [0, ty, 0]; vd = d
  }
  const g = groundAt(pos[0], pos[2]); if (!fp && pos[1] < g + (orbit ? .004 : .002)) pos[1] = g + (orbit ? .004 : .002);
  const near = fp ? .0004 : Math.max(.0005, Math.min(.03, (pos[1] - g) * .25));
  return { pos, r: b.r, u: b.u, f: b.f, tanHalf, near, far: 45, focus, viewDist: vd, orbit }
}

// Render scale adapts to the GPU: it drops when frames are slow and recovers when there is headroom
let rs = 1, acc = 0, accN = 0;
function adapt(dt) {
  if (window.FTL && window.FTL.fixedScale) { if (rs != window.FTL.fixedScale) { rs = window.FTL.fixedScale; fit() } return }
  acc += dt; if (++accN < 20) return; const ms = acc / accN * 1000; acc = 0; accN = 0; if (document.hidden) return;
  const old = rs, gd = S.gdet || 1;
  if (ms > 36) { if (rs <= .72 && gd > .45) S.gdet = Math.max(.45, gd * .85); else rs = Math.max(.45, rs * (ms > 70 ? .75 : .88)) }
  else if (ms < 19) { if (rs < 1) rs = Math.min(1, rs * 1.08); else if (gd < 1) S.gdet = Math.min(1, gd * 1.1) }
  if (rs != old) fit()
}
function fit() { const r = $("w").getBoundingClientRect(); let d = Math.min(devicePixelRatio || 1, 1.5) * rs; const px = r.width * r.height * d * d, cap = 2560 * 1440; if (px > cap) d *= Math.sqrt(cap / px); cv.width = Math.max(2, Math.round(r.width * d)); cv.height = Math.max(2, Math.round(r.height * d)) }

let last = 0, frames = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const raw = (t - last) / 1000 || .016, dt = Math.min(.05, raw); last = t; S.TM = t / 1000; adapt(Math.min(raw, .5));
  weatherStep(dt);
  if (S.fly) { if (S.HUNT) huntTick(dt); else flyTick(dt, t) }
  animStep(dt); audioTick();
  R.render(view());
  if (!(frames++ % 30)) { const n = $("ge").checked ? R.stats.blades : 0; $("gqv").textContent = n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1000 | 0) + "k" }
}

// ---------- controls ----------
function bind() {
  const keys = S.keys;
  ["m", "H", "L"].forEach(id => $(id).oninput = gen);
  ["hs", "sea"].forEach(id => $(id).oninput = shade);
  $("nb").onclick = () => { S.seed = (Math.random() * 1e6) | 0; gen() };
  $("seedIn").addEventListener("change", () => { const v = Math.floor(+$("seedIn").value); if (isFinite(v) && v >= 0) { S.seed = v; gen() } });
  ["td", "tt"].forEach(id => $(id).addEventListener("input", () => S.TR = null));
  ["ch", "cc", "ct", "td", "wi", "an"].forEach(id => { const f = () => $(id + "v").textContent = (+$(id).value).toFixed(2); $(id).addEventListener("input", f); f() });
  $("spd").oninput = () => $("spdv").textContent = (+$("spd").value).toFixed(2); $("spd").oninput();
  const gz = () => $("gzv").textContent = (+$("gz").value).toFixed(2); $("gz").addEventListener("input", gz); gz();
  const tod = () => { const h = +$("tod").value % 24, hh = Math.floor(h), mm = Math.round((h - hh) * 60); $("todv").textContent = String(hh).padStart(2, "0") + ":" + String(mm == 60 ? 59 : mm).padStart(2, "0") }; $("tod").addEventListener("input", tod); tod();
  $("z").oninput = () => setZoom(.4 * Math.pow(100, +$("z").value / 100)); setZoom(1);
  cv.addEventListener("wheel", e => { e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * .0015)) }, { passive: false });
  const typing = e => { const t = e.target; return t && (t.tagName == "INPUT" && (t.type == "text" || t.type == "number")) };
  addEventListener("keydown", e => {
    if (typing(e)) return; keys[e.key] = 1; keys[e.key.toLowerCase()] = 1; if (S.HUNT && e.key == " ") e.preventDefault(); if (!S.fly) return; if (e.key.startsWith("Arrow")) e.preventDefault(); if (S.HUNT) return; const s = $("spd");
    if (e.key == "ArrowUp") s.value = +s.value + .02; if (e.key == "ArrowDown") s.value = +s.value - .02; s.oninput()
  });
  addEventListener("keyup", e => { keys[e.key] = 0; keys[e.key.toLowerCase()] = 0 });
  // pointer: drag to look / steer / aim, pinch to zoom, tap to fire
  let dr = null; const ptr = new Map();
  cv.onpointerdown = e => { if (S.HUNT) S.HU.moved = 0; dr = [e.clientX, e.clientY]; ptr.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId) };
  cv.onpointermove = e => {
    if (!dr) return;
    if (ptr.size == 2) { const [p, q] = [...ptr.values()], d0 = Math.hypot(p[0] - q[0], p[1] - q[1]); ptr.set(e.pointerId, [e.clientX, e.clientY]); const [p2, q2] = [...ptr.values()]; setZoom(S.zoom * Math.hypot(p2[0] - q2[0], p2[1] - q2[1]) / (d0 || 1)); return }
    const dx = e.clientX - dr[0], dy = e.clientY - dr[1]; dr = [e.clientX, e.clientY];
    if (S.HUNT) { const HU = S.HU; HU.yaw += dx * .006; HU.pit = Math.max(-.6, Math.min(1.1, HU.pit + dy * .004)); if (Math.abs(dx) + Math.abs(dy) > 1) HU.moved = 1 }
    else if (S.fly) { S.cam.yaw += dx * .006; S.cam.pit = Math.max(-.3, Math.min(1.1, S.cam.pit + dy * .004)); S.manual = performance.now() }
    else { S.yaw += dx * .008; S.pit = Math.max(.02, Math.min(1.45, S.pit + dy * .006)) }
  };
  cv.onpointerup = cv.onpointercancel = e => { if (S.HUNT && !S.HU.moved && e.type == "pointerup") tryFire(); ptr.delete(e.pointerId); dr = ptr.size ? [...ptr.values()][0] : null };
  // options panel: one section open at a time
  const gs = $("groups"); gs.querySelectorAll("details").forEach(d => d.addEventListener("toggle", () => { if (d.open) gs.querySelectorAll("details").forEach(o => { if (o !== d) o.open = false }) }));
  $("ptab").onclick = () => { gs.style.display = gs.style.display == "none" ? "" : "none" };
  $("spb").onclick = loadSpotify;
  new ResizeObserver(fit).observe($("w")); addEventListener("resize", fit)
}
// Spotify: embedded player (log in inside the player; Premium needed for full tracks)
function loadSpotify() {
  const s = $("spl").value; let kind = null, id = null;
  for (const k of ["track", "album", "playlist", "artist", "episode", "show"]) {
    let i = s.indexOf("/" + k + "/"); if (i >= 0) { kind = k; id = s.slice(i + k.length + 2).split("?")[0].split("#")[0].split("/")[0]; break }
    i = s.indexOf("spotify:" + k + ":"); if (i >= 0) { kind = k; id = s.slice(i + k.length + 9).split("?")[0]; break }
  }
  let box = $("mus"); if (!box) { box = document.createElement("div"); box.id = "mus"; $("w").append(box) }
  box.replaceChildren(); if (!kind || !/^[A-Za-z0-9]+$/.test(id)) return;
  const btn = document.createElement("button"); btn.textContent = "♫ minimise"; btn.onclick = () => box.classList.toggle("min");
  const fr = document.createElement("iframe"); fr.src = "https://open.spotify.com/embed/" + kind + "/" + encodeURIComponent(id) + "?utm_source=generator&theme=0";
  fr.width = "300"; fr.height = kind == "track" || kind == "episode" ? "80" : "152"; fr.frameBorder = "0"; fr.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"; fr.loading = "lazy";
  box.append(btn, fr)
}

bind(); bindLife(); audioBind(); fit();
fetch("VERSION").then(r => r.ok ? r.text() : "").then(v => { if (v.trim()) $("ver").textContent = "v" + v.trim() }).catch(() => { });
// Debug handle: FTL.fixedScale = 0.8 pins the render scale (turns the adaptive scaler off)
window.FTL = { S, R };
// Shader compilation and noise generation take a few seconds, so let the page paint a message first
$("hud").textContent = "Preparing landscape…";
setTimeout(() => { if (R.init(cv)) { gen(); requestAnimationFrame(frame) } $("hud").textContent = "" }, 40);
