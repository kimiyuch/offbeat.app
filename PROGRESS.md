# PROGRESS

Status as of 2026-11-13: **proof of concept, ready to publish** on a subdomain.

Read with `PLAN.md` (the original plan) and `NOTES.md` (Strudel API facts verified
against the packages: read this before touching `src/engine/`).

## Done

| Plan phase | State | What exists |
|---|---|---|
| 0 Spike | ✅ | Vite + Vue 3 + Tailwind 4, `@strudel/web` engine wrapper, AGPL `LICENSE`, `NOTES.md` |
| 1 Step sequencer | ✅ | 16-step drum tracks, play/stop, tempo, live code preview |
| 2 Knobs & playhead | ✅ | `Knob.vue` (drag, wheel, keys, double-click reset), per-track params, mute/solo, playhead read from the audio clock |
| 3 Alternation, persistence | ✅ | per-step alternate sound (right-click / long-press), drum-machine picker, swing, autosave, share link (URL hash), "Open in strudel.cc" |
| 4 Synth track | ✅ | piano roll with note lengths, scales, filter + amp envelopes, delay/reverb, 11 melody presets, saved melodies, 🎲 random melody |
| 5 Polish | ◐ | space = play/stop, error toast, sample preloading with progress, "silent" warning for sounds a machine lacks, narrow-screen layout, audio resume after background tab. **Not done:** real touch/iOS testing |

Beyond the plan (the plan listed song arrangement as out of scope):

- **Song mode:** patterns A–H per track, copy/paste/clear, a chain of up to 64 bars, song length display.
- **Demo songs:** Trance (A minor, 138 BPM, 40 bars) and Electro (E phrygian, 112 BPM, TR-808, 48 bars).
- **Compact saves:** projects and share links store only the steps that are on; older formats still load.
- **Rename:** groovebox → Offbeat (old `groovebox:*` localStorage keys are still read).

Tests: 79 Vitest tests, mostly on `codegen.js`. Several compare the generated code
event-by-event against Strudel's own parser (timing, note lengths, pitches, per-bar
alternation across song chains, demo harmony on every bar).

## Running it

```sh
npm install
npm run dev     # Vite on 127.0.0.1:4324
npm run test
npm run build   # static site in dist/
```

Local URL: https://offbeat.app.test via `herd proxy offbeat.app http://127.0.0.1:4324 --secure`
(only works while `npm run dev` runs).

## Publishing

Live at **https://offbeat.kimiyu.ch** (Hostpoint, web root `~/www/offbeat.kimiyu.ch/public`).
Deploy with `./deploy.sh`: refuses uncommitted changes, runs the tests, builds from HEAD,
rsyncs `dist/` into the web root (keeps a panel-managed `.htaccess`).

- The site is fully static: no server code, no environment variables.
- Serve it over **HTTPS**: AudioWorklet (used by Strudel, e.g. the `supersaw` synth) and
  the clipboard "Copy" buttons only work in a secure context.
- Samples are fetched at runtime from `strudel.b-cdn.net` (Strudel's CDN); the site
  depends on it being reachable.
- The footer **Source** link points to https://github.com/kimiyuch/offbeat.app (AGPL
  requirement). Override with `VITE_SOURCE_URL` at build time if the repo moves.
- Before going public: check "Offbeat" for existing products/trademarks.

## Never verified

The user's listening check (desktop) covered the core sequencer. Features added after
that (synths, song mode, demos) were built test-first but only partly heard. Not
checked: Safari and Firefox explicitly, phones/tablets (touch, iOS audio unlock,
hardware mute switch), 5+ minute playhead drift, demo mix levels. There are no browser
automation tests.

## Known limitations

- Knob settings are per track, not per pattern (no filter sweeps / risers in builds).
- Synth tracks are monophonic (pads use two tracks).
- In song mode, alternating patterns that repeat are written out bar by bar in the
  generated code (correct, but long).
- Saved melodies stay in the browser (not in share links).
- Re-selecting the same melody preset does nothing (pick another, then back).

## Ideas backlog (not started)

Ordered roughly by value for effort:

1. Undo/redo
2. Per-pattern knob values (automation)
3. Step accents, probability, ratchets (all native in Strudel mini-notation)
4. Duplicate / reorder / rename tracks; euclidean fill
5. Chords on synth tracks
6. Sidechain ducking
7. WAV export (`renderPatternAudio` exists in `@strudel/webaudio`, untested)
8. MIDI keyboard input (no Safari)
9. More demos (house, hip-hop, techno)
10. Browser end-to-end tests
