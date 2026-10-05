// The coffee on the desk (Felix, 26 Sep 16:21Z): "Clicking the coffee should play a 'slurp' sound and remove a little coffee
// (until it's empty, when you remove the smoke)". A click on the mug is a sip: a slurp, and the coffee goes down the mug while
// it plays, its surface rocking a little after. Seven sips empty it: the last ends on the air at the bottom, leaves a film of
// coffee there, and the steam dies away. An empty mug answers a click with a tap on the glaze. Each visit starts with a full one.
//
// The mug's light is baked (the props_mug atlas) with the coffee in it, so the glaze under the coffee's line baked black. Where
// the coffee has gone, the wall takes its light from the band just above the old line, at the same angle round the mug, dimmed
// the deeper it is (what a point inside a cup sees of the room through its mouth), with a faint tide line where the coffee
// stood. The coffee itself gets darker and mirrors less of the room as it sinks.
//
// No imports: the page passes THREE in. createCoffee(THREE,{root,interact,MUG,audio,view,reduce,live}) after the room's
// load traverse (the mug's materials baked) and before the draw-call join, which then leaves the mug's meshes alone.
export function createCoffee(THREE,{root,interact,MUG,audio,view,reduce=false,live=()=>{},url=new URL("./slurps.mp3",import.meta.url).href}){
  // ---- the mug's inside, from props.py (MUG_PROF): radius at each height, metres above the desk, bottom up
  const IN=[[0,.0077],[.02,.0078],[.0305,.0084],[.0336,.0096],[.0353,.0128],[.036,.019],[.0366,.03],[.0372,.05],[.0377,.07],[.038,.088],[.0382,.0914]];
  const FULL=.0802, MEN=.0008, FILM=.0086, RIM=.093, RI=.038, SIPS=7, RING_Y=.0855;
  const rAt=y=>{ if(y<=IN[0][1]) return 0; for(let i=1;i<IN.length;i++) if(y<=IN[i][1]){ const [r0,y0]=IN[i-1],[r1,y1]=IN[i]; return r0+(r1-r0)*(y-y0)/(y1-y0); } return IN.at(-1)[0]; };
  // the volume under each height (0.1 mm steps). The first sips are small (it's hot, and from the home view the coffee shows
  // only in the top 4 mm of the mug, so the first one can still be seen going down), the later ones bigger as it cools
  const VY=[], VV=[]; for(let y=IN[0][1],v=0;y<=FULL+1e-9;y+=1e-4){ VY.push(y); VV.push(v); const r=rAt(y+5e-5); v+=Math.PI*r*r*1e-4; }
  const vAt=y=>{ const i=Math.min(VY.length-1,Math.max(0,Math.round((y-VY[0])/1e-4))); return VV[i]; };
  const yAt=v=>{ let i=1; while(i<VV.length-1&&VV[i]<v) i++; const f=(v-VV[i-1])/Math.max(1e-12,VV[i]-VV[i-1]); return VY[i-1]+(VY[i]-VY[i-1])*Math.min(1,Math.max(0,f)); };
  const LV=[FULL]; { const v0=vAt(FULL), v1=vAt(FILM), w=[.25,.45,1,1.2,1.3,1.35,1.45].map(x=>x*(.92+Math.random()*.16));
    const sw=w.reduce((a,b)=>a+b,0); let v=v0; for(let i=0;i<SIPS;i++){ v-=(v0-v1)*w[i]/sw; LV.push(i===SIPS-1?FILM:yAt(v)); } }

  // ---- the parts
  const mug=root.getObjectByName("mug"), coffee=root.getObjectByName("coffee"), handle=root.getObjectByName("mug_handle");
  const parts=[]; mug?.traverse(o=>{ if(o.isMesh) parts.push(o); });
  const glaze=parts.find(o=>/^mug_glaze/.test(o.material?.name||""));
  if(!coffee||!glaze) console.warn("coffee: no mug in the scene");
  const info={kind:"coffee",label:"COFFEE · SIP"};   // one for all its parts: the label follows the mug
  for(const o of [...parts,coffee,handle]) if(o?.isMesh) interact.set(o,info);
  const base=coffee?{y:coffee.position.y,sx:coffee.scale.x,sz:coffee.scale.z}:null, mug0=MUG?MUG.y:0;
  const U={cupY:{value:FULL+MEN},cupRing:{value:[]},cupTideY:{value:new Array(8).fill(-1)},cupTide:{value:new Array(8).fill(0)},
    cupDiff:{value:1},cupSpec:{value:1},cupSlosh:{value:new THREE.Vector2()},cupRip:{value:new THREE.Vector2()}};
  let tides=0;

  // a material of its own for a mesh, keeping the bake's shader (Material.copy leaves onBeforeCompile behind), plus our patch
  function own(o,tag,patch){
    const m0=o.material, m=m0.clone(), bake=m0.onBeforeCompile, key=m0.customProgramCacheKey;
    m.onBeforeCompile=(sh,r)=>{ bake.call(m,sh,r); patch(sh); };
    m.customProgramCacheKey=()=>key.call(m0)+"|"+tag; o.material=m; return m;
  }
  const swap=(s,a,b)=>{ if(!s.includes(a)) throw new Error("coffee: the shader has no "+a.slice(0,40)); return s.replace(a,b); };

  // ---- the wall: the lightmap's coordinates at 97 steps round the mug, RING_Y up (the seam's two sides are the first and the
  // last), from the glaze's own rings of vertices at 7 and 8.8 cm
  function ringUVs(o){
    const P=o.geometry.attributes.position, T=o.geometry.attributes.uv1; if(!P||!T) return null;
    const R={70:[],88:[]};
    for(let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i), z=P.getZ(i), r=Math.hypot(x,z);
      for(const [k,h,rr] of [[70,.07,.0377],[88,.088,.038]]) if(Math.abs(y-h)<3e-4&&Math.abs(r-rr)<3e-4){
        const t=(((Math.atan2(-z,x)-Math.PI/2)/(2*Math.PI))%1+1)%1; R[k].push({t:t>1-1/192?t-1:t,u:T.getX(i),v:T.getY(i)}); } }
    const out=[];
    for(const k of [70,88]){ const a=R[k].sort((p,q)=>p.t-q.t); if(a.length!==97) return null;
      // the seam has two vertices at t 0: the one next to the second step's is the start, the other the end (t 1)
      const d=p=>Math.hypot(p.u-a[2].u,p.v-a[2].v); const s0=d(a[0])<d(a[1])?a[0]:a[1], s1=s0===a[0]?a[1]:a[0];
      out.push([s0,...a.slice(2),s1]); }
    const f=(RING_Y-.07)/.018;
    return out[0].map((p,i)=>{ const q=out[1][i]; return new THREE.Vector2(p.u+(q.u-p.u)*f,p.v+(q.v-p.v)*f); });
  }
  if(glaze){ try{
    const ring=ringUVs(glaze); if(!ring) throw new Error("the glaze's rings aren't the ones props.py makes");
    U.cupRing.value=ring;
    own(glaze,"coffee-wall",sh=>{
      Object.assign(sh.uniforms,{cupY:U.cupY,cupRing:U.cupRing,cupTideY:U.cupTideY,cupTide:U.cupTide});
      sh.vertexShader=swap("varying vec3 vCupP;\n"+sh.vertexShader,"#include <begin_vertex>","#include <begin_vertex>\nvCupP=position;");
      let f="uniform float cupY; uniform vec2 cupRing[97]; uniform float cupTideY[8],cupTide[8]; varying vec3 vCupP;\n"+
        // how much of the room a point on the wall h up sees through the mouth (a cylinder's wall to its end disc)
        "float cupF(float h){ float H=max(0.,"+RIM+"-h)/"+RI+"; return .5*((H*H+2.)/sqrt(H*H+4.)-H); }\n"+sh.fragmentShader;
      f=swap(f,"{ vec3 ia=pow(texture2D(lightMap,vLightMapUv).rgb,vec3(bg))*sA;",
        // exposed: inside, above the coffee now, below where it stood (the bake's light starts just above the old line)
        // (nothing before the first sip: a full mug looks as it always did)
        `float cupH=vCupP.y, cupE=step(length(vCupP.xz),.0386)*step(.005,cupH)*step(cupY-.0003,cupH)*(1.-smoothstep(${(FULL+MEN).toFixed(4)},${(FULL+MEN+.003).toFixed(4)},cupH))*step(cupY,${(FULL+MEN-1e-5).toFixed(5)});
        float cupA=pow(clamp(cupF(cupH)/cupF(${RING_Y}),0.,1.),.7), cupS=mix(1.,cupA,cupE);
        vec2 cupUv=vLightMapUv;
        if(cupE>0.){ float ct=fract((atan(-vCupP.z,vCupP.x)-1.5707963)/6.2831853)*96.; int ci=int(floor(ct)); cupUv=mix(vLightMapUv,mix(cupRing[ci],cupRing[min(ci+1,96)],fract(ct)),cupE); }
        { vec3 ia=pow(texture2D(lightMap,cupUv).rgb,vec3(bg))*sA;`);
      f=swap(f,"vec3 id=pow(texture2D(irrD,vLightMapUv).rgb","vec3 id=pow(texture2D(irrD,cupUv).rgb");
      f=swap(f,"vec3 ib=pow(texture2D(irrB,vLightMapUv).rgb","vec3 ib=pow(texture2D(irrB,cupUv).rgb");
      f=swap(f,"vec3 e=(ia+ib*tvCol)*bakeGain;",`vec3 e=(ia+ib*tvCol)*bakeGain;
        if(cupE>0.){ float tide=0.; float ca=atan(vCupP.z,vCupP.x); for(int i=0;i<8;i++){ float w=.00022*sin(3.*ca+float(i)*1.7)+.00012*sin(7.*ca+float(i)*2.9); tide=max(tide,cupTide[i]*exp(-pow((cupH-cupTideY[i]-w)/.0004,2.))); }
          e*=mix(vec3(1.),cupA*vec3(.97,.94,.9)*mix(vec3(1.),vec3(.74,.57,.42),tide),cupE); }`);
      f=swap(f,"reflectedLight.indirectSpecular*=so;","reflectedLight.indirectSpecular*=so*cupS;");
      f=swap(f,"clearcoatSpecularIndirect*=so;","clearcoatSpecularIndirect*=so*cupS;");
      sh.fragmentShader=f;
    });
  }catch(e){ console.warn("coffee: the mug's wall keeps its bake",e); } }

  // ---- the coffee: darker and less of a mirror as it sinks, and its surface rocks after a sip (the slosh: the first mode, a
  // tilt swinging back and forth; and a ring of ripples running out from the middle)
  if(coffee){ try{
    own(coffee,"coffee-top",sh=>{
      Object.assign(sh.uniforms,{cupDiff:U.cupDiff,cupSpec:U.cupSpec,cupSlosh:U.cupSlosh,cupRip:U.cupRip});
      sh.vertexShader=swap("varying vec2 vCofP;\n"+sh.vertexShader,"#include <begin_vertex>","#include <begin_vertex>\nvCofP=position.xz;");
      let f="uniform float cupDiff,cupSpec; uniform vec2 cupSlosh,cupRip; varying vec2 vCofP;\n"+sh.fragmentShader;
      f=swap(f,"#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        { float cr=length(vCofP); vec2 cg=cupSlosh;
          if(cupRip.x>0.) cg+=cupRip.x*cos(cr*628.-cupRip.y*150.)*(1.-smoothstep(cupRip.y*.24,cupRip.y*.24+.006,cr))*vCofP/max(cr,1e-4);
          normal=normalize(normal-mat3(viewMatrix)*vec3(cg.x,0.,cg.y)); }`);
      f=swap(f,"vec3 e=(ia+ib*tvCol)*bakeGain;","vec3 e=(ia+ib*tvCol)*bakeGain*cupDiff;");
      f=swap(f,"#include <aomap_fragment>","reflectedLight.indirectSpecular*=cupSpec;\n#include <aomap_fragment>");
      sh.fragmentShader=f;
    });
  }catch(e){ console.warn("coffee: the coffee keeps its look",e); } }

  // ---- the level
  let y=FULL, k=0, anim=null, queued=false, pend=null, slosh=null, steam=1;
  function place(){
    if(!coffee||!base) return;
    const s=rAt(y+MEN)/rAt(FULL+MEN); coffee.position.y=base.y+(y-FULL); coffee.scale.set(base.sx*s,coffee.scale.y,base.sz*s);
    U.cupY.value=y+MEN;
    // the light a disc h down a cup gets through its mouth, against a full one's
    const Fd=h=>{ const H=(RIM-h)/RI; return 1/(1+H*H); }, q=Fd(y)/Fd(FULL);
    U.cupDiff.value=Math.pow(q,.7); U.cupSpec.value=Math.pow(q,1.2);
    if(MUG) MUG.y=mug0+(y-FULL);
  }

  // ---- the sounds: four slurps and the air at the bottom, in one file (sounds/make_slurps.py): offset, length, and when the
  // coffee flows (from, to), in seconds
  const CUTS={sip1:[.1,1.28,.42,1.22],sip2:[1.73,1.17,.2,1.1],sip3:[3.25,1.17,.35,1.1],sip4:[4.77,.77,.08,.72],air:[5.89,.35,0,.35]};
  let buf=null, loading=null, lastCut="";
  function load(a){ return loading||(loading=fetch(url).then(r=>{ if(!r.ok) throw new Error(url+" "+r.status); return r.arrayBuffer(); })
    .then(d=>a.ctx.decodeAudioData(d)).then(b=>{ buf=b; }).catch(e=>console.warn("coffee: no slurps",e))); }
  const P=new THREE.Vector3();
  function pan(){ const v=view?.(); if(!v||!coffee) return -.3; coffee.getWorldPosition(P).project(v); return Math.max(-.6,Math.min(.6,P.x*.6)); }
  function out(a){ const p=a.ctx.createStereoPanner(); p.pan.value=pan(); p.connect(a.out); if(a.verb){ const v=a.ctx.createGain(); v.gain.value=.5; p.connect(v).connect(a.verb); } return p; }
  function play(name,{gain=1,rate=1,at=0}={}){
    const a=audio?.(); if(!a||!buf) return false; const c=CUTS[name], ctx=a.ctx;
    const n=ctx.createBufferSource(); n.buffer=buf; n.playbackRate.value=rate; const g=ctx.createGain(); g.gain.value=gain;
    n.connect(g).connect(out(a)); n.start(ctx.currentTime+at,c[0],c[1]); return true;
  }
  // an empty mug: a fingernail on the glaze
  function tap(){
    const a=audio?.(); if(!a) return; const ctx=a.ctx, t=ctx.currentTime, p=out(a);
    for(const [f,d,amp] of [[1480,.3,.06],[3270,.15,.035],[5570,.07,.02]]){ const o=ctx.createOscillator(), g=ctx.createGain();
      o.frequency.value=f*(.985+Math.random()*.03); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(amp,t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g).connect(p); o.start(t); o.stop(t+d+.05); }
  }

  // ---- a sip
  function sip(){
    if(anim||pend){ queued=true; return; }   // (one more while one runs)
    if(k>=SIPS){ tap(); return; }
    const a=audio?.(); if(a&&!buf){ load(a); pend={t:performance.now()}; return; }   // the file is on its way: wait for it a moment
    start();
  }
  function start(){
    pend=null;
    const names=Object.keys(CUTS).filter(n=>n!=="air"&&n!==lastCut), name=names[Math.floor(Math.random()*names.length)]; lastCut=name;
    const c=CUTS[name], rate=.96+Math.random()*.08, last=k===SIPS-1;
    const heard=play(name,{rate,gain:.72+Math.random()*.1});
    if(heard&&last) play("air",{at:c[1]/rate-.03,gain:.9});
    if(tides<8&&k>0){ U.cupTideY.value[tides]=y+MEN*.6; U.cupTide.value[tides]=.16; tides++; }   // the line where it stood since the last sip
    if(k===0){ U.cupTideY.value[tides]=FULL+MEN*.6; U.cupTide.value[tides]=.34; tides++; }   // (the first line: where it stood all along)
    anim={t:0,from:y,to:LV[k+1],a:c[2]/rate,b:c[3]/rate,end:c[1]/rate+(last?.35:0),last};
    k++;
    if(k>=SIPS){ info.label="COFFEE · EMPTY"; live("That was the last of the coffee."); } else live("A sip of coffee.");
  }
  const smooth=x=>{ x=Math.min(1,Math.max(0,x)); return x*x*(3-2*x); };
  function frame(dt){
    const a=audio?.(); if(a&&!loading) load(a);   // fetched once the room has its sound, so the first sip needn't wait
    if(pend&&(buf||performance.now()-pend.t>450)) start();
    if(anim){ anim.t+=dt; y=anim.from+(anim.to-anim.from)*smooth((anim.t-anim.a)/(anim.b-anim.a));
      if(anim.t>=anim.b&&!anim.rocked){ anim.rocked=true; if(!reduce){ const th=Math.random()*Math.PI*2; slosh={t:0,dx:Math.cos(th),dz:Math.sin(th),a:anim.last?.02:.03}; } }
      if(anim.t>=anim.end){ anim=null; if(queued){ queued=false; if(k<SIPS) start(); else tap(); } } }
    if(slosh){ slosh.t+=dt; const t=slosh.t, s=slosh.a*Math.exp(-t/.75)*Math.sin(2*Math.PI*3.3*t);
      U.cupSlosh.value.set(slosh.dx*s,slosh.dz*s); U.cupRip.value.set(.018*Math.exp(-t/.5),t);
      if(t>3){ slosh=null; U.cupSlosh.value.set(0,0); U.cupRip.value.set(0,0); } }
    // the steam: thinner as the coffee goes down, gone once it's all drunk
    const want=k>=SIPS&&!anim?0:1-.25*Math.min(k,SIPS-1)/(SIPS-1);
    steam+=(want-steam)*Math.min(1,dt*(want<steam&&want===0?.9:2));
    if(steam<.003&&want===0) steam=0;
    place();
  }
  place();
  return {sip,frame,parts:[...parts,coffee,handle].filter(Boolean),
    get busy(){ return !!(anim||pend||slosh)||(k>=SIPS&&steam>0); },get steam(){ return steam; },get level(){ return (y-FILM)/(FULL-FILM); },
    get sips(){ return k; },get empty(){ return k>=SIPS; },get y(){ return y; },LV,SIPS,tip:()=>info.label,
    get ready(){ return !!buf; },
    // tests: back to a full mug
    reset(){ y=FULL; k=0; anim=pend=slosh=null; queued=false; steam=1; tides=0; U.cupTide.value.fill(0); info.label="COFFEE · SIP"; place(); }};
}
