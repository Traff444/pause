import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const configuredBase = env.VITE_BASE_PATH || '/';
  const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;

  return {
    base,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@supabase/')) return 'supabase';
            if (id.includes('/node_modules/lucide-react/')) return 'icons';
            if (id.includes('/node_modules/dexie/')) return 'storage';
            if (id.includes('/node_modules/react')) return 'react';
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'assets/entry-hands.png',
          'assets/onboarding-title.png',
          'assets/onboarding-choice.png',
          'assets/onboarding-price-screen.png',
          'assets/final-screen.png',
          'assets/stories/moon-illusion.jpg',
          'assets/stories/music-chills.jpg',
          'assets/stories/scent-memory.jpg',
          'fonts/PauzaDisplay.woff',
          'fonts/PauzaDisplay.ttf',
          'apple-touch-icon.png',
          'icon-192.png',
          'icon-512.png',
          'icon.svg',
        ],
        manifest: {
          name: 'Пауза',
          short_name: 'Пауза',
          description: 'Спокойный путь к жизни без сигарет',
          lang: 'ru',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#1246B8',
          background_color: '#F8F7F3',
          icons: [
            { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
            {
              src: `${base}icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
