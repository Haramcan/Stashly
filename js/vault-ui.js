/* Wo ist was – Tresor: Oberfläche (Vollbild). Daten kommen verschlüsselt aus W.Vault. */
(function (W) {
  'use strict';
  var U = W.U, V = W.Vault, C = W.VaultCrypto, L = W.Lock, DB = W.DB;
  var esc = U.esc;
  var UI = W.VaultUI = {};

  /* ---------- Symbole ---------- */
  var SW = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var P = {
    back: '<path d="m15 5-7 7 7 7"/>', chev: '<path d="m9 5 7 7-7 7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/><path d="M12 15v2"/>',
    face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/>',
    del: '<path d="M9 5h11v14H9l-6-7z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.5 12.5 8.5-8.5M16 7l2.5 2.5M13.5 9.5 15.5 11.5"/>',
    shield: '<path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
    idcard: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4.5M14 13.5h3"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" ' + SW + ' aria-hidden="true">' + P[n] + '</svg>'; }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function toast(m, o) { U.toast(m, o); }

  function dial(size, cls) {
    var t = '';
    for (var i = 0; i < 48; i++) { var a = i * 7.5 * Math.PI / 180, r1 = i % 4 ? 43.5 : 40;
      t += '<line x1="' + (50 + Math.cos(a) * r1).toFixed(2) + '" y1="' + (50 + Math.sin(a) * r1).toFixed(2) + '" x2="' + (50 + Math.cos(a) * 46.5).toFixed(2) + '" y2="' + (50 + Math.sin(a) * 46.5).toFixed(2) + '"/>'; }
    var sp = [0, 120, 240].map(function (d) { var a = (d - 90) * Math.PI / 180;
      return '<line x1="' + (50 + Math.cos(a) * 11).toFixed(2) + '" y1="' + (50 + Math.sin(a) * 11).toFixed(2) + '" x2="' + (50 + Math.cos(a) * 24).toFixed(2) + '" y2="' + (50 + Math.sin(a) * 24).toFixed(2) + '"/>'; }).join('');
    return '<svg class="dial ' + (cls || '') + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="48.5" fill="#1D2226" stroke="#C7A15A" stroke-width="1.4"/>' +
      '<g stroke="#C7A15A" stroke-width="1.2" stroke-linecap="round" opacity=".85">' + t + '</g>' +
      '<g class="dknob"><circle cx="50" cy="50" r="30" fill="#D9B978"/><g stroke="#1D2226" stroke-width="4.5" stroke-linecap="round">' + sp + '</g><circle cx="50" cy="50" r="7" fill="#1D2226"/></g></svg>';
  }

  /* ---------- 2FA-Codes (offline berechnet) ---------- */
  function b32(s) {
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = '', out = [];
    s = String(s).replace(/[\s=-]/g, '').toUpperCase();
    for (var i = 0; i < s.length; i++) { var v = A.indexOf(s[i]); if (v >= 0) bits += ('0000' + v.toString(2)).slice(-5); }
    for (var j = 0; j + 8 <= bits.length; j += 8) out.push(parseInt(bits.slice(j, j + 8), 2));
    return new Uint8Array(out);
  }
  var totpCache = {};
  function totp(secret) {
    var step = Math.floor(Date.now() / 30000), ck = secret + ':' + step;
    if (totpCache[ck]) return Promise.resolve(totpCache[ck]);
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('------');
    var buf = new ArrayBuffer(8), dv = new DataView(buf);
    dv.setUint32(0, Math.floor(step / 4294967296)); dv.setUint32(4, step >>> 0);
    return crypto.subtle.importKey('raw', b32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, buf); })
      .then(function (sig) { var h = new Uint8Array(sig), o = h[h.length - 1] & 15;
        var n = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
        return (totpCache[ck] = ('00000' + n).slice(-6)); }).catch(function () { return '------'; });
  }
  function tickCodes() {
    var els = SCR.querySelectorAll('[data-totp]'); if (!els.length) return;
    var left = 30 - (Math.floor(Date.now() / 1000) % 30);
    els.forEach(function (el) { totp(el.dataset.totp).then(function (c) { el.textContent = c.slice(0, 3) + ' ' + c.slice(3); }); });
    SCR.querySelectorAll('[data-ring]').forEach(function (r) { r.style.setProperty('--p', (left / 30).toFixed(3)); r.classList.toggle('low', left <= 5); });
  }

  /* ---------- Passwort-Stärke / Generator ---------- */
  function strength(p) {
    var cl = 0; [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].forEach(function (r) { if (r.test(p)) cl++; });
    var s = (p.length >= 8) + (p.length >= 12) + (p.length >= 16) + (cl >= 3) + (cl >= 4);
    var n = p.toLowerCase();
    if (/passw|sommer|winter|hallo|123|qwert|abc/.test(n) || /^[a-z]+\d{1,4}$/i.test(p)) s = Math.min(s, 1);
    return Math.max(0, Math.min(4, s));
  }
  var SLBL = ['schwach', 'schwach', 'mittel', 'gut', 'stark'];
  function rnd(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  function genPw(o) {
    var L2 = 'abcdefghijkmnopqrstuvwxyz', U2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', Y = '!#$%&*+-=?@_';
    if (!o.easy) { L2 += 'l'; U2 += 'IO'; D += '01'; Y += '()[]{}<>.,;:'; }
    var sets = [L2]; if (o.up) sets.push(U2); if (o.dig) sets.push(D); if (o.sym) sets.push(Y);
    var all = sets.join(''), out = sets.map(function (s) { return s[rnd(s.length)]; });
    while (out.length < o.len) out.push(all[rnd(all.length)]);
    for (var i = out.length - 1; i > 0; i--) { var j = rnd(i + 1), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out.join('');
  }
  function dupsOf(p) { return D().passwords.filter(function (x) { return x.pw === p.pw && x.id !== p.id; }); }
  function fmtSize(b) { return b < 1e6 ? Math.max(1, Math.round(b / 1e3)) + ' KB' : (b / 1e6).toFixed(b < 1e7 ? 1 : 0).replace('.', ',') + ' MB'; }

  var TPL = {
    card: { n: 'Bankkarte', ic: 'card', f: [['Bank', 0], ['Karteninhaber', 0], ['Kartennummer', 1], ['Gültig bis', 0], ['PIN', 1], ['IBAN', 1]] },
    id: { n: 'Ausweis', ic: 'idcard', f: [['Art', 0], ['Nummer', 1], ['Gültig bis', 0]] },
    wifi: { n: 'WLAN', ic: 'wifi', f: [['Netzwerk', 0], ['Passwort', 1]] },
    lock: { n: 'Zahlenschloss', ic: 'lock', f: [['Wofür', 0], ['Kombination', 1]] },
    text: { n: 'Freitext', ic: 'doc', f: [['Text', 1]] }
  };

  /* ---------- DOM ---------- */
  var BOX, TOP, TITLE, BACK, GEAR, SCR, FID, FILEIN;
  function D() { return V.data(); }
  function build() {
    if (BOX) return;
    BOX = document.createElement('div'); BOX.id = 'vaultui';
    BOX.innerHTML =
      '<div class="v-top"><button class="v-ib" id="vBack" type="button" aria-label="Zurück"></button>' +
      '<h2 id="vTitle"></h2><button class="v-ib" id="vGear" type="button" aria-label="Tresor-Einstellungen" hidden></button></div>' +
      '<div class="v-scr" id="vScr"></div>' +
      '<div class="fid" id="vFid" aria-hidden="true"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="scan"><path class="fc" d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path class="fc" d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/></g>' +
      '<g class="ok"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/></g></svg></div></div>' +
      '<div class="vc-wrap" id="vConfirm"><div class="vc-card" role="alertdialog" aria-modal="true"><b class="vc-t"></b><p class="vc-x"></p>' +
      '<div class="rowbtns"><button type="button" class="abtn" data-a="vc-no">Abbrechen</button><button type="button" class="abtn dang" data-a="vc-yes">Löschen</button></div></div></div>' +
      '<input id="vFileIn" type="file" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" tabindex="-1">';
    document.body.appendChild(BOX);
    TOP = BOX.querySelector('.v-top'); TITLE = BOX.querySelector('#vTitle'); BACK = BOX.querySelector('#vBack');
    GEAR = BOX.querySelector('#vGear'); SCR = BOX.querySelector('#vScr'); FID = BOX.querySelector('#vFid'); FILEIN = BOX.querySelector('#vFileIn');
    BACK.innerHTML = ic('back'); GEAR.innerHTML = ic('gear');
    wire();
    setInterval(function () { if (BOX.classList.contains('on')) tickCodes(); }, 1000);
  }

  /* ---------- Zustand ---------- */
  var st = {}, hist = [];
  function reset() {
    st = { screen: 'items', tab: 'items', pwv: 'pw', ff: 'all', fid: null, pwId: null, nid: null, show: false,
      nshow: {}, delArm: false, entry: '', codeMode: 'setup', codeStep: 1, first: '', draft: null, ndraft: null,
      editId: null, neditId: null, armReal: false, recKey: '', recMode: 'show', wrote: false, folder: null, nfold: false,
      fmode: null, fdel: false, recInput: '', pendingFiles: null };
    hist = [];
  }
  function go(s) { hist.push(st.screen); st.screen = s; render(); }
  function back() {
    if (!hist.length) { UI.close(); return; }
    st.screen = hist.pop(); render();
  }

  /* ---------- Render ---------- */
  function render() {
    var r = (S[st.screen] || S.items)();
    TITLE.textContent = r.title || '';
    TOP.hidden = !!r.hideTop;
    BACK.hidden = false;
    GEAR.hidden = !r.gear;
    BOX.querySelector('.v-scr').className = 'v-scr' + (r.full ? ' full' : '');
    BOX.classList.toggle('v-dark', !!r.dark);
    BOX.classList.toggle('viewer', !!r.viewer);
    SCR.innerHTML = r.html;
    SCR.scrollTop = 0;
    if (r.after) r.after();
    tickCodes();
  }

  function save() { return V.save().then(render); }

  /* ================= Bildschirme ================= */
  var S = {};

  /* --- Einrichten --- */
  S.intro = function () {
    return { dark: true, full: true, html:
      '<div class="vhero">' + dial(96) + '<h3>Dein Tresor</h3><p>Für Dinge, Fotos, Dokumente und Passwörter, die nur du sehen sollst.</p></div>' +
      '<div class="vpoints">' +
      '<div class="vpoint"><span>' + ic('lock') + '</span><p><b>Eigener Code</b><small>6 Ziffern, getrennt vom App-Code. Face ID kannst du dazunehmen.</small></p></div>' +
      '<div class="vpoint"><span>' + ic('shield') + '</span><p><b>Echt verschlüsselt</b><small>Name, Ort, Notizen, Fotos und Passwörter. Auch in der Sicherung.</small></p></div>' +
      '<div class="vpoint"><span>' + ic('key') + '</span><p><b>Wiederherstellungsschlüssel</b><small>Falls du den Code vergisst. Du schreibst ihn gleich auf.</small></p></div>' +
      '</div><div class="spacer"></div><button type="button" class="bbtn" data-a="startcode">Code festlegen</button>' };
  };
  S.code = function () {
    var T = { setup: 'Tresor-Code festlegen', change: 'Neuer Tresor-Code', tarn: 'Tarn-Code festlegen', reset: 'Neuen Code festlegen' }[st.codeMode];
    var sub = st.codeStep === 2 ? 'Zur Sicherheit noch einmal' :
      (st.codeMode === 'setup' ? 'Nimm nicht denselben Code wie für die App.' : st.codeMode === 'tarn' ? 'Ein anderer Code als dein echter Tresor-Code' : '6 Ziffern, die du dir gut merken kannst');
    return { dark: true, full: true, html:
      '<div class="vhero"><h3>' + (st.codeStep === 2 ? 'Code wiederholen' : T) + '</h3></div>' +
      '<p class="vsub" id="vsub">' + sub + '</p>' + dots() + '<div class="spacer"></div>' + keypad(false) + '<div style="height:10px"></div>' };
  };
  S.recovery = function () {
    var renew = st.recMode === 'renew';
    var groups = (st.recKey || '').split('-');
    return { dark: true, full: true, html:
      '<div class="vhero"><h3>' + (renew ? 'Neuer Wiederherstellungs&shy;schlüssel' : 'Dein Wiederherstellungs&shy;schlüssel') + '</h3><p>Schreib ihn auf Papier, genau in dieser Reihenfolge.</p></div>' +
      '<div class="rkey">' + groups.map(function (g, i) { return '<span><i>' + (i + 1) + '</i>' + esc(g) + '</span>'; }).join('') + '</div>' +
      '<div class="vwarn">' + ic('warn') + '<span><b>Ohne Tresor-Code und ohne diesen Schlüssel ist alles im Tresor für immer verloren.</b> Niemand kann ihn wiederherstellen, auch die App nicht. Bewahr ihn sicher auf, nicht im Tresor und nicht als Foto in der App.' + (renew ? ' Der alte Schlüssel gilt ab jetzt nicht mehr.' : '') + '</span></div>' +
      '<div class="vrow2"><button type="button" class="gbtn" data-a="copykey">' + ic('copy') + 'Kopieren</button></div>' +
      '<label class="vcheck"><input type="checkbox" id="vWrote"' + (st.wrote ? ' checked' : '') + '>Ich habe den Schlüssel aufgeschrieben.</label>' +
      '<div class="spacer"></div><button type="button" class="bbtn" id="vRecNext" data-a="recnext"' + (st.wrote ? '' : ' disabled') + '>Weiter</button>' };
  };
  S.face = function () {
    return { dark: true, full: true, html:
      '<div class="vhero" style="margin-top:26px"><div style="width:92px;height:92px;border-radius:26px;display:grid;place-items:center;background:rgba(199,161,90,.14);color:#E6C98E">' + ic('face').replace('<svg ', '<svg width="52" height="52" ') + '</div>' +
      '<h3>Tresor mit Face ID öffnen?</h3><p>Dann reicht ein Blick. Der Tresor-Code funktioniert trotzdem immer.</p></div>' +
      '<div class="spacer"></div><button type="button" class="bbtn" data-a="faceyes">' + ic('face') + 'Face ID nutzen</button>' +
      '<button type="button" class="gbtn" data-a="faceno">Nur mit Code</button>' };
  };

  /* --- Sperre / vergessen --- */
  S.lock = function () {
    var o = V.opts();
    return { dark: true, full: true, hideTop: true, html:
      '<div style="height:env(safe-area-inset-top,0px)"></div>' +
      '<div class="vhero" style="margin-top:20px"><button type="button" class="dialbtn" data-a="dialtap" aria-label="Tresor-Drehrad">' + dial(92, 'big' + (st.armReal ? ' armed' : '')) + '</button><h3>Tresor</h3></div>' +
      '<p class="vsub" id="vsub">' + (o.faceOn ? 'Face ID oder Tresor-Code' : 'Gib deinen Tresor-Code ein') + '</p>' + dots() + '<div class="spacer"></div>' + keypad(o.faceOn) +
      '<button type="button" class="vlink" data-a="forgot">Code vergessen?</button>' };
  };
  S.forgot = function () {
    return { dark: true, full: true, html:
      '<div class="vhero" style="margin-top:8px"><div style="width:80px;height:80px;border-radius:24px;display:grid;place-items:center;background:rgba(199,161,90,.14);color:#E6C98E">' + ic('key').replace('<svg ', '<svg width="44" height="44" ') + '</div>' +
      '<h3>Code vergessen</h3><p>Gib deinen Wiederherstellungsschlüssel ein. Danach legst du einen neuen Code fest.</p></div>' +
      '<input class="kin" id="vKin" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" maxlength="29" value="' + esc(st.recInput) + '">' +
      '<p class="vsub" id="vKsub" style="min-height:0">Mit oder ohne Bindestriche.</p>' +
      '<div class="spacer"></div><button type="button" class="bbtn" id="vKgo" data-a="keyok"' + (C.cleanKey(st.recInput).length >= 24 ? '' : ' disabled') + '>Tresor öffnen</button>' };
  };

  /* --- offener Tresor --- */
  function vhead() {
    return '<div class="vhead"><span class="vstat"><button type="button" class="vsw-ib" data-a="switch" aria-label="Schnell wechseln">' + ic('unlock') + '</button>' +
      '<span>Offen<small>Sperrt sich, sobald du ihn verlässt</small></span></span>' +
      '<button type="button" class="vmini" data-a="relock">' + ic('lock') + 'Sperren</button>' +
      '<button type="button" class="vmini ic" data-a="settings" aria-label="Einstellungen">' + ic('gear') + '</button></div>';
  }
  S.items = function () {
    var vi = D().items, h = vhead() + seg();
    if (st.tab === 'items') {
      h += logBanner();
      h += vi.length ? vi.map(itemRow).join('') : '<div class="empty">Noch nichts im Tresor.</div>';
      h += '<button type="button" class="addbtn" data-a="additem">' + ic('plus') + 'Ding hinzufügen</button>';
    } else if (st.tab === 'files') {
      h += filesTab();
    } else {
      h += pwArea();
    }
    return { title: 'Tresor', html: h, after: st.tab === 'pw' && st.pwv === 'pw' ? pwListAfter : null };
  };
  function seg() {
    var d = D();
    return '<div class="seg" role="group" aria-label="Inhalt">' + [['items', 'Dinge', d.items.length], ['files', 'Dateien', d.files.length], ['pw', 'Passwörter', d.passwords.length]].map(function (t) {
      return '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + (st.tab === t[0]) + '">' + t[1] + ' <small>' + t[2] + '</small></button>';
    }).join('') + '</div>';
  }
  function itemRow(it) {
    return '<div class="prow" role="button" tabindex="0" data-item="' + esc(it.id) + '"><span class="th" style="--c:' + (it.c || 'var(--accent)') + '">' + esc((it.n || '?')[0]) + '</span>' +
      '<span class="pt"><b>' + esc(it.n) + '</b><small>' + esc((it.place || '') || 'Im Tresor') + '</small></span>' + ic('chev') + '</div>';
  }

  /* --- Passwörter / Notizen / Codes --- */
  function pwArea() {
    var d = D(), codes = d.passwords.filter(function (p) { return p.totp; });
    var h = '<div class="chips" role="group" aria-label="Bereich">' + [['pw', 'Passwörter', d.passwords.length], ['notes', 'Notizen', d.notes.length], ['codes', 'Codes', codes.length]].map(function (c) {
      return '<button type="button" class="chip" data-pwv="' + c[0] + '" aria-pressed="' + (st.pwv === c[0]) + '">' + c[1] + '<small>' + c[2] + '</small></button>';
    }).join('') + '</div>';
    if (st.pwv === 'notes') {
      h += d.notes.length ? d.notes.map(function (n) {
        return '<div class="prow" role="button" tabindex="0" data-nt="' + esc(n.id) + '"><span class="av" style="--c:var(--accent)">' + ic(TPL[n.tpl] ? TPL[n.tpl].ic : 'doc') + '</span><span class="pt"><b>' + esc(n.n) + '</b><small>' + esc(TPL[n.tpl] ? TPL[n.tpl].n : 'Notiz') + '</small></span>' + ic('chev') + '</div>';
      }).join('') : '<div class="empty">Noch keine Notizen.</div>';
      h += '<button type="button" class="addbtn" data-a="newnote">' + ic('plus') + 'Neue Notiz</button>';
    } else if (st.pwv === 'codes') {
      h += '<div class="wbox">' + ic('warn') + '<span>Passwort und Code am selben Ort ist bequem, aber weniger sicher. Für Bank oder E-Mail ist eine eigene Authenticator-App besser.</span></div>';
      h += codes.length ? codes.map(function (p) {
        return '<div class="prow" role="button" tabindex="0" data-copytotp="1" aria-label="Code für ' + esc(p.n) + ' kopieren"><span class="av" style="--c:var(--accent)">' + esc((p.n || '?')[0]) + '</span><span class="pt"><b>' + esc(p.n) + '</b><small>' + esc(p.u || '') + '</small></span><span class="code" data-totp="' + esc(p.totp) + '">··· ···</span><span class="tring" data-ring></span></div>';
      }).join('') : '<div class="empty">Keine Codes. Füg beim Passwort unter „Bearbeiten“ einen Schlüssel hinzu.</div>';
    } else {
      var weak = d.passwords.filter(function (p) { return strength(p.pw) <= 1; }).length, dup = d.passwords.filter(function (p) { return dupsOf(p).length; }).length;
      h += '<div class="pwsum"><div><b>' + d.passwords.length + '</b><small>Passwörter</small></div><div class="bad"><b>' + weak + '</b><small>schwach</small></div><div class="dup"><b>' + dup + '</b><small>doppelt</small></div></div>' +
        '<label class="psearch">' + ic('search') + '<input id="vPq" type="search" placeholder="Passwort suchen" autocomplete="off"></label><div id="vPwl"></div>' +
        '<button type="button" class="addbtn" data-a="newpw">' + ic('plus') + 'Neues Passwort</button>';
    }
    return h;
  }
  function pwListAfter() {
    var el = document.getElementById('vPwl'), inp = document.getElementById('vPq'); if (!el) return;
    var q = (inp ? inp.value : '').trim().toLowerCase();
    var list = D().passwords.filter(function (p) { return !q || ((p.n || '') + ' ' + (p.u || '') + ' ' + (p.url || '')).toLowerCase().indexOf(q) >= 0; });
    el.innerHTML = list.length ? list.map(function (p) {
      var s = strength(p.pw || ''), dp = dupsOf(p).length;
      return '<div class="prow" role="button" tabindex="0" data-pw="' + esc(p.id) + '"><span class="av" style="--c:' + (p.c || 'var(--accent)') + '">' + esc((p.n || '?')[0]) + '</span><span class="pt"><b>' + esc(p.n) + '</b><small>' + esc(p.u || '') + '</small></span>' +
        (s <= 1 ? '<span class="pill bad">schwach</span>' : dp ? '<span class="pill dup">doppelt</span>' : '') + ic('chev') + '</div>';
    }).join('') : '<div class="empty">Kein Passwort gefunden.</div>';
  }
  S.pwDetail = function () {
    var p = byId(D().passwords, st.pwId); if (!p) { st.screen = 'items'; return S.items(); }
    var s = strength(p.pw || ''), dps = dupsOf(p);
    return { title: 'Passwort', html:
      '<div class="pwhead"><span class="av" style="--c:' + (p.c || 'var(--accent)') + '">' + esc((p.n || '?')[0]) + '</span><div><h3>' + esc(p.n) + '</h3><small>' + esc(p.url || 'ohne Website') + '</small></div></div>' +
      (dps.length ? '<div class="wbox">' + ic('warn') + '<span>Dieses Passwort nutzt du auch bei ' + dps.map(function (x) { return esc(x.n); }).join(', ') + '.</span></div>' : '') +
      '<div class="grp"><div class="fr"><span class="fl"><small>Benutzername</small><b>' + esc(p.u || '–') + '</b></span><button type="button" class="ib" data-copy="u" aria-label="Benutzername kopieren">' + ic('copy') + '</button></div>' +
      '<div class="fr"><span class="fl"><small>Passwort</small><b class="mono' + (st.show ? '' : ' mask') + '">' + (st.show ? esc(p.pw) : '•'.repeat(Math.min((p.pw || '').length, 14))) + '</b></span>' +
      '<button type="button" class="ib" data-a="reveal" aria-label="Zeigen">' + ic(st.show ? 'eyeOff' : 'eye') + '</button><button type="button" class="ib" data-copy="pw" aria-label="Passwort kopieren">' + ic('copy') + '</button></div>' +
      (p.totp ? '<div class="fr"><span class="fl"><small>Zwei-Faktor-Code</small><b class="code" data-totp="' + esc(p.totp) + '">··· ···</b></span><span class="tring" data-ring></span><button type="button" class="ib" data-copytotp="1" aria-label="Code kopieren">' + ic('copy') + '</button></div>' : '') +
      '<div class="str"><div class="sl">Stärke<span>' + SLBL[s] + '</span></div><div class="meter" data-s="' + s + '"><i></i><i></i><i></i><i></i></div></div></div>' +
      '<div class="grp">' + (p.url ? '<div class="fr"><span class="fl"><small>Website</small><b>' + esc(p.url) + '</b></span></div>' : '') +
      '<div class="fr"><span class="fl"><small>Notiz</small><b>' + esc(p.note || '–') + '</b></span></div></div>' +
      '<div class="rowbtns"><button type="button" class="abtn" data-a="editpw">Bearbeiten</button><button type="button" class="abtn dang" data-a="delpw">' + (st.delArm ? 'Wirklich löschen?' : 'Löschen') + '</button></div>' +
      '<p class="foot">Zuletzt geändert ' + esc(p.ch || 'gerade eben') + (st.show ? ' · wird nach 30 Sek. wieder verdeckt' : '') + '</p>' };
  };
  S.pwNew = function () {
    var d = st.draft;
    return { title: st.editId ? 'Bearbeiten' : 'Neues Passwort', html:
      '<div class="grp"><div class="fld"><label>Name</label><input data-f="n" value="' + esc(d.n) + '" placeholder="z. B. Instagram" autocomplete="off"></div>' +
      '<div class="fld"><label>Website</label><input data-f="url" value="' + esc(d.url) + '" placeholder="instagram.com" autocomplete="off" autocapitalize="off"></div>' +
      '<div class="fld"><label>Benutzername oder E-Mail</label><input data-f="u" value="' + esc(d.u) + '" autocomplete="off" autocapitalize="off"></div>' +
      '<div class="fld"><label>Passwort</label><div class="pwin"><input data-f="pw" id="vFp" value="' + esc(d.pw) + '" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="ib" data-a="roll" aria-label="Würfeln">' + ic('dice') + '</button></div></div>' +
      '<div class="str"><div class="sl">Stärke<span id="vSl"></span></div><div class="meter" id="vMeter"><i></i><i></i><i></i><i></i></div></div></div>' +
      '<div class="grp gen"><div class="gl"><label>Länge</label><output id="vGlo">' + d.len + '</output></div><input type="range" id="vGlen" min="8" max="40" value="' + d.len + '">' +
      opt('up', 'Großbuchstaben', d.up) + opt('dig', 'Ziffern', d.dig) + opt('sym', 'Sonderzeichen', d.sym) + opt('easy', 'Leicht zu tippen', d.easy, 'ohne 0 und O, 1 und l') + '</div>' +
      '<div class="grp"><div class="fld"><label>Notiz</label><input data-f="note" value="' + esc(d.note) + '" placeholder="optional" autocomplete="off"></div>' +
      '<div class="fld"><label>Zwei-Faktor-Schlüssel (optional)</label><input data-f="totp" value="' + esc(d.totp || '') + '" placeholder="beim Einrichten unter dem QR-Code" autocomplete="off" autocapitalize="characters" spellcheck="false"></div></div>' +
      '<button type="button" class="addbtn" data-a="savepw">Speichern</button>', after: updStrength };
  };
  function opt(id, label, on, sub) {
    return '<div class="opt"><span>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span><button type="button" class="sw" role="switch" data-sw="' + id + '" aria-checked="' + !!on + '" aria-label="' + label + '"></button></div>';
  }
  function updStrength() {
    var d = st.draft; if (!d) return;
    var m = document.getElementById('vMeter'), l = document.getElementById('vSl'); var s = strength(d.pw || '');
    if (m) m.dataset.s = d.pw ? s : '';
    if (l) l.textContent = d.pw ? SLBL[s] : '–';
  }
  S.noteDetail = function () {
    var n = byId(D().notes, st.nid); if (!n) { st.screen = 'items'; return S.items(); }
    var T = TPL[n.tpl] || TPL.text;
    return { title: 'Notiz', html:
      '<div class="pwhead"><span class="av" style="--c:var(--accent)">' + ic(T.ic) + '</span><div><h3>' + esc(n.n) + '</h3><small>' + esc(T.n) + '</small></div></div>' +
      '<div class="grp">' + T.f.map(function (f, i) {
        var v = n.v[i] || ''; if (!v) return '';
        var sec = f[1], shown = !sec || st.nshow[i];
        return '<div class="fr"><span class="fl"><small>' + esc(f[0]) + '</small><b class="' + (sec ? 'mono' : '') + (shown ? '' : ' mask') + '">' + (shown ? esc(v) : '•'.repeat(Math.min(v.length, 12))) + '</b></span>' +
          (sec ? '<button type="button" class="ib" data-nshow="' + i + '" aria-label="Zeigen">' + ic(shown ? 'eyeOff' : 'eye') + '</button>' : '') +
          '<button type="button" class="ib" data-ncopy="' + i + '" aria-label="Kopieren">' + ic('copy') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="rowbtns"><button type="button" class="abtn" data-a="editnote">Bearbeiten</button><button type="button" class="abtn dang" data-a="delnote">' + (st.delArm ? 'Wirklich löschen?' : 'Löschen') + '</button></div>' };
  };
  S.noteNew = function () {
    var d = st.ndraft;
    if (!d.tpl) return { title: 'Neue Notiz', html: '<p class="hint" style="margin:0 4px 12px">Wähle eine Vorlage. Sie gibt die passenden Felder vor.</p><div class="dacts">' + Object.keys(TPL).map(function (k) {
      return '<button type="button" class="dact" data-tpl="' + k + '"><span>' + ic(TPL[k].ic) + '</span>' + TPL[k].n + '</button>'; }).join('') + '</div>' };
    var T = TPL[d.tpl];
    return { title: st.neditId ? 'Bearbeiten' : T.n, html:
      '<div class="grp"><div class="fld"><label>Name</label><input data-nf="name" value="' + esc(d.n) + '" placeholder="z. B. ' + esc(T.n) + '" autocomplete="off"></div>' +
      T.f.map(function (f, i) { return '<div class="fld"><label>' + esc(f[0]) + (f[1] ? ' · wird verdeckt' : '') + '</label><input data-nf="' + i + '" value="' + esc(d.v[i] || '') + '" autocomplete="off" spellcheck="false"></div>'; }).join('') +
      '</div><button type="button" class="addbtn" data-a="savenote">Speichern</button>' };
  };

  /* --- Ding im Tresor --- */
  S.item = function () {
    var it = byId(D().items, st.pwId); if (!it) { st.screen = 'items'; return S.items(); }
    return { title: 'Tresor', html:
      '<div class="dph" style="--c:' + (it.c || 'var(--accent)') + '">' + esc((it.n || '?')[0]) + '<span class="dlock">' + ic('lock') + 'Im Tresor · verschlüsselt</span></div>' +
      '<h2 class="dname">' + esc(it.n) + '</h2>' +
      '<dl class="dmeta"><div><dt>Ort</dt><dd>' + esc(it.place || '–') + '</dd></div>' + (it.note ? '<div><dt>Notiz</dt><dd>' + esc(it.note) + '</dd></div>' : '') + '</dl>' +
      '<div class="rowbtns" style="margin-top:14px"><button type="button" class="abtn" data-a="edititem">Bearbeiten</button><button type="button" class="abtn dang" data-a="delitem">' + (st.delArm ? 'Wirklich löschen?' : 'Löschen') + '</button></div>' };
  };
  S.itemNew = function () {
    var d = st.draft;
    return { title: st.editId ? 'Bearbeiten' : 'Neues Ding', html:
      '<div class="grp"><div class="fld"><label>Name</label><input data-f="n" value="' + esc(d.n) + '" placeholder="z. B. Goldkette" autocomplete="off"></div>' +
      '<div class="fld"><label>Ort</label><input data-f="place" value="' + esc(d.place) + '" placeholder="z. B. Schlafzimmer, Schmuckkästchen" autocomplete="off"></div>' +
      '<div class="fld"><label>Notiz</label><input data-f="note" value="' + esc(d.note) + '" placeholder="optional" autocomplete="off"></div></div>' +
      '<button type="button" class="addbtn" data-a="saveitem">Speichern</button>' };
  };

  /* --- Dateien --- */
  function folders() { return D().folders; }
  function filesTab() {
    var d = D();
    if (st.folder && folders().indexOf(st.folder) < 0) st.folder = null;
    var inF = function (f) { return !st.folder || f.fo === st.folder; };
    var ph = d.files.filter(function (f) { return f.k === 'photo' && inF(f); }), dc = d.files.filter(function (f) { return f.k === 'doc' && inF(f); });
    var tot = d.files.reduce(function (s, f) { return s + (f.size || 0); }, 0);
    var h = '<div class="store">' + ic('phone') + '<span><b>' + fmtSize(tot) + ' verschlüsselt</b> · nur auf diesem iPhone, geht auch ohne Internet</span></div>';
    h += '<div class="chips" role="group" aria-label="Filter">' + [['all', 'Alle', d.files.length], ['photo', 'Fotos', d.files.filter(function (f) { return f.k === 'photo'; }).length], ['doc', 'Dokumente', d.files.filter(function (f) { return f.k === 'doc'; }).length]].map(function (c) {
      return '<button type="button" class="chip" data-ff="' + c[0] + '" aria-pressed="' + (st.ff === c[0]) + '">' + c[1] + '<small>' + c[2] + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="fold" role="group" aria-label="Ordner">' + folders().map(function (n) {
      return '<button type="button" class="fcard" data-fold="' + esc(n) + '" aria-pressed="' + (st.folder === n) + '">' + ic('folder') + '<b>' + esc(n) + '</b><small>' + d.files.filter(function (f) { return f.fo === n; }).length + '</small></button>';
    }).join('') + '<button type="button" class="fcard add" data-a="newfold">' + ic('plus') + '<b>Ordner</b><small>neu</small></button></div>';
    if (st.nfold) h += '<div class="psearch" style="margin-top:8px"><input id="vNfold" placeholder="Name des Ordners" autocomplete="off"><button type="button" class="abtn pri" style="min-height:40px" data-a="savefold">Anlegen</button></div>';
    if (st.ff !== 'doc') h += '<div class="shead"><h3>Fotos</h3><small>' + ph.length + '</small></div>' + (ph.length ? '<div class="pgrid" id="vPgrid">' + ph.map(tile).join('') + '</div>' : '<div class="empty">Noch keine Fotos.</div>');
    if (st.ff !== 'photo') h += '<div class="shead"><h3>Dokumente</h3><small>' + dc.length + '</small></div>' + (dc.length ? '<div id="vDocl">' + dc.map(fileRow).join('') + '</div>' : '<div class="empty">Noch keine Dokumente.</div>');
    h += '<button type="button" class="addbtn" data-a="addfile">' + ic('plus') + 'Hinzufügen</button>';
    return h;
  }
  function tile(f) {
    return '<button type="button" class="ptile" data-file="' + esc(f.id) + '" style="--c1:#3A4A55;--c2:#1E2830" aria-label="' + esc(f.n) + '">' +
      (f.url ? '<img src="' + f.url + '" alt="">' : ic('image')) + '<small>' + esc(f.n) + '</small></button>';
  }
  function fileRow(f) {
    var e = (f.n.indexOf('.') > 0 ? f.n.split('.').pop().toUpperCase().slice(0, 4) : 'DATEI');
    var mini = '<span class="dicon' + (/^DOC/.test(e) ? ' word' : '') + '">' + (f.url ? '<img src="' + f.url + '" alt="">' : '<b>' + esc(e) + '</b>') + '</span>';
    return '<div class="prow" role="button" tabindex="0" data-file="' + esc(f.id) + '">' + mini + '<span class="pt"><b>' + esc(f.n) + '</b><small>' + esc([fmtSize(f.size), f.d].filter(Boolean).join(' · ')) + '</small></span>' + ic('chev') + '</div>';
  }
  S.file = function () {
    var f = byId(D().files, st.fid); if (!f) { st.screen = 'items'; return S.items(); }
    var isImg = f.k === 'photo';
    var media = '<div class="vw-photo">' + (f.url ? '<img src="' + f.url + '" alt="' + esc(f.n) + '">' : ic(isImg ? 'image' : 'doc')) + '</div>';
    var box = '';
    if (st.fmode === 'rename') box = '<div class="grp" style="margin:10px 0"><div class="fld"><label>Name</label><input id="vFren" value="' + esc(f.n) + '" autocomplete="off"></div></div><div class="rowbtns"><button type="button" class="abtn" data-a="fcancel">Abbrechen</button><button type="button" class="abtn pri" data-a="fren2">Sichern</button></div>';
    return { viewer: true, full: true, title: isImg ? 'Foto' : 'Dokument', html:
      '<div class="vw-media">' + media + '</div>' +
      '<div class="vw-meta"><b>' + esc(f.n) + '</b>' + esc([fmtSize(f.size), 'hinzugefügt ' + (f.d || '')].filter(Boolean).join(' · ')) + (f.fo ? '<br>Ordner: ' + esc(f.fo) : '') + '</div>' + box +
      '<div class="vw-acts"><button type="button" data-a="fshare"><span>' + ic('share') + '</span>Teilen</button><button type="button" data-a="fren"><span>' + ic('pencil') + '</span>Umbenennen</button>' +
      '<button type="button" class="dang" data-a="fdel"><span>' + ic('trash') + '</span>' + (st.fdel ? 'Löschen?' : 'Löschen') + '</button></div>' };
  };

  /* --- Einstellungen / Tarn / Protokoll --- */
  S.settings = function () {
    var o = V.opts(), faceAvail = UI._faceAvail;
    return { title: 'Einstellungen', html:
      '<div class="sgt">Zugang</div><div class="grp">' +
      '<button type="button" class="srow" data-a="changecode"><span class="fl"><b>Tresor-Code ändern</b><small>Unabhängig vom App-Code</small></span>' + ic('chev') + '</button>' +
      (faceAvail ? '<div class="srow"><span class="fl"><b>Face ID</b><small>Öffnet den Tresor mit einem Blick</small></span>' + swc('faceOn', o.faceOn) + '</div>' : '') +
      '</div>' +
      (V.isDecoy() ? '' : '<div class="sgt">Schutz</div><div class="grp"><button type="button" class="srow" data-a="tarn"><span class="fl"><b>Tarn-Tresor</b><small>' + (V.hasDecoy() ? 'An · ein zweiter Code öffnet einen harmlosen Tresor' : 'Aus') + '</small></span>' + ic('chev') + '</button></div>') +
      '<div class="sgt">Sicherheit</div><div class="grp">' +
      '<button type="button" class="srow" data-a="renewkey"><span class="fl"><b>Wiederherstellungsschlüssel neu erstellen</b><small>Der alte gilt danach nicht mehr</small></span>' + ic('chev') + '</button>' +
      (V.isDecoy() ? '' : '<button type="button" class="srow" data-a="log"><span class="fl"><b>Einbruch-Protokoll</b><small>' + pl(V.log().length, 'Eintrag', 'Einträge') + '</small></span>' + ic('chev') + '</button>' +
        '<button type="button" class="srow" data-a="emergency"><span class="fl"><b>Notfall-Blatt</b><small>Zum Ausdrucken für Familie oder Partner</small></span>' + ic('chev') + '</button>') + '</div>' +
      '<div class="grp" style="margin-top:16px"><button type="button" class="srow dang" data-a="wipe"><span class="fl"><b>' + (V.isDecoy() ? 'Tarn-Tresor leeren' : 'Tresor löschen') + '</b><small>Löscht alles darin, nach einer Rückfrage</small></span></button></div>' };
  };
  S.tarn = function () {
    var o = V.opts(), has = V.hasDecoy();
    return { title: 'Tarn-Tresor', html:
      '<p class="hint" style="margin:0 4px 12px">Wenn dich jemand drängt, den Tresor zu öffnen, gibst du den Tarn-Code ein. Dann sieht er einen zweiten, harmlosen Tresor. Dein echter Tresor bleibt unsichtbar.</p>' +
      '<div class="grp"><div class="srow"><span class="fl"><b>Tarn-Tresor</b><small>' + (has ? 'Ist eingeschaltet' : 'Ist ausgeschaltet') + '</small></span>' + swc('tarnOn', has) + '</div>' +
      (has ? '<div class="srow col"><div class="top"><span class="fl"><b>Tarn-Tresor öffnet sich</b><small>' + (o.tarnMode === 'any' ? 'Bei jedem Code außer deinem echten.' : 'Nur mit dem Tarn-Code.') + '</small></span></div>' +
        '<div class="mseg" role="group">' + [['code', 'Nur Tarn-Code'], ['any', 'Jeder falsche Code']].map(function (x) { return '<button type="button" data-tm="' + x[0] + '" aria-pressed="' + (o.tarnMode === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
        (UI._faceAvail ? '<div class="srow col"><div class="top"><span class="fl"><b>Face ID öffnet</b><small>' + (o.faceReal ? 'Den echten Tresor.' : 'Den Tarn-Tresor. Für den echten vorher aufs Drehrad tippen oder Face ID gedrückt halten.') + '</small></span></div>' +
        '<div class="mseg" role="group">' + [['tarn', 'Tarn-Tresor'], ['real', 'Echten Tresor']].map(function (x) { return '<button type="button" data-ft="' + x[0] + '" aria-pressed="' + ((x[0] === 'real') === !!o.faceReal) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' : '') +
        '<div class="srow"><span class="fl"><b>Tarn-Modus jetzt</b><small>' + (o.tarnNow ? 'An. Alles öffnet nur den Tarn-Tresor, bis du deinen echten Code eingibst.' : 'Vorher einschalten, z. B. vor einer Kontrolle.') + '</small></span>' + swc('tarnNow', o.tarnNow) + '</div>' : '') + '</div>' +
      (has ? '<div class="sgt">Inhalt</div><div class="grp"><button type="button" class="srow" data-a="editdecoy"><span class="fl"><b>Tarn-Inhalt bearbeiten</b><small>Fotos, Dokumente und Passwörter für den Tarn-Tresor</small></span>' + ic('chev') + '</button></div>' +
        '<p class="hint" style="margin:8px 4px 0">Den Tarn-Code änderst du im Tarn-Tresor selbst: dort öffnen, dann unter Einstellungen „Tresor-Code ändern“.</p>' : '') +
      '<div class="vwarn" style="margin-top:12px">' + ic('face') + '<span><b>Zur Erinnerung:</b> Face ID öffnet, was du oben einstellst. Wenn dich jemand zwingt, tippe auf das Tastenfeld und gib den Tarn-Code ein.</span></div>' };
  };
  S.log = function () {
    var L2 = V.log().slice().reverse();
    V.markLogSeen();
    return { title: 'Protokoll', html:
      '<p class="hint" style="margin:0 4px 12px">Die App merkt sich jeden falschen Code und wann der Tarn-Tresor geöffnet wurde. Im Tarn-Tresor ist das Protokoll nicht zu sehen.</p>' +
      (L2.length ? '<div class="grp">' + L2.map(function (l) {
        return '<div class="fr"><span class="hi ' + (l.bad ? 'bad' : '') + '">' + ic(l.bad ? 'warn' : 'shield') + '</span><span class="fl"><b>' + esc(l.what) + '</b><small>' + esc(logWhen(l.t)) + '</small></span></div>';
      }).join('') + '</div>' : '<div class="empty">Keine Einträge.</div>') +
      '<p class="foot">Fotos von der Person macht die App nicht – das erlaubt das iPhone einer Web-App nicht.</p>' +
      (L2.length ? '<button type="button" class="abtn full" style="margin-top:12px" data-a="clearlog">Protokoll leeren</button>' : '') };
  };
  S.emergency = function () {
    return { title: 'Notfall-Blatt', html:
      '<p class="hint" style="margin:0 4px 12px">Ein Blatt für Familie oder Partner. Es erklärt, wie man mit dem Wiederherstellungsschlüssel an den Tresor kommt, falls dir etwas zustößt.</p>' +
      '<div class="grp" style="padding:16px;background:#FDFDF9;color:#26261F;border:0">' +
      '<div style="font:800 18px/1.1 var(--f-display)">Notfall-Blatt</div><div style="font-size:12px;color:#6A6A60;margin:2px 0 8px">Tresor in der App „Wo ist was“</div>' +
      '<ol style="margin:0;padding-left:18px;display:grid;gap:7px;font-size:13px;line-height:1.5"><li>Mein iPhone entsperren.</li><li>App „Wo ist was“ öffnen, unten auf „Mehr“ und dann auf „Archiv &amp; Tresor“.</li><li>Unten auf „Code vergessen?“ tippen.</li><li>Meinen Wiederherstellungsschlüssel eingeben (liegt an einem sicheren Ort).</li><li>Einen neuen Tresor-Code festlegen.</li></ol></div>' +
      '<div class="vwarn" style="color:var(--warn);background:var(--warn-soft);border-color:transparent">' + ic('warn') + '<span>Wer dieses Blatt und dein entsperrtes iPhone hat, kommt in deinen Tresor. Leg es in einen verschlossenen Umschlag an einen sicheren Ort. Der Tarn-Tresor steht nicht darauf.</span></div>' +
      '<p class="foot">Den Schlüssel selbst findest du unter „Wiederherstellungsschlüssel neu erstellen“.</p>' };
  };

  function swc(id, on) { return '<button type="button" class="sw" role="switch" data-swopt="' + id + '" aria-checked="' + !!on + '"></button>'; }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function dots() { var h = ''; for (var i = 0; i < 6; i++) h += '<i' + (i < st.entry.length ? ' class="on"' : '') + '></i>'; return '<div class="dots" id="vDots">' + h + '</div>'; }
  function keypad(face) {
    return '<div class="kp">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', face ? 'face' : 'blank', '0', 'del'].map(function (k) {
      if (k === 'blank') return '<button type="button" class="blank" tabindex="-1" aria-hidden="true"></button>';
      if (k === 'face') return '<button type="button" class="plain" data-k="face" aria-label="Face ID">' + ic('face') + '</button>';
      if (k === 'del') return '<button type="button" class="plain" data-k="del" aria-label="Löschen">' + ic('del') + '</button>';
      return '<button type="button" data-k="' + k + '">' + k + '</button>';
    }).join('') + '</div>';
  }
  function logWhen(t) {
    var d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    var dd = new Date(d); dd.setHours(0, 0, 0, 0);
    var n = Math.round((today - dd) / 864e5), hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return (n === 0 ? 'Heute' : n === 1 ? 'Gestern' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })) + ', ' + hh;
  }
  function logBanner() {
    if (V.isDecoy()) return '';
    var un = V.log().filter(function (l) { return !l.seen; }); if (!un.length) return '';
    var bad = un.filter(function (l) { return l.bad; }).length, dec = un.filter(function (l) { return /Tarn/.test(l.what); }).length;
    var parts = []; if (bad) parts.push(pl(bad, 'falscher Code', 'falsche Codes')); if (dec) parts.push('Tarn-Tresor geöffnet');
    if (!parts.length) return '';
    return '<button type="button" class="prow" data-a="log" style="background:var(--danger-soft);border-color:transparent"><span class="hi bad">' + ic('warn') + '</span><span class="pt"><b style="white-space:normal">Seit dem letzten Öffnen: ' + esc(parts.join(', ')) + '</b><small>zuletzt ' + esc(logWhen(un[un.length - 1].t)) + '</small></span>' + ic('chev') + '</button>';
  }

  /* ================= Abläufe ================= */
  function faceScan(cb) {
    FID.classList.remove('done'); FID.classList.add('on');
    setTimeout(function () { FID.classList.add('done'); }, 850);
    setTimeout(function () { FID.classList.remove('on'); setTimeout(function () { FID.classList.remove('done'); }, 220); cb(); }, 1300);
  }
  function copy(text, what) {
    try { navigator.clipboard.writeText(text).then(function () { toast(what + ' kopiert'); }, function () { toast(what + ' kopiert'); }); }
    catch (e) { toast(what + ' kopiert'); }
  }
  function openVaultHome(decoyEdit) {
    st.screen = 'items'; st.tab = 'items'; st.pwv = 'pw'; st.ff = 'all'; st.folder = null; hist = [];
    loadFileURLs();
    render();
    if (st.pending && st.pending.importItem && !V.isDecoy()) { var pend = st.pending; st.pending = null; importItem(pend); }
  }
  // Einen Gegenstand aus der App verschlüsselt übernehmen (Fotos aus der App-Datenbank verschlüsseln)
  function importItem(pend) {
    var snap = pend.importItem, id = U.uid('vi');
    var item = { id: id, n: snap.name, place: snap.place || '', note: snap.note || '', c: pickColor() };
    var photos = (snap.photoIds || []), docs = (snap.docs || []);
    var chain = Promise.resolve();
    photos.forEach(function (p, i) {
      chain = chain.then(function () { return DB.getBlob(p.id); }).then(function (blob) {
        if (!blob) return; var fid = U.uid('vf');
        return V.putFile(fid, blob).then(function () { D().files.unshift({ id: fid, k: 'photo', n: snap.name + (photos.length > 1 ? ' ' + (i + 1) : ''), size: blob.size, mime: blob.type, d: 'gerade eben', fo: null, link: id, hasBlob: true }); });
      });
    });
    docs.forEach(function (d) {
      chain = chain.then(function () { return DB.getBlob(d.id); }).then(function (blob) {
        if (!blob) return; var fid = U.uid('vf');
        return V.putFile(fid, blob).then(function () { D().files.unshift({ id: fid, k: 'doc', n: d.name, size: blob.size, mime: blob.type, d: 'gerade eben', fo: null, link: id, hasBlob: true }); });
      });
    });
    chain.then(function () {
      D().items.unshift(item);
      return V.save();
    }).then(function () {
      if (pend.onImported) try { pend.onImported(); } catch (e) {}
      loadFileURLs(); render();
      toast('„' + snap.name + '“ liegt jetzt verschlüsselt im Tresor');
    });
  }
  // Datei-URLs für Vorschaubilder nachladen (entschlüsselt)
  function loadFileURLs() {
    var files = D().files.filter(function (f) { return !f.url && f.hasBlob; });
    files.forEach(function (f) {
      V.getFileURL(f.id, f.mime).then(function (u) { if (u) { f.url = u; if (BOX.classList.contains('on')) render(); } }).catch(function () {});
    });
  }

  function key(k) {
    if (k === 'face') { faceBiometric(false); return; }
    if (k === 'del') st.entry = st.entry.slice(0, -1);
    else if (st.entry.length < 6) st.entry += k; else return;
    var d = document.getElementById('vDots');
    if (d) Array.prototype.forEach.call(d.children, function (el, i) { el.classList.toggle('on', i < st.entry.length); });
    if (st.entry.length === 6) codeDone(st.entry);
  }
  function badCode(msg) {
    var d = document.getElementById('vDots');
    if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
    st.entry = ''; st.codeStep = 1; st.first = '';
    setTimeout(function () { render(); var s = document.getElementById('vsub'); if (s) s.textContent = msg; }, 420);
  }
  function codeDone(code) {
    if (st.screen === 'lock') {
      V.unlock(code).then(function (r) {
        if (r.decoy) V.addLog('Tarn-Tresor mit Tarn-Code geöffnet', false);
        openVaultHome();
      }, function () { V.addLog('Falscher Code', true); badCode('Falscher Code. Versuch es noch einmal.'); });
      return;
    }
    // Code festlegen (setup/change/tarn/reset)
    if (st.codeStep === 1) {
      if (st.codeMode === 'change' && code === '000000' && false) {}
      st.first = code; st.codeStep = 2; st.entry = '';
      setTimeout(render, 140); return;
    }
    if (code !== st.first) { badCode('Die Codes waren verschieden. Bitte neu festlegen.'); return; }
    st.entry = '';
    if (st.codeMode === 'setup') {
      V.setup(code).then(function (rk) { st.recKey = rk; st.recMode = 'show'; st.wrote = false; go('recovery'); });
    } else if (st.codeMode === 'change') {
      V.changeCode(code).then(function () { popTo('settings'); toast('Neuer Tresor-Code gespeichert'); });
    } else if (st.codeMode === 'tarn') {
      var mode = V.opts().tarnMode || 'code';
      V.setupDecoy(code, mode).then(function () { popTo('tarn'); toast('Tarn-Tresor eingerichtet'); });
    } else if (st.codeMode === 'reset') {
      V.changeCode(code).then(function () { openVaultHome(); toast('Neuer Code gespeichert'); });
    }
  }

  function popTo(screen) {
    while (hist.length && st.screen !== screen) st.screen = hist.pop();
    st.screen = screen; render();
  }

  /* Face ID: biometrische Prüfung über W.Lock, dann über den Geräteschlüssel öffnen */
  function faceBiometric(wantReal) {
    faceScan(function () {
      V.faceOpen(wantReal).then(function (r) {
        if (r.decoy) V.addLog('Tarn-Tresor mit Face ID geöffnet', false);
        openVaultHome();
      }, function () { toast('Face ID hat nicht geklappt. Gib deinen Code ein.'); });
    });
  }

  /* ---------- Ereignisse ---------- */
  var longT = null, longFired = false;
  function wire() {
    BACK.addEventListener('click', back);
    GEAR.addEventListener('click', function () { go('settings'); });

    BOX.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-k]'))) { if (t.dataset.k === 'face' && longFired) { longFired = false; return; } key(t.dataset.k); return; }
      if ((t = e.target.closest('[data-tab]'))) { st.tab = t.dataset.tab; render(); return; }
      if ((t = e.target.closest('[data-pwv]'))) { st.pwv = t.dataset.pwv; render(); return; }
      if ((t = e.target.closest('[data-ff]'))) { st.ff = t.dataset.ff; render(); return; }
      if ((t = e.target.closest('[data-fold]'))) { st.folder = st.folder === t.dataset.fold ? null : t.dataset.fold; render(); return; }
      if ((t = e.target.closest('[data-tm]'))) { V.setOpt('tarnMode', t.dataset.tm).then(render); return; }
      if ((t = e.target.closest('[data-ft]'))) { V.setOpt('faceReal', t.dataset.ft === 'real').then(render); return; }
      if ((t = e.target.closest('[data-swopt]'))) { toggleOpt(t.dataset.swopt, t); return; }
      if ((t = e.target.closest('[data-sw]'))) { var on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); if (st.draft) { st.draft[t.dataset.sw] = on; roll(); } return; }
      if ((t = e.target.closest('[data-item]'))) { st.pwId = t.dataset.item; st.delArm = false; go('item'); return; }
      if ((t = e.target.closest('[data-pw]'))) { st.pwId = t.dataset.pw; st.show = false; st.delArm = false; go('pwDetail'); return; }
      if ((t = e.target.closest('[data-nt]'))) { st.nid = t.dataset.nt; st.nshow = {}; st.delArm = false; go('noteDetail'); return; }
      if ((t = e.target.closest('[data-file]'))) { st.fid = t.dataset.file; st.fmode = null; st.fdel = false; go('file'); return; }
      if ((t = e.target.closest('[data-tpl]'))) { st.ndraft.tpl = t.dataset.tpl; st.ndraft.v = []; render(); return; }
      if ((t = e.target.closest('[data-copy]'))) { var p = byId(D().passwords, st.pwId); if (p) copy(t.dataset.copy === 'u' ? p.u : p.pw, t.dataset.copy === 'u' ? 'Benutzername' : 'Passwort'); return; }
      if ((t = e.target.closest('[data-copytotp]'))) { var tr = t.closest('.prow,.fr'), te = tr && tr.querySelector('[data-totp]'); if (te) copy(te.textContent.replace(/\s/g, ''), 'Code'); return; }
      if ((t = e.target.closest('[data-nshow]'))) { st.nshow[t.dataset.nshow] = !st.nshow[t.dataset.nshow]; render(); return; }
      if ((t = e.target.closest('[data-ncopy]'))) { var n = byId(D().notes, st.nid), T = TPL[n.tpl] || TPL.text; copy(n.v[+t.dataset.ncopy] || '', T.f[+t.dataset.ncopy][0]); return; }
      if ((t = e.target.closest('[data-a]'))) act(t.dataset.a, t);
    });
    BOX.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'vPq') pwListAfter();
      else if (t.id === 'vKin') { var raw = C.cleanKey(t.value).slice(0, 24); t.value = C.formatRecoveryKey(raw); st.recInput = t.value; var g = document.getElementById('vKgo'); if (g) g.disabled = raw.length < 24; var ks = document.getElementById('vKsub'); if (ks) ks.textContent = raw.length < 24 ? 'Noch ' + (24 - raw.length) + ' Zeichen' : 'Vollständig'; }
      else if (t.id === 'vGlen') { st.draft.len = +t.value; var o = document.getElementById('vGlo'); if (o) o.textContent = t.value; roll(); }
      else if (t.dataset && t.dataset.f) { st.draft[t.dataset.f] = t.value; if (t.dataset.f === 'pw') updStrength(); }
      else if (t.dataset && t.dataset.nf) { if (t.dataset.nf === 'name') st.ndraft.n = t.value; else st.ndraft.v[+t.dataset.nf] = t.value; }
    });
    BOX.addEventListener('change', function (e) {
      if (e.target.id === 'vWrote') { st.wrote = e.target.checked; var b = document.getElementById('vRecNext'); if (b) b.disabled = !st.wrote; }
    });
    BOX.addEventListener('keydown', function (e) {
      var r = e.target.closest && e.target.closest('.prow[role="button"]');
      if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); }
    });
    // langes Drücken auf Face ID = echter Tresor
    BOX.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('[data-k="face"]')) return;
      longFired = false; clearTimeout(longT);
      longT = setTimeout(function () { longFired = true; faceBiometric(true); }, 550);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { BOX.addEventListener(ev, function () { clearTimeout(longT); }); });
    FILEIN.addEventListener('change', function () { addPickedFiles(FILEIN.files); FILEIN.value = ''; });
  }

  function toggleOpt(id, el) {
    var on = el.getAttribute('aria-checked') !== 'true';
    if (id === 'faceOn') {
      if (on) { faceScan(function () { V.enableFace().then(function () { el.setAttribute('aria-checked', 'true'); toast('Face ID für den Tresor ist an'); }); }); }
      else { V.disableFace().then(function () { render(); toast('Face ID ist aus'); }); }
      return;
    }
    if (id === 'tarnOn') {
      if (on) { st.codeMode = 'tarn'; st.codeStep = 1; st.entry = ''; go('code'); }
      else { V.removeDecoy().then(render).then(function () { toast('Tarn-Tresor ist aus'); }); }
      return;
    }
    if (id === 'tarnNow') { V.setOpt('tarnNow', on).then(render).then(function () { toast(on ? 'Tarn-Modus ist an' : 'Tarn-Modus ist aus'); }); return; }
  }

  function roll() { var d = st.draft; if (!d) return; d.pw = genPw(d); var f = document.getElementById('vFp'); if (f) f.value = d.pw; updStrength(); }

  var revealT = null;
  function act(a, el) {
    switch (a) {
      case 'startcode': st.codeMode = 'setup'; st.codeStep = 1; st.entry = ''; go('code'); break;
      case 'copykey': copy(st.recKey, 'Schlüssel'); break;
      case 'recnext':
        if (st.recMode === 'renew') { popTo('settings'); toast('Neuer Schlüssel gilt ab jetzt'); }
        else go('face');
        break;
      case 'faceyes': if (UI._faceAvail) faceScan(function () { V.enableFace().then(function () { openVaultHome(); toast('Tresor eingerichtet'); }); }); else { openVaultHome(); toast('Tresor eingerichtet'); } break;
      case 'faceno': openVaultHome(); toast('Tresor eingerichtet'); break;
      case 'forgot': st.recInput = ''; go('forgot'); break;
      case 'keyok':
        V.openWithRecovery(st.recInput, false).then(function () { st.codeMode = 'reset'; st.codeStep = 1; st.entry = ''; go('code'); }, function () { toast('Der Schlüssel passt nicht.'); });
        break;
      case 'dialtap': st.armReal = !st.armReal; var dl = el.querySelector('.dial'); if (dl) dl.classList.toggle('armed', st.armReal); break;
      case 'relock': relock(); break;
      case 'settings': go('settings'); break;
      case 'switch': quickSwitch(); break;
      case 'additem': st.editId = null; st.draft = { n: '', place: '', note: '', c: pickColor() }; go('itemNew'); break;
      case 'edititem': var ie = byId(D().items, st.pwId); st.editId = ie.id; st.draft = { n: ie.n, place: ie.place || '', note: ie.note || '', c: ie.c }; go('itemNew'); break;
      case 'saveitem': saveItem(); break;
      case 'delitem': delArmed(function () { var arr = D().items, it = byId(arr, st.pwId); arr.splice(arr.indexOf(it), 1); save(); back(); toast('Gelöscht'); }); break;
      case 'newpw': st.editId = null; st.draft = { n: '', url: '', u: '', pw: '', note: '', totp: '', len: 20, up: true, dig: true, sym: true, easy: false }; st.draft.pw = genPw(st.draft); go('pwNew'); break;
      case 'editpw': var pe = byId(D().passwords, st.pwId); st.editId = pe.id; st.draft = { n: pe.n, url: pe.url || '', u: pe.u || '', pw: pe.pw, note: pe.note || '', totp: pe.totp || '', len: Math.max(8, Math.min(40, (pe.pw || '').length || 20)), up: true, dig: true, sym: true, easy: false }; go('pwNew'); break;
      case 'roll': roll(); break;
      case 'savepw': savePw(); break;
      case 'reveal': st.show = !st.show; render(); clearTimeout(revealT); if (st.show) revealT = setTimeout(function () { if (st.show) { st.show = false; if (st.screen === 'pwDetail') render(); } }, 30000); break;
      case 'delpw': delArmed(function () { var arr = D().passwords, p = byId(arr, st.pwId); arr.splice(arr.indexOf(p), 1); save(); back(); toast('Gelöscht'); }); break;
      case 'newnote': st.neditId = null; st.ndraft = { tpl: null, n: '', v: [] }; go('noteNew'); break;
      case 'editnote': var ne = byId(D().notes, st.nid); st.neditId = ne.id; st.ndraft = { tpl: ne.tpl, n: ne.n, v: ne.v.slice() }; go('noteNew'); break;
      case 'savenote': saveNote(); break;
      case 'delnote': delArmed(function () { var arr = D().notes, n = byId(arr, st.nid); arr.splice(arr.indexOf(n), 1); save(); back(); toast('Gelöscht'); }); break;
      case 'addfile': pickFiles('*/*'); break;
      case 'newfold': st.nfold = !st.nfold; render(); var nf = document.getElementById('vNfold'); if (nf) nf.focus(); break;
      case 'savefold': var v = (document.getElementById('vNfold') || {}).value || ''; v = v.trim(); if (!v) { toast('Gib dem Ordner einen Namen'); break; } if (folders().indexOf(v) < 0) folders().push(v); st.nfold = false; st.folder = v; save(); toast('Ordner „' + v + '“ angelegt'); break;
      case 'fshare': fileShare(); break;
      case 'fren': st.fmode = st.fmode === 'rename' ? null : 'rename'; render(); break;
      case 'fcancel': st.fmode = null; render(); break;
      case 'fren2': var nf2 = (document.getElementById('vFren') || {}).value || ''; var f = byId(D().files, st.fid); if (nf2.trim()) f.n = nf2.trim(); st.fmode = null; save(); toast('Umbenannt'); break;
      case 'fdel': if (!st.fdel) { st.fdel = true; render(); break; } var files = D().files, fx = byId(files, st.fid); V.delFile(fx.id); files.splice(files.indexOf(fx), 1); st.fdel = false; save(); back(); toast('Gelöscht'); break;
      case 'changecode': st.codeMode = 'change'; st.codeStep = 1; st.entry = ''; go('code'); break;
      case 'tarn': go('tarn'); break;
      case 'editdecoy': editDecoy(); break;
      case 'renewkey': V.newRecoveryKey().then(function (rk) { st.recKey = rk; st.recMode = 'renew'; st.wrote = false; go('recovery'); }); break;
      case 'log': go('log'); break;
      case 'emergency': go('emergency'); break;
      case 'clearlog': V.clearLog().then(render).then(function () { toast('Protokoll geleert'); }); break;
      case 'wipe': wipeConfirm(); break;
      case 'vc-no': BOX.querySelector('#vConfirm').classList.remove('on'); confirmCb = null; break;
      case 'vc-yes': BOX.querySelector('#vConfirm').classList.remove('on'); var cb = confirmCb; confirmCb = null; if (cb) cb(); break;
    }
  }

  function delArmed(fn) { if (!st.delArm) { st.delArm = true; render(); } else { st.delArm = false; fn(); } }
  function pickColor() { var c = ['#2F5D50', '#3563A8', '#6E56B8', '#C4611F', '#9A4E7A', '#4F7A5E']; return c[D().items.length % c.length]; }

  function saveItem() {
    var d = st.draft; if (!d.n.trim()) { toast('Gib dem Ding einen Namen'); return; }
    if (st.editId) { var it = byId(D().items, st.editId); it.n = d.n.trim(); it.place = d.place.trim(); it.note = d.note.trim(); }
    else D().items.unshift({ id: U.uid('vi'), n: d.n.trim(), place: d.place.trim(), note: d.note.trim(), c: d.c });
    st.tab = 'items'; save(); back(); toast('Gespeichert und verschlüsselt');
  }
  function savePw() {
    var d = st.draft; if (!d.n.trim() || !d.pw) { toast('Name und Passwort fehlen noch'); return; }
    var totp = (d.totp || '').trim() || null;
    if (st.editId) { var p = byId(D().passwords, st.editId); p.n = d.n.trim(); p.url = d.url.trim(); p.u = d.u.trim(); p.pw = d.pw; p.note = d.note; p.totp = totp; p.ch = 'gerade eben'; }
    else D().passwords.unshift({ id: U.uid('vp'), n: d.n.trim(), url: d.url.trim(), u: d.u.trim() || '–', pw: d.pw, note: d.note, totp: totp, ch: 'gerade eben', c: pickColor() });
    st.tab = 'pw'; st.pwv = 'pw'; st.show = false; save(); back(); toast('Gespeichert und verschlüsselt');
  }
  function saveNote() {
    var d = st.ndraft; if (!d.n.trim()) { toast('Gib der Notiz einen Namen'); return; }
    if (st.neditId) { var n = byId(D().notes, st.neditId); n.n = d.n.trim(); n.v = d.v.slice(); }
    else D().notes.unshift({ id: U.uid('vn'), tpl: d.tpl, n: d.n.trim(), v: d.v.slice() });
    st.tab = 'pw'; st.pwv = 'notes'; save(); back(); toast('Gespeichert und verschlüsselt');
  }

  /* --- Dateien hinzufügen --- */
  function pickFiles(accept) { FILEIN.accept = accept || '*/*'; FILEIN.multiple = true; FILEIN.click(); }
  function addPickedFiles(fileList) {
    var list = Array.prototype.slice.call(fileList || []); if (!list.length) return;
    var today = new Date().toLocaleDateString('de-DE');
    var chain = Promise.resolve(), added = 0;
    list.forEach(function (file, i) {
      var isImg = /^image\//.test(file.type);
      var id = U.uid('vf');
      var meta = { id: id, k: isImg ? 'photo' : 'doc', n: file.name || (isImg ? 'Foto vom ' + today : 'Datei'), size: file.size, mime: file.type, d: 'gerade eben', fo: st.folder || null, hasBlob: true };
      chain = chain.then(function () { return V.putFile(id, file); }).then(function () {
        D().files.unshift(meta); added++;
        return V.getFileURL(id, file.type).then(function (u) { meta.url = u; }).catch(function () {});
      });
    });
    chain.then(function () { return V.save(); }).then(function () { st.tab = 'files'; st.ff = 'all'; render(); toast(pl(added, 'Datei', 'Dateien') + ' verschlüsselt gespeichert'); });
  }
  function fileShare() {
    var f = byId(D().files, st.fid);
    V.getFileURL(f.id, f.mime).then(function (url) {
      // Über das Teilen-Menü: Blob holen und Web Share nutzen, sonst Hinweis
      return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
        var file = new File([blob], f.n, { type: f.mime || 'application/octet-stream' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: f.n });
        toast('Teilen geht auf diesem Gerät nicht direkt.');
      });
    }).catch(function () { toast('Teilen hat nicht geklappt.'); });
  }

  /* --- Tarn --- */
  function editDecoy() {
    // Tarn-Tresor öffnen (ohne den echten zu verlassen? Store hält nur einen offenen). Wir öffnen den Tarn-Tresor.
    V.openDecoyDirect().then(function () { openVaultHome(); toast('Du bearbeitest den Tarn-Tresor'); }, function () {
      toast('Zum Bearbeiten den Tarn-Code eingeben'); st.screen = 'lock'; st.entry = ''; render();
    });
  }
  function quickSwitch() {
    if (!V.hasDecoy()) { toast('Kein Tarn-Tresor eingerichtet'); return; }
    if (!V.isDecoy()) { V.openDecoyDirect().then(function () { openVaultHome(); }, function () { toast('Tarn-Tresor braucht den Tarn-Code'); }); }
    else { faceScan(function () { V.unlock; st.screen = 'lock'; st.entry = ''; render(); }); }
  }
  function relock() {
    V.lock();
    st.screen = V.configured() ? 'lock' : 'intro'; st.entry = ''; hist = []; render();
  }
  function wipeConfirm() {
    var decoy = V.isDecoy();
    confirmSheet(decoy ? 'Tarn-Tresor leeren?' : 'Tresor löschen?', decoy ? 'Alle Inhalte im Tarn-Tresor werden gelöscht.' : 'Alle Dinge, Dateien und Passwörter im Tresor werden gelöscht. Das lässt sich nicht rückgängig machen.', function () {
      V.wipe().then(function () { openVaultHome(); toast(decoy ? 'Tarn-Tresor geleert' : 'Tresor geleert'); });
    });
  }
  var confirmCb = null;
  function confirmSheet(title, text, onYes) {
    confirmCb = onYes;
    var w = BOX.querySelector('#vConfirm');
    w.querySelector('.vc-t').textContent = title;
    w.querySelector('.vc-x').textContent = text;
    w.classList.add('on');
  }

  /* ---------- Öffentliche API ---------- */
  UI._faceAvail = false;
  UI.open = function (opts) {
    if (!V.available()) { toast('Verschlüsselung geht in diesem Browser nicht.'); return; }
    build();
    reset();
    if (opts && opts.importItem) st.pending = { importItem: opts.importItem, onImported: opts.onImported };
    V.lock();
    st.screen = V.configured() ? 'lock' : 'intro';
    document.body.classList.add('vault-open');
    BOX.classList.add('on');
    render();
    if (L.faceAvailable) L.faceAvailable().then(function (v) { UI._faceAvail = !!v; });
  };
  UI.close = function () {
    V.lock();
    if (BOX) BOX.classList.remove('on');
    document.body.classList.remove('vault-open');
  };
  UI.isOpen = function () { return BOX && BOX.classList.contains('on'); };

  // Nach Zeit im Hintergrund wieder sperren
  document.addEventListener('visibilitychange', function () {
    if (!UI.isOpen()) return;
    if (document.visibilityState === 'hidden') { UI._hidAt = Date.now(); return; }
    if (!UI._hidAt || !V.isOpen()) return;
    var mins = +(V.opts().lockAfter || 0);
    if (Date.now() - UI._hidAt >= mins * 60000) { V.lock(); st.screen = 'lock'; st.entry = ''; hist = []; render(); }
  });
})(window.W = window.W || {});
