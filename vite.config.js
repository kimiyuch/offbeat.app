import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Local dev runs behind Herd: `herd proxy offbeat.app http://127.0.0.1:4324 --secure`
  // -> https://offbeat.app.test. Live reload goes through the proxy's port 443.
  server: {
    host: '127.0.0.1',
    port: 4324,
    strictPort: true,
    allowedHosts: ['offbeat.app.test'],
    hmr: { clientPort: 443 },
  },
  test: {
    server: { deps: { inline: [/@strudel\//] } },
    alias: {
      // Node picks this package's CJS "main", which lacks named exports.
      // Tests only (the browser build resolves "module" correctly).
      '@kabelsalat/web': fileURLToPath(new URL('./node_modules/@kabelsalat/web/dist/index.mjs', import.meta.url)),
    },
  },
});
