// Weather simulation on a 48x48 grid: drifting precipitation cells, snow build-up, tornado path and lightning.
// The renderer reads S.WX (cell intensity and type), S.SNOW, S.TW, S.bolt and S.flash.
import { S, $ } from './state.js';
import { CG, CX, hh, vn, gh, mulberry } from './terrain.js';
import { thunder } from './audio.js';

// Independent, drifting, pulsing weather-cell field (not tied to the cloud layer)
export function wxField(i, j) {
  const x = -CX + (i + .5) * 2 * CX / CG, z = -CX + (j + .5) * 2 * CX / CG, t = S.TM,
    n = .6 * vn(x * 2.2 + t * .03 + 900, z * 2.2 - t * .02 + 900) + .4 * vn(x * 5 + t * .06 + 1500, z * 5 - t * .05 + 1700),
    g = .5 + .5 * Math.sin(t * .22 + hh(i >> 2, (j >> 2) + 400) * 40); return n * (.55 + .6 * g)
}
export function weatherStep(dt) {
  const wm = $("wx").value, wi = +$("wi").value, WX = S.WX, TM = S.TM, ch = +$("ch").value, cell = 2 * CX / CG, hs = S.hs;
  S.TW = null; S.SNA = []; S.WL = []; WX.fill(0);
  if (wm != "off") {
    for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) {
      const nz = wxField(i, j), k = Math.min(1, (nz - (.8 - .4 * wi)) / .18); if (k <= 0) continue;
      const cx = -CX + (i + .5) * cell, cz = -CX + (j + .5) * cell, top = ch * .85 + .12 * hh(i, j + 1000), gc = gh(cx, cz); if (top < gc + .03) continue;
      let ty = wm; if (wm == "storm" || wm == "tornado") ty = "rain";
      if (wm == "mixed") { const tv = vn(cx * 2.5 + 600 + TM * .02, cz * 2.5 + 600) * 1.3 - .35 * gc / hs; ty = tv > .62 ? "rain" : tv > .5 ? "sleet" : "snow" }
      if (ty == "snow") S.SNA.push(i + j * CG); if (k > .6 && ty == "rain" && (wm == "storm" || wm == "tornado" || wm == "mixed")) S.WL.push([cx, cz, gc, top]);
      const o = (j * CG + i) * 4; WX[o] = k * 255; WX[o + 1] = ty == "snow" ? 255 : ty == "sleet" ? 128 : 0
    }
    const life = wm == "tornado" ? 1 : wm == "mixed" && wi > .5 ? Math.max(0, Math.min(1, (Math.sin(TM * .1) - .2) * 3)) : 0;
    if (life > 0) { const bx = .2 * Math.sin(TM * .05 + 1) + .1 * Math.sin(TM * .13), bz = .2 * Math.cos(TM * .04) + .08 * Math.cos(TM * .11 + 2), g = gh(bx, bz), top = Math.min(Math.max(ch + .03, g + .15), g + .45); S.TW = [bx, bz, g, top, life] }
  }
  // Snow: cells under snow weather build up cover (~11 s to full) and melt slowly otherwise
  const on = new Set(S.SNA), SN = S.SNOW;
  for (let k = 0; k < CG * CG; k++) { const v = SN[k]; if (on.has(k)) SN[k] = Math.min(1, v + dt * .09); else if (v > 0) SN[k] = Math.max(0, v - dt * .004) }
  // Lightning: a jagged bolt from a strong rain cell, by repeated midpoint displacement
  S.bolt = null; S.flash = 0;
  if (S.WL.length) {
    const sl = Math.floor(TM * .9), ph = TM * .9 - sl;
    if (ph <= .22 && hh(sl, 3) <= .45) {
      if (sl != S.LS) { S.LS = sl; thunder() }
      const r = mulberry(sl * 7919 + 13), c = S.WL[Math.floor(r() * S.WL.length)];
      let pts = [[c[0], c[3], c[1]], [c[0] + (r() - .5) * .04, c[2], c[1] + (r() - .5) * .04]], off = .05;
      for (let l = 0; l < 5; l++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; n.push([(a[0] + b[0]) / 2 + (r() - .5) * off, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + (r() - .5) * off], b) } pts = n; off *= .55 }
      S.bolt = pts; S.flash = 1 - ph / .22
    }
  }
}
// Wind and sky numbers derived from the weather controls
export function weatherLook() {
  const wm = $("wx").value, wi = +$("wi").value, b = { off: 0, rain: .55, snow: .3, sleet: .7, storm: 1.1, tornado: 1.2, mixed: .75 }[wm], ang = S.TM * .04 + .7;
  const cl = $("cl").checked, cc = +$("cc").value, storm = wm == "storm" || wm == "tornado";
  const over = Math.max(cl ? cc * cc * .75 : 0, wm == "off" ? 0 : (storm ? .6 : .4) + .4 * wi);
  const fog = .06 + ({ off: 0, rain: .04 + .1 * wi, snow: .06 + .2 * wi, sleet: .05 + .14 * wi, storm: .05 + .12 * wi, tornado: .05 + .1 * wi, mixed: .04 + .12 * wi }[wm]);
  return {
    wm, wi, storm, over, fog, wind: [Math.cos(ang), Math.sin(ang), (.2 + b * (.35 + .65 * wi)) * .55],
    cloudOn: cl ? 1 : 0, thr: .74 - .38 * cc, base: +$("ch").value, thick: Math.max(+$("ct").value, .05) + (storm ? .2 : 0),
    dens: storm ? 1.7 : wm == "off" ? 1 : 1.3, veil: wm == "off" ? 0 : wm == "snow" ? .5 + 1.1 * wi : .7 + 1.6 * wi, shadow: storm ? 4.5 : 2.8
  }
}
