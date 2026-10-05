// The window's frame and sill, up close (thread "Window frame texture"). Felix, 27 Sep 03:01Z, of the frame past the TV:
// "the white blobby thing? i think you can do better". The casements and the sill shared the room atlas: about 13 mm of
// paint to a texel (26 mm in the TV's and the lamp-off maps), cut by the export's islands into slivers along every bevel,
// under the bake's noise and a mottled paint. Now they have an atlas of their own, "win" in bake/bake.json (win_albedo,
// win_irrA/B/D.jpg; winframe/tools/bake_win.py in the v9 kit's scene), at 1.7 mm to a texel:
//  - winUV: each part's triangles are re-indexed by the side of its box they face (winframe/tools/chart.py; a vertex on a
//    side's edge gets one copy per side), with the new atlas's UVs as uv1, and the part moves to the "win" atlas;
//  - winPaint: the frame's and the sill's baked materials read their light through a cubic B-spline (no steps or
//    diamonds up close) over one flat paint colour, with faint brush marks along the wood (a bump, the roughness in step).
// Wiring (winframe/wire.py):
//   right after expandQuantized(root):   winUV(THREE,root,BAKE)
//   in the traverse, after the line that gives baked materials:   if(o.userData.winPaint) o.material=winPaint(THREE,o.material,o.userData.winPaint)
// If the loaded glTF's window is not the one the charts were made for (a new export), or bake.json has no "win", winUV
// leaves the window as it was (the room atlas) and says so in the console. A new export or a change round the window
// wants the charts and the bake re-run (winframe/README.md).
import { WIN } from "./charts.js";

// brush marks: bump height per material (the sill is smoother than the frame), the roughness factor on the ridges and in
// the grooves, and the tile's size along and across the wood in metres
export const PAINT={ bump:{frame_paint:.05,sill:.03}, rough:[.86,1], tile:[.4,.19] };
const clones=new Map();   // the page's baked material -> ours
let brush=null, warned=false;

const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
// the name GLTFLoader gives a node (PropertyBinding.sanitizeNodeName)
const nodeName=s=>s.replace(/\s/g,"_").replace(/[\[\]\.:\/]/g,"");

export function winUV(THREE,root,BAKE){
  const fail=why=>{ console.warn("winframe: "+why+"; the window keeps the room's light map"); return 0; };
  if(!BAKE?.win) return fail("bake.json has no \"win\" atlas");
  const found=[];
  for(const [name,P] of Object.entries(WIN.parts)){
    const o=root.getObjectByName(nodeName(name)), g=o?.geometry;
    if(!o?.isMesh||!g.index||!g.attributes.position) return fail(name+" is missing");
    const pos=g.attributes.position;
    if(pos.count!==P.n||g.index.count!==3*P.ntri) return fail(name+" has changed");
    for(let k=0;k<P.at.length;k++){ const i=P.at[k], p=P.p[k];
      if(Math.abs(pos.getX(i)-p[0])>1e-4||Math.abs(pos.getY(i)-p[1])>1e-4||Math.abs(pos.getZ(i)-p[2])>1e-4) return fail(name+" has moved"); }
    found.push([o,P]);
  }
  const get=[(a,i)=>a.getX(i),(a,i)=>a.getY(i),(a,i)=>a.getZ(i),(a,i)=>a.getW(i)];
  for(const [o,P] of found){
    const g=o.geometry, idx=g.index, pos=g.attributes.position, tri=b64(P.tri), A=P.charts;
    // one vertex per (vertex, chart): numbered in order of first use, as tools/bake_win.py numbers them
    const key=new Map(), from=[], chart=[], index=new Uint32Array(idx.count);
    for(let t=0;t<P.ntri;t++){ const c=tri[t];
      for(let j=0;j<3;j++){ const v=idx.getX(3*t+j), k=v*64+c; let n=key.get(k);
        if(n===undefined){ n=from.length; key.set(k,n); from.push(v); chart.push(c); }
        index[3*t+j]=n; } }
    const ng=new THREE.BufferGeometry();
    for(const [nm,a] of Object.entries(g.attributes)){ if(nm==="uv1") continue;
      const s=a.itemSize, f=new Float32Array(from.length*s);
      for(let i=0;i<from.length;i++) for(let c=0;c<s;c++) f[i*s+c]=get[c](a,from[i]);
      ng.setAttribute(nm,new THREE.BufferAttribute(f,s)); }
    const uv=new Float32Array(from.length*2);
    for(let i=0;i<from.length;i++){ const m=A[chart[i]], v=from[i], x=pos.getX(v), y=pos.getY(v), z=pos.getZ(v);
      uv[2*i]=m[0]*x+m[1]*y+m[2]*z+m[3]; uv[2*i+1]=m[4]*x+m[5]*y+m[6]*z+m[7]; }
    ng.setAttribute("uv1",new THREE.BufferAttribute(uv,2));
    ng.setIndex(new THREE.BufferAttribute(from.length>65535?index:Uint16Array.from(index),1));
    ng.computeBoundingBox(); ng.computeBoundingSphere();
    o.geometry=ng; o.userData.atlas="win"; o.userData.winPaint=P.mat;
  }
  return found.length;
}

