// Shared mutable state for every module. World units match the original lab:
// the base tile spans [-0.5,0.5] in x and z; one unit is roughly 400 m.
export const $ = id => document.getElementById(id);
export const S = {
  seed: (Math.random() * 1e6) | 0, sd: 0,
  Hn: null, AO: null, heightVer: 0,      // 1024x1024 normalised height + ambient occlusion
  hex: false, edges: null, hs: .28, sea: .3,
  yaw: .6, pit: .3, zoom: 1,
  fly: false, cam: null, keys: {}, TM: 0, manual: -9,
  AN: [], AID: 0, TW: null,
  HUNT: false, HU: { on: 0, cool: 0, kills: 0, view: 0, wp: 0, btn: 0 },
  TRC: [], ARR: [], PTL: [], SNA: [], WL: [],
  SNOW: new Float32Array(48 * 48), WX: new Uint8Array(48 * 48 * 4),
  bolt: null, flash: 0, LS: -1,
  TR: null, SK: null, treeVer: 0,
};
