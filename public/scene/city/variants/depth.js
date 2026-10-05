// Variant "depth": the living photo plus parallax. Each photo pixel gets a distance from the home camera: the ground
// plane 12 m below the photographer out of the same camera model the traffic uses, and wherever assets/depth.png (a
// depth model's estimate, 50 KB) has something nearer, that: masts, signals, the buildings on the left. The shader
// finds, per pixel, where the view ray meets that surface (a few fixed-point steps). From the home camera the picture
// is exactly the living one, so the baked room light still matches; when the camera drifts or orbits, the masts and
// the tracks slide against the skyline and the city stops behaving like a poster 30 m away.
// On top of that (lib/living-shader.js): more trains, with headlights and glints on the wet rails; showers that come
// and go, thickening the rain and hazing the far city; mist over the yard; and the photo's own lights switching: the
// red lights of the cranes and chimneys blink, the rail signals clear to green now and then, a sign flickers. Each
// can be turned off (depthMap: false, trains: false, weather: false, mist: false, reds: false), for comparing.
import { createCity as createLiving, HOME_EYE } from "./living.js";

export const info = { name: "depth", label: "Depth photo" };

export function createCity(THREE, opts) {
  return createLiving(THREE, { depthMap: true, trains: true, weather: true, mist: true, reds: true, ...opts, parallax: true, eye: opts.eye || HOME_EYE });
}
