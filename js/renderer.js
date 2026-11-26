// WebGL2 renderer. Frame order: sky lookup -> two sun shadow maps -> HDR scene (terrain, trees, grass, creatures)
// -> volumetric clouds (half res) -> composite (sky, water, fog, clouds) -> weather particles -> bloom -> tone map.
import { S, $ } from './state.js';
import { HN, CG, gh } from './terrain.js';
import * as GS from './glsl_scene.js';
import * as GP from './glsl_post.js';
import { noise2D, noise3D } from './noisetex.js';
import { sunLight, skyAmbient, sunDir } from './atmos.js';
import { protoGen, treeGen, treeMesh, leafCanvas } from './trees.js';
import { AT, CRAFT, WPN, HUNTER_PAL } from './life.js';
import { weatherLook } from './weather.js';
import { landerInstance, retro } from './lander.js';
import * as GR from './glsl_props.js';
import { MODELS } from './props.js';
import { worldDraw, blocked } from './world.js';

let gl, cv, P = {}, F = {}, TX = {}, FB = {}, W = 0, H = 0, msaa = 4, ok = false;
const UNITS = { uHeight: 0, uSnow: 1, uWx: 2, uSh0: 3, uSh1: 4, uSkyLUT: 5, uNoise: 6, uNoise3: 7, uScene: 8, uDepth: 9, uClouds: 10, uLeaf: 11, uTexA: 12, uTexB: 13, uRoad: 14 };
const SH = 2048, GN = 192, SCR = 15;
const fail = m => { const e = $("err"); e.style.display = "block"; e.textContent = (e.textContent ? e.textContent + "\n" : "") + m; console.error(m) };

function prog(name, vs, fs) {
  const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) fail("Shader " + name + (t == gl.VERTEX_SHADER ? " (vertex)" : " (fragment)") + ": " + gl.getShaderInfoLog(o));
    gl.attachShader(p, o)
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { fail("Link " + name + ": " + gl.getProgramInfoLog(p)); return null }
  p.L = {}; gl.useProgram(p);
  for (const n in UNITS) { const l = gl.getUniformLocation(p, n); if (l) gl.uniform1i(l, UNITS[n]) }
  return p
}
const U = (p, n) => n in p.L ? p.L[n] : (p.L[n] = gl.getUniformLocation(p, n));
function set(p, n, v) {
  const l = U(p, n); if (!l) return;
  if (typeof v == "number") gl.uniform1f(l, v); else if (v.length == 2) gl.uniform2fv(l, v); else if (v.length == 3) gl.uniform3fv(l, v); else if (v.length == 4) gl.uniform4fv(l, v); else gl.uniformMatrix4fv(l, false, v)
}
function use(p) { gl.useProgram(p); for (const n in F) set(p, n, F[n]); return p }
function tex(target, filter, wrap) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + SCR); gl.bindTexture(target, t);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filter == gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrap); if (target == gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, wrap);
  return t
}
const bindU = (u, t, target = gl.TEXTURE_2D) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(target, t) };
function fbo(color, depth) {
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0); else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE) }
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  return f
}
function hdrTex(w, h) { const t = tex(gl.TEXTURE_2D, gl.LINEAR, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h); return t }

let gridVAO, gridN, bladeVAO, quadVAO, emptyVAO, impVAO, impBuf, sprVAO, sprBuf, ribVAO, ribBuf, tornVAO, precipVAO;
let meshes = {}, roadVer = -1;
let trees = null, treeVer = -1, leafTex = [], heightVer = -1, atmoKey = "", atmoVal = null;
const PRECIP_N = 70000;

