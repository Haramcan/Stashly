/* TCG Sammlung – Service Worker: macht die App offline nutzbar.
   Die Liste zwischen den Markierungen wird von tools/build_sw.py erzeugt. */
// BEGIN-GENERATED
const VERSION = '6645fb906d13';
const ASSETS = [
  './',
  './css/app.css',
  './data/dbfw.json',
  './data/meta.json',
  './data/op.json',
  './data/pokemon.json',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './js/ai.js',
  './js/app.js',
  './js/catalog.js',
  './js/db.js',
  './js/recognize.js',
  './js/scan.js',
  './js/util.js',
  './manifest.webmanifest'
];
// END-GENERATED

const APP = 'tcg-app-' + VERSION;
const OCR = 'tcg-ocr-v1';   // Texterkennung (groß, ändert sich selten)
const IMG = 'tcg-img-v1';   // Kartenbilder aus dem Internet
const IMG_HOSTS = ['assets.tcgdex.net', 'www.dbs-cardgame.com', 'optcgapi.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tcg-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(cacheName, req, { ignoreSearch = false, cors = false } = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch });
  if (hit) return hit;
  // TCGdex erlaubt CORS: dann ist die Antwort lesbar und belegt viel weniger Speicherplatz
  const res = cors ? await fetch(req.url, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(req)) : await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
      return;
    }
    if (url.pathname.includes('/lib/tesseract/')) {
      event.respondWith(cacheFirst(OCR, req, { ignoreSearch: true }));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }

  if (IMG_HOSTS.includes(url.hostname) && (req.destination === 'image' || /\.(webp|png|jpe?g)$/i.test(url.pathname) || req.mode === 'no-cors')) {
    event.respondWith(cacheFirst(IMG, req, { cors: url.hostname === 'assets.tcgdex.net' }).catch(() => new Response('', { status: 504 })));
  }
});
