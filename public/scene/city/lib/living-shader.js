// The "living photo" backdrop shader, shared by the living and depth variants.
//
// Everything animated is a pure function of absolute time T (seconds) and trainT (seconds since the S-Bahn sound
// started, or -1). Nothing accumulates, so a tab that was hidden for an hour simply resumes at the right state.
// The few values that are the same for every pixel (where the aircraft are, the train's extent, the beacons'
// on/off, the failing lamp's state, texture drift offsets) are computed once per frame in frameUniforms() below:
// a few dozen flops, no loops over anything. The rest is per pixel on the GPU.
//
// Photo space: full-res pixel coordinates of tex/berlin.jpg (3840 x 3201, y down). A tiny camera model maps
// photo pixels to 3D and back: f = 2451 px/rad in both axes (the shipped cylinder mapping), the horizon row is the
// tracks' vanishing row (y = 2090), and the photographer stands HG = 12 m above the rails (fitted to the track gauge).
//
// The depth variant switches on four extras, each a flag of its own (the living variant has none of them, and its
// shaders are exactly what they were): depthMap, the photo's depth from assets/depth.png, so masts, signals and
// buildings move as solid things when the camera does; trains, more of them, with headlights, glints on the wet rails,
// and masts that pass in front of them; weather, showers that come and go, thickening the rain and hazing the far
// city; mist, low banks of it drifting over the yard.
import { GLSL_COMMON } from "./common.js";
import { EVENING, inCurfew } from "./night.js";

export const PHOTO = { W: 3840, H: 3201, F: 3840 / (47 / 30), CX: 1920, YH: 2090, HG: 12 };
const { F, CX, YH } = PHOTO;

// back-project two photo pixels on the road to the ground plane, so the road is a straight 3D line
function ground(px, py) {
  const { F, CX, YH, HG } = PHOTO; const rho = F * HG / (py - YH), a = (px - CX) / F;
  return [rho * Math.sin(a), -HG, -rho * Math.cos(a)];
}
const f3 = v => `vec3(${v.map(x => x.toFixed(4)).join(",")})`;

// ------------------------------------------------------------------------------------------ per frame, on the CPU
const fract = x => x - Math.floor(x);
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function hash11(p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }   // same as the GLSL one

const CAR_CELL = 72, CAR_WRAP = 256;   // the traffic pattern repeats every 256 cells (18 km of road, ~30 min)
const LANE_V = [10.5, 9.6];            // m/s, toward the viewer / away
// One approach every ~3 min descending toward the northwest (right of the TV tower), seen from behind: steady
// white tail light, red beacon, white strobes. Now and then a high crossing. Positions in metres, eye at origin.
// Approaches (lands) keep the night curfew: whether one flies is decided by the Berlin hour at its cycle's start,
// so none ever vanishes halfway.
const PLANES = [
  { per: 190, seed: 1, off: 610, p0: [-150, 640, -2100], p1: [1250, 210, -8600], dur: 105, gain: 1, lands: true },   // off: first one ~40 s after load
  { per: 410, seed: 5, off: 0, p0: [-9000, 2600, -7000], p1: [7000, 2600, -9000], dur: 170, gain: 3 },
];
// The S-Bahn leaves toward the station on the left bundle: the front clears the sill line (~120 m out) as the
// sound turns loud (~5.5 s) and the tail clears it as the loud part ends (~14 s); then it slows and fades out
// before the next train can start (the site schedules them 42-67 s apart).
function trainFront(t) {
  const v0 = 17.8, t1 = 20, acc = .55;
  const tb = Math.min(Math.max(t - t1, 0), v0 / acc);
  return 22 + v0 * Math.min(t, t1) + v0 * tb - .5 * acc * tb * tb;
}
// The train's box in the track frame (shared with the shader) and the track's azimuth, for its photo-space extent.
const TRAIN = { XT: -7.1, W: 1.5, Y0: .45, Y1: 3.75, LEN: 147 };
const VPA = (1576 - CX) / F;           // azimuth of the tracks' vanishing point
// photo-px bounding box of the box x in [XT-W, XT+W], height [Y0, Y1] above the rails, s in [s0, s1] along the
// track. The footprint never contains the eye, so the extremes of the cylindrical projection are at corners.
function trainBox(s0, s1, out) {
  const { XT, W, Y0, Y1 } = TRAIN, HG = PHOTO.HG, cv = Math.cos(VPA), sv = Math.sin(VPA);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k < 8; k++) {
    const x = XT + (k & 1 ? W : -W), y = -HG + (k & 2 ? Y1 : Y0), s = k & 4 ? s1 : s0;
    const wx = x * cv + s * sv, wz = -s * cv + x * sv, rho = Math.hypot(wx, wz);
    const px = CX + F * Math.atan2(wx, -wz), py = YH - F * y / rho;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  const m = 8 * 1.4 * Math.max(1, .09 * F / Math.max(s0, 20)) + 2;   // room for the tail lights' glow
  out.set(x0 - m, y0 - m, x1 + m, y1 + m);
}

// ------------------------------------------------------------------------------------ more trains (depth variant)
// Three slots. Slot 0 is the S-Bahn the room plays the sound of (trainT), leaving on the left bundle as above. The
// others keep a timetable of their own, a pure function of T like the aircraft: an S-Bahn coming in on the next track
// every few minutes, braking for the station behind the viewer, and now and then a regional or a long-distance train on
// the main line further left, either way. Trains keep to the right, as in Germany: leaving (away from the viewer) on
// the right-hand track of a pair, arriving on the left one. Offsets xt are metres in the track frame, left negative.
export const TRAIN_KINDS = [
  { W: 1.5, Y0: .2, Y1: 3.75, LEN: 147, CAR: 18.4 },      // S-Bahn: ochre over red, eight cars
  { W: 1.45, Y0: .2, Y1: 3.9, LEN: 201, CAR: 28.7 },      // long-distance: white with a red band, seven cars
  { W: 1.4, Y0: .2, Y1: 4.6, LEN: 135, CAR: 27 },         // regional: red double-deck coaches, five
];
const FAR = 1100;         // past this the tracks run into the station's glare: trains fade in and out there
const LINES = [
  // an S-Bahn arriving, out of the far glare at 17 m/s and braking to 9 m/s under the bridge; the first one shows its
  // lights a few seconds after the page opens
  { per: 170, seed: 3, first: 6, xt: [-10.3], dir: [-1], kinds: [0], v: [17, 9], skip: .15 },
  // the main line: v is [far, near] speed (out of or into the station); the first one leaves about a minute in
  { per: 290, seed: 8, first: 62, xt: [-13.9, -17.2], dir: [1, -1], kinds: [1, 2], v: [14, 19], skip: .2 },
];
// photo-px bounding box of a box in the track frame (x across, y up from the eye, s along); its footprint never
// holds the eye, so the extremes of the cylindrical projection are at its corners
function trackBox(xa, xb, ya, yb, s0, s1, b) {
  const cv = Math.cos(VPA), sv = Math.sin(VPA);
  for (let k = 0; k < 8; k++) {
    const x = k & 1 ? xb : xa, y = k & 2 ? yb : ya, s = k & 4 ? s1 : s0;
    const wx = x * cv + s * sv, wz = -s * cv + x * sv, rho = Math.hypot(wx, wz);
    const px = CX + F * Math.atan2(wx, -wz), py = YH - F * y / rho;
    b[0] = Math.min(b[0], px); b[2] = Math.max(b[2], px); b[1] = Math.min(b[1], py); b[3] = Math.max(b[3], py);
  }
}
// photo px of a point in the track frame
function trackPx(x, y, s, out, o) {
  const wx = x * Math.cos(VPA) + s * Math.sin(VPA), wz = -s * Math.cos(VPA) + x * Math.sin(VPA);
  out[o] = CX + F * Math.atan2(wx, -wz); out[o + 1] = YH - F * y / Math.hypot(wx, wz);
}
const LPX = new Float32Array(6);
// one slot's train: A = (near end, far end, visibility, track offset), C = (direction, kind), B its patch box,
// E and G its near end's lamps in photo px (E: two low ones; G: the high one, the glow radius and the strength)
function trainSlot(sN, vis, xt, dir, kind, A, C, B, E, G) {
  const K = TRAIN_KINDS[kind], HG = PHOTO.HG, sF = sN + K.LEN;
  const s0 = Math.max(sN, 24), s1 = Math.min(sF, FAR + 150);
  A.set(sN, sF, vis, xt); C.set(dir, kind, 0, 0);
  if (s1 <= s0 || vis <= 0) { B.set(0, 0, -1, -1); return; }
  const b = [1e9, 1e9, -1e9, -1e9];
  trackBox(xt - K.W, xt + K.W, -HG + K.Y0, -HG + K.Y1, s0, s1, b);
  // the near end's lamps glow; they also shine on the rails and the ballast short of it
  if (sN > 24) trackBox(xt - 1.6, xt + 1.6, -HG, -HG + .2, Math.max(24, sN - (dir < 0 ? 90 : 50)), sN, b);
  const rhoE = Math.max(sN, 20), r = Math.max(1, .09 * F / rhoE) * 1.4, m = (dir < 0 ? 22 : 8) * r + 2;
  B.set(b[0] - m, b[1] - m, b[2] + m, b[3] + m);
  // arriving: two white lamps low and one high; leaving: two red ones low
  const lx = dir < 0 ? .95 : 1.05, ly = dir < 0 ? 1.05 : 1.1;
  trackPx(xt - lx, -HG + ly, rhoE - .1, LPX, 0); trackPx(xt + lx, -HG + ly, rhoE - .1, LPX, 2); trackPx(xt, -HG + K.Y1 - .45, rhoE - .1, LPX, 4);
  E.set(LPX[0], LPX[1], LPX[2], LPX[3]); G.set(LPX[4], LPX[5], r, dir < 0 ? 2.2 + 6e4 / (rhoE * rhoE) : 2.4);
}
// per set of uniforms: for each line, the cycle last decided and whether a train runs in it. A cycle is skipped now
// and then, and after midnight more often, as the hour's trainGap says (lib/night.js); decided once per cycle, so a
// train that set off never vanishes when the hour moves on
const RUNS = new WeakMap();
function lineRun(L, li, T, life, U, A, C, B, E, G) {
  const cyc = Math.floor(T / L.per), tc = T - cyc * L.per, h = i => hash11(cyc * 7.31 + L.seed * 13.7 + i * 3.3);
  let runs = RUNS.get(U); if (!runs) RUNS.set(U, runs = LINES.map(() => ({ cyc: NaN, go: true })));
  if (runs[li].cyc !== cyc) { runs[li].cyc = cyc; runs[li].go = cyc === 0 || h(4) >= 1 - (1 - L.skip) / Math.max(1, life.trainGap || 1); }
  const i = cyc === 0 ? 0 : Math.floor(h(1) * L.dir.length), dir = L.dir[i];
  const kind = cyc === 0 ? L.kinds[0] : L.kinds[Math.floor(h(2) * L.kinds.length)], K = TRAIN_KINDS[kind];
  // from the moment one end shows until the other has gone: the near end runs from FAR in to 24 - LEN (arriving), or
  // the far end from 24 out to FAR + LEN (leaving), with the speed changing evenly on the way
  const D = FAR - 24 + K.LEN, v0 = dir < 0 ? L.v[0] : L.v[1], v1 = dir < 0 ? L.v[1] : L.v[0], dur = 2 * D / (v0 + v1);
  const t = tc - (cyc === 0 ? L.first : 4 + h(3) * Math.max(0, L.per - dur - 8));
  if (t < 0 || t > dur || !runs[li].go) { B.set(0, 0, -1, -1); A.z = 0; return; }
  const x = v0 * t + .5 * (v1 - v0) / dur * t * t;
  const sN = dir < 0 ? FAR - x : 24 - K.LEN + x;
  trainSlot(sN, smoothstep(FAR, FAR - 300, sN), L.xt[i], dir, kind, A, C, B, E, G);
}

