# Render and QA

## Render

```bash
node scripts/studio.mjs                           # preview player: play, scrub, format, language
node scripts/render.mjs --preview --format 16:9   # half resolution, fast: for the user gate
node scripts/render.mjs                           # every format and language in the config
node scripts/render.mjs --format 9:16 --lang fr   # one of them
node scripts/render.mjs --stills 90,300           # single frames, full size, to check a layout
```

Outputs go to `out/<title>-<format>-<lang>[-preview].mp4` and `out/still-<format>-<lang>-<frame>.png`.

How it works: `scripts/build.mjs` bundles the scenes into a page (esbuild), the renderer opens it in
headless Chrome, sets each frame with `window.__setFrame(n)`, waits for fonts and images, and
screenshots the stage on several pages in parallel (`--workers`, default up to 6). ffmpeg encodes the
frames and the soundtrack (padded with silence, so the storyboard sets the length). A 60 s 1080p
video takes a few minutes.

If Playwright's own browser is not installed, point it to any Chrome or chrome-headless-shell:

```bash
CHROMIUM_PATH=/path/to/chrome-headless-shell node scripts/render.mjs --preview
```

## Writing scenes for the frame engine

- Read time only with `useCurrentFrame()`; derive every motion from it with `interpolate`,
  `spring` and `Easing` from `src/engine`. No CSS transitions or animations, no timers, no
  `Date.now()`, no `Math.random()`: they would make two renders differ.
- Sizes are `box-sizing: border-box` everywhere (set by the page).
- Load images with `Img` and `staticFile()`, recordings with `Recording`; the renderer waits for
  them before each screenshot.

## QA

`node scripts/qa.mjs` checks every MP4 in `out/`:

- duration against the storyboard (±0.5 s)
- integrated loudness (target -16 LUFS, accepted -19 to -13)
- a contact sheet of 12 frames in `out/qa/<name>.png`

Then **look at the contact sheet**, and at full-size stills of the scenes that matter
(`node scripts/render.mjs --stills 300`). Look for:

1. text cut at the edge of the frame, in every format
2. a caption sitting on the part of the screen the scene is about
3. a callout box that does not frame what its label says
4. a zoom that shows an empty edge or crops the subject
5. numbers on screen that differ from the storyboard or from the capture
6. a scene that is empty or still loading when it appears
7. another customer's name or data visible anywhere
