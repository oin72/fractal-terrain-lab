// Sound: everything is synthesised with WebAudio (guns, rain/wind/tornado beds, thunder, animal calls).
import { S, $ } from './state.js';
import { CG, CX } from './terrain.js';
import { wxField } from './weather.js';

let AU = null;
export function audioInit() {
  if (!$("snd").checked) return; if (AU) { AU.c.resume(); return }
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return; const c = new A(), m = c.createGain(); m.gain.value = +$("vol").value; m.connect(c.destination);
  const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const lp = (ty, f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = ty; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(m); s.start(); return { g, fl } };
  AU = { c, m, nb, rain: lp("bandpass", 3500, .6), wind: lp("lowpass", 420, .7), roar: lp("lowpass", 110, 1) }
}
export function audioBind() {
  ["pointerdown", "keydown"].forEach(e => addEventListener(e, audioInit));
  $("vol").addEventListener("input", () => { if (AU) AU.m.gain.value = +$("vol").value });
  $("snd").addEventListener("change", () => { if (AU) AU.m.gain.value = $("snd").checked ? +$("vol").value : 0; else audioInit() })
}
const on = () => AU && $("snd").checked;
export function audioTick() {
  if (!on()) return; const wm = $("wx").value, wi = +$("wi").value, L = S.HUNT ? S.HU : S.fly && S.cam ? S.cam : null, lx = L ? L.x : 0, lz = L ? L.z : 0,
    k = wm == "off" ? 0 : Math.max(0, Math.min(1, (wxField(Math.floor((lx + CX) / (2 * CX / CG)), Math.floor((lz + CX) / (2 * CX / CG))) - (.8 - .4 * wi)) / .18)),
    rain = (wm == "snow") ? k * .15 : (wm == "off") ? 0 : k * .5, windA = (.15 + (wm == "off" ? 0 : .5 * wi)) * (1 + k), t = AU.c.currentTime, TW = S.TW; let tor = 0; if (TW && TW[4] > .3) tor = Math.max(0, 1 - Math.hypot(TW[0] - lx, TW[1] - lz) / .9);
  AU.rain.fl.frequency.value = wm == "snow" ? 1200 : 3500; AU.rain.g.gain.setTargetAtTime(rain * .6, t, .3); AU.wind.g.gain.setTargetAtTime(windA * .3, t, .3); AU.roar.g.gain.setTargetAtTime(tor * .9, t, .3)
}
export function gun(w) {
  if (!on()) return; const c = AU.c, t = c.currentTime,
    o = (f0, f1, d, g) => { const s = c.createOscillator(), e = c.createGain(); s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + d); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(e); e.connect(AU.m); s.start(t); s.stop(t + d) },
    ns = (f, d, g, ty) => { const s = c.createBufferSource(); s.buffer = AU.nb; const fl = c.createBiquadFilter(); fl.type = ty || "bandpass"; fl.frequency.value = f; const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl); fl.connect(e); e.connect(AU.m); s.start(t); s.stop(t + d) };
  if (w == 0) { ns(2200, .14, .7); o(180, 50, .12, .6) } else if (w == 1) { ns(1500, .35, .9); o(120, 35, .25, .9) } else if (w == 2) { ns(800, .5, 1); o(90, 30, .4, 1) } else if (w == 3) { o(260, 120, .18, .4); ns(3500, .1, .25, "highpass") } else { ns(2800, .07, .55); o(160, 60, .06, .45) }
}
export function thunder() {
  if (!on()) return; const c = AU.c, t = c.currentTime + .3 + Math.random() * 1.2, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.nb; f.type = "lowpass"; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(60, t + 3);
  g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(.9, t + .1); g.gain.exponentialRampToValueAtTime(.001, t + 3.5); s.connect(f); f.connect(g); g.connect(AU.m); s.start(t); s.stop(t + 4)
}
export function voice(k, v, dth) {
  if (!on() || AU.c.currentTime < (AU.vt || 0)) return; const c = AU.c, t = c.currentTime; AU.vt = t + .12;
  const P = [[1900, 2700, .14, "triangle"], [320, 240, .45, "sawtooth"], [720, 480, .2, "square"], [360, 620, 1.6, "sine"], [1800, 1200, .5, "sawtooth"], [2600, 1900, .7, "triangle"], [3200, 4200, .35, "sine"], [160, 60, 1.4, "sawtooth"]][k], d = dth ? P[2] * 1.8 : P[2], s = c.createOscillator(), f = c.createBiquadFilter(), e = c.createGain();
  s.type = P[3]; s.frequency.setValueAtTime(dth ? P[1] : P[0], t); s.frequency.linearRampToValueAtTime(dth ? P[0] * .6 : P[1], t + d); f.type = "lowpass"; f.frequency.value = k == 1 ? 1200 : k == 2 ? 2500 : k == 7 ? 700 : 6000;
  e.gain.setValueAtTime(.001, t); e.gain.linearRampToValueAtTime(.18 * v, t + .04); e.gain.exponentialRampToValueAtTime(.001, t + d);
  if (k == 3) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = 18; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + d) }
  s.connect(f); f.connect(e); e.connect(AU.m); s.start(t); s.stop(t + d)
}
export function animCall(a) { if (!AU || S.TM < (a.cl || 0)) return; a.cl = S.TM + 4 + Math.random() * 10; const L = S.HUNT ? S.HU : S.fly && S.cam ? S.cam : { x: 0, z: 0 }, d = Math.hypot(a.x - L.x, a.z - L.z); if (d < .6) voice(a.t, 1 - d / .6) }
