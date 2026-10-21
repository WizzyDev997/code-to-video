import raw from "../video.config.json";

// Everything the video shows comes from video.config.json. The skill writes that file from what it
// read in the code and measured in the running app; the components below never invent content.

export type Text = string | Record<string, string>;
export type Focus = { x: number; y: number; scale: number }; // x, y: centre of the view as a fraction of the image
export type Callout = { x: number; y: number; w: number; h: number; label: Text; at?: number }; // fractions of the image; at = seconds into the scene
export type Metric = { label: Text; before: number; after: number; unit?: Text; decimals?: number; better?: "lower" | "higher" };

type Base = { id: string; duration: number; voice?: Text; eyebrow?: Text; title?: Text };
export type Scene =
  | (Base & { type: "title"; title: Text; accent?: Text; subtitle?: Text; logo?: string })
  | (Base & { type: "screen"; image: string; aspect?: number; url?: string; caption?: Text; tag?: Text; zoom?: { from?: Focus; to?: Focus }; callouts?: Callout[] })
  | (Base & { type: "clip"; video: string; aspect?: number; url?: string; caption?: Text; tag?: Text; playbackRate?: number; startFrom?: number }) // video: folder of frames made by capture.mjs
  | (Base & { type: "compare"; before: { image: string; label: Text }; after: { image: string; label: Text }; aspect?: number; url?: string; metrics?: Metric[]; source?: Text; tag?: Text })
  | (Base & { type: "metrics"; title: Text; metrics: Metric[]; source?: Text })
  | (Base & { type: "typing"; prompt: Text; reply?: Text[]; image?: string; aspect?: number; url?: string })
  | (Base & { type: "features"; title: Text; items: { title: Text; text?: Text; icon?: string }[] })
  | (Base & { type: "outro"; title: Text; subtitle?: Text; url?: string; logo?: string; note?: Text });

export type Theme = {
  background: string; surface: string; ink: string; muted: string; line: string;
  accent: string; accentInk: string; good: string; bad: string; grid: boolean;
};

export type VideoConfig = {
  title: string;
  fps: number;
  languages: string[];
  formats: ("16:9" | "9:16" | "1:1")[];
  overlap: number; // seconds two consecutive scenes cross-fade
  captions: boolean | "auto"; // "auto": captions only when there is no voice-over file
  theme: Theme;
  fonts: { sans: string; mono: string };
  scenes: Scene[];
};

export const config = raw as unknown as VideoConfig;

export const t = (v: Text | undefined, lang: string): string => {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
};

// Scene start frames: scenes overlap by `overlap` seconds for cross-fades
export const timeline = (fps = config.fps) => {
  const ov = Math.round(config.overlap * fps);
  let at = 0;
  const items = config.scenes.map((s, i) => {
    const dur = Math.round(s.duration * fps);
    const from = at;
    at += dur - (i < config.scenes.length - 1 ? ov : 0);
    return { scene: s, from, dur };
  });
  return { items, total: at, overlap: ov };
};

export const FORMATS = {
  "16:9": { id: "16x9", width: 1920, height: 1080 },
  "9:16": { id: "9x16", width: 1080, height: 1920 },
  "1:1": { id: "1x1", width: 1080, height: 1080 },
} as const;
