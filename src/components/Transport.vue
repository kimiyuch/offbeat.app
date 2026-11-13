<script setup>
import Knob from './Knob.vue';
import { project, BANKS } from '../store/project.js';

defineProps({
  playing: Boolean,
  loading: Boolean,
});
defineEmits(['toggle']);
</script>

<template>
  <section class="flex flex-wrap items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <button
      type="button"
      class="flex h-14 w-32 items-center justify-center gap-2 rounded-lg text-lg font-bold transition-colors"
      :class="playing ? 'bg-amber-400 text-zinc-900 hover:bg-amber-300' : 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600'"
      :disabled="loading"
      @click="$emit('toggle')"
    >
      <template v-if="loading">Loading…</template>
      <template v-else-if="playing">■ Stop</template>
      <template v-else>▶ Play</template>
    </button>

    <label class="flex flex-col gap-1">
      <span class="text-[10px] uppercase tracking-wider text-zinc-400">Tempo</span>
      <span class="flex items-center gap-2">
        <input v-model.number="project.bpm" type="range" min="60" max="200" class="w-36 accent-amber-400" aria-label="Tempo slider" />
        <input
          v-model.number="project.bpm"
          type="number"
          min="40"
          max="240"
          class="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-right tabular-nums"
          aria-label="Tempo in BPM"
        />
        <span class="text-xs text-zinc-500">BPM</span>
      </span>
    </label>

    <Knob v-model="project.swing" label="Swing" :default="0" :format="(v) => `${Math.round(v * 100)}%`" />

    <label class="flex flex-col gap-1">
      <span class="text-[10px] uppercase tracking-wider text-zinc-400">Drum machine</span>
      <select v-model="project.bank" class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm">
        <option v-for="b in BANKS" :key="b" :value="b">{{ b }}</option>
      </select>
    </label>

    <div class="ml-auto text-right text-[11px] leading-relaxed text-zinc-500">
      <kbd class="rounded border border-zinc-700 px-1">space</kbd> play / stop
    </div>
  </section>
</template>
