# Capturing real screens

`node scripts/capture.mjs [capture.json]` drives the running app with Playwright and writes
`public/captures/<name>.png` (screens) and `public/captures/<name>/` (recordings, as frames).

## capture.json

```json
{
  "baseUrl": "http://localhost:5173",
  "start": { "command": "npm run dev", "cwd": "..", "readyUrl": "http://localhost:5173", "timeoutMs": 60000 },
  "viewport": { "width": 1600, "height": 1000 },
  "deviceScaleFactor": 1.25,
  "localStorage": { "onboardingSeen": "1" },
  "shots": [
    { "name": "home", "path": "/" },
    { "name": "after", "path": "/", "actions": [{ "click": "#optimize" }, { "wait": 800 }] }
  ],
  "clips": [
    { "name": "wow", "path": "/", "actions": [{ "type": ["#search", "late orders this week", 50] }, { "press": "Enter" }, { "wait": 2000 }] }
  ]
}
```

`start` is optional: when present, the script starts the app, waits for `readyUrl`, and stops it
at the end. Without it, start the app yourself.

Actions run in order: `goto`, `click`, `fill: [selector, text]`, `type: [selector, text, delayMs]`
(visible typing, good for clips), `press`, `hover`, `wait: ms`, `waitFor: selector`, `scroll: px`,
`upload: [selector, file]`.

## Checklist before using a capture

- Open it. Look at it. Is it the state the scene talks about?
- No spinner, skeleton, toast, cookie banner, dev overlay, or debug panel.
- No real person's or other customer's name, email, phone or logo. Use the app's demo data.
- Numbers on the capture match the numbers in the storyboard.
- Same theme, language and data across captures of one video.

## Recordings

The browser records the whole page at the viewport size, 1× scale. Keep clips short (3 to 8 s),
with a short pause before and after the interaction (`settleMs`, `tailMs`). ffmpeg turns the
recording into a folder of frames, `public/captures/<name>/00001.jpg`, at 30 fps (`fps` per clip).
A `clip` scene points at that folder (`"video": "captures/<name>"`): one image per video frame is
exact and needs no video codec in the headless browser.
