import { describe, it, expect } from 'vitest';
import { synthTokens, synthStepsToMini, trackToLine, STEPS } from './codegen.js';
import { degreeLabel } from './scales.js';
import { mini } from '@strudel/mini';
import { n } from '@strudel/core';
import '@strudel/tonal'; // registers .scale()

const notes = (spec = {}) =>
  Array.from({ length: STEPS }, (_, i) =>
    i in spec ? { on: true, note: spec[i][0], len: spec[i][1] ?? 1, alt: spec[i][2] ?? null } : { on: false, note: 0, len: 1, alt: null },
  );
const synth = (spec, extra = {}) => ({
  id: 's', type: 'synth', sound: 'sawtooth', root: 'C', octave: 2, mode: 'minor',
  steps: notes(spec), mute: false, solo: false, params: {}, ...extra,
});
const proj = { bpm: 120, swing: 0, bank: 'tr909', tracks: [] };

// begin:duration:value for every onset, so lengths are compared too
const events = (pat, cycles = 2) =>
  pat.queryArc(0, cycles).filter((h) => h.hasOnset())
    .map((h) => `${h.whole.begin.toFraction()}+${h.whole.end.sub(h.whole.begin).toFraction()}:${JSON.stringify(h.value)}`)
    .sort();

describe('synthTokens', () => {
  it('renders ties, rests and cut-short notes', () => {
    expect(synthTokens(notes({ 0: [0, 3], 4: [2] })).slice(0, 6)).toEqual(['0', '_', '_', '~', '2', '~']);
    // note at 0 asks for 8 steps but a note starts at 2
    expect(synthTokens(notes({ 0: [0, 8], 2: [4] })).slice(0, 4)).toEqual(['0', '_', '4', '~']);
    expect(synthTokens(notes({ 0: [-3, 1, 5] }))[0]).toBe('<-3 5>');
  });
});

describe('synthStepsToMini', () => {
  it('compacts without changing note lengths', () => {
    expect(synthStepsToMini(notes({ 0: [0, 2], 2: [3, 2], 4: [0, 2], 6: [3, 2], 8: [0, 2], 10: [3, 2], 12: [0, 2], 14: [3, 2] }))).toBe('[0 3]*4');
    expect(synthStepsToMini(notes({ 0: [0, 4], 8: [5, 4] }))).toBe('0 ~ 5 ~');
    // 3-step note can't be halved
    expect(synthStepsToMini(notes({ 0: [0, 3] }))).toBe('0 _ _ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  });

  it('is event- and duration-identical to the raw 16-slot row', () => {
    const cases = [
      { 0: [0, 3] },
      { 0: [0, 4], 8: [5, 4] },
      { 0: [0, 2], 4: [2, 1], 6: [4, 2], 12: [7, 4] },
      { 0: [0, 8], 2: [4] },
      { 0: [0, 2, 3], 8: [5, 2] },
      { 1: [0], 3: [0], 5: [0], 7: [0], 9: [0], 11: [0], 13: [0], 15: [0] },
    ];
    for (const spec of cases) {
      const steps = notes(spec);
      expect(events(mini(synthStepsToMini(steps)))).toEqual(events(mini(synthTokens(steps).join(' '))));
    }
  });
});

describe('synth trackToLine', () => {
  it('emits n().scale().s() and omits neutral params', () => {
    expect(trackToLine(synth({ 0: [0, 4], 8: [3, 4] }), proj)).toBe('$: n("0 ~ 3 ~").scale("C2:minor").s("sawtooth")');
    // a single 16th must stay a 16th, not become a whole-bar note
    expect(trackToLine(synth({ 0: [0] }), proj)).toBe('$: n("0 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").scale("C2:minor").s("sawtooth")');
  });

  it('emits the whole ADSR when any stage is set, and lpdecay only with lpenv', () => {
    const line = trackToLine(synth({ 0: [0, 16] }, { params: { lpf: 600, lpq: 8, lpdecay: 0.3, attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1 } }), proj);
    expect(line).toBe('$: n("0").scale("C2:minor").s("sawtooth").lpf(600).lpq(8).adsr(".005:.2:.3:.1")');
    const withEnv = trackToLine(synth({ 0: [0] }, { params: { lpenv: 4, lpdecay: 0.3 } }), proj);
    expect(withEnv).toContain('.lpenv(4).lpdecay(.3)');
  });

  it('scale degrees resolve to the pitches the piano roll shows', () => {
    const line = trackToLine(synth({ 0: [0], 4: [2], 8: [4], 12: [7] }), proj);
    const pat = n(mini(line.match(/n\("([^"]*)"\)/)[1])).scale('C2:minor');
    const got = pat.queryArc(0, 1).map((h) => h.value.note);
    const want = [0, 2, 4, 7].map((d) => degreeLabel(d, 'C', 2, 'minor'));
    expect(got).toEqual(want);
  });
});
