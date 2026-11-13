import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    server: { deps: { inline: [/@strudel\//] } },
    alias: {
      // Node picks this package's CJS "main", which lacks named exports.
      // Tests only (the browser build resolves "module" correctly).
      '@kabelsalat/web': fileURLToPath(new URL('./node_modules/@kabelsalat/web/dist/index.mjs', import.meta.url)),
    },
  },
});
