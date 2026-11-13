// Demo songs. Plain data in a readable shorthand, turned into the saved-project
// format; loading goes through the same fromJSON() as any saved project.
import { NPATS } from './serialize.js';

const PAT = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
const range = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step);

// byPattern: { A: hits | notes, ... } -> compact pats array (see serialize.js)
function drum(sound, params, byPattern) {
  const pats = Array.from({ length: NPATS }, () => []);
  for (const [name, hits] of Object.entries(byPattern)) pats[PAT[name]] = hits.map((i) => [i]);
  return { sound, params, pats };
}
function synth(name, sound, opts, params, byPattern) {
  const pats = Array.from({ length: NPATS }, () => []);
  for (const [pname, notes] of Object.entries(byPattern)) {
    pats[PAT[pname]] = Object.entries(notes).map(([i, [n, len = 1, alt]]) => (alt == null ? [+i, n, len] : [+i, n, len, alt]));
  }
  return { type: 'synth', name, sound, ...opts, params, pats };
}
// Same notes with main and alternate swapped: the pattern then starts on the
// other chord. Used where a section starts on an odd bar of the progression.
const swap = (notes) =>
  Object.fromEntries(Object.entries(notes).map(([i, [n, len = 1, alt]]) => [i, alt == null ? [n, len] : [alt, len, n]]));

