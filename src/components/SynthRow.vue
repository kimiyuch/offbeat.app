<script setup>
import { computed, ref } from 'vue';
import { STEPS } from '../engine/codegen.js';
import { SCALES, ROOTS, degreeLabel } from '../engine/scales.js';
import { WAVES, ui, removeTrack, clearTrack, userMelodies, applyMelody, saveMelody, deleteMelody, stepsOf, setNotes } from '../store/project.js';
import { MELODIES, KIND_LABELS, randomMelody } from '../store/presets.js';
import { currentStep } from '../engine/playhead.js';

const props = defineProps({ track: { type: Object, required: true } });
const steps = computed(() => stepsOf(props.track)); // the pattern being edited

function onDice() {
  ui.selectedId = props.track.id;
  setNotes(props.track, randomMelody(props.track.octave <= 2 ? 'bass' : 'lead'));
}

const ROWS = 15; // scale degrees 0..14 (two octaves of a 7-note scale)
const degrees = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i); // top = highest
const scaleLen = computed(() => (SCALES[props.track.mode] ?? SCALES.minor).length);
// --- melody picker ---
const melodyId = ref('');
const groups = computed(() => {
  const all = [...MELODIES, ...userMelodies];
  return Object.keys(KIND_LABELS)
    .map((kind) => ({ kind, label: KIND_LABELS[kind], items: all.filter((m) => m.kind === kind) }))
    .filter((g) => g.items.length);
});
const selectedMelody = computed(() => [...MELODIES, ...userMelodies].find((m) => m.id === melodyId.value));
function onPickMelody() {
  if (selectedMelody.value) applyMelody(props.track, selectedMelody.value);
}
function onSave() {
  if (!steps.value.some((s) => s.on)) return alert('Nothing to save: the piano roll is empty.');
  const name = prompt('Name this melody:', `My melody ${userMelodies.length + 1}`)?.trim();
  if (name) melodyId.value = saveMelody(props.track, name).id;
}
function onDelete() {
  const m = selectedMelody.value;
  if (m?.kind === 'mine' && confirm(`Delete "${m.name}"?`)) {
    deleteMelody(m.id);
    melodyId.value = '';
  }
}

const label = (d) => degreeLabel(d, props.track.root, props.track.octave, props.track.mode);

// Same rule as codegen.synthTokens: a note lasts `len` steps unless the next note cuts it.
const spans = computed(() => {
  const out = [];
  const s = steps.value;
  for (let i = 0; i < STEPS; i++) {
    if (!s[i].on) continue;
    let end = Math.min(STEPS, i + Math.max(1, s[i].len));
    for (let j = i + 1; j < end; j++) if (s[j].on) end = j;
    out.push({ start: i, end, note: s[i].note, alt: s[i].alt });
  }
  return out;
});
const spanAt = (i) => spans.value.find((sp) => i >= sp.start && i < sp.end);

function cellState(d, i) {
  const sp = spanAt(i);
  if (!sp) return '';
  if (sp.note === d) return i === sp.start ? 'head' : 'tail';
  if (sp.alt === d) return i === sp.start ? 'althead' : 'alttail';
  return '';
}

// --- editing: click = add/remove, drag right = length, right-click = alternate note ---
const grid = ref(null);
let drag = null;

function stepFromX(x) {
  const r = grid.value.getBoundingClientRect();
  return Math.min(STEPS - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * STEPS)));
}

function onDown(e, d, i) {
  if (e.button !== 0) return;
  ui.selectedId = props.track.id;
  const st = steps.value;
  const sp = spanAt(i);
  if (sp && sp.note === d) {
    // grab an existing note: click deletes (if on its head), drag resizes
    drag = { start: sp.start, deleteOnUp: i === sp.start, moved: false };
  } else {
    if (sp && sp.start < i) st[sp.start].len = i - sp.start; // cut the note we land inside
    Object.assign(st[i], { on: true, note: d, len: 1, alt: null });
    drag = { start: i, deleteOnUp: false, moved: false };
  }
  grid.value.setPointerCapture(e.pointerId);
}

function onMove(e) {
  if (!drag) return;
  const j = stepFromX(e.clientX);
  const len = Math.max(1, j - drag.start + 1);
  const s = steps.value[drag.start];
  if (len !== s.len) {
    s.len = len;
    drag.moved = true;
  }
}

function onUp() {
  if (!drag) return;
  const st = steps.value;
  const s = st[drag.start];
  if (drag.deleteOnUp && !drag.moved) {
    Object.assign(s, { on: false, len: 1, alt: null });
  } else {
    // a stretched note swallows the notes it now covers
    for (let j = drag.start + 1; j < Math.min(STEPS, drag.start + s.len); j++) {
      Object.assign(st[j], { on: false, len: 1, alt: null });
    }
  }
  drag = null;
}

function onContext(d, i) {
  const sp = spanAt(i);
  if (!sp) return;
  const head = steps.value[sp.start];
  head.alt = d === sp.note || d === head.alt ? null : d;
}
</script>

