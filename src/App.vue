<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import Transport from './components/Transport.vue';
import TrackRow from './components/TrackRow.vue';
import SynthRow from './components/SynthRow.vue';
import TrackParams from './components/TrackParams.vue';
import CodePreview from './components/CodePreview.vue';
import Patterns from './components/Patterns.vue';
import { generateCode } from './engine/codegen.js';
import { init, unlockAudio, evaluate, stop, onError, preloadSamples, hasSound, resumeAudio } from './engine/strudel.js';
import { startPlayhead, stopPlayhead } from './engine/playhead.js';
import { project, ui, addTrack, addSynth, SOUNDS, defaultProject, replaceProject } from './store/project.js';
import { DEMOS } from './store/demos.js';

const SOURCE_URL = import.meta.env.VITE_SOURCE_URL || 'https://github.com/kimiyuch/offbeat.app';

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

// --- sample preloading: every drum sound in use, for the current machine ---
const samples = reactive({ ready: false, done: 0, total: 0, missing: new Set() });
const drumKeys = computed(() => {
  const sounds = new Set(project.tracks.filter((t) => t.type !== 'synth').map((t) => t.sound));
  return [...sounds].map((s) => `${project.bank}_${s}`.toLowerCase());
});
let preloadRun = 0;
async function preload() {
  const run = ++preloadRun;
  await init();
  if (run !== preloadRun) return;
  samples.ready = true;
  samples.missing = new Set(drumKeys.value.filter((k) => !hasSound(k)));
  await preloadSamples(drumKeys.value, (done, total) => {
    if (run === preloadRun) Object.assign(samples, { done, total });
  });
}
watch(drumKeys, preload);
const isMissing = (t) => samples.ready && samples.missing.has(`${project.bank}_${t.sound}`.toLowerCase());
const loadingSamples = computed(() => samples.total > 0 && samples.done < samples.total);

function onVisibility() {
  if (document.visibilityState === 'visible' && playing.value) resumeAudio();
}

function onKey(e) {
  if (e.code !== 'Space') return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  if (!e.repeat) toggle();
}

let offError;
onMounted(() => {
  init(); // registers Strudel's first-click audio unlock + fetches sample maps
  preload();
  offError = onError((err) => showError(String(err?.message ?? err)));
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  offError?.();
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('visibilitychange', onVisibility);
});

function resetAll() {
  if (confirm('Reset to the default beat?')) replaceProject(defaultProject());
}

const demoId = ref('');
function loadDemo() {
  const demo = DEMOS.find((d) => d.id === demoId.value);
  demoId.value = '';
  if (!demo) return;
  if (!confirm(`Load the demo "${demo.name}"? It replaces your current project (use Share link first to keep it).`)) return;
  replaceProject(demo.build());
}
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 sm:p-6">
    <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 class="text-2xl font-black tracking-tight">off<span class="text-amber-400">beat</span></h1>
      <span class="hidden text-sm text-zinc-500 sm:inline">buttons and knobs in, Strudel code out</span>
      <span v-if="loadingSamples" class="text-xs text-zinc-400" role="status">loading samples {{ samples.done }}/{{ samples.total }}…</span>
      <select
        v-model="demoId"
        class="ml-auto rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
        aria-label="Load a demo song"
        @change="loadDemo"
      >
        <option value="" disabled>♫ Demo songs…</option>
        <option v-for="d in DEMOS" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <button type="button" class="text-xs text-zinc-500 hover:text-zinc-300" @click="resetAll">reset</button>
    </header>

    <Transport :playing="playing" :loading="loading" @toggle="toggle" />
    <Patterns :playing="playing" />

    <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-1 sm:p-2">
      <div class="hidden grid-cols-[11rem_1fr] gap-3 px-2 pb-1 sm:grid">
        <span />
        <div class="grid grid-cols-16 gap-1 text-center text-[10px] tabular-nums text-zinc-500">
          <span v-for="i in 16" :key="i" :class="(i - 1) % 4 === 0 ? 'text-zinc-300' : ''">{{ i }}</span>
        </div>
      </div>
      <template v-for="t in project.tracks" :key="t.id">
        <SynthRow v-if="t.type === 'synth'" :track="t" />
        <TrackRow v-else :track="t" :missing="isMissing(t)" />
      </template>
      <div class="flex flex-wrap items-center gap-2 px-2 pt-2">
        <select v-model="newSound" class="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-sm" aria-label="Sound for new track">
          <option v-for="s in SOUNDS" :key="s" :value="s">{{ s }}</option>
        </select>
        <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-sm hover:bg-zinc-800" @click="addTrack(newSound)">
          + Drum track
        </button>
        <button type="button" class="rounded border border-sky-700 px-2 py-1 text-sm text-sky-300 hover:bg-sky-950" @click="addSynth">
          + Synth track
        </button>
        <span class="ml-auto hidden text-[11px] text-zinc-500 md:inline">drums: right-click / long-press a step to alternate sounds each bar</span>
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
