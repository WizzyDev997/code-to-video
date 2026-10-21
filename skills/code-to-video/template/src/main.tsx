// The page. Two modes:
//   ?format=16x9&lang=en           one stage at its real size, driven frame by frame by scripts/render.mjs
//   ?format=16x9&lang=en&player=1  a preview player: play, scrub, switch format and language (npm run studio)
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { FrameProvider, staticFile, getStaticFiles } from "./engine";
import { config, FORMATS, timeline } from "./config";
import { Video } from "./Video";

declare global {
  interface Window { __setFrame: (f: number) => Promise<number>; __TOTAL__: number; __SIZE__: { width: number; height: number } }
}

const q = new URLSearchParams(location.search);
const format = Object.values(FORMATS).find((f) => f.id === q.get("format")) ?? FORMATS[config.formats[0]];
const lang = q.get("lang") ?? config.languages[0];
const { total } = timeline();
const vc = { fps: config.fps, width: format.width, height: format.height, durationInFrames: total };
window.__TOTAL__ = total;
window.__SIZE__ = { width: format.width, height: format.height };

const Stage: React.FC<{ frame: number }> = ({ frame }) => (
  <div id="stage" style={{ position: "relative", width: format.width, height: format.height, overflow: "hidden" }}>
    <FrameProvider frame={frame} config={vc}><Video lang={lang} /></FrameProvider>
  </div>
);

// ---------- render mode ----------

async function settle() {
  await document.fonts.ready;
  await Promise.all([...document.images].map((im) => (im.complete ? im.decode().catch(() => {}) : new Promise((r) => { im.onload = im.onerror = r; }))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ---------- player mode ----------

const btn: React.CSSProperties = { font: "600 13px system-ui", padding: "7px 12px", borderRadius: 8, border: "1px solid #3a3f4b", background: "#1d2129", color: "#fff", cursor: "pointer" };
const Player: React.FC = () => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const hasAudio = getStaticFiles().some((f) => f.name === `audio-${lang}.mp3`);
  useEffect(() => {
    const fit = () => setScale(Math.min((innerWidth - 40) / format.width, (innerHeight - 110) / format.height));
    fit(); addEventListener("resize", fit); return () => removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    if (!playing) { audio.current?.pause(); return; }
    const start = performance.now() - (frame / config.fps) * 1000;
    if (audio.current) { audio.current.currentTime = frame / config.fps; audio.current.play().catch(() => {}); }
    let id = 0;
    const tick = () => {
      const f = Math.floor(((performance.now() - start) / 1000) * config.fps);
      if (f >= total) { setPlaying(false); setFrame(total - 1); return; }
      setFrame(f); id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (k: string, v: string) => { const u = new URLSearchParams(location.search); u.set(k, v); location.search = u.toString(); };
  return (
    <div style={{ minHeight: "100vh", background: "#0e1015", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 20, font: "13px system-ui" }}>
      <div style={{ width: format.width * scale, height: format.height * scale, boxShadow: "0 10px 40px rgba(0,0,0,.5)" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}><Stage frame={frame} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", width: Math.max(600, format.width * scale) }}>
        <button style={btn} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        <input type="range" min={0} max={total - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }} style={{ flex: 1 }} />
        <span style={{ fontFamily: "ui-monospace, monospace", minWidth: 120 }}>{(frame / config.fps).toFixed(2)} s · {frame}/{total - 1}</span>
        <select style={btn} value={format.id} onChange={(e) => go("format", e.target.value)}>{config.formats.map((f) => <option key={f} value={FORMATS[f].id}>{f}</option>)}</select>
        <select style={btn} value={lang} onChange={(e) => go("lang", e.target.value)}>{config.languages.map((l) => <option key={l}>{l}</option>)}</select>
      </div>
      {hasAudio && <audio ref={audio} src={staticFile(`audio-${lang}.mp3`)} preload="auto" />}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
if (q.get("player")) {
  root.render(<Player />);
} else {
  // Render one frame synchronously, then wait until fonts and images are ready: the screenshot never
  // catches a half-loaded frame.
  window.__setFrame = async (f: number) => {
    flushSync(() => root.render(<Stage frame={f} />));
    await settle();
    return f;
  };
  window.__setFrame(Number(q.get("frame") ?? 0));
}
