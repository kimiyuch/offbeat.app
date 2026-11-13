// Pure project helpers: building, normalising (fromJSON) and compact saving
// (toJSON). No Vue, no browser APIs, so this module is testable in Node.
import { STEPS, trackType, PATTERN_NAMES } from '../engine/codegen.js';
import { SCALES, ROOTS } from '../engine/scales.js';

export const SOUNDS = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd', 'cb'];
export const WAVES = ['sawtooth', 'square', 'triangle', 'sine', 'supersaw'];
export const BANKS = ['tr909', 'tr808', 'tr707', 'tr606', 'tr505', 'linn', 'lm1'];
export const NPATS = PATTERN_NAMES.length;
export const MAX_CHAIN = 64;

// Initial knob values for a new track (not the same as codegen's "omit" defaults).
export const NEW_PARAMS = {
  drum: { gain: 1, dec: 0, lpf: 20000, room: 0, pan: 0.5, speed: 1 },
  synth: {
    gain: 0.7, lpf: 700, lpq: 6, lpenv: 3, lpdecay: 0.2,
    attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1,
    room: 0, delay: 0, pan: 0.5,
  },
};

let nextId = 1;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const drumSteps = (hits = []) => Array.from({ length: STEPS }, (_, i) => ({ on: hits.includes(i), alt: null }));
// notes: { step: [degree, len = 1, alt = null] }
export const synthSteps = (notes = {}) =>
  Array.from({ length: STEPS }, (_, i) => {
    const n = notes[i];
    return n ? { on: true, note: n[0], len: n[1] ?? 1, alt: n[2] ?? null } : { on: false, note: 0, len: 1, alt: null };
  });
export const emptySteps = (track) => (trackType(track) === 'synth' ? synthSteps() : drumSteps());

// hitsPerPattern: [[hits of A], [hits of B], ...]; missing patterns are empty
export function makeTrack(sound, ...hitsPerPattern) {
  return {
    id: `t${nextId++}`,
    sound,
    pats: Array.from({ length: NPATS }, (_, p) => drumSteps(hitsPerPattern[p])),
    mute: false,
    solo: false,
    params: { ...NEW_PARAMS.drum },
  };
}

// notesPerPattern: [{ step: [degree, len, alt] }, ...]
export function makeSynth(sound = 'sawtooth', notesPerPattern = [], extra = {}) {
  return {
    id: `t${nextId++}`,
    type: 'synth',
    sound,
    root: 'C',
    octave: 2,
    mode: 'minor',
    pats: Array.from({ length: NPATS }, (_, p) => synthSteps(notesPerPattern[p])),
    mute: false,
    solo: false,
    params: { ...NEW_PARAMS.synth },
    ...extra,
  };
}

export function defaultProject() {
  return {
    bpm: 120,
    swing: 0,
    bank: 'tr909',
    pattern: 0,
    chain: [0, 0, 0, 1],
    song: false,
    tracks: [
      makeTrack('bd', [0, 4, 8, 12], [0, 4, 8, 10, 12]),
      makeTrack('sd', [4, 12], [4, 12, 13, 14, 15]),
      makeTrack('hh', [2, 6, 10, 14], [2, 6, 10]),
      makeTrack('oh', [], [14]),
      makeSynth('sawtooth', [
        { 0: [0, 2], 3: [0, 1], 6: [7, 2], 8: [0, 2], 11: [5, 1], 12: [3, 2], 14: [2, 2] },
        { 0: [0, 2], 3: [0, 1], 6: [7, 2], 8: [5, 2], 10: [4, 2], 12: [3, 2], 14: [4, 2] },
      ]),
    ],
  };
}

// --- reading ---

// Steps of pattern p as saved, in any of the formats we have written:
//  - compact (current): only the hits, drum [i] / [i, alt], synth [i, note, len, alt?]
//  - full (older): 16 step objects
//  - pre-patterns: a single `steps` array, which becomes pattern A
function rawStep(t, p, i) {
  const pats = Array.isArray(t?.pats) ? t.pats : [t?.steps];
  const pat = pats[p];
  if (!Array.isArray(pat)) return null;
  if (pat.every(Array.isArray)) {
    const hit = pat.find((h) => h[0] === i);
    if (!hit) return null;
    return trackType(t) === 'synth'
      ? { on: true, note: hit[1], len: hit[2], alt: hit[3] ?? null }
      : { on: true, alt: hit[1] ?? null };
  }
  return pat[i] ?? null;
}

