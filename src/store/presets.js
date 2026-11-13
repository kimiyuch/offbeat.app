// Built-in melodies for synth tracks.
// notes: { step: [scaleDegree, lengthInSteps = 1, altDegree = null] }
// Degrees are scale-relative (0 = root, 7 = root an octave up in a 7-note
// scale), so every preset plays in the track's current key and scale.
// `params` are applied on top of the default synth params.

export const MELODIES = [
  // --- bass ---
  {
    id: 'offbeat-bass',
    name: 'Offbeat bass',
    kind: 'bass',
    sound: 'sawtooth',
    octave: 2,
    params: { lpf: 500, lpq: 4, lpenv: 3, lpdecay: 0.15 },
    notes: { 2: [0, 2], 6: [0, 2], 10: [0, 2], 14: [0, 2, 3] },
  },
  {
    id: 'rolling-bass',
    name: 'Rolling 16ths',
    kind: 'bass',
    sound: 'sawtooth',
    octave: 2,
    params: { lpf: 400, lpq: 8, lpenv: 2.5, lpdecay: 0.12, decay: 0.12, sustain: 0.2 },
    notes: {
      0: [0], 1: [0], 2: [7], 3: [0], 4: [0], 5: [0], 6: [5], 7: [0],
      8: [0], 9: [0], 10: [3], 11: [0], 12: [0], 13: [0], 14: [4], 15: [2],
    },
  },
  {
    id: 'acid',
    name: 'Acid line',
    kind: 'bass',
    sound: 'sawtooth',
    octave: 2,
    params: { lpf: 300, lpq: 16, lpenv: 4.5, lpdecay: 0.18, sustain: 0.6, delay: 0.15 },
    notes: { 0: [0], 2: [0], 3: [7], 5: [0], 6: [3, 1, 2], 8: [0], 10: [5], 11: [7], 12: [0, 2], 14: [10], 15: [9] },
  },
  {
    id: 'dub-bass',
    name: 'Dub bass',
    kind: 'bass',
    sound: 'sine',
    octave: 2,
    params: { lpf: 20000, lpq: 1, lpenv: 0, attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.15, gain: 1 },
    notes: { 0: [0, 6], 8: [4, 3], 12: [3, 4, 2] },
  },
  {
    id: 'walking',
    name: 'Walking quarters',
    kind: 'bass',
    sound: 'triangle',
    octave: 2,
    params: { lpf: 2000, lpq: 1, lpenv: 1, attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.1, gain: 0.9 },
    notes: { 0: [0, 4], 4: [2, 4], 8: [4, 4, 5], 12: [5, 4, 6] },
  },

  // --- lead ---
  {
    id: 'hook',
    name: 'Supersaw hook',
    kind: 'lead',
    sound: 'supersaw',
    octave: 4,
    params: { gain: 0.5, lpf: 3000, lpq: 2, lpenv: 1.5, lpdecay: 0.3, sustain: 0.6, release: 0.3, delay: 0.3, room: 0.3 },
    notes: { 0: [4, 3], 3: [3], 4: [2, 2], 6: [0, 2], 8: [2, 3], 11: [4], 12: [7, 4, 9] },
  },
  {
    id: 'stabs',
    name: 'Offbeat stabs',
    kind: 'lead',
    sound: 'square',
    octave: 3,
    params: { gain: 0.5, lpf: 1800, lpq: 3, lpenv: 2, lpdecay: 0.1, decay: 0.15, sustain: 0.1, room: 0.35, delay: 0.25 },
    notes: { 2: [4], 6: [4], 10: [3], 14: [2, 1, 5] },
  },
  {
    id: 'call-response',
    name: 'Call & response',
    kind: 'lead',
    sound: 'triangle',
    octave: 4,
    params: { gain: 0.8, lpf: 6000, lpq: 1, lpenv: 0, attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.4, delay: 0.35, room: 0.25 },
    notes: { 0: [7, 2], 2: [6], 3: [4, 3], 8: [2, 2], 10: [4], 11: [3, 5, 0] },
  },

  // --- arp ---
  {
    id: 'arp-updown',
    name: 'Up-down arp',
    kind: 'arp',
    sound: 'square',
    octave: 4,
    params: { gain: 0.45, lpf: 2500, lpq: 2, lpenv: 1, decay: 0.12, sustain: 0.2, delay: 0.35, room: 0.2 },
    notes: { 0: [0, 2], 2: [2, 2], 4: [4, 2], 6: [7, 2, 9], 8: [9, 2, 11], 10: [7, 2], 12: [4, 2], 14: [2, 2] },
  },
  {
    id: 'trance-gate',
    name: 'Trance gate',
    kind: 'arp',
    sound: 'supersaw',
    octave: 4,
    params: { gain: 0.4, lpf: 2200, lpq: 3, lpenv: 1.5, lpdecay: 0.08, decay: 0.08, sustain: 0.1, release: 0.05, room: 0.3 },
    notes: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, [[0, 7, 4, 7][i % 4]]])),
  },
  {
    id: 'pluck-arp',
    name: 'Pluck arp',
    kind: 'arp',
    sound: 'sawtooth',
    octave: 3,
    params: { gain: 0.5, lpf: 900, lpq: 6, lpenv: 3, lpdecay: 0.1, decay: 0.15, sustain: 0, release: 0.2, delay: 0.4, room: 0.3 },
    notes: { 0: [0], 3: [4], 6: [7], 8: [9], 11: [7], 14: [4, 1, 11] },
  },
];

