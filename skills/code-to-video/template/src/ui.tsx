import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "./engine";
import { C, F } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);

// Layout unit: 1 at 1080 px on the short side, so one design serves 16:9, 9:16 and 1:1
export const useLayout = () => {
  const { width, height, fps } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return { width, height, fps, u, portrait: height > width * 1.1, square: Math.abs(width - height) < 10 };
};

export const useSpring = (delay: number, config = { damping: 200, mass: 0.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
};

export const rise = (frame: number, at: number, dur = 18) => interpolate(frame - at, [0, dur], [0, 1], { ...clamp, easing: ease });

// Background: the theme colour with a faint drafting grid drifting slowly
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = frame * 0.15;
  return (
    <AbsoluteFill style={{ background: C.background }}>
      {C.grid && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            backgroundPosition: `${-drift}px ${-drift * 0.5}px`,
            opacity: 0.45,
          }}
        />
      )}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${C.background}ee 0%, ${C.background}88 55%, ${C.background}00 100%)` }} />
    </AbsoluteFill>
  );
};

// Cross-fade wrapper: in over `fin` frames, out over the last `fout` frames
export const Fade: React.FC<{ dur: number; fin: number; fout: number; children: React.ReactNode }> = ({ dur, fin, fout, children }) => {
  const frame = useCurrentFrame();
  const a = fin ? interpolate(frame, [0, fin], [0, 1], clamp) : 1;
  const b = fout ? interpolate(frame, [dur - fout, dur], [1, 0], clamp) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
};

// Word-by-word rise
export const Words: React.FC<{ text: string; delay: number; stagger?: number; style?: React.CSSProperties }> = ({ text, delay, stagger = 3, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", ...style }}>
      {text.split(" ").map((w, i) => {
        const p = rise(frame, delay + i * stagger);
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 0.5}em)`, filter: `blur(${(1 - p) * 6}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { u } = useLayout();
  return <div style={{ fontFamily: F.mono, fontSize: 24 * u, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, ...style }}>{children}</div>;
};

export const Pill: React.FC<{ children: React.ReactNode; tone?: "accent" | "ink" | "good" | "bad"; style?: React.CSSProperties }> = ({ children, tone = "ink", style }) => {
  const { u } = useLayout();
  const bg = tone === "accent" ? C.accent : tone === "good" ? C.good : tone === "bad" ? C.bad : C.ink;
  const fg = tone === "accent" ? C.accentInk : "#fff";
  return <span style={{ fontFamily: F.mono, fontSize: 17 * u, letterSpacing: "0.08em", textTransform: "uppercase", background: bg, color: fg, borderRadius: 8 * u, padding: `${6 * u}px ${12 * u}px`, whiteSpace: "nowrap", ...style }}>{children}</span>;
};

// A browser window around a real screenshot or screen recording
export const Frame: React.FC<{ url?: string; width: number; aspect: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ url, width, aspect, children, style }) => {
  const { u } = useLayout();
  const bar = 44 * u;
  return (
    <div style={{ width, borderRadius: 18 * u, overflow: "hidden", background: C.surface, border: `1px solid ${C.line}`, boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,0.16)`, ...style }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 9 * u, padding: `0 ${18 * u}px`, borderBottom: `1px solid ${C.line}` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 13 * u, height: 13 * u, borderRadius: "50%", background: C.line }} />)}
        {url && <span style={{ marginLeft: 14 * u, fontFamily: F.mono, fontSize: 16 * u, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8 * u, padding: `${4 * u}px ${14 * u}px` }}>{url}</span>}
      </div>
      <div style={{ position: "relative", width, height: width / aspect, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// Animated number between two values (counts once, then holds)
export const Count: React.FC<{ from: number; to: number; at: number; dur?: number; decimals?: number; style?: React.CSSProperties }> = ({ from, to, at, dur = 30, decimals = 0, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - at, [0, dur], [0, 1], { ...clamp, easing: ease });
  const v = from + (to - from) * p;
  return <span style={style}>{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
};

const PATHS: Record<string, string> = {
  check: "M20 6 9 17l-5-5",
  bolt: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  chart: "M3 3v18h18M7 14l3-4 3 3 5-7",
  chat: "M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  search: "m21 21-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  sparkle: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z",
  data: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  arrow: "M5 12h14M13 6l6 6-6 6",
};
export const Icon: React.FC<{ name?: string; size: number; color?: string }> = ({ name = "check", size, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={PATHS[name] ?? PATHS.check} />
  </svg>
);

export const Heading: React.FC<{ eyebrow?: string; title?: string; delay?: number; align?: "left" | "center" }> = ({ eyebrow, title, delay = 0, align = "left" }) => {
  const frame = useCurrentFrame();
  const { u, portrait } = useLayout();
  if (!eyebrow && !title) return null;
  const p = rise(frame, delay);
  return (
    <div style={{ textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      {eyebrow && <Eyebrow style={{ marginBottom: 14 * u }}>{eyebrow}</Eyebrow>}
      {title && <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: (portrait ? 58 : 60) * u, letterSpacing: "-0.03em", lineHeight: 1.1, color: C.ink }}>{title}</div>}
    </div>
  );
};
