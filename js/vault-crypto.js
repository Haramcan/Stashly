/* Wo ist was – Tresor: Verschlüsselung und verschlüsselter Speicher.
 *
 * So funktioniert es:
 *  - Die Inhalte (Dinge, Dateien, Passwörter, Notizen) liegen verschlüsselt mit einem zufälligen
 *    Hauptschlüssel (AES-256-GCM).
 *  - Der Hauptschlüssel selbst wird zweimal verpackt: einmal mit einem Schlüssel aus deinem Tresor-Code,
 *    einmal mit einem Schlüssel aus dem Wiederherstellungsschlüssel. So kommst du mit beidem hinein,
 *    und der Code lässt sich ändern, ohne alles neu zu verschlüsseln.
 *  - Der echte Tresor und der Tarn-Tresor sind getrennte Profile mit eigenem Hauptschlüssel. Der Tarn-Code
 *    öffnet nur den Tarn-Tresor, der echte Code nur den echten.
 *  - Nichts davon verlässt das Gerät. Es gibt kein Konto und keine Cloud.
 *
 * Die Krypto-Grundfunktionen stehen hier; der Speicher (IndexedDB) ist W.VaultStore in vault-store.js.
 */
(function (W) {
  'use strict';
  var C = W.VaultCrypto = {};
  var subtle = (window.crypto && window.crypto.subtle) || null;
  var ITER = 310000; // PBKDF2-Runden (OWASP-Empfehlung für SHA-256)

  C.available = function () { return !!(subtle && window.TextEncoder); };

  /* ---------- kleine Helfer ---------- */
  function rnd(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  C.b64 = b64; C.unb64 = unb64; C.rnd = rnd;

  function enc(s) { return new TextEncoder().encode(s); }
  function dec(b) { return new TextDecoder().decode(b); }

  /* ---------- Wiederherstellungsschlüssel ---------- */
  // 6 Blöcke zu 4 Zeichen, ohne leicht verwechselbare Zeichen (0/O, 1/I)
  var RALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  C.newRecoveryKey = function () {
    var g = [];
    for (var i = 0; i < 6; i++) {
      var s = '', r = rnd(4);
      for (var k = 0; k < 4; k++) s += RALPHABET[r[k] % RALPHABET.length];
      g.push(s);
    }
    return g.join('-');
  };
  // Eingabe säubern: Großbuchstaben, nur Buchstaben und Ziffern. Das Alphabet oben nutzt kein 0/O/1/I,
  // deshalb genügt es, alles andere zu entfernen; falsch getippte Zeichen fallen bei der Prüfung auf.
  C.cleanKey = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  C.formatRecoveryKey = function (s) {
    var raw = C.cleanKey(s).slice(0, 24);
    return raw.replace(/(.{4})(?=.)/g, '$1-');
  };

  /* ---------- Schlüssel aus Code/Schlüssel ableiten ---------- */
  function importPw(str) {
    return subtle.importKey('raw', enc(str), { name: 'PBKDF2' }, false, ['deriveKey']);
  }
  function deriveWrap(str, salt) {
    return importPw(str).then(function (base) {
      return subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
      );
    });
  }

  /* ---------- Hauptschlüssel ---------- */
  function newMaster() {
    return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  // Schlüssel aus rohen Bytes (für den Geräteschlüssel hinter Face ID bzw. „jeder Code“)
  C.rawKey = function (bytes) {
    return subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
  };
  function wrapMaster(master, wrapKey) {
    var iv = rnd(12);
    return subtle.wrapKey('raw', master, wrapKey, { name: 'AES-GCM', iv: iv }).then(function (wrapped) {
      return { iv: b64(iv), ct: b64(wrapped) };
    });
  }
  function unwrapMaster(rec, wrapKey) {
    return subtle.unwrapKey('raw', unb64(rec.ct), wrapKey, { name: 'AES-GCM', iv: unb64(rec.iv) },
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  C.wrapMasterWith = wrapMaster;     // Hauptschlüssel mit einem beliebigen Schlüssel verpacken
  C.unwrapMasterWith = unwrapMaster; // und wieder auspacken (z. B. Geräteschlüssel)

  /* ---------- Daten ver-/entschlüsseln (mit Hauptschlüssel) ---------- */
  C.encryptBytes = function (master, bytes) {
    var iv = rnd(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, master, bytes).then(function (ct) {
      return { iv: b64(iv), ct: b64(ct) };
    });
  };
  C.decryptBytes = function (master, rec) {
    return subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, master, unb64(rec.ct));
  };
  C.encryptJSON = function (master, obj) { return C.encryptBytes(master, enc(JSON.stringify(obj))); };
  C.decryptJSON = function (master, rec) { return C.decryptBytes(master, rec).then(function (buf) { return JSON.parse(dec(buf)); }); };

  /* ---------- Profil anlegen / öffnen ---------- */
  // Ergebnis: ein nicht geheimes Profil-Objekt, das gespeichert werden darf.
  // { v, saltCode, saltRec, iter, wrapCode, wrapRec, check }  (alles base64 / Zahlen)
  C.createProfile = function (code, recoveryKey) {
    var saltCode = rnd(16), saltRec = rnd(16);
    var master;
    return newMaster().then(function (mk) {
      master = mk;
      return Promise.all([deriveWrap(code, saltCode), deriveWrap(C.cleanKey(recoveryKey), saltRec)]);
    }).then(function (keys) {
      return Promise.all([wrapMaster(master, keys[0]), wrapMaster(master, keys[1]), C.encryptBytes(master, enc('wo-ist-was-tresor'))]);
    }).then(function (r) {
      return {
        profile: { v: 1, iter: ITER, saltCode: b64(saltCode), saltRec: b64(saltRec), wrapCode: r[0], wrapRec: r[1], check: r[2] },
        master: master
      };
    });
  };

  // Mit Code öffnen → Hauptschlüssel, oder Fehler (falscher Code)
  C.openWithCode = function (profile, code) {
    return deriveWrap(code, unb64(profile.saltCode)).then(function (wk) {
      return unwrapMaster(profile.wrapCode, wk);
    }).then(function (master) {
      // Prüfen, dass der Code wirklich passt (GCM wirft sonst schon, aber sicher ist sicher)
      return C.decryptBytes(master, profile.check).then(function () { return master; });
    });
  };
  // Mit Wiederherstellungsschlüssel öffnen
  C.openWithRecovery = function (profile, recoveryKey) {
    return deriveWrap(C.cleanKey(recoveryKey), unb64(profile.saltRec)).then(function (wk) {
      return unwrapMaster(profile.wrapRec, wk);
    }).then(function (master) {
      return C.decryptBytes(master, profile.check).then(function () { return master; });
    });
  };

  // Neuen Code setzen (Hauptschlüssel neu mit Code verpacken) – ohne alles neu zu verschlüsseln
  C.rewrapCode = function (profile, master, newCode) {
    var saltCode = rnd(16);
    return deriveWrap(newCode, saltCode).then(function (wk) {
      return wrapMaster(master, wk);
    }).then(function (wrap) {
      var p = Object.assign({}, profile);
      p.saltCode = b64(saltCode); p.wrapCode = wrap;
      return p;
    });
  };
  // Neuen Wiederherstellungsschlüssel setzen
  C.rewrapRecovery = function (profile, master, newRecoveryKey) {
    var saltRec = rnd(16);
    return deriveWrap(C.cleanKey(newRecoveryKey), saltRec).then(function (wk) {
      return wrapMaster(master, wk);
    }).then(function (wrap) {
      var p = Object.assign({}, profile);
      p.saltRec = b64(saltRec); p.wrapRec = wrap;
      return p;
    });
  };
})(window.W = window.W || {});
