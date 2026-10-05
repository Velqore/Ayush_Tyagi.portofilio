// The VCR's cassette flap (thread "VCR tape door"; Felix, 26 Sep 16:21Z: "The VCRs tape door should open and close when
// moving tapes"). In the scene the flap hangs in front of a solid slot box, so the page's old swing turned it into the box
// and nothing showed. Here the flap's opening goes through the VCR's front (the fascia and the body behind it), a dark
// cassette well sits behind it, and the flap hangs from its front top edge on a spring: a cassette going in pushes it up and
// slides in under it, and it drops shut behind the cassette with a little bounce and a click; on eject the deck swings it up
// before the cassette moves, and it falls shut once the cassette is out. No imports: the page passes THREE in. What it
// changes in the scene it changes once, at setup, before the page joins the room's still meshes (perf/join).
export function createVCRDoor(THREE,{root,scene,door,audio=()=>null,reduce=false}={}){
  const stub={lead:0,busy:false,insert(){},eject(){ return 0; },stow(g){ if(g) g.visible=false; },release(){},frame(){},state:null};
  const get=n=>root&&root.getObjectByName(n);
  door=door||get("vcr_door");
  const fascia=get("vcr_fascia"), body=get("vcr_body"), slot=get("vcr_slot"), line=get("vcr_door_line");
  if(!door?.geometry||!fascia?.geometry||!body?.geometry||!scene) return stub;

  const TH_MAX=1.66;   // the flap flat against the well's roof (95°)
  const TH_OPEN=1.6;   // where the deck holds it while a cassette comes out
  const OPEN_T=.14;    // the deck's swing, s
  const LEAD=.16;      // the cassette waits this long inside while the deck opens the flap (the page's eject adds it)
  const A=55, K=45, C=2;   // the spring that shuts it, rad/s²: preloaded (A) so it snaps shut in a sixth of a second and
                           // its bounce is a quick tick, not a swing; K per radian open, C damping
  const E_REST=reduce?0:.12, W_MIN=1.2;   // how much of its speed a shutting flap bounces back with, above W_MIN rad/s
  const E=2e-4;        // contact slack, m

  // ---- the flap, in world units: it turns about the x axis through its front top edge
  root.updateMatrixWorld(true);
  const box=o=>{ const g=o.geometry; if(!g.boundingBox) g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(o.matrixWorld); };
  const db=box(door), L=db.max.y-db.min.y, T=db.max.z-db.min.z, X0=db.min.x, X1=db.max.x;
  const P={y:db.max.y,z:db.max.z};
  const Pl=door.parent.worldToLocal(new THREE.Vector3(0,P.y,P.z)), rest=door.position.clone(), restRot=door.rotation.x;
  const oy=rest.y-Pl.y, oz=rest.z-Pl.z;
  if(line){ door.attach(line); line.castShadow=false; }   // the groove across the flap turns with it (and stays out of the join with it)
  door.castShadow=false;   // (its shadow falls inside the VCR: no shadow map to redo while it swings)

  // ---- the opening: the flap's outline, less half a millimetre at the sides and bottom so the shut flap overlaps its frame
  const hx0=X0+5e-4, hx1=X1-5e-4, hy0=db.min.y+5e-4, hy1=db.max.y;
  const zf=box(fascia).max.z, zb=zf-.16;   // the fascia's face, and the back of the well (behind the deepest a cassette goes)
  const cut=[cutHole(fascia),cutHole(body)];   // faces cut: the fascia's front and back, the body's front
  if(!cut[0]||!cut[1]) return stub;   // (a scene whose VCR is built differently keeps its flap still)
  if(slot) slot.visible=false;   // the dark box the flap used to hang in front of; the well takes its place

  // the cassette well: five dark walls facing in, seen only through the opening
  const well=new THREE.Mesh(wellGeometry(),new THREE.MeshBasicMaterial({vertexColors:true}));
  // and the dark in it: thin black veils one behind the other, so a cassette (and the flap's lower edge) dims as it goes deeper
  const DEPTHS=Array.from({length:20},(_,i)=>.0015+i*.003);
  const fog=new THREE.Mesh(veilGeometry(),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.11,depthWrite:false}));
  well.name="vcr_well"; fog.name="vcr_well_dark"; fog.renderOrder=10;
  for(const m of [well,fog]){ m.visible=false; m.castShadow=m.receiveShadow=false; m.raycast=()=>{}; m.matrixAutoUpdate=false; scene.add(m); }

  // ---- state
  let th=0, w=0, track=null, motor=null, pending=null;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  function pose(){
    const c=Math.cos(th), s=Math.sin(th);
    door.position.set(rest.x,Pl.y+oy*c-oz*s,Pl.z+oy*s+oz*c); door.rotation.x=restRot+th;
    const open=th>1e-4; if(well.visible!==open){ well.visible=open; fog.visible=open; }
  }

  // the cassette being moved: its box in its own group's frame, and each frame that box in the room
  function localBox(g){
    g.updateWorldMatrix(true,true);
    const inv=g.matrixWorld.clone().invert(), m=new THREE.Matrix4(), b=new THREE.Box3(), part=new THREE.Box3();
    g.traverse(o=>{ if(!o.isMesh||!o.geometry) return; const ge=o.geometry; if(!ge.boundingBox) ge.computeBoundingBox();
      b.union(part.copy(ge.boundingBox).applyMatrix4(m.multiplyMatrices(inv,o.matrixWorld))); });
    return b;
  }
  const v=new THREE.Vector3(), wb=new THREE.Box3();
  function worldBox(tr){
    const g=tr.g, b=tr.box; g.updateWorldMatrix(true,false); wb.makeEmpty();
    for(let i=0;i<8;i++) wb.expandByPoint(v.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(g.matrixWorld));
    return wb;
  }
  // does the flap at angle a cut into the cassette's box? Its cross-section is a rectangle from the hinge along its length
  // (L, down and in) and its thickness (T, in); the box's is a rectangle too: separating axes in the y-z plane
  const Y=[0,0,0,0], Z=[0,0,0,0];
  function hits(a,b){
    const c=Math.cos(a), s=Math.sin(a), ay=-L*c, az=-L*s, by=T*s, bz=-T*c;
    Y[0]=P.y; Z[0]=P.z; Y[1]=P.y+ay; Z[1]=P.z+az; Y[2]=Y[1]+by; Z[2]=Z[1]+bz; Y[3]=P.y+by; Z[3]=P.z+bz;
    if(Math.max(...Y)<=b.min.y+E||Math.min(...Y)>=b.max.y-E||Math.max(...Z)<=b.min.z+E||Math.min(...Z)>=b.max.z-E) return false;
    for(const [uy,uz] of [[-c,-s],[s,-c]]){
      let r0=Infinity, r1=-Infinity, q0=Infinity, q1=-Infinity;
      for(let i=0;i<4;i++){ const r=Y[i]*uy+Z[i]*uz; if(r<r0) r0=r; if(r>r1) r1=r;
        const q=(i&1?b.max.y:b.min.y)*uy+(i&2?b.max.z:b.min.z)*uz; if(q<q0) q0=q; if(q>q1) q1=q; }
      if(r1<=q0+E||r0>=q1-E) return false;
    }
    return true;
  }
  // the angles the cassette leaves the flap no room at: {lo,hi}, or null when it's clear of the flap's swing
  function blocked(tr){
    if(!tr.g.visible) return null;
    const b=worldBox(tr);
    if(b.max.x<=X0+E||b.min.x>=X1-E||b.max.y<=P.y-L||b.min.y>=P.y+T||b.min.z>=P.z-E||b.max.z<=P.z-L-T) return null;
    const n=96; let lo=-1, hi=-1;
    for(let i=0;i<=n;i++){ const a=TH_MAX*i/n; if(hits(a,b)){ if(lo<0) lo=a; hi=a; } }
    if(lo<0) return null;
    let x=hi, y=hi+TH_MAX/n;
    if(y>TH_MAX) y=TH_MAX; else for(let k=0;k<8;k++){ const m=(x+y)/2; if(hits(m,b)) x=m; else y=m; }
    return {lo,hi:y};
  }

  function stowNow(){ if(pending){ pending.visible=false; pending=null; } }

  function frame(dt){
    if(!track&&!motor&&!pending&&th===0&&w===0) return;
    dt=Math.min(Math.max(dt,0),.05);
    const B=track?blocked(track):null;
    if(motor){ motor.t+=dt; const m=TH_OPEN*ease(Math.min(1,motor.t/OPEN_T)); if(th<m){ th=m; if(w<0) w=0; }
      if(!track||motor.t>1.5||motor.t>LEAD&&B&&B.hi>th-.08) motor=null; }   // the cassette is under it now: it rests on it
    const n=Math.max(1,Math.ceil(dt/.004)), h=dt/n;
    for(let i=0;i<n;i++){
      if(!motor){ w+=(-(A+K*th)-C*w)*h; th+=w*h; }
      if(th<0){ const sp=-w; th=0;
        if(sp>W_MIN){ click(Math.min(1,sp/14)); w=sp*E_REST; } else w=0;
        stowNow(); }   // it's shut: a cassette that went in can go now (the page hid it at once before)
      if(th>TH_MAX){ th=TH_MAX; if(w>0) w=0; }
      if(B&&th>B.lo-1e-4&&th<B.hi){ th=B.hi; if(w<0) w=0; }   // pushed up by the cassette, or resting on it
    }
    if(!B&&!motor&&th<1e-4&&Math.abs(w)<.05){ th=0; w=0; stowNow(); }
    pose();
  }

  // a small plastic click as it shuts (k: how hard, 0..1), panned a little left like the page's other VCR sounds
  let noise=null;
  function click(k){
    const a=audio(); if(!a||!a.ctx||!a.out||k<.05) return;
    const ctx=a.ctx, t=ctx.currentTime;
    if(!noise||noise.sampleRate!==ctx.sampleRate){ noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.06),ctx.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const pan=ctx.createStereoPanner(); pan.pan.value=-.05; pan.connect(a.out); if(a.verb) pan.connect(a.verb);
    const s=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain(); s.buffer=noise;
    f.type="bandpass"; f.frequency.value=2100+Math.random()*400; f.Q.value=2.5;
    g.gain.setValueAtTime(1e-4,t); g.gain.exponentialRampToValueAtTime(.2*k+1e-4,t+.001); g.gain.exponentialRampToValueAtTime(1e-4,t+.025);
    s.connect(f).connect(g).connect(pan); s.start(t); s.stop(t+.06);
    const o=ctx.createOscillator(), og=ctx.createGain(); o.frequency.setValueAtTime(210,t); o.frequency.exponentialRampToValueAtTime(120,t+.04);
    og.gain.setValueAtTime(1e-4,t); og.gain.exponentialRampToValueAtTime(.12*k+1e-4,t+.002); og.gain.exponentialRampToValueAtTime(1e-4,t+.05);
    o.connect(og).connect(pan); o.start(t); o.stop(t+.07);
  }

  // ---- geometry
  // Cut the opening out of a mesh's flat faces that the well passes through. Each such face (two triangles facing +z or
  // -z, in the VCR's case the fascia's front and back and the body's front) becomes a frame of eight rectangles round the
  // hole, their uv's and light map uv's read off the face's corners, so the baked light round the opening stays put.
  function cutHole(mesh){
    mesh.updateWorldMatrix(true,false);
    const e=mesh.matrixWorld.elements, g=mesh.geometry, pos=g.attributes.position, nor=g.attributes.normal, idx=g.index;
    if(Math.abs(e[1])+Math.abs(e[2])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])>1e-6||e[0]<=0||e[5]<=0||e[10]<=0) return 0;   // (placed without a turn, as the VCR's parts are)
    if(!idx||!nor||Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute)||Object.keys(g.morphAttributes).length) return 0;
    const lx0=(hx0-e[12])/e[0], lx1=(hx1-e[12])/e[0], ly0=(hy0-e[13])/e[5], ly1=(hy1-e[13])/e[5];
    const faces=new Map();
    for(let t=0;t<idx.count;t+=3){
      const a=idx.getX(t), b=idx.getX(t+1), c=idx.getX(t+2), z=pos.getZ(a);
      if(Math.abs(pos.getZ(b)-z)>1e-6||Math.abs(pos.getZ(c)-z)>1e-6||Math.abs(nor.getZ(a))<.95) continue;
      const wz=z*e[10]+e[14]; if(wz<zb||wz>zf+1e-3) continue;
      const k=z.toFixed(6)+(nor.getZ(a)>0?"+":"-"); if(!faces.has(k)) faces.set(k,[]); faces.get(k).push(t);
    }
    const names=Object.keys(g.attributes), drop=new Set(), add=[], extra=[];   // extra: per new vertex, [name]: values
    let nv=pos.count;
    for(const tris of faces.values()){
      if(tris.length!==2) continue;
      const vs=[...new Set(tris.flatMap(t=>[idx.getX(t),idx.getX(t+1),idx.getX(t+2)]))]; if(vs.length!==4) continue;
      const xs=vs.map(i=>pos.getX(i)), ys=vs.map(i=>pos.getY(i));
      const qx0=Math.min(...xs), qx1=Math.max(...xs), qy0=Math.min(...ys), qy1=Math.max(...ys), z=pos.getZ(vs[0]);
      if(!(qx0<lx0-1e-4&&qx1>lx1+1e-4&&qy0<ly0-1e-4&&qy1>ly1+1e-4)) continue;   // the face must hold the whole opening
      const corner=(x,y)=>vs.reduce((m,i)=>Math.hypot(pos.getX(i)-x,pos.getY(i)-y)<Math.hypot(pos.getX(m)-x,pos.getY(m)-y)?i:m,vs[0]);
      const c00=corner(qx0,qy0), c10=corner(qx1,qy0), c11=corner(qx1,qy1), c01=corner(qx0,qy1);
      const read=(a,i)=>{ const out=[]; for(let k=0;k<a.itemSize;k++) out.push(a.getComponent(i,k)); return out; };
      const at=(x,y)=>{ const u=(x-qx0)/(qx1-qx0), s=(y-qy0)/(qy1-qy0), o={};
        for(const n of names){ const a=g.attributes[n];
          if(n==="position"){ o[n]=[x,y,z]; continue; }
          const A=read(a,c00), B=read(a,c10), Cc=read(a,c11), D=read(a,c01);
          o[n]=A.map((_,k)=>(1-u)*(1-s)*A[k]+u*(1-s)*B[k]+u*s*Cc[k]+(1-u)*s*D[k]); }
        return o; };
      const t0=tris[0], p0=read(pos,idx.getX(t0)), p1=read(pos,idx.getX(t0+1)), p2=read(pos,idx.getX(t0+2));
      const ccw=(p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0])>0;   // the face's own winding, seen from +z
      const X=[qx0,lx0,lx1,qx1], Yv=[qy0,ly0,ly1,qy1], base=nv;
      for(let j=0;j<4;j++) for(let i=0;i<4;i++){ extra.push(at(X[i],Yv[j])); nv++; }
      const id=(i,j)=>base+j*4+i;
      for(let j=0;j<3;j++) for(let i=0;i<3;i++){ if(i===1&&j===1) continue;   // the middle cell is the opening
        const a=id(i,j), b=id(i+1,j), c=id(i+1,j+1), d=id(i,j+1);
        if(ccw) add.push(a,b,c,a,c,d); else add.push(a,c,b,a,d,c); }
      tris.forEach(t=>drop.add(t));
    }
    if(!drop.size) return 0;
    for(const n of names){ const a=g.attributes[n], s=a.itemSize;
      const arr=new a.array.constructor(nv*s); arr.set(a.array.subarray(0,a.count*s));
      const na=new THREE.BufferAttribute(arr,s,a.normalized);
      const whole=!a.normalized&&!(arr instanceof Float32Array);
      extra.forEach((o,k)=>{ for(let c=0;c<s;c++) na.setComponent(a.count+k,c,whole?Math.round(o[n][c]):o[n][c]); });
      g.setAttribute(n,na); }
    const keep=[]; for(let t=0;t<idx.count;t+=3) if(!drop.has(t)) keep.push(idx.getX(t),idx.getX(t+1),idx.getX(t+2));
    g.setIndex(new THREE.BufferAttribute(nv>65535?new Uint32Array([...keep,...add]):new Uint16Array([...keep,...add]),1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return drop.size/2;
  }
  // quads, each wound to face the given way
  function quads(list){
    const p=[], c=[], ix=[]; const A=new THREE.Vector3(), B=new THREE.Vector3(), Cv=new THREE.Vector3();
    for(const {q,n,col} of list){
      const k=p.length/3; q.forEach(pt=>p.push(...pt)); for(let i=0;i<4;i++) c.push(col,col,col);
      A.fromArray(q[0]); B.fromArray(q[1]).sub(A); Cv.fromArray(q[2]).sub(A); B.cross(Cv);
      if(B.dot(new THREE.Vector3(...n))>0) ix.push(k,k+1,k+2,k,k+2,k+3); else ix.push(k,k+2,k+1,k,k+3,k+2);
    }
    const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(p,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(c,3)); g.setIndex(ix);
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
  function wellGeometry(){
    const f=zf+3e-4, b=zb;   // (a hair in front of the fascia, so no seam shows at the opening's edge)
    return quads([
      {q:[[hx0,hy0,f],[hx1,hy0,f],[hx1,hy0,b],[hx0,hy0,b]],n:[0,1,0],col:.014},    // floor: the cassette tray
      {q:[[hx0,hy1,f],[hx1,hy1,f],[hx1,hy1,b],[hx0,hy1,b]],n:[0,-1,0],col:.006},   // roof
      {q:[[hx0,hy0,f],[hx0,hy1,f],[hx0,hy1,b],[hx0,hy0,b]],n:[1,0,0],col:.01},     // sides
      {q:[[hx1,hy0,f],[hx1,hy1,f],[hx1,hy1,b],[hx1,hy0,b]],n:[-1,0,0],col:.01},
      {q:[[hx0,hy0,b],[hx1,hy0,b],[hx1,hy1,b],[hx0,hy1,b]],n:[0,0,1],col:.004}]);  // back
  }
  function veilGeometry(){
    return quads(DEPTHS.map(d=>{ const z=zf-d; return {q:[[hx0,hy0,z],[hx1,hy0,z],[hx1,hy1,z],[hx0,hy1,z]],n:[0,0,1],col:0}; }));
  }

  pose();
  return {
    lead:LEAD,
    // a cassette is on its way in: it pushes the flap open when it gets there
    insert(g){ if(pending&&pending!==g) stowNow(); track=g?{g,box:localBox(g)}:null; motor=null; },
    // a cassette comes out: the deck swings the flap up first. Returns how long the cassette should wait inside for it
    eject(g){ if(pending===g) pending=null; else stowNow(); track=g?{g,box:localBox(g)}:null; motor={t:0}; return LEAD; },
    // the cassette is in: hide it once the flap has shut in front of it
    stow(g){ track=null; motor=null; if(!g) return; if(pending&&pending!==g) stowNow(); pending=g; if(th===0&&w===0) stowNow(); },
    // the cassette is out (back on the shelf): the flap is free to shut
    release(){ track=null; motor=null; },
    frame,
    get busy(){ return !!(track||motor||pending||th>0||w!==0); },
    get state(){ return {angle:th,speed:w,tracking:!!track,motor:!!motor,pending:!!pending,well:well.visible,cut}; },
    well,fog,door
  };
}
