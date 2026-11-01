// Lokale Datenbank (IndexedDB) – alles bleibt auf dem Gerät.
//
// entries : deine Karten (eine Zeile pro Exemplar-Gruppe, z. B. "3x Normal, NM, Deutsch")
// photos  : eigene Fotos als Blob
// wish    : Wunschliste (key = "game:cardId")
// prices  : zwischengespeicherte Online-Preise (key = "game:cardId")
// kv      : Einstellungen und Sonstiges

const DB_NAME = 'tcg-sammlung';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('key', 'key');
        s.createIndex('game', 'game');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
      if (!db.objectStoreNames.contains('wish')) db.createObjectStore('wish', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('prices')) db.createObjectStore('prices', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaktion abgebrochen'));
  }));
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const idb = {
  all: (store) => tx(store, 'readonly', (s) => req2p(s.getAll())),
  get: (store, key) => tx(store, 'readonly', (s) => req2p(s.get(key))),
  put: (store, val, key) => tx(store, 'readwrite', (s) => req2p(key === undefined ? s.put(val) : s.put(val, key))),
  del: (store, key) => tx(store, 'readwrite', (s) => req2p(s.delete(key))),
  clear: (store) => tx(store, 'readwrite', (s) => req2p(s.clear())),
  putMany: (store, vals) => tx(store, 'readwrite', (s) => { vals.forEach((v) => s.put(v)); }),
  byIndex: (store, index, value) => tx(store, 'readonly', (s) => req2p(s.index(index).getAll(value))),
  keys: (store) => tx(store, 'readonly', (s) => req2p(s.getAllKeys())),
};

// Ersatz, falls der Browser keinen Speicher erlaubt (z. B. privater Modus, eingebettete Vorschau):
// Die App funktioniert dann, vergisst aber alles beim Schließen.
const KEYPATH = { entries: 'id', wish: 'key', prices: 'key' };
const mem = new Map();
const ms = (store) => { if (!mem.has(store)) mem.set(store, new Map()); return mem.get(store); };
const memdb = {
  all: async (store) => [...ms(store).values()],
  get: async (store, key) => ms(store).get(key),
  put: async (store, val, key) => { ms(store).set(key === undefined ? val[KEYPATH[store]] : key, val); },
  del: async (store, key) => { ms(store).delete(key); },
  clear: async (store) => { ms(store).clear(); },
  putMany: async (store, vals) => { vals.forEach((v) => ms(store).set(v[KEYPATH[store]], v)); },
  byIndex: async (store, index, value) => [...ms(store).values()].filter((v) => v[index] === value),
  keys: async (store) => [...ms(store).keys()],
};

