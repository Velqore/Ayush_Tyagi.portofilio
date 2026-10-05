// The wall clock's battery (Felix, 28 Sep 01:55Z: "can we add a 'yank batteries out of the ticking clock' pls?", as an action).
// A click on the clock (on a phone, the second tap) takes its battery out: the clock tips off the wall at the bottom while a
// hand reaches behind it, the battery comes out with a click, and the clock drops back against the wall with a knock and swings
// a little on its nail. It has stopped: its hands stand still and the ticking is gone. Another click puts the battery back: it
// clicks in, and half a second later the clock goes on from where it stood, as late as the battery was out. Every visit starts
// with the battery in.
//
// The ticking: the room's background recording (audio2/room.mp3) had a mechanical clock in it, ticking every 0.515 s in the
// left channel only, out of step with this quartz clock's second hand. room.mp3 here is that recording with its ticks cut out
// (sounds/make_sounds.py), and six of them are played again, one on each step of the second hand, from where the clock is:
// panned by its direction from the camera, a little louder close to it.
//
// No imports: the page passes THREE in. createClock(THREE,{scene,body,pivots,interact,night,audio,view,reduce,live}) after
// setupClock (the hands on their pivots) and before the room's pick occluders and draw-call join are made. The page draws the
// hands at clock.now(Date.now()), shows clock.tip() over the clock, and takes its background from ROOM_URL.
export const ROOM_URL=new URL("./room.mp3",import.meta.url).href;
export function createClock(THREE,{scene,body,pivots=[],interact,night,audio,view,reduce=false,live=()=>{},url=new URL("./clock.mp3",import.meta.url).href}){
  if(!body) throw new Error("clock: no wall clock in the scene");
  // one entry for all its parts. Its label stays as it is: a phone's first tap shows it and learns the clock by it (touch.js);
  // the tip over it on a desktop says what the next click does (tip())
  const info={kind:"clock",label:"CLOCK · PULL BATTERY"};
  const parts=[]; body.traverse(o=>{ if(o.isMesh) parts.push(o); });
  for(const c of pivots) c.p.traverse(o=>{ if(o.isMesh) parts.push(o); });
  for(const o of parts) interact.set(o,info);

  // ---- the rig: the clock hangs from the top of its back. It tips out about the edge there (rig z), and swings in the wall's
  // plane about the same point (rig x: the face looks along +x, the hands turn about their pivots' x)
  const box=new THREE.Box3().setFromObject(body), mid=box.getCenter(new THREE.Vector3());
  const rig=new THREE.Group(); rig.name="wall_clock_rig"; rig.position.set(box.min.x,box.max.y-.004,mid.z);
  scene.add(rig); rig.updateMatrixWorld(true);
  rig.attach(body); for(const c of pivots) rig.attach(c.p);
  const midL=rig.worldToLocal(mid.clone());   // the clock's middle, in the rig (where its sounds come from)

  // ---- the battery: the time the hands show is the page's night time, less what the clock has lost with its battery out
  const PH=170;   // the page's quartz step: the hand jumps at each whole second and has settled 170 ms later
  let on=true, lost=0, F=0, holdTo=0;
  const phase=w=>((night(w)%1000)+1000)%1000;   // how far into its second the time w shows
  function now(w){ return on?(w<holdTo?F:w-lost):Math.min(w-lost,F); }   // (while out: on to where the step under way settles)
  function pull(w){ const d=now(w), p=phase(d); F=p<PH?d+PH-p:d; lost=w-d; on=false; }
  function put(w){ holdTo=w+500; lost=holdTo-F; on=true; }   // the first step comes half a second or more after the click
  let want=true;   // the battery in, once every click so far has been done
  const tip=()=>want?"CLOCK · PULL BATTERY":"CLOCK · PUT BATTERY BACK";

  // ---- sounds: six ticks, then the battery coming out and going in (sounds/make_sounds.py): offset and length, seconds
  const CUTS={tick0:[0,.2],tick1:[.45,.2],tick2:[.9,.2],tick3:[1.35,.2],tick4:[1.8,.2],tick5:[2.25,.2],out:[2.7,.425],in:[3.375,.305]};
  const TICKS=Object.keys(CUTS).filter(k=>k.startsWith("tick")), TICK_GAIN=.8;   // (the room stem's gain: the ticks it had)
  let buf=null, loading=null, lastTick="", nextSec=null, ticks=[];
  function load(a){ return loading||(loading=fetch(url).then(r=>{ if(!r.ok) throw new Error(url+" "+r.status); return r.arrayBuffer(); })
    .then(d=>a.ctx.decodeAudioData(d)).then(b=>{ buf=b; }).catch(e=>console.warn("clock: no sounds",e))); }
  const P=new THREE.Vector3();
  // from the camera: the clock's side (-1 left .. 1 right, never quite all one side) and a gain that's 1 from the desk
  function where(){ const v=view?.(); if(!v) return {pan:-.5,g:1};
    P.copy(midL).applyMatrix4(rig.matrixWorld).applyMatrix4(v.matrixWorldInverse); const d=Math.max(.05,P.length());
    return {pan:Math.max(-.75,Math.min(.75,P.x/d*.85)),g:Math.max(.8,Math.min(1.4,Math.sqrt(2.2/d)))}; }
  function out(a,wet=.25){ const w=where(), p=a.ctx.createStereoPanner(); p.pan.value=w.pan; const g=a.ctx.createGain(); g.gain.value=w.g;
    g.connect(p).connect(a.out); if(a.verb&&wet){ const s=a.ctx.createGain(); s.gain.value=wet; p.connect(s).connect(a.verb); } return g; }
  function play(a,name,{at,gain=1,rate=1,wet=.25}={}){
    if(!buf) return null; const c=CUTS[name], ctx=a.ctx;
    const n=ctx.createBufferSource(); n.buffer=buf; n.playbackRate.value=rate; const g=ctx.createGain(); g.gain.value=gain;
    n.connect(g).connect(out(a,wet)); n.start(Math.max(ctx.currentTime,at??ctx.currentTime),c[0],c[1]); return n;
  }
  // a tick on every step of the second hand: each one is started ahead of time, at its step (a frame can come late; a step no
  // frame saw coming is skipped rather than ticked late). None while the sound is held up (an iPhone's call, a context not yet
  // resumed: they would all come at once after), and none after the moment the battery comes out
  const AHEAD=180;
  function scheduleTicks(a){
    if(!a||!buf||!on||a.ctx.state!=="running") return;
    const w=Date.now(), d=now(w), toStep=(1000-phase(d))%1000, ms=(w<holdTo?holdTo-w:0)+toStep, sec=Math.round((night(d)+toStep)/1000)%86400;
    if(ms>AHEAD||sec===nextSec) return;
    const at=a.ctx.currentTime+ms/1000;
    if(anim&&anim.going&&anim.popAt!=null&&at>=anim.popAt) return;
    nextSec=sec;
    const names=TICKS.filter(n=>n!==lastTick), name=names[Math.floor(Math.random()*names.length)]; lastTick=name;
    const n=play(a,name,{at,gain:TICK_GAIN*(.9+Math.random()*.14),rate:.99+Math.random()*.02,wet:.12});
    if(n){ ticks.push({n,at}); ticks=ticks.filter(t=>t.at>a.ctx.currentTime-1); }
  }
  function cancelTicks(a,after=0){ const t=Math.max(a?a.ctx.currentTime:0,after);
    ticks=ticks.filter(k=>{ if(k.at<=t) return true; try{ k.n.stop(); }catch{} return false; }); nextSec=null; }
  // the clock against the wall: a lift off the plaster, and the knock when it drops back (and its little bounce)
  let noise=null;
  function noiseBuf(ctx){ if(noise) return noise; noise=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return noise; }
  function hit(a,o,t,f,q,amp,dur){ const ctx=a.ctx, s=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), g=ctx.createGain(); s.buffer=noiseBuf(ctx);
    bp.type="bandpass"; bp.frequency.value=f; bp.Q.value=q; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(amp,t+Math.min(.002,dur*.3)); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(bp).connect(g).connect(o); s.start(t,Math.random()*.3); s.stop(t+dur+.05); }
  function thump(a,o,t,f,amp,dur){ const ctx=a.ctx, s=ctx.createOscillator(), g=ctx.createGain(); s.frequency.setValueAtTime(f,t); s.frequency.exponentialRampToValueAtTime(f*.62,t+dur);
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(amp,t+.003); g.gain.exponentialRampToValueAtTime(.0001,t+dur); s.connect(g).connect(o); s.start(t); s.stop(t+dur+.05); }
  function lift(a,at){ const o=out(a,.2), t=Math.max(a.ctx.currentTime,at);
    hit(a,o,t,1300,.7,.12,.18); hit(a,o,t+.02,2600,1.2,.06,.1); }   // (a soft scrape, some 12 dB under the room's click)
  function knock(a,at){ const o=out(a,.3), t=Math.max(a.ctx.currentTime,at);
    thump(a,o,t,115,.32,.075); hit(a,o,t,650,1.2,.2,.035); hit(a,o,t+.003,2500,3,.07,.008);
    thump(a,o,t+.075,125,.1,.05); hit(a,o,t+.075,700,1.2,.07,.025); }   // (it bounces off the plaster once)

  // ---- a click: the battery out, or back in. The picture keeps to the sounds, which are all set off at the click: it runs on
  // the time since then, not on the page's frames (capped at 64 ms each, so a slow phone's would fall behind)
  const R=reduce?{pop:.12,knock:.12,end:.12}:{pop:.3,fall:.42,knock:.55,end:.65}, TIP=6.5*Math.PI/180;
  let anim=null, queued=false;
  const animT=()=>anim?(performance.now()-anim.w0)/1000:0;
  function start(){
    const a=audio?.(); if(a&&!buf) load(a);
    const going=on, t0=a?a.ctx.currentTime:0;
    anim={t:0,w0:performance.now(),going,popAt:a?t0+R.pop:null,played:false,popped:false};
    if(a&&!reduce){ lift(a,t0); knock(a,t0+R.knock); }
    if(a&&buf){ play(a,going?"out":"in",{at:t0+R.pop}); anim.played=true; }
    if(a&&going) cancelTicks(a,t0+R.pop);   // (a tick already on its way for after the battery's out)
  }
  function toggle(){ want=!want; if(anim&&animT()<R.knock){ queued=!queued; return; } start(); }   // (one more while one is under way)
  // the swing on the nail: a damped pendulum (about 1.25 swings a second, gone in about three), kicked by each knock
  const sw={a:0,v:0}, W=2*Math.PI*1.25, Z=.18;
  function swing(dt){ for(let h=dt;h>1e-6;h-=.008){ const s=Math.min(.008,h); sw.v+=(-W*W*sw.a-2*Z*W*sw.v)*s; sw.a+=sw.v*s; }
    if(Math.abs(sw.a)<2e-4&&Math.abs(sw.v)<2e-3){ sw.a=sw.v=0; } }   // (0.01°: still, and the frame rate can drop again)
  const ease=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
  function tipAt(t){
    if(t<R.fall) return TIP*ease(t/.22)+(t>R.pop?.012*Math.exp(-(t-R.pop)/.05)*Math.sin((t-R.pop)*60):0);   // (a tug as the battery gives)
    if(t<R.knock){ const x=(t-R.fall)/(R.knock-R.fall); return TIP*(1-x*x); }   // it drops back, faster and faster
    const x=(t-R.knock)/.09; return x<1?.016*Math.sin(Math.PI*x):0;   // the bounce
  }
  function frame(dt){
    const a=audio?.(); if(a&&!loading) load(a);   // fetched once the room has its sound, so the first click needn't wait
    if(anim){ const tp=anim.t, t=anim.t=animT();
      // the battery's own sound, if its file came in after the click (and not too late to still belong to it)
      if(!anim.played&&buf&&a&&t<R.pop+.2){ play(a,anim.going?"out":"in",{at:a.ctx.currentTime+Math.max(0,R.pop-t)}); anim.played=true; }
      if(!anim.popped&&t>=R.pop){ anim.popped=true; const w=Date.now();
        if(anim.going){ pull(w); cancelTicks(a); live("The clock's battery is out: it has stopped."); } else { put(w); live("The battery is back in the clock."); } }
      if(!reduce){ rig.rotation.z=tipAt(t); if(tp<R.knock&&t>=R.knock) sw.v+=(Math.random()<.5?-1:1)*(.13+Math.random()*.05); }
      if(t>=R.knock&&queued){ queued=false; start(); }
      else if(t>=R.end){ anim=null; rig.rotation.z=0; } }
    if(!reduce&&(sw.a||sw.v)){ swing(dt); rig.rotation.x=sw.a; }
    scheduleTicks(a);
  }
  return {now,frame,toggle,tip,where,rig,parts,CUTS,
    get on(){ return on; },get busy(){ return !!anim||!!(sw.a||sw.v); },get ready(){ return !!buf; },get anim(){ return anim&&{t:animT(),going:anim.going}; },
    get swing(){ return sw.a; },get ticks(){ return ticks.map(k=>k.at); },
    // tests: the battery back in, nothing lost
    reset(){ on=true; lost=0; F=0; holdTo=0; anim=null; queued=false; want=true; sw.a=sw.v=0; rig.rotation.set(0,0,0); cancelTicks(audio?.()); }};
}
