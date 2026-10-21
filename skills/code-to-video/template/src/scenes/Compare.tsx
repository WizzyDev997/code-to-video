import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "../engine";
import { t, type Metric, type Scene } from "../config";
import { C, F } from "../theme";
import { Count, Frame, Heading, Icon, Pill, clamp, ease, rise, useLayout } from "../ui";
import { useStage } from "./Screen";

type P<T> = { scene: Extract<Scene, { type: T }>; lang: string; dur: number };

const MetricRow: React.FC<{ m: Metric; lang: string; at: number; big?: boolean; compact?: boolean }> = ({ m, lang, at, big, compact }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = rise(frame, at, 16);
  const better = m.better ?? (m.after < m.before ? "lower" : "higher");
  const good = better === "lower" ? m.after <= m.before : m.after >= m.before;
  const unit = t(m.unit, lang);
  const k = big ? 1.35 : compact ? 0.72 : 1;
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)`, padding: `${16 * u}px 0`, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ fontFamily: F.mono, fontSize: 19 * u * k, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>{t(m.label, lang)}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 * u, marginTop: 6 * u, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: F.sans, fontSize: 40 * u * k, fontWeight: 600, color: C.muted, textDecoration: "line-through", textDecorationColor: C.bad, opacity: 0.8 }}>
          {m.before.toLocaleString("en-US", { maximumFractionDigits: m.decimals ?? 0 })}{unit && ` ${unit}`}
        </span>
        <span style={{ color: C.muted, alignSelf: "center" }}><Icon name="arrow" size={30 * u * k} /></span>
        <span style={{ fontFamily: F.sans, fontSize: 70 * u * k, fontWeight: 700, letterSpacing: "-0.03em", color: good ? C.good : C.bad }}>
          <Count from={m.before} to={m.after} at={at + 6} decimals={m.decimals ?? 0} />{unit && <span style={{ fontSize: 34 * u * k }}> {unit}</span>}
        </span>
      </div>
    </div>
  );
};

// The same screen before and after, a wipe between them, and the numbers that changed
export const Compare: React.FC<P<"compare">> = ({ scene, lang, dur }) => {
  const frame = useCurrentFrame();
  const aspect = scene.aspect ?? 1.6;
  const hasHead = !!(scene.eyebrow || scene.title);
  const metrics = scene.metrics ?? [];
  const { width, height, u: u0 } = useLayout();
  const stack = width / height < 1.4;
  const tall = height > width * 1.1;
  // wide: numbers beside the window; tall: a column of big numbers under it; square: one row under it
  const side = metrics.length ? (tall ? 150 * u0 * metrics.length : stack ? 190 * u0 : 520 * u0) : 0;
  const { pad, top, w, u } = useStage(hasHead, aspect, side);
  const portrait = stack;
  const wipeAt = Math.round(dur * 0.3), wipeEnd = Math.round(dur * 0.55);
  const p = interpolate(frame, [wipeAt, wipeEnd], [0, 1], { ...clamp, easing: ease });
  const win = rise(frame, 6, 22);
  const panel = (
    <div style={portrait && !tall
      ? { width: w, display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, columnGap: 28 * u }
      : { width: tall ? w : side - 50 * u, display: "flex", flexDirection: "column" }}>
      {metrics.map((m, i) => <MetricRow key={i} m={m} lang={lang} at={wipeAt + i * 8} compact={portrait && !tall} />)}
      {scene.source && <div style={{ gridColumn: "1 / -1", marginTop: 14 * u, fontFamily: F.mono, fontSize: 17 * u, color: C.muted, opacity: rise(frame, wipeEnd) }}>{t(scene.source, lang)}</div>}
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: pad, right: pad, top: 70 * u }}>
        <Heading eyebrow={t(scene.eyebrow, lang)} title={t(scene.title, lang)} />
      </div>
      <div style={{ position: "absolute", left: pad, right: pad, top, display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: (portrait ? 26 : 50) * u }}>
        <div style={{ position: "relative", opacity: win, transform: `translateY(${(1 - win) * 30}px)` }}>
          <Frame url={scene.url} width={w} aspect={aspect}>
            <Img src={staticFile(scene.before.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} />
            <Img src={staticFile(scene.after.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />
            {p > 0 && p < 1 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100}%`, width: 4 * u, marginLeft: -2 * u, background: C.accent }} />}
          </Frame>
          <div style={{ position: "absolute", top: 60 * u, left: 16 * u, opacity: 1 - p }}><Pill>{t(scene.before.label, lang)}</Pill></div>
          <div style={{ position: "absolute", top: 60 * u, right: 16 * u, opacity: p }}><Pill tone="accent">{t(scene.after.label, lang)}</Pill></div>
          {scene.tag && <div style={{ position: "absolute", bottom: 16 * u, right: 16 * u }}><Pill>{t(scene.tag, lang)}</Pill></div>}
        </div>
        {metrics.length > 0 && panel}
      </div>
    </AbsoluteFill>
  );
};

// Before and after numbers on their own, with where they come from
export const Metrics: React.FC<P<"metrics">> = ({ scene, lang }) => {
  const frame = useCurrentFrame();
  const { u, width, portrait } = useLayout();
  const cols = portrait ? 1 : Math.min(scene.metrics.length, scene.metrics.length > 3 ? 2 : scene.metrics.length);
  return (
    <AbsoluteFill style={{ padding: `${70 * u}px ${80 * u}px`, justifyContent: "center" }}>
      <Heading eyebrow={t(scene.eyebrow, lang)} title={t(scene.title, lang)} />
      <div style={{ marginTop: 40 * u, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 60 * u, width: width - 160 * u }}>
        {scene.metrics.map((m, i) => <MetricRow key={i} m={m} lang={lang} at={20 + i * 10} big />)}
      </div>
      {scene.source && <div style={{ marginTop: 30 * u, fontFamily: F.mono, fontSize: 19 * u, color: C.muted, opacity: rise(frame, 50) }}>{t(scene.source, lang)}</div>}
    </AbsoluteFill>
  );
};
