import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { AstroPWAIntegration as AstroPWA } from '@vite-pwa/astro';

// Static site (Vercel or any static host). Pages build to /index.html, /tunnel-raider.html, /dino-run.html …
// served without the .html (vercel.json: cleanUrls). The PWA integration precaches every built file by content
// hash, so each deploy is a new offline version without hand-editing a service worker.
export default defineConfig({
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    react(),
    AstroPWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      manifest: {
    "name": "PGD-01 Portable Gaming Device",
    "short_name": "PGD",
    "description": "A 1983-style home console in your browser: pick a floppy and play Tunnel Raider, Dino Run and more, with drive sounds, high scores and offline play.",
    "id": "./",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "display_override": [
      "fullscreen",
      "standalone"
    ],
    "orientation": "any",
    "background_color": "#111110",
    "theme_color": "#111110",
    "lang": "en-GB",
    "dir": "ltr",
    "categories": [
      "games",
      "entertainment"
    ],
    "icons": [
      {
        "src": "icons/icon-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "icons/icon-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "icons/maskable-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "maskable"
      },
      {
        "src": "icons/maskable-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      },
      {
        "src": "favicon.svg",
        "sizes": "any",
        "type": "image/svg+xml",
        "purpose": "any"
      }
    ],
    "screenshots": [
      {
        "src": "og-image.png",
        "sizes": "1200x630",
        "type": "image/png",
        "form_factor": "wide",
        "label": "The PGD-01 Portable Gaming Device disk menu on a green-phosphor CRT"
      }
    ]
  },
      generateSW: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['manifest.webmanifest', 'og-*.png'],   // the plugin adds the manifest itself; share images are only for link previews
        navigateFallback: '/',
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^test$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'gg-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
  vite: { build: { target: 'es2022', assetsInlineLimit: 0 } },
});
