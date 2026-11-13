# Offbeat

Make music in the browser with buttons and knobs instead of code. Offbeat is a
step sequencer and synth that generates [Strudel](https://strudel.cc) code
live, and Strudel plays it.

- Drum tracks on classic drum machines (TR-909, TR-808, …), 16 steps, per-step alternation
- Synth tracks with a piano roll, scales, filter/amp envelopes, built-in and random melodies
- Patterns A–D and a song chain
- Everything you build is shown as Strudel code, with a one-click "Open in strudel.cc"
- Autosave, and share links that carry the whole project in the URL

## Develop

```sh
npm install
npm run dev     # http://localhost:5173
npm run test    # codegen unit tests (Vitest)
npm run build
```

`src/engine/codegen.js` turns the project state into Strudel code and is the heart of the
app. `src/engine/strudel.js` is the only file that talks to Strudel. `NOTES.md` records
Strudel API details verified against the packages; `PLAN.md` is the original plan.

## License

AGPL-3.0-or-later (Strudel is AGPL too). See `LICENSE`.
