# Voice-over

`node scripts/voice.mjs` writes one file per scene and language in `public/voice/<lang>/<scene>.mp3`
from each scene's `voice` line. `node scripts/mix.mjs` places them on the timeline, adds optional
music, normalises to -16 LUFS and writes `public/audio-<lang>.mp3`, which the video picks up.

## Voices without a key (default)

The default, `"provider": "auto"`, needs no account and no key. Two open-source models run on the
CPU of an ordinary laptop. Each one is downloaded once into `.cache/voice-models/`; after that,
everything works offline. **The user only picks the language; the engine follows from it.**

| Language | Engine | First download | License |
|---|---|---|---|
| English (`en`) | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), through `kokoro-js` | about 90 MB | Apache-2.0 |
| The 30 others | [Supertonic 3](https://github.com/supertone-inc/supertonic), on ONNX Runtime | about 400 MB | code MIT, weights OpenRAIL-M |

Languages available without a key:

- English `en` (Kokoro)
- French `fr`, German `de`, Spanish `es`, Italian `it`, Portuguese `pt`, Dutch `nl` (Supertonic)
- Arabic `ar`, Bulgarian `bg`, Croatian `hr`, Czech `cs`, Danish `da`, Estonian `et`,
  Finnish `fi`, Greek `el`, Hindi `hi`, Hungarian `hu`, Indonesian `id`, Japanese `ja`,
  Korean `ko`, Latvian `lv`, Lithuanian `lt`, Polish `pl`, Romanian `ro`, Russian `ru`,
  Slovak `sk`, Slovenian `sl`, Swedish `sv`, Turkish `tr`, Ukrainian `uk`, Vietnamese `vi`
  (Supertonic)

A language outside this list stops with a message that lists these languages; use a provider
with a key for it (below).

**Why Kokoro only for English.** The Kokoro model knows nine languages, but nearly all of its
voices and its best-rated ones are English (`af_heart`, `af_bella`). It has a single French voice,
`ff_siwis` (a Swiss French speaker, rated B-). Most importantly, the Node package turns text into
sounds only for English, so a French voice would read French with English rules. Supertonic is
built for many languages and reads each one with its own rules.

Settings, all optional:

```json
"voice": {
  "provider": "auto",
  "kokoro": { "voice": "af_heart", "dtype": "q8", "speed": 1 },
  "supertonic": { "voice": "F3", "steps": 8, "speed": 1.05 }
}
```

- `kokoro.voice`: any English Kokoro voice (`af_heart`, `af_bella`, `am_michael`, `bf_emma`,
  `bm_george`...). `dtype`: `q8` (about 90 MB, the default) or `fp32` (about 330 MB, slightly
  faster on most laptops).
- `supertonic.voice`: `F1` to `F5` (female) or `M1` to `M5` (male). `steps`: quality against
  speed (8 is a good default). Takes are reproducible: take 1 always sounds the same.
- `node scripts/fetch-voice-model.mjs [kokoro|supertonic|all]` downloads the models ahead of
  time, for example before going offline or in CI.

Licenses to respect: Kokoro is Apache-2.0. Supertonic's sample code is MIT; its weights are under
OpenRAIL-M, free to use with use restrictions taken from the model card: no imitating a real
person without their consent, no machine-generated content passed off as human where that
deceives, no harassment, defamation or illegal use. A product video that says what it is meets
them.

A stronger English and French option for advanced users is
[Pocket TTS](https://github.com/kyutai-labs/pocket-tts) by Kyutai: excellent quality, but it needs
Python and a Hugging Face account to download. Plug it in through `command`.

## Providers with a key, or any other TTS

Set `voice.provider`, or pass `--provider`, to use a hosted voice instead.

| Provider | Key | Settings |
|---|---|---|
| `deepgram` | `DEEPGRAM_API_KEY` | `voice.deepgram.model`, e.g. `aura-2-thalia-en` (English), `aura-2-agathe-fr` (French) |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `voice.elevenlabs.voiceId`, `voice.elevenlabs.modelId` (default `eleven_multilingual_v2`) |
| `openai` | `OPENAI_API_KEY` | `voice.openai.model` (default `gpt-4o-mini-tts`), `voice.openai.voice` |
| `command` | none | `voice.command.run`: any shell command with `{text}` and `{out}`; it must write an audio file to `{out}` |

Keys come from the environment or a git-ignored `.env` file. Any other TTS (Azure, Google, Polly,
piper, macOS `say`, a local model) works through `command`, or by adding a function to `PROVIDERS`
in `scripts/voice.mjs`: it receives the settings, the line, the output path, and the language.

Per-language settings go under `voice.languages.<lang>` and replace the global ones key by key,
e.g. a different provider or respelling for French:

```json
"voice": {
  "provider": "auto",
  "respell": { "Crewboard": "Crew board" },
  "languages": {
    "fr": { "respell": { "Crewboard": "Crou-borde" } },
    "ja": { "provider": "elevenlabs" }
  }
}
```

## Getting a clean voice

- **Respell product names for the voice only.** `"respell": { "nginx": "engine x" }`
  changes what the voice reads, not the captions. A respelling is per language: an English
  respelling read by a French voice sounds wrong, so give French its own.
- **Write numbers the way the voice reads them well.** Digits and long number words are where
  voices slip. Write them out, and listen. In French, Supertonic reads "septante-huit"
  (Swiss and Belgian French) cleanly where it turned "soixante-dix-huit" into 68.
- **Check by ear, or by transcript.** `--check` transcribes each line with the `whisper` CLI
  (`pip install openai-whisper`) and prints the share of words heard. Numbers written as words
  come back as digits, so a lower score there is not an error: read the transcript.
- **Several takes when a voice is not deterministic.** `--takes 3` generates three takes per line
  and, with `whisper` installed, keeps the one whose transcript is closest to the script.
- **Lines that fit.** The script prints each line's length and warns when it is longer than its
  scene. Shorten the line, or lengthen the scene, rather than speeding the voice up. French runs
  about 15 % longer than English: size scenes for the longest language.

## Music

`"music": { "file": "public/music.mp3", "volume": 0.15 }`. Use music you have the right to use. It
loops, fades out over the last 2 s and sits under the voice.
