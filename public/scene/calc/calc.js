// The pocket calculator on the desk (Felix, 26 Sep 16:24Z: "can you have the calculator float up and work?"). A click on it
// lifts it off the desk and it floats up in front of you, as the Work notepad does. There it works: its twenty keys press,
// its LCD shows what you type, and its sums are a pocket calculator's (eight digits, each operation done as you go, = again
// repeats the last one). The keyboard types on it too. A click anywhere off its keys, or Esc, puts it back down.
//
// createCalculator(THREE, ctx) takes the loaded room and returns the calculator's controller (null if the scene has none).
// Call it before the page joins the room's meshes (perf/join): the calculator moves, so it leaves the room's tree for the scene.
//   ctx.scene, ctx.root   the room (the calculator is gear_calc, from gear90s.py)
//   ctx.interact          the page's pick map: its parts join it as {kind:"calc", label, part:"key"|"body", i}
//   ctx.view()            the camera the room is drawn with, as it is this frame (it floats in front of it)
//   ctx.audio()           {ctx, out} while the room has sound, else null
//   ctx.live(text)        the page's line for screen readers
//   ctx.reduce            prefers-reduced-motion: no flight, no bob
//   ctx.anisotropy        renderer.capabilities.getMaxAnisotropy()
//   ctx.changed(up)       called when it starts up or goes back down (the page's hint)
//   ctx.keyLevel          the key clicks' level, x1 by default (about the room's own button click); 0 turns them off
// The controller: lift(instant), lower(instant), up (floating or on its way up), busy (moving or a key going down),
// frame(dt, t) once a frame after the view is final, at(x, y) (the part of the floating calculator under a client point, or
// null), click(part) (a key presses, anywhere else puts it down), press(id), key(k) (e.key in lower case; true if it was the
// calculator's), tip(hit), and for tests: display, keys, toScreen(id), engine.

// ---- the sums: eight digits, each operation done as it's keyed in (2 + 3 × 4 = is 20, as on any pocket calculator)
export function calcEngine(first="1994"){
  const N=8;
  // cur: the display's digits as typed, neg its sign; edit: keys go on typing into it; fresh: it holds a number that no
  // operation has used yet; acc and op: the sum so far and what's to be done to it; k: the last = (op, number), for = again
  let cur=first, neg=false, edit=false, fresh=true, acc=0, op=null, k=null, err=false;
  const count=s=>s.replace(/[^0-9]/g,"").length, value=()=>(neg?-1:1)*parseFloat(cur);
  const ap=(a,o,b)=>o==="add"?a+b:o==="sub"?a-b:o==="mul"?a*b:b===0?NaN:a/b;
  // a number as the display shows it: eight digits at most, no trailing zeros; null if it doesn't fit
  function fmt(v){
    const a=Math.abs(v); if(a<5e-8) return {s:"0",neg:false};
    const n=a<1?1:Math.floor(Math.log10(a))+1; if(n>N) return null;
    for(let d=N-n;d>=0;d--){ const s=a.toFixed(d); if(count(s)>N) continue;
      const t=s.includes(".")?s.replace(/0+$/,"").replace(/\.$/,""):s; return {s:t,neg:v<0&&t!=="0"}; }
    return null; }
  // too big for eight digits: E, and the first eight of them (the display then reads ×10^8); 1 ÷ 0 and the root of a
  // negative number are E too. Only C goes on from there.
  function show(v){
    if(!isFinite(v)){ cur="0"; neg=false; err=true; return false; }
    const f=fmt(v); if(f){ cur=f.s; neg=f.neg; return true; }
    const g=fmt(v/1e8)||{s:"0",neg:false}; cur=g.s; neg=g.neg; err=true; return false; }
  function press(id){
    if(id==="C"){ cur="0"; neg=false; edit=false; fresh=true; acc=0; op=null; k=null; err=false; return; }
    if(err) return;
    if(/^[0-9]$/.test(id)||id==="dot"){
      if(!edit){ cur="0"; neg=false; edit=true; }
      if(id==="dot"){ if(!cur.includes(".")&&count(cur)<N) cur+="."; }
      else if(cur==="0") cur=id; else if(count(cur)<N) cur+=id;
      fresh=true; }
    else if(id==="back"){ if(edit){ cur=cur.slice(0,-1)||"0"; if(value()===0&&!cur.includes(".")) neg=false; } }
    else if(id==="neg"){ if(value()!==0) neg=!neg; fresh=true; }
    else if(id==="add"||id==="sub"||id==="mul"||id==="div"){
      if(op&&fresh&&!show(ap(acc,op,value()))){ op=null; return; }
      acc=value(); op=id; k=null; edit=false; fresh=false; }
    else if(id==="eq"){
      if(op){ const b=value(), r=ap(acc,op,b); k={op,b}; op=null; show(r); }
      else if(k) show(ap(value(),k.op,k.b));
      edit=false; fresh=false; }
    else if(id==="pct"){   // 200 + 5 % is 210, 200 × 5 % is 10, 50 ÷ 200 % is 25; on its own, a hundredth
      const b=value(); let r=b/100;
      if(op==="add") r=acc+acc*b/100; else if(op==="sub") r=acc-acc*b/100; else if(op==="mul") r=acc*b/100; else if(op==="div") r=b===0?NaN:acc/b*100;
      op=null; k=null; show(r); edit=false; fresh=false; }
    else if(id==="sqrt"){ const v=value(); show(Math.sqrt(Math.abs(v))); if(v<0) err=true; edit=false; fresh=true; }
  }
  // the display, cell by cell from the left: {ch, dp}, right-aligned in N cells; a number without a point shows it last
  function cells(){ const s=cur.includes(".")?cur:cur+".", out=[]; let dp=false;
    for(let i=s.length-1;i>=0&&out.length<N;i--){ if(s[i]==="."){ dp=true; continue; } out.unshift({ch:s[i],dp}); dp=false; }
    while(out.length<N) out.unshift({ch:" ",dp:false}); return out; }
  return {press,cells,N,
    get text(){ return (neg?"-":"")+(cur.includes(".")?cur:cur+".")+(err?" E":""); },
    get neg(){ return neg; }, get err(){ return err; }, get op(){ return op; }};
}