export function init(canvas) {
  cv = canvas; gl = cv.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" });
  if (!gl) { fail("This browser has no WebGL2, which the renderer needs."); return false }
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) { fail("The graphics driver cannot render to HDR textures (EXT_color_buffer_float missing)."); return false }
  msaa = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  P.terrain = prog("terrain", GS.TERRAIN_VS, GS.TERRAIN_FS); P.terrainSh = prog("terrain shadow", GS.TERRAIN_VS, GS.TERRAIN_SHADOW_FS);
  P.grass = prog("grass", GS.GRASS_VS, GS.GRASS_FS);
  P.tree = prog("tree", GS.TREE_VS, GS.TREE_FS); P.treeSh = prog("tree shadow", GS.TREE_VS, GS.TREE_SHADOW_FS);
  GS.IMP_FS.forEach((fs, i) => P["imp" + i] = prog("creatures " + i, GS.IMP_VS, fs));
  P.prop = prog("props", GR.PROP_VS, GR.PROP_FS); P.propSh = prog("prop shadow", GR.PROP_VS, GR.PROP_SHADOW_FS);
  P.sky = prog("sky", GP.FS_VS, GP.SKYLUT_FS); P.cloud = prog("clouds", GP.FS_VS, GP.CLOUD_FS); P.comp = prog("composite", GP.FS_VS, GP.COMP_FS);
  P.torn = prog("tornado", GP.FS_VS, GP.TORN_FS); P.precip = prog("precipitation", GP.PRECIP_VS, GP.PRECIP_FS);
  P.sprite = prog("sprites", GP.SPRITE_VS, GP.SPRITE_FS); P.ribbon = prog("ribbons", GP.RIBBON_VS, GP.RIBBON_FS);
  P.down = prog("bloom down", GP.FS_VS, GP.DOWN_FS); P.up = prog("bloom up", GP.FS_VS, GP.UP_FS); P.final = prog("final", GP.FS_VS, GP.FINAL_FS);
  if (Object.values(P).some(p => !p)) return false;
  // static textures
  TX.height = tex(gl.TEXTURE_2D, gl.NEAREST, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32F, HN, HN);
  TX.snow = tex(gl.TEXTURE_2D, gl.LINEAR, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, CG, CG);
  TX.wx = tex(gl.TEXTURE_2D, gl.LINEAR, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, CG, CG);
  TX.noise = tex(gl.TEXTURE_2D, gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, noise2D(512)); gl.generateMipmap(gl.TEXTURE_2D);
  const af = gl.getExtension("EXT_texture_filter_anisotropic"); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  TX.noise3 = tex(gl.TEXTURE_3D, gl.LINEAR, gl.REPEAT); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, 64, 64, 64, 0, gl.RG, gl.UNSIGNED_BYTE, noise3D(64));
  TX.sky = tex(gl.TEXTURE_2D, gl.LINEAR, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, 256, 128); FB.sky = fbo(TX.sky);
  TX.sh = [0, 1].map(() => { const t = tex(gl.TEXTURE_2D, gl.LINEAR, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SH, SH); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); return t });
  FB.sh = TX.sh.map(t => fbo(null, t));
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  leafTex = [0, 1, 2].map(k => { const t = tex(gl.TEXTURE_2D, gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, leafCanvas(k)); gl.generateMipmap(gl.TEXTURE_2D); return t });
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  bindU(0, TX.height); bindU(1, TX.snow); bindU(2, TX.wx); bindU(3, TX.sh[0]); bindU(4, TX.sh[1]); bindU(5, TX.sky); bindU(6, TX.noise); bindU(7, TX.noise3, gl.TEXTURE_3D);
  TX.road = tex(gl.TEXTURE_2D, gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, HN, HN, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.generateMipmap(gl.TEXTURE_2D); bindU(14, TX.road);
  // geometry
  const vb = (data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b };
  const at = (i, n, stride, off, div) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); if (div) gl.vertexAttribDivisor(i, 1) };
  { const n = GN + 1, v = new Float32Array(n * n * 2), ix = new Uint32Array(GN * GN * 6); let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { v[(j * n + i) * 2] = i - GN / 2; v[(j * n + i) * 2 + 1] = j - GN / 2 }
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const a = j * n + i; ix[k++] = a; ix[k++] = a + 1; ix[k++] = a + n; ix[k++] = a + 1; ix[k++] = a + n + 1; ix[k++] = a + n }
    gridVAO = gl.createVertexArray(); gl.bindVertexArray(gridVAO); vb(v); at(0, 2, 0, 0); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW); gridN = ix.length }
  // blade strips at three levels of detail: 5, 3 and 2 segments
  bladeVAO = [5, 3, 2].map(rows => { const b = []; for (let i = 0; i < rows; i++) b.push(-1, i / rows, 1, i / rows); b.push(0, 1); const v = gl.createVertexArray(); gl.bindVertexArray(v); vb(new Float32Array(b)); at(0, 2, 0, 0); v.n = rows * 2 + 1; return v });
  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  emptyVAO = gl.createVertexArray();
  tornVAO = gl.createVertexArray(); gl.bindVertexArray(tornVAO); vb(quad); at(0, 2, 0, 0);
  precipVAO = gl.createVertexArray(); gl.bindVertexArray(precipVAO); vb(quad); at(0, 2, 0, 0);
  impVAO = gl.createVertexArray(); gl.bindVertexArray(impVAO); vb(quad); at(0, 2, 0, 0); impBuf = vb(new Float32Array(12), gl.DYNAMIC_DRAW); at(1, 4, 48, 0, 1); at(2, 4, 48, 16, 1); at(3, 4, 48, 32, 1);
  sprVAO = gl.createVertexArray(); gl.bindVertexArray(sprVAO); vb(quad); at(0, 2, 0, 0); sprBuf = vb(new Float32Array(9), gl.DYNAMIC_DRAW); at(1, 4, 36, 0, 1); at(2, 4, 36, 16, 1); at(3, 1, 36, 32, 1);
  ribVAO = gl.createVertexArray(); gl.bindVertexArray(ribVAO); ribBuf = vb(new Float32Array(13), gl.DYNAMIC_DRAW); at(0, 3, 52, 0); at(1, 3, 52, 12); at(2, 3, 52, 24); at(3, 4, 52, 36);
  // building and vehicle meshes, each with its own instance buffer
  { const M = MODELS(); for (const k in M) { const d = new Float32Array(M[k]), v = gl.createVertexArray(); gl.bindVertexArray(v); vb(d); at(0, 3, 40, 0); at(1, 3, 40, 12); at(2, 4, 40, 24); const ib = vb(new Float32Array(12), gl.DYNAMIC_DRAW); at(3, 4, 48, 0, 1); at(4, 4, 48, 16, 1); at(5, 4, 48, 32, 1); meshes[k] = { vao: v, ib, n: d.length / 10, count: 0 } } }
  gl.bindVertexArray(null);
  // palettes for the raymarched creatures
  const pal = [0, 1, 2].map(j => { const a = new Float32Array(96); a.set([[.8, .16, .14], [.92, .85, .25], [.3, .31, .36]][j], 90); a.set([[.86, .88, .91], [.08, .62, .7], [.1, .11, .13]][j], 93); AT.forEach((t, i) => a.set(t.pal[j], i * 3)); a.set(HUNTER_PAL[j], 24); CRAFT.forEach((t, i) => a.set(t.pal[j], (10 + i) * 3)); WPN.forEach((t, i) => a.set(t.pal[j], (20 + i) * 3)); return a });
  for (let i = 0; i < 6; i++) { const q = P["imp" + i]; gl.useProgram(q); ["uA", "uB", "uC"].forEach((n, j) => { const l = U(q, n); if (l) gl.uniform3fv(l, pal[j]) }) }
  ok = true; return true
}

