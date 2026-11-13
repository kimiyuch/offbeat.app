import { describe, it, expect } from 'vitest';
import { generateCode, stepsToMini, trackToLine, num, STEPS } from './codegen.js';
// Test-only: use Strudel's own mini-notation parser to prove that the code we
// emit is *musically* identical to the reference, not just similar-looking.
import { mini } from '@strudel/mini';
import { stack } from '@strudel/core';

const off = () => ({ on: false, alt: null });
const row = (hits = {}) =>
  Array.from({ length: STEPS }, (_, i) =>
    i in hits ? { on: true, alt: hits[i] === true ? null : hits[i] } : off(),
  );
const track = (sound, hits, extra = {}) => ({
  id: sound,
  sound,
  steps: row(hits),
  mute: false,
  solo: false,
  params: { gain: 1, dec: 0, lpf: 20000, room: 0, pan: 0.5, speed: 1 },
  ...extra,
});
const project = (tracks, extra = {}) => ({ bpm: 120, swing: 0, bank: 'tr909', tracks, ...extra });

// Strip `$: s("…")` -> mini string, for comparing event streams.
const miniOf = (line) => line.match(/s\("([^"]*)"\)/)[1];
const events = (pat, cycles = 4) =>
  pat
    .queryArc(0, cycles)
    .filter((h) => h.hasOnset())
    .map((h) => `${h.whole.begin.toFraction()}:${h.value}`)
    .sort();

describe('num', () => {
  it('formats like hand-written Strudel', () => {
    expect(num(0.4)).toBe('.4');
    expect(num(1)).toBe('1');
    expect(num(-0.25)).toBe('-.25');
    expect(num(1200.4)).toBe('1200');
    expect(num(0.333333)).toBe('.33');
  });
});

describe('stepsToMini', () => {
  it('folds regular rows', () => {
    expect(stepsToMini(row({ 0: true, 4: true, 8: true, 12: true }), 'bd')).toBe('bd*4');
    expect(stepsToMini(row(Object.fromEntries([...Array(16).keys()].map((i) => [i, true]))), 'hh')).toBe('hh*16');
    expect(stepsToMini(row({ 4: true, 12: true }), 'sd')).toBe('[~ sd]*2');
  });

  it('coarsens irregular rows without changing timing', () => {
    expect(stepsToMini(row({ 0: true, 10: true }), 'bd')).toBe('bd ~ ~ ~ ~ bd ~ ~');
    expect(stepsToMini(row({ 0: true, 3: true }), 'bd')).toBe('bd ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  });

  it('emits alternation and never folds rows that contain it', () => {
    expect(stepsToMini(row({ 0: 'oh' }), 'hh')).toBe('<hh oh>');
    expect(stepsToMini(row({ 4: 'oh', 12: 'oh' }), 'hh')).toBe('~ <hh oh> ~ <hh oh>');
  });

  it('every folded form is event-identical to the raw 16-step form', () => {
    const cases = [
      { 0: true, 4: true, 8: true, 12: true },
      { 4: true, 12: true },
      { 0: true, 10: true },
      { 2: true, 6: true, 10: true, 14: true },
      { 4: 'oh', 12: 'oh' },
      { 0: true, 3: 'cp', 8: true },
    ];
    for (const hits of cases) {
      const steps = row(hits);
      const raw = steps.map((s) => (!s.on ? '~' : s.alt ? `<x ${s.alt}>` : 'x')).join(' ');
      expect(events(mini(stepsToMini(steps, 'x')))).toEqual(events(mini(raw)));
    }
  });
});

describe('generateCode', () => {
  it('sets tempo as one bar per cycle', () => {
    expect(generateCode(project([]))).toBe('setcps(120/60/4)\nsilence');
  });

  it('drops empty tracks', () => {
    expect(generateCode(project([track('bd', {})]))).toBe('setcps(120/60/4)\nsilence');
  });

  it('all-on', () => {
    const all = Object.fromEntries([...Array(16).keys()].map((i) => [i, true]));
    expect(trackToLine(track('hh', all), project([]))).toBe('$: s("hh*16").bank("tr909")');
  });

  it('mute drops the line, solo keeps only soloed lines', () => {
    const a = track('bd', { 0: true });
    const b = track('sd', { 4: true }, { mute: true });
    expect(generateCode(project([a, b]))).toBe('setcps(120/60/4)\n$: s("bd").bank("tr909")');

    const c = track('hh', { 2: true, 6: true, 10: true, 14: true }, { solo: true });
    expect(generateCode(project([a, b, c]))).toBe('setcps(120/60/4)\n$: s("[~ hh]*4").bank("tr909")');
  });

  it('omits params at their default, emits the rest in a stable order', () => {
    const t = track('bd', { 0: true }, { params: { gain: 1, dec: 0.4, lpf: 800, room: 0, pan: 0.5, speed: 1 } });
    expect(trackToLine(t, project([]))).toBe('$: s("bd").bank("tr909").dec(.4).lpf(800)');
  });

  it('adds swing to every line', () => {
    const t = track('hh', { 0: true, 2: true });
    expect(trackToLine(t, project([], { swing: 0.5 }))).toContain('.swingBy(.25, 8)');
  });

  it('reference: $: s("[bd <hh oh>]*2").bank("tr909").dec(.4) is reachable by clicking', () => {
    // `<hh oh>` inside `*2` alternates per repetition, so every bar is
    // bd hh bd oh. The click-built equivalent: bd on 0/8, hh on 4, oh on 12.
    // (A step "alt" alternates per *bar*, which is a different groove.)
    const dec = { gain: 1, dec: 0.4, lpf: 20000, room: 0, pan: 0.5, speed: 1 };
    const p = project([
      track('bd', { 0: true, 8: true }, { params: dec }),
      track('hh', { 4: true }, { params: dec }),
      track('oh', { 12: true }, { params: dec }),
    ]);
    const code = generateCode(p);
    expect(code).toBe(
      [
        'setcps(120/60/4)',
        '$: s("bd*2").bank("tr909").dec(.4)',
        '$: s("~ hh ~ ~").bank("tr909").dec(.4)',
        '$: s("~ ~ ~ oh").bank("tr909").dec(.4)',
      ].join('\n'),
    );
    const ours = stack(...code.split('\n').slice(1).map((l) => mini(miniOf(l))));
    expect(events(ours)).toEqual(events(mini('[bd <hh oh>]*2')));
  });
});
