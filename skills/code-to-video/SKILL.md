---
name: code-to-video
description: >-
  Turn a codebase or a running web app/prototype into a short, honest product video (about 60 s):
  read the code, run the app, capture real screens and recordings with Playwright, measure real
  numbers, storyboard with the user, compose with a built-in frame engine, add an optional voice-over with any
  text-to-speech (Deepgram, ElevenLabs, OpenAI, or a local CLI), render 16:9 / 9:16 / 1:1 and check
  the result. Use when the user asks for a demo video, promo video, explainer, launch clip, or
  "a video of this app / repo / prototype / PR".
---

# Code to video

Make a short product video **from the product itself**: real screens, real interactions, real
numbers. The video sells the idea on broad lines; it is not a click-by-click tutorial.

The template in `template/` (next to this file) is a complete video project: React scenes, a frame
engine (`src/engine/`), and capture, preview, render, voice, mix and QA scripts. Rendering is
Playwright photographing each frame and ffmpeg encoding them; no video framework is involved. You copy it, fill two JSON files, and render.
You never hand-write a video component for a normal job; you only edit `video.config.json` and
`capture.json`. Add a scene type only when none of the existing ones fits (see
`references/storyboard.md`).

## Non-negotiable rules

1. **Real screens only.** Every screen in the video is captured from the running product. No
   mock-ups, no redrawn UI, no stock footage of "an app".
2. **Real numbers only.** Every figure on screen comes from the product's own output, from a run
   you did and can show. If the data is demo or synthetic, the scene carries a visible tag
   ("Demo data", "Synthetic data"). Never invent a metric, a customer, a quote or a result.
3. **An honest comparison.** A before/after compares against what people really do today (the
   current tool, a sensible rule), not a strawman. If the gain only appears against a weak
   baseline, say so to the user before rendering.
4. **A prototype is a prototype.** Never call it "live", "in production" or "deployed to
   customers" unless it is. Say "working prototype", "demo environment".
5. **Nothing that does not belong to the viewer.** No other customer's name, data or logo in the
   frames, the captions or the file names. Check the screenshots themselves: a privacy check that
   reads only text misses a name painted on a screen.
6. **Two user gates.** The storyboard (words and scene list) and the low-resolution preview are
   approved by the user before the voice and the final render. Words are cheap to change before
   the render, expensive after.
7. **Keys stay out of the repo.** TTS keys come from the environment or a git-ignored `.env`.

## The pipeline

| Step | You do | Output | Gate |
|---|---|---|---|
| 1 · Understand | Read README, routes, main screens, tests. Write a 6-line product brief: who, problem, the one "wow" interaction, what is real vs demo data, how to run it | brief in chat | none |
| 2 · Run | Start the app locally (detect the stack: `npm run dev`, `vite`, `next dev`, `python -m ...`, docker compose). Confirm it answers | URL | none |
| 3 · Capture | Write `capture.json` (screens + one or two short recordings of the wow interaction), run `node scripts/capture.mjs`, **look at every image** | `public/captures/*` | none |
| 4 · Measure | Get the numbers the video will quote from the product itself (its UI, its API, its engine run headless). Write down where each comes from | numbers + sources | none |
| 5 · Storyboard | Fill `video.config.json`: 5 to 7 scenes, one message each, voice line per scene, total about 60 s | the scene list in plain words | **user approves** |
| 6 · Preview | `node scripts/render.mjs --preview --format 16:9`, then `node scripts/qa.mjs`; look at the contact sheet | half-res MP4 + sheet | **user approves** |
| 7 · Voice (optional) | `node scripts/voice.mjs`, then `node scripts/mix.mjs` | `public/audio-<lang>.mp3` | listen |
| 8 · Render + QA | `node scripts/render.mjs` (all formats and languages), `node scripts/qa.mjs` | MP4s + sheets | deliver |

Prefer speed: one low-res preview, then straight to voice and final. Do not loop on cosmetic
details the user did not ask about.

## Step details

**Setup.** Copy `template/` to a folder in the user's project (e.g. `video/`), then `npm install`.
Needs Node 20+, ffmpeg (render, recordings, mix, QA) and a Chromium for Playwright
(`npx playwright install chromium`, or set `CHROMIUM_PATH`).

**Capture** (`references/capture.md`). Viewport 1600×1000 at device scale 1.25 gives sharp
screens. Use the app's own state (seed data, localStorage, query params) so every capture is
reproducible. Record the wow interaction as a clip of 3 to 8 s. Look at each capture before using
it: a loading spinner, a cookie banner, an error toast or a private name ruins a scene.

**Storyboard** (`references/storyboard.md`). The default arc for 60 s:
1. `title` the problem in the viewer's words (5 s)
2. `screen` today's situation on the real screen, with a callout (7 to 9 s)
3. `compare` the one-click change, before vs after, with the measured numbers (9 to 12 s)
4. `typing` or `clip` the interaction that feels like magic (7 to 10 s)
5. `features` or a second `screen`: what else it does, one line each (6 to 8 s)
6. `outro` the name, the promise, where to try it (5 s)

Present the storyboard to the user as a short table: scene, what we see, what the voice says,
where each number comes from. Wait for approval.

**Voice** (`references/voice.md`). Any TTS works: `deepgram`, `elevenlabs`, `openai` are built in,
and `command` runs any CLI (macOS `say`, piper, espeak, Coqui...). Write lines to be spoken, not
read: short sentences, numbers as words when they sound odd. Use `voice.respell` for product names
the voice mangles, and `--takes 3` when a voice is not deterministic (the script keeps the take
whose `whisper` transcript is closest to the line). Each line must fit its scene: the script warns
when it does not.

**Render and QA** (`references/render-and-qa.md`). Preview at half resolution first; use
`node scripts/studio.mjs` to scrub through the video while editing. QA checks duration
against the storyboard and loudness (-16 LUFS, the streaming norm) and writes a contact sheet:
open it and look for cropped text, captions over important UI, a scene that is empty on entry.

## Delivering

Give the user the MP4 paths, the contact sheet, the list of numbers with their sources, and
anything you could not verify. Say plainly if a scene uses demo or synthetic data.

## Formats and languages

`formats` renders 16:9 (web, decks), 9:16 (Reels, Shorts, TikTok) and 1:1 (LinkedIn, X) from the
same scenes; layouts adapt (side by side when wide, stacked when tall or square). `languages`
renders one video per language; any text field can be `{"en": "...", "fr": "..."}`. Captions are
on when there is no voice-over (`"captions": "auto"`), or always (`true`) for feeds that autoplay
muted.
