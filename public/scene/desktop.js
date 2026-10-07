// Built by ghost-theme/build.py from vhs-tv sources. Do not edit here.
const CHANNEL_BASE = (window.__BM && window.__BM.assetBase) ? window.__BM.assetBase + "channels/" : new URL("./channels/", import.meta.url).href;
const SCENE_BASE = (window.__BM && window.__BM.assetBase) || new URL("./", import.meta.url).href;
// start page: the #hash, or (room on every page) the page this URL stands for
const BM_HASH = () => location.hash.slice(1) || (window.__BM && window.__BM.pageAt ? window.__BM.pageAt(location.pathname) : "");

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createCity as cityDepth } from "./city/variants/depth.js";   // the living city, with depth: the only window since Felix's 16:21Z
import { nightLife } from "./city/lib/night.js";
import { createNotepad } from "./notepad/notepad.js";
import { winUV, winPaint } from "./winframe/winframe.js";   // the window's frame and sill: an atlas of their own, clean satin paint (thread "Window frame texture")
import { createCredits } from "./credits/credits.js";   // the credits: the open card of the card file behind the desk lamp, floating up   // Work's card: the yellow pad on the desk, floating up with a tape's notes
import { pcCase, pcCaseLip } from "./pccase/case.js";   // the old PC's plastic up close: smooth baked light, a moulded stipple (thread "PC screen look")
import { createVCRDoor } from "./vcrdoor/vcrdoor.js";   // the VCR's cassette flap: a tape pushes it open, it springs shut behind it
import { createMusic, createCDPlayer } from "./cdplayer/cdplayer.js";   // the music, and the CD player's close-up
import { createCalculator } from "./calc/calc.js";   // the desk calculator: a click lifts it, and it works
import { createPCKeys } from "./pckeys/pckeys.js";   // the old PC's keyboard: the keys you type press its caps
import { createCoffee } from "./coffee/coffee.js";   // the coffee on the desk: a click is a sip
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
// the wall clock: a click takes its battery out (clock/clock.js; a room without it keeps its old background, ticking and all)
let clockMod=null; const clockP=import("./clock/clock.js").then(m=>{ clockMod=m; },e=>console.warn("clock",e));

const $ = s => document.querySelector(s);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fontsReady = Promise.all(["600 70px Caveat","44px VT323","900 150px Archivo","900 condensed 80px Archivo","800 60px Archivo"].map(f=>document.fonts.load(f))).catch(()=>{});

// ======================================================================= content
// About and Online live on the old PC, Work and Posts on the TV. Old links to the Contact and GitHub cards land on Online.
const PAGES = ["home","about","work","posts","online"], PAGE_ALIAS={twitter:"online",github:"online",contact:"online"};
const atPC=page=>page==="about"||page==="online";
// the monitor's six buttons: its three inputs, then three picture checks from a studio monitor (tvButton)
const TV_BTN=["home","work","posts","underscan","hvdelay","blueonly"], TV_LABEL=["HOME","WORK","POSTS","UNDERSCAN","H/V DELAY","BLUE ONLY"];
const MON={underscan:false,hvdelay:false,blueonly:false}, MONK={us:0,fx:1.07,fy:1.1};
// How far the raster reaches over the glass (the glass is this many rasters wide and high). Pages of text keep the whole
// raster in sight, a little inside the glass. A film fills the tube, its edges just past the glass's, as a TV's are: a
// channel asks for that with `fill: true` (the welcome film does).
const RASTER={page:[1.07,1.1],fill:[.99,.99]}; let rasterFill=false;
// the page's settings, listed and set in OPTIONS on the old PC (#options goes there); the picks stay in this browser.
// The TV at home (the penguin film), the window (the living city, with depth), the music (Deep Field), the old PC (BASIC)
// and every tape play their first cut. The Anthropic tape's four cuts and their line here went when it became Anthropic's
// own ad (Felix, 27 Sep 02:40Z: "remove all other tapes (and therefore the option to select a tape, too)"): CH_SRC.
const OPT_DEFS={};
Object.assign(OPT_DEFS,{
  // the home film's own music (Felix, 22:56Z: "optional music in the tv"), on unless switched off here; it switches live,
  // and `now` says whether it is on this visit (the CD player used takes the music until its ■: cdClaim, cdGive)
  tv_music:{label:"TV · Film music",choices:[["on","On"],["off","Off"]],now:()=>filmMusic?"on":"off",
    live:v=>{ filmMusic=v==="on"; cdTook=false; if(!filmMusic) filmMusT=-1e9; try{ homeInst?.setMusic?.(filmMusic); }catch(e){} }},
// >>> perf/phone: opts
  // how many pixels the room draws, and a frame-rate line along the top edge (vhs-tv/perf/phone), on every screen. Full is
  // the room as it was; Auto starts there and draws fewer pixels once the frames drag; Smooth draws fewer from the start.
  // A phone starts at Auto, any other screen at Full (Felix, 28 Sep 16:39Z, "2 pls" to "Phones start in Auto instead of
  // Full"): def is this screen's default, which OPT and saveOpt go by, so a phone's pick of Full is kept. phone is phone
  // mode (PQ.on), taken here once. (The ids are from when both lines were for phones only: a pick made then carries over.)
  phone_gfx:{label:"Graphics",choices:[["full","Full"],["auto","Auto"],["smooth","Smooth"]],now:()=>PQ.level,live:v=>gfxLevel(v),
    phone:/[?&]touch=1/.test(location.search)||matchMedia("(hover: none) and (pointer: coarse)").matches&&Math.min(innerWidth,innerHeight)<540,
    get def(){ return this.phone?"auto":"full"; }},
  phone_fps:{label:"Frame rate",choices:[["off","Hidden"],["on","Shown"]],now:()=>PQ.meter?"on":"off",live:v=>fpsLine(v==="on")},
// <<< perf/phone: opts
});
// Only the picks that differ from the defaults are kept (v:2), so a later change of a default reaches everyone who didn't
// pick. Picks of options that are gone (TV · Home, Window, Music, Old PC, the tapes) are left out, and the next save drops them.
const OPT=(()=>{ let o={}; try{ o=JSON.parse(localStorage.getItem("bm-options")||"{}")||{}; }catch{} const r={};
  for(const [k,d] of Object.entries(OPT_DEFS)) r[k]=d.choices.some(c=>c[0]===o[k])?o[k]:d.def??d.choices[0][0]; return r; })();
function saveOpt(){ try{ const o={v:2}; for(const [k,d] of Object.entries(OPT_DEFS)) if(OPT[k]!==(d.def??d.choices[0][0])) o[k]=OPT[k]; localStorage.setItem("bm-options",JSON.stringify(o)); }catch{} }
const OPEN_OPTIONS=location.hash==="#options";
// A visit that comes in on a page's own link (the site's menu on a post, a shared #online) opens in the middle of the room, as a
// visit to home does, and then goes to that page the way its button sends you from home (Felix, 16:43Z: "can the camera start
// in the middle of the room and then pan over to the computer? Same for Posts, Work, and About"); #options walks over to the
// PC the same way. ENTRY is that page ("options" for #options) until the camera sets off (entryGo): a page picked before then (a
// button, a key, Back) takes its place, and a close-up or a walk to the PC drops it (entryDrop). Reduced motion goes straight there.
let ENTRY=reduce?null:OPEN_OPTIONS?"options":(p=>p!=="home"?p:null)(pageFromUrl());
// The Work card's words: one sentence and one link a tape (vhs-tv/work-blurbs.json), and a stippled title card for a tape
// whose channel hasn't loaded. The jobs first, newest on top of their stack, then the projects.
const TAPES = [
  // --- EXPERIENCE (Internships) ---
  {t:"SIFS Forensics", y:"2026", d:"Forensic Science Intern exploring the practice of forensic investigation, questioned documents, fingerprint analysis, and evidence examination.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#b5532b", ink:"#fff1e6", big:["SIFS","LAB"], shell:"clear-orange"},
  {t:"Beyond Evidence", y:"2025", d:"Legal & Forensic Intern at Supreme Court of India · Examining forensic inquiry, legal practice, chain-of-custody, and courtroom presentation.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#8a2020", ink:"#fef4f4", big:["BEYOND","LAW"], shell:"clear-red"},

  // --- EDUCATION ---
  {t:"KR Mangalam Univ", y:"2024–2027", d:"B.Sc. (Hons) Forensic Science · In-depth study of criminalistics, evidence processing, forensic toxicology, questioned documents, and jurisprudence.", link:["krmangalam.edu.in","https://www.krmangalam.edu.in/"], bg:"#1a3b5c", ink:"#e6f2ff", big:["KRMU","DEPT"], shell:"clear-blue"},
  {t:"KSK Academy", y:"2010–2024", d:"Senior Secondary Schooling · Foundation in science, analytical thinking, curiosity for computing, mathematics, and investigative observation.", link:["kskacademy.com","https://kskacademy.com/"], bg:"#2b4c3f", ink:"#eafaf1", big:["KSK","ACAD"], shell:"clear-green"},

  // --- PROJECTS ---
  {t:"Pratyaksh-AI", y:"2024–now", d:"A forensic AI platform covering cyber forensics, questioned documents, and fingerprint analysis. Patent application filed · 2024/0103322A.", link:["pratyaksh-ai.vercel.app","https://pratyaksh-ai.vercel.app/"], bg:"#0e3845", ink:"#82e9ff", big:["PRATYAKSH","AI"], shell:"clear-smoke"},
  {t:"Aurex", y:"2024–now", d:"A communication and collaboration platform designed around cryptography, protected storage, and authenticated interactions.", link:["aurexcyber.vercel.app","https://aurexcyber.vercel.app/"], bg:"#381552", ink:"#f3d8ff", big:["AUREX"], shell:"clear-purple"},
  {t:"CyberRepo Hub", y:"2024–now", d:"Curated GitHub repositories and tools across cybersecurity, AI/ML, web development, DevOps, and systems. A multi-ecosystem discovery hub curated by @Velqore.", link:["cyberrepo.dpdns.org","https://cyberrepo.dpdns.org/"], bg:"#143a28", ink:"#93f5c7", big:["CYBER","REPO"], shell:"clear-green"},
  {t:"OSINT Research", y:"2024–now", d:"Open-source intelligence investigations, public record correlation, digital footprints, and OSINT graph analysis.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#2d3748", ink:"#edf2f7", big:["OSINT","DESK"], shell:"clear-smoke"},
  {t:"Forensics Toolkit", y:"2025–now", d:"Python & Node command-line utilities for disk artifact extraction, file signature verification, and timestamp analysis.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#744210", ink:"#fefcbf", big:["FORENSIC","TOOL"], shell:"clear-yellow"},
  {t:"CryptoVault", y:"2024–now", d:"Client-side encrypted key-value store utilizing WebCrypto AES-GCM and authenticated key derivation.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#234e52", ink:"#e6fffa", big:["CRYPTO","VAULT"], shell:"clear-blue"},
  {t:"CaseFiles 95", y:"2025–now", d:"Retro forensic workstation simulator capturing 1990s law enforcement database interfaces and cataloging.", link:["github.com/Velqore","https://github.com/Velqore"], bg:"#004d40", ink:"#ffffff", big:["CASE","FILES"], shell:"clear-smoke"},
];
const EXP = 2;    // Experience (SIFS Lab, Beyond Evidence)
const EDU = 2;    // Education (KR Mangalam Univ, KSK Academy)
const JOBS = EXP + EDU; // the left-hand stack on the shelf: 4 tapes
const CH_IDS = ["sifs","beyond","krmu","ksk","pratyaksh","aurex","cyberrepo","osint","toolkit","cryptovault","casefiles"];
const CH_SRC = {};
const channels = [];
const NOMUSIC = new Set(["slack","slack/xray","electron","clippy","lmb","lmb/hero","windows95","macintosh"]);
const chPath = p => NOMUSIC.has(p)?p+".nomusic":p;
const chLoad = p => import(`${CHANNEL_BASE}${chPath(p)}.js`).catch(e=>{ if(chPath(p)===p) throw e; return import(`${CHANNEL_BASE}${p}.js`); });
const chReady = Promise.all(CH_IDS.map((id,i)=>{
  const src = CH_SRC[id];
  if(!src) return Promise.resolve();
  return chLoad(src).then(m=>{ channels[i]=m.default; }).catch(()=>{});
}));
const POSTS = (window.__BM&&window.__BM.posts&&window.__BM.posts.length)?window.__BM.posts:[
  {"t": "Forensic Science in the Digital Era", "u": "https://www.linkedin.com/in/ayush-tyagi-96b3b7350/recent-activity/all/", "d": "02 Oct 2026"},
  {"t": "Patent 2024/0103322A: AI in Questioned Docs", "u": "https://pratyaksh-ai.vercel.app/", "d": "15 Aug 2026"},
  {"t": "Internship Notes: Investigation at SIFS", "u": "https://www.linkedin.com/in/ayush-tyagi-96b3b7350/recent-activity/all/", "d": "10 Jul 2026"},
  {"t": "Beyond Evidence: Supreme Court Forensic Practice", "u": "https://www.linkedin.com/in/ayush-tyagi-96b3b7350/recent-activity/all/", "d": "25 Aug 2025"},
  {"t": "Building Aurex: Cryptography & Secure Storage", "u": "https://aurexcyber.vercel.app/", "d": "14 Jan 2025"},
  {"t": "OSINT Techniques for Forensic Investigators", "u": "https://www.linkedin.com/in/ayush-tyagi-96b3b7350/recent-activity/all/", "d": "18 Nov 2024"},
  {"t": "CyberRepo Hub: Curating Developer & Security Tools", "u": "https://cyberrepo.dpdns.org/", "d": "05 Sep 2024"},
  {"t": "Why Observation is Everything: Connecting Details", "u": "https://www.linkedin.com/in/ayush-tyagi-96b3b7350/recent-activity/all/", "d": "20 Jun 2024"}
];
const ONSITE=true;
const postHref = p => ONSITE ? new URL(p.u, location.href).pathname:p.u;
// the teletext's subpage (8 posts each), when it last turned, and the row pointed at or tabbed to (-1: none)
let postSub=0, ttxSubT=0, ttxHover=-1, ttxFocus=-1;
// how far you got in a post: the post pages keep it in localStorage (same origin on the real site) as {slug:{f:0..1,s,t}}
let seen={};
function readSeen(){ try{ seen=JSON.parse(localStorage.getItem("velqore.tape")||"{}")||{}; }catch{ seen={}; } }
readSeen(); addEventListener("storage",e=>{ if(e.key==="velqore.tape") readSeen(); });
const postSlug=p=>p.slug||String(p.u||"").replace(/[?#].*$/,"").split("/").filter(Boolean).pop()||"";
function seenTag(p){ const f=+seen[postSlug(p)]?.f; return !(f>=.02)?"":f>=.97?"SEEN":Math.round(f*100)+"% SEEN"; }
// a host that routes posts itself (window.__BM.openPost) gets the post; otherwise the room goes to its URL
function openPost(i){
  const p=POSTS[i]; if(!p) return;
  if(!ONSITE||PHONE()){ const w=window.open(p.u,"_blank"); if(w){ w.opener=null; return; }
    return postLink(p); }   // popups refused (the artifact viewer): a real link at the pointer, one more click follows it
  state.glitch=1; staticBurst(.35,.4); click("relay",.05);
  setTimeout(()=>{ const h=window.__BM?.openPost; if(typeof h==="function") h(p); else location.href=postHref(p); },380);
}
let lastPtr={x:0,y:0}, plinkT=0;
addEventListener("pointerdown",e=>{ lastPtr={x:e.clientX,y:e.clientY}; const l=document.getElementById("plink"); if(l&&!l.hidden&&e.target!==l) l.hidden=true; },{capture:true,passive:true});
function postLink(p){
  const l=document.getElementById("plink"); l.href=p.u; l.textContent="OPEN · "+p.t+" ↗"; l.hidden=false;
  l.style.left=lastPtr.x+"px"; l.style.top=lastPtr.y+"px"; l.style.transform=lastPtr.x+l.offsetWidth+28>innerWidth?"translate(calc(-100% - 12px),14px)":"";
  clearTimeout(plinkT); plinkT=setTimeout(()=>{ l.hidden=true; },8000);
}

// ======================================================================= state
const state = { page:"home", sheet:null, power:1, powerT:-1e9, glitch:0, pendingPage:null, tape:-1, tapeState:"none", tracking:.15, volume:.5, chroma:.85, volShow:0, osd:"" };

// ======================================================================= the signal: 2D canvas painted per page
const SRC_W=1024, SRC_H=768, K=SRC_W/960;
const src=document.createElement("canvas"); src.width=SRC_W; src.height=SRC_H;
const sx=src.getContext("2d");
function rng(seed){return()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6D2B79F5|0,((seed^seed>>>7)>>>0)/4294967296))}
const stills=new Map();
function stipple(key,{bg,ink,big,sub,seed=7}){
  if(stills.has(key)) return stills.get(key);
  const L=document.createElement("canvas"); L.width=SRC_W; L.height=SRC_H;
  const g=L.getContext("2d"); g.scale(K,K); const r=rng(seed);
  g.fillStyle=bg; g.fillRect(0,0,960,720); g.fillStyle=ink;
  for(let i=0;i<26000;i++){
    const x=r()*960,y=r()*720,dx=(x-560)/300,dy=(y-420)/300,d=Math.hypot(dx,dy),edge=Math.max(0,y/720-.55)*1.6;
    const p=d<1?(1-d)*.55*(.4+.6*Math.max(0,-(dx+dy)*.7+.3)):.05+edge*.5;
    if(r()<p){const s=r()<.08?1.8:1.1;g.fillRect(x,y,s,s)}
  }
  g.strokeStyle=ink;g.lineWidth=2;g.globalAlpha=.25;g.beginPath();g.arc(560,420,300,0,7);g.stroke();g.globalAlpha=1;
  const size=big.length>1?150:(big[0].length>7?130:170);
  g.font=`900 ${size}px Archivo`; try{g.fontStretch="condensed"}catch{}
  big.forEach((w,i)=>g.fillText(w,58,220+i*size*.9));
  g.font="32px VT323";g.globalAlpha=.85;g.fillText(sub,62,262+(big.length-1)*size*.9);g.globalAlpha=1;
  L.orbits=true; L.ink=ink;
  const a=document.createElement("canvas");a.width=a.height=1;const ac=a.getContext("2d");ac.drawImage(L,0,0,1,1);
  const px=ac.getImageData(0,0,1,1).data; L.avg=new THREE.Color(`rgb(${px[0]},${px[1]},${px[2]})`);
  stills.set(key,L); return L;
}
function orbits(ink,t){
  sx.save();sx.strokeStyle=ink;sx.lineCap="round";
  [[560,420,430,120,-.32,5],[560,420,380,150,.42,3],[560,400,470,70,.08,2]].forEach(([x,y,a,b,rot,w],i)=>{
    sx.lineWidth=w;sx.setLineDash([.1,14+i*6]);sx.lineDashOffset=-(t*.02*(i%2?1:-1));sx.beginPath();sx.ellipse(x,y,a,b,rot,0,7);sx.stroke();});
  sx.restore();
  sx.save();sx.translate(820+Math.sin(t*.0004)*20,110);sx.rotate(t*.0003);sx.fillStyle=ink;sx.beginPath();
  for(let k=0;k<8;k++){const R=k%2?5:42+Math.sin(t*.003)*6,a=k*Math.PI/4;sx.lineTo(Math.cos(a)*R,Math.sin(a)*R)}sx.fill();sx.restore();
}
function osd(text,x,y,align="left",size=44){sx.font=`${size}px VT323`;sx.textAlign=align;sx.fillStyle="#f2f2f2";sx.shadowColor="rgba(0,0,0,.65)";sx.shadowOffsetX=3;sx.shadowOffsetY=3;sx.fillText(text,x,y);sx.shadowColor="transparent";sx.textAlign="left"}
function wrap(g,text,x,y,maxW,lh){const words=text.split(" ");let line="",yy=y;for(const w of words){const test=line?line+" "+w:w;if(g.measureText(test).width>maxW&&line){g.fillText(line,x,yy);line=w;yy+=lh}else line=test}g.fillText(line,x,yy);return yy}
const t0=performance.now();
let pageT=performance.now(); // when the current page started, for typing effects
// It is always night in the room, whenever you come: its clocks (the wall clock, the VCR's display, the teletext) start at
// 23:04 when the page opens and run on from there
const NIGHT0=Date.now(), nightMs=(now=Date.now())=>((23*60+4)*6e4+now-NIGHT0)%864e5;
function nightClock(sec){ const t=nightMs(), p=n=>String(n).padStart(2,"0"); return p(Math.floor(t/36e5))+":"+p(Math.floor(t/6e4)%60)+(sec?":"+p(Math.floor(t/1e3)%60):""); }

const chCanvas=document.createElement("canvas"); chCanvas.width=SRC_W; chCanvas.height=SRC_H;
const chCtx=chCanvas.getContext("2d");
let chInst=null, chIdx=-1, chAvgN=0, chAvg=new THREE.Color("#222"), chT0=0;
const avgC=document.createElement("canvas"); avgC.width=avgC.height=1; const avgX=avgC.getContext("2d",{willReadFrequently:true});
function chStart(i){
  chStop(); const c=channels[i]; if(!c||!c.mount) return;
  try{ chCtx.setTransform(1,0,0,1,0,0); chCtx.clearRect(0,0,SRC_W,SRC_H);
    chInst=c.mount({canvas:chCanvas,ctx:chCtx,width:SRC_W,height:SRC_H,audio:A.ctx?{ctx:A.ctx,out:A.prog}:null}); chIdx=i; chT0=performance.now(); chLastT=0; chPaused=false; }
  catch(e){ console.error("channel",CH_IDS[i],e); chInst=null; }
}
function chStop(){ if(chInst){ try{ chInst.stop(); }catch(e){} } chInst=null; chIdx=-1; chPaused=false; }
function chInput(ev){ if(chInst&&chInst.input){ try{ chInst.input(ev); }catch(e){} return true; } return false; }
let chPaused=false;
function chPause(p){ p=p||document.hidden; /* a hidden tab never plays: it gets no frames */ if(!chInst||p===chPaused) return; chPaused=p; chLastT=0; chInput({type:p?"stop":"play"}); }
// a tape's name and words on the card are TAPES' (one sentence, one link); its channel brings the picture, the shell and the spine
function tapeInfo(i){ const t=TAPES[i]||{t:"",y:"",d:""}; return {t:t.t,y:t.y,d:t.d,links:t.link?[t.link]:[]}; }
let chLastT=0;
// The home program. At home with no tape in, the TV plays the welcome tape (channels/intro.js, made by vhs-tv/voices).
// The room opens on the title card, and the tape comes in HOME_DELAY after the room
// starts to fade in, with a flick of static and the VCR's PLAY (Felix, 00:21Z: "with a bit of delay after opening the room").
// It loops on its own clock and holds its place, picture and voice, while you're
// away from home, the TV is off or the tab is hidden; back home it carries on. Work, when you come to it from home with no
// tape playing, isn't away (Felix, 03:34Z: "picking up the notepad shouldn't immediately stop the home video"): the program
// plays on there, as a VCR passes the TV's channel through until it plays a tape, and gives way once a tape goes in and
// starts (homeCarry). A visit that starts at Work, or comes to it from Posts, has the VCR's blue screen as before.
// Since v37 it also waits for the visitor's first click or key (userT, set by gesture and setSound), which is what lets a
// browser play sound, so the film starts from the top with its voice (Felix, 22:38Z: "That way there'd be sound when the
// home video starts playing"). Until then the card's VCR display blinks PRESS PLAY; the room itself keeps moving. A click
// before the room is in keeps the delay above.
// The film: the penguin film under Felix's own designed voice (23:32Z), playing intro/penguin.webm or .mp4 in a hidden
// <video>. Since v32 it is the film remade in Blender with Felix's additions (a desk on the ice, the route flags, the blog
// sign: thread "Recreate the penguin home film"; Felix, 16:21Z: "That should be the home video"). It asks to fill the tube.
const HOME_PROG="avatar";
const homeCanvas=document.createElement("canvas"); homeCanvas.width=SRC_W; homeCanvas.height=SRC_H;
const homeCtx=homeCanvas.getContext("2d"), homeAvg=new THREE.Color("#222");
let homeMod=null, homeInst=null, homeKey="", homeT=0, homeOn=false, homeLastT=0, homeSnd=false, homeAvgN=0;
let filmMusic=OPT.tv_music!=="off", filmMusT=-1e9, cdTook=false;   // the film's own music wanted (OPTIONS, cdClaim, cdGive); when it last sounded; whether the CD player took it
const HOME_DELAY=4000, HOME_CUE=250; let revealT=Infinity, homeStartT=-1e9, userT=Infinity;   // revealT: when the room's fade-in started; userT: the first click or key
function homeStop(){ if(homeInst){ try{ homeInst.stop(); }catch(e){} } homeInst=null; homeOn=false; }
function homePause(){ if(homeInst&&homeOn){ homeOn=false; try{ homeInst.input?.({type:"stop"}); }catch(e){} } }
// About and Online are on the old PC, not the TV: the TV keeps what it had on, a tape or the home program playing on and a
// page staying as it was (Felix, 05:34Z: "when selecting "about me", the tv should not swap playback/tapes/video"). pcTV is
// the page whose picture it keeps meanwhile; a visit that starts on the PC has the home program.
// The tapes take turns (vhs-tv/tapecycle; Felix, 30 Sep 02:02Z: "after the home tape played for the first time, we should
// cycle through the other tapes, one by one"). Left at home, the TV plays the home film through, then switches itself to
// the VCR: the shelf's tapes go in one after another, in the shelf's order, each for one round of its loop, its cassette
// back on its stack as the next comes off. After the last the TV goes back to the home film, from the top, and round again.
// The visitor's page stays home throughout: tvPage says the VCR is on (CYC.tv), so the picture, the input LEDs, the VCR's
// display, the notepad and the music rules (the CD holds for Anthropic's ad) follow as they do for a tape picked at Work.
// The turns are home's: they go on while the TV is on home's page (from the old PC too, come from home). The menu and the
// TV's buttons pick the TV's input as before: Work keeps the tape that is on (it goes round there, its notes up), Posts
// has the teletext, and HOME, pressed at home or come back to, has the home film; the next tape in line takes its turn
// once the film has played through again. With the TV off or in a hidden tab they wait.
// They end for the visit (cycOff) once the visitor picks a tape or presses a button of the VCR (play, stop, the skips,
// eject): from there the room is as it was. ?cycle=0 starts without them, and so does an automated browser (the tests:
// ?cycle=1, or __scene.cycle.on=true).
// Lengths: a drawn tape keeps its own clock from the dt it is given, so the page counts the same dt against the tape's
// length (CYC_LEN, in seconds; a module may say its own: length). The two films say their clock, and a fall back to the
// top is their end; a tape whose clock stands still for 20 s (a film that doesn't come) gives way too.
const CYC={on:/[?&]cycle=1/.test(location.search)||!navigator.webdriver&&!/[?&]cycle=0/.test(location.search),tv:false,i:-1,t:0,c:-1,still:0,idle:0,hold:0,press:-1e9};
const CYC_LEN={anthropic:90.04,notion:43.2,stripe:32,slack:43,microsoft:42.6,electron:59,fiddle:45.5,clippy:48,lmb:59.4,windows95:40,macintosh:56}, CYC_DEF=60, CYC_FILM=116.24, CYC_BLACK=new THREE.Color("#000");
let homeCarry=false, pcTV="home"; const tvBase=()=>atPC(state.page)?pcTV:state.page;   // the page the TV is on, the tapes' turns aside
const tvPage=()=>{ const p=tvBase(); return p==="home"&&CYC.tv?"work":p; };   // the page whose picture the TV shows
const homeOnTV=()=>{ const p=tvPage(); return p==="home"||(p==="work"&&homeCarry); };   // the TV shows the home program
const tvProg=()=>homeOnTV()?"home":tvPage();
const cycLen=i=>+channels[i]?.length||CYC_LEN[CH_IDS[i]]||CYC_DEF;
const cycHere=()=>tvBase()==="home"&&!!state.power;   // the TV shows it from home: it may move on
const cycHold=now=>now<CYC.hold&&!!state.power&&state.volume>0;   // the CD player holds through a change to a program with music of its own
function cycFlick(){ pageT=performance.now(); state.glitch=1; click("relay",.05); staticBurst(.32,.35); setLeds(); }   // the TV changes its input, as for a page
// has the program played through? c: its clock, where it says one; dt: this frame's step (ms); stall: how long that clock
// may stand still (s); go: it would move on now (one that stays on is counted to its very end, and on from there)
function cycDone(c,dt,len,stall,go){
  const was=CYC.c; CYC.t+=dt/1000;
  if(typeof c==="number"){ CYC.c=c;
    if(was>5&&c<3&&c<was-5){ CYC.t=CYC.still=0; return true; }   // back at its top
    CYC.still=c===was?CYC.still+dt/1000:0; if(CYC.still<=stall) return false;
    CYC.t=CYC.still=0; return true; }
  if(CYC.t<len-(go?.05:0)) return false;   // (just short of its end, so the tape's first picture doesn't show again)
  CYC.t=go?0:CYC.t-len; return true;
}
// the home film's frame: true once it has played through and a tape takes its place
function cycFilm(dt){ if(!CYC.on||HOME_PROG==="avatar") return false; CYC.hold=0; const go=cycHere(); return cycDone(homeInst.clock,dt,CYC_FILM,Infinity,go)&&go&&cycNext(); }
// the playing tape's frame: true once it has played through and the next program takes its place
function cycTape(dt){ if(!CYC.on||!CYC.tv||chPaused) return false; CYC.hold=CYC.idle=0; const go=cycHere(); return cycDone(chInst.clock,dt,cycLen(chIdx),20,go)&&go&&cycNext(); }
// the next program's turn: the tape after the one that had the last (one that loaded, with a cassette in the scene); after
// the shelf's last tape the home film, and after the film the first tape again
function cycNext(){
  if(!CYC.on||tapeAnim||queue.length) return false;
  const n=CH_IDS.length, from=k=>{ while(k<n&&!(channels[k]?.mount&&tapeGroups[k])) k++; return k; };
  let j=from(CYC.i+1); if(j>=n&&!CYC.tv&&(j=from(0))>=n) return false;   // (no tape to play: the film goes round)
  const has=state.tape>=0;
  if(j>=n){ CYC.i=-1; if(filmMusic) CYC.hold=performance.now()+3000;
    const home=()=>{ if(CYC.on&&CYC.tv) cycHome(tvBase()==="home"); };
    if(has) eject(home); else home(); return true; }
  if(!CYC.tv){ CYC.tv=true; cycFlick(); }
  CYC.i=j; CYC.t=CYC.still=CYC.idle=0; CYC.c=-1; if(channels[j].musicTitle) CYC.hold=performance.now()+3000;
  // (a pick of the visitor's meanwhile takes its place; the TV switched away from the turns meanwhile: it keeps its turn)
  const put=()=>{ if(CYC.i!==j) return; if(CYC.on&&CYC.tv) insert(j); else CYC.i=j-1; };
  if(has) eject(put); else put(); return true;
}
// home has the home film again: after the last tape, HOME pressed at home while a tape has its turn, or the TV's page
// leaving home (quietly then: go switches the picture). A tape in the VCR waits there, as one does at home
function cycHome(flick){ CYC.tv=false; CYC.hold=0; CYC.t=CYC.still=0; CYC.c=-1; if(flick){ cycFlick(); if(chInst) chPause(true); } }
// the visitor took over the VCR: no more turns this visit, and home has the home film again. stay: a scene skipped, and
// that tape stays on the TV at home (until HOME, Work or Posts)
function cycOff(stay){ CYC.on=false; CYC.hold=0; if(CYC.tv&&!stay) cycHome(true); }
// (every frame) the VCR has had nothing playing for the TV at home for 6 s (a tape that didn't start): the next one
function cycWatch(dt){
  if(!CYC.on||!CYC.tv||tapeAnim||state.tapeState==="loading"||!cycHere()||(state.tapeState==="playing"&&chInst&&chIdx===state.tape)){ CYC.idle=0; return; }
  if((CYC.idle+=dt)>6){ CYC.idle=0; cycNext(); } }
function homeMount(){
  homeStop(); if(!A.ctx) audioInit(true); homeSnd=!!A.ctx;
  try{ homeCtx.setTransform(1,0,0,1,0,0); homeCtx.clearRect(0,0,SRC_W,SRC_H);
    homeInst=homeMod.mount({canvas:homeCanvas,ctx:homeCtx,width:SRC_W,height:SRC_H,audio:homeSnd?{ctx:A.ctx,out:A.prog}:null,music:filmMusic}); homeOn=true; }
  catch(e){ console.warn("home program",e); homeInst=null; homeMod=null; }
}
function homeFrame(t){
  if(!homeKey){ homeKey=HOME_PROG;
    import(new URL("./channels/" + HOME_PROG + ".js", import.meta.url).href).then(m=>{ if(!homeMod&&m.default?.mount) homeMod=m.default; }).catch(e=>console.warn("home program",e)); }
  if(!homeMod||!state.power) return false;
  if(!homeInst){ const n=performance.now(); if(n-revealT<HOME_DELAY||n-userT<HOME_CUE) return false;   // (no click yet: userT is Infinity, and it waits)
    homeMount(); if(!homeInst) return false;
    homeStartT=performance.now(); state.glitch=Math.max(state.glitch,.8); staticBurst(.22,.3); }
  if(!homeOn){ homeOn=true; homeLastT=0; try{ homeInst.input?.({type:"play"}); }catch(e){} }
  const dt=homeLastT?Math.min(100,t-homeLastT):16; homeLastT=t; homeT+=dt;
  try{ homeCtx.save(); homeInst.frame(homeT,dt); homeCtx.restore(); }catch(e){ console.warn("home program",e); homeStop(); homeMod=null; return false; }
  if(cycFilm(dt)){ sx.fillStyle="#000"; sx.fillRect(0,0,SRC_W,SRC_H); return true; }   // played through, and the tapes take their turns (tapecycle)
  sx.drawImage(homeCanvas,0,0);
  if((homeAvgN++&15)===0){ tvAvg(homeCanvas,homeAvg); }
  return true;
}
const PAINT = {
  home(t){ if(homeOnTV()&&homeFrame(t)){ rasterFill=!!homeMod?.fill; sx.setTransform(K,0,0,K,0,0); if(!CYC.tv&&t-Math.max(pageT,homeStartT)<2500){ osd("▶ PLAY",60,82); osd("CH 00",900,82,"right"); } return homeAvg; }
    const s=stipple("home",{bg:"#15206b",ink:"#82e9ff",big:["AYUSH","TYAGI"],sub:"FORENSICS & SOFTWARE · CH 00"}); sx.drawImage(s,0,0); sx.setTransform(K,0,0,K,0,0); orbits(s.ink,t);
    if(userT<Infinity||t-revealT<HOME_DELAY) osd("▶ PLAY",60,82); else if(reduce||Math.floor(t/600)%2===0) osd("PRESS PLAY",60,82);   // the film waits for a click or a key
    osd("CH 00",900,82,"right"); return s.avg; },
  work(t){
    if(homeCarry) return PAINT.home(t);   // come from home, and no tape has started yet: the home program plays on
    if(state.tape>=0&&state.tapeState==="playing"&&chInst&&chIdx===state.tape){
      const dt=chLastT?Math.min(100,t-chLastT):16; chLastT=t;
      try{ chCtx.save(); chInst.frame(t-chT0,dt); chCtx.restore(); }catch(e){ console.error(e); chStop(); }
      if(chInst&&cycTape(dt)){ sx.fillStyle="#000"; sx.fillRect(0,0,SRC_W,SRC_H); return CYC_BLACK; }   // played through: the next program's turn (tapecycle)
      sx.drawImage(chCanvas,0,0); rasterFill=!!channels[chIdx]?.fill; sx.setTransform(K,0,0,K,0,0);   // (a film fills the tube)
      if(t-pageT<2500) osd(state.osd||"▶ PLAY",60,82);
      if((chAvgN++&15)===0){ tvAvg(chCanvas,chAvg); }
      return chAvg;
    }
    if(state.tape>=0&&state.tapeState==="playing"){
      const c=TAPES[state.tape]; const s=stipple("tape"+state.tape,{bg:c.bg,ink:c.ink,big:c.big,sub:c.y.toUpperCase()+"  ·  "+c.t.toUpperCase(),seed:state.tape+11});
      sx.drawImage(s,0,0); sx.setTransform(K,0,0,K,0,0); orbits(s.ink,t); osd(state.osd||"▶ PLAY",60,82); osd("TAPE "+String(state.tape+1).padStart(2,"0"),900,82,"right");
      const sec=Math.floor((t-pageT)/1000); osd(`SP  0:${String(Math.floor(sec/60)%60).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`,900,668,"right"); return s.avg;
    }
    // the VCR's blue screen
    sx.setTransform(K,0,0,K,0,0); sx.fillStyle="#1733b5"; sx.fillRect(0,0,960,720);
    const held=state.tape>=0&&state.tapeState==="stopped";
    osd(state.tapeState==="loading"?"LOADING…":"■ STOP",60,82); osd(held?"TAPE "+String(state.tape+1).padStart(2,"0"):"VIDEO",900,82,"right");
    if(held){ osd(tapeInfo(state.tape).t.toUpperCase(),480,380,"center",64); osd("PRESS PLAY",480,440,"center",34); }
    else { if(Math.floor(t/700)%2||state.tapeState==="loading") osd(state.tapeState==="loading"?"":"INSERT TAPE",480,380,"center",64);
      osd("PICK A TAPE FROM THE DESK",480,440,"center",34); }
    return new THREE.Color("#1733b5");
  },
  posts(t){ return teletext(t); },
};
// Teletext: page 100 lists the posts, with the four Fastext keys at the bottom
const TT_DATE=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",weekday:"short",day:"2-digit",month:"short"});
const FASTEXT=["about","work","home","online"];
function teletext(t){
  sx.setTransform(K,0,0,K,0,0); sx.fillStyle="#000"; sx.fillRect(0,0,960,720);
  const CW=24, RH=28.8, col=["#000","#ff2a2a","#2aff4a","#ffff2a","#2a3aff","#ff2aff","#2affff","#ffffff"];
  const cell=(c,r,txt,fg=7,bg=null,dbl=false)=>{ if(bg!==null){sx.fillStyle=col[bg];sx.fillRect(c*CW,r*RH,txt.length*CW,RH*(dbl?2:1)+.5)}
    sx.fillStyle=col[fg]; sx.save(); sx.translate(c*CW,(r+1)*RH-6+(dbl?RH:0)); if(dbl) sx.scale(1,2); sx.font="34px VT323";
    for(let i=0;i<txt.length;i++) sx.fillText(txt[i],i*CW+1,dbl?-3:0); sx.restore(); };
  const now=new Date(), hms=nightClock(true);
  const P=Object.fromEntries(TT_DATE.formatToParts(now).map(q=>[q.type,q.value])), dm=`${P.weekday.slice(0,3)} ${P.day} ${P.month.slice(0,3)}`;
  cell(0,0," P100",7); cell(6,0,"NIGHTFAX",3); cell(17,0,"100",7); cell(21,0,dm,7); cell(32,0,hms,3);
  // banner with mosaic blocks
  sx.fillStyle=col[4]; sx.fillRect(0,RH*1.2,960,RH*3.2);
  const r=rng(5); sx.fillStyle=col[6];
  for(let c=0;c<40;c++) for(let s=0;s<6;s++){ if((c<5||c>32)&&r()<.55){ sx.fillRect(c*CW+(s%2)*CW/2,RH*1.4+Math.floor(s/2)*RH*.9,CW/2-1,RH*.9-1);} }
  cell(9,1.9,"NIGHTFAX",3,null,true); cell(20,2.25,"POSTS & NOTES",7);
  // eight posts a subpage; the subpages turn every 9 s, as teletext's did, and hold while you point at or tab to a row
  const per=TTX_PER(), pages=Math.max(1,Math.ceil(POSTS.length/per)), pin=ttxFocus>=0?ttxFocus:ttxHover, big=per<8, RS=big?4:2;
  if(ttxSubT<pageT){ postSub=0; ttxSubT=pageT; }
  if(pin>=0){ postSub=Math.floor(pin/per); ttxSubT=t; } else if(t-ttxSubT>9000){ postSub=(postSub+1)%pages; ttxSubT=t; }
  const sub=postSub=Math.min(postSub,pages-1);
  cell(0,5,"  POSTS",6); cell(31,5,`PAGE ${sub+1}/${pages}`,7);
  POSTS.slice(sub*per,sub*per+per).forEach((p,i)=>{ const j=sub*per+i, on=j===pin, title=p.t.length>28?p.t.slice(0,27)+"…":p.t, tag=seenTag(p);
    const y=7+i*RS;
    if(on){ sx.fillStyle=col[4]; sx.fillRect(0,y*RH,960,RH*(big?2:1)+.5); }   // the row you're on, on the banner's blue
    cell(1,y,String(101+j),on?3:6,null,big); cell(5,y,title,on?7:i%2?3:7,null,big); cell(5,y+(big?2:1),p.d.toUpperCase(),2); if(tag) cell(39-tag.length,y+(big?2:1),tag,6); });
  // Fastext row
  [["ABOUT",1],["WORK",2],["HOME",3],["ONLINE",6]].forEach(([s,c],i)=>cell(i*10+1,24,s,c));   // FASTEXT, in the same order
  return new THREE.Color("#1f2a55");
}
function paintSignal(t){
  sx.setTransform(1,0,0,1,0,0); rasterFill=false;
  const avg=(PAINT[tvPage()]||PAINT.home)(t);
  sx.setTransform(K,0,0,K,0,0);
  if(state.volShow>performance.now()){ osd("VOLUME",60,600,"left",40); for(let i=0;i<24;i++){sx.fillStyle=i/24<state.volume?"#f2f2f2":"rgba(242,242,242,.25)";sx.fillRect(60+i*18,616,12,26)} }
  sx.setTransform(1,0,0,1,0,0);
  return avg;
}

// ======================================================================= renderer
const canvas=$("#gl");
// The home view's still shows while the room downloads, the loading display on its TV (Felix, 28 Sep 01:47Z: "i like 1 on the
// tv with the still on"). Every window 1.3:1 or wider sees the same vertical slice of the room (lensFov, frameFor), so the wide
// still, fitted to the height, lines up with the first live frame, a page's own link's too (it opens at home: ENTRY); a
// narrower one (a phone) sees the TV close up, and the still pulls back to the room's wider framing as the room comes in
// (stillOut). Other start pages and reduced data start on the dark ground as before. The loading display asks for it before
// the scene's own files and shows it as soon as it's in; this request finds it in the cache.
const still=$("#still");
function stillOff(){ if(!still?.isConnected) return; if(!still.classList.contains("on")) return still.remove();   // not shown yet: gone before its image can arrive
  still.classList.remove("on"); setTimeout(()=>still.remove(),600); }
// Entering on a window narrower than 1.3:1 (a phone), the room is framed wider than the still (frameFor keeps the width a 32°
// lens shows at 1.3:1: the camera stands further back, and on a tall window the lens widens too), and a fade from one to the
// other would show two TVs. So the room comes in as the still shows it, through the still's own lens from the still's own
// distance, quickly (#gl.pull), and once it's in, the view pulls back to the room's framing: a short camera move away from
// the TV. It moves the view only; the camera, and every framing worked out from it, stays where the page put it.
let pull=null;
function stillOut(){
  if(reduce||pull||!still?.isConnected||!still.classList.contains("on")) return;
  const d=camera.position.distanceTo(controls.target), r=FRAMES.home.d*Math.tan(THREE.MathUtils.degToRad(FOV/2))/(d*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  if(!(r<.98)) return;   // (1.3:1 or wider: the room is framed as the still is)
  pull={t:0,hold:.45,dur:1}; canvas.classList.add("pull"); }
function pullStep(dt){   // (in the loop, on the view as the camera left it)
  pull.t+=dt; const e=ease(Math.min(1,Math.max(0,(pull.t-pull.hold)/pull.dur))), dv=view.position.distanceTo(controls.target);
  if(dv>1e-6) view.position.sub(controls.target).multiplyScalar((FRAMES.home.d+(dv-FRAMES.home.d)*e)/dv).add(controls.target);
  view.fov=FOV+(view.fov-FOV)*e;
  if(e>=1){ pull=null; canvas.classList.remove("pull"); } }
if(still&&(ENTRY||pageFromUrl()==="home"&&(location.hash===""||location.hash==="#home"))&&!navigator.connection?.saveData){
  const im=new Image(); im.fetchPriority="high"; im.decoding="async";
  im.onload=()=>{ if(still.isConnected&&!canvas.classList.contains("ready")){ still.style.backgroundImage=`url("${im.src}")`; still.classList.add("on"); } };
  im.src="/scene/tex/still.jpg";
} else stillOff();   // (the loading display may have shown it already: a #hash the room doesn't open at home; it fades)
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance"}); }
catch(e){ still?.remove(); $("#err").hidden=false; $("#err").textContent="This scene needs WebGL, which isn't available in this browser."; throw e; }
// >>> perf/phone: pixels
// ---- Graphics (vhs-tv/perf/phone). PQ.on is phone mode, PHONE()'s test (PHONE is only defined further down), taken once
// (in OPT_DEFS.phone_gfx, where it also makes Auto a phone's default): a phone stays one when it turns. level: OPTIONS'
// Graphics (?gfx=full|auto|smooth tries one for a visit; ?phone= too, its first name). cap: the most pixels per CSS pixel
// the room draws (DPR_MAX), 2 as before, 1.5 for Smooth; Auto steps down from 2 to floor.
const PQ=(()=>{ const s=location.search, on=OPT_DEFS.phone_gfx.phone;
  const level=/[?&](?:gfx|phone)=(full|auto|smooth)\b/.exec(s)?.[1]||OPT.phone_gfx;
  return {on,level,cap:on?(level==="smooth"?1.25:1.5):(level==="smooth"?1.5:2),floor:1.15,meter:/[?&]fps=1\b/.test(s)||OPT.phone_fps==="on",win:{n:0,late:0},stepT:0,tried:null,held:false,odd:false}; })();
// <<< perf/phone: pixels
// >>> perf/mem: early
// ---- Memory (vhs-tv/perf/mem). What the room lets go of: once it is built, its pictures are uploaded and the copies in
// memory dropped (memTextures), and so is the loader with its copy of the geometry; the reflections' leftover buffers go once
// the panorama's reflections are made; the geometry's text goes straight into the GLB (memGlb); the sounds behind the window
// decode at 16 kHz (memDecode). And if the browser takes the room's graphics away (webglcontextlost), the room's still shows
// with a reload button: the room can't come back without a reload, as its reflections, shadows and the pictures let go of
// here went with the graphics. That card is the only thing here anyone can see, and only once the room has stopped drawing.
const MEM={lost:false,tex:null};
canvas.addEventListener("webglcontextlost",()=>{ if(MEM.lost) return; MEM.lost=true;
  // (the sound goes quiet and stays so, as every resume of the page's waits for A.on; and the entry gate, if it's up, lets the
  // card have the next tap or key, instead of taking it to let the visitor in with the sound on)
  try{ A.on=false; firstGesture=false; A.ctx?.suspend(); }catch{}
  try{ if(gated){ gated=false; removeEventListener("click",gateClick,true); removeEventListener("keydown",gateKey,true); } }catch{}
  const d=document.createElement("div"), p=document.createElement("p"), b=document.createElement("button"), still=SCENE_BASE+"tex/still.jpg";
  d.id="lost"; d.setAttribute("role","alert");
  d.style.cssText="position:fixed;inset:0;z-index:10;display:grid;place-content:center;justify-items:center;gap:18px;padding:20px;font-family:var(--osd);font-size:22px;color:var(--ink);text-align:center;text-shadow:0 0 1px #000,0 0 2px #000,0 1px 1px #000,0 0 9px rgba(0,0,0,.8)";
  d.style.background=`linear-gradient(rgba(7,8,13,.62),rgba(7,8,13,.62)),url("${still}") 50% 50%/auto 100% no-repeat #07080d`;
  p.style.cssText="margin:0;max-width:26em"; p.textContent="The browser stopped drawing the room, most likely to free up memory.";
  b.className="sound"; b.textContent=`${touchOnly()?"TAP":"CLICK"} TO RELOAD`; b.onclick=()=>location.reload();
  d.append(p,b); document.body.append(d); try{ b.focus({preventScroll:true}); }catch{} });
// <<< perf/mem: early
const DPR_MAX=()=>Math.max(1,Math.min(devicePixelRatio||1,PQ.cap,Math.sqrt(4.2e6/(innerWidth*innerHeight))));
let dprCap=2, DPR=DPR_MAX();   // dprCap only ever drops, when frames drag
renderer.setPixelRatio(DPR); renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.AgXToneMapping; renderer.toneMappingExposure=1.8;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;   // the room is static: shadows re-render only when something moves (see shadowsDirty)
let shadowsDirty=2;
RectAreaLightUniformsLib.init();
renderer.info.autoReset=false;   // reset once per frame in the loop, so the debug HUD sees every pass

const scene=new THREE.Scene(); scene.background=new THREE.Color("#07080d");
const FOV=32;
function lensFov(){ const a=innerWidth/innerHeight, tv=Math.tan(THREE.MathUtils.degToRad(FOV/2)); return THREE.MathUtils.radToDeg(2*Math.atan(Math.max(tv,Math.min(.62,.29/a)))); }
const camera=new THREE.PerspectiveCamera(lensFov(),innerWidth/innerHeight,0.03,400);
const view=new THREE.PerspectiveCamera();

// framing per page: where the camera looks, from which direction, how far
const FRAMES={
  home:{t:[0.04,1.1,0.02],dir:[-0.13,0.1,1],d:1.75},
  panel:{t:[0.04,1.08,0.02],dir:[-0.1,0.1,1],d:1.45},
  work:{t:[0.2,0.92,0.02],dir:[-0.06,0.42,1],d:1.3},
};
// Each page flies to a thing on the desk (or the wall) and pins its card beside it.
// ANCHOR boxes are filled in from the loaded scene; until then pages fall back to FRAMES.
const ANCHOR={
  about:{re:/^(postcard|retro_(monitor|screen))/,dir:[1,.12,.3],fit:1.15,az:[.35,1.45],minD:.32},   // where About waits while the old PC starts up
  work:{re:/^(tv_|screen$|vcr_body|tape_\d)/,dir:[-.06,.42,1],fit:1.08},
  work_m:{re:/^(tv_|screen$|vcr_body)/,dir:[-.06,.3,1],fit:1.04},
  posts:{re:/^(tv_|screen$|vcr_body)/,dir:[-.1,.1,1],fit:1.2},
};
ANCHOR.online=ANCHOR.about;   // Online is a program on the same PC
const CARD_W=()=>Math.min(Math.max(360,Math.min(innerHeight*.72,640)/1.618),innerWidth-40);   // as the CSS: golden at full height
const mobile=()=>innerWidth<760;
// On Work, on a desktop, the yellow pad is the card: it floats at the right of the picture while it's up (notepad.width()).
let notepad=null;
let calc=null;   // the desk calculator (calc/calc.js), once the room is in
let pckeys=null;   // the PC keyboard's caps (pckeys/pckeys.js), once the room is in
let vcr=null;   // the VCR's cassette flap, once the room is in (createVCRDoor)
const PHONE=()=>/[?&]touch=1/.test(location.search)||matchMedia("(hover: none) and (pointer: coarse)").matches&&Math.min(innerWidth,innerHeight)<540;
const TTX_PER=()=>PHONE()?4:8;
const padOn=()=>!!notepad&&!mobile(), padUp=()=>padOn()&&notepad.up&&state.page==="work";
// The credits, on a desktop, are the open card of the card file behind the desk lamp: it floats up while the sheet is open
let credits=null;
const credOn=()=>!!credits&&!mobile(), credUp=()=>credOn()&&state.sheet==="credits"&&credits.up;
const sideW=page=>page==="work"&&padOn()&&!state.sheet?notepad.width():CARD_W();
function anchorFor(page){ let an=(mobile()&&ANCHOR[page+"_m"]?.box)?ANCHOR[page+"_m"]:ANCHOR[page]; while(an&&!an.box&&an.alt) an=ANCHOR[an.alt]; return an; }
// Work without its card (Felix, 23:09Z): HIDE in the card's header tucks it away and the tape plays on, in a TV framed as on a page
// without a card; SHOW CARD (bottom right), N, or WORK again brings it back. A sheet still opens over it; leaving Work resets it.
let workHidden=false;
const cardless=page=>page==="home"||page==="work"&&PHONE()||page==="posts"||atPC(page)||page==="work"&&workHidden;
function frameFor(page){
  if(atPC(page)&&PC.mesh) return pcFrame(page);
  if(page==="posts"&&PHONE()) return tvZoomFrame();
  const a=innerWidth/innerHeight, tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  // the free part of the screen: beside the card on a desktop, above it on a phone (where the card docks to the bottom)
  const usable=cardless(page)||mobile()?a:(innerWidth-sideW(page)-60)/innerHeight, tvv=page==="work"&&PHONE()&&window.__touch?.stripH()?tv*(1-window.__touch.stripH()/innerHeight):!cardless(page)&&mobile()?tv*.42:tv;
  const an=anchorFor(page);
  if(an&&an.box){
    const c=an.box.getCenter(new THREE.Vector3()), sz=an.box.getSize(new THREE.Vector3());
    const rw=Math.hypot(sz.x,sz.z)/2, rh=sz.y/2, th=tv*Math.max(.3,usable);
    const d=Math.max(.28,an.fit*Math.max(rh/tvv,rw/th)+Math.hypot(sz.x,sz.z)*.5);
    return {tgt:c,pos:c.clone().add(new THREE.Vector3(...an.dir).normalize().multiplyScalar(d))};
  }
  const f=page==="home"?FRAMES.home:page==="work"?FRAMES.work:FRAMES.panel;
  const tgt=new THREE.Vector3(...f.t);
  const d=f.d*Math.max(1,Math.tan(THREE.MathUtils.degToRad(FOV/2))*1.3/(tv*Math.max(.4,usable)));   // keep the width a 32° lens shows at 1.3:1
  return {tgt,pos:tgt.clone().add(new THREE.Vector3(...f.dir).normalize().multiplyScalar(d))};
}
// how close the wheel may bring the camera: never inside the thing the page looks at
function pageMinDist(page){ if(page==="posts"&&PHONE()) return .2; const an=anchorFor(page); if(!an||!an.box||page==="home") return .3; if(an.minD) return an.minD;
  const sz=an.box.getSize(new THREE.Vector3()); return Math.max(.3,Math.min(.9,Math.hypot(sz.x,sz.z)/2+.15)); }
// orbit limits apply once a flight lands, so a flight never snaps to a new page's limits halfway
function pageLimits(){ const az=(PC.zoom?[.35,1.45]:WIN.zoom?[-.5,.5]:!zoomed&&ANCHOR[state.page]?.az)||[-1.3,1.2]; controls.minAzimuthAngle=az[0]; controls.maxAzimuthAngle=az[1]; controls.maxDistance=WIN.zoom?1.1:2.6; controls.minDistance=zoomed?.2:pageMinDist(state.page);
  const po=WIN.zoom?winPolar():[.95,1.72]; controls.minPolarAngle=po[0]; controls.maxPolarAngle=po[1]; if(cd?.near) cd.limits(controls); }
function looseLimits(){ controls.minAzimuthAngle=-1.3; controls.maxAzimuthAngle=1.45; controls.minDistance=.2; controls.maxDistance=2.6; controls.minPolarAngle=.95; controls.maxPolarAngle=1.72; }
// Looking out of the window: the camera stands at the right-hand casement, just clear of the TV, and looks out over the
// station. It orbits about a point on the glass, so a drag moves your head to see more of the city, and the wheel steps back.
const WIN={zoom:false};
function winFrame(){
  const tgt=new THREE.Vector3(.34,1.66,-.47), [lo,hi]=winPolar(), ph=Math.min(hi,Math.max(lo,Math.atan2(.5,.045)));
  return {tgt,pos:tgt.clone().add(new THREE.Vector3(0,Math.cos(ph)*.502,Math.sin(ph)*.502))};
}
// the photo reaches about 27 degrees below the eye at the glass and 38 above it: the view may tilt only as far as its edges
// stay on the photo (past its last row there is only that row, smeared), so a tall phone view looks out a little upwards
function winPolar(){ const h=camera.fov/2; return [Math.min(64+h,96),Math.min(98.5,Math.max(128-h,96))].map(THREE.MathUtils.degToRad); }
// the TV's glass filling the view: fitted to the screen, so a narrow phone sees all of it too
let tvScreen=null;
function tvZoomFrame(){
  if(!tvScreen) return {tgt:new THREE.Vector3(0,1.064,.16),pos:new THREE.Vector3(0,1.07,.62)};
  const b=new THREE.Box3().setFromObject(tvScreen), c=b.getCenter(new THREE.Vector3()), sz=b.getSize(new THREE.Vector3());
  const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), a=innerWidth/innerHeight;
  const d=Math.max(.46,sz.y/2/(tv*.85),sz.x/2/(tv*a*.92));
  return {tgt:c,pos:c.clone().add(new THREE.Vector3(0,.013,1).multiplyScalar(d))};
}
// when a card is open, shift the projection so the object sits in the space the card leaves
let shift={x:0,y:0};
function shiftTarget(){
  if(!zoomed&&!state.sheet&&state.page==="work"&&PHONE()) return {x:0,y:(window.__touch?.stripH()||0)/2};
  if(zoomed||cardless(state.page)&&!(state.sheet&&state.page!=="home")) return {x:0,y:0};
  return mobile()?{x:0,y:innerHeight*.23-34}:{x:(sideW(state.page)+40)/2,y:0};
}
// pin the card just right of the object's on-screen box, clamped to the viewport. It is measured against
// cardCam (the view without the idle camera drift), so a card at rest stays put instead of creeping by a pixel.
const _v=new THREE.Vector3(), cardCam=new THREE.PerspectiveCamera();
let cardH=0, cardXY="";
function placeCard(){
  const el=panel; if(!el||el.hidden||document.body.classList.contains("ttx")||document.body.classList.contains("padnote")||document.body.classList.contains("credcard")) return;
  if(mobile()){ if(el.style.left||el.style.top){ el.style.left=el.style.right=el.style.top=""; } cardXY=""; return; }   // the phone layout docks the card with CSS
  const an=anchorFor(state.page);
  const W=CARD_W(); let x=innerWidth-W-20, y=innerHeight/2;
  if(an&&an.box&&!zoomed){
    const b=an.box; let x1=-1e9, y0=1e9, y1=-1e9;
    for(let k=0;k<8;k++){ _v.set(k&1?b.max.x:b.min.x,k&2?b.max.y:b.min.y,k&4?b.max.z:b.min.z).project(cardCam);
      const sx=(_v.x*.5+.5)*innerWidth, sy=(-_v.y*.5+.5)*innerHeight; x1=Math.max(x1,sx); y0=Math.min(y0,sy); y1=Math.max(y1,sy); }
    x=Math.min(innerWidth-W-20,Math.max(20,x1+28)); y=Math.min(innerHeight-40,Math.max(80,(y0+y1)/2));
  }
  const h=cardH/2; y=Math.min(innerHeight-20-h,Math.max(70+h,y));
  const xy=Math.round(x)+","+Math.round(y); if(xy===cardXY) return; cardXY=xy;
  el.style.left=Math.round(x)+"px"; el.style.right="auto"; el.style.top=Math.round(y)+"px";
}
function measureAnchors(root){
  for(const an of Object.values(ANCHOR)){
    const b=new THREE.Box3(); let any=false;
    root.traverse(o=>{ if(o.isMesh&&an.re.test(o.name)){ b.expandByObject(o); any=true; } });
    if(any) an.box=b;
  }
}
{ const f=frameFor("home"); camera.position.copy(f.pos); }
const controls=new OrbitControls(camera,canvas);
controls.target.copy(frameFor("home").tgt); controls.enableDamping=true; controls.dampingFactor=.06; controls.enablePan=false;
controls.minDistance=.3; controls.maxDistance=2.6; controls.minPolarAngle=.95; controls.maxPolarAngle=1.72;
controls.minAzimuthAngle=-1.3; controls.maxAzimuthAngle=1.2; controls.rotateSpeed=.5; controls.zoomSpeed=.7; controls.update();

// ---- the desk lamp: a click on it switches it off and on (L did too until v27, when Felix dropped the lamp and window keys). Off, the room is lit by the TV, the city and the floor lamp:
// that light has its own bake (bake/*_irrD.jpg) and its own panorama for reflections (tex/env_off.jpg), fetched the first time
// the pointer finds the lamp. The filament lights almost at once and glows out over a moment; then the eye opens up to the dark.
const DESK={on:true,k:1,target:1,eye:1,maps:null,bulb:null,env:{on:null,off:null}}, LAMP_K={value:1};
// ---- the floor lamp in the corner by the armchair switches the same way (Felix, 03:19Z: "the lamp on the right side, too").
// No bake has the room without it yet (that's for the next scene pass), so for now its light is taken out of the bake by a
// fit: its direct light, as from a point at the bulb, bright through the shade's open top and bottom and about a seventh of
// that through the fabric (fitted to the desk-lamp-off bake along 6000 rays from the bulb, tv/lampmeasure27.cjs), and most
// of the light it bounced round the room (FLOOR_BOUNCE). Like the desk lamp, it waits for that bake (deskMaps) to go off.
const FLOOR={on:true,k:1,target:1,eye:1,bulb:null,shades:[]}, FLOOR_K={value:1}, FLOOR_P=[1.28,1.52,.62], FLOOR_BOUNCE=.7;
// ---- environment for reflections: dark room, warm lamp, blue window
// The room's panorama (tv/envmap8.py) is shot from PROBE, and every reflection is box-projected: the reflected ray is followed
// to the room's walls, and the panorama is read in the direction of that point as seen from PROBE. So the window shows up in
// the floorboards and the varnish where it really is, instead of the same picture being reflected from everywhere.
const PROBE=[.1,1.35,1.55], ROOM_BOX=[[-1.6,0,-.42],[2.8,3.2,2.6]];
{ const v3=a=>`vec3(${a.map(n=>n.toFixed(3)).join(",")})`;
  const chunk=THREE.ShaderChunk.envmap_physical_pars_fragment, hook="reflectVec = inverseTransformDirection( reflectVec, viewMatrix );";
  if(chunk.includes(hook)) THREE.ShaderChunk.envmap_physical_pars_fragment=chunk.replace("#ifdef USE_ENVMAP",`#ifdef USE_ENVMAP
	vec3 boxDir( vec3 r ) {
		vec3 wp = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;
		vec3 q = mix( vec3( 1e-4 ), r, step( vec3( 1e-4 ), abs( r ) ) );
		vec3 t = max( ( ${v3(ROOM_BOX[1])} - wp ) / q, ( ${v3(ROOM_BOX[0])} - wp ) / q );
		return wp + r * max( min( min( t.x, t.y ), t.z ), 0.0 ) - ${v3(PROBE)};
	}`).replace(hook,"reflectVec = boxDir( inverseTransformDirection( reflectVec, viewMatrix ) );");
}
{
  const pm=new THREE.PMREMGenerator(renderer); const es=new THREE.Scene(); es.background=new THREE.Color("#0c0b10");
  const room=new THREE.Mesh(new THREE.BoxGeometry(6,4,6),new THREE.MeshBasicMaterial({color:"#1a1519",side:THREE.BackSide})); room.position.y=1.2; es.add(room);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.8),new THREE.MeshBasicMaterial({color:new THREE.Color("#2d3f78").multiplyScalar(2.2)}));win.position.set(0,1.7,-2.9);es.add(win);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.25),new THREE.MeshBasicMaterial({color:new THREE.Color("#ffb46a").multiplyScalar(9)}));lamp.position.set(-1.2,1.4,.3);es.add(lamp);
  const first=pm.fromScene(es,0.03); scene.environment=first.texture; scene.environmentIntensity=.55;
  // swap in a Cycles panorama of the lit room once it arrives, so glass, varnish and metal reflect the real room
  new THREE.TextureLoader().load(SCENE_BASE+"tex/env.jpg",tx=>{ tx.mapping=THREE.EquirectangularReflectionMapping; tx.colorSpace=THREE.SRGBColorSpace;
    // the panorama is centred on the window (-z) with the PC side on its left; three centres an equirect on +x, so turn it +90°
    DESK.env.on=pm.fromEquirectangular(tx).texture; DESK.env.onTx=tx; if(DESK.k>=.5||!DESK.env.off) scene.environment=DESK.env.on;
    pm.dispose(); if(scene.environment!==first.texture) first.dispose();   // (the generator's work buffer, the first reflections: perf/mem)
    scene.environmentRotation.set(0,Math.PI/2,0); scene.environmentIntensity=1.0; });
}

// ======================================================================= VHS pass → screen texture
// The tube's face sits 5 mm further out than it was modelled: its curved sides dipped behind the chassis, which showed as a
// black strip either side of the picture. With that and a raster that reaches the glass's edge, the picture fills the tube.
const GLASS_OUT=.005;
const rt=new THREE.WebGLRenderTarget(SRC_W,SRC_H,{depthBuffer:false});
const srcTex=new THREE.CanvasTexture(src); srcTex.minFilter=THREE.LinearFilter; srcTex.generateMipmaps=false;
const vhsMat=new THREE.ShaderMaterial({
  uniforms:{T:{value:srcTex},t:{value:0},g:{value:0},trk:{value:.15},sat:{value:.85},openX:{value:1},openY:{value:1},dotR:{value:0},us:{value:0},hv:{value:0},bo:{value:0},fit:{value:new THREE.Vector2(1.07,1.1)},R:{value:new THREE.Vector2(SRC_W,SRC_H)}},
  vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`precision highp float;
  uniform sampler2D T;uniform float t,g,trk,sat,openX,openY,dotR,us,hv,bo;uniform vec2 R,fit;varying vec2 v;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  float n1(float x){float i=floor(x),f=fract(x);return mix(h(vec2(i,1.)),h(vec2(i+1.,1.)),smoothstep(0.,1.,f));}
  vec3 tex(vec2 u){return texture2D(T,clamp(u,.001,.999)).rgb;}
  // H/V DELAY shows the blanking between lines (HB of a line) and between fields (VB of one, 21 lines). The monitor lifts
  // black to a dark grey in this mode, so the sync pulses under it are the darkest thing on the screen.
  const float HB=.17,VB=.085,BL=.12;
  vec3 hblank(float x){   // across it: front porch, sync, breezeway, colour burst (a few cycles of subcarrier), back porch
    if(x>.1&&x<.5) return vec3(0.);
    if(x>.56&&x<.82) return vec3(BL)+vec3(.05,.065,-.02)*(.5+.5*sin(x*300.));
    return vec3(BL);
  }
  vec3 vblank(float n,float x,vec3 hb,float fr){   // line n of 21 (the texture runs bottom-up, so the caller counts from q.y=1+VB), x along it from its sync
    float hx=fract(x*2.);   // the first nine lines pulse twice a line
    if(n<3.||n>5.&&n<9.) return hx<.07?vec3(0.):vec3(BL);   // equalizing pulses
    if(n<6.) return hx<.85?vec3(0.):vec3(BL);   // vertical sync: broad pulses with narrow serrations
    if((n==16.||n==17.)&&x>.2&&x<.46) return vec3(.8);   // a test signal: a white bar,
    if((n==16.||n==17.)&&x>.52&&x<.94) return vec3(BL+floor((x-.52)*12.)*.14);   // then a staircase
    if(n==20.&&x>.18&&x<.34) return vec3(BL+.32*(.5+.5*sin(x*175.)));   // closed captions: the clock run-in,
    if(n==20.&&x>.37&&x<.95) return vec3(BL+.42*step(.5,h(vec2(floor((x-.37)*27.6),fr))));   // then two characters a field
    return hb;
  }
  void main(){
    vec2 base=vec2(v.x,1.-v.y);
    vec2 q=(base-.5)*fit*(1.+us*.13)/vec2(max(openX,.001),max(openY,.001))+.5;   // fit: how far the raster reaches (RASTER). UNDERSCAN: the whole raster, edges and all
    float ras=step(abs(q.x-.5),.5+HB*.5)*step(abs(q.y-.5),.5+VB*.5);   // the raster is one line by one field: underscanned, the tube beyond it is dark
    if(hv>.5) q=vec2(mod(q.x+.5+HB*.5,1.+HB),mod(q.y+.5+VB*.5,1.+VB));   // H/V DELAY: half a line and half a field late (sigUV maps clicks the same way)
    float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);
    vec2 uv=q;
    float by=1.-fract(t*.045+trk*.37);
    float band=(1.-smoothstep(0.,.07,abs(uv.y-by)))*(.2+trk*1.8);
    float amt=.0012+band*.012+g*.045+trk*.002;
    float jit=(n1(floor(uv.y*240.)*.9+t*33.)-.5)*amt;
    jit+=(1.-smoothstep(0.,.04,uv.y))*(.018+n1(t*25.)*.02);
    uv.x+=jit+sin(uv.y*7.+t*1.1)*.0007*(1.+trk*3.);
    uv.y+=g*(n1(t*50.)-.5)*.06;
    float ca=.0022+g*.014+band*.004;
    vec3 c=vec3(tex(uv+vec2(ca,0.)).r,tex(uv).g,tex(uv-vec2(ca*1.4,0.)).b);
    vec3 sm=(tex(uv+vec2(.004,0.))+tex(uv+vec2(.009,0.)))*.5;
    c=mix(c,max(c,sm*.85),.3);
    float L=dot(c,vec3(.299,.587,.114)); c=mix(vec3(L),c,sat);
    float gr=h(uv*R+fract(t*9.)*91.);
    c+=(gr-.5)*(.05+band*.35+g*.4);
    c=mix(c,vec3(gr*.9),smoothstep(.55,1.,g)*.9);
    c+=step(.982,h(vec2(floor(base.y*320.),floor(t*24.))))*min(band,1.)*.6;
    if(hv>.5){   // the blanking crosses the middle, around a brightened picture
      vec3 b=q.x>1.?hblank((q.x-1.)/HB):vec3(BL);
      if(q.y>1.) b=vblank(floor((1.+VB-q.y)/VB*21.),fract((q.x-1.-HB*.1)/(1.+HB)+1.),b,floor(t*30.));
      c=mix(c*(1.-BL)+BL,b+(gr-.5)*.05,1.-inside); inside=ras;
    }
    if(bo>.5) c=vec3(c.b+(gr-.5)*.07);   // BLUE ONLY: the blue signal alone, in black and white, where tape noise shows most
    c*=.86+.14*sin(base.y*R.y*1.5708);
    c*=.9+.1*sin(base.x*R.x*2.0944);
    vec2 e=base-.5; c*=1.-dot(e,e)*.9;
    c*=inside*(1.+(1.-openY)*2.5+(1.-openX)*1.5);
    float dt=(1.-smoothstep(dotR*.3,dotR,length((base-.5)*vec2(1.33,1.))));
    c+=vec3(dt)*step(.0001,dotR)*1.4;
    gl_FragColor=vec4(pow(max(c,0.),vec3(2.2)),1.);
  }`
});
const vhsScene=new THREE.Scene(); vhsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),vhsMat));
const vhsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);

// ======================================================================= Berlin outside
const cityCommon=`
float h1(float x){return fract(sin(x*127.1)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
`;
// Berlin outside: a real rainy-night photo from the Warschauer Brücke (Billie Grace Ward, CC BY 2.0),
// placed 30 m out so the window frame parallaxes against it. Highlights are lifted so street lights bloom.
// Wrapped on a 30 m cylinder (160 deg) so no edge shows at steep angles: the photo covers the middle
// 47 m and mirrors outward. Subtle life: drifting low cloud lit by sodium light, crane and tower
// beacons, lights shimmering through the rain, and an S-Bahn now and then coming up the tracks.
const BH=47*3201/3840, BZ0=1.3-.381*BH;
// The city itself lives in city/: the photo, its windows lit and switched off one by one, beacons, cars, trains
// and planes, and the rain, all on the GPU; "with depth" parallaxes the layers on a depth map and adds more trains,
// showers that come and go, and mist over the yard (city/README.md). It is the only window since Felix's 16:21Z.
// The photo's path is given here, with the page's other assets, so a host that moves them (the Ghost theme) finds it.
let city=cityDepth(THREE,{scene,renderer,loader:new THREE.TextureLoader(),BH,BZ0,photo:SCENE_BASE+"tex/berlin.jpg"});

// ======================================================================= lights
scene.add(new THREE.HemisphereLight("#3a4a7a","#2a1a0c",.14));
const fill=new THREE.PointLight("#ffcf9a",.3,4,1.5); fill.position.set(-.7,1.35,1.3); scene.add(fill);
const moon=new THREE.DirectionalLight("#8aa2e6",1.0);
moon.position.set(1.8,4.2,-5); moon.target.position.set(0,.8,0); scene.add(moon,moon.target);
moon.castShadow=true; moon.shadow.mapSize.set(2048,2048); Object.assign(moon.shadow.camera,{left:-1.6,right:1.6,top:1.6,bottom:-1.6,near:1,far:12}); moon.shadow.bias=-.0006; moon.shadow.normalBias=.02; moon.shadow.radius=3;
const lampSpot=new THREE.SpotLight("#ffb56b",3.4,3,1.0,.7,1.6);
lampSpot.position.set(-.42,1.1,-.1); lampSpot.target.position.set(-.1,.76,.1); scene.add(lampSpot,lampSpot.target);
lampSpot.castShadow=true; lampSpot.shadow.mapSize.set(2048,2048); lampSpot.shadow.bias=-.0005; lampSpot.shadow.normalBias=.01; lampSpot.shadow.radius=6;
const lampFill=new THREE.PointLight("#ff9f5a",.5,3.5,1.6); lampFill.position.set(-.42,1.2,-.05); scene.add(lampFill);
const floorLamp=new THREE.PointLight("#ffb46e",1.6,6,1.4); floorLamp.position.set(...FLOOR_P); scene.add(floorLamp);
const tvLight=new THREE.RectAreaLight("#6d7cff",6,.29,.22); tvLight.position.set(0,1.064,.2); tvLight.lookAt(0,1.0,3); scene.add(tvLight);

// ======================================================================= textures
// the coffee's top (planar UVs, 0..1 across the cup): near-black brown, warming to a thin crema line at the glaze
const COFFEE_TEX=()=>canvasTex(256,256,(g,w,h)=>{ const r=w/2, gr=g.createRadialGradient(r,r,0,r,r,r);
  gr.addColorStop(0,"#170a05"); gr.addColorStop(.86,"#1d0d06"); gr.addColorStop(.94,"#2e170b"); gr.addColorStop(.985,"#6a4428"); gr.addColorStop(1,"#6a4428");
  g.fillStyle=gr; g.fillRect(0,0,w,h); });
function canvasTex(w,h,draw,{srgb=true,flip=false,repeat=null}={}){
  const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);
  const tx=new THREE.CanvasTexture(c); tx.flipY=flip; if(srgb) tx.colorSpace=THREE.SRGBColorSpace;
  tx.anisotropy=8; if(repeat){tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(...repeat)} tx.userData.canvas=c; return tx;
}
function noiseCanvas(g,w,h,lo,hi,seed,blob=0){const d=g.createImageData(w,h),r=rng(seed);for(let i=0;i<d.data.length;i+=4){const v=lo+r()*(hi-lo);d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0);
  for(let i=0;i<blob;i++){const x=r()*w,y=r()*h,rr=4+r()*30;const gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,`rgba(255,255,255,${.1+r()*.25})`);gr.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=gr;g.fillRect(x-rr,y-rr,rr*2,rr*2)}}
const oakDraw=(g,w,h)=>{const r=rng(3); g.fillStyle="#8a5c38";g.fillRect(0,0,w,h);
  for(let i=0;i<300;i++){const y=r()*h,a=.03+r()*.09,th=1+r()*5;g.strokeStyle=r()<.5?`rgba(60,32,16,${a})`:`rgba(210,160,110,${a*.8})`;g.lineWidth=th;
    g.beginPath();g.moveTo(0,y);for(let x=0;x<=w;x+=24)g.lineTo(x,y+Math.sin(x*.004+i)*6+Math.sin(x*.02+i*3)*1.5);g.stroke();}
  for(let i=0;i<9;i++){const x=r()*w,y=r()*h;g.strokeStyle="rgba(50,26,12,.18)";for(let k=1;k<7;k++){g.beginPath();g.ellipse(x,y,k*14,k*4,0,0,7);g.stroke()}}
  // rings from mugs, a few scratches: a desk that's used
  for(let i=0;i<3;i++){const x=r()*w,y=r()*h;g.strokeStyle="rgba(40,22,10,.12)";g.lineWidth=5;g.beginPath();g.arc(x,y,40,0,7);g.stroke()}
  for(let i=0;i<40;i++){const x=r()*w,y=r()*h;g.strokeStyle="rgba(230,190,140,.08)";g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*80-40,y+r()*10-5);g.stroke()}};
const oakTex=canvasTex(1024,1024,oakDraw,{repeat:[1.2,1.2]});
const oakBump=canvasTex(1024,1024,oakDraw,{srgb:false,repeat:[1.2,1.2]});
const plasterTex=canvasTex(512,512,(g,w,h)=>noiseCanvas(g,w,h,190,240,9,120),{srgb:false,repeat:[3,3]});
const grainTex=canvasTex(256,256,(g,w,h)=>noiseCanvas(g,w,h,110,170,5),{srgb:false,repeat:[40,40]});
const smudgeTex=canvasTex(512,512,(g,w,h)=>{g.fillStyle="#1c1c1c";g.fillRect(0,0,w,h);const r=rng(12);
  for(let i=0;i<26;i++){const x=r()*w,y=r()*h,rr=10+r()*50;const gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,`rgba(120,120,120,${.2+r()*.3})`);gr.addColorStop(1,"rgba(120,120,120,0)");g.fillStyle=gr;g.fillRect(x-rr,y-rr,rr*2,rr*2)}
  g.strokeStyle="rgba(150,150,150,.25)";g.lineWidth=14;g.beginPath();g.moveTo(60,420);g.quadraticCurveTo(200,380,330,440);g.stroke();},{srgb:false});

function tapeLabel(i){
  const c=TAPES[i];
  const draw=(g,w,h)=>{
    g.fillStyle="#efe8d6";g.fillRect(0,0,w,h);
    const col=c.bg||(i<EXP?"#b5532b":i<JOBS?"#1a3b5c":"#2f5fb8");
    g.fillStyle=col;g.fillRect(0,0,w,14);
    g.fillStyle="#2b2b33";g.fillRect(0,14,w,3);
    g.strokeStyle="rgba(60,80,140,.35)";g.lineWidth=2;for(let y=52;y<h;y+=30){g.beginPath();g.moveTo(24,y);g.lineTo(w-230,y);g.stroke()}
    g.font="600 70px Caveat, cursive";g.fillStyle="#1b2a5a";g.fillText(c.t,34,94);
    g.font="28px VT323, monospace";g.fillStyle="#333";
    ["SP","LP","EP"].forEach((s,k)=>{const x=w-200+k*62;g.strokeRect(x,48,18,18);g.fillText(s,x+24,66);});
    g.font="600 40px Caveat, cursive";g.fillStyle="#1b2a5a";g.fillText("✓",w-200,68);
    g.font="600 34px Caveat, cursive";g.fillText(c.y,w-205,106);
  };
  const tx=canvasTex(1024,120,draw);
  labelDraws.push(()=>{ draw(tx.userData.canvas.getContext("2d"),1024,120); tx.needsUpdate=true; });
  return tx;
}
// cassette dressing from each channel: shell plastic (opaque hex or "clear-<tint>"), spine and top labels
const CLEAR={blue:"#3d86d8",orange:"#ff7417",smoke:"#2c2c33",green:"#2fbf71",red:"#e0303a",purple:"#7b4fd6",yellow:"#ffd21a",pink:"#ff5fa2","":"#d8dde2"};
function shellMat(spec){
  const m=/^clear(?:-(\w+))?$/.exec(spec||"");
  if(m) return new THREE.MeshPhysicalMaterial({color:CLEAR[m[1]||""]||CLEAR[""],roughness:.18,metalness:0,clearcoat:.6,transparent:true,opacity:m[1]==="smoke"?.62:.5,depthWrite:false});
  return new THREE.MeshStandardMaterial({color:spec||"#1b1b1e",roughness:.5});
}
function topLabel(i){
  const c=tapeInfo(i);
  const draw=(g,w,h)=>{
    g.fillStyle="#efe8d6";g.fillRect(0,0,w,h);
    g.strokeStyle="rgba(60,80,140,.3)";g.lineWidth=2;for(let y=70;y<h;y+=44){g.beginPath();g.moveTo(30,y);g.lineTo(w-30,y);g.stroke()}
    const col=TAPES[i]?.bg||(i<EXP?"#b5532b":i<JOBS?"#1a3b5c":"#2f5fb8");
    g.fillStyle=col;g.fillRect(0,0,w,14);
    g.font="600 104px Caveat, cursive";g.fillStyle="#1b2a5a";g.fillText(c.t,40,150);
    g.font="40px VT323, monospace";g.fillStyle="#444";g.textAlign="right";g.fillText(c.y.toUpperCase(),w-40,196);g.textAlign="left";
  };
  const tx=canvasTex(1024,222,draw);
  labelDraws.push(()=>{ draw(tx.userData.canvas.getContext("2d"),1024,222); tx.needsUpdate=true; });
  return tx;
}
// Spine labels are redrawn whenever a late web font lands, so a channel's own typeface replaces the fallback.
const labelDraws=[];
function spineTex(i){
  const ch=channels[i]; if(!ch?.cassette?.drawLabel) return tapeLabel(i);
  const draw=(g,w,h)=>{ try{ g.save(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h); ch.cassette.drawLabel(g,w,h); g.restore(); }catch(e){ console.warn(e); } };
  const tx=canvasTex(1024,160,draw); tx.repeat.set(1,136/160); tx.offset.set(0,12/160);
  labelDraws.push(()=>{ draw(tx.userData.canvas.getContext("2d"),1024,160); tx.needsUpdate=true; });
  return tx;
}
function dressTapes(){
  const shells={};
  tapeGroups.forEach((grp,i)=>{ if(!grp) return;
    grp.traverse(o=>{ if(!o.isMesh) return;
      if(/^tape_shell_/.test(o.material.name||"")){ o.material=shells[i]||(shells[i]=shellMat(channels[i]?.cassette?.shell || TAPES[i]?.shell)); o.castShadow=!o.material.transparent; }
      if(/^tape_label_/.test(o.name)) o.material=new THREE.MeshStandardMaterial({map:spineTex(i),roughness:.75});
      if(/^tape_toplabel_/.test(o.name)) o.material=new THREE.MeshStandardMaterial({map:topLabel(i),roughness:.8});
      if(interact.has(o)) interact.get(o).label="TAPE · "+tapeInfo(i).t.toUpperCase();
    });
  });
  if(document.fonts){ let tm=0; const redraw=()=>{ clearTimeout(tm); tm=setTimeout(()=>labelDraws.forEach(f=>f()),120); };
    document.fonts.addEventListener("loadingdone",redraw); document.fonts.ready.then(redraw); }
  joinTapes();   // each cassette's parts as one (perf/join)
  stills.clear(); shadowsDirty=2;
  refreshWork();
}
const vfdTex=canvasTex(512,112,()=>{});
function drawVFD(){
  const g=vfdTex.userData.canvas.getContext("2d"),w=512,h=112;
  g.fillStyle="#020403";g.fillRect(0,0,w,h);
  const tm=nightClock();
  g.font="84px VT323, monospace";g.textBaseline="middle";
  g.fillStyle="rgba(90,255,220,.07)";g.fillText("88:88",250,60);g.fillText("88",42,60);
  g.fillStyle="#7dffe4";g.shadowColor="#56ffd6";g.shadowBlur=14;
  g.fillText(Math.floor(nightMs()/1000)%2?tm:tm.replace(":"," "),250,60);
  g.fillText(state.tape>=0?String(state.tape+1).padStart(2,"0"):"--",42,60);
  g.font="28px VT323, monospace";
  g.fillText(state.tapeState==="playing"?"▶ PLAY":state.tapeState==="loading"?"LOAD":state.tapeState==="ejecting"?"EJECT":state.tape>=0?"■ STOP":"NO TAPE",150,28);g.fillText("HI-FI",150,92);
  g.shadowBlur=0; vfdTex.needsUpdate=true;
}

// ======================================================================= load the Blender scene
const interact=new Map();
const clockHands=[]; let clockBody=null;
let clock=null;   // the wall clock's battery (clock/clock.js): in or out, the time its hands show, its ticking
const leds=[]; let powerLed, vcrLed, remoteIR, screenMat, vcrDoor; const cdParts=[];
const buttons={}; const knobs=[]; const tapeGroups=[]; const noDepth=[];
const rainMats=[];
// Rain on the outer pane, seen through the inner one. Each drop is a small lens: it shows the street behind it upside
// down and blurred (the photo, read along the bent ray), with a dark rim where the light skims its edge and a speck of
// the desk lamp. Two layers of beads, fine and coarse, and now and then a drop that runs down in fits and starts and
// leaves a thin wet track. From the desk the beads are a few pixels across; at the glass you see the city in them.
function rainGlass(){
  const m=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, premultipliedAlpha:true, uniforms:{t:{value:0},photo:{value:null},uPh:{value:0},lampK:LAMP_K},
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`precision highp float;varying vec3 vW;uniform float t,uPh,lampK;uniform sampler2D photo;
    ${cityCommon}
    const float BH=${BH.toFixed(4)}, BZ0=${BZ0.toFixed(4)};
    const vec3 SKY=vec3(.075,.07,.078);
    float hb(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }   // no sine: exact on phone GPUs
    // where a ray from the glass meets the photo's 30 m cylinder (the city backdrop's own mapping)
    vec2 cylUV(vec3 o,vec3 d){ float a=dot(d.xz,d.xz), b=dot(o.xz,d.xz), c=dot(o.xz,o.xz)-900.;
      float s=(-b+sqrt(max(b*b-a*c,0.)))/a; vec3 p=o+s*d; return vec2(.5+atan(p.x,-p.z)*30./47.,(p.y-BZ0)/BH); }
    // the street along a ray, blurred by lod; lights bloom in the water
    vec3 street(vec3 d,float lod){
      vec2 uv=cylUV(vW,d); vec2 mu=vec2(1.-abs(mod(uv.x,2.)-1.),clamp(uv.y,.002,.998));
      vec3 c=mix(SKY,textureLod(photo,mu,lod).rgb,uPh); c=mix(c,SKY,smoothstep(.93,1.05,uv.y));
      float l=dot(c,vec3(.3,.59,.11)); return c+c*smoothstep(.3,1.,l)*1.6; }
    // one bead centred at ctr (metres on the glass), radius r, laid over acc; px: metres per screen pixel here
    void bead(vec2 P,vec2 ctr,float r,vec3 V,float px,inout vec4 acc){
      vec2 q=(P-ctr)/r; q.y*=q.y<0.?.8:1.1;                   // it sags: fuller below its centre
      float d2=dot(q,q); if(d2>=1.) return;
      float d=sqrt(d2), h=sqrt(1.-d2);
      // a tiny wide-angle lens: its edge looks some 50 degrees off to the other side, so the street stands on its
      // head, the sky at the bottom of the drop. One pixel of a bead takes in a wide patch of the photo, so the photo is
      // read at the mip that covers that patch, and a second, sharper read keeps lamps as points of light in the water
      vec3 dir=normalize(V+vec3(-q*1.15*(1.-h*.5),0.));
      float lod=clamp(log2(2100.*px/r),2.,9.);
      vec3 c=street(dir,lod)*.8, g=street(dir,max(lod-3.,1.5));
      c+=g*smoothstep(.6,1.3,dot(g,vec3(.3,.59,.11)))*.8;
      c*=1.-.85*smoothstep(.68,1.,d)*smoothstep(1.5,4.,r/px); // the rim, where the light skims off (a speck of a bead has none: it would read as dust)
      vec2 s=q-vec2(-.32,.38); c+=vec3(1.,.82,.62)*.22*lampK*exp(-dot(s,s)*30.);   // the desk lamp
      float fw=1.5*px/r, a=.94*(1.-smoothstep(1.-fw,1.,d))*min(1.,.5*r/px);   // beads under a pixel or two fade out
      acc=vec4(mix(acc.rgb,c,a),a+acc.a*(1.-a)); }            // acc is premultiplied: each bead goes over what is already there
    void main(){
      vec3 V=normalize(vW-cameraPosition);
      vec2 P=vW.xy;                                           // metres across the pane
      float px=length(fwidth(P));                             // taken outside every branch: inside one it is undefined
      vec4 acc=vec4(0.);
      for(int L=0;L<3;L++){                                   // grid cells, each with at most one bead: fine, coarse, and a few big ones
        float cs=L==0?.008:L==1?.02:.05, occ=L==0?.5:L==1?.38:.24, r0=L==0?.0008:L==1?.0018:.0036, r1=L==0?.0018:L==1?.0036:.0056, sd=float(L)*31.;
        vec2 c=floor(P/cs);
        if(hb(c+sd)<occ){ float k=hb(c+sd+1.3); bead(P,(c+.2+.6*vec2(hb(c+sd+3.1),hb(c+sd+7.7)))*cs,mix(r0,r1,k*k),V,px,acc); }
      }
      // runners: in some 2 cm columns a drop slides down in fits and starts (it never climbs: the slide's derivative
      // is 1-cos), and a thin wet track stays above it
      float cw=.02, cx=floor(P.x/cw);
      float cyc=t*(.018+.03*h1(cx*1.7))/1.1+h1(cx*7.3), k=floor(cyc), f=fract(cyc);
      if(h1(cx+k*1.3)>.82){
        float y=1.85+.2*h1(cx+k)-1.1*(f-sin(56.55*f)/56.55);
        float x=(cx+.5+.25*(h1(cx*3.+k)-.5))*cw+.003*sin(P.y*45.+cx);
        bead(P,vec2(x,y),.0034,V,px,acc);
        float tr=(1.-smoothstep(.0006,.0011,abs(P.x-x)))*step(y,P.y)*(1.-smoothstep(0.,.35,P.y-y))*min(1.,.0011/px);
        if(tr>0.){ vec3 c=street(normalize(V+vec3((x-P.x)*60.,0.,0.)),3.)*.9; float w=tr*.7; acc=vec4(mix(acc.rgb,c,w),w+acc.a*(1.-w)); }
      }
      gl_FragColor=acc;
    }`
  });
  rainMats.push(m); return m;
}

// Baked lighting: per atlas an albedo map, the room's irradiance (A) and the TV's irradiance (B), all on uv1.
const BAKE={}, TVCOL={value:new THREE.Color(0,0,0)}, BAKEGAIN={value:1}, SPEC_OCC={value:1.5};
const texL=new THREE.TextureLoader();
// lightmap atlases are packed islands: mipmaps would blend neighbouring islands into each other, so sample level 0 only
// (each bake map, once its image is in, goes by bakeIn: clockBake moves the wall clock's shadow on the room atlas's)
const bakeIns=new Set(); let CLOCK_FIX=null;
function bakeIn(t){ bakeIns.add(t); clockBake(t); }
function btex(url,srgb){ const t=texL.load(url,bakeIn); t.channel=1; t.flipY=false; t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace; t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; return t; }
const bakeReady=fetch(SCENE_BASE+"bake/bake.json").then(r=>r.json()).then(j=>{
  for(const [k,v] of Object.entries(j)){ BAKE[k]={sA:v.A,sB:v.B,sD:v.D,g:v.g||2.2,A:btex(`${SCENE_BASE}bake/${k}_irrA.jpg`),B:btex(`${SCENE_BASE}bake/${k}_irrB.jpg`),albedo:k.startsWith("props")?null:btex(`${SCENE_BASE}bake/${k}_albedo.jpg`,true)};
    BAKE[k].uD={value:BAKE[k].A}; BAKE[k].usD={value:v.A}; }
});
const bakedCache=new Map();
// Baked surfaces neither cast nor receive shadows, so the moon (the one directional light) would put its cold highlight on every
// one of them that faces the window, inside the bookshelf too. The window's light is in the bake and in the room's reflection.
const LIGHTS_NO_MOON=THREE.ShaderChunk.lights_fragment_begin.replace("getDirectionalLightInfo( directionalLight, directLight );",
  "getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color = vec3( 0.0 );");
function bakedMaterial(src,atlas){
  // a diffuse bake of a metal is black (colour and light): metals keep their own material and reflect the room. A metalness
  // map (Poly Haven props) leaves the factor at glTF's default 1: the map decides per texel, and the bake lights the rest
  if((src.metalness??0)>.5&&!src.metalnessMap) return src;
  const key=src.uuid+atlas; if(bakedCache.has(key)) return bakedCache.get(key);
  const b=BAKE[atlas]; let m;
  if(b.albedo){
    m=new THREE.MeshPhysicalMaterial({map:b.albedo,roughness:src.roughness??.5,metalness:src.metalness??0,side:src.side});
    if(src.emissive&&src.emissiveIntensity>0&&src.emissive.getHex()){ m.emissive.copy(src.emissive); m.emissiveIntensity=src.emissiveIntensity; }   // LEDs keep their glow
    if(src.clearcoat){ m.clearcoat=src.clearcoat; m.clearcoatRoughness=src.clearcoatRoughness; }   // and LCD windows their lacquer
    const mn=src.name.replace(/\.\d+$/,"");
    if(mn==="oak"||mn==="floorboards"){ m.clearcoat=.4; m.clearcoatRoughness=.28; m.roughness=.5; }
    if(mn==="wall"){ m.roughness=.92; }
    if(mn==="gear_card") m.color.setScalar(.78);   // the rolodex's front card sits in the desk lamp's hot spot: greyer stock keeps its ink
    if(mn==="stove_glaze") m.roughness=.3;   // at Blender's .14 the lamps' highlights broke into a bright spot on every tile
    if(mn==="screen"||mn==="window_glass") return src;
  } else { m=src.clone(); }
  bakeLit(m,b,b.albedo?"1":"0");
  bakedCache.set(key,m); return m;
}
// the bake's light on a material (its irradiance maps on uv1) in place of the live lights' diffuse
function bakeLit(m,b,tag){
  m.lightMap=b.A;
  m.onBeforeCompile=sh=>{
    sh.uniforms.irrB={value:b.B}; sh.uniforms.sA={value:b.sA}; sh.uniforms.sB={value:b.sB}; sh.uniforms.bg={value:b.g}; sh.uniforms.tvCol=TVCOL; sh.uniforms.bakeGain=BAKEGAIN; sh.uniforms.specOcc=SPEC_OCC;
    sh.uniforms.irrD=b.uD; sh.uniforms.sD=b.usD; sh.uniforms.lampK=LAMP_K; sh.uniforms.floorK=FLOOR_K;
    sh.fragmentShader="uniform sampler2D irrB,irrD; uniform float sA,sB,sD,bg,bakeGain,specOcc,lampK,floorK; uniform vec3 tvCol;\n"+
      "float bakeLum(sampler2D m,vec2 u,vec2 o,float g){ vec3 w=vec3(.2126,.7152,.0722); return .25*(dot(pow(texture2D(m,u-o).rgb,vec3(g)),w)+dot(pow(texture2D(m,u+o).rgb,vec3(g)),w)+dot(pow(texture2D(m,u+vec2(o.x,-o.y)).rgb,vec3(g)),w)+dot(pow(texture2D(m,u-vec2(o.x,-o.y)).rgb,vec3(g)),w)); }\n"+sh.fragmentShader.replace("#include <lights_fragment_begin>",LIGHTS_NO_MOON).replace("#include <lights_fragment_end>",
      `#include <lights_fragment_end>
      { vec3 ia=pow(texture2D(lightMap,vLightMapUv).rgb,vec3(bg))*sA;
        if(lampK<1.||floorK<1.){ vec3 id=pow(texture2D(irrD,vLightMapUv).rgb,vec3(bg))*sD;   // the bake without the desk lamp
          ia=mix(id,ia,lampK);   // the desk lamp dimming
          if(floorK<1.){
            // the floor lamp's share of the light here (FLOOR): its direct light, from the bulb (the ray's rise tells the shade's
            // open top and bottom from its fabric), never more than the bake has, and FLOOR_BOUNCE of the rest, which it bounced
            // round the room. One share for all three channels, from the two bakes' light a texel and a half either side: channel
            // by channel and texel by texel, the bakes' noise came through as coloured blotches. What's left is a little cooler
            vec3 L=(viewMatrix*vec4(${FLOOR_P.map(v=>v.toFixed(3)).join(",")},1.)).xyz+vViewPosition; float d2=max(dot(L,L),.03), rl=inversesqrt(d2);
            float up=-(vec4(L,0.)*viewMatrix).y*rl, open=smoothstep(.5,.6,-up)+smoothstep(.65,.75,up);
            vec2 o=1.5/vec2(textureSize(irrD,0)); float li=bakeLum(irrD,vLightMapUv,o,bg)*sD, lo=mix(li,bakeLum(lightMap,vLightMapUv,o,bg)*sA,lampK);
            float dir=min((open*.85+.12)*max(dot(normal,L*rl),0.)/d2,li), f=(1.-floorK)*clamp((dir+${FLOOR_BOUNCE.toFixed(2)}*(li-dir))/max(lo,1e-4),0.,1.);
            ia*=(1.-f)*mix(vec3(1.),vec3(.9,.97,1.12),f);
          }
        }
        vec3 ib=pow(texture2D(irrB,vLightMapUv).rgb,vec3(bg))*sB;
        vec3 e=(ia+ib*tvCol)*bakeGain;
        reflectedLight.directDiffuse=vec3(0.);
        reflectedLight.indirectDiffuse=material.diffuseColor*e;
        #ifdef USE_ENVMAP
        // the panorama is the room seen from its middle. Where the bake gets far less light than the panorama gives this normal
        // (inside the bookshelf, under the desk), what blocks the light blocks the reflection too
        float so=clamp(specOcc*PI*dot(e,vec3(.2126,.7152,.0722))/max(dot(iblIrradiance,vec3(.2126,.7152,.0722)),1e-4),0.,1.);
        reflectedLight.indirectSpecular*=so;
        #ifdef USE_CLEARCOAT
        clearcoatSpecularIndirect*=so;
        #endif
        #endif
      }`);
  };
  m.customProgramCacheKey=()=>"baked"+tag;
  return m;
}
// a material of its own for one mesh (an LED that lights up), keeping the bake shader, which Material.copy() leaves behind
function ownMaterial(m){ const c=m.clone(); c.onBeforeCompile=m.onBeforeCompile; c.customProgramCacheKey=m.customProgramCacheKey; return c; }
// glass over a photo, a dial or the old PC's text: a lamp's direct highlight on it is a hard pinpoint (and on the PC it sat on
// the first line of text). k scales it (0: none); the glass still reflects the room, lamps included, from the panorama.
// With envLow below 1 the room's reflection goes down to that share as k does (the PC, while you read it).
function noGlints(m,k,envLow=1){
  const env=envLow<1?`\nfloat glintEnv=mix(${envLow.toFixed(2)},1.,glint);\nreflectedLight.indirectSpecular*=glintEnv;\n#ifdef USE_CLEARCOAT\nclearcoatSpecularIndirect*=glintEnv;\n#endif`:"";
  m.onBeforeCompile=sh=>{ sh.uniforms.glint=k; sh.fragmentShader="uniform float glint;\n"+sh.fragmentShader.replace("#include <lights_fragment_end>",
    "#include <lights_fragment_end>\nreflectedLight.directSpecular*=glint;\n#ifdef USE_CLEARCOAT\nclearcoatSpecularDirect*=glint;\n#endif"+env); };
  m.customProgramCacheKey=()=>"noglint"+envLow; return m;
}
const NO_GLINT={value:0};
const CAPTION=new THREE.MeshStandardMaterial({color:"#d9d3c4",roughness:.7,emissive:"#d9d3c4",emissiveIntensity:.05});
function shadeMat(o){
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  const m=new THREE.MeshStandardMaterial({color:"#1a140c",emissive:"#ffc98a",emissiveIntensity:.62,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{
    sh.uniforms.yr={value:new THREE.Vector2(bb.min.y,bb.max.y)}; sh.uniforms.cxz={value:new THREE.Vector2((bb.min.x+bb.max.x)/2,(bb.min.z+bb.max.z)/2)};
    sh.vertexShader="varying float vH;\nvarying vec2 vXZ;\nuniform vec2 yr,cxz;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvH=clamp((position.y-yr.x)/max(yr.y-yr.x,1e-4),0.,1.);\nvXZ=position.xz-cxz;");
    // lit fabric: brightest low down and in a band level with the bulb, dimmer where the view grazes it (more cloth in the
    // way), with soft pleats around it, so the shade reads as a round, sewn drum rather than a flat glowing tube. vH is
    // clamped again here: with MSAA an edge pixel is shaded from its centre, which can lie just off the triangle, where vH
    // runs below 0 and pow() gives NaN (it drew a black ring round the bottom rim)
    sh.fragmentShader="varying float vH;\nvarying vec2 vXZ;\n"+sh.fragmentShader.replace("#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float shadeH=clamp(vH,0.,1.), shadeZ=(shadeH-.42)/.17, ndv=abs(dot(normalize(normal),normalize(vViewPosition)));
      totalEmissiveRadiance*=(mix(1.3,.5,pow(max(shadeH,1e-5),.85))+.45*exp(-shadeZ*shadeZ)+(gl_FrontFacing?0.:.35*(1.-shadeH)))
        *(gl_FrontFacing?mix(.62,1.,sqrt(ndv)):1.)*(.97+.03*sin(atan(vXZ.y,vXZ.x)*36.));`);
  };
  m.customProgramCacheKey=()=>"shade"; return m;
}
// the loading display's steps (its script, at the top of the page: __osdStep): the page goes on once the display has drawn
// the step, as the work that follows may keep it from drawing for a while (building the room; drawing it the first time,
// which waits for its shaders: holdDraw). Without the display it goes straight on.
let holdDraw=false, holdT=0;
function osdPaint(n){ const p=window.__osdStep?.(n); return p&&typeof p.then==="function"?p:Promise.resolve(); }
function loadScene(onLoad,onErr){
  const get=u=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u+" "+r.status); return r.json(); });
  // (the geometry's parts are read as they stream in, for the loading display's count)
  const stream=u=>fetch(u).then(async r=>{ if(!r.ok) throw new Error(u+" "+r.status); const feed=window.__osdFeed; if(!feed||!r.body) return r.json();
    const rd=r.body.getReader(), got=[]; for(;;){ const {done,value}=await rd.read(); if(done) break; got.push(value); feed(value.length); }
    return JSON.parse(await new Blob(got).text()); });
  // the glTF JSON and its geometry (base64 in a few JSON parts) are stitched into a GLB and parsed from memory
  Promise.all([get(SCENE_BASE+"gl/scene.json"),bakeReady]).then(([g])=>
    Promise.all(Array.from({length:g.extras.binParts},(_,i)=>stream(`${SCENE_BASE}gl/bin${i}.json`))).then(parts=>osdPaint(1).then(()=>{
      new GLTFLoader().parse(memGlb(g,parts),SCENE_BASE+"gl/",onLoad,onErr);   // (the text straight into the GLB, a slice at a time: perf/mem)
    }))).catch(onErr);
}
// the geometry comes quantized (tv/quantize.py): positions, and UVs outside 0..1, as 16-bit steps over each accessor's own range,
// carried in the primitive's extras. They are expanded back to floats before anything measures the scene.
function expandQuantized(root){
  const done=new Set(), NAME={POSITION:"position",TEXCOORD_0:"uv",TEXCOORD_1:"uv1"};
  root.traverse(o=>{ const g=o.geometry, dq=g&&g.userData.dq; if(!dq||done.has(g)) return; done.add(g);
    for(const [k,p] of Object.entries(dq)){ const a=g.attributes[NAME[k]]; if(!a) continue;
      const n=a.itemSize, q=a.array, f=new Float32Array(q.length);
      for(let i=0;i<q.length;i+=n) for(let c=0;c<n;c++) f[i+c]=p[c]+p[n+c]*q[i+c]/65535;
      g.setAttribute(NAME[k],new THREE.BufferAttribute(f,n)); }
    g.computeBoundingBox(); g.computeBoundingSphere(); });
}
// the room is built once the loading display has drawn the scene's parse (osdPaint)
const sceneErr=e=>{ still?.remove(); $("#err").hidden=false; $("#err").textContent="Couldn't load the scene."; console.error(e); };
loadScene(gltf=>osdPaint(2).then(()=>clockP).then(()=>{
  const root=gltf.scene; gltf.parser=null; expandQuantized(root); winUV(THREE,root,BAKE); scene.add(root);
  // an object with several materials arrives as a Group of meshes called mesh_N; name them after the object
  // (gear_phone~0, gear_phone~1, ...) so the name patterns below and the camera anchors find them
  root.traverse(o=>{ if(o.isMesh&&/^mesh_\d/.test(o.name)&&o.parent&&o.parent.name&&!/^mesh_/.test(o.parent.name)) o.name=o.parent.name+"~"+o.parent.children.indexOf(o); });
  const T={
    tv_plastic:{roughnessMap:grainTex,bumpMap:grainTex,bumpScale:.15,roughness:.62},
    tv_bezel:{roughnessMap:grainTex,bumpMap:grainTex,bumpScale:.12,roughness:.55},
    vcr_body:{roughnessMap:grainTex,roughness:.5},
    oak:{map:oakTex,bumpMap:oakBump,bumpScale:.4,roughnessMap:oakBump,roughness:.6,color:"#ffffff"},
    wall:{roughnessMap:plasterTex,bumpMap:plasterTex,bumpScale:1.2,color:"#b3a58f"},
    frame_paint:{color:"#d8d1c4",roughness:.42},
    sill:{roughness:.28,color:"#bdb6aa"},
    silk:{roughness:.7}, metal:{roughness:.28}, brass:{roughness:.32},
    // mottled plastics: Blender drives their roughness through a noise ramp, which exports as 1; these are the ramps' middles
    gear_phone_body:{roughness:.42}, gear_card:{roughness:.85}, gear_pager:{roughness:.45}, gear_calc:{roughness:.42}, gear_telbook_cover:{roughness:.7},
    gear_discman_silver:{roughness:.34,color:"#9fa2a7"}, retro_beige:{roughness:.46}, retro_beige_front:{roughness:.5}, retro_grey:{roughness:.44},
    retro_kb_case:{roughness:.48}, retro_key:{roughness:.42}, retro_key_dark:{roughness:.45},
  };
  const tapeParts=new Map();   // cassette index in the scene -> its meshes
  const prints=[];   // printed text on the desk gear
  const marks=[];
  root.traverse(o=>{
    if(o.name==="wall_clock_body") clockBody=o;   // two materials: arrives as a Group
    if(!o.isMesh) return;
    if(/^coffee/.test(o.name)){ o.updateWorldMatrix(true,false); new THREE.Box3().setFromObject(o).getCenter(MUG); }
    o.castShadow=true; o.receiveShadow=true;
    const n=o.name, mname=o.material.name.replace(/\.\d+$/,""); o.userData.mname=mname;
    if(/^gear_(print_dark|print_light|ink_blue)$/.test(mname)&&/^gear_(phone|telbook|rolodex|floppies|calc)~/.test(n)) prints.push(o);
    const tw=T[mname];
    if(tw){ for(const [k,v] of Object.entries(tw)){ if(k==="color") o.material.color.set(v); else o.material[k]=v; } o.material.needsUpdate=true; }
    // the mug (v16): a satin body under a clear glaze, and coffee that mirrors the room with a thin lighter ring where it meets the glaze
    if(mname==="mug_glaze"&&!o.material.isMeshPhysicalMaterial){ const s=o.material; o.material=new THREE.MeshPhysicalMaterial({name:s.name,color:s.color,roughness:.36,clearcoat:1,clearcoatRoughness:.06}); }
    if(mname==="mug_coffee"){ o.material=o.material.clone(); o.material.roughness=.03; o.material.color.set("#ffffff"); o.material.map=COFFEE_TEX(); }
    if(FADES.some(F=>F.re.test(n))) o.material=o.material.clone();   // its own materials, so it can fade alone (FADES)
    // the meshes of a multi-material object (mesh_N above) bake with their Group, which carries the object's userData. Two
    // keep real-time light, because their lightmap is too coarse: the phone's coiled cord (about one texel per loop) and the
    // encyclopedias (2 cm spines, under two texels, which bake into streaks).
    const bk=o.userData.baked?o.userData:/~\d+$/.test(n)&&o.parent.userData.baked?o.parent.userData:null;
    if(mname==="window_glass"||o.material.transmission>0||o.material.transparent||mname==="gear_cord_beige"||/^book_encyclopedia/.test(n)||/^tape_(label|toplabel|shell)_/.test(n)){ }
    else if(bk&&BAKE[bk.atlas]){ o.material=bakedMaterial(o.material,bk.atlas); o.castShadow=o.receiveShadow=false; }
    if(o.userData.winPaint) o.material=winPaint(THREE,o.material,o.userData.winPaint);   // the window's frame and sill (winframe/winframe.js)
    if(/^retro_(body|monitor|keyboard)(~\d+)?$/.test(n)) o.material=pcCase(THREE,o.material,mname);   // the old PC's plastic (pccase/case.js)
    if(o.material.transmission>0){ const g=o.material.clone(); g.transmission=0; g.transparent=true; g.opacity=.18; g.roughness=.05; g.depthWrite=false; o.material=g; noDepth.push(o); }
    // the glass over a photo or the clock's dial only reflects: a white pane lit live laid a grey veil over what's behind it
    if(/^(standing_picture_frame_\d+|hanging_picture_frame_\d+|wall_clock)_glass$/.test(mname)){ o.material.color.setScalar(0); noGlints(o.material,NO_GLINT); }
    // the old PC's key legends are added after the bake and lit live, which washes their ink out next to the baked caps
    if(n==="retro_legends"||n==="retro_legends_light"){ o.material=o.material.clone(); o.material.color.set(n==="retro_legends"?"#24221e":"#c9c1ae"); o.castShadow=o.receiveShadow=false; }
    if(n.startsWith("floorlamp_shade")){ o.material=shadeMat(o); o.castShadow=false; FLOOR.shades.push(o.material); }
    if(n==="mug_handle"&&!o.userData.baked){ o.material=o.material.clone(); o.material.color.multiply(new THREE.Color("#a88462")); o.material.envMapIntensity=.35; }
    if(/^(t_(btn|knob)_\d|t_power|t_input|rule_input|vcr_t\d)/.test(n)){ o.material=CAPTION; o.castShadow=o.receiveShadow=false; }
    if(n.startsWith("floorlamp_bulb")){ o.material=new THREE.MeshStandardMaterial({color:"#fff1d6",emissive:"#ffc47e",emissiveIntensity:5}); o.castShadow=false; }
    if(n.startsWith("floorlamp_")) interact.set(o,{kind:"floor",label:"SWITCH OFF"});
    if(/^wall_clock_(hours|minute|second)/.test(n)) clockHands.push(o);
    if(mname==="screen"){
      tvScreen=o; o.position.z+=GLASS_OUT; screenMat=new THREE.MeshPhysicalMaterial({color:"#0c0e0d",roughness:.2,roughnessMap:smudgeTex,metalness:0,clearcoat:1,clearcoatRoughness:.05,emissive:"#ffffff",emissiveMap:rt.texture,emissiveIntensity:1.6});
      o.material=screenMat; o.castShadow=false; interact.set(o,{kind:"screen",label:"ZOOM"});
    }
    if(mname==="curtain"){ o.material=new THREE.MeshPhysicalMaterial({color:"#b7ab98",roughness:1,sheen:.45,sheenColor:new THREE.Color("#eadcc6"),sheenRoughness:.8,envMapIntensity:.5,side:THREE.DoubleSide}); }
    if(mname==="bulb"){ o.material=new THREE.MeshStandardMaterial({color:"#fff1d6",emissive:"#ffc47e",emissiveIntensity:4}); o.castShadow=false; if(!n.startsWith("floorlamp")) DESK.bulb=o.material; else FLOOR.bulb=o.material; }
    if(/^(lamp_(shade|base|arm)|bulb)$/.test(n)) interact.set(o,{kind:"lamp",label:"SWITCH OFF"});
    if(mname==="vfd"){ o.material=new THREE.MeshStandardMaterial({color:"#000",roughness:.1,emissive:"#fff",emissiveMap:vfdTex,emissiveIntensity:2.4}); }
    if(mname==="ir"){ remoteIR=o; o.material=ownMaterial(o.material); }
    if(mname==="window_glass"){
      o.castShadow=false; o.receiveShadow=false;
      o.material=n.startsWith("win_out")?rainGlass():new THREE.MeshPhysicalMaterial({color:"#dfe6ff",transparent:true,opacity:.07,roughness:.04,depthWrite:false});
      o.renderOrder=5; noDepth.push(o);
      if(n.startsWith("win_in")) interact.set(o,{kind:"window",label:"LOOK OUTSIDE"});
    }
    if(mname==="led"){ o.material=ownMaterial(o.material); o.material.emissive=new THREE.Color("#000"); o.castShadow=false;
      if(n==="led_power") powerLed=o; else if(/^led_\d$/.test(n)) leds[+n[4]]=o; else if(n.startsWith("vcr_led")) vcrLed=o; }
    let m;
    if((m=n.match(/^btn_(\d)$/))){ const i=+m[1]; interact.set(o,{kind:"btn",i,label:TV_LABEL[i]||""}); buttons[i]=o; o.userData.home=o.position.clone(); }
    else if(n==="btn_power"){ interact.set(o,{kind:"power",label:"POWER"}); buttons.power=o; o.userData.home=o.position.clone(); }
    else if((m=n.match(/^knob_(\d)$/))){ interact.set(o,{kind:"knob",i:+m[1],label:["VOLUME","TRACKING","CHROMA"][+m[1]]}); knobs[+m[1]]=o; }
    else if((m=n.match(/^knob_(\d)_mark/))){ marks.push([o,+m[1]]); }
    else if((m=n.match(/^tape_(?:[a-z]+_)?(\d)/))){ const j=+m[1]; if(!tapeParts.has(j)) tapeParts.set(j,[]); tapeParts.get(j).push(o); }   // one digit: Blender's .001 copies arrive as tape_hub_4001
    else if(n.startsWith("remote")){ interact.set(o,{kind:"remote",label:"REMOTE · NEXT"}); }
    else if(/^gear_phone(?!_line)/.test(n)){ interact.set(o,{kind:"phone",label:"PHONE · GO ONLINE"}); }
    else if(/^gear_discman(~\d+)?$/.test(n)){ interact.set(o,{kind:"cd",label:"MUSIC · PAUSE"}); cdParts.push(o); }   // the CD player: the room's music
    else if((m=n.match(/^vcr_btn_(\d)/))){ interact.set(o,{kind:"vcr",i:+m[1],label:["PLAY","STOP","REW","FF","REC"][+m[1]]}); o.userData.home=o.position.clone(); }
    else if(n.startsWith("vcr_door")&&!n.includes("line")){ vcrDoor=o; interact.set(o,{kind:"eject",label:"EJECT"}); }
  });
  root.traverse(o=>{
    if(/^(magnifying_glass|cigarette_pack|vintage_lighter)/.test(o.name)) o.visible=false;
    if(o.name==="t_tapetron"||o.name==="wordmark") o.visible=false;
  });
  marks.forEach(([o,i])=>knobs[i]&&knobs[i].attach(o));
  knobs.forEach(k=>{ k.userData.base=k.rotation.clone(); });
  setupShelf(tapeParts);
  dressTapes();
  Promise.all([fontsReady,chReady]).then(dressTapes);
  setKnob(0,state.volume); setKnob(1,state.tracking); setKnob(2,state.chroma);
  setupClock(); setupPC(root); setupPrint(root); setupMonBtn(root); setupVelqoreBadge(root); pcCaseLip(THREE,root); scene.updateMatrixWorld(true); measureAnchors(scene);
  if(!PC.mesh) prints.forEach(o=>o.visible=false);   // v5 scenes (no old PC yet) printed their gear labels in German; v6 prints them in English
  restProps(root);
  // Work's card: the yellow pad (it also moves the pencil and the glasses off it, over to the A4 sheets)
  notepad=createNotepad(THREE,{scene,root,interact,view:()=>view,reduce,fonts:fontsReady,anisotropy:renderer.capabilities.getMaxAnisotropy(),
    content:()=>({tape:state.tape,st:state.tapeState,tapes:TAPES.map((_,i)=>tapeInfo(i)),exp:EXP,edu:EDU,jobs:JOBS}),audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master}:null});
  // the credits: typed on the card file's open card, which it takes out of the file (before the room is joined for drawing)
  credits=createCredits(THREE,{scene,root,interact,view:()=>view,reduce,anisotropy:renderer.capabilities.getMaxAnisotropy(),
    content:()=>({credits:CREDITS,ccBy:CC_BY,cc0:CC0,fs:FS,props:["Poly Haven","https://polyhaven.com/models"]}),audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master}:null});
  // the CD player: its close-up, buttons, wheel and LCD (the music itself runs from the start: createMusic)
  cd=createCDPlayer(THREE,{root,interact,view:()=>view,canvas,music,reduce,audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master}:null,soundOn:()=>{ if(!A.on) setSound(true); },live,claim:cdClaim,give:cdGive});
  // the calculator: a click lifts it off the desk and it works (calc/)
  try{ calc=createCalculator(THREE,{scene,root,interact,view:()=>view,reduce,anisotropy:renderer.capabilities.getMaxAnisotropy(),live,
    audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master}:null,changed:up=>{ document.body.classList.toggle("calcup",up); setHint(); }}); }catch(e){ console.warn("calculator",e); }
  // the coffee: a click drinks a sip, with a slurp, until it's gone and the steam with it (Felix, 26 Sep 16:21Z)
  try{ coffee=createCoffee(THREE,{root,interact,MUG,reduce,live,view:()=>view,audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master,verb:A.verb}:null}); }catch(e){ console.warn("coffee",e); }
  // the wall clock: a click takes its battery out and it stops, another puts it back (Felix, 28 Sep 01:55Z)
  try{ if(clockMod) clock=clockMod.createClock(THREE,{scene,body:clockBody,pivots:clockPivots,interact,night:nightMs,reduce,live,view:()=>view,audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master,verb:A.verb}:null}); }catch(e){ console.warn("clock",e); }
  // the VCR's flap: an opening through its front, a dark well behind, the flap hinged at its front top edge (vcrdoor/)
  vcr=createVCRDoor(THREE,{root,scene,door:vcrDoor,reduce,audio:()=>A.on&&A.ctx?{ctx:A.ctx,out:A.master,verb:A.verb}:null});
  // furniture the orbit can reach: the stove and the bookshelf (tall, backs to a wall) slide the view out of their front, the
  // rest lifts it over their top. The PC sits on the chest of drawers and the TV on the VCR, so each pair is one block. The
  // floor lamp, free-standing at eye height, fades instead (FADES).
  for(const [re,ax] of [[/^wooden_bookshelf/,"z"],[/^stove/,"z"],[/^painted_wooden_chair/,"y"],[/^mid_century_lounge_chair/,"y"],[/^painted_wooden_nightstand/,"y"],[/^(retro_(body|monitor|keyboard|screen)|vintage_wooden_drawer)/,"y"],[/^desk_(top|apron|leg)/,"y"],[/^(tv_|screen$|vcr_)/,"y"]]){
    const b=new THREE.Box3(); let any=false; root.traverse(o=>{ if(o.isMesh&&re.test(o.name)){ b.expandByObject(o,true); any=true; } });
    if(!any) continue; b.expandByScalar(.05); b.min.y=Math.min(b.min.y,-.05);
    // a sideways push goes away from the wall the piece stands against
    OBST.push({b,ax,s:ax==="y"?1:b.max.z>ROOM_IN.z1?-1:1}); }   // tapes live in their own groups under scene
  { const shown=o=>{ for(let q=o;q;q=q.parent) if(!q.visible||/^city_/.test(q.name)) return false; return true; };   // (the city outside never blocks a pick, and a window switched away mustn't linger here)
    scene.traverse(o=>{ if(!o.isMesh||interact.has(o)||noDepth.includes(o)||o.material.transparent||!shown(o)) return;
      o.geometry.boundingSphere||o.geometry.computeBoundingSphere(); const r=o.geometry.boundingSphere.radius*o.getWorldScale(_v).x; if(r<1.2) occluders.push(o); }); }
  root.traverse(o=>{ const F=o.isMesh&&FADES.find(F=>F.re.test(o.name)); if(F){ o.material.transparent=true; F.parts.push(o); F.box.expandByObject(o,true); } });
  // the old PC's keyboard: a key typed at the PC presses its cap, and the computer view stands back to show it (pckeys/)
  try{ pckeys=createPCKeys(THREE,{root,input:pcKbd,wide:"visit"}); }catch(e){ console.warn("pc keys",e); }
  joinRoom(root);   // fewer draw calls (perf/join)
  if(ENTRY) go("home",{instant:true,silent:true,entry:true}); else go(pageFromUrl(),{instant:true,silent:true});   // a page's own link: home first (entryGo)
  if(OPEN_OPTIONS&&!ENTRY) pcOptions();
  // (the loading display: the room is built, its shaders compile next. The room isn't drawn until they have and the display
  // shows it (holdDraw, frame()): its first frame would wait for all of them, and the display with it, v54's 75%)
  memTextures();   // the room's pictures: uploaded now, their copies in memory let go (perf/mem)
  holdDraw=true; holdT=performance.now(); window.__osdStep?.(3);
  // the canvas fades in once it has drawn the room: shaders compile first (off the main thread where the browser can), so
  // neither a blank canvas nor a stalled first frame fades in over the still. They compile for the composer's target, as the
  // room is drawn (no tone mapping there; for the screen they'd be a second, unused set). three's promise never settles if a
  // material is disposed meanwhile (a Window option picked during the compile), so the reveal waits 5 s at most.
  const prevRT=renderer.getRenderTarget(); renderer.setRenderTarget(composer.readBuffer);
  let warm=Promise.resolve();
  try{ if(renderer.extensions.has("KHR_parallel_shader_compile")) warm=renderer.compileAsync(scene,view).catch(()=>{}); else renderer.compile(scene,view); }catch{}
  renderer.setRenderTarget(prevRT);
  Promise.race([warm,new Promise(r=>setTimeout(r,5000))]).then(()=>osdPaint(4)).then(()=>{ holdDraw=false; if(GATE) gateUp(); else revealNext=true; });   // (the gate: click to enter)
}).catch(sceneErr),sceneErr);

// >>> perf/join: room
// ======================================================================= fewer draw calls (vhs-tv/perf/join)
// Every mesh the room arrives with was a draw call of its own: some 650 a frame at home, most of the time a frame takes the
// CPU (thread "Room frame rate"). Meshes that don't move and share a material, their shadow settings and a vertex layout are
// drawn as one: joined into one geometry, in groups at most JOIN.reach across, so a close-up still leaves the far side of the
// room out, and laid in near to far from the home view within each, the order the room drew them in. Each cassette's parts
// are joined the same way inside the cassette's own group, which the shelf and the VCR move as before.
// Materials that are copies of one another count as one (joinMat): the bake gives each of the model's materials its own, and
// many come out the same (same atlas, textures and numbers). Only three's own materials, unpatched or with the bake's patch
// (bakeLit, whose state is its atlas, which the light map pins), since another patch may keep state no property shows.
// The meshes themselves stay where they were, for picking, the occluders and all that finds or measures them by name, on a
// layer the camera doesn't draw (JOIN.layer) and the pick ray reads. What moves or changes keeps its own meshes: all that can
// be clicked but the phone, the remote and the desk lamp (JOIN_STILL), the PC's moving parts, the LEDs, the clock, the print.
// Each time the room is drawn, a joined part that has moved, been hidden or been given another material since, or whose
// material no longer matches the one it's drawn with, is drawn on its own again with the rest of its group (joinCheck), so a
// later change to the room can't leave a joined copy behind. __scene.perf.join(false) draws every mesh on its own again.
const JOIN={on:false,layer:2,reach:2.5,meshes:[],tapes:new Set(),ms:0};
const JOIN_STILL=new Set(["phone","remote","lamp","rolodex"]);   // (rolodex: the card file lifts out a card of its own, credits/)   // act(): the phone goes Online, the remote blinks its own LED, the lamp switches its bulb
const SHARE={rep:new Map(),bySig:new Map(),baked:null};
const SHARE_SKIP=new Set(["uuid","id","name","version","userData","_listeners","onBeforeCompile","customProgramCacheKey"]);
const PERF={join:v=>setJoin(v),fold:v=>setFold(v),get renderer(){ return renderer; },get composer(){ return composer; },
  get joined(){ return {on:JOIN.on,ms:Math.round(JOIN.ms),meshes:JOIN.meshes.length,parts:JOIN.meshes.reduce((n,j)=>n+j.userData.snap.length,0),
    drawn:JOIN.meshes.filter(j=>j.visible).length,apart:JOIN.meshes.filter(j=>JOIN.on&&!j.visible).map(j=>j.name)}; },get folded(){ return FOLD.on; }};
// a material as the list of all it holds (textures by identity), or null if it can't be told from its properties
function matSig(m){
  const M=THREE.Material.prototype;
  if(!m.isMaterial||m.isShaderMaterial) return null;
  const hooks=m.onBeforeCompile!==M.onBeforeCompile||m.customProgramCacheKey!==M.customProgramCacheKey;
  if(hooks&&!(SHARE.baked||(SHARE.baked=new Set(bakedCache.values()))).has(m)) return null;
  const val=v=>v==null?String(v):v.isTexture?"T"+v.uuid:v.isColor?"C"+v.r+","+v.g+","+v.b:v.isVector2||v.isVector3||v.isVector4||v.isEuler?"V"+v.toArray().join(","):v.isMatrix3||v.isMatrix4?"M"+v.elements.join(","):typeof v==="function"?null:typeof v==="object"?JSON.stringify(v):String(v);
  const out=[m.type,hooks?"key="+m.customProgramCacheKey():""];
  for(const k of Object.keys(m).sort()){ if(SHARE_SKIP.has(k)) continue; const x=val(m[k]); if(x===null) return null; out.push(k+"="+x); }
  return out.join(";");
}
// the material a mesh is joined with: the first one seen of those identical to its own
function joinMat(m){
  if(SHARE.rep.has(m)) return SHARE.rep.get(m);
  let r=m; try{ const s=matSig(m); if(s){ r=SHARE.bySig.get(s)||m; if(r===m) SHARE.bySig.set(s,m); } }catch{ r=m; }
  SHARE.rep.set(m,r); return r;
}
// is a part's own material still the same as the copy it's drawn with: what the room might change on a material while it
// runs (spelled out, not looped over by name: this runs for every such part each frame)
const sameC=(x,y)=>x===y||(!!x&&!!y&&x.r===y.r&&x.g===y.g&&x.b===y.b), sameV=(x,y)=>x===y||(!!x&&!!y&&x.x===y.x&&x.y===y.y);
const sameLive=(a,b)=>sameC(a.color,b.color)&&sameC(a.emissive,b.emissive)&&a.emissiveIntensity===b.emissiveIntensity&&a.opacity===b.opacity&&
  a.roughness===b.roughness&&a.metalness===b.metalness&&a.map===b.map&&a.lightMap===b.lightMap&&a.lightMapIntensity===b.lightMapIntensity&&
  a.envMap===b.envMap&&a.envMapIntensity===b.envMapIntensity&&a.aoMap===b.aoMap&&a.aoMapIntensity===b.aoMapIntensity&&a.normalMap===b.normalMap&&
  sameV(a.normalScale,b.normalScale)&&a.bumpMap===b.bumpMap&&a.bumpScale===b.bumpScale&&a.roughnessMap===b.roughnessMap&&a.metalnessMap===b.metalnessMap&&
  a.emissiveMap===b.emissiveMap&&a.alphaMap===b.alphaMap&&a.alphaTest===b.alphaTest&&a.side===b.side&&a.depthWrite===b.depthWrite&&
  a.depthTest===b.depthTest&&a.colorWrite===b.colorWrite&&a.clearcoat===b.clearcoat&&a.clearcoatRoughness===b.clearcoatRoughness&&a.sheen===b.sheen&&
  sameC(a.sheenColor,b.sheenColor)&&a.transmission===b.transmission&&a.ior===b.ior&&a.specularIntensity===b.specularIntensity&&
  sameC(a.specularColor,b.specularColor)&&a.toneMapped===b.toneMapped&&a.fog===b.fog&&a.flatShading===b.flatShading&&a.vertexColors===b.vertexColors&&
  a.wireframe===b.wireframe&&a.polygonOffset===b.polygonOffset&&a.polygonOffsetFactor===b.polygonOffsetFactor&&a.polygonOffsetUnits===b.polygonOffsetUnits&&
  a.blending===b.blending&&a.transparent===b.transparent&&a.visible===b.visible&&a.alphaHash===b.alphaHash&&a.dithering===b.dithering;
function joinKey(o){
  const m=o.material, g=o.geometry, P=THREE.Object3D.prototype;
  if(!o.isMesh||!g||!m||Array.isArray(m)||o.isInstancedMesh||o.isSkinnedMesh||o.isBatchedMesh||o.morphTargetInfluences) return null;
  if(m.transparent||!m.depthWrite||!m.depthTest||!m.visible||m.wireframe||m.alphaHash||o.layers.mask!==1) return null;
  if(o.onBeforeRender!==P.onBeforeRender||o.onAfterRender!==P.onAfterRender||o.customDepthMaterial||o.customDistanceMaterial) return null;
  const A=g.attributes;
  if(!A.position||!A.normal||A.tangent||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity) return null;
  return [joinMat(m).id,Object.keys(A).sort().map(k=>k+A[k].itemSize).join(),o.castShadow,o.receiveShadow,o.renderOrder,o.frustumCulled].join("|");
}
// a list of meshes cut along its longest side, at the middle one, until every piece is at most JOIN.reach across
function joinClusters(list,out=[]){
  const bs=list.map(o=>{ const g=o.geometry; if(!g.boundingBox) g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(o.matrixWorld); });
  const all=new THREE.Box3(); bs.forEach(b=>all.union(b)); const s=all.getSize(new THREE.Vector3());
  if(list.length<2||Math.max(s.x,s.y,s.z)<=JOIN.reach){ out.push(list); return out; }
  const ax=s.x>=s.y&&s.x>=s.z?"x":s.y>=s.z?"y":"z", mid=bs.map(b=>b.min[ax]+b.max[ax]), ord=list.map((_,i)=>i).sort((i,j)=>mid[i]-mid[j]), h=ord.length>>1;
  joinClusters(ord.slice(0,h).map(i=>list[i]),out); joinClusters(ord.slice(h).map(i=>list[i]),out); return out;
}
// one mesh for several that share a material: their vertices taken into the parent's space (normals by the inverse transpose,
// as the shader would; a mirrored one's triangles turned round, as three turns the front face for it). local: the parts hang
// right under that parent (a cassette), so it's their own transforms that must stay put, not their place in the room
function joinMeshes(parts,parent,local){
  parent.updateMatrixWorld(true);
  const inv=parent.matrixWorld.clone().invert(), m=new THREE.Matrix4(), nm=new THREE.Matrix3(), v=new THREE.Vector3(), g0=parts[0].geometry, names=Object.keys(g0.attributes);
  let nv=0, ni=0; for(const o of parts){ const g=o.geometry, n=g.attributes.position.count; nv+=n; ni+=g.index?g.index.count:n; }
  const arr={}; for(const k of names) arr[k]=new Float32Array(nv*g0.attributes[k].itemSize);
  const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni); let vo=0, io=0;
  const plain=a=>!a.isInterleavedBufferAttribute&&!a.normalized&&a.array instanceof Float32Array;
  for(const o of parts){
    const g=o.geometry, n=g.attributes.position.count; if(local) m.copy(o.matrix); else m.multiplyMatrices(inv,o.matrixWorld); nm.getNormalMatrix(m);
    const e=m.elements, q=nm.elements;
    for(const k of names){ const a=g.attributes[k], s=a.itemSize, d=arr[k];
      if(k==="position"||k==="normal"){ const P=k==="position";
        if(plain(a)){ const x=a.array; for(let i=0,j=vo*3;i<n*3;i+=3,j+=3){ const X=x[i], Y=x[i+1], Z=x[i+2];
            if(P){ d[j]=e[0]*X+e[4]*Y+e[8]*Z+e[12]; d[j+1]=e[1]*X+e[5]*Y+e[9]*Z+e[13]; d[j+2]=e[2]*X+e[6]*Y+e[10]*Z+e[14]; }
            else { d[j]=q[0]*X+q[3]*Y+q[6]*Z; d[j+1]=q[1]*X+q[4]*Y+q[7]*Z; d[j+2]=q[2]*X+q[5]*Y+q[8]*Z; } } }
        else for(let i=0;i<n;i++){ v.fromBufferAttribute(a,i); if(P) v.applyMatrix4(m); else v.applyMatrix3(nm); d[(vo+i)*3]=v.x; d[(vo+i)*3+1]=v.y; d[(vo+i)*3+2]=v.z; } }
      else if(plain(a)) d.set(a.array.subarray(0,n*s),vo*s);
      else for(let i=0;i<n;i++){ const j=(vo+i)*s; d[j]=a.getX(i); if(s>1) d[j+1]=a.getY(i); if(s>2) d[j+2]=a.getZ(i); if(s>3) d[j+3]=a.getW(i); } }
    const flip=m.determinant()<0, ix=g.index?.array, cnt=ix?g.index.count:n;
    for(let t=0;t+2<cnt;t+=3){ const a=ix?ix[t]:t, b=ix?ix[t+1]:t+1, c=ix?ix[t+2]:t+2; idx[io++]=vo+a; idx[io++]=vo+(flip?c:b); idx[io++]=vo+(flip?b:c); }
    vo+=n;
  }
  const geo=new THREE.BufferGeometry(); for(const k of names) geo.setAttribute(k,new THREE.BufferAttribute(arr[k],g0.attributes[k].itemSize));
  geo.setIndex(new THREE.BufferAttribute(io<idx.length?idx.subarray(0,io):idx,1)); geo.computeBoundingBox(); geo.computeBoundingSphere();
  const o=parts[0], j=new THREE.Mesh(geo,joinMat(o.material));
  j.name="joined:"+(j.material.name||o.name); j.castShadow=o.castShadow; j.receiveShadow=o.receiveShadow; j.renderOrder=o.renderOrder; j.frustumCulled=o.frustumCulled;
  j.raycast=()=>{}; j.visible=false;
  j.userData.local=!!local; j.userData.snap=parts.map(p=>({o:p,m:p.material,sh:p.material!==j.material,v:p.material.version,cs:p.castShadow,rs:p.receiveShadow,ro:p.renderOrder,e:(local?p.matrix:p.matrixWorld).elements.slice()}));
  parent.add(j); JOIN.meshes.push(j); return j;
}
// do all of a joined mesh's parts still look as they did when they were joined: same place, material and settings, shown
function joinCheck(j){
  const P=j.parent, L=j.userData.local;
  for(const S of j.userData.snap){
    const o=S.o, m=o.material;
    if(m!==S.m||m.transparent||!m.visible||o.castShadow!==S.cs||o.receiveShadow!==S.rs||o.renderOrder!==S.ro||(L&&o.parent!==P)) return false;
    if(S.sh&&(m.version!==S.v||!sameLive(m,j.material))) return false;   // (drawn with an identical copy of its material: still identical?)
    let q=o; for(;q.parent;q=q.parent) if(!q.visible) return false;
    if(q!==scene) return false;
    const a=(L?o.matrix:o.matrixWorld).elements, e=S.e; for(let k=0;k<16;k++) if(a[k]!==e[k]) return false;
  }
  return true;
}
function joinShow(j,on){
  j.visible=on; for(const S of j.userData.snap) S.o.layers.set(on?JOIN.layer:0);
  if(!on&&JOIN.on&&!j.userData.told){ j.userData.told=true; console.info("join: "+j.name+" is drawn part by part again: one of its "+j.userData.snap.length+" parts has changed"); }
}
function joinGuard(){ if(JOIN.on) for(const j of JOIN.meshes){ const ok=joinCheck(j); if(ok!==j.visible) joinShow(j,ok); } }
function setJoin(on){ JOIN.on=!!on; for(const j of JOIN.meshes) joinShow(j,JOIN.on&&joinCheck(j)); shadowsDirty=2; }
// once the room is set up (the pad and the CD player have their meshes, the shelf its cassettes, FADES its parts)
function joinRoom(root){
  if(window.__scene) window.__scene.perf=PERF;
  const t0=performance.now();
  try{
    const keep=new Set(), hold=o=>o&&o.traverse(q=>keep.add(q));
    for(const [o,info] of interact) if(!JOIN_STILL.has(info.kind)) hold(o);
    FADES.forEach(F=>F.parts.forEach(hold));
    [PC.mesh,PC.btn,PC.led,powerLed,vcrLed,remoteIR,vcrDoor,tvScreen,clockBody,PRINT.mesh?.parent,...leds,...knobs,...clockHands,...cdParts,...noDepth].forEach(hold);
    hold(root.getObjectByName("gear_discman"));   // the CD player's module moves its buttons and wheel (cdplayer/)
    root.updateMatrixWorld(true);
    const shown=o=>{ for(let q=o;q;q=q.parent) if(!q.visible||/^city_/.test(q.name)) return false; return true; }, bins=new Map();
    root.traverse(o=>{ if(keep.has(o)||!o.isMesh||!shown(o)) return; const k=joinKey(o); if(!k) return; if(!bins.has(k)) bins.set(k,[]); bins.get(k).push(o); });
    const at=new THREE.Group(); at.name="joined"; scene.add(at); at.updateMatrixWorld(true);
    const eye=frameFor("home").pos, c=new THREE.Vector3(), far=o=>{ const g=o.geometry; if(!g.boundingSphere) g.computeBoundingSphere(); return c.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld).distanceToSquared(eye); };
    for(const list of bins.values()) for(const cl of joinClusters(list)) if(cl.length>1) joinMeshes(cl.sort((a,b)=>far(a)-far(b)),at,false);
    ray.layers.enable(JOIN.layer);
    const before=scene.onBeforeRender; scene.onBeforeRender=function(...a){ before.apply(this,a); joinGuard(); };   // (after the scene's matrices are updated, before it's drawn)
    setJoin(true);
  }catch(e){ console.warn("join: the room is drawn mesh by mesh",e); setJoin(false); }
  JOIN.ms+=performance.now()-t0;
}
// each cassette's parts, once dressTapes has given them their shells and labels
function joinTapes(){
  const t0=performance.now();
  try{
    tapeGroups.forEach(g=>{ if(!g||JOIN.tapes.has(g)) return; JOIN.tapes.add(g);
      const bins=new Map(); for(const o of g.children){ const k=!o.children.length&&o.visible&&joinKey(o); if(!k) continue; if(!bins.has(k)) bins.set(k,[]); bins.get(k).push(o); }
      for(const list of bins.values()) if(list.length>1) joinMeshes(list,g,true); });
    ray.layers.enable(JOIN.layer); setJoin(JOIN.on);
  }catch(e){ console.warn("join: the cassettes are drawn part by part",e); setJoin(false); }
  JOIN.ms+=performance.now()-t0;
}
// <<< perf/join: room
// ======================================================================= the wall clock (nightMs: always a little past eleven)
const clockPivots=[], CLOCK_Y=1.55;   // (m) the clock's bottom edge: the scene has 1.95 (Felix, 28 Sep: "move the wall clock down a little", then "another 40cm lower": at 1.45 it would hang over the postcards' corner, so it stops just above them)
// the left wall's inner face on uv1 (affine, from its own vertices), and the spot the clock leaves (its box and the soft edge of
// its shadow, which the bake has about 4 cm wide): CLOCK_FIX, for clockBake
function clockWall(drop,box){
  const w=scene.getObjectByName("wall_left"), g=w?.geometry, P=g?.attributes.position, N=g?.attributes.normal, U=g?.attributes.uv1;
  if(!P||!N||!U||w.userData.atlas!=="room"||!BAKE.room) return false;
  w.updateWorldMatrix(true,false); const nm=new THREE.Matrix3().getNormalMatrix(w.matrixWorld), p=new THREE.Vector3(), n=new THREE.Vector3(), f=[];
  for(let i=0;i<P.count;i++){ n.fromBufferAttribute(N,i).applyMatrix3(nm).normalize(); if(n.x<.9) continue;   // (the face into the room)
    p.fromBufferAttribute(P,i).applyMatrix4(w.matrixWorld); f.push([p.y,p.z,U.getX(i),U.getY(i)]); }
  if(f.length<3) return false;
  const M=new THREE.Matrix3().set(f[0][0],f[0][1],1,f[1][0],f[1][1],1,f[2][0],f[2][1],1); if(Math.abs(M.determinant())<1e-6) return false; M.invert();
  const cu=new THREE.Vector3(f[0][2],f[1][2],f[2][2]).applyMatrix3(M), cv=new THREE.Vector3(f[0][3],f[1][3],f[2][3]).applyMatrix3(M);   // u = cu.x y + cu.y z + cu.z (v alike)
  if(f.some(([y,z,u,v])=>Math.abs(cu.x*y+cu.y*z+cu.z-u)>1e-3||Math.abs(cv.x*y+cv.y*z+cv.z-v)>1e-3)) return false;   // not one flat island
  if(Math.abs(cu.x*cv.y-cu.y*cv.x)<1e-9) return false;
  const m=.07; CLOCK_FIX={cu,cv,O:[box.min.y-m,box.max.y+m,box.min.z-m,box.max.z+m],d:drop};
  return true;
}
// the clock's shadow in one of the room atlas's light maps (A, B, D), moved down with it, on the image as decoded: where the clock
// hung, the wall's light filled in from all round the spot (a harmonic fill, with the wall's own grain from above the spot); where
// it hangs now, the wall's own light times the shadow the bake has round the old spot (its share of the light there). In linear
// light (the maps hold light^(1/g)); only that patch of texels changes
function clockBake(t){
  const F=CLOCK_FIX, b=BAKE.room;
  if(!F||!b||t.userData.clockDone||!(t===b.A||t===b.B||t===b.uD.value)||!t.image) return;
  t.userData.clockDone=true;
  try{
    const im=t.image, W=im.naturalWidth||im.width, H=im.naturalHeight||im.height, G=b.g, {cu,cv,d}=F, [oy0,oy1,oz0,oz1]=F.O, det=cu.x*cv.y-cu.y*cv.x;
    const tx=(y,z)=>(cu.x*y+cu.y*z+cu.z)*W-.5, ty=(y,z)=>(cv.x*y+cv.y*z+cv.z)*H-.5;   // the wall -> texels (centres on integers)
    const dn=oy1-oy0+.05, Y0=oy0-d, Y1=oy1+dn;   // (the patch: where it hangs now, where it hung, and the grain's source above that)
    let x0=1e9,x1=-1e9,r0=1e9,r1=-1e9;
    for(const y of [Y0,Y1]) for(const z of [oz0,oz1]){ const a=tx(y,z), c=ty(y,z); x0=Math.min(x0,a); x1=Math.max(x1,a); r0=Math.min(r0,c); r1=Math.max(r1,c); }
    x0=Math.max(0,Math.floor(x0)-4); r0=Math.max(0,Math.floor(r0)-4); x1=Math.min(W-1,Math.ceil(x1)+4); r1=Math.min(H-1,Math.ceil(r1)+4);
    const w=x1-x0+1, h=r1-r0+1, n=w*h, cvs=document.createElement("canvas"); cvs.width=W; cvs.height=H;
    const ctx=cvs.getContext("2d",{willReadFrequently:true}); ctx.drawImage(im,0,0);
    const img=ctx.getImageData(x0,r0,w,h), px=img.data, L=[0,1,2].map(c=>{ const a=new Float32Array(n); for(let i=0;i<n;i++) a[i]=Math.pow(px[i*4+c]/255,G); return a; });
    const yy=new Float32Array(n), zz=new Float32Array(n), inO=new Uint8Array(n), idx=[];
    for(let r=0;r<h;r++) for(let x=0;x<w;x++){ const i=r*w+x, u=(x+x0+.5)/W-cu.z, v=(r+r0+.5)/H-cv.z, y=(cv.y*u-cu.y*v)/det, z=(cu.x*v-cv.x*u)/det;
      yy[i]=y; zz[i]=z; if(y>oy0&&y<oy1&&z>oz0&&z<oz1&&x>0&&r>0&&x<w-1&&r<h-1){ inO[i]=1; idx.push(i); } }
    // the old spot filled in from its edge (SOR); the wall round it a little blurred, the old spot left out
    const fill=L.map(a=>{ const f=Float32Array.from(a); let m=0,k=0;
      for(const i of idx) for(const j of [i-1,i+1,i-w,i+w]) if(!inO[j]){ m+=a[j]; k++; }
      m/=k||1; for(const i of idx) f[i]=m;
      for(let it=0;it<500;it++) for(const i of idx) f[i]+=1.85*((f[i-1]+f[i+1]+f[i-w]+f[i+w])*.25-f[i]);
      return f; });
    const soft=L.map(a=>{ const o=new Float32Array(n);
      for(let r=0;r<h;r++) for(let x=0;x<w;x++){ let s=0,k=0;
        for(let q=Math.max(0,r-2);q<=Math.min(h-1,r+2);q++) for(let e=Math.max(0,x-2);e<=Math.min(w-1,x+2);e++){ const j=q*w+e; if(!inO[j]){ s+=a[j]; k++; } }
        o[r*w+x]=k?s/k:a[r*w+x]; }
      return o; });
    const bil=(a,x,r)=>{ const xi=Math.floor(x), ri=Math.floor(r), fx=x-xi, fr=r-ri, i=ri*w+xi; return (a[i]*(1-fx)+a[i+1]*fx)*(1-fr)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fr; };
    for(let i=0;i<n;i++){
      const y=yy[i], z=zz[i], qy=y+d, hang=qy>oy0&&qy<oy1&&z>oz0&&z<oz1;
      if(!hang&&!inO[i]) continue;
      let o=L.map(a=>a[i]);
      if(inO[i]){ const j=Math.round(ty(y+dn,z)-r0)*w+Math.round(tx(y+dn,z)-x0);   // (where it hung: the fill, with the grain from above)
        o=o.map((_,c)=>fill[c][i]*Math.min(1.5,Math.max(.6,L[c][j]/Math.max(soft[c][j],1e-6)))); }
      if(hang){ const qx=tx(qy,z)-x0, qr=ty(qy,z)-r0;   // (where it hangs now: the shadow round the same point of the old spot; the
        // bake's grain there, a few per cent either way, is left out)
        o=o.map((v,c)=>{ const k=Math.min(1,bil(L[c],qx,qr)/Math.max(bil(fill[c],qx,qr),1e-6)), e=Math.min(1,Math.max(0,(k-.8)/.15)); return v*(k+(1-k)*e*e*(3-2*e)); }); }
      for(let c=0;c<3;c++) px[i*4+c]=Math.round(255*Math.pow(Math.max(0,o[c]),1/G));
    }
    ctx.putImageData(img,x0,r0); t.image=cvs; t.needsUpdate=true;
  }catch(e){ console.warn("clock: its shadow in the bake stays where it hung",e); }
}
function setupClock(){
  if(!clockBody) return;
  // lower than the scene hangs it, its shadow on the wall moved along in the light maps (clockBake: the ones in now, and the rest
  // as they come in)
  const drop=clockBody.position.y-CLOCK_Y;
  if(drop>.001&&clockWall(drop,new THREE.Box3().setFromObject(clockBody))){ for(const o of [clockBody,...clockHands]){ o.position.y-=drop; o.updateMatrixWorld(true); }
    for(const t of bakeIns) clockBake(t); }
  const box=new THREE.Box3().setFromObject(clockBody); const c=box.getCenter(new THREE.Vector3());
  clockHands.forEach(h=>{
    const hb=new THREE.Box3().setFromObject(h).getCenter(new THREE.Vector3());
    const p=new THREE.Group(); p.position.copy(c); scene.add(p); p.updateMatrixWorld(); p.attach(h);
    // the face looks along +x; angle of the hand's tip around that axis, 12 o'clock = +y
    const a0=Math.atan2(-(hb.z-c.z),hb.y-c.y);
    clockPivots.push({p,a0,kind:h.name.includes("hour")?"h":h.name.includes("minute")?"m":"s"});
  });
}
function updateClock(now){
  if(!clockPivots.length) return;
  const t=nightMs(now), S=Math.floor(t/1000)%60, M=Math.floor(t/60000)%60, H=Math.floor(t/3600000)%24;
  const u=(t%1000)/170, tick=u>=1?1:1-Math.exp(-6*u)*Math.cos(9*u);   // quartz step: a quick jump, a small overshoot, settle
  for(const c of clockPivots){
    const a=c.kind==="h"?((H%12)+M/60)/12*Math.PI*2:c.kind==="m"?(M+S/60)/60*Math.PI*2:(S-1+tick)/60*Math.PI*2;
    c.p.rotation.x=-(a-c.a0);
  }
}

// ======================================================================= the old PC on the chest of drawers (v6 scenes)
// Its software is pc/basic.js (the same shape as a tape channel, plus keyboard input; OPTIONS and DEBUG on it are the page's). The 720x400 text
// screen is drawn into a 4:3 texture with a dark border, the way a CRT underscans, and lights the glass. While you
// type, a hidden textarea holds the focus: phones get their keyboard, and the page's own shortcuts step aside.
const PC={press:null,mesh:null,mod:null,inst:null,cv:null,tcv:null,tctx:null,tex:null,focused:false,zoom:false,audio:false,used:false,opened:false,lastT:0,fresh:false,hover:false,want:null,wantOpen:null,unkbd:null,glint:{value:1},
  mon:{on:true,t:-1e9,dark:false},btn:null,led:null,ledK:0};
const PC_W=720, PC_H=400, PC_TW=800, PC_TH=600, PC_MX=.05, PC_MY=.065;
const pcKbd=document.createElement("textarea");
pcKbd.setAttribute("aria-label","Type on the old PC"); pcKbd.tabIndex=-1; pcKbd.setAttribute("autocapitalize","off"); pcKbd.setAttribute("autocomplete","off"); pcKbd.spellcheck=false;
pcKbd.style.cssText="position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;resize:none;pointer-events:none";
document.body.appendChild(pcKbd);
// Two props were placed by their bounding boxes and came out implausible: a pencil standing on its end on the legal pad,
// and a closed binder hovering on the clipboard's clip. Lay the pencil down where it stood (its eraser keeps its spot and
// its contact shadow), and slide the binder off the clip onto the board.
function restProps(root){
  const V=THREE.Vector3, move=(o,m)=>{ o.updateWorldMatrix(true,false); const w=m.multiply(o.matrixWorld); w.premultiply(new THREE.Matrix4().copy(o.parent.matrixWorld).invert()); w.decompose(o.position,o.quaternion,o.scale); o.updateWorldMatrix(false,false); };
  const pencil=root.getObjectByName("stationery_supplies_pencil_used");
  if(pencil){ const b=new THREE.Box3().setFromObject(pencil);
    if(b.max.y-b.min.y>.08){   // still upright
      const base=new V((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2), q=new THREE.Quaternion().setFromUnitVectors(new V(0,1,0),new V(-1,.02,-1).normalize());   // toward the pad's far-left corner, clear of the glasses
      move(pencil,new THREE.Matrix4().makeTranslation(base.x,base.y,base.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-base.x,-base.y,-base.z)));
      const b2=new THREE.Box3().setFromObject(pencil); move(pencil,new THREE.Matrix4().makeTranslation(0,base.y-b2.min.y+.0004,0)); } }
  const binder=root.getObjectByName("binder_notebook_closed"), board=root.getObjectByName("clipboard");
  if(binder&&board&&binder.geometry&&board.geometry){
    const bb=new THREE.Box3().setFromObject(binder), pos=board.geometry.attributes.position, v=new V(); board.updateWorldMatrix(true,false);
    // the clip is the part of the clipboard more than 6 mm above its median height; the binder may not overlap it
    const ys=[]; for(let i=0;i<pos.count;i+=7) ys.push(v.fromBufferAttribute(pos,i).applyMatrix4(board.matrixWorld).y); ys.sort((p,q)=>p-q);
    const clipY=ys[ys.length>>1]+.006, clip=new THREE.Box3();
    for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i).applyMatrix4(board.matrixWorld); if(v.y>clipY) clip.expandByPoint(v); }
    if(!clip.isEmpty()&&bb.min.y>=clip.max.y-.002){   // resting on the clip: slide it clear along x, then drop it onto whatever is under it
      const dx=clip.max.x<bb.max.x&&bb.min.x<clip.max.x+.005?clip.max.x+.006-bb.min.x:0;
      let top=-Infinity; for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i).applyMatrix4(board.matrixWorld);
        if(v.y<=clipY&&v.x>=bb.min.x+dx&&v.x<=bb.max.x+dx&&v.z>=bb.min.z&&v.z<=bb.max.z) top=Math.max(top,v.y); }
      if(isFinite(top)) move(binder,new THREE.Matrix4().makeTranslation(dx,top+.0005-bb.min.y,0)); } }
}
function setupPC(root){
  root.traverse(o=>{ if(!PC.mesh&&o.isMesh&&/^retro_screen/.test(o.name)) PC.mesh=o; });
  if(!PC.mesh) return;
  PC.tcv=document.createElement("canvas"); PC.tcv.width=PC_TW; PC.tcv.height=PC_TH;
  PC.tctx=PC.tcv.getContext("2d"); PC.tctx.fillStyle="#010302"; PC.tctx.fillRect(0,0,PC_TW,PC_TH);
  PC.tex=new THREE.CanvasTexture(PC.tcv); PC.tex.colorSpace=THREE.SRGBColorSpace; PC.tex.flipY=false; PC.tex.anisotropy=4;
  PC.mesh.material=noGlints(new THREE.MeshPhysicalMaterial({color:"#070a08",roughness:.16,metalness:0,clearcoat:1,clearcoatRoughness:.05,emissive:"#ffffff",emissiveMap:PC.tex,emissiveIntensity:1.6}),PC.glint,.3);
  PC.mesh.castShadow=false;
  interact.set(PC.mesh,{kind:"pc",label:"USE THE COMPUTER"});   // (a click walks up to it: pcVisit)
  pcLoad(ENTRY?"saver":OPEN_OPTIONS?"options":atPC(pageFromUrl())?pageFromUrl():"saver");   // a #about, #online or #options link: the PC starts on that program, no boot (a fly-in: once the camera is there)
}
// A photo of me, taped to the monitor. The About page used to open with it, and the PC's screen is for its text, so it's a
// print on the bezel beside the glass, a little over the edge the way notes end up. It takes its light from the bake of the
// plastic under the tape (its uv1 is the housing's, cast straight back onto it), so it sits in the monitor's light and dims
// with the desk lamp; a soft contact shadow under its curled edge sits on the bezel. Everything in the monitor's own space.
const PRINT={mesh:null,corners:[]};
const PR={w:.058,h:.08,x:.154,y:.228,rot:-.05,lift:.0028,z:.0006};   // size, centre, tilt (rad), curl of the bottom edge, gap
function setupPrint(root){
  const mon=root.getObjectByName("retro_monitor"), b=mon&&BAKE[mon.userData.atlas]; if(!b) return;
  mon.updateWorldMatrix(true,true);
  const parts=mon.children.filter(o=>o.isMesh), ray=new THREE.Raycaster(), back=new THREE.Vector3(0,0,-1).transformDirection(mon.matrixWorld), lmCache=new Map();
  // the housing's lightmap uv at height y on its flat front beside the glass, the strip the tape holds on to
  const lm=y=>{ const k=Math.round(Math.min(.3,Math.max(.045,y))*1000); if(lmCache.has(k)) return lmCache.get(k);
    ray.set(new THREE.Vector3(.153,k/1000,.04).applyMatrix4(mon.matrixWorld),back); ray.far=.1;
    const h=ray.intersectObjects(parts,false).find(h=>h.uv1&&h.distance>.03), l=h?h.uv1.clone():null; lmCache.set(k,l); return l; };
  if(!lm(PR.y)) return;
  const pc=Math.cos(PR.rot), ps=Math.sin(PR.rot);
  const curl=(u,v)=>PR.z+PR.lift*Math.pow(Math.max(0,.5-v/PR.h),2.4)+.0004*(2*u/PR.w)**2;   // print space: v up, from its centre
  // a grid given in its own space (to: its space -> print space), laid onto the bezel with the housing's uv1
  const sheet=(w,h,nx,ny,to,z)=>{
    const g=new THREE.PlaneGeometry(w,h,nx,ny), p=g.attributes.position, uv1=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){ const [u,v]=to(p.getX(i),p.getY(i)), x=PR.x+u*pc-v*ps, y=PR.y+u*ps+v*pc, l=lm(y)||{x:0,y:0};
      p.setXYZ(i,x,y,z(u,v)); uv1[i*2]=l.x; uv1[i*2+1]=l.y; }
    g.setAttribute("uv1",new THREE.BufferAttribute(uv1,2)); g.computeVertexNormals(); return g; };
  const tex=(url,srgb)=>{ const t=texL.load(url); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; };
  const own=(u,v)=>[u,v];
  const front=sheet(PR.w,PR.h,8,12,own,curl), grp=new THREE.Group(); grp.name="about_print";
  const print=new THREE.Mesh(front,bakeLit(new THREE.MeshPhysicalMaterial({map:tex(new URL("/scene/tex/print.jpg",location.origin).href,true),roughness:.45,clearcoat:.3,clearcoatRoughness:.32}),b,"print")); // Ayush portrait — local override
  const paper=new THREE.Mesh(front,bakeLit(new THREE.MeshPhysicalMaterial({color:"#e6e1d4",roughness:.85,side:THREE.BackSide}),b,"paper"));
  // the tape: frosted and a little yellowed, across the top edge, stuck to the bezel above the print and to the print below
  const tu=.157-PR.x, tv=PR.h/2-.001, tr=-.09, tc=Math.cos(tr), ts=Math.sin(tr);
  const tape=new THREE.Mesh(sheet(.019,.027,1,8,(a,q)=>[tu+a*tc-q*ts,tv+a*ts+q*tc],(u,v)=>{ const k=THREE.MathUtils.smoothstep(v,PR.h/2-.0008,PR.h/2+.0012); return THREE.MathUtils.lerp(curl(u,v)+.0003,.00025,k); }),
    bakeLit(new THREE.MeshPhysicalMaterial({map:tex(SCENE_BASE+"tex/tape.png",true),transparent:true,depthWrite:false,roughness:.35}),b,"tape"));
  // its shadow on the bezel, deeper under the curled bottom edge; only on the flat plastic (not over the recess, not in the air)
  const SX=.008, SY=.008;   // the shadow's sheet reaches this far past the print on each side
  const shTex=canvasTex(128,160,(g,w,h)=>{ g.fillStyle="#000"; g.fillRect(0,0,w,h); g.filter="blur(5px)";   // an alpha map: white is shadow (row 0 is the bottom)
    const px=w*SX/(PR.w+2*SX), py=h*SY/(PR.h+2*SY), gr=g.createLinearGradient(0,py,0,h-py);
    gr.addColorStop(0,"rgba(255,255,255,.7)"); gr.addColorStop(.35,"rgba(255,255,255,.35)"); gr.addColorStop(1,"rgba(255,255,255,.12)");
    g.fillStyle=gr; g.fillRect(px,py,w-2*px,h-2*py); },{srgb:false});
  const shMat=new THREE.MeshBasicMaterial({color:0,alphaMap:shTex,transparent:true,depthWrite:false});
  shMat.onBeforeCompile=sh=>{ sh.vertexShader="varying float vMx;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvMx=position.x;");
    sh.fragmentShader="varying float vMx;\n"+sh.fragmentShader.replace("void main() {","void main() {\nif(vMx<.1455||vMx>.1692) discard;"); };
  shMat.customProgramCacheKey=()=>"printshadow";
  const shadow=new THREE.Mesh(sheet(PR.w+2*SX,PR.h+2*SY,6,8,(u,v)=>[u+.0008,v-.0026],()=>.00015),shMat);
  for(const o of [print,paper,tape,shadow]){ o.castShadow=o.receiveShadow=false; grp.add(o); }
  tape.renderOrder=2; mon.add(grp); grp.updateMatrixWorld(true);
  PRINT.mesh=print;
  PRINT.corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>{ const u=i*PR.w/2, v=j*PR.h/2; return new THREE.Vector3(PR.x+u*pc-v*ps,PR.y+u*ps+v*pc,curl(u,v)).applyMatrix4(mon.matrixWorld); });
}
// The monitor's push button, bottom right under the glass, beside its LED: it switches the monitor, not the PC, off and on.
// The model has the button as part of the housing, so its few triangles are lifted out into a mesh of their own (sharing the
// housing's vertices and baked light), which a press pushes in. In the monitor's own space: +z comes out of its face.
const MON_BTN={x:.128,y:.052,hx:.0095,hy:.0065};
function setupMonBtn(root){
  const mon=root.getObjectByName("retro_monitor"); if(!mon||!PC.mesh) return;
  mon.updateWorldMatrix(true,true);
  const toMon=new THREE.Matrix4(), a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
  for(const part of mon.children){
    const g=part.isMesh&&part.geometry, idx=g&&g.index; if(!idx) continue;
    const pos=g.attributes.position; toMon.copy(mon.matrixWorld).invert().multiply(part.matrixWorld);
    const keep=[], take=[];
    for(let i=0;i<idx.count;i+=3){ const i0=idx.getX(i), i1=idx.getX(i+1), i2=idx.getX(i+2);
      a.fromBufferAttribute(pos,i0); b.fromBufferAttribute(pos,i1); c.fromBufferAttribute(pos,i2); a.add(b).add(c).multiplyScalar(1/3).applyMatrix4(toMon);
      (Math.abs(a.x-MON_BTN.x)<MON_BTN.hx&&Math.abs(a.y-MON_BTN.y)<MON_BTN.hy&&a.z>.0012&&a.z<.009?take:keep).push(i0,i1,i2); }
    if(!take.length) continue;
    const bg=new THREE.BufferGeometry(); for(const [k,at] of Object.entries(g.attributes)) bg.setAttribute(k,at);
    bg.setIndex(take); g.setIndex(keep);
    const bb=new THREE.Box3(); for(const i of take) bb.expandByPoint(a.fromBufferAttribute(pos,i));   // its own bounds, not the housing's whole vertex list
    bg.boundingBox=bb; bg.boundingSphere=bb.getBoundingSphere(new THREE.Sphere());
    const btn=new THREE.Mesh(bg,part.material); btn.name="retro_mbtn"; btn.castShadow=part.castShadow; btn.receiveShadow=part.receiveShadow;
    btn.position.copy(part.position); btn.quaternion.copy(part.quaternion); btn.scale.copy(part.scale); part.parent.add(btn);
    btn.userData.home=btn.position.clone(); interact.set(btn,{kind:"pcmon",label:"MONITOR OFF"}); PC.btn=btn; break;
  }
  const led=root.getObjectByName("retro_led");
  if(led?.isMesh){ led.material=ownMaterial(led.material); PC.led=led; PC.ledK=led.material.emissiveIntensity; }
}
function setupVelqoreBadge(root){
  const badgeTex=canvasTex(512,112,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.font="900 58px Archivo, sans-serif";
    g.textAlign="center"; g.textBaseline="middle";
    try{ g.letterSpacing="4px"; }catch(e){}
    g.fillStyle="rgba(8,10,12,0.85)";
    g.fillText("VELQORE",w/2,h/2+3);
    g.fillStyle="#9da3ab";
    g.fillText("VELQORE",w/2,h/2);
  });
  const badgeGeo=new THREE.PlaneGeometry(.058,.012);
  const badgeMat=new THREE.MeshStandardMaterial({map:badgeTex,transparent:true,roughness:.4,metalness:.5,depthWrite:false});
  const badgeMesh=new THREE.Mesh(badgeGeo,badgeMat);
  badgeMesh.position.set(-.1185,1.1795,.1856);
  badgeMesh.name="velqore_wordmark";
  root.add(badgeMesh);
  fontsReady.then(()=>{
    const g=badgeTex.userData.canvas.getContext("2d");
    g.clearRect(0,0,512,112);
    g.font="900 58px Archivo, sans-serif";
    g.textAlign="center"; g.textBaseline="middle";
    try{ g.letterSpacing="4px"; }catch(e){}
    g.fillStyle="rgba(8,10,12,0.85)";
    g.fillText("VELQORE",256,59);
    g.fillStyle="#9da3ab";
    g.fillText("VELQORE",256,56);
    badgeTex.needsUpdate=true;
  });
}
// Off, the glass goes dark the way a CRT does: the picture folds into a line and the line into a dot, and the green phosphor's
// afterglow fades behind it; the LED goes out. On, the tube warms up for a moment, then the picture opens out of a bright line.
// The PC itself runs on either way (its sounds too).
function pcMonitor(on){
  const M=PC.mon; if(M.on===on) return; M.on=on; M.t=performance.now(); M.dark=false;
  if(PC.led) PC.led.material.emissiveIntensity=on?PC.ledK:0;
  if(A.on){ const ctx=A.ctx, t=ctx.currentTime;
    if(on) sample("crt_on",{gain:.4,pan:-.45,rate:1.22});
    else { const o=ctx.createOscillator(), g=ctx.createGain(), p=ctx.createStereoPanner(); p.pan.value=-.45;
      o.frequency.setValueAtTime(1500,t+.03); o.frequency.exponentialRampToValueAtTime(80,t+.3); env(g,t+.03,.004,.035,.28);
      o.connect(g).connect(p).connect(A.master); o.start(t+.03); o.stop(t+.4); setTimeout(()=>crackle(.8,14),90); } }
  live(on?"The old PC's monitor is on":"The old PC's monitor is off");
}
const PC_MON_OFF=1.4, PC_MON_ON=1.5;   // how long each switch draws the glass itself
function pcMonFrame(now){
  const M=PC.mon, k=(now-M.t)/1000, x=PC.tctx, W=PC_TW, H=PC_TH, rx=PC_MX*W, ry=PC_MY*H, rw=W*(1-2*PC_MX), rh=H*(1-2*PC_MY), cy=H/2, src=PC.cv;
  x.save(); x.fillStyle="#010302"; x.fillRect(0,0,W,H);
  if(!M.on){
    if(src&&k<PC_MON_OFF){ x.globalAlpha=.22*(1-k/PC_MON_OFF)**2; x.drawImage(src,rx,ry,rw,rh); x.globalAlpha=1; }   // the afterglow
    x.globalCompositeOperation="lighter";
    if(k<.09){ const s=1-THREE.MathUtils.smoothstep(k,0,.09); if(src){ x.filter=`brightness(${(1+2.5*(1-s)).toFixed(2)})`; x.drawImage(src,rx,cy-Math.max(1.5,rh*s/2),rw,Math.max(3,rh*s)); x.filter="none"; } }
    else if(k<.2){ const s=1-(k-.09)/.11; x.fillStyle="rgba(205,255,215,.95)"; x.fillRect(W/2-Math.max(2,rw*s/2),cy-1.5,Math.max(4,rw*s),3); }
    else if(k<1.1){ const f=1-(k-.2)/.9, r=5+5*f, gr=x.createRadialGradient(W/2,cy,0,W/2,cy,r*2.2);
      gr.addColorStop(0,`rgba(225,255,230,${(f*f).toFixed(3)})`); gr.addColorStop(.35,`rgba(120,255,150,${(.55*f*f).toFixed(3)})`); gr.addColorStop(1,"rgba(40,255,90,0)");
      x.fillStyle=gr; x.fillRect(W/2-r*2.2,cy-r*2.2,r*4.4,r*4.4); }
  } else if(src&&k>.35){
    const o=THREE.MathUtils.smoothstep(k,.35,.5), br=1-Math.pow(1-Math.min(1,(k-.35)/1.1),3), h=Math.max(3,rh*o);
    x.globalAlpha=.3+.7*br; if(o<1) x.filter=`brightness(${(1+1.5*(1-o)).toFixed(2)})`; x.drawImage(src,rx,cy-h/2,rw,h);
  }
  x.restore(); PC.tex.needsUpdate=true;
}
// the PC runs BASIC (pc/basic.js). DOS and a dial-up BBS (pc/dos.js, pc/bbs.js, the same mount API) were in Options
// until Felix took the picker out (00:29Z)
function pcLoad(start){
  import(new URL("./pc/",import.meta.url).href+"basic.js").then(m=>{ PC.mod=m.default; pcMount(start); }).catch(e=>console.warn("pc",e));
}
// a link on the PC (About's words, its Links list) opens as a real link, clicked inside the click or key press that chose it:
// the artifact frame and popup blockers treat that as the visitor's own click, where window.open is often refused
function pcOpen(url){
  if(!/^https:\/\//.test(url)) return true;   // only web links leave the room
  const a=document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener"; a.hidden=true;
  document.body.append(a); a.click(); a.remove(); PC.opened=true; return true;
}
// a click on the glass goes to the PC at once, inside the visitor's click, so a link opens as their own click. The first click
// of a visit also brings the sound, which takes a new PC (pcFocus): only while nothing on this one would be lost (scrolled,
// typed, a program running). A link it just opened doesn't count, nor waking it (screensaver, boot, power), as the new PC
// shows the same About from the top
function pcTap(uv){
  if(uv&&PC.inst){ const s=PC.inst.state||{}, wake=s.saver||s.power!=="on"||s.mode==="boot";
    PC.opened=false; if(PC.inst.input({type:"click",...pcUV(uv)})&&!PC.opened&&!wake) PC.used=true; }
  pcFocus();
}
function pcMount(start){
  if(!PC.mod) return;
  pcUnkbd(); if(PC.inst){ try{ PC.inst.stop(); }catch(e){} }
  PC.cv=PC.cv||document.createElement("canvas"); PC.cv.width=PC_W; PC.cv.height=PC_H;
  const x=PC.cv.getContext("2d"); x.fillStyle="#030a05"; x.fillRect(0,0,PC_W,PC_H);
  PC.audio=!!A.ctx;
  try{ PC.inst=PC.mod.mount({canvas:PC.cv,ctx:x,width:PC_W,height:PC_H,audio:A.ctx?{ctx:A.ctx,out:pcOut()}:null,start,focused:PC.focused||PC.zoom,reducedMotion:reduce,saverFps:20,open:pcOpen,settings:PC_SETTINGS,debug:touchOnly()?touchDebug():pcDebug,touch:touchOnly,select:true,copy:()=>{ live("Copied"); return false; }});
    // the PC reads the hidden textarea itself: hardware keys, phone keyboards (composing, autocorrect), paste; Tab completes in DOS, Shift+Tab leaves
    PC.unkbd=PC.inst.attachKeyboard(pcKbd,{tab:true}); }
  catch(e){ console.error("pc",e); PC.inst=null; }
  PC.lastT=0; PC.fresh=true; PC.used=false;
  if(PC.inst&&PC.wantOptions){ PC.wantOptions=false; PC.wantOpen=null; try{ PC.inst.input({type:"open",what:"options"}); }catch(e){ console.warn("pc",e); } }   // #options before the PC had started
  else if(PC.inst&&PC.wantOpen){ const w=PC.wantOpen; PC.wantOpen=null; if(state.page===w) setTimeout(()=>{ if(state.page===w) aboutPC(); },0); }   // #about or #online before the PC had started
  else if(PC.inst&&atPC(state.page)&&start!==state.page) pcProgram(state.page);   // a PC started some other way while its program is the page
}
// About and Online live on the old PC: the camera moves to its glass and the PC opens that program from whatever it was
// doing (booting, screensaver, a game). A phone keeps its keyboard down until you tap the screen.
const touchOnly=()=>matchMedia("(hover: none) and (pointer: coarse)").matches;
function aboutPC(instant,open=true){
  const page=state.page;
  if(!PC.mon.on&&open) pcMonitor(true);   // switched off at its button: About and Online switch it back on
  if(!PC.inst){ PC.wantOpen=page; setZoomed(false); if(PC.mesh) pcNear(true); pcFly(frameFor(page),instant); return; }
  const fresh=pcFocus({kbd:!touchOnly(),instant});   // a new PC opens it itself
  if(open&&!fresh) pcProgram(page);
}
// A click on the PC from the room walks up to its glass and wakes it, and that's all (Felix, 16:21Z: "the initial action to
// be "heading to the computer". It should not immediately launch the "About me" program"): About opens from its link at the
// top right. The page stays as it was, so its card steps aside, the TV plays on, and Esc or BACK TO THE DESK goes back to
// that page's view. As About does, it switches the monitor back on.
function pcVisit(){
  if(!PC.mon.on) pcMonitor(true);
  if(PC.inst) pcFocus({kbd:!touchOnly()});
  else if(PC.mesh){ if(WIN.zoom) winAt(false); setZoomed(false); pcNear(true); pcFly(pcFrame()); }   // (the PC is still loading: it starts focused)
  live("At the old PC");
}
// C: over to the computer (Felix, 16:56Z: "C - use computer"), from any page or close-up, as a click on it does; a sheet
// closes and the notepad goes down on the way. At its glass the keys are the PC's, so there C takes the keys back.
function pcKey(){
  if(state.sheet) closeSheet();
  padAway();
  if(PC.zoom) pcFocus({kbd:!touchOnly()}); else pcVisit();
}
// Options and debug mode are programs on the old PC (Felix, 16:21Z: "Options and debug mode should be pc programs"). OPTIONS
// lists the page's settings and sets them (pc/README.md, "Options and debug mode"); each one switches at once. DEBUG
// switches the free-look camera on, and backquote comes back to the glass;
// a touch screen, which has no backquote key, gets the frame-rate line instead (touchDebug, perf/phone).
const PC_SETTINGS={
  list:()=>Object.entries(OPT_DEFS).filter(([,d])=>!d.show||d.show()).map(([id,d])=>({id,label:d.label,value:d.now?d.now():OPT[id],choices:d.choices})),
  set:(id,v)=>{ const d=OPT_DEFS[id]; if(!d||!d.choices.some(c=>c[0]===v)) return false; if((d.now?d.now():OPT[id])===v) return true;
    OPT[id]=v; saveOpt(); if(d.live){ const r=d.live(v); return r===undefined?true:r; } return "reload"; },
};
function pcDebug(on){ if(on&&!DBG.on){ pcBlur(); setDebug(true); } return DBG.on; }
// #options walks up to the PC, as a click on it does (pcVisit), and the PC opens OPTIONS from whatever it was doing; the
// address goes back to the page's (it isn't a page: a reload or Back doesn't bring it back)
function pcOptions(){
  if(location.hash==="#options") try{ history.replaceState(history.state,"",pageUrl(state.page)); }catch{}
  if(DBG.on) setDebug(false);
  if(state.sheet) closeSheet();
  padAway();
  pcVisit();
  if(!PC.inst){ PC.wantOptions=true; return; }
  if(PC.hold){ PC.held="options"; return; }   // a fly-in: entryGo opens it once the camera is at the glass
  try{ PC.inst.input({type:"open",what:"options"}); }catch(e){ console.warn("pc",e); }
}
// Online is the PC's short dial-up to its BBS and my links there; a PC program that doesn't have it shows About, which lists them too
function pcProgram(page){
  if(!PC.inst) return;
  if(PC.hold){ PC.held=page; return; }   // a fly-in: entryGo opens it once the camera is at the glass
  try{ if(page==="online"&&PC.inst.input({type:"open",what:"online"})) return; PC.inst.input({type:"open",what:"about"}); }catch(e){ console.warn("pc",e); }
}
// the PC's own speaker sits left of the desk, in the room rather than in the TV
function pcOut(){
  if(A.pc) return A.pc;
  const g=A.ctx.createGain(); g.gain.value=.8; const p=A.ctx.createStereoPanner(); p.pan.value=-.45;
  g.connect(p).connect(A.master); g.connect(A.verb); return A.pc=g;
}
// typing on the PC: the camera moves up to its glass so the 40 columns are readable, and the card steps aside
const PC_DIR=new THREE.Vector3(.95,.1,.31).normalize();
function pcFrame(page=state.page){
  const b=new THREE.Box3().setFromObject(PC.mesh), c=b.getCenter(new THREE.Vector3()), sz=b.getSize(new THREE.Vector3());
  const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), a=innerWidth/innerHeight;
  // the glass fills about two thirds of the height, the bezel stays in view, and never nearer than the orbit lets the camera
  // stand once it has landed (pageLimits; a flight or a close-up loosens the limits on the way, so they can't be read here)
  const d=Math.max(sz.y/2/(tv*.66),Math.hypot(sz.x,sz.z)/2/(tv*a*.8),pageMinDist(page)+.01);
  if(PRINT.mesh){   // the photo beside the glass stays in the picture: on a narrow screen the view slides toward it, never so far that the glass leaves
    const r=new THREE.Vector3().crossVectors(PC_DIR,THREE.Object3D.DEFAULT_UP).negate().normalize(), hw=d*tv*a;
    const need=Math.max(...PRINT.corners.map(p=>p.clone().sub(c).dot(r)))+.006-hw, room=hw-Math.hypot(sz.x,sz.z)/2-.004;
    if(need>0) c.addScaledVector(r,Math.min(need,Math.max(0,room))); }
  // the bezel under the glass stays in the picture, clear of the page's buttons along the bottom: the monitor's power button
  // sits 3.5 cm under the glass, and the view drops (3 cm at most) until it is about 120 px above the bottom edge
  c.y-=Math.min(.03,Math.max(0,sz.y/2+.035-d*tv*(1-240/innerHeight)));
  const near={tgt:c,pos:c.clone().addScaledVector(PC_DIR,d)};
  // typing at it (a click on the computer, C): halfway back from this close-up, so the keyboard is in the picture too
  // (pckeys/); About and Online keep the close-up, and so do phones and tablets, whose own keyboard covers that corner
  return (!touchOnly()&&!PHONE()&&pckeys?.typingFrame({fov:camera.fov,aspect:a,height:innerHeight,print:PRINT.corners,minD:pageMinDist(page)+.01,reading:atPC(page),near}))||near;
}
// at the PC's glass: About is this view (not a close-up of another page), so the card slot and the credits stay as they are
function pcNear(v){ PC.zoom=v; document.body.classList.toggle("pcnear",v); unzoomLabel(); if(!v){ PC.srText=""; $("#pc-sr").textContent=""; } }
function pcFocus({kbd=true,instant=false}={}){
  if(!PC.inst) return false;
  if(WIN.zoom) winAt(false);
  const fresh=!PC.audio&&!!A.ctx&&!PC.used;
  if(fresh) pcMount(atPC(state.page)&&!PC.hold?state.page:PC.inst.state?.view==="options"?"options":"ready");   // (a fly-in's program waits: pcProgram)   // mounted before the first click could start audio: this brings its sound along (and keeps OPTIONS up)
  if(!PC.inst) return false;
  PC.focused=true; PC.inst.input({type:"focus"});
  if(kbd) pcKbd.focus({preventScroll:true}); document.body.classList.add("pc-typing"); tip.hidden=true;
  if(!PC.zoom){ setZoomed(false); pcNear(true); pcFly(pcFrame(),instant); }
  return fresh;
}
// The keys stop going to the PC (a click beside it, a drag, another window), but the camera stays at the glass, and the
// PC keeps its screensaver away while you read. A click on the screen takes the keys back.
function pcLeft(){
  PC.focused=false; document.body.classList.remove("pc-typing");
  if(!PC.zoom) PC.inst?.input({type:"blur"});
}
function pcBlur(){ if(document.activeElement===pcKbd) pcKbd.blur(); if(PC.focused) pcLeft(); }
// Leaving the PC's glass (Esc, the button, another page). About is the PC, so from About that goes home, and from a visit
// (pcVisit) back to that page's view; go() itself passes fly=false, as it flies to the next page anyway.
function pcExit(fly=true){
  pcBlur(); if(!PC.zoom) return;
  pcNear(false); PC.inst?.input({type:"blur"});
  if(fly){ if(atPC(state.page)) go("home"); else go(state.page,{silent:true}); }
}
const pcUV=uv=>({u:(uv.x-PC_MX)/(1-2*PC_MX),v:(uv.y-PC_MY)/(1-2*PC_MY)});   // glTF uv: y=0 is the top of the glass
pcKbd.addEventListener("blur",()=>{ if(PC.focused) pcLeft(); });
for(const ev of ["keydown","input","paste"]) pcKbd.addEventListener(ev,()=>{ PC.used=true; },true);   // typed at the PC: keep this one (pcTap)
pcKbd.addEventListener("focus",()=>{ if(PC.zoom&&!PC.focused&&PC.inst) pcFocus({kbd:false}); });
$("#unzoom").addEventListener("click",()=>{ if(PC.zoom) pcExit(); else if(zoomed) toggleZoom(); else if(calc?.up){ gesture(); calc.lower(); } else if(padUp()){ gesture(); workCard(false); } });
function pcUnkbd(){ if(PC.unkbd){ PC.unkbd(); PC.unkbd=null; } }
// Esc leaves the typing close-up like every other close-up here, before the PC sees it (its own Esc uses all have Q, Ctrl+C or F10 too)
addEventListener("keydown",e=>{ if(e.key==="Escape"&&document.activeElement===pcKbd){ e.preventDefault(); e.stopPropagation(); if(state.sheet) closeSheet(); else pcExit(); } },true);
// C walks up to the PC and gives it the keys in the middle of its own keydown, where the browser would type the letter into
// the PC's keyboard (Felix, 27 Sep 02:36Z: "the computer has already received the "c" input"): that keydown is prevented
// where C is handled, and while C stays held its repeats are swallowed here, before the PC's keyboard sees them
let pcHeld=null;
addEventListener("keydown",e=>{ if(!pcHeld||(e.code||e.key)!==pcHeld) return; if(!e.repeat){ pcHeld=null; return; } e.preventDefault(); e.stopImmediatePropagation(); },true);
addEventListener("keyup",e=>{ if((e.code||e.key)===pcHeld) pcHeld=null; },true);
const _pcFr=new THREE.Frustum(), _pcM=new THREE.Matrix4(), _pcS=new THREE.Sphere(); let _pcSet=false;
function stepPC(now){
  const dt=PC.lastT?Math.min(100,now-PC.lastT):16; PC.lastT=now;
  PC.glint.value+=((PC.zoom?0:1)-PC.glint.value)*Math.min(1,dt/250);   // the lamps' highlights leave the glass while you read it
  if(!PC.inst) return;
  if(!PC.focused){   // off camera its clock simply pauses
    if(!_pcSet){ new THREE.Box3().setFromObject(PC.mesh).getBoundingSphere(_pcS); _pcSet=true; }
    _pcM.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse); _pcFr.setFromProjectionMatrix(_pcM); if(!_pcFr.intersectsSphere(_pcS)) return;
  }
  let changed=false; try{ changed=PC.inst.frame(now,dt); }catch(e){ console.error("pc",e); pcUnkbd(); PC.inst=null; return; }
  if(PC.zoom&&now-(PC.srT||0)>500){ PC.srT=now; const tx=PC.inst.text?.()||""; if(tx!==PC.srText){ PC.srText=tx; $("#pc-sr").textContent=tx; } }
  const M=PC.mon, mk=(now-M.t)/1000;
  if(mk<(M.on?PC_MON_ON:PC_MON_OFF)){ pcMonFrame(now); PC.fresh=true; }   // switching: the glass is drawn every frame, then once more plainly
  else if(!M.on){ if(!M.dark){ M.dark=true; PC.tctx.fillStyle="#010302"; PC.tctx.fillRect(0,0,PC_TW,PC_TH); PC.tex.needsUpdate=true; } }
  else if(changed||PC.fresh){ PC.fresh=false; PC.tctx.drawImage(PC.cv,PC_MX*PC_TW,PC_MY*PC_TH,PC_TW*(1-2*PC_MX),PC_TH*(1-2*PC_MY)); PC.tex.needsUpdate=true; }
}

// ======================================================================= Mahadev painting on the wall
{
  const posterTex=texL.load("/scene/tex/poster.jpg");
  posterTex.colorSpace=THREE.SRGBColorSpace;
  // 576x1024 aspect ratio (9:16)
  const PW=.31, PH=.55;
  const poster=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshStandardMaterial({map:posterTex,roughness:.85}));
  const PX=1.13;   // in the gap between the right curtain (ends at x .92) and the open-backed bookshelf (starts at 1.34)
  poster.position.set(PX,1.34,-.4); poster.rotation.z=-.012; poster.receiveShadow=true; scene.add(poster);
  const tape=new THREE.MeshStandardMaterial({color:"#e8e0c8",roughness:.8,transparent:true,opacity:.8});
  [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([a,b])=>{const t=new THREE.Mesh(new THREE.PlaneGeometry(.055,.02),tape);t.position.set(PX+a*(PW*.47),1.34+b*(PH*.47),-.398);t.rotation.z=a*b*.7;scene.add(t);});
  const wash=new THREE.SpotLight("#ffd9b0",.75,2.4,.5,.8,1.5); wash.position.set(.9,2.1,.4); wash.target=poster; scene.add(wash);
}

// ======================================================================= steam + dust
const puff=canvasTex(64,64,(g)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,"rgba(255,255,255,.55)");gr.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=gr;g.fillRect(0,0,64,64)},{flip:true});
const steam=[];
for(let i=0;i<14;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:puff,color:"#e8d9c4",transparent:true,opacity:0,depthWrite:false})); s.userData.ph=i/14; scene.add(s); steam.push(s); noDepth.push(s); }
const MUG=new THREE.Vector3(-.2,.84,.2);
let coffee=null;   // the coffee (coffee/coffee.js), once the room is in: sips, its level, and how much the steam shows
const dustGeo=new THREE.BufferGeometry(); const DN=220; const dp=new Float32Array(DN*3);
for(let i=0;i<DN;i++){dp[i*3]=-.75+Math.random()*1.1;dp[i*3+1]=.8+Math.random()*.7;dp[i*3+2]=-.35+Math.random()*.7}
dustGeo.setAttribute("position",new THREE.BufferAttribute(dp,3));
const moteTex=canvasTex(32,32,g=>{ const r=g.createRadialGradient(16,16,0,16,16,16); r.addColorStop(0,"rgba(255,255,255,1)"); r.addColorStop(.35,"rgba(255,255,255,.55)"); r.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle=r; g.fillRect(0,0,32,32); });
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:"#ffd7a6",size:.0034,map:moteTex,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
scene.add(dust); noDepth.push(dust,city.rain.mesh); 

// ======================================================================= post: bloom, lens
// AO and light are baked, so no GTAO; no depth of field either (it read as blur). MSAA on the
// composer's target keeps edges crisp.
const isMobileDev=(typeof PHONE==="function"&&PHONE())||(typeof mobile==="function"&&mobile())||(matchMedia("(hover: none) and (pointer: coarse)").matches&&Math.min(innerWidth,innerHeight)<540);
const msaaSamples=isMobileDev?0:4;
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth*DPR,innerHeight*DPR,{type:THREE.HalfFloatType,samples:msaaSamples}));
composer.addPass(new RenderPass(scene,view));
const bloomW=isMobileDev?Math.min(innerWidth/2,256):innerWidth/2;
const bloomH=isMobileDev?Math.min(innerHeight/2,256):innerHeight/2;
const bloom=new UnrealBloomPass(new THREE.Vector2(bloomW,bloomH),.28,.5,.88); composer.addPass(bloom);
// One pixel that is not a number (some GPU dividing by zero in some shader) is black, and the bloom's blurs would spread it
// into a stepped black box over half the screen, as on a big Mac screen with the view turned right. The bloom reads the room
// through this sieve, and the grade passes such a pixel on as black: one dark pixel, no box. It tests the exponent bits,
// since a shader compiler may assume that x!=x never holds.
const FINITE=`vec3 finite(vec3 c){ uvec3 e=floatBitsToUint(c)&0x7f800000u; return any(equal(e,uvec3(0x7f800000u)))?vec3(0.):clamp(c,0.,256.); }`;
bloom.materialHighPassFilter.fragmentShader=FINITE+"\n"+bloom.materialHighPassFilter.fragmentShader.replace(/vec4 texel = texture2D\( tDiffuse, vUv \);/,"$& texel.rgb = finite( texel.rgb );");
const grade=new ShaderPass({
  uniforms:{tDiffuse:{value:null},t:{value:0},res:{value:new THREE.Vector2(innerWidth,innerHeight)}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float t;uniform vec2 res;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  ${FINITE}
  void main(){
    vec2 e=vUv-.5; float r2=dot(e,e);
    vec2 uv=.5+e*(1.-.02*r2);                                    // a little barrel distortion
    vec2 ca=e*.002*r2*4.;                                        // lateral chromatic aberration toward the corners
    vec3 c=finite(vec3(texture2D(tDiffuse,uv+ca).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-ca).b));
    c*=1.-r2*.8;
    float g=h(vUv*res+fract(t)*97.)-.5; c+=g*.009*(1.-dot(c,vec3(.33)));  // grain, stronger in shadows
    gl_FragColor=vec4(c,1.);}`
}); composer.addPass(grade);
composer.addPass(new OutputPass());
// EffectComposer takes a given target's size as the window's and multiplies the pixel ratio in again, so until the first
// resize the bloom's buffers were DPR x too large on each side (4x the work on a 2x screen, and a tighter glow than after a
// resize). Sizing it once here matches what every resize already does. (The room frame rate thread, vhs-tv/perf/, v27.)
composer.setSize(innerWidth,innerHeight);
// Only the room's render needs MSAA, and it always lands in renderTarget2 (the read buffer: two swaps a frame, grade and
// output). renderTarget1 only takes the grade's full-screen quad, where 4x samples are memory traffic for nothing.
composer.renderTarget1.samples=0;
// >>> perf/join: post
// ---- the post chain, folded (vhs-tv/perf/join). The bloom was added onto the room's 4x multisampled buffer by a full-screen
// pass of its own, which then resolved again (colour and depth), and the grade wrote a half-float buffer that OutputPass read
// back to tone-map and encode for the screen. Now the grade adds the bloom where it reads the room, weighted by its alpha as
// that additive blend was, and tone-maps and encodes as OutputPass did, straight to the screen; the room's resolve leaves out
// the depth, which nothing reads. A multisampled blend, a resolve and a full-screen pass fewer each frame, for the same
// picture. __scene.perf.fold(false) puts the passes back as they were.
const FOLD={on:false,ok:false};
try{
  const src=grade.material.fragmentShader, READ="vec3 c=finite(vec3(texture2D(tDiffuse,uv+ca).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-ca).b));", OUT="gl_FragColor=vec4(c,1.);}";
  FOLD.out=composer.passes.find(p=>p instanceof OutputPass);
  if(!src.includes(READ)||!src.includes(OUT)||!FOLD.out||composer.passes.at(-1)!==FOLD.out||composer.passes.at(-2)!==grade||renderer.toneMapping!==THREE.AgXToneMapping||renderer.outputColorSpace!==THREE.SRGBColorSpace)
    throw new Error("the grade or the output isn't what the fold was written for");
  grade.uniforms.tBloom={value:bloom.renderTargetsHorizontal[0].texture}; grade.uniforms.bloomOn={value:1}; grade.uniforms.foldExposure={value:renderer.toneMappingExposure};
  const TM=THREE.ShaderChunk.tonemapping_pars_fragment.replace("uniform float toneMappingExposure;","uniform float foldExposure;\n#define toneMappingExposure foldExposure");
  FOLD.base=grade.material;
  FOLD.mat=new THREE.ShaderMaterial({name:"grade, bloom and output",uniforms:grade.uniforms,vertexShader:FOLD.base.vertexShader,toneMapped:false,
    fragmentShader:"uniform sampler2D tBloom;\nuniform float bloomOn;\n"+TM+"\nvec3 bloomAt(vec2 u){ vec4 b=texture2D(tBloom,u); return b.rgb*b.a*bloomOn; }\n"+
      src.replace(READ,"vec3 c=finite(vec3(texture2D(tDiffuse,uv+ca).r+bloomAt(uv+ca).r,texture2D(tDiffuse,uv).g+bloomAt(uv).g,texture2D(tDiffuse,uv-ca).b+bloomAt(uv-ca).b));")
        .replace(OUT,"gl_FragColor=vec4(c,1.); gl_FragColor.rgb=AgXToneMapping(gl_FragColor.rgb); gl_FragColor=sRGBTransferOETF(gl_FragColor);}")});
  const quad=bloom.fsQuad, draw=quad.render.bind(quad); quad.render=r=>{ if(FOLD.on&&quad.material===bloom.blendMaterial) return; draw(r); };   // (the blend)
  const pass=grade.render.bind(grade); grade.render=(r,...a)=>{ grade.uniforms.foldExposure.value=r.toneMappingExposure; grade.uniforms.bloomOn.value=bloom.enabled?1:0; pass(r,...a); };
  FOLD.ok=true; setFold(true);
}catch(e){ console.warn("post: the passes stay as they were:",e.message); }
// Folded, the grade is the last pass and swaps nothing, so the room keeps rendering into renderTarget2, the multisampled one
function setFold(on){ if(!FOLD.ok) return; FOLD.on=!!on; grade.material=FOLD.on?FOLD.mat:FOLD.base; grade.needsSwap=!FOLD.on; FOLD.out.enabled=!FOLD.on; composer.renderTarget2.resolveDepthBuffer=!FOLD.on; }
// <<< perf/join: post

// >>> perf/phone: main
// ---- Graphics (vhs-tv/perf/phone), continued: the pick, the shadows while a tape moves, the TV's glow, Auto, the frame-rate
// line, DEBUG on a touch screen
function gfxLevel(v){
  PQ.level=v; PQ.cap=v==="smooth"?1.5:2; PQ.win.n=PQ.win.late=0; PQ.tried=null; PQ.held=false; PQ.stepT=performance.now();
  dprCap=2; DPR=Math.min(dprCap,DPR_MAX()); resize();   // a pick starts again from its own top (a step down from slow frames too)
  gfxShadows(v==="smooth"?1024:2048);
  return v==="auto"?"Sharp until the frames drag, then a little softer.":v==="smooth"?"A little softer, a little smoother.":true;
}
// Smooth's shadow maps are half as wide: a quarter of the texels to draw whenever the shadows redraw, and softer edges by a
// shade. (Three makes the new maps at their next redraw, which shadowsDirty asks for.)
function gfxShadows(s){
  for(const L of [moon,lampSpot]){ const sh=L.shadow; if(sh.mapSize.x===s) continue; sh.mapSize.set(s,s); if(sh.map){ sh.map.dispose(); sh.map=null; } }
  shadowsDirty=2;
}
// While a tape flies or drops into place, every caster goes into both shadow maps each frame: the heaviest frames the room
// has. On a phone the shadows follow the tape every other frame; the frame it lands on is drawn in full, as before.
function phoneShadowSkip(){ if(!PQ.on||!(tapeAnim||settles.length)||!moon.shadow.map||!lampSpot.shadow.map) return false; return PQ.odd=!PQ.odd; }

// The TV's glow on the room takes its colour from the picture every 16th paint (sigAvg: tvLight, TVCOL). Drawn into a 1x1
// canvas and read with getImageData, that stopped the page about twice a second while a film or a tape played: the canvas
// came back from the GPU, and the page waited for it. A phone samples the same spot on the GPU instead (the middle of the
// picture, where the 1x1 draw samples in Chrome), right after the TV's pass has uploaded the paint, and reads the one pixel
// a frame or two later, once a fence says the GPU got there: nothing waits. The colour lands one or two paints later.
const TVA={rt:null,scene:null,want:null,busy:null,sync:false,px:new Uint8Array(4)};
function tvAvg(cv,col){
  if(!PQ.on||TVA.sync){ avgX.drawImage(cv,0,0,1,1); const d=avgX.getImageData(0,0,1,1).data; col.setRGB(d[0]/255,d[1]/255,d[2]/255,THREE.SRGBColorSpace); return; }
  if(!TVA.busy) TVA.want=col;   // (one read at a time: an ask while one is out waits for the next 16th paint)
}
function tvAvgRun(){   // right after the TV's pass: srcTex holds this frame's paint
  const col=TVA.want; TVA.want=null;
  try{
    const gl=renderer.getContext(), st=renderer.state;
    if(!TVA.rt){ TVA.rt=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false}); TVA.scene=new THREE.Scene();
      const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{T:{value:srcTex}},depthTest:false,depthWrite:false,
        vertexShader:"void main(){gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:"uniform sampler2D T;void main(){gl_FragColor=texture2D(T,vec2(.5));}"}));
      q.frustumCulled=false; TVA.scene.add(q); }
    const prev=renderer.getRenderTarget();
    renderer.setRenderTarget(TVA.rt); renderer.render(TVA.scene,vhsCam);
    // the pixel goes into a buffer on the GPU; three binds and unbinds the read framebuffer through its state, as for a resolve
    st.bindFramebuffer(gl.READ_FRAMEBUFFER,renderer.properties.get(TVA.rt).__webglFramebuffer);
    const buf=gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf); gl.bufferData(gl.PIXEL_PACK_BUFFER,4,gl.STREAM_READ);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    st.bindFramebuffer(gl.READ_FRAMEBUFFER,null); renderer.setRenderTarget(prev);
    TVA.busy={buf,col,sync:gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),t:performance.now()};
  }catch(e){ console.warn("tv glow: read straight from here on",e); TVA.sync=true;
    try{ const gl=renderer.getContext(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null); renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,null); renderer.setRenderTarget(null); }catch(e2){} }
}
function tvAvgPoll(now){
  const b=TVA.busy;
  try{
    const gl=renderer.getContext(), s=gl.getSyncParameter(b.sync,gl.SYNC_STATUS);
    if(s!==gl.SIGNALED&&now-b.t<1000) return;   // not there yet (a lost one is let go after a second)
    if(s===gl.SIGNALED){ gl.bindBuffer(gl.PIXEL_PACK_BUFFER,b.buf); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,TVA.px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
      b.col.setRGB(TVA.px[0]/255,TVA.px[1]/255,TVA.px[2]/255,THREE.SRGBColorSpace); }
    gl.deleteSync(b.sync); gl.deleteBuffer(b.buf);
  }catch(e){ console.warn("tv glow: read straight from here on",e); TVA.sync=true; }
  TVA.busy=null;
}

// Auto: of the frames drawn while something moves, how many came late (under ~48 fps). When more than a quarter of the last
// 90 did, the room draws a quarter fewer pixels per CSS pixel (2, 1.75, 1.5, 1.25; a screen at 1.25 or less keeps its own).
// A step that didn't help (the next 90 as late, give or take a fifth: then it's the draw calls, not the pixels) is taken
// back, and Auto holds there for the visit. It judges only the room as it runs: not the first seconds after the reveal
// (shaders, the film starting), not a tape in the air (its shadow frames), not the second after a step, not a stall (a tab
// away, a program loading), not debug mode.
function gfxAuto(now,raw,busy){
  if(PQ.held||!busy||gated||DBG.on||!canvas.classList.contains("ready")||now-revealT<6000||now-PQ.stepT<1500||raw>250||tapeAnim||settles.length) return;
  const W=PQ.win; W.n++; if(raw>1000/48) W.late++;
  if(W.n<90) return;
  const r=W.late/W.n, t=PQ.tried; W.n=W.late=0; PQ.tried=null;
  if(t&&r>t.r*.8){ dprCap=DPR=t.dpr; resize(); PQ.stepT=now; PQ.held=true; slow=0; return; }
  if(r>.25&&DPR>PQ.floor+.01){ PQ.tried={dpr:DPR,r}; dprCap=DPR=Math.max(PQ.floor,DPR-.25); resize(); PQ.stepT=now; slow=0; }   // (the slow step-down starts over too)
}

// The frame-rate line (OPTIONS' Frame rate, DEBUG on a touch screen, or ?fps=1): frames drawn a second against the page's
// own pace (60 while something moves, 30 at rest), the longest gap between two frames, the pixels per CSS pixel, the pick.
const MT={el:null,n:0,busy:0,worst:0,t0:0};
function fpsLine(on){
  PQ.meter=!!on;
  if(on&&!MT.el){ MT.el=document.createElement("div"); MT.el.setAttribute("aria-hidden","true");
    // (a thin line along the very top, above the top bar: calc(16px + the safe area) is where .top starts)
    MT.el.style.cssText="position:fixed;z-index:9;left:calc(8px + env(safe-area-inset-left,0px));top:calc(1px + env(safe-area-inset-top,0px));font:10px/1.3 ui-monospace,Menlo,monospace;color:#b8ffc8;background:rgba(0,0,0,.62);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:pre";
    document.body.appendChild(MT.el); MT.n=MT.busy=MT.worst=0; MT.t0=performance.now(); }
  else if(!on&&MT.el){ MT.el.remove(); MT.el=null; }
  return true;
}
function fpsTick(now,raw,busy,target){
  if(!MT.el) return;
  MT.n++; if(busy) MT.busy++; if(raw<1000) MT.worst=Math.max(MT.worst,raw);
  const span=now-MT.t0; if(span<500) return;
  MT.el.textContent=`${MT.busy*2>=MT.n?"MOVING":"AT REST"}  ${Math.round(MT.n*1000/span)}/${Math.round(1000/target)} FPS  ·  WORST ${Math.round(MT.worst)} MS  ·  ${DPR.toFixed(2)}×  ·  ${PQ.level.toUpperCase()}${PQ.held?" (HELD)":""}`;
  MT.n=MT.busy=MT.worst=0; MT.t0=now;
}
// each drawn frame (frame(), once it knows it draws): raw is the time since the frame before, target the page's own pace
function gfxTick(now,raw,busy,target){
  if(TVA.busy) tvAvgPoll(now);
  if(PQ.level==="auto") gfxAuto(now,raw,busy);
  if(PQ.meter) fpsTick(now,raw,busy,target);
}
// DEBUG on a touch screen, which has no backquote key to leave the free-look camera by: the frame-rate line, for the visit
// (FRAME RATE in OPTIONS hides it). The PC prints `how` first and lists DEBUG in HELP with `help` (pc/README, "Options and
// debug mode"); a PC that only knows the free-look camera says it has no debug mode, as before.
function touchDebug(){
  return {on:on=>{ if(on) fpsLine(true); return PQ.meter; },how:"The frame rate now shows along the top edge. FRAME RATE in OPTIONS hides it.",help:"show the frame rate"};
}
if(PQ.level==="smooth"||PQ.on) gfxShadows(1024);
if(PQ.meter) fpsLine(true);
PERF.phone={get state(){ return {on:PQ.on,level:PQ.level,dpr:DPR,cap:PQ.cap,held:PQ.held,shadowMap:moon.shadow.mapSize.x,meter:PQ.meter,glow:PQ.on&&!TVA.sync?"gpu":"read"}; },
  level:v=>gfxLevel(v),meter:v=>fpsLine(v)};
// <<< perf/phone: main
// >>> perf/mem: main
// ---- Memory (vhs-tv/perf/mem), continued. The room's pictures: GLTFLoader decodes each into an ImageBitmap that three
// keeps as the texture's image for good, besides the copy on the GPU (90 of them, 165 MiB). Once the room is built they're
// all uploaded right away and each bitmap is closed. A 32 px copy stays in its place, drawn only if something uploaded that
// texture again, which nothing in the room does (three would throw on a closed bitmap). Only the glTF's own textures
// (userData.mimeType); a texture that didn't upload is left as it was.
function memTextures(){
  const by=new Map(), st={images:0,kept:0,mib:0};
  scene.traverse(o=>{ for(const m of [o.material].flat()) if(m) for(const k in m){ const t=m[k];
    if(t&&t.isTexture&&t.userData?.mimeType&&t.source?.data){ let s=by.get(t.source); if(!s) by.set(t.source,s=new Set()); s.add(t); } } });
  for(const [src,ts] of by){
    const im=src.data, w=im.width, h=im.height; if(!(Math.max(w,h)>32)) continue;
    try{
      for(const t of ts) renderer.initTexture(t);
      if(![...ts].every(t=>renderer.properties.get(t).__version===t.version)){ st.kept++; continue; }
      src.data=memFit(im,32,[...ts].every(t=>t.userData.mimeType==="image/jpeg"));
      im.close?.(); st.images++; st.mib+=w*h*4/1048576;
    }catch(e){ console.warn("[mem] texture",e); }
  }
  MEM.tex=st;
}
// an image at most `max` px on its long side: the image itself if it is that already, else a copy on a canvas
function memFit(im,max,opaque=true){ const w=im.width, h=im.height, k=max/Math.max(w,h); if(!(k<1)) return im;
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
  const x=c.getContext("2d",{alpha:!opaque}); x.imageSmoothingQuality="high"; x.drawImage(im,0,0,c.width,c.height); return c; }
// The geometry's text (base64, in a few JSON parts) into the GLB a slice at a time. The old way held a joined copy of the
// text, the decoded string and a byte copy of that all at once besides the GLB (30 MB and more at the load's peak here);
// the bytes are the same. Text with anything but base64 in it (the parts never have any) goes the old way.
function memGlb(g,parts){
  const js=new TextEncoder().encode(JSON.stringify(g)), jl=(js.length+3)&~3, SL=1<<20;
  let text=null, cap=0;
  if(parts.every(s=>typeof s==="string"&&!/[^A-Za-z0-9+/=]/.test(s))){ let end="";
    for(let p=parts.length-1;p>=0&&end.length<2;p--) end=parts[p].slice(end.length-2)+end;   // (the text's last two characters)
    for(const s of parts) cap+=s.length; cap=((cap-(end.endsWith("==")?2:end.endsWith("=")?1:0))*3)>>2; }
  else { text=atob(parts.join("")); cap=text.length; }
  const glb=new Uint8Array(28+jl+((cap+3)&~3)); let o=28+jl;
  // (a plain loop: Uint8Array.from with a function per character took 25 times as long, 0.8 s of a frozen page here,
  // while the loading display couldn't move)
  const put=b=>{ for(let i=0;i<b.length;i++) glb[o++]=b.charCodeAt(i); };
  if(text) put(text);
  else { let carry="";   // (a slice decodes on its own when it is whole groups of 4 characters: the rest waits for the next)
    for(let p=0;p<parts.length;p++){ const s=parts[p]; parts[p]=null; let i=0;
      if(carry){ i=Math.min(s.length,4-carry.length); carry+=s.slice(0,i); if(carry.length<4) continue; put(atob(carry)); carry=""; }
      const end=i+((s.length-i)&~3);
      for(;i<end;i+=SL) put(atob(s.slice(i,Math.min(end,i+SL))));
      carry=s.slice(end); }
    if(carry) put(atob(carry)); }
  if(o>glb.length) throw new Error("the geometry is longer than its text said");
  const bl=(o-28-jl+3)&~3, dv=new DataView(glb.buffer);   // (the chunk's padding: zeros, as the buffer is new)
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,28+jl+bl,true);
  dv.setUint32(12,jl,true); dv.setUint32(16,0x4E4F534A,true); glb.fill(0x20,20,20+jl); glb.set(js,20);
  dv.setUint32(20+jl,bl,true); dv.setUint32(24+jl,0x004E4942,true);
  return glb.buffer;
}
// The sounds heard only through the window's filter (its 1700 Hz lowpass: the city and the S-Bahn, 38 and 7 MB as samples at
// 48 kHz, as Web Audio keeps a sound whole, whatever its MP3 took) decode at 16 kHz, a third of that. What goes is above
// 8 kHz, which the filter has already taken down by 28 dB and more.
function memDecode(ctx,bytes,thin){
  if(!thin||typeof OfflineAudioContext==="undefined") return ctx.decodeAudioData(bytes);
  const again=bytes.slice(0);   // (decoding takes the bytes: a copy, should the 16 kHz way fail)
  try{ return new OfflineAudioContext(2,1,16000).decodeAudioData(bytes).catch(()=>ctx.decodeAudioData(again)); }catch{ return ctx.decodeAudioData(again); }
}
PERF.mem={get state(){ return {lost:MEM.lost,textures:MEM.tex}; }};
// <<< perf/mem: main
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setPixelRatio(DPR); renderer.setSize(w,h,false); composer.setPixelRatio(DPR); composer.setSize(w,h);
  camera.aspect=w/h; if(!DBG.on) camera.fov=lensFov(); camera.updateProjectionMatrix(); grade.uniforms.res.value.set(w,h); cardXY="";
}
addEventListener("resize",()=>{ DPR=Math.min(dprCap,DPR_MAX()); resize();
  if(state.page==="work"&&!state.sheet&&notepad&&document.body.classList.contains("padnote")!==padOn()) go("work",{silent:true});
  if(state.sheet==="credits"&&credits&&document.body.classList.contains("credcard")!==credOn()) showCredits();   // the credits: card or sheet   // across the phone layout: card or pad
  if(!fly&&!DBG.on){ const f=PC.zoom?pcFrame():WIN.zoom?winFrame():cd?.near?cd.shot():zoomed?tvZoomFrame():frameFor(state.page); controls.target.copy(f.tgt); camera.position.copy(f.pos); pageLimits(); } });

// ======================================================================= audio
const A={ctx:null,on:false,stems:{},fx:{}};
function sample(name,{gain=1,pan=0,rate=1,offset=0,dur,dest}={}){
  const buf=A.fx[name]; if(!A.on||!buf) return false; const ctx=A.ctx;
  const n=ctx.createBufferSource(); n.buffer=buf; n.playbackRate.value=rate;
  const g=ctx.createGain(); g.gain.value=gain; const p=ctx.createStereoPanner(); p.pan.value=pan;
  n.connect(g).connect(p).connect(dest||A.master); p.connect(A.verb);
  if(dur){ g.gain.setValueAtTime(gain,ctx.currentTime+dur*.7); g.gain.linearRampToValueAtTime(0,ctx.currentTime+dur); n.start(0,offset,dur+.05); } else n.start(0,offset);
  return true;
}
function noiseBuf(ctx,sec=2){const b=ctx.createBuffer(1,ctx.sampleRate*sec,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
// iPhones and iPads play a page's Web Audio as "ambient" sound, which the ring/silent switch (Silent Mode) mutes, and every
// sound in the room is Web Audio, the film's voice too (Felix, 28 Sep 00:44Z: "I somehow can't hear sound on my iPhone in
// iOS safari"). Now it plays through the switch, as a video's sound does: navigator.audioSession "playback", the session a
// music app uses (Safari 16.4+), set before the room's first sound, as iOS keeps the kind the sound started with. Safari
// takes it only on a page that may use the microphone, which a page framed by another site (the artifact) may not: there,
// and on older iPhones, a silent <audio> on a loop does the same, the way it was done before that API (mediaChannel). As
// with a video, the room's sound then pauses the phone's other audio (a podcast)
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);   // (an iPad says Macintosh)
function playbackSession(){ try{ const s=navigator.audioSession; if(s){ s.type="playback"; return s.type==="playback"; } }catch(e){} return false; }   // (refused, it stays "auto")
// the silent <audio> plays while the room's sound is on and the page is in view, and goes when either ends, as a playing
// <audio> puts the page in the phone's media controls. iOS starts one only from a tap or a key: the visit's first click
// (setSound) starts it, and after the page was hidden, the next tap does
let mediaTag=null, silence="";
function mediaChannel(){
  if(!(IOS&&A.ctx&&!A.session&&A.on&&!document.hidden)){ if(mediaTag){ mediaTag.pause(); mediaTag.removeAttribute("src"); mediaTag.load(); mediaTag=null; } return; }   // (no src and a load: out of the media controls)
  if(!mediaTag){
    if(!silence){ const r=A.ctx.sampleRate|0, n=r>>2, b=new DataView(new ArrayBuffer(44+n*4)), w=(o,s)=>{ for(let i=0;i<4;i++) b.setUint8(o+i,s.charCodeAt(i)); };
      w(0,"RIFF"); b.setUint32(4,36+n*4,true); w(8,"WAVE"); w(12,"fmt "); b.setUint32(16,16,true); b.setUint16(20,1,true); b.setUint16(22,2,true); b.setUint32(24,r,true);
      b.setUint32(28,r*4,true); b.setUint16(32,4,true); b.setUint16(34,16,true); w(36,"data"); b.setUint32(40,n*4,true);
      let s=""; const u=new Uint8Array(b.buffer); for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]);
      silence="data:audio/wav;base64,"+btoa(s); }   // a quarter second of 16-bit stereo silence at the room's own rate (a data: URI, as the unmute scripts have long used on iOS)
    mediaTag=document.createElement("audio"); mediaTag.setAttribute("x-webkit-airplay","deny"); mediaTag.disableRemotePlayback=true; mediaTag.loop=true; mediaTag.src=silence; }
  const t=mediaTag; if(t.paused) t.play()?.catch(()=>{ if(mediaTag===t) mediaTag=null; });   // (refused outside a tap: the next tap makes a new one)
}
// early: the home program wants the sound graph before the first click, suspended (it starts on that click, part-way through
// a line, the way the tapes expect); the recordings and the music wait for the click
function audioInit(early){
  if(A.ctx) return early||audioStems();
  A.session=playbackSession();   // (before the context: see playbackSession)
  const ctx=A.ctx=new (window.AudioContext||window.webkitAudioContext)();
  A.master=ctx.createGain(); A.master.gain.value=0;
  const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=2.5; comp.knee.value=12;
  A.master.connect(comp).connect(ctx.destination);
  A.white=noiseBuf(ctx);
  const ir=ctx.createBuffer(2,ctx.sampleRate*.9,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3.2)*.6}
  A.verb=ctx.createConvolver(); A.verb.buffer=ir; const vg=ctx.createGain(); vg.gain.value=.2; A.verb.connect(vg).connect(A.master);
  // the monitor's little speaker
  A.tv=ctx.createGain(); A.tv.gain.value=0;
  const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=170;
  const pk=ctx.createBiquadFilter(); pk.type="peaking"; pk.frequency.value=2200; pk.gain.value=4; pk.Q.value=.8;
  const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=6500;
  const sh=ctx.createWaveShaper(); const cv=new Float32Array(1024); for(let i=0;i<1024;i++){const x=i/511.5-1;cv[i]=Math.tanh(x*1.6)} sh.curve=cv;
  A.prog=ctx.createGain(); A.prog.gain.value=.9;
  A.prog.connect(hp).connect(pk).connect(sh).connect(lp).connect(A.tv).connect(A.master); A.tv.connect(A.verb);
  A.wow=ctx.createGain(); A.wow.gain.value=9; const lf=ctx.createOscillator(); lf.frequency.value=.55; lf.connect(A.wow); lf.start();
  const fl=ctx.createOscillator(); fl.frequency.value=7.3; const flg=ctx.createGain(); flg.gain.value=2.5; fl.connect(flg).connect(A.wow); fl.start();
  // outside, heard through a closed Kastenfenster: two panes of glass take the top off
  A.window=ctx.createBiquadFilter(); A.window.type="lowpass"; A.window.frequency.value=1700; A.window.Q.value=.4;
  const wshelf=ctx.createBiquadFilter(); wshelf.type="lowshelf"; wshelf.frequency.value=180; wshelf.gain.value=-3;
  A.outside=ctx.createGain(); A.outside.gain.value=.55; A.window.connect(wshelf).connect(A.outside).connect(A.master);
  crtTone(); if(!early) audioStems();
}
const RAIN=.63;   // the rain's level (x .65 in a drizzle to x 1.35 in a downpour): .9 until v26, when Felix found it a little loud (03:12Z)
function audioStems(){ if(A.stemsAsked) return; A.stemsAsked=true; loadStems().then(()=>{ if(!music.started) musicStart(); }); }   // the music never holds up the room's own sounds
async function loadStems(){
  await clockP;   // (the room's background comes from the clock's folder when it's there)
  const ctx=A.ctx;
  // field recordings from freesound.org (credits in the Credits panel); one-shots feed the VCR and CRT
  const spec={rain:{gain:RAIN,dest:()=>A.master},city:{gain:1.5,dest:()=>A.window},room:{gain:.8,dest:()=>A.master,url:clockMod?.ROOM_URL},sbahn:{gain:1,dest:()=>A.window,oneShot:true},
    vcr_insert:{fx:1},vcr_eject:{fx:1},crt_on:{fx:1},button_click:{fx:1},channel_static:{fx:1}};
  await Promise.all(Object.entries(spec).map(async([k,s])=>{
    try{ const buf=await memDecode(ctx,await (await fetch(s.url||`${SCENE_BASE}audio2/${k}.mp3`)).arrayBuffer(),s.dest?.()===A.window);   // (perf/mem)
      A.stems[k]=buf;
      if(s.fx){ A.fx[k]=buf; return; }
      if(!s.oneShot){ const n=ctx.createBufferSource(); n.buffer=buf; n.loop=true; const g=ctx.createGain(); g.gain.value=0;
        if(k==="city"){ A.cityGain=g; A.cityLvl=cityHum(); }
        if(k==="rain") A.rainGain=g;   // the frame loop turns it up in a shower
        g.gain.setTargetAtTime(k==="city"?A.cityLvl:s.gain,ctx.currentTime,1.2); n.connect(g).connect(s.dest()); n.start(0,Math.random()*buf.duration); }
    }catch(e){ console.warn("audio stem",k,e); }
  }));
}
function playTrain(){ if(!A.on||!A.stems.sbahn) return; const n=A.ctx.createBufferSource(); n.buffer=A.stems.sbahn; const g=A.ctx.createGain(); g.gain.value=1.1; n.connect(g).connect(A.window); n.start(); }
function src_(buf,loop=false){const s=A.ctx.createBufferSource();s.buffer=buf;s.loop=loop;return s}
function env(g,t,a,peak,d,end=0.0001){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(end,t+a+d)}
function crtTone(){
  const ctx=A.ctx; A.crt=ctx.createGain(); A.crt.gain.value=0; A.crt.connect(A.master);
  const whine=ctx.createOscillator(); whine.frequency.value=15625; const wg=ctx.createGain(); wg.gain.value=.0025; whine.connect(wg).connect(A.crt); whine.start();
  const hum=ctx.createOscillator(); hum.type="sawtooth"; hum.frequency.value=50;
  const hl=ctx.createBiquadFilter(); hl.type="lowpass"; hl.frequency.value=200; const hg=ctx.createGain(); hg.gain.value=.008; hum.connect(hl).connect(hg).connect(A.crt); hum.start();
}
function click(kind="button",pan=0){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime;
  if((kind==="button"||kind==="power")&&sample("button_click",{gain:kind==="power"?.9:.55,pan,rate:(kind==="power"?.86:1)+Math.random()*.08})) return;
  const p=ctx.createStereoPanner(); p.pan.value=pan; p.connect(A.master); p.connect(A.verb);
  const hit=(dt,freq,q,amp,dur)=>{const s=src_(A.white),f=ctx.createBiquadFilter(),g=ctx.createGain();f.type="bandpass";f.frequency.value=freq;f.Q.value=q;env(g,t+dt,.0008,amp,dur);s.connect(f).connect(g).connect(p);s.start(t+dt,Math.random());s.stop(t+dt+dur+.05)};
  const thump=(dt,freq,amp,dur)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(freq,t+dt);o.frequency.exponentialRampToValueAtTime(freq*.5,t+dt+dur);env(g,t+dt,.002,amp,dur);o.connect(g).connect(p);o.start(t+dt);o.stop(t+dt+dur+.05)};
  if(kind==="button"){hit(0,3200,4,.45,.012);thump(0,190,.3,.04);hit(.085,4200,5,.22,.01);}
  else if(kind==="power"){hit(0,1800,2,.55,.02);thump(0,110,.55,.08);hit(.12,2600,3,.28,.015);}
  else if(kind==="relay"){hit(0,5200,8,.3,.006);hit(.012,2400,6,.26,.01);}
  else if(kind==="switch"){hit(0,2900,3,.5,.009);thump(0,150,.3,.03);hit(.004,6200,6,.16,.005);}
  else if(kind==="tape"){hit(0,1200,3,.45,.02);hit(.03,2800,4,.3,.02);thump(0,240,.22,.05);}
  else if(kind==="settle"){hit(0,1500,3,.16,.014);thump(0,210,.1,.035);}
  else if(kind==="rubber"){thump(0,320,.35,.03);hit(0,900,2,.16,.02);}
  else if(kind==="tick"){hit(0,6000,10,.1,.004);}
  else if(kind==="door"){hit(0,1600,3,.3,.02);thump(0,150,.25,.06);}
  else if(kind==="handset"){ if(arguments[2]){ thump(0,120,.4,.07); hit(0,1100,2,.35,.03); hit(.07,2600,4,.14,.012); } else { hit(0,1900,3,.3,.018); thump(0,170,.22,.045); } }
  else if(kind==="clunk"){thump(0,90,.6,.12);hit(0,700,2,.4,.04);hit(.06,2200,4,.25,.02);hit(.3,3000,6,.2,.01);}
}
function staticBurst(dur=.3,amp=.3){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime;
  if(A.fx.channel_static&&sample("channel_static",{gain:amp*2.2,offset:Math.random()*.6,dur:Math.min(dur,.6),dest:A.tv.gain.value>0?A.tv:A.master})) return;
  const s=src_(A.white); const f=ctx.createBiquadFilter(); f.type="bandpass"; f.frequency.value=2400; f.Q.value=.6;
  const g=ctx.createGain(); g.gain.setValueAtTime(amp,t); g.gain.setTargetAtTime(0.0001,t+dur*.4,dur*.25);
  s.connect(f).connect(g).connect(A.tv.gain.value>0?A.tv:A.master); s.start(t,Math.random()); s.stop(t+dur*2);
}
function crackle(dur=1.2,rate=40){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime;
  for(let i=0;i<dur*rate;i++){const dt=Math.random()*dur,s=src_(A.white),g=ctx.createGain(),f=ctx.createBiquadFilter();
    f.type="highpass";f.frequency.value=2000+Math.random()*4000; env(g,t+dt,.0005,.07*Math.random()*(1-dt/dur),.004); s.connect(f).connect(g).connect(A.master); s.start(t+dt,Math.random()); s.stop(t+dt+.02);}
}
function degauss(){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime;
  if(sample("crt_on",{gain:1.1})) return;
  click("power");
  const o=ctx.createOscillator(); o.type="sawtooth"; o.frequency.value=50;
  const o2=ctx.createOscillator(); o2.type="square"; o2.frequency.value=100;
  const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.setValueAtTime(900,t); lp.frequency.exponentialRampToValueAtTime(140,t+1.6);
  const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t+.05); g.gain.exponentialRampToValueAtTime(.28,t+.09); g.gain.exponentialRampToValueAtTime(.0001,t+1.8);
  const trem=ctx.createGain(); const tl=ctx.createOscillator(); tl.frequency.setValueAtTime(14,t); tl.frequency.linearRampToValueAtTime(4,t+1.6); const tg=ctx.createGain(); tg.gain.value=.5;
  tl.connect(tg).connect(trem.gain); trem.gain.value=.6;
  o.connect(lp); o2.connect(lp); lp.connect(trem).connect(g).connect(A.master); g.connect(A.verb);
  [o,o2,tl].forEach(x=>{x.start(t+.05);x.stop(t+2)});
  const b=ctx.createOscillator(); b.frequency.setValueAtTime(90,t+.05); b.frequency.exponentialRampToValueAtTime(38,t+.6);
  const bg=ctx.createGain(); env(bg,t+.05,.01,.4,.6); b.connect(bg).connect(A.master); b.start(t+.05); b.stop(t+.8);
  setTimeout(()=>crackle(1.6,50),250);
}
function powerOffSound(){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime; click("power");
  const o=ctx.createOscillator(); o.frequency.setValueAtTime(1400,t+.05); o.frequency.exponentialRampToValueAtTime(70,t+.35);
  const g=ctx.createGain(); env(g,t+.05,.005,.07,.35); o.connect(g).connect(A.master); o.start(t+.05); o.stop(t+.5);
  setTimeout(()=>crackle(1.4,30),120);
}
function motor(sec=1.2){
  if(!A.on) return; const ctx=A.ctx,t=ctx.currentTime;
  const o=ctx.createOscillator(); o.type="sawtooth"; o.frequency.setValueAtTime(18,t); o.frequency.linearRampToValueAtTime(34,t+.6);
  const s=src_(A.white); const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=420;
  const g=ctx.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.1,t+.15); g.gain.exponentialRampToValueAtTime(.0001,t+sec);
  o.connect(lp); s.connect(lp); lp.connect(g).connect(A.master); o.start(t); s.start(t); o.stop(t+sec+.1); s.stop(t+sec+.1);
}

// ---- music: three original ambient synth beds under the whole room (vhs-tv/music), played by the CD player on the desk, and
// Felix's song "Retche Gospod Gospodevi moyemu" (26 Sep 22:56Z; cut to 2:24 between two of its rests, 1:37 to 4:01, 22:59Z)
// (cdplayer/cdplayer.js). Deep Field first (Felix's pick, 22:20Z); the player's close-up switches songs and turns the music's own
// volume (Felix, 26 Sep 03:03Z). It plays in the room, not through the TV's speaker, each song looping on its own seamless loop
// points, and it ducks under a tape: a little while one plays, more while it speaks (the TV's program bus loud, with a hold
// between words), and comes back up between lines.
const MUSIC_LEVEL=.42;   // the music's level at the player's middle volume step
let duckK=1, loudT=-1e9;
function musicBus(){
  if(!A.ctx) return null; const ctx=A.ctx;
  if(!A.music){ A.music=ctx.createGain(); A.music.gain.value=MUSIC_LEVEL*music.gain(); A.musicDuck=ctx.createGain(); A.music.connect(A.musicDuck).connect(A.master);
    A.progTap=ctx.createAnalyser(); A.progTap.fftSize=1024; A.tapBuf=new Float32Array(1024); const z=ctx.createGain(); z.gain.value=0;
    A.prog.connect(A.progTap); A.progTap.connect(z).connect(A.master); }   // (kept in the graph, so every browser runs it)
  return A.music; }
const music=createMusic({level:MUSIC_LEVEL,url:id=>`${SCENE_BASE}audio2/${id}.mp3`,audio:()=>A.ctx?{ctx:A.ctx,bus:musicBus()}:null,
  tracks:[{id:"deep-field",title:"Deep Field",loop:[.5,96.5]},{id:"late-shift",title:"Late Shift",loop:[.5,91.928571]},{id:"soft-focus",title:"Soft Focus",loop:[.5,80.5]}]});
function musicStart(){ musicBus(); music.start(); }
// the CD player used (Felix, 27 Sep 21:32Z: "if the user interacts with the discman, we should mute the home video music and
// play whatever the discman is playing"): how is "play" (▶‖ that plays), "skip" (◀◀ ▶▶), "turn" (the volume wheel) or "look"
// (a press on the LCD); ■ isn't. While the home film is on the TV, or about to be, with its music on, the CD takes the music,
// whether it holds for it yet or not (its music can still be loading): the film plays on, its voice too, without its music,
// and the CD's song comes in at once. The CD keeps it until its ■ (cdGive): a loop of the film, a page away and back or a
// pause don't give it back. A skip, a turn or a look with the disc paused or stopped leaves the film its music (the CD has
// nothing to play). Anthropic's ad can't play without its score, so ▶‖ or a skip while the CD holds for it stops that tape
// instead, as the VCR's stop button does (play brings it back); the wheel and the LCD leave it be
function cdClaim(how="play"){
  if(adHold){ if(how!=="play"&&how!=="skip") return;
    adHold=false; if(CYC.tv&&cycHere()&&cycNext()){ music.yieldTo(false); return; }   // (the ad's turn: the next tape's, tapecycle)
    if(state.tapeState==="playing"){ state.tapeState="stopped"; motor(.5); chPause(true); refreshWork(); drawVFD(); }
    music.yieldTo(false); return; }
  if(how!=="play"&&music.mode!=="play") return;
  if(!filmMusic||!homeOnTV()) return;
  filmMusic=false; filmMusT=-1e9; cdTook=true; try{ homeInst?.setMusic?.(false); }catch(e){}
  music.yieldTo(false,.12); }
// ■ on the CD player after it took the music: the film has its own back (unless OPTIONS switched it off), and the CD holds for
// it from now on, so a ▶‖ right after takes it again rather than the film's music coming in over the CD's song
function cdGive(){ if(!cdTook) return; cdTook=false; filmMusic=OPT.tv_music!=="off"; if(!filmMusic) return;
  filmMusT=performance.now(); if(homeOnTV()) music.yieldTo(true); try{ homeInst?.setMusic?.(true); }catch(e){} }
let adMusT=-1e9, adHold=false;   // Anthropic's ad: when its score last sounded, and whether the CD player holds for it
const FILM_WAIT=12000;   // how long the CD player waits for the home film's music to come in (it loads once the film is on)
let cd=null, cdLeft=false;   // the player itself, once the room is in (createCDPlayer); cdLeft: the next flight starts at it
function musicDuck(now){
  // the TV's home film playing its own music (Felix, 22:56Z: "while the tv music is playing we should not play the discman
  // song"): the CD player holds, and comes back in where it was once the film's music ends (its instance says: music). It
  // holds through a pause (a hidden tab) or a stall shorter than .8 s, and ahead of the film's music: from the visit's first
  // click until the film is on (so the visit doesn't start with the CD's song), and while that music loads, until it first
  // sounds (FILM_WAIT at most each; 4 s once it has: a slow load let the CD's song in and then cut it when the music came).
  const tv=homeOnTV()&&!!state.power&&state.volume>0&&filmMusic;
  if(tv&&homeInst&&(!homeOn||homeInst.music)) filmMusT=now;
  // a tape with a score of its own (Anthropic's ad: its module has a musicTitle, its instance says music) holds it the same
  // way while it sounds, and for the tape's first 7 s while the score loads (the film waits up to 6 s for it)
  const ad=tvPage()==="work"&&state.tapeState==="playing"&&!!chInst&&chIdx===state.tape&&!!channels[chIdx]?.musicTitle&&!!state.power&&state.volume>0;
  if(ad&&chInst.music) adMusT=now;
  adHold=ad&&(now-adMusT<800||now-chT0<7000);
  music.yieldTo(adHold||cycHold(now)||tv&&(now-filmMusT<800||(homeInst?now-homeStartT<(filmMusT<homeStartT?FILM_WAIT:4000):now-userT<HOME_DELAY+FILM_WAIT)));
  if(!A.musicDuck||!A.on) return;
  const tape=((tvPage()==="work"&&state.tapeState==="playing"&&!!chInst&&!chPaused)||(homeOnTV()&&homeOn))&&!!state.power&&state.volume>0;
  if(tape){ A.progTap.getFloatTimeDomainData(A.tapBuf); let e=0; for(let i=0;i<A.tapBuf.length;i++) e+=A.tapBuf[i]*A.tapBuf[i];
    if(Math.sqrt(e/A.tapBuf.length)>.0079) loudT=now; }   // −42 dBFS
  const talk=tape&&now-loudT<350, k=(tape?.56:1)*(talk?.56:1);   // −5 dB each
  if(k!==duckK){ A.musicDuck.gain.setTargetAtTime(k,A.ctx.currentTime,k<duckK?(talk?.08:.4):(tape?.6:.4)); duckK=k; }
}
addEventListener("pageshow",e=>{ if(!e.persisted) return;
  state.glitch=0; lastInput=performance.now(); readSeen(); document.getElementById("plink").hidden=true;
  if(A.ctx&&A.on&&A.ctx.state!=="running") A.ctx.resume().catch(()=>{}); });
// a hidden tab gets no frames: the tape stops with its picture instead of its sound running on ahead, and the room's sound
// sleeps; back in view, a tape that was playing picks up where it froze (play, then the sound, as the tapes expect)
document.addEventListener("visibilitychange",()=>{
  if(chInst) chPause(!(tvPage()==="work"&&state.tapeState==="playing"&&chIdx===state.tape));
  if(document.hidden) homePause();
  if(A.ctx){ if(document.hidden) A.ctx.suspend().catch(()=>{}); else if(A.on) A.ctx.resume().catch(()=>{}); mediaChannel(); } });
function audioLevels(){
  if(!A.ctx) return; const t=A.ctx.currentTime;
  A.master.gain.setTargetAtTime(A.on?1:0,t,.12);
  A.tv.gain.setTargetAtTime(A.on&&state.power?state.volume*.85:0,t,.05);
  A.crt.gain.setTargetAtTime(A.on&&state.power?1:0,t,.15);
}
const soundBtn=$("#sound");
function setSound(on){ audioInit(); A.on=on; if(firstGesture) userT=performance.now(); firstGesture=false; if(on&&A.ctx.state!=="running") A.ctx.resume().catch(()=>{}); mediaChannel(); soundBtn.setAttribute("aria-pressed",on); soundBtn.textContent=on?"SOUND ON":"SOUND OFF"; audioLevels(); }
soundBtn.onclick=e=>{e.stopPropagation(); setSound(!A.on); if(A.on) click("relay");};
let firstGesture=true;
function gesture(){ if(firstGesture){ firstGesture=false; userT=performance.now(); if(!A.on) setSound(true); } }   // the visit's first click or key: the sound, and the home film (userT)
// Enter muted (ENTER MUTED on the TV at the gate): the click counts as the visit's first, as with gesture, so the home film
// starts and later clicks don't bring the sound, but the sound stays off until SOUND ON (or the CD player). The click doesn't
// start the sound either, as an iPhone pauses its other audio (a podcast) once the room's sound starts (see mediaChannel):
// the AudioContext is made on the next frame, outside the click, where a browser that wants a click for it leaves it
// suspended, and SOUND ON starts it. The film's voice and music pick up where the film is (channels/intro.js)
function quiet(){
  if(!firstGesture){ if(A.on) setSound(false); return; }   // (a click while the room loaded brought the sound: it goes)
  firstGesture=false; userT=performance.now(); requestAnimationFrame(()=>{ if(!A.ctx) audioInit(true); }); }
// iOS takes the room's sound away for a call, Siri, an alarm or another app's audio (the context turns "interrupted", WebKit's
// own state) and doesn't always give it back: with the room's sound on, the next tap or key does, and brings back the silent
// <audio> where the room uses one
for(const k of ["touchend","click","keydown"]) addEventListener(k,()=>{ if(!A.ctx||!A.on||document.hidden) return;
  if(A.ctx.state!=="running") A.ctx.resume().catch(()=>{}); mediaChannel(); },{capture:true,passive:true});

// ======================================================================= navigation
const panel=$("#panel");
new ResizeObserver(()=>{ cardH=panel.offsetHeight; cardXY=""; }).observe(panel);
// Where each card lives in the address bar. These two are the only places that know it's a #hash, so a host
// that serves the cards at real paths (the Ghost theme) swaps just these.
function pageUrl(page){ return page==="home"?location.pathname+location.search:"#"+page; }
function pageFromUrl(){ const h=BM_HASH(), p=PAGE_ALIAS[h]||h; return PAGES.includes(p)?p:"home"; }  // #debug falls through to home
if(PAGE_ALIAS[BM_HASH()]) try{ history.replaceState(history.state,"",pageUrl(pageFromUrl())); }catch{}   // an old #twitter or #github link
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const HINT0=$("#hint").innerHTML, HINT_TTX="↑ ↓ pick · Enter reads · ← → turns the page";
const HINT_PAD="N notepad · C use computer · M use CD player · Z zoom TV · 1–6 monitor buttons";   // (C was the notepad's until Felix gave it to the PC, 16:56Z)
const HINT_CD="← → song · ↑ ↓ volume · Space pause · Esc back to the desk";   // (room v27: the keys only, as Felix trimmed the room's hints)
function renderPanel(page){
  const body=$("#p-body"); const idx=PAGES.indexOf(page);
  const fa=document.activeElement, keep=fa&&body.contains(fa)?(fa.dataset.tape!=null?`[data-tape="${fa.dataset.tape}"]`:fa.dataset.post!=null?`[data-post="${fa.dataset.post}"]`:null):null;
  $("#p-ch").textContent="CH "+String(idx).padStart(2,"0")+(page==="posts"?" · TELETEXT 100":"");
  $("#p-title").textContent=TITLES[page];
  if(page==="about") body.innerHTML=aboutPanel();
  if(page==="work") body.innerHTML=workPanel();
  if(page==="posts") body.innerHTML=`<ul class="list">${POSTS.map((p,i)=>`<li><a class="row" href="${postHref(p)}" data-post="${i}"${ONSITE?"":` target="_blank" rel="noopener"`}><span class="n">${101+i}</span><span class="t">${esc(p.t)}</span><span class="m">${p.d.toUpperCase()}</span></a></li>`).join("")}</ul>`;
  body.scrollTop=0;
  if(ONSITE) body.querySelectorAll("[data-post]").forEach(a=>a.onclick=e=>{ if(e.metaKey||e.ctrlKey||e.shiftKey) return; e.preventDefault(); openPost(+a.dataset.post); });
  body.querySelectorAll("[data-post]").forEach(a=>{ a.onfocus=()=>{ ttxFocus=+a.dataset.post; postSub=Math.floor(ttxFocus/TTX_PER()); ttxSubT=performance.now(); lastInput=ttxSubT; }; a.onblur=()=>{ if(ttxFocus===+a.dataset.post) ttxFocus=-1; }; });
  body.querySelectorAll("[data-tape]").forEach(b=>{ b.onclick=()=>{ gesture(); chooseTape(+b.dataset.tape); };
    // tabbing through the tapes marks each on the notepad, which comes up for it
    b.onfocus=()=>{ if(!padOn()||state.page!=="work"||state.sheet) return; notepad.focus(+b.dataset.tape); if(workHidden) workCard(true); }; b.onblur=()=>notepad?.focus(-1); });
  if(keep) body.querySelector(keep)?.focus();
}
function refreshWork(){ notepad?.redraw(); if(state.page==="work"&&!state.sheet&&!panel.hidden) renderPanel("work"); }
function live(msg){ const el=$("#live"); el.textContent=""; setTimeout(()=>el.textContent=msg,60); }
function aboutPanel(){
  return `<div class="about-hero">
    <p class="lead">Forensic science student at K.R. Mangalam University · Developer · Observer</p>
  </div>
  <div class="bio-text">
    <p>Connecting careful empirical observation with digital forensics, questioned documents, evidence analysis, open-source intelligence (OSINT), and applied cryptography.</p>
    <p>Alongside forensic science, I build production-grade full-stack tools with Python, JavaScript, and Java. Internships at SIFS Lab and Beyond Evidence (Supreme Court of India) have deepened my understanding of evidence custody, forensic protocols, and courtroom presentation.</p>
    <p class="motto"><em>"Nothing is just a detail. I’m interested in what it reveals."</em></p>
  </div>
  <div class="sec">EXPERIENCE (INTERNSHIPS)</div>
  <ul class="list">
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">Forensic Science Intern</span>
          <span class="m">2026</span>
        </div>
        <div class="org">SIFS Lab</div>
        <p>Forensic investigation, questioned documents analysis, fingerprint ridge pattern identification, and evidence examination.</p>
      </div>
    </li>
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">Legal &amp; Forensic Intern</span>
          <span class="m">2025</span>
        </div>
        <div class="org">Beyond Evidence · Supreme Court of India</div>
        <p>Examining the intersection of forensic inquiry, chain-of-custody protocols, legal practice, and expert witness courtroom presentation.</p>
      </div>
    </li>
  </ul>
  <div class="sec">EDUCATION</div>
  <ul class="list">
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">B.Sc. (Hons) Forensic Science</span>
          <span class="m">2024–2027</span>
        </div>
        <div class="org">K.R. Mangalam University (Expected 2027)</div>
        <p>Specialization in criminalistics, forensic toxicology, questioned documents, digital forensics, and jurisprudence.</p>
      </div>
    </li>
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">Senior Secondary Schooling</span>
          <span class="m">2010–2024</span>
        </div>
        <div class="org">K.S.K Academy</div>
        <p>Foundations in science, mathematical analysis, computing, and investigative observation.</p>
      </div>
    </li>
  </ul>
  <div class="sec">SELECTED PROJECTS</div>
  <ul class="list">
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">Pratyaksh-AI</span>
          <span class="m">2024–NOW</span>
        </div>
        <p>Forensic AI platform covering cyber forensics, questioned documents, and automated fingerprint analysis. Patent application filed: <strong>2024/0103322A</strong>.</p>
        <p><a href="https://pratyaksh-ai.vercel.app/" target="_blank" rel="noopener">pratyaksh-ai.vercel.app ↗</a></p>
      </div>
    </li>
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">Aurex</span>
          <span class="m">2024–NOW</span>
        </div>
        <p>Secure communication and collaboration platform designed around cryptography, protected storage, and authenticated interactions.</p>
        <p><a href="https://aurexcyber.vercel.app/" target="_blank" rel="noopener">aurexcyber.vercel.app ↗</a></p>
      </div>
    </li>
    <li>
      <div class="entry">
        <div class="entry-header">
          <span class="t">CyberRepo Hub</span>
          <span class="m">2024–NOW</span>
        </div>
        <p>Curated multi-ecosystem repository hub across cybersecurity, AI/ML, web dev, DevOps, and systems.</p>
        <p><a href="https://cyberrepo.dpdns.org/" target="_blank" rel="noopener">cyberrepo.dpdns.org ↗</a></p>
      </div>
    </li>
  </ul>
  <div class="sec">CONNECT</div>
  <div class="connect-links">
    <p><a href="https://github.com/Velqore" target="_blank" rel="noopener">GitHub: @Velqore ↗</a></p>
    <p><a href="https://www.linkedin.com/in/ayush-tyagi-96b3b7350" target="_blank" rel="noopener">LinkedIn: Ayush Tyagi ↗</a></p>
    <p><a href="mailto:ayushtyagi5544@gmail.com">Email: ayushtyagi5544@gmail.com ↗</a></p>
  </div>`;
}
function workPanel(){
  const row=i=>{
    const t=tapeInfo(i);
    return `<li><button data-tape="${i}" aria-pressed="${state.tape===i}"><span class="n">${String(i+1).padStart(2,"0")}</span><span class="t">${esc(t.t)}</span><span class="m">${esc(t.y.toUpperCase())}</span><span class="desc">${esc(t.d)}</span></button></li>`;
  };
  const ids=TAPES.map((_,i)=>i);
  const lists=`<div class="sec">EXPERIENCE (INTERNSHIPS)</div><ul class="list">${ids.slice(0,EXP).map(row).join("")}</ul><div class="sec">EDUCATION</div><ul class="list">${ids.slice(EXP,JOBS).map(row).join("")}</ul><div class="sec">SELECTED PROJECTS</div><ul class="list">${ids.slice(JOBS).map(row).join("")}</ul>`;
  const cur=state.tape>=0?tapeInfo(state.tape):null;
  const st={playing:"NOW PLAYING",loading:"LOADING",stopped:"STOPPED",ejecting:"EJECTING"}[state.tapeState]||"IN THE VCR";
  return (cur?`<div class="detail"><div class="m">${st} · TAPE ${String(state.tape+1).padStart(2,"0")}</div><h3>${esc(cur.t)}</h3><div class="m">${esc(cur.y)}</div><p>${esc(cur.d)}</p>${cur.links.map(l=>`<p><a href="${l[1]}" target="_blank" rel="noopener">${esc(l[0])} ↗</a></p>`).join("")}</div>`:"")+lists;
}
// HIDE and SHOW CARD are Work and About's card switch.
let aboutHidden=false;
function modeBtn(){
  const onWork=state.page==="work"&&!state.sheet&&!padOn();
  const onAbout=state.page==="about"&&!state.sheet;
  const on=onWork||onAbout;
  $("#p-hide").hidden=!on;
  const hiddenNow=onAbout?aboutHidden:workHidden;
  $("#cardon").hidden=!(on&&hiddenNow);
}
function aboutCard(show){
  if(state.page!=="about"||state.sheet||aboutHidden!==show) return;
  aboutHidden=!show; document.body.classList.toggle("paneled",show);
  if(show){ renderPanel("about"); panel.hidden=false; } else panel.hidden=true;
  modeBtn();
  live(show?"About me":"Card hidden");
}
function workCard(show){
  if(state.page!=="work"||state.sheet||workHidden!==show) return;   // shows a hidden card, hides a shown one
  workHidden=!show; document.body.classList.toggle("paneled",show);
  if(padOn()){ if(show){ calc?.lower(); notepad.lift(); } else notepad.lower(); setHint(); }   // (the pad makes its own paper sounds; its HTML stays, out of sight)
  else { const fa=document.activeElement, kbd=!!fa&&(panel.contains(fa)||fa.id==="cardon"); click("button");
    if(show){ renderPanel("work"); panel.hidden=false; } else panel.hidden=true;
    if(kbd) (show?$("#p-hide"):$("#cardon")).focus({preventScroll:true}); }   // the keys stay with the card's switch
  modeBtn();
  if(show&&zoomed) setZoomed(false);   // from the TV's close-up (or the window), the card comes back to the desk
  if(!zoomed&&!PHONE()) flyTo(frameFor("work"));
  const plays=state.tape>=0&&(state.tapeState==="playing"||state.tapeState==="loading");
  live(show?"Work":padOn()?(plays?"Notepad down, the tape plays on":"Notepad down"):(plays?"Card hidden, the tape plays on":"Card hidden"));
}
// a click on the floating pad: its link opens (as the visitor's own click, in a new tab), a tape's row puts that tape in,
// and anywhere else on the paper puts the pad down
function padClick(h){
  if(!h||h.kind==="paper") return workCard(false);
  click("button");
  if(h.kind==="link"){ if(!/^https:\/\//.test(h.url)) return; const a=document.createElement("a"); a.href=h.url; a.target="_blank"; a.rel="noopener"; a.hidden=true; document.body.append(a); a.click(); a.remove(); }
  else if(h.kind==="row") chooseTape(h.i);
}
const HINT_CALC="0–9 + − * / % · Enter equals · Del clear · Esc put it down";
function setHint(){ $("#hint").innerHTML=calc?.up?HINT_CALC:cd?.near?HINT_CD:state.page==="posts"?HINT_TTX:state.page==="work"&&padOn()?HINT_PAD:HINT0; unzoomLabel(); }
$("#p-hide").onclick=()=>{ gesture(); if(state.page==="about") aboutCard(false); else workCard(false); };
$("#cardon").onclick=()=>{ gesture(); if(state.page==="about") aboutCard(true); else workCard(true); };
$("#cardon").textContent="SHOW CARD"+keyHint("N");
// The address follows the card. Opening one from home adds a history entry, so the browser's Back closes it again.
let backPending=false;
function syncUrl(page,push){
  const alias=!!PAGE_ALIAS[BM_HASH()];   // an old #twitter, #github or #contact typed in: #online takes its place
  if(backPending||(pageFromUrl()===page&&!alias&&location.hash!=="#options")) return;
  try{
    if(push&&page!=="home"&&!alias) history.pushState({card:1},"",pageUrl(page));
    else if(page==="home"&&history.state?.card){ backPending=true; history.back(); setTimeout(()=>{ if(backPending){ backPending=false; syncUrl(state.page); } },700); }
    else history.replaceState(history.state,"",pageUrl(page));
  }catch{}
}
const TITLES={home:"Home",about:"About me",work:"Work",posts:"Posts",online:"Online"};
// A fly-in (ENTRY): once the room has shown its home view for a moment, the camera sets off for the page as the page's own button
// sends it from home (#options: as C does). The PC's program waits for the camera (PC.hold: pcProgram and pcOptions keep it in
// PC.held, and the flight's landing opens it), so Online's call, About and OPTIONS start at the glass.
const ENTRY_WAIT=1500;   // ms after the room starts to fade in
function entryGo(){
  const p=ENTRY; if(!p) return; ENTRY=null;
  PC.hold=p==="options"||atPC(p); if(p==="options") pcOptions(); else go(p,{entry:true}); PC.hold=false;
  const w=PC.held, at=state.page; PC.held=null; if(!w) return;
  const open=()=>{ if(state.page!==at||!PC.zoom) return; if(w!=="options") return pcProgram(w); try{ PC.inst?.input({type:"open",what:"options"}); }catch(e){ console.warn("pc",e); } };
  if(fly) fly.land=open; else open();
}
// the visitor went somewhere first (the TV, the PC, the window, the CD player, C): they stay, at the address of the page they're on
function entryDrop(){ ENTRY=null; syncUrl(state.page,false); }
// entry: a step of a fly-in, its home view first or its move to the page
function go(page,{instant=false,silent=false,entry=false}={}){
  page=PAGE_ALIAS[page]||page; if(!PAGES.includes(page)) page="home";
  if(!entry) ENTRY=null;   // a page picked before a fly-in sets off takes its place
  if(page!=="home"&&!canvas.classList.contains("ready")) stillOff();
  if(!state.power&&!silent){ setPower(true); }
  const prev=state.page, changed=page!==prev, wasHome=homeOnTV(), was=tvProg();
  if(changed&&!atPC(page)) homeCarry=page==="work"&&!silent&&!entry&&wasHome&&state.tapeState!=="playing";   // Work from home: the home program plays on (a fly-in is a visit that starts at Work)
  if(changed&&atPC(page)&&!atPC(prev)) pcTV=prev;   // About and Online leave the TV on its page
  if(CYC.tv&&!silent&&!entry&&(changed?(atPC(page)?pcTV:page)!=="home":page==="home"&&performance.now()-CYC.press<100)) cycHome(!changed);   // (the tapes' turns are home's: tapecycle)
  state.page=page; state.sheet=null; document.body.classList.remove("sheet");
  if(changed) calc?.lower();   // (the calculator goes back on the desk)
  const keepTV=(changed||atPC(page))&&tvProg()===was;   // and then the TV's picture stays as it is: no switch, no static
  if(changed||!silent){ if(!keepTV) pageT=performance.now(); workHidden=PHONE()&&page==="work"; aboutHidden=false; }   // (closing a sheet keeps Work's card tucked away)
  if(!entry) syncUrl(page,changed&&!silent&&prev==="home");   // (a fly-in's address is its page's already)
  document.querySelectorAll("nav.menu a").forEach(a=>a.toggleAttribute("aria-current",a.dataset.page===page)&&a.setAttribute("aria-current","page"));
  $("#p-close").textContent="HOME"; $("#p-close").setAttribute("aria-label","Back to home");
  const pad=page==="work"&&padOn(), paneled=(page!=="home"&&!atPC(page)&&!(page==="work"&&workHidden))||(page==="about"&&!aboutHidden); document.body.classList.toggle("paneled",paneled);
  const padWas=document.body.classList.contains("padnote");
  document.body.classList.toggle("ttx",page==="posts"); document.body.classList.toggle("padnote",pad); setHint();
  if(changed){ ttxFocus=ttxHover=-1; $("#plink").hidden=true; if(page==="posts") readSeen(); }
  if(paneled||pad){ renderPanel(page); panel.hidden=false; }
  else if(padWas&&!panel.hidden){ panel.style.transition="none"; panel.hidden=true; void panel.offsetWidth; panel.style.transition=""; }   // (the pad's card was only tucked away: gone at once, not in a fade from full size)
  else panel.hidden=true;
  if(notepad){ if(pad&&!workHidden) notepad.lift(instant); else notepad.lower(instant&&!pad); }
  if(credits){ credits.lower(instant); if(document.body.classList.contains("credcard")){ panel.style.transition="none"; document.body.classList.remove("credcard"); void panel.offsetWidth; panel.style.transition=""; } }   // (the credits card goes back into its file, and the sheet's HTML, out of sight while it was up, goes at once: not in a fade from full size)   // Work's card is the pad: up, or down on the desk
  modeBtn(); setLeds();
  if(changed&&!silent&&!keepTV){ state.glitch=1; click("relay",.05); staticBurst(.32,.35); }
  const stay=!atPC(page)&&!changed&&silent&&PC.zoom;   // a sheet closed over the PC's glass, visited from this page (pcVisit): the camera stays
  if(atPC(page)) aboutPC(instant,changed||!silent); else if(stay) pcFocus({kbd:!touchOnly()}); else { setZoomed(false); flyTo(frameFor(page),instant); }
  drawVFD();
  if(changed&&page!=="work") queue=[];
  if(!atPC(page)&&(changed||PC.zoom)&&!stay){ PC.wantOpen=null; pcExit(false); }
  if(changed&&chInst) chPause(!(tvPage()==="work"&&state.tapeState==="playing"));
  if(changed&&!silent) live(TITLES[page]);
}
// Back, Forward and typed #hashes: popstate covers history moves (hash or path), hashchange a typed hash; both may fire
function onNav(){
  if(backPending){ backPending=false; if(state.page!=="home") syncUrl(state.page,true); return; }   // our own Back from a card that has since changed
  if(location.hash==="#options") return pcOptions(); const p=pageFromUrl(); if(p!==state.page) go(p); }
addEventListener("popstate",onNav); addEventListener("hashchange",onNav);
// Credits opens over whatever page is showing, as a sheet; closing it puts that page's card back
function openSheet(name,title,html){
  if(PC.zoom) pcBlur(); else if(zoomed) toggleZoom();   // over the PC the camera stays put; only the keys come back
  state.sheet=name; document.body.classList.add("paneled","sheet"); document.body.classList.remove("ttx","padnote","credcard"); panel.hidden=false; notepad?.lower(); calc?.lower(); credits?.lower();   // (closing it lifts the pad again)
  document.querySelectorAll("nav.menu a").forEach(a=>a.removeAttribute("aria-current"));
  $("#p-ch").textContent=title.toUpperCase(); $("#p-title").textContent=title;
  $("#p-close").textContent="CLOSE"; $("#p-close").setAttribute("aria-label","Close "+title);
  $("#p-body").innerHTML=html; $("#p-body").scrollTop=0; modeBtn();
}
function closeSheet(){ if(state.sheet) go(state.page,{silent:true}); }
document.querySelectorAll("[data-page]").forEach(a=>a.addEventListener("click",e=>{
  const p=a.dataset.page; gesture();
  e.preventDefault(); pressAnim(buttons[TV_BTN.indexOf(p)]); click("button"); go(p);
}));
$("#home-link").onclick=()=>{ gesture(); pressAnim(buttons[0]); click("button"); go("home"); };
// Credits: what the licences ask for (the work, its author, where it's from, the licence, and that it was changed: every one is
// cut, filtered or looped), and a line of thanks for the CC0 work. Felix Reiseberg: design direction throughout the build.
const CC_BY={"2.0":"https://creativecommons.org/licenses/by/2.0/","4.0":"https://creativecommons.org/licenses/by/4.0/"}, FS="https://freesound.org/people/";
const CREDITS=[
  ["Berlin Skyline","Billie Grace Ward",null,"https://commons.wikimedia.org/wiki/File:Berin_Skyline_(39941687570).jpg","2.0"],
  ["Rain on the sill","YleArkisto",FS+"YleArkisto/",FS+"YleArkisto/sounds/350358/","4.0"],
  ["Wet traffic","klankbeeld",FS+"klankbeeld/",FS+"klankbeeld/sounds/174242/","4.0"],
  ["City hum","klankbeeld",FS+"klankbeeld/",FS+"klankbeeld/sounds/219877/","4.0"],
  ["VCR eject","magedu",FS+"magedu/",FS+"magedu/sounds/267832/","4.0"],
];
const CC0=[["SignatureSoundsOrg","869851"],["photogtony","242008"],["qubodup","737955"],["matrixx2k","745241"],["Sanderboah","838726"],["Fission9","693859"],["Warrick_Lendon","542635"],["nodzSound","506536"]];
// Special thanks — people who shaped this room with their direction and feedback
const FELIX={name:"Felix Reiseberg",url:"https://github.com/felixrieseberg",role:"Design direction, UX feedback, and loading screen concept"};
const extLink=(u,t)=>`<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`;
// On a desktop the card from the card file floats up with the credits typed on it; the sheet's HTML stays in the page, out of
// sight, for keyboards and screen readers, and the link the keys are on is marked on the card
function showCredits(){
  openSheet("credits","Credits",`<ul class="cred">${CREDITS.map(([t,a,au,u,v])=>`<li>${extLink(u,t)} · ${au?extLink(au,a):esc(a)} · ${extLink(CC_BY[v],"CC BY "+v)}, adapted</li>`).join("")}</ul>`+
    `<p class="cred0">CC0, with thanks: sounds by ${CC0.map(([a,n])=>extLink(`${FS}${a}/sounds/${n}/`,a)).join(", ")}; furniture and props from ${extLink("https://polyhaven.com/models","Poly Haven")}.</p>`+
    `<p class="cred0 cred-thanks">Special thanks: ${extLink(FELIX.url,FELIX.name)} — ${esc(FELIX.role)}.</p>`);
  if(credOn()){ document.body.classList.add("credcard"); credits.lift();
    $("#p-body").querySelectorAll("a").forEach((a,i)=>{ a.onfocus=()=>credits.focus(i); a.onblur=()=>credits.focus(-1); }); }
  live("Credits");
}
// a click on the floating card: a title, author or licence opens (as the visitor's own click, in a new tab); the rest of it
// puts the card back
function credClick(h){
  if(!h||h.kind!=="link") return closeSheet();
  click("button"); if(!/^https:\/\//.test(h.url)) return;
  const a=document.createElement("a"); a.href=h.url; a.target="_blank"; a.rel="noopener"; a.hidden=true; document.body.append(a); a.click(); a.remove();
}
$("#credits").onclick=e=>{ e.stopPropagation(); click("button"); if(state.sheet==="credits") return closeSheet(); showCredits(); };
$("#p-close").onclick=()=>{ click("button"); if(state.sheet) return closeSheet(); pressAnim(buttons[0]); go("home"); };


// ======================================================================= tapes and the VCR
// three.js coordinates of the cassette slot, just in front of the VCR's flap
const SLOT=new THREE.Vector3(-0.07,0.828,0.235);
let tapeAnim=null, queue=[];
function chooseTape(i){
  if(state.page!=="work") go("work");
  cycOff();   // a tape picked: the tapes' turns end (tapecycle)
  const same=i===state.tape&&state.tapeState!=="ejecting";
  if(tapeAnim){ queue=same?[]:[i]; return; }   // the last pick wins; picking the tape that is going in again cancels a pick
  if(same){ if(state.tapeState==="stopped") resumeTape(); return; }
  if(state.tape>=0) return eject(()=>insert(i));
  insert(i);
}
function resumeTape(){
  if(state.tape<0||tapeAnim||state.tapeState==="loading") return;
  motor(); if(state.tapeState!=="playing"){ state.tapeState="playing"; homeCarry=false; if(chIdx!==state.tape) chStart(state.tape); }
  if(state.page!=="work") go("work"); cycOff(); chPause(false); drawVFD(); refreshWork();
}
// ---- the shelf: eleven tapes in two stacks, five companies on the left and six projects on the right, each read top to bottom.
// Pulling a cassette out lets the ones above it settle; a tape coming back from the VCR goes on top of its stack.
const stacks=[], settles=[];
const SHELF=[JOBS,TAPES.length-JOBS];
function setupShelf(tapeParts){
  const found=[];
  for(const parts of tapeParts.values()){
    const body=parts.find(p=>/^tape_\d+$/.test(p.name))||parts[0]; body.updateWorldMatrix(true,false);
    const g=new THREE.Group(); body.getWorldPosition(g.position); body.getWorldQuaternion(g.quaternion); scene.add(g); g.updateMatrixWorld();
    parts.forEach(p=>g.attach(p));
    let st=found.find(q=>Math.hypot(q.x-g.position.x,q.z-g.position.z)<.06);
    if(!st){ st={x:g.position.x,z:g.position.z,tapes:[]}; found.push(st); }
    st.tapes.push(g);
  }
  found.sort((a,b)=>a.x-b.x);
  // a scene baked with the older nine-cassette layout keeps the bottom of each stack, so every baked contact shadow keeps its tape
  found.forEach((st,k)=>{ st.tapes.sort((a,b)=>a.position.y-b.position.y);
    // a stack the scene has too few cassettes for (Microsoft made the companies five, Felix 03:20Z; the scene has four) gets copies
    // of its top one, a cassette higher each and turned a little, until a scene pass adds them in Blender (they carry its light)
    while(found.length>1&&st.tapes.length>=2&&st.tapes.length<(SHELF[k]??0)){ const n=st.tapes.length, top=st.tapes[n-1], c=top.clone(true);
      c.position.y+=top.position.y-st.tapes[n-2].position.y; c.position.x+=.003; c.position.z-=.002; c.rotateY(n%2?.045:-.045);
      scene.add(c); c.updateMatrixWorld(true); st.tapes.push(c); }
    const keep=found.length===1?CH_IDS.length:Math.min(st.tapes.length,SHELF[k]??0);
    st.tapes.slice(keep).forEach(g=>scene.remove(g)); st.tapes=st.tapes.slice(0,keep);
    st.slots=st.tapes.map(g=>({p:g.position.clone(),q:g.quaternion.clone()}));
    if(keep) stacks.push(st); });
  let i=0;
  stacks.forEach(st=>{ for(const g of [...st.tapes].reverse()){
    if(i>=CH_IDS.length){ scene.remove(g); st.tapes.splice(st.tapes.indexOf(g),1); continue; }
    g.userData={home:g.position.clone(),homeQ:g.quaternion.clone(),i,stack:st}; tapeGroups[i]=g;
    const lab="TAPE · "+TAPES[i].t.toUpperCase(), idx=i;
    g.traverse(p=>{ if(p.isMesh) interact.set(p,{kind:"tape",i:idx,label:lab}); }); i++; } });
}
function leaveStack(g,delay){
  const st=g.userData.stack; if(!st) return; const L=st.tapes.indexOf(g); if(L<0) return;
  st.tapes.splice(L,1);
  for(let k=L;k<st.tapes.length;k++){ const t=st.tapes[k], sl=st.slots[k];
    settles.push({g:t,p0:t.position.clone(),q0:t.quaternion.clone(),p1:sl.p,q1:sl.q,t:-(delay+(k-L)*.035)/.2});
    t.userData.home=sl.p.clone(); t.userData.homeQ=sl.q.clone(); }
}
function topOfStack(g){ const st=g.userData.stack; if(!st) return; const sl=st.slots[st.tapes.length]; if(sl){ g.userData.home=sl.p.clone(); g.userData.homeQ=sl.q.clone(); } }
function stepSettles(dt){
  for(let k=settles.length-1;k>=0;k--){ const o=settles[k]; o.t+=dt/.2; if(o.t<=0) continue;
    const e=Math.min(1,o.t)**2;   // it drops, then stops dead on the cassette below
    o.g.position.lerpVectors(o.p0,o.p1,e); o.g.quaternion.slerpQuaternions(o.q0,o.q1,e);
    if(o.t>=1){ settles.splice(k,1); click("settle",.3); } }
  if(settles.length) shadowsDirty=2;
}
// Tapes travel on a curve: off the stack toward you, up, round in front of the monitor (never through it), then into the slot.
const IN_Z=.075, FRONT_Z=.31;
function tapePath(home,q){
  const front=SLOT.clone().setZ(FRONT_Z);
  const out=home.clone().add(new THREE.Vector3(0,.004,.11).applyQuaternion(q));
  const up=out.clone().add(new THREE.Vector3(0,.07,.05));
  const pre=new THREE.Vector3((home.x+SLOT.x)/2,Math.max(home.y+.08,SLOT.y+.05),FRONT_Z+.06);
  return new THREE.CatmullRomCurve3([home.clone(),out,up,pre,front],false,"centripetal");
}
function insert(i){
  const g=tapeGroups[i]; if(!g) return;
  click("tape",.3); state.tape=i; state.tapeState="loading"; drawVFD(); refreshWork();
  const fromQ=g.quaternion.clone(), path=tapePath(g.userData.home,g.userData.homeQ), front=path.getPoint(1), inside=front.clone().setZ(IN_Z);
  leaveStack(g,.26); if(vcr) vcr.insert(g);
  tapeAnim={t:0,dur:1.05,step(k){
    if(k<.66){ const e=ease(k/.66); g.position.copy(path.getPoint(e)); g.quaternion.slerpQuaternions(fromQ,new THREE.Quaternion(),Math.min(1,Math.max(0,e*1.7-.35))); }
    else { const e=ease((k-.66)/.34); g.quaternion.identity(); g.position.lerpVectors(front,inside,e); }
  },done(){ if(vcr) vcr.stow(g); else g.visible=false; if(!A.fx.vcr_insert){ click("clunk",-.05); motor(.8); }
    if(state.page==="work"&&padOn()&&workHidden&&!zoomed&&!PHONE()) workCard(true);   // the tape's in: the notepad floats up with its notes
    setTimeout(()=>{ if(state.tape!==i||state.tapeState!=="loading") return;   // ejected, stopped or swapped while it threaded
      state.tapeState="playing"; homeCarry=false; chStart(i); drawVFD(); live("Now playing: "+tapeInfo(i).t);
      if(tvPage()!=="work"){ chPause(true); return; }   // you left Work for the TV's other pages while it loaded: it waits there, paused
      pageT=performance.now(); state.glitch=.9; staticBurst(.2,.2); refreshWork(); },220); }};
  if(A.fx.vcr_insert) setTimeout(()=>sample("vcr_insert",{gain:1,pan:-.05}),620); else if(!vcr) setTimeout(()=>click("door",-.05),660);
}
function eject(then){
  const i=state.tape; const g=tapeGroups[i]; if(!g){ state.tape=-1; return then&&then(); }
  chStop(); if(!sample("vcr_eject",{gain:1,pan:-.05})){ motor(.5); click("relay",-.05); } state.tapeState="ejecting"; drawVFD(); refreshWork();
  topOfStack(g);
  const path=tapePath(g.userData.home,g.userData.homeQ), front=path.getPoint(1), inside=front.clone().setZ(IN_Z);
  g.visible=true; g.position.copy(inside); g.quaternion.identity();
  const lead=vcr?vcr.eject(g):0;   // the flap swings up first: the cassette waits inside that long
  tapeAnim={t:0,dur:.9+lead,step(k){ k=Math.max(0,(k*(.9+lead)-lead)/.9);
    if(k<.28){ const e=ease(k/.28); g.position.lerpVectors(inside,front,e); }
    else { const e=ease((k-.28)/.72); g.position.copy(path.getPoint(1-e)); g.quaternion.slerpQuaternions(new THREE.Quaternion(),g.userData.homeQ,Math.min(1,Math.max(0,e*1.7-.7))); }
  },done(){ if(vcr) vcr.release(); const st=g.userData.stack; if(st&&!st.tapes.includes(g)) st.tapes.push(g);
    g.position.copy(g.userData.home); g.quaternion.copy(g.userData.homeQ);
    chStop(); click("tape",.3); state.tape=-1; state.tapeState="none"; drawVFD(); refreshWork(); then&&then(); }};
}
function ease(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}

// ======================================================================= power, buttons, knobs
function setPower(on){
  if(on===!!state.power) return;
  state.power=on?1:0; state.powerT=performance.now();
  powerLed&&(powerLed.material.emissive.set(on?"#46ff7a":"#000"),powerLed.material.emissiveIntensity=on?4:0,powerLed.material.color.set(on?"#9dffb5":"#301010"));
  if(on) degauss(); else powerOffSound();
  setLeds();
  audioLevels();
}
// the monitor's six buttons: its three inputs (the pages on this screen), then three of a studio monitor's picture checks,
// each on until pressed again, its LED lit amber: UNDERSCAN shows the whole raster, H/V DELAY the blanking between lines
// and fields, BLUE ONLY the blue signal alone
function tvButton(i){
  pressAnim(buttons[i]); click("button",-.05);
  if(i<3) return go(TV_BTN[i]);
  if(!state.power) return;   // the picture checks act on a running picture
  const k=TV_BTN[i]; MON[k]=!MON[k]; if(k!=="underscan") state.glitch=Math.max(state.glitch,.3);
  setLeds(); live(TV_LABEL[i]+(MON[k]?" on":" off"));
}
function setLeds(){
  leds.forEach((l,j)=>{ if(!l) return; const on=!!state.power&&(j<3?TV_BTN[j]===tvPage():!!MON[TV_BTN[j]]), amb=j>=3;
    l.material.emissive.set(on?(amb?"#ffa42e":"#46ff7a"):"#000"); l.material.emissiveIntensity=on?5:0; l.material.color.set(on?(amb?"#ffd79a":"#9dffb5"):"#301010"); });
}
function pressAnim(o,depth=.0022){ if(o===buttons[0]) CYC.press=performance.now();   // (HOME on the TV, for the tapes' turns: tapecycle)
  if(!o||!o.userData.home) return; o.userData.press=performance.now(); o.userData.depth=depth; }
function setKnob(i,v){
  const k=knobs[i]; if(!k) return; v=Math.min(1,Math.max(0,v));
  if(i===0){state.volume=v; state.volShow=performance.now()+1800; audioLevels();}
  if(i===1) state.tracking=v; if(i===2) state.chroma=v;
  k.rotation.copy(k.userData.base||k.rotation); k.rotateY((.5-v)*Math.PI*1.5);
}
function act(hit){
  const info=interact.get(hit); if(!info) return; const heard=!!A.on; gesture();
  if(info.kind==="btn") tvButton(info.i);
  else if(info.kind==="cd"){ if(cd?.near) cd.act(hit,heard); else if(cd) cdFocus();
    else { if(heard&&music.playing) music.pause(); else { if(!A.on) setSound(true); music.play(); } click("switch",-.35); } }   // (no player in the scene: a click plays and pauses)
  else if(info.kind==="coffee"){ coffee?.sip(); if(!tip.hidden) tip.textContent=info.label; }   // a sip (the tip says when it's empty)
  else if(info.kind==="clock"){ clock?.toggle(); if(clock&&!tip.hidden) tip.textContent=clock.tip(); }   // the battery out, or back in (the tip says which is next)
  else if(info.kind==="calc"){ if(calc&&!calc.up) calc.lift(); }   // the calculator: up it comes
  else if(info.kind==="phone"){ click("button",.05); go("online"); }   // the line the PC's modem dials out on
  else if(info.kind==="pc"){ if(atPC(state.page)||PC.zoom) pcTap(pickUV); else pcVisit(); }
  else if(info.kind==="pcmon"){ pressAnim(hit,.0025); click("button",-.45); pcMonitor(!PC.mon.on); if(!tip.hidden) tip.textContent=PC.mon.on?"MONITOR OFF":"MONITOR ON"; }
  else if(info.kind==="power"){ pressAnim(buttons.power,.003); setPower(!state.power); }
  else if(info.kind==="window"){ if(WIN.zoom) toggleZoom(); else winFocus(); }
  else if(info.kind==="lamp") setDesk(!DESK.on);
  else if(info.kind==="floor") setFloor(!FLOOR.on);
  else if(info.kind==="tape"){ chooseTape(info.i); }
  else if(info.kind==="rolodex"||info.kind==="credits"){ if(state.sheet!=="credits") showCredits(); }   // the card file: its open card comes up
  else if(info.kind==="notepad"){ if(state.page!=="work") go("work"); else if(workHidden) workCard(true); }   // the pad on the desk: up it comes
  else if(info.kind==="eject"){ if(state.tape>=0){ cycOff(); click("button"); if(tapeAnim) queue=["eject"]; else eject(); } }
  else if(info.kind==="remote"){ click("rubber",.15); if(remoteIR){remoteIR.material.emissive.set("#ff3b2a");remoteIR.material.emissiveIntensity=3;setTimeout(()=>remoteIR.material.emissiveIntensity=0,160);}
    setTimeout(()=>{ if(!state.power) return setPower(true); go(TV_BTN[(TV_BTN.indexOf(tvPage())+1)%3]); },90); }   // the TV's next input
  else if(info.kind==="vcr"){ pressAnim(hit,.0015); click("button",.1);
    if(info.i===0){ if(state.tape<0) chooseTape(0); else resumeTape(); cycOff(); }
    else if(info.i===1){ cycOff(); if(state.tape>=0&&state.tapeState!=="ejecting"&&state.tapeState!=="stopped"){ state.tapeState="stopped"; motor(.5); chPause(true); refreshWork(); } }
    else if(info.i===2){ if(!(state.tapeState==="playing"&&chInput({type:"prev"}))) chooseTape(((state.tape<0?0:state.tape)+TAPES.length-1)%TAPES.length); cycOff(true); }   // (a scene skipped: that tape stays on)
    else if(info.i===3){ if(!(state.tapeState==="playing"&&chInput({type:"next"}))) chooseTape(((state.tape<0?-1:state.tape)+1)%TAPES.length); cycOff(true); }
    else if(info.i===4){ vcrLed&&(vcrLed.material.emissive.set("#ff2a1a"),vcrLed.material.emissiveIntensity=4); setTimeout(()=>vcrLed&&(vcrLed.material.emissiveIntensity=0),1600); }
    drawVFD(); }
  else if(info.kind==="knob"){ const v=[state.volume,state.tracking,state.chroma][info.i]; setKnob(info.i,(v+.2)%1.05); click("tick"); }
  else if(info.kind==="screen"){ if(state.page==="posts"){ const r=teletextRow(pickUV); if(r>=0&&r<POSTS.length) return openPost(r);
      const fk=fastextKey(pickUV); if(fk){ click("button"); return go(fk); }
      if(ttxPageCell(pickUV)){ click("button"); return ttxFlip(1); } }
    if(zoomed&&state.page==="work"&&state.tapeState==="playing"&&chInput({type:"click"})) return; toggleZoom(); }
}
let fly=null, zoomed=false;
// the move to the old PC takes its time: longer, and on a sine curve with no rush in the middle (the others: 1.2 s, cubic)
const PC_FLY=1.9, PC_ARC=3;
function flyTo({tgt,pos},instant,dur,via){
  $("#tip").hidden=true;   // whatever the pointer was over has moved away
  if(instant||reduce){ controls.target.copy(tgt); camera.position.copy(pos); fly=null; pageLimits(); return; }
  // start from where the view is drawn, which the room and the furniture may have moved off the orbit
  const from=camera.position.clone(); if(!fly) keepInRoom(from,controls.target);
  looseLimits(); if(cd&&(cd.near||cdLeft)) spanLimits([from,controls.target],[pos,tgt]); cdLeft=false;   // to or from the CD player
  fly={t:0,fromT:controls.target.clone(),fromP:from,toT:tgt,toP:pos,dur:dur||1.2,soft:!!dur,via:via||null};
}
// To the old PC from a view that doesn't show it: the camera first steps back from the desk and turns to the chest of drawers,
// so the PC reads as a computer standing in the room's corner, then pushes in to its glass. From a view that shows the PC
// already, it goes straight in.
function pcFly(fr,instant){
  if(instant||reduce||!PC.mesh) return flyTo(fr,instant,PC_FLY);
  const u=pcUnit(), c=u.getCenter(new THREE.Vector3()).project(view);
  if(c.z<1&&Math.abs(c.x)<.75&&Math.abs(c.y)<.8) return flyTo(fr,false,PC_FLY);
  // the overview: the monitor and the case in the middle of the picture, from a step behind where the desk view stands, at
  // standing eye height and a little off the glass's axis toward the room, so the chair and the chest stand in the picture too
  const tgt=u.getCenter(new THREE.Vector3()), pos=tgt.clone().addScaledVector(PC_OVER,2.3);
  flyTo(fr,false,PC_ARC,{tgt,pos});
}
const PC_OVER=new THREE.Vector3(.672,.236,.703).normalize();
let pcUnitBox=null;
function pcUnit(){ if(pcUnitBox) return pcUnitBox; const b=new THREE.Box3();
  for(const n of ["retro_monitor","retro_body"]){ const o=scene.getObjectByName(n); if(o) b.expandByObject(o); }
  return pcUnitBox=b.isEmpty()?new THREE.Box3().setFromObject(PC.mesh):b; }
// a flight through a waypoint: two moves on one clock that overlap, so the path bends through the turn without stopping; the
// look turns first, as a head does. The push in rises a little on its way (6 cm at most), well clear of the desk chair's back.
// the push-in lifts 11 cm over the desk chair: the lift peaks 70% of the way in, where it passes over the chair's back
const PC_LIFT=.11, PC_LIFT_K=Math.log(.5)/Math.log(.7);
const sineIn=(a,b,x)=>x<=a?0:x>=b?1:.5-.5*Math.cos(Math.PI*(x-a)/(b-a)), _fd=new THREE.Vector3();
function flyVia(f){ const v=f.via, t=f.t, e2=sineIn(.34,1,t);
  camera.position.copy(f.fromP).addScaledVector(_fd.subVectors(v.pos,f.fromP),sineIn(0,.48,t)).addScaledVector(_fd.subVectors(f.toP,v.pos),e2);
  camera.position.y+=PC_LIFT*Math.sin(Math.PI*Math.pow(e2,PC_LIFT_K));
  controls.target.copy(f.fromT).addScaledVector(_fd.subVectors(v.tgt,f.fromT),sineIn(0,.42,t)).addScaledVector(_fd.subVectors(f.toT,v.tgt),sineIn(.36,1,t)); }
// a close-up (the TV's glass, or the PC's while typing) puts the card away; the round button or Z brings it back
// the notepad goes down where it is, with no flight back to Work's view first (a close-up, or C and #options on the way to the PC)
function padAway(){ calc?.lower(); if(!padUp()) return; workHidden=true; notepad.lower(); document.body.classList.remove("paneled"); setHint(); }
function setZoomed(v){ zoomed=v; if(v) calc?.lower(); if(v) padAway();   // a close-up puts the notepad down
  if(!v&&WIN.zoom) winAt(false); if(!v) cdAt(false); document.body.classList.toggle("zoomed",v); unzoomLabel(); }
// the buttons name their keys, except on a touch screen, where there are none
function keyHint(k){ return matchMedia("(hover: none) and (pointer: coarse)").matches?"":" · "+k; }
// the pill: Esc goes back to the desk from the PC and every close-up (the TV's too), and puts the notepad down
function unzoomLabel(){ const b=document.body.classList, near=PC.zoom||zoomed, pad=!near&&b.contains("padnote")&&b.contains("paneled");
  $("#unzoom").textContent=(!near&&calc?.up?"PUT DOWN CALCULATOR":pad?"PUT DOWN NOTEPAD":"BACK TO THE DESK")+keyHint("ESC"); }
// at the glass the street comes up a little: the window's two panes still take the top off it
function deskMaps(){
  if(DESK.maps) return DESK.maps;
  const load=u=>new Promise(r=>texL.load(u,r,undefined,()=>r(null)));
  new THREE.TextureLoader().load(SCENE_BASE+"tex/env_off.jpg",tx=>{ tx.mapping=THREE.EquirectangularReflectionMapping; tx.colorSpace=THREE.SRGBColorSpace;
    const pm=new THREE.PMREMGenerator(renderer); DESK.env.off=pm.fromEquirectangular(tx).texture; DESK.env.offTx=tx; pm.dispose();
    if(DESK.k<.5) scene.environment=DESK.env.off; });
  return DESK.maps=bakeReady.then(()=>Promise.all(Object.entries(BAKE).filter(([,b])=>b.sD).map(([k,b])=>load(`${SCENE_BASE}bake/${k}_irrD.jpg`).then(t=>{
    if(!t) return false;
    t.channel=1; t.flipY=false; t.colorSpace=THREE.NoColorSpace; t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.needsUpdate=true;
    b.uD.value=t; b.usD.value=b.sD; bakeIn(t); return true; })))).then(ok=>ok.length>0&&ok.every(Boolean));
}
// the room goes dark only once its lamp-off light is here; if that fails to load, the lamp stays on
function setDesk(on){
  DESK.on=on; click("switch",-.45);
  if(on){ DESK.target=1; live("The desk lamp is on"); return; }
  deskMaps().then(ok=>{ if(!ok){ DESK.maps=null; DESK.on=true; return; } if(DESK.on) return;   /* switched back on while the maps loaded */ DESK.target=0; live("The desk lamp is off"); });
}
// the floor lamp, the same way (instant: no fade, for the tests' pictures)
function setFloor(on,instant=false){
  FLOOR.on=on; if(!instant) click("switch",.6);
  if(on){ FLOOR.target=1; if(instant) FLOOR.k=FLOOR.eye=1; live("The floor lamp is on"); return; }
  deskMaps().then(ok=>{ if(!ok){ DESK.maps=null; FLOOR.on=true; return; } if(FLOOR.on) return; FLOOR.target=0; if(instant) FLOOR.k=FLOOR.eye=0; live("The floor lamp is off"); });
}
function lampFrame(dt){
  // the filament: lights in about 70 ms, drops to a glow in about a tenth of a second and fades out from there; the
  // eye then takes a few seconds to open up to the dark room (and is dazzled for a moment when the light comes back)
  for(const L of [DESK,FLOOR]){
    if(L.k!==L.target) L.k=L.target>L.k?Math.min(1,L.k+dt/.07):Math.max(0,L.k-dt*(L.k>.3?6:2));
    L.eye+=(L.k-L.eye)*Math.min(1,dt*(L.k>L.eye?1.4:.45)); }
  const k=DESK.k, f=FLOOR.k;
  if(LAMP_K.value===k&&FLOOR_K.value===f&&DESK.eyeSet===DESK.eye&&FLOOR.eyeSet===FLOOR.eye) return; DESK.eyeSet=DESK.eye; FLOOR.eyeSet=FLOOR.eye;
  LAMP_K.value=k; lampSpot.intensity=3.4*k; lampFill.intensity=.5*k; lampSpot.shadow.autoUpdate=k>0;
  if(DESK.bulb){ DESK.bulb.emissiveIntensity=4*k*k; DESK.bulb.emissive.setRGB(1,.35+.42*k,.1+.39*k); DESK.bulb.color.setScalar(.25+.75*k); }
  // the floor lamp: its light, its bulb, and a shade that glows while it's on and is plain cream cloth in the dark once it's off
  FLOOR_K.value=f; floorLamp.intensity=1.6*f;
  if(FLOOR.bulb){ FLOOR.bulb.emissiveIntensity=4*f*f; FLOOR.bulb.emissive.setRGB(1,.35+.42*f,.1+.39*f); FLOOR.bulb.color.setScalar(.25+.75*f); }
  for(const m of FLOOR.shades){ m.emissiveIntensity=.62*f*f; m.emissive.setRGB(1,.25+.33*f,.06+.19*f); m.color.lerpColors(SHADE_OFF,SHADE_ON,f); m.envMapIntensity=.35+.65*f; }
  const dk=k<.5&&DESK.env.off?"off":"on", env=f<.5&&floorEnv(dk)||DESK.env[dk]; if(env&&scene.environment!==env) scene.environment=env;
  renderer.toneMappingExposure=1.8*(1+.38*(1-DESK.eye))*(1+.06*(1-FLOOR.eye));
}
const SHADE_ON=new THREE.Color("#1a140c"), SHADE_OFF=new THREE.Color("#b3a894");
// The panoramas were shot with the floor lamp on. With it off, the reflections take a copy (half size) with its light taken
// out direction by direction: ENV_FLOOR is the room as the page draws it seen from PROBE, lamp off / on, over 12° cones on a
// 32x16 grid laid out like the panorama (tv/envmap28.cjs), with the desk lamp on and then off. Made the first time it's needed.
const ENV_FLOOR=(()=>{ const s=atob("U1ZYXF5hY2doaGdlY15bV1RQTkpJR0dGR0hJSktNT1FSWF1gZmx1eXx7enh0bmdbTTwuJSAfISYsMjg9QURITV1hYGJna2loaWVkZ4anp5dlNBgOCQkNFR8oMDc8QUlSkJSQfnGAhHhiUHyWoLGypWEoEwsGBQcMFSAsMkRYboGcn5aHhqClkHqTtbeumJF8QyAcFRAHBAgOGytAU2V5joaRkpCQr7eqsbCxuKja77hFGRQgGREIER4iMkBTW2NzYXOHkYuotbK5p6K5v+328KkwHxkoIBseIzAzOj1DRVBMVV9ta4iVkpuKjZyh2ev62mQ4HRUXHSMtMjIxLzw/REpRU1ZWZ2liZGhva3GtyOfdY0MXEA4cIjAzKysuNztBSU9SVVVcX1hZWl1fZZCpu7NIKhwVGCQrMTMsMTI4O0FJTlFVVFRSUlNTV1xhgKepfDIdHBoXHCMvODU4OTo9Q0lNUVhcV1BMUFRZYXaVl4FYMB8YEAoKDBMfMTs9O0BESU9aYGZjXFpcX2NobXFnUjklGRAJBgYGBgwYKzo/QUNRWF9lY2ViYmJhWEs6LiUeGhUSEA8KCQgICQ0XJDVDSjxGTVBTVVRRSkI4LyUeGRYXFhQTEhAPDgwLDA8TGiQvHSAiJScmJSUjIR8dHBoZGBYVFRQUExIREBISExQWGBobHR8iJSgrLzAwLyspIyEdGhgWFBMTExITExQUFRYXGRcaHSEqNENMT05LRDosIhsWEQ0KCQgJCgwNDhARExQWHSAiJSouNj9KSD8wJSEeGhQOCAUEBAUHCgwOEBMVFhkxNTc4ODo6OTYtKyslGxQRDAcEAwICAwUIDBAQFBwkKjs9Pj47ODo6NzQ6PTQlDgwGBAQEBAIBBAcLEhohKTA3Ojw/QDk3Ojs5ODw8QFR/VSEHAwcGBgMHDxcjJSwzNTc5PD9AOjk9PTw5OTRMqt3elR8SCQsVGBgXIykoJy8yNjg7P0A6Oj4+PTcwLkWb+/bbXi0SChMdHSIqJiMlLjI1ODs+QDk6PT08NjAuO3nb//9cOBAJChsdKC8oIyUuMTU4Oz4/Ozk8PDs4NDE4TZnN00MiFA4YKiswMywmJy8yNTg6PT89PDo6OTc0MjhCYGxKHRQREhYaICszLyoqMDM1ODo8Pj47OTg3NjU0NTgsGxIOCwkHBggNERorMzQzNTc5Ojs8PTw8Ozo5ODYvHhEMCgkHBQIDBQgKDBknMzg5OTk5OTo7PDw8OzkyJxgQCwkIBwYEBAQFBwkKDBMgKzU4JCktLi8vLSsmHxgSDgsKCAgHBwYGBgcICQoLDA8TGB4NDg4PDw4NDAsKCgkICAgICAgHCAgICAgICAkJCgoLDA=="), u=Uint8Array.from(s,c=>c.charCodeAt(0));
  return ["on","off"].map((k,i)=>{ const t=new THREE.DataTexture(u.subarray(i*512,i*512+512),32,16,THREE.RedFormat,THREE.UnsignedByteType);
    t.magFilter=t.minFilter=THREE.LinearFilter; t.wrapS=THREE.RepeatWrapping; t.needsUpdate=true; return t; }); })();
function floorEnv(key){
  const E=DESK.env, tx=E[key+"Tx"]; if(E[key+"F"]||!tx) return E[key+"F"]||null;
  const rt=new THREE.WebGLRenderTarget(tx.image.width/2,tx.image.height/2,{type:THREE.HalfFloatType,depthBuffer:false}), cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{T:{value:tx},R:{value:ENV_FLOOR[key==="on"?0:1]}},depthTest:false,depthWrite:false,
    vertexShader:"varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader:"uniform sampler2D T,R;varying vec2 v;void main(){gl_FragColor=vec4(texture2D(T,v).rgb*texture2D(R,v).r,1.);}"}));
  const prev=renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(q,cam); renderer.setRenderTarget(prev);
  const pm=new THREE.PMREMGenerator(renderer); E[key+"F"]=pm.fromEquirectangular(rt.texture).texture; pm.dispose(); rt.dispose(); q.geometry.dispose(); q.material.dispose();
  return E[key+"F"];
}
function winAt(v){ WIN.zoom=v; document.body.classList.toggle("win",v); if(A.outside) A.outside.gain.setTargetAtTime(v?.85:.55,A.ctx.currentTime,.5); live(v?"Looking out of the window":""); }
function winFocus(){ if(PC.zoom) pcExit(); cdAt(false); winAt(true); setZoomed(true); flyTo(winFrame()); }
// At the CD player (cdplayer/cdplayer.js): the camera looks down at it from its front right, its buttons and wheel work, the LCD
// lights up, and Esc, Z, the round button or a click beside it goes back to the desk.
function cdAt(v){ if(!cd||cd.near===v) return; cd.setNear(v); if(!v) cdLeft=true; document.body.classList.toggle("cdz",v); setHint(); unzoomLabel(); live(v?"The CD player: "+cd.title():""); }
function cdFocus(){ if(!cd) return; if(PC.zoom) pcExit(); if(WIN.zoom) winAt(false); cdAt(true); setZoomed(true); flyTo(cd.shot()); }
// The close-up looks down more steeply and stands nearer than any other view, outside looseLimits: a flight there or back
// widens the orbit's limits to take in both its ends, or the controls would pin the camera to them on the way and it would
// jump at the end (or, leaving, at the start).
function spanLimits(...ends){ for(const [p,t] of ends){ const o=p.clone().sub(t), r=o.length(), phi=Math.acos(THREE.MathUtils.clamp(o.y/r,-1,1)), th=Math.atan2(o.x,o.z);
  controls.minPolarAngle=Math.min(controls.minPolarAngle,phi-.02); controls.maxPolarAngle=Math.max(controls.maxPolarAngle,phi+.02);
  controls.minAzimuthAngle=Math.min(controls.minAzimuthAngle,th-.02); controls.maxAzimuthAngle=Math.max(controls.maxAzimuthAngle,th+.02);
  controls.minDistance=Math.min(controls.minDistance,r*.9); controls.maxDistance=Math.max(controls.maxDistance,r*1.1); } }
function toggleZoom(){ setZoomed(!zoomed); flyTo(zoomed?tvZoomFrame():frameFor(state.page)); }

// ---- picking
const ray=new THREE.Raycaster(); const ptr=new THREE.Vector2(); let down=null, dragKnob=null, cdDrag=false;
const tip=$("#tip");
let pickUV=null;
const occluders=[];
function pick(e){ ptr.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1); ray.setFromCamera(ptr,view);
  // a piece fading out of the view's way (FADES) takes no clicks and hides nothing from them: inside the floor lamp's shade
  // every ray met the shade, so every click went to the lamp
  const gone=FADES.filter(F=>F.a<.99).flatMap(F=>F.parts), keep=o=>!gone.includes(o);
  const h=ray.intersectObjects(gone.length?[...interact.keys()].filter(keep):[...interact.keys()],false)[0]; pickUV=null; if(!h) return null;
  ray.far=h.distance-.002; const blocked=ray.intersectObjects(gone.length?occluders.filter(o=>o.visible&&keep(o)):occluders,false).length>0; ray.far=Infinity;
  if(blocked) return null; pickUV=h.uv||null; return h.object; }
// fingers are wider than a VCR button: a tap that misses looks around it, nearest ring first
function pickNear(e){ let h=pick(e); if(h||e.pointerType==="mouse") return h;
  for(const r of [9,18,27]) for(let k=0;k<8;k++){ const a=k*Math.PI/4; h=pick({clientX:e.clientX+Math.cos(a)*r,clientY:e.clientY+Math.sin(a)*r}); if(h) return h; }
  return null; }
// where on the signal a point of the glass is (screen uv.y=0 is the top), as the monitor shader draws it: the raster's reach (RASTER),
// the whole raster under UNDERSCAN, and under H/V DELAY the picture split around the blanking (null on the blanking)
function sigUV(uv){ if(!uv) return null; const k=1+MONK.us*.13; let x=(uv.x-.5)*MONK.fx*k+.5, y=(.5-uv.y)*MONK.fy*k+.5;   // y up, as the texture
  if(MON.hvdelay){ if(Math.abs(x-.5)>.585||Math.abs(y-.5)>.5425) return null;   // off the raster (underscan)
    const m=(a,n)=>(a%n+n)%n; x=m(x+.585,1.17); y=m(y+.5425,1.085); if(x>1||y>1) return null; }
  return {x,y:1-y}; }
function fastextKey(uv){ const p=sigUV(uv); if(!p) return null; const y=p.y*25; if(y<24||y>=25) return null; return FASTEXT[Math.floor(p.x*4)]||null; }
function ttxPageCell(uv){ const p=sigUV(uv); if(!p) return false; const y=p.y*25, c=p.x*40; return y>=5&&y<6&&c>=30; }
function ttxFlip(d){ const pages=Math.max(1,Math.ceil(POSTS.length/TTX_PER())); postSub=(postSub+d+pages)%pages; ttxSubT=performance.now(); }
// what the pointer is over on the Posts screen: a post's row, a Fastext key, or the page counter
function ttxAt(uv){ const r=teletextRow(uv); if(r>=0&&r<POSTS.length) return {row:r,tip:"READ POST"};
  const fk=fastextKey(uv); if(fk) return {row:-1,tip:fk.toUpperCase()}; return ttxPageCell(uv)?{row:-1,tip:"NEXT PAGE"}:null; }
// ↑ ↓ walk the posts (focus moves through the card's hidden rows, so screen readers follow), ← → turn the page
function ttxKey(k){
  const rows=[...document.querySelectorAll("#p-body a.row[data-post]")]; if(!rows.length) return;
  const per=TTX_PER(), pages=Math.max(1,Math.ceil(POSTS.length/per)), cur=ttxFocus;
  if(k==="arrowleft"||k==="arrowright"){ const d=k==="arrowright"?1:-1; if(cur<0) return ttxFlip(d);
    const s=(Math.floor(cur/per)+d+pages)%pages; return rows[Math.min(rows.length-1,s*per+cur%per)]?.focus({preventScroll:true}); }
  const j=cur<0?postSub*per:Math.max(0,Math.min(rows.length-1,cur+(k==="arrowdown"?1:-1)));
  rows[j]?.focus({preventScroll:true});
}
function teletextRow(uv){ const p=sigUV(uv); if(!p) return -1; const y=p.y*25,   /* 25 teletext rows */ per=TTX_PER(), r=Math.floor((y-7)/(per<8?4:2)); return y>=7&&r>=0&&r<per?postSub*per+r:-1; }
let hoverEv=null;
canvas.addEventListener("pointermove",e=>{
  if(PC.press===e.pointerId){ const uv=pcRayUV(e); if(uv&&PC.inst) PC.inst.input({type:"pointermove",buttons:e.buttons,...pcUV(uv)}); return; }
  if(cdDrag){ cd.drag(e); return; }
  if(dragKnob){ const dy=(dragKnob.y-e.clientY)/160; setKnob(dragKnob.i,dragKnob.v+dy);
    const q=Math.round([state.volume,state.tracking,state.chroma][dragKnob.i]*20); if(q!==dragKnob.q){dragKnob.q=q;click("tick");} return; }
  if(e.pointerType!=="mouse") return;
  if(!hoverEv) requestAnimationFrame(()=>{ const ev=hoverEv; hoverEv=null; if(ev&&!DBG.on&&!fly) hover(ev); });   // at most one pick per frame, none mid-flight
  hoverEv=e;
});
function hover(e){
  const h=pick(e); canvas.style.cursor=h?"pointer":"grab";
  if(!h||interact.get(h)?.kind!=="notepad") notepad?.leave();
  if(!h||interact.get(h)?.kind!=="credits") credits?.leave();
  const onPC=!!h&&h===PC.mesh&&!!PC.inst&&PC.zoom, tt=h&&state.page==="posts"&&interact.get(h)?.kind==="screen"?ttxAt(pickUV):null;
  ttxHover=tt?tt.row:-1;
  if(onPC){ if(!PC.inst.input({type:"pointermove",...pcUV(pickUV)})&&PC.focused) canvas.style.cursor="text"; } else if(PC.hover&&PC.inst) PC.inst.input({type:"pointerleave"});
  PC.hover=onPC;
  if(h&&!(onPC&&PC.focused)){ const info=interact.get(h); tip.hidden=false; tip.textContent=padUp()&&info.kind!=="notepad"?"PUT DOWN NOTEPAD":calc?.up&&info.kind!=="calc"?"PUT DOWN CALCULATOR":credUp()&&info.kind!=="credits"&&info.kind!=="rolodex"?"PUT BACK CREDITS":tt?tt.tip:info.kind==="window"&&WIN.zoom?"BACK TO THE DESK":info.kind==="pc"&&PC.zoom?"CLICK TO TYPE":info.kind==="lamp"?(DESK.on?"SWITCH OFF":"SWITCH ON"):info.kind==="floor"?(FLOOR.on?"SWITCH OFF":"SWITCH ON"):info.kind==="pcmon"?(PC.mon.on?"MONITOR OFF":"MONITOR ON"):info.kind==="calc"&&calc?calc.tip(h):info.kind==="clock"&&clock?clock.tip():info.kind==="cd"?(cd?cd.tip(h):music.playing?"MUSIC · PAUSE":"MUSIC · PLAY"):info.kind==="notepad"?notepad.tip(e.clientX,e.clientY):info.kind==="credits"?credits.tip(e.clientX,e.clientY):info.kind==="rolodex"?(credUp()?"PUT IT BACK":"CREDITS"):info.label;
    if(info.kind==="lamp"||info.kind==="floor") deskMaps(); tip.style.left=e.clientX+"px"; tip.style.top=e.clientY+"px";
    tip.style.transform=e.clientX+tip.offsetWidth+28>innerWidth?"translate(calc(-100% - 12px),14px)":""; } else tip.hidden=true;
}
canvas.addEventListener("pointerdown",e=>{
  if(e.button===2){ down=null; return; }   // (the right button slides the camera: touch/touch.js)
  down={x:e.clientX,y:e.clientY,hit:pickNear(e)};
  if(PC.focused&&down.hit===PC.mesh) e.preventDefault();
  if(padUp()||calc?.up||credUp()) return;   // the notepad, the calculator or the credits card up: a press grabs nothing (a knob, the CD's buttons, the PC's glass), and its click only puts it down
  // at the PC, once it has its sound (the first click brings that, as a click), a mouse or pen press goes to it as it happens:
  // a drag selects text (Ctrl+C or Cmd+C copies it), a link opens on release. While the PC holds the press the camera stays
  // put. A touch stays a tap (pcTap): it brings up the phone's keyboard, and a phone has no Ctrl+C to copy with anyway.
  if(e.pointerType!=="touch"&&down.hit===PC.mesh&&PC.inst&&PC.zoom&&PC.focused&&(PC.audio||PC.used)&&e.button===0&&pickUV&&PC.inst.input({type:"pointerdown",button:0,...pcUV(pickUV)})){
    PC.press=e.pointerId; controls.enabled=false; try{ canvas.setPointerCapture(e.pointerId); }catch{} return; }
  const info=down.hit&&interact.get(down.hit);
  if(info&&info.kind==="cd"&&cd?.near&&cd.grab(down.hit,e)){ controls.enabled=false; cdDrag=true; gesture(); }
  if(info&&info.kind==="knob"){ controls.enabled=false; dragKnob={i:info.i,y:e.clientY,v:[state.volume,state.tracking,state.chroma][info.i]}; gesture(); }
});
addEventListener("pointerup",e=>{
  if(PC.press===e.pointerId) return pcRelease(e,"pointerup");
  if(cdDrag){ cdDrag=false; controls.enabled=true; cd.release(e); down=null; return; }
  if(dragKnob){ if(Math.abs(e.clientY-dragKnob.y)<=3) act(down.hit); dragKnob=null; controls.enabled=true; down=null; return; }
  const tap=down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6;
  // With the notepad up, a click on its paper goes to the pad (padClick), and any other click only puts the pad down (Felix,
  // 27 Sep 02:36Z: "any click/tap outside the notepad should just put it down (as opposed to immediately performing another
  // action)"): the TV, the PC, a tape on the shelf and the rest answer the next click, and the pad's own rows put tapes in.
  // With the credits card up, a click on it goes to the card (credClick), and any other click only puts it back; with the
  // calculator up, a click on it goes to it (a key, or its body puts it down), and any other click only puts it down (Felix,
  // 27 Sep 02:45Z: the two work like the notepad)
  if(tap&&credUp()){ gesture();
    if(down.hit&&interact.get(down.hit)?.kind==="credits") credClick(credits.at(e.clientX,e.clientY)); else closeSheet();
    down=null; return; }
  if(tap&&calc?.up){ gesture(); const c=calc.at(e.clientX,e.clientY);
    if(c) calc.click(c); else calc.lower();
    down=null; return; }
  if(tap&&padUp()){ gesture();
    if(down.hit&&interact.get(down.hit)?.kind==="notepad") padClick(notepad.at(e.clientX,e.clientY)); else workCard(false);
    down=null; return; }
  if(tap&&down.hit){ if(!window.__touch?.gate(down.hit,e)){ act(down.hit); if(e.pointerType==="mouse"&&!fly&&!DBG.on) hover(e); } } else if(tap&&zoomed&&!PC.zoom){ gesture(); toggleZoom(); }   // a click beside the glass leaves the close-up
  else if(down) gesture();
  down=null;
});
addEventListener("pointercancel",e=>{ if(PC.press===e.pointerId) pcRelease(e,"pointercancel"); if(cdDrag){ cdDrag=false; controls.enabled=true; cd.release(null); } });
// the end of a press at the PC, sent from the event itself: a link it opens, and a copy, stay inside the visitor's gesture
function pcRelease(e,type){
  PC.press=null; down=null; controls.enabled=true; try{ canvas.releasePointerCapture(e.pointerId); }catch{}
  const uv=type==="pointerup"?pcRayUV(e):null; if(PC.inst) PC.inst.input(uv?{type,...pcUV(uv)}:{type});
  if(type==="pointerup"){ gesture(); if(document.activeElement!==pcKbd) pcFocus(); }   // as a tap would: the visit's sound, and the keys
}
function pcRayUV(e){ if(!PC.mesh) return null; ptr.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1); ray.setFromCamera(ptr,view); return ray.intersectObject(PC.mesh,false)[0]?.uv||null; }
canvas.addEventListener("pointerleave",()=>{ tip.hidden=true; hoverEv=null; ttxHover=-1; notepad?.leave(); credits?.leave(); });
canvas.addEventListener("wheel",()=>{ tip.hidden=true; },{passive:true});
canvas.addEventListener("wheel",e=>{ if(DBG.on||!cd?.near||e.ctrlKey) return; const h=pick(e); if(h&&interact.get(h)?.kind==="cd"&&cd.scroll(h,e.deltaY*(e.deltaMode===1?40:1))){ e.preventDefault(); e.stopImmediatePropagation(); } },{capture:true,passive:false});
canvas.addEventListener("wheel",e=>{ if(DBG.on||!PC.inst||!PC.hover) return; if(PC.inst.input({type:"wheel",deltaY:e.deltaY})){ PC.used=true; e.preventDefault(); e.stopImmediatePropagation(); } },{capture:true,passive:false});
addEventListener("keydown",e=>{
  if(e.target.closest&&e.target.closest("input,textarea")) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;   // leave the browser's own shortcuts (copy, reload, tab switching) alone
  const k=e.key.toLowerCase();
  if(e.repeat&&/^[mzcn]$/.test(k)) return;   // a held key toggles once
  if(calc?.up&&!state.sheet&&calc.key(k)){ e.preventDefault(); gesture(); return; }   // the calculator, while it's up
  if(k==="k"&&calc&&!e.repeat&&!state.sheet&&!zoomed&&!PC.zoom&&!cd?.near){ gesture(); if(calc.up) calc.lower(); else { if(typeof padAway==="function") padAway(); calc.lift(); } return; }   // K: the calculator, up or down (a free key: C, N, M and Z are taken); the notepad makes way
  if(cd?.near&&!state.sheet&&cd.key(k)){ e.preventDefault(); gesture(); return; }
  if(state.page==="posts"&&!state.sheet&&/^arrow(up|down|left|right)$/.test(k)){ e.preventDefault(); ttxKey(k); }
  else if(/^[1-6]$/.test(k)){ gesture(); tvButton(+k-1); }
  else if(k==="m"){ if(cd&&!cd.near){ gesture(); if(state.sheet) closeSheet(); cdFocus(); } }   // M: to the CD player, as a click on it (Felix, 17:54Z; the sound has no key)
  else if(k==="z"){ if(!PC.zoom) toggleZoom(); }
  else if(k==="c"){ e.preventDefault(); pcHeld=e.code||e.key; gesture(); pcKey(); }   // (the letter stays out of the PC: pcHeld)
  else if(k==="n"){ if(state.page==="work"&&!state.sheet){ gesture(); workCard(workHidden); } }
  else if(k==="escape"){ if(state.sheet) closeSheet(); else if(calc?.up) calc.lower(); else if(PC.zoom) pcExit(); else if(zoomed) toggleZoom(); else if(padUp()) workCard(false); else if(state.page!=="home") go("home"); }   // a sheet can lie over the PC: it goes first
});

// ======================================================================= debug: free-look camera
// Toggle with the backquote key, DEBUG on the old PC, or open the page at #debug. Drag to look, WASD to move, Q/E down/up,
// Shift for speed, scroll to change the field of view, C copies the camera, backquote leaves.
const DBG={on:false,yaw:0,pitch:0,keys:new Set(),drag:null,fov:32,hud:null,fps:60,fn:0,ft:0};
function setDebug(on){
  if(on===DBG.on) return; DBG.on=on; controls.enabled=!on; fly=null;
  if(on){ const d=new THREE.Vector3(); camera.getWorldDirection(d); DBG.yaw=Math.atan2(-d.x,-d.z); DBG.pitch=Math.asin(d.y); DBG.fov=camera.fov;
    DBG.hud=document.createElement("div"); DBG.hud.style.cssText="position:fixed;left:12px;bottom:12px;z-index:9;font:13px/1.45 ui-monospace,monospace;color:#b8ffc8;background:rgba(0,0,0,.72);padding:8px 10px;border-radius:4px;pointer-events:none;white-space:pre";
    document.body.appendChild(DBG.hud); document.body.classList.add("debug"); panel.hidden=true; }
  else { DBG.hud?.remove(); DBG.hud=null; document.body.classList.remove("debug"); camera.fov=lensFov(); camera.updateProjectionMatrix();
    const d=new THREE.Vector3(); camera.getWorldDirection(d); controls.target.copy(camera.position).addScaledVector(d,.8); go(state.page,{silent:true}); if(PC.zoom) pcFly(pcFrame()); }   // (DEBUG on the PC: back to its glass)
}
function debugStep(dt,raw){
  const sp=(DBG.keys.has("shift")?2.4:.6)*dt, f=new THREE.Vector3(-Math.sin(DBG.yaw)*Math.cos(DBG.pitch),Math.sin(DBG.pitch),-Math.cos(DBG.yaw)*Math.cos(DBG.pitch));
  const r=new THREE.Vector3(Math.cos(DBG.yaw),0,-Math.sin(DBG.yaw)), k=DBG.keys;
  if(k.has("w")||k.has("arrowup")) camera.position.addScaledVector(f,sp); if(k.has("s")||k.has("arrowdown")) camera.position.addScaledVector(f,-sp);
  if(k.has("d")||k.has("arrowright")) camera.position.addScaledVector(r,sp); if(k.has("a")||k.has("arrowleft")) camera.position.addScaledVector(r,-sp);
  if(k.has("e")) camera.position.y+=sp; if(k.has("q")) camera.position.y-=sp;
  camera.fov=DBG.fov; camera.updateProjectionMatrix(); camera.lookAt(camera.position.clone().add(f));
  DBG.fn++; DBG.ft+=raw; if(DBG.ft>=500||DBG.fn>=60){ DBG.fps=DBG.fn*1000/DBG.ft; DBG.fn=DBG.ft=0; }   // frames over real time, not the clamped step
  const p=camera.position, fx=v=>v.toFixed(3);
  if(DBG.hud) DBG.hud.textContent=`DEBUG  ${DBG.fps.toFixed(0)} fps  ·  DPR ${DPR}  ·  ${DBG.calls|0} draws  ·  ${((DBG.tris|0)/1e3).toFixed(0)}k tris
three  pos (${fx(p.x)}, ${fx(p.y)}, ${fx(p.z)})   yaw ${(DBG.yaw*57.3).toFixed(1)}°  pitch ${(DBG.pitch*57.3).toFixed(1)}°  fov ${DBG.fov.toFixed(0)}
blender (${fx(p.x)}, ${fx(-p.z)}, ${fx(p.y)})
drag look · WASD move · Q/E down/up · shift fast · wheel fov · C copy · \` exit`;
}
canvas.addEventListener("pointerdown",e=>{ if(!DBG.on) return; DBG.drag={x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); e.stopImmediatePropagation(); },true);
canvas.addEventListener("pointermove",e=>{ if(!DBG.on) return; e.stopImmediatePropagation(); if(!DBG.drag) return;
  DBG.yaw-=(e.clientX-DBG.drag.x)*.004; DBG.pitch=Math.max(-1.5,Math.min(1.5,DBG.pitch-(e.clientY-DBG.drag.y)*.004)); DBG.drag={x:e.clientX,y:e.clientY}; },true);
canvas.addEventListener("pointerup",e=>{ if(!DBG.on) return; DBG.drag=null; e.stopImmediatePropagation(); },true);
canvas.addEventListener("wheel",e=>{ if(!DBG.on) return; e.preventDefault(); e.stopImmediatePropagation(); DBG.fov=Math.max(10,Math.min(100,DBG.fov+e.deltaY*.03)); },{capture:true,passive:false});
addEventListener("keydown",e=>{
  if(e.key==="`"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(DBG.on||!(e.target.closest&&e.target.closest("input,textarea")))){ e.preventDefault(); setDebug(!DBG.on); return; }
  if(!DBG.on) return; e.stopImmediatePropagation(); const k=e.key.toLowerCase(); DBG.keys.add(k);
  if(k==="c"){ const p=camera.position; const s=`pos ${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)} yaw ${(DBG.yaw*57.3).toFixed(1)} pitch ${(DBG.pitch*57.3).toFixed(1)} fov ${DBG.fov.toFixed(0)}`;
    navigator.clipboard?.writeText(s).catch(()=>{}); console.log(s); }
},true);
addEventListener("keyup",e=>{ DBG.keys.delete(e.key.toLowerCase()); },true);
addEventListener("blur",()=>DBG.keys.clear());
if(location.hash==="#debug") setTimeout(()=>setDebug(true),0);

// ======================================================================= loop
let revealNext=false, gated=false;
// Click to enter (Felix, 26 Sep 23:00Z: "stay on the "Loading screen" at a 100% and then display a "Click to enter" (or Tap to
// enter for touch)"): once the room is in, the loading display stays up at 100% and asks for a click, a tap or a key. That first
// one brings the sound (gesture()) and the room fades in, so the home film starts with its voice; the click itself does nothing
// else, except on a nav link, which goes on to its page. While it waits the hidden room draws a few frames a second. An
// automated browser (the tests, a link preview) goes straight in; ?gate=1 keeps the gate there too.
const GATE=!navigator.webdriver||/[?&]gate=1/.test(location.search), enterBtn=$("#enter"), muteBtn=$("#enter-muted");
const GATE_SKIP=/^(Tab|Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock|ScrollLock|Escape|Fn|FnLock|ContextMenu|Unidentified|Dead|F\d+|Audio\w*|Media\w*|Volume\w*|Browser\w*)$/;
function gateUp(){
  if(MEM.lost) return;   // the browser took the room's graphics away: the next tap is the reload card's (perf/mem)
  if(!enterBtn){ revealNext=true; return; }
  gated=true; canvas.classList.add("loaded");
  const osd=$("#osd"), cta=osd?.querySelector(".tv-cta");
  if(osd&&cta){ osd.classList.add("enter"); cta.textContent=`${touchOnly()?"TAP":"CLICK"} TO ENTER`; }
  enterBtn.hidden=false; if(muteBtn) muteBtn.hidden=false; try{ enterBtn.focus({preventScroll:true}); }catch{}
  addEventListener("click",gateClick,true); addEventListener("keydown",gateKey,true);
  addEventListener("pointerdown",muteDown,true); addEventListener("pointerup",muteUp,true); }
function enter(muted){
  if(!gated) return; gated=false; removeEventListener("click",gateClick,true); removeEventListener("keydown",gateKey,true);
  removeEventListener("pointerdown",muteDown,true); removeEventListener("pointerup",muteUp,true);
  enterBtn.remove(); muteBtn?.remove(); if(muted) quiet(); else gesture(); stillOut(); canvas.classList.add("ready"); revealNext=true; }   // (ready at once: a nav link's go() keeps the still)
function gateClick(e){ const nav=e.target.closest?.("nav.menu a"); enter(!!e.target.closest?.("#osd .tv-mute,#enter-muted")); if(!nav){ e.preventDefault(); e.stopPropagation(); } }
// A finger on ENTER MUTED lets the room in when it lifts, on the label still (Felix, 30 Sep 16:40Z: on an iPhone the tap
// "seems to be in a hover mode and additional clicks don't get me in"): Safari may never send that tap's click. A click
// it sends after all is eaten, so it doesn't land in the room
let muteId=null;
function muteDown(e){ muteId=gated&&e.pointerType!=="mouse"&&e.target.closest?.("#osd .tv-mute")?e.pointerId:null; }
function muteUp(e){ if(muteId===null||e.pointerId!==muteId) return; muteId=null;
  if(!gated||!document.elementFromPoint(e.clientX,e.clientY)?.closest?.("#osd .tv-mute")) return;
  const eat=c=>{ c.preventDefault(); c.stopPropagation(); };
  addEventListener("click",eat,true); setTimeout(()=>removeEventListener("click",eat,true),600);
  enter(true); }
function gateKey(e){ if(e.ctrlKey||e.metaKey||e.altKey||GATE_SKIP.test(e.key)) return;
  if(e.key==="Enter"&&e.target.closest?.("nav.menu a")) return enter();   // (Enter on a nav link: in, and on to its page)
  e.preventDefault(); e.stopPropagation(); enter(e.target===muteBtn&&(e.key==="Enter"||e.key===" ")); }   // (Enter or Space on ENTER MUTED: in, with the sound off)
let rainK=1, last=performance.now(), trainNext=performance.now()+12000, trainOn=0, lastSec=-1, slow=0, sigT=-1e9;
// The city outside is always in its busy evening (city/lib/night.js). __scene.lifeAt(hour, weekday) runs its later hours
// instead, for screenshots, from that hour on; lifeAt(null) goes back to the evening.
let cityLife=nightLife(0,0,true), lifePin=null;
function lifeTick(now=performance.now()){
  cityLife=lifePin?nightLife(lifePin.h*3600+(now-lifePin.t0)/1000,lifePin.dow??5,false,now/1000):nightLife(0,0,true,now/1000);
  const v=cityHum(); if(A.cityGain&&Math.abs(v-A.cityLvl)>.01){ A.cityLvl=v; A.cityGain.gain.setTargetAtTime(v,A.ctx.currentTime,3); }
}
// the city's hum follows its traffic: about 3.5 dB lower in the small hours than in the evening
function cityHum(){ return 1.5*(.55+.45*Math.min(1,cityLife.traffic/.36)); }
const sigAvg=new THREE.Color(), boAvg=new THREE.Color(), WHITE=new THREE.Color(1,1,1);
// orbiting can swing the camera through a wall (the room is 4.4 m wide and the orbit 2.6 m long), and from outside
// the page goes black: the rendered camera slides in along its line of sight instead, so it stays in the room
const ROOM_IN={x0:-1.6+.14,x1:2.8-.14,y0:.12,y1:3.2-.14,z0:-.42+.14,z1:2.6-.14};
function keepInRoom(p,t){
  let s=1; const lim=(pv,tv,lo,hi)=>{ if(pv<lo) s=Math.min(s,(lo-tv)/(pv-tv)); else if(pv>hi) s=Math.min(s,(hi-tv)/(pv-tv)); };
  lim(p.x,t.x,ROOM_IN.x0,ROOM_IN.x1); lim(p.y,t.y,ROOM_IN.y0,ROOM_IN.y1); lim(p.z,t.z,ROOM_IN.z0,ROOM_IN.z1);
  if(s<1) p.sub(t).multiplyScalar(Math.max(.05,s)).add(t);
  // and it never ends up inside furniture. Each piece pushes the view one way (see OBST), and past its edges the push fades
  // along a steep ramp instead of stopping, so the view stays a continuous function of the orbit: a drag glides over a chair
  // rather than jumping to its far side. Furniture may still stand in the view (GitHub looks past the desk chair at the PC),
  // a piece the page is looking at doesn't push, and page flights and the typing close-up are placed by hand and pass untouched.
  if(PC.zoom||cd?.near||fly) return;
  for(const o of OBST) if(o.ax!=="y") shove(o,p,t);
  for(const o of OBST) if(o.ax==="y") shove(o,p,t);   // lifts last: they move nothing sideways, so no sideways push undoes them
}
const OBST=[], RAMP=1.6;
// a free-standing piece can't be flown around smoothly, so a view passing close fades it out instead (r: gone that near to
// its box, whole again from there): the pendant over the desk, which the top orbits pass, and the floor lamp, which the view
// swings into as it turns left to the PC (Felix, 16:21Z). The lamp goes early and quickly, so a view resting there looks past
// it rather than through a veil of its shade; while it fades it takes no clicks (pick).
const FADES=[{re:/^floorlamp_/,parts:[],box:new THREE.Box3(),a:1,r:[.24,.42]},{re:/^pendant/,parts:[],box:new THREE.Box3(),a:1,r:[.08,.4]}], LAMP=FADES[0];
function fades(){ for(const F of FADES){ if(!F.parts.length) continue; const a=THREE.MathUtils.smoothstep(F.box.distanceToPoint(view.position),F.r[0],F.r[1]);
  if(a===F.a) continue; F.a=a; for(const o of F.parts){ o.visible=a>.01; o.material.opacity=a; o.material.depthWrite=a>.99; } } }
function shove(o,p,t){ const b=o.b; if(b.containsPoint(t)) return;
  // how far p is outside the piece's footprint, seen along the push
  const [u,w]=o.ax==="y"?["x","z"]:["x","y"], du=Math.max(0,b.min[u]-p[u],p[u]-b.max[u]), dw=Math.max(0,b.min[w]-p[w],p[w]-b.max[w]);
  const f=(o.s>0?b.max[o.ax]+.01:b.min[o.ax]-.01)-o.s*RAMP*Math.hypot(du,dw);
  if(o.s>0?p[o.ax]<f:p[o.ax]>f) p[o.ax]=f; }
// Frame pacing: about 60 frames a second whatever the screen's refresh rate (a 120 Hz screen would draw the room twice as often
// for nothing), and about 30 while nobody touches anything and nothing moves: the tape, the rain and the city read the same at
// 30, and the GPU does half the work. Input, a flight, a tape or a switch-on bring back 60 at once. The page draws on every
// n-th refresh, with n from the screen's measured refresh interval: 60 Hz draws every refresh (30: every 2nd), 120 Hz every
// 2nd (4th), 144 Hz every 2nd (5th); 90 and 100 Hz draw every refresh, since every 2nd would be 45 or 50.
let lastInput=-1e9, lastDraw=-1e9, lastRaf=-1e9, refreshMs=1000/60;
for(const ev of ["pointerdown","pointermove","wheel","keydown","touchstart","touchmove"]) addEventListener(ev,()=>{ lastInput=performance.now(); },{passive:true,capture:true});
const busyNow=now=>!!(fly||pull||tapeAnim||credits?.busy||notepad?.busy||cd?.busy||calc?.busy||pckeys?.busy||coffee?.busy||clock?.busy||vcr?.busy||settles.length||DBG.on||state.glitch>0||now-lastInput<(PQ.on?900:2500)||now-state.powerT<1600||!canvas.classList.contains("ready"));
const glc=renderer.getContext(); let preFence=null;
function frame(now){
  requestAnimationFrame(frame);
  if(MEM.lost) return;   // the browser took the room's graphics away: the reload card is up (perf/mem)
  const gap=now-lastRaf; lastRaf=now; if(gap>3&&gap<50) refreshMs+=(gap-refreshMs)*.05;   // hidden tabs and long stalls aside
  const busy=busyNow(now)&&(!PQ.on||(panel.hidden&&!state.sheet)), n=Math.max(1,Math.round((busy?1000/60:1000/30)/refreshMs-.2));
  if(now-lastDraw<n*refreshMs-2.5) return;   // the margin keeps rAF jitter from skipping a refresh we meant to draw
  if(gated&&now-lastDraw<250) return;   // (at the gate the room is hidden: four frames a second keep it warm)
  if(holdDraw&&now-holdT<8000) return;   // (built, the room waits for its shaders and the loading display: osdPaint)
  // until the room is shown the canvas is invisible, so the browser doesn't hold frames back: on a slow GPU (a software
  // one) hidden frames would pile up faster than it draws them and the reveal would wait for all of them. So until then a
  // frame is drawn only once the GPU has finished the one before.
  if(preFence&&!revealNext){ if(glc.getSyncParameter(preFence,glc.SYNC_STATUS)===glc.UNSIGNALED) return; glc.deleteSync(preFence); preFence=null; }
  lastDraw=now;
  const raw=now-last, dt=Math.min(64,raw)/1000; last=now; const T=now/1000;
  gfxTick(now,raw,busy,n*refreshMs);   // the TV's glow on phones, Graphics: Auto, the frame-rate line (perf/phone)

  // keep it smooth on slower machines: step the resolution down if frames drag (late means past two 60 Hz refreshes at 60 a
  // second, three at 30)
  slow = gated?slow:dt>(busy?.034:.051) ? slow+dt : Math.max(0,slow-dt*.5);   // (the gate's slow frames are on purpose)
  if(slow>2.5&&DPR>.75){ dprCap=DPR=Math.max(.75,DPR-.25); resize(); slow=0; }

  if(now-sigT>1000/31){ sigT=now; sigAvg.copy(paintSignal(now)); srcTex.needsUpdate=true; }
  const avg=MON.blueonly?boAvg.setScalar(sigAvg.b):sigAvg;
  const pt=(now-state.powerT)/1000;
  let ox=1,oy=1,dr=0;
  if(state.power){ ox=Math.min(1,pt/.12); oy=pt<.12?.004:Math.min(1,Math.pow((pt-.12)/.35,.7)); }
  else { oy=Math.max(.004,1-pt/.14); ox=pt<.14?1:0; if(pt>.14&&pt<.26) ox=Math.max(0,1-(pt-.14)/.12); dr=pt<.26?0:Math.max(0,.05*(1-(pt-.26)/1.3)); }
  const U=vhsMat.uniforms; U.t.value=T; U.g.value=reduce?Math.min(state.glitch,.3):state.glitch; U.trk.value=state.tracking*.7; U.sat.value=state.chroma*1.15;
  U.openX.value=ox; U.openY.value=oy; U.dotR.value=dr;
  MONK.us+=((MON.underscan?1:0)-MONK.us)*(reduce?1:Math.min(1,dt*18)); U.us.value=MONK.us; U.hv.value=MON.hvdelay&&ox*oy>=1?1:0; U.bo.value=MON.blueonly?1:0;
  { const F=RASTER[rasterFill?"fill":"page"], k=reduce?1:Math.min(1,dt*9); MONK.fx+=(F[0]-MONK.fx)*k; MONK.fy+=(F[1]-MONK.fy)*k; U.fit.value.set(MONK.fx,MONK.fy); }
  DBG.calls=renderer.info.render.calls; DBG.tris=renderer.info.render.triangles; renderer.info.reset();   // the HUD shows the whole previous frame
  renderer.setRenderTarget(rt); renderer.render(vhsScene,vhsCam); renderer.setRenderTarget(null);
  if(TVA.want) tvAvgRun();   // the TV's glow, read without waiting (perf/phone)
  state.glitch=Math.max(0,state.glitch-dt/.34);

  const lit=(state.power?Math.min(1,ox*oy):(dr>0?.15:0))*(1-.2*MONK.us);
  tvLight.color.copy(avg).lerp(WHITE,.25);
  TVCOL.value.copy(avg).lerp(WHITE,.15).multiplyScalar(lit*1.5*(1+state.glitch*.5));
  tvLight.intensity=lit*(5.5+Math.sin(T*60)*.15+state.glitch*3)*(state.power&&pt<.6?1.8:1);
  if(screenMat) screenMat.emissiveIntensity=1.6*(state.power&&pt<1.4?1+Math.sin(pt*40)*.25*(1.4-pt):1);

  for(const o of interact.keys()){ const u=o.userData; if(!u.press) continue; const k=(now-u.press)/1000;
    const d=k<.05?k/.05:k<.14?1:Math.max(0,1-(k-.14)/.08); o.position.copy(u.home); o.position.z-=d*u.depth; if(k>.3) u.press=0; }
  if(settles.length) stepSettles(dt);
  if(tapeAnim){ shadowsDirty=2; tapeAnim.t+=dt/tapeAnim.dur; tapeAnim.step(Math.min(1,tapeAnim.t)); if(tapeAnim.t>=1){ const a=tapeAnim; tapeAnim=null; a.done(); if(!tapeAnim&&queue.length){ const q=queue.shift(); if(q==="eject"){ if(state.tape>=0) eject(); } else chooseTape(q); } } }
  if(vcr) vcr.frame(dt);   // the VCR's flap: pushed by a cassette, swung up by the deck, sprung shut

  const photo=city.backdrop.material.uniforms.map?.value||null;   // the beads refract the city's own photo
  rainMats.forEach(m=>{ m.uniforms.t.value=T; if(m.uniforms.photo){ m.uniforms.photo.value=photo; m.uniforms.uPh.value=photo?1:0; } });
  lampFrame(dt);
  // at the glass the streaks outside would crowd the view and hide the drops: they thin out while you look out
  rainK+=((WIN.zoom?.4:1)-rainK)*Math.min(1,dt*1.5);
  const rm=city.rain?.mesh?.material; if(rm){ const u=rm.uniforms?.uOpacity, b=rm.userData.base??=(u?u.value:rm.opacity); if(u) u.value=b*rainK; else rm.opacity=b*rainK; }
  if(now>trainNext){ trainNext=now+(42000+Math.random()*25000)*cityLife.trainGap; trainOn=now; playTrain(); }
  city.update(T,dt,{trainT:trainOn?(now-trainOn)/1000:-1,camera:view,life:cityLife});
  // the rain sound follows the depth window's showers (city.weather: 0 a drizzle .. 1 a downpour; null for the others)
  if(A.rainGain&&now-(A.rainT||0)>500){ A.rainT=now; const w=city.weather; A.rainGain.gain.setTargetAtTime(RAIN*(w==null?1:.65+.7*w),A.ctx.currentTime,2); }
  steam.forEach(s=>{ const p=(s.userData.ph+T*.09)%1; s.position.set(MUG.x+Math.sin(T*.7+p*9)*.012*p*3,MUG.y+p*.2,MUG.z+Math.cos(T*.5+p*7)*.01*p*3);
    s.scale.setScalar(.02+p*.07); s.material.opacity=Math.sin(p*Math.PI)*.15*(coffee?coffee.steam:1); s.visible=!coffee||coffee.steam>0; s.material.rotation=p*2+s.userData.ph*6; });
  const dA=dustGeo.attributes.position.array;
  const dk=dt*60;   // the dust drifts per 60th of a second, at 30 frames a second too
  for(let i=0;i<DN;i++){ dA[i*3]+=Math.sin(T*.3+i)*.00004*dk; dA[i*3+1]+=(Math.cos(T*.2+i*1.7)*.00003-.000008)*dk; if(dA[i*3+1]<.78) dA[i*3+1]=1.5; }
  dustGeo.attributes.position.needsUpdate=true;

  if(DBG.on){ debugStep(dt,raw); view.copy(camera); view.clearViewOffset(); }
  else {
  if(fly){ fly.t=Math.min(1,fly.t+dt/fly.dur);
    if(fly.via) flyVia(fly); else { const e=fly.soft?.5-.5*Math.cos(Math.PI*fly.t):ease(fly.t); controls.target.lerpVectors(fly.fromT,fly.toT,e); camera.position.lerpVectors(fly.fromP,fly.toP,e); }
    if(fly.t>=1){ const land=fly.land; fly=null; pageLimits(); land?.(); } }
  controls.update();
  view.copy(camera); keepInRoom(view.position,controls.target); view.lookAt(controls.target);
  if(pull) pullStep(dt);   // (entering a narrow window: from the still's framing to the room's, stillOut)
  const st=shiftTarget(); const kk=reduce?1:Math.min(1,dt*4); shift.x+=(st.x-shift.x)*kk; shift.y+=(st.y-shift.y)*kk;
  if(Math.abs(shift.x)+Math.abs(shift.y)>.5) view.setViewOffset(innerWidth,innerHeight,shift.x,shift.y,innerWidth,innerHeight);
  cardCam.copy(view); cardCam.updateMatrixWorld();
  if(!reduce){ const dr=PC.zoom||cd?.near?.3:1; view.position.x+=Math.sin(T*.23)*.005*dr; view.position.y+=Math.sin(T*.31+1)*.0035*dr; view.lookAt(controls.target); }
  }
  fades();
  view.updateProjectionMatrix();
  if(notepad) notepad.frame(dt,T);
  if(credits) credits.frame(dt,T);   // the credits card too   // the pad floats in front of the view as it is drawn this frame
  if(cd) cd.frame(dt,T);   // the CD player's buttons, wheel, backlight and LCD
  if(calc) calc.frame(dt,T);   // the calculator: its keys, and floating in front of the view
  if(pckeys) pckeys.frame(dt);   // the PC keyboard's caps, down and back up
  if(coffee) coffee.frame(dt,T);   // the coffee: its level while a sip goes down, its surface after, the steam
  if(clock) clock.frame(dt);   // the wall clock: a tick on each step of its second hand, and its battery coming out or going in
  // focus follows what the camera looks at
  grade.uniforms.t.value=T;
  if(shadowsDirty>0&&!phoneShadowSkip()){ renderer.shadowMap.needsUpdate=true; shadowsDirty--; }
  updateClock(clock?clock.now(Date.now()):Date.now()); stepPC(now); cycWatch(dt); musicDuck(now);
  if(homeOn&&!(homeOnTV()&&state.power)) homePause();
  composer.render();
  if(!revealNext&&!canvas.classList.contains("ready")) preFence=glc.fenceSync(glc.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(revealNext){ revealNext=false; stillOut(); canvas.classList.add("ready"); revealT=performance.now();
    if(still?.isConnected){ const gone=()=>still.remove(); if(reduce) gone(); else { canvas.addEventListener("transitionend",e=>{ if(e.propertyName==="opacity") gone(); }); setTimeout(gone,6000); } } }
  if(ENTRY&&(fly||zoomed||PC.zoom||WIN.zoom||cd?.near)) entryDrop();
  else if(ENTRY&&!state.sheet&&now-revealT>=ENTRY_WAIT) entryGo();   // a page's own link: off to the page (a sheet opened meanwhile holds it; closing it goes home)
  placeCard();

  const sec=Math.floor(Date.now()/1000);
  if(sec!==lastSec){ lastSec=sec; drawVFD(); lifeTick(now); }
}
requestAnimationFrame(frame);
window.__scene={gesture,get cycle(){ return CYC; },cycNext,cycOff,cycLen,get userT(){ return userT; },get coffee(){ return coffee; },get clock(){ return clock; },MON,tvButton,DESK,setDesk,deskMaps,FLOOR,setFloor,scene,get city(){ return city; },get life(){ return cityLife; },lifeAt(h,dow){ lifePin=h==null?null:{h,dow,t0:performance.now()}; lifeTick(); },camera,view,OBST,LAMP,FADES,keepInRoom,controls,renderer,state,go,chooseTape,setPower,ANCHOR,frameFor,DBG,setDebug,THREE,chCanvas,chPause,chStart,chStop,channels,CH_IDS,tapeGroups,PC,pcFocus,pcBlur,pcExit,pcFrame,pcMonitor,pcMonFrame,pcUnit,flyVia,get fly(){ return fly; },get pull(){ return pull; },openPost,get ttx(){ return {sub:postSub,hover:ttxHover,focus:ttxFocus}; },get home(){ return {mod:!!homeMod,inst:!!homeInst,on:homeOn,key:homeKey,t:homeT,snd:homeSnd,clock:homeInst?.clock??null,reveal:revealT,start:homeStartT,delay:HOME_DELAY,carry:homeCarry}; },signal:src,
  get rain(){ return {weather:city.weather,gain:A.rainGain?+A.rainGain.gain.value.toFixed(3):null,base:RAIN,den:city.rain?.mesh?.material?.uniforms?.uDen?.value??null}; },
  get music(){ return {on:!!A.on,...music.state(),t:A.ctx?.currentTime??0}; },musicEngine:music,get filmMusic(){ return {want:filmMusic,took:cdTook,sounds:!!homeInst?.music}; },get cd(){ return cd; },get vcr(){ return vcr; },cdFocus,cdParts,
  settle(){ if(fly){ controls.target.copy(fly.toT); camera.position.copy(fly.toP); const land=fly.land; fly=null; pageLimits(); land?.(); } },get entry(){ return ENTRY; },entryGo,lensFov,tvZoomFrame,pageMinDist,anchorFor,act,pick,occluders,interact,resumeTape,openSheet,closeSheet,refreshWork,get queue(){ return queue; },get tapeAnim(){ return tapeAnim; },get chIdx(){ return chIdx; },get chPaused(){ return chPaused; },get zoomed(){ return zoomed; },get pickUV(){ return pickUV; },get chInst(){ return chInst; },get notepad(){ return notepad; },get calc(){ return calc; },get pckeys(){ return pckeys; },get credits(){ return credits; },showCredits,credClick,workCard,padClick,get workHidden(){ return workHidden; },get tv(){ return {page:tvPage(),prog:tvProg(),pc:pcTV}; },pcVisit,pcOptions,settings:PC_SETTINGS,get raster(){ return {fill:rasterFill,fx:MONK.fx,fy:MONK.fy}; }};
window.__touchHooks={PHONE,TAPES,EXP,EDU,JOBS,interact,pick,go,chooseTape,pcVisit,pcExit,workCard,padUp,atPC,canvas,controls,camera,tip,PC,state,gesture,
  get view(){ return view; },get notepad(){ return notepad; },get workHidden(){ return workHidden; },get zoomed(){ return zoomed; },get fly(){ return fly; },
  get cd(){ return cd; },get calc(){ return calc; },credUp,frameFor,flyTo,pageLimits,ttxSwipe(d){ ttxHover=-1; if(d) ttxFlip(d); }};
import("./touch/touch.js").then(m=>m.default(window.__touchHooks)).catch(e=>console.warn("touch",e));