function resize(w, h) {
  if (w == W && h == H) return; W = w; H = h;
  for (const k of ["resC", "resD", "cloud", "comp"]) if (TX[k]) gl.deleteTexture(TX[k]); (TX.bloom || []).forEach(t => gl.deleteTexture(t));
  for (const k of ["ms", "res", "cloud", "comp", "compD"]) if (FB[k]) gl.deleteFramebuffer(FB[k]); (FB.bloom || []).forEach(f => gl.deleteFramebuffer(f));
  if (FB.rbC) { gl.deleteRenderbuffer(FB.rbC); gl.deleteRenderbuffer(FB.rbD) }
  FB.rbC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, FB.rbC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, msaa, gl.RGBA16F, w, h);
  FB.rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, FB.rbD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, msaa, gl.DEPTH_COMPONENT32F, w, h);
  FB.ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, FB.ms); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, FB.rbC); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, FB.rbD);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) fail("Scene framebuffer incomplete");
  TX.resC = hdrTex(w, h); TX.resD = tex(gl.TEXTURE_2D, gl.NEAREST, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, w, h); FB.res = fbo(TX.resC, TX.resD);
  const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
  TX.cloud = hdrTex(hw, hh); FB.cloud = fbo(TX.cloud); TX.comp = hdrTex(w, h); FB.comp = fbo(TX.comp); FB.compD = fbo(TX.comp, TX.resD);
  TX.bloom = []; FB.bloom = []; let bw = hw, bh = hh; for (let i = 0; i < 6 && bw > 4 && bh > 4; i++) { const t = hdrTex(bw, bh); t.w = bw; t.h = bh; TX.bloom.push(t); FB.bloom.push(fbo(t)); bw >>= 1; bh >>= 1 }
  bindU(8, TX.resC); bindU(9, TX.resD); bindU(10, TX.cloud)
}

