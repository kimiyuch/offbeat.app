import { reactive, watch } from 'vue';
import {
  NEW_PARAMS, WAVES, MAX_CHAIN, synthSteps, emptySteps, makeTrack, makeSynth,
  defaultProject, fromJSON, toJSON, pickNumbers,
} from './serialize.js';

export { SOUNDS, WAVES, BANKS, NEW_PARAMS, MAX_CHAIN, defaultProject, fromJSON, toJSON } from './serialize.js';

const STORAGE_KEY = 'offbeat:v1';
const LEGACY_STORAGE_KEY = 'groovebox:v1'; // read-only fallback from before the rename

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
    const s = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
const MELODY_KEY = 'offbeat:melodies';
const LEGACY_MELODY_KEY = 'groovebox:melodies';

function loadUserMelodies() {
  try {
    const raw = JSON.parse(localStorage.getItem(MELODY_KEY) ?? localStorage.getItem(LEGACY_MELODY_KEY) ?? '[]');
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
