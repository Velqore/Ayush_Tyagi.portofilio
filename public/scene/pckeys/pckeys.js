// The old PC's keyboard types along (Felix, 27 Sep 02:36Z: "i'd love if typing keys on the computer would press the matching
// key on the in-scene keyboard"). A key that reaches the PC presses its cap on the model: down as the key goes down, up when
// it's let go, Space, the modifiers and the numpad included. Each cap is a closed piece of the keyboard's two key meshes
// (retro_pc.py builds them one by one), so there's no re-bake: every vertex gets its cap's number as an attribute, and the
// vertex shader moves the caps that are down, straight down the keyboard's plate, their printed legends (details.py) with them.
//
// Which cap: the one whose legend is the character typed (e.key: z presses Z on any layout, ! the 1, @ the 2), else the one
// in the key's place (e.code: Shift, Enter, F1-F10, a letter the XT hasn't got). The XT has no arrow or Home/End keys: those
// are its numpad's, as its legends say (8 is up, 7 Home, . Del). A key it hasn't got (F11, Cmd, the Windows key) presses
// nothing. A phone's keyboard sends text, not keys: the last letter of what it types taps that letter's cap.
//
// The computer view stands back so the keyboard is in the picture while you type (typingFrame, which the page's pcFrame asks
// with its reading close-up). It goes halfway (Felix, 27 Sep 03:27Z: "go halfway between what you have right now and the
// about view"): half the step back to where the whole keyboard would fit, from a little higher. The glass sits at the top
// right with the print beside it, the keyboard's back rows come in from the bottom left, and the PC's text is about 70% of
// its reading size (63% on 4:3). A window narrower than about 5:4 keeps the reading close-up.
//
// createPCKeys(THREE, ctx) takes the loaded room and returns the controller (null if the keyboard isn't there or its caps
// don't match the layout). Call it before the page joins the room's meshes (perf/join): the caps' attribute of their own
// keeps them out of the joined meshes.
//   ctx.root    the room: retro_keyboard, retro_monitor (retro_pc.py), retro_legends and retro_legends_light (details.py);
//               the page has named each mesh's material in userData.mname
//   ctx.input   the PC's hidden textarea: the keys aimed at it press caps
//   ctx.wide    when the computer view stands back to show the keyboard: "visit" (a click on the computer, or C; About and
//               Online keep their reading close-up), "always", or "off"
//   ctx.travel  how far a cap goes down (PCKEYS.travel)
// The controller: frame(dt) once a frame, busy (a cap on its way), typingFrame({fov, aspect, height, print, minD, reading, near}),
// wide (as ctx.wide, settable), press(id), release(id), tap(id), depth(id) (0 up, 1 down), keys (the ids: "a", "1", "space",
// "shiftl", "n7", "f1" ...), dispose().

export const PCKEYS={ travel:.0035, down:.035, up:.075, stale:2500 };   // metres; seconds down and back up; ms a key may stay down unheard

// ---- the XT layout, as retro_pc.py lays it out: key pitch, the function block's left edge, the space row's front edge, all
// in the keyboard's own space (x across, z toward the front, y up), and the plate's slope (it rises .014 over .146)
const U=.019, X0=-.209, Y0=.018, SLOPE=Math.atan(.014/.146);
// each cap: id, column and width (key units from the left), row (0 = the space row) and depth, the codes it answers, and the
// characters printed on it
export const KEYS=[];
const key=(id,col,w,row,codes,chars="",d=1)=>KEYS.push({id,col,w,row,d,codes:codes?codes.split(" "):[],chars:[...chars]});
for(let r=0;r<5;r++) for(let c=0;c<2;c++){ const n=(4-r)*2+c+1; key("f"+n,c,1,r,"F"+n); }   // function block: F1 F2 at the back
function row(r,x,specs){ for(const [id,w,codes,chars] of specs){ key(id,x,w,r,codes,chars); x+=w; } }
const letters=s=>[...s].map(c=>[c,1,"Key"+c.toUpperCase(),c]);
row(4,2.5,[["esc",1,"Escape"],..."1234567890".split("").map(c=>[c,1,"Digit"+c,c+"!@#$%^&*()"["1234567890".indexOf(c)]]),
  ["-",1,"Minus","-_"],["=",1,"Equal","=+"],["bksp",2,"Backspace"]]);
