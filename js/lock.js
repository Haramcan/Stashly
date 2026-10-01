/* Wo ist was – App-Sperre mit Code und (wenn das Gerät es kann) Face ID über einen Passkey.
   Hinweis: Die Sperre hält andere Leute vom Durchblättern ab. Die Daten selbst werden dadurch nicht verschlüsselt. */
(function (W) {
  'use strict';
  var U = W.U, $ = U.$;
  var L = W.Lock = {};
  var cfg = function () { return {}; }, save = function () {}, onChange = function () {};
  var mode = 'unlock', entry = '', first = '', busy = false, setupDone = null, hiddenAt = 0;

  L.init = function (o) { cfg = o.cfg; save = o.save; onChange = o.onChange || onChange; };

  /* ---------- Code als Prüfsumme speichern, nie im Klartext ---------- */
  function hash(code) {
    var s = 'wo-ist-was:' + code;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Promise.resolve('d' + (h >>> 0).toString(16));
  }

  /* ---------- Face ID / Touch ID über WebAuthn ---------- */
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  L.faceAvailable = function () {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  };
  // Muss direkt aus einem Antippen heraus aufgerufen werden
  L.enrollFace = function (label) {
    return navigator.credentials.create({ publicKey: {
      challenge: rand(32),
      rp: { name: 'Wo ist was', id: location.hostname },
      user: { id: rand(16), name: label || 'wo-ist-was', displayName: label || 'Wo ist was' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000
    } }).then(function (c) { return b64(c.rawId); });
  };
  function verifyFace() { return L.verifyFaceWith(cfg().lockCred); }
  // Prüft Face ID mit einem bestimmten Passkey (auch für den Tresor). Muss direkt aus einem Antippen heraus aufgerufen werden.
  L.verifyFaceWith = function (id) {
    if (!id) return Promise.reject(new Error('kein Passkey'));
    return navigator.credentials.get({ publicKey: {
      challenge: rand(32), rpId: location.hostname, userVerification: 'required', timeout: 60000,
      allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }]
    } });
  };

  /* ---------- Oberfläche ---------- */
  var FACE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/></svg>';
  var DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/></svg>';
  var built = false, box;
  function build() {
    if (built) return;
    built = true; box = $('#lock');
    $('#lkPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'face', '0', 'del'].map(function (k) {
      if (k === 'face') return '<button type="button" class="plain" data-lk="face" id="lkFace" aria-label="Mit Face ID entsperren">' + FACE + '</button>';
      if (k === 'del') return '<button type="button" class="plain" data-lk="del" aria-label="Letzte Ziffer löschen">' + DEL + '</button>';
      return '<button type="button" data-lk="' + k + '">' + k + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lk]');
      if (t) { key(t.dataset.lk); return; }
      if (e.target.closest('#lkCancel')) cancelSetup();
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (/^[0-9]$/.test(e.key)) key(e.key);
      else if (e.key === 'Backspace') key('del');
    });
  }
  function render() {
    var T = { unlock: ['Wo ist was ist gesperrt', cfg().lockCred ? 'Entsperre mit Face ID oder deinem Code' : 'Gib deinen Code ein'],
      setup: ['Code festlegen', '4 Ziffern, die du dir gut merken kannst'], confirm: ['Code wiederholen', 'Zur Sicherheit noch einmal'] }[mode];
    $('#lkT').textContent = T[0];
    $('#lkS').textContent = T[1];
    U.$$('#lkDots i').forEach(function (d, i) { d.classList.toggle('on', i < entry.length); });
    $('#lkFace').style.visibility = mode === 'unlock' && cfg().lockCred ? 'visible' : 'hidden';
    $('#lkCancel').style.visibility = mode === 'unlock' ? 'hidden' : 'visible';
  }
  function open(m) {
    build();
    mode = m; entry = ''; first = ''; busy = false;
    box.classList.remove('scanning', 'scanned', 'leaving');
    render();
    box.hidden = false;
    document.documentElement.classList.add('is-locked');
  }
  function close(anim) {
    document.documentElement.classList.remove('is-locked');
    if (!anim) { box.hidden = true; return; }
    box.classList.add('leaving');
    setTimeout(function () { box.hidden = true; box.classList.remove('leaving', 'scanning', 'scanned'); }, 420);
  }
  function wrong(msg) {
    var d = $('#lkDots');
    d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
    W.Sound.haptic(2); W.Sound.play('close');
    entry = '';
    setTimeout(function () { render(); if (msg) $('#lkS').textContent = msg; }, 380);
  }
  function key(k) {
    if (busy) return;
    if (k === 'face') { face(); return; }
    if (k === 'del') { entry = entry.slice(0, -1); W.Sound.play('tick'); render(); return; }
    if (entry.length >= 4) return;
    entry += k; W.Sound.play('tick'); render();
    if (entry.length === 4) check();
  }
  function check() {
    var code = entry;
    if (mode === 'setup') { first = code; entry = ''; mode = 'confirm'; setTimeout(render, 150); return; }
    if (mode === 'confirm') {
      if (code !== first) { mode = 'setup'; first = ''; wrong('Die Codes waren verschieden. Bitte neu festlegen.'); return; }
      busy = true;
      hash(code).then(function (h) {
        var c = cfg(); c.lockHash = h; c.lock = true; save();
        W.Sound.play('done'); close(true); busy = false;
        var cb = setupDone; setupDone = null; if (cb) cb(true);
        onChange();
      });
      return;
    }
    busy = true;
    hash(code).then(function (h) {
      busy = false;
      if (h === cfg().lockHash) { W.Sound.play('done'); close(true); }
      else wrong('Falscher Code. Versuch es noch einmal.');
    });
  }
  function face() {
    box.classList.add('scanning');
    verifyFace().then(function () {
      box.classList.add('scanned'); W.Sound.play('done');
      setTimeout(function () { close(true); }, 450);
    }, function () {
      box.classList.remove('scanning');
      $('#lkS').textContent = 'Face ID hat nicht geklappt. Gib deinen Code ein.';
    });
  }
  function cancelSetup() {
    var cb = setupDone; setupDone = null;
    W.Sound.play('close'); close(false);
    if (cb) cb(false);
  }

  /* ---------- Von außen ---------- */
  L.enabled = function () { var c = cfg(); return !!(c.lock && c.lockHash); };
  L.lockNow = function () { if (L.enabled()) open('unlock'); };
  L.setup = function (cb) { setupDone = cb || null; open('setup'); };
  L.isOpen = function () { return built && !box.hidden; };
  L.boot = function () {
    if (L.enabled()) open('unlock');
    else document.documentElement.classList.remove('is-locked');
  };
  // Nach der eingestellten Zeit im Hintergrund wieder sperren
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (!L.enabled() || !hiddenAt) return;
    // Offene Sperre zum Entsperren: nichts zu tun. Offenes „Code ändern“ zählt nicht als gesperrt,
    // sonst käme man danach mit „Abbrechen“ ohne Code in die App.
    if (L.isOpen() && mode === 'unlock') return;
    var mins = +(cfg().lockAfter || 0);
    if (Date.now() - hiddenAt >= mins * 60000) {
      var cb = setupDone; setupDone = null;
      open('unlock');
      if (cb) cb(false);
    }
  });
})(window.W = window.W || {});
