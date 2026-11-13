// The only file that imports @strudel/web. Everything else uses these exports.
import { initStrudel, samples, aliasBank, evaluate as strudelEvaluate, hush, initAudio } from '@strudel/web';

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
