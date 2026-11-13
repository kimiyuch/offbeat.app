# PLAN: Web-based groovebox (GUI for Strudel)

A browser app that lets you make music with buttons and knobs instead of code.
The GUI generates Strudel pattern code and hands it to the Strudel engine,
which does all sound and timing.

Reference pattern the first version must be able to produce:

```js
$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)
```

## Decisions (already made)

- **Engine:** Strudel via the `@strudel/web` package (headless, own UI). No custom DSP.
- **Direction:** one-way only. GUI state -> generated code -> Strudel. The app never parses
  hand-written Strudel code back into the GUI.
- **Stack:** Vite + Vue 3 (Composition API, `<script setup>`) + Tailwind CSS. No backend.
- **State:** one plain reactive store (Pinia or a single `reactive()` object). The whole
  project state must be serialisable as JSON.
- **License:** Strudel is AGPL-3.0-or-later. This project is therefore AGPL-3.0-or-later too:
  add `LICENSE`, and put a visible "Source" link in the app footer.
- **Target:** desktop Chrome/Firefox/Safari first. Touch and mobile are a later phase.

## Out of scope for v1

Live keyboard/MIDI playing, audio recording/export, user accounts, custom sample upload,
a code editor, song arrangement (chaining patterns).

## Verify first (do not trust this plan on API details)

Before writing app code, check the current docs and README and note the findings in `NOTES.md`:

1. `@strudel/web` API: how to init (`initStrudel`), evaluate a code string, and stop (`hush`).
   Source: https://strudel.cc/technical-manual/project-start and the package README.
2. How to load the drum-machine sample banks so `.bank("tr909")` works outside the official
   REPL (the REPL preloads them in its "prebake" step; `@strudel/web` may not). Find the
   sample map URL the REPL uses and the exact bank names/aliases.
3. Whether re-evaluating a pattern while playing swaps it seamlessly at the next cycle
   (expected: yes) or restarts the clock.
4. How to read the current cycle position for the playhead (scheduler time / `getTime` or
   an `onTrigger`-style callback).
5. Exact names of the effect params used below (`dec`/`decay`, `lpf`, `room`, `gain`, `pan`, `speed`).

If something here contradicts the docs, the docs win. Record the difference in `NOTES.md`.

## Architecture

```
src/
  engine/
    strudel.js        init, evaluate(code), stop() - the only file that imports @strudel/web
    codegen.js        pure function: projectState -> Strudel code string
    codegen.test.js   unit tests (Vitest)
    playhead.js       exposes current step (0..15) as a ref, driven by the audio clock
  store/
    project.js        tracks, steps, params, tempo; toJSON / fromJSON
  components/
    Transport.vue     play/stop, tempo, swing
    TrackRow.vue      sound picker, mute/solo, 16 StepButtons
    StepButton.vue
    Knob.vue          drag + wheel + keyboard, double-click resets
    TrackParams.vue   knobs for the selected track
    CodePreview.vue   read-only view of the generated code, "Open in strudel.cc" link
  App.vue
```

Rules:

- `codegen.js` is pure and has no imports from Vue or Strudel. It is the core of the app
  and must be fully unit-tested.
- Only `engine/strudel.js` touches Strudel. Everything else talks to it through
  `evaluate(code)` and `stop()`.
- A single watcher on the store regenerates code and calls `evaluate`, debounced (~50 ms)
  so dragging a knob does not flood the engine.

## Data model

```js
project = {
  bpm: 120,
  swing: 0,            // 0..1
  bank: 'tr909',       // drum machine for all tracks (per-track override later)
  tracks: [
    {
      id, sound: 'bd', // bd, sd, hh, oh, cp, ...
      steps: [ /* 16 x */ { on: false, alt: null } ],  // alt = second sound for alternation
      mute: false, solo: false,
      params: { gain: 1, dec: 0.4, lpf: 20000, room: 0, pan: 0.5, speed: 1 }
    }
  ]
}
```

## Code generation

- One `$:` line per track, so tracks are independent and mute = drop the line.
- Steps -> mini-notation: 16 slots, `~` for rest, e.g. `s("bd ~ ~ ~ bd ~ ~ ~ ...")`.
- A step with `alt` set becomes `<a b>` (alternates each cycle). This is what makes the
  reference pattern reachable: `[bd <hh oh>]*2`.
- Only emit params that differ from their default, to keep the code readable.
- Tempo via `setcps(bpm / 60 / 4)` (one cycle = one bar of 4/4).
- Optional later: compress output (`bd*4`, `[bd hh]*2`) when the pattern is regular.
  Not needed for correctness.

Tests must cover: empty track, all-on, alternation, mute/solo, param defaults omitted,
and the reference pattern.

## Phases

Each phase ends with something that runs. Commit after each one.

### Phase 0 - Spike (prove the engine works)
- Vite + Vue + Tailwind scaffold, AGPL `LICENSE`, `NOTES.md` with the verified API facts.
- One page, one button: plays the reference pattern through `@strudel/web`, second button stops.
- **Done when:** the 909 pattern is audible in Chrome, Firefox and Safari after one click.

### Phase 1 - Step sequencer
- Store, `codegen.js` with tests, 4 tracks (bd, sd, hh, oh) x 16 steps, play/stop, tempo.
- `CodePreview` shows the generated code live.
- **Done when:** toggling steps while playing changes the beat without a hiccup or restart.

### Phase 2 - Knobs and playhead
- `Knob.vue`, per-track params (gain, decay, filter, reverb, pan), mute/solo.
- Playhead highlight synced to the audio clock, not to `setInterval`.
- **Done when:** knob drags are click-free and the playhead stays in sync for 5+ minutes.

### Phase 3 - Alternation, more sounds, persistence
- Step "alt" sound (long-press or right-click on a step), add/remove tracks, bank picker
  (tr909, tr808, ...), swing.
- Autosave to `localStorage` (in try/catch), share via URL hash (base64 JSON),
  "Open in strudel.cc" link built from the generated code.
- **Done when:** the reference pattern can be built purely by clicking, and a shared URL
  restores the exact project in another browser.

### Phase 4 - Synth track (optional)
- A melodic track type: piano-roll or note-per-step, `note(...)`, scale picker,
  waveform (`sawtooth`, `square`, ...), filter envelope.
- **Done when:** a bassline plays alongside the drums.

### Phase 5 - Polish
- Keyboard shortcuts (space = play/stop), touch support, responsive layout,
  iOS audio unlock check, loading state while samples fetch, error toast if evaluate fails.

## Known pitfalls

- Audio can only start from a user gesture: init Strudel inside the first click handler.
- Samples load from the network: show a loading state, and expect the first hit of a new
  sound to be silent or late if it is not preloaded.
- Do not drive anything musical with `setTimeout`/`setInterval`; only the visual playhead
  may poll (via `requestAnimationFrame`), reading the audio clock.
- Re-evaluating on every knob pixel causes glitches: debounce.
- Safari: no Web MIDI, audio suspends in background tabs, hardware mute switch on iOS.

## Working agreement for the agent

- Read this file and `NOTES.md` at the start of every session.
- Work phase by phase; do not start a phase before the previous "Done when" is met.
- Run `npm run test` and `npm run build` before every commit.
- Audio cannot be verified by tests alone: at the end of each phase, list what the human
  needs to listen for and wait for confirmation.
- Keep dependencies minimal: no UI kit, no audio library besides Strudel.
