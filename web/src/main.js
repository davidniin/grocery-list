import { createApp } from 'vue';
import App from './App.vue';
import { start, DEMO } from './sync.js';
import './style.css';

createApp(App).mount('#app');
start();

// El service worker solo en producción (en desarrollo cachearía los módulos de Vite); en la demo de la landing, no
if (import.meta.env.PROD && !DEMO && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[sw] ' + e.message));
}
