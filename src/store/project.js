import { reactive, watch } from 'vue';
import { STEPS, trackType, PATTERN_NAMES } from '../engine/codegen.js';
import { SCALES, ROOTS } from '../engine/scales.js';

export const SOUNDS = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd', 'cb'];
export const WAVES = ['sawtooth', 'square', 'triangle', 'sine', 'supersaw'];
export const BANKS = ['tr909', 'tr808', 'tr707', 'tr606', 'tr505', 'linn', 'lm1'];

// Initial knob values for a new track (not the same as codegen's "omit" defaults).
export const NEW_PARAMS = {
  drum: { gain: 1, dec: 0, lpf: 20000, room: 0, pan: 0.5, speed: 1 },
  synth: {
    gain: 0.7, lpf: 700, lpq: 6, lpenv: 3, lpdecay: 0.2,
    attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1,
    room: 0, delay: 0, pan: 0.5,
  },
};

const STORAGE_KEY = 'groovebox:v1';
let nextId = 1;

const NPATS = PATTERN_NAMES.length;
const drumSteps = (hits = []) => Array.from({ length: STEPS }, (_, i) => ({ on: hits.includes(i), alt: null }));
const synthSteps = (notes = {}) =>
  Array.from({ length: STEPS }, (_, i) => {
    const n = notes[i];
    return n ? { on: true, note: n[0], len: n[1] ?? 1, alt: n[2] ?? null } : { on: false, note: 0, len: 1, alt: null };
  });
const emptySteps = (track) => (trackType(track) === 'synth' ? synthSteps() : drumSteps());

// hitsPerPattern: [[hits of A], [hits of B], ...]; missing patterns are empty
function makeTrack(sound, ...hitsPerPattern) {
  return {
    id: `t${nextId++}`,
    sound,
    pats: Array.from({ length: NPATS }, (_, p) => drumSteps(hitsPerPattern[p])),
    mute: false,
    solo: false,
    params: { ...NEW_PARAMS.drum },
  };
}

