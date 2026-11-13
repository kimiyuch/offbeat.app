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

// How a step with an alternate renders in a given chain slot:
//   'ab' -> <main alt>   'ba' -> <alt main>   'a' -> main   'b' -> alt
function altToken(main, alt, phase) {
  if (phase === 'a') return main;
  if (phase === 'b') return alt;
  return phase === 'ba' ? `<${alt} ${main}>` : `<${main} ${alt}>`;
}

function drumToken(step, sound, phase = 'ab') {
  if (!step?.on) return '~';
  return step.alt && step.alt !== sound ? altToken(sound, step.alt, phase) : sound;
}

// Monophonic note row. A note at step i lasts `len` steps (rendered as `_`
// ties) unless the next note starts earlier, which cuts it short.
export function synthTokens(steps, phase = 'ab') {
  const out = [];
  let remaining = 0;
  for (let i = 0; i < STEPS; i++) {
    const s = steps[i];
    if (s?.on) {
      const n = s.note ?? 0;
      out.push(s.alt != null && s.alt !== n ? altToken(String(n), String(s.alt), phase) : String(n));
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

export function stepsToMini(steps, sound, phase) {
  return tokensToMini(Array.from({ length: STEPS }, (_, i) => drumToken(steps[i], sound, phase)));
}

export function synthStepsToMini(steps, phase) {
  return tokensToMini(synthTokens(steps, phase), { keepLength: true });
}

// --- patterns and song chain ---

export const PATTERN_NAMES = ['A', 'B', 'C', 'D'];

// A track's patterns. Older/simple tracks only have `steps` (= pattern A).
export const patternsOf = (track) => track.pats ?? [track.steps];

// Which pattern plays in which bar: the chain in song mode, else the edited pattern.
export function playOrder(project) {
  if (project.song && project.chain?.length) return project.chain;
  return [project.pattern ?? 0];
}

// Alternation must flip every time a pattern *plays*. Inside `<slot slot …>`,
// a slot's own `<a b>` only advances once per pass through the whole chain
// (verified against Strudel's mini parser), so each slot gets an explicit phase:
// if pattern p appears c times per pass, its i-th appearance plays
// occurrence number pass*c + i. Even c: parity fixed per slot -> 'a' / 'b'.
// Odd c: parity flips every pass -> '<a b>' or '<b a>'.
export function slotPhases(order) {
  const seen = {};
  const count = {};
  order.forEach((p) => (count[p] = (count[p] ?? 0) + 1));
  return order.map((p) => {
    const i = (seen[p] = (seen[p] ?? -1) + 1);
    if (count[p] % 2 === 0) return i % 2 === 0 ? 'a' : 'b';
    return i % 2 === 0 ? 'ab' : 'ba';
  });
}

const wrap = (m) => (/^[^\s*\[<]+$/.test(m) ? m : `[${m}]`);

// One mini-notation string for the whole play order, e.g. "<[bd*4]!3 [bd ~ bd sd]>".
export function trackMini(track, order) {
  const pats = patternsOf(track);
  const phases = slotPhases(order);
  const synth = trackType(track) === 'synth';
  const slots = order.map((p, k) => {
    const steps = pats[p];
    if (!steps?.some((s) => s.on)) return '~';
    return synth ? synthStepsToMini(steps, phases[k]) : stepsToMini(steps, track.sound, phases[k]);
  });
  if (slots.every((m) => m === '~')) return null;
  if (slots.every((m) => m === slots[0])) return slots[0];
  // run-length: consecutive equal slots -> x!n
  const parts = [];
  for (let k = 0; k < slots.length; ) {
    let n = 1;
    while (slots[k + n] === slots[k]) n++;
    parts.push(n > 1 ? `${wrap(slots[k])}!${n}` : wrap(slots[k]));
    k += n;
  }
  return `<${parts.join(' ')}>`;
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
  const mini = trackMini(track, playOrder(project));
  if (!mini) return null;
  let line;
  if (type === 'synth') {
    const scale = `${track.root ?? 'C'}${track.octave ?? 3}:${track.mode ?? 'minor'}`;
    line = `$: n("${mini}").scale("${scale}").s("${track.sound}")`;
  } else {
    line = `$: s("${mini}")`;
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