// Accepts anything and returns a valid project (unknown/missing fields -> defaults).
export function fromJSON(raw) {
  const d = defaultProject();
  if (!raw || typeof raw !== 'object') return d;
  return {
    bpm: clamp(Number(raw.bpm) || d.bpm, 40, 240),
    swing: clamp(Number(raw.swing) || 0, 0, 1),
    bank: typeof raw.bank === 'string' ? raw.bank : d.bank,
    pattern: Number.isInteger(raw.pattern) ? clamp(raw.pattern, 0, NPATS - 1) : 0,
    chain: Array.isArray(raw.chain)
      ? raw.chain.filter((x) => Number.isInteger(x) && x >= 0 && x < NPATS).slice(0, MAX_CHAIN)
      : [0],
    song: !!raw.song,
    tracks: Array.isArray(raw.tracks) ? raw.tracks.map(normTrack) : d.tracks,
  };
}

function normTrack(t) {
  if (trackType(t) === 'synth') {
    const base = makeSynth(WAVES.includes(t.sound) ? t.sound : 'sawtooth');
    return {
      ...base,
      ...trackName(t),
      root: ROOTS.includes(t.root) ? t.root : 'C',
      octave: Number.isInteger(t.octave) ? clamp(t.octave, 0, 6) : 2,
      mode: t.mode in SCALES ? t.mode : 'minor',
      mute: !!t.mute,
      solo: !!t.solo,
      pats: base.pats.map((steps, p) =>
        steps.map((s, i) => {
          const r = rawStep(t, p, i);
          return {
            on: !!r?.on,
            note: Number.isInteger(r?.note) ? r.note : 0,
            len: Number.isInteger(r?.len) ? clamp(r.len, 1, STEPS - i) : 1,
            alt: Number.isInteger(r?.alt) ? r.alt : null,
          };
        }),
      ),
      params: { ...NEW_PARAMS.synth, ...pickNumbers(t.params, 'synth') },
    };
  }
  const base = makeTrack(typeof t?.sound === 'string' ? t.sound : 'bd');
  return {
    ...base,
    ...trackName(t),
    mute: !!t?.mute,
    solo: !!t?.solo,
    pats: base.pats.map((steps, p) =>
      steps.map((s, i) => {
        const r = rawStep(t, p, i);
        return { on: !!r?.on, alt: typeof r?.alt === 'string' ? r.alt : null };
      }),
    ),
    params: { ...NEW_PARAMS.drum, ...pickNumbers(t?.params, 'drum') },
  };
}

// Optional display name, e.g. "Lead" or "Pad high".
const trackName = (t) => (typeof t?.name === 'string' && t.name.trim() ? { name: t.name.trim().slice(0, 24) } : {});

export function pickNumbers(o, type) {
  const out = {};
  for (const k of Object.keys(NEW_PARAMS[type])) if (Number.isFinite(o?.[k])) out[k] = o[k];
  return out;
}

// --- writing (compact: only the steps that are on) ---

function compactPat(steps, synth) {
  const out = [];
  steps.forEach((s, i) => {
    if (!s.on) return;
    if (synth) out.push(s.alt != null ? [i, s.note, s.len, s.alt] : [i, s.note, s.len]);
    else out.push(s.alt ? [i, s.alt] : [i]);
  });
  return out;
}

export function toJSON(p) {
  return {
    bpm: p.bpm,
    swing: p.swing,
    bank: p.bank,
    pattern: p.pattern,
    chain: p.chain,
    song: p.song,
    // ids are runtime-only
    tracks: p.tracks.map(({ id, pats, ...t }) => ({
      ...t,
      pats: pats.map((steps) => compactPat(steps, trackType(t) === 'synth')),
    })),
  };
}