row(3,2.5,[["tab",1.5,"Tab"],...letters("qwertyuiop"),["[",1,"BracketLeft","[{"],["]",1,"BracketRight","]}"],["\\",1.5,"Backslash","\\|"]]);
row(2,2.5,[["ctrl",1.75,"ControlLeft ControlRight"],...letters("asdfghjkl"),[";",1,"Semicolon",";:"],["'",1,"Quote","'\""],
  ["`",1,"Backquote","`~"],["enter",1.25,"Enter NumpadEnter"]]);
row(1,2.5,[["shiftl",2.25,"ShiftLeft"],...letters("zxcvbnm"),[",",1,"Comma",",<"],[".",1,"Period",".>"],["/",1,"Slash","/?"],
  ["shiftr",1.75,"ShiftRight"],["prtsc",1,"PrintScreen NumpadMultiply"]]);
row(0,2.5,[["alt",1.5,"AltLeft AltRight"],["space",12,"Space"," "],["caps",1.5,"CapsLock"]]);
row(4,18,[["numlock",2,"NumLock"],["scrolllock",2,"ScrollLock"]]);
row(3,18,[["n7",1,"Numpad7 Home"],["n8",1,"Numpad8 ArrowUp"],["n9",1,"Numpad9 PageUp"],["n-",1,"NumpadSubtract"]]);
row(2,18,[["n4",1,"Numpad4 ArrowLeft"],["n5",1,"Numpad5"],["n6",1,"Numpad6 ArrowRight"]]);
row(1,18,[["n1",1,"Numpad1 End"],["n2",1,"Numpad2 ArrowDown"],["n3",1,"Numpad3 PageDown"]]);
row(0,18,[["n0",2,"Numpad0 Insert"],["n.",1,"NumpadDecimal Delete"]]);
key("n+",21,1,0,"NumpadAdd","",3);   // the tall + key, three rows deep
const IDX=new Map(KEYS.map((k,i)=>[k.id,i])), CODE=new Map(), CHAR=new Map();
KEYS.forEach((k,i)=>{ for(const c of k.codes) CODE.set(c,i); for(const c of k.chars) CHAR.set(c,i); });
const TOGGLES=new Set(["CapsLock","NumLock","ScrollLock"]);   // a Mac sends Caps Lock's keyup only when it's switched off again: these tap
const MODS=new Set(["ShiftLeft","ShiftRight","ControlLeft","ControlRight","AltLeft","AltRight"]);   // held for long without repeating
const NAMED={Shift:"ShiftLeft",Control:"ControlLeft",Alt:"AltLeft",AltGraph:"AltRight"};   // a key's name where it differs from its code's

// the cap for a key event, or -1
export function capFor(e){
  const c=e.code||"", k=e.key||"";
  if(c.startsWith("Numpad")&&CODE.has(c)) return CODE.get(c);   // (the numpad's own 7, not the one over U)
  if(k.length===1){ const i=CHAR.get(k)??CHAR.get(k.toLowerCase()); if(i!==undefined) return i; }
  return CODE.get(c)??CODE.get(NAMED[k]||k)??-1;   // (a keyboard that sends no code, as a phone's may: the key's name)
}

