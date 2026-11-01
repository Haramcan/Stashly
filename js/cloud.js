// Automatische Cloud-Sicherung, wenn die App als Vorschau auf claude.ai läuft.
// Jede Änderung an Sammlung, Wunschliste, Bindern und selbst angelegten Karten wird
// sofort in die private Datenbank des Artefakts geschrieben (nur der Besitzer kann sie lesen).
// Beim Start wird beides zusammengeführt – so geht nichts verloren, auch wenn der
// Browser-Speicher leer ist. Fotos bleiben im Browser (sie sind zu groß dafür).
import * as store from './db.js';

const ROOT = 'sammlung/main';
let cdb = null;
let synced = { entries: new Map(), wish: new Map(), meta: '' };
let timer = null;
let busy = false;
let again = false;
export const status = { active: false, ok: false, last: 0, count: 0, error: '' };
const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((f) => { try { f(status); } catch { /* egal */ } });

async function getDb() {
  try {
    if (!window.claude?.use) return null;
    return await Promise.race([window.claude.use('db'), new Promise((r) => setTimeout(() => r(null), 12000))]);
  } catch { return null; }
}

const entriesCol = () => cdb.collection(`${ROOT}/entries`);
const wishCol = () => cdb.collection(`${ROOT}/wish`);
const metaDoc = () => cdb.doc('sammlung/meta');
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_');

async function retry(fn) {
  try { return await fn(); } catch (e) {
    if (e?.code === 'unavailable') { await new Promise((r) => setTimeout(r, 500 + Math.random() * 800)); return fn(); }
    throw e;
  }
}
async function pool(items, n, fn) {
  const q = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); }));
}

async function localMeta() {
  const s = await store.settings();
  const { aiKey, ...rest } = s; // API-Schlüssel nie in die Cloud
  return {
    binders: (await store.db.get('kv', 'binders')) || null,
    userCatalog: (await store.db.get('kv', 'userCatalog')) || null,
    settings: rest,
  };
}

/** Start: Cloud und Browser zusammenführen, dann bei jeder Änderung sichern */
export async function startCloud({ onRestored } = {}) {
  cdb = await getDb();
  if (!cdb) return false;
  status.active = true; emit();
  try {
    const [es, ws, meta] = await Promise.all([retry(() => entriesCol().get()), retry(() => wishCol().get()), retry(() => metaDoc().get())]);
    const tomb = new Set((await store.db.get('kv', 'cloudTombstones')) || []);
    const local = await store.entries();
    const localById = new Map(local.map((e) => [e.id, e]));
    const cloudEntries = es.docs.map((d) => d.data());
    const toLocal = [];
    for (const ce of cloudEntries) {
      if (!ce?.id || tomb.has(ce.id)) continue;
      const le = localById.get(ce.id);
      if (!le || (ce.updated || 0) > (le.updated || 0)) toLocal.push({ ...ce, photos: le?.photos || ce.photos || [] });
    }
    const localWish = await store.wishlist();
    const lw = new Set(localWish.map((w) => w.key));
    const wishToLocal = ws.docs.map((d) => d.data()).filter((w) => w?.key && !lw.has(w.key) && !tomb.has('w:' + w.key));
    const m = meta.exists ? meta.data() : null;
    const restore = { app: 'tcg-sammlung', entries: toLocal, wish: wishToLocal };
    if (m?.binders) restore.binders = m.binders;
    if (m?.userCatalog) restore.userCatalog = m.userCatalog;
    let restored = toLocal.length + wishToLocal.length;
    if (!local.length && m?.settings) restore.settings = m.settings;
    if (restored || m?.binders || m?.userCatalog) {
      await store.importAll(restore, { replace: false });
      // Binder: Cloud-Stand übernehmen, wenn im Browser keiner da ist
      if (m?.binders && !(await store.db.get('kv', 'binders'))?.length) await store.db.put('kv', m.binders, 'binders');
    }
    // Was die Cloud schon hat, merken
    synced.entries = new Map(cloudEntries.filter((e) => e?.id).map((e) => [e.id, e.updated || 0]));
    synced.wish = new Map(ws.docs.map((d) => d.data()).filter((w) => w?.key).map((w) => [w.key, w.added || 0]));
    synced.meta = m ? JSON.stringify({ binders: m.binders || null, userCatalog: m.userCatalog || null, settings: m.settings || null }) : '';
    if (restored) onRestored?.(restored);
    store.onChange(schedule);
    await push();
    return true;
  } catch (e) {
    console.warn('Cloud-Sicherung:', e);
    status.ok = false; status.error = e?.message || String(e); emit();
    store.onChange(schedule);
    return false;
  }
}

function schedule() {
  if (!cdb) return;
  clearTimeout(timer);
  timer = setTimeout(push, 900);
}

/** Unterschiede zur Cloud hochladen */
export async function push() {
  if (!cdb) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    const local = await store.entries();
    const ids = new Set(local.map((e) => e.id));
    const changed = local.filter((e) => synced.entries.get(e.id) !== (e.updated || 0));
    const removed = [...synced.entries.keys()].filter((id) => !ids.has(id));
    const tomb = new Set((await store.db.get('kv', 'cloudTombstones')) || []);
    removed.forEach((id) => tomb.add(id));
    await store.db.put('kv', [...tomb], 'cloudTombstones');
    await pool(changed, 4, async (e) => {
      await retry(() => entriesCol().doc(safeId(e.id)).set(JSON.parse(JSON.stringify(e))));
      synced.entries.set(e.id, e.updated || 0);
    });
    await pool([...tomb].filter((t) => !t.startsWith('w:')), 4, async (id) => {
      await retry(() => entriesCol().doc(safeId(id)).delete());
      synced.entries.delete(id); tomb.delete(id);
    });
    // Wunschliste
    const wish = await store.wishlist();
    const wkeys = new Set(wish.map((w) => w.key));
    for (const w of wish) {
      if (synced.wish.get(w.key) === (w.added || 0)) continue;
      await retry(() => wishCol().doc(safeId(w.key)).set({ ...w }));
      synced.wish.set(w.key, w.added || 0);
    }
    for (const k of [...synced.wish.keys()].filter((k) => !wkeys.has(k))) tomb.add('w:' + k);
    for (const t of [...tomb].filter((x) => x.startsWith('w:'))) {
      await retry(() => wishCol().doc(safeId(t.slice(2))).delete());
      synced.wish.delete(t.slice(2)); tomb.delete(t);
    }
    await store.db.put('kv', [...tomb], 'cloudTombstones');
    // Binder, eigene Karten, Einstellungen
    const meta = await localMeta();
    const ms = JSON.stringify(meta);
    if (ms !== synced.meta) { await retry(() => metaDoc().set(JSON.parse(ms))); synced.meta = ms; }
    status.ok = true; status.error = ''; status.last = Date.now(); status.count = local.length;
  } catch (e) {
    console.warn('Cloud-Sicherung fehlgeschlagen:', e);
    status.ok = false; status.error = e?.code === 'quota_exceeded' ? 'Cloud-Speicher voll' : (e?.message || String(e));
  } finally {
    busy = false;
    emit();
    if (again) { again = false; schedule(); }
  }
}

/** Datei speichern, wenn die Vorschau Downloads erlaubt */
export async function saveFile(filename, data) {
  try {
    const dl = window.claude?.use ? await window.claude.use('downloads') : null;
    if (!dl) return false;
    await dl.save({ filename, data });
    return true;
  } catch (e) {
    if (e?.code === 'declined') return true;
    return false;
  }
}
