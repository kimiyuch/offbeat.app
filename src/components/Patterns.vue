<script setup>
import { computed } from 'vue';
import { PATTERN_NAMES } from '../engine/codegen.js';
import { project, patternHasNotes, copyPattern, pastePattern, clearPattern, clip, chainPush, chainRemove, MAX_CHAIN } from '../store/project.js';
import { currentBar } from '../engine/playhead.js';

const props = defineProps({ playing: Boolean });

// which pattern is sounding right now
const playingSlot = computed(() =>
  props.playing && project.song && project.chain.length ? ((currentBar.value % project.chain.length) + project.chain.length) % project.chain.length : -1,
);
const playingPattern = computed(() =>
  !props.playing ? -1 : playingSlot.value >= 0 ? project.chain[playingSlot.value] : project.pattern,
);

const songLength = computed(() => {
  const secs = Math.round((project.chain.length * 4 * 60) / project.bpm);
  return `${project.chain.length} bars · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
});

function onPaste() {
  if (patternHasNotes(project.pattern) && !confirm(`Overwrite pattern ${PATTERN_NAMES[project.pattern]}?`)) return;
  pastePattern();
}
function onClear() {
  if (confirm(`Clear every track in pattern ${PATTERN_NAMES[project.pattern]}?`)) clearPattern();
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
    <!-- pattern being edited -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[10px] uppercase tracking-wider text-zinc-400">Edit</span>
      <div class="flex gap-1" role="radiogroup" aria-label="Pattern to edit">
        <button
          v-for="(name, p) in PATTERN_NAMES"
          :key="name"
          type="button"
          role="radio"
          :aria-checked="project.pattern === p"
          class="relative size-10 rounded-md border text-base font-black transition-colors"
          :class="project.pattern === p ? 'border-amber-300 bg-amber-400 text-zinc-900' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'"
          :title="`Edit pattern ${name}${!project.song ? ' (and play it)' : ''}`"
          @click="project.pattern = p"
        >
          {{ name }}
          <span v-if="patternHasNotes(p)" class="absolute right-1 top-1 size-1.5 rounded-full" :class="project.pattern === p ? 'bg-zinc-900' : 'bg-amber-400'" />
          <span v-if="playingPattern === p" class="absolute inset-x-1.5 bottom-1 h-0.5 rounded bg-emerald-400" />
        </button>
      </div>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" title="Copy this pattern (all tracks)" @click="copyPattern">copy</button>
      <button
        type="button"
        class="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
        :disabled="!clip.has"
        :title="clip.has ? `Paste pattern ${PATTERN_NAMES[clip.from]} here` : 'Copy a pattern first'"
        @click="onPaste"
      >paste{{ clip.has ? ` ${PATTERN_NAMES[clip.from]}` : '' }}</button>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900" @click="onClear">clear</button>
    </div>

    <!-- song chain -->
    <div class="flex min-w-0 flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
      <div class="flex rounded-md border border-zinc-700 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Playback mode">
        <button type="button" role="radio" :aria-checked="!project.song" class="rounded px-2 py-1" :class="!project.song ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-400'" @click="project.song = false">Pattern</button>
        <button type="button" role="radio" :aria-checked="project.song" class="rounded px-2 py-1" :class="project.song ? 'bg-emerald-400 text-zinc-900' : 'text-zinc-400'" @click="project.song = true">Song</button>
      </div>
      <ol class="flex min-w-0 flex-wrap items-center gap-1" :class="project.song ? '' : 'opacity-50'" aria-label="Song chain">
        <li v-for="(p, k) in project.chain" :key="k">
          <button
            type="button"
            class="h-6 min-w-6 rounded border px-1 text-[11px] font-bold"
            :class="playingSlot === k ? 'border-emerald-300 bg-emerald-400 text-zinc-900' : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-red-400 hover:line-through'"
            :title="`Bar ${k + 1}: pattern ${PATTERN_NAMES[p]} — click to remove`"
            @click="chainRemove(k)"
          >{{ PATTERN_NAMES[p] }}</button>
        </li>
        <li v-if="!project.chain.length" class="text-xs text-zinc-500">empty: add patterns →</li>
      </ol>
      <span v-if="project.chain.length" class="text-[11px] tabular-nums text-zinc-500">{{ songLength }}</span>
      <div class="ml-auto flex items-center gap-1">
        <span class="text-[10px] uppercase tracking-wider text-zinc-500">add</span>
        <button
          v-for="(name, p) in PATTERN_NAMES"
          :key="name"
          type="button"
          class="h-7 w-7 rounded border border-dashed border-zinc-600 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          :disabled="project.chain.length >= MAX_CHAIN"
          :title="`Append pattern ${name} to the song`"
          @click="chainPush(p)"
        >{{ name }}</button>
      </div>
    </div>
  </section>
</template>
