// The old PC's plastic, up close (thread "PC screen look"). Felix, 26 Sep 04:06Z: the grey/white monitor's texture "seems
// off". About puts the bezel a hand's width from the camera, where its bake shows: some 5 mm of plastic to a texel, read
// bilinearly, on a surface with no texture of its own, and a dark, stepped notch in each corner of the glass. With the
// cleaned light maps (pccase/clean_irr.py) this is the page's half, on the PC's baked materials only:
//  - their light maps are read through a cubic B-spline (four bilinear taps), so the bake's texels blend into gradients
//    instead of steps and diamonds;
//  - the moulded plastics get a fine stipple, the texture ABS housings had (a bump, with the roughness in step), and are a
//    little glossier;
//  - pcCaseLip: the lip's corner faces, which retro_pc.py gives the recess's dark material, are drawn in the housing's grey,
//    and so are the housing's faces next to them, which the bake smudged with that dark.
// Wiring (pccase/wire.py): each of the PC's meshes gets its clone right after the page gives it its baked material,
//   o.material=pcCase(THREE,o.material,mname)
// and pcCaseLip(THREE,root) runs once the scene is set up. Meshes that share a baked material share its clone.
// bump height, stipple tiles per lightmap unit (about 2 cm each), the stipple's roughness range, and how much glossier than
// the page's plastics (the TV's come out near .34). The reflection's occlusion stays the page's (SPEC_OCC): stronger, it
// lightens the shadow the monitor casts on the base unit.
export const CASE={ grain:.18, repeat:220, rough:[.84,1], gloss:.08 };
const PLASTIC=/^retro_(grey|grey_dark|grey_inner|beige|beige_front|kb_case)$/;
const clones=new Map();   // the page's baked material -> the PC's
let stipple=null, warned=false;