export function createPCKeys(THREE,ctx){
  const {root,input}=ctx, travel=ctx.travel??PCKEYS.travel;
  const kb=root.getObjectByName("retro_keyboard"), mon=root.getObjectByName("retro_monitor");
  if(!kb) return null;
  root.updateMatrixWorld(true);
  const capMeshes=[]; kb.traverse(o=>{ if(o.isMesh&&!Array.isArray(o.material)&&/^retro_key(_dark)?$/.test(o.userData.mname||"")) capMeshes.push(o); });
  const legends=["retro_legends","retro_legends_light"].map(n=>root.getObjectByName(n)).filter(o=>o?.isMesh&&!Array.isArray(o.material));
  if(!capMeshes.length){ console.warn("pckeys: no keycaps on the keyboard"); return null; }
  const toKb=o=>new THREE.Matrix4().copy(kb.matrixWorld).invert().multiply(o.matrixWorld), v3=new THREE.Vector3();

  // ---- the caps: each key mesh's vertices, welded where they share a place (a seam splits them), in connected pieces; a
  // piece is the cap whose layout centre its footprint holds, and each cap has exactly one piece
  const foot=[];   // footprints in the keyboard's space: [x0, x1, z0, z1, cap]
  const cen=KEYS.map(k=>[X0+(k.col+k.w/2)*U,-(Y0+(k.row+k.d/2)*U)]), found=new Uint8Array(KEYS.length);
  const tags=new Map();   // mesh -> its vertices' caps (cap + 1, 0 for none)
  for(const o of capMeshes){
    const g=o.geometry, P=g.attributes.position, n=P.count, ix=g.index, m=ix?ix.count:n, M=toKb(o);
    const par=new Int32Array(n), used=new Uint8Array(n), at=new Map();
    for(let i=0;i<n;i++) par[i]=i;
    const find=a=>{ while(par[a]!==a){ par[a]=par[par[a]]; a=par[a]; } return a; };
    const join=(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; };
    for(let i=0;i<n;i++){ const k=Math.round(P.getX(i)*2e4)+","+Math.round(P.getY(i)*2e4)+","+Math.round(P.getZ(i)*2e4), j=at.get(k); if(j===undefined) at.set(k,i); else join(i,j); }
    for(let t=0;t+2<m;t+=3){ const a=ix?ix.getX(t):t, b=ix?ix.getX(t+1):t+1, c=ix?ix.getX(t+2):t+2; used[a]=used[b]=used[c]=1; join(a,b); join(a,c); }
    const box=new Map();
    for(let i=0;i<n;i++){ if(!used[i]) continue; const r=find(i); let b=box.get(r); if(!b) box.set(r,b=[1e9,-1e9,1e9,-1e9,-1]);
      v3.fromBufferAttribute(P,i).applyMatrix4(M); b[0]=Math.min(b[0],v3.x); b[1]=Math.max(b[1],v3.x); b[2]=Math.min(b[2],v3.z); b[3]=Math.max(b[3],v3.z); }
    for(const b of box.values()){
      const hits=[]; cen.forEach(([x,z],i)=>{ if(x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]) hits.push(i); });
      if(hits.length!==1||found[hits[0]]){ console.warn("pckeys: the keyboard's caps don't match the XT layout",hits.map(i=>KEYS[i].id)); return null; }
      b[4]=hits[0]; found[hits[0]]=1; foot.push(b); }
    const tag=new Float32Array(n);
    for(let i=0;i<n;i++) if(used[i]) tag[i]=box.get(find(i))[4]+1;
    tags.set(o,tag);
  }
  if(found.some(f=>!f)){ console.warn("pckeys: caps missing from the keyboard",KEYS.filter((k,i)=>!found[i]).map(k=>k.id)); return null; }
  // the legends: each vertex rides the cap it's printed on (a letter's vertices come together: the last cap is tried first)
  const on=(b,p)=>p.x>=b[0]-1e-4&&p.x<=b[1]+1e-4&&p.z>=b[2]-1e-4&&p.z<=b[3]+1e-4;
  for(const o of legends){
    const P=o.geometry.attributes.position, n=P.count, M=toKb(o), tag=new Float32Array(n); let last=foot[0];
    for(let i=0;i<n;i++){ v3.fromBufferAttribute(P,i).applyMatrix4(M);
      const b=on(last,v3)?last:foot.find(b=>on(b,v3)); if(b){ tag[i]=b[4]+1; last=b; } }
    tags.set(o,tag);
  }

  // ---- the shader: a cap that's down moves along the plate's normal, in each mesh's own space (the legends are placed in the
  // room's). Its travel comes from one shared array, four caps to a vec4. The materials keep the hooks they have (the bake's
  // light, pccase's plastic) and add this; one shared by some other mesh gets a copy of its own first.
  const N=KEYS.length, SLOTS=Math.ceil(N/4), DEPTH={value:new Float32Array(SLOTS*4)}, D=DEPTH.value;
  const HEAD=`attribute float pcKey;\nuniform vec4 pcKeyD[${SLOTS}];\nuniform vec3 pcKeyDir;\n`;
  const MOVE="#include <begin_vertex>\n\tif(pcKey>.5){ int k=int(pcKey+.5)-1; transformed+=pcKeyDir*pcKeyD[k>>2][k&3]; }";
  const users=new Map(); root.traverse(o=>{ if(o.isMesh) users.set(o.material,(users.get(o.material)||0)+1); });
  const down=new THREE.Vector3(0,-Math.cos(SLOPE),-Math.sin(SLOPE)).multiplyScalar(travel), P0=new THREE.Vector3(0,.04,-.06);
  let warned=false;
  for(const [o,tag] of tags){
    o.geometry.setAttribute("pcKey",new THREE.BufferAttribute(tag,1));
    const inv=new THREE.Matrix4().copy(o.matrixWorld).invert(), a=P0.clone().applyMatrix4(kb.matrixWorld).applyMatrix4(inv);
    const dir={value:P0.clone().add(down).applyMatrix4(kb.matrixWorld).applyMatrix4(inv).sub(a)};
    let m=o.material;
    if(users.get(m)>1){ const c=m.clone(); c.onBeforeCompile=m.onBeforeCompile; c.customProgramCacheKey=m.customProgramCacheKey; o.material=m=c; }
    const obc=m.onBeforeCompile, keyFn=m.customProgramCacheKey;
    m.onBeforeCompile=function(sh,r){ obc.call(this,sh,r);
      if(!sh.vertexShader.includes("#include <begin_vertex>")){ if(!warned){ warned=true; console.warn("pckeys: the caps' shader has changed; they stay up"); } return; }
      sh.uniforms.pcKeyD=DEPTH; sh.uniforms.pcKeyDir=dir; sh.vertexShader=HEAD+sh.vertexShader.replace("#include <begin_vertex>",MOVE); };
    m.customProgramCacheKey=function(){ return keyFn.call(this)+"|pckeys"; };
    m.needsUpdate=true;
  }

  // ---- the caps' travel: down in a blink, back up on the spring a little slower; a tap goes all the way down first
  const x=new Float32Array(N), want=new Uint8Array(N), hit=new Uint8Array(N).fill(1), cnt=new Uint8Array(N), moving=new Set();   // (hit: been all the way down since its press)
  const press=i=>{ want[i]=1; hit[i]=0; moving.add(i); }, release=i=>{ want[i]=0; moving.add(i); };
  const tap=i=>{ if(cnt[i]) return; press(i); release(i); };
  const hold=(i,s)=>{ cnt[i]=Math.max(0,cnt[i]+s); if(s>0&&cnt[i]===1) press(i); else if(!cnt[i]) release(i); };
  function frame(dt){
    if(!moving.size) return;
    for(const i of moving){
      let v=x[i];
      if(want[i]||!hit[i]){ v=Math.min(1,v+dt/PCKEYS.down); if(v>=1){ hit[i]=1; if(want[i]) moving.delete(i); } }   // (held down: nothing moves)
      else { v=Math.max(0,v-dt/PCKEYS.up); if(v<=0) moving.delete(i); }
      x[i]=v; D[i]=v*v*(3-2*v);
    }
  }

  // ---- the keys: those aimed at the PC's textarea go down, and any key let go anywhere comes up. Each key is held by its
  // code, so Shift let go before the 1 still lets the 1 up. Leaving the window, or the PC, lets them all up.
  const held=new Map(), stale=new Map(); let lastKey=-1e9;
  const letGo=id=>{ const i=held.get(id); if(i===undefined) return; held.delete(id); clearTimeout(stale.get(id)); stale.delete(id); hold(i,-1); };
  const releaseAll=()=>{ for(const id of [...held.keys()]) letGo(id); };
  const onDown=e=>{
    if(e.target!==input) return;
    const i=capFor(e); if(i<0) return;
    lastKey=performance.now();
    if(TOGGLES.has(e.code)){ if(!e.repeat) tap(i); return; }
    const id=e.code||"key:"+e.key;
    if(!held.has(id)){ held.set(id,i); hold(i,1); }
    // a Mac sends no keyup for a key let go while Cmd is down: one that stops repeating comes up after a while
    if(!MODS.has(e.code)){ clearTimeout(stale.get(id)); stale.set(id,setTimeout(()=>letGo(id),PCKEYS.stale)); }
  };
  const onUp=e=>{
    if(e.key==="Meta"){ releaseAll(); return; }   // (and when Cmd comes up, so does everything)
    const id=e.code||"key:"+e.key;
    if(held.has(id)) letGo(id);
    else if(e.code==="PrintScreen"&&e.target===input) tap(CODE.get("PrintScreen"));   // Windows sends Print Screen only on its way up
  };
  // a phone's keyboard: its keydowns name no key, so the text it puts in taps the cap of its last letter (a key the keydown
  // named has pressed its cap already)
  const onInput=e=>{
    if(performance.now()-lastKey<150) return;
    const t=e.inputType||"";
    if(t.startsWith("delete")) return tap(IDX.get("bksp"));
    if(t==="insertLineBreak"||t==="insertParagraph") return tap(IDX.get("enter"));
    if(!e.data||t&&!/^insert(Text|CompositionText|ReplacementText)$/.test(t)) return;
    const ch=[...e.data].pop(), i=CHAR.get(ch)??CHAR.get(ch.toLowerCase());
    if(i!==undefined) tap(i);
  };
  const onHide=()=>{ if(document.hidden) releaseAll(); };
  addEventListener("keydown",onDown,true); addEventListener("keyup",onUp,true); addEventListener("blur",releaseAll);
  document.addEventListener("visibilitychange",onHide);
  input?.addEventListener("input",onInput); input?.addEventListener("blur",releaseAll);

  // ---- the typing view: the monitor and the keyboard in one picture. From the reading view's line of sight, 10° further
  // round toward the room (clear of the desk chair; the orbit's limit is 1.45) and 8° higher, looking at a point 45% of the
  // way from the glass to the keys; far enough back that the monitor and the print on it stay clear of the page's top bar
  // (64 px) and the keyboard of the bottom edge, and never nearer than the orbit lets the camera stand. Past 1.1 m (a narrow
  // window) the desk chair comes into the picture: the reading close-up stays instead.
  const FR={az:10,el:8,mix:.45,lift:.02,maxD:1.1,back:.5,up:10}, Y=new THREE.Vector3(0,1,0), DEG=Math.PI/180;
  function typingFrame({fov=32,aspect=1.6,height=900,print=[],minD=.31,reading=false,near=null}={}){
    if(!mon||ctl.wide==="off"||ctl.wide==="visit"&&reading) return null;
    mon.updateWorldMatrix(true,false); kb.updateWorldMatrix(true,false);
    const tv=Math.tan(fov*DEG/2), top=Math.min(.86,1-128/height), W=(o,a,b,c)=>new THREE.Vector3(a,b,c).applyMatrix4(o.matrixWorld);
    // each point with how far from the middle it may sit (1 is the edge): across, above, below. The monitor's housing (its
    // top seen from above, back to where the tube narrows) and the print on it; the letter block's caps and the keyboard's
    // front edge under them
    const pts=[];
    for(const a of [-.17,.17]){ pts.push([W(mon,a,.322,-.062),.94,top,.8]); pts.push([W(mon,a,.04,0),.94,top,.8]); }
    for(const p of print) pts.push([p,.94,top,.8]);
    for(const c of [2.5,17.5]){ for(const z of [-.018,-.113]) pts.push([W(kb,X0+c*U,.045,z),.94,top,.94]); pts.push([W(kb,X0+c*U,.021,0),.94,top,.97]); }
    const glass=W(mon,0,.186,-.015), keys=W(kb,X0+10*U,.045,-.0655);
    const h=new THREE.Vector3(0,0,1).transformDirection(mon.matrixWorld); h.y=0; h.normalize().applyAxisAngle(Y,FR.az*DEG);
    if(Math.atan2(h.x,h.z)>1.44) h.set(Math.sin(1.44),0,Math.cos(1.44));
    const el=(5.7+FR.el)*DEG, dv=h.clone().multiplyScalar(Math.cos(el)).addScaledVector(Y,Math.sin(el)).normalize();
    const f=dv.clone().negate(), r=new THREE.Vector3().crossVectors(f,Y).normalize(), u=new THREE.Vector3().crossVectors(r,f);
    const tgt=glass.clone().lerp(keys,FR.mix).addScaledVector(u,FR.lift), q=new THREE.Vector3(), cam=new THREE.Vector3();
    const fit=()=>{ let d=minD;
      for(const [p,mx,mt,mb] of pts){ q.subVectors(p,tgt); const al=q.dot(dv), la=q.dot(r), ve=q.dot(u);
        d=Math.max(d,al+Math.abs(la)/(mx*tv*aspect),al+(ve>=0?ve/(mt*tv):-ve/(mb*tv))); }
      return d; };
    for(let k=0;k<3;k++){   // centred between what it must show, and fitted again
      const d=fit(); cam.copy(tgt).addScaledVector(dv,d); let x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
      for(const [p,mx,mt,mb] of pts){ q.subVectors(p,cam); const z=q.dot(f), X=q.dot(r)/z/(tv*aspect)/mx, Yv=q.dot(u)/z/tv, Yn=Yv/(Yv>=0?mt:mb);
        x0=Math.min(x0,X); x1=Math.max(x1,X); y0=Math.min(y0,Yn); y1=Math.max(y1,Yn); }
      tgt.addScaledVector(r,(x0+x1)/2*.94*tv*aspect*d).addScaledVector(u,(y0+y1)/2*top*tv*d);
    }
    const d=fit(); if(d>FR.maxD) return null;
    if(!near) return {tgt,pos:tgt.clone().addScaledVector(dv,d)};
    // halfway there from the reading close-up (near), FR.up degrees higher: the glass's top edge just under the page's top
    // bar, the monitor's right edge and the print at the right margin, and the keyboard from the bottom left as far as it
    // reaches (where all of it fits, it's all centred instead)
    const dn=near.pos.distanceTo(near.tgt), D=dn+Math.max(0,d-dn)*FR.back, e=el+FR.up*DEG;
    const dv2=h.clone().multiplyScalar(Math.cos(e)).addScaledVector(Y,Math.sin(e)).normalize(), f2=dv2.clone().negate();
    const r2=new THREE.Vector3().crossVectors(f2,Y).normalize(), u2=new THREE.Vector3().crossVectors(r2,f2);
    const TOP=[-.132,.132].map(a=>W(mon,a,.285,-.015)), RIGHT=[W(mon,.17,.322,-.062),W(mon,.17,.04,0),...print], t2=glass.clone();
    const ndc=p=>{ q.subVectors(p,cam); const z=q.dot(f2); return [q.dot(r2)/z/(tv*aspect),q.dot(u2)/z/tv]; };
    for(let k=0;k<8;k++){
      cam.copy(t2).addScaledVector(dv2,D); let x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
      for(const [p] of pts){ const [X,Yv]=ndc(p); x0=Math.min(x0,X); x1=Math.max(x1,X); y0=Math.min(y0,Yv); y1=Math.max(y1,Yv); }
      const xr=Math.max(...RIGHT.map(p=>ndc(p)[0])), yt=Math.max(...TOP.map(p=>ndc(p)[1]));
      t2.addScaledVector(r2,(x1-x0<=1.88?(x0+x1)/2:xr-.94)*tv*aspect*D).addScaledVector(u2,(y1-y0<=top+.94?(y0+y1+.94-top)/2:yt-top)*tv*D);
    }
    return {tgt:t2,pos:t2.clone().addScaledVector(dv2,D)};
  }

  const ctl={
    wide:ctx.wide||"visit",
    frame, typingFrame, keys:KEYS.map(k=>k.id),
    get busy(){ return moving.size>0; },
    press(id){ const i=IDX.get(id); if(i!==undefined) hold(i,1); },
    release(id){ const i=IDX.get(id); if(i!==undefined) hold(i,-1); },
    tap(id){ const i=IDX.get(id); if(i!==undefined) tap(i); },
    depth(id){ const i=IDX.get(id); return i===undefined?0:x[i]; },
    dispose(){ releaseAll(); removeEventListener("keydown",onDown,true); removeEventListener("keyup",onUp,true); removeEventListener("blur",releaseAll);
      document.removeEventListener("visibilitychange",onHide); input?.removeEventListener("input",onInput); input?.removeEventListener("blur",releaseAll); },
  };
  return ctl;
}
