import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Build de la demo para la landing (npm run build:site): sin manifest, para que no se ofrezca instalar la demo
const demoHtml = (mode) => ({
  name: 'demo-html',
  transformIndexHtml: (html) => (mode === 'demo' ? html.replace(/\s*<link rel="manifest"[^>]*>/, '') : html),
});

// En desarrollo, /v1 va al servidor local (cd server && npm run dev). `vite --mode demo` abre la demo sin servidor.
export default defineConfig(({ mode }) => ({
  plugins: [vue(), demoHtml(mode)],
  define: { __DEMO__: JSON.stringify(mode === 'demo') },
  server: { proxy: { '/v1': 'http://localhost:8790' } },
}));
