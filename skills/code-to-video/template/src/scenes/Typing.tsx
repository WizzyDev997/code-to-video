import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "../engine";
import { t, type Scene } from "../config";
import { C, F } from "../theme";
import { Frame, Heading, Icon, rise, useLayout } from "../ui";
import { useStage } from "./Screen";

type P<T> = { scene: Extract<Scene, { type: T }>; lang: string; dur: number };

// Someone types a request into the product (search box, command bar, chat) and the answer appears.
// Show only requests the product really handles: the reply lines come from a real run.
export const Typing: React.FC<P<"typing">> = ({ scene, lang }) => {
  const frame = useCurrentFrame();
  const { u, width } = useLayout();
  const prompt = t(scene.prompt, lang);
  const typeStart = 18, cps = 1.4; // characters per frame
  const shown = Math.max(0, Math.min(prompt.length, Math.floor((frame - typeStart) * cps)));
  const sentAt = typeStart + Math.ceil(prompt.length / cps) + 10;
  const replies = scene.reply ?? [];
  const aspect = scene.aspect ?? 1.6;
  const hasHead = !!(scene.eyebrow || scene.title);
  const cardH = (150 + replies.length * 72) * u;
  const probe = useStage(hasHead, aspect, 0);
  const { pad, top, w, stacked } = useStage(hasHead, aspect, scene.image ? (probe.stacked ? cardH + 46 * u : 700 * u) : 0);
  const card = (
    <div style={{ width: stacked ? Math.min(width - 2 * pad, scene.image ? Math.max(w, 700 * u) : 900 * u) : 640 * u, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20 * u, padding: 30 * u, boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,0.12)` }}>
      <div style={{ display: "flex", gap: 14 * u, alignItems: "center", border: `2px solid ${C.accent}`, borderRadius: 14 * u, padding: `${16 * u}px ${20 * u}px`, fontFamily: F.sans, fontSize: 32 * u, color: C.ink, minHeight: 50 * u }}>
        <Icon name="chat" size={30 * u} color={C.accent} />
        <span>{prompt.slice(0, shown)}<span style={{ opacity: frame < sentAt && Math.floor(frame / 8) % 2 === 0 ? 1 : 0, color: C.accent }}>|</span></span>
      </div>
      {replies.map((r, i) => {
        const a = rise(frame, sentAt + 12 + i * 12, 16);
        return (
          <div key={i} style={{ marginTop: 18 * u, opacity: a, transform: `translateY(${(1 - a) * 14}px)`, display: "flex", gap: 14 * u, alignItems: "flex-start", fontFamily: F.sans, fontSize: 28 * u, lineHeight: 1.35, color: C.ink }}>
            <span style={{ color: C.good, marginTop: 4 * u }}><Icon name="check" size={28 * u} /></span>
            <span>{t(r, lang)}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: pad, right: pad, top: 70 * u }}>
        <Heading eyebrow={t(scene.eyebrow, lang)} title={t(scene.title, lang)} />
      </div>
      <div style={{ position: "absolute", left: pad, right: pad, top, display: "flex", flexDirection: stacked ? "column" : "row", gap: 46 * u, alignItems: "center", justifyContent: "center" }}>
        {card}
        {scene.image && (
          <div style={{ opacity: rise(frame, sentAt + 6, 20) }}>
            <Frame url={scene.url} width={w} aspect={aspect}><Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} /></Frame>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// What else the product does, one line each
export const Features: React.FC<P<"features">> = ({ scene, lang }) => {
  const frame = useCurrentFrame();
  const { u, width, portrait } = useLayout();
  const cols = portrait ? 1 : scene.items.length > 4 ? 3 : 2;
  return (
    <AbsoluteFill style={{ padding: `${70 * u}px ${80 * u}px`, justifyContent: "center" }}>
      <Heading eyebrow={t(scene.eyebrow, lang)} title={t(scene.title, lang)} />
      <div style={{ marginTop: 46 * u, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 28 * u, width: width - 160 * u }}>
        {scene.items.map((it, i) => {
          const a = rise(frame, 16 + i * 7, 18);
          return (
            <div key={i} style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)`, display: "flex", gap: 22 * u, alignItems: "flex-start", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18 * u, padding: 28 * u }}>
              <span style={{ flexShrink: 0, width: 66 * u, height: 66 * u, borderRadius: "50%", background: C.accent, color: C.accentInk, display: "grid", placeItems: "center" }}><Icon name={it.icon} size={34 * u} /></span>
              <div>
                <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34 * u, color: C.ink, lineHeight: 1.2 }}>{t(it.title, lang)}</div>
                {it.text && <div style={{ marginTop: 8 * u, fontFamily: F.sans, fontSize: 25 * u, color: C.muted, lineHeight: 1.35 }}>{t(it.text, lang)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