export function createCalculator(THREE, ctx){
  const V3=THREE.Vector3, Q4=THREE.Quaternion;
  const {scene, root}=ctx;
  const g=root.getObjectByName("gear_calc");
  if(!g) return null;
  const parts=[]; g.traverse(o=>{ if(o.isMesh&&o.geometry?.attributes?.position) parts.push(o); });
  // which part is which, by the material gear90s.py gave it: the page keeps that name as userData.mname (the bake's materials
  // have none); failing that, glTF's order of the object's materials, which is gear90s.py's
  const ORDER=["gear_calc","gear_solar","gear_reel","gear_print_dark","gear_lcd","gear_lcd_segments","gear_print_light","gear_calc_key_orange","gear_calc_key","gear_rubber"];
  const nameOf=o=>o.userData.mname||o.material?.name||ORDER[+(/~(\d+)$/.exec(o.name)||[])[1]]||"";
  const byMat=n=>parts.find(o=>nameOf(o)===n);
  const body=byMat("gear_calc"), keysG=byMat("gear_calc_key"), keysO=byMat("gear_calc_key_orange"), inkL=byMat("gear_print_light"),
    inkD=byMat("gear_print_dark"), lcdBox=byMat("gear_lcd"), segs=byMat("gear_lcd_segments"), solar=byMat("gear_solar"), cells=byMat("gear_reel");
  if(!body||!keysG||!keysO){ console.warn("calculator: its parts aren't where gear90s.py puts them"); return null; }
  scene.updateMatrixWorld(true);
  scene.attach(g); g.updateMatrixWorld(true);   // from here on in world terms, and out of the room's joined meshes
  const restP=g.position.clone(), restQ=g.quaternion.clone(), restM=g.matrixWorld.clone();
  const within=(o,p)=>{ for(let q=o;q;q=q.parent) if(q===p) return true; return false; };

  // The calculator as gear90s.py builds it, in its own frame (x across, y up, z toward you: the display is at -z): a wedge
  // 7.2 by 12.2 cm, 7.3 mm thick at the front and 10.3 at the back (feet included); twenty keys 12.5 by 9.2 mm on a 17 by 13.5 mm
  // pitch, each with its legend printed on it; the LCD and the solar strip above them.
  const KEYS=["C","sqrt","pct","div","7","8","9","mul","4","5","6","sub","1","2","3","add","0","dot","neg","eq"];
  const NAME={C:"CLEAR",sqrt:"SQUARE ROOT",pct:"PERCENT",div:"DIVIDE",mul:"MULTIPLY",sub:"SUBTRACT",add:"ADD",eq:"EQUALS",dot:"DECIMAL POINT",neg:"CHANGE SIGN"};
  const KX=c=>-.0255+c*.017, KZ=r=>-.009+r*.0135;
  const local=(o,i,out)=>out.fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrix);   // (the parts are dequantized by their own matrix)
  const box=new THREE.Box3(); for(const o of parts){ o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix)); }
  const CENTER=box.getCenter(new V3()), HW=(box.max.x-box.min.x)/2, HD=(box.max.z-box.min.z)/2;

  // ---- the keys: their caps and legends come out of the shared meshes into four of their own (the digits' caps, the
  // operations', the two orange ones, all twenty legends), in the calculator's frame. Each vertex knows its key (keyId), so a
  // pressed key goes down in the vertex shader (PRESS): the keys cost four draws, not forty
  const _v=new V3(), _w=new V3();
  const keyAt=(o,i)=>{ local(o,i,_v); const c=Math.round((_v.x+.0255)/.017), r=Math.round((_v.z+.009)/.0135);
    return c<0||c>3||r<0||r>4||Math.abs(_v.x-KX(c))>.0078||Math.abs(_v.z-KZ(r))>.006?-1:r*4+c; };
  const keys=KEYS.map((id,i)=>({id,i,press:-1})), PRESS={value:new Float32Array(20)};
  // some of a mesh's triangles as a mesh of their own, in the same place, for rays only: it shares the mesh's vertices and
  // material (a mesh with several materials, or drawn in part, stays whole: its triangles go by its groups)
  function rayPart(src,tris){ const sg=src.geometry;
    if(Array.isArray(src.material)||sg.groups.length||sg.drawRange.start||sg.drawRange.count!==Infinity) return src;
    if(!sg.boundingSphere) sg.computeBoundingSphere();
    const geo=new THREE.BufferGeometry(); for(const k in sg.attributes) geo.setAttribute(k,sg.attributes[k]);
    geo.setIndex(tris); geo.boundingBox=sg.boundingBox; geo.boundingSphere=sg.boundingSphere;
    const m=new THREE.Mesh(geo,src.material); m.matrixAutoUpdate=false; m.matrixWorld.copy(src.matrixWorld); return m; }
  // The legends' own bake is dark (printed 40 µm over the cap, the baker's rays start inside it): they take the light of the key
  // top they're printed on instead, found straight under each of their corners (before the split, so every key's legend shares
  // the one new attribute)
  // The ray under a legend's corner goes straight down in the calculator's frame, so on a key it can only meet that key's
  // own triangles (they lie inside the key's cell) or one that belongs to no key: it is cast at those alone, a twentieth
  // of the caps, for the same hits. Cast at all the caps, the 545 rays took 1.6 s of the page's load in a browser that
  // runs without its compiler (a managed Chrome, Lockdown Mode), while the loading display stood still; now 0.15 s
  function relight(ink){   // (the maker's mark takes the light of the body under it the same way)
    if(!ink) return; g.updateMatrixWorld(true);
    const geo=ink.geometry, u=geo.attributes.uv1, out=new Float32Array(u.count*2), rc=new THREE.Raycaster(), dn=new V3(0,-1,0).applyQuaternion(g.quaternion);
    const caps=[keysG,keysO].map(src=>{ const {on,rest}=sortTris(src), by=KEYS.map(()=>rest.slice());
      for(let t=0;t<on.length;t+=3) by[keyAt(src,on[t])].push(on[t],on[t+1],on[t+2]);
      return by.map(tris=>rayPart(src,tris)); });
    let moved=0;
    for(let i=0;i<u.count;i++){ out[i*2]=u.getX(i); out[i*2+1]=u.getY(i); const k=keyAt(ink,i);
      local(ink,i,_v); _v.y+=.004; rc.set(_v.applyMatrix4(g.matrixWorld),dn); rc.far=.006;
      const h=rc.intersectObjects(k>=0?[caps[0][k],caps[1][k]]:[body],false)[0]; if(h&&h.uv1){ out[i*2]=h.uv1.x; out[i*2+1]=h.uv1.y; moved++; } }
    geo.setAttribute("uv1",new THREE.BufferAttribute(out,2)); return moved; }
  relight(inkL);
  // which triangles of a mesh lie on a key (all three corners on the same one), and the rest
  function sortTris(src){ const geo=src.geometry, n=geo.attributes.position.count, ix=geo.index?Array.from(geo.index.array):[...Array(n).keys()], on=[], rest=[];
    for(let t=0;t+2<ix.length;t+=3){ const a=keyAt(src,ix[t]); (a>=0&&keyAt(src,ix[t+1])===a&&keyAt(src,ix[t+2])===a?on:rest).push(ix[t],ix[t+1],ix[t+2]); }
    return {on,rest}; }
  // a mesh of some of src's triangles, in the calculator's frame (in metres: the parts arrive dequantized by their matrix)
  function lift3(src,tris,name){
    if(!tris.length) return null;
    const A=src.geometry.attributes, nm=new THREE.Matrix3().getNormalMatrix(src.matrix), used=[...new Set(tris)], at=new Map(used.map((v,i)=>[v,i])), n=used.length;
    const P=new Float32Array(n*3), N=new Float32Array(n*3), U=new Float32Array(n*2), U1=new Float32Array(n*2), K=new Float32Array(n);
    used.forEach((v,i)=>{ local(src,v,_v); P.set([_v.x,_v.y,_v.z],i*3); _w.fromBufferAttribute(A.normal,v).applyMatrix3(nm).normalize(); N.set([_w.x,_w.y,_w.z],i*3);
      if(A.uv){ U[i*2]=A.uv.getX(v); U[i*2+1]=A.uv.getY(v); } U1[i*2]=A.uv1.getX(v); U1[i*2+1]=A.uv1.getY(v); K[i]=keyAt(src,v); });
    const geo=new THREE.BufferGeometry();
    for(const [k,a,sz] of [["position",P,3],["normal",N,3],["uv",U,2],["uv1",U1,2],["keyId",K,1]]) geo.setAttribute(k,new THREE.BufferAttribute(a,sz));
    geo.setIndex(tris.map(v=>at.get(v))); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const m=new THREE.Mesh(geo,src.material); m.name=name; g.add(m); return m; }
  // the digits and the point a shade lighter than the operations; C and = are orange
  const OPS=new Set(["sqrt","pct","div","mul","sub","add","neg"]);
  const tg=sortTris(keysG), to=sortTris(keysO), tl=inkL?sortTris(inkL):{on:[],rest:[]};
  const pickOn=(src,tris,f)=>{ const out=[]; for(let t=0;t<tris.length;t+=3) if(f(KEYS[keyAt(src,tris[t])])) out.push(tris[t],tris[t+1],tris[t+2]); return out; };
  const capsDigit=lift3(keysG,pickOn(keysG,tg.on,id=>!OPS.has(id)),"gear_calc_keys"), capsOp=lift3(keysG,pickOn(keysG,tg.on,id=>OPS.has(id)),"gear_calc_keys_op"),
    capsOrange=lift3(keysO,to.on,"gear_calc_keys_orange"), legends=inkL?lift3(inkL,tl.on.concat(tl.rest),"gear_calc_legends"):null;   // (with the maker's mark: keyId -1)
  const keyMeshes=[capsDigit,capsOp,capsOrange,legends].filter(Boolean);
  keysG.visible=keysO.visible=false;
  if(inkL&&legends) inkL.visible=false;
  // the rubber feet are under it, on the desk and up in the air alike: not drawn
  const feet=byMat("gear_rubber"); if(feet){ const fb=feet.geometry.boundingBox.clone().applyMatrix4(feet.matrix); if(fb.max.y<box.min.y+.0015) feet.visible=false; }
  let keyTop=-Infinity; for(const m of [capsDigit,capsOp,capsOrange]) if(m){ const p=m.geometry.attributes.position; for(let i=0;i<p.count;i++) keyTop=Math.max(keyTop,p.getY(i)); }
  if(!isFinite(keyTop)) keyTop=.0105;

  // ---- materials: each part keeps its bake (a copy of its material), and gets two things more. Floating, it is drawn in front
  // of the room: its depth is squeezed into the nearest fifth of the depth range, its own order kept (SQ, Z0, Z1). And off the
  // desk it keeps some of the desk lamp's light, so it reads with the lamp off (LIFT, FLOOR), as the notepad does.
  const SQ={value:0}, Z0={value:0}, Z1={value:1}, LIFT={value:0}, FLOOR={value:.8}, DIM={value:1};
  const mats=[];
  function own(m,set,press){
    const c=m.clone(), ob=m.onBeforeCompile, key=m.customProgramCacheKey?m.customProgramCacheKey():"";
    c.onBeforeCompile=(sh,r)=>{ if(ob) ob.call(m,sh,r);
      Object.assign(sh.uniforms,{calcSq:SQ,calcZ0:Z0,calcZ1:Z1,calcLift:LIFT,calcFloor:FLOOR,calcDim:DIM});
      if(press){ sh.uniforms.calcPress=PRESS; sh.vertexShader="attribute float keyId;\nuniform float calcPress[20];\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n  if(keyId>-.5) transformed.y-=calcPress[int(keyId+.5)];"); }
      sh.vertexShader="uniform float calcSq,calcZ0,calcZ1;\n"+sh.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\n  if(calcSq>.5){ float zn=gl_Position.z/gl_Position.w; gl_Position.z=(-.999+.2*clamp((zn-calcZ0)/max(calcZ1-calcZ0,1e-7),0.,1.))*gl_Position.w; }");
      const f=sh.fragmentShader, a="vec3 ia=pow(texture2D(lightMap,vLightMapUv).rgb,vec3(bg))*sA;", b="vec3 ib=pow(";
      if(f.includes(a)&&f.includes(b)) sh.fragmentShader=f.replace(a,a+" vec3 iaOn=ia;").replace(b,"ia=mix(ia,max(ia,iaOn*calcFloor),calcLift);\n        "+b);
      sh.fragmentShader="uniform float calcLift,calcFloor,calcDim;\n"+sh.fragmentShader.replace("#include <tonemapping_fragment>","gl_FragColor.rgb*=calcDim;\n#include <tonemapping_fragment>"); };
    c.customProgramCacheKey=()=>"calc"+(press?"key":"")+key;
    c.transparent=true;   // (drawn with the room's see-through things, after the rest: floating, it goes last of all; see setFloat)
    if(set) set(c); mats.push(c); return c; }
  const L=THREE.SRGBColorSpace;
  const tint=(c,hex,rough)=>{ c.map=null; c.color.set(hex); if(rough!=null) c.roughness=rough; };
  const mat=new Map(), orig=new Map(parts.map(o=>[o,o.material]));   // (each part's own material, as the room made it)
  const matFor=(m,set)=>{ if(!mat.get(m)) mat.set(m,own(m,set)); return mat.get(m); };
  const LOOK={digit:"#4a4f57",op:"#33363c",orange:"#a9441c",body:.82,legend:"#eeede8"};
  body.material=matFor(body.material,c=>{ c.color.setScalar(LOOK.body); c.roughness=.5; });
  if(capsDigit) capsDigit.material=own(keysG.material,c=>tint(c,LOOK.digit,.46),true);
  if(capsOp) capsOp.material=own(keysG.material,c=>tint(c,LOOK.op,.44),true);
  if(capsOrange) capsOrange.material=own(keysO.material,c=>tint(c,LOOK.orange,.4),true);
  if(legends) legends.material=own(inkL.material,c=>tint(c,LOOK.legend,.5),true);
  for(const o of parts) if(o.visible&&o.material&&!mats.includes(o.material)) o.material=matFor(o.material);

  // ---- the LCD: a canvas on the LCD's glass, lit by the bake like the glass it covers. Eight digits of seven segments, each
  // with its point, the minus sign and E to their left; the unlit segments faintly there, the lit ones casting a faint shadow
  // on the reflector behind them, as on the real thing
  function onTop(src,name,cw,ch,m){   // a quad just over the top face of a box, with the face's light map coordinates
    if(!src) return null;
    const p=src.geometry.attributes.position, nA=src.geometry.attributes.normal, u1=src.geometry.attributes.uv1, nm=new THREE.Matrix3().getNormalMatrix(src.matrix), n=new V3();
    const top=[]; let ymax=-Infinity;
    for(let i=0;i<p.count;i++){ n.fromBufferAttribute(nA,i).applyMatrix3(nm).normalize(); if(n.y<.97) continue; const v=local(src,i,new V3()); top.push({v,u:u1.getX(i),w:u1.getY(i)}); ymax=Math.max(ymax,v.y); }
    if(top.length<4) return null;
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity; for(const t of top){ x0=Math.min(x0,t.v.x); x1=Math.max(x1,t.v.x); z0=Math.min(z0,t.v.z); z1=Math.max(z1,t.v.z); }
    const corner=(x,z)=>top.reduce((b,t)=>Math.hypot(t.v.x-x,t.v.z-z)<Math.hypot(b.v.x-x,b.v.z-z)?t:b);
    const C=[corner(x0,z0),corner(x1,z0),corner(x0,z1),corner(x1,z1)], lift=.00004;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(C.flatMap(t=>[t.v.x,t.v.y+lift,t.v.z]),3));
    geo.setAttribute("normal",new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));
    geo.setAttribute("uv",new THREE.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));   // (the canvas's top toward the display end, -z)
    geo.setAttribute("uv1",new THREE.Float32BufferAttribute(C.flatMap(t=>[t.u,t.w]),2));
    geo.setIndex([0,2,1,1,2,3]); geo.computeBoundingSphere();
    const cv=document.createElement("canvas"); cv.width=cw; cv.height=ch;
    const tex=new THREE.CanvasTexture(cv); tex.colorSpace=L; tex.anisotropy=ctx.anisotropy||8;
    const q=new THREE.Mesh(geo,own(orig.get(src),c=>{ c.map=tex; c.color.set("#ffffff"); Object.assign(c,{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1},m||{}); }));
    q.name=name; g.add(q); return {mesh:q,cv,tex,w:x1-x0,h:z1-z0}; }

  const lcd=onTop(lcdBox,"gear_calc_lcd",1024,Math.round(1024*.015/.052),{roughness:.34,clearcoat:.55,clearcoatRoughness:.08});
  if(lcd&&segs) segs.visible=false;   // the bake's "1994.": the canvas shows what's keyed in (and starts on 1994 too)
  const E=calcEngine("1994");
  const LG=lcd&&lcd.cv.getContext("2d"), LCW=lcd?lcd.cv.width:0, LCH=lcd?lcd.cv.height:0;
  const lcdBG=(()=>{ if(!lcd) return null; const c=document.createElement("canvas"); c.width=LCW; c.height=LCH; const x=c.getContext("2d");
    const gr=x.createLinearGradient(0,0,0,LCH); gr.addColorStop(0,"#6a755e"); gr.addColorStop(.28,"#7b866e"); gr.addColorStop(1,"#808b73"); x.fillStyle=gr; x.fillRect(0,0,LCW,LCH);
    let s=11; const r=()=>((s=Math.imul(s^s>>>15,s|1)+0x6D2B79F5|0),((s^s>>>7)>>>0)/4294967296);
    for(let i=0;i<5200;i++){ x.fillStyle=r()<.5?`rgba(255,255,240,${.02+r()*.03})`:`rgba(20,30,10,${.02+r()*.03})`; x.fillRect(r()*LCW,r()*LCH,1+r()*2,1); }
    // the bezel's shadow along the top and down the sides: the glass sits a little below it
    const t=x.createLinearGradient(0,0,0,30); t.addColorStop(0,"rgba(8,12,4,.5)"); t.addColorStop(1,"rgba(8,12,4,0)"); x.fillStyle=t; x.fillRect(0,0,LCW,30);
    for(const [x0,dir] of [[0,1],[LCW,-1]]){ const s2=x.createLinearGradient(x0,0,x0+dir*18,0); s2.addColorStop(0,"rgba(8,12,4,.35)"); s2.addColorStop(1,"rgba(8,12,4,0)"); x.fillStyle=s2; x.fillRect(dir>0?0:LCW-18,0,18,LCH); }
    return c; })();
  const ON="rgba(24,30,21,.93)", GHOST="rgba(24,30,21,.055)", SHADOW="rgba(14,20,8,.16)", LEAN=.085;
  const SEG={"0":"abcdef","1":"bc","2":"abdeg","3":"abcdg","4":"bcfg","5":"acdfg","6":"acdefg","7":"abc","8":"abcdefg","9":"abcdfg","-":"g","E":"adefg"," ":""};
  let skY=0;
  function poly(pts,st,ox=0,oy=0){ LG.fillStyle=st; LG.beginPath(); pts.forEach(([x,y],i)=>{ const a=x+(skY-y)*LEAN+ox, b=y+oy; i?LG.lineTo(a,b):LG.moveTo(a,b); }); LG.closePath(); LG.fill(); }
  const hbar=(x0,x1,y,s)=>[[x0,y],[x0+s/2,y-s/2],[x1-s/2,y-s/2],[x1,y],[x1-s/2,y+s/2],[x0+s/2,y+s/2]];
  const vbar=(x,y0,y1,s)=>[[x,y0],[x+s/2,y0+s/2],[x+s/2,y1-s/2],[x,y1],[x-s/2,y1-s/2],[x-s/2,y0+s/2]];
  function digit(ch,X,Y,w,h,s,pass){   // pass 0: the lit segments' shadows; 1: the segments
    const on=SEG[ch]??"", q=s*.14, my=Y+h/2; skY=Y+h;
    const shape={a:hbar(X+q,X+w-q,Y+s/2,s),d:hbar(X+q,X+w-q,Y+h-s/2,s),g:hbar(X+q,X+w-q,my,s),f:vbar(X+s/2,Y+q,my-q*.5,s),e:vbar(X+s/2,my+q*.5,Y+h-q,s),b:vbar(X+w-s/2,Y+q,my-q*.5,s),c:vbar(X+w-s/2,my+q*.5,Y+h-q,s)};
    for(const k of "abcdefg"){ const lit=on.includes(k); if(pass===0){ if(lit) poly(shape[k],SHADOW,5,7); } else poly(shape[k],lit?ON:GHOST); } }
  function dot(x,y,r,lit,pass){ skY=y; const a=x, b=y;
    if(pass===0){ if(lit){ LG.fillStyle=SHADOW; LG.beginPath(); LG.arc(a+5,b+7,r,0,Math.PI*2); LG.fill(); } return; }
    LG.fillStyle=lit?ON:GHOST; LG.beginPath(); LG.arc(a,b,r,0,Math.PI*2); LG.fill(); }
  let drawn="";
  function drawLCD(){
    if(!lcd) return; const key=E.text; if(key===drawn) return; drawn=key;
    LG.setTransform(1,0,0,1,0,0); LG.drawImage(lcdBG,0,0);
    const cells=E.cells(), N=E.N, CW=76, PITCH=102, DH=Math.round(LCH*.6), Y=Math.round((LCH-DH)/2)+6, S=16, X0=LCW-34-N*PITCH+(PITCH-CW);
    for(const pass of [0,1]){
      // the minus sign and E, in a column of their own at the left
      digit(E.err?"E":" ",40,Y+4,40,Math.round(DH*.46),9,pass);
      poly(hbar(40,86,Y+DH*.72,11),pass===0?(E.neg?SHADOW:"rgba(0,0,0,0)"):E.neg?ON:GHOST,pass===0?5:0,pass===0?7:0);
      cells.forEach((c,i)=>{ const x=X0+i*PITCH; digit(c.ch,x,Y,CW,DH,S,pass); dot(x+CW+13,Y+DH-6,7.5,c.dp,pass); }); }
    lcd.tex.needsUpdate=true; }
  drawLCD();

  // ---- the solar strip: four amorphous-silicon cells under glass, a deep plum brown, their scribed lines catching the light
  const sol=onTop(solar,"gear_calc_solar",512,Math.round(512*.011/.036),{roughness:.3,clearcoat:1,clearcoatRoughness:.04,metalness:0});
  if(sol){ const x=sol.cv.getContext("2d"), W=sol.cv.width, H=sol.cv.height;
    const gr=x.createLinearGradient(0,0,W,H); gr.addColorStop(0,"#2b171c"); gr.addColorStop(.5,"#1e0f14"); gr.addColorStop(1,"#261517"); x.fillStyle=gr; x.fillRect(0,0,W,H);
    for(let i=6;i<W-6;i+=3){ x.fillStyle=`rgba(${i%9?120:150},${i%9?80:96},${i%9?70:84},${.1+(i%7)*.012})`; x.fillRect(i,8,1,H-16); }   // the scribes, lengthwise across each cell
    x.strokeStyle="rgba(150,132,116,.45)"; x.lineWidth=3; x.strokeRect(4,4,W-8,H-8);
    for(let k=1;k<4;k++){ x.fillStyle="rgba(160,140,122,.55)"; x.fillRect(Math.round(W*k/4)-2,4,4,H-8); }
    sol.tex.needsUpdate=true; if(cells) cells.visible=false; }

  // ---- what you can press: a box over each key's whole cell (its gap to the next one included), never drawn
  const hidden=new THREE.MeshBasicMaterial({visible:false}), pick=new Map();
  const top=z=>.0073+(.061-z)*.003/.122;   // the top face's height over z (a 3 mm rise from front to back)
  keys.forEach((k,i)=>{ const r=Math.floor(i/4), c=i%4, z=KZ(r), h=keyTop-top(z)+.0012;
    const m=new THREE.Mesh(new THREE.BoxGeometry(.017,h,.0135),hidden); m.position.set(KX(c),top(z)+h/2,z); m.name="gear_calc_hit_"+k.id; m.visible=false; g.add(m);
    ctx.interact.set(m,{kind:"calc",label:"CALCULATOR",part:"key",i}); pick.set(m,{part:"key",i}); });
  for(const m of keyMeshes){ ctx.interact.set(m,{kind:"calc",label:"CALCULATOR",part:"keys"}); pick.set(m,{part:"keys"}); }   // (a cap itself: its key from the face)
  g.traverse(o=>{ if(o.isMesh&&!pick.has(o)&&o.visible){ ctx.interact.set(o,{kind:"calc",label:"CALCULATOR",part:"body"}); pick.set(o,{part:"body"}); } });
  const pickList=[...pick.keys()];
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=false; } });
  g.updateMatrixWorld(true);

  // ---- the desk under it: the bake has its shadow there, so lifted it would leave a dark patch. A patch of desk takes its
  // place as it goes: the desk's own material, with the light maps filled in over the calculator's footprint from the desk
  // round it (a membrane, solved once per map), and faded in with the height it has left the desk by
  const fill=deskFill();
  function deskFill(){
    try{
      const rc=new THREE.Raycaster(), dn=new V3(0,-1,0), wb=new THREE.Box3().setFromObject(g,true), y0=wb.min.y;
      const others=[]; scene.traverse(o=>{ if(o.isMesh&&o.visible&&!within(o,g)) others.push(o); });
      const at=(lx,lz,y)=>new V3(lx,0,lz).applyMatrix4(restM).setY(y);
      rc.set(at(0,0,y0+.012),dn); const h0=rc.intersectObjects(others,false)[0];
      const desk=h0&&h0.object, dm=desk&&desk.material;
      if(!desk||Array.isArray(dm)||!dm.lightMap||!desk.geometry.attributes.uv1||!dm.onBeforeCompile) return null;
      // the desk's uv and uv1 over the calculator's frame (x, z): planar there, so a least-squares plane fits them exactly
      const A=HW+.028, B=HD+.028, S=[];
      for(let i=0;i<=4;i++) for(let j=0;j<=4;j++){ const lx=-A+2*A*i/4, lz=-B+2*B*j/4; rc.set(at(lx,lz,y0+.012),dn); const h=rc.intersectObject(desk,false)[0]; if(h&&h.uv1) S.push({lx,lz,uv:h.uv,uv1:h.uv1,y:h.point.y}); }
      if(S.length<6) return null;
      const fit=k=>{ const M=[[0,0,0],[0,0,0],[0,0,0]], R=[[0,0],[0,0],[0,0]];
        for(const s of S){ const v=[1,s.lx,s.lz], t=s[k]; for(let a=0;a<3;a++){ for(let b=0;b<3;b++) M[a][b]+=v[a]*v[b]; R[a][0]+=v[a]*t.x; R[a][1]+=v[a]*t.y; } }
        const I=new THREE.Matrix3().set(...M[0],...M[1],...M[2]).invert().elements, c=[0,1].map(q=>[0,1,2].map(a=>I[a]*R[0][q]+I[a+3]*R[1][q]+I[a+6]*R[2][q]));
        let err=0; for(const s of S) for(let q=0;q<2;q++) err=Math.max(err,Math.abs(c[q][0]+c[q][1]*s.lx+c[q][2]*s.lz-(q?s[k].y:s[k].x)));
        return {c,err,f:(lx,lz)=>[c[0][0]+c[0][1]*lx+c[0][2]*lz,c[1][0]+c[1][1]*lx+c[1][2]*lz]}; };
      const F0=fit("uv"), F1=fit("uv1"); if(F1.err>2e-4||F0.err>2e-3) return null;
      const yd=S.reduce((a,s)=>a+s.y,0)/S.length;
      // the patch: its pixels over the calculator's frame; unknown where the calculator and its penumbra were, and where
      // anything else stands on the desk (the lamp's foot, the binder): the desk's light there isn't the desk's to give
      const PX=900, PW=Math.round(2*A*PX), PH=Math.round(2*B*PX), P=.008;
      const unknown=new Uint8Array(PW*PH), wbox=new THREE.Box3().setFromPoints([at(-A,-B,yd),at(A,B,yd),at(A,-B,yd),at(-A,B,yd)]);
      wbox.min.y=yd-.002; wbox.max.y=yd+.06;
      const cands=others.filter(o=>{ if(o===desk) return false; const gg=o.geometry; if(!gg.boundingBox) gg.computeBoundingBox(); return new THREE.Box3().copy(gg.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(wbox); });
      const lxOf=i=>-A+(i+.5)/PW*2*A, lzOf=j=>-B+(j+.5)/PH*2*B;
      // (the rays go straight down inside the patch, so of each thing only the triangles that reach over the patch can be
      // met: 800 of the lamp's foot, the binder and the pot, not their 7,600, for the same hits. Cast at all of them, the
      // 2,000 rays took 1.3 s of the page's load in a browser that runs without its compiler; now 0.16 s)
      const reach=o=>{ const p=o.geometry.attributes.position, ix=o.geometry.index, n=ix?ix.count:p.count, tris=[], w=[new V3(),new V3(),new V3()], id=[0,0,0];
        for(let t=0;t+2<n;t+=3){ for(let k=0;k<3;k++){ id[k]=ix?ix.getX(t+k):t+k; w[k].fromBufferAttribute(p,id[k]).applyMatrix4(o.matrixWorld); }
          if(Math.max(w[0].x,w[1].x,w[2].x)<wbox.min.x||Math.min(w[0].x,w[1].x,w[2].x)>wbox.max.x||Math.max(w[0].z,w[1].z,w[2].z)<wbox.min.z||Math.min(w[0].z,w[1].z,w[2].z)>wbox.max.z) continue;
          tris.push(id[0],id[1],id[2]); }
        return rayPart(o,tris); };
      const near=cands.map(reach);
      if(cands.length) for(let j=0;j<PH;j+=3) for(let i=0;i<PW;i+=3){ rc.set(at(lxOf(i+1),lzOf(j+1),yd+.3),dn); rc.far=.3-.0005;
        if(rc.intersectObjects(near,false).some(h=>h.point.y<yd+.06)) for(let b=-2;b<=4;b++) for(let a=-2;a<=4;a++){ const x=i+a, y=j+b; if(x>=0&&y>=0&&x<PW&&y<PH) unknown[y*PW+x]=1; } }
      rc.far=Infinity;
      for(let j=0;j<PH;j++) for(let i=0;i<PW;i++) if(Math.abs(lxOf(i))<HW+P&&Math.abs(lzOf(j))<HD+P) unknown[j*PW+i]=1;
      // the quad, over the desk, with the desk's own uv and uv1 at its corners; the patches are looked up through the light
      // map's transform (desk uv1 to patch), so the albedo, on uv1 like every atlas here, still finds the desk
      const cn=[[-A,-B],[A,-B],[-A,B],[A,B]], geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.Float32BufferAttribute(cn.flatMap(([x,z])=>at(x,z,yd+.00012).toArray()),3));
      geo.setAttribute("normal",new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));
      geo.setAttribute("uv",new THREE.Float32BufferAttribute(cn.flatMap(([x,z])=>F0.f(x,z)),2));
      geo.setAttribute("uv1",new THREE.Float32BufferAttribute(cn.flatMap(([x,z])=>F1.f(x,z)),2));
      geo.setIndex([0,2,1,1,2,3]); geo.computeBoundingSphere();
      const c=F1.c, det=c[0][1]*c[1][2]-c[0][2]*c[1][1];   // uv1 = O + [X Z]·(lx, lz); patch = ((lx+A)/2A, (lz+B)/2B)
      const iX=[c[1][2]/det,-c[0][2]/det], iZ=[-c[1][1]/det,c[0][1]/det];
      const T=new THREE.Matrix3().set(iX[0]/(2*A),iX[1]/(2*A),(-(iX[0]*c[0][0]+iX[1]*c[1][0]))/(2*A)+.5, iZ[0]/(2*B),iZ[1]/(2*B),(-(iZ[0]*c[0][0]+iZ[1]*c[1][0]))/(2*B)+.5, 0,0,1);
      const probe={uniforms:{},vertexShader:"",fragmentShader:""}; dm.onBeforeCompile(probe,null);   // (the desk's maps, as its shader has them)
      const srcB=probe.uniforms.irrB?.value, uD=probe.uniforms.irrD; if(!srcB) return null;
      const tx=()=>{ const t=new THREE.DataTexture(new Uint8Array(PW*PH*4),PW,PH); t.channel=1; t.flipY=false; t.colorSpace=THREE.NoColorSpace; t.minFilter=t.magFilter=THREE.LinearFilter; t.generateMipmaps=false; t.matrixAutoUpdate=false; t.matrix.copy(T); return t; };
      const pA=tx(), pB=tx(), pD=tx();
      const m=dm.clone(); m.lightMap=pA; Object.assign(m,{transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const myB={value:pB}, myD={value:pA};
      m.onBeforeCompile=(sh,r)=>{ dm.onBeforeCompile(sh,r); sh.uniforms.irrB=myB; sh.uniforms.irrD=myD; };
      m.customProgramCacheKey=dm.customProgramCacheKey;
      const q=new THREE.Mesh(geo,m); q.name="gear_calc_deskfill"; q.renderOrder=1; q.visible=false; q.castShadow=q.receiveShadow=false; q.raycast=()=>{}; scene.add(q);
      // one map's patch: the desk's texels over the frame (bilinear), then the unknown ones as a membrane over the known: a first
      // guess from the nearest known ones along their row and column (nearer counts more), then over-relaxed averaging of the four
      // neighbours until it settles. It's a generator, so idle moments can make it a few sweeps at a time (a map is some 50 ms
      // of sums in all, which in one piece would be a dropped frame or three)
      const U=[]; for(let n=0;n<PW*PH;n++) if(unknown[n]) U.push(n);
      function* making(src,dst){
        const img=src&&src.image; if(!img||!img.width) return false;
        const W=img.width, H=img.height, us=[], vs=[];
        for(const [x,z] of cn){ const [u,v]=F1.f(x,z); us.push(u*W); vs.push(v*H); }
        const sx=Math.max(0,Math.floor(Math.min(...us))-2), sy=Math.max(0,Math.floor(Math.min(...vs))-2), sw=Math.min(W,Math.ceil(Math.max(...us))+2)-sx, sh=Math.min(H,Math.ceil(Math.max(...vs))+2)-sy;
        let data;
        if(img.data){ data=new Uint8ClampedArray(sw*sh*4); const ch=img.data.length/(W*H); for(let y=0;y<sh;y++) for(let x=0;x<sw;x++) for(let k=0;k<3;k++) data[(y*sw+x)*4+k]=img.data[((sy+y)*W+sx+x)*ch+Math.min(k,ch-1)]; }
        else { const cv=document.createElement("canvas"); cv.width=sw; cv.height=sh; const x2=cv.getContext("2d",{willReadFrequently:true}); x2.drawImage(img,sx,sy,sw,sh,0,0,sw,sh); data=x2.getImageData(0,0,sw,sh).data; }
        yield;
        const out=new Float32Array(PW*PH*3), px=(x,y,k)=>data[(Math.min(sh-1,Math.max(0,y))*sw+Math.min(sw-1,Math.max(0,x)))*4+k];
        for(let j=0;j<PH;j++) for(let i=0;i<PW;i++){ const [u,v]=F1.f(lxOf(i),lzOf(j)), X=u*W-.5-sx, Y=v*H-.5-sy, x0=Math.floor(X), y0=Math.floor(Y), fx=X-x0, fy=Y-y0, o=(j*PW+i)*3;
          for(let k=0;k<3;k++) out[o+k]=(px(x0,y0,k)*(1-fx)+px(x0+1,y0,k)*fx)*(1-fy)+(px(x0,y0+1,k)*(1-fx)+px(x0+1,y0+1,k)*fx)*fy; }
        yield;
        const guess=new Float32Array(PW*PH*3), wsum=new Float32Array(PW*PH);
        const run=(len,stride,start,count)=>{ for(let l=0;l<count;l++){ const s0=start(l); let last=-1;
          for(const dir of [1,-1]){ last=-1; for(let t=dir>0?0:len-1;dir>0?t<len:t>=0;t+=dir){ const n=s0+t*stride;
            if(!unknown[n]){ last=t; continue; } if(last<0) continue; const w=1/Math.abs(t-last), m=s0+last*stride; wsum[n]+=w; for(let k=0;k<3;k++) guess[n*3+k]+=out[m*3+k]*w; } } } };
        run(PW,1,j=>j*PW,PH); run(PH,PW,i=>i,PW);
        for(const n of U) for(let k=0;k<3;k++) out[n*3+k]=wsum[n]?guess[n*3+k]/wsum[n]:128;
        yield;
        for(let it=0;it<220;it++){ for(const n of U){ const i=n%PW, j=(n-i)/PW;
          for(let k=0;k<3;k++){ let s=0,c2=0; if(i>0){ s+=out[(n-1)*3+k]; c2++; } if(i<PW-1){ s+=out[(n+1)*3+k]; c2++; } if(j>0){ s+=out[(n-PW)*3+k]; c2++; } if(j<PH-1){ s+=out[(n+PW)*3+k]; c2++; }
            const o=n*3+k; out[o]+=1.85*(s/c2-out[o]); } }
          if(it%4===3) yield; }
        const d=dst.image.data; for(let n=0;n<PW*PH;n++){ for(let k=0;k<3;k++) d[n*4+k]=Math.max(0,Math.min(255,Math.round(out[n*3+k]))); d[n*4+3]=255; }
        dst.needsUpdate=true; return true; }
      // each map's patch, as a job: made in idle moments ahead of time, or on the spot if a lift comes first
      const jobs=new Map();
      function job(src,dst){ let j=jobs.get(src);
        if(j&&j.done&&!j.ok&&!j.err&&src.image&&src.image.width) j=null;   // (its image wasn't in yet: again)
        if(!j){ j={gen:making(src,dst),done:false,ok:false}; jobs.set(src,j); } return j; }
      // (dl: an idle deadline, or none to finish now; an idle call that comes by its timeout, on a page with no idle moments, still
      // gets 4 ms)
      function work(j,dl){ const t0=performance.now(); try{ while(!j.done){ const r=j.gen.next(); if(r.done){ j.done=true; j.ok=!!r.value; }
          else if(dl&&(dl.didTimeout?performance.now()-t0>4:dl.timeRemaining()<3)) return false; } }
        catch(e){ j.done=j.err=true; j.ok=false; console.warn("calculator: a desk patch failed",e); } return true; }   // (and the calculator's own spot stays as baked)
      const lampOff=()=>{ const d=uD&&uD.value; return d&&d!==dm.lightMap?d:null; };   // the bake without the desk lamp, once the page has it
      const wanted=()=>{ const w=[job(dm.lightMap,pA),job(srcB,pB)], d=lampOff(); if(d) w.push(job(d,pD)); return w; };
      let readyFor;   // the lamp-off bake the patches are all made for (null: there's none yet); nothing to do till it changes
      function ready(){ const off=lampOff(); if(readyFor!==undefined&&readyFor===off) return true;
        const [a,b,d]=wanted(); work(a); work(b); if(d) work(d); myD.value=d&&d.ok?pD:pA;
        if(a.ok&&b.ok&&(!d||d.ok)) readyFor=off; return a.ok&&b.ok; }
      // ahead of time: a few sweeps in each idle moment from a few seconds in, then a look now and then for the lamp-off bake
      // (the page loads it the first time the lamp goes off)
      const idle=f=>window.requestIdleCallback?requestIdleCallback(f,{timeout:1000}):setTimeout(()=>{ const t0=performance.now(); f({timeRemaining:()=>10-(performance.now()-t0)}); },40);
      function warm(dl){ const w=wanted(); let all=true; for(const j of w) if(!work(j,dl)){ all=false; break; }
        if(!all) idle(warm); else if(!w.every(j=>j.ok)||!lampOff()) setTimeout(()=>idle(warm),2000); }
      setTimeout(()=>idle(warm),2500);
      return {mesh:q,unknown,PW,PH,get ready(){ const a=jobs.get(dm.lightMap), b=jobs.get(srcB); return !!(a&&a.ok&&b&&b.ok); },
        set(k){ const v=k>0.002&&ready(); q.visible=!!v; m.opacity=v?Math.min(1,k):0; }};
    }catch(e){ console.warn("calculator: the desk patch is off",e); return null; }
  }

  // ---- where it floats: upright in front of the camera, a little below the middle, tilted back as if held in a hand to read
  const TILT=THREE.MathUtils.degToRad(15);
  function size(){ const H=innerHeight; return {h:Math.max(260,Math.min(H*.64,H-200,620)),cx:innerWidth/2,cy:H/2+16}; }
  const BASE=new Q4().setFromAxisAngle(new V3(1,0,0),Math.PI/2);   // its face toward the camera, the display end up
  const _n=new V3(), _d=new V3(), _f=new V3(), _u=new V3(), _r=new V3(), _q=new Q4(), _e=new THREE.Euler();
  function floatPose(T,outC,outQ){
    const cam=ctx.view(); cam.updateMatrixWorld();
    const s=size(), W=innerWidth, H=innerHeight, tv=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
    const d=2*HD*Math.cos(TILT)*H/(2*tv*s.h);   // the distance at which it stands s.h pixels tall
    _n.set(s.cx/W*2-1,-(s.cy/H*2-1),.5).unproject(cam); _d.subVectors(_n,cam.position).normalize();
    _f.set(0,0,-1).applyQuaternion(cam.quaternion); _u.set(0,1,0).applyQuaternion(cam.quaternion); _r.set(1,0,0).applyQuaternion(cam.quaternion);
    outC.copy(cam.position).addScaledVector(_d,d/_d.dot(_f));
    const bob=ctx.reduce?0:1;
    outC.addScaledVector(_u,Math.sin(T*.8)*.0005*bob).addScaledVector(_r,Math.sin(T*.53+1)*.0004*bob);
    _e.set(-TILT+Math.sin(T*.61)*.004*bob,Math.sin(T*.37)*.006*bob,THREE.MathUtils.degToRad(-1.5)+Math.sin(T*.43+2)*.003*bob,"ZYX");
    outQ.copy(cam.quaternion).multiply(_q.setFromEuler(_e)).multiply(BASE);
  }
  const restC=CENTER.clone().applyQuaternion(restQ).add(restP);
  function place(c,q){ g.quaternion.copy(q); g.position.copy(c).sub(_n.copy(CENTER).applyQuaternion(q)); g.updateMatrixWorld(true); }
  const curC=()=>_u.copy(CENTER).applyQuaternion(g.quaternion).add(g.position);

  // ---- lifting and setting down: it rises off the desk, turns to you as it comes, and settles in front of the camera; going
  // back it turns flat on the way and drops the last few centimetres onto its spot
  let mode="down", u=0; const fromC=new V3(), fromQ=new Q4(), fc=new V3(), fq=new Q4(), p1=new V3(), p2=new V3();
  const UP=.9, DOWN=.7; let pace=1;   // (pace: tests run the flights faster)
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, win=(a,b,x)=>x<=a?0:x>=b?1:.5-.5*Math.cos(Math.PI*(x-a)/(b-a));
  const bez=(o,a,b,c,d,t)=>{ const s=1-t; return o.set(0,0,0).addScaledVector(a,s*s*s).addScaledVector(b,3*s*s*t).addScaledVector(c,3*s*t*t).addScaledVector(d,t*t*t); };
  function lift(instant){ if(mode==="up"||mode==="rising") return; fromC.copy(curC()); fromQ.copy(g.quaternion);
    if(instant||ctx.reduce){ mode="up"; u=1; } else { mode="rising"; u=0; sound("lift"); }
    say("Calculator: "+spoken()); ctx.changed&&ctx.changed(true); }
  function lower(instant){ if(mode==="down"||mode==="falling") return; fromC.copy(curC()); fromQ.copy(g.quaternion);
    if(instant||ctx.reduce){ mode="down"; u=1; place(restC,restQ); setFloat(false); settle(); } else { mode="falling"; u=0; sound("lower"); }
    ctx.changed&&ctx.changed(false); }
  let floating=null;
  function setFloat(f){ if(f===floating) return; floating=f; SQ.value=f?1:0;
    g.traverse(o=>{ if(o.isMesh) o.renderOrder=f?30:0; }); }   // (drawn last: nothing the room draws over everything, a glow or a label, lands on it)
  setFloat(false);
  // off the desk it is out of the lamp's hot spot: held up in front of you it takes less of its light (DIM_UP), and keeps some
  // with the lamp off (FLOOR)
  const DIM_UP=.5;
  function settle(){ const h=Math.max(0,curC().y-restC.y); LIFT.value=Math.min(1,h/.15); DIM.value=1-(1-DIM_UP)*LIFT.value; if(fill) fill.set(Math.min(1,h/.04)); }
  function depthRange(){   // its nearest and farthest depth, for the squeeze
    const cam=ctx.view(), e=cam.projectionMatrix.elements, d=_r.copy(curC()).applyMatrix4(cam.matrixWorldInverse).z*-1, rad=Math.hypot(HW,HD,.006)+.004;
    const zn=x=>-e[10]+e[14]/x; Z0.value=zn(Math.max(cam.near*1.02,d-rad)); Z1.value=zn(Math.max(cam.near*1.05,d+rad)); }
  function frame(dt,T){
    const now=performance.now();
    for(const k of keys){ if(k.press<0) continue; const s=(now-k.press)/1000, e=s<.035?s/.035:s<.11?1:Math.max(0,1-(s-.11)/.08);
      PRESS.value[k.i]=e*.0008; if(s>.2){ k.press=-1; PRESS.value[k.i]=0; } }
    if(mode==="down") return;
    floatPose(T,fc,fq);
    if(mode==="up"){ place(fc,fq); setFloat(true); }
    else if(mode==="rising"){ u=Math.min(1,u+dt*pace/UP);
      const e=ease(u); p1.copy(fromC).y+=.14; p2.copy(fc).addScaledVector(_f,.1);
      place(bez(_d,fromC,p1,p2,fc,e),_q.slerpQuaternions(fromQ,fq,win(.14,.86,u))); setFloat(u>.22);
      if(u>=1) mode="up"; }
    else if(mode==="falling"){ u=Math.min(1,u+dt*pace/DOWN);
      const e=ease(u); p1.copy(fromC).addScaledVector(_f,.08); p2.copy(restC).y+=.13;
      place(bez(_d,fromC,p1,p2,restC,e),_q.slerpQuaternions(fromQ,restQ,win(0,.8,u))); setFloat(u<.72);
      if(u>=1){ mode="down"; place(restC,restQ); setFloat(false); sound("land"); } }
    if(floating) depthRange();
    settle();
  }

  // ---- its sounds: a plastic click and thock for a key (hard caps on rubber domes), at about the level of the room's own
  // button click (button_click at .55: an offline render puts both within 1 dB at the peak and 3 dB over their loudest 10 ms);
  // a scrape as it leaves the desk, a tap back down
  const KEYV=ctx.keyLevel==null?1:+ctx.keyLevel||0;
  let noise=null;
  function sound(kind){
    const a=ctx.audio&&ctx.audio(); if(!a) return; const ac=a.ctx, t=ac.currentTime+.005;
    if(!noise){ noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const burst=(dt,f,q,amp,att,dur,type="bandpass")=>{ const s=ac.createBufferSource(), fl=ac.createBiquadFilter(), gg=ac.createGain();
      s.buffer=noise; fl.type=type; fl.frequency.value=f; fl.Q.value=q; gg.gain.setValueAtTime(.0001,t+dt); gg.gain.exponentialRampToValueAtTime(amp,t+dt+att); gg.gain.exponentialRampToValueAtTime(.0001,t+dt+att+dur);
      s.connect(fl).connect(gg).connect(a.out); s.start(t+dt,Math.random()*.5); s.stop(t+dt+att+dur+.05); };
    if(kind==="key"){ if(!(KEYV>0)) return; burst(0,2300,1.8,.8*KEYV,.001,.02); burst(0,380,1,.9*KEYV,.001,.035,"lowpass"); burst(.065+Math.random()*.02,3300,2.6,.25*KEYV,.001,.008); }
    else if(kind==="lift"){ burst(0,1600,.9,.045,.02,.12); burst(.03,4200,1.3,.02,.01,.1); }
    else if(kind==="lower") burst(0,2800,.9,.03,.04,.16);
    else if(kind==="land"){ burst(0,760,1.4,.22,.003,.06,"lowpass"); burst(0,2700,2,.08,.002,.035); }   // (the notepad's pat, a little crisper)
  }

  // ---- the keys at work
  let sayT=0;
  function say(text){ if(ctx.live){ sayT=performance.now(); ctx.live(text); } }
  const spoken=()=>E.err?"error, "+E.text.replace(" E",""):E.text.replace(/\.$/,"");
  function press(id){ const k=keys.find(k=>k.id===id); if(!k) return false;
    k.press=performance.now(); sound("key"); E.press(id); drawLCD();
    if(id==="eq"||id==="pct"||id==="sqrt"||E.err) say(spoken()); return true; }
  // (no letters the room uses: C is the computer's and N the notepad's; Delete clears, as @ and F9 are √ and ± on Windows' calculator)
  const KEYMAP={"+":"add","-":"sub","*":"mul","x":"mul","/":"div",enter:"eq","=":"eq",".":"dot",",":"dot","%":"pct","@":"sqrt",r:"sqrt",f9:"neg",delete:"C",backspace:"back"};
  function key(k){ if(!(mode==="up"||mode==="rising")) return false;
    const id=/^[0-9]$/.test(k)?k:KEYMAP[k]; if(!id) return false;
    if(id==="back"){ E.press("back"); drawLCD(); sound("key"); return true; }
    return press(id); }
  // what of it is under a point on the screen while it floats: a key, or the rest of it
  const ray=new THREE.Raycaster(), ptr=new THREE.Vector2();
  function at(x,y){ if(mode==="down") return null;
    ptr.set(x/innerWidth*2-1,-(y/innerHeight)*2+1); ray.setFromCamera(ptr,ctx.view());
    const h=ray.intersectObjects(pickList,false)[0]; if(!h) return null; const p=pick.get(h.object);
    if(p.part==="keys"){ const k=h.face?h.object.geometry.attributes.keyId.getX(h.face.a):-1; return k>=0?{part:"key",i:k}:{part:"body"}; }
    return p; }
  function click(p){ if(!p) return; if(p.part==="key") press(KEYS[p.i]); else lower(); }
  function tip(h){ const p=pick.get(h)||{part:"body"};
    if(!(mode==="up"||mode==="rising")) return "CALCULATOR";
    if(p.part==="key"){ const id=KEYS[p.i]; return NAME[id]||id; }
    return "PUT IT DOWN"; }
  function toScreen(id){ const i=KEYS.indexOf(id), v=new V3(KX(i%4),keyTop,KZ(Math.floor(i/4))).applyMatrix4(g.matrixWorld).project(ctx.view());
    return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}; }

  return {group:g,lift,lower,frame,at,click,press,key,tip,toScreen,engine:E,fill,keys:KEYS,
    get up(){ return mode==="up"||mode==="rising"; }, get busy(){ return mode==="rising"||mode==="falling"||keys.some(k=>k.press>=0); },
    get mode(){ return mode; }, set pace(v){ pace=v; }, get display(){ return E.text; }, get floating(){ return floating; }, lcd:lcd&&lcd.cv};
}
