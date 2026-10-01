/* Wo ist was – Tresor: verschlüsselter Speicher.
 * Nutzt die vorhandene Datenbank (DB.meta für die verschlüsselten Inhalte, DB-Blobs für Dateien)
 * und W.VaultCrypto für die Verschlüsselung. Nichts verlässt das Gerät.
 */
(function (W) {
  'use strict';
  var DB = W.DB, C = W.VaultCrypto;
  var V = W.Vault = {};

  // Schlüssel in der Datenbank
  var K = {
    set: 'vault.set', prof: 'vault.profile', data: 'vault.data',
    decoySet: 'vault.decoyset', decoyProf: 'vault.decoyProfile', decoyData: 'vault.decoyData',
    opts: 'vault.opts', dev: 'vault.dev', log: 'vault.log'
  };
  var EMPTY = function () { return { items: [], files: [], passwords: [], notes: [], folders: [] }; };

  // Nur im Speicher, solange offen
  var master = null, open = false, decoy = false, data = null;
  // Zählt jedes Öffnen und Sperren. Laufende Abläufe prüfen damit, ob noch derselbe Tresor offen ist.
  var session = 0;
  V.session = function () { return session; };

  V.available = function () { return C.available() && !!DB; };
  V.configured = function () { return !!DB.meta[K.set]; };
  V.hasDecoy = function () { return !!DB.meta[K.decoySet]; };
  V.isOpen = function () { return open; };
  V.isDecoy = function () { return decoy; };
  V.data = function () { return data; };

  /* ---------- Optionen (nicht geheim) ---------- */
  var DEFopts = { faceOn: false, faceReal: false, tarnMode: 'code', hidden: false, lockAfter: '0', bkRem: '30', wipeTrig: 'hold' };
  V.opts = function () { return Object.assign({}, DEFopts, DB.meta[K.opts] || {}); };
  V.setOpt = function (k, val) { var o = V.opts(); o[k] = val; return DB.setMeta(K.opts, o); };
  V.setOpts = function (patch) { var o = Object.assign(V.opts(), patch); return DB.setMeta(K.opts, o); };

  /* ---------- Geräteschlüssel (hinter Face ID / „jeder Code“) ---------- */
  function deviceKey() {
    var s = DB.meta[K.dev], bytes;
    if (s) bytes = C.unb64(s);
    else { bytes = C.rnd(32); }
    return (s ? Promise.resolve() : DB.setMeta(K.dev, C.b64(bytes))).then(function () { return C.rawKey(bytes); });
  }

  /* ---------- Einrichten ---------- */
  V.setup = function (code, recoveryKey) {
    recoveryKey = recoveryKey || C.newRecoveryKey();
    var created;
    return C.createProfile(code, recoveryKey).then(function (r) {
      created = r; master = r.master; open = true; decoy = false; data = EMPTY();
      return C.encryptJSON(master, data);
    }).then(function (encData) {
      return DB.setMeta(K.prof, created.profile).then(function () { return DB.setMeta(K.data, encData); });
    }).then(function () {
      return DB.setMeta(K.set, true);
    }).then(function () { return recoveryKey; });
  };

  /* ---------- Tarn-Tresor einrichten ---------- */
  V.setupDecoy = function (tarnCode, mode, recoveryKey) {
    recoveryKey = recoveryKey || C.newRecoveryKey();
    var created, prof;
    return C.createProfile(tarnCode, recoveryKey).then(function (r) {
      created = r; prof = created.profile;
      // Immer zusätzlich mit dem Geräteschlüssel verpacken: dann öffnen Face ID, Schnellwechsel und
      // Modus „jeder Code“ den Tarn-Tresor. Ob ein Fehlcode ihn öffnet, entscheidet allein tarnMode.
      return deviceKey().then(function (dk) {
        return C.wrapMasterWith(created.master, dk).then(function (w) { prof.wrapAny = w; });
      });
    }).then(function () {
      return C.encryptJSON(created.master, EMPTY());
    }).then(function (encData) {
      return DB.setMeta(K.decoyProf, prof)
        .then(function () { return DB.setMeta(K.decoyData, encData); })
        .then(function () { return V.setOpt('tarnMode', mode || 'code'); })
        .then(function () { return DB.setMeta(K.decoySet, true); });
    }).then(function () { return recoveryKey; });
  };
  V.removeDecoy = function () {
    // Dateien des Tarn-Tresors mitlöschen: alles Verschlüsselte, das der offene echte Tresor nicht nutzt
    var keep = {};
    if (open && !decoy && data) data.files.forEach(function (f) { keep['venc:' + f.id] = 1; });
    var orphans = (open && !decoy) ? V.blobKeysEnc().then(function (keys) {
      var del = keys.filter(function (k) { return !keep[k]; });
      return del.length ? DB.delBlobs(del) : null;
    }) : Promise.resolve();
    return orphans.then(function () { return DB.setMeta(K.decoySet, false); }).then(function () { return DB.setMeta(K.decoyProf, null); })
      .then(function () { return DB.setMeta(K.decoyData, null); });
  };
  // Welcher Tresor öffnet sich mit diesem Code? 'real', 'decoy' oder null. Verhindert gleiche Codes für beide.
  V.codeOwner = function (code) {
    return C.openWithCode(DB.meta[K.prof], code).then(function () { return 'real'; }, function () {
      var dp = V.hasDecoy() && DB.meta[K.decoyProf];
      if (!dp) return null;
      return C.openWithCode(dp, code).then(function () { return 'decoy'; }, function () { return null; });
    });
  };

  /* ---------- Öffnen ---------- */
  function loadData(dec) {
    var rec = DB.meta[dec ? K.decoyData : K.data];
    return rec ? C.decryptJSON(master, rec).then(function (d) {
      d = Object.assign(EMPTY(), d);
      // Vorschau-Adressen gelten nur bis zum Neustart (ältere Stände hatten sie mitgespeichert)
      d.files.forEach(function (f) { delete f.url; });
      return d;
    }) : Promise.resolve(EMPTY());
  }
  function finishOpen(mk, dec) {
    session++;
    master = mk; decoy = dec;
    return loadData(dec).then(function (d) { data = d; open = true; return dec ? ensureDecoyDevWrap() : null; })
      .then(function () { return { decoy: dec }; });
  }
  // Ältere Tarn-Tresore (Modus „Nur Tarn-Code“) hatten keinen Geräteschlüssel. Beim ersten Öffnen nachrüsten,
  // damit Face ID und Schnellwechsel danach auch den Tarn-Tresor öffnen.
  function ensureDecoyDevWrap() {
    var dprof = DB.meta[K.decoyProf];
    if (!dprof || dprof.wrapAny) return Promise.resolve();
    return deviceKey().then(function (dk) { return C.wrapMasterWith(master, dk); }).then(function (w) {
      var p = Object.assign({}, DB.meta[K.decoyProf]); p.wrapAny = w;
      return DB.setMeta(K.decoyProf, p);
    }).catch(function () {});
  }

  // Code eingeben: echter Code → echter Tresor; Tarn-Code → Tarn-Tresor;
  // bei Modus „jeder Code“ öffnet jeder sonst falsche Code den Tarn-Tresor.
  V.unlock = function (code) {
    var prof = DB.meta[K.prof];
    return C.openWithCode(prof, code).then(function (mk) {
      // Der echte Code beendet den „Tarn-Modus jetzt“
      return (V.opts().tarnNow ? V.setOpt('tarnNow', false) : Promise.resolve()).then(function () { return finishOpen(mk, false); });
    }, function () {
      if (!V.hasDecoy()) return Promise.reject(new Error('Falscher Code'));
      var dprof = DB.meta[K.decoyProf];
      return C.openWithCode(dprof, code).then(function (mk) {
        return finishOpen(mk, true);
      }, function () {
        var o = V.opts();
        if ((o.tarnMode !== 'any' && !o.tarnNow) || !dprof.wrapAny) return Promise.reject(new Error('Falscher Code'));
        return deviceKey().then(function (dk) { return C.unwrapMasterWith(dprof.wrapAny, dk); }).then(function (mk) { return finishOpen(mk, true); });
      });
    });
  };

  // Für „Tarn-Modus jetzt“ / Schnellwechsel: gezielt den Tarn-Tresor öffnen (nutzt den Geräteschlüssel)
  V.openDecoyDirect = function () {
    var dprof = DB.meta[K.decoyProf];
    if (!dprof) return Promise.reject(new Error('Kein Tarn-Tresor'));
    if (!dprof.wrapAny) return Promise.reject(new Error('Tarn-Tresor braucht den Tarn-Code'));
    return deviceKey().then(function (dk) { return C.unwrapMasterWith(dprof.wrapAny, dk); }).then(function (mk) { return finishOpen(mk, true); });
  };

  /* ---------- Face ID (Geräteschlüssel als Komfort-Weg) ---------- */
  // Nach erfolgreicher Face-ID-Prüfung aufrufen. Öffnet echten oder Tarn-Tresor über den Geräteschlüssel.
  V.enableFace = function (credId) {
    // Hauptschlüssel des aktuell offenen Profils zusätzlich mit dem Geräteschlüssel verpacken
    if (!open) return Promise.reject(new Error('Tresor ist nicht offen'));
    var key = decoy ? K.decoyProf : K.prof;
    return deviceKey().then(function (dk) { return C.wrapMasterWith(master, dk); }).then(function (w) {
      var p = Object.assign({}, DB.meta[key]); p.wrapFace = w;
      return DB.setMeta(key, p);
    }).then(function () { return V.setOpts(credId ? { faceOn: true, faceCred: credId } : { faceOn: true }); });
  };
  V.disableFace = function () {
    var p = Object.assign({}, DB.meta[K.prof]); delete p.wrapFace;
    return DB.setMeta(K.prof, p).then(function () { return V.setOpts({ faceOn: false, faceCred: null }); });
  };
  // wantReal=true (Drehrad/langes Drücken) öffnet den echten Tresor.
  // Sonst entscheidet die Option faceReal: true = echter Tresor, false = Tarn-Tresor (falls vorhanden).
  // Ist „Tarn-Modus jetzt“ an, öffnet Face ID immer nur den Tarn-Tresor.
  V.faceOpen = function (wantReal) {
    var opts = V.opts();
    var toDecoy = V.hasDecoy() && (!!opts.tarnNow || (!wantReal && !opts.faceReal));
    var prof = DB.meta[toDecoy ? K.decoyProf : K.prof];
    if (!prof) return Promise.reject(new Error('Kein Tresor'));
    var wrap = prof.wrapFace || (toDecoy ? prof.wrapAny : null);
    if (!wrap) return Promise.reject(new Error(toDecoy ? 'Tarn-Tresor einmal mit dem Tarn-Code öffnen' : 'Face ID nicht eingerichtet'));
    return deviceKey().then(function (dk) { return C.unwrapMasterWith(wrap, dk); }).then(function (mk) { return finishOpen(mk, toDecoy); });
  };

  /* ---------- Code vergessen: mit Wiederherstellungsschlüssel ---------- */
  V.openWithRecovery = function (recoveryKey, dec) {
    var prof = DB.meta[dec ? K.decoyProf : K.prof];
    if (!prof) return Promise.reject(new Error('Kein Tresor'));
    return C.openWithRecovery(prof, recoveryKey).then(function (mk) { return finishOpen(mk, !!dec); });
  };

  /* ---------- Code / Schlüssel ändern ---------- */
  V.changeCode = function (newCode) {
    if (!open) return Promise.reject(new Error('Tresor ist nicht offen'));
    var key = decoy ? K.decoyProf : K.prof;
    return C.rewrapCode(DB.meta[key], master, newCode).then(function (p) {
      if (DB.meta[key].wrapFace) p.wrapFace = DB.meta[key].wrapFace;
      if (DB.meta[key].wrapAny) p.wrapAny = DB.meta[key].wrapAny;
      return DB.setMeta(key, p);
    });
  };
  V.newRecoveryKey = function () {
    if (!open) return Promise.reject(new Error('Tresor ist nicht offen'));
    var key = decoy ? K.decoyProf : K.prof, rk = C.newRecoveryKey();
    return C.rewrapRecovery(DB.meta[key], master, rk).then(function (p) {
      if (DB.meta[key].wrapFace) p.wrapFace = DB.meta[key].wrapFace;
      if (DB.meta[key].wrapAny) p.wrapAny = DB.meta[key].wrapAny;
      return DB.setMeta(key, p);
    }).then(function () { return rk; });
  };

  /* ---------- Speichern ---------- */
  V.save = function () {
    if (!open) return Promise.reject(new Error('Tresor ist nicht offen'));
    // Schlüssel und Ziel jetzt festhalten: ein Wechsel während des Verschlüsselns darf nichts vertauschen
    var mk = master, slot = decoy ? K.decoyData : K.data;
    var clean = Object.assign({}, data, { files: data.files.map(function (f) { var c = Object.assign({}, f); delete c.url; return c; }) });
    return C.encryptJSON(mk, clean).then(function (enc) { return DB.setMeta(slot, enc); });
  };

  /* ---------- Dateien (verschlüsselt) ---------- */
  V.putFile = function (id, blob) {
    var mk = master;
    if (!mk) return Promise.reject(new Error('Tresor ist nicht offen'));
    return blob.arrayBuffer()
      .then(function (buf) { return C.encryptBytes(mk, new Uint8Array(buf)); })
      .then(function (rec) {
        // Als Blob mit der verschlüsselten Nutzlast speichern (iv vorangestellt via JSON-Hülle wäre unhandlich → zwei Felder)
        var payload = new Blob([JSON.stringify(rec)], { type: 'application/x-wiw-enc' });
        return DB.putBlob('venc:' + id, payload);
      });
  };
  // Entschlüsselte Vorschau-Adressen merken, damit sie beim Sperren wieder freigegeben werden
  var liveURLs = [];
  V.getFileURL = function (id, mime) {
    var mk = master, s0 = session;
    if (!mk) return Promise.resolve('');
    return DB.getBlob('venc:' + id).then(function (b) {
      if (!b) return '';
      return b.text().then(function (txt) {
        var rec = JSON.parse(txt);
        return C.decryptBytes(mk, rec).then(function (buf) {
          if (s0 !== session) return '';
          var u = URL.createObjectURL(new Blob([buf], { type: mime || 'application/octet-stream' }));
          liveURLs.push(u);
          return u;
        });
      });
    });
  };
  V.delFile = function (id) { return DB.delBlobs(['venc:' + id]); };

  /* ---------- Einbruch-Protokoll (nicht geheim) ---------- */
  V.log = function () { return DB.meta[K.log] || []; };
  V.addLog = function (what, bad) {
    var l = (DB.meta[K.log] || []).slice();
    l.push({ t: Date.now(), what: what, bad: !!bad });
    return DB.setMeta(K.log, l.slice(-100));
  };
  V.markLogSeen = function () {
    var l = (DB.meta[K.log] || []).map(function (e) { var c = Object.assign({}, e); c.seen = true; return c; });
    return DB.setMeta(K.log, l);
  };
  V.clearLog = function () { return DB.setMeta(K.log, []); };

  /* ---------- Schließen / Löschen ---------- */
  V.lock = function () {
    session++; master = null; open = false; decoy = false; data = null;
    liveURLs.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    liveURLs = [];
  };
  V.wipe = function () {
    // Nur den gerade offenen Tresor löschen (Dateien + Index)
    var files = (data && data.files) || [], ids = files.map(function (f) { return 'venc:' + f.id; });
    var p = ids.length ? DB.delBlobs(ids) : Promise.resolve();
    return p.then(function () {
      data = EMPTY();
      return V.save();
    });
  };
  // Alles (echt + Tarn) entfernen und zurücksetzen
  V.destroyAll = function () {
    return V.blobKeysEnc().then(function (keys) {
      return keys.length ? DB.delBlobs(keys) : null;
    }).then(function () {
      return Promise.all([K.set, K.prof, K.data, K.decoySet, K.decoyProf, K.decoyData, K.opts, K.log].map(function (k) { return DB.setMeta(k, null); }));
    }).then(function () { V.lock(); });
  };
  /* ---------- Sicherung ---------- */
  // Alles, was für die Sicherung nötig ist, ist schon verschlüsselt. Der Geräteschlüssel kommt NIE mit:
  // sonst ließe sich der Tresor aus der Sicherungsdatei ohne Code öffnen. Darum fallen auch die
  // Face-ID- und „jeder Code“-Hüllen weg; der Tarn-Tresor bekommt seine beim ersten Öffnen neu.
  var BACKUP_KEYS = [K.set, K.prof, K.data, K.decoySet, K.decoyProf, K.decoyData, K.opts, K.log];
  V.exportMeta = function () {
    if (!V.configured()) return null;
    var out = {};
    BACKUP_KEYS.forEach(function (k) {
      var v = DB.meta[k]; if (v == null) return;
      v = JSON.parse(JSON.stringify(v));
      if (k === K.prof || k === K.decoyProf) { delete v.wrapFace; delete v.wrapAny; }
      if (k === K.opts) { v.faceOn = false; v.faceCred = null; v.tarnNow = false; }
      out[k] = v;
    });
    return out;
  };
  // Nur auf einem Gerät ohne eigenen Tresor einspielen, ein vorhandener wird nie überschrieben
  V.importMeta = function (m) {
    if (V.configured() || !m || !m[K.set] || !m[K.prof]) return Promise.resolve(false);
    return Promise.all(BACKUP_KEYS.filter(function (k) { return k in m; }).map(function (k) { return DB.setMeta(k, m[k]); }))
      .then(function () { return true; });
  };
  V.blobKeysEnc = function () {
    return DB.blobKeys().then(function (keys) { return keys.filter(function (k) { return String(k).indexOf('venc:') === 0; }); });
  };
})(window.W = window.W || {});