// showers: `wet` runs from 0 (a light drizzle) to 1 (a downpour). Most 5-minute cycles hold one, placed and sized by a
// hash of the cycle; the first starts 40 s after the page opens, so a short visit sees one come and go
const SHOWER = { per: 300, up: 35, down: 50, base: .12 };
export function showerAt(T) {
  const { per, up, down, base } = SHOWER, cyc = Math.floor(T / per), tc = T - cyc * per, h = i => hash11(cyc * 5.17 + i * 1.91 + .4);
  if (cyc > 0 && h(0) > .8) return base;
  const hold = cyc === 0 ? 45 : 20 + 50 * h(1), peak = cyc === 0 ? .9 : .55 + .45 * h(2);
  const t0 = cyc === 0 ? 40 : 10 + h(3) * (per - up - hold - down - 20);
  const k = smoothstep(t0, t0 + up, tc) * (1 - smoothstep(t0 + up + hold, t0 + up + hold + down, tc));
  return base + (peak - base) * k;
}

export function makeUniforms(THREE, feat = {}) {
  const v4 = () => new THREE.Vector4();
  return {
    uDrift: { value: v4() }, uLane: { value: v4() }, uBea: { value: v4() }, uLamp: { value: v4() },
    uTr: { value: new THREE.Vector3() }, uTrB: { value: v4() }, uPlane: { value: [v4(), v4()] }, uPlaneF: { value: [v4(), v4()] },
    uLife: { value: new THREE.Vector4(EVENING.winOff, EVENING.tv, 0, 0) },
    ...(feat.trains ? { uTrA: { value: [v4(), v4(), v4()] }, uTrC: { value: [v4(), v4(), v4()] }, uTrBox: { value: [v4(), v4(), v4()] },
      uTrE: { value: [v4(), v4(), v4()] }, uTrG: { value: [v4(), v4(), v4()] } } : {}),
    ...(feat.weather || feat.mist ? { uWx: { value: new THREE.Vector4(SHOWER.base, 0, 1, 0) } } : {}),
    ...(feat.reds ? { uRL: { value: PHOTO_LIGHTS.map(() => v4()) } } : {}),
  };
}

// per set of uniforms: for each aircraft, the cycle last decided and whether it stays on the ground
const GROUNDED = new WeakMap();
// life: the hour's state of the city (lib/night.js); left out, a busy evening. feat: the depth variant's extras.
export function frameUniforms(U, T, trainT, life = EVENING, feat = null) {
  // noise-texture drift: the texture tiles with period 1, so fract() is seamless and keeps float32 exact for days
  U.uDrift.value.set(fract(T * .29), 0, fract(T * .00225), fract(T * .0057));   // x: shimmer; z, w: cloud layers (~.002 and ~.003 of the photo width per second)
  U.uLane.value.set((LANE_V[0] * T) % (CAR_CELL * CAR_WRAP), (LANE_V[1] * T) % (CAR_CELL * CAR_WRAP), fract(T * .5), life.traffic);
  U.uLife.value.set(life.winOff, life.tv, 0, 0);
  // beacons: TV tower, two crane tips, the power-station chimney pair
  U.uBea.value.set(+(fract(T * .47) >= .45), +(fract(T * .31 + .2) >= .5), +(fract(T * .29 + .6) >= .5), +(fract(T * .5 + .25) >= .5));
  // the failing sodium lamp: in 55% of 170 s cycles it drops out at 95 s, re-strikes red at 113 s, warms up by 150 s.
  // The seed gives an irregular run early in a visit: cycles 0-10 go 1 0 1 1 0 1 1 1 0 0 0, so the first dropout is
  // 95 s after load and the next ones don't come like clockwork.
  {
    const per = 170, x = T / per, cyc = Math.floor(x), f = (x - cyc) * per;
    if (hash11(cyc * 11.7 + .13) < .55 && f > 94) {
      if (f < 113) { const k = 1 - smoothstep(95, 96.5, f); U.uLamp.value.set(k, k, k, 1); }
      else { const s = smoothstep(113, 150, f); U.uLamp.value.set(lerp(.55, 1, s), lerp(.1, 1, s), lerp(.06, 1, s), 1); }
    } else U.uLamp.value.set(1, 1, 1, 0);
  }
  // the train
  if (trainT != null && trainT >= 0 && trainT <= 44) {
    const Df = trainFront(trainT), Dr = Df - TRAIN.LEN;
    U.uTr.value.set(Df, Dr, 1 - smoothstep(34, 42, trainT));
    // only pixels in this box run the train's shader; nothing nearer than 24 m is in the photo (its bottom row
    // looks 26 m out), so the box starts there
    if (Df > 24) trainBox(Math.max(Dr, 24), Df, U.uTrB.value); else U.uTrB.value.set(0, 0, -1, -1);
  } else { U.uTr.value.set(0, 0, 0); U.uTrB.value.set(0, 0, -1, -1); }
  // aircraft
  for (let i = 0; i < PLANES.length; i++) {
    const p = PLANES[i], A = U.uPlane.value[i], B = U.uPlaneF.value[i];
    const Tp = T + p.off, cyc = Math.floor(Tp / p.per), tc = Tp - cyc * p.per;
    const tau = (tc - hash11(cyc * 9.13 + p.seed) * (p.per - p.dur)) / p.dur;
    // landings keep the curfew, decided once per cycle from the Berlin time it began (life.sec was read at page time
    // life.T, so it is life.sec + T - life.T now), so an approach that started never vanishes or blinks on a boundary
    let grounded = false;
    if (p.lands && life.curfew) {
      let g = GROUNDED.get(U); if (!g) GROUNDED.set(U, g = PLANES.map(() => ({ cyc: NaN, v: false })));
      if (g[i].cyc !== cyc) { g[i].cyc = cyc; g[i].v = inCurfew((((life.sec + T - life.T - tc) / 3600) % 24 + 24) % 24); }
      grounded = g[i].v;
    }
    if (tau < 0 || tau > 1 || grounded || hash11(cyc * 3.1 + p.seed * 7) > .8) { A.set(-1e5, -1e5, 0, 0); B.set(0, 0, 0, 0); continue; }
    const jx = (hash11(cyc + p.seed) - .5) * 1600, jz = (hash11(cyc * 1.7 + p.seed) - .5) * 1200;
    const W = [lerp(p.p0[0] + jx * .3, p.p1[0] + jx, tau), lerp(p.p0[1], p.p1[1], tau), lerp(p.p0[2] + jz * .3, p.p1[2] + jz, tau)];
    const rho = Math.hypot(W[0], W[2]), dist = Math.hypot(W[0], W[1], W[2]);
    const k = p.gain * 2.4e6 / (dist * dist) * smoothstep(0, .06, tau) * (1 - smoothstep(.85, 1, tau));
    const ph = Tp + p.seed * 3, fs = fract(ph * .83 + .3);
    const beacon = +(fract(ph * .95) <= .07), strobe = +(fs <= .035) + +(Math.abs(fs - .09) <= .017);
    A.set(CX + F * Math.atan2(W[0], -W[2]), YH - F * W[1] / rho, k, 0);
    B.set(2.5 * k * beacon, 5 * k * strobe, 0, 0);
  }
  if (!feat) return;
  if (feat.trains) {
    const A = U.uTrA.value, C = U.uTrC.value, B = U.uTrBox.value, E = U.uTrE.value, G = U.uTrG.value;
    // slot 0: the S-Bahn in sync with the sound, as above
    if (trainT != null && trainT >= 0 && trainT <= 44)
      trainSlot(trainFront(trainT) - TRAIN_KINDS[0].LEN, 1 - smoothstep(34, 42, trainT), TRAIN.XT, 1, 0, A[0], C[0], B[0], E[0], G[0]);
    else { B[0].set(0, 0, -1, -1); A[0].z = 0; }
    lineRun(LINES[0], 0, T, life, U, A[1], C[1], B[1], E[1], G[1]);
    lineRun(LINES[1], 1, T, life, U, A[2], C[2], B[2], E[2], G[2]);
  }
  if (feat.weather || feat.mist) {
    const w = feat.weather ? showerAt(T) : SHOWER.base;
    U.uWx.value.set(w, 0, feat.mist ? .75 + .45 * w : 0, 0);
    U.uDrift.value.y = fract(T * .0021);   // the mist banks drift across the yard, ~.5 m/s
  }
  if (feat.reds) photoLights(U, T, life);
}

