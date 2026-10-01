/* Wo ist was - Service Worker: macht die App offline nutzbar. Automatisch erzeugt von tools/build-sw.ps1 */
const CACHE = 'wiw-941849c54a84';
const ASSETS = [
  './',
  './css/app.css',
  './css/fonts.css',
  './css/splash.css',
  './fonts/BricolageGrotesque-600-800-latin.woff2',
  './fonts/BricolageGrotesque-600-800-latin-ext.woff2',
  './fonts/Figtree-400-700-latin.woff2',
  './fonts/Figtree-400-700-latin-ext.woff2',
  './fonts/IBMPlexMono-500-latin.woff2',
  './fonts/IBMPlexMono-500-latin-ext.woff2',
  './fonts/IBMPlexMono-600-latin.woff2',
  './fonts/IBMPlexMono-600-latin-ext.woff2',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './js/app.js',
  './js/db.js',
  './js/exporters.js',
  './js/labels-de.js',
  './js/lock.js',
  './js/recognize.js',
  './js/scanner.js',
  './js/search.js',
  './js/sound.js',
  './js/splash.js',
  './js/util.js',
  './js/vault-crypto.js',
  './js/vault-store.js',
  './js/vault-ui.js',
  './js/voice.js',
  './lib/jspdf.umd.min.js',
  './lib/jsQR.js',
  './lib/jszip.min.js',
  './lib/qrcode.js',
  './lib/tf.min.js',
  './manifest.webmanifest',
  './model/group1-shard1of4',
  './model/group1-shard2of4',
  './model/group1-shard3of4',
  './model/group1-shard4of4',
  './model/model.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wiw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});