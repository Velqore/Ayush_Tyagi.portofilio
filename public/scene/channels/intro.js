// TAPE · INTRO — "At the Edge of the Internet", customized for Ayush Tyagi.
// Forensic Science, digital craft, Pratyaksh-AI, and curious systems.
// Streamed from CDN with personalized captions and soothing soundtrack.

const W = 960, H = 720, TOP = 0, BOT = H, PH = BOT - TOP;
const CAPS = s => `400 ${s}px Georgia, "Times New Roman", serif`;
const SERIF = (s, it = true) => `${it ? "italic " : ""}600 ${s}px Georgia, "Times New Roman", serif`;
const SUB = s => `600 ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

const CDN_INTRO = "https://c96b3c59.berlin-monitor-scene.pages.dev/3e11de40/channels/intro/";
const DUR = 116.24;
const VW = 640, VH = 480;
const CHAPTERS = [0, 11.22, 28.24, 41.05, 66.45, 71.37, 94.43, 102.65];
const TITLE = { in: .6, out: 7.6, gone: 9.2 };
const END = 1.4;
const FORMATS = [
  ["penguin.mp4", "video/mp4", 'video/mp4; codecs="avc1.64001F"'],
  ["penguin.webm", "video/webm", 'video/webm; codecs="vp9"']
];
const POSTER = "data:image/jpeg;base64,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";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };

function mk(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    try { const c = new OffscreenCanvas(w, h); if (c.getContext("2d")) return c; } catch (e) {}
  }
  return typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width: w, height: h }) : null;
}

const NODASH = [];
function resetCtx(g) {
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.textBaseline = "alphabetic";
  g.lineCap = "butt"; g.lineJoin = "miter"; g.miterLimit = 10;
  g.setLineDash(NODASH); g.lineDashOffset = 0; g.imageSmoothingEnabled = true;
  try { g.letterSpacing = "0px"; g.wordSpacing = "0px"; } catch (e) {}
  g.direction = "ltr"; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  g.shadowColor = "rgba(0,0,0,0)"; g.filter = "none";
}

let posterImg = null;
if (typeof Image !== "undefined") {
  posterImg = Object.assign(new Image(), { crossOrigin: "anonymous" });
  posterImg.decoding = "async";
  posterImg.src = POSTER;
}

function caption(g, s, x, y, size = 30, color = "#fffbe8", maxW = 840) {
  g.font = CAPS(size);
  try { g.letterSpacing = `${Math.round(size * .2)}px`; } catch (e) {}
  const w = g.measureText(s).width, k = w > maxW ? maxW / w : 1;
  g.save(); g.translate(x, y); g.scale(k, 1); g.textAlign = "center";
  g.shadowColor = "rgba(12,18,32,.75)"; g.shadowBlur = size * .5; g.fillStyle = color; g.fillText(s, 0, 0);
  g.shadowBlur = 0; g.fillStyle = "rgba(12,18,32,.45)"; g.fillText(s, 1.5, 1.5); g.fillStyle = color; g.fillText(s, 0, 0);
  g.restore();
  try { g.letterSpacing = "0px"; } catch (e) {}
}

function title(g, t) {
  if (t < TITLE.in || t > TITLE.gone) return;
  const out = 1 - ease((t - TITLE.out) / (TITLE.gone - TITLE.out)), a = g.globalAlpha;
  const band = g.createLinearGradient(0, 96, 0, 226);
  band.addColorStop(0, "rgba(14,20,34,0)"); band.addColorStop(.5, "rgba(14,20,34,.3)"); band.addColorStop(1, "rgba(14,20,34,0)");
  g.globalAlpha = a * ease((t - TITLE.in) / 1.8) * out; g.fillStyle = band; g.fillRect(0, 96, W, 130);
  caption(g, "AYUSH TYAGI — WORKSTATION", 480, 174, 34);
  g.globalAlpha = a;
}

// Subtitles tailored for Ayush Tyagi
const AYUSH_CAPS = [
  [2.2, 6.5, ["Here, at the edge of the internet,", "there is a small workstation."]],
  [7.0, 11.5, ["It belongs to a researcher", "named Ayush Tyagi."]],
  [12.0, 17.0, ["A student of Forensic Science,", "connecting careful observation with digital craft."]],
  [17.5, 23.0, ["Building Pratyaksh-AI, Aurex,", "and curious forensic systems,"]],
  [23.5, 28.5, ["each one a careful inquiry", "into evidence, truth, and software."]],
  [29.0, 34.0, ["His work, he tells me,", "is finding truth in the finest details."]],
  [34.8, 37.5, ["Nothing is just a detail."]],
  [37.9, 41.2, ["Everything leaves a mark."]],
  [41.8, 44.0, ["From physical questioned documents,"]],
  [44.2, 49.0, ["to digital forensics, cryptography,", "and open-source intelligence."]],
  [49.5, 55.0, ["Investigating at SIFS Forensics,", "and Beyond Evidence at the Supreme Court."]],
  [55.5, 59.5, ["Pursuing B.Sc. Forensic Science", "at K.R. Mangalam University."]],
  [60.0, 66.0, ["Exploring systems at CyberRepo,", "and sharing discoveries along the way."]],
  [72.5, 77.0, ["Here, on this workstation,", "there is also a log."]],
  [81.0, 86.5, ["Notes on investigations, models,", "code, and legal frameworks."]],
  [92.5, 95.5, ["Curiosity never rests."]],
  [96.2, 98.0, ["It only deepens."]],
  [104.0, 109.0, ["Observation is everything."]]
];

function voiceCaption(t) {
  for (const [from, to, text] of AYUSH_CAPS) {
    if (t >= from && t <= to) {
      const dur = to - from, k = clamp(Math.min((t - from) / .22, (to - t) / .22));
      return { text, k };
    }
  }
  return null;
}

function voiceSubtitle(g, lines, k, y, maxW = 760) {
  if (k <= 0) return;
  g.save(); g.font = SUB(26); g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,.9)"; g.shadowBlur = 6; g.lineWidth = 4;
  g.strokeStyle = "rgba(0,0,0,.85)"; g.fillStyle = "#ffe840";
  const step = 32, startY = y - ((lines.length - 1) * step) / 2;
  lines.forEach((l, i) => {
    const ly = startY + i * step;
    g.strokeText(l, 480, ly);
    g.fillText(l, 480, ly);
  });
  g.restore();
}

function shade(g, k) {
  if (k <= 0) return;
  const h = g.createLinearGradient(0, BOT - 170, 0, BOT);
  h.addColorStop(0, "rgba(0,0,0,0)");
  h.addColorStop(1, `rgba(0,0,0,${(.42 * k).toFixed(3)})`);
  g.fillStyle = h; g.fillRect(0, BOT - 170, W, 170);
}

// Gentle film grain and vignette
function grain(g, anim) {
  g.save(); g.fillStyle = "rgba(0,0,0,.08)";
  const off = Math.floor(anim * 60) % 7;
  for (let y = 0; y < H; y += 8 + (off % 3)) {
    g.fillRect(0, y, W, 1);
  }
  g.restore();
}

function film(g, anim) {
  // Vignette
  const rad = g.createRadialGradient(480, 360, 260, 480, 360, 520);
  rad.addColorStop(0, "rgba(0,0,0,0)");
  rad.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = rad; g.fillRect(0, TOP, W, PH);
}

export default {
  id: "intro",
  title: "At the Edge of the Internet",
  kind: "film",
  mount(opts) {
    const { canvas: cv, ctx: g, width: cw, height: chh, audio } = opts;
    let clock = 0, last = 0, anim = 0, shadeK = 0;
    let ready = false, dead = false, stopped = false;
    let held = false, hold = mk(VW, VH), hg = hold ? hold.getContext("2d") : null;
    let v = null;

    if (typeof document !== "undefined") {
      v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.playsInline = true;
      v.muted = true;
      v.loop = true;
      v.preload = "auto";
      // Load video stream from CDN
      const srcEl = document.createElement("source");
      srcEl.src = CDN_INTRO + "penguin.mp4";
      srcEl.type = 'video/mp4; codecs="avc1.64001F"';
      v.appendChild(srcEl);
      const srcEl2 = document.createElement("source");
      srcEl2.src = CDN_INTRO + "penguin.webm";
      srcEl2.type = 'video/webm; codecs="vp9"';
      v.appendChild(srcEl2);

      v.addEventListener("canplay", () => { ready = true; });
      v.addEventListener("loadeddata", () => { ready = true; });
      v.play().catch(() => {});
    }

    function paint() {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); resetCtx(g);
      g.setTransform(cw / W, 0, 0, chh / H, 0, 0);
      g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      g.save(); g.beginPath(); g.rect(0, TOP, W, PH); g.clip();

      const wx = Math.round(Math.sin(anim * 2.3) * .6), wy = Math.round(Math.sin(anim * 1.7 + 1) * .6);
      if (v && ready && v.readyState >= 2) {
        g.drawImage(v, wx - 3, TOP + wy - 2, W + 6, PH + 4);
      } else if (held && hold) {
        g.drawImage(hold, wx - 3, TOP + wy - 2, W + 6, PH + 4);
      } else if (posterImg && posterImg.complete) {
        g.drawImage(posterImg, wx - 3, TOP + wy - 2, W + 6, PH + 4);
      } else {
        g.fillStyle = "#cfd6da"; g.fillRect(0, TOP, W, PH);
      }

      grain(g, anim); film(g, anim);
      title(g, clock);
      shade(g, shadeK);

      const c = voiceCaption(clock);
      if (c) voiceSubtitle(g, c.text, c.k, 660, 480);

      const f = clamp((clock - (DUR - END)) / (END - .25));
      if (f > 0) {
        g.globalAlpha = f; g.fillStyle = "#000"; g.fillRect(0, TOP, W, PH); g.globalAlpha = 1;
      }
      g.restore(); g.restore();
    }

    function frame(tMs, dtMs = 16) {
      if (dead) return;
      let d = +dtMs; d = d > 0 ? Math.min(100, d) / 1000 : 0;
      if (!stopped) {
        anim += d;
        if (v && ready) {
          if (v.paused) v.play().catch(() => {});
          clock = v.currentTime;
          if (hg && v.readyState >= 2) { hg.drawImage(v, 0, 0, VW, VH); held = true; }
        } else {
          clock += d; if (clock >= DUR) clock -= DUR;
        }
        const on = voiceCaption(clock) ? 1 : 0;
        shadeK += (on - shadeK) * Math.min(1, d * 4);
      }
      paint();
    }

    function jump(t) {
      clock = t;
      if (v && ready) { try { v.currentTime = t; } catch (e) {} }
    }

    function input(ev) {
      if (!ev || dead) return;
      const ty = ev.type, N = CHAPTERS.length;
      let i = N - 1; while (i > 0 && CHAPTERS[i] > clock) i--;
      if (ty === "next" || ty === "click") jump(CHAPTERS[(i + 1) % N] + .004);
      else if (ty === "prev") jump(CHAPTERS[clock - CHAPTERS[i] < 1.5 ? (i + N - 1) % N : i] + .004);
      else if (ty === "stop") {
        if (stopped) return; stopped = true;
        try { if (v) v.pause(); } catch (e) {}
      } else if (ty === "play") {
        if (!stopped) return; stopped = false;
        try { if (v) v.play().catch(() => {}); } catch (e) {}
      }
    }

    function stop() {
      if (dead) return; stopped = dead = true;
      if (v) {
        try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {}
        if (v.parentNode) v.parentNode.removeChild(v);
      }
    }

    return {
      frame, input, stop,
      get clock() { return clock; },
      get music() { return false; }, // Host plays its own soothing ambient music
      setMusic() {}
    };
  }
};