// ------------------------------------------------------------------------------------------ the shaders
// The backdrop and three small "lights" draws share one set of uniforms. The backdrop shader does what every
// window pixel needs: the photo, low cloud, the lit windows, the failing lamp and the highlight lift. The lights
// cover only patches of the cylinder where something point-like can be: the road band, the train's box, a
// square around each aircraft and each beacon. They add their light on top of the backdrop (the train with
// alpha). A software rasteriser such as SwiftShader runs every instruction of a shader whatever its branches
// decide, so keeping the rare, local things out of the big shader is what keeps its per-pixel cost down; on a
// GPU it keeps it short.
const ROAD = (() => {
  const A = ground(2360, 2226), B = ground(3300, 2262);
  const dx = B[0] - A[0], dz = B[2] - A[2], dl = Math.hypot(dx, dz);
  return { A, RD: [dx / dl, dz / dl] };
})();
// fixed patches, photo px (x0, y0, x1, y1): the road band, the TV tower's and the two cranes' beacons (their glow
// ends 11, 8 and 8 px out), the chimney pair
const PATCHES = {
  cars: [[2265, 2185, 3840, 2346]],
  beacons: [[2933, 1569, 2962, 1597], [569, 1426, 591, 1448], [981, 1517, 1001, 1537], [1544, 1767, 1644, 1867]],
};
// The lights are drawn in three small draws, so each patch runs only its own code: a software rasteriser would
// otherwise run the traffic code for the aircraft's square too.
export const LIGHT_GROUPS = [["cars"], ["train"], ["planes", "beacons"]];

// The lights baked into the photo that the depth variant switches (reds: true): the red obstruction lights of three
// cranes blink, each crane on its own beat, and those of the two chimneys on the beat of Germany's tall structures;
// the rail signals clear to green now and then; the small METRO sign stutters and the lightbox beside it flutters.
// c: centre, photo px; r: half-size of the soft ellipse that holds the light and its glow; src: where its "off" pixels
// are copied from, photo px away (clean fog or facade, picked by tools/photo_lights.py). A sign instead fills a box,
// rect (x0, y0, x1, y1), fading out over soft px (x, y) past its sides, and leaves cut, its neighbour's box, alone (the
// two touch); for its "off", the fog at src times gain (the colour of the facade just around the sign over the fog's)
// stands in where the photo is brighter than that, so only the letters and their glow go. d: its distance in the
// depth map, m.
export const PHOTO_LIGHTS = [
  { c: [994.8, 1526.2], r: [14.5, 14.5], d: 853, kind: "crane", n: 0, src: [26, -26] },   // the tall crane
  { c: [892.3, 1568.5], r: [15, 15], d: 2031, kind: "crane", n: 0, src: [31, 0] },
  { c: [1326.6, 1592.0], r: [15, 15], d: 3901, kind: "crane", n: 0, src: [31, -31] },
  { c: [438.0, 1593.1], r: [13, 13], d: 3901, kind: "crane", n: 1, src: [26, -26] },     // the crane on the left
  { c: [333.5, 1642.0], r: [17, 15.5], d: 1148, kind: "crane", n: 1, src: [7, -31] },
  { c: [630.1, 1638.1], r: [15, 15], d: 3901, kind: "crane", n: 1, src: [33, 0] },
  { c: [847.8, 1633.1], r: [15, 15], d: 3901, kind: "crane", n: 1, src: [-35, -14] },
  { c: [926.3, 1675.3], r: [14, 14], d: 3901, kind: "crane", n: 2, src: [23, -23] },     // the low crane
  { c: [823.3, 1719.2], r: [13.5, 13.5], d: 1466, kind: "crane", n: 2, src: [-5, -27] },
  { c: [1313.7, 1719.9], r: [15, 15], d: 3901, kind: "crane", n: 2, src: [-35, 0] },
  { c: [1483.5, 1824.5], r: [16.5, 13], d: 3901, kind: "stack", src: [33, -26] },          // the chimneys
  { c: [1595.5, 1819.0], r: [29, 13.5], d: 3902, kind: "stack", src: [-60, -19] },
  { c: [1438.3, 2013.9], r: [12, 12], d: 3901, kind: "signal", n: 0, src: [-29, 12] },   // rail signals
  { c: [1521.3, 2014.7], r: [13, 13], d: 3901, kind: "signal", n: 1, src: [-30, 12] },
  { c: [944.7, 2041.3], r: [8, 8], d: 433, kind: "signal", n: 2, src: [-17, -3] },
  { c: [1456.1, 2313.2], r: [13, 13], d: 130, kind: "signal", n: 3, src: [-12, -30] },
  { rect: [2386, 1920, 2524, 1961], soft: [7, 7], cut: [2503, 1860, 2660, 1932.5], src: [0, -100], gain: [1.235, 1.203, .754], d: 3902, kind: "neon" },   // the METRO sign
  { rect: [2499, 1888, 2622, 1932.5], soft: [7, 7], cut: [2488, 1932.5, 2524, 1975], src: [0, -90], gain: [1.599, 1.642, 1.413], d: 3902, kind: "box" },    // the lightbox
];

// their beats. pulse(): 1 from a to b seconds, with ramps 2r long
const pulse = (t, a, b, r) => smoothstep(a - r, a + r, t) * (1 - smoothstep(b - r, b + r, t));
const blink = (t, per, duty, r) => { const f = t - per * Math.floor(t / per); return pulse(f, 0, duty * per, r) + pulse(f, per, per + duty * per, r); };
// the red flashing light Germany puts on tall structures at night: 1 s on, 0.5 off, 1 on, 1.5 off, started on
// the UTC second, so they all blink together (s: the Berlin wall clock, whose seconds are UTC's)
const towerBeat = s => { const f = s - 4 * Math.floor(s / 4); return pulse(f, 0, 1, .06) + pulse(f, 1.5, 2.5, .06) + pulse(f, 4, 5, .06); };
const CRANES = [{ per: 2.2, off: .3 }, { per: 1.9, off: 1.1 }, { per: 2.6, off: .7 }];   // their controllers keep their own time
// in each cycle of per s a signal clears to green in 7 of 10: red goes out, green comes on half a second later and
// stays 8 to 24 s, then red again after the same half second. The first cycle clears at first s, so a visit sees it.
const SIGNALS = [{ per: 67, first: 22, seed: .17 }, { per: 83, first: 9, seed: .61 }, { per: 59, first: 40, seed: .33 }, { per: 97, first: 31, seed: .87 }];
function signalAt(S, T) {
  const cyc = Math.floor(T / S.per), tc = T - cyc * S.per, h = i => hash11(cyc * 7.7 + S.seed * 31 + i * 1.9);
  if (cyc > 0 && h(0) > .7) return [1, 0];
  const dur = cyc === 0 ? 16 : 8 + 16 * h(1), t0 = cyc === 0 ? S.first : 4 + h(2) * (S.per - dur - 10);
  return [1 - pulse(tc, t0, t0 + dur + .5, .05), pulse(tc, t0 + .5, t0 + dur, .05)];
}
// the METRO sign: in 3 of 5 cycles of 19 s a burst of stutter, 0.4 to 1.3 s, the tubes dropping to 15% at random
// 1/17 s steps; the lightbox: in about 2 of 5 cycles of 43 s a flutter of 0.45 s, down to about half as bright (75% of
// the photo's colour: the highlight lift does the rest)
function neonAt(T) {
  const cyc = Math.floor(T / 19), tc = T - cyc * 19, h = i => hash11(cyc * 3.71 + i * 1.37 + .71);
  const t0 = 2 + h(1) * 15, dur = .4 + .9 * h(2);
  return h(0) > .6 || tc < t0 || tc > t0 + dur ? 1 : hash11(Math.floor(T * 17) * .618 + cyc) < .5 ? .15 : 1;
}
function boxAt(T) {
  const cyc = Math.floor(T / 43), tc = T - cyc * 43, h = i => hash11(cyc * 5.13 + i * 2.3 + .29);
  const t0 = 3 + h(1) * 37;
  return h(0) > .45 || tc < t0 || tc > t0 + .45 ? 1 : .75 + .25 * hash11(Math.floor(T * 26) * .71 + cyc);
}
// per light: x, how much of its photographed light shows (0 off, 1 as photographed); y, how green a signal is.
// The TV tower's beacon (uBea.x) keeps the chimneys' beat.
function photoLights(U, T, life) {
  const wall = life && life.T != null ? life.sec + T - life.T : T;
  PHOTO_LIGHTS.forEach((L, i) => {
    let k = 1, g = 0;
    if (L.kind === "crane") { const C = CRANES[L.n]; k = blink(T + C.off, C.per, .5, .09); }
    else if (L.kind === "stack") k = towerBeat(wall);
    else if (L.kind === "signal") [k, g] = signalAt(SIGNALS[L.n], T);
    else if (L.kind === "neon") k = neonAt(T);
    else if (L.kind === "box") k = boxAt(T);
    U.uRL.value[i].set(k, g, 0, 0);
  });
  U.uBea.value.x = towerBeat(wall);
}

