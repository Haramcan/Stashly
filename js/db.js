/* Wo ist was – lokaler Speicher (IndexedDB auf dem Gerät) */
(function (W) {
  'use strict';
  var DBNAME = 'wo-ist-was', VERSION = 1;
  var STORES = ['rooms', 'places', 'items', 'blobs', 'meta'];
  var idb = null, listeners = [], emitQueued = false;
  var memBlobs = new Map(), urlCache = new Map();

  var D = W.DB = { rooms: [], places: [], items: [], meta: {}, persistent: false };

  function tx(stores, mode, fn) {
    return new Promise(function (res, rej) {
      var t, out;
      try { t = idb.transaction(stores, mode); out = fn(t); } catch (e) { rej(e); return; }
      t.oncomplete = function () { res(out); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error('Speichern abgebrochen')); };
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function upsert(arr, obj) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === obj.id) { arr[i] = obj; return; }
    arr.push(obj);
  }
  function remove(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); return; }
  }
  function emit() {
    if (emitQueued) return;
    emitQueued = true;
    Promise.resolve().then(function () {
      emitQueued = false;
      listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    });
  }

  D.on = function (fn) { listeners.push(fn); };

  D.open = function () {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('Kein IndexedDB')); return; }
      var r = indexedDB.open(DBNAME, VERSION);
      r.onupgradeneeded = function () {
        var d = r.result;
        STORES.forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error('Datenbank blockiert')); };
    }).then(function (d) {
      idb = d;
      idb.onversionchange = function () { idb.close(); };
      return tx(['rooms', 'places', 'items', 'meta'], 'readonly', function (t) {
        return {
          rooms: t.objectStore('rooms').getAll(),
          places: t.objectStore('places').getAll(),
          items: t.objectStore('items').getAll(),
          meta: t.objectStore('meta').getAll()
        };
      });
    }).then(function (r) {
      D.rooms = r.rooms.result || [];
      D.places = r.places.result || [];
      D.items = r.items.result || [];
      (r.meta.result || []).forEach(function (m) { D.meta[m.id] = m.value; });
      D.persistent = true;
      return true;
    }).catch(function (e) {
      console.warn('IndexedDB nicht verfügbar, nur Arbeitsspeicher:', e);
      idb = null; D.persistent = false;
      return false;
    });
  };

  /* Mehrere Änderungen in einer Transaktion: { items: {put:[..], del:[..]}, places: {...}, rooms: {...} } */
  D.write = function (ops) {
    var names = Object.keys(ops).filter(function (n) { return ['rooms', 'places', 'items'].indexOf(n) >= 0; });
    var prepared = {};
    names.forEach(function (n) {
      prepared[n] = { put: (ops[n].put || []).map(clone), del: (ops[n].del || []).slice() };
    });
    var p = idb ? tx(names, 'readwrite', function (t) {
      names.forEach(function (n) {
        var s = t.objectStore(n);
        prepared[n].put.forEach(function (o) { s.put(o); });
        prepared[n].del.forEach(function (id) { s.delete(id); });
      });
    }) : Promise.resolve();
    return p.then(function () {
      names.forEach(function (n) {
        prepared[n].put.forEach(function (o) { upsert(D[n], o); });
        prepared[n].del.forEach(function (id) { remove(D[n], id); });
      });
      emit();
    });
  };
  D.put = function (store, objs) { var o = {}; o[store] = { put: [].concat(objs) }; return D.write(o); };
  D.del = function (store, ids) { var o = {}; o[store] = { del: [].concat(ids) }; return D.write(o); };

  /* ---------- Dateien (Fotos, Belege) ---------- */
  D.putBlob = function (id, blob) {
    return blob.arrayBuffer().then(function (buf) {
      if (!idb) { memBlobs.set(id, blob); return id; }
      return tx(['blobs'], 'readwrite', function (t) {
        t.objectStore('blobs').put({ id: id, type: blob.type || 'application/octet-stream', size: blob.size, data: buf });
      }).then(function () { return id; });
    });
  };
  D.getBlob = function (id) {
    if (!id) return Promise.resolve(null);
    if (!idb) return Promise.resolve(memBlobs.get(id) || null);
    return tx(['blobs'], 'readonly', function (t) { return t.objectStore('blobs').get(id); }).then(function (r) {
      var v = r.result;
      return v ? new Blob([v.data], { type: v.type }) : null;
    });
  };
  D.delBlobs = function (ids) {
    ids = [].concat(ids).filter(Boolean);
    if (!ids.length) return Promise.resolve();
    ids.forEach(function (id) {
      var u = urlCache.get(id);
      if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
      memBlobs.delete(id);
    });
    if (!idb) return Promise.resolve();
    return tx(['blobs'], 'readwrite', function (t) {
      var s = t.objectStore('blobs');
      ids.forEach(function (id) { s.delete(id); });
    }).catch(function (e) { console.warn(e); });
  };
  D.blobURL = function (id) {
    if (!id) return Promise.resolve('');
    if (urlCache.has(id)) return Promise.resolve(urlCache.get(id));
    return D.getBlob(id).then(function (b) {
      if (!b) return '';
      if (urlCache.has(id)) return urlCache.get(id);
      var u = URL.createObjectURL(b);
      urlCache.set(id, u);
      return u;
    });
  };
  D.blobKeys = function () {
    if (!idb) return Promise.resolve(Array.from(memBlobs.keys()));
    return tx(['blobs'], 'readonly', function (t) { return t.objectStore('blobs').getAllKeys(); }).then(function (r) { return r.result || []; });
  };

  /* ---------- Einstellungen ---------- */
  D.setMeta = function (key, value) {
    D.meta[key] = value;
    if (!idb) return Promise.resolve();
    return tx(['meta'], 'readwrite', function (t) { t.objectStore('meta').put({ id: key, value: value }); });
  };

  // Wie clearAll, aber der Tresor bleibt: verschlüsselte Dateien (venc:*) und Tresor-Einstellungen (vault.*)
  function isVaultKey(k) { k = String(k); return k.indexOf('venc:') === 0 || k.indexOf('vault.') === 0; }
  D.clearApp = function () {
    urlCache.forEach(function (u) { URL.revokeObjectURL(u); });
    urlCache.clear();
    Array.from(memBlobs.keys()).forEach(function (k) { if (!isVaultKey(k)) memBlobs.delete(k); });
    var keepMeta = {};
    Object.keys(D.meta).forEach(function (k) { if (isVaultKey(k)) keepMeta[k] = D.meta[k]; });
    var p = idb ? D.blobKeys().then(function (keys) {
      return tx(['rooms', 'places', 'items', 'blobs', 'meta'], 'readwrite', function (t) {
        ['rooms', 'places', 'items'].forEach(function (n) { t.objectStore(n).clear(); });
        var b = t.objectStore('blobs'); keys.forEach(function (k) { if (!isVaultKey(k)) b.delete(k); });
        var m = t.objectStore('meta'); Object.keys(D.meta).forEach(function (k) { if (!isVaultKey(k)) m.delete(k); });
      });
    }) : Promise.resolve();
    return p.then(function () { D.rooms = []; D.places = []; D.items = []; D.meta = keepMeta; emit(); });
  };
  D.clearAll = function () {
    urlCache.forEach(function (u) { URL.revokeObjectURL(u); });
    urlCache.clear(); memBlobs.clear();
    var p = idb ? tx(STORES, 'readwrite', function (t) { STORES.forEach(function (n) { t.objectStore(n).clear(); }); }) : Promise.resolve();
    return p.then(function () { D.rooms = []; D.places = []; D.items = []; D.meta = {}; emit(); });
  };
})(window.W = window.W || {});
