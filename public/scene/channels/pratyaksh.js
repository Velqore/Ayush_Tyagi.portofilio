// Pratyaksh-AI Tape Channel for CRT TV
// Plays the forensic showcase video from /scene/video/pratyaksh.mp4

export default {
  id: "pratyaksh",
  title: "Pratyaksh-AI",
  fill: true,
  length: 60,

  mount({ canvas, ctx: g, width: W, height: H, audio }) {
    let dead = false;
    let clock = 0;
    let videoReady = false;
    let audioConnected = false;

    // Create hidden video element
    const v = document.createElement("video");
    v.src = "/scene/video/pratyaksh.mp4";
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.loop = true;
    v.muted = !audio; // unmute if audio graph will handle it, else muted to satisfy autoplay
    v.autoplay = true;
    v.style.position = "fixed";
    v.style.top = "-9999px";
    v.style.left = "-9999px";
    v.style.opacity = "0";
    v.style.pointerEvents = "none";
    document.body.appendChild(v);

    v.addEventListener("loadeddata", () => {
      videoReady = true;
    });

    v.addEventListener("canplay", () => {
      videoReady = true;
      v.play().catch(() => {});
    });

    // WebAudio routing if provided
    if (audio && audio.ctx && audio.out) {
      try {
        const srcNode = audio.ctx.createMediaElementSource(v);
        srcNode.connect(audio.out);
        v.muted = false;
        audioConnected = true;
      } catch (e) {
        console.warn("Pratyaksh audio routing failed, falling back to muted video", e);
        v.muted = true;
      }
    }

    v.play().catch(() => {});

    function frame(t, dt = 16) {
      if (dead) return;
      clock += dt / 1000;

      // Ensure playback
      if (v.paused && !dead) {
        v.play().catch(() => {});
      }

      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);

      // 1. Dark background
      g.fillStyle = "#030810";
      g.fillRect(0, 0, W, H);

      // 2. Render video frame
      if (v.readyState >= 2) {
        const vw = v.videoWidth || W;
        const vh = v.videoHeight || H;
        const vAspect = vw / vh;
        const screenAspect = W / H;

        let dw = W, dh = H, dx = 0, dy = 0;
        if (vAspect > screenAspect) {
          // Video is wider than screen: fit width
          dw = W;
          dh = W / vAspect;
          dy = (H - dh) / 2;
        } else {
          // Video is taller than screen: fit height
          dh = H;
          dw = H * vAspect;
          dx = (W - dw) / 2;
        }

        g.drawImage(v, dx, dy, dw, dh);
      } else {
        // Loading state
        g.fillStyle = "rgba(70, 210, 255, 0.85)";
        g.font = "bold 20px monospace";
        g.textAlign = "center";
        g.fillText("LOADING PRATYAKSH-AI TAPE...", W / 2, H / 2);
      }

      // 3. Retro Forensic HUD Overlay
      g.save();
      // Scanline tint
      g.fillStyle = "rgba(0, 20, 40, 0.15)";
      g.fillRect(0, 0, W, H);

      // Header Tag
      g.font = "bold 13px monospace";
      g.fillStyle = "rgba(80, 230, 255, 0.9)";
      g.textAlign = "left";
      const recBlink = Math.floor(clock * 2) % 2 === 0;
      g.fillText(recBlink ? "● PLAY [PRATYAKSH-AI // FORENSIC PLATFORM]" : "  PLAY [PRATYAKSH-AI // FORENSIC PLATFORM]", 28, 42);

      // Right-side timecode
      const curSec = Math.floor(v.currentTime || clock);
      const mm = String(Math.floor(curSec / 60)).padStart(2, "0");
      const ss = String(curSec % 60).padStart(2, "0");
      g.textAlign = "right";
      g.fillStyle = "rgba(120, 220, 180, 0.85)";
      g.fillText(`SP ${mm}:${ss} VHS-HQ`, W - 28, 42);

      // Bottom info bar
      g.fillStyle = "rgba(2, 8, 18, 0.75)";
      g.fillRect(0, H - 36, W, 36);
      g.strokeStyle = "rgba(60, 180, 240, 0.25)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, H - 36);
      g.lineTo(W, H - 36);
      g.stroke();

      g.font = "11px monospace";
      g.fillStyle = "rgba(160, 220, 255, 0.8)";
      g.textAlign = "left";
      g.fillText("PATENT 2024/0103322A · QUESTIONED DOCS · CYBER FORENSICS · FINGERPRINTS", 24, H - 14);

      g.textAlign = "right";
      g.fillStyle = "rgba(80, 240, 190, 0.85)";
      g.fillText("pratyaksh-ai.vercel.app ↗", W - 24, H - 14);

      g.restore();
      g.restore();
    }

    function input(ev) {
      if (!ev || dead) return;
      if (ev.type === "stop") {
        try { v.pause(); } catch (e) {}
      } else if (ev.type === "play") {
        try { v.play().catch(() => {}); } catch (e) {}
      }
    }

    function stop() {
      dead = true;
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch (e) {}
      if (v.parentNode) {
        v.parentNode.removeChild(v);
      }
    }

    return {
      frame,
      input,
      stop,
      get clock() { return v.currentTime || clock; },
      get music() { return false; }
    };
  }
};
