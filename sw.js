// Service Worker: alles vorab cachen → App läuft offline.
const CACHE = 'leek-darttraining-v3';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/settings.js', 'js/checkouts.js', 'js/chart.js', 'js/wakelock.js',
  'js/sound.js', 'js/board.js', 'js/info.js', 'js/weakness.js', 'js/plans.js', 'js/calendar.js', 'js/badges.js',
  'js/games/registry.js', 'js/games/timed.js', 'js/games/warmup.js', 'js/games/sequence.js', 'js/games/atc.js', 'js/games/switch.js',
  'js/games/checkouts.js', 'js/games/doubles.js', 'js/games/l121.js', 'js/games/drill.js', 'js/games/survival.js',
  'js/screens/summary.js', 'js/screens/history.js', 'js/screens/admin.js', 'js/screens/versus.js', 'js/screens/custom.js',
  'fonts/bebas-neue.woff2', 'fonts/rajdhani-600.woff2', 'fonts/rajdhani-700.woff2', 'fonts/sora-600.woff2', 'fonts/inter-400.woff2', 'fonts/inter-600.woff2',
  'icons/logo.webp', 'icons/logo-wink.webp', 'icons/mascot.webp', 'icons/duel.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Netzwerk zuerst (für Updates), bei Offline aus dem Cache.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
