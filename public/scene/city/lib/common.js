// Shared pieces for the city variants: the photo cylinder, GLSL helpers, a one-time GPU noise bake,
// and texture loading that never blocks first paint (everything fades in when it lands).

// The photo is mapped exactly as the shipped backdrop does it, so the baked room lighting still matches:
// a 30 m open cylinder spanning 160 deg; the photo covers the middle 47 m and mirrors outward.
export const R = 30, PHOTO_W = 47;

export function cylinderGeometry(THREE, BH) {
  return new THREE.CylinderGeometry(R, R, BH * 1.6, 120, 1, true, Math.PI - 1.4, 2.8);
}
export function placeCylinder(mesh, BH, BZ0) { mesh.position.set(0, BZ0 + BH * .6, 0); }

// GLSL: hashes without sin() (stable on mobile GPUs), value noise, and the photo mapping.
export const GLSL_COMMON = /* glsl */`
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash21(float p){ vec3 p3=fract(vec3(p)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float lum(vec3 c){ return dot(c,vec3(.2126,.7152,.0722)); }
float glow(vec2 d,float r){ return 1.-smoothstep(0.,r,length(d)); }
`;

// One-time bake of a 256x256 tileable fbm texture on the GPU: four independent fields in RGBA.
// Sampling it costs one fetch where the old shader evaluated five octaves of value noise.
export function bakeNoise(THREE, renderer, size = 256) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
  });
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: /* glsl */`precision highp float; varying vec2 vUv;
      float h(vec2 p,float s){ vec3 p3=fract(vec3(p.xyx+s*vec2(17.13,59.71).xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
      float n(vec2 p,float per,float s){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        vec2 i0=mod(i,per), i1=mod(i+1.,per);
        return mix(mix(h(i0,s),h(vec2(i1.x,i0.y),s),f.x),mix(h(vec2(i0.x,i1.y),s),h(i1,s),f.x),f.y); }
      float fbm(vec2 p,float per,float s){ float a=.5,t=0.,w=0.; for(int i=0;i<6;i++){ t+=a*n(p,per,s); w+=a; p*=2.; per*=2.; a*=.5; } return t/w; }
      void main(){
        vec2 p=vUv*8.;
        // R,G: two fbm fields (clouds, warp); B: finer fbm; A: streaky noise, stretched in y (rain, shimmer)
        gl_FragColor=vec4(fbm(p,8.,1.),fbm(p,8.,7.),fbm(p*2.,16.,3.),fbm(vec2(p.x*4.,p.y*.5),32.,5.));
      }`,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene(); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget(), prevXR = renderer.xr.enabled; renderer.xr.enabled = false;
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev); renderer.xr.enabled = prevXR;
  mat.dispose(); quad.geometry.dispose();
  return rt;
}

// Load a texture without blocking; returns a handle whose `fade` rises 0..1 over `dur` seconds (wall clock)
// after the image lands. Fades read performance.now(), so they never depend on the animation clock.
export function lateTexture(THREE, loader, url, { srgb = false, nearest = false, mip = true, aniso = 1, flipY = true, dur = 1.2 } = {}) {
  const h = { tex: null, t0: -1, fade: 0, promise: null };
  h.promise = new Promise(res => {
    loader.load(url, tx => {
      tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tx.flipY = flipY;
      if (nearest) { tx.minFilter = tx.magFilter = THREE.NearestFilter; tx.generateMipmaps = false; }
      else if (!mip) { tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; }
      tx.anisotropy = aniso; tx.needsUpdate = true;
      h.tex = tx; h.t0 = performance.now(); res(tx);
    }, undefined, err => { console.warn("city: texture failed", url, err); res(null); });
  });
  h.update = () => { if (h.t0 >= 0 && h.fade < 1) h.fade = Math.min(1, (performance.now() - h.t0) / (dur * 1000)); return h.fade; };
  return h;
}

// Resolve an asset that ships next to the variant modules (city/assets/...), independent of the page URL.
export const assetUrl = name => new URL(`../assets/${name}`, import.meta.url).href;