const head = (BH, parallax, o = {}) => /* glsl */`
precision highp float;
varying vec3 vW;
uniform sampler2D map, noiseTex, winTex;
uniform float T, uPhoto, uWin, uNoise;
uniform vec3 uEye, uTr;
uniform vec4 uDrift, uLane, uBea, uLamp, uTrB;
uniform vec4 uPlane[2], uPlaneF[2];
uniform vec4 uLife;
${o.depthMap ? `uniform sampler2D depthTex;
` : ""}${o.weather || o.mist ? `uniform vec4 uWx;     // x: the shower (0 a drizzle .. 1 a downpour), z: how much mist
` : ""}${GLSL_COMMON}
const float F=${PHOTO.F.toFixed(3)}, CX=${PHOTO.CX.toFixed(1)}, YH=${PHOTO.YH.toFixed(1)}, HG=${PHOTO.HG.toFixed(2)};
const float BH=${BH.toFixed(4)}, BZ0=${(1.3 - .381 * BH).toFixed(4)};
const vec3 SKY=vec3(.075,.07,.078);

vec2 proj(vec3 W){ float a=atan(W.x,-W.z); float rho=length(W.xz); return vec2(CX+F*a, YH-F*W.y/rho); }   // 3D -> photo px
vec2 rayDirA(vec2 P){ return vec2((P.x-CX)/F, (YH-P.y)/F); }   // photo px -> azimuth, tan(elevation)
// glow of a point light: tight core plus a soft skirt, radius in photo px
float pglow(vec2 d, float r){ float q=dot(d,d)/(r*r); return exp(-q)+.08*exp(-sqrt(q)*.9); }

// where the ray o + t d meets the 30 m cylinder, in the shipped photo mapping
vec2 cylUV(vec3 o, vec3 d){
  float a=dot(d.xz,d.xz), b=dot(o.xz,d.xz), c=dot(o.xz,o.xz)-900.;
  float t=(-b+sqrt(max(b*b-a*c,0.)))/a;
  vec3 p=o+t*d;
  return vec2(.5+atan(p.x,-p.z)*30./47., (p.y-BZ0)/BH);
}
${parallax && o.depthMap ? `
// Distance from the home eye to what the photo pixel shows, horizontally in metres: the ground plane 12 m down below
// the horizon row (the tracks, the car park), and wherever assets/depth.png says something is nearer (a mast, a
// signal, a building), that. The map is a depth model's estimate calibrated on that plane (city/tools/make_depth.py);
// its R channel is grown and softened for the parallax, so a mast moves as one piece, G is sharp, for what stands in
// front of the trains. Both hold sqrt(24 / distance); nothing is farther than 4 km.
float depthOf(vec2 mu, float m){ return 1./max(max(max((1.-mu.y)*3201.-YH,0.)/(F*HG),m*m/24.),1./4000.); }
float depthAt(vec2 uv){
  vec2 mu=vec2(1.-abs(mod(uv.x,2.)-1.),clamp(uv.y,.002,.998));
  return depthOf(mu,texture2D(depthTex,vec2(mu.x,1.-mu.y)).r);
}
float sharpDepth(vec2 mu){ return depthOf(mu,texture2D(depthTex,vec2(mu.x,1.-mu.y)).g); }` : parallax ? `
// Distance from the home eye to the photo pixel's 3D point, from the same camera model the traffic and the train
// use: below the horizon row the ground plane 12 m down (the tracks, the car park), and everything above it far
// (the skyline is 1 to 3 km out). Summed as inverse distances, so the kink at the horizon is soft. No texture.
float depthAt(vec2 uv){
  float y=(1.-uv.y)*3201.;
  return 1./(max(y-YH,0.)/(F*HG)+1./1500.);
}` : ""}${o.weather ? `
// showers haze the far city: toward a warm grey lit from below, more the farther and the harder it rains
const vec3 HAZE=vec3(.07,.06,.054);
float hazeAt(float rho){ return uWx.x*.36*(1.-exp(-rho/1500.)); }` : ""}
`;
// uv of this pixel from the view ray (both draws in the parallax variant, and the lights draw always)
const rayUV = (parallax, depthMap = false) => parallax ? `
  // Parallax: the photo pixels sit at a coarse depth (distance from the home camera, which is the photo's eye).
  // Find the pixel whose 3D point lies on this view ray with a few fixed-point steps; from the home camera the
  // result is exactly the flat cylinder, elsewhere near ground slides against the far skyline.
  vec3 C=cameraPosition, V=normalize(vW-C);
  vec3 pw=C-uEye; float pwv=dot(pw,V), pww=dot(pw,pw);
  uv=cylUV(C,V);
${depthMap ? `  float dPix=0.;                                       // ends as how far what this pixel shows is
  for(int i=0;i<3;i++){
    dPix=depthAt(uv);
    float t=-pwv+sqrt(max(pwv*pwv-pww+dPix*dPix,1.));
    uv=cylUV(uEye,pw+t*V);
  }` : `  for(int i=0;i<3;i++){
    float dd=depthAt(uv);
    float t=-pwv+sqrt(max(pwv*pwv-pww+dd*dd,1.));
    uv=cylUV(uEye,pw+t*V);
  }`}` : `
  vec3 C=cameraPosition, V=normalize(vW-C);
  uv=cylUV(C,V);`;

// ---------------------------------------------------------------------------------------------- the backdrop
const WIN_STATE = /* glsl */`// ---------------------------------------------------------------- windows
float winState(float id, out float tv){
  float per=220.+380.*hash11(id*1.37);
  float ph=hash11(id*7.1)*per;
  float x=(T+ph)/per; float k=floor(x); float f=fract(x);
  // uLife.x of them are dark at any time and uLife.y watch television; both follow the Berlin night (lib/night.js)
  float offNow=step(hash12(vec2(id,k)),uLife.x);
  float offPrev=step(hash12(vec2(id,k-1.)),uLife.x);
  float s=mix(offPrev,offNow,smoothstep(0.,.35/per,f));
  tv=step(hash11(id*3.3+.5),uLife.y);
  return 1.-s;
}`;

export function livingFragment({ BH, parallax = false, win = { y0: 1667, y1: 2112 }, strip = [], depthMap = false, weather = false, mist = false }) {
  const on = k => !strip.includes(k);   // strip: blocks to leave out, for profiling and taste
  depthMap = depthMap && parallax; weather = weather && parallax; mist = mist && parallax;   // they need the 3D point
  return /* glsl */`
varying vec3 vP;
${head(BH, parallax, { depthMap, weather, mist })}
${WIN_STATE}

void main(){
  vec2 uv;
  ${parallax ? rayUV(true, depthMap) : `
  uv=vec2(.5+atan(vP.x,-vP.z)*30./47.,vP.y/BH+.6);`}${(weather || mist) && !depthMap ? `
  float dPix=depthAt(uv);` : ""}
  vec2 mu=vec2(1.-abs(mod(uv.x,2.)-1.),clamp(uv.y,.002,.998));
  vec3 c=mix(SKY,texture2D(map,mu).rgb,uPhoto);
  c=mix(c,SKY,smoothstep(.93,1.05,uv.y));
  vec2 P=vec2(mu.x*3840.,(1.-mu.y)*3201.);             // photo px (y down), clamped to the photo
${backdropBody({ on, win, weather, mist })}

  c*=vec3(.93,.97,1.06);
  gl_FragColor=vec4(c,1.);
}`;
}

