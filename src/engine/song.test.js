import { describe, it, expect } from 'vitest';
import { trackMini, slotPhases, playOrder, generateCode, synthTokens, STEPS } from './codegen.js';
import { mini } from '@strudel/mini';

// tiny seeded RNG so failures are reproducible
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const empty = () => Array.from({ length: STEPS }, () => ({ on: false, alt: null }));
function randomDrumPat(r) {
  return Array.from({ length: STEPS }, () => {
    const on = r() < 0.35;
    return { on, alt: on && r() < 0.3 ? 'oh' : null };
  });
}
function randomSynthPat(r) {
  const steps = Array.from({ length: STEPS }, () => ({ on: false, note: 0, len: 1, alt: null }));
  for (let i = 0; i < STEPS; i++) {
    if (r() < 0.3) steps[i] = { on: true, note: Math.floor(r() * 8), len: 1 + Math.floor(r() * 4), alt: r() < 0.3 ? 9 : null };
  }
  return steps;
}

const onsets = (pat, cycles) =>
  pat.queryArc(0, cycles).filter((h) => h.hasOnset())
    .map((h) => `${h.whole.begin.toFraction()}+${h.whole.end.sub(h.whole.begin).toFraction()}:${h.value}`)
    .sort();

// Ground truth, straight from the definition: bar c plays pattern order[c % L];
// a step's alternate sounds on every odd-numbered play of that pattern.
function expected(track, order, cycles, synth) {
  const out = [];
  const count = {};
  order.forEach((p) => (count[p] = (count[p] ?? 0) + 1));
  for (let c = 0; c < cycles; c++) {
    const k = c % order.length;
    const p = order[k];
    const before = order.slice(0, k).filter((q) => q === p).length;
    const occurrence = Math.floor(c / order.length) * count[p] + before;
    const steps = track.pats[p];
    const toks = synth
      ? synthTokens(steps, occurrence % 2 ? 'b' : 'a')
      : steps.map((s) => (!s.on ? '~' : s.alt && occurrence % 2 ? s.alt : track.sound));
    // one bar of plain 16-slot notation, shifted to bar c
    for (const h of mini(toks.join(' ')).queryArc(0, 1)) {
      if (!h.hasOnset()) continue;
      out.push(`${h.whole.begin.add(c).toFraction()}+${h.whole.end.sub(h.whole.begin).toFraction()}:${h.value}`);
    }
  }
  return out.sort();
}

describe('slotPhases', () => {
  it('fixes the phase for even counts, alternates per pass for odd counts', () => {
    expect(slotPhases([0])).toEqual(['ab']);
    expect(slotPhases([0, 0, 1, 0])).toEqual(['ab', 'ba', 'ab', 'ab']);
    expect(slotPhases([0, 0, 1, 1])).toEqual(['a', 'b', 'a', 'b']);
  });
});

describe('playOrder', () => {
  it('uses the edited pattern unless song mode is on', () => {
    expect(playOrder({ pattern: 2, chain: [0, 1], song: false })).toEqual([2]);
    expect(playOrder({ pattern: 2, chain: [0, 1], song: true })).toEqual([0, 1]);
    expect(playOrder({ pattern: 2, chain: [], song: true })).toEqual([2]);
  });
});

describe('trackMini (song)', () => {
  it('reads nicely', () => {
    const four = empty().map((s, i) => ({ on: i % 4 === 0, alt: null }));
    const fill = empty().map((s, i) => ({ on: [0, 4, 8, 10, 12, 14].includes(i), alt: null }));
    const t = { sound: 'bd', pats: [four, fill, empty(), empty()] };
    expect(trackMini(t, [0, 0, 0, 1])).toBe('<[bd*4]!3 [bd ~ bd ~ bd bd bd bd]>');
    expect(trackMini(t, [0, 0])).toBe('bd*4');
    expect(trackMini(t, [0, 2])).toBe('<[bd*4] ~>');
    expect(trackMini(t, [2, 3])).toBe(null);
  });

  const chains = [[0], [0, 1], [0, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 0, 0], [3, 3, 3], [0, 1, 0, 2, 0, 1, 0, 3]];
  for (const order of chains) {
    it(`drums: chain ${order.map((p) => 'ABCD'[p]).join('')} plays exactly the defined bars`, () => {
      const r = rng(order.length * 7 + order[0]);
      const t = { sound: 'hh', pats: [0, 1, 2, 3].map(() => randomDrumPat(r)) };
      const L = order.length;
      expect(onsets(mini(trackMini(t, order) ?? '~'), L * 4)).toEqual(expected(t, order, L * 4, false));
    });
    it(`synth: chain ${order.map((p) => 'ABCD'[p]).join('')} keeps notes, lengths and alternation`, () => {
      const r = rng(order.length * 13 + 5);
      const t = { type: 'synth', sound: 'sawtooth', pats: [0, 1, 2, 3].map(() => randomSynthPat(r)) };
      const L = order.length;
      expect(onsets(mini(trackMini(t, order) ?? '~'), L * 4)).toEqual(expected(t, order, L * 4, true));
    });
  }
});

describe('generateCode with patterns', () => {
  it('drops a track that is empty in every played pattern', () => {
    const t = { sound: 'bd', pats: [empty(), empty(), empty(), empty()], params: {} };
    t.pats[1][0] = { on: true, alt: null };
    const p = { bpm: 120, swing: 0, bank: 'tr909', pattern: 0, chain: [0, 1], song: false, tracks: [t] };
    expect(generateCode(p)).toBe('setcps(120/60/4)\nsilence');
    expect(generateCode({ ...p, song: true })).toBe('setcps(120/60/4)\n$: s("<~ bd>").bank("tr909")');
  });
});
