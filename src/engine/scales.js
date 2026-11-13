// Pure scale helpers for labelling the piano roll. Strudel (via Tonal) does the
// real degree -> note conversion; these names must be valid Tonal scale names
// with spaces written as ':' (Strudel's convention).

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'harmonic:minor': [0, 2, 3, 5, 7, 8, 11],
  'minor:pentatonic': [0, 3, 5, 7, 10],
  'major:pentatonic': [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
};

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Scale degree -> semitones above the root (degrees may exceed one octave or be negative).
export function degreeToSemitone(degree, mode) {
  const iv = SCALES[mode] ?? SCALES.minor;
  const oct = Math.floor(degree / iv.length);
  return oct * 12 + iv[((degree % iv.length) + iv.length) % iv.length];
}

// Human label, e.g. (0, 'C', 3, 'minor') -> "C3", (2, ...) -> "Eb3"
export function degreeLabel(degree, root, octave, mode) {
  const midi = (octave + 1) * 12 + ROOTS.indexOf(root) + degreeToSemitone(degree, mode);
  return ROOTS[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