<template>
  <div
    class="grid grid-cols-1 gap-2 rounded-lg p-2 sm:grid-cols-[11rem_1fr] sm:gap-3"
    :class="ui.selectedId === track.id ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'"
    @pointerdown="ui.selectedId = track.id"
  >
    <div class="flex flex-col gap-1.5">
      <div v-if="track.name" class="text-xs font-bold uppercase tracking-wider text-sky-300">{{ track.name }}</div>
      <div class="flex items-center gap-1.5">
        <select v-model="track.sound" class="w-[5.5rem] rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-sm font-semibold text-sky-300" aria-label="Waveform">
          <option v-for="w in WAVES" :key="w" :value="w">{{ w }}</option>
        </select>
        <button type="button" class="size-7 rounded border text-xs font-bold"
          :class="track.mute ? 'border-red-400 bg-red-500 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
          :aria-pressed="track.mute" title="Mute" @click="track.mute = !track.mute">M</button>
        <button type="button" class="size-7 rounded border text-xs font-bold"
          :class="track.solo ? 'border-emerald-300 bg-emerald-400 text-zinc-900' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'"
          :aria-pressed="track.solo" title="Solo" @click="track.solo = !track.solo">S</button>
      </div>
      <div class="flex items-center gap-1">
        <select v-model="track.root" class="w-12 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs" aria-label="Root note">
          <option v-for="r in ROOTS" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model.number="track.octave" class="w-10 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs" aria-label="Octave">
          <option v-for="o in [1, 2, 3, 4, 5]" :key="o" :value="o">{{ o }}</option>
        </select>
        <select v-model="track.mode" class="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs" aria-label="Scale">
          <option v-for="(_, m) in SCALES" :key="m" :value="m">{{ m.replace(':', ' ') }}</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <select
          v-model="melodyId"
          class="min-w-0 flex-1 rounded border border-sky-800 bg-zinc-900 px-1 py-0.5 text-xs text-sky-200"
          aria-label="Load a melody"
          title="Load a melody (replaces notes, sound and knobs; keeps key and scale)"
          @change="onPickMelody"
        >
          <option value="" disabled>♪ load melody…</option>
          <optgroup v-for="g in groups" :key="g.kind" :label="g.label">
            <option v-for="m in g.items" :key="m.id" :value="m.id">{{ m.name }}</option>
          </optgroup>
        </select>
        <button type="button" class="h-6 rounded border border-zinc-700 px-1.5 text-xs hover:bg-zinc-700" title="Random melody in this scale (notes only; roll again for another)" aria-label="Random melody" @click="onDice">🎲</button>
        <button type="button" class="h-6 rounded border border-zinc-700 px-1.5 text-xs text-zinc-300 hover:bg-zinc-700" title="Save these notes as a melody" @click="onSave">save</button>
        <button
          v-if="selectedMelody?.kind === 'mine'"
          type="button"
          class="h-6 rounded border border-zinc-700 px-1.5 text-xs text-zinc-400 hover:bg-red-900"
          title="Delete this saved melody"
          @click="onDelete"
        >✕</button>
      </div>
      <div class="flex gap-1.5">
        <button type="button" class="h-7 flex-1 rounded border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-700" @click="clearTrack(track.id)">clear</button>
        <button type="button" class="h-7 flex-1 rounded border border-zinc-700 text-xs text-zinc-400 hover:bg-red-900" @click="removeTrack(track.id)">remove</button>
      </div>
      <p class="mt-auto text-[10px] leading-snug text-zinc-500">
        click: note · drag →: length<br />right-click: alternate note each bar
      </p>
    </div>

    <div
      ref="grid"
      class="grid touch-none select-none grid-cols-16 gap-x-px gap-y-px overflow-hidden rounded-md bg-zinc-950"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <template v-for="d in degrees" :key="d">
        <div
          v-for="i in STEPS"
          :key="i"
          class="relative h-3.5 cursor-pointer"
          :class="[
            {
              head: 'bg-sky-400 rounded-l-sm',
              tail: 'bg-sky-400/70',
              althead: 'bg-amber-400/30 ring-1 ring-inset ring-amber-400 rounded-l-sm',
              alttail: 'bg-amber-400/20',
            }[cellState(d, i - 1)] ||
              (currentStep === i - 1
                ? 'bg-zinc-600'
                : d % scaleLen === 0
                  ? 'bg-zinc-700/70'
                  : (i - 1) % 4 === 0
                    ? 'bg-zinc-800'
                    : 'bg-zinc-800/60'),
          ]"
          :title="label(d)"
          @pointerdown.stop="onDown($event, d, i - 1)"
          @contextmenu.prevent="onContext(d, i - 1)"
        >
          <span
            v-if="cellState(d, i - 1) === 'head' || cellState(d, i - 1) === 'althead' || (i === 1 && d % scaleLen === 0 && !cellState(d, 0))"
            class="pointer-events-none absolute inset-y-0 left-0.5 text-[9px] leading-[14px] font-semibold"
            :class="cellState(d, i - 1) === 'head' ? 'text-zinc-900' : cellState(d, i - 1) === 'althead' ? 'text-amber-300' : 'text-zinc-400'"
          >{{ label(d) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
