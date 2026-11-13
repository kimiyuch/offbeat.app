import { describe, it, expect } from 'vitest';
import { MELODIES, KIND_LABELS } from './presets.js';
import { trackToLine, synthTokens, STEPS } from '../engine/codegen.js';
import { mini } from '@strudel/mini';

const ROWS = 15; // piano roll shows degrees 0..14
const toSteps = (m) =>
  Array.from({ length: STEPS }, (_, i) => {
    const n = m.notes[i];
    return n ? { on: true, note: n[0], len: n[1] ?? 1, alt: n[2] ?? null } : { on: false, note: 0, len: 1, alt: null };
  });

describe('built-in melodies', () => {
  it('have unique ids and known kinds', () => {
    expect(new Set(MELODIES.map((m) => m.id)).size).toBe(MELODIES.length);
    for (const m of MELODIES) expect(Object.keys(KIND_LABELS)).toContain(m.kind);
  });

  for (const m of MELODIES) {
    it(`${m.name}: every note is visible in the piano roll and fits the bar`, () => {
      for (const [step, [deg, len = 1, alt = null]] of Object.entries(m.notes)) {
        const i = Number(step);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(STEPS);
        expect(deg).toBeGreaterThanOrEqual(0);
        expect(deg).toBeLessThan(ROWS);
        if (alt !== null) expect(alt).toBeGreaterThanOrEqual(0), expect(alt).toBeLessThan(ROWS);
        expect(i + len).toBeLessThanOrEqual(STEPS);
      }
    });

    it(`${m.name}: generates code Strudel can parse`, () => {
      const track = { type: 'synth', sound: m.sound, root: 'C', octave: m.octave, mode: 'minor', steps: toSteps(m), params: m.params };
      const line = trackToLine(track, { swing: 0 });
      expect(line).toMatch(/^\$: n\(".+"\)\.scale\("C\d:minor"\)\.s\("\w+"\)/);
      const body = line.match(/n\("([^"]*)"\)/)[1];
      const onsets = mini(body).queryArc(0, 1).filter((h) => h.hasOnset()).length;
      expect(onsets).toBe(synthTokens(toSteps(m)).filter((t) => t !== '~' && t !== '_').length);
    });
  }
});
