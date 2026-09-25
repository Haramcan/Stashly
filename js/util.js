/* Wo ist was – Hilfsfunktionen */
(function (W) {
  'use strict';
  var U = W.U = {};

  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.uid = function (p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); };
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.norm = function (s) {
    return String(s || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
  };
  U.PALETTE = ['#3E7C6B', '#C27A3E', '#4C72A8', '#9B5A8E', '#AE9127', '#5F8F3C', '#B5514C', '#667580'];
  U.safeColor = function (c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#667580'; };

  /* ---------- Zahlen & Geld ---------- */
  var EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  U.money = function (n) { return EUR.format(Number(n) || 0); };
  U.parseMoney = function (s) {
    s = String(s || '').trim().replace(/[€\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  U.moneyInput = function (n) { return (n == null || n === '') ? '' : String(n).replace('.', ','); };
  U.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  U.fmtBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return (b / 1073741824).toFixed(2).replace('.', ',') + ' GB';
  };

  /* ---------- Datum ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  U.dayStr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  U.today = function () { return U.dayStr(new Date()); };
  U.parseDay = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  U.fmtDay = function (s) {
    var d = U.parseDay(s);
    return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  };
  U.daysUntil = function (s) {
    var d = U.parseDay(s);
    if (!d) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 864e5);
  };
  U.relDays = function (n) {
    if (n === null || n === undefined) return '';
    if (n === 0) return 'heute';
    if (n === 1) return 'morgen';
    if (n === -1) return 'gestern';
    return n > 0 ? 'in ' + n + ' Tagen' : 'seit ' + (-n) + ' Tagen';
  };
  /* Intervall addieren: unit = d | w | m | y */
  U.addInterval = function (s, n, unit) {
    var d = U.parseDay(s) || new Date();
    n = Math.max(1, parseInt(n, 10) || 1);
    if (unit === 'd') d.setDate(d.getDate() + n);
    else if (unit === 'w') d.setDate(d.getDate() + 7 * n);
    else {
      var months = unit === 'y' ? 12 * n : n;
      var day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + months);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
    }
    return U.dayStr(d);
  };
  U.UNIT_LABEL = { d: ['Tag', 'Tage'], w: ['Woche', 'Wochen'], m: ['Monat', 'Monate'], y: ['Jahr', 'Jahre'] };
  U.everyText = function (n, unit) {
    var l = U.UNIT_LABEL[unit] || U.UNIT_LABEL.m;
    n = parseInt(n, 10) || 1;
    if (n === 1) return { d: 'jeden Tag', w: 'jede Woche', m: 'jeden Monat', y: 'jedes Jahr' }[unit] || 'jeden Monat';
    return 'alle ' + n + ' ' + l[1];
  };

  /* ---------- Toast ---------- */
  var toastTimer = null;
  U.toast = function (msg, opts) {
    opts = opts || {};
    var t = U.$('#toast'), b = U.$('#toastBtn');
    U.$('#toastMsg').textContent = msg;
    if (opts.action) {
      b.textContent = opts.action; b.hidden = false;
      b.onclick = function () { t.hidden = true; opts.onAction && opts.onAction(); };
    } else { b.hidden = true; b.onclick = null; }
    t.hidden = false;
    clearTimeout(toastTimer);
    if (opts.ms !== 0) toastTimer = setTimeout(function () { t.hidden = true; }, opts.ms || 2800);
  };

  /* ---------- Plattform ---------- */
  U.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  U.isMobile = U.isIOS || /Android|Mobi/i.test(navigator.userAgent);
  U.isStandalone = function () {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  };

  /* ---------- Skripte nachladen ---------- */
  var scriptCache = {};
  U.loadScript = function (src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { delete scriptCache[src]; rej(new Error('Skript konnte nicht geladen werden: ' + src)); };
      document.head.appendChild(s);
    });
    return scriptCache[src];
  };

  /* ---------- Bilder ---------- */
  U.loadImage = function (blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej({ code: 'unsupported_type' }); };
      img.src = url;
    });
  };
  U.drawScaled = function (img, max) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s = Math.min(1, max / Math.max(w, h));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.drawImage(img, 0, 0, w, h);
    return c;
  };
  U.canvasToJpeg = function (c, q) {
    return new Promise(function (res, rej) {
      c.toBlob(function (b) { c.width = c.height = 0; b ? res(b) : rej({ code: 'encode' }); }, 'image/jpeg', q);
    });
  };
  /* Foto verkleinern: großes Bild (1600 px) + Vorschaubild (480 px) */
  U.processImage = function (file) {
    return U.loadImage(file).then(function (o) {
      return U.canvasToJpeg(U.drawScaled(o.img, 1600), 0.82).then(function (full) {
        return U.canvasToJpeg(U.drawScaled(o.img, 480), 0.76).then(function (thumb) {
          URL.revokeObjectURL(o.url);
          return { full: full, thumb: thumb };
        });
      }, function (e) { URL.revokeObjectURL(o.url); throw e; });
    });
  };
  U.blobToDataURL = function (blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  };

  /* ---------- Dateien weitergeben ---------- */
  U.downloadBlob = function (blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  };
  /* Auf dem Handy über das Teilen-Menü (z. B. „In Dateien sichern“), am PC als Download. */
  U.saveFile = function (blob, filename, title) {
    var file;
    try { file = new File([blob], filename, { type: blob.type || 'application/octet-stream' }); } catch (e) { file = null; }
    if (U.isMobile && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title || filename }).then(function () { return 'shared'; }, function (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        U.downloadBlob(blob, filename);
        return 'downloaded';
      });
    }
    U.downloadBlob(blob, filename);
    return Promise.resolve('downloaded');
  };
  U.copyText = function (text, fallbackEl) {
    function fb() {
      if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); }
      U.toast('Text ist markiert. Jetzt kopieren.');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { U.toast('Kopiert'); }, fb);
      }
    } catch (e) { /* weiter zum Fallback */ }
    fb();
    return Promise.resolve();
  };
})(window.W = window.W || {});
