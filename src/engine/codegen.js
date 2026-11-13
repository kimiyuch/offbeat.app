// Pure: project state -> Strudel code string.
// No imports from Vue or Strudel. Keep it that way.

export const STEPS = 16;

// Strudel-neutral values per track type. A param at its neutral value is not emitted.
export const PARAM_DEFAULTS = Object.freeze({
  // `dec: 0` means "no decay envelope" (sample plays out).
  drum: Object.freeze({ gain: 1, dec: 0, lpf: 20000, room: 0, pan: 0.5, speed: 1 }),
  synth: Object.freeze({
    gain: 1,
    lpf: 20000,
    lpq: 1, // superdough's default filter Q
    lpenv: 0, // filter envelope amount in octaves; 0 = off
    lpdecay: 0.14, // superdough's default filter-env decay
    attack: 0.001, // amp ADSR, superdough's values when none is set
    decay: 0.001,
    sustain: 1,
    release: 0.01,
    room: 0,
    delay: 0,
    pan: 0.5,
  }),
});

const PARAM_ORDER = {
  drum: ['gain', 'dec', 'lpf', 'room', 'pan', 'speed'],
  synth: ['gain', 'lpf', 'lpq', 'lpenv', 'lpdecay', 'room', 'delay', 'pan'],
};
const ADSR = ['attack', 'decay', 'sustain', 'release'];

export const trackType = (t) => (t?.type === 'synth' ? 'synth' : 'drum');

// 0.4 -> ".4", 1 -> "1", -0.25 -> "-.25", 1200.456 -> "1200"
export function num(v, digits = 2) {
  const f = 10 ** digits;
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * f) / f;
  return String(r).replace(/^(-?)0\./, '$1.');
}

// --- step rows -> mini-notation ---

function drumToken(step, sound) {
  if (!step?.on) return '~';
  return step.alt && step.alt !== sound ? `<${sound} ${step.alt}>` : sound;
}

// Monophonic note row. A note at step i lasts `len` steps (rendered as `_`
// ties) unless the next note starts earlier, which cuts it short.
export function synthTokens(steps) {
  const out = [];
  let remaining = 0;
  for (let i = 0; i < STEPS; i++) {
    const s = steps[i];
    if (s?.on) {
      const n = s.note ?? 0;
      out.push(s.alt != null && s.alt !== n ? `<${n} ${s.alt}>` : String(n));
      remaining = Math.max(1, s.len ?? 1) - 1;
    } else if (remaining > 0) {
      out.push('_');
      remaining--;
    } else out.push('~');
  }
  return out;
}

// Shortest semantics-preserving mini-notation for a 16-token row.
// 1. Coarsen the grid while every hit lands on the coarser grid.
//    With `keepLength` (synths), a slot may only be merged into the one before
//    it if that keeps every note's length: `0 _` -> `0`, `~ ~` -> `~`.
//    Drums ignore event length (samples play out), so `bd ~` -> `bd` is fine.
// 2. If the row repeats with period p and contains no alternation, emit `[..]*n`.
//    (`<a b>` inside `*n` would alternate per repetition, not per bar.)
export function tokensToMini(tokens, { keepLength = false } = {}) {
  const hasAlt = tokens.some((t) => t.startsWith('<'));
  if (!hasAlt) {
    for (const p of [1, 2, 4, 8]) {
      if (tokens.every((t, i) => t === tokens[i % p])) {
        const unit = coarsen(tokens.slice(0, p), keepLength);
        const body = unit.length === 1 ? unit[0] : `[${unit.join(' ')}]`;
        return `${body}*${tokens.length / p}`;
      }
    }
  }
  return coarsen(tokens, keepLength).join(' ');
}

function mergeable(prev, t, keepLength) {
  if (!keepLength) return t === '~';
  return prev === '~' ? t === '~' : t === '_';
}

function coarsen(tokens, keepLength) {
  let cur = tokens;
  while (
    cur.length % 2 === 0 &&
    cur.length > 1 &&
    cur.every((t, i) => i % 2 === 0 || mergeable(cur[i - 1], t, keepLength))
  ) {
    cur = cur.filter((_, i) => i % 2 === 0);
  }
  return cur;
}

export function stepsToMini(steps, sound) {
  return tokensToMini(Array.from({ length: STEPS }, (_, i) => drumToken(steps[i], sound)));
}

export function synthStepsToMini(steps) {
  return tokensToMini(synthTokens(steps), { keepLength: true });
}

// --- tracks -> lines ---

export function trackIsAudible(track, tracks) {
  const anySolo = tracks.some((t) => t.solo);
  if (anySolo) return track.solo;
  return !track.mute;
}

const differs = (a, b) => Math.abs(a - b) > 1e-9;

function paramCalls(type, params) {
  const defaults = PARAM_DEFAULTS[type];
  const p = { ...defaults, ...params };
  let out = '';
  for (const key of PARAM_ORDER[type]) {
    const v = p[key];
    if (v == null || !differs(v, defaults[key])) continue;
    if (key === 'lpdecay' && !differs(p.lpenv, 0)) continue; // no filter env -> irrelevant
    out += `.${key}(${num(v)})`;
  }
  if (type === 'synth') out += adsrCall(p, defaults);
  return out;
}

// Strudel fills in unset envelope stages based on which ones *are* set, so
// emitting a subset would not sound like what the knobs show. All or nothing.
function adsrCall(p, defaults) {
  if (!ADSR.some((k) => differs(p[k], defaults[k]))) return '';
  return `.adsr("${ADSR.map((k) => num(p[k], 3)).join(':')}")`;
}

export function trackToLine(track, project) {
  const type = trackType(track);
  if (!track.steps.some((s) => s.on)) return null;
  let line;
  if (type === 'synth') {
    const scale = `${track.root ?? 'C'}${track.octave ?? 3}:${track.mode ?? 'minor'}`;
    line = `$: n("${synthStepsToMini(track.steps)}").scale("${scale}").s("${track.sound}")`;
  } else {
    line = `$: s("${stepsToMini(track.steps, track.sound)}")`;
    const bank = track.bank || project.bank;
    if (bank) line += `.bank("${bank}")`;
  }
  line += paramCalls(type, track.params);
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
