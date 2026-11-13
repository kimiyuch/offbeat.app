<script setup>
import StepButton from './StepButton.vue';
import { SOUNDS, ui, removeTrack, clearTrack } from '../store/project.js';
import { currentStep } from '../engine/playhead.js';

const props = defineProps({ track: { type: Object, required: true } });
</script>

<template>
  <div
    class="grid grid-cols-[11rem_1fr] items-center gap-3 rounded-lg p-2"
    :class="ui.selectedId === track.id ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'"
    @pointerdown="ui.selectedId = track.id"
  >
    <div class="flex items-center gap-1.5">
      <select
        v-model="track.sound"
        class="w-16 rounded bg-zinc-900 border border-zinc-700 px-1.5 py-1 text-sm font-semibold"
        aria-label="Sound"
      >
        <option v-for="s in SOUNDS" :key="s" :value="s">{{ s }}</option>
      </select>
      <button
        type="button"
        class="size-7 rounded text-xs font-bold border"
        :class="track.mute ? 'bg-red-500 border-red-400 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
        :aria-pressed="track.mute"
        title="Mute"
        @click="track.mute = !track.mute"
      >M</button>
      <button
        type="button"
        class="size-7 rounded text-xs font-bold border"
        :class="track.solo ? 'bg-emerald-400 border-emerald-300 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
        :aria-pressed="track.solo"
        title="Solo"
        @click="track.solo = !track.solo"
      >S</button>
      <button
        type="button"
        class="size-7 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700"
        title="Clear steps"
        @click="clearTrack(track.id)"
      >⌫</button>
      <button
        type="button"
        class="size-7 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-red-900"
        title="Remove track"
        @click="removeTrack(track.id)"
      >✕</button>
    </div>

    <div class="grid grid-cols-16 gap-1">
      <StepButton
        v-for="(step, i) in track.steps"
        :key="i"
        :step="step"
        :index="i"
        :sound="track.sound"
        :active="currentStep === i"
      />
    </div>
  </div>
</template>
