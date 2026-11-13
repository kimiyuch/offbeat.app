import { reactive, watch } from 'vue';
import { STEPS } from '../engine/codegen.js';

export const SOUNDS = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd', 'cb'];
export const BANKS = ['tr909', 'tr808', 'tr707', 'tr606', 'tr505', 'linn', 'lm1'];

// Initial knob values for a new track (not the same as codegen's "omit" defaults).
export const NEW_TRACK_PARAMS = { gain: 1, dec: 0, lpf: 20000, room: 0, pan: 0.5, speed: 1 };

const STORAGE_KEY = 'groovebox:v1';
let nextId = 1;

function makeTrack(sound, hits = []) {
  return {
    id: `t${nextId++}`,
    sound,
    steps: Array.from({ length: STEPS }, (_, i) => ({ on: hits.includes(i), alt: null })),
    mute: false,
    solo: false,
    params: { ...NEW_TRACK_PARAMS },
  };
}

export function defaultProject() {
  return {
    bpm: 120,
    swing: 0,
    bank: 'tr909',
    tracks: [
      makeTrack('bd', [0, 4, 8, 12]),
      makeTrack('sd', [4, 12]),
      makeTrack('hh', [2, 6, 10, 14]),
      makeTrack('oh', []),
    ],
  };
}

// Accepts anything and returns a valid project (unknown/missing fields -> defaults).
export function fromJSON(raw) {
  const d = defaultProject();
  if (!raw || typeof raw !== 'object') return d;
  const p = {
    bpm: clamp(Number(raw.bpm) || d.bpm, 40, 240),
    swing: clamp(Number(raw.swing) || 0, 0, 1),
    bank: typeof raw.bank === 'string' ? raw.bank : d.bank,
    tracks: Array.isArray(raw.tracks) ? raw.tracks.map(normTrack) : d.tracks,
  };
  return p;
}

function normTrack(t) {
  const base = makeTrack(typeof t?.sound === 'string' ? t.sound : 'bd');
  return {
    ...base,
    mute: !!t?.mute,
    solo: !!t?.solo,
    steps: base.steps.map((s, i) => ({
      on: !!t?.steps?.[i]?.on,
      alt: typeof t?.steps?.[i]?.alt === 'string' ? t.steps[i].alt : null,
    })),
    params: { ...NEW_TRACK_PARAMS, ...pickNumbers(t?.params) },
  };
}

function pickNumbers(o) {
  const out = {};
  for (const k of Object.keys(NEW_TRACK_PARAMS)) if (Number.isFinite(o?.[k])) out[k] = o[k];
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function toJSON(p) {
  // ids are runtime-only
  return {
    bpm: p.bpm,
    swing: p.swing,
    bank: p.bank,
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

export function removeTrack(id) {
  const i = project.tracks.findIndex((t) => t.id === id);
  if (i < 0) return;
  project.tracks.splice(i, 1);
  if (ui.selectedId === id) ui.selectedId = project.tracks[Math.max(0, i - 1)]?.id ?? null;
}

export function clearTrack(id) {
  const t = project.tracks.find((t) => t.id === id);
  t?.steps.forEach((s) => ((s.on = false), (s.alt = null)));
}
