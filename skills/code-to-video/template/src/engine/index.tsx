// The frame engine. Time never flows by itself: the renderer sets a frame number, React renders that
// exact frame, Playwright photographs it, ffmpeg encodes the photographs. Every scene reads time
// with useCurrentFrame() and derives everything else from it, so a frame always looks the same.
import React, { createContext, useContext } from "react";

export type VideoConfig = { fps: number; width: number; height: number; durationInFrames: number };

const FrameCtx = createContext(0);
const ConfigCtx = createContext<VideoConfig>({ fps: 30, width: 1920, height: 1080, durationInFrames: 1 });

export const FrameProvider: React.FC<{ frame: number; config: VideoConfig; children: React.ReactNode }> = ({ frame, config, children }) => (
  <ConfigCtx.Provider value={config}>
    <FrameCtx.Provider value={frame}>{children}</FrameCtx.Provider>
  </ConfigCtx.Provider>
);

export const useCurrentFrame = () => useContext(FrameCtx);
export const useVideoConfig = () => useContext(ConfigCtx);

// ---------- layout ----------

export const AbsoluteFill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, ...rest }) => (
  <div {...rest} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", ...style }} />
);

// Children see the frame relative to `from` and are not rendered outside [from, from + duration)
export const Sequence: React.FC<{ from?: number; durationInFrames?: number; children: React.ReactNode }> = ({ from = 0, durationInFrames = Infinity, children }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= from + durationInFrames) return null;
  return <AbsoluteFill><FrameCtx.Provider value={frame - from}>{children}</FrameCtx.Provider></AbsoluteFill>;
};

// ---------- assets ----------

declare global { interface Window { __STATIC_FILES__?: string[] } }
export const staticFile = (name: string) => `/${name.replace(/^\/+/, "")}`;
export const getStaticFiles = () => (window.__STATIC_FILES__ ?? []).map((name) => ({ name, src: staticFile(name) }));
export const Img: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => <img {...props} />;

// A screen recording, played as the image sequence capture.mjs extracted (public/<dir>/00001.jpg...).
// An image per frame is exact and needs no video codec in the headless browser.
export const Recording: React.FC<{ dir: string; fps?: number; playbackRate?: number; startFrom?: number; style?: React.CSSProperties }> = ({ dir, fps = 30, playbackRate = 1, startFrom = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps: videoFps } = useVideoConfig();
  const prefix = dir.replace(/^\/+|\/+$/g, "") + "/";
  const count = (window.__STATIC_FILES__ ?? []).filter((f) => f.startsWith(prefix) && /^\d+\.jpg$/.test(f.slice(prefix.length))).length;
  const i = Math.max(1, Math.min(count || 1, Math.floor((startFrom + (frame / videoFps) * playbackRate) * fps) + 1));
  return <img src={staticFile(`${prefix}${String(i).padStart(5, "0")}.jpg`)} style={style} />;
};

// ---------- interpolate ----------

type Extrapolate = "extend" | "clamp" | "identity";
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: { easing?: (t: number) => number; extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate } = {},
): number {
  const { easing = (t: number) => t, extrapolateLeft = "extend", extrapolateRight = "extend" } = options;
  let i = 1;
  while (i < inputRange.length - 1 && input > inputRange[i]) i++;
  const inMin = inputRange[i - 1], inMax = inputRange[i];
  const outMin = outputRange[i - 1], outMax = outputRange[i];
  let x = input;
  if (x < inMin) { if (extrapolateLeft === "clamp") x = inMin; else if (extrapolateLeft === "identity") return x; }
  if (x > inMax) { if (extrapolateRight === "clamp") x = inMax; else if (extrapolateRight === "identity") return x; }
  if (outMin === outMax) return outMin;
  const t = inMax === inMin ? 0 : (x - inMin) / (inMax - inMin);
  return outMin + easing(t) * (outMax - outMin);
}

// ---------- easing ----------

// Cubic Bézier timing function, like CSS cubic-bezier(x1, y1, x2, y2)
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a, B = (a: number, b: number) => 3 * b - 6 * a, Cc = (a: number) => 3 * a;
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + Cc(a)) * t;
  const slope = (t: number, a: number, b: number) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + Cc(a);
  const tForX = (x: number) => {
    let t = x;
    for (let k = 0; k < 8; k++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-7) break; t -= (calc(t, x1, x2) - x) / s; }
    if (t < 0 || t > 1 || Math.abs(calc(t, x1, x2) - x) > 1e-6) {
      let lo = 0, hi = 1; t = x;
      for (let k = 0; k < 40; k++) { const v = calc(t, x1, x2); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : calc(tForX(x), y1, y2));
}
export const Easing = {
  linear: (t: number) => t,
  bezier,
  ease: bezier(0.25, 0.1, 0.25, 1),
  out: (e: (t: number) => number) => (t: number) => 1 - e(1 - t),
  inOut: (e: (t: number) => number) => (t: number) => (t < 0.5 ? e(t * 2) / 2 : 1 - e((1 - t) * 2) / 2),
};

// ---------- spring ----------

// A damped spring from 0 to 1, advanced one frame at a time, then mapped to [from, to]. Two regimes:
// oscillating (damping ratio < 1) and the critically damped curve for everything else, so heavily
// damped springs settle briskly instead of crawling towards the target.
export function spring({ frame, fps, config = {}, from = 0, to = 1, delay = 0 }: {
  frame: number; fps: number; from?: number; to?: number; delay?: number;
  config?: { damping?: number; mass?: number; stiffness?: number; overshootClamping?: boolean };
}): number {
  const c = config.damping ?? 10, m = config.mass ?? 1, k = config.stiffness ?? 100;
  const f = Math.max(0, frame - delay);
  const zeta = c / (2 * Math.sqrt(k * m));
  const w0 = Math.sqrt(k / m);
  const w1 = w0 * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  let x = 0, v = 0;
  const step = (dt: number) => {
    if (dt <= 0) return;
    const x0 = 1 - x, v0 = -v;
    if (zeta < 1) {
      const env = Math.exp(-zeta * w0 * dt), s = Math.sin(w1 * dt), co = Math.cos(w1 * dt);
      const frag = env * (s * ((v0 + zeta * w0 * x0) / w1) + x0 * co);
      x = 1 - frag;
      v = zeta * w0 * frag - env * (co * (v0 + zeta * w0 * x0) - w1 * x0 * s);
    } else {
      const env = Math.exp(-w0 * dt);
      x = 1 - env * (x0 + (v0 + w0 * x0) * dt);
      v = env * (v0 * (dt * w0 - 1) + dt * x0 * w0 * w0);
    }
  };
  const whole = Math.floor(f);
  for (let i = 1; i <= whole; i++) step(Math.min(1 / fps, 0.064));
  if (f % 1 > 0) step((f - whole) / fps);
  const r = config.overshootClamping ? Math.min(x, 1) : x;
  return from + (to - from) * r;
}