// What the backdrop does to the photo colour c at photo pixel P (uv, mu, and dPix when there is mist or weather):
// windows, the failing lamp, mist, the highlight lift, low cloud, the shower's haze. The photo's lights below run
// the same text, so what they draw matches the backdrop.
function backdropBody({ on, win, weather, mist }) {
  const wy0 = win.y0.toFixed(1), wyh = (win.y1 - win.y0).toFixed(1);
  return /* glsl */`  float cl=0., cl2=0.;
${on("sky") ? `
  if(uv.y>.36){
    vec2 n2=texture2D(noiseTex,vec2(uv.x*2.1+uDrift.w,uv.y*3.9)+.37).rg;     // cloud layer 2, and a warp for layer 1
    cl2=n2.r;
    cl=texture2D(noiseTex,vec2(uv.x*1.2+uDrift.z,uv.y*2.625)+n2.g*.125).r;    // cloud layer 1, pushed around by layer 2
  }` : ""}
${on("win") ? `
  // lit windows: some switch off for a while, a few glow with a television
  if(P.y>${wy0}&&P.y<${win.y1.toFixed(1)}&&uWin>0.){
    float al=texture2D(winTex,vec2(mu.x,(P.y-${wy0})/${wyh})).g;
    if(al>.02){
      float id=texelFetch(winTex,ivec2(int(P.x),int(P.y-${wy0})),0).r*255.;
      if(id>.5){
        float tv; float on=winState(id,tv);
        float k=al*uWin;
        c*=1.-k*(1.-on)*.9;
        float fl=(.45+.55*hash11(floor(T*.8+id*13.)))*(.92+.08*sin(T*7.+id));   // cuts about once a second, a slight flicker
        c=mix(c,lum(c)*vec3(.5,.68,1.25)*1.6*fl,k*tv*on);
      }
    }
  }` : ""}
${on("lamp") ? `
  // a sodium lamp on the car-park road that is failing: now and then it drops out, then re-strikes red and warms up.
  // What is behind it is rebuilt from the rows just above and below its glare (the facade there is vertical
  // stripes), and only the lamp's excess over that is scaled, so "off" reads as off, not as a hole.
  if(uLamp.w>0.){
    vec2 dl=(P-vec2(2617.,2141.))/35.;
    float m=1.-smoothstep(.7,1.,length(dl));
    if(m>0.){
      vec3 bgT=texture2D(map,vec2(mu.x,1.-2107./3201.),1.).rgb, bgB=texture2D(map,vec2(mu.x,1.-2177./3201.),1.).rgb;
      vec3 bg=mix(bgT,bgB,clamp((P.y-2107.)/70.,0.,1.))*(.9+.2*texture2D(noiseTex,P*.031).b);
      vec3 ex=max(c-bg,0.);
      c=min(c,bg)+ex*mix(vec3(1.),uLamp.rgb,m*uPhoto);
    }
  }` : ""}${mist ? `
  // mist lying on the yard and the car park: a layer 3 m deep, thicker in banks that drift across the tracks, lit by
  // the lamps around it (the photo's own light, blurred). What stands out of it is seen through less of it.
  if(P.y>YH-60.){
    float hgt=max(HG+dPix*(YH-P.y)/F,0.);                  // height of this pixel's point above the ground
    float path=dPix*max(3.-hgt,0.)/max(HG-hgt,1.);          // metres of the view ray inside the layer
    float az=(P.x-CX)/F;
    vec2 gp=dPix*vec2(sin(az),cos(az));                     // where it stands, metres
    float bank=smoothstep(.45,.75,texture2D(noiseTex,gp*.004+vec2(uDrift.y,.61)).r);
    float mm=1.-exp(-path*uWx.z*(.12+1.6*bank)*.003);
    c=mix(c,vec3(.03,.028,.027)+texture2D(map,mu,6.).rgb*1.5,mm*uPhoto);
  }` : ""}
${on("shimmer") ? `
  // bright lights shimmer through the rain (the shipped highlight lift, with baked noise instead of hashing)
  float l=dot(c,vec3(.3,.59,.11));
  if(l>.35) c=c*.95+c*smoothstep(.35,1.,l)*2.2*(.85+.3*texture2D(noiseTex,vec2(uv.x*112.5,uv.y*62.5+uDrift.x)).r)${weather ? "*(1.+.4*uWx.x)" : ""};
  else c*=.95;` : `
  float l=dot(c,vec3(.3,.59,.11)); c=c*.95+c*smoothstep(.35,1.,l)*2.2;`}
${on("sky") ? `
  // low cloud over the skyline, lit from below by the city: two layers drifting at different speeds. They are
  // small enough that the patch of sky seen from the desk always holds several, so the window's mean stays put
  // (a coarser version swung the window mean by +-2.3%; this one by +-0.7%).
  if(uv.y>.36){
    float cc=smoothstep(.45,.85,cl)*.85+smoothstep(.5,.8,cl2)*.35;
    ${on("clouds") ? "" : "cc=0.;"}
    c+=vec3(.12,.075,.045)*cc*smoothstep(.36,.6,uv.y)*(1.-smoothstep(.75,1.,uv.y))*.9*uNoise${weather ? "*(1.+.8*uWx.x)" : ""};
  }` : ""}${weather ? `
  // a shower hazes the far city
  c=mix(c,HAZE*(1.+.5*uWx.x),hazeAt(dPix)*uPhoto);` : ""}`;
}

// ------------------------------------------------------------------------------------------------ the lights
// Where the patches are: fixed boxes carry their own corners; the train's box and the aircraft come from the
// per-frame uniforms, so the vertex shader moves them and the CPU never touches a vertex.
export const lightsVertex = (BH, parallax = false, o = {}) => /* glsl */`
attribute vec4 aPatch;   // x: 0 a fixed box, 1 the train, 2 and 3 the aircraft; y, z: corner (0..1); w: which light
attribute vec4 aBox;     // the fixed box, photo px
uniform vec4 uTrB, uPlane[2];
${o.trains ? `uniform vec4 uTrBox[3];   // with more trains, each slot's box (w: the slot)
` : ""}uniform vec3 uEye;
varying vec3 vW;
varying float vId;
void main(){
  vec4 b=aBox;
  if(aPatch.x>2.5) b=uPlane[1].z>0.?vec4(uPlane[1].xy-31.,uPlane[1].xy+31.):vec4(0.);
  else if(aPatch.x>1.5) b=uPlane[0].z>0.?vec4(uPlane[0].xy-31.,uPlane[0].xy+31.):vec4(0.);
  else if(aPatch.x>.5) b=${o.trains ? "aPatch.w<.5?uTrBox[0]:aPatch.w<1.5?uTrBox[1]:uTrBox[2]" : "uTrB"};
  vId=aPatch.w; vW=vec3(0.);
  if(b.z<=b.x){ gl_Position=vec4(0.,0.,-2.,1.); return; }     // nothing there: the patch collapses to a point
  // slack around the patch: the boxes already hold each light's whole glow, so the flat mapping needs none; with
  // parallax, as far as the ray search can move a light from where the flat mapping has it (at most 82 photo px
  // per metre between the camera and the photo's eye)
  float m=${parallax ? `min(2.+${o.depthMap ? "105" : "100"}.*length(cameraPosition-uEye),480.)` : "2."};${o.depthMap ? "   // (nothing in the depth map is nearer than 24 m)" : ""}
  b+=vec4(-m,-m,m,m);
  vec2 px=mix(b.xy,b.zw,aPatch.yz);
  float a=(px.x/3840.-.5)*47./30.;
  vec3 Q=vec3(30.*sin(a),${(1.3 - .381 * BH).toFixed(4)}+${BH.toFixed(4)}*(1.-px.y/3201.),-30.*cos(a));   // where the backdrop shows this photo pixel
  vW=mix(cameraPosition,Q,.996);                        // on the same view ray, 12 cm in front of the backdrop
  gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);
}`;

// Each patch is a strip of quads over the backdrop's own cylinder, drawn just in front of it, so the room hides it
// the same way; enough segments that the chords stay close to the cylinder even with the parallax slack.
export function lightsGeometry(THREE, kinds, o = {}) {
  const on = k => kinds.includes(k);
  const pat = [], box = [], idx = [];
  const add = (kind, b, seg, id = 0) => {
    const base = pat.length / 4;
    for (let i = 0; i <= seg; i++) for (let j = 0; j < 2; j++) { pat.push(kind, i / seg, j, id); box.push(b[0], b[1], b[2], b[3]); }
    for (let i = 0; i < seg; i++) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  };
  if (on("cars")) PATCHES.cars.forEach(b => add(0, b, 24));
  // each beacon and aircraft patch draws only its own light (id), so where patches overlap nothing is added twice.
  // With the photo's own lights (reds), the tall crane's tip and the chimney blink there instead.
  if (on("beacons")) PATCHES.beacons.forEach((b, i) => { if (!(o.reds && i >= 2)) add(0, b, 6, i); });
  // with more trains, one patch per slot, the outer tracks first: a train nearer the tracks' axis hides the bottom of
  // its neighbour on the left, never the other way round
  if (on("train")) { if (o.trains) [2, 1, 0].forEach(i => add(1, [0, 0, 0, 0], 24, i)); else add(1, [0, 0, 0, 0], 24); }
  if (on("planes")) { add(2, [0, 0, 0, 0], 6, 4); add(3, [0, 0, 0, 0], 6, 5); }
  if (!pat.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(pat.length / 4 * 3), 3));   // unused; three.js expects one
  g.setAttribute("aPatch", new THREE.Float32BufferAttribute(pat, 4));
  g.setAttribute("aBox", new THREE.Float32BufferAttribute(box, 4));
  g.setIndex(idx);
  return g;
}

// the trains of the depth variant (lightsFragment with trains: true)
const trainsGlsl = ({ depthMap, weather }) => /* glsl */`
// ---------------------------------------------------------------- trains
// Each slot is a box on its track between its near end sN and far end sF (metres along the track from the eye's foot),
// in its kind's livery, moving on the CPU's timetable. Leaving, its rear faces the viewer with two red tail lights;
// arriving, its front does, with the three white lights of a German train (two low, one high), their glow in the rain
// and their glints on the wet rails and the ballast ahead of it.${depthMap ? `
// Masts and signals nearer than the train (the depth map's sharp channel, dS) stand in front of it.` : ""}
const float VPA=${VPA.toFixed(5)}, FAR=${FAR.toFixed(1)};
uniform vec4 uTrA[3], uTrC[3], uTrBox[3];   // A: near end, far end, visibility, track offset; C: direction (+1 leaving), kind
uniform vec4 uTrE[3], uTrG[3];              // the near end's lamps, photo px: E two low ones; G the high one, radius, strength
// half width, floor and roof above the rails, car length
vec4 kindDims(float k){ return ${TRAIN_KINDS.map((K, i) => [i, `vec4(${[K.W, K.Y0, K.Y1, K.CAR].map(v => v.toFixed(2)).join(",")})`])
    .reduceRight((acc, [i, v]) => acc === null ? v : `k<${i}.5?${v}:${acc}`, null)}; }
