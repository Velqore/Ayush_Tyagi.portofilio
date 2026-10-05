// The credits are typed on the open card of the card file behind the desk lamp (Felix, 26 Sep 16:24Z: "there is a little stack
// of index cards behind the small desk lamp. Credits should be on that card and it should float up like the work notepad").
// A click on the file, or on CREDITS, pulls that card up out of the file and floats it in front of the camera. A title, an
// author or a licence on it opens in a new tab; a click anywhere else slides the card back into its place.
//
// createCredits(THREE, ctx) takes the loaded room and returns the card's controller (null if the room has no card file):
//   ctx.scene, ctx.root   the room (the file is gear_rolodex: a mesh per material, the open card's parts among them)
//   ctx.interact          the page's pick map: the file joins it as {kind:"rolodex"} (it never moves, so the page may still
//                         draw it joined), the card as {kind:"credits"}
//   ctx.view()            the camera the room is drawn with, as it is this frame (the card floats in front of it)
//   ctx.content()         {credits:[[title,author,authorUrl,url,ccVersion]], ccBy:{version:url}, cc0:[[author,soundId]], fs,
//                         props:[text,url]}: the page's credits, as its HTML sheet lists them (the links come in the sheet's order)
//   ctx.audio()           {ctx, out} while the room has sound, else null
//   ctx.reduce            prefers-reduced-motion: no flight, no bob
//   ctx.anisotropy        renderer.capabilities.getMaxAnisotropy()
// The controller: lift(instant), lower(instant), up (floating or on its way up), busy (moving), mode, frame(dt, t) once a frame
// after the view is final, at(x, y) and tip(x, y) for the pointer (client pixels), leave(), focus(i) for the link the keyboard is
// on (i in the sheet's order, -1 for none), toScreen(px, py), width(), regions, canvas, mesh, cut (what came out of the file).
export function createCredits(THREE, ctx){
  const V3=THREE.Vector3, Q4=THREE.Quaternion, M4=THREE.Matrix4;
  const {scene, root}=ctx;
  const file=root.getObjectByName("gear_rolodex");
  if(!file) return null;
  scene.updateMatrixWorld(true);
  const parts=[]; file.traverse(o=>{ const g=o.geometry; if(o.isMesh&&g&&g.attributes.position&&g.attributes.normal&&!Array.isArray(o.material)) parts.push(o); });
  if(!parts.length) return null;

  // ---- the open card, found in the file's own frame. Its front is the big face that looks most straight out at the room: the
  // other cards lean forward or back, parted at it. Every triangle in a thin slab on that face, inside its outline or in the tab
  // above it, belongs to it: the card itself, its tab, and the contact written on it (which the credits replace)
  const toFile=new M4().copy(file.matrixWorld).invert();
  const L=parts.map(o=>{ const m=new M4().multiplyMatrices(toFile,o.matrixWorld), nm=new THREE.Matrix3().getNormalMatrix(m), g=o.geometry, pa=g.attributes.position, na=g.attributes.normal;
    const p=[], n=[]; for(let i=0;i<pa.count;i++){ p.push(new V3().fromBufferAttribute(pa,i).applyMatrix4(m)); n.push(new V3().fromBufferAttribute(na,i).applyMatrix3(nm).normalize()); }
    return {o,p,n,ix:g.index?Array.from(g.index.array):[...Array(pa.count).keys()]}; });
  const e1=new V3(), e2=new V3(), tn=new V3();
  const triN=(l,t,out)=>out.copy(l.n[l.ix[t]]).add(l.n[l.ix[t+1]]).add(l.n[l.ix[t+2]]).normalize();
  const triC=(l,t)=>new V3().copy(l.p[l.ix[t]]).add(l.p[l.ix[t+1]]).add(l.p[l.ix[t+2]]).divideScalar(3);
  let best=null;
  L.forEach((l,li)=>{ for(let t=0;t+2<l.ix.length;t+=3){
    const a=l.p[l.ix[t]], area=e1.subVectors(l.p[l.ix[t+1]],a).cross(e2.subVectors(l.p[l.ix[t+2]],a)).length()/2;
    if(area<.001) continue;   // (a card's face is two triangles of 28 cm²)
    triN(l,t,tn); if(Math.abs(tn.x)>.2) continue;
    if(!best||tn.z>best.nz) best={li,nz:tn.z,n:tn.clone(),p:triC(l,t)}; } });
  if(!best||best.nz<.9) return null;
  const n=best.n, p0=best.p, right=new V3(1,0,0).addScaledVector(n,-n.x).normalize(), up=new V3().crossVectors(n,right);
  const lc=L[best.li], face=[];   // its front's two triangles
  for(let t=0;t+2<lc.ix.length;t+=3) if(triN(lc,t,tn).dot(n)>.999&&Math.abs(triC(lc,t).sub(p0).dot(n))<1e-4) face.push(t);
  const _v=new V3(), X=v=>_v.subVectors(v,p0).dot(right), Y=v=>_v.subVectors(v,p0).dot(up), D=v=>_v.subVectors(v,p0).dot(n);
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const t of face) for(let k=0;k<3;k++){ const v=lc.p[lc.ix[t+k]]; x0=Math.min(x0,X(v)); x1=Math.max(x1,X(v)); y0=Math.min(y0,Y(v)); y1=Math.max(y1,Y(v)); }
  const CWm=x1-x0, CHm=y1-y0;   // 10 by 5.7 cm
  if(face.length<2||CWm<.05||CHm<.03) return null;
  // the slab: the card is .35 mm thick behind its front, the writing lies just in front of it; the next card back is ~.7 mm off
  // at the drum and further out, so the slab stays thinner than that
  const inSlab=v=>{ const d=D(v), x=X(v), y=Y(v); return d>-6e-4&&d<3e-4&&x>x0-1e-3&&x<x1+1e-3&&y>y0-2e-4&&y<y1+.008; };
  const card=[], tab=[], cut={card:0,tab:0,writing:0};
  let tabPart=null;
  L.forEach(l=>{ const keep=[];
    for(let t=0;t+2<l.ix.length;t+=3){
      const a=l.p[l.ix[t]], b=l.p[l.ix[t+1]], c=l.p[l.ix[t+2]];
      if(!(inSlab(a)&&inSlab(b)&&inSlab(c))){ keep.push(l.ix[t],l.ix[t+1],l.ix[t+2]); continue; }
      if(l===lc){ card.push([l,t]); cut.card++; }
      else if(Math.min(Y(a),Y(b),Y(c))>y1-4e-4){ tab.push([l,t]); tabPart=tabPart||l; cut.tab++; }
      else cut.writing++;   // the old contact's ink and its red rule: the credits take their place
    }
    if(keep.length===l.ix.length) return;
    const g=l.o.geometry.clone(); g.setIndex(keep); l.o.geometry=g; if(!keep.length) l.o.visible=false; });
  if(cut.card<2) return null;

  // ---- the card as a mesh of its own, in a frame of its own: origin in the middle of its front, x to the right, y up, z out of
  // the front. Its triangles keep the file's light-map UVs (the bake lights it where it stands); the front gets UVs for the
  // canvas the credits are typed on. The front is drawn last, so while the card floats over the room its edges can't cover it
  const C=new V3().copy(p0).addScaledVector(right,(x0+x1)/2).addScaledVector(up,(y0+y1)/2);
  const basis=new M4().makeBasis(right,up,n).setPosition(C);
  const pos=[], nrm=[], uv=[], uv1=[], groups=[[],[],[]];   // material 0: the front, 1: the card's stock, 2: the tab
  const frontSet=new Set(face);
  const addTri=([l,t],gi,front)=>{
    const g=l.o.geometry, U1=g.attributes.uv1||g.attributes.uv, vs=[0,1,2].map(k=>l.ix[t+k]);
    const q=vs.map(i=>new V3().subVectors(l.p[i],C)), qq=q.map(v=>new V3(v.dot(right),v.dot(up),v.dot(n)));
    const nn=vs.map(i=>{ const w=l.n[i]; return new V3(w.dot(right),w.dot(up),w.dot(n)); });
    // wound to face the way its normals point, so front faces alone draw the card
    const fn=new V3().subVectors(qq[1],qq[0]).cross(new V3().subVectors(qq[2],qq[0])), avg=nn[0].clone().add(nn[1]).add(nn[2]);
    const order=fn.dot(avg)<0?[0,2,1]:[0,1,2], base=pos.length/3;
    for(const k of order){ const v=qq[k]; pos.push(v.x,v.y,v.z); nrm.push(nn[k].x,nn[k].y,nn[k].z);
      uv.push(front?(v.x+CWm/2)/CWm:0,front?(CHm/2-v.y)/CHm:0); uv1.push(U1?U1.getX(vs[k]):0,U1?U1.getY(vs[k]):0); }
    groups[gi].push(base,base+1,base+2); };
  for(const ct of card) addTri(ct,frontSet.has(ct[1])&&ct[0]===lc?0:1,frontSet.has(ct[1])&&ct[0]===lc);
  for(const tt of tab) addTri(tt,2,false);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute("normal",new THREE.Float32BufferAttribute(nrm,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); geo.setAttribute("uv1",new THREE.Float32BufferAttribute(uv1,2));
  geo.setIndex([...groups[1],...groups[2],...groups[0]]);
  geo.addGroup(0,groups[1].length,1); geo.addGroup(groups[1].length,groups[2].length,2); geo.addGroup(groups[1].length+groups[2].length,groups[0].length,0);
  geo.computeBoundingBox(); geo.computeBoundingSphere();

  // ---- the card stock, the rules and the typing, drawn into a canvas the size of the card
  const CW=1600, CH=Math.round(CW*CHm/CWm), LEFT=104, RIGHT=CW-78, HEAD=112, RED_Y=152, LH=66, FIRST=RED_Y+62;
  const SLOTS=Math.max(1,Math.floor((CH-44-FIRST)/LH)+1), base=k=>FIRST+k*LH;
  const cv=document.createElement("canvas"); cv.width=CW; cv.height=CH;
  const inkCv=document.createElement("canvas"); inkCv.width=CW; inkCv.height=CH;
  const tex=new THREE.CanvasTexture(cv); tex.flipY=false; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=ctx.anisotropy||8;
  const rng=seed=>()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6D2B79F5|0,((seed^seed>>>7)>>>0)/4294967296));
  const hash=s=>{ let h=2166136261; for(const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h>>>0; };
  // cream card stock with its fibres and a faint mottle, printed with pale blue rules and a red one under the heading
  const paperCv=(()=>{ const c=document.createElement("canvas"); c.width=CW; c.height=CH; const g=c.getContext("2d"), r=rng(11);
    g.fillStyle="#f4eedf"; g.fillRect(0,0,CW,CH);
    for(let i=0;i<34;i++){ const x=r()*CW,y=r()*CH,rr=70+r()*220,gr=g.createRadialGradient(x,y,0,x,y,rr);
      gr.addColorStop(0,r()<.5?`rgba(255,252,240,${.05+r()*.05})`:`rgba(170,150,110,${.03+r()*.03})`); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x-rr,y-rr,rr*2,rr*2); }
    for(let i=0;i<9000;i++){ const x=r()*CW,y=r()*CH,l=r()<.6; g.fillStyle=l?`rgba(255,255,248,${.14+r()*.14})`:`rgba(110,96,70,${.04+r()*.07})`; g.fillRect(x,y,1+r()*2.2,.8+r()*.9); }
    for(let k=0;k<SLOTS;k++){ g.fillStyle="rgba(78,118,178,.34)"; g.fillRect(0,base(k)+13,CW,2); }
    g.fillStyle="rgba(206,52,42,.66)"; g.fillRect(0,RED_Y-1.5,CW,3);
    const ge=g.createLinearGradient(0,0,0,CH); ge.addColorStop(0,"rgba(120,96,60,.07)"); ge.addColorStop(.06,"rgba(120,96,60,0)"); ge.addColorStop(.94,"rgba(120,96,60,0)"); ge.addColorStop(1,"rgba(120,96,60,.08)");
    g.fillStyle=ge; g.fillRect(0,0,CW,CH);
    return c; })();

  const INK="#1f1d1a", RED="#b3302a";
  const FONT=(px,w=400)=>`${w} ${px}px "Courier Prime", "Courier New", monospace`;
  // typed: each letter struck on its own, never quite on the line, the ribbon's ink a little uneven, and a faint second strike
  // where the ink spread into the card
  function type(g,text,x,y,px,{color=INK,weight=400,seed=text}={}){
    const r=rng(hash(seed+"@"+x+","+y)); g.save(); g.font=FONT(px,weight); g.fillStyle=color; let cx=x;
    for(const ch of text){ const w=g.measureText(ch).width;
      if(ch!==" "){ const a=.74+r()*.22, dx=(r()-.5)*.9, dy=(r()-.5)*1.6;
        g.globalAlpha=a; g.fillText(ch,cx+dx,y+dy); g.globalAlpha=a*.3; g.fillText(ch,cx+dx+.7,y+dy+.4); }
      cx+=w; }
    g.restore(); return cx-x; }
  // a highlighter's stroke behind a link the pointer or the keyboard is on, with ragged ends
  function marker(g,xa,xb,y,h){ const r=rng(hash(xa+":"+y)); g.save(); g.fillStyle="rgba(255,222,64,.58)"; g.beginPath();
    g.moveTo(xa-8+r()*5,y-h+r()*4); g.lineTo(xb+4,y-h-2+r()*4); g.lineTo(xb+10,y-h*.45); g.lineTo(xb+2,y+h*.2+r()*4); g.lineTo(xa-6,y+h*.24-r()*4); g.closePath(); g.fill(); g.restore(); }

  // what goes on the card: the licensed work first, a line each (its title underlined, as a typist would), then the thanks for the
  // CC0 work. Every title, author and licence with an address is a link, numbered in the order the HTML sheet lists them.
  function paragraphs(){
    const c=ctx.content(), out=[], links=[];
    const L2=(text,url,under)=>{ if(!url) return {text,under}; links.push({url,text}); return {text,under,link:links.length-1}; };
    for(const [t,a,au,u,v] of c.credits||[]) out.push([L2(t,u,true),{text:" · "},L2(a,au),{text:" · "},L2("CC BY "+v,c.ccBy&&c.ccBy[v]),{text:", adapted"}]);
    const cc0=c.cc0||[];
    if(cc0.length||c.props){ const p=[{text:"CC0, with thanks: sounds by "}];
      cc0.forEach(([a,id],i)=>{ p.push(L2(a,`${c.fs}${a}/sounds/${id}/`)); if(i<cc0.length-1) p.push({text:", "}); });
      if(c.props) p.push({text:(cc0.length?"; ":"")+"furniture and props from "},L2(c.props[0],c.props[1]),{text:"."});
      out.push(null,p); }   // (null: a blank line before the thanks, if there's room)
    return {out,links}; }
  // words onto lines of at most `max` letters; a line that runs on is indented two
  function wrap(par,max){
    const lines=[]; let line=[], n=0;
    const push=(text,sp)=>{ const last=line[line.length-1]; if(last&&last.link===sp.link&&last.under===sp.under) last.text+=text; else line.push({...sp,text}); n+=text.length; };
    for(const sp of par) for(const w of sp.text.split(/(?<= )/)){
      if(n+w.trimEnd().length>max&&n>2&&!/^[,.;:·]/.test(w)){ lines.push(line); line=[]; n=0; push("  ",{}); }   // (never a line starting with a comma)
      push(w,sp); }
    if(line.length) lines.push(line);
    return lines; }
  let lay=null;
  function layout(){
    const {out,links}=paragraphs(), g=inkCv.getContext("2d");
    for(let px=40;px>=26;px-=2){ g.font=FONT(px); const cw=g.measureText("M").width, max=Math.floor((RIGHT-LEFT)/cw);
      let lines=[]; for(const p of out) if(p) lines.push(...wrap(p,max)); else lines.push(null);
      if(lines.length>SLOTS) lines=lines.filter(Boolean);   // no room for the blank line
      if(lines.length<=SLOTS||px===26) return {px,cw,lines:lines.slice(0,SLOTS),links}; } }
  let regions=[], hoverLink=-1, focusLink=-1, fontsOk=false, drawnKey="";
  function draw(){
    lay=lay||layout();
    const g=inkCv.getContext("2d"); g.clearRect(0,0,CW,CH);
    const s=cv.getContext("2d"); s.globalCompositeOperation="source-over"; s.drawImage(paperCv,0,0);
    const {px,cw,lines}=lay, rs=[];
    // the regions first: a link the pointer or the keys are on gets the highlighter, on the card under the typing
    lines.forEach((line,k)=>{ if(!line) return; let col=0; const y=base(k);
      for(const sp of line){ if(sp.link!=null){ const xa=LEFT+col*cw, xb=xa+sp.text.trimEnd().length*cw;
          rs.push({i:sp.link,x0:xa-10,x1:xb+10,y0:y-px*.9,y1:y+px*.4,url:lay.links[sp.link].url,text:lay.links[sp.link].text});
          if(sp.link===hoverLink||sp.link===focusLink) marker(s,xa,xb,y-px*.28,px*.5); }
        col+=sp.text.length; } });
    type(g,"CREDITS",LEFT,HEAD,px*1.15,{color:RED,weight:700,seed:"head"});
    lines.forEach((line,k)=>{ if(!line) return; let col=0; const y=base(k);
      for(const sp of line){ const x=LEFT+col*cw; type(g,sp.text,x,y,px,{seed:k+":"+col});
        if(sp.under){ const t=sp.text.trimEnd(); type(g,"_".repeat(t.length),x,y+3,px,{seed:"u"+k+":"+col}); }
        col+=sp.text.length; } });
    if(fontsOk){ s.globalCompositeOperation="multiply"; s.drawImage(inkCv,0,0); s.globalCompositeOperation="source-over"; }
    regions=rs; tex.needsUpdate=true; }
  const key=()=>[hoverLink,focusLink,fontsOk].join("|");
  function redraw(force){ const k=key(); if(!force&&k===drawnKey) return; drawnKey=k; draw(); }
  // Courier Prime is in the page's font list but only comes in once something uses it: the typing waits for it (a card typed in
  // a fallback face and then retyped would show both), then lays out again with its real widths
  const fontLoad=Promise.all(["400 40px \"Courier Prime\"","700 46px \"Courier Prime\""].map(f=>document.fonts?document.fonts.load(f):Promise.resolve())).catch(()=>{});
  fontLoad.then(()=>{ fontsOk=true; lay=null; redraw(true); });
  setTimeout(()=>{ if(!fontsOk){ fontsOk=true; lay=null; redraw(true); } },4000);   // (fonts blocked: type it in the fallback)
  redraw(true);

  // ---- materials: the card's own stock (its bake included) for the edges and the back, the tab's, and a copy of the stock with
  // the canvas for the front. Each is the card's own, since floating changes their depth test. In the file the card has the light
  // the bake gives it there, the desk lamp's hot spot; lifted out (LIFT) it goes over to an even light of LIGHT, in the colour the
  // bake gives it: in the hot spot it glowed white and its typing washed out, and with the lamp off it would be dark
  const LIFT={value:0}, LIGHT={value:.6};
  const own=m=>{ const c=m.clone(), bake=m.onBeforeCompile, key0=m.customProgramCacheKey; c.side=THREE.FrontSide;
    c.onBeforeCompile=(sh,r)=>{ bake&&bake.call(c,sh,r); sh.uniforms.cardLift=LIFT; sh.uniforms.cardLight=LIGHT;
      const f=sh.fragmentShader, e=f.match(/vec3 e=\([^;]*;/);
      if(e) sh.fragmentShader="uniform float cardLift,cardLight;\n"+f.replace(e[0],e[0]+"\n        e=mix(e,e*(cardLight/max(dot(e,vec3(.2126,.7152,.0722)),1e-4)),cardLift);"); };
    c.customProgramCacheKey=()=>"credcard"+(key0?key0.call(m):""); return c; };
  const stockMat=own(lc.o.material), tabMat=tabPart?own(tabPart.o.material):stockMat, faceMat=own(lc.o.material);
  Object.assign(faceMat,{map:tex,normalMap:null,roughnessMap:null,metalnessMap:null,aoMap:null,clearcoat:0,roughness:.9,metalness:0});
  faceMat.color.setScalar(.8);   // (the file's card stock is greyed to .78 for the lamp's hot spot it stands in)
  const mesh=new THREE.Mesh(geo,[faceMat,stockMat,tabMat]); mesh.name="credits_card"; mesh.castShadow=mesh.receiveShadow=false;
  file.updateMatrixWorld(true);
  new M4().multiplyMatrices(file.matrixWorld,basis).decompose(mesh.position,mesh.quaternion,mesh.scale);
  scene.add(mesh); mesh.updateMatrixWorld(true);
  const restC=mesh.position.clone(), restQ=mesh.quaternion.clone(), upW=new V3(0,1,0).applyQuaternion(restQ);
  for(const l of L) if(l.o.visible) ctx.interact.set(l.o,{kind:"rolodex",label:"CREDITS"});
  ctx.interact.set(mesh,{kind:"credits",label:"CREDITS"});

  // ---- where it floats: upright in front of the camera, on the right of the picture like the notepad, big enough to read, leaning
  // back a little and turned a little toward you, the way you'd hold a card up to read it
  function size(){ const W=innerWidth, H=innerHeight; let w=Math.min(W*.5,900,(H-190)*CWm/CHm); w=Math.max(w,Math.min(400,W-80));
    return {w,h:w*CHm/CWm,cx:W-46-w/2,cy:H/2+8}; }
  const _n=new V3(), _d=new V3(), _f=new V3(), _u=new V3(), _r=new V3(), _q=new Q4(), _e=new THREE.Euler();
  function floatPose(T,outC,outQ){
    const cam=ctx.view(); cam.updateMatrixWorld();
    const s=size(), W=innerWidth, H=innerHeight, tv=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
    const d=CHm*H/(2*tv*s.h);   // the distance at which the card stands s.h pixels tall
    _n.set(s.cx/W*2-1,-(s.cy/H*2-1),.5).unproject(cam); _d.subVectors(_n,cam.position).normalize();
    _f.set(0,0,-1).applyQuaternion(cam.quaternion); _u.set(0,1,0).applyQuaternion(cam.quaternion); _r.set(1,0,0).applyQuaternion(cam.quaternion);
    outC.copy(cam.position).addScaledVector(_d,d/_d.dot(_f));
    const side=Math.atan2(_d.dot(_r),_d.dot(_f)), bob=ctx.reduce?0:1;
    outC.addScaledVector(_u,Math.sin(T*.8)*.0005*bob).addScaledVector(_r,Math.sin(T*.53+1)*.0003*bob);
    _e.set(THREE.MathUtils.degToRad(-5)+Math.sin(T*.61)*.006*bob,-side*.12,THREE.MathUtils.degToRad(-.7)+Math.sin(T*.43+2)*.004*bob,"ZYX");
    outQ.copy(cam.quaternion).multiply(_q.setFromEuler(_e));
  }

  // ---- out of the file and back: the card slides straight up out of its slot, clear of the drum, then turns to you as it comes
  // and settles in front of the camera; going back, it swings round above its slot and slides down into it
  let mode="down", u=0, slide=0; const fromC=new V3(), fromQ=new Q4(), fc=new V3(), fq=new Q4(), p1=new V3(), p2=new V3(), top=new V3(), cur=new V3();
  const UP=1.05, DOWN=.85, RISE=Math.min(.09,CHm*1.3);
  top.copy(restC).addScaledVector(upW,RISE);
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, sm=x=>x*x*(3-2*x), win=(a,b,x)=>x<=a?0:x>=b?1:.5-.5*Math.cos(Math.PI*(x-a)/(b-a));
  const bez=(o,a,b,c,d,t)=>{ const s=1-t; return o.set(0,0,0).addScaledVector(a,s*s*s).addScaledVector(b,3*s*s*t).addScaledVector(c,3*s*t*t).addScaledVector(d,t*t*t); };
  function place(c,q){ mesh.position.copy(c); mesh.quaternion.copy(q); mesh.updateMatrixWorld(); }   // (the pointer may ask before the room is drawn)
  let floating=null;
  function setFloat(f){ if(f===floating) return; floating=f;
    for(const m of mesh.material) m.depthFunc=f?THREE.AlwaysDepth:THREE.LessEqualDepth;
    mesh.renderOrder=f?21:0; }
  setFloat(false);
  function settle(){ LIFT.value=Math.min(1,mesh.position.distanceTo(restC)/.1); }
  function lift(instant){ if(mode==="up"||mode==="rising") return;
    slide=mode==="down"?.3:0; fromC.copy(mesh.position); fromQ.copy(mesh.quaternion);   // (from the desk it slides out of the slot first)
    if(instant||ctx.reduce){ mode="up"; u=1; return; } mode="rising"; u=0; sound("pull"); }
  function lower(instant){ if(mode==="down"||mode==="falling") return; fromC.copy(mesh.position); fromQ.copy(mesh.quaternion);
    if(instant||ctx.reduce){ mode="down"; u=1; place(restC,restQ); setFloat(false); settle(); return; } mode="falling"; u=0; sound("back"); }
  let held=false;   // (tests: hold a flight where it is)
  function frame(dt,T){
    if(mode==="down") return;
    if(held) dt=0;
    floatPose(T,fc,fq);
    if(mode==="up"){ place(fc,fq); setFloat(true); }
    else if(mode==="rising"){ u=Math.min(1,u+dt/UP);
      if(u<slide){ place(cur.copy(fromC).lerp(top,sm(u/slide)),restQ); setFloat(false); }
      else { const a=slide?top:fromC, e=ease((u-slide)/(1-slide));
        p1.copy(a).addScaledVector(slide?upW:_f,slide?.05:-.03); p2.copy(fc).addScaledVector(_f,.07);
        place(bez(cur,a,p1,p2,fc,e),_q.slerpQuaternions(slide?restQ:fromQ,fq,win(slide,.92,u))); setFloat(u>slide+.1); }
      if(u>=1) mode="up"; }
    else if(mode==="falling"){ u=Math.min(1,u+dt/DOWN); const b=.66;
      if(u<b){ const e=ease(u/b); p1.copy(fromC).addScaledVector(_f,.06); p2.copy(top).addScaledVector(upW,.05);
        place(bez(cur,fromC,p1,p2,top,e),_q.slerpQuaternions(fromQ,restQ,win(0,.8,u/b))); setFloat(u<b*.7); }
      else { place(cur.copy(top).lerp(restC,sm((u-b)/(1-b))),restQ); setFloat(false); }
      if(u>=1){ mode="down"; place(restC,restQ); setFloat(false); sound("seat"); } }
    settle();
  }

  // ---- card sounds: a flick as it's pulled off the drum's rails and a whisper of air as it comes, a slide and a soft tick as it
  // goes back into its slot
  let noise=null;
  function sound(kind){
    const a=ctx.audio&&ctx.audio(); if(!a) return; const ac=a.ctx, t=ac.currentTime+.01;
    if(!noise){ noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const burst=(dt,f,q,amp,att,dur,type="bandpass")=>{ const s=ac.createBufferSource(), fl=ac.createBiquadFilter(), g=ac.createGain();
      s.buffer=noise; fl.type=type; fl.frequency.value=f; fl.Q.value=q; g.gain.setValueAtTime(.0001,t+dt); g.gain.exponentialRampToValueAtTime(amp,t+dt+att); g.gain.exponentialRampToValueAtTime(.0001,t+dt+att+dur);
      s.connect(fl).connect(g).connect(a.out); s.start(t+dt,Math.random()*.5); s.stop(t+dt+att+dur+.05); };
    if(kind==="pull"){ burst(0,3800,1.1,.06,.02,.12); burst(.2,2200,2.5,.12,.002,.035); burst(.24,6000,2,.05,.002,.03); burst(.32,1600,.7,.04,.08,.28); }
    else if(kind==="back"){ burst(0,2800,.9,.05,.05,.22); }
    else if(kind==="seat"){ burst(0,3200,1.8,.07,.012,.1); burst(.1,1900,3,.13,.002,.03); burst(.1,700,1.4,.08,.003,.05,"lowpass"); }
  }

  // ---- the pointer on the floating card: a link, or just card
  const ray=new THREE.Raycaster(), ptr=new THREE.Vector2();
  function at(x,y){
    ptr.set(x/innerWidth*2-1,-(y/innerHeight)*2+1); ray.setFromCamera(ptr,ctx.view());
    const h=ray.intersectObject(mesh,false)[0]; if(!h) return null;
    if(!h.face||h.face.materialIndex!==0||!h.uv) return {kind:"card"};
    const px=h.uv.x*CW, py=h.uv.y*CH, r=regions.find(r=>px>=r.x0&&px<=r.x1&&py>=r.y0&&py<=r.y1);
    return r?{kind:"link",i:r.i,url:r.url,text:r.text}:{kind:"card"};
  }
  function tip(x,y){
    const upNow=mode==="up", h=upNow?at(x,y):null, lk=h&&h.kind==="link"?h.i:-1;
    if(lk!==hoverLink){ hoverLink=lk; redraw(); }
    if(!upNow) return mode==="rising"?"PUT IT BACK":"CREDITS";   // (on its way back, a click lifts it again)
    return lk>=0?"OPEN "+h.text.toUpperCase()+" ↗":"PUT IT BACK";
  }
  function leave(){ if(hoverLink>=0){ hoverLink=-1; redraw(); } }
  function focus(i){ focusLink=i; redraw(); }
  // where a point of the card (canvas pixels) is on the screen, for tests
  function toScreen(px,py){ const v=new V3((px/CW-.5)*CWm,(.5-py/CH)*CHm,0).applyMatrix4(mesh.matrixWorld).project(ctx.view());
    return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}; }

  return {mesh,lift,lower,frame,redraw,at,tip,leave,focus,toScreen,cut,
    get up(){ return mode==="up"||mode==="rising"; }, get busy(){ return mode==="rising"||mode==="falling"; }, get mode(){ return mode; },
    width(){ return size().w; }, size, get regions(){ return regions; }, get links(){ return lay?lay.links:[]; }, get marked(){ return {hover:hoverLink,focus:focusLink}; }, light:LIGHT, get progress(){ return u; }, set held(v){ held=!!v; }, canvas:cv};
}
