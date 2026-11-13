<script setup>
import { computed, ref } from 'vue';
import { b64encode, shareUrl, project } from '../store/project.js';

const props = defineProps({ code: { type: String, required: true } });

// Same format as strudel.cc's code2hash: '#' + encodeURIComponent(base64(utf8))
const strudelUrl = computed(() => `https://strudel.cc/#${encodeURIComponent(b64encode(props.code))}`);

const copied = ref('');
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = what;
    setTimeout(() => (copied.value = ''), 1500);
  } catch {
    prompt('Copy:', text);
  }
}
function share() {
  const url = shareUrl(project);
  history.replaceState(null, '', url);
  copy(url, 'link');
}
</script>

<template>
  <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <h2 class="mr-auto text-xs uppercase tracking-widest text-zinc-400">Generated Strudel code</h2>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" @click="copy(code, 'code')">
        {{ copied === 'code' ? 'Copied ✓' : 'Copy code' }}
      </button>
      <button type="button" class="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" @click="share">
        {{ copied === 'link' ? 'Link copied ✓' : 'Share link' }}
      </button>
      <a
        :href="strudelUrl"
        target="_blank"
        rel="noopener"
        class="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-white"
      >Open in strudel.cc ↗</a>
    </div>
    <pre class="overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[13px] leading-relaxed text-emerald-300">{{ code }}</pre>
  </section>
</template>