// the lit windows of one car: u metres from its end, y above the rails; fw the pixel's footprint along the train
float carWindows(float kind, float u, float y, float fw, float CAR){
  if(kind<.5){      // S-Bahn: one band, broken by pillars and two doors a side
    float wy=smoothstep(1.72,1.8,y)*(1.-smoothstep(2.72,2.8,y));
    float pil=smoothstep(0.,fw*1.5+.08,abs(fract(u/2.3)-.5)*2.3-.28);
    float doors=1.-step(abs(u-6.1),.7)-step(abs(u-12.3),.7);
    return wy*pil*step(1.2,u)*step(u,CAR-1.2)*max(doors,.15);
  }
  if(kind<1.5){     // long-distance: a long band of big windows, the doors at the car ends
    float wy=smoothstep(1.42,1.5,y)*(1.-smoothstep(2.28,2.36,y));
    float pil=smoothstep(0.,fw*1.5+.06,abs(fract(u/2.05)-.5)*2.05-.16);
    return wy*pil*step(3.4,u)*step(u,CAR-3.4);
  }
  // regional double-deck: two rows, the doors low down a quarter in from each end
  float lo=smoothstep(.98,1.06,y)*(1.-smoothstep(1.86,1.94,y)), up=smoothstep(2.74,2.82,y)*(1.-smoothstep(3.56,3.64,y));
  float pil=smoothstep(0.,fw*1.5+.08,abs(fract(u/1.85)-.5)*1.85-.22);
  float doors=1.-step(abs(u-7.),.8)-step(abs(u-CAR+7.),.8);
  return (lo*max(doors,.1)+up)*pil*step(1.6,u)*step(u,CAR-1.6);
}
// one slot's train as seen at photo pixel P: premultiplied colour and alpha. base: the photo's blurred colour here,
// the light it is lit by; dS: how far the photo's own surface at P is
vec4 trainAt(vec2 P, vec3 base, float fwx, vec4 A, vec4 C, vec4 E, vec4 G, float dS){
  float sN=A.x, sF=A.y, vis=A.z, xt=A.w, dir=C.x, kind=C.y;
  vec4 K=kindDims(kind);
  float W=K.x, Y0=K.y, Y1=K.z, CAR=K.w;
  vec2 ae=rayDirA(P);
  float ar=ae.x-VPA;
  vec3 d=vec3(sin(ar),ae.y,cos(ar));      // this pixel's ray in the track frame (across, up, along), unit horizontal length
  float s0=max(sN,24.), s1=min(sF,FAR+150.);
  vec3 col=vec3(0.); float a=0.;
  if(s1>s0){
    vec3 lo=vec3(xt-W,-HG+Y0,s0), hi=vec3(xt+W,-HG+Y1,s1);
    vec3 inv=1./d;
    vec3 ta=lo*inv, tb=hi*inv;
    vec3 tmn=min(ta,tb), tmx=max(ta,tb);
    float tn=max(max(tmn.x,tmn.y),tmn.z), tf=min(min(tmx.x,tmx.y),tmx.z);
    if(tf>tn&&tn>0.&&tn<dS*1.08){          // a hit, and nothing in the photo stands in front of it
      vec3 h=d*tn; float y=h.y+HG;           // the hit point, and its height above the rails
      float fog=exp(-tn/900.);
      float isSide=step(tmn.y,tmn.x)*step(tmn.z,tmn.x);          // which face: the one entered last
      float isRoof=step(tmn.x,tmn.y)*step(tmn.z,tmn.y)*(1.-isSide);
      float isEnd=1.-isSide-isRoof;
      // the livery, lit only by the city around it
      vec3 paint=kind<.5?mix(vec3(.9,.62,.3),vec3(.55,.16,.1),step(y,1.55))
                :kind<1.5?mix(vec3(.8,.81,.82),vec3(.62,.05,.04),step(abs(y-1.2),.09))
                :mix(vec3(.6,.07,.05),vec3(.2,.2,.22),step(y,.85));
      vec3 body=paint*(base*1.3+.0012)*mix(.25,1.,step(.8,y));      // the bogies and the skirts below are dark
      // side windows, car by car from the near end, so they travel with the train
      float u=h.z-sN, ci=floor(u/CAR), uc=u-ci*CAR;
      float fw=max(abs(xt+W)*fwx/(F*d.x*d.x),.05);
      float lit=carWindows(kind,uc,y,fw,CAR);
      vec3 interior=(kind>.5&&kind<1.5?vec3(.9,.97,1.05):vec3(.95,1.,.82))*1.15*(.85+.15*hash11(ci+kind*7.));
      vec3 cs=mix(body,interior,lit);
      vec3 roof=base*vec3(.55,.55,.6)+vec3(.001);
      // the near end: the cab window, dark glass on an arriving train, a dim light at the back of a leaving one
      float cab=smoothstep(Y1-1.7,Y1-1.6,y)*(1.-smoothstep(Y1-.8,Y1-.7,y))*step(abs(h.x-xt),W-.3);
      vec3 ce=mix(body*.8,dir<0.?base*.5+vec3(.004,.005,.006):vec3(.03,.028,.02),cab);
      col=cs*isSide+roof*isRoof+ce*isEnd;
      col=mix(base*1.2,col,fog);${weather ? `
      col=mix(col,HAZE,hazeAt(tn));` : ""}
      a=vis*smoothstep(0.,1.,min(tf-tn,1.)*8.);
    }
  }
  vec3 glowc=vec3(0.);
  float rhoE=max(sN,20.), r=G.z, I=G.w;
  // a mast or a signal between the viewer and the near end hides its lamps' cores (the ground in front hides nothing)
  float occ=dS<rhoE*.92&&dS<(P.y>YH?F*HG/(P.y-YH):1.e5)*.9?.2:1.;
  vec2 d0=P-E.xy, d1=P-E.zw, d2=P-G.xy;
  if(dir<0.){
    // arriving: two white lamps low and one high, dazzling through the rain as it comes closer
    glowc=vec3(1.,.95,.86)*I*((pglow(d0,r)+pglow(d1,r)+.6*pglow(d2,r))*occ+.05*(pglow(d0,r*7.)+pglow(d1,r*7.)+pglow(d2,r*7.)));
  } else {
    // leaving: two red tail lamps
    glowc=vec3(1.,.05,.02)*I*(pglow(d0,r)+pglow(d1,r))*occ;
  }
  glowc*=step(22.,sN);                       // below 26 m it has left the photo
  // the wet rails and the ballast between the viewer and the near end catch its lights
  if(P.y>YH+1.&&sN>24.){
    float rg=F*HG/(P.y-YH);                  // how far this pixel's point on the ground is
    if(rg<sN+4.&&rg<dS*1.12){                // short of the train (or just under its nose), nothing standing in front
      vec2 g=rg*vec2(sin(ar),cos(ar));       // where, in the track frame
      float gap=sN-g.y, pm=F/rg;             // metres short of the train; photo px per metre there
      float rails=0.;
      for(int s=-1;s<=1;s+=2){ float dx=(g.x-xt-.72*float(s))*pm; rails+=exp(-dx*dx*1.25); }
      rails*=.5+texture2D(noiseTex,vec2(g.x*.05,g.y*.013)).b;             // wetter and drier stretches
      float fall=exp(-max(gap,0.)/(dir<0.?26.:14.))*smoothstep(-2.,1.,gap), pool=exp(-(g.x-xt)*(g.x-xt)/3.6)*exp(-max(gap,0.)/12.)*smoothstep(-4.,2.,gap);
      float Ig=dir<0.?1.+3.e4/(rhoE*rhoE):.35;
      glowc+=(dir<0.?vec3(1.,.95,.86):vec3(1.,.08,.03))*Ig*(rails*fall*.32+pool*.05);
    }
  }
  glowc*=vis${weather ? "*(1.-hazeAt(rhoE))" : ""};
  return vec4(col*a+glowc,a);
}

`;

export function lightsFragment({ BH, parallax = false, kinds, depthMap = false, trains = false, weather = false }) {
  const on = k => kinds.includes(k);
  const { A, RD } = ROAD;
  depthMap = depthMap && parallax;
  return /* glsl */`