const CUBIC=`
// the bake's light through a cubic B-spline: four bilinear taps (the maps filter linearly, level 0 only)
vec3 pcCubic(sampler2D t,vec2 uv){
  vec2 sz=vec2(textureSize(t,0)), p=uv*sz-.5, i=floor(p), f=p-i, f2=f*f, f3=f2*f;
  vec2 w0=(1.-3.*f+3.*f2-f3)/6., w1=(4.-6.*f2+3.*f3)/6., w2=(1.+3.*f+3.*f2-3.*f3)/6., w3=f3/6.;
  vec2 g0=w0+w1, g1=w2+w3, h0=(i-.5+w1/g0)/sz, h1=(i+1.5+w3/g1)/sz;
  return g0.y*(g0.x*texture2D(t,h0).rgb+g1.x*texture2D(t,vec2(h1.x,h0.y)).rgb)+g1.y*(g0.x*texture2D(t,vec2(h0.x,h1.y)).rgb+g1.x*texture2D(t,h1).rgb);
}
`;
function patch(sh){
  let f=sh.fragmentShader, n=0;
  for(const t of ["lightMap","irrD","irrB"]){ const a=`texture2D(${t},vLightMapUv).rgb`; if(f.includes(a)){ f=f.split(a).join(`pcCubic(${t},vLightMapUv)`); n++; } }
  if(n) f=f.replace("void main() {",CUBIC+"void main() {");
  else if(!warned){ warned=true; console.warn("pccase: the bake's shader has changed; the old PC's light maps are read as before"); }
  sh.fragmentShader=f;
}
// the stipple: soft bumps a few tenths of a millimetre across over a gentler swell, as a height (red) and a roughness
// factor (green); tiled on the lightmap's UVs, the only ones the PC has, about 2 cm to a tile
function stippleTex(THREE){
  if(stipple) return stipple;
  const N=512, f=new Float32Array(N*N); let s=7;
  for(let i=0;i<N*N;i++){ s=s*16807%2147483647; f[i]=s/2147483647; }
  const blur=(a,r)=>{ const o=new Float32Array(N*N), o2=new Float32Array(N*N);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ let t=0; for(let k=-r;k<=r;k++) t+=a[y*N+(x+k+N)%N]; o[y*N+x]=t/(2*r+1); }
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ let t=0; for(let k=-r;k<=r;k++) t+=o[((y+k+N)%N)*N+x]; o2[y*N+x]=t/(2*r+1); }
    return o2; };
  const a=blur(blur(f,1),1), b=blur(f,4), h=new Float32Array(N*N); let lo=1e9, hi=-1e9;
  for(let i=0;i<N*N;i++){ h[i]=a[i]*.75+b[i]*.25; lo=Math.min(lo,h[i]); hi=Math.max(hi,h[i]); }
  const d=new Uint8Array(N*N*4), [r0,r1]=CASE.rough;
  for(let i=0;i<N*N;i++){ const v=(h[i]-lo)/(hi-lo); d[4*i]=Math.round(255*v); d[4*i+1]=Math.round(255*(r0+(r1-r0)*v)); d[4*i+2]=0; d[4*i+3]=255; }
  const t=new THREE.DataTexture(d,N,N); t.channel=1; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(CASE.repeat,CASE.repeat);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=8; t.needsUpdate=true;
  return stipple=t;
}
export function pcCase(THREE,m,name){
  if(clones.has(m)) return clones.get(m);
  if(!m?.lightMap||m.userData.pcCase) return m;   // metals keep their own material (no bake), and a clone is already done
  const plastic=PLASTIC.test(name), c=m.clone(), obc=m.onBeforeCompile, key=m.customProgramCacheKey;
  c.onBeforeCompile=(sh,r)=>{ obc.call(c,sh,r); patch(sh); };
  c.customProgramCacheKey=()=>key.call(c)+"|pccase";
  c.userData.pcCase=name;
  if(plastic){ const t=stippleTex(THREE); c.bumpMap=t; c.bumpScale=CASE.grain; c.roughnessMap=t; c.roughness=Math.min(1,(m.roughness-CASE.gloss)*2/(CASE.rough[0]+CASE.rough[1])); }
  clones.set(m,c); return c;
}
// The lip's corners. retro_pc.py gives the recess's dark material (retro_grey_inner) to every face of the monitor's shell
// whose centre is inside the opening's rectangle, which at the corners takes in the lip, grey the rest of the way round:
// four dark, stepped notches in the corners of the glass. Their triangles (the recess's that touch the front plane, z=0 in
// the monitor's space) move to a mesh of their own with the housing's material and its flat colour: the atlas has the
// recess's dark under them. The bake also spread that dark a few texels round them in the albedo atlas, where the lip's
// grey faces next to them read it as smudges, so the housing's triangles whose lightmap UVs come within 2 texels of the
// notch's go flat too (32 of them). Once the model and the bake have the fix (pccase/retro_pc.diff), there's nothing to move.
const LIP_GREY=[181,175,163];   // the housing's albedo in the gear atlas (sRGB, flat to about 1%)
function split(THREE,o,pick,mat,name){   // o's triangles for which pick(a,b,c) holds, as a mesh of their own on the same attributes
  const g=o.geometry, idx=g.index, keep=[], take=[];
  for(let i=0;i<idx.count;i+=3){ const t=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)]; (pick(...t)?take:keep).push(...t); }
  if(!take.length) return null;
  const bg=new THREE.BufferGeometry(); for(const [k,a] of Object.entries(g.attributes)) bg.setAttribute(k,a);
  bg.setIndex(take); g.setIndex(keep);
  const pos=g.attributes.position, v=new THREE.Vector3(), bb=new THREE.Box3();
  for(const i of take) bb.expandByPoint(v.fromBufferAttribute(pos,i));   // its own bounds, not the whole vertex list
  bg.boundingBox=bb; bg.boundingSphere=bb.getBoundingSphere(new THREE.Sphere());
  const m=new THREE.Mesh(bg,mat); m.name=name; m.castShadow=o.castShadow; m.receiveShadow=o.receiveShadow;
  m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); o.parent.add(m);
  m.userData.pcLip={now:mat,before:[...clones].find(([,c])=>c===o.material)?.[0]||o.material};
  return m;
}
export function pcCaseLip(THREE,root){
  const mon=root.getObjectByName("retro_monitor"); if(!mon) return 0;
  mon.updateWorldMatrix(true,true);
  const part=nm=>mon.children.find(o=>o.isMesh&&o.material?.userData.pcCase===nm);
  const inner=part("retro_grey_inner"), grey=part("retro_grey"); if(!inner?.geometry.index||!grey?.geometry.index) return 0;
  const pos=inner.geometry.attributes.position, toMon=new THREE.Matrix4().copy(mon.matrixWorld).invert().multiply(inner.matrixWorld), v=new THREE.Vector3();
  const front=i=>Math.abs(v.fromBufferAttribute(pos,i).applyMatrix4(toMon).z)<.001;
  const m=grey.material.clone(); m.onBeforeCompile=grey.material.onBeforeCompile; m.customProgramCacheKey=grey.material.customProgramCacheKey;
  m.map=null; m.color.setRGB(...LIP_GREY.map(x=>x/255),THREE.SRGBColorSpace);
  const lip=split(THREE,inner,(a,b,c)=>front(a)||front(b)||front(c),m,"retro_monitor~lip"); if(!lip) return 0;
  const uvI=inner.geometry.attributes.uv1, uvG=grey.geometry.attributes.uv1, ti=lip.geometry.index, box=[], M=2/1024;
  for(let i=0;i<ti.count;i+=3){ const u=[0,1,2].map(k=>uvI.getX(ti.getX(i+k))), w=[0,1,2].map(k=>uvI.getY(ti.getX(i+k)));
    box.push([Math.min(...u)-M,Math.min(...w)-M,Math.max(...u)+M,Math.max(...w)+M]); }
  const near=i=>{ const u=uvG.getX(i), w=uvG.getY(i); return box.some(b=>u>b[0]&&u<b[2]&&w>b[1]&&w<b[3]); };
  const edge=split(THREE,grey,(a,b,c)=>near(a)||near(b)||near(c),m,"retro_monitor~lipedge");
  return ti.count/3+(edge?edge.geometry.index.count/3:0);
}
// previews: the old PC as the page drew it before (false) and with this (true)
export function pcCaseAB(scene,on){
  const before=new Map([...clones].map(([m,c])=>[c,m]));
  scene.traverse(o=>{ if(!o.isMesh) return; const L=o.userData.pcLip;
    if(L) o.material=on?L.now:L.before;
    else if(on&&clones.has(o.material)) o.material=clones.get(o.material);
    else if(!on&&before.has(o.material)) o.material=before.get(o.material); });
}
