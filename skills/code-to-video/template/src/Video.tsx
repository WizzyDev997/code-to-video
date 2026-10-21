import React from "react";
import { AbsoluteFill, Sequence, getStaticFiles, interpolate, useCurrentFrame } from "./engine";
import { config, t, timeline, type Scene } from "./config";
import { C, F } from "./theme";
import { Backdrop, Fade, clamp, useLayout } from "./ui";
import { Outro, Title } from "./scenes/Title";
import { Screen } from "./scenes/Screen";
import { Compare, Metrics } from "./scenes/Compare";
import { Features, Typing } from "./scenes/Typing";

const SceneView: React.FC<{ scene: Scene; lang: string; dur: number }> = ({ scene, lang, dur }) => {
  switch (scene.type) {
    case "title": return <Title scene={scene} lang={lang} dur={dur} />;
    case "screen":
    case "clip": return <Screen scene={scene} lang={lang} dur={dur} />;
    case "compare": return <Compare scene={scene} lang={lang} dur={dur} />;
    case "metrics": return <Metrics scene={scene} lang={lang} dur={dur} />;
    case "typing": return <Typing scene={scene} lang={lang} dur={dur} />;
    case "features": return <Features scene={scene} lang={lang} dur={dur} />;
    case "outro": return <Outro scene={scene} lang={lang} dur={dur} />;
  }
};

// Subtitles from each scene's voice line: the video reads well with the sound off (social feeds)
const Caption: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const { u, width } = useLayout();
  const a = Math.min(interpolate(frame, [8, 18], [0, 1], clamp), interpolate(frame, [dur - 18, dur - 8], [1, 0], clamp));
  if (!text) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46 * u }}>
      <div style={{ maxWidth: width - 200 * u, opacity: a, background: "rgba(10,12,16,0.78)", color: "#fff", fontFamily: F.sans, fontSize: 30 * u, lineHeight: 1.35, borderRadius: 12 * u, padding: `${12 * u}px ${22 * u}px`, textAlign: "center" }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const Video: React.FC<{ lang: string }> = ({ lang }) => {
  const { items, overlap } = timeline();
  const audio = `audio-${lang}.mp3`; // muxed by ffmpeg after the frames are captured
  const hasAudio = getStaticFiles().some((f) => f.name === audio);
  const captions = config.captions === true || (config.captions === "auto" && !hasAudio);
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <Backdrop />
      {items.map(({ scene, from, dur }, i) => (
        <Sequence key={scene.id} from={from} durationInFrames={dur}>
          <Fade dur={dur} fin={i === 0 ? 0 : overlap} fout={i === items.length - 1 ? 0 : overlap}>
            <SceneView scene={scene} lang={lang} dur={dur} />
          </Fade>
          {captions && <Caption text={t(scene.voice, lang)} dur={dur} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
