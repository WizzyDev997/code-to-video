# Voice-over with any text-to-speech

`node scripts/voice.mjs` writes one file per scene and language in `public/voice/<lang>/<scene>.mp3`
from each scene's `voice` line. `node scripts/mix.mjs` places them on the timeline, adds optional
music, normalises to -16 LUFS and writes `public/audio-<lang>.mp3`, which the video picks up.

## Providers

Set `voice.provider` in `video.config.json`, or pass `--provider`.

| Provider | Key | Settings |
|---|---|---|
| `deepgram` | `DEEPGRAM_API_KEY` | `voice.deepgram.model`, e.g. `aura-2-thalia-en` (English), `aura-2-agathe-fr` (French) |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `voice.elevenlabs.voiceId`, `voice.elevenlabs.modelId` (default `eleven_multilingual_v2`) |
| `openai` | `OPENAI_API_KEY` | `voice.openai.model` (default `gpt-4o-mini-tts`), `voice.openai.voice` |
| `command` | none | `voice.command.run`: any shell command with `{text}` and `{out}`; it must write an audio file to `{out}` |

Any other TTS (Azure, Google, Polly, piper, Coqui, a local model) works through `command`, or by
adding a function to `PROVIDERS` in `scripts/voice.mjs`: it receives the settings, the line and the
output path.

Per-language settings go under `voice.languages.<lang>`, e.g. a French voice for `fr`:

```json
"voice": {
  "provider": "deepgram",
  "deepgram": { "model": "aura-2-thalia-en" },
  "languages": { "fr": { "deepgram": { "model": "aura-2-agathe-fr" } } }
}
```

## Getting a clean voice

- **Respell product names for the voice only.** `"respell": { "nginx": "engine x" }`
  changes what the voice reads, not the captions.
- **Several takes when a voice is not deterministic.** `--takes 3` generates three takes per line;
  with the `whisper` CLI installed (`pip install openai-whisper`), the take whose transcript is
  closest to the script is kept. Listen to the lines that score lowest.
- **Lines that fit.** The script prints each line's length and warns when it is longer than its
  scene. Shorten the line rather than speeding the voice up.
- **Write for the ear.** Short sentences. Numbers the way people say them ("one hundred and
  thirteen percent" if the voice reads "113 %" oddly).

## Music

`"music": { "file": "public/music.mp3", "volume": 0.15 }`. Use music you have the right to use. It
loops, fades out over the last 2 s and sits under the voice.
