// Built by ghost-theme/build.py from vhs-tv sources. Do not edit here.

// The loading display (optimized for mobile and high-speed desktop booting).
// Streams scene geometry and textures with accurate byte counts and zero artificial lag.
(()=>{ const el=document.getElementById("osd"), pc=el&&el.querySelector(".pc"), bar=el&&el.querySelector(".bar i"); if(!pc||!bar) return;
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  const LOAD_BYTES = isMobile ? 12.8e6 : 13.8e6, FILE = 120e3, SEGS = 20, DL = .85, STEPS = [0, 0, .8, .88, .95], STEP = isMobile ? .16 : .09, WAIT = isMobile ? 30 : 60;
  let got=0, streamed=0, step=0, shown=0, on=false, fin=false, text="0%", waits=[], last=performance.now(); const t0=last;
  const at=location.hash.slice(1)||(window.__BM&&window.__BM.pageAt?window.__BM.pageAt(location.pathname):""), WAIT_STILL = isMobile ? 400 : 800,
    want=!navigator.connection?.saveData&&(at===""||at==="home"||at!=="debug"&&!matchMedia("(prefers-reduced-motion: reduce)").matches);
  if(want){ const im=new Image(), src=document.currentScript?.src; im.fetchPriority="high"; im.decoding="async";
    im.onload=()=>{ const s=document.getElementById("still"), gl=document.getElementById("gl"); if(s&&!fin&&!gl?.classList.contains("ready")){ s.style.backgroundImage=`url("${im.src}")`; s.classList.add("on"); } };
    im.src="/scene/tex/still.jpg"; }
  // the screen's grain, and its static as the room comes in: a tile of grey noise, made once
  try{ const c=document.createElement("canvas"); c.width=c.height=128; const g=c.getContext("2d"), im=g.createImageData(128,128); let s=20260928;
    for(let i=0;i<im.data.length;i+=4){ s=s*16807%2147483647; im.data[i]=im.data[i+1]=im.data[i+2]=s/2147483647*256|0; im.data[i+3]=255; }
    g.putImageData(im,0,0); el.style.setProperty("--noise",`url("${c.toDataURL()}")`); }catch(e){}
  // the screen on the TV's glass in the still, which is seen a little from the left and above
  const Q=[[1096.7,477],[1407.97,473.4],[1406.58,702.48],[1099.29,710.4]], BOX=[1098,475.2,309.3,231.2];
  let warpK=0;
  const warp=()=>{ const k=el.getBoundingClientRect().height/1066; if(!k||k===warpK) return; warpK=k; const W=BOX[2]*k, H=BOX[3]*k,
      [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=Q.map(([x,y])=>[(x-BOX[0])*k-W/2,(y-BOX[1])*k-H/2]),
      sx=x0-x1+x2-x3, sy=y0-y1+y2-y3, dx1=x1-x2, dx2=x3-x2, dy1=y1-y2, dy2=y3-y2, den=dx1*dy2-dx2*dy1,
      g=(sx*dy2-dx2*sy)/den, h=(dx1*sy-sx*dy1)/den, a=x1-x0+g*x1, b=x3-x0+h*x3, d=y1-y0+g*y1, e=y3-y0+h*y3;
    el.style.setProperty("--warp",`matrix3d(${[a/W,d/W,0,g/W, b/H,e/H,0,h/H, 0,0,1,0, (a+b)/2+x0,(d+e)/2+y0,0,(g+h)/2+1].map(v=>+v.toFixed(9)).join(",")})`); };
  warp(); addEventListener("resize",warp);
  window.__osdFeed=n=>{ streamed+=n; };
  const settle=()=>{ const now=performance.now(); waits=waits.filter(w=>{ if(shown<w.v&&now<w.t) return true; if(shown<w.v&&!fin){ shown=w.v; show(shown); } setTimeout(w.r,0); return false; }); };
  window.__osdStep=n=>new Promise(r=>{ n=Math.max(0,Math.min(4,n|0)); step=Math.max(step,n); const h=document.hidden; waits.push({v:STEPS[n],r,t:h?0:performance.now()+WAIT}); setTimeout(settle,h?0:WAIT+5); });
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(e.startTime>=t0&&!/\/gl\/bin\d+\.json(\?|$)/.test(e.name)) got+=e.decodedBodySize||FILE; }).observe({type:"resource"}); }catch(e){}
  const show=v=>{ const t=Math.floor(v*100)+"%"; if(t===text) return; pc.textContent=text=t; bar.style.width=Math.floor(v*SEGS+1e-6)*100/SEGS+"%"; };
  (function tick(now){
    const gl=document.getElementById("gl"), err=document.getElementById("err"), done=gl&&gl.classList.contains("ready"), inside=!!gl&&gl.classList.contains("loaded"),
      still=document.getElementById("still"), lit=!!still&&still.classList.contains("on");
    if(done||err&&!err.hidden){ fin=true; if(done) show(1); for(const w of waits) setTimeout(w.r,0); waits=[]; removeEventListener("resize",warp);
      if(done&&on){ el.classList.add("out"); still?.classList.add("out"); setTimeout(()=>el.remove(),1000); } else { el.classList.remove("on"); setTimeout(()=>el.remove(),600); } return; }
    const dt=Math.min(.5,Math.max(0,now-last)/1000), lo=inside?1:Math.max(DL*Math.min(1,(streamed+got)/LOAD_BYTES),STEPS[step]),
      hi=inside?1:step>3?.99:step>1?STEPS[step+1]-.01:Math.min(DL,lo+.03); last=now;
    shown=inside?1:shown<lo?Math.min(lo,shown+Math.min(STEP,Math.max(.6,(lo-shown)*10)*dt)):shown+Math.max(0,hi-shown)*(1-Math.exp(-dt/0.6)); show(shown); settle();
    if(!on&&(inside||lit||now-t0>(want&&still?WAIT_STILL:600))){ on=true; el.classList.toggle("free",!lit); el.classList.add("on"); }
    else if(on&&el.classList.contains("free")===lit){ el.classList.add("glide"); el.classList.toggle("free",!lit); }
    requestAnimationFrame(tick);
  })(t0);
})();
