import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// En desarrollo, /v1 va al servidor local (cd server && npm run dev)
export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/v1': 'http://localhost:8790' } },
});