const CUBIC=`
// the bake's light through a cubic B-spline: four bilinear taps (the maps filter linearly, level 0 only)
vec3 winCubic(sampler2D t,vec2 uv){
  vec2 sz=vec2(textureSize(t,0)), p=uv*sz-.5, i=floor(p), f=p-i, f2=f*f, f3=f2*f;
  vec2 w0=(1.-3.*f+3.*f2-f3)/6., w1=(4.-6.*f2+3.*f3)/6., w2=(1.+3.*f+3.*f2-3.*f3)/6., w3=f3/6.;
  vec2 g0=w0+w1, g1=w2+w3, h0=(i-.5+w1/g0)/sz, h1=(i+1.5+w3/g1)/sz;
  return g0.y*(g0.x*texture2D(t,h0).rgb+g1.x*texture2D(t,vec2(h1.x,h0.y)).rgb)+g1.y*(g0.x*texture2D(t,vec2(h0.x,h1.y)).rgb+g1.x*texture2D(t,h1).rgb);
}
`;
function patch(sh){
  let f=sh.fragmentShader, n=0;
  for(const t of ["lightMap","irrD","irrB"]){ const a=`texture2D(${t},vLightMapUv).rgb`; if(f.includes(a)){ f=f.split(a).join(`winCubic(${t},vLightMapUv)`); n++; } }
  if(n) f=f.replace("void main() {",CUBIC+"void main() {");
  else if(!warned){ warned=true; console.warn("winframe: the bake's shader has changed; the window's light maps are read as before"); }
  sh.fragmentShader=f;
}
// brush marks: fine ridges a millimetre or two apart that run a few centimetres along the wood and fade, as a height (red)
// and a roughness factor (green), tiled on uv1 (the charts keep the wood's direction along u, at one scale)
function brushTex(THREE){
  if(brush) return brush;
  const N=256, f=new Float32Array(N*N); let s=11;
  for(let i=0;i<N*N;i++){ s=s*16807%2147483647; f[i]=s/2147483647; }
  const box=(a,r,along)=>{ const o=new Float32Array(N*N), w=(i,j)=>along?j*N+(i&N-1):(i&N-1)*N+j;   // a running box, wrapping (N is a power of 2)
    for(let j=0;j<N;j++){ let t=0; for(let k=-r;k<=r;k++) t+=a[w(k,j)];
      for(let i=0;i<N;i++){ o[w(i,j)]=t/(2*r+1); t+=a[w(i+r+1,j)]-a[w(i-r,j)]; } }
    return o; };
  const blur=(a,rx,ry)=>box(box(a,rx,true),ry,false);
  const a=blur(blur(f,14,0),14,1), b=blur(blur(f,40,3),40,3), h=new Float32Array(N*N); let lo=1e9, hi=-1e9;
  for(let i=0;i<N*N;i++){ h[i]=a[i]+.6*b[i]; lo=Math.min(lo,h[i]); hi=Math.max(hi,h[i]); }
  const d=new Uint8Array(N*N*4), [r0,r1]=PAINT.rough;
  for(let i=0;i<N*N;i++){ const v=(h[i]-lo)/(hi-lo); d[4*i]=Math.round(255*v); d[4*i+1]=Math.round(255*(r1+(r0-r1)*v)); d[4*i+2]=0; d[4*i+3]=255; }
  const t=new THREE.DataTexture(d,N,N); t.channel=1; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  const texel=WIN.texel_mm/1000; t.repeat.set(WIN.W*texel/PAINT.tile[0],WIN.H*texel/PAINT.tile[1]);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=8; t.needsUpdate=true;
  return brush=t;
}
export function winPaint(THREE,m,kind){
  if(clones.has(m)) return clones.get(m);
  if(!m?.lightMap||m.userData.winPaint) return m;
  const c=m.clone(), obc=m.onBeforeCompile, key=m.customProgramCacheKey;
  c.onBeforeCompile=(sh,r)=>{ obc.call(c,sh,r); patch(sh); };
  c.customProgramCacheKey=()=>key.call(c)+"|winframe";
  c.userData.winPaint=kind;
  const t=brushTex(THREE); c.bumpMap=t; c.bumpScale=PAINT.bump[kind]??PAINT.bump.frame_paint;
  c.roughnessMap=t; c.roughness=Math.min(1,m.roughness*2/(PAINT.rough[0]+PAINT.rough[1]));   // the page's roughness on average
  clones.set(m,c); return c;
}
