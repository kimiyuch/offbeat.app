<script setup>
import { computed } from 'vue';
import StepButton from './StepButton.vue';
import { SOUNDS, ui, project, removeTrack, clearTrack, stepsOf } from '../store/project.js';
import { currentStep } from '../engine/playhead.js';

const props = defineProps({
  track: { type: Object, required: true },
  missing: { type: Boolean, default: false }, // this drum machine has no such sound
});
const steps = computed(() => stepsOf(props.track));
</script>

<template>
  <div
    class="grid grid-cols-1 items-center gap-2 rounded-lg p-2 sm:grid-cols-[11rem_1fr] sm:gap-3"
    :class="ui.selectedId === track.id ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'"
    @pointerdown="ui.selectedId = track.id"
  >
    <div class="flex items-center gap-1.5">
      <select
        v-model="track.sound"
        class="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-sm font-semibold"
        aria-label="Sound"
      >
        <option v-for="s in SOUNDS" :key="s" :value="s">{{ s }}</option>
      </select>
      <button
        type="button"
        class="size-8 rounded border text-xs font-bold sm:size-7"
        :class="track.mute ? 'border-red-400 bg-red-500 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
        :aria-pressed="track.mute"
        title="Mute"
        @click="track.mute = !track.mute"
      >M</button>
      <button
        type="button"
        class="size-8 rounded border text-xs font-bold sm:size-7"
        :class="track.solo ? 'border-emerald-300 bg-emerald-400 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
        :aria-pressed="track.solo"
        title="Solo"
        @click="track.solo = !track.solo"
      >S</button>
      <button
        type="button"
        class="size-8 rounded border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-700 sm:size-7"
        title="Clear steps in this pattern"
        @click="clearTrack(track.id)"
      >⌫</button>
      <button
        type="button"
        class="size-8 rounded border border-zinc-700 text-xs text-zinc-400 hover:bg-red-900 sm:size-7"
        title="Remove track"
        @click="removeTrack(track.id)"
      >✕</button>
      <span
        v-if="missing"
        class="ml-auto text-xs text-amber-400"
        :title="`${project.bank} has no '${track.sound}' sound — this track is silent`"
      >⚠ silent</span>
    </div>

    <div class="grid grid-cols-16 gap-0.5 sm:gap-1">
      <StepButton
        v-for="(step, i) in steps"
        :key="i"
        :step="step"
        :index="i"
        :sound="track.sound"
        :active="currentStep === i"
      />
    </div>
  </div>
</template>