function uploadHeight() {
  const d = new Float32Array(HN * HN * 2), A = S.AO.ao, n = S.AO.n, k = (n - 1) / (HN - 1);
  for (let j = 0; j < HN; j++) { const fy = j * k, j0 = Math.min(n - 2, fy | 0), v = fy - j0; for (let i = 0; i < HN; i++) { const fx = i * k, i0 = Math.min(n - 2, fx | 0), u = fx - i0, o = j0 * n + i0, q = (j * HN + i) * 2; d[q] = S.Hn[j * HN + i]; d[q + 1] = (A[o] * (1 - u) + A[o + 1] * u) * (1 - v) + (A[o + n] * (1 - u) + A[o + n + 1] * u) * v } }
  bindU(0, TX.height); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HN, HN, gl.RG, gl.FLOAT, d); heightVer = S.heightVer
}
const snow8 = new Uint8Array(CG * CG);
function buildTrees() {
  if (trees) for (const m of trees) { gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib) }
  trees = [];
  S.SK.forEach((T, k) => { for (let lod = 0; lod < 2; lod++) {
    const data = treeMesh(T, k, lod), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vbf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    [[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 2, 32]].forEach(([i, n, o]) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 40, o) });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    [[4, 0], [5, 16]].forEach(([i, o]) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(i, 1) });
    trees.push({ vao, vb: vbf, ib, n: data.length / 10, type: (k / 4) | 0, ins: [], count: 0 })
  } });
  gl.bindVertexArray(null); treeVer = S.treeVer
}
const LEAFCOL = [[.035, .1, .02], [.065, .15, .025], [.022, .08, .038]];
function drawTrees(p) {
  for (const m of trees) if (m.count) { set(p, "uLeafCol", LEAFCOL[m.type]); bindU(11, leafTex[m.type]); gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.n, m.count) }
}
function lightMat(L, C, R, D) {
  const up = Math.abs(L[1]) > .95 ? [1, 0, 0] : [0, 1, 0]; let lr = [up[1] * L[2] - up[2] * L[1], up[2] * L[0] - up[0] * L[2], up[0] * L[1] - up[1] * L[0]]; const l = Math.hypot(...lr); lr = lr.map(v => v / l);
  const lu = [L[1] * lr[2] - L[2] * lr[1], L[2] * lr[0] - L[0] * lr[2], L[0] * lr[1] - L[1] * lr[0]], tx = 2 * R / SH, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cx = Math.round(dot(lr, C) / tx) * tx, cy = Math.round(dot(lu, C) / tx) * tx, cz = dot(L, C);
  return new Float32Array([lr[0] / R, lu[0] / R, -L[0] / D, 0, lr[1] / R, lu[1] / R, -L[1] / D, 0, lr[2] / R, lu[2] / R, -L[2] / D, 0, -cx / R, -cy / R, cz / D, 1])
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
const fsTri = () => { gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3) };
export const stats = { blades: 0, trees: 0, emis: 1, night: 0 };