// notesPerPattern: [{ step: [degree, lengthInSteps, alt] }, ...]
function makeSynth(sound = 'sawtooth', notesPerPattern = [], extra = {}) {
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

export const MAX_CHAIN = 16;

// Saved before patterns existed: a single `steps` array becomes pattern A.
const rawPats = (t) => (Array.isArray(t?.pats) ? t.pats : [t?.steps]);

// Accepts anything and returns a valid project (unknown/missing fields -> defaults).
export function fromJSON(raw) {
  const d = defaultProject();
  if (!raw || typeof raw !== 'object') return d;
  const p = {
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
  return p;
}

function normTrack(t) {
  if (trackType(t) === 'synth') {
    const base = makeSynth(WAVES.includes(t.sound) ? t.sound : 'sawtooth');
    return {
      ...base,
      root: ROOTS.includes(t.root) ? t.root : 'C',
      octave: Number.isInteger(t.octave) ? clamp(t.octave, 0, 6) : 2,
      mode: t.mode in SCALES ? t.mode : 'minor',
      mute: !!t.mute,
      solo: !!t.solo,
      pats: base.pats.map((steps, p) =>
        steps.map((s, i) => {
          const r = rawPats(t)[p]?.[i];
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
    mute: !!t?.mute,
    solo: !!t?.solo,
    pats: base.pats.map((steps, p) =>
      steps.map((s, i) => {
        const r = rawPats(t)[p]?.[i];
        return { on: !!r?.on, alt: typeof r?.alt === 'string' ? r.alt : null };
      }),
    ),
    params: { ...NEW_PARAMS.drum, ...pickNumbers(t?.params, 'drum') },
  };
}

function pickNumbers(o, type) {
  const out = {};
  for (const k of Object.keys(NEW_PARAMS[type])) if (Number.isFinite(o?.[k])) out[k] = o[k];
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function toJSON(p) {
  // ids are runtime-only
  return {
    bpm: p.bpm,
    swing: p.swing,
    bank: p.bank,
    pattern: p.pattern,
    chain: p.chain,
    song: p.song,
    tracks: p.tracks.map(({ id, ...t }) => t),
  };
}

// --- URL hash sharing (base64 JSON, UTF-8 safe) ---
export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
export function b64decode(b64) {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export function shareUrl(p) {
  const url = new URL(location.href);
  url.hash = 'p=' + encodeURIComponent(b64encode(JSON.stringify(toJSON(p))));
  return url.toString();
}
function fromHash() {
  const m = location.hash.match(/^#p=(.+)$/);
  if (!m) return null;
  try {
    return fromJSON(JSON.parse(b64decode(decodeURIComponent(m[1]))));
  } catch {
    return null;
  }
}
function fromStorage() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? fromJSON(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

// --- the store ---
export const project = reactive(fromHash() ?? fromStorage() ?? defaultProject());
export const ui = reactive({ selectedId: project.tracks[0]?.id ?? null });

watch(
  project,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON(project)));
    } catch {
      /* storage blocked: fine, just no autosave */
    }
  },
  { deep: true },
);

export function replaceProject(next) {
  Object.assign(project, fromJSON(next));
  ui.selectedId = project.tracks[0]?.id ?? null;
}

export function addTrack(sound = 'cp') {
  const t = makeTrack(sound);
  project.tracks.push(t);
  ui.selectedId = t.id;
}

export function addSynth() {
  const other = project.tracks.find((x) => x.type === 'synth');
  const t = makeSynth('square', [], { octave: 4, root: other?.root ?? 'C', mode: other?.mode ?? 'minor' });
  t.params = { ...t.params, lpf: 2500, lpenv: 1, sustain: 0.3, delay: 0.3, room: 0.2 };
  project.tracks.push(t);
  ui.selectedId = t.id;
}

export function removeTrack(id) {
  const i = project.tracks.findIndex((t) => t.id === id);
  if (i < 0) return;
  project.tracks.splice(i, 1);
  if (ui.selectedId === id) ui.selectedId = project.tracks[Math.max(0, i - 1)]?.id ?? null;
}

// The steps currently being edited for a track.
export const stepsOf = (track) => track.pats[project.pattern];

export function clearTrack(id) {
  const t = project.tracks.find((t) => t.id === id);
  if (t) t.pats[project.pattern] = emptySteps(t);
}

// --- patterns & chain ---
export const patternHasNotes = (p) => project.tracks.some((t) => t.pats[p].some((s) => s.on));

let clipboard = null;
export const clip = reactive({ has: false, from: null });
export function copyPattern() {
  clipboard = project.tracks.map((t) => ({ id: t.id, steps: JSON.parse(JSON.stringify(t.pats[project.pattern])) }));
  clip.has = true;
  clip.from = project.pattern;
}
export function pastePattern() {
  if (!clipboard) return;
  for (const t of project.tracks) {
    const c = clipboard.find((x) => x.id === t.id);
    if (c) t.pats[project.pattern] = JSON.parse(JSON.stringify(c.steps));
  }
}
export function clearPattern() {
  for (const t of project.tracks) t.pats[project.pattern] = emptySteps(t);
}
export function chainPush(p) {
  if (project.chain.length < MAX_CHAIN) project.chain.push(p);
}
export function chainRemove(k) {
  project.chain.splice(k, 1);
}

// --- melodies: built-in presets + the user's own (localStorage only) ---
const MELODY_KEY = 'groovebox:melodies';

function loadUserMelodies() {
  try {
    const raw = JSON.parse(localStorage.getItem(MELODY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((m) => m && typeof m.name === 'string' && m.notes) : [];
  } catch {
    return [];
  }
}
export const userMelodies = reactive(loadUserMelodies());
watch(userMelodies, () => {
  try {
    localStorage.setItem(MELODY_KEY, JSON.stringify(userMelodies));
  } catch {
    /* no storage: melodies last for this session only */
  }
});

// Replaces the track's notes, sound, octave and knobs. Key and scale stay.
export function applyMelody(track, m) {
  track.pats[project.pattern] = synthSteps(m.notes);
  if (WAVES.includes(m.sound)) track.sound = m.sound;
  if (Number.isInteger(m.octave)) track.octave = m.octave;
  track.params = { ...NEW_PARAMS.synth, ...pickNumbers(m.params, 'synth') };
}

export function saveMelody(track, name) {
  const notes = {};
  stepsOf(track).forEach((s, i) => {
    if (s.on) notes[i] = [s.note, s.len, s.alt];
  });
  const m = { id: `u${Date.now()}`, name, kind: 'mine', sound: track.sound, octave: track.octave, params: { ...track.params }, notes };
  userMelodies.push(m);
  return m;
}

export function deleteMelody(id) {
  const i = userMelodies.findIndex((m) => m.id === id);
  if (i >= 0) userMelodies.splice(i, 1);
}

// Notes only: keeps the track's sound and knobs.
export function setNotes(track, notes) {
  track.pats[project.pattern] = synthSteps(notes);
}
