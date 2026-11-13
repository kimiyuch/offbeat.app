// Pure: project state -> Strudel code string.
// No imports from Vue or Strudel. Keep it that way.

export const STEPS = 16;

// Strudel-neutral values. A param equal to its neutral value is not emitted.
// `dec: 0` means "no decay envelope" (sample plays out).
export const PARAM_DEFAULTS = Object.freeze({
  gain: 1,
  dec: 0,
  lpf: 20000,
  room: 0,
  pan: 0.5,
  speed: 1,
});

const PARAM_ORDER = ['gain', 'dec', 'lpf', 'room', 'pan', 'speed'];

// 0.4 -> ".4", 1 -> "1", -0.25 -> "-.25", 1200.456 -> "1200"
export function num(v) {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  return String(r).replace(/^(-?)0\./, '$1.');
}

function stepToken(step, sound) {
  if (!step?.on) return '~';
  return step.alt && step.alt !== sound ? `<${sound} ${step.alt}>` : sound;
}

// Shortest semantics-preserving mini-notation for a 16-step row.
// 1. Coarsen the grid: if every hit lands on a multiple of k, use STEPS/k slots.
// 2. If the row repeats with period p and contains no alternation, emit `[..]*n`.
//    (`<a b>` inside `*n` would alternate per repetition, not per cycle, so we
//    never fold rows that contain alternation.)
export function stepsToMini(steps, sound) {
  const tokens = Array.from({ length: STEPS }, (_, i) => stepToken(steps[i], sound));

  const hasAlt = tokens.some((t) => t.startsWith('<'));
  if (!hasAlt) {
    for (const p of [1, 2, 4, 8]) {
      if (tokens.every((t, i) => t === tokens[i % p])) {
        const unit = coarsen(tokens.slice(0, p));
        const body = unit.length === 1 ? unit[0] : `[${unit.join(' ')}]`;
        return `${body}*${STEPS / p}`;
      }
    }
  }
  return coarsen(tokens).join(' ');
}

// Halve the grid resolution while every hit sits on the coarser grid.
function coarsen(tokens) {
  let cur = tokens;
  while (cur.length % 2 === 0 && cur.length > 1 && cur.every((t, i) => i % 2 === 0 || t === '~')) {
    cur = cur.filter((_, i) => i % 2 === 0);
  }
  return cur;
}

export function trackIsAudible(track, tracks) {
  const anySolo = tracks.some((t) => t.solo);
  if (anySolo) return track.solo;
  return !track.mute;
}

export function trackToLine(track, project) {
  if (!track.steps.some((s) => s.on)) return null;
  let line = `$: s("${stepsToMini(track.steps, track.sound)}")`;
  const bank = track.bank || project.bank;
  if (bank) line += `.bank("${bank}")`;
  const params = { ...PARAM_DEFAULTS, ...track.params };
  for (const key of PARAM_ORDER) {
    const v = params[key];
    if (v === undefined || v === null) continue;
    if (Math.abs(v - PARAM_DEFAULTS[key]) < 1e-9) continue;
    line += `.${key}(${num(v)})`;
  }
  if (project.swing > 0) line += `.swingBy(${num(project.swing * 0.5)}, 8)`;
  return line;
}

export function generateCode(project) {
  const lines = [`setcps(${num(project.bpm)}/60/4)`];
  const body = project.tracks
    .filter((t) => trackIsAudible(t, project.tracks))
    .map((t) => trackToLine(t, project))
    .filter(Boolean);
  if (body.length === 0) lines.push('silence');
  else lines.push(...body);
  return lines.join('\n');
}