// ---------------------------------------------------------------------------
// Trance — A minor, 138 BPM, 40 bars (~70 s).
// Harmony: Am | F, one chord per bar, via each step's alternate note: the main
// note is the Am version, the alternate the F version, so every pattern plays
// Am, F, Am, F … as it repeats. Degrees in A natural minor: 0 A, 2 C, 4 E, 5 F, 7 A'.
// ---------------------------------------------------------------------------
function trance() {
  const four = [0, 4, 8, 12];
  const offbeats = [2, 6, 10, 14];
  const all16 = range(0, 15);

  // rolling bass: the three 16ths after each kick, A2 / F2
  const bass = Object.fromEntries([1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((i) => [i, [7, 1, 5]]));
  // arp over Am (A C E), the F version only lifts E to F
  const arpAm = [0, 2, 4, 7, 4, 2, 4, 7, 0, 2, 4, 7, 9, 7, 4, 2];
  const arp = Object.fromEntries(arpAm.map((n, i) => [i, n === 4 ? [4, 1, 5] : [n, 1]]));
  // the hook: A C B A E C over Am, A C A F F D over F
  const lead = { 0: [7, 3], 3: [9, 3], 6: [8, 2, 7], 8: [7, 2, 5], 10: [4, 2, 5], 12: [2, 4, 3] };
  // two pad voices on top of the bass root: E→F moves, C stays
  const padHi = { 0: [4, 16, 5] };
  const padLo = { 0: [2, 16] };

  const key = { root: 'A', mode: 'minor' };
  const padParams = { gain: 0.22, lpf: 1600, lpq: 1, lpenv: 0, attack: 0.35, decay: 0.5, sustain: 0.8, release: 0.6, room: 0.55 };

  return {
    bpm: 138,
    swing: 0,
    bank: 'tr909',
    pattern: 0,
    song: true,
    // A intro · B groove · E breakdown · C build · D build (no kick) · F drop bar 1 (crash) · G drop · H outro
    chain: [
      ...Array(4).fill(PAT.A),
      ...Array(8).fill(PAT.B),
      ...Array(8).fill(PAT.E),
      ...Array(4).fill(PAT.C),
      ...Array(4).fill(PAT.D),
      PAT.F,
      ...Array(7).fill(PAT.G), // odd count after F: G's notes are swapped so the drop keeps Am | F
      ...Array(4).fill(PAT.H),
    ],
    tracks: [
      drum('bd', { gain: 1.1 }, { A: four, B: four, C: four, F: four, G: four, H: four }),
      drum('cp', { gain: 0.8, room: 0.15 }, { B: [4, 12], F: [4, 12], G: [4, 12] }),
      drum('oh', { gain: 0.65, dec: 0.25 }, { A: offbeats, B: offbeats, F: offbeats, G: offbeats, H: offbeats }),
      drum('hh', { gain: 0.4, dec: 0.06, pan: 0.42 }, { B: all16, C: all16, F: all16, G: all16, H: all16 }),
      drum('sd', { gain: 0.6, room: 0.25 }, { C: range(0, 14, 2), D: all16 }),
      drum('cr', { gain: 0.7, room: 0.3 }, { F: [0] }),
      synth('Bass', 'sawtooth', { ...key, octave: 1 },
        { gain: 0.8, lpf: 350, lpq: 8, lpenv: 3, lpdecay: 0.1, attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.05 },
        { B: bass, F: bass, G: swap(bass), H: bass }),
      synth('Arp', 'square', { ...key, octave: 4 },
        { gain: 0.3, lpf: 2400, lpq: 3, lpenv: 1.5, lpdecay: 0.1, attack: 0.002, decay: 0.1, sustain: 0.15, release: 0.05, delay: 0.3, room: 0.25, pan: 0.6 },
        { C: arp, D: arp, F: arp, G: swap(arp) }),
      synth('Lead', 'supersaw', { ...key, octave: 4 },
        { gain: 0.4, lpf: 3500, lpq: 2, lpenv: 1, lpdecay: 0.3, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3, delay: 0.3, room: 0.35 },
        { E: lead, F: lead, G: swap(lead) }),
      synth('Pad high', 'supersaw', { ...key, octave: 3 }, { ...padParams, pan: 0.65 },
        { C: padHi, D: padHi, E: padHi, F: padHi, G: swap(padHi) }),
      synth('Pad low', 'supersaw', { ...key, octave: 3 }, { ...padParams, pan: 0.35 },
        { C: padLo, D: padLo, E: padLo, F: padLo, G: padLo }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Electro — E phrygian, 112 BPM, TR-808, 48 bars (~1:43).
// Harmony: Em | F (i – bII, the dark phrygian move), one chord per bar via the
// alternate note. Every section has an even number of bars, so each pattern
// always starts on Em and nothing needs swapping.
// Degrees in E phrygian: 0 E, 1 F, 2 G, 3 A, 4 B, 5 C, 6 D, 7 E'.
// ---------------------------------------------------------------------------
function electro() {
  const all16 = range(0, 15);
  const kick = [0, 7, 10];

  // syncopated bass, root and octave jumps; over F the roots move up a half step
  const bass = { 0: [0, 2, 1], 3: [0, 1, 1], 6: [7, 1, 8], 7: [0, 2, 1], 10: [3, 1], 11: [2, 2, 3], 14: [0, 1, 1], 15: [7, 1, 8] };
  // robotic call: B B E' D B G A E over Em, C C F' C C A F F over F
  const lead = { 0: [4, 1, 5], 2: [4, 1, 5], 4: [7, 2, 8], 7: [6, 1, 5], 8: [4, 2, 5], 11: [2, 1, 3], 12: [3, 2, 1], 14: [0, 2, 1] };
  // two slow voices: B→C and G→A (Em → F)
  const padHi = { 0: [4, 16, 5] };
  const padLo = { 0: [2, 16, 3] };

  const key = { root: 'E', mode: 'phrygian' };
  const padParams = { gain: 0.2, lpf: 1200, lpq: 2, lpenv: 0, attack: 0.6, decay: 0.6, sustain: 0.8, release: 0.8, room: 0.5, delay: 0.15 };

  return {
    bpm: 112,
    swing: 0.15,
    bank: 'tr808',
    pattern: 0,
    song: true,
    // A intro · B beat + bass · C + lead · D breakdown · E full · F fill · E again · G outro
    chain: [
      ...Array(4).fill(PAT.A),
      ...Array(8).fill(PAT.B),
      ...Array(8).fill(PAT.C),
      ...Array(8).fill(PAT.D),
      ...Array(8).fill(PAT.E),
      ...Array(2).fill(PAT.F),
      ...Array(4).fill(PAT.E),
      ...Array(6).fill(PAT.G),
    ],
    tracks: [
      drum('bd', { gain: 1 }, { A: [0, 10], B: kick, C: kick, E: kick, F: [0, 7], G: [0, 10] }),
      drum('sd', { gain: 0.75 }, { B: [4, 12], C: [4, 12], E: [4, 12], F: [4, 12, 14, 15] }),
      drum('cp', { gain: 0.55, room: 0.2 }, { C: [4, 12], E: [4, 12] }),
      drum('rim', { gain: 0.5, room: 0.3 }, { D: [4, 12] }),
      drum('hh', { gain: 0.35, dec: 0.04, pan: 0.42 }, { A: all16, B: all16, C: all16, D: [2, 6, 10, 14], E: all16, G: all16 }),
      drum('oh', { gain: 0.4, dec: 0.2 }, { B: [14], C: [14], E: [14] }),
      drum('cb', { gain: 0.32, pan: 0.65, room: 0.15 }, { A: [3, 6, 11], C: [3, 6, 11], D: [3, 6, 11], E: [3, 6, 11] }),
      drum('ht', { gain: 0.6, room: 0.2 }, { F: [8, 9, 10] }),
      drum('lt', { gain: 0.65, room: 0.2 }, { F: [11, 12, 13] }),
      synth('Bass', 'square', { ...key, octave: 2 },
        { gain: 0.6, lpf: 500, lpq: 10, lpenv: 2.5, lpdecay: 0.15, attack: 0.003, decay: 0.2, sustain: 0.3, release: 0.05 },
        { B: bass, C: bass, D: bass, E: bass, F: bass }),
      synth('Lead', 'square', { ...key, octave: 4 },
        { gain: 0.28, lpf: 2200, lpq: 4, lpenv: 2, lpdecay: 0.12, attack: 0.003, decay: 0.15, sustain: 0.3, release: 0.1, delay: 0.35, room: 0.2, pan: 0.58 },
        { C: lead, E: lead }),
      synth('Pad high', 'sawtooth', { ...key, octave: 3 }, { ...padParams, pan: 0.65 }, { D: padHi, E: padHi, G: padHi }),
      synth('Pad low', 'sawtooth', { ...key, octave: 3 }, { ...padParams, pan: 0.35 }, { D: padLo, E: padLo, G: padLo }),
    ],
  };
}

export const DEMOS = [
  { id: 'trance', name: 'Trance — A minor, 138 BPM', build: trance },
  { id: 'electro', name: 'Electro — E phrygian, 112 BPM', build: electro },
];