varying float vId;
${head(BH, parallax, { depthMap, weather })}
${on("cars") ? `
// ---------------------------------------------------------------- traffic
// Two lanes on the car-park road right of the station. The road coordinate of each photo column comes from a
// closed-form ray/line intersection; each lane is cut into 72 m cells with at most one car, placed so it never
// comes within 12 m of the next cell. A car's lights and glints stay within 8 m of its road coordinate in
// column terms (half its length plus the lane offset seen obliquely), so a pixel tests its own cell and, only near
// the cell's far end, the next one; then a row test; only then any lighting maths.
const vec3 RA=${f3(A)};
const vec2 RDIR=vec2(${RD[0].toFixed(5)},${RD[1].toFixed(5)});
const vec2 RNRM=vec2(${(-RD[1]).toFixed(5)},${RD[0].toFixed(5)});
// the lights of one car (road coordinate sc, cell hash kh) as seen at photo pixel P
vec3 carAt(vec2 P, float sc, float kh, float sg, float lat){
  vec2 G=RA.xz+RDIR*sc+RNRM*lat;
  float rho=length(G); float sz=F/rho;     // px per metre here
  float pcy=YH+F*HG/rho;
  vec3 acc=vec3(0.);
  if(P.y>pcy-2.*sz-8.&&P.y<pcy+4.*sz+14.){
    float fade=smoothstep(-8.,14.,sc);      // cars appear out of the station's glare at the far end
    vec2 hd=RDIR*sg;                        // heading
    float facing=dot(hd,-G/rho);
    // a low beam is intense only near its axis; from the side it is a modest point. Tail lights read from behind.
    float headV=facing>0.?facing*facing*facing:0., tailV=smoothstep(-.3,.7,-facing);
    float If=.3+2.6*headV, Ib=.22+1.4*tailV;
    vec2 side=vec2(-hd.y,hd.x);
    float r=max(.9,.12*sz)*1.25;
    float rip=.25+1.5*texture2D(noiseTex,vec2(P.y*.045-uLane.z,P.x*.002+kh*.13)).a;   // rain rings break the glints up
    float L=.45*sz+2., wq=r*.8, gs=.3*sz+1.;
    for(int s=-1;s<=1;s+=2){
      vec2 fL=G+hd*2.1+side*(.72*float(s)); vec2 bL=G-hd*2.1+side*(.7*float(s));
      vec2 pf=proj(vec3(fL.x,-HG+.65,fL.y)), pb=proj(vec3(bL.x,-HG+.85,bL.y));
      float gf=pglow(P-pf,r)*If, gb=pglow(P-pb,r*.9)*Ib;
      // wet asphalt: a soft glint at the mirror image (2h below the lamp) smeared toward the viewer
      float yf=pf.y+1.3*sz, yb=pb.y+1.7*sz;
      float xf=(P.x-pf.x)/wq, xb=(P.x-pb.x)/wq, qf=(P.y-yf)/gs, qb=(P.y-yb)/gs;
      float sf=exp(-xf*xf)*(exp(-qf*qf)*.6+.4*smoothstep(yf-2.,yf,P.y)*exp(-max(P.y-yf,0.)/L));
      float sb=exp(-xb*xb)*(exp(-qb*qb)*.6+.4*smoothstep(yb-2.,yb,P.y)*exp(-max(P.y-yb,0.)/L));
      acc+=fade*(vec3(1.,.83,.6)*(gf+sf*.16*rip*If) + vec3(1.,.06,.025)*(gb+sb*.22*rip*Ib));
    }
  }
  return acc;
}
// both lanes: for each, the car of this pixel's cell and, near the cell's far end, the next cell's car.
// Written as one loop with a single call site: two lanes of inlined copies made the shader twice as slow
// on a software rasteriser, for no gain anywhere else.
vec3 carLights(vec2 P, float sCol){
  vec3 acc=vec3(0.);
  float cell=72.;
  for(int i=0;i<4;i++){
    float lane=float(i/2), j=float(i-2*(i/2));
    float sg=lane<.5?1.:-1.;                 // lane 0 comes toward the viewer (to the right), lane 1 goes away
    float shift=lane<.5?uLane.x:uLane.y;     // v*T, wrapped every 256 cells on the CPU
    float u=sCol-sg*shift;                   // road coordinate in the lane's moving frame
    float k0=floor(u/cell), k=k0+j;
    // the car of cell k sits at k*cell + [0, cell-12) in the moving frame; uLane.w of the cells hold one (about a
    // third in the evening, fewer late at night). The pattern repeats every 256 cells (kh), so the CPU's wrap of
    // the shift is seamless. As uLane.w falls over the night a car on the road dims out over minutes, not at once.
    float kh=mod(k,256.);
    float uc=k*cell+hash11(kh*3.7+lane*11.)*(cell-12.), sc=uc+sg*shift;
    float hc=hash11(kh*1.618+lane*37.);
    if((j<.5||u-k0*cell>cell-8.)&&hc<uLane.w&&abs(u-uc)<8.&&sc>-8.&&sc<135.)   // past 135 m the road leaves the photo
      acc+=carAt(P,sc,kh,sg,sg*1.7)*min(1.,(uLane.w-hc)*80.);
  }
  return acc;
}

` : ""}
${on("train") && trains ? trainsGlsl({ depthMap, weather }) : ""}${on("train") && !trains ? `
// ---------------------------------------------------------------- the S-Bahn, synced to the sound
// A box on the left bundle's track (lateral offset XT in the track frame), receding toward the station.
const float VPA=${VPA.toFixed(5)};
const float XT=${TRAIN.XT.toFixed(2)};
vec4 sbahn(vec2 P, vec3 base, float fwx){
  float Df=uTr.x, Dr=uTr.y, vis=uTr.z;
  // ray of this photo pixel in the track frame (x: right of the track axis, s: along the track, y: up)
  vec2 ae=rayDirA(P);
  float ar=ae.x-VPA;
  vec3 d=vec3(sin(ar), ae.y, cos(ar));      // (lateral, up, along) with unit horizontal length
  float s0=max(Dr,0.), s1=Df;
  if(s1<=s0) return vec4(0.);
  vec3 lo=vec3(XT-${TRAIN.W.toFixed(2)},-HG+${TRAIN.Y0.toFixed(2)},s0), hi=vec3(XT+${TRAIN.W.toFixed(2)},-HG+${TRAIN.Y1.toFixed(2)},s1);
  vec3 inv=1./d;
  vec3 ta=lo*inv, tb=hi*inv;
  vec3 tmn=min(ta,tb), tmx=max(ta,tb);
  float tn=max(max(tmn.x,tmn.y),tmn.z), tf=min(min(tmx.x,tmx.y),tmx.z);
  vec3 col=vec3(0.); float a=0.;
  if(tf>tn&&tn>0.){
    vec3 h=d*tn;                              // hit point in the track frame
    float fog=exp(-tn/900.);
    float isSide=step(tmn.y,tmn.x)*step(tmn.z,tmn.x);          // which face: the one entered last
    float isRoof=step(tmn.x,tmn.y)*step(tmn.z,tmn.y)*(1.-isSide);
    float isRear=1.-isSide-isRoof;
    // body: dark ochre and red livery, lit only by the city around it
    vec3 amb=base;
    vec3 body=mix(vec3(.9,.62,.3),vec3(.55,.16,.1),step(h.y,-HG+1.55))*amb*1.3+vec3(.0015,.001,.0008);
    // side windows: a lit band broken by pillars, doors and car ends
    float along=h.z; float car=mod(along,18.4);
    float wy=smoothstep(-HG+1.72,-HG+1.8,h.y)*(1.-smoothstep(-HG+2.72,-HG+2.8,h.y));
    // pixel footprint along the train on its near side (x = XT+W): d(along)/d(azimuth) = |x|/sin^2, from the
    // photo column's screen derivative, which main() takes outside every branch (inside one it is undefined)
    float fw=max(abs(XT+${TRAIN.W.toFixed(2)})*fwx/(F*d.x*d.x),.05);
    float pil=smoothstep(.0,fw*1.5+.08,abs(fract(car/2.3)-.5)*2.3-.28);
    float ends=step(1.2,car)*step(car,17.2);
    float doors=1.-step(abs(car-6.1),.7)-step(abs(car-12.3),.7);
    float lit=wy*pil*ends*max(doors,.15);
    vec3 interior=vec3(.95,1.,.82)*1.15*(.85+.15*hash11(floor(along/18.4)));
    vec3 cs=mix(body,interior,lit);
    vec3 roof=amb*vec3(.55,.55,.6)+vec3(.001);
    // rear face: a dim cab
    vec3 cr=body*.8;
    cr+=vec3(.03,.028,.02)*smoothstep(-HG+2.0,-HG+2.1,h.y)*(1.-smoothstep(-HG+2.9,-HG+3.0,h.y))*step(abs(h.x-XT),1.1);
    col=cs*isSide+roof*isRoof+cr*isRear;
    col=mix(base*1.2,col,fog);
    a=vis*smoothstep(0.,1.,min(tf-tn,1.)*8.);
  }
  // tail lights as glows so they read even when tiny
  vec3 glowc=vec3(0.);
  float rhoR=max(s0,20.);
  for(int s=-1;s<=1;s+=2){
    vec3 Lw=vec3(XT+1.05*float(s),-HG+1.1,rhoR-.1);
    vec3 Wl=vec3(Lw.x*cos(VPA)+Lw.z*sin(VPA), Lw.y, -Lw.z*cos(VPA)+Lw.x*sin(VPA));
    glowc+=vec3(1.,.05,.02)*pglow(P-proj(Wl),max(1.,.09*F/rhoR)*1.4)*2.4;
  }
  glowc*=vis*step(.01,Df-Dr)*step(0.,Dr);
  return vec4(col*a+glowc, a);
}

` : ""}
${on("planes") ? `
// ---------------------------------------------------------------- aircraft (positions come from the CPU)
vec3 planeLight(vec2 Pu, vec4 A, vec4 B){
  vec2 d=Pu-A.xy;
  if(dot(d,d)>900.) return vec3(0.);
  return vec3(1.,.95,.85)*A.z*pglow(d,1.3)+vec3(1.,.08,.04)*B.x*pglow(d-vec2(0.,-1.4),1.3)+vec3(.9,.95,1.)*B.y*pglow(d,1.5);
}

` : ""}
void main(){
  vec2 uv;
  ${rayUV(parallax, depthMap)}
  vec2 mu=vec2(1.-abs(mod(uv.x,2.)-1.),clamp(uv.y,.002,.998));
  vec2 P=vec2(mu.x*3840.,(1.-mu.y)*3201.);             // photo px (y down), clamped to the photo
  vec2 Pu=vec2(uv.x*3840.,(1.-uv.y)*3201.);            // unclamped, for things in the open sky
  vec3 c=vec3(0.); float al=0.;
${on("beacons") ? `
  // beacons: TV tower, two crane tips (as shipped), and the power-station chimney; each patch draws its own
  if(vId<.5) c+=vec3(1.,.08,.04)*glow((uv-vec2(.7675,.5055))*vec2(1.2,1.),.0035)*uBea.x*5.;
  else if(vId<1.5) c+=vec3(1.,.12,.05)*glow((uv-vec2(.151,.551))*vec2(1.2,1.),.0026)*uBea.y*4.;
  else if(vId<2.5) c+=vec3(1.,.12,.05)*glow((uv-vec2(.258,.523))*vec2(1.2,1.),.0024)*uBea.z*4.;
  else if(vId<3.5){
    vec2 dc=P-vec2(1594.,1817.);
    if(dot(dc,dc)<2500.) c+=vec3(1.,.1,.04)*(pglow(dc-vec2(-13.,1.),2.2)+pglow(dc-vec2(13.,1.),2.2))*(.3+2.2*uBea.w);
  }` : ""}
${on("cars") ? `
  // traffic on the car-park road, right of the station
  if(P.y>2185.&&P.y<2346.&&P.x>2265.){
    float a=(P.x-CX)/F; float ca=cos(a), sa=sin(a);
    float sCol=(RA.x*ca+RA.z*sa)/(-RDIR.x*ca-RDIR.y*sa);   // road coordinate of this photo column
    c+=carLights(P,sCol)${weather ? "*(1.-hazeAt(250.))" : ""};
  }` : ""}
${on("train") && trains ? `
  // the trains: each slot's patch draws its own, inside the box the CPU works out for it per frame
  float fwx=fwidth(P.x);
  int ti=vId<.5?0:vId<1.5?1:2;
  vec4 TB=uTrBox[ti];
  if(P.x>TB.x&&P.x<TB.z&&P.y>TB.y&&P.y<TB.w){
    vec4 tr=trainAt(P,texture2D(map,mu,5.).rgb*uPhoto,fwx,uTrA[ti],uTrC[ti],uTrE[ti],uTrG[ti],${depthMap ? "sharpDepth(mu)" : "1e5"});
    c=c*(1.-tr.a)+tr.rgb; al=tr.a;
  }` : ""}${on("train") && !trains ? `
  // the S-Bahn on the left bundle: only inside its photo-space bounding box, which the CPU works out per frame
  float fwx=fwidth(P.x);
  if(P.x>uTrB.x&&P.x<uTrB.z&&P.y>uTrB.y&&P.y<uTrB.w){
    vec4 tr=sbahn(P,texture2D(map,mu,5.).rgb*uPhoto,fwx);
    c=c*(1.-tr.a)+tr.rgb; al=tr.a;
  }` : ""}
${on("planes") ? `
  // aircraft: each has its own patch
  if(vId>3.5&&Pu.y<2080.) c+=vId<4.5?planeLight(Pu,uPlane[0],uPlaneF[0]):planeLight(Pu,uPlane[1],uPlaneF[1]);` : ""}${weather && (on("beacons") || on("planes")) ? `
  c*=1.-hazeAt(3000.);                                  // far lights fade in a shower` : ""}

  gl_FragColor=vec4(c*vec3(.93,.97,1.06),al);          // premultiplied: blended as dst*(1-al) + rgb
}`;
}

// ------------------------------------------------------------------------------------- the photo's own lights
// One patch per light of PHOTO_LIGHTS, drawn before the other lights (they add to what is there; this replaces it).
// Each pixel runs the backdrop's own text (backdropBody) on the photo's colour turned down toward the light out
// (pixels copied from beside it; for a sign, fog from nearby), so a dimmed light loses its highlight lift and bloom
// as a real one would. A light showing as photographed has no patch: the backdrop's pixels show.
export function photoLightsGeometry(THREE) {
  const pat = [], box = [], shape = [], src = [], bg = [], cut = [], idx = [];
  PHOTO_LIGHTS.forEach((L, i) => {
    const [sx, sy] = L.rect ? L.soft : L.r, [cx, cy] = L.c || [0, 0];
    const [x0, y0, x1, y1] = L.rect || [cx, cy, cx, cy], base = pat.length / 4;
    for (let j = 0; j < 4; j++) {
      pat.push(L.d, j >> 1, j & 1, i); box.push(x0 - sx - 1, y0 - sy - 1, x1 + sx + 1, y1 + sy + 1);
      shape.push(...(L.rect || [cx, cy, sx, sy])); src.push(...L.src, ...(L.rect ? L.soft : [0, 0]));
      bg.push(...(L.rect ? [...L.gain, 1] : [0, 0, 0, 0])); cut.push(...(L.cut || [0, 0, 0, 0]));
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(pat.length / 4 * 3), 3));   // unused; three.js expects one
  for (const [k, v] of [["aPatch", pat], ["aBox", box], ["aShape", shape], ["aSrc", src], ["aBg", bg], ["aCut", cut]]) g.setAttribute(k, new THREE.Float32BufferAttribute(v, 4));
  g.setIndex(idx);
  return g;
}

export const photoLightsVertex = BH => /* glsl */`
attribute vec4 aPatch;   // x: the light's distance (m); y, z: corner (0..1); w: which light
attribute vec4 aBox;     // its patch, photo px
attribute vec4 aShape;   // a lamp: its centre and the half-size of its soft ellipse; a sign: its box (photo px)
attribute vec4 aSrc;     // where its "off" pixels are copied from, photo px away; a sign: how far past its box it fades
attribute vec4 aBg;      // a sign: the gain on those pixels, and w: 1 (a lamp: 0)
attribute vec4 aCut;     // a sign: its neighbour's box, left alone
uniform vec4 uRL[${PHOTO_LIGHTS.length}];   // per frame: x, how much of the photographed light shows; y, green
uniform vec3 uEye;
varying vec3 vW;
varying vec4 vShape, vSrc, vBg, vCut, vK;
void main(){
  vShape=aShape; vSrc=aSrc; vBg=aBg; vCut=aCut; vK=uRL[int(aPatch.w+.5)];
  // a light as photographed: no patch (all four corners outside the view)
  if(vK.x>.999&&vK.y<.001){ gl_Position=vec4(2.,2.,2.,1.); return; }
  // The patch lies where its light is seen from the camera: the light stands aPatch.x metres from the photo's eye
  // along the line to its backdrop pixel, and the patch goes where the view ray to it meets the backdrop. What the
  // patch holds stands at about that distance, so however the camera moves it needs only a little slack.
  float m=2.+6.*length(cameraPosition-uEye);
  vec2 px=mix(aBox.xy-m,aBox.zw+m,aPatch.yz);
  float a=(px.x/3840.-.5)*47./30.;
  vec3 Q=vec3(30.*sin(a),${(1.3 - .381 * BH).toFixed(4)}+${BH.toFixed(4)}*(1.-px.y/3201.),-30.*cos(a));
  vec3 D=uEye+normalize(Q-uEye)*aPatch.x-cameraPosition;
  float qa=dot(D.xz,D.xz), qb=dot(cameraPosition.xz,D.xz), qc=dot(cameraPosition.xz,cameraPosition.xz)-900.;
  vW=cameraPosition+D*(.996*(-qb+sqrt(max(qb*qb-qa*qc,0.)))/qa);   // on that ray, 12 cm in front of the backdrop
  gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);
}`;

export function photoLightsFragment({ BH, win = { y0: 1667, y1: 2112 }, strip = [], weather = false, mist = false }) {
  const on = k => !strip.includes(k);
  return /* glsl */`
