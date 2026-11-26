// Low-polygon meshes for buildings and vehicles, built from boxes, roofs, cylinders and extruded outlines.
// Local space: +x forward, +y up, +z right, in metres. Vertex = position(3) normal(3) colour(3) material(1).
// Materials: 0 tinted by the instance, 1 fixed colour, 2 window, 4 white lamp, 6 red lamp.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function tri(m, a, b, c, col, mat) {
  const u = sub(b, a), v = sub(c, a); let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l);
  for (const p of [a, b, c]) m.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], mat)
}
const quad = (m, a, b, c, d, col, mat = 1) => { tri(m, a, b, c, col, mat); tri(m, a, c, d, col, mat) };
// box by centre and full size
function box(m, c, s, col, mat = 1) {
  const [x0, y0, z0] = [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2], [x1, y1, z1] = [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2];
  quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, mat); quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, mat);
  quad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, mat); quad(m, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col, mat);
  quad(m, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col, mat); quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, mat)
}
// pitched roof with the ridge along x, sitting on y0, with gable ends filled in the wall colour
function gable(m, c, sx, sz, y0, h, col, wall, over = .4) {
  const x0 = c[0] - sx / 2 - over, x1 = c[0] + sx / 2 + over, z0 = c[2] - sz / 2 - over, z1 = c[2] + sz / 2 + over, z = c[2];
  quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0 + h, z], [x0, y0 + h, z], col); quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y0 + h, z], [x0, y0 + h, z], col);
  for (const x of [c[0] - sx / 2, c[0] + sx / 2]) tri(m, [x, y0, c[2] - sz / 2], [x, y0, c[2] + sz / 2], [x, y0 + h, z], wall[0], wall[1])
}
// frustum along an axis ('x','y','z') from a to b with radii r0, r1
function cyl(m, ax, c, a, b, r0, r1, n, col, mat = 1, caps = true) {
  const P = (t, r, k) => { const u = Math.cos(k) * r, v = Math.sin(k) * r; return ax == "y" ? [c[0] + u, t, c[2] + v] : ax == "x" ? [t, c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, t] };
  const C = t => ax == "y" ? [c[0], t, c[2]] : ax == "x" ? [t, c[1], c[2]] : [c[0], c[1], t];
  for (let i = 0; i < n; i++) { const k0 = i / n * 6.2832, k1 = (i + 1) / n * 6.2832; quad(m, P(a, r0, k0), P(a, r0, k1), P(b, r1, k1), P(b, r1, k0), col, mat); if (caps) { if (r1 > .01) tri(m, C(b), P(b, r1, k0), P(b, r1, k1), col, mat); if (r0 > .01) tri(m, C(a), P(a, r0, k0), P(a, r0, k1), col, mat) } }
}
// extrude an outline in the x-z plane between two heights
function extrude(m, pts, y0, y1, col, mat = 1, deck = col) {
  const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cz = pts.reduce((s, p) => s + p[1], 0) / n;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; quad(m, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], col, mat); tri(m, [cx, y1, cz], [a[0], y1, a[1]], [b[0], y1, b[1]], deck, 1); tri(m, [cx, y0, cz], [a[0], y0, a[1]], [b[0], y0, b[1]], col, mat) }
}
// a row of windows on a wall facing +-z (side) or +-x (end); each window gets a random id in its colour for night lighting
function windows(m, x0, x1, y, z, n, w = 1, h = 1.2, axis = "z") {
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + .5) / n, id = [Math.random(), 0, 0];
    if (axis == "z") quad(m, [x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z], [x - w / 2, y + h, z], id, 2);
    else quad(m, [z, y, x - w / 2], [z, y, x + w / 2], [z, y + h, x + w / 2], [z, y + h, x - w / 2], id, 2) }
}
const W = [1, 1, 1], DK = [.08, .08, .09], TILE = [.5, .2, .13], SLATE = [.2, .22, .26], THATCH = [.55, .45, .25], WOOD = [.33, .22, .13], STONE = [.5, .48, .44], GL = [.3, .5, .6];
function wheels(m, xs, y, z, r, w) { for (const x of xs) for (const s of [-1, 1]) cyl(m, "z", [x, y, 0], s * z - w / 2, s * z + w / 2, r, r, 10, DK) }

