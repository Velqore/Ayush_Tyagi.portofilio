// The room on a phone (Felix, 26 Sep 17:56Z: ideas 1-4 of the mobile brainstorm). Loaded by the room page as patched by
// touch/patch.py, with its hooks (window.__touchHooks). Only acts while PHONE(): a touch-only screen with a short side
// under 540 px (or ?touch=1).
//   1. stations: a quick sideways flick steps between three fixed shots, the old PC, the desk (home) and
//      Work (the TV and its tapes); a slow drag or a pinch looks around a little, and two fingers slide the camera, on a leash; tabs at the screen's edges say where a swipe goes, and take a tap too.
//   2. the tape strip: in portrait, Work puts every tape under the TV as a row of big cassettes you swipe through.
//   3. the notepad: on a phone it floats in the middle of the screen, as big as fits (notepad.js size()); NOTEPAD lifts it.
//   4. no hover: now and then a soft glint breathes on something that answers a tap; the first tap on a thing shows its
//      label, the second (or any tap once you've used it) does it.
export default function init(H){
  const $=s=>document.querySelector(s), now=()=>performance.now();
  const T=window.__touch={get on(){ return H.PHONE(); }, stripH, gate};
  const portrait=()=>innerHeight>innerWidth;
  function stripH(){ return T.on&&portrait()&&H.state.page==="work"?STRIP_H:0; }
  const STRIP_H=176;   // the strip (104) and the row of pills under it

  const css=document.createElement("style"); css.textContent=`
#ttip{position:fixed;z-index:6;pointer-events:none;transform:translate(-50%,calc(-100% - 26px));text-align:center;font-family:var(--osd);letter-spacing:.06em;
  color:#0b0b0d;background:#efe9dc;padding:3px 10px 2px;border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,.45);transition:opacity .2s}
#ttip b{display:block;font-weight:400;font-size:21px;line-height:1}
#ttip i{display:block;font-style:normal;font-size:15px;opacity:.6;line-height:1.1}
#ttip[hidden]{display:block;opacity:0}
.glint{position:fixed;z-index:2;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;pointer-events:none;mix-blend-mode:screen;
  background:radial-gradient(circle,rgba(255,236,200,.95) 0,rgba(255,214,150,.45) 22%,rgba(255,190,120,0) 62%);animation:glint 2.2s ease-in-out forwards}
.glint:after{content:"";position:absolute;left:50%;top:50%;width:64px;height:2px;margin:-1px 0 0 -32px;background:linear-gradient(90deg,transparent,rgba(255,240,215,.8),transparent);
  box-shadow:0 0 6px rgba(255,220,170,.6);transform:rotate(-20deg)}
@keyframes glint{0%{opacity:0;transform:scale(.3)}40%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.55)}}
.edge{position:fixed;z-index:3;top:50%;transform:translateY(-50%);font-family:var(--osd);font-size:19px;letter-spacing:.06em;color:#efe9dc;
  background:rgba(14,13,19,.5);border:1px solid rgba(255,255,255,.18);padding:10px 8px 8px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.edge.l{left:0;border-left:0;border-radius:0 6px 6px 0} .edge.r{right:0;border-right:0;border-radius:6px 0 0 6px}
.edge[hidden]{display:none}
#tstrip{position:fixed;z-index:3;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));height:104px;display:flex;gap:10px;align-items:stretch;
  overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding:0 16px;scroll-padding:0 16px;scrollbar-width:none;-webkit-overflow-scrolling:touch;
  transition:opacity .25s,transform .25s}
#tstrip::-webkit-scrollbar{display:none}
#tstrip[hidden]{display:flex;opacity:0;transform:translateY(20px);pointer-events:none}
#tstrip .tp{flex:0 0 128px;scroll-snap-align:start;position:relative;border-radius:5px;padding:9px 10px 8px;display:flex;flex-direction:column;justify-content:space-between;
  font:inherit;text-align:left;border:0;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.12);-webkit-tap-highlight-color:transparent}
#tstrip .tp .n{font-family:var(--display);font-weight:800;font-size:17px;line-height:1.05;letter-spacing:-.01em;overflow-wrap:anywhere}
#tstrip .tp .y{font-family:var(--osd);font-size:17px;opacity:.75}
#tstrip .tp:before{content:"";position:absolute;left:10px;right:10px;bottom:30px;height:14px;border-radius:7px;background:rgba(0,0,0,.28)}   /* the reels' window */
#tstrip .tp.on{outline:2px solid #ffb867;outline-offset:2px}
#tstrip .tp.on .y:after{content:" ▶"}
#tstrip .grp{flex:0 0 auto;scroll-snap-align:start;align-self:center;writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--osd);font-size:17px;letter-spacing:.12em;color:#a29fae}
/* leaving Work: the hidden HTML card must not fade out from full size once body.padnote goes (Felix 22:36Z) */
body.tphone #panel[hidden]{transition:none!important}
#tnotes,#tback{display:none}
body.tp-back #tback{display:inline-block}
body.tphone.tp-back .ctl{display:flex!important}
body.tphone .ctl .hint{display:none!important}
body.tphone.padnote.paneled .ctl{display:flex!important}
body.tphone-work #tnotes{display:inline-block}
/* a calmer phone (Felix 20:28Z "the ui is a little busy"): one top row, sound as an icon up there, credits a quiet line,
   the notepad a tile in the strip; the name only on the home shot, where it introduces the room */
body.tphone .top{flex-wrap:wrap;row-gap:6px}
body.tphone .top .name{display:none}   /* no name on a phone (Felix 21:05Z) */
body.tphone nav.menu{flex:1;flex-wrap:nowrap;justify-content:space-between;gap:0}
body.tphone nav.menu a{font-size:20px;padding:2px 7px 1px}
body.tphone #sound{flex:0 0 auto;width:38px;height:38px;padding:0;margin-left:6px;border-radius:50%;font-size:0;color:transparent;position:relative;pointer-events:auto}
body.tphone #sound:before{content:"";position:absolute;inset:8px;background:#a29fae;
  -webkit-mask:var(--spk-off) center/contain no-repeat;mask:var(--spk-off) center/contain no-repeat}
body.tphone #sound[aria-pressed="true"]:before{background:#ffb867;-webkit-mask-image:var(--spk-on);mask-image:var(--spk-on)}
:root{--spk-on:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h4l5-4v14l-5-4H4z' fill='%23000'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'/%3E%3C/svg%3E");
  --spk-off:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h4l5-4v14l-5-4H4z' fill='%23000'/%3E%3Cpath d='M17 9.5l5 5M22 9.5l-5 5'/%3E%3C/svg%3E")}
body.tphone #credits{position:fixed;left:16px;bottom:calc(12px + env(safe-area-inset-bottom,0px));height:30px;display:flex;align-items:center;line-height:1;   /* centred on the pills' row (30 px tall, 12 px up; Felix 22:58Z) */
  background:none;border:0;box-shadow:none;padding:0;font-size:15px;color:#a29fae;opacity:.7}
body.tphone .ctl{bottom:calc(12px + env(safe-area-inset-bottom,0px))}
body.tphone .edge{padding:14px 5px 12px;font-size:16px;background:rgba(14,13,19,.35)}
@media (orientation:portrait){ body.tphone-work #tnotes{display:none} }
#tstrip .tp.pad{background:#f3dc72;color:#2a2418}
#tstrip .tp.pad:before{display:none}
#tstrip .tp.pad .n{font-family:"Caveat",cursive;font-weight:600;font-size:26px}
@media (orientation:landscape){ body.tphone nav.menu{flex:0 1 auto;gap:6px;justify-content:flex-start} body.tphone #sound{margin-left:auto} }
`; document.head.append(css);

  // ---- 4. labels on the first tap
  const tt=document.createElement("div"); tt.id="ttip"; tt.hidden=true; tt.innerHTML="<b></b><i>TAP AGAIN</i>"; document.body.append(tt);
  const learned=new Set(); let pend=null, ttT=0;
  const groupOf=info=>info.kind==="tape"?"tape":info.kind==="vcr"||info.kind==="btn"||info.kind==="knob"?info.kind:info.label||info.kind;
  function inHand(info){ const k=info.kind;
    return k==="screen"||k==="knob"||k==="pc"&&(H.PC.zoom||H.atPC(H.state.page))||k==="cd"&&H.cd?.near||k==="calc"&&H.calc?.up||k==="notepad"&&H.padUp()||k==="credits"; }
  function gate(hit,e){
    if(!T.on||(e.pointerType!=="touch"&&!/[?&]touch=1/.test(location.search))) return false;
    if(H.state.page==="posts") return false;   // Posts is the TV's glass up close: every tap is on purpose (Felix 21:47Z)
    const info=H.interact.get(hit); if(!info||inHand(info)) return false;
    const g=groupOf(info); if(learned.has(g)) return false;
    if(pend&&pend.g===g&&now()-pend.t<6000){ learned.add(g); pend=null; tt.hidden=true; return false; }
    pend={g,t:now()}; H.gesture();
    tt.firstChild.textContent=(info.label||info.kind).toUpperCase();
    const x=Math.min(innerWidth-90,Math.max(90,e.clientX)); tt.style.left=x+"px"; tt.style.top=Math.max(70,e.clientY)+"px"; tt.hidden=false; ttT=now();
    return true; }
  addEventListener("pointerdown",e=>{ if(!tt.hidden&&e.target!==H.canvas) tt.hidden=true; },{capture:true,passive:true});

  // ---- 1. stations
  const edgeL=document.createElement("button"), edgeR=document.createElement("button");
  edgeL.className="edge l"; edgeR.className="edge r"; edgeL.hidden=edgeR.hidden=true; document.body.append(edgeL,edgeR);
  function station(){
    if(H.state.sheet||H.zoomed||H.padUp()||H.calc?.up||H.cd?.near) return null;
    if(H.PC.zoom) return H.atPC(H.state.page)?null:"pc";   // a visit to the PC (About and Online are its pages, with the nav)
    return H.state.page==="home"?"home":H.state.page==="work"?"work":null; }
  const ORDER=["pc","home","work"], NAME={pc:"PC",home:"DESK",work:"TAPES"};
  function stepTo(s){ H.gesture(); tt.hidden=true; if(s==="pc") H.pcVisit(); else H.go(s); }
  function step(d){ const s=station(); if(!s) return; const n=ORDER[ORDER.indexOf(s)+d]; if(n) stepTo(n); }
  edgeL.onclick=()=>step(-1); edgeR.onclick=()=>step(1);
  let sw=null;
  H.canvas.addEventListener("pointerdown",e=>{ sw=T.on&&e.isPrimary?{x:e.clientX,y:e.clientY,t:now(),pc:H.PC.zoom&&H.pick(e)===H.PC.mesh}:null; },{passive:true});
  addEventListener("pointerup",e=>{ const s=sw; sw=null; if(!s||!T.on) return;
    const dx=e.clientX-s.x, dy=e.clientY-s.y;
    if(Math.abs(dx)>48&&Math.abs(dx)>1.6*Math.abs(dy)&&now()-s.t<350&&!s.pc) step(dx<0?1:-1); },{passive:true});

  // a finger on the old PC's glass scrolls what it shows (About's text), as a trackpad's wheel does (Felix 21:49Z: one finger);
  // on Posts, where the TV's glass fills the view, a finger flips its pages. Elsewhere fingers look around / move the camera
  let drag=null;
  const mid=ts=>{ let x=0,y=0; for(const t of ts){ x+=t.clientX; y+=t.clientY; } return {clientX:x/ts.length,clientY:y/ts.length}; };
  H.canvas.addEventListener("touchstart",e=>{ if(!T.on||drag||e.touches.length>2) return;
    const m=mid(e.touches), pc=H.PC.zoom&&H.PC.inst&&H.interact.get(H.pick(m))?.kind==="pc", ttx=!pc&&H.state.page==="posts"&&!H.PC.zoom;
    if(!pc&&!ttx) return;
    drag={pc,y:m.clientY,acc:0,n:e.touches.length,was:H.controls.enabled}; H.controls.enabled=false; },{passive:true,capture:true});
  H.canvas.addEventListener("touchmove",e=>{ if(!drag) return; const m=mid(e.touches);
    if(e.touches.length!==drag.n){ drag.n=e.touches.length; drag.y=m.clientY; return; }   // a finger added or lifted: no jump
    const dy=drag.y-m.clientY; drag.y=m.clientY; if(!dy) return; e.preventDefault();
    if(drag.pc){ H.PC.inst.input({type:"wheel",deltaY:dy*1.6}); return; }
    drag.acc+=dy; if(Math.abs(drag.acc)>70){ H.ttxSwipe(Math.sign(drag.acc)); drag.acc=0; } },{passive:false,capture:true});
  // while a finger flips the pages, the row under it isn't a hover (that would pin its page)
  addEventListener("pointermove",e=>{ if(drag&&!drag.pc&&e.pointerType==="touch"){ e.stopImmediatePropagation(); H.ttxSwipe(0); } },{capture:true});
  const endDrag=e=>{ if(drag&&e.touches.length===0){ if(!H.controls.enabled) H.controls.enabled=drag.was; drag=null; } };
  H.canvas.addEventListener("touchend",endDrag); H.canvas.addEventListener("touchcancel",endDrag);

  // ---- 2. the tape strip
  const strip=document.createElement("div"); strip.id="tstrip"; strip.hidden=true; strip.setAttribute("aria-label","Tapes");
  const tiles=[];
  { const b=document.createElement("button"); b.className="tp pad"; b.innerHTML='<span class="n">Notepad</span><span class="y">WORK</span>';
    b.setAttribute("aria-label","Lift the notepad"); b.onclick=()=>{ H.gesture(); learned.add("NOTEPAD · WORK"); H.workCard(true); }; strip.append(b); }
  H.TAPES.forEach((t,i)=>{
    if(i===0||i===(H.EXP||2)||i===(H.JOBS||4)){ const g=document.createElement("span"); g.className="grp"; g.textContent=i===0?"EXPERIENCE":i===(H.EXP||2)?"EDUCATION":"PROJECTS"; strip.append(g); }
    const b=document.createElement("button"); b.className="tp"; b.style.background=t.bg||"#2a2622"; b.style.color=t.ink||"#efe9dc";
    b.innerHTML=`<span class="n"></span><span class="y"></span>`; b.firstChild.textContent=t.t; b.lastChild.textContent=t.y;
    b.setAttribute("aria-label","Play "+t.t);
    b.onclick=()=>{ H.gesture(); learned.add("tape"); picked={i,from:H.state.tape}; H.chooseTape(i); };
    tiles.push(b); strip.append(b); });
  document.body.append(strip);
  // NOTEPAD: lifts the pad on a phone's Work (the pad on the desk takes a tap too)
  // the border moves to a tape the moment it's picked, not when it starts playing (Felix 00:32Z); it follows the VCR again
  // once the VCR's tape changes (to this one, or to another the remote picked)
  let picked=null;
  const nb=document.createElement("button"); nb.className="sound"; nb.id="tnotes"; nb.textContent="NOTEPAD";
  nb.onclick=()=>{ H.gesture(); learned.add("NOTEPAD · WORK"); H.workCard(true); };
  $(".ctl .btns")?.prepend(nb);
  // BACK TO THE DESK on Posts and Work, the same pill as at the PC and in the close-ups (Felix 21:09Z)
  const bb=document.createElement("button"); bb.className="sound"; bb.id="tback"; bb.textContent="BACK TO THE DESK";
  bb.onclick=()=>{ H.gesture(); H.go("home"); };
  $("#unzoom")?.before(bb);

  // ---- 4. glints
  const GLINT=new Set(["pc","notepad","tape","cd","lamp","floor","window","phone","rolodex","credits","coffee","calc","remote","eject"]);
  const GLINTS_ON=false;   // Felix 22:34Z: no sparkles (kept for T.glint in tests)
  const live=[]; let nextG=now()+2500;
  function groups(){ const m=new Map();
    for(const [o,info] of H.interact){ if(!GLINT.has(info.kind)||!o.visible) continue; const g=info.kind==="tape"?"tape"+info.i:groupOf(info);
      if(learned.has(info.kind==="tape"?"tape":g)) continue; (m.get(g)||m.set(g,[]).get(g)).push(o); }
    return m; }
  function centre(objs){
    let x=0,y=0,z=0,n=0; const v=H.camera.position.clone();
    for(const o of objs){ o.updateWorldMatrix(true,false); if(!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      v.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld); x+=v.x; y+=v.y; z+=v.z; n++; }
    return v.set(x/n,y/n,z/n); }
  function screenOf(p){ const v=p.clone().project(H.view); if(v.z>1) return null; return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}; }
  function spawnGlints(){
    const m=groups(), cand=[]; let tapeDone=false;
    for(const [g,objs] of m){ const p=centre(objs), s=screenOf(p); if(!s||s.x<24||s.y<80||s.x>innerWidth-24||s.y>innerHeight-(strip.hidden?90:STRIP_H)) continue;
      const h=H.pick({clientX:s.x,clientY:s.y}); if(!h||!objs.includes(h)) continue;
      if(g.startsWith("tape")){ if(tapeDone) continue; }
      cand.push({g,p,s}); }
    cand.sort(()=>Math.random()-.5); const pickN=[]; for(const c of cand){ if(c.g.startsWith("tape")){ if(tapeDone) continue; tapeDone=true; } pickN.push(c); if(pickN.length>=2) break; }
    pickN.forEach((c,k)=>setTimeout(()=>{ const el=document.createElement("div"); el.className="glint"; document.body.append(el); live.push({el,p:c.p,t:now()}); place(live[live.length-1]); },k*700)); }
  function place(L){ const s=screenOf(L.p); if(!s){ L.el.style.opacity=0; return; } L.el.style.left=s.x+"px"; L.el.style.top=s.y+"px"; }

  // ---- look around a little (Felix 18:42Z): drag turns the head and pinch leans in, on a short leash around each shot
  function leash(){ const c=H.controls, o=H.camera.position.clone().sub(c.target), d=o.length();
    const az=Math.atan2(o.x,o.z), po=Math.acos(Math.min(1,Math.max(-1,o.y/d)));
    c.minAzimuthAngle=az-.22; c.maxAzimuthAngle=az+.22; c.minPolarAngle=Math.max(.05,po-.12); c.maxPolarAngle=Math.min(3.09,po+.12);
    c.minDistance=d*.62; c.maxDistance=d*1.06; rebase(); }
  // two fingers slide the camera over the floor: along the whole desk (Felix 21:01Z, "strafe along the entire length of the
  // table"; desk_top in build.py runs x -0.8..0.9), and forward/back up to MOVE_Z from the shot's own spot
  let base=null, baseKey=""; const DESK_X=[-.8,.9], MOVE_Z=.25;
  // the leash's centre is the shot's own target, taken once per shot: a tape or a resize while you've slid along keeps it
  const shotKey=()=>[H.state.page,H.zoomed,H.PC.zoom,!!H.cd?.near,!!H.calc?.up,!!H.state.sheet,H.padUp(),H.credUp?.()].join();
  function rebase(){ const k=shotKey(); if(k!==baseKey){ baseKey=k; base=H.controls.target.clone(); } }
  function unbase(){ base=null; baseKey=""; }
  // desktop (Felix 02:36Z): the right mouse button held slides the camera the same way two fingers do on a phone, on the same leash;
  // only in the room's own shots, not in close-ups (PC, TV zoom, CD player, calculator, pad or credits up)
  const deskPan=()=>!H.padUp()&&!H.PC.zoom&&!H.zoomed&&!H.cd?.near&&!H.calc?.up&&!H.state.sheet&&!H.credUp?.();
  H.canvas.addEventListener("contextmenu",e=>{ if(!T.on) e.preventDefault(); });
  function clampMove(){ if(!base||H.fly) return; const t=H.controls.target;
    const x0=Math.min(DESK_X[0],base.x), x1=Math.max(DESK_X[1],base.x);
    const dx=Math.max(x0,Math.min(x1,t.x))-t.x, dz=Math.max(-MOVE_Z,Math.min(MOVE_Z,t.z-base.z))+base.z-t.z, dy=base.y-t.y;
    if(dx||dy||dz){ t.x+=dx; t.y+=dy; t.z+=dz; H.camera.position.x+=dx; H.camera.position.y+=dy; H.camera.position.z+=dz; } }

  // ---- every frame: what shows, where the glints are
  let last="";
  function tick(){
    requestAnimationFrame(tick);
    const on=T.on, st=on?station():null, P=portrait(), work=on&&H.state.page==="work"&&!H.state.sheet;
    const key=[on,st,P,work,H.zoomed,H.padUp(),H.PC.zoom,H.state.tape,picked?.i,H.state.page,!!H.fly,innerWidth,innerHeight,!!H.cd?.near,!!H.calc?.up,!!H.state.sheet].join();
    if(key!==last){ last=key; document.body.classList.toggle("tphone",on);
      H.controls.enableRotate=H.controls.enableZoom=!on||!H.padUp();
      H.controls.enablePan=on?!H.padUp():deskPan(); H.controls.screenSpacePanning=false;   // (slides over the floor's plane)
      if(!on){ if(deskPan()&&!H.fly) rebase(); else unbase(); }
      const sb=$("#sound"), top=$(".hud.top"); if(sb&&top){ if(on&&sb.parentNode!==top) top.append(sb); else if(!on&&sb.parentNode===top) $(".ctl .btns").append(sb); }
      document.body.classList.toggle("tp-home",on&&H.state.page==="home"&&!H.PC.zoom);
      document.body.classList.toggle("tp-back",on&&(H.state.page==="posts"||H.state.page==="work")&&!H.zoomed&&!H.padUp()&&!H.PC.zoom&&!H.state.sheet&&!H.cd?.near&&!H.calc?.up);
      if(on){ if(!H.fly&&!H.cd?.near) leash(); else unbase(); }
      const i=on&&!H.fly&&st?ORDER.indexOf(st):-1;
      edgeL.hidden=edgeR.hidden=true;   // Felix 22:34Z: the nav already goes there; swipes still do
      if(i>0) edgeL.textContent="‹ "+NAME[ORDER[i-1]]; if(i>=0&&i<2) edgeR.textContent=NAME[ORDER[i+1]]+" ›";
      strip.hidden=!(work&&P&&!H.zoomed&&!H.padUp());
      document.body.classList.toggle("tphone-work",work&&!H.zoomed&&!H.padUp());
      if(picked&&H.state.tape!==picked.from&&H.state.tape>=0) picked=null;   // (an eject on the way, tape -1, keeps the pick)
      const cur=picked?picked.i:H.state.tape; tiles.forEach((b,i)=>b.classList.toggle("on",i===cur)); }
    clampMove();
    if(!tt.hidden&&now()-ttT>3500) tt.hidden=true;
    for(let k=live.length-1;k>=0;k--){ const L=live[k]; if(now()-L.t>2300){ L.el.remove(); live.splice(k,1); } else place(L); }
    if(on&&now()>nextG){ nextG=now()+5200+Math.random()*1800;
      const idle=!H.fly&&!H.zoomed&&!H.state.sheet&&!H.padUp()&&!H.PC.zoom&&!H.cd?.near&&!H.calc?.up&&document.querySelector("#gl.ready");
      if(GLINTS_ON&&idle&&!document.hidden) spawnGlints(); }
  }
  T.glint=spawnGlints;   // (for tests)
  requestAnimationFrame(tick);
  // the page may have framed Work before this loaded: frame it again with the strip in mind
  if(T.on&&H.state.page==="work"&&!H.fly&&!H.zoomed) H.flyTo(H.frameFor("work"),true);
  return T;
}
