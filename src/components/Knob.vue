<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  default: { type: Number, default: undefined },
  log: { type: Boolean, default: false }, // logarithmic travel (for Hz)
  label: { type: String, default: '' },
  format: { type: Function, default: (v) => v.toFixed(2) },
});
const emit = defineEmits(['update:modelValue']);

// value <-> normalised 0..1 travel
const toNorm = (v) =>
  props.log
    ? Math.log(v / props.min) / Math.log(props.max / props.min)
    : (v - props.min) / (props.max - props.min);
const fromNorm = (n) => {
  n = Math.min(1, Math.max(0, n));
  return props.log ? props.min * Math.pow(props.max / props.min, n) : props.min + n * (props.max - props.min);
};

const norm = computed(() => toNorm(props.modelValue));
const set = (n) => emit('update:modelValue', fromNorm(n));
const nudge = (d) => set(norm.value + d);

// 270° sweep, starting bottom-left
const START = 135;
const SWEEP = 270;
const R = 16;
function polar(deg) {
  const r = (deg * Math.PI) / 180;
  return [20 + R * Math.cos(r), 20 + R * Math.sin(r)];
}
function arc(a0, a1) {
  const [x0, y0] = polar(a0);
  const [x1, y1] = polar(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}
const track = arc(START, START + SWEEP);
const valueArc = computed(() => arc(START, START + Math.max(0.5, norm.value * SWEEP)));
const pointer = computed(() => {
  const [x, y] = polar(START + norm.value * SWEEP);
  return { x, y };
});

let drag = null;
function onPointerDown(e) {
  e.currentTarget.setPointerCapture(e.pointerId);
  e.currentTarget.focus();
  drag = { y: e.clientY, n: norm.value };
}
function onPointerMove(e) {
  if (!drag) return;
  const px = e.shiftKey ? 600 : 150; // shift = fine
  set(drag.n + (drag.y - e.clientY) / px);
}
function onPointerUp() {
  drag = null;
}
function onWheel(e) {
  nudge((e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.005 : 0.02));
}
function onKey(e) {
  const step = e.shiftKey ? 0.01 : 0.05;
  const map = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step };
  if (e.key in map) {
    e.preventDefault();
    nudge(map[e.key]);
  } else if (e.key === 'Home') set(0);
  else if (e.key === 'End') set(1);
}
function reset() {
  if (props.default !== undefined) emit('update:modelValue', props.default);
}
</script>

<template>
  <div class="flex flex-col items-center gap-1 select-none w-14">
    <svg
      viewBox="0 0 40 40"
      class="size-12 cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      tabindex="0"
      role="slider"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="format(modelValue)"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
      @keydown="onKey"
      @dblclick="reset"
    >
      <circle cx="20" cy="20" r="12" class="fill-zinc-800 stroke-zinc-700" />
      <path :d="track" class="fill-none stroke-zinc-700" stroke-width="3" stroke-linecap="round" />
      <path :d="valueArc" class="fill-none stroke-amber-400" stroke-width="3" stroke-linecap="round" />
      <line x1="20" y1="20" :x2="pointer.x" :y2="pointer.y" class="stroke-zinc-200" stroke-width="2" stroke-linecap="round" />
    </svg>
    <div class="text-[10px] uppercase tracking-wider text-zinc-400">{{ label }}</div>
    <div class="text-[11px] tabular-nums text-zinc-200">{{ format(modelValue) }}</div>
  </div>
</template>