// V: { pos, r, u, f, tanHalf, near, far, focus, viewDist, orbit }
export function render(V) {
  if (!ok || !cv.width || !cv.height || !S.Hn) return;
  resize(cv.width, cv.height);
  if (heightVer != S.heightVer) uploadHeight();
  for (let i = 0; i < CG * CG; i++) snow8[i] = S.SNOW[i] * 255;
  bindU(1, TX.snow); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CG, CG, gl.RED, gl.UNSIGNED_BYTE, snow8);
  bindU(2, TX.wx); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CG, CG, gl.RGBA, gl.UNSIGNED_BYTE, S.WX);
  if (S.W && S.W.ver != roadVer) { roadVer = S.W.ver; bindU(14, TX.road); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HN, HN, gl.RGBA, gl.UNSIGNED_BYTE, S.W.tex); gl.generateMipmap(gl.TEXTURE_2D) }
  const wl = weatherLook(), TM = S.TM, TW = S.TW, HU = S.HU, hunt = S.HUNT, land = !!S.LAND, flying = S.fly && !hunt && !land && !S.GAME, rt = retro() ? 1 : 0, LI = land ? landerInstance() : null;

  // ---- light: sun or moon, ambient sky, exposure ----
  const hour = +$("tod").value, sd = sunDir(hour), haze = 1 + 2.5 * wl.over, key = hour.toFixed(3) + "|" + haze.toFixed(2);
  if (key != atmoKey) { atmoKey = key; atmoVal = { sun: sunLight(sd, haze), amb: skyAmbient(sd, haze) } }
  const night = 1 - ss(-.2, -.03, sd[1]);
  let md = [-sd[0] * .6 + .3, Math.max(.25, -sd[1]) + .15, -sd[2] * .6 + .2]; { const l = Math.hypot(...md); md = md.map(v => v / l) }
  let L, Lc;
  if (sd[1] > -.03) { L = [sd[0], Math.max(sd[1], .035), sd[2]]; const l = Math.hypot(...L); L = L.map(v => v / l); Lc = atmoVal.sun.map(v => v * ss(-.03, .04, sd[1])) } else { L = md; Lc = [.011, .014, .022].map(v => v * night) }
  const ambClear = atmoVal.amb.map((v, i) => v + night * [.0035, .005, .009][i]), sunE = Lc.map(v => v * Math.max(L[1], 0));
  const overAmb = [.92, .96, 1].map((t, i) => (sunE[i] * .28 + ambClear[i] * .55) * t * (wl.storm ? .5 : 1));
  let ambSky = mix3(ambClear, overAmb, wl.over); const fl = S.flash; ambSky = ambSky.map((v, i) => v + fl * [.5, .6, .9][i] * 1.5);
  const ambGnd = ambSky.map((v, i) => v * [.34, .31, .26][i] + sunE[i] * .07);
  const lum = c => c[0] * .2126 + c[1] * .7152 + c[2] * .0722, exposure = .85 * Math.pow(lum(sunE) + lum(ambClear) * 1.6 + .004, -.55) * (1 + .35 * wl.over) * (wl.storm ? .72 : 1);

  // ---- camera ----
  const { pos, r, u, f, tanHalf, near, far } = V, asp = W / H, fx = 1 / (tanHalf * asp), fy = 1 / tanHalf, A = (far + near) / (far - near), B = -2 * far * near / (far - near), d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const VP = new Float32Array([fx * r[0], fy * u[0], A * f[0], f[0], fx * r[1], fy * u[1], A * f[1], f[1], fx * r[2], fy * u[2], A * f[2], f[2], -fx * d3(r, pos), -fy * d3(u, pos), -A * d3(f, pos) + B, -d3(f, pos)]);
  const fo = V.focus, vd = V.viewDist;
  // shadow cascades
  const R0 = Math.min(.75, Math.max(.06, 2.5 * vd)), R1 = Math.min(2.2, Math.max(.75, R0 * 4)), D0 = Math.max(1.2, R0 * 3), D1 = 3;
  const LM = [lightMat(L, fo, R0, D0), lightMat(L, fo, R1, D1)], t0 = 2 * R0 / SH, t1 = 2 * R1 / SH;

  Object.assign(F, {
    uVP: VP, uCam: pos, uCamR: r, uCamU: u, uCamF: f, uProj: [tanHalf, asp, near, far], uTime: TM, uRes: [W, H],
    uSunDir: L, uSunCol: Lc, uAmbSky: ambSky, uAmbGnd: ambGnd, uSunTrue: sd, uMoonDir: md,
    uTer: [S.hs, S.sea, $("ring").checked ? 1 : 0, S.hex ? 1 : 0], uHz: $("hz").checked ? 1 : 0,
    uCloud: [wl.base, wl.thick, wl.thr, wl.cloudOn], uWind: [wl.wind[0], wl.wind[1], wl.wind[2], TM * .012], uWxG: [0, wl.over, wl.fog, fl],
    uTorn: TW ? [TW[0], TW[1], TW[4], TW[3]] : [0, 0, 0, 0], uHu: hunt ? [HU.x, HU.z, HU.y, 1] : LI ? [LI[0], LI[2], gh(LI[0], LI[2]), 2.6] : S.GAME && !S.GAME.hide ? [S.GAME.x, S.GAME.z, gh(S.GAME.x, S.GAME.z), S.GAME.mode == "foot" ? 1 : 2.2] : [0, 0, 0, 0], uCl2: [wl.shadow, wl.dens, wl.veil, 38],
    uShM0: LM[0], uShM1: LM[1], uShB: [t0 * 1.6, t0 * 1.2 / D0, t1 * 1.6, t1 * 1.2 / D1]
  });

  // ---- clipmap levels ----
  const c0 = Math.pow(2, Math.round(Math.log2(Math.min(.004, Math.max(.0003, vd * .012))))), lv = [];
  for (let c = c0; ; c *= 2) { lv.push([c, Math.round(fo[0] / (2 * c)) * 2 * c, Math.round(fo[2] / (2 * c)) * 2 * c]); if (96 * c >= 8 || lv.length >= 12) break }
  const drawTerrain = p => {
    gl.bindVertexArray(gridVAO);
    lv.forEach((l, i) => {
      set(p, "uLvl", [l[0], l[1], l[2], i < lv.length - 1 ? 1 : 0]);
      // the coarser level keeps a two-cell overlap under the finer one (where the finer one is fully morphed), so no pixel cracks
      if (i) { const q = lv[i - 1], e = 96 * q[0] - l[0] * 2; set(p, "uHole", [q[1] - e, q[2] - e, q[1] + e, q[2] + e]) } else set(p, "uHole", [9, 9, -9, -9]);
      gl.drawElements(gl.TRIANGLES, gridN, gl.UNSIGNED_INT, 0)
    })
  };

  // ---- trees: sort instances into near (full) and far (light) meshes ----
  const treesOn = $("tr").checked;
  if (treesOn) {
    if (!S.SK) protoGen(); if (treeVer != S.treeVer) buildTrees(); if (!S.TR) { treeGen(); S.TR = S.TR.filter(t => !blocked(t[0], t[2])) }
    const lodD = Math.min(.22, Math.max(.06, vd * .25)); for (const m of trees) m.ins.length = 0;
    for (const t of S.TR) { const d = Math.hypot(t[0] - pos[0], t[1] - pos[1], t[2] - pos[2]), h = Math.sin(t[0] * 7919.3 + t[2] * 10472.7) * 43758.5; trees[t[4] * 2 + (d < lodD ? 0 : 1)].ins.push(t[0], t[1], t[2], t[3], (h - Math.floor(h)) * 6.2832, (h * 7.13) - Math.floor(h * 7.13), 0, 0) }
    for (const m of trees) { m.count = m.ins.length / 8; if (m.count) { gl.bindBuffer(gl.ARRAY_BUFFER, m.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.ins), gl.DYNAMIC_DRAW) } }
    stats.trees = S.TR.length
  }

  // ---- buildings, vehicles, people and game objects ----
  stats.emis = 1 / exposure; stats.night = night;
  const WD = worldDraw(V, night, stats.emis), G = S.GD || null;
  for (const k in meshes) { const m = meshes[k], a = WD.props[k], b = G && G.props && G.props[k], all = a && b ? a.concat(b) : a || b; m.count = all ? all.length / 12 : 0; if (m.count) { gl.bindBuffer(gl.ARRAY_BUFFER, m.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all), gl.DYNAMIC_DRAW) } }
  const drawProps = p => { for (const k in meshes) { const m = meshes[k]; if (m.count) { gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.n, m.count) } } };
  gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true); gl.colorMask(true, true, true, true);
  // ---- 1. sky lookup ----
  gl.disable(gl.DEPTH_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, FB.sky); gl.viewport(0, 0, 256, 128);
  gl.useProgram(P.sky); set(P.sky, "uSunTrue", sd); set(P.sky, "uHaze", haze); fsTri();

  // ---- 2. shadow maps ----
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
  for (let c = 0; c < 2; c++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.sh[c]); gl.viewport(0, 0, SH, SH); gl.clear(gl.DEPTH_BUFFER_BIT);
    let p = use(P.terrainSh); set(p, "uVP", LM[c]); drawTerrain(p);
    if (treesOn) { p = use(P.treeSh); set(p, "uVP", LM[c]); drawTrees(p) }
    p = use(P.propSh); set(p, "uVP", LM[c]); drawProps(p);
  }
  gl.disable(gl.POLYGON_OFFSET_FILL);

  // ---- 3. HDR scene ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.ms); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // grass rings: dense near the focus, sparser and wider with distance
  const grassOn = $("ge").checked && !rt, ext = $("ring").checked ? 1.6 : .56, rings = [];
  let gFar = [0, 0, 0, 0];
  if (grassOn) {
    const Nq = Math.round(256 * Math.sqrt(+$("gq").value) * (S.gdet || 1) / 2) * 2, fl2 = Math.hypot(f[0], f[2]) || 1, sh = V.orbit ? 0 : .55;
    for (let R = Math.min(.6, Math.max(.016, .8 * vd)), k = 0; k < 4; k++, R *= 3) { rings.push({ R, N: Nq, c: [fo[0] + f[0] / fl2 * R * sh, fo[2] + f[2] / fl2 * R * sh] }); if (R >= ext) break }
    const g0 = rings[0]; gFar = [g0.c[0], g0.c[1], g0.R, Math.min(1, .00012 / (2 * g0.R / Nq))]; stats.blades = Nq * Nq * rings.length
  }
  let p = use(P.terrain); set(p, "uGFar", gFar); set(p, "uRetro", rt); drawTerrain(p);
  if (treesOn) { gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); p = use(P.tree); drawTrees(p); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE) }
  p = use(P.prop); set(p, "uNite", [Math.max(night, wl.over * .5), stats.emis]); drawProps(p);
  if (grassOn) {
    p = use(P.grass);
    rings.forEach((g, k) => {
      const pr = k ? rings[k - 1] : null, bv = bladeVAO[2 * g.R / g.N < .0001 ? 0 : 2 * g.R / g.N < .0004 ? 1 : 2]; gl.bindVertexArray(bv);
      set(p, "uG", [g.N, 2 * g.R / g.N, g.R, pr ? pr.R : 0]); set(p, "uGC", [g.c[0], g.c[1], pr ? pr.c[0] : 0, pr ? pr.c[1] : 0]); set(p, "uGQ", [.92, +$("gz").value, k == rings.length - 1 ? 1 : 0, k]);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, bv.n, g.N * g.N)
    })
  }
  // creatures, hunter, craft, weapon
  const imp = [];
  if ($("ae").checked) for (const a of S.AN) {
    if (a.st == "dead" && TM > (a.dd || 0) + 4) continue; if (a.st == "dead" && !a.dd) continue;
    const T = AT[a.t], un = T.au * (hunt ? .45 : 1), air = a.st == "carried" || a.st == "thrown", hop = a.t == 0 && a.mv ? Math.abs(Math.sin(TM * 8 + a.id * 3)) * un * .7 : 0;
    imp.push(a.x, a.y + hop, a.z, un, a.h + (air ? TM * 7 + a.id : 0), a.t, (a.mv || air) ? (a.t > 0 && a.t < 4 && a.ph != null && !air ? a.ph : TM * (a.t == 0 ? 9 : a.t == 4 ? 8 : a.t == 5 ? 5 : a.t == 6 ? 26 : a.t == 7 ? 3.2 : 6) + a.id) : 0, a.st == "dead" ? 2 : (a.t > 3 ? a.gl : a.gz) ? 1 : 0, a.t > 3 && !air ? a.bk || 0 : 0, a.t < 4 && !air ? a.pt || 0 : 0, 0, 0)
  }
  if (hunt && HU.view == 0) imp.push(HU.x, HU.y, HU.z, .0015, Math.PI / 2 - HU.yaw, 8, HU.ph, HU.sw ? 1 : 0, 0, 0, HU.chute || 0, 0);
  if (hunt && HU.view == 1 && !HU.walk) {
    const bob = HU.mv ? Math.sin(HU.ph * 1.2) * .00006 : 0, rc = (HU.rec || 0) * .0004, o = [.0026 - rc, .00062 + bob, -.00082];
    imp.push(pos[0] + f[0] * o[0] + r[0] * o[1] + u[0] * o[2], pos[1] + f[1] * o[0] + r[1] * o[1] + u[1] * o[2], pos[2] + f[2] * o[0] + r[2] * o[1] + u[2] * o[2], .0005, Math.PI / 2 - S.cam.yaw, 20 + HU.wp, 0, 0, 0, -S.cam.pit + (HU.rec || 0) * .08, 0, 0)
  }
  if (LI) imp.push(...LI);
  for (const q of WD.imp) imp.push(q); if (G && G.imp) for (const q of G.imp) imp.push(q);
  if (flying && $("pl").checked) { const c = S.cam, k = +$("cr").value; imp.push(c.x, c.y, c.z, CRAFT[k].cu, Math.PI / 2 - c.yaw, 10 + k, 0, 0, -(c.bank || 0), c.pitch || 0, 0, 0) }
  if (imp.length) {
    const fam = [[], [], [], [], [], []]; for (let i = 0; i < imp.length; i += 12) { const k = imp[i + 5]; fam[k < 3.5 ? 0 : k < 7.5 ? 1 : k < 9.5 ? 2 : k < 19.5 ? 3 : k < 29.5 ? 4 : 5].push(...imp.slice(i, i + 12)) }
    gl.bindVertexArray(impVAO); gl.bindBuffer(gl.ARRAY_BUFFER, impBuf);
    fam.forEach((a, i) => { if (!a.length) return; use(P["imp" + i]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, a.length / 12) })
  }

  // ---- 4. resolve ----
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, FB.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, FB.res); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);

  // ---- 5. clouds, 6. composite ----
  gl.disable(gl.DEPTH_TEST);
  const bolt = S.bolt, flashP = bolt ? [bolt[0][0], bolt[0][1], bolt[0][2], fl] : [0, 0, 0, 0];
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.cloud); gl.viewport(0, 0, Math.max(1, W >> 1), Math.max(1, H >> 1)); p = use(P.cloud); set(p, "uFlashP", flashP); fsTri();
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.comp); gl.viewport(0, 0, W, H); p = use(P.comp); set(p, "uNight", [night, 0, 0, 0]); set(p, "uSunDisc", atmoVal.sun.map(v => v * 420 * ss(-.03, .02, sd[1]))); fsTri();

  if (TW) { const Hh = TW[3] - TW[2]; gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); p = use(P.torn); set(p, "uTB", [TW[0], TW[2], TW[1], TW[4]]); set(p, "uTS", [Hh, wl.base + wl.thick - TW[2], Hh * .36]); set(p, "uDust", [.4, .33, .25]); fsTri(); gl.disable(gl.BLEND) }
  // ---- 7. transparent effects, depth-tested against the scene ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.compD); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const spr = [], rib = [], seg = (a, b, w, c) => { for (const q of [[-1, 0], [1, 0], [-1, 1], [1, 0], [1, 1], [-1, 1]]) rib.push(a[0], a[1], a[2], b[0], b[1], b[2], q[0], q[1], w, c[0], c[1], c[2], c[3]) };
  if (TW) {
    for (let a = 0; a < 28; a++) { const h1 = Math.sin(a * 12.9898) * 43758.5, q1 = h1 - Math.floor(h1), q2 = (h1 * 3.7) - Math.floor(h1 * 3.7), an = TM * (3 + q1 * 3) + a * .9, rr = .012 + .03 * q2; spr.push(TW[0] + Math.cos(an) * rr, TW[2] + .004 + .05 * q1 * (1 + Math.sin(TM * 3 + a)), TW[1] + Math.sin(an) * rr, .0012 + .0022 * q2, .42, .36, .28, .85 * TW[4], 0) }
  }
  if (wl.wm != "off") {
    p = use(P.precip); const Bx = Math.min(1.3, Math.max(.05, vd * 2.2)), pc = V.orbit ? fo : pos;
    set(p, "uPB", [pc[0], pc[1], pc[2], Bx]); set(p, "uPP", [Math.max(.0009, vd * .022), Math.max(.03, vd * .3), 0, .5 + 1.2 * wl.wi]);
    gl.bindVertexArray(precipVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PRECIP_N)
  }
  for (const q of S.PTL) {
    const fq = q.l / q.m;
    if (q.k == 10) spr.push(q.x, q.y, q.z, q.s * (1.6 - fq), q.c[0] / 255, q.c[1] / 255, q.c[2] / 255, Math.min(.8, fq), 0);
    else if (q.k == 11) spr.push(q.x, q.y, q.z, .002 + .006 * (1 - fq), 1, 1, 1, fq * .8, 1); else spr.push(q.x, q.y, q.z, q.s, .12, .1, .08, Math.min(.5, fq * .6), 2)
  }
  if (hunt && HU.sw) spr.push(HU.x, HU.y, HU.z, .0026 + Math.sin(TM * 4) * .0002, 1, 1, 1, .6, 1);
  if (hunt && HU.flash > 0) { const k = Math.min(1, HU.flash * 10) * 40, o = HU.view == 1 ? [.0045, .00075, -.0009] : [.004, 0, -.0006], b = HU.view == 1 ? pos : [HU.x, HU.y + .0047, HU.z]; spr.push(b[0] + f[0] * o[0] + r[0] * o[1] + u[0] * o[2], b[1] + f[1] * o[0] + r[1] * o[1] + u[1] * o[2], b[2] + f[2] * o[0] + r[2] * o[1] + u[2] * o[2], .0009, k, k * .8, k * .4, 1, 3) }
  if ($("ae").checked) for (const a of S.AN) if (a.eat > TM && a.st == "alive") { const un = AT[a.t].au * (hunt ? .45 : 1); spr.push(a.x + Math.cos(a.h) * un, a.y + un * .9, a.z + Math.sin(a.h) * un, un * .14, .75, .08, .08, 1, 0) }
  if (S.FX) for (const q of S.FX) spr.push(q);
  for (const q of WD.fx) spr.push(q); for (const q of WD.fxr) seg(q[0], q[1], q[2], q[3]);
  if (G) { if (G.fx) for (const q of G.fx) spr.push(q); if (G.fxr) for (const q of G.fxr) seg(q[0], q[1], q[2], q[3]) }
  if (S.FXR) for (const q of S.FXR) seg(q[0], q[1], q[2], q[3]);
  for (const t of S.TRC) seg(t.a, t.b, 1.6, [6, 5.6, 4, Math.min(1, t.t * 8)]);
  if (bolt) { const k = 90 * (.5 + .5 * fl); for (let i = 1; i < bolt.length; i++) { seg(bolt[i - 1], bolt[i], 2.2, [k * .92, k * .94, k, 1]); seg(bolt[i - 1], bolt[i], 9, [k * .1, k * .12, k * .2, 1]) } }
  if (spr.length) { p = use(P.sprite); gl.bindVertexArray(sprVAO); gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spr), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, spr.length / 9) }
  if (rib.length) { p = use(P.ribbon); gl.bindVertexArray(ribVAO); gl.bindBuffer(gl.ARRAY_BUFFER, ribBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rib), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, rib.length / 13) }
  gl.depthMask(true); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);

  // ---- 8. bloom ----
  gl.useProgram(P.down); let src = TX.comp, sw = W, sh2 = H;
  TX.bloom.forEach((t, i) => { gl.bindFramebuffer(gl.FRAMEBUFFER, FB.bloom[i]); gl.viewport(0, 0, t.w, t.h); bindU(12, src); set(P.down, "uTexel", [1 / sw, 1 / sh2]); fsTri(); src = t; sw = t.w; sh2 = t.h });
  gl.useProgram(P.up); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = TX.bloom.length - 2; i >= 0; i--) { const t = TX.bloom[i], s = TX.bloom[i + 1]; gl.bindFramebuffer(gl.FRAMEBUFFER, FB.bloom[i]); gl.viewport(0, 0, t.w, t.h); bindU(12, s); set(P.up, "uTexel", [1 / s.w, 1 / s.h]); fsTri() }
  gl.disable(gl.BLEND);

  // ---- 9. tone map to the screen ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(P.final); bindU(12, TX.comp); bindU(13, TX.bloom[0]);
  set(P.final, "uRetro", rt); set(P.final, "uGrade", [exposure, .5 / TX.bloom.length * .22, fl * .025, TM % 10]); fsTri();
  gl.bindVertexArray(null)
}
