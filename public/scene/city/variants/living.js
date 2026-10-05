// Variant "living": the same photo, brought to life with a mask derived from it offline.
// Traffic with head and tail lights and wet-road glints on the car-park road, the S-Bahn leaving toward the
// station in sync with the train sound, office and tower windows that switch off and on (a few with a TV),
// aircraft on the approach, drifting low cloud from a baked noise texture, beacons, and one failing sodium lamp.
// Given the Berlin clock (ctx.life, from lib/night.js) the windows, the traffic and the aircraft follow the real night.
// Per frame the CPU writes a handful of uniforms (see frameUniforms). Extra download: assets/windows.png (77 KB).
// Drawn as the backdrop (photo, cloud, windows, lamp) plus three small draws for the point-like lights, which
// cover only the patches where those can be (lib/living-shader.js).
// With parallax the depth variant also passes depthMap, trains, weather, mist and reds (see lib/living-shader.js);
// left out, this variant is as it was. depthMap loads assets/depth.png (50 KB).
import { cylinderGeometry, placeCylinder, bakeNoise, lateTexture, assetUrl } from "../lib/common.js";
import { livingFragment, lightsFragment, lightsVertex, lightsGeometry, LIGHT_GROUPS, makeUniforms, frameUniforms,
  photoLightsGeometry, photoLightsVertex, photoLightsFragment } from "../lib/living-shader.js";
import { createRain } from "../lib/rain.js";

export const info = { name: "living", label: "Living photo" };
export const WIN = { y0: 1667, y1: 2112 };      // rows of berlin.jpg covered by assets/windows.png
export const HOME_EYE = [-0.1845, 1.2727, 1.7469];

export function createCity(THREE, { scene, renderer, loader, BH, BZ0, photo = "./tex/berlin.jpg", rain = true, renderOrder = 1, parallax = false, eye = null, strip = [],
  depthMap = false, trains = false, weather = false, mist = false, reds = false }) {
  loader = loader || new THREE.TextureLoader();
  // the extras that need the 3D point of each pixel come only with parallax (the photo's own lights with the depth map)
  const feat = { depthMap: depthMap && parallax, trains, weather: weather && parallax, mist: mist && parallax, reds: reds && depthMap && parallax };
  const extras = Object.values(feat).some(Boolean) ? feat : null;
  const noise = bakeNoise(THREE, renderer);
  const ph = lateTexture(THREE, loader, photo, { srgb: true, aniso: 8, dur: 1.2 });
  const win = lateTexture(THREE, loader, assetUrl("windows.png"), { flipY: false, mip: false, dur: 2 });
  const dm = feat.depthMap ? lateTexture(THREE, loader, assetUrl("depth.png"), { flipY: false, mip: false }) : null;
  const U = {
    map: { value: null }, noiseTex: { value: noise.texture }, winTex: { value: null },
    T: { value: 0 }, uPhoto: { value: 0 }, uWin: { value: 0 }, uNoise: { value: 1 },
    uEye: { value: new THREE.Vector3(...(eye || HOME_EYE)) },
    ...makeUniforms(THREE, feat),
    ...(dm ? { depthTex: { value: null } } : {}),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: true,
    vertexShader: `varying vec3 vP; varying vec3 vW;
      void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: livingFragment({ BH, parallax, win: WIN, strip, ...feat }),
  });
  const backdrop = new THREE.Mesh(cylinderGeometry(THREE, BH), mat);
  placeCylinder(backdrop, BH, BZ0);
  // Drawn after the opaque room (renderOrder 1), so early depth testing skips every pixel the room covers:
  // only the window opening pays for this shader. The shipped backdrop used -10, which shades the whole screen.
  backdrop.renderOrder = renderOrder; backdrop.name = "city_backdrop";
  scene.add(backdrop);
  // The point-like lights (traffic, the S-Bahn, aircraft, beacons) are small patches drawn over the backdrop with
  // the same uniforms: first among the transparent objects (renderOrder -1), so the window glass and the rain
  // still go over them, and depth-tested against the room like the backdrop.
  const overlay = new THREE.Object3D(); overlay.name = "city_lights";
  for (const kinds of LIGHT_GROUPS.map(g => g.filter(k => !strip.includes(k))).filter(g => g.length)) {
    const m = new THREE.Mesh(lightsGeometry(THREE, kinds, feat), new THREE.ShaderMaterial({
      uniforms: U, vertexShader: lightsVertex(BH, parallax, feat), fragmentShader: lightsFragment({ BH, parallax, kinds, ...feat }),
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,   // premultiplied
    }));
    m.frustumCulled = false; m.renderOrder = -1; m.name = "city_lights_" + kinds.join("_");
    m.raycast = () => {};   // its vertices are placed on the GPU; there is nothing here for a picking ray to hit
    overlay.add(m);
  }
  // the lights baked into the photo that blink and flicker (reds): drawn first, since they replace what the backdrop
  // drew and the others add to it
  if (feat.reds && !strip.includes("reds")) {
    const m = new THREE.Mesh(photoLightsGeometry(THREE), new THREE.ShaderMaterial({
      uniforms: U, vertexShader: photoLightsVertex(BH), fragmentShader: photoLightsFragment({ BH, win: WIN, strip, ...feat }),
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,   // premultiplied
    }));
    m.frustumCulled = false; m.renderOrder = -2; m.name = "city_lights_photo"; m.raycast = () => {};
    overlay.add(m);
  }
  scene.add(overlay);
  // with showers there are more drops, and the shower decides how many of them fall
  const rainObj = rain ? createRain(THREE, scene, feat.weather ? { count: 1900, showers: true } : undefined) : null;
  ph.promise.then(t => { U.map.value = t; });
  win.promise.then(t => { U.winTex.value = t; });
  dm && dm.promise.then(t => { U.depthTex.value = t; });
  const ready = Promise.all([ph.promise, win.promise, ...(dm ? [dm.promise] : [])]);
  return {
    backdrop, overlay, ready, rain: rainObj,
    // how hard it is raining, 0 (a drizzle) to 1 (a downpour), for the page's rain sound and the drops on the glass;
    // null without showers
    get weather() { return feat.weather ? U.uWx.value.x : null; },
    update(T, dt, ctx = {}) {
      U.T.value = T;
      frameUniforms(U, T, ctx.trainT, ctx.life, extras);   // ctx.life: the Berlin night (lib/night.js); left out, a busy evening
      U.uPhoto.value = ph.update(); U.uWin.value = U.winTex.value ? win.update() : 0;
      if (rainObj) { rainObj.update(T); if (feat.weather) rainObj.density(.3 + .7 * U.uWx.value.x); }
    },
    dispose() {
      scene.remove(backdrop); backdrop.geometry.dispose(); mat.dispose(); noise.dispose();
      overlay.parent && overlay.parent.remove(overlay); overlay.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      [ph, win, dm].forEach(h => h && h.tex && h.tex.dispose());
      rainObj && rainObj.dispose();
    },
  };
}
