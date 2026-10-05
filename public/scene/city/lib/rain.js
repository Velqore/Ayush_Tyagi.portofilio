// Rain streaks outside the window, moved on the GPU.
// The old LineSegments' distribution (1100 segments, about 0.3 m long, about 6.5 m/s, opacity .12), but the fall is a
// vertex-shader function of one uniform, so the CPU does no per-vertex work. The clock is wrapped on the CPU
// (T % PERIOD) so float precision never degrades.
// Streaks nearer the camera than near[1] metres fade out (gone at near[0]): from the desk the nearest is about three
// metres off and nothing changes, but standing at the glass the closest ones would be long lines across the view.
// With showers each drop gets a random threshold, and density(v) (0..1) lets that share of them fall, a little
// brighter as it rises: a shower thickens and thins the rain without touching a vertex.
export function createRain(THREE, scene, {
  count = 1100, color = "#a7b8dd", opacity = .12, speed = 6.5, len = .3, slant = .01,
  x0 = -4.5, x1 = 4.5, y0 = -3, span = 8, z0 = -1.2, z1 = -8.2, seed = 1, near = [1.7, 2.9], showers = false,
} = {}) {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = Math.imul(s ^ s >>> 15, s | 1) + 0x6D2B79F5 | 0, ((s ^ s >>> 7) >>> 0) / 4294967296));
  // Drops fall at five speeds around `speed`, in steps of span/PERIOD, so after PERIOD seconds each one has fallen whole
  // spans and the clock can wrap there without a jump. All at one speed, the eye pairs a streak with the one just above it
  // in the next frame and sees it rise, most of all at 30 frames a second; mixed speeds and a streak that is brightest at
  // its falling end leave no such pairs.
  const PERIOD = 16, step = span / PERIOD, n0 = Math.round(speed / step) - 2;
  const pos = new Float32Array(count * 6), end = new Float32Array(count * 2), vel = new Float32Array(count * 2);
  const thr = showers ? new Float32Array(count * 2) : null;
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * span, z = z0 + rnd() * (z1 - z0), v = (n0 + Math.floor(rnd() * 5)) * step;
    pos.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1; vel[i * 2] = vel[i * 2 + 1] = v;
    if (thr) thr[i * 2] = thr[i * 2 + 1] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 1));
  if (thr) geo.setAttribute("aThr", new THREE.BufferAttribute(thr, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, ...(showers ? { uDen: { value: 1 } } : {}) },
    vertexShader: `attribute float aEnd, aVel${showers ? ", aThr" : ""}; uniform float uT${showers ? ", uDen" : ""}; varying float vNear, vEnd;
      void main(){
        vec3 p=position;
        // a faster drop draws a longer streak, as a camera's shutter would; aEnd 1 is its lower, leading end
        p.y=mod(p.y-(${y0.toFixed(3)})-uT*aVel,${span.toFixed(3)})+(${y0.toFixed(3)})-aEnd*${len.toFixed(3)}*aVel/${speed.toFixed(3)};
        p.x-=aEnd*${slant.toFixed(4)};
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vNear=smoothstep(${near[0].toFixed(3)},${near[1].toFixed(3)},length(mv.xyz))${showers ? "*step(aThr,uDen)" : ""}; vEnd=aEnd;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity${showers ? ", uDen" : ""}; varying float vNear, vEnd;
      void main(){ gl_FragColor=vec4(uColor,uOpacity*vNear*(.25+.95*vEnd)${showers ? "*(.75+.35*uDen)" : ""}); }`,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;   // positions move in the shader; the static bounds would be wrong
  mesh.name = "city_rain";
  scene.add(mesh);
  return {
    mesh,
    update(T) { mat.uniforms.uT.value = T % PERIOD; },
    density(v) { if (showers) mat.uniforms.uDen.value = v; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}

// The old CPU path, kept only so the baseline variant can be measured as it ships today.
export function createCpuRain(THREE, scene, { count = 1100 } = {}) {
  const geo = new THREE.BufferGeometry(); const rp = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) { const x = (Math.random() - .5) * 9, y = Math.random() * 8 - 3, z = -1.2 - Math.random() * 7; rp.set([x, y, z, x - .01, y - .3, z], i * 6); }
  geo.setAttribute("position", new THREE.BufferAttribute(rp, 3));
  const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#a7b8dd", transparent: true, opacity: .12, depthWrite: false }));
  mesh.name = "city_rain_cpu";
  scene.add(mesh);
  return {
    mesh,
    update(T, dt) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) { let y = a[i * 6 + 1] - dt * 6.5; if (y < -3) y += 8; a[i * 6 + 1] = y; a[i * 6 + 4] = y - .3; }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mesh.material.dispose(); },
  };
}
