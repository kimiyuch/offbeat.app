<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Transport from './components/Transport.vue';
import TrackRow from './components/TrackRow.vue';
import TrackParams from './components/TrackParams.vue';
import CodePreview from './components/CodePreview.vue';
import { generateCode } from './engine/codegen.js';
import { init, unlockAudio, evaluate, stop, onError } from './engine/strudel.js';
import { startPlayhead, stopPlayhead } from './engine/playhead.js';
import { project, ui, addTrack, SOUNDS, defaultProject, replaceProject } from './store/project.js';

const SOURCE_URL = import.meta.env.VITE_SOURCE_URL || '#source-url-not-set';

const code = computed(() => generateCode(project));
const selected = computed(() => project.tracks.find((t) => t.id === ui.selectedId) ?? null);

const playing = ref(false);
const loading = ref(false);
const error = ref('');
let errorTimer = 0;
function showError(msg) {
  error.value = msg;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => (error.value = ''), 5000);
}

async function play() {
  loading.value = true;
  try {
    await unlockAudio(); // inside the user gesture
    await evaluate(code.value);
    playing.value = true;
    startPlayhead();
  } catch (e) {
    showError(String(e?.message ?? e));
  } finally {
    loading.value = false;
  }
}
function halt() {
  stop();
  playing.value = false;
  stopPlayhead();
}
const toggle = () => (playing.value ? halt() : play());

// The single store watcher: GUI state -> code -> engine (debounced).
let debounce = 0;
watch(code, (c) => {
  if (!playing.value) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => evaluate(c).catch((e) => showError(String(e?.message ?? e))), 50);
});

const newSound = ref('cp');

function onKey(e) {
  if (e.code !== 'Space') return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  toggle();
}

let offError;
onMounted(() => {
  init(); // registers Strudel's first-click audio unlock + fetches sample maps
  offError = onError((err) => showError(String(err?.message ?? err)));
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  offError?.();
  window.removeEventListener('keydown', onKey);
});

function resetAll() {
  if (confirm('Reset to the default beat?')) replaceProject(defaultProject());
}
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 sm:p-6">
    <header class="flex items-baseline gap-3">
      <h1 class="text-2xl font-black tracking-tight">groove<span class="text-amber-400">box</span></h1>
      <span class="text-sm text-zinc-500">buttons and knobs in, Strudel code out</span>
      <button type="button" class="ml-auto text-xs text-zinc-500 hover:text-zinc-300" @click="resetAll">reset</button>
    </header>

    <Transport :playing="playing" :loading="loading" @toggle="toggle" />

    <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-2">
      <div class="grid grid-cols-[11rem_1fr] gap-3 px-2 pb-1">
        <span />
        <div class="grid grid-cols-16 gap-1 text-center text-[10px] tabular-nums text-zinc-500">
          <span v-for="i in 16" :key="i" :class="(i - 1) % 4 === 0 ? 'text-zinc-300' : ''">{{ i }}</span>
        </div>
      </div>
      <TrackRow v-for="t in project.tracks" :key="t.id" :track="t" />
      <div class="flex items-center gap-2 px-2 pt-2">
        <select v-model="newSound" class="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-sm" aria-label="Sound for new track">
          <option v-for="s in SOUNDS" :key="s" :value="s">{{ s }}</option>
        </select>
        <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-sm hover:bg-zinc-800" @click="addTrack(newSound)">
          + Add track
        </button>
        <span class="ml-auto text-[11px] text-zinc-500">right-click or long-press a step to alternate it with another sound each bar</span>
      </div>
    </section>

    <TrackParams :track="selected" />
    <CodePreview :code="code" />

    <footer class="mt-auto flex gap-4 pt-4 text-xs text-zinc-500">
      <span>AGPL-3.0-or-later · sound by <a class="underline hover:text-zinc-300" href="https://strudel.cc" target="_blank" rel="noopener">Strudel</a></span>
      <a class="underline hover:text-zinc-300" :href="SOURCE_URL" target="_blank" rel="noopener">Source</a>
    </footer>

    <div
      v-if="error"
      role="alert"
      class="fixed bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg border border-red-400 bg-red-950 px-4 py-2 text-sm text-red-100 shadow-xl"
    >
      {{ error }}
    </div>
  </div>
</template>
