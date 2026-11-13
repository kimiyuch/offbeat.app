<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { SOUNDS } from '../store/project.js';

const props = defineProps({
  step: { type: Object, required: true },
  index: { type: Number, required: true },
  sound: { type: String, required: true },
  active: { type: Boolean, default: false }, // playhead is here
});

const menuOpen = ref(false);
let pressTimer = 0;
let longPressed = false;

function toggle() {
  if (longPressed) return (longPressed = false);
  props.step.on = !props.step.on;
  if (!props.step.on) props.step.alt = null;
}
function closeMenu() {
  menuOpen.value = false;
  window.removeEventListener('pointerdown', closeMenu);
}
function openMenu() {
  menuOpen.value = true;
  setTimeout(() => window.addEventListener('pointerdown', closeMenu));
}
function onPointerDown(e) {
  if (e.button !== 0) return;
  longPressed = false;
  pressTimer = setTimeout(() => {
    longPressed = true;
    openMenu();
  }, 450);
}
function cancelPress() {
  clearTimeout(pressTimer);
}
function chooseAlt(s) {
  props.step.on = true;
  props.step.alt = s === props.sound ? null : s;
  closeMenu();
}
onBeforeUnmount(() => {
  cancelPress();
  closeMenu();
});
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="relative h-10 w-full rounded-md border transition-colors duration-75 overflow-hidden"
      :class="[
        step.on ? 'bg-amber-400 border-amber-300' : index % 4 === 0 ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-800 border-zinc-700',
        active ? 'ring-2 ring-white/80' : '',
        !step.on && active ? 'bg-zinc-600' : '',
      ]"
      :aria-pressed="step.on"
      :aria-label="`Step ${index + 1}${step.alt ? `, alternates with ${step.alt}` : ''}`"
      :title="step.alt ? `${sound} / ${step.alt} (alternates each bar)` : 'Click: toggle · Right-click / long-press: alternate sound'"
      @click="toggle"
      @contextmenu.prevent="openMenu"
      @pointerdown="onPointerDown"
      @pointerup="cancelPress"
      @pointerleave="cancelPress"
    >
      <!-- alternation: lower-right triangle in a second colour -->
      <span
        v-if="step.on && step.alt"
        class="absolute inset-0 bg-sky-400"
        style="clip-path: polygon(100% 0, 100% 100%, 0 100%)"
      />
      <span v-if="step.on && step.alt" class="absolute bottom-0.5 right-1 text-[9px] font-bold text-zinc-900">{{ step.alt }}</span>
    </button>

    <div
      v-if="menuOpen"
      class="absolute left-1/2 top-full z-20 mt-1 w-28 -translate-x-1/2 rounded-md border border-zinc-600 bg-zinc-900 p-1 shadow-xl"
      @pointerdown.stop
    >
      <div class="px-1.5 pb-1 text-[10px] uppercase tracking-wider text-zinc-400">Alternate with</div>
      <div class="grid grid-cols-3 gap-0.5">
        <button
          v-for="s in SOUNDS"
          :key="s"
          type="button"
          class="rounded px-1 py-0.5 text-xs hover:bg-zinc-700"
          :class="(step.alt ?? sound) === s ? 'bg-sky-500 text-zinc-900' : 'text-zinc-200'"
          @click="chooseAlt(s)"
        >
          {{ s === sound ? '—' : s }}
        </button>
      </div>
      <button type="button" class="mt-1 w-full rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700" @click="closeMenu">
        close
      </button>
    </div>
  </div>
</template>
