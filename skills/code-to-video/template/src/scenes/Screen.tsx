import React from "react";
import { AbsoluteFill, Img, Recording, interpolate, staticFile, useCurrentFrame } from "../engine";
import { t, type Focus, type Scene } from "../config";
import { C, F } from "../theme";
import { Frame, Heading, Pill, clamp, ease, rise, useLayout } from "../ui";

type P<T> = { scene: Extract<Scene, { type: T }>; lang: string; dur: number };

// Where the window goes: heading on top, the window as large as the format allows, caption under it
// `side` is the room another block needs next to the window: beside it on a wide format, above or
// below it when the format is tall or square (stacked)
export const useStage = (hasHeading: boolean, aspect: number, side = 0, hasCaption = false) => {
  const { width, height, u, portrait } = useLayout();
  const stacked = width / height < 1.4;
  const pad = 80 * u;
  const top = hasHeading ? (portrait ? 330 : 205) * u : 90 * u;
  const bottom = (hasCaption ? 230 : 150) * u; // room for the caption line and the subtitles under it
  const bar = 44 * u;
  const availW = width - pad * 2 - (stacked ? 0 : side);
  const availH = height - top - bottom - bar - (stacked ? side : 0);
  const w = Math.min(availW, availH * aspect);
  return { pad, top, w, u, portrait, stacked };
};

const DEFAULT: Focus = { x: 0.5, y: 0.5, scale: 1 };

// The camera: (x, y) is the point of the image shown at the centre of the window, scale >= 1 zooms
// in. The view is clamped to the image, so a zoom never shows an empty edge.
const camera = ({ x, y, scale }: Focus) => {
  const s = Math.max(1, scale)
  const cx = Math.min(1 - 0.5 / s, Math.max(0.5 / s, x)), cy = Math.min(1 - 0.5 / s, Math.max(0.5 / s, y))
  return `translate(${-(cx - 0.5 / s) * s * 100}%, ${-(cy - 0.5 / s) * s * 100}%) scale(${s})`
}

const Media: React.FC<{ scene: Extract<Scene, { type: "screen" | "clip" }>; lang: string; dur: number }> = ({ scene, lang, dur }) => {
  const frame = useCurrentFrame();
  const { u, fps } = useLayout();
  const from = (scene.type === "screen" && scene.zoom?.from) || DEFAULT;
  const to = (scene.type === "screen" && scene.zoom?.to) || from;
  const p = interpolate(frame, [10, dur - 10], [0, 1], { ...clamp, easing: ease });
  const view = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, scale: from.scale + (to.scale - from.scale) * p };
  const s = Math.max(1, view.scale);
  return (
    <AbsoluteFill style={{ transform: camera(view), transformOrigin: "0 0" }}>
      {scene.type === "screen"
        ? <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} />
        : <Recording dir={scene.video} playbackRate={scene.playbackRate ?? 1} startFrom={scene.startFrom ?? 0} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} />}
      {scene.type === "screen" && scene.callouts?.map((c, i) => {
        const a = rise(frame, Math.round((c.at ?? 1) * fps), 14);
        return (
          <div key={i} style={{ position: "absolute", left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, opacity: a,
            border: `${4 * u / s}px solid ${C.accent}`, borderRadius: 12 * u / s, boxShadow: `0 0 0 9999px rgba(0,0,0,${0.12 * a})` }}>
            <div style={{ position: "absolute", left: 10 * u / s, top: 10 * u / s, transform: `scale(${1 / s})`, transformOrigin: "left top" }}>
              <Pill tone="accent">{t(c.label, lang)}</Pill>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// A real screen of the product (screenshot or recording), with an optional slow zoom and callouts
export const Screen: React.FC<P<"screen" | "clip">> = ({ scene, lang, dur }) => {
  const frame = useCurrentFrame();
  const aspect = scene.aspect ?? 1.6;
  const hasHead = !!(scene.eyebrow || scene.title);
  const { pad, top, w, u } = useStage(hasHead, aspect, 0, !!scene.caption);
  const win = rise(frame, 6, 22);
  const cap = rise(frame, 24);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: pad, right: pad, top: 70 * u }}>
        <Heading eyebrow={t(scene.eyebrow, lang)} title={t(scene.title, lang)} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", opacity: win, transform: `translateY(${(1 - win) * 30}px) scale(${0.97 + 0.03 * win})` }}>
        <div style={{ position: "relative" }}>
          <Frame url={scene.url} width={w} aspect={aspect}><Media scene={scene} lang={lang} dur={dur} /></Frame>
          {scene.tag && <div style={{ position: "absolute", top: 60 * u, right: 16 * u }}><Pill>{t(scene.tag, lang)}</Pill></div>}
        </div>
        {scene.caption && <div style={{ marginTop: 24 * u, width: w, opacity: cap, fontFamily: F.sans, fontSize: 30 * u, color: C.muted, textAlign: "center", lineHeight: 1.35 }}>{t(scene.caption, lang)}</div>}
      </div>
    </AbsoluteFill>
  );
};
