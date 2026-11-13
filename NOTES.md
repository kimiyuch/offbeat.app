# NOTES

Verified against the published packages (`@strudel/web@1.3.0`, `@strudel/core@1.2.6`,
`superdough@1.3.0`) and the strudel.cc REPL source (`website/src/repl/prebake.mjs` on
codeberg.org/uzu/strudel), 2026-11-13. If this file and the plan disagree, this file wins.

## 1. `@strudel/web` API

- `initStrudel(options)` → Promise resolving to the REPL object (`repl.scheduler`, …).
  - `options.prebake`: async fn run after the default prebake (module scope + synth sounds).
  - Any other option is passed through to `repl()` — e.g. `onEvalError(err)`.
  - It calls `initAudioOnFirstClick()` itself, and **creates the AudioContext immediately**
    (suspended until a gesture). So it is fine to call `initStrudel()` on page load; we
    additionally call `initAudio()` (re-exported from superdough) inside the Play click.
    *Differs from the plan*, which says "init Strudel inside the first click handler" —
    not needed, and doing so would delay sample-map loading until after the click.
- `evaluate(code, autoplay = true)`: transpiles like the REPL (double-quoted strings are
  mini-notation, `$:` lines are stacked) and starts playback. Errors do **not** throw; they
  go to `onEvalError`.
- `hush()` → `repl.stop()` (stops the clock, resets cycle to 0).

## 2. Drum-machine banks

`@strudel/web` loads **no samples** by default. The REPL's prebake does:

```js
samples('https://strudel.b-cdn.net/tidal-drum-machines.json',
        'https://strudel.b-cdn.net/tidal-drum-machines/machines/', { prebake: true, tag: 'drum-machines' })
aliasBank('https://strudel.b-cdn.net/tidal-drum-machines-alias.json')
```

- Sounds are registered as `<Machine>_<sound>`, e.g. `RolandTR909_bd`. `.bank("x")` turns
  `s("bd")` into `x_bd`; lookup is lowercased.
- The alias file maps `RolandTR909 → TR909`, `RolandTR808 → TR808`, `RolandTR707 → TR707`,
  `RolandTR606`, `RolandTR505`, `AkaiLinn → Linn`, `LinnLM1 → LM1`, … so `.bank("tr909")` works.
- `aliasBank` iterates the *already registered* sounds, so it must run **after** `samples()`
  resolves (the REPL does it without awaiting, which is racy; we await).
- TR909 has: bd cp cr hh ht lt mt oh rd rim sd (no cb). TR808 has cb, no rd.
- Audio files are fetched lazily on first trigger → first hit of a new sound may be silent.

## 3. Re-evaluating while playing

`repl.evaluate` → `scheduler.setPattern(pat)` just swaps `this.pattern`; the clock keeps
running. The next scheduler tick (~every 50 ms) queries the new pattern. So swaps are
seamless and **not** quantised to the next cycle (that's fine for a step sequencer since
both patterns share the same grid). `setcps(x)` with an unchanged value is a no-op.

## 4. Playhead

`repl.scheduler.now()` returns the current position in cycles (float), derived from
`audioContext.currentTime`. Returns 0 when stopped. Read it in `requestAnimationFrame`.

## 5. Param names (all in `@strudel/core/controls.mjs`)

`gain`, `decay` (alias `dec`), `lpf` (alias of `cutoff`, also `ctf`, `lp`), `room`,
`pan` (0..1, .5 = centre), `speed`, `bank`, `swingBy(amount, n)` (delays the 2nd half of
each of n slices by amount/2 of a slice; `swing(n)` = `swingBy(1/3, n)`).

## Other findings

- strudel.cc share link: `https://strudel.cc/#` + `encodeURIComponent(base64(utf8(code)))`.
- Vitest: `@kabelsalat/web` (dep of `@strudel/core`) exposes CJS as `main`; tests alias it
  to its ESM build and inline `@strudel/*` (see `vite.config.js`). Browser build unaffected.

## Reference pattern

`$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)` — note the `<hh oh>` alternates **per
repetition of the `*2`**, i.e. every bar is `bd hh bd oh`. With one line per track the GUI
produces the musically identical

```
$: s("bd*2").bank("tr909").dec(.4)
$: s("~ hh ~ ~").bank("tr909").dec(.4)
$: s("~ ~ ~ oh").bank("tr909").dec(.4)
```

