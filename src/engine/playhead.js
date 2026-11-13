// Visual-only: reads the audio clock once per animation frame.
// Nothing musical is driven from here.
import { ref } from 'vue';
import { getCycle } from './strudel.js';
import { STEPS } from './codegen.js';

export const currentStep = ref(-1);
export const currentBar = ref(-1); // whole cycles since play

let raf = 0;

function frame() {
  const c = getCycle();
  const pos = ((c % 1) + 1) % 1;
  currentStep.value = Math.floor(pos * STEPS);
  currentBar.value = Math.floor(c);
  raf = requestAnimationFrame(frame);
}

export function startPlayhead() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

export function stopPlayhead() {
  cancelAnimationFrame(raf);
  currentStep.value = -1;
  currentBar.value = -1;
}
