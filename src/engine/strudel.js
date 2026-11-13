// The only file that imports @strudel/web. Everything else uses these exports.
import {
  initStrudel,
  samples,
  aliasBank,
  evaluate as strudelEvaluate,
  hush,
  initAudio,
  getSound,
  loadBuffer,
  getAudioContext,
} from '@strudel/web';

const CDN = 'https://strudel.b-cdn.net';
const errorListeners = new Set();

let ready = null;
let repl = null;

// Safe to call before any user gesture: it only registers Strudel's
// "init audio on first click" listener and fetches the sample *maps* (JSON).
// The audio files themselves are fetched lazily on first use of each sound.
export function init() {
  if (!ready) {
    ready = initStrudel({
      onEvalError: (err) => errorListeners.forEach((fn) => fn(err)),
      prebake: async () => {
        // Same maps the strudel.cc REPL loads in its prebake step.
        await samples(`${CDN}/tidal-drum-machines.json`, `${CDN}/tidal-drum-machines/machines/`, {
          prebake: true,
          tag: 'drum-machines',
        });
        // aliasBank walks the already-registered sounds, so it must run after samples().
        // Adds e.g. RolandTR909 -> TR909 (lookup is case-insensitive: "tr909").
        await aliasBank(`${CDN}/tidal-drum-machines-alias.json`);
      },
    }).then((r) => (repl = r));
  }
  return ready;
}

// Call from inside a click/keydown handler: resumes the AudioContext.
export async function unlockAudio() {
  await initAudio();
}

export async function evaluate(code) {
  await init();
  return strudelEvaluate(code, true);
}

export function stop() {
  if (repl) hush();
}

// Current position in cycles (1 cycle = 1 bar). 0 when stopped.
export function getCycle() {
  return repl?.scheduler?.now() ?? 0;
}

export function onError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

// Fetch + decode drum samples ahead of time so the first hit isn't silent.
// `names` are bank-qualified sound keys, e.g. "tr909_bd". Unknown names (a
// sound the machine doesn't have) are skipped. Resolves to the keys that failed.
export async function preloadSamples(names, onProgress) {
  await init();
  const ac = getAudioContext();
  const jobs = names.map((key) => ({ key, url: getSound(key)?.data?.samples?.[0] })).filter((j) => typeof j.url === 'string');
  let done = 0;
  onProgress?.(done, jobs.length);
  const failed = [];
  await Promise.all(
    jobs.map((j) =>
      loadBuffer(j.url, ac, j.key)
        .catch(() => failed.push(j.key))
        .finally(() => onProgress?.(++done, jobs.length)),
    ),
  );
  return failed;
}

// Which bank-qualified sounds exist (for greying out sounds a machine lacks).
export function hasSound(key) {
  return !!getSound(key);
}

// Safari suspends audio in background tabs; resume when the tab comes back.
export function resumeAudio() {
  const ac = getAudioContext();
  if (ac.state !== 'running') return ac.resume().catch(() => {});
}
