import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "../engine";
import { t, type Scene } from "../config";
import { C, F } from "../theme";
import { Eyebrow, Words, rise, useLayout, useSpring } from "../ui";

type P<T> = { scene: Extract<Scene, { type: T }>; lang: string; dur: number };

// Opening line: the problem or the promise, in the viewer's words
export const Title: React.FC<P<"title">> = ({ scene, lang }) => {
  const frame = useCurrentFrame();
  const { u, width } = useLayout();
  const logo = useSpring(2, { damping: 18, mass: 0.9 });
  const sub = rise(frame, 46);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * u }}>
      <div style={{ width: Math.min(width - 160 * u, 1640 * u), textAlign: "center" }}>
        {scene.logo && <Img src={staticFile(scene.logo)} style={{ height: 96 * u, marginBottom: 44 * u, opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }} />}
        {scene.eyebrow && <Eyebrow style={{ marginBottom: 26 * u, opacity: rise(frame, 6) }}>{t(scene.eyebrow, lang)}</Eyebrow>}
        <Words text={t(scene.title, lang)} delay={14} style={{ justifyContent: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 104 * u, letterSpacing: "-0.03em", lineHeight: 1.08, color: C.ink }} />
        {scene.accent && <Words text={t(scene.accent, lang)} delay={30} stagger={4} style={{ justifyContent: "center", fontFamily: F.sans, fontWeight: 800, fontSize: 104 * u, letterSpacing: "-0.03em", lineHeight: 1.08, color: C.accent }} />}
        {scene.subtitle && <div style={{ marginTop: 34 * u, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`, fontFamily: F.sans, fontSize: 38 * u, color: C.muted, lineHeight: 1.35 }}>{t(scene.subtitle, lang)}</div>}
      </div>
    </AbsoluteFill>
  );
};

// Closing card: the name, the promise, where to try it
export const Outro: React.FC<P<"outro">> = ({ scene, lang }) => {
  const frame = useCurrentFrame();
  const { u, width } = useLayout();
  const logo = useSpring(0, { damping: 18, mass: 0.9 });
  const sub = rise(frame, 30), foot = rise(frame, 52);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * u }}>
      <div style={{ width: Math.min(width - 160 * u, 1700 * u), textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {scene.logo && <Img src={staticFile(scene.logo)} style={{ height: 110 * u, marginBottom: 46 * u, opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }} />}
        <Words text={t(scene.title, lang)} delay={8} stagger={5} style={{ justifyContent: "center", fontFamily: F.sans, fontWeight: 800, fontSize: 124 * u, letterSpacing: "-0.04em", lineHeight: 1.02, color: C.ink }} />
        {scene.subtitle && <div style={{ marginTop: 28 * u, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`, fontFamily: F.sans, fontWeight: 600, fontSize: 44 * u, color: C.muted }}>{t(scene.subtitle, lang)}</div>}
        {scene.url && (
          <div style={{ marginTop: 54 * u, opacity: foot, transform: `translateY(${(1 - foot) * 16}px)`, fontFamily: F.mono, fontSize: 38 * u, fontWeight: 600, color: C.ink, border: `2px solid ${C.accent}`, borderRadius: 14 * u, padding: `${16 * u}px ${30 * u}px`, background: C.surface }}>
            {scene.url}
          </div>
        )}
        {scene.note && <div style={{ marginTop: 34 * u, opacity: foot * 0.9, fontFamily: F.mono, fontSize: 22 * u, color: C.muted, letterSpacing: "0.04em" }}>{t(scene.note, lang)}</div>}
      </div>
    </AbsoluteFill>
  );
};