export const KIND_LABELS = { bass: 'Bass', lead: 'Lead', arp: 'Arp', mine: 'My melodies' };

// --- random melodies ---
// Musical-ish rather than uniform noise: rhythms come from a few groove
// templates, bass favours root/fifth/octave on strong beats, and leads move
// mostly stepwise with occasional leaps to chord tones.
// `style`: 'bass' | 'lead'. `rand`: () => [0, 1) (inject for tests).
const BASS_RHYTHMS = [
  [0, 3, 6, 8, 11, 14],
  [0, 2, 4, 6, 8, 10, 12, 14],
  [0, 3, 8, 11, 12],
  [2, 6, 10, 14],
  [0, 1, 4, 6, 8, 9, 12, 14],
];
const LEAD_RHYTHMS = [
  [0, 3, 6, 8, 10, 12],
  [0, 2, 3, 6, 8, 11, 12],
  [0, 4, 6, 8, 12, 14],
  [0, 1, 2, 4, 8, 9, 10, 12],
];

export function randomMelody(style = 'lead', rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const starts = [...pick(style === 'bass' ? BASS_RHYTHMS : LEAD_RHYTHMS)];
  const notes = {};
  let deg = style === 'bass' ? 0 : pick([2, 4, 7]);
  starts.forEach((s, k) => {
    const next = starts[k + 1] ?? 16;
    const gap = next - s;
    if (style === 'bass') {
      // root-heavy, with fifths, octaves and the odd passing note
      deg = s % 8 === 0 ? 0 : pick([0, 0, 0, 4, 7, 2, 5, 3]);
    } else {
      // stepwise walk with occasional leaps to chord tones, kept in range
      deg = rand() < 0.7 ? deg + pick([-2, -1, -1, 1, 1, 2]) : pick([0, 2, 4, 7, 9, 11]);
      deg = Math.max(0, Math.min(11, deg));
    }
    // mostly fill the gap (legato) for leads, shorter for bass
    const len = style === 'bass' ? Math.max(1, Math.min(gap, pick([1, 2, 2]))) : Math.max(1, gap - (rand() < 0.3 ? 1 : 0));
    notes[s] = [deg, len];
  });
  // a bit of variation every other bar on one late note
  const late = starts.filter((s) => s >= 8);
  if (late.length && rand() < 0.6) {
    const s = pick(late);
    const alt = Math.max(0, Math.min(14, notes[s][0] + pick([-2, 2, 3, 4])));
    if (alt !== notes[s][0]) notes[s][2] = alt;
  }
  return notes;
}
