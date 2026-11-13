<script setup>
import { computed } from 'vue';
import Knob from './Knob.vue';
import { NEW_PARAMS } from '../store/project.js';
import { trackType } from '../engine/codegen.js';

const props = defineProps({ track: { type: Object, default: null } });

const pct = (v) => `${Math.round(v * 100)}%`;
const secs = (v) => (v < 0.995 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);
const hz = (v) => (v >= 19990 ? 'open' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const panFmt = (v) => (Math.abs(v - 0.5) < 0.01 ? 'C' : v < 0.5 ? `L${Math.round((0.5 - v) * 200)}` : `R${Math.round((v - 0.5) * 200)}`);

const GROUPS = {
  drum: [
    [
      { key: 'gain', label: 'Gain', min: 0, max: 1.5, format: pct },
      { key: 'dec', label: 'Decay', min: 0, max: 1, format: (v) => (v < 0.01 ? 'off' : `${v.toFixed(2)}s`) },
      { key: 'lpf', label: 'Filter', min: 80, max: 20000, log: true, format: hz },
      { key: 'room', label: 'Reverb', min: 0, max: 1, format: pct },
      { key: 'pan', label: 'Pan', min: 0, max: 1, format: panFmt },
      { key: 'speed', label: 'Pitch', min: 0.25, max: 3, log: true, format: (v) => `${v.toFixed(2)}×` },
    ],
  ],
  synth: [
    [
      { key: 'gain', label: 'Gain', min: 0, max: 1.5, format: pct },
      { key: 'lpf', label: 'Cutoff', min: 60, max: 20000, log: true, format: hz },
      { key: 'lpq', label: 'Reso', min: 0, max: 20, format: (v) => v.toFixed(1) },
      { key: 'lpenv', label: 'Env amt', min: 0, max: 8, format: (v) => (v < 0.05 ? 'off' : `${v.toFixed(1)}oct`) },
      { key: 'lpdecay', label: 'Env dec', min: 0.01, max: 1.5, log: true, format: secs },
    ],
    [
      { key: 'attack', label: 'Attack', min: 0.001, max: 1, log: true, format: secs },
      { key: 'decay', label: 'Decay', min: 0.001, max: 1.5, log: true, format: secs },
      { key: 'sustain', label: 'Sustain', min: 0, max: 1, format: pct },
      { key: 'release', label: 'Release', min: 0.01, max: 2, log: true, format: secs },
    ],
    [
      { key: 'delay', label: 'Delay', min: 0, max: 1, format: pct },
      { key: 'room', label: 'Reverb', min: 0, max: 1, format: pct },
      { key: 'pan', label: 'Pan', min: 0, max: 1, format: panFmt },
    ],
  ],
};

const type = computed(() => trackType(props.track));
const groups = computed(() => GROUPS[type.value]);
const title = computed(() =>
  !props.track
    ? '—'
    : (props.track.name ? `${props.track.name} · ` : '') +
      (type.value === 'synth' ? `${props.track.sound} · ${props.track.root}${props.track.octave} ${props.track.mode.replace(':', ' ')}` : props.track.sound),
);
</script>

<template>
  <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-xs uppercase tracking-widest text-zinc-400">
        Track
        <span class="ml-1 text-base font-bold normal-case tracking-normal" :class="type === 'synth' ? 'text-sky-300' : 'text-amber-400'">{{ title }}</span>
      </h2>
      <span class="text-[11px] text-zinc-500">drag · wheel · arrows · double-click resets</span>
    </div>
    <div v-if="track" class="flex flex-wrap gap-x-8 gap-y-3">
      <div v-for="(g, gi) in groups" :key="gi" class="flex flex-wrap gap-3">
        <Knob
          v-for="k in g"
          :key="k.key"
          v-model="track.params[k.key]"
          :min="k.min"
          :max="k.max"
          :log="k.log"
          :label="k.label"
          :format="k.format"
          :default="NEW_PARAMS[type][k.key]"
        />
      </div>
    </div>
    <p v-else class="text-sm text-zinc-500">No track selected.</p>
  </section>
</template>