export let persistent = true;
let backend = null;
async function pick() {
  if (backend) return backend;
  try {
    if (!window.indexedDB) throw new Error('kein IndexedDB');
    await Promise.race([open(), new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB antwortet nicht')), 4000))]);
    backend = idb;
  } catch (e) {
    console.warn('Speicher nicht verfügbar, nutze Arbeitsspeicher:', e);
    persistent = false;
    backend = memdb;
  }
  return backend;
}
export const db = Object.fromEntries(Object.keys(idb).map((k) => [k, async (...a) => (await pick())[k](...a)]));

// ---------- Cache im Speicher, damit die Oberfläche flott bleibt ----------
let entriesCache = null;
let wishCache = null;
let pricesCache = null;
const listeners = new Set();

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }

export async function entries() {
  if (!entriesCache) entriesCache = await db.all('entries');
  return entriesCache;
}
export async function wishlist() {
  if (!wishCache) wishCache = await db.all('wish');
  return wishCache;
}
export async function prices() {
  if (!pricesCache) {
    pricesCache = new Map((await db.all('prices')).map((p) => [p.key, p]));
  }
  return pricesCache;
}

export async function saveEntry(e) {
  e.updated = Date.now();
  if (!e.created) e.created = e.updated;
  await db.put('entries', e);
  const list = await entries();
  const i = list.findIndex((x) => x.id === e.id);
  if (i >= 0) list[i] = e; else list.push(e);
  emit();
  return e;
}

export async function deleteEntry(id) {
  const list = await entries();
  const e = list.find((x) => x.id === id);
  if (e?.photos?.length) for (const p of e.photos) await db.del('photos', p);
  await db.del('entries', id);
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list.splice(i, 1);
  emit();
  return e;
}

export async function toggleWish(key, data = {}) {
  const list = await wishlist();
  const i = list.findIndex((w) => w.key === key);
  if (i >= 0) {
    await db.del('wish', key);
    list.splice(i, 1);
    emit();
    return false;
  }
  const w = { key, added: Date.now(), ...data };
  await db.put('wish', w);
  list.push(w);
  emit();
  return true;
}

export async function setPrice(key, p) {
  const m = await prices();
  const v = { key, ...p, at: Date.now() };
  m.set(key, v);
  await db.put('prices', v);
  return v;
}

export async function savePhoto(blob) {
  const id = 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await db.put('photos', blob, id);
  return id;
}
export const getPhoto = (id) => db.get('photos', id);

const photoUrls = new Map();
export async function photoURL(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const b = await getPhoto(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  photoUrls.set(id, u);
  return u;
}

// ---------- Einstellungen ----------
const DEFAULTS = {
  theme: 'dark',
  pkLang: 'de',            // Pokémon: Namen/Bilder bevorzugt deutsch
  usdRate: 0.86,           // Umrechnung USD -> EUR für One-Piece-Preise
  scanGame: 'auto',        // Spiel für den Scanner
  scanBatch: false,        // Serien-Scan
  defaultLang: 'Deutsch',
  defaultCondition: 'NM',
  aiKey: '',
  aiModel: 'claude-opus-5-5',
  aiAuto: false,
  collectionView: 'grid',
  setView: 'grid',
  lastBackup: 0,
  keepCount: 1,
  games: ['dbfw'],
};
let settingsCache = null;
export async function settings() {
  if (!settingsCache) settingsCache = { ...DEFAULTS, ...((await db.get('kv', 'settings')) || {}) };
  return settingsCache;
}
export async function setSetting(k, v) {
  const s = await settings();
  s[k] = v;
  await db.put('kv', s, 'settings');
  emit();
}

// ---------- Sicherung ----------
export async function exportAll({ withPhotos = true } = {}) {
  const { blobToDataURL } = await import('./util.js');
  const out = {
    app: 'tcg-sammlung', version: 1, exported: new Date().toISOString(),
    entries: await db.all('entries'),
    wish: await db.all('wish'),
    settings: { ...(await settings()), aiKey: '' },
    userCatalog: (await db.get('kv', 'userCatalog')) || null,
    binders: (await db.get('kv', 'binders')) || null,
    photos: {},
  };
  if (withPhotos) {
    const keys = await db.keys('photos');
    for (const k of keys) {
      const b = await db.get('photos', k);
      if (b) out.photos[k] = await blobToDataURL(b);
    }
  }
  return out;
}

export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'tcg-sammlung') throw new Error('Das ist keine Sicherung dieser App.');
  const { dataURLToBlob } = await import('./util.js');
  if (replace) {
    await db.clear('entries'); await db.clear('wish'); await db.clear('photos');
  }
  for (const [k, v] of Object.entries(data.photos || {})) {
    await db.put('photos', await dataURLToBlob(v), k);
  }
  await db.putMany('entries', data.entries || []);
  await db.putMany('wish', data.wish || []);
  if (Array.isArray(data.binders)) {
    const cur = replace ? [] : ((await db.get('kv', 'binders')) || []);
    for (const b of data.binders) if (!cur.some((x) => x.id === b.id)) cur.push(b);
    await db.put('kv', cur, 'binders');
  }
  if (data.userCatalog) {
    const cur = (await db.get('kv', 'userCatalog')) || { sets: [], cards: [] };
    const ids = new Set(cur.cards.map((c) => c.game + ':' + c.id));
    const sids = new Set(cur.sets.map((x) => x.game + ':' + x.id));
    for (const x of data.userCatalog.sets || []) if (!sids.has(x.game + ':' + x.id)) cur.sets.push(x);
    for (const c of data.userCatalog.cards || []) if (!ids.has(c.game + ':' + c.id)) cur.cards.push(c);
    await db.put('kv', cur, 'userCatalog');
  }
  if (data.settings) {
    const cur = await settings();
    const keep = cur.aiKey;
    Object.assign(cur, data.settings, { aiKey: keep });
    await db.put('kv', cur, 'settings');
  }
  entriesCache = null; wishCache = null;
  emit();
  return { entries: (data.entries || []).length, wish: (data.wish || []).length };
}

export async function requestPersist() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* egal */ }
  return false;
}
