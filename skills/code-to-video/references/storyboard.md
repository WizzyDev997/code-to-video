# Storyboard and scene types

A storyboard is `video.config.json`. One scene = one message. If a scene needs two sentences to say
what it shows, it is two scenes or none.

## Writing rules

- **The viewer's words.** Name the problem the way the viewer would say it to a colleague, not the
  way the codebase names it. "Two people above capacity" beats "Load-balancing module".
- **Say what it is.** Avoid "not X, but Y" punchlines; state Y.
- **One number per scene** on screen, at most three on a compare scene. Each one has a source you
  can name (`source` field on `compare` and `metrics`).
- **Voice lines are spoken.** About 2.5 words per second. A 7 s scene holds about 15 words, after
  the 0.4 s `voiceDelay`.
- **Tag demo data.** Any scene showing demo or synthetic data gets `"tag": "Demo data"`.

## Scene types

Every scene has `id`, `type`, `duration` (seconds), optional `eyebrow`, `title`, `voice`. Text fields
are a string or `{ "en": "...", "fr": "..." }`. Image and video paths are relative to `public/`.

| Type | Use it for | Key fields |
|---|---|---|
| `title` | the hook, the problem in one line | `title`, `accent` (second line in the accent colour), `subtitle`, `logo` |
| `screen` | a real screen, with an optional slow zoom and callouts | `image`, `url`, `zoom.from/to` `{x, y, scale}` (x, y = point at the centre of the view, 0 to 1), `callouts[] {x, y, w, h, label, at}` (fractions of the image), `caption`, `tag`, `aspect` (default 1.6) |
| `clip` | a real recording of an interaction | `video`, `url`, `playbackRate`, `startFrom`, `caption`, `tag` |
| `compare` | before vs after on the same screen, with the numbers that changed | `before {image, label}`, `after {image, label}`, `metrics[] {label, before, after, unit, decimals, better}`, `source`, `tag` |
| `metrics` | numbers on their own | `metrics[]`, `source` |
| `typing` | a request typed into the product and its real answer | `prompt`, `reply[]`, `image` (the screen after the request) |
| `features` | what else it does, one line each | `items[] {title, text, icon}`; icons: check, bolt, chart, chat, shield, clock, calendar, search, users, sparkle, data, arrow |
| `outro` | name, promise, where to try it | `title`, `subtitle`, `url`, `logo`, `note` |

## Timing

Scenes cross-fade over `overlap` seconds (default 0.5). Total length = sum of durations minus the
overlaps; the QA script checks the rendered file against it. A 60 s video is usually 6 scenes.

## Adding a scene type

Only when no type above can show the point (for example a product-specific chart driven by real
exported data). Add a component in `src/scenes/` (time from `useCurrentFrame()`, motion from
`src/engine`), a case in `src/Video.tsx`, its fields in `src/config.ts`, and keep the same
rules: data comes from a file the product produced, never from numbers typed into the component.
