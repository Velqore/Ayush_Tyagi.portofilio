// The Work card is the yellow legal pad on the desk (Felix, 26 Sep 00:02Z). Its top sheet carries the tape list and, with a
// tape in, that tape's notes, written in ink on the paper itself. Inserting a tape floats the pad up in front of the camera;
// a click anywhere puts it back down on the desk. The pencil and the glasses that lay on it have moved over to the A4 sheets.
//
// createNotepad(THREE, ctx) takes the loaded room and returns the pad's controller (null if the scene has no pad):
//   ctx.scene, ctx.root   the room (the pad is office_notepads_yellow_pad)
//   ctx.interact          the page's pick map: the pad joins it as {kind:"notepad"}
//   ctx.view()            the camera the room is drawn with, as it is this frame (the pad floats in front of it)
//   ctx.content()         {tape, st, tapes:[{t,y,d,links:[[text,url]]}], jobs}: what the top sheet says
//   ctx.audio()           {ctx, out} while the room has sound, else null
//   ctx.fonts             a promise for the page's web fonts; the ink is redrawn in Caveat once they're in
//   ctx.reduce            prefers-reduced-motion: no flight, no bob
//   ctx.anisotropy        renderer.capabilities.getMaxAnisotropy()
// The controller: lift(instant), lower(instant), up (floating or on its way up), busy (moving), frame(dt, t) once a frame
// after the view is final, redraw() when the tape changes, at(x, y) and tip(x, y) for the pointer (client pixels),
// focus(i) for the tape row the keyboard is on, width() its width on screen while it floats, restBox (on the desk).
export function createNotepad(THREE, ctx){
  const V3=THREE.Vector3, Q4=THREE.Quaternion, M4=THREE.Matrix4;
  const {scene, root}=ctx;
  const pad=root.getObjectByName("office_notepads_yellow_pad");
  if(!pad||!pad.isMesh||!pad.geometry) return null;
  const glasses=root.getObjectByName("round_spectacles"), pencil=root.getObjectByName("stationery_supplies_pencil_used");
  scene.updateMatrixWorld(true);

  // ---- a move in world terms, whatever the object hangs under
  const moveBy=(o,m)=>{ o.updateWorldMatrix(true,false); const w=m.clone().multiply(o.matrixWorld); w.premultiply(new M4().copy(o.parent.matrixWorld).invert());
    w.decompose(o.position,o.quaternion,o.scale); o.updateMatrixWorld(true); };
  const within=(o,p)=>{ for(let q=o;q;q=q.parent) if(q===p) return true; return false; };
  const solid=[]; scene.traverse(o=>{ if(o.isMesh&&o.visible&&!(Array.isArray(o.material)?o.material[0]:o.material)?.transparent&&!/^city_/.test(o.name)) solid.push(o); });
  // the highest surface under the middle of a box (what it would rest on), ignoring the objects given
  function surfaceUnder(b,skip){
    const ray=new THREE.Raycaster(), from=new V3(), down=new V3(0,-1,0), list=solid.filter(o=>!skip.some(s=>within(o,s)));
    let y=-Infinity;
    for(let i=0;i<=4;i++) for(let j=0;j<=4;j++){
      ray.set(from.set(b.min.x+(b.max.x-b.min.x)*(.2+.15*i),b.max.y+.25,b.min.z+(b.max.z-b.min.z)*(.2+.15*j)),down);
      const h=ray.intersectObjects(list,false).find(h=>h.point.y<=b.max.y); if(h) y=Math.max(y,h.point.y); }
    return y; }
  // turn an object about the vertical through its middle, set it over (x, z), and down onto what is under it there
  function setDown(o,x,z,turn,skip){
    const b=new THREE.Box3().setFromObject(o,true), c=b.getCenter(new V3());
    moveBy(o,new M4().makeTranslation(x,0,z).multiply(new M4().makeRotationY(turn)).multiply(new M4().makeTranslation(-c.x,0,-c.z)));
    const b2=new THREE.Box3().setFromObject(o,true), y=surfaceUnder(b2,skip);
    if(isFinite(y)) moveBy(o,new M4().makeTranslation(0,y+.0003-b2.min.y,0));
  }
  // The glasses and the pencil lay on the pad: they go over to the right, onto the A4 sheets in front of the floppies. The
  // glasses' arms point back, clear of the floppies; the pencil lies along the sheets' right edge. (Blender: props.py should
  // place them there too, and the pad's next bake no longer sees them.)
  if(glasses) setDown(glasses,.7225,.235,THREE.MathUtils.degToRad(-10),[glasses,pad,pencil]);
  if(pencil) setDown(pencil,.816,.1,THREE.MathUtils.degToRad(-37),[pencil,pad,glasses]);

  // ---- soft contact shadows. The desk's bake has none for these (the glasses and the pencil lay elsewhere; the pad's was taken
  // out with the patch under it), so each gets a flat quad just over the surface: its triangles seen from above, darker where
  // they are near the surface, blurred.
  function contactShadow(obj,y0,{res=.002,reach=.02,blur=2,dark=.6,skipGlass=true}={}){
    obj.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(obj,true), m0=reach+.012;
    const x0=b.min.x-m0, z0=b.min.z-m0, w=b.max.x-b.min.x+2*m0, d=b.max.z-b.min.z+2*m0;
    const S=4, cw=Math.max(4,Math.ceil(w/res)), ch=Math.max(4,Math.ceil(d/res));
    const big=document.createElement("canvas"); big.width=cw*S; big.height=ch*S; const g=big.getContext("2d");
    const v=[new V3(),new V3(),new V3()], k=S/res;
    obj.traverse(m=>{ if(!m.isMesh||!m.visible) return; const mat=Array.isArray(m.material)?m.material[0]:m.material; if(skipGlass&&mat.transparent) return;
      const p=m.geometry.attributes.position, ix=m.geometry.index, n=ix?ix.count:p.count;
      for(let t=0;t+2<n;t+=3){
        for(let q=0;q<3;q++) v[q].fromBufferAttribute(p,ix?ix.getX(t+q):t+q).applyMatrix4(m.matrixWorld);
        const h=(v[0].y+v[1].y+v[2].y)/3-y0, a=Math.min(1,Math.max(0,1-h/reach)); if(a<=0) continue;
        g.fillStyle=`rgba(0,0,0,${(a*.5).toFixed(3)})`; g.beginPath();
        g.moveTo((v[0].x-x0)*k,(v[0].z-z0)*k); g.lineTo((v[1].x-x0)*k,(v[1].z-z0)*k); g.lineTo((v[2].x-x0)*k,(v[2].z-z0)*k); g.closePath(); g.fill(); } });
    const c=document.createElement("canvas"); c.width=cw; c.height=ch; const s=c.getContext("2d");
    s.imageSmoothingQuality="high"; if("filter" in s&&blur) s.filter=`blur(${blur}px)`;
    s.drawImage(big,0,0,cw,ch);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.MeshBasicMaterial({map:tex,color:0xffffff,transparent:true,opacity:dark,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const q=new THREE.Mesh(new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2),mat);
    q.position.set(x0+w/2,y0+.0004,z0+d/2); q.name=(obj.name||"prop")+"_contact"; q.renderOrder=1; q.castShadow=q.receiveShadow=false; q.raycast=()=>{};
    scene.add(q); return q;
  }
  const floorY=o=>{ const b=new THREE.Box3().setFromObject(o,true); return surfaceUnder(new THREE.Box3(b.min.clone(),new V3(b.max.x,b.min.y+.004,b.max.z)),[o,pad]); };
  if(glasses) contactShadow(glasses,floorY(glasses),{reach:.03,blur:2.5,dark:.55});
  if(pencil) contactShadow(pencil,floorY(pencil),{reach:.012,blur:2,dark:.6,res:.0015});

  // ---- the pad: kept in world terms from here on
  scene.attach(pad); pad.updateMatrixWorld(true);
  const restP=pad.position.clone(), restQ=pad.quaternion.clone();
  const restBox=new THREE.Box3().setFromObject(pad,true);
  const padShadow=contactShadow(pad,restBox.min.y,{reach:.02,blur:2.5,dark:.5,res:.004});

  // ---- the top sheet: the top face's corners get UVs of its own (the atlas gives the sheet 254 px: too coarse for ink)
  const geo=pad.geometry.clone(); pad.geometry=geo;
  const pos=geo.attributes.position;
  let yTop=-Infinity; for(let i=0;i<pos.count;i++) yTop=Math.max(yTop,pos.getY(i));
  const top=[]; for(let i=0;i<pos.count;i++) if(pos.getY(i)>yTop-1e-4) top.push(i);
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
  for(const i of top){ x0=Math.min(x0,pos.getX(i)); x1=Math.max(x1,pos.getX(i)); z0=Math.min(z0,pos.getZ(i)); z1=Math.max(z1,pos.getZ(i)); }
  const PW=x1-x0, PH=z1-z0;   // 22.3 by 30.7 cm: the sheet's top (where the pad is bound) is at z0, its left edge (the red margin) at x0
  const CENTER=new V3((x0+x1)/2,yTop,(z0+z1)/2);
  const uvA=geo.attributes.uv, uv=new Float32Array(uvA.count*2);
  for(let i=0;i<uvA.count;i++){ uv[i*2]=uvA.getX(i); uv[i*2+1]=uvA.getY(i); }
  for(const i of top){ uv[i*2]=(pos.getX(i)-x0)/PW; uv[i*2+1]=(pos.getZ(i)-z0)/PH; }
  geo.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  // the sheet's two triangles first (material 0), the pad's sides and back after (material 1). Every face is wound outward, so
  // front faces alone draw the pad: while it floats it draws over the room, whatever stands nearer (see floatDepth)
  { const ix=geo.index?Array.from(geo.index.array):[...Array(pos.count).keys()], isTop=new Set(top), A=[], B=[];
    const bb=new THREE.Box3().setFromBufferAttribute(pos), mid=bb.getCenter(new V3()), a=new V3(), b=new V3(), c=new V3(), n=new V3(), e=new V3();
    for(let t=0;t+2<ix.length;t+=3){ let i0=ix[t],i1=ix[t+1],i2=ix[t+2];
      a.fromBufferAttribute(pos,i0); b.fromBufferAttribute(pos,i1); c.fromBufferAttribute(pos,i2);
      n.subVectors(b,a).cross(e.subVectors(c,a)); const f=a.clone().add(b).add(c).divideScalar(3).sub(mid);
      if(n.dot(f)<0) [i1,i2]=[i2,i1];
      (isTop.has(i0)&&isTop.has(i1)&&isTop.has(i2)?A:B).push(i0,i1,i2); }
    geo.setIndex([...A,...B]); geo.clearGroups(); geo.addGroup(0,A.length,0); geo.addGroup(A.length,B.length,1); }

  // ---- the paper and the ink, drawn into a canvas the size of the sheet
  const CW=1280, CH=Math.round(CW*PH/PW), PXCM=CW/(PW*100);
  const TOP=Math.round(CH*.12), RULE=Math.round(1.1*PXCM), MARGIN=Math.round(2.25*PXCM), LEFT=MARGIN+28, RIGHT=CW-66;
  const cv=document.createElement("canvas"); cv.width=CW; cv.height=CH;
  const inkCv=document.createElement("canvas"); inkCv.width=CW; inkCv.height=CH;
  const tex=new THREE.CanvasTexture(cv); tex.flipY=false; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=16; tex.generateMipmaps=true; tex.minFilter=THREE.LinearMipmapLinearFilter; tex.magFilter=THREE.LinearFilter;
  const rng=seed=>()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6D2B79F5|0,((seed^seed>>>7)>>>0)/4294967296));
  const hash=s=>{ let h=2166136261; for(const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h>>>0; };
  // legal-pad yellow (the pad's own texture), fibres and a faint mottle, the printed rules and the red double margin
  const paperCv=(()=>{ const c=document.createElement("canvas"); c.width=CW; c.height=CH; const g=c.getContext("2d"), r=rng(7);
    g.fillStyle="#f4d665"; g.fillRect(0,0,CW,CH);
    for(let i=0;i<46;i++){ const x=r()*CW,y=r()*CH,rr=80+r()*260,gr=g.createRadialGradient(x,y,0,x,y,rr);
      gr.addColorStop(0,r()<.5?`rgba(255,244,196,${.05+r()*.04})`:`rgba(186,146,40,${.035+r()*.03})`); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x-rr,y-rr,rr*2,rr*2); }
    for(let i=0;i<14000;i++){ const x=r()*CW,y=r()*CH,l=r()<.55; g.fillStyle=l?`rgba(255,250,222,${.12+r()*.14})`:`rgba(120,86,18,${.05+r()*.08})`; g.fillRect(x,y,1+r()*2.4,.8+r()*1.1); }
    for(let y=TOP;y<CH-6;y+=RULE){ g.fillStyle="rgba(60,90,128,.42)"; g.fillRect(0,y-1.1,CW,2.2); }
    g.fillStyle="rgba(204,50,38,.56)"; g.fillRect(MARGIN-5,0,2.3,CH); g.fillRect(MARGIN+3,0,2.3,CH);
    const gt=g.createLinearGradient(0,0,0,46); gt.addColorStop(0,"rgba(110,70,0,.18)"); gt.addColorStop(1,"rgba(110,70,0,0)"); g.fillStyle=gt; g.fillRect(0,0,CW,46);
    return c; })();

  const INK="#101c3d", RED="#b3402c";
  const FONT=px=>`600 ${px}px Caveat, "Segoe Print", "Bradley Hand", cursive`;
  // a line of handwriting: clean, sharp, resting naturally on the rule
  function hand(g,text,x,y,px,{color=INK,alpha=.98,align="left",seed=text}={}){
    const r=rng(hash(seed)); g.save(); g.font=FONT(px); g.fillStyle=color; g.globalAlpha=alpha; g.textAlign=align;
    g.translate(x+(r()-.5)*1.8,y+(r()-.5)*1.2); g.rotate((r()-.5)*.005); g.fillText(text,0,0);
    const w=g.measureText(text).width; g.restore(); return w; }
  function fit(g,text,px,maxW){ g.font=FONT(px); const w=g.measureText(text).width; return w>maxW?Math.floor(px*maxW/w):px; }
  function wrap(g,text,px,maxW){ g.font=FONT(px); const out=[]; let line="";
    for(const word of text.split(/\s+/)){ const t=line?line+" "+word:word; if(g.measureText(t).width>maxW&&line){ out.push(line); line=word; } else line=t; }
    if(line) out.push(line); return out; }
  function stroke(g,pts,{color=RED,w=3.6,alpha=.8}={}){ g.save(); g.strokeStyle=color; g.globalAlpha=alpha; g.lineWidth=w; g.lineCap=g.lineJoin="round";
    g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.restore(); }
  function underline(g,xa,xb,y,opt={}){ const r=rng(opt.seed||hash(xa+","+y)), n=Math.max(2,Math.round((xb-xa)/70)), pts=[];
    for(let i=0;i<=n;i++) pts.push([xa+(xb-xa)*i/n,y+(r()-.5)*3.6+(i/n-.5)*(opt.slope||0)]); stroke(g,pts,opt); }
  function ring(g,cx,cy,rx,ry,seed){ const r=rng(seed), a0=-2.3+r()*.5, pts=[];
    for(let k=0;k<=54;k++){ const a=a0+k/54*Math.PI*2*1.1, j=1+(r()-.5)*.035+k/54*.08; pts.push([cx+Math.cos(a)*rx*j,cy+Math.sin(a)*ry*j]); }
    stroke(g,pts,{w:4,alpha:.85}); }
  function arrow(g,x,y,s){ stroke(g,[[x,y],[x+s,y-s]],{color:INK,w:4.2,alpha:.9}); stroke(g,[[x+s*.3,y-s],[x+s,y-s],[x+s,y-s*.7]],{color:INK,w:4.2,alpha:.9}); }
  // a highlighter's stroke behind a row, with ragged ends
  function marker(g,xa,xb,y,h){ const r=rng(hash(xa+":"+y)); g.save(); g.fillStyle="rgba(255,138,70,.5)"; g.beginPath();
    g.moveTo(xa+r()*6,y-h+r()*5); g.lineTo(xb,y-h-2+r()*5); g.lineTo(xb+8,y-h*.4); g.lineTo(xb-2,y+h*.22+r()*4); g.lineTo(xa,y+h*.25-r()*4); g.closePath(); g.fill(); g.restore(); }
  const pad2=n=>String(n).padStart(2,"0");

  // Sizes, in canvas pixels: the sheet is ruled 1.1 cm apart (wide ruling, so the notes read from the room), the handwriting
  // about one rule tall.
  const SZ={title:146,status:62,name:132,nameY:66,num:60,body:76,head:72,row:74,rowY:60,rowN:58};
  let regions={rows:[],link:null}, hoverRow=-1, hoverLink=false, focusRow=-1, fontsOk=false, drawnKey="";
  const STATUS={playing:"now playing",loading:"loading…",stopped:"stopped",ejecting:"ejecting…"};
  function inkSheet(){
    const c=ctx.content(), g=inkCv.getContext("2d"); g.clearRect(0,0,CW,CH);
    const rows=[]; let link=null;
    const base=k=>TOP+k*RULE-11;   // the text of line k sits just on its rule
    // in the unruled top: the page's name, underlined twice in red, and what the VCR is doing
    const tw=hand(g,"Work",LEFT-6,TOP-50,SZ.title,{seed:"title"});
    underline(g,LEFT-12,LEFT+tw+14,TOP-28,{seed:3,slope:-3}); underline(g,LEFT-2,LEFT+tw-2,TOP-15,{seed:4,w:3,alpha:.6,slope:-2});
    const cur=c.tape>=0?c.tapes[c.tape]:null;
    if(cur) hand(g,`tape ${pad2(c.tape+1)} · ${STATUS[c.st]||"in the VCR"}`,RIGHT,TOP-58,SZ.status,{align:"right",alpha:.8,seed:"st"+c.tape+c.st});
    let k=1;
    if(cur){
      // its number in the margin, circled in red; its name large, its years at the end of the line
      const yb=base(k+1), yw=hand(g,cur.y,RIGHT,yb,SZ.nameY,{align:"right",alpha:.82,seed:"y"+cur.y});
      hand(g,cur.t,LEFT,yb-2,fit(g,cur.t,SZ.name,RIGHT-LEFT-yw-40),{seed:"n"+cur.t});
      hand(g,pad2(c.tape+1),MARGIN-18,yb-8,SZ.num,{align:"right",alpha:.8,seed:"#"+c.tape});
      ring(g,MARGIN-52,yb-28,46,38,hash("ring"+c.tape));
      k+=2;
      for(const line of wrap(g,cur.d,SZ.body,RIGHT-LEFT)){ hand(g,line,LEFT,base(k),SZ.body,{seed:line}); k++; }
      const l=cur.links&&cur.links[0];
      if(l){ const y=base(k), w=hand(g,l[0],LEFT,y,SZ.body,{seed:"l"+l[0]});
        arrow(g,LEFT+w+18,y-8,26);
        underline(g,LEFT-4,LEFT+w+8,y+10,{seed:hash(l[0]),w:hoverLink?5:3.4,alpha:hoverLink?.95:.75});
        link={x0:LEFT-20,x1:LEFT+w+70,y0:y-RULE+8,y1:y+20,url:l[1],text:l[0]}; k++; }
      k++;
    }
    // the shelf, as two lists: companies, then projects, a line apart. A row is a tape to put in. With no tape in, they start
    // right under the title (no intro text: Felix, 26 Sep 04:40Z).
    const section=(label,from,to)=>{
      const w=hand(g,label,LEFT,base(k),SZ.head,{color:RED,alpha:.88,seed:"s"+label}); underline(g,LEFT-2,LEFT+w+4,base(k)+11,{seed:hash(label),w:3,alpha:.6}); k++;
      for(let i=from;i<to;i++){ const t=c.tapes[i], y=base(k);
        if(i===hoverRow||i===focusRow){ g.font=FONT(SZ.row); marker(g,LEFT-16,Math.min(RIGHT+10,LEFT+g.measureText(t.t).width+34),y,SZ.row*.62); }
        hand(g,pad2(i+1),MARGIN-18,y,SZ.rowN,{align:"right",alpha:.55,seed:"r#"+i});
        const nw=hand(g,t.t,LEFT,y,SZ.row,{seed:"r"+t.t});
        hand(g,t.y,RIGHT,y,SZ.rowY,{align:"right",alpha:.7,seed:"ry"+t.y});
        if(i===c.tape){ ring(g,MARGIN-47,y-20,42,32,hash("r"+i)); underline(g,LEFT-4,LEFT+nw+8,y+11,{seed:hash("u"+i),w:3.2,alpha:.7}); }
        rows.push({i,x0:MARGIN-100,x1:RIGHT+30,y0:y-RULE+15,y1:y+16}); k++; }
    };
    const exp = c.exp ?? 2, edu = c.edu ?? 2;
    section("Experience", 0, exp); k++;
    section("Education", exp, exp + edu); k++;
    section("Projects", exp + edu, c.tapes.length);
    const s=cv.getContext("2d"); s.globalCompositeOperation="source-over"; s.drawImage(paperCv,0,0);
    if(fontsOk||!ctx.fonts){ s.globalCompositeOperation="multiply"; s.drawImage(inkCv,0,0); s.globalCompositeOperation="source-over"; }
    regions={rows,link}; tex.needsUpdate=true;
  }
  const key=()=>{ const c=ctx.content(); return [c.tape,c.st,hoverRow,hoverLink,focusRow,fontsOk].join("|"); };
  function redraw(force){ const k=key(); if(!force&&k===drawnKey) return; drawnKey=k; inkSheet(); }
  inkSheet();
  if(ctx.fonts) ctx.fonts.then(()=>{ fontsOk=true; redraw(true); });
  if(document.fonts) document.fonts.addEventListener("loadingdone",()=>{ fontsOk=true; redraw(true); });

  // ---- materials: the pad's own (its bake included) for the sides, and a copy of it with the canvas for the sheet. While the
  // pad floats, the sheet keeps at least part of the lamps' light, so the notes stay readable with the desk lamp or the floor
  // lamp off: the bake's light as the page first reads it ("vec3 ia=...", both lamps on) is kept before the page dims it for
  // the lamps, and a share of it (FLOOR) is the least the sheet gets, just before the TV's light is added ("vec3 ib=...").
  // lit: whether that took (null until the sheet's shader is built); if the page's bake shader moves on, it says so.
  const src=pad.material, LIFT={value:0}, FLOOR={value:.45}; let lit=null;
  const own=m=>{ const c=m.clone(); c.onBeforeCompile=m.onBeforeCompile; c.customProgramCacheKey=m.customProgramCacheKey; c.side=THREE.FrontSide; return c; };
  const sideMat=own(src);
  const sheetMat=own(src);
  Object.assign(sheetMat,{map:tex,normalMap:null,roughnessMap:null,metalnessMap:null,aoMap:null,roughness:.88,metalness:0});
  sheetMat.color.set("#ffffff");
  sheetMat.onBeforeCompile=(sh,r)=>{ src.onBeforeCompile&&src.onBeforeCompile(sh,r); sh.uniforms.padLift=LIFT; sh.uniforms.padFloor=FLOOR;
    const f=sh.fragmentShader, a=/vec3 ia=[^;]*;/, b="vec3 ib=pow(";
    lit=a.test(f)&&f.indexOf(b)>f.search(a);
    if(lit) sh.fragmentShader="uniform float padLift,padFloor;\n"+f.replace(a,m=>m+" vec3 iaOn=ia;").replace(b,"ia=mix(ia,max(ia,iaOn*padFloor),padLift);\n        "+b);
    else console.warn("notepad: the page's bake shader has changed, so the floating sheet has no light of its own with the lamps off"); };
  sheetMat.customProgramCacheKey=()=>"padsheet";
  pad.material=[sheetMat,sideMat];
  pad.castShadow=pad.receiveShadow=false;
  ctx.interact.set(pad,{kind:"notepad",label:"NOTEPAD · WORK"});

  // ---- where it floats: upright in front of the camera, on the right of the picture, as tall as fits between the page's top bar
  // and its buttons; leaning back a little and turned a little toward you, the way you'd hold a pad to read it
  function size(){ const W=innerWidth, H=innerHeight;
    if(window.__touch?.on){ const P=H>W, w=Math.min(W-28,(H-(P?96:36))*PW/PH,560), h=w*PH/PW; return {w,h,cx:W/2,cy:H/2+(P?22:4)}; }   // a phone: the middle, as big as fits
    const h=Math.max(260,Math.min(H-160,H*.8,820)), w=h*PW/PH; return {w,h,cx:W-46-w/2,cy:H/2+14}; }
  const BASE=new Q4().setFromAxisAngle(new V3(1,0,0),Math.PI/2);   // the sheet facing the camera, its top up
  const _n=new V3(), _d=new V3(), _f=new V3(), _u=new V3(), _r=new V3(), _q=new Q4(), _e=new THREE.Euler();
  function floatPose(T,outC,outQ){
    const cam=ctx.view(); cam.updateMatrixWorld();
    const s=size(), W=innerWidth, H=innerHeight, tv=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
    const d=PH*H/(2*tv*s.h);   // the distance at which the sheet stands s.h pixels tall
    _n.set(s.cx/W*2-1,-(s.cy/H*2-1),.5).unproject(cam); _d.subVectors(_n,cam.position).normalize();
    _f.set(0,0,-1).applyQuaternion(cam.quaternion); _u.set(0,1,0).applyQuaternion(cam.quaternion); _r.set(1,0,0).applyQuaternion(cam.quaternion);
    outC.copy(cam.position).addScaledVector(_d,d/_d.dot(_f));
    const side=Math.atan2(_d.dot(_r),_d.dot(_f));   // how far right of the middle it stands, as seen from the eye
    const bob=ctx.reduce?0:1;
    outC.addScaledVector(_u,Math.sin(T*.8)*.0012*bob).addScaledVector(_r,Math.sin(T*.53+1)*.0008*bob);
    // (turned only a touch toward the eye: out at the side of a 32 degree lens, a sheet turned to face you stretches toward its near edge)
    _e.set(THREE.MathUtils.degToRad(-4)+Math.sin(T*.61)*.005*bob,-side*.12,THREE.MathUtils.degToRad(.8)+Math.sin(T*.43+2)*.004*bob,"ZYX");
    outQ.copy(cam.quaternion).multiply(_q.setFromEuler(_e)).multiply(BASE);
  }
  const restC=CENTER.clone().applyQuaternion(restQ).add(restP);
  function place(c,q){ pad.quaternion.copy(q); pad.position.copy(c).sub(_n.copy(CENTER).applyQuaternion(q)); }

  // ---- lifting and setting down: the pad rises straight off the desk, turns to you as it comes, and settles in front of the
  // camera; going back, it turns flat on the way and drops the last few centimetres onto its spot
  let mode="down", u=0; const fromC=new V3(), fromQ=new Q4(), fc=new V3(), fq=new Q4(), p1=new V3(), p2=new V3();
  const UP=.95, DOWN=.72;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, win=(a,b,x)=>x<=a?0:x>=b?1:.5-.5*Math.cos(Math.PI*(x-a)/(b-a));
  const bez=(o,a,b,c,d,t)=>{ const s=1-t; return o.set(0,0,0).addScaledVector(a,s*s*s).addScaledVector(b,3*s*s*t).addScaledVector(c,3*s*t*t).addScaledVector(d,t*t*t); };
  const curC=()=>_u.copy(CENTER).applyQuaternion(pad.quaternion).add(pad.position);
  function lift(instant){ if(mode==="up"||mode==="rising") return; fromC.copy(curC()); fromQ.copy(pad.quaternion);
    if(instant||ctx.reduce){ mode="up"; u=1; return; } mode="rising"; u=0; sound("lift"); }
  function lower(instant){ if(mode==="down"||mode==="falling") return; fromC.copy(curC()); fromQ.copy(pad.quaternion);
    if(instant||ctx.reduce){ mode="down"; u=1; place(restC,restQ); setFloat(false); settle(); return; } mode="falling"; u=0; sound("lower"); }
  // floating, it draws over the room (its depth test always passes, its own back faces culled): nothing that stands between
  // the eye and the pad may cut into it
  let floating=null;
  function setFloat(f){ if(f===floating) return; floating=f;
    for(const m of pad.material) m.depthFunc=f?THREE.AlwaysDepth:THREE.LessEqualDepth;
    pad.renderOrder=f?20:0; }
  setFloat(false);
  // its shadow on the desk thins and spreads as it leaves; off the desk the sheet keeps some of the lamp's light (LIFT)
  function settle(){ const h=Math.max(0,curC().y-restC.y); LIFT.value=Math.min(1,h/.15);
    padShadow.material.opacity=.5*Math.max(0,1-h/.09); padShadow.scale.setScalar(1+Math.min(h,.1)*2.2); }
  function frame(dt,T){
    if(mode==="down") return;
    floatPose(T,fc,fq);
    if(mode==="up"){ place(fc,fq); setFloat(true); }
    else if(mode==="rising"){ u=Math.min(1,u+dt/UP);
      const e=ease(u); p1.copy(fromC).y+=.16; p2.copy(fc).addScaledVector(_f,.12);
      place(bez(_d,fromC,p1,p2,fc,e),_q.slerpQuaternions(fromQ,fq,win(.16,.86,u))); setFloat(u>.22);
      if(u>=1) mode="up"; }
    else if(mode==="falling"){ u=Math.min(1,u+dt/DOWN);
      const e=ease(u); p1.copy(fromC).addScaledVector(_f,.1); p2.copy(restC).y+=.15;
      place(bez(_d,fromC,p1,p2,restC,e),_q.slerpQuaternions(fromQ,restQ,win(0,.8,u))); setFloat(u<.72);
      if(u>=1){ mode="down"; place(restC,restQ); setFloat(false); sound("land"); } }
    settle();
  }

  // ---- paper sounds: a quick rustle as it's picked up, a soft pat as it lands on the desk
  let noise=null;
  function sound(kind){
    const a=ctx.audio&&ctx.audio(); if(!a) return; const ac=a.ctx, t=ac.currentTime+.01;
    if(!noise){ noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const burst=(dt,f,q,amp,att,dur,type="bandpass")=>{ const s=ac.createBufferSource(), fl=ac.createBiquadFilter(), g=ac.createGain();
      s.buffer=noise; fl.type=type; fl.frequency.value=f; fl.Q.value=q; g.gain.setValueAtTime(.0001,t+dt); g.gain.exponentialRampToValueAtTime(amp,t+dt+att); g.gain.exponentialRampToValueAtTime(.0001,t+dt+att+dur);
      s.connect(fl).connect(g).connect(a.out); s.start(t+dt,Math.random()*.5); s.stop(t+dt+att+dur+.05); };
    if(kind==="lift"){ burst(0,2600,.8,.09,.03,.16); burst(.05,5200,1.2,.05,.02,.22); burst(.1,1400,.7,.05,.06,.3); }
    else if(kind==="lower"){ burst(0,3400,.9,.06,.05,.24); }
    else if(kind==="land"){ burst(0,700,1.4,.22,.004,.07,"lowpass"); burst(0,2400,1.5,.07,.002,.05); }
  }

  // ---- the pointer on the floating sheet: a tape's row, the link, or just paper
  const ray=new THREE.Raycaster(), ptr=new THREE.Vector2();
  function at(x,y){
    ptr.set(x/innerWidth*2-1,-(y/innerHeight)*2+1); ray.setFromCamera(ptr,ctx.view());
    const h=ray.intersectObject(pad,false)[0]; if(!h) return null;
    if(!h.face||h.face.materialIndex!==0||!h.uv) return {kind:"paper"};
    const px=h.uv.x*CW, py=h.uv.y*CH, L=regions.link;
    if(L&&px>=L.x0&&px<=L.x1&&py>=L.y0&&py<=L.y1) return {kind:"link",url:L.url,text:L.text};
    const r=regions.rows.find(r=>px>=r.x0&&px<=r.x1&&py>=r.y0&&py<=r.y1);
    return r?{kind:"row",i:r.i}:{kind:"paper"};
  }
  function tip(x,y){
    const up=mode==="up"; const h=up?at(x,y):null; const row=h&&h.kind==="row"?h.i:-1, lk=!!h&&h.kind==="link";
    if(row!==hoverRow||lk!==hoverLink){ hoverRow=row; hoverLink=lk; redraw(); }
    if(!up) return "NOTEPAD · WORK";
    const c=ctx.content();
    if(lk) return "OPEN "+h.text.toUpperCase()+" ↗";
    if(row>=0) return row===c.tape?(c.st==="playing"||c.st==="loading"?"NOW PLAYING":"PLAY"):"PLAY · "+c.tapes[row].t.toUpperCase();
    return "PUT IT DOWN";
  }
  function leave(){ if(hoverRow>=0||hoverLink){ hoverRow=-1; hoverLink=false; redraw(); } }
  function focus(i){ focusRow=i; redraw(); }

  // where a point of the sheet (canvas pixels) is on the screen, for tests
  function toScreen(px,py){ const v=new V3(x0+px/CW*PW,yTop,z0+py/CH*PH).applyMatrix4(pad.matrixWorld).project(ctx.view());
    return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}; }

  return {mesh:pad,restBox,lift,lower,frame,redraw,at,tip,leave,focus,toScreen,
    get up(){ return mode==="up"||mode==="rising"; }, get busy(){ return mode==="rising"||mode==="falling"; }, get mode(){ return mode; }, get lit(){ return lit; },
    width(){ return size().w; }, size, get regions(){ return regions; }, canvas:cv};
}
