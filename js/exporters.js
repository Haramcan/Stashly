/* Wo ist was – CSV, Sicherung (ZIP), PDF-Bericht, Etiketten und Kalenderdatei */
(function (W) {
  'use strict';
  var U = W.U, DB = W.DB;
  var X = W.Export = {};

  function M() { return W.M; }

  /* ---------- CSV ---------- */
  function csvCell(v) { v = v == null ? '' : String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function num(n) { return n ? Number(n).toFixed(2).replace('.', ',') : ''; }
  X.csv = function () {
    var m = M();
    var head = ['Name', 'Raum', 'Möbel / Kiste', 'Genauer Ort', 'Kategorie', 'Etiketten', 'Anzahl', 'Wert pro Stück (EUR)', 'Wert gesamt (EUR)',
      'Kaufdatum', 'Garantie bis', 'Seriennummer', 'Haltbar bis', 'Mindestbestand', 'Verliehen an', 'Verliehen seit', 'Aussortieren', 'Preis (EUR)', 'Notizen', 'Fotos'];
    var rows = m.sortedForExport().map(function (it) {
      var r = m.room(m.roomIdOf(it));
      return [it.name, r ? r.name : 'Ohne Raum', m.placePathText(it.placeId), it.spot, it.category, (it.tags || []).join(', '), m.qty(it),
        num(it.value), num(m.val(it)), U.fmtDay(it.bought), U.fmtDay(it.warranty), it.serial, U.fmtDay(it.expiry), it.minQty || '',
        it.lentTo, U.fmtDay(it.lentSince), it.disposition, num(it.price), it.notes, (it.photos || []).length];
    });
    return '\uFEFF' + [head].concat(rows).map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  };

  /* ---------- Sicherung ---------- */
  function referencedBlobs() {
    var ids = [];
    DB.items.forEach(function (it) {
      (it.photos || []).forEach(function (p) { if (p.id) ids.push(p.id); if (p.t) ids.push(p.t); });
      (it.docs || []).forEach(function (d) { if (d.id) ids.push(d.id); });
    });
    return ids;
  }
  X.backup = function (onProgress) {
    return U.loadScript('lib/jszip.min.js').then(function () {
      var zip = new window.JSZip();
      var data = { app: 'wo-ist-was', version: 1, exportedAt: new Date().toISOString(), rooms: DB.rooms, places: DB.places, items: DB.items, blobs: {},
        // Eigene Erinnerungen und was erledigt oder verschoben ist
        meta: { reminders: DB.meta.reminders || [], dueDone: DB.meta.dueDone || {}, dueSnooze: DB.meta.dueSnooze || {} } };
      var ids = referencedBlobs(), i = 0;
      function next() {
        if (i >= ids.length) return Promise.resolve();
        var id = ids[i++];
        if (onProgress) onProgress(i, ids.length);
        return DB.getBlob(id).then(function (b) {
          if (b) { zip.file('blobs/' + id, b); data.blobs[id] = b.type || 'application/octet-stream'; }
          return next();
        });
      }
      return next().then(function () {
        zip.file('data.json', JSON.stringify(data));
        return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' });
      });
    });
  };

  /* Datei lesen: Sicherung (ZIP), eigene data.json oder Export der claude.ai-Version */
  X.readBackup = function (file) {
    var isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    if (isZip) {
      return U.loadScript('lib/jszip.min.js').then(function () { return window.JSZip.loadAsync(file); }).then(function (zip) {
        var f = zip.file('data.json');
        if (!f) throw new Error('In der ZIP-Datei fehlt data.json. Ist das eine Sicherung von „Wo ist was“?');
        return f.async('string').then(function (txt) { return { kind: 'zip', data: JSON.parse(txt), zip: zip }; });
      });
    }
    return file.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (d && Array.isArray(d.gegenstaende)) return { kind: 'legacy', data: d };
      if (d && Array.isArray(d.items)) return { kind: 'json', data: d };
      throw new Error('Diese Datei kenne ich nicht.');
    });
  };
  function arr(a) { return Array.isArray(a) ? a.filter(function (o) { return o && typeof o.id === 'string' && o.id; }) : []; }
  function fromLegacy(d, replacing) {
    // Gleichnamige Räume nicht doppelt anlegen, sondern zuordnen
    var byName = {}, idMap = {};
    if (!replacing) DB.rooms.forEach(function (r) { byName[U.norm(r.name).trim()] = r.id; });
    var maxOrder = replacing ? -1 : DB.rooms.reduce(function (m, r) { return Math.max(m, r.order || 0); }, -1);
    var rooms = [];
    arr(d.raeume).forEach(function (r) {
      var name = String(r.name || 'Raum'), key = U.norm(name).trim();
      if (byName[key]) { idMap[r.id] = byName[key]; return; }
      byName[key] = r.id; idMap[r.id] = r.id;
      rooms.push({ id: r.id, name: name, color: U.safeColor(r.color), order: ++maxOrder, createdAt: r.createdAt || Date.now() });
    });
    var items = arr(d.gegenstaende).map(function (g) {
      return {
        id: g.id, name: String(g.name || 'Gegenstand'), roomId: idMap[g.roomId] || '', placeId: '', spot: g.spot || '', category: g.category || '',
        tags: Array.isArray(g.tags) ? g.tags : [], photos: [], docs: [], qty: g.qty == null ? 1 : g.qty, value: g.value == null ? null : g.value,
        bought: g.bought || '', warranty: g.warranty || '', serial: '', expiry: '', minQty: 0, lentTo: g.lentTo || '', lentSince: g.lentSince || '',
        disposition: '', price: null, notes: g.notes || '', tasks: [], history: [{ t: Date.now(), text: 'Aus der claude.ai-Version übernommen' }],
        createdAt: g.createdAt || Date.now(), updatedAt: Date.now()
      };
    });
    return { rooms: rooms, places: [], items: items };
  }
  /* mode: 'replace' (alles ersetzen) oder 'merge' (hinzufügen/aktualisieren) */
  X.restore = function (parsed, mode, onProgress) {
    var d = parsed.kind === 'legacy' ? fromLegacy(parsed.data, mode === 'replace') : { rooms: arr(parsed.data.rooms), places: arr(parsed.data.places), items: arr(parsed.data.items) };
    var blobTypes = (parsed.data && parsed.data.blobs) || {};
    var start = mode === 'replace' ? DB.clearAll() : Promise.resolve();
    return start.then(function () {
      return DB.write({ rooms: { put: d.rooms }, places: { put: d.places }, items: { put: d.items } });
    }).then(function () {
      if (parsed.kind !== 'zip') return;
      var files = [];
      parsed.zip.folder('blobs').forEach(function (rel, f) { if (!f.dir) files.push({ id: rel, f: f }); });
      var i = 0;
      function next() {
        if (i >= files.length) return Promise.resolve();
        var e = files[i++];
        if (onProgress) onProgress(i, files.length);
        return e.f.async('blob').then(function (b) {
          var typed = new Blob([b], { type: blobTypes[e.id] || 'image/jpeg' });
          return DB.putBlob(e.id, typed);
        }).then(next);
      }
      return next();
    }).then(function () {
      var m = parsed.data && parsed.data.meta;
      if (!m || typeof m !== 'object') return;
      var keep = mode === 'replace' ? { reminders: [], dueDone: {}, dueSnooze: {} } : { reminders: DB.meta.reminders || [], dueDone: DB.meta.dueDone || {}, dueSnooze: DB.meta.dueSnooze || {} };
      var ids = {}; keep.reminders.forEach(function (r) { ids[r.id] = 1; });
      var rems = keep.reminders.concat(arr(m.reminders).filter(function (r) { return !ids[r.id]; }));
      return Promise.all([
        DB.setMeta('reminders', rems),
        DB.setMeta('dueDone', Object.assign({}, keep.dueDone, m.dueDone || {})),
        DB.setMeta('dueSnooze', Object.assign({}, keep.dueSnooze, m.dueSnooze || {}))
      ]);
    }).then(function () {
      return DB.setMeta('seeded', true);
    }).then(function () {
      return { rooms: d.rooms.length, places: d.places.length, items: d.items.length };
    });
  };

  /* ---------- PDF-Hilfen ---------- */
  function pdfText(s) {
    return String(s == null ? '' : s)
      .replace(/€/g, 'EUR').replace(/[–—]/g, '-').replace(/[„“”]/g, '"').replace(/[‚‘’]/g, "'")
      .replace(/›/g, '>').replace(/…/g, '...').replace(/→/g, '->')
      .replace(/[^\x00-\xFF]/g, '?');
  }
  function eur(n) { return pdfText(U.money(n)); }
  function jsPDF() {
    return U.loadScript('lib/jspdf.umd.min.js').then(function () { return window.jspdf.jsPDF; });
  }

  /* ---------- Versicherungsbericht ---------- */
  X.reportPdf = function (onProgress) {
    var m = M();
    return jsPDF().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'mm', format: 'a4' });
      var L = 15, R = 195, y = 20;
      var items = m.sortedForExport();
      var total = items.reduce(function (s, it) { return s + m.val(it); }, 0);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
      doc.text(pdfText('Inventarliste'), L, y); y += 8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
      doc.text(pdfText('Erstellt am ' + new Date().toLocaleDateString('de-DE') + ' mit „Wo ist was“'), L, y); y += 10;
      doc.setTextColor(0); doc.setFontSize(12);
      doc.text(pdfText(U.plural(items.length, 'Gegenstand', 'Gegenstände') + ' · ' + m.pieces(items) + ' Stück'), L, y); y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(pdfText('Gesamtwert: ' + eur(total)), L, y); y += 10;

      // Tabelle pro Raum
      var groups = m.groupByRoom(items);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Raum', L, y); doc.text('Anzahl', 130, y, { align: 'right' }); doc.text('Wert', R, y, { align: 'right' });
      y += 2; doc.setDrawColor(180); doc.line(L, y, R, y); y += 5;
      doc.setFont('helvetica', 'normal');
      groups.forEach(function (g) {
        doc.text(pdfText(g.name), L, y);
        doc.text(String(g.items.length), 130, y, { align: 'right' });
        doc.text(eur(g.value), R, y, { align: 'right' });
        y += 6;
        if (y > 280) { doc.addPage(); y = 20; }
      });

      var photoJobs = [];
      groups.forEach(function (g) {
        g.items.forEach(function (it) { photoJobs.push(it); });
      });
      var cache = {}, done = 0;
      function loadThumb(it) {
        var p = (it.photos || [])[0];
        if (!p) return Promise.resolve(null);
        return DB.getBlob(p.t || p.id).then(function (b) { return b ? U.blobToDataURL(b) : null; }).catch(function () { return null; });
      }
      // Fotos nacheinander laden (spart Speicher auf dem Handy)
      var chain = Promise.resolve();
      photoJobs.forEach(function (it) {
        chain = chain.then(function () { return loadThumb(it); }).then(function (d) { cache[it.id] = d; done++; if (onProgress) onProgress(done, photoJobs.length); });
      });
      return chain.then(function () {
        groups.forEach(function (g) {
          doc.addPage(); y = 20;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
          doc.text(pdfText(g.name), L, y);
          doc.setFontSize(11); doc.text(pdfText(eur(g.value)), R, y, { align: 'right' });
          y += 4; doc.setDrawColor(180); doc.line(L, y, R, y); y += 5;
          g.items.forEach(function (it) {
            var rowH = 28;
            if (y + rowH > 285) { doc.addPage(); y = 20; }
            var img = cache[it.id];
            if (img) {
              try {
                var pr = doc.getImageProperties(img), bw = 24, bh = 24;
                var s = Math.min(bw / pr.width, bh / pr.height), iw = pr.width * s, ih = pr.height * s;
                doc.addImage(img, 'JPEG', L + (bw - iw) / 2, y + (bh - ih) / 2, iw, ih);
              } catch (e) { /* Bild überspringen */ }
            } else {
              doc.setDrawColor(210); doc.rect(L, y, 24, 24);
            }
            var tx = L + 29, tw = 110;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
            doc.text(doc.splitTextToSize(pdfText(it.name), tw)[0], tx, y + 5);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
            var l2 = m.locText(it);
            var l3 = [it.category, 'Anzahl ' + m.qty(it), it.bought ? 'gekauft ' + U.fmtDay(it.bought) : '', it.warranty ? 'Garantie bis ' + U.fmtDay(it.warranty) : ''].filter(Boolean).join(' · ');
            var l4 = it.serial ? 'Seriennr. ' + it.serial : '';
            doc.text(doc.splitTextToSize(pdfText(l2), tw)[0], tx, y + 10);
            doc.text(doc.splitTextToSize(pdfText(l3), tw)[0], tx, y + 15);
            if (l4) doc.text(doc.splitTextToSize(pdfText(l4), tw)[0], tx, y + 20);
            doc.setTextColor(0); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
            doc.text(m.val(it) ? eur(m.val(it)) : '-', R, y + 5, { align: 'right' });
            if (m.qty(it) > 1 && it.value) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
              doc.text(pdfText(m.qty(it) + ' x ' + eur(it.value)), R, y + 10, { align: 'right' });
              doc.setTextColor(0);
            }
            y += rowH;
            doc.setDrawColor(230); doc.line(L, y - 2, R, y - 2);
          });
        });
        var n = doc.getNumberOfPages();
        for (var i = 1; i <= n; i++) {
          doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
          doc.text('Seite ' + i + ' von ' + n, R, 292, { align: 'right' });
        }
        return doc.output('blob');
      });
    });
  };

  /* ---------- Etiketten mit QR-Code (A4, 2 × 5) ---------- */
  X.placeLink = function (id) {
    return location.origin + location.pathname.replace(/index\.html$/, '') + '#/place/' + encodeURIComponent(id);
  };
  X.labelsPdf = function (places) {
    var m = M();
    return Promise.all([jsPDF(), U.loadScript('lib/qrcode.js')]).then(function (r) {
      var JsPDF = r[0];
      var doc = new JsPDF({ unit: 'mm', format: 'a4' });
      var LW = 90, LH = 52, COLS = 2, ROWS = 5, X0 = (210 - COLS * LW) / 2, Y0 = (297 - ROWS * LH) / 2;
      places.forEach(function (p, i) {
        var slot = i % (COLS * ROWS);
        if (i > 0 && slot === 0) doc.addPage();
        var x = X0 + (slot % COLS) * LW, y = Y0 + Math.floor(slot / COLS) * LH;
        doc.setDrawColor(200); doc.setLineWidth(0.2);
        doc.roundedRect(x + 1, y + 1, LW - 2, LH - 2, 3, 3, 'S');
        // QR-Code als Vektorgrafik
        var qr = window.qrcode(0, 'M');
        qr.addData(X.placeLink(p.id));
        qr.make();
        var n = qr.getModuleCount(), qs = 40, cell = qs / n, qx = x + 5, qy = y + (LH - qs) / 2;
        doc.setFillColor(0, 0, 0);
        for (var rr = 0; rr < n; rr++) for (var cc = 0; cc < n; cc++) {
          if (qr.isDark(rr, cc)) doc.rect(qx + cc * cell, qy + rr * cell, cell + 0.02, cell + 0.02, 'F');
        }
        var tx = x + 49, tw = LW - 52;
        var ty = y + 12;
        if (p.code) {
          doc.setFont('courier', 'bold'); doc.setFontSize(24);
          doc.text(pdfText(p.code), tx, ty); ty += 7;
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        var nameLines = doc.splitTextToSize(pdfText(p.name), tw).slice(0, 2);
        doc.text(nameLines, tx, ty); ty += nameLines.length * 4.6 + 1;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80);
        var room = m.room(m.placeRoomId(p));
        doc.text(doc.splitTextToSize(pdfText(room ? room.name : 'Ohne Raum'), tw).slice(0, 1), tx, ty); ty += 4.5;
        doc.setTextColor(0);
        var target = p.moveTarget ? m.room(p.moveTarget) : null;
        if (target) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
          doc.text(doc.splitTextToSize(pdfText('-> ' + target.name), tw).slice(0, 1), tx, Math.min(ty + 3, y + LH - 6));
        }
      });
      return doc.output('blob');
    });
  };

  /* ---------- Kalender (.ics) ---------- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    // Zeilen nach RFC 5545 bei 73 Bytes umbrechen (UTF-8-sicher)
    var out = [], cur = '', bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) { ch += line[++i]; }
      var b = unescape(encodeURIComponent(ch)).length;
      if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function ymd(s) { return s.replace(/-/g, ''); }
  /* Alle kommenden Termine sammeln */
  X.icsEvents = function () {
    var m = M(), ev = [];
    DB.items.forEach(function (it) {
      var where = m.locText(it);
      if (it.expiry && U.daysUntil(it.expiry) >= 0) {
        ev.push({ uid: 'mhd-' + it.id + '-' + it.expiry, date: it.expiry, title: 'Läuft ab: ' + it.name, desc: where, alarms: ['-P1DT15H', 'PT9H'] });
      }
      if (it.warranty && U.daysUntil(it.warranty) >= 0) {
        ev.push({ uid: 'gar-' + it.id + '-' + it.warranty, date: it.warranty, title: 'Garantie endet: ' + it.name, desc: where + (it.serial ? '\nSeriennummer: ' + it.serial : ''), alarms: ['-P13DT15H', 'PT9H'] });
      }
      (it.tasks || []).forEach(function (t) {
        if (t.next && U.daysUntil(t.next) >= 0) {
          ev.push({ uid: 'wart-' + it.id + '-' + t.id + '-' + t.next, date: t.next, title: t.title + ': ' + it.name, desc: where + '\n' + U.everyText(t.every, t.unit), alarms: ['-PT15H', 'PT9H'] });
        }
      });
    });
    ev.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return ev;
  };
  X.icsText = function (events) {
    var now = new Date(), stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wo ist was//Inventar//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Wo ist was'];
    events.forEach(function (e) {
      var d = U.parseDay(e.date), next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@wo-ist-was', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ymd(e.date), 'DTEND;VALUE=DATE:' + ymd(U.dayStr(next)),
        'SUMMARY:' + icsEsc(e.title), 'DESCRIPTION:' + icsEsc(e.desc), 'TRANSP:TRANSPARENT');
      e.alarms.forEach(function (tr) {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:' + tr, 'END:VALARM');
      });
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  };
})(window.W = window.W || {});
