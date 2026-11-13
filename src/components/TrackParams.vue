<script setup>
import Knob from './Knob.vue';
import { NEW_TRACK_PARAMS } from '../store/project.js';

defineProps({ track: { type: Object, default: null } });

const pct = (v) => `${Math.round(v * 100)}%`;
const knobs = [
  { key: 'gain', label: 'Gain', min: 0, max: 1.5, format: pct },
  { key: 'dec', label: 'Decay', min: 0, max: 1, format: (v) => (v < 0.01 ? 'off' : `${v.toFixed(2)}s`) },
  { key: 'lpf', label: 'Filter', min: 80, max: 20000, log: true, format: (v) => (v >= 19990 ? 'open' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) },
  { key: 'room', label: 'Reverb', min: 0, max: 1, format: pct },
  { key: 'pan', label: 'Pan', min: 0, max: 1, format: (v) => (Math.abs(v - 0.5) < 0.01 ? 'C' : v < 0.5 ? `L${Math.round((0.5 - v) * 200)}` : `R${Math.round((v - 0.5) * 200)}`) },
  { key: 'speed', label: 'Pitch', min: 0.25, max: 3, log: true, format: (v) => `${v.toFixed(2)}×` },
];
</script>

<template>
  <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-xs uppercase tracking-widest text-zinc-400">
        Track <span class="ml-1 text-base font-bold normal-case tracking-normal text-amber-400">{{ track?.sound ?? '—' }}</span>
      </h2>
      <span class="text-[11px] text-zinc-500">drag · wheel · arrows · double-click resets</span>
    </div>
    <div v-if="track" class="flex flex-wrap gap-3">
      <Knob
        v-for="k in knobs"
        :key="k.key"
        v-model="track.params[k.key]"
        :min="k.min"
        :max="k.max"
        :log="k.log"
        :label="k.label"
        :format="k.format"
        :default="NEW_TRACK_PARAMS[k.key]"
      />
    </div>
    <p v-else class="text-sm text-zinc-500">No track selected.</p>
  </section>
</template>