function house(kind) {
  const m = [];
  if (kind == 0) { box(m, [0, 1.3, 0], [8, 4.6, 6], W, 0); gable(m, [0, 0, 0], 8, 6, 3.6, 2.6, TILE, [W, 0]); box(m, [2, 5.6, 1], [.8, 2, .8], [.4, .22, .17]); for (const s of [-1, 1]) windows(m, -3.4, 3.4, 1.4, s * 3.02, 3); box(m, [4.02, 1, 0], [.1, 2, 1], WOOD) }
  else if (kind == 1) { box(m, [0, 2.6, 0], [7, 7.2, 7], W, 0); gable(m, [0, 0, 0], 7, 7, 6.2, 2.8, SLATE, [W, 0]); box(m, [-2, 8.4, -1.5], [.9, 2.2, .9], [.35, .2, .16]); for (const s of [-1, 1]) for (const y of [1.3, 4.2]) windows(m, -3, 3, y, s * 3.52, 3); windows(m, -2, 2, 4.2, 3.52, 2, 1, 1.2, "x"); box(m, [3.52, 1, 0], [.1, 2.1, 1.1], [.1, .2, .35]) }
  else { box(m, [0, 1.1, 0], [13, 4.2, 5.5], W, 0); gable(m, [0, 0, 0], 13, 5.5, 3.2, 2.9, THATCH, [W, 0], .7); box(m, [-4, 5.4, 0], [.9, 2, .9], STONE); box(m, [3.5, 5.4, 0], [.9, 2, .9], STONE); for (const s of [-1, 1]) windows(m, -6, 6, 1.3, s * 2.77, 5, .9, 1); box(m, [0, .9, 2.8], [1, 1.9, .1], WOOD) }
  return m
}
function church() {
  const m = []; box(m, [-1, 2.5, 0], [15, 8, 7], STONE); gable(m, [-1, 0, 0], 15, 7, 6.5, 4, SLATE, [STONE, 1]);
  box(m, [9, 6, 0], [5, 15, 5], STONE); cyl(m, "y", [9, 0, 0], 13.5, 21, 3.6, 0, 4, SLATE);
  for (const s of [-1, 1]) windows(m, -8, 6, 2, s * 3.52, 5, .8, 3); windows(m, -1, 1, 8, 11.52, 1, 1, 2.2, "x"); box(m, [11.52, 1.3, 0], [.1, 2.8, 1.6], WOOD); return m
}
function barn() {
  const m = [], R = [.5, .12, .09]; box(m, [0, 2, 0], [14, 6, 9], R); gable(m, [0, 0, 0], 14, 9, 5, 3.6, [.32, .33, .35], [R, 1]);
  box(m, [7.02, 2, 0], [.1, 4, 4], [.75, .72, .65]); for (const s of [-1, 1]) windows(m, -5, 5, 3, s * 4.52, 3, .9, .9); return m
}
function silo() { const m = []; cyl(m, "y", [0, 0, 0], -1, 11, 2.3, 2.3, 12, [.72, .74, .76]); cyl(m, "y", [0, 0, 0], 11, 13, 2.4, 0, 12, [.45, .47, .5]); return m }
function windmill() {
  const m = []; cyl(m, "y", [0, 0, 0], -1, 11, 3.4, 2.1, 10, [.9, .88, .82]); cyl(m, "y", [0, 0, 0], 11, 13.6, 2.5, .3, 10, [.2, .17, .14]);
  box(m, [1.6, 11.6, 0], [2.4, .7, .7], WOOD); box(m, [3.3, .9, 0], [.3, 2, 1.1], WOOD); windows(m, -.5, .5, 5, 2.95, 1, .8, 1); windows(m, -.5, .5, 8, -2.6, 1, .8, 1); return m
}
// sails: origin at the hub, spin axis along +x (instance roll turns them)
function sails() {
  const m = []; cyl(m, "x", [0, 0, 0], -.2, .7, .45, .3, 8, WOOD);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708, c = Math.cos(a), s = Math.sin(a), P = (r, w, x) => [x, c * r - s * w, s * r + c * w];
    quad(m, P(1, -.12, .35), P(10.5, -.12, .35), P(10.5, .12, .35), P(1, .12, .35), WOOD); quad(m, P(2.2, .12, .4), P(10.3, .12, .4), P(10.3, 1.9, .52), P(2.2, 1.9, .52), [.86, .83, .74]);
    for (let k = 0; k < 5; k++) { const r = 2.6 + k * 1.9; quad(m, P(r, .12, .46), P(r + .12, .12, .46), P(r + .12, 1.9, .56), P(r, 1.9, .56), WOOD) } }
  return m
}
function lighthouse() {
  const m = []; cyl(m, "y", [0, 0, 0], -1, 5, 2.6, 2.2, 12, W); cyl(m, "y", [0, 0, 0], 5, 9, 2.2, 1.9, 12, [.75, .1, .08]); cyl(m, "y", [0, 0, 0], 9, 13, 1.9, 1.6, 12, W);
  cyl(m, "y", [0, 0, 0], 13, 13.4, 2.4, 2.4, 12, DK); cyl(m, "y", [0, 0, 0], 13.4, 15.2, 1.1, 1.1, 8, [1, 1, 1], 4); cyl(m, "y", [0, 0, 0], 15.2, 16.6, 1.6, 0, 8, [.6, .1, .08]); return m
}
function jetty() { const m = []; box(m, [12, .9, 0], [26, .3, 3], WOOD); for (let x = 1; x < 25; x += 4) for (const s of [-1, 1]) cyl(m, "y", [x, 0, s * 1.3], -4, 1.3, .22, .22, 6, [.22, .15, .1]); return m }
function station() {
  const m = []; box(m, [0, .5, 0], [34, 1, 4.5], [.55, .55, .55]); box(m, [0, 2.6, 3.4], [12, 3.4, 4], [.75, .62, .45]); gable(m, [0, 0, 3.4], 12, 4, 4.3, 1.6, SLATE, [[.75, .62, .45], 1]);
  windows(m, -5, 5, 1.9, 1.38, 4); box(m, [0, 4, 0], [14, .2, 4.4], [.3, .32, .35]); for (const x of [-6, 0, 6]) cyl(m, "y", [x, 0, -1.6], 1, 4, .12, .12, 6, DK); return m
}
function car() {
  const m = []; box(m, [0, .75, 0], [4.3, .75, 1.8], W, 0); box(m, [-.25, 1.4, 0], [2.3, .6, 1.62], GL, 2); box(m, [-.25, 1.73, 0], [2.2, .08, 1.6], W, 0);
  wheels(m, [1.35, -1.35], .36, .86, .36, .24); for (const s of [-1, 1]) { box(m, [2.16, .8, s * .6], [.05, .2, .36], [1, 1, 1], 4); box(m, [-2.16, .82, s * .6], [.05, .18, .36], [1, 0, 0], 6) } return m
}
function bus() {
  const m = []; box(m, [0, 1.75, 0], [11, 2.7, 2.5], W, 0); box(m, [0, 2.2, 0], [10.4, 1, 2.54], GL, 2); box(m, [5.52, 2.1, 0], [.05, 1.2, 2.2], GL, 2);
  wheels(m, [3.6, -3.2], .5, 1.2, .5, .3); for (const s of [-1, 1]) { box(m, [5.52, .9, s * .9], [.05, .22, .4], [1, 1, 1], 4); box(m, [-5.52, 1, s * .9], [.05, .22, .4], [1, 0, 0], 6) } return m
}
function loco() {
  const m = []; box(m, [0, 2.3, 0], [17, 3, 2.9], W, 0); box(m, [0, 1.25, 0], [17.1, .5, 2.95], [.95, .8, .1]); box(m, [6.6, 2.9, 0], [3.9, 1.1, 2.94], GL, 2); box(m, [-6.6, 2.9, 0], [3.9, 1.1, 2.94], GL, 2);
  box(m, [0, 3.95, 0], [15, .3, 2.2], [.3, .31, .33]); for (const x of [-5.5, 5.5]) box(m, [x, .5, 0], [4.4, 1, 2.6], DK);
  for (const s of [-1, 1]) { box(m, [8.52, 1.6, s * .9], [.05, .3, .4], [1, 1, 1], 4); box(m, [-8.52, 1.6, s * .9], [.05, .3, .4], [1, 0, 0], 6) } return m
}
function carriage() {
  const m = []; box(m, [0, 2.3, 0], [18.5, 3, 2.9], W, 0); for (const s of [-1, 1]) windows(m, -8.4, 8.4, 2.3, s * 1.47, 9, 1.4, 1); box(m, [0, 3.95, 0], [18.3, .3, 2.5], [.5, .52, .55]);
  for (const x of [-6.5, 6.5]) box(m, [x, .5, 0], [3.6, 1, 2.6], DK); return m
}
const hull = (L, B, bow) => [[-L / 2, -B * .42], [L / 2 - bow, -B / 2], [L / 2, 0], [L / 2 - bow, B / 2], [-L / 2, B * .42]];
function fishingBoat() {
  const m = []; extrude(m, hull(9, 3, 2.6), -.7, 1, W, 0, [.5, .4, .3]); box(m, [-1.6, 1.9, 0], [2.4, 1.9, 2], W); windows(m, -.9, .9, 1.9, -.38, 2, .7, .7, "x"); box(m, [-1.6, 2.95, 0], [2.8, .15, 2.3], [.25, .3, .4]);
  cyl(m, "y", [1.4, 0, 0], 1, 5, .08, .06, 6, WOOD); box(m, [3, 1.2, 0], [1.2, .5, 1.2], [.9, .5, .1]); box(m, [-1.6, 3.2, 0], [.15, .15, .15], [1, 1, 1], 4); return m
}
function sailBoat() {
  const m = []; extrude(m, hull(7, 2.2, 2.4), -.5, .7, W, 0, [.75, .7, .6]); cyl(m, "y", [.4, 0, 0], .7, 9.5, .07, .05, 6, [.8, .8, .8]);
  tri(m, [.3, 1.6, 0], [-3.2, 1.6, 0], [.3, 9.3, 0], [.95, .95, .92], 1); tri(m, [.5, 1.2, 0], [3.3, 1, 0], [.5, 8, 0], [.95, .95, .92], 1); return m
}
function ship() {
  const m = []; extrude(m, hull(90, 14, 12), -3, 6, W, 0, [.35, .2, .15]); box(m, [-33, 11, 0], [12, 10, 12], W); for (const y of [9, 12, 14.5]) windows(m, -5.5, 5.5, y, -26.98, 6, 1.2, .9, "x");
  cyl(m, "y", [-36, 0, 0], 16, 21, 1.8, 1.5, 8, [.8, .15, .1]);
  const C = [[.7, .15, .1], [.1, .35, .6], [.85, .6, .1], [.2, .5, .3], [.6, .6, .62]]; let k = 0;
  for (let x = -22; x < 30; x += 6.6) for (let z = -4.5; z <= 4.5; z += 3) { const h = 2.6 * (1 + ((k * 7) % 3)); box(m, [x, 6 + h / 2, z], [6.2, h, 2.7], C[(k++ * 3) % 5]) }
  box(m, [-33, 16.3, 0], [.4, .4, .4], [1, 1, 1], 4); return m
}
function airliner() {
  const m = [], B = [.93, .94, .96]; cyl(m, "x", [0, 0, 0], -13, 13, 1.9, 1.9, 10, W, 0); cyl(m, "x", [0, 0, 0], 13, 18, 1.9, .3, 10, W, 0); cyl(m, "x", [0, .5, 0], -22, -13, .35, 1.9, 10, W, 0);
  for (const s of [-1, 1]) {
    quad(m, [4, -.6, s * 1.5], [-3, -.6, s * 1.5], [-9, .5, s * 17], [-6.5, .5, s * 17], B); quad(m, [4, -.9, s * 1.5], [-3, -.9, s * 1.5], [-9, .35, s * 17], [-6.5, .35, s * 17], B);
    quad(m, [-16, .8, s * .8], [-19.5, .8, s * .8], [-21.5, 1.2, s * 6.5], [-20, 1.2, s * 6.5], B); cyl(m, "x", [0, -1.7, s * 6], -2.5, 2, 1, 1.1, 8, [.5, .52, .56]);
    windows(m, -11, 12, .35, s * 1.92, 22, .5, .45); quad(m, [-6.5, .5, s * 17], [-9, .5, s * 17], [-9.6, 2.2, s * 17.3], [-8.4, 2.2, s * 17.3], [.1, .3, .7]); box(m, [-7.5, .5, s * 17], [.4, .2, .2], s < 0 ? [1, 0, 0] : [1, 1, 1], s < 0 ? 6 : 4)
  }
  quad(m, [-15.5, 1.8, 0], [-20, 1.8, 0], [-22.5, 8.5, 0], [-20.5, 8.5, 0], [.1, .3, .7]); cyl(m, "x", [15.4, .5, 0], 14, 16.4, 1.75, 1.2, 8, GL, 2, false); return m
}
function lightPlane() {
  const m = []; cyl(m, "x", [0, 0, 0], -1.5, 2, .7, .65, 8, W, 0); cyl(m, "x", [0, 0, 0], 2, 3, .65, .3, 8, [.2, .2, .22]); cyl(m, "x", [0, .15, 0], -5, -1.5, .15, .7, 8, W, 0);
  box(m, [.6, .85, 0], [1.5, .12, 10.6], W); box(m, [.3, .5, 0], [1.6, .6, 1.2], GL, 2); box(m, [-4.7, .25, 0], [.8, .08, 3.2], W); quad(m, [-4.1, .2, 0], [-5.1, .2, 0], [-5.2, 1.6, 0], [-4.7, 1.6, 0], [.75, .12, .1]);
  for (const s of [-1, 1]) { cyl(m, "y", [.8, 0, s * 1], -1.2, -.4, .05, .05, 5, DK); cyl(m, "z", [.8, -1.25, 0], s * 1 - .08, s * 1 + .08, .25, .25, 8, DK) }
  box(m, [3.05, 0, 0], [.04, .1, 2.2], [.6, .6, .6]); return m
}
function platform() { const m = []; box(m, [0, -.6, 0], [6, 1.2, 6], [.5, .48, .45]); box(m, [0, .02, 0], [5.6, .06, 5.6], [.32, .5, .22]); return m }
function tower() {
  const m = []; cyl(m, "y", [0, 0, 0], -1, 7, 2.2, 1.8, 8, STONE); cyl(m, "y", [0, 0, 0], 7, 8, 2.3, 2.3, 8, [.4, .38, .35]); cyl(m, "x", [0, 8.4, 0], 0, 3, .4, .3, 8, DK); return m
}
function flag() { const m = []; cyl(m, "y", [0, 0, 0], 0, 6, .08, .08, 6, [.9, .9, .9]); quad(m, [0, 6, 0], [0, 4.6, 0], [2.2, 5, 0], [2.2, 5.9, 0], W, 0); return m }
function cannon() { const m = []; box(m, [0, .5, 0], [2.6, 1, 2.2], WOOD); wheels(m, [0], .7, 1.2, .7, .25); return m }
function barrel() { const m = []; cyl(m, "x", [0, 0, 0], -.6, 3.2, .42, .3, 8, DK); return m }
function rock() { const m = []; cyl(m, "y", [0, 0, 0], -.5, 1.1, 1.5, 1, 6, [.36, .35, .33]); cyl(m, "y", [0, 0, 0], 1.1, 1.7, 1, .3, 6, [.4, .39, .37]); return m }
function crate() { const m = []; box(m, [0, .6, 0], [1.2, 1.2, 1.2], W, 0); box(m, [0, .6, 0], [1.26, .16, 1.26], WOOD); return m }
function tent() { const m = []; gable(m, [0, 0, 0], 3.4, 3, 0, 2.1, W, [W, 0], 0); tri(m, [-1.7, 0, -1.5], [-1.7, 0, 1.5], [-1.7, 2.1, 0], [.2, .2, .2], 1); return m }

export const MODELS = () => ({
  house0: house(0), house1: house(1), house2: house(2), church: church(), barn: barn(), silo: silo(), windmill: windmill(), sails: sails(), lighthouse: lighthouse(), jetty: jetty(), station: station(),
  car: car(), bus: bus(), loco: loco(), carriage: carriage(), fishingBoat: fishingBoat(), sailBoat: sailBoat(), ship: ship(), airliner: airliner(), lightPlane: lightPlane(),
  platform: platform(), tower: tower(), flag: flag(), cannon: cannon(), barrel: barrel(), rock: rock(), crate: crate(), tent: tent()
});
