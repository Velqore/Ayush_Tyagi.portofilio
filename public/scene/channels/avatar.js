// CHANNEL · AVATAR v6 — Authentic Interactive Ayush Tyagi Avatar
// Features:
// 1. Pristine high-resolution portrait of Ayush Tyagi (1024x588) with authentic studio rim light
// 2. Pure 2.5D head and body parallax tracking cursor with natural breathing motion
// 3. Natural tilt, depth perspective, and smooth lerping without any artificial eye filters
// 4. Smooth sleep mode when desk lamp is turned off (head tilts down into sleep posture, calm breathing, floating Zzz)
// 5. Silent forensic telemetry HUD & typewriter bio (speech synthesis completely removed)
// 6. Styled CRT forensic/cyber workstation background with dynamic ambient back-glow

"use strict";

// ── Global cursor tracking with capture ───────────────────────────────────────
if (typeof window !== "undefined" && !window.__cursorTrackerAttached) {
  window.__cursorTrackerAttached = true;
  window.__cursor = { x: 0.5, y: 0.5 };
  const update = (cx, cy) => {
    window.__cursor.x = Math.max(0, Math.min(1, cx / (window.innerWidth || 1)));
    window.__cursor.y = Math.max(0, Math.min(1, cy / (window.innerHeight || 1)));
  };
  window.addEventListener("pointermove", e => update(e.clientX, e.clientY), { passive: true, capture: true });
  window.addEventListener("mousemove", e => update(e.clientX, e.clientY), { passive: true, capture: true });
  window.addEventListener("touchmove", e => {
    if (e.touches && e.touches[0]) update(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true, capture: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// ── Image asset ───────────────────────────────────────────────────────────────
let avatarImg = null, imgReady = false;
{
  const img = new Image();
  img.src = "/scene/tex/ayush_nobg.png";
  img.onload = () => { avatarImg = img; imgReady = true; };
}

// ── Original Image Geometry (1024 × 588) ──────────────────────────────────────
const IMG_ORIG_W = 1024;
const IMG_ORIG_H = 588;

// ── Self-Intro Script ─────────────────────────────────────────────────────────
const LINES = [
  { ms:  1000, text: "Hey, I'm Ayush Tyagi.",           style: "title"  },
  { ms:  3500, text: "@Velqore",                         style: "handle" },
  { ms:  5500, text: "Forensic Scientist & Developer.",  style: "sub"    },
  { ms:  8500, text: "───────────────────────────────",  style: "rule"   },
  { ms:  9500, text: "K.R. Mangalam University",         style: "label"  },
  { ms: 11000, text: "B.Sc. Forensic Science (Hons)",    style: "value"  },
  { ms: 13500, text: "───────────────────────────────",  style: "rule"   },
  { ms: 14500, text: "Internships —",                    style: "label"  },
  { ms: 16000, text: "SIFS Lab  ·  Beyond Evidence",     style: "value"  },
  { ms: 18500, text: "Supreme Court of India",           style: "dim"    },
  { ms: 21000, text: "───────────────────────────────",  style: "rule"   },
  { ms: 22000, text: "Key Projects —",                   style: "label"  },
  { ms: 23500, text: "Pratyaksh-AI  ·  Aurex",           style: "accent" },
  { ms: 25500, text: "CyberRepo  ·  OSINT Research",     style: "accent" },
  { ms: 28000, text: "───────────────────────────────",  style: "rule"   },
  { ms: 29500, text: "\"Everything leaves a mark.\"",   style: "quote"  },
  { ms: 32000, text: "Observation is everything.",       style: "final"  },
];
const LOOP_MS = 40000;

// ── Draw Tech Cyber Background ────────────────────────────────────────────────
function drawBackground(g, W, H, sleeping, curX, curY, clock) {
  const bg = g.createLinearGradient(0, 0, W, H);
  if (sleeping) {
    bg.addColorStop(0, "#01040a");
    bg.addColorStop(0.6, "#020712");
    bg.addColorStop(1, "#010308");
  } else {
    bg.addColorStop(0, "#020914");
    bg.addColorStop(0.5, "#041224");
    bg.addColorStop(1, "#020a16");
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Subtle tech grid lines
  if (!sleeping) {
    g.save();
    g.strokeStyle = "rgba(40, 120, 200, 0.05)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.restore();

    // Dynamic ambient back-glow behind Ayush that gently follows cursor
    const glowX = W * 0.70 + (curX - 0.5) * 40;
    const glowY = H * 0.45 + (curY - 0.5) * 30;
    const glow = g.createRadialGradient(glowX, glowY, 30, glowX, glowY, W * 0.45);
    glow.addColorStop(0, "rgba(80, 160, 240, 0.16)");
    glow.addColorStop(0.4, "rgba(40, 90, 180, 0.07)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
  }

  // CRT scanlines
  for (let y = 0; y < H; y += 3) {
    g.fillStyle = "rgba(0, 0, 0, 0.08)";
    g.fillRect(0, y, W, 1);
  }

  // Corner brackets
  if (!sleeping) {
    g.save();
    g.strokeStyle = "rgba(60, 190, 255, 0.3)";
    g.lineWidth = 1.5;
    const L = 22;
    const corners = [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]];
    const dirs = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i], [dx, dy] = dirs[i];
      g.beginPath();
      g.moveTo(cx, cy + dy * L);
      g.lineTo(cx, cy);
      g.lineTo(cx + dx * L, cy);
      g.stroke();
    }
    g.restore();
  }
}

// ── Draw Ayush with 2.5D Head & Body Tracking (Pure, Authentic Photo) ──────────
function drawAyushAvatar(g, W, H, curX, curY, sleeping, clock) {
  if (!imgReady || !avatarImg) return;

  // Fit height to 96% of H, scale width proportionally
  const destH = H * 0.96;
  const scale = destH / IMG_ORIG_H;
  const destW = IMG_ORIG_W * scale;

  // Center Ayush's face (~x:510 in original) on the right side of the screen (~68% of W)
  const targetFaceX = W * 0.68;
  const destX = targetFaceX - (510 * scale);
  const destY = H - destH;

  g.save();

  // 2.5D Parallax & Head/Body Shift
  const pivotX = destX + (510 * scale);
  const pivotY = destY + (480 * scale);

  // Smooth cursor-driven motion
  const headShiftX = (curX - 0.5) * (sleeping ? 4 : 24);
  const headShiftY = (curY - 0.5) * (sleeping ? 3 : 16) + (sleeping ? 18 : 0);
  const tiltAngle  = (curX - 0.5) * (sleeping ? 0.015 : 0.045) + (sleeping ? 0.03 : 0);
  const breath     = Math.sin(clock / (sleeping ? 2800 : 1400)) * (sleeping ? 1.5 : 2.8);

  g.translate(pivotX + headShiftX, pivotY + headShiftY + breath);
  g.rotate(tiltAngle);
  g.translate(-pivotX, -pivotY);

  if (sleeping) g.globalAlpha = 0.52;

  // Soft ambient lighting behind silhouette
  if (!sleeping) {
    g.shadowColor = "rgba(70, 160, 240, 0.22)";
    g.shadowBlur = 35;
  }

  // Draw authentic photo cleanly without any artificial eye overlay
  g.drawImage(avatarImg, 0, 0, IMG_ORIG_W, IMG_ORIG_H, destX, destY, destW, destH);
  g.shadowBlur = 0;

  // Smooth fade at the bottom so t-shirt blends seamlessly into CRT bezel
  const fade = g.createLinearGradient(0, H - destH * 0.14, 0, H);
  fade.addColorStop(0, "rgba(0, 0, 0, 0)");
  fade.addColorStop(1, sleeping ? "rgba(1, 4, 10, 0.98)" : "rgba(2, 9, 20, 0.98)");
  g.fillStyle = fade;
  g.fillRect(destX - 25, H - destH * 0.14, destW + 50, destH * 0.15);

  g.restore();
}

// ── Forensic Telemetry HUD ────────────────────────────────────────────────────
function drawTelemetryHUD(g, W, H, clock, sleeping) {
  g.save();
  const startX = 32, startY = 48;

  // Header
  g.font = "bold 13px monospace";
  g.fillStyle = sleeping ? "rgba(90, 130, 170, 0.6)" : "rgba(70, 210, 255, 0.85)";
  g.textAlign = "left";
  g.fillText(sleeping ? "[STATUS: DORMANT // SLEEP CYCLE]" : "[STATUS: ONLINE // FORENSIC MONITOR]", startX, startY);

  // Pulse wave box
  const waveW = 240, waveH = 34;
  const waveY = startY + 12;
  g.fillStyle = "rgba(4, 15, 30, 0.55)";
  g.fillRect(startX, waveY, waveW, waveH);
  g.strokeStyle = "rgba(60, 160, 240, 0.25)";
  g.lineWidth = 1;
  g.strokeRect(startX, waveY, waveW, waveH);

  // Oscilloscope telemetry pulse
  g.beginPath();
  g.lineWidth = 1.5;
  g.strokeStyle = sleeping ? "rgba(60, 120, 190, 0.45)" : "rgba(60, 210, 255, 0.75)";

  const numPoints = 40;
  for (let i = 0; i < numPoints; i++) {
    const px = startX + (i / (numPoints - 1)) * waveW;
    let py = waveY + waveH * 0.5;
    if (sleeping) {
      py += Math.sin((clock / 900) + i * 0.2) * 2.5;
    } else {
      py += Math.sin((clock / 380) + i * 0.35) * 5.0;
    }
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.stroke();

  // Status badge
  g.font = "10px monospace";
  g.fillStyle = "rgba(120, 185, 225, 0.7)";
  g.fillText(sleeping ? "SYS: IDLE · LIGHT OFF" : "SYS: REAL-TIME TRACKING", startX + 6, waveY + waveH - 6);

  g.restore();
}

// ── Typewriter Bio Script ─────────────────────────────────────────────────────
function drawTypewriter(g, W, H, clock, sleeping) {
  if (sleeping) return;

  const loopT = clock % LOOP_MS;
  let y = 145;

  g.save();
  g.textAlign = "left";

  for (const line of LINES) {
    if (loopT < line.ms) break;

    const typeDur = 650;
    const progress = Math.min(1, (loopT - line.ms) / typeDur);
    const shown = line.text.slice(0, Math.ceil(line.text.length * progress));
    const cur   = progress < 1 ? "▌" : "";

    let font, color, dy;
    switch (line.style) {
      case "title":  font = "bold 22px monospace";   color = "#e6f4ff";              dy = 34; break;
      case "handle": font = "bold 17px monospace";   color = "rgba(70, 220, 190, 1)"; dy = 26; break;
      case "sub":    font = "400 13px monospace";    color = "rgba(180, 215, 245, 0.9)"; dy = 24; break;
      case "rule":   font = "400 11px monospace";    color = "rgba(60, 130, 200, 0.3)";  dy = 18; break;
      case "label":  font = "bold 12px monospace";   color = "rgba(90, 185, 255, 0.75)"; dy = 22; break;
      case "value":  font = "400 13px monospace";    color = "rgba(215, 230, 245, 0.9)"; dy = 24; break;
      case "dim":    font = "400 12px monospace";    color = "rgba(130, 155, 180, 0.65)"; dy = 20; break;
      case "accent": font = "bold 13px monospace";   color = "rgba(80, 220, 190, 0.9)";  dy = 24; break;
      case "quote":  font = "italic 14px Georgia, serif"; color = "rgba(230, 210, 160, 0.9)"; dy = 28; break;
      case "final":  font = "bold 15px monospace";   color = "#ffffff";              dy = 28;
        g.shadowColor = "rgba(255, 255, 255, 0.5)"; g.shadowBlur = 10;
        break;
      default:       font = "400 13px monospace";    color = "#ccc"; dy = 22;
    }

    g.font = font;
    g.fillStyle = color;
    if (line.style === "final") { g.shadowColor = "rgba(255, 255, 255, 0.5)"; g.shadowBlur = 10; }
    else { g.shadowBlur = 0; }

    g.fillText(shown + cur, 32, y);
    y += dy;
  }

  g.restore();
}

// ── Floating Sleep Z's ────────────────────────────────────────────────────────
function drawSleepZs(g, W, H, clock) {
  const zt = (clock / 2200) % 1;
  const zs = [
    { x: W * 0.65, y: H * 0.28, s: 18, phase: 0.0 },
    { x: W * 0.72, y: H * 0.19, s: 26, phase: 0.33 },
    { x: W * 0.79, y: H * 0.10, s: 34, phase: 0.66 },
  ];
  g.save();
  for (const z of zs) {
    const t = ((zt - z.phase) + 1) % 1;
    const alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
    g.globalAlpha = alpha * 0.92;
    g.font = `900 ${z.s}px sans-serif`;
    g.fillStyle = "rgba(90, 180, 255, 0.95)";
    g.shadowColor = "rgba(50, 140, 255, 0.8)";
    g.shadowBlur = 12;
    g.textAlign = "center";
    g.fillText("Z", z.x, z.y - t * 36);
  }

  // Sleep message in the center-left
  g.globalAlpha = 0.75;
  g.font = "italic 16px monospace";
  g.fillStyle = "rgba(100, 160, 220, 0.7)";
  g.textAlign = "left";
  g.fillText("— Table light is OFF —", 32, H * 0.48);
  g.font = "13px monospace";
  g.fillStyle = "rgba(80, 130, 180, 0.55)";
  g.fillText("Ayush is sleeping. Turn on the table lamp to wake him up.", 32, H * 0.48 + 26);

  g.restore();
}

// ── Bottom Status Bar ─────────────────────────────────────────────────────────
function drawStatusBar(g, W, H, sleeping) {
  // Vignette
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);

  // Status strip
  g.save();
  const bh = 34;
  g.fillStyle = "rgba(2, 9, 22, 0.85)";
  g.fillRect(0, H - bh, W, bh);
  g.strokeStyle = "rgba(60, 160, 255, 0.2)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, H - bh);
  g.lineTo(W, H - bh);
  g.stroke();

  g.font = "11px monospace";
  g.textAlign = "left";
  g.fillStyle = sleeping ? "rgba(80, 130, 180, 0.6)" : "rgba(90, 200, 255, 0.8)";
  g.fillText(sleeping ? "AYUSH TYAGI · @VELQORE · SLEEPING (DESK LAMP OFF)" : "AYUSH TYAGI  ·  @VELQORE  ·  FORENSIC SCIENTIST  ·  DEVELOPER", 20, H - 12);

  if (!sleeping) {
    g.textAlign = "right";
    g.fillStyle = "rgba(80, 220, 160, 0.8)";
    g.fillText("● LIVE · 2.5D PARALLAX TRACKING", W - 20, H - 12);
  }
  g.restore();
}

// ── Channel Export ────────────────────────────────────────────────────────────
export default {
  id: "avatar",
  title: "Ayush Tyagi",
  fill: false,

  mount({ ctx: g, width: W, height: H }) {
    let dead = false, clock = 0;
    let curXs = 0.5, curYs = 0.5;

    function frame(_t, dt = 16) {
      if (dead) return;
      clock += Math.min(dt, 80);

      // Check desk lamp state for sleep mode
      const isLampOn = window.__scene?.DESK?.on ?? true;
      const sleeping = !isLampOn;

      // Smooth cursor lerp
      const raw = window.__cursor || { x: 0.5, y: 0.5 };
      const speed = sleeping ? 0.02 : 0.12;
      curXs += (clamp(raw.x) - curXs) * speed;
      curYs += (clamp(raw.y) - curYs) * speed;

      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);

      // 1. Cyber / Forensic CRT Background
      drawBackground(g, W, H, sleeping, curXs, curYs, clock);

      // 2. Pure Authentic Ayush Avatar with 2.5D Head & Body Tracking
      drawAyushAvatar(g, W, H, curXs, curYs, sleeping, clock);

      // 3. Forensic Telemetry HUD
      drawTelemetryHUD(g, W, H, clock, sleeping);

      // 4. Typewriter Bio Intro
      drawTypewriter(g, W, H, clock, sleeping);

      // 5. Floating Z's when sleeping
      if (sleeping) drawSleepZs(g, W, H, clock);

      // 6. CRT Status Chrome
      drawStatusBar(g, W, H, sleeping);

      g.restore();
    }

    return {
      frame,
      stop() { dead = true; },
      input() {},
      get music() { return false; },
      clock: 0
    };
  },
};