(`codegen.test.js` proves event-for-event equality using Strudel's own parser.) The exact
one-line string is not reachable with the current data model; it would need multi-sound
tracks plus line merging. The step "alt" (`<a b>` at a step) alternates per **bar**, which
is a different groove.

## Synth tracks (phase 4)

- Oscillators registered by `@strudel/web`'s default prebake: `sawtooth`, `square`,
  `triangle`, `sine`, `supersaw` (AudioWorklet; bundled in `@strudel/web/dist`), plus
  `pulse`, `user`, `one` (not exposed).
- Melodies: `n("0 2 4").scale("C2:minor")` — scale degrees, root with octave, Tonal scale
  names with spaces written as `:` (`"C2:minor:pentatonic"`). Degrees may be negative/>7.
- Note length: in mini-notation an event lasts its slot; `_` extends the previous event
  (`"0 _ _ ~"` = a 3/16 note). **Unlike samples, synth duration matters**, so codegen only
  coarsens `note _` → `note` and `~ ~` → `~`, never `note ~` → `note` (that would lengthen
  it). Samples ignore hap duration unless `clip`/`release` is set
  (superdough `sampler.mjs`: `duration = sliceDuration`).
- Amp envelope: if *any* of attack/decay/sustain/release is set, superdough fills the
  rest with context-dependent defaults (e.g. decay alone ⇒ sustain≈0). So codegen emits
  all four together as `.adsr("a:d:s:r")` or none. Unset = `[.001, .001, 1, .01]`.
- Filter: `lpf`, `lpq` (resonance, default 1), `lpenv` (env amount in octaves; enables the
  filter envelope), `lpdecay` (default .14 when env is on; lpattack/lpsustain/lprelease
  also exist).
- `delay(amount)`; `delaytime` defaults to .25 s, `delayfeedback` to .5 (not exposed yet).

## Song mode (patterns A–D + chain)

- Each track has `pats[4]`; sound/knobs are per track, steps per pattern. Old projects
  (`steps` only) load as pattern A.
- Codegen: one line per track, `<slot slot …>` with one slot per bar, `x!n` for repeats,
  plain mini when all slots are equal. Empty slot = `~`.
- **Gotcha (verified with @strudel/mini):** inside `<[a <x y>] [b c]>` the inner `<x y>`
  advances once per *pass through the whole chain*, not per play of that slot. And
  `<[A] [A] [B]>` gives both A-slots the same phase. So codegen resolves alternation per
  slot (`slotPhases`): a pattern appearing c times per pass — even c ⇒ fixed `main`/`alt`
  per slot, odd c ⇒ `<main alt>` / `<alt main>`. `song.test.js` checks this against a
  bar-by-bar ground truth for random patterns and chains.
- Swapping code mid-bar keeps the clock, so the bar counter (`floor(scheduler.now())`)
  maps to chain slot `bar % chain.length` — matches how `<…>` picks slots.

## Sample preloading

`getSound("tr909_bd").data.samples` is the URL list (drum machines: array);
`loadBuffer(url, getAudioContext(), label)` fetches + decodes into superdough's cache
(same cache key the sampler uses). Works while the AudioContext is still suspended.
A sound missing from a machine (e.g. `tr909_cb`) has no entry → flagged "silent" in the UI.

## Background tabs

Safari suspends the AudioContext in background tabs; we `resume()` on `visibilitychange`.

## Demo songs / limits

- 8 patterns (A–H), chain up to 64 bars. Saved/shared JSON stores only hits
  (`[i]`, `[i, alt]`, synth `[i, note, len, alt?]`); older full-step and pre-pattern
  formats still load (`serialize.js` → `rawStep`).
- Demos live in `src/store/demos.js` as readable data and load through `fromJSON`.
- Harmony via alternation: a pattern played n times in a row alternates main/alt per
  bar. When a section has an odd bar count (trance drop: F×1 then G×7), the following
  pattern's notes are written with main/alt swapped so the progression stays in step.
  `demos.test.js` checks Am|F on every bar of the whole song.
- Known verbosity: in song mode an alternating pattern repeated n times is written out
  slot by slot (no mini-notation shorthand keeps per-play alternation across `!n`).