varying vec4 vShape, vSrc, vBg, vCut, vK;
${head(BH, true, { depthMap: true, weather, mist })}
${WIN_STATE}

// what the backdrop shows at this pixel for photo colour ph
vec3 shade(vec2 uv, vec2 mu, vec2 P, float dPix, vec3 ph){
  vec3 c=mix(SKY,ph,uPhoto);
  c=mix(c,SKY,smoothstep(.93,1.05,uv.y));
${backdropBody({ on, win, weather, mist })}
  return c*vec3(.93,.97,1.06);
}

void main(){
  vec2 uv;
  ${rayUV(true, true)}
  vec2 mu=vec2(1.-abs(mod(uv.x,2.)-1.),clamp(uv.y,.002,.998));
  vec2 P=vec2(mu.x*3840.,(1.-mu.y)*3201.);             // photo px (y down), clamped to the photo
  // how much of this pixel is the light's: a lamp, 1 inside its soft ellipse; a sign, 1 inside its box, fading out
  // past each side, and 0 over its neighbour
  float q=length((P-vShape.xy)/vShape.zw), A=1.-smoothstep(.55,1.,q);
  if(vBg.w>0.){
    vec2 lo=max(vShape.xy-P,0.)/vSrc.zw, hi=max(P-vShape.zw,0.)/vSrc.zw;
    A=(1.-smoothstep(0.,1.,lo.x))*(1.-smoothstep(0.,1.,lo.y))*(1.-smoothstep(0.,1.,hi.x))*(1.-smoothstep(0.,1.,hi.y));
    if(P.x>vCut.x&&P.x<vCut.z&&P.y>vCut.y&&P.y<vCut.w) A=0.;
    q=1.;
  }
  // the light out: for a lamp, the pixels beside it; for a sign, the fog nearby at the facade's level, standing in
  // where the photo is brighter than that (the letters, their glow), so the building behind stays as photographed.
  // Both read outside any branch, so the mip level is the backdrop's.
  vec3 ph=texture2D(map,mu).rgb, near=texture2D(map,mu+vec2(vSrc.x/3840.,-vSrc.y/3201.)).rgb, alt=near;
  if(vBg.w>0.){ vec3 fog=near*vBg.rgb; alt=mix(ph,fog,smoothstep(1.2,2.,lum(ph)/max(lum(fog),1e-4))); }
  // the photo with the light turned down, and a cleared signal's lamp turned green (weaker than its red was: the
  // highlight lift makes a green of the same strength about twice as bright)
  vec3 c=alt+(ph-alt)*vK.x+max(ph.r-alt.r,0.)*vec3(.05,.8,.4)*vK.y*(1.-smoothstep(.2,.6,q));
  gl_FragColor=vec4(shade(uv,mu,P,dPix,c)*A,A);         // premultiplied: the backdrop's pixel becomes that where A is 1
}`;
}
