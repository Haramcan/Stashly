/* Wo ist was – Oberfläche */
(function (W) {
  'use strict';
  var U = W.U, DB = W.DB, X = W.Export, $ = U.$, $$ = U.$$, esc = U.esc;
  var APP_VERSION = '1.1.0';

  var KIND = { moebel: 'Möbel', kiste: 'Kiste', fach: 'Fach', sonst: 'Sonstiges' };
  var KIND_PREFIX = { moebel: 'M', kiste: 'K', fach: 'F', sonst: 'S' };
  var DISP = { verkaufen: 'Verkaufen', verschenken: 'Verschenken', entsorgen: 'Entsorgen' };
  var MOVE_STATUS = { '': 'Offen', gepackt: 'Gepackt', ausgepackt: 'Ausgepackt' };
  var DEFAULT_ROOMS = ['Wohnzimmer', 'Küche', 'Schlafzimmer', 'Badezimmer', 'Arbeitszimmer', 'Flur', 'Keller'];
  var ICON = {
    moebel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16"/></svg>',
    kiste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/></svg>',
    fach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M10 12h4"/></svg>',
    sonst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- Einstellungen im Browser ---------- */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }
  var prefs = lsGet('wiw-prefs') || {};
  function savePrefs() { lsSet('wiw-prefs', prefs); }
  function recogOn() { return prefs.recog !== false; }

  /* =========================================================
   * Modell-Hilfen
   * ========================================================= */
  var M = W.M = {};
  var roomMap = new Map(), placeMap = new Map(), itemMap = new Map(), sortedRooms = [];
  function natural(a, b) { return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' }); }
  function reindex() {
    roomMap = new Map(); placeMap = new Map(); itemMap = new Map();
    DB.rooms.forEach(function (r) { roomMap.set(r.id, r); });
    DB.places.forEach(function (p) { placeMap.set(p.id, p); });
    DB.items.forEach(function (i) { itemMap.set(i.id, i); });
    sortedRooms = DB.rooms.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0) || natural(a.name, b.name); });
  }
  M.rooms = function () { return sortedRooms; };
  M.room = function (id) { return id ? roomMap.get(id) || null : null; };
  M.place = function (id) { return id ? placeMap.get(id) || null : null; };
  M.item = function (id) { return id ? itemMap.get(id) || null : null; };
  M.placeRoomId = function (p) {
    var n = 0;
    while (p && p.parentId && n++ < 40) { var par = placeMap.get(p.parentId); if (!par) break; p = par; }
    var rid = p ? (p.roomId || '') : '';
    return rid && roomMap.has(rid) ? rid : '';
  };
  M.roomIdOf = function (it) {
    if (it.placeId) { var p = placeMap.get(it.placeId); if (p) return M.placeRoomId(p); }
    return (it.roomId && roomMap.has(it.roomId)) ? it.roomId : '';
  };
  M.validPlaceId = function (it) { return it.placeId && placeMap.has(it.placeId) ? it.placeId : ''; };
  M.placePath = function (id) {
    var out = [], p = placeMap.get(id), n = 0;
    while (p && n++ < 40) { out.unshift(p); p = p.parentId ? placeMap.get(p.parentId) : null; }
    return out;
  };
  M.placeLabel = function (p) { return (p.code ? p.code + ' ' : '') + p.name; };
  M.placePathText = function (id) { return id && placeMap.has(id) ? M.placePath(id).map(M.placeLabel).join(' › ') : ''; };
  M.locText = function (it) {
    var r = M.room(M.roomIdOf(it)), s = r ? r.name : 'Ohne Raum';
    var pp = M.placePathText(it.placeId);
    if (pp) s += ' › ' + pp;
    if (it.spot) s += ' · ' + it.spot;
    return s;
  };
  M.shortLoc = function (it) {
    var r = M.room(M.roomIdOf(it)), s = r ? r.name : 'Ohne Raum';
    var p = M.place(it.placeId);
    if (p) s += ' · ' + M.placeLabel(p);
    else if (it.spot) s += ' · ' + it.spot;
    return s;
  };
  M.qty = function (it) { if (it.qty === undefined || it.qty === null || it.qty === '') return 1; var q = parseInt(it.qty, 10); return isNaN(q) || q < 0 ? 1 : q; };
  M.val = function (it) { var v = Number(it.value); return isFinite(v) && v > 0 ? v * M.qty(it) : 0; };
  M.pieces = function (items) { return items.reduce(function (s, it) { return s + M.qty(it); }, 0); };
  M.childPlaces = function (parentId, roomId) {
    return DB.places.filter(function (p) {
      if (parentId) return p.parentId === parentId;
      var root = !p.parentId || !placeMap.has(p.parentId);
      return root && (p.roomId || '') === (roomId || '') && (roomId === '' ? true : roomMap.has(p.roomId));
    }).concat(parentId || roomId !== '' ? [] : DB.places.filter(function (p) {
      // Wurzel-Orte, deren Raum gelöscht wurde, erscheinen unter „Ohne Raum“
      var root = !p.parentId || !placeMap.has(p.parentId);
      return root && p.roomId && !roomMap.has(p.roomId);
    })).sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); });
  };
  M.descendantIds = function (id) {
    var out = new Set([id]), queue = [id], n = 0;
    while (queue.length && n++ < 5000) {
      var cur = queue.shift();
      DB.places.forEach(function (p) { if (p.parentId === cur && !out.has(p.id)) { out.add(p.id); queue.push(p.id); } });
    }
    return out;
  };
  M.itemsInPlace = function (id, deep) {
    var set = deep ? M.descendantIds(id) : new Set([id]);
    return DB.items.filter(function (it) { return it.placeId && set.has(it.placeId); });
  };
  M.itemsInRoom = function (rid) { return DB.items.filter(function (it) { return M.roomIdOf(it) === rid; }); };
  M.placesInRoom = function (rid) { return DB.places.filter(function (p) { return M.placeRoomId(p) === rid || (rid === '' && !roomMap.has(M.placeRoomId(p))); }); };
  M.groupByRoom = function (items) {
    var groups = M.rooms().map(function (r) { return { id: r.id, name: r.name, items: [], value: 0 }; });
    var idx = {}; groups.forEach(function (g, i) { idx[g.id] = i; });
    var none = { id: '', name: 'Ohne Raum', items: [], value: 0 };
    items.forEach(function (it) {
      var rid = M.roomIdOf(it), g = rid && idx[rid] !== undefined ? groups[idx[rid]] : none;
      g.items.push(it); g.value += M.val(it);
    });
    if (none.items.length) groups.push(none);
    return groups.filter(function (g) { return g.items.length; });
  };
  M.sortedForExport = function () {
    var ord = {}; M.rooms().forEach(function (r, i) { ord[r.id] = i; });
    return DB.items.slice().sort(function (a, b) {
      var ra = M.roomIdOf(a), rb = M.roomIdOf(b);
      var x = ra in ord ? ord[ra] : 1e6, y = rb in ord ? ord[rb] : 1e6;
      return x - y || natural(M.placePathText(a.placeId), M.placePathText(b.placeId)) || natural(a.name, b.name);
    });
  };
  M.nextCode = function (kind) {
    var pre = KIND_PREFIX[kind] || 'S', max = 0, re = new RegExp('^' + pre + '(\\d+)$', 'i');
    DB.places.forEach(function (p) { var m = re.exec((p.code || '').trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return pre + (max + 1);
  };
  M.expiryState = function (it) {
    var n = U.daysUntil(it.expiry);
    if (n === null) return '';
    return n < 0 ? 'expired' : n <= 14 ? 'soon' : 'ok';
  };
  M.warrantyState = function (it) {
    var n = U.daysUntil(it.warranty);
    if (n === null) return '';
    return n < 0 ? 'expired' : n <= 60 ? 'soon' : 'ok';
  };
  M.needsBuying = function (it) { var min = parseInt(it.minQty, 10) || 0; return min > 0 && M.qty(it) < min; };
  M.due = function () {
    var r = { expiry: [], tasks: [], warranty: [], shopping: [], lent: [], backup: false, count: 0 };
    DB.items.forEach(function (it) {
      var n = U.daysUntil(it.expiry);
      if (n !== null && n <= 14) r.expiry.push({ it: it, n: n });
      var w = U.daysUntil(it.warranty);
      if (w !== null && w >= 0 && w <= 60) r.warranty.push({ it: it, n: w });
      (it.tasks || []).forEach(function (t) { var d = U.daysUntil(t.next); if (d !== null && d <= 14) r.tasks.push({ it: it, t: t, n: d }); });
      if (M.needsBuying(it)) r.shopping.push({ it: it });
      if (it.lentTo) r.lent.push({ it: it, n: it.lentSince ? -U.daysUntil(it.lentSince) : null });
    });
    var byN = function (a, b) { return a.n - b.n; };
    r.expiry.sort(byN); r.tasks.sort(byN); r.warranty.sort(byN);
    r.lent.sort(function (a, b) { return (b.n || 0) - (a.n || 0); });
    r.shopping.sort(function (a, b) { return natural(a.it.name, b.it.name); });
    var lb = DB.meta.lastBackup;
    r.backup = DB.items.length >= 5 && (!lb || Date.now() - lb > 30 * 864e5);
    r.count = r.expiry.length + r.tasks.length + r.warranty.length + r.shopping.length;
    return r;
  };
  function histPush(it, text) {
    var h = (it.history || []).slice();
    h.push({ t: Date.now(), text: text });
    return h.slice(-50);
  }
  function locationChangeText(before, after) {
    var a = M.locText(before), b = M.locText(after);
    return a !== b ? 'Verschoben: ' + a + ' → ' + b : '';
  }
  function blobIdsOf(it) {
    var ids = [];
    (it.photos || []).forEach(function (p) { ids.push(p.id, p.t); });
    (it.docs || []).forEach(function (d) { ids.push(d.id); });
    return ids.filter(Boolean);
  }

  /* =========================================================
   * Zustand & Navigation
   * ========================================================= */
  var S = { route: 'home', arg: null, q: '', room: prefs.room || 'all', status: 'all', sort: prefs.sort || 'new', selecting: false, selected: new Set(), ready: false };
  var ROUTES = ['home', 'items', 'places', 'room', 'place', 'due', 'more', 'sortout', 'moving'];
  var TOP_ROUTES = ['items', 'places', 'due', 'more'];
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('/');
    var r = parts[0] || 'home';
    if (ROUTES.indexOf(r) < 0) r = 'home';
    S.route = r;
    S.arg = parts[1] ? decodeURIComponent(parts[1]) : null;
  }
  function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); }
  window.addEventListener('hashchange', function () {
    parseHash();
    closeAllSheets();
    setDock(false);
    if (S.route === 'home' && S.q) { S.q = ''; $('#q').value = ''; $('#qClear').hidden = true; }
    if (S.route !== 'items') exitSelect(true);
    render();
    window.scrollTo(0, 0);
  });

  /* =========================================================
   * Rendering
   * ========================================================= */
  var view = $('#view');
  function hydrate(root) {
    $$('img[data-blob]', root).forEach(function (img) {
      var id = img.getAttribute('data-blob');
      img.removeAttribute('data-blob');
      DB.blobURL(id).then(function (u) { if (u) img.src = u; else img.classList.add('broken'); });
    });
  }
  function imgTag(id, alt, lazy) {
    return '<img data-blob="' + esc(id) + '" alt="' + esc(alt || '') + '"' + (lazy ? ' loading="lazy"' : '') + ' decoding="async">';
  }
  function initials(name) { var w = String(name || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }

  var TITLES = { home: 'Wo ist was', items: 'Dinge', places: 'Orte', due: 'Fällig', more: 'Mehr', sortout: 'Aussortieren', moving: 'Umzug' };
  var NAV = [
    { id: 'home', href: '#/', label: 'Start', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>' },
    { id: 'items', href: '#/items', label: 'Dinge', icon: ICON.kiste },
    { id: 'places', href: '#/places', label: 'Orte', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/></svg>' },
    { id: 'due', href: '#/due', label: 'Fällig', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>' },
    { id: 'more', href: '#/more', label: 'Mehr', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>' }
  ];
  function navMeta(id, due) {
    if (id === 'home') return 'Übersicht';
    if (id === 'items') return U.plural(DB.items.length, 'Gegenstand', 'Gegenstände');
    if (id === 'places') {
      var n = DB.places.length;
      return U.plural(M.rooms().length, 'Raum', 'Räume') + (n ? ' · ' + U.plural(n, 'Möbel/Kiste', 'Möbel/Kisten') : '');
    }
    if (id === 'due') return due.count ? due.count + ' fällig' : 'Alles erledigt';
    return 'Sicherung, Berichte, Umzug';
  }
  function badgeText(n) { return n > 99 ? '99+' : String(n); }
  var dockHTML = '';
  function updateChrome() {
    var r = S.route, title = TITLES[r] || 'Wo ist was';
    if (r === 'room') { var rm = S.arg === 'none' ? { name: 'Ohne Raum' } : M.room(S.arg); title = rm ? rm.name : 'Raum'; }
    if (r === 'place') { var p = M.place(S.arg); title = p ? p.name : 'Ort'; }
    $('#viewTitle').textContent = title;
    document.title = r === 'home' ? 'Wo ist was' : title + ' – Wo ist was';
    $('#backBtn').hidden = r === 'home';
    $('#searchWrap').hidden = r !== 'items' && r !== 'home';
    var tab = r === 'room' || r === 'place' ? 'places' : (r === 'sortout' || r === 'moving') ? 'more' : r;
    var fab = $('#fab');
    fab.hidden = S.selecting || ['items', 'places', 'room', 'place'].indexOf(r) < 0;
    document.body.classList.toggle('has-fab', !fab.hidden);
    $('#dock').hidden = S.selecting || r === 'home';
    if (S.selecting) setDock(false);
    $('#selectBar').hidden = !S.selecting;
    var due = M.due();
    // Menü zum Hochziehen
    var html = NAV.map(function (n) {
      var cur = n.id === tab;
      return '<a class="dock-item" href="' + n.href + '" data-tab="' + n.id + '" style="--c:var(--c-' + n.id + ')"' + (cur ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-ic" aria-hidden="true">' + n.icon + '</span><span class="dock-item-txt"><b>' + esc(n.label) + '</b><small>' + esc(navMeta(n.id, due)) + '</small></span>' +
        (n.id === 'due' && due.count ? '<b class="nav-badge">' + badgeText(due.count) + '</b>' : '') +
        (cur ? '<span class="dock-here" aria-hidden="true">' + ICON.check + '</span>' : '') + '</a>';
    }).join('');
    if (html !== dockHTML) { dockHTML = html; $('#dockMenuIn').innerHTML = html; }
    var curNav = NAV.filter(function (n) { return n.id === tab; })[0] || NAV[0];
    $('#dockCur').textContent = curNav.label;
    var ic = $('#dockIc');
    ic.innerHTML = curNav.icon;
    ic.style.setProperty('--c', 'var(--c-' + curNav.id + ')');
    $('#dockDot').hidden = !due.count || tab === 'due';
    updateAppBadge(due.count);
  }

  /* ---------- Menü zum Hochziehen (ersetzt die Tab-Leiste) ---------- */
  var dock = $('#dock'), dockMenu = $('#dockMenu'), dockHandle = $('#dockHandle'), dockScrim = $('#dockScrim');
  var dockOpen = false, dockDrag = null, dockDragged = false;
  function dockMax() { return $('#dockMenuIn').offsetHeight; }
  function setDock(open, animate) {
    dockOpen = open;
    dock.classList.toggle('instant', animate === false);
    dock.classList.toggle('open', open);
    document.body.classList.toggle('dock-open', open);
    dockHandle.setAttribute('aria-expanded', String(open));
    dockMenu.style.height = open ? dockMax() + 'px' : '0px';
    dockMenu.inert = !open;
    dockScrim.style.opacity = '';
  }
  dockHandle.addEventListener('click', function () { setDock(!dockOpen); });
  dockScrim.addEventListener('click', function () { setDock(false); });
  dockMenu.addEventListener('click', function (e) { if (e.target.closest('.dock-item')) setDock(false); });
  // Mitziehen: Menü folgt dem Finger, beim Loslassen rastet es offen oder zu ein
  dock.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    dockDragged = false;
    var max = dockMax();
    dockDrag = { id: e.pointerId, y0: e.clientY, h0: dockOpen ? max : 0, max: max, moved: false, y: e.clientY, t: e.timeStamp, v: 0 };
  });
  dock.addEventListener('pointermove', function (e) {
    var d = dockDrag;
    if (!d || e.pointerId !== d.id) return;
    var dy = d.y0 - e.clientY;
    if (!d.moved) {
      if (Math.abs(dy) < 8) return;
      d.moved = true;
      dock.classList.add('dragging');
      try { dock.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    }
    var h = d.h0 + dy;
    if (h > d.max) h = d.max + (h - d.max) * 0.2;
    if (h < 0) h = 0;
    dockMenu.style.height = h + 'px';
    dockScrim.style.opacity = String(Math.min(1, h / (d.max || 1)));
    document.body.classList.add('dock-open');
    var dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (d.y - e.clientY) / dt;
    d.y = e.clientY; d.t = e.timeStamp;
  });
  function endDockDrag(e) {
    var d = dockDrag;
    if (!d || e.pointerId !== d.id) return;
    dockDrag = null;
    if (!d.moved) return;
    dockDragged = true;
    dock.classList.remove('dragging');
    var h = parseFloat(dockMenu.style.height) || 0;
    setDock(Math.abs(d.v) > 0.3 ? d.v > 0 : h > d.max / 2);
  }
  dock.addEventListener('pointerup', endDockDrag);
  dock.addEventListener('pointercancel', endDockDrag);
  // Nach dem Ziehen keinen Klick auslösen
  dock.addEventListener('click', function (e) { if (dockDragged) { dockDragged = false; e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('resize', function () { if (dockOpen) setDock(true, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dockOpen && !stack.length) setDock(false); });
  dockMenu.inert = true;

  function render() {
    if (!S.ready) return;
    updateChrome();
    var fn = VIEWS[S.route] || VIEWS.items;
    view.innerHTML = fn();
    hydrate(view);
    if (!$('#sheetDetail').hidden && detailId) {
      if (M.item(detailId)) renderDetail(); else closeSheet($('#sheetDetail'));
    }
  }

  /* ---------- Karten ---------- */
  function badgesFor(it) {
    var b = '';
    if (it.lentTo) b += '<span class="pill pill-ok">verliehen</span>';
    var e = M.expiryState(it);
    if (e === 'expired') b += '<span class="pill pill-bad">abgelaufen</span>';
    else if (e === 'soon') b += '<span class="pill pill-warn">läuft bald ab</span>';
    if (M.warrantyState(it) === 'soon') b += '<span class="pill pill-warn">Garantie endet</span>';
    if (M.needsBuying(it)) b += '<span class="pill pill-warn">nachkaufen</span>';
    if (it.disposition && DISP[it.disposition]) b += '<span class="pill pill-neutral">' + esc(DISP[it.disposition].toLowerCase()) + '</span>';
    return b;
  }
  function cardHTML(it) {
    var ph = (it.photos || [])[0], q = M.qty(it), r = M.room(M.roomIdOf(it));
    var img = ph ? imgTag(ph.t || ph.id, '', true) : '<div class="ph-empty" aria-hidden="true">' + esc(initials(it.name)) + '</div>';
    var badges = badgesFor(it);
    var sel = S.selecting && S.selected.has(it.id);
    return '<button class="card' + (sel ? ' is-selected' : '') + '" type="button" data-item="' + esc(it.id) + '"' + (S.selecting ? ' aria-pressed="' + sel + '"' : '') + '>' +
      (S.selecting ? '<span class="check" aria-hidden="true">' + (sel ? ICON.check : '') + '</span>' : '') +
      '<div class="card-photo">' + img + (q !== 1 ? '<span class="qty' + (q === 0 ? ' zero' : '') + '">' + (q === 0 ? 'leer' : '×' + q) + '</span>' : '') + '</div>' +
      '<div class="card-body"><div class="card-name">' + esc(it.name) + '</div>' +
      '<div class="card-where"><span class="dot" style="--c:' + (r ? U.safeColor(r.color) : 'var(--muted)') + '"></span><span class="t">' + esc(M.shortLoc(it)) + '</span></div>' +
      (badges ? '<div class="badges">' + badges + '</div>' : '') + '</div></button>';
  }
  function gridHTML(items) { return '<div class="grid">' + items.map(cardHTML).join('') + '</div>'; }
  function sortItems(list, how) {
    var byName = function (a, b) { return natural(a.name, b.name); };
    if (how === 'name') return list.sort(byName);
    if (how === 'value') return list.sort(function (a, b) { return M.val(b) - M.val(a) || byName(a, b); });
    if (how === 'room') {
      var ord = {}; M.rooms().forEach(function (r, i) { ord[r.id] = i; });
      return list.sort(function (a, b) {
        var x = ord[M.roomIdOf(a)], y = ord[M.roomIdOf(b)];
        x = x === undefined ? 1e6 : x; y = y === undefined ? 1e6 : y;
        return x - y || natural(M.placePathText(a.placeId), M.placePathText(b.placeId)) || byName(a, b);
      });
    }
    if (how === 'expiry') return list.sort(function (a, b) { return (a.expiry || '9999') < (b.expiry || '9999') ? -1 : (a.expiry || '9999') > (b.expiry || '9999') ? 1 : byName(a, b); });
    return list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  /* ---------- Suche ---------- */
  var STATUS_OPTS = [['all', 'Alle'], ['lent', 'Verliehen'], ['expiry', 'Läuft bald ab'], ['warranty', 'Garantie läuft'], ['shopping', 'Einkaufsliste'], ['sortout', 'Aussortieren'], ['nophoto', 'Ohne Foto']];
  function statusMatch(it, key) {
    if (key === 'lent') return !!it.lentTo;
    if (key === 'expiry') { var n = U.daysUntil(it.expiry); return n !== null && n <= 30; }
    if (key === 'warranty') { var w = U.daysUntil(it.warranty); return w !== null && w >= 0; }
    if (key === 'shopping') return M.needsBuying(it);
    if (key === 'sortout') return !!it.disposition;
    if (key === 'nophoto') return !(it.photos || []).length;
    return true;
  }
  function searchItems() {
    var parsed = W.Search.parse(S.q, { rooms: DB.rooms, places: DB.places });
    var placeSet = parsed.placeId ? M.descendantIds(parsed.placeId) : null;
    var base = DB.items.filter(function (it) {
      var rid = M.roomIdOf(it);
      if (S.room === 'none' && rid) return false;
      if (S.room !== 'all' && S.room !== 'none' && rid !== S.room) return false;
      if (S.status !== 'all' && !statusMatch(it, S.status)) return false;
      if (parsed.roomId && rid !== parsed.roomId) return false;
      if (placeSet && !(it.placeId && placeSet.has(it.placeId))) return false;
      for (var i = 0; i < parsed.intents.length; i++) if (!statusMatch(it, parsed.intents[i])) return false;
      return true;
    });
    if (!parsed.tokens.length) return { list: sortItems(base, S.sort), partial: [], parsed: parsed };
    var full = [], partial = [];
    base.forEach(function (it) {
      var hay = W.Search.hayOf(it, M.locText(it));
      var total = 0, hits = 0;
      parsed.tokens.forEach(function (t) { var s = W.Search.scoreToken(hay, t); if (s > 0) { hits++; total += s; } });
      if (hits === parsed.tokens.length) full.push({ it: it, s: total });
      else if (hits > 0) partial.push({ it: it, s: total + hits * 10 });
    });
    var bySc = function (a, b) { return b.s - a.s || natural(a.it.name, b.it.name); };
    full.sort(bySc); partial.sort(bySc);
    return { list: full.map(function (x) { return x.it; }), partial: full.length < 3 ? partial.slice(0, 12).map(function (x) { return x.it; }) : [], parsed: parsed };
  }

  /* =========================================================
   * Ansichten
   * ========================================================= */
  var VIEWS = {};

  function installBanner() {
    if (!U.isIOS || U.isStandalone() || prefs.installDismissed) return '';
    return '<div class="banner warn"><p><strong>Als App installieren</strong>Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Danach läuft „Wo ist was“ offline wie eine App. Wichtig: Einträge in Safari und in der installierten App sind getrennt. Installiere die App deshalb, bevor du loslegst.</p>' +
      '<button class="icon-btn" type="button" data-act="dismiss-install" aria-label="Hinweis ausblenden">' + ICON.close + '</button></div>';
  }
  function storageBanner() {
    return DB.persistent ? '' : '<div class="banner warn"><p><strong>Speichern nicht möglich</strong>Dieser Browser erlaubt keinen Speicher (privates Surfen?). Deine Einträge gehen beim Schließen verloren.</p></div>';
  }

  VIEWS.home = function () {
    var h = installBanner() + storageBanner();
    var due = M.due();
    h += '<div class="home-grid">' + NAV.slice(1).map(function (n) {
      return '<a class="nav-tile" href="' + n.href + '" style="--c:var(--c-' + n.id + ')">' +
        '<span class="nav-ic" aria-hidden="true">' + n.icon + '</span>' +
        (n.id === 'due' && due.count ? '<b class="nav-badge">' + badgeText(due.count) + '</b>' : '') +
        '<span class="nav-tile-txt"><b>' + esc(n.label) + '</b><small>' + esc(navMeta(n.id, due)) + '</small></span></a>';
    }).join('') + '</div>';
    h += '<div class="home-actions">' +
      '<button class="btn btn-primary" type="button" data-act="new"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Neu erfassen</button>' +
      '<button class="btn" type="button" data-act="scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8h3v3H8zM13 13h3v3h-3z"/></svg>Etikett scannen</button></div>';
    var recent = DB.items.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 8);
    if (recent.length) {
      h += '<div class="section-head"><h2>Zuletzt erfasst</h2><a class="linkish" href="#/items">Alle</a></div><div class="recent">' + recent.map(function (it) {
        var ph = (it.photos || [])[0];
        return '<button class="recent-item" type="button" data-item="' + esc(it.id) + '"><span class="recent-photo">' +
          (ph ? imgTag(ph.t || ph.id, '', true) : '<span class="ph-empty" aria-hidden="true">' + esc(initials(it.name)) + '</span>') +
          '</span><span class="recent-name">' + esc(it.name) + '</span></button>';
      }).join('') + '</div>';
    }
    return h;
  };

  VIEWS.items = function () {
    var h = installBanner() + storageBanner();
    var due = M.due();
    if (due.count) {
      h += '<a class="banner attn" href="#/due"><p><strong>' + U.plural(due.count, 'Sache braucht', 'Sachen brauchen') + ' Aufmerksamkeit</strong>Ablaufdaten, Wartung, Garantie oder Einkaufsliste</p>' + ICON.chev + '</a>';
    }
    // Raum-Chips
    var counts = {}, none = 0;
    DB.items.forEach(function (it) { var rid = M.roomIdOf(it); if (rid) counts[rid] = (counts[rid] || 0) + 1; else none++; });
    if (S.room !== 'all' && S.room !== 'none' && !M.room(S.room)) S.room = 'all';
    h += '<div class="chips" role="toolbar" aria-label="Nach Raum filtern"><button class="chip" type="button" data-chip="all" aria-pressed="' + (S.room === 'all') + '">Alle <span class="n">' + DB.items.length + '</span></button>';
    M.rooms().forEach(function (r) {
      h += '<button class="chip" type="button" data-chip="' + esc(r.id) + '" aria-pressed="' + (S.room === r.id) + '"><span class="dot" style="--c:' + U.safeColor(r.color) + '"></span>' + esc(r.name) + ' <span class="n">' + (counts[r.id] || 0) + '</span></button>';
    });
    if (none || S.room === 'none') h += '<button class="chip" type="button" data-chip="none" aria-pressed="' + (S.room === 'none') + '">Ohne Raum <span class="n">' + none + '</span></button>';
    h += '</div>';

    var res = searchItems();
    if (S.q.trim()) {
      var words = res.parsed.tokens.map(function (t) { return t.raw; });
      h += '<div class="interp">' + (words.length ? 'Suche nach <b>' + esc(words.join(' ')) + '</b>' : 'Filter') +
        res.parsed.labels.map(function (l) { return '<span class="pill pill-ok">' + esc(l) + '</span>'; }).join('') + '</div>';
    }
    h += '<div class="toolbar"><span class="count">' + U.plural(res.list.length, 'Gegenstand', 'Gegenstände') + '</span>' +
      '<label for="statusSel" class="sr-only">Filter</label><select class="sel" id="statusSel">' +
      STATUS_OPTS.map(function (o) { return '<option value="' + o[0] + '"' + (S.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<label for="sortSel" class="sr-only">Sortierung</label><select class="sel" id="sortSel">' +
      [['new', 'Neueste zuerst'], ['name', 'Name A–Z'], ['room', 'Nach Ort'], ['value', 'Wert absteigend'], ['expiry', 'Ablaufdatum']].map(function (o) {
        return '<option value="' + o[0] + '"' + (S.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      (DB.items.length ? '<button class="btn small" type="button" data-act="select">Auswählen</button>' : '') + '</div>';

    if (res.list.length) h += gridHTML(res.list);
    if (res.partial.length) h += '<div class="sub-head">Passt teilweise</div>' + gridHTML(res.partial);
    if (!res.list.length && !res.partial.length) {
      if (!DB.items.length) {
        h += '<div class="empty"><h2>Noch nichts erfasst</h2><p>Fotografiere einen Gegenstand und wähle, wo er liegt. Mit „Viele Fotos auf einmal“ erfasst du ein ganzes Regal in einem Rutsch.</p>' +
          '<div class="row-btns"><button class="btn btn-primary" type="button" data-act="add-item">Ersten Gegenstand anlegen</button><button class="btn" type="button" data-act="add-batch">Viele Fotos auf einmal</button></div></div>';
      } else {
        h += '<div class="empty"><h2>Nichts gefunden</h2><p>Kein Gegenstand passt zu Suche und Filter. Probier ein anderes Wort oder setz die Filter zurück.</p><button class="btn" type="button" data-act="reset-filters">Filter zurücksetzen</button></div>';
      }
    }
    return h;
  };

  function mosaicHTML(items, color) {
    var ph = [];
    items.forEach(function (it) { var p = (it.photos || [])[0]; if (p && ph.length < 4) ph.push(p); });
    if (!ph.length) return '<div class="mosaic"><div class="none"><span class="dot" style="--c:' + color + '"></span></div></div>';
    var use = ph.length < 4 ? ph.slice(0, 1) : ph;
    return '<div class="mosaic' + (use.length === 1 ? ' one' : '') + '">' + use.map(function (p) { return imgTag(p.t || p.id, '', true); }).join('') + '</div>';
  }
  function placeRowHTML(p) {
    var deep = M.itemsInPlace(p.id, true).length, subs = DB.places.filter(function (x) { return x.parentId === p.id; }).length;
    var meta = [KIND[p.kind] || 'Ort', U.plural(deep, 'Ding', 'Dinge')];
    if (subs) meta.push(U.plural(subs, 'Unterbereich', 'Unterbereiche'));
    if (p.moveStatus) meta.push(MOVE_STATUS[p.moveStatus]);
    return '<a class="row" href="#/place/' + encodeURIComponent(p.id) + '"><span class="kind-ic">' + (ICON[p.kind] || ICON.sonst) + '</span>' +
      '<span class="row-txt"><span class="row-name">' + (p.code ? '<span class="code">' + esc(p.code) + '</span>' : '') + esc(p.name) + '</span>' +
      '<span class="row-meta">' + esc(meta.join(' · ')) + '</span></span>' + ICON.chev + '</a>';
  }

  VIEWS.places = function () {
    var h = storageBanner();
    var packed = DB.places.filter(function (p) { return p.moveStatus === 'gepackt'; }).length;
    if (packed) h += '<a class="banner attn" href="#/moving"><p><strong>Umzug läuft</strong>' + U.plural(packed, 'Kiste ist', 'Kisten sind') + ' gepackt und noch nicht ausgepackt.</p>' + ICON.chev + '</a>';
    h += '<div class="section-head"><h2>Räume</h2><div class="row-btns"><button class="btn small" type="button" data-act="add-place">Möbel oder Kiste</button><button class="btn small" type="button" data-act="add-room">Raum hinzufügen</button></div></div>';
    h += '<div class="rooms">';
    M.rooms().forEach(function (r) {
      var items = M.itemsInRoom(r.id), places = M.placesInRoom(r.id).length;
      var v = items.reduce(function (s, it) { return s + M.val(it); }, 0);
      var meta = [U.plural(items.length, 'Ding', 'Dinge')];
      if (places) meta.push(U.plural(places, 'Möbel/Kiste', 'Möbel/Kisten'));
      if (v) meta.push(U.money(v));
      h += '<a class="row" href="#/room/' + encodeURIComponent(r.id) + '">' + mosaicHTML(items, U.safeColor(r.color)) +
        '<span class="row-txt"><span class="row-name"><span class="dot" style="--c:' + U.safeColor(r.color) + '"></span>' + esc(r.name) + '</span><span class="row-meta">' + esc(meta.join(' · ')) + '</span></span>' + ICON.chev + '</a>';
    });
    var noneItems = M.itemsInRoom(''), nonePlaces = M.placesInRoom('').length;
    if (noneItems.length || nonePlaces) {
      h += '<a class="row" href="#/room/none">' + mosaicHTML(noneItems, 'var(--muted)') + '<span class="row-txt"><span class="row-name">Ohne Raum</span><span class="row-meta">' +
        esc(U.plural(noneItems.length, 'Ding', 'Dinge') + (nonePlaces ? ' · ' + U.plural(nonePlaces, 'Möbel/Kiste', 'Möbel/Kisten') : '')) + '</span></span>' + ICON.chev + '</a>';
    }
    h += '</div>';
    if (!DB.rooms.length && !noneItems.length) h += '<div class="empty"><h2>Noch keine Räume</h2><p>Lege Räume an, zum Beispiel Küche, Keller oder Garage. Auch Auto oder Gartenhaus gehen.</p></div>';
    return h;
  };

  VIEWS.room = function () {
    var isNone = S.arg === 'none', r = isNone ? null : M.room(S.arg);
    if (!isNone && !r) return '<div class="empty"><h2>Raum nicht gefunden</h2><p>Der Raum wurde gelöscht.</p><a class="btn" href="#/places">Zu den Orten</a></div>';
    var rid = isNone ? '' : r.id;
    var items = M.itemsInRoom(rid), roots = M.childPlaces(null, rid);
    var direct = items.filter(function (it) { return !M.validPlaceId(it); });
    var v = items.reduce(function (s, it) { return s + M.val(it); }, 0);
    var h = '<div class="place-head"><h2>' + (r ? '<span class="dot" style="--c:' + U.safeColor(r.color) + ';width:14px;height:14px"></span>' : '') + esc(r ? r.name : 'Ohne Raum') + '</h2>' +
      '<p>' + esc(U.plural(items.length, 'Ding', 'Dinge') + (v ? ' · ' + U.money(v) : '')) + '</p></div>';
    var ra = ' data-room="' + esc(rid) + '"';
    h += '<div class="actions"><button class="btn small btn-primary" type="button" data-act="add-item"' + ra + '>Gegenstand</button>' +
      '<button class="btn small" type="button" data-act="add-batch"' + ra + '>Viele Fotos</button>' +
      '<button class="btn small" type="button" data-act="add-place"' + ra + '>Möbel oder Kiste</button>' +
      (r ? '<button class="btn small" type="button" data-act="edit-room" data-id="' + esc(r.id) + '">Raum bearbeiten</button>' : '') + '</div>';
    h += '<div class="sub-head">Möbel &amp; Kisten</div>';
    h += roots.length ? '<div class="list">' + roots.map(placeRowHTML).join('') + '</div>' : '<p class="lead">Noch keine. Lege zum Beispiel „Regal links“ oder „Kiste Weihnachten“ an, dann findest du Dinge schneller.</p>';
    h += '<div class="sub-head">Direkt im Raum</div>';
    h += direct.length ? gridHTML(sortItems(direct, 'name')) : '<p class="lead">Nichts, das keinem Möbel und keiner Kiste zugeordnet ist.</p>';
    return h;
  };

  VIEWS.place = function () {
    var p = M.place(S.arg);
    if (!p) {
      var hint = U.isIOS && !U.isStandalone()
        ? 'Diese Kiste ist in deiner installierten App gespeichert. Öffne „Wo ist was“ vom Home-Bildschirm und tippe oben rechts auf das Scan-Symbol.'
        : 'Diesen Ort gibt es hier nicht (mehr). Vielleicht wurde er gelöscht oder auf einem anderen Gerät angelegt.';
      return '<div class="empty"><h2>Ort nicht gefunden</h2><p>' + esc(hint) + '</p><a class="btn" href="#/places">Zu den Orten</a></div>';
    }
    var path = M.placePath(p.id), rid = M.placeRoomId(p), r = M.room(rid);
    var h = '<nav class="crumbs" aria-label="Pfad"><a href="#/room/' + encodeURIComponent(r ? r.id : 'none') + '">' + esc(r ? r.name : 'Ohne Raum') + '</a>';
    path.slice(0, -1).forEach(function (a) { h += '<span aria-hidden="true">›</span><a href="#/place/' + encodeURIComponent(a.id) + '">' + esc(M.placeLabel(a)) + '</a>'; });
    h += '</nav>';
    h += '<div class="place-head"><h2>' + (p.code ? '<span class="dymo">' + esc(p.code) + '</span>' : '') + esc(p.name) + '</h2>';
    var sub = [KIND[p.kind] || 'Ort'];
    if (p.moveStatus || p.moveTarget) {
      var t = M.room(p.moveTarget);
      sub.push('Umzug: ' + MOVE_STATUS[p.moveStatus || ''] + (t ? ' → ' + t.name : ''));
    }
    h += '<p>' + esc(sub.join(' · ')) + '</p>' + (p.note ? '<p>' + esc(p.note) + '</p>' : '') + '</div>';
    var pa = ' data-room="' + esc(rid) + '" data-place="' + esc(p.id) + '"';
    h += '<div class="actions"><button class="btn small btn-primary" type="button" data-act="add-item"' + pa + '>Gegenstand hier</button>' +
      '<button class="btn small" type="button" data-act="add-batch"' + pa + '>Viele Fotos</button>' +
      '<button class="btn small" type="button" data-act="add-place"' + pa + '>Fach oder Kiste darin</button>' +
      '<button class="btn small" type="button" data-act="label-place" data-id="' + esc(p.id) + '">QR-Etikett</button>' +
      '<button class="btn small" type="button" data-act="edit-place" data-id="' + esc(p.id) + '">Bearbeiten</button></div>';
    var subs = M.childPlaces(p.id, rid);
    if (subs.length) h += '<div class="sub-head">Darin</div><div class="list">' + subs.map(placeRowHTML).join('') + '</div>';
    var items = M.itemsInPlace(p.id, false);
    h += '<div class="sub-head">Inhalt</div>';
    h += items.length ? gridHTML(sortItems(items, 'name')) : '<p class="lead">Noch leer. Tippe auf „Gegenstand hier“ oder „Viele Fotos“, um den Inhalt zu erfassen.</p>';
    return h;
  };

  function itemLine(it, right, rightClass, extra) {
    return '<li><button class="main" type="button" data-item="' + esc(it.id) + '">' + esc(it.name) + '<small>' + esc(extra || M.shortLoc(it)) + '</small></button>' +
      (right ? '<span class="r ' + (rightClass || '') + '">' + right + '</span>' : '') + '</li>';
  }
  VIEWS.due = function () {
    var d = M.due(), h = '';
    var none = !d.count && !d.lent.length && !d.backup;
    if (none) h += '<div class="empty"><h2>Alles erledigt</h2><p>Hier erscheinen Ablaufdaten, Wartungen, auslaufende Garantien, die Einkaufsliste und verliehene Sachen, sobald du sie bei Gegenständen einträgst.</p></div>';
    h += '<div class="panels" style="margin-top:' + (none ? '14px' : '0') + '">';
    if (d.backup) {
      var lb = DB.meta.lastBackup;
      h += '<section class="panel warn"><h3>Sicherung empfohlen</h3><p>' + (lb ? 'Letzte Sicherung vor ' + Math.floor((Date.now() - lb) / 864e5) + ' Tagen.' : 'Du hast noch keine Sicherung gemacht.') +
        ' Deine Daten liegen nur auf diesem Gerät. Eine Sicherung schützt vor Verlust, falls das iPhone kaputtgeht.</p><div class="row-btns"><button class="btn small btn-primary" type="button" data-act="backup">Jetzt sichern</button></div></section>';
    }
    if (d.expiry.length) {
      h += '<section class="panel"><h3>Läuft ab</h3><ul class="mini-list">' + d.expiry.map(function (x) {
        return itemLine(x.it, esc(U.fmtDay(x.it.expiry)) + '<br>' + esc(U.relDays(x.n)), x.n < 0 ? 'bad' : 'warn');
      }).join('') + '</ul></section>';
    }
    if (d.tasks.length) {
      h += '<section class="panel"><h3>Wartung</h3><ul class="mini-list">' + d.tasks.map(function (x) {
        return '<li><button class="main" type="button" data-item="' + esc(x.it.id) + '">' + esc(x.t.title) + '<small>' + esc(x.it.name + ' · ' + (x.n < 0 ? 'überfällig ' + U.relDays(x.n) : U.relDays(x.n))) + '</small></button>' +
          '<button class="btn small" type="button" data-task-done="' + esc(x.it.id) + '" data-task="' + esc(x.t.id) + '">Erledigt</button></li>';
      }).join('') + '</ul></section>';
    }
    if (d.shopping.length) {
      h += '<section class="panel"><h3>Einkaufsliste <button class="btn small" type="button" data-act="share-shopping">Liste teilen</button></h3><ul class="mini-list">' + d.shopping.map(function (x) {
        return '<li><button class="main" type="button" data-item="' + esc(x.it.id) + '">' + esc(x.it.name) + '<small>mindestens ' + esc(x.it.minQty) + ' · ' + esc(M.shortLoc(x.it)) + '</small></button>' +
          '<span class="stepper"><button type="button" data-qty="-1" data-id="' + esc(x.it.id) + '" aria-label="Eins weniger">−</button><output>' + M.qty(x.it) + '</output><button type="button" data-qty="1" data-id="' + esc(x.it.id) + '" aria-label="Eins mehr">+</button></span></li>';
      }).join('') + '</ul><p>Tippe auf +, wenn du nachgekauft hast. Sobald der Mindestbestand erreicht ist, verschwindet der Eintrag.</p></section>';
    }
    if (d.warranty.length) {
      h += '<section class="panel"><h3>Garantie endet</h3><ul class="mini-list">' + d.warranty.map(function (x) {
        return itemLine(x.it, esc(U.fmtDay(x.it.warranty)) + '<br>' + esc(U.relDays(x.n)), x.n <= 14 ? 'warn' : '');
      }).join('') + '</ul></section>';
    }
    if (d.lent.length) {
      h += '<section class="panel"><h3>Verliehen</h3><ul class="mini-list">' + d.lent.map(function (x) {
        return itemLine(x.it, x.n !== null ? esc(x.n === 0 ? 'seit heute' : 'seit ' + U.plural(x.n, 'Tag', 'Tagen')) : '', x.n > 30 ? 'warn' : '', 'an ' + x.it.lentTo);
      }).join('') + '</ul></section>';
    }
    // Kalender
    var ev = X.icsEvents(), doneSet = DB.meta.icsDone || [];
    var fresh = ev.filter(function (e) { return doneSet.indexOf(e.uid) < 0; }).length;
    h += '<section class="panel"><h3>Erinnerungen im iPhone-Kalender</h3>' +
      '<p>Ablaufdaten, Garantien und Wartungen kommen als Termine mit Erinnerung in deinen Kalender. Dein iPhone meldet sich dann von selbst, auch ohne Internet und ohne dass du die App öffnest.</p>' +
      '<p>' + (ev.length ? U.plural(ev.length, 'Termin', 'Termine') + ' insgesamt, davon <b>' + fresh + ' neu</b> seit dem letzten Export.' : 'Noch keine Termine. Trag bei Gegenständen „Haltbar bis“, „Garantie bis“ oder eine Wartung ein.') + '</p>' +
      '<div class="row-btns"><button class="btn small btn-primary" type="button" data-act="cal-new"' + (fresh ? '' : ' disabled') + '>' + (fresh ? U.plural(fresh, 'neuen Termin', 'neue Termine') + ' übernehmen' : 'Keine neuen Termine') + '</button>' +
      (ev.length ? '<button class="btn small" type="button" data-act="cal-all">Alle exportieren</button>' : '') + '</div>' +
      '<details class="plain"><summary>So geht’s auf dem iPhone</summary><ol class="hist" style="margin-top:8px">' +
      '<li>Tippe auf „Termine übernehmen“ und wähle im Teilen-Menü „In Dateien sichern“.</li>' +
      '<li>Öffne die Datei in der Dateien-App und tippe auf „Alle hinzufügen“. Wähle dabei am besten einen eigenen Kalender „Wo ist was“.</li>' +
      '<li>Kommt keine Erinnerung? Stell unter Einstellungen › Apps › Kalender › Standard-Erinnerungen bei „Ganztägige Ereignisse“ eine Zeit ein, z. B. „Am Tag des Ereignisses (9:00)“.</li>' +
      '</ol></details></section>';
    // App-Symbol-Zahl
    var badgeSupported = 'setAppBadge' in navigator && 'Notification' in window;
    if (badgeSupported) {
      var granted = Notification.permission === 'granted';
      h += '<section class="panel"><h3>Zahl am App-Symbol</h3><p>' + (granted ? 'Aktiv: Am App-Symbol siehst du, wie viele Sachen fällig sind. Die Zahl wird aktualisiert, wenn du die App öffnest.' : 'Zeigt am App-Symbol, wie viele Sachen fällig sind. Dafür fragt dein iPhone einmal nach der Erlaubnis für Mitteilungen.') + '</p>' +
        (granted ? '' : '<div class="row-btns"><button class="btn small" type="button" data-act="badge">Zahl am App-Symbol aktivieren</button></div>') + '</section>';
    } else if (U.isIOS && !U.isStandalone()) {
      h += '<section class="panel"><h3>Zahl am App-Symbol</h3><p>Geht nur in der installierten App (Teilen › Zum Home-Bildschirm).</p></section>';
    }
    h += '</div>';
    return h;
  };

  VIEWS.more = function () {
    var items = DB.items, total = items.reduce(function (s, it) { return s + M.val(it); }, 0);
    var photos = items.reduce(function (s, it) { return s + (it.photos || []).length; }, 0);
    var h = '<div class="tiles">' +
      '<div class="tile"><span class="k">Gegenstände</span><span class="v">' + items.length + '</span></div>' +
      '<div class="tile"><span class="k">Stück gesamt</span><span class="v">' + M.pieces(items) + '</span></div>' +
      '<div class="tile"><span class="k">Gesamtwert</span><span class="v">' + U.money(total) + '</span></div>' +
      '<div class="tile"><span class="k">Fotos</span><span class="v">' + photos + '</span></div></div>';
    h += '<div class="panels">';
    var groups = M.groupByRoom(items).filter(function (g) { return g.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    var maxV = groups.length ? groups[0].value : 0;
    h += '<section class="panel"><h3>Wert pro Raum</h3>' + (maxV ? '<div class="bars">' + groups.map(function (g) {
      var r = M.room(g.id), c = r ? U.safeColor(r.color) : 'var(--muted)';
      return '<div class="bar-row"><span class="lbl"><span class="dot" style="--c:' + c + '"></span>' + esc(g.name) + '</span><span class="num">' + U.money(g.value) + '</span><div class="bar"><span style="width:' + (g.value / maxV * 100).toFixed(1) + '%;--c:' + c + '"></span></div></div>';
    }).join('') + '</div>' : '<p>Trag bei Gegenständen einen Wert ein, dann siehst du hier die Summen pro Raum.</p>') + '</section>';
    var cats = {};
    items.forEach(function (it) { var c = (it.category || '').trim() || 'Ohne Kategorie'; cats[c] = (cats[c] || 0) + 1; });
    var catRows = Object.keys(cats).map(function (k) { return { k: k, n: cats[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    h += '<section class="panel"><h3>Kategorien</h3>' + (catRows.length ? '<div class="bars">' + catRows.map(function (r) {
      return '<div class="bar-row"><span class="lbl">' + esc(r.k) + '</span><span class="num">' + r.n + '</span><div class="bar"><span style="width:' + (r.n / catRows[0].n * 100).toFixed(1) + '%"></span></div></div>';
    }).join('') + '</div>' : '<p>Noch keine Gegenstände.</p>') + '</section></div>';

    var so = items.filter(function (it) { return it.disposition; });
    var soValue = so.reduce(function (s, it) { return s + (it.disposition === 'verkaufen' ? (Number(it.price) || 0) : 0); }, 0);
    var boxes = DB.places.filter(function (p) { return p.kind === 'kiste'; });
    var unpacked = boxes.filter(function (p) { return p.moveStatus === 'ausgepackt'; }).length;
    function row(act, title, meta, href) {
      var inner = '<span class="row-txt"><span class="row-name">' + esc(title) + '</span><span class="row-meta">' + esc(meta) + '</span></span>' + ICON.chev;
      return href ? '<a class="row" href="' + href + '">' + inner + '</a>' : '<button class="row" type="button" data-act="' + act + '">' + inner + '</button>';
    }
    h += '<div class="sub-head">Werkzeuge</div><div class="menu-list">' +
      row('', 'Aussortieren', so.length ? U.plural(so.length, 'Sache', 'Sachen') + (soValue ? ' · ' + U.money(soValue) + ' möglicher Erlös' : '') : 'Dinge zum Verkaufen, Verschenken oder Entsorgen sammeln', '#/sortout') +
      row('', 'Umzug', boxes.length ? U.plural(boxes.length, 'Kiste', 'Kisten') + ' · ' + unpacked + ' ausgepackt' : 'Kisten nummerieren, Zielraum festlegen, abhaken', '#/moving') +
      row('labels', 'QR-Etiketten drucken', 'PDF mit Etiketten für Kisten und Möbel, zum Ausdrucken und Aufkleben') +
      row('report', 'Bericht für die Versicherung', 'PDF mit Fotos, Werten und Kaufdaten, sortiert nach Raum') +
      row('csv', 'Tabelle exportieren', 'CSV-Datei für Excel oder Numbers') +
      '</div>';
    var lb = DB.meta.lastBackup;
    h += '<div class="sub-head">Sicherung</div><div class="menu-list">' +
      row('backup', 'Sicherung erstellen', 'ZIP-Datei mit allen Einträgen und Fotos. ' + (lb ? 'Letzte: ' + new Date(lb).toLocaleDateString('de-DE') : 'Noch nie gesichert')) +
      row('restore', 'Sicherung einspielen', 'Aus einer ZIP-Sicherung oder dem JSON-Export der claude.ai-Version') +
      '</div>';
    h += '<div class="sub-head">Einstellungen</div><div class="menu-list">' +
      row('recog', 'Bilderkennung: ' + (recogOn() ? 'an' : 'aus'), 'Schlägt beim Fotografieren einen Namen vor. Läuft komplett auf dem Gerät, ohne Internet.') +
      row('storage', 'Speicher', DB.persistent ? 'Alle Daten liegen nur auf diesem Gerät. Tippen für Details.' : 'Speichern ist in diesem Browser nicht möglich.') +
      '</div>';
    h += '<p class="meta-line" style="margin-top:18px">Wo ist was · Version ' + APP_VERSION + (U.isStandalone() ? ' · installiert' : '') + '</p>';
    return h;
  };

  VIEWS.sortout = function () {
    var groups = ['verkaufen', 'verschenken', 'entsorgen'].map(function (k) {
      return { k: k, items: DB.items.filter(function (it) { return it.disposition === k; }).sort(function (a, b) { return natural(a.name, b.name); }) };
    });
    var any = groups.some(function (g) { return g.items.length; });
    var h = '<p class="lead" style="margin-bottom:14px">Markiere Dinge beim Bearbeiten unter „Aussortieren“ oder wähle in der Liste mehrere aus. Hier sammelst du sie, bis sie weg sind.</p>';
    if (!any) return h + '<div class="empty"><h2>Nichts zum Aussortieren</h2><p>Sobald du etwas zum Verkaufen, Verschenken oder Entsorgen markierst, erscheint es hier.</p></div>';
    groups.forEach(function (g) {
      if (!g.items.length) return;
      var sum = g.items.reduce(function (s, it) { return s + (Number(it.price) || 0); }, 0);
      h += '<div class="section-head"><h3>' + DISP[g.k] + ' (' + g.items.length + ')</h3>' + (g.k === 'verkaufen' && sum ? '<span class="pill pill-ok">' + U.money(sum) + '</span>' : '') + '</div><div class="list">';
      g.items.forEach(function (it) {
        var ph = (it.photos || [])[0];
        h += '<div class="box-row"><div class="top-line"><span class="mosaic one" style="width:48px;height:48px">' + (ph ? imgTag(ph.t || ph.id, '', true) : '') + '</span>' +
          '<a href="#" data-item="' + esc(it.id) + '">' + esc(it.name) + '</a>' + (it.price ? '<span class="code">' + esc(U.money(it.price)) + '</span>' : '') + '</div>' +
          '<div class="meta">' + esc(M.shortLoc(it)) + '</div><div class="row-btns">' +
          (g.k === 'verkaufen' ? '<button class="btn small" type="button" data-act="ad" data-id="' + esc(it.id) + '">Anzeigentext</button>' : '') +
          '<button class="btn small" type="button" data-act="so-keep" data-id="' + esc(it.id) + '">Doch behalten</button>' +
          '<button class="btn small btn-primary" type="button" data-act="so-done" data-id="' + esc(it.id) + '">Ist weg</button></div></div>';
      });
      h += '</div>';
    });
    return h;
  };

  VIEWS.moving = function () {
    var boxes = DB.places.filter(function (p) { return p.kind === 'kiste'; }).sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); });
    var packed = boxes.filter(function (p) { return p.moveStatus === 'gepackt'; }).length;
    var unpacked = boxes.filter(function (p) { return p.moveStatus === 'ausgepackt'; }).length;
    var h = '<p class="lead" style="margin-bottom:12px">Jede Kiste bekommt eine Nummer und einen Zielraum. Druck die Etiketten aus, kleb sie auf und hake beim Packen und Auspacken ab. Beim Auspacken zieht die Kiste automatisch in den Zielraum um.</p>';
    h += '<div class="panel" style="margin-bottom:14px"><h3>Fortschritt <span class="pill pill-neutral">' + unpacked + ' von ' + boxes.length + ' ausgepackt</span></h3>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + boxes.length + '" aria-valuenow="' + unpacked + '"><span style="width:' + (boxes.length ? (unpacked / boxes.length * 100).toFixed(1) : 0) + '%"></span></div>' +
      '<p>' + packed + ' gepackt · ' + (boxes.length - packed - unpacked) + ' offen</p>' +
      '<div class="row-btns"><button class="btn small btn-primary" type="button" data-act="new-box">Neue Umzugskiste</button>' +
      (boxes.length ? '<button class="btn small" type="button" data-act="labels-boxes">Etiketten für alle Kisten</button>' : '') + '</div></div>';
    if (!boxes.length) return h + '<div class="empty"><h2>Noch keine Kisten</h2><p>Leg die erste Umzugskiste an. Sie bekommt automatisch eine Nummer wie K1.</p></div>';
    h += '<div class="list">';
    boxes.forEach(function (p) {
      var cur = M.room(M.placeRoomId(p)), n = M.itemsInPlace(p.id, true).length;
      var opts = '<option value="">Kein Zielraum</option>' + M.rooms().map(function (r) { return '<option value="' + esc(r.id) + '"' + (p.moveTarget === r.id ? ' selected' : '') + '>→ ' + esc(r.name) + '</option>'; }).join('');
      h += '<div class="box-row"><div class="top-line">' + (p.code ? '<span class="code">' + esc(p.code) + '</span>' : '') + '<a href="#/place/' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a><span class="pill pill-neutral">' + U.plural(n, 'Ding', 'Dinge') + '</span></div>' +
        '<div class="meta">Jetzt: ' + esc(cur ? cur.name : 'Ohne Raum') + '</div>' +
        '<div class="ctrl"><label class="sr-only" for="tg-' + esc(p.id) + '">Zielraum</label><select id="tg-' + esc(p.id) + '" data-target="' + esc(p.id) + '">' + opts + '</select>' +
        '<div class="seg" role="radiogroup" aria-label="Status">' + ['', 'gepackt', 'ausgepackt'].map(function (s) {
          return '<button type="button" role="radio" aria-checked="' + ((p.moveStatus || '') === s) + '" data-mstatus="' + s + '" data-id="' + esc(p.id) + '">' + MOVE_STATUS[s] + '</button>';
        }).join('') + '</div></div></div>';
    });
    return h + '</div>';
  };

  /* =========================================================
   * Sheets (Dialoge)
   * ========================================================= */
  var stack = [];
  function openSheet(el) {
    if (stack.indexOf(el) < 0) stack.push(el);
    el.style.zIndex = String(50 + stack.indexOf(el) * 2);
    el.hidden = false;
    document.body.classList.add('locked');
  }
  var onClose = {};
  function closeSheet(el) {
    if (!el || el.hidden) return;
    el.hidden = true;
    stack = stack.filter(function (s) { return s !== el; });
    if (!stack.length) document.body.classList.remove('locked');
    var fn = onClose[el.id];
    if (fn) { onClose[el.id] = null; fn(); }
  }
  function closeAllSheets() { stack.slice().reverse().forEach(closeSheet); }
  $$('.sheet-wrap').forEach(function (w) {
    w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('[data-close]')) closeSheet(w); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) closeSheet(stack[stack.length - 1]); });

  /* ---------- Bestätigen ---------- */
  var confirmResolve = null;
  function askConfirm(title, text, okLabel, danger) {
    $('#cTitle').textContent = title; $('#cText').textContent = text;
    var yes = $('#cYes');
    yes.textContent = okLabel || 'Löschen';
    yes.className = 'btn grow ' + (danger === false ? 'btn-primary' : 'btn-danger');
    openSheet($('#sheetConfirm'));
    return new Promise(function (res) {
      confirmResolve = res;
      onClose.sheetConfirm = function () { if (confirmResolve) { var r = confirmResolve; confirmResolve = null; r(false); } };
    });
  }
  $('#cYes').addEventListener('click', function () { var r = confirmResolve; confirmResolve = null; closeSheet($('#sheetConfirm')); if (r) r(true); });
  $('#cNo').addEventListener('click', function () { closeSheet($('#sheetConfirm')); });

  /* ---------- Menü / Panel ---------- */
  var menuActions = [];
  function openMenu(title, entries, html) {
    $('#menuTitle').textContent = title;
    menuActions = entries || [];
    $('#menuBody').innerHTML = (html || '') + (menuActions.length ? '<div class="menu-list">' + menuActions.map(function (e, i) {
      return '<button class="row" type="button" data-menu="' + i + '"' + (e.disabled ? ' disabled' : '') + '><span class="row-txt"><span class="row-name"' + (e.danger ? ' style="color:var(--danger)"' : '') + '>' + esc(e.label) + '</span>' +
        (e.meta ? '<span class="row-meta">' + esc(e.meta) + '</span>' : '') + '</span>' + ICON.chev + '</button>';
    }).join('') + '</div>' : '');
    hydrate($('#menuBody'));
    openSheet($('#sheetMenu'));
  }
  $('#menuBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-menu]');
    if (!b) return;
    var entry = menuActions[+b.dataset.menu];
    closeSheet($('#sheetMenu'));
    if (entry && entry.run) entry.run();
  });

  /* ---------- Text (kopieren/teilen) ---------- */
  var textFiles = null;
  function openText(title, text, filesPromise) {
    $('#tTitle').textContent = title;
    $('#tText').value = text;
    textFiles = null;
    var canShare = !!navigator.share;
    $('#tShare').hidden = !canShare;
    if (filesPromise) filesPromise.then(function (f) { textFiles = f; }, function () { textFiles = null; });
    openSheet($('#sheetText'));
  }
  $('#tCopy').addEventListener('click', function () { U.copyText($('#tText').value, $('#tText')); });
  $('#tShare').addEventListener('click', function () {
    var data = { text: $('#tText').value };
    if (textFiles && textFiles.length && navigator.canShare && navigator.canShare({ files: textFiles, text: data.text })) data.files = textFiles;
    navigator.share(data).catch(function (err) { if (!err || err.name !== 'AbortError') U.toast('Teilen hat nicht geklappt. Nutze „Kopieren“.'); });
  });

  /* ---------- Eingabe ---------- */
  var promptCb = null;
  function openPrompt(title, label, value, opts, cb) {
    opts = opts || {};
    $('#qTitle').textContent = title; $('#qLabel').textContent = label;
    var inp = $('#q-input');
    inp.value = value || '';
    if (opts.list) inp.setAttribute('list', opts.list); else inp.removeAttribute('list');
    inp.placeholder = opts.placeholder || '';
    promptCb = cb;
    openSheet($('#sheetPrompt'));
    setTimeout(function () { inp.focus(); }, 60);
  }
  $('#promptForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var cb = promptCb, v = $('#q-input').value.trim();
    promptCb = null;
    closeSheet($('#sheetPrompt'));
    if (cb) cb(v);
  });

  /* ---------- Datei fertig: teilen oder herunterladen ---------- */
  var fileOffer = null;
  function offerFile(blob, filename, note) {
    return new Promise(function (resolve) {
      var file = null;
      try { file = new File([blob], filename, { type: blob.type || 'application/octet-stream' }); } catch (e) { file = null; }
      var shareable = U.isMobile && file && navigator.canShare && navigator.canShare({ files: [file] });
      if (!shareable) { U.downloadBlob(blob, filename); U.toast('Datei gespeichert: ' + filename); resolve('downloaded'); return; }
      fileOffer = { blob: blob, file: file, name: filename, resolve: resolve, done: false };
      $('#fInfo').textContent = filename + ' (' + U.fmtBytes(blob.size) + ')';
      $('#fNote').textContent = note || '';
      $('#fNote').hidden = !note;
      onClose.sheetFile = function () { if (fileOffer && !fileOffer.done) { fileOffer.resolve('cancelled'); } fileOffer = null; };
      openSheet($('#sheetFile'));
    });
  }
  $('#fShare').addEventListener('click', function () {
    var o = fileOffer; if (!o) return;
    navigator.share({ files: [o.file], title: o.name }).then(function () {
      o.done = true; o.resolve('shared'); closeSheet($('#sheetFile'));
    }, function (err) {
      if (err && err.name === 'AbortError') return;
      U.toast('Teilen ging nicht. Versuch „Herunterladen“.');
    });
  });
  $('#fDownload').addEventListener('click', function () {
    var o = fileOffer; if (!o) return;
    U.downloadBlob(o.blob, o.name);
    o.done = true; o.resolve('downloaded'); closeSheet($('#sheetFile'));
  });

  /* =========================================================
   * Detailansicht
   * ========================================================= */
  var detailId = null;
  function openDetail(id) {
    if (!M.item(id)) return;
    detailId = id;
    renderDetail();
    onClose.sheetDetail = function () { detailId = null; };
    openSheet($('#sheetDetail'));
    $('#dBody').scrollTop = 0;
  }
  function renderDetail() {
    var it = M.item(detailId); if (!it) return;
    var photos = it.photos || [], rid = M.roomIdOf(it), placeId = M.validPlaceId(it);
    $('#dTitle').textContent = it.name;
    var h = '';
    if (photos.length) {
      h += '<div class="gallery' + (photos.length > 1 ? ' multi' : '') + '">' + photos.map(function (p, i) { return '<img data-blob="' + esc(p.id) + '" alt="Foto ' + (i + 1) + ' von ' + esc(it.name) + '" data-zoom="' + esc(p.id) + '">'; }).join('') + '</div>';
      if (photos.length > 1) h += '<div class="g-note">' + photos.length + ' Fotos, zum Blättern wischen</div>';
    }
    h += '<div><button class="dymo" type="button" data-go="' + esc(placeId ? 'place/' + placeId : 'room/' + (rid || 'none')) + '">' + esc(M.locText(it)) + '</button></div>';
    h += '<div class="quick"><button class="btn small" type="button" data-dact="move">Verschieben</button>' +
      (it.lentTo ? '<button class="btn small" type="button" data-dact="return">Zurückbekommen</button>' : '<button class="btn small" type="button" data-dact="lend">Verleihen</button>') + '</div>';
    h += '<dl class="facts">';
    h += '<dt>Anzahl</dt><dd><span class="stepper"><button type="button" data-dqty="-1" aria-label="Eins weniger">−</button><output>' + M.qty(it) + '</output><button type="button" data-dqty="1" aria-label="Eins mehr">+</button></span>' +
      (M.needsBuying(it) ? '<span class="pill pill-warn">unter Mindestbestand (' + esc(it.minQty) + ')</span>' : (parseInt(it.minQty, 10) > 0 ? '<span class="hint">mind. ' + esc(it.minQty) + '</span>' : '')) + '</dd>';
    if (it.category) h += '<dt>Kategorie</dt><dd>' + esc(it.category) + '</dd>';
    if (it.value != null && it.value !== '') h += '<dt>Wert</dt><dd>' + U.money(it.value) + (M.qty(it) > 1 ? ' pro Stück · ' + U.money(M.val(it)) + ' gesamt' : '') + '</dd>';
    if (it.bought) h += '<dt>Gekauft</dt><dd>' + U.fmtDay(it.bought) + '</dd>';
    if (it.warranty) {
      var ws = M.warrantyState(it), wn = U.daysUntil(it.warranty);
      h += '<dt>Garantie bis</dt><dd>' + U.fmtDay(it.warranty) + (ws === 'expired' ? '<span class="pill pill-bad">abgelaufen</span>' : ws === 'soon' ? '<span class="pill pill-warn">' + esc(U.relDays(wn)) + '</span>' : '') + '</dd>';
    }
    if (it.serial) h += '<dt>Seriennummer</dt><dd style="font-family:var(--f-mono)">' + esc(it.serial) + '</dd>';
    if (it.expiry) {
      var es = M.expiryState(it), en = U.daysUntil(it.expiry);
      h += '<dt>Haltbar bis</dt><dd>' + U.fmtDay(it.expiry) + (es === 'expired' ? '<span class="pill pill-bad">abgelaufen</span>' : es === 'soon' ? '<span class="pill pill-warn">' + esc(U.relDays(en)) + '</span>' : '') + '</dd>';
    }
    if (it.lentTo) h += '<dt>Verliehen an</dt><dd>' + esc(it.lentTo) + (it.lentSince ? ' <span class="hint">seit ' + U.fmtDay(it.lentSince) + '</span>' : '') + '</dd>';
    if (it.disposition && DISP[it.disposition]) h += '<dt>Aussortieren</dt><dd>' + DISP[it.disposition] + (it.price ? ' · ' + U.money(it.price) : '') + '</dd>';
    h += '</dl>';
    if ((it.tasks || []).length) {
      h += '<div class="panel" style="padding:12px 14px"><h3>Wartung</h3><ul class="mini-list">' + it.tasks.map(function (t) {
        var n = U.daysUntil(t.next);
        return '<li><span class="main">' + esc(t.title) + '<small>' + esc(U.everyText(t.every, t.unit) + ' · nächstes Mal ' + (t.next ? U.fmtDay(t.next) + ' (' + U.relDays(n) + ')' : 'offen')) + '</small></span>' +
          '<button class="btn small" type="button" data-task-done="' + esc(it.id) + '" data-task="' + esc(t.id) + '">Erledigt</button></li>';
      }).join('') + '</ul></div>';
    }
    if ((it.docs || []).length) {
      h += '<div class="field"><span>Belege &amp; Anleitungen</span><div class="docs">' + it.docs.map(function (d) {
        return '<div class="doc"><span class="n">' + esc(d.name) + '</span><span class="s">' + U.fmtBytes(d.size || 0) + '</span><button class="btn small" type="button" data-doc="' + esc(d.id) + '">Öffnen</button></div>';
      }).join('') + '</div></div>';
    }
    if ((it.tags || []).length) h += '<div class="tags">' + it.tags.map(function (t) { return '<button class="tag" type="button" data-tag="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    if (it.notes) h += '<p class="notes">' + esc(it.notes) + '</p>';
    if ((it.history || []).length) {
      h += '<details class="plain"><summary>Verlauf (' + it.history.length + ')</summary><ul class="hist" style="margin-top:8px">' + it.history.slice().reverse().slice(0, 20).map(function (e) {
        return '<li><b>' + new Date(e.t).toLocaleDateString('de-DE') + '</b> ' + esc(e.text) + '</li>';
      }).join('') + '</ul></details>';
    }
    $('#dBody').innerHTML = h;
    hydrate($('#dBody'));
  }
  function updateItem(it, patch, histText) {
    var n = Object.assign({}, it, patch, { updatedAt: Date.now() });
    if (histText) n.history = histPush(it, histText);
    return DB.put('items', n).catch(function (e) { U.toast('Speichern hat nicht geklappt: ' + (e && e.message || e)); throw e; });
  }
  function changeQty(id, delta) {
    var it = M.item(id); if (!it) return;
    var q = Math.max(0, M.qty(it) + delta);
    if (q === M.qty(it)) return;
    updateItem(it, { qty: q });
  }
  function taskDone(itemId, taskId) {
    var it = M.item(itemId); if (!it) return;
    var today = U.today(), title = '';
    var tasks = (it.tasks || []).map(function (t) {
      if (t.id !== taskId) return t;
      title = t.title;
      return Object.assign({}, t, { last: today, next: U.addInterval(today, t.every, t.unit) });
    });
    updateItem(it, { tasks: tasks }, 'Erledigt: ' + title).then(function () {
      var t = tasks.filter(function (x) { return x.id === taskId; })[0];
      U.toast('Erledigt. Nächstes Mal am ' + U.fmtDay(t.next) + '.');
    });
  }
  $('#dBody').addEventListener('click', function (e) {
    var it = M.item(detailId); if (!it) return;
    var t;
    if ((t = e.target.closest('[data-go]'))) { go(t.dataset.go); return; }
    if ((t = e.target.closest('[data-tag]'))) { closeSheet($('#sheetDetail')); setQuery(t.dataset.tag); if (S.route !== 'items') go('items'); return; }
    if ((t = e.target.closest('[data-dqty]'))) { changeQty(it.id, +t.dataset.dqty); return; }
    if ((t = e.target.closest('[data-task-done]'))) { taskDone(t.dataset.taskDone, t.dataset.task); return; }
    if ((t = e.target.closest('[data-zoom]'))) { openMenu(it.name, [], '<img data-blob="' + esc(t.dataset.zoom) + '" alt="" style="width:100%;border-radius:12px">'); return; }
    if ((t = e.target.closest('[data-doc]'))) { openDoc(it, t.dataset.doc); return; }
    if ((t = e.target.closest('[data-dact]'))) {
      var a = t.dataset.dact;
      if (a === 'move') openMove([it.id]);
      if (a === 'return') updateItem(it, { lentTo: '', lentSince: '' }, 'Zurückbekommen von ' + it.lentTo).then(function () { U.toast('Als zurückgegeben markiert'); });
      if (a === 'lend') openPrompt('Verleihen', 'An wen?', '', { placeholder: 'Name' }, function (v) {
        if (!v) return;
        updateItem(it, { lentTo: v, lentSince: U.today() }, 'Verliehen an ' + v).then(function () { U.toast('Verliehen an ' + v); });
      });
    }
  });
  function openDoc(it, docId) {
    var d = (it.docs || []).filter(function (x) { return x.id === docId; })[0];
    if (!d) return;
    if (/^image\//.test(d.type)) { openMenu(d.name, [], '<img data-blob="' + esc(d.id) + '" alt="" style="width:100%;border-radius:12px">'); return; }
    DB.getBlob(d.id).then(function (b) {
      if (!b) { U.toast('Die Datei wurde nicht gefunden.'); return; }
      if (!U.isMobile) {
        var u = URL.createObjectURL(b), w = window.open(u, '_blank');
        if (!w) U.downloadBlob(b, d.name);
        setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
        return;
      }
      offerFile(b, d.name, 'Über „Teilen“ kannst du die PDF ansehen, in Dateien sichern oder weiterschicken.');
    });
  }
  $('#dEdit').addEventListener('click', function () { var it = M.item(detailId); if (it) openEditor(it); });
  $('#dCopy').addEventListener('click', function () {
    var it = M.item(detailId); if (!it) return;
    openEditor(null, { roomId: M.roomIdOf(it), placeId: M.validPlaceId(it), spot: it.spot, category: it.category, tags: it.tags });
  });
  $('#dDelete').addEventListener('click', function () {
    var it = M.item(detailId); if (!it) return;
    deleteItems([it.id]);
  });
  function deleteItems(ids) {
    var items = ids.map(M.item).filter(Boolean);
    if (!items.length) return Promise.resolve(false);
    var title = items.length === 1 ? '„' + items[0].name + '“ löschen?' : U.plural(items.length, 'Gegenstand', 'Gegenstände') + ' löschen?';
    var photos = items.reduce(function (s, it) { return s + (it.photos || []).length; }, 0);
    return askConfirm(title, 'Die Einträge' + (photos ? ' und ' + U.plural(photos, 'Foto', 'Fotos') : '') + ' werden endgültig von diesem Gerät gelöscht.').then(function (ok) {
      if (!ok) return false;
      return DB.del('items', ids).then(function () {
        var blobs = []; items.forEach(function (it) { blobs = blobs.concat(blobIdsOf(it)); });
        DB.delBlobs(blobs);
        closeSheet($('#sheetDetail'));
        U.toast(items.length === 1 ? 'Gelöscht' : U.plural(items.length, 'Gegenstand', 'Gegenstände') + ' gelöscht');
        return true;
      }, function (e) { U.toast('Löschen hat nicht geklappt: ' + (e && e.message || e)); return false; });
    });
  }

  /* =========================================================
   * Auswahl mehrerer Gegenstände
   * ========================================================= */
  function enterSelect() { S.selecting = true; S.selected = new Set(); render(); updateSelCount(); }
  function exitSelect(silent) { if (!S.selecting) return; S.selecting = false; S.selected = new Set(); if (!silent) render(); }
  function updateSelCount() { $('#selCount').textContent = S.selected.size + ' ausgewählt'; }
  $('#selectBar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bulk]'); if (!b) return;
    var ids = Array.from(S.selected), act = b.dataset.bulk;
    if (act === 'done') { exitSelect(); return; }
    if (!ids.length) { U.toast('Tippe zuerst Gegenstände an.'); return; }
    if (act === 'move') openMove(ids, function () { exitSelect(); });
    if (act === 'delete') deleteItems(ids).then(function (ok) { if (ok) exitSelect(); });
    if (act === 'category') {
      fillDatalists('');
      openPrompt('Kategorie setzen', 'Kategorie für ' + U.plural(ids.length, 'Gegenstand', 'Gegenstände'), '', { list: 'dl-cats' }, function (v) {
        var list = ids.map(M.item).filter(Boolean).map(function (it) { return Object.assign({}, it, { category: v, updatedAt: Date.now() }); });
        DB.put('items', list).then(function () { U.toast('Kategorie gesetzt'); exitSelect(); });
      });
    }
    if (act === 'sortout') {
      var mk = function (disp) {
        return function () {
          var list = ids.map(M.item).filter(Boolean).map(function (it) {
            return Object.assign({}, it, { disposition: disp, updatedAt: Date.now(), history: disp ? histPush(it, 'Zum ' + DISP[disp] + ' markiert') : it.history });
          });
          DB.put('items', list).then(function () { U.toast(disp ? 'Markiert: ' + DISP[disp] : 'Markierung entfernt'); exitSelect(); });
        };
      };
      openMenu('Aussortieren', [
        { label: 'Verkaufen', run: mk('verkaufen') }, { label: 'Verschenken', run: mk('verschenken') },
        { label: 'Entsorgen', run: mk('entsorgen') }, { label: 'Doch behalten', meta: 'Markierung entfernen', run: mk('') }
      ]);
    }
  });

  /* =========================================================
   * Auswahllisten für Raum und Ort
   * ========================================================= */
  function roomOptionsHTML(selected, withNew) {
    var h = M.rooms().map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === selected ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
    h += '<option value=""' + (!selected || !M.room(selected) ? ' selected' : '') + '>Ohne Raum</option>';
    if (withNew) h += '<option value="__new">+ Neuer Raum …</option>';
    return h;
  }
  function placeOptionsHTML(roomId, selected, opts) {
    opts = opts || {};
    var h = '<option value="">' + esc(opts.emptyLabel || '– keins –') + '</option>';
    function walk(parentId, depth) {
      M.childPlaces(parentId, roomId).forEach(function (p) {
        if (opts.exclude && opts.exclude.has(p.id)) return;
        h += '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + new Array(depth + 1).join('— ') + esc(M.placeLabel(p)) + '</option>';
        if (depth < 8) walk(p.id, depth + 1);
      });
    }
    walk(null, 0);
    if (opts.withNew) h += '<option value="__new">+ Neu anlegen …</option>';
    return h;
  }
  function fillDatalists(roomId) {
    var spots = {}, cats = {};
    DB.items.forEach(function (it) {
      if (it.spot && (!roomId || M.roomIdOf(it) === roomId)) spots[it.spot] = 1;
      if (it.category) cats[it.category] = 1;
    });
    ['Elektronik', 'Küche', 'Haushalt', 'Werkzeug', 'Möbel', 'Deko', 'Kleidung', 'Schuhe', 'Bad & Pflege', 'Büro', 'Bücher & Medien',
      'Spielzeug', 'Sport & Freizeit', 'Garten', 'Lebensmittel', 'Dokumente'].forEach(function (c) { cats[c] = 1; });
    var opt = function (s) { return '<option value="' + esc(s) + '"></option>'; };
    $('#dl-spots').innerHTML = Object.keys(spots).sort(natural).map(opt).join('');
    $('#dl-cats').innerHTML = Object.keys(cats).sort(natural).map(opt).join('');
  }

  /* =========================================================
   * Gegenstand bearbeiten
   * ========================================================= */
  var draft = null;
  function openEditor(item, preset) {
    if (draft) discardDraft();
    preset = preset || {};
    var src = item || preset;
    draft = {
      id: item ? item.id : U.uid('i'),
      orig: item || null,
      photos: (item && item.photos || []).map(function (p) { return { key: U.uid(), id: p.id, t: p.t || '', isNew: false, uploading: false }; }),
      docs: (item && item.docs || []).map(function (d) { return Object.assign({ key: U.uid(), isNew: false }, d); }),
      tasks: (item && item.tasks || []).map(function (t) { return Object.assign({}, t); }),
      busy: 0, closed: false, committed: false, saving: false, recog: null, recogStarted: false
    };
    $('#eTitle').textContent = item ? 'Bearbeiten' : 'Neuer Gegenstand';
    $('#eSaveNext').hidden = !!item;
    var roomId = item ? M.roomIdOf(item) : (preset.roomId !== undefined ? preset.roomId : (S.route === 'items' && S.room !== 'all' && S.room !== 'none' ? S.room : (prefs.lastRoom || '')));
    if (roomId && !M.room(roomId)) roomId = '';
    var placeId = item ? M.validPlaceId(item) : (preset.placeId || '');
    if (placeId && M.placeRoomId(M.place(placeId)) !== roomId) placeId = '';
    var rs = $('#f-room'); rs.innerHTML = roomOptionsHTML(roomId, true); rs.dataset.prev = rs.value;
    var ps = $('#f-place'); ps.innerHTML = placeOptionsHTML(rs.value, placeId, { withNew: true }); ps.dataset.prev = ps.value;
    $('#f-name').value = item ? item.name : '';
    $('#f-spot').value = src.spot || '';
    $('#f-cat').value = src.category || '';
    $('#f-qty').value = item ? M.qty(item) : 1;
    $('#f-tags').value = (src.tags || []).join(', ');
    $('#f-value').value = item ? U.moneyInput(item.value) : '';
    $('#f-bought').value = item ? item.bought || '' : '';
    $('#f-warranty').value = item ? item.warranty || '' : '';
    $('#f-serial').value = item ? item.serial || '' : '';
    $('#f-expiry').value = item ? item.expiry || '' : '';
    $('#f-min').value = item && parseInt(item.minQty, 10) > 0 ? item.minQty : '';
    $('#f-lent').value = item ? item.lentTo || '' : '';
    $('#f-disp').value = item ? item.disposition || '' : '';
    $('#f-price').value = item ? U.moneyInput(item.price) : '';
    $('#f-notes').value = item ? item.notes || '' : '';
    $('#gBuy').open = !!(item && (item.value || item.bought || item.warranty || item.serial || (item.docs || []).length));
    $('#gStock').open = !!(item && (item.expiry || parseInt(item.minQty, 10) > 0));
    $('#gMaint').open = !!(item && (item.tasks || []).length);
    $('#gMisc').open = !!(item && (item.lentTo || item.disposition || item.notes));
    $('#nameField').classList.remove('err'); $('#nameErr').hidden = true;
    updatePriceField();
    fillDatalists(rs.value);
    renderDraftPhotos(); renderSuggest(); renderDraftDocs(); renderTasks();
    setEditBusy();
    onClose.sheetEdit = discardDraft;
    openSheet($('#sheetEdit'));
    $('#sheetEdit .sheet-body').scrollTop = 0;
  }
  function updatePriceField() { $('#priceField').hidden = $('#f-disp').value !== 'verkaufen'; }
  $('#f-disp').addEventListener('change', updatePriceField);

  function renderDraftPhotos() {
    if (!draft) return;
    var h = draft.photos.map(function (p, i) {
      var img = p.preview ? '<img src="' + esc(p.preview) + '" alt="">' : (p.t || p.id ? imgTag(p.t || p.id, '') : '');
      return '<div class="pthumb">' + img +
        (p.uploading ? '<div class="busy"><div class="spinner"></div></div>' :
          (i > 0 ? '<button class="mk" type="button" data-cover="' + p.key + '" aria-label="Als Titelbild verwenden"></button>' : '') +
          '<button class="x" type="button" data-rm="' + p.key + '" aria-label="Foto entfernen">×</button>') +
        (i === 0 && !p.uploading ? '<span class="cover">Titel</span>' : '') + '</div>';
    }).join('');
    if (draft.photos.length < 12) h += '<label class="add-photo" for="photoInput">' + ICON.camera + 'Foto</label>';
    $('#ePhotos').innerHTML = h;
    hydrate($('#ePhotos'));
    $('#photoHint').hidden = draft.photos.length < 2;
  }
  function renderSuggest() {
    var el = $('#eSuggest'), r = draft && draft.recog;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (r.state === 'loading') el.innerHTML = '<span class="spinner dark"></span> Erkenne das Foto …' + (W.Recognizer.state === 'loading' ? ' Beim ersten Mal dauert das ein paar Sekunden.' : '');
    else if (r.state === 'error') el.innerHTML = 'Die Bilderkennung ist gerade nicht verfügbar. Gib den Namen selbst ein.';
    else if (!r.res.length) el.innerHTML = 'Keine sichere Erkennung. Gib den Namen selbst ein.';
    else el.innerHTML = 'Vorschläge: ' + r.res.map(function (s, i) { return '<button type="button" data-sug="' + i + '">' + esc(s.name) + '<small>' + Math.round(s.p * 100) + ' %</small></button>'; }).join('');
  }
  function startRecognition(d, blob) {
    if (!recogOn() || d.recogStarted) return;
    d.recogStarted = true;
    d.recog = { state: 'loading' };
    if (d === draft) renderSuggest();
    W.Recognizer.classify(blob, 3).then(function (res) {
      d.recog = { state: 'done', res: res };
      if (d === draft) renderSuggest();
    }, function () {
      d.recog = { state: 'error' };
      if (d === draft) renderSuggest();
    });
  }
  $('#eSuggest').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sug]');
    if (!b || !draft || !draft.recog || !draft.recog.res) return;
    var s = draft.recog.res[+b.dataset.sug];
    if (!s) return;
    $('#f-name').value = s.name;
    $('#nameField').classList.remove('err'); $('#nameErr').hidden = true;
    if (!$('#f-cat').value.trim() && s.category && ['Tier', 'Pflanze', 'Sonstiges'].indexOf(s.category) < 0) $('#f-cat').value = s.category;
  });
  $('#ePhotos').addEventListener('click', function (e) {
    if (!draft) return;
    var rm = e.target.closest('[data-rm]'), cv = e.target.closest('[data-cover]');
    if (rm) {
      var k = rm.dataset.rm, p = draft.photos.filter(function (x) { return x.key === k; })[0];
      draft.photos = draft.photos.filter(function (x) { return x.key !== k; });
      if (p && p.isNew) DB.delBlobs([p.id, p.t]);
      if (p && p.preview) URL.revokeObjectURL(p.preview);
      renderDraftPhotos();
    } else if (cv) {
      var i = -1;
      draft.photos.forEach(function (x, j) { if (x.key === cv.dataset.cover) i = j; });
      if (i > 0) { draft.photos.unshift(draft.photos.splice(i, 1)[0]); renderDraftPhotos(); }
    }
  });
  $('#photoInput').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!draft || !files.length) return;
    var d = draft, room = 12 - d.photos.length;
    if (files.length > room) { U.toast('Höchstens 12 Fotos pro Gegenstand.'); files = files.slice(0, Math.max(0, room)); }
    var entries = files.map(function () { return { key: U.uid(), id: '', t: '', isNew: true, uploading: true, preview: '' }; });
    entries.forEach(function (en) { d.photos.push(en); });
    d.busy += entries.length;
    renderDraftPhotos(); setEditBusy();
    var chain = Promise.resolve();
    files.forEach(function (f, i) {
      var en = entries[i];
      chain = chain.then(function () {
        if (d.closed) return;
        return U.processImage(f).then(function (b) {
          if (d.closed) return;
          en.preview = URL.createObjectURL(b.thumb);
          var fid = U.uid('p'), tid = U.uid('t');
          return DB.putBlob(fid, b.full).then(function () { return DB.putBlob(tid, b.thumb); }).then(function () {
            if (d.closed) { DB.delBlobs([fid, tid]); return; }
            en.id = fid; en.t = tid; en.uploading = false;
            if (!d.orig && !$('#f-name').value.trim()) startRecognition(d, b.thumb);
          });
        }).catch(function (err) {
          d.photos = d.photos.filter(function (x) { return x !== en; });
          if (en.preview) URL.revokeObjectURL(en.preview);
          if (!d.closed) U.toast(err && err.code === 'unsupported_type' ? 'Dieses Bildformat kann ich nicht lesen.' : 'Das Foto konnte nicht gespeichert werden.');
        }).then(function () {
          d.busy--;
          if (d === draft && !d.closed) { renderDraftPhotos(); setEditBusy(); }
        });
      });
    });
  });

  /* Belege */
  function renderDraftDocs() {
    if (!draft) return;
    $('#eDocs').innerHTML = draft.docs.map(function (d) {
      return '<div class="doc"><span class="n">' + esc(d.name) + '</span><span class="s">' + (d.uploading ? 'lädt …' : U.fmtBytes(d.size || 0)) + '</span>' +
        (d.uploading ? '' : '<button class="icon-btn" type="button" data-drm="' + d.key + '" aria-label="Beleg entfernen">' + ICON.close + '</button>') + '</div>';
    }).join('');
  }
  $('#eDocs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-drm]'); if (!b || !draft) return;
    var d = draft.docs.filter(function (x) { return x.key === b.dataset.drm; })[0];
    draft.docs = draft.docs.filter(function (x) { return x.key !== b.dataset.drm; });
    if (d && d.isNew) DB.delBlobs([d.id]);
    renderDraftDocs();
  });
  $('#docInput').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!draft || !files.length) return;
    var d = draft;
    files.forEach(function (f) {
      var isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      var isImg = /^image\//.test(f.type);
      if (!isPdf && !isImg) { U.toast('Nur Fotos und PDF-Dateien.'); return; }
      if (f.size > 30 * 1048576) { U.toast('„' + f.name + '“ ist größer als 30 MB.'); return; }
      var entry = { key: U.uid(), id: U.uid('d'), name: f.name || (isPdf ? 'Dokument.pdf' : 'Beleg.jpg'), type: isPdf ? 'application/pdf' : 'image/jpeg', size: f.size, isNew: true, uploading: true };
      d.docs.push(entry); d.busy++;
      var job = isPdf ? Promise.resolve(new Blob([f], { type: 'application/pdf' })) : U.loadImage(f).then(function (o) {
        return U.canvasToJpeg(U.drawScaled(o.img, 2200), 0.85).then(function (b) { URL.revokeObjectURL(o.url); return b; });
      });
      job.then(function (blob) {
        entry.size = blob.size;
        if (!isPdf && !/\.jpe?g$/i.test(entry.name)) entry.name = entry.name.replace(/\.[^.]+$/, '') + '.jpg';
        return DB.putBlob(entry.id, blob);
      }).then(function () {
        entry.uploading = false;
        if (d.closed) DB.delBlobs([entry.id]);
      }, function () {
        d.docs = d.docs.filter(function (x) { return x !== entry; });
        U.toast('„' + entry.name + '“ konnte nicht gespeichert werden.');
      }).then(function () {
        d.busy--;
        if (d === draft && !d.closed) { renderDraftDocs(); setEditBusy(); }
      });
    });
    renderDraftDocs(); setEditBusy();
  });

  /* Wartungsaufgaben */
  function renderTasks() {
    if (!draft) return;
    $('#eTasks').innerHTML = draft.tasks.map(function (t) {
      return '<div class="task" data-tid="' + esc(t.id) + '">' +
        '<input type="text" data-tf="title" maxlength="80" placeholder="Aufgabe, z. B. Filter wechseln" value="' + esc(t.title) + '" aria-label="Aufgabe">' +
        '<div class="row3"><input type="number" inputmode="numeric" min="1" max="999" data-tf="every" value="' + esc(t.every) + '" aria-label="Abstand">' +
        '<select data-tf="unit" aria-label="Einheit">' + ['d', 'w', 'm', 'y'].map(function (u) { return '<option value="' + u + '"' + (t.unit === u ? ' selected' : '') + '>' + U.UNIT_LABEL[u][1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="task-foot"><label class="field" style="flex:1"><span>Nächstes Mal</span><input type="date" data-tf="next" value="' + esc(t.next || '') + '"></label>' +
        '<button class="icon-btn" type="button" data-trm="' + esc(t.id) + '" aria-label="Aufgabe entfernen">' + ICON.close + '</button></div></div>';
    }).join('');
  }
  function readTasks() {
    if (!draft) return [];
    $$('#eTasks .task').forEach(function (el) {
      var t = draft.tasks.filter(function (x) { return x.id === el.dataset.tid; })[0];
      if (!t) return;
      t.title = $('[data-tf="title"]', el).value.trim();
      t.every = Math.min(999, Math.max(1, parseInt($('[data-tf="every"]', el).value, 10) || 1));
      t.unit = $('[data-tf="unit"]', el).value;
      t.next = $('[data-tf="next"]', el).value || '';
    });
    return draft.tasks;
  }
  $('#addTask').addEventListener('click', function () {
    if (!draft) return;
    readTasks();
    draft.tasks.push({ id: U.uid('w'), title: '', every: 3, unit: 'm', next: U.addInterval(U.today(), 3, 'm'), last: '' });
    renderTasks();
    var inputs = $$('#eTasks [data-tf="title"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
  $('#eTasks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-trm]'); if (!b || !draft) return;
    readTasks();
    draft.tasks = draft.tasks.filter(function (t) { return t.id !== b.dataset.trm; });
    renderTasks();
  });
  $('#eTasks').addEventListener('change', function (e) {
    // Wenn Abstand oder Einheit geändert wird und das Datum noch dem Vorschlag entspricht, Vorschlag anpassen
    var el = e.target.closest('.task'); if (!el || !draft) return;
    var f = e.target.dataset.tf;
    if (f !== 'every' && f !== 'unit') return;
    var t = draft.tasks.filter(function (x) { return x.id === el.dataset.tid; })[0];
    if (!t) return;
    var oldSuggest = U.addInterval(t.last || U.today(), t.every, t.unit);
    readTasks();
    var nextEl = $('[data-tf="next"]', el);
    if (!nextEl.value || nextEl.value === oldSuggest) { t.next = U.addInterval(t.last || U.today(), t.every, t.unit); nextEl.value = t.next; }
  });

  function setEditBusy() {
    if (!draft) return;
    var busy = draft.busy > 0;
    $('#eSave').disabled = draft.saving; $('#eSaveNext').disabled = draft.saving;
    $('#eSave').textContent = draft.saving ? 'Speichert …' : (busy ? 'Fotos werden verarbeitet …' : 'Speichern');
  }
  function discardDraft() {
    if (!draft) return;
    var d = draft; draft = null; d.closed = true;
    if (!d.committed) {
      var ids = [];
      d.photos.forEach(function (p) { if (p.isNew) ids.push(p.id, p.t); });
      d.docs.forEach(function (x) { if (x.isNew) ids.push(x.id); });
      DB.delBlobs(ids);
    }
    d.photos.forEach(function (p) { if (p.preview) URL.revokeObjectURL(p.preview); });
  }
  $('#f-room').addEventListener('change', function (e) {
    var sel = e.target, ps = $('#f-place');
    if (sel.value === '__new') {
      sel.value = sel.dataset.prev || '';
      openRoomEditor(null, function (newId) {
        sel.innerHTML = roomOptionsHTML(newId, true); sel.value = newId; sel.dataset.prev = newId;
        ps.innerHTML = placeOptionsHTML(newId, '', { withNew: true }); ps.dataset.prev = '';
        fillDatalists(newId);
      });
      return;
    }
    sel.dataset.prev = sel.value;
    ps.innerHTML = placeOptionsHTML(sel.value, '', { withNew: true }); ps.dataset.prev = '';
    fillDatalists(sel.value);
  });
  $('#f-place').addEventListener('change', function (e) {
    var sel = e.target;
    if (sel.value === '__new') {
      sel.value = sel.dataset.prev || '';
      var roomId = $('#f-room').value;
      openPlaceEditor(null, { roomId: roomId, parentId: '' }, function (newId) {
        sel.innerHTML = placeOptionsHTML(roomId, newId, { withNew: true }); sel.value = newId; sel.dataset.prev = newId;
      });
      return;
    }
    sel.dataset.prev = sel.value;
  });
  $('#f-name').addEventListener('input', function () { if (this.value.trim()) { $('#nameField').classList.remove('err'); $('#nameErr').hidden = true; } });

  function saveDraft(next) {
    if (!draft || draft.saving) return;
    var name = $('#f-name').value.trim();
    if (!name) {
      $('#nameField').classList.add('err'); $('#nameErr').hidden = false;
      $('#f-name').focus(); $('#f-name').scrollIntoView({ block: 'center' });
      return;
    }
    if (draft.busy > 0) { U.toast('Einen Moment, die Dateien werden noch verarbeitet.'); return; }
    var d = draft, orig = d.orig, now = Date.now();
    var roomId = $('#f-room').value; if (roomId === '__new') roomId = '';
    var placeId = $('#f-place').value; if (placeId === '__new') placeId = '';
    var lentTo = $('#f-lent').value.trim();
    var disp = $('#f-disp').value;
    var tasks = readTasks().filter(function (t) { return t.title; }).map(function (t) {
      return { id: t.id, title: t.title, every: t.every, unit: t.unit, next: t.next || U.addInterval(t.last || U.today(), t.every, t.unit), last: t.last || '' };
    });
    var qtyRaw = $('#f-qty').value.trim();
    var item = {
      id: d.id,
      name: name,
      roomId: roomId,
      placeId: placeId,
      spot: $('#f-spot').value.trim(),
      category: $('#f-cat').value.trim(),
      tags: parseTags($('#f-tags').value),
      qty: qtyRaw === '' ? 1 : Math.min(99999, Math.max(0, parseInt(qtyRaw, 10) || 0)),
      photos: d.photos.filter(function (p) { return p.id; }).map(function (p) { return { id: p.id, t: p.t || '' }; }),
      docs: d.docs.filter(function (x) { return x.id && !x.uploading; }).map(function (x) { return { id: x.id, name: x.name, type: x.type, size: x.size }; }),
      value: U.parseMoney($('#f-value').value),
      bought: $('#f-bought').value || '',
      warranty: $('#f-warranty').value || '',
      serial: $('#f-serial').value.trim(),
      expiry: $('#f-expiry').value || '',
      minQty: Math.max(0, parseInt($('#f-min').value, 10) || 0),
      tasks: tasks,
      lentTo: lentTo,
      lentSince: lentTo ? ((orig && orig.lentTo === lentTo && orig.lentSince) ? orig.lentSince : U.today()) : '',
      disposition: disp,
      price: disp === 'verkaufen' ? U.parseMoney($('#f-price').value) : null,
      notes: $('#f-notes').value.trim(),
      history: orig ? (orig.history || []).slice() : [],
      createdAt: orig && orig.createdAt ? orig.createdAt : now,
      updatedAt: now
    };
    if (!orig) item.history.push({ t: now, text: 'Erfasst in ' + M.locText(item) });
    else {
      var moved = locationChangeText(orig, item);
      if (moved) item.history.push({ t: now, text: moved });
      if ((orig.lentTo || '') !== lentTo) item.history.push({ t: now, text: lentTo ? 'Verliehen an ' + lentTo : 'Zurückbekommen von ' + orig.lentTo });
      if ((orig.disposition || '') !== disp && disp) item.history.push({ t: now, text: 'Zum ' + DISP[disp] + ' markiert' });
    }
    item.history = item.history.slice(-50);
    d.saving = true; setEditBusy();
    DB.put('items', item).then(function () {
      d.committed = true;
      if (orig) {
        var keep = new Set(blobIdsOf(item)), gone = blobIdsOf(orig).filter(function (id) { return !keep.has(id); });
        DB.delBlobs(gone);
      }
      prefs.lastRoom = roomId; savePrefs();
      requestPersist();
      U.toast(orig ? 'Gespeichert' : '„' + name + '“ angelegt');
      if (next) {
        openEditor(null, { roomId: roomId, placeId: placeId, spot: item.spot, category: item.category, tags: item.tags });
      } else closeSheet($('#sheetEdit'));
    }, function (err) {
      d.saving = false; if (d === draft) setEditBusy();
      U.toast('Speichern hat nicht geklappt: ' + (err && err.message || err));
    });
  }
  function parseTags(s) {
    var seen = {};
    return String(s || '').split(',').map(function (t) { return t.trim(); }).filter(function (t) {
      var k = U.norm(t); if (!t || seen[k]) return false; seen[k] = 1; return true;
    }).slice(0, 20);
  }
  $('#editForm').addEventListener('submit', function (e) { e.preventDefault(); saveDraft(false); });
  $('#eSaveNext').addEventListener('click', function () { saveDraft(true); });

  /* =========================================================
   * Räume
   * ========================================================= */
  var roomDraft = null;
  function openRoomEditor(room, onCreated) {
    var used = DB.rooms.map(function (r) { return r.color; });
    var free = U.PALETTE.filter(function (c) { return used.indexOf(c) < 0; });
    roomDraft = { room: room, color: room ? U.safeColor(room.color) : (free[0] || U.PALETTE[DB.rooms.length % U.PALETTE.length]), onCreated: onCreated || null };
    $('#rTitle').textContent = room ? 'Raum bearbeiten' : 'Neuer Raum';
    $('#r-name').value = room ? room.name : '';
    $('#rNameField').classList.remove('err');
    $('#rDelete').hidden = !room;
    renderSwatches();
    onClose.sheetRoom = function () { roomDraft = null; };
    openSheet($('#sheetRoom'));
    if (!room) setTimeout(function () { $('#r-name').focus(); }, 60);
  }
  function renderSwatches() {
    $('#rSwatches').innerHTML = U.PALETTE.map(function (c) {
      return '<button class="swatch" type="button" role="radio" aria-checked="' + (roomDraft && roomDraft.color === c) + '" aria-label="Farbe ' + c + '" data-color="' + c + '" style="--c:' + c + '"></button>';
    }).join('');
  }
  $('#rSwatches').addEventListener('click', function (e) { var b = e.target.closest('[data-color]'); if (b && roomDraft) { roomDraft.color = b.dataset.color; renderSwatches(); } });
  $('#roomForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!roomDraft) return;
    var name = $('#r-name').value.trim();
    if (!name) { $('#rNameField').classList.add('err'); $('#r-name').focus(); return; }
    var rd = roomDraft, now = Date.now();
    var maxOrder = DB.rooms.reduce(function (m, r) { return Math.max(m, r.order || 0); }, -1);
    var room = rd.room ? Object.assign({}, rd.room, { name: name, color: rd.color, updatedAt: now })
      : { id: U.uid('r'), name: name, color: rd.color, order: maxOrder + 1, createdAt: now, updatedAt: now };
    DB.put('rooms', room).then(function () {
      closeSheet($('#sheetRoom'));
      if (rd.onCreated) rd.onCreated(room.id);
      U.toast(rd.room ? 'Raum gespeichert' : 'Raum „' + name + '“ angelegt');
    }, function (err) { U.toast('Speichern hat nicht geklappt: ' + (err && err.message || err)); });
  });
  $('#rDelete').addEventListener('click', function () {
    if (!roomDraft || !roomDraft.room) return;
    var room = roomDraft.room;
    var items = DB.items.filter(function (it) { return it.roomId === room.id; });
    var places = DB.places.filter(function (p) { return p.roomId === room.id; });
    var parts = [];
    if (items.length) parts.push(U.plural(items.length, 'Gegenstand', 'Gegenstände'));
    if (places.length) parts.push(U.plural(places.length, 'Möbelstück oder Kiste', 'Möbel und Kisten'));
    askConfirm('„' + room.name + '“ löschen?', parts.length ? parts.join(' und ') + ' kommen danach unter „Ohne Raum“. Gelöscht wird nur der Raum.' : 'Der Raum ist leer.').then(function (ok) {
      if (!ok) return;
      var now = Date.now();
      DB.write({
        rooms: { del: [room.id] },
        items: { put: items.map(function (it) { return Object.assign({}, it, { roomId: '', updatedAt: now }); }) },
        places: { put: places.map(function (p) { return Object.assign({}, p, { roomId: '', updatedAt: now }); }) }
      }).then(function () {
        closeSheet($('#sheetRoom'));
        if (S.room === room.id) { S.room = 'all'; prefs.room = 'all'; savePrefs(); }
        if (S.route === 'room' && S.arg === room.id) go('places');
        U.toast('Raum gelöscht');
      }, function (err) { U.toast('Löschen hat nicht geklappt: ' + (err && err.message || err)); });
    });
  });

  /* =========================================================
   * Möbel, Kisten, Fächer
   * ========================================================= */
  var placeDraft = null;
  function setKind(kind) {
    $$('#pKind [data-kind]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.kind === kind)); });
    $('#pTargetField').hidden = kind !== 'kiste';
  }
  function fillParentSelect(roomId, selected) {
    var exclude = placeDraft && placeDraft.place ? M.descendantIds(placeDraft.place.id) : null;
    $('#p-parent').innerHTML = placeOptionsHTML(roomId, selected, { emptyLabel: 'Direkt im Raum', exclude: exclude });
  }
  function openPlaceEditor(place, preset, onCreated) {
    preset = preset || {};
    var kind = place ? place.kind || 'sonst' : preset.kind || (preset.parentId ? 'fach' : 'moebel');
    placeDraft = { place: place, kind: kind, codeTouched: !!place, onCreated: onCreated || null };
    $('#pTitle').textContent = place ? 'Bearbeiten' : 'Möbel, Kiste oder Fach';
    var roomId = place ? M.placeRoomId(place) : (preset.roomId || '');
    if (roomId && !M.room(roomId)) roomId = '';
    $('#p-room').innerHTML = roomOptionsHTML(roomId, false);
    fillParentSelect(roomId, place ? (place.parentId && M.place(place.parentId) ? place.parentId : '') : (preset.parentId || ''));
    $('#p-name').value = place ? place.name : '';
    $('#p-code').value = place ? place.code || '' : M.nextCode(kind);
    $('#p-note').value = place ? place.note || '' : '';
    $('#p-target').innerHTML = '<option value="">Kein Zielraum</option>' + M.rooms().map(function (r) { return '<option value="' + esc(r.id) + '"' + (place && place.moveTarget === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
    $('#pNameField').classList.remove('err');
    $('#pDelete').hidden = !place;
    setKind(kind);
    onClose.sheetPlace = function () { placeDraft = null; };
    openSheet($('#sheetPlace'));
    if (!place) setTimeout(function () { $('#p-name').focus(); }, 60);
  }
  $('#pKind').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kind]'); if (!b || !placeDraft) return;
    placeDraft.kind = b.dataset.kind;
    setKind(placeDraft.kind);
    if (!placeDraft.codeTouched) $('#p-code').value = M.nextCode(placeDraft.kind);
  });
  $('#p-code').addEventListener('input', function () { if (placeDraft) placeDraft.codeTouched = true; });
  $('#p-room').addEventListener('change', function () { fillParentSelect($('#p-room').value, ''); });
  $('#placeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!placeDraft) return;
    var name = $('#p-name').value.trim();
    if (!name) { $('#pNameField').classList.add('err'); $('#p-name').focus(); return; }
    var pd = placeDraft, now = Date.now();
    var parentId = $('#p-parent').value || '';
    var roomId = parentId ? M.placeRoomId(M.place(parentId)) : $('#p-room').value;
    var code = $('#p-code').value.trim().toUpperCase().slice(0, 12);
    var dup = code && DB.places.some(function (p) { return p.code && p.code.toUpperCase() === code && (!pd.place || p.id !== pd.place.id); });
    if (dup) { U.toast('Die Nummer ' + code + ' gibt es schon. Nimm eine andere.'); $('#p-code').focus(); return; }
    var data = { name: name, kind: pd.kind, roomId: roomId, parentId: parentId, code: code, note: $('#p-note').value.trim(), moveTarget: pd.kind === 'kiste' ? $('#p-target').value : '', updatedAt: now };
    var place = pd.place ? Object.assign({}, pd.place, data) : Object.assign({ id: U.uid('o'), createdAt: now, moveStatus: '' }, data);
    // Unterbereiche bekommen denselben Raum
    var kids = pd.place ? Array.from(M.descendantIds(place.id)).filter(function (id) { return id !== place.id; }).map(M.place).filter(Boolean)
      .map(function (p) { return Object.assign({}, p, { roomId: roomId, updatedAt: now }); }) : [];
    DB.write({ places: { put: [place].concat(kids) } }).then(function () {
      closeSheet($('#sheetPlace'));
      if (pd.onCreated) pd.onCreated(place.id);
      U.toast(pd.place ? 'Gespeichert' : KIND[place.kind] + ' „' + name + '“ angelegt');
    }, function (err) { U.toast('Speichern hat nicht geklappt: ' + (err && err.message || err)); });
  });
  $('#pDelete').addEventListener('click', function () {
    if (!placeDraft || !placeDraft.place) return;
    var p = placeDraft.place, parent = M.place(p.parentId), rid = M.placeRoomId(p);
    var items = DB.items.filter(function (it) { return it.placeId === p.id; });
    var kids = DB.places.filter(function (x) { return x.parentId === p.id; });
    var dest = parent ? M.placeLabel(parent) : ((M.room(rid) || { name: 'Ohne Raum' }).name);
    var what = [];
    if (items.length) what.push(U.plural(items.length, 'Gegenstand', 'Gegenstände'));
    if (kids.length) what.push(U.plural(kids.length, 'Unterbereich', 'Unterbereiche'));
    askConfirm('„' + p.name + '“ löschen?', what.length ? what.join(' und ') + ' kommen danach nach „' + dest + '“. Gelöscht wird nur ' + (p.kind === 'kiste' ? 'die Kiste' : 'der Ort') + '.' : 'Hier liegt nichts drin.').then(function (ok) {
      if (!ok) return;
      var now = Date.now();
      DB.write({
        places: { del: [p.id], put: kids.map(function (k) { return Object.assign({}, k, { parentId: p.parentId || '', roomId: rid, updatedAt: now }); }) },
        items: { put: items.map(function (it) { return Object.assign({}, it, { placeId: p.parentId && parent ? p.parentId : '', roomId: rid, updatedAt: now }); }) }
      }).then(function () {
        closeSheet($('#sheetPlace'));
        if (S.route === 'place' && S.arg === p.id) go(parent ? 'place/' + parent.id : 'room/' + (rid || 'none'));
        U.toast('Gelöscht');
      }, function (err) { U.toast('Löschen hat nicht geklappt: ' + (err && err.message || err)); });
    });
  });

  /* =========================================================
   * Verschieben
   * ========================================================= */
  var moveIds = null, moveDone = null;
  function openMove(ids, done) {
    moveIds = ids; moveDone = done || null;
    var first = M.item(ids[0]);
    var rid = ids.length === 1 && first ? M.roomIdOf(first) : '';
    var pid = ids.length === 1 && first ? M.validPlaceId(first) : '';
    $('#mTitle').textContent = ids.length === 1 ? 'Verschieben' : U.plural(ids.length, 'Gegenstand', 'Gegenstände') + ' verschieben';
    $('#m-room').innerHTML = roomOptionsHTML(rid, false);
    $('#m-place').innerHTML = placeOptionsHTML(rid, pid, {});
    $('#mSpotField').hidden = ids.length !== 1;
    $('#m-spot').value = ids.length === 1 && first ? first.spot || '' : '';
    onClose.sheetMove = function () { moveIds = null; moveDone = null; };
    openSheet($('#sheetMove'));
  }
  $('#m-room').addEventListener('change', function () { $('#m-place').innerHTML = placeOptionsHTML($('#m-room').value, '', {}); });
  $('#moveForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!moveIds) return;
    var roomId = $('#m-room').value, placeId = $('#m-place').value, single = moveIds.length === 1, now = Date.now(), done = moveDone;
    var list = moveIds.map(M.item).filter(Boolean).map(function (it) {
      var n = Object.assign({}, it, { roomId: roomId, placeId: placeId, updatedAt: now });
      if (single) n.spot = $('#m-spot').value.trim();
      var txt = locationChangeText(it, n);
      if (txt) n.history = histPush(it, txt);
      return n;
    });
    DB.put('items', list).then(function () {
      closeSheet($('#sheetMove'));
      var target = placeId ? M.placeLabel(M.place(placeId)) : ((M.room(roomId) || { name: 'Ohne Raum' }).name);
      U.toast('Verschoben nach ' + target);
      if (done) done();
    }, function (err) { U.toast('Verschieben hat nicht geklappt: ' + (err && err.message || err)); });
  });

  /* =========================================================
   * Viele Fotos auf einmal
   * ========================================================= */
  var batch = null;
  function openBatch(preset) {
    preset = preset || {};
    if (batch) discardBatch();
    batch = { entries: [], closed: false, busy: 0 };
    var rid = preset.roomId !== undefined ? preset.roomId : (prefs.lastRoom || '');
    if (rid && !M.room(rid)) rid = '';
    $('#b-room').innerHTML = roomOptionsHTML(rid, false);
    $('#b-place').innerHTML = placeOptionsHTML($('#b-room').value, preset.placeId || '', {});
    $('#b-cat').value = '';
    fillDatalists('');
    $('#bList').innerHTML = '';
    updateBatchFoot();
    onClose.sheetBatch = discardBatch;
    openSheet($('#sheetBatch'));
  }
  $('#b-room').addEventListener('change', function () { $('#b-place').innerHTML = placeOptionsHTML($('#b-room').value, '', {}); });
  function discardBatch() {
    if (!batch) return;
    var b = batch; batch = null; b.closed = true;
    var ids = [];
    b.entries.forEach(function (en) { if (!en.saved) ids.push(en.id, en.t); if (en.preview) URL.revokeObjectURL(en.preview); });
    DB.delBlobs(ids);
  }
  function batchItemHTML(en) {
    return '<div class="bitem" data-key="' + en.key + '"><div class="pv"></div><div><label class="sr-only" for="bn-' + en.key + '">Name</label>' +
      '<input id="bn-' + en.key + '" type="text" maxlength="120" placeholder="Name" data-bname="' + en.key + '" autocomplete="off"><div class="suggest"></div></div>' +
      '<button class="icon-btn" type="button" data-bremove="' + en.key + '" aria-label="Foto entfernen">' + ICON.close + '</button></div>';
  }
  function updateBatchItem(en) {
    var el = $('.bitem[data-key="' + en.key + '"]', $('#bList'));
    if (!el) return;
    $('.pv', el).innerHTML = en.preview ? '<img src="' + esc(en.preview) + '" alt="">' : '<div class="busy"><div class="spinner"></div></div>';
    var inp = $('input', el);
    if (!en.touched && inp.value !== en.name) inp.value = en.name || '';
    var sug = $('.suggest', el);
    if (en.state === 'recog') sug.innerHTML = '<span class="spinner dark"></span> erkenne …';
    else if (en.sug && en.sug.length) sug.innerHTML = en.sug.map(function (s, i) { return '<button type="button" data-bsug="' + en.key + ':' + i + '">' + esc(s.name) + '</button>'; }).join('');
    else sug.innerHTML = '';
  }
  function updateBatchFoot() {
    if (!batch) return;
    var ready = batch.entries.filter(function (e) { return e.id; }).length;
    $('#bStatus').textContent = batch.busy ? 'Verarbeite Fotos … (' + ready + ' von ' + batch.entries.length + ' fertig)' : (batch.entries.length ? U.plural(ready, 'Foto', 'Fotos') + ' bereit' : '');
    $('#bSave').disabled = !ready || batch.busy > 0;
    $('#bSave').textContent = ready ? U.plural(ready, 'Gegenstand', 'Gegenstände') + ' speichern' : 'Speichern';
  }
  $('#batchInput').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!batch || !files.length) return;
    var b = batch;
    if (b.entries.length + files.length > 60) { U.toast('Höchstens 60 Fotos auf einmal.'); files = files.slice(0, Math.max(0, 60 - b.entries.length)); }
    var entries = files.map(function () { return { key: U.uid(), id: '', t: '', preview: '', name: '', touched: false, sug: [], state: 'processing' }; });
    entries.forEach(function (en) { b.entries.push(en); $('#bList').insertAdjacentHTML('beforeend', batchItemHTML(en)); updateBatchItem(en); });
    b.busy += entries.length;
    updateBatchFoot();
    var chain = Promise.resolve();
    files.forEach(function (f, i) {
      var en = entries[i];
      chain = chain.then(function () {
        if (b.closed || en.removed) return;
        return U.processImage(f).then(function (r) {
          var fid = U.uid('p'), tid = U.uid('t');
          return DB.putBlob(fid, r.full).then(function () { return DB.putBlob(tid, r.thumb); }).then(function () {
            if (b.closed || en.removed) { DB.delBlobs([fid, tid]); return; }
            en.id = fid; en.t = tid; en.preview = URL.createObjectURL(r.thumb);
            if (recogOn()) {
              en.state = 'recog'; updateBatchItem(en);
              return W.Recognizer.classify(r.thumb, 3).then(function (res) {
                en.sug = res;
                if (!en.touched && res[0]) { en.name = res[0].name; en.cat = ['Tier', 'Pflanze', 'Sonstiges'].indexOf(res[0].category) < 0 ? res[0].category : ''; }
              }, function () { en.sug = []; });
            }
          });
        }).catch(function () {
          en.failed = true;
          if (!b.closed) U.toast('Ein Foto konnte nicht gelesen werden.');
        }).then(function () {
          b.busy--;
          en.state = 'done';
          if (b === batch && !b.closed) {
            if (en.failed) { var el = $('.bitem[data-key="' + en.key + '"]', $('#bList')); if (el) el.remove(); b.entries = b.entries.filter(function (x) { return x !== en; }); }
            else updateBatchItem(en);
            updateBatchFoot();
          }
        });
      });
    });
  });
  $('#bList').addEventListener('input', function (e) {
    var k = e.target.dataset.bname; if (!k || !batch) return;
    var en = batch.entries.filter(function (x) { return x.key === k; })[0];
    if (en) { en.name = e.target.value; en.touched = true; e.target.closest('.bitem').classList.remove('err'); }
  });
  $('#bList').addEventListener('click', function (e) {
    if (!batch) return;
    var rm = e.target.closest('[data-bremove]'), sg = e.target.closest('[data-bsug]');
    if (rm) {
      var en = batch.entries.filter(function (x) { return x.key === rm.dataset.bremove; })[0];
      if (!en) return;
      en.removed = true;
      batch.entries = batch.entries.filter(function (x) { return x !== en; });
      DB.delBlobs([en.id, en.t]);
      if (en.preview) URL.revokeObjectURL(en.preview);
      rm.closest('.bitem').remove();
      updateBatchFoot();
    }
    if (sg) {
      var parts = sg.dataset.bsug.split(':'), en2 = batch.entries.filter(function (x) { return x.key === parts[0]; })[0];
      if (!en2 || !en2.sug[+parts[1]]) return;
      var s = en2.sug[+parts[1]];
      en2.name = s.name; en2.touched = true;
      en2.cat = ['Tier', 'Pflanze', 'Sonstiges'].indexOf(s.category) < 0 ? s.category : '';
      var inp = $('input[data-bname="' + en2.key + '"]', $('#bList'));
      if (inp) { inp.value = s.name; inp.closest('.bitem').classList.remove('err'); }
    }
  });
  $('#bSave').addEventListener('click', function () {
    if (!batch || batch.busy) return;
    var ready = batch.entries.filter(function (en) { return en.id; });
    var missing = ready.filter(function (en) { return !String(en.name || '').trim(); });
    missing.forEach(function (en) { var el = $('.bitem[data-key="' + en.key + '"]', $('#bList')); if (el) el.classList.add('err'); });
    if (missing.length) { U.toast(U.plural(missing.length, 'Foto hat', 'Fotos haben') + ' noch keinen Namen.'); return; }
    var roomId = $('#b-room').value, placeId = $('#b-place').value, cat = $('#b-cat').value.trim(), now = Date.now();
    var list = ready.map(function (en, i) {
      var it = {
        id: U.uid('i'), name: String(en.name).trim(), roomId: roomId, placeId: placeId, spot: '', category: cat || en.cat || '', tags: [], qty: 1,
        photos: [{ id: en.id, t: en.t }], docs: [], value: null, bought: '', warranty: '', serial: '', expiry: '', minQty: 0, tasks: [],
        lentTo: '', lentSince: '', disposition: '', price: null, notes: '', history: [], createdAt: now + i, updatedAt: now + i
      };
      it.history.push({ t: now, text: 'Erfasst in ' + M.locText(it) });
      return it;
    });
    $('#bSave').disabled = true;
    DB.put('items', list).then(function () {
      ready.forEach(function (en) { en.saved = true; });
      prefs.lastRoom = roomId; savePrefs();
      requestPersist();
      closeSheet($('#sheetBatch'));
      U.toast(U.plural(list.length, 'Gegenstand', 'Gegenstände') + ' gespeichert');
    }, function (err) { $('#bSave').disabled = false; U.toast('Speichern hat nicht geklappt: ' + (err && err.message || err)); });
  });

  /* =========================================================
   * Scannen
   * ========================================================= */
  function openScanner() {
    $('#scanStatus').textContent = 'Kamera wird gestartet …';
    onClose.sheetScan = function () { W.Scanner.stop(); };
    openSheet($('#sheetScan'));
    W.Scanner.start($('#scanVideo'), handleScan, function (msg) { $('#scanStatus').textContent = msg; }).catch(function () {
      $('#scanStatus').textContent = 'Die Kamera ist nicht verfügbar oder wurde nicht erlaubt. Mach stattdessen ein Foto vom Etikett.';
    });
  }
  function handleScan(text) {
    var m = /#\/place\/([^\/?#\s]+)/.exec(text || '');
    if (m) {
      var id = decodeURIComponent(m[1]);
      if (M.place(id)) { closeSheet($('#sheetScan')); go('place/' + encodeURIComponent(id)); U.toast('Etikett erkannt'); return; }
      U.toast('Diese Kiste ist in dieser App nicht gespeichert.');
    } else {
      U.toast('Das ist kein Etikett von „Wo ist was“.');
    }
    if (!$('#sheetScan').hidden) setTimeout(function () {
      if ($('#sheetScan').hidden) return;
      W.Scanner.start($('#scanVideo'), handleScan, function (msg) { $('#scanStatus').textContent = msg; }).catch(function () { /* Hinweis steht schon da */ });
    }, 1500);
  }
  $('#scanBtn').addEventListener('click', openScanner);
  $('#scanFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('#scanStatus').textContent = 'Lese das Foto …';
    W.Scanner.stop();
    W.Scanner.decodeFile(f).then(function (txt) {
      if (txt) handleScan(txt);
      else { $('#scanStatus').textContent = 'Auf dem Foto war kein QR-Code zu erkennen. Versuch es näher und mit mehr Licht.'; }
    }, function () { $('#scanStatus').textContent = 'Das Foto konnte nicht gelesen werden.'; });
  });

  /* =========================================================
   * Export, Sicherung, Kalender
   * ========================================================= */
  var busyExport = false;
  function runExport(label, job) {
    if (busyExport) { U.toast('Einen Moment, es läuft schon ein Export.'); return; }
    busyExport = true;
    U.toast(label + ' …', { ms: 0 });
    return job().then(function (r) { busyExport = false; return r; }, function (err) {
      busyExport = false;
      console.error(err);
      U.toast(label + ' hat nicht geklappt: ' + (err && err.message || err));
    });
  }
  function dateTag() { return U.today(); }
  function doBackup() {
    runExport('Sicherung wird erstellt', function () {
      return X.backup(function (i, n) { $('#toastMsg').textContent = 'Sicherung wird erstellt … ' + i + ' von ' + n + ' Dateien'; }).then(function (blob) {
        $('#toast').hidden = true;
        return offerFile(blob, 'wo-ist-was-sicherung-' + dateTag() + '.zip', 'Tipp: Wähle „In Dateien sichern“ und leg die Sicherung in iCloud Drive. Dann ist sie auch sicher, wenn dem iPhone etwas passiert.');
      }).then(function (res) {
        if (res !== 'cancelled') { DB.setMeta('lastBackup', Date.now()).then(render); U.toast('Sicherung erstellt'); }
      });
    });
  }
  function doReport() {
    if (!DB.items.length) { U.toast('Noch keine Gegenstände für einen Bericht.'); return; }
    runExport('Bericht wird erstellt', function () {
      return X.reportPdf(function (i, n) { $('#toastMsg').textContent = 'Bericht wird erstellt … Foto ' + i + ' von ' + n; }).then(function (blob) {
        $('#toast').hidden = true;
        return offerFile(blob, 'inventar-bericht-' + dateTag() + '.pdf');
      });
    });
  }
  function doLabels(places, name) {
    if (!places.length) { U.toast('Keine passenden Orte für Etiketten.'); return; }
    runExport('Etiketten werden erstellt', function () {
      return X.labelsPdf(places).then(function (blob) {
        $('#toast').hidden = true;
        return offerFile(blob, (name || 'etiketten') + '-' + dateTag() + '.pdf', 'Druck die PDF in Originalgröße auf A4 (10 Etiketten pro Seite), schneid die Etiketten aus und kleb sie auf.');
      });
    });
  }
  function doCsv() {
    var blob = new Blob([X.csv()], { type: 'text/csv' });
    U.saveFile(blob, 'inventar-' + dateTag() + '.csv', 'Inventar');
  }
  function doCalendar(onlyNew) {
    var ev = X.icsEvents(), done = DB.meta.icsDone || [];
    var list = onlyNew ? ev.filter(function (e) { return done.indexOf(e.uid) < 0; }) : ev;
    if (!list.length) { U.toast('Keine neuen Termine.'); return; }
    var blob = new Blob([X.icsText(list)], { type: 'text/calendar' });
    U.saveFile(blob, 'wo-ist-was-termine.ics', 'Termine').then(function (res) {
      if (res === 'cancelled') return;
      var current = new Set(ev.map(function (e) { return e.uid; }));
      var merged = done.filter(function (u) { return current.has(u); }).concat(list.map(function (e) { return e.uid; }));
      DB.setMeta('icsDone', Array.from(new Set(merged))).then(render);
      U.toast(U.plural(list.length, 'Termin', 'Termine') + ' exportiert. Öffne die Datei, um sie in den Kalender zu übernehmen.');
    });
  }
  function enableBadge() {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(function (p) {
      if (p === 'granted') U.toast('Die Zahl am App-Symbol ist jetzt aktiv.');
      else U.toast('Ohne Erlaubnis kann die App keine Zahl am Symbol zeigen.');
      render();
    });
  }
  var lastBadge = -1;
  function updateAppBadge(n) {
    if (n === lastBadge || !('setAppBadge' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    lastBadge = n;
    try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () { /* egal */ }); } catch (e) { /* egal */ }
  }
  function openLabelsMenu() {
    var boxes = DB.places.filter(function (p) { return p.kind === 'kiste'; }).sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); });
    var all = DB.places.slice().sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); });
    var moving = boxes.filter(function (p) { return p.moveTarget; });
    if (!all.length) { U.toast('Leg zuerst Möbel oder Kisten an.'); return; }
    openMenu('QR-Etiketten drucken', [
      { label: 'Alle Kisten', meta: U.plural(boxes.length, 'Etikett', 'Etiketten'), disabled: !boxes.length, run: function () { doLabels(boxes, 'etiketten-kisten'); } },
      { label: 'Alle Möbel, Kisten und Fächer', meta: U.plural(all.length, 'Etikett', 'Etiketten'), run: function () { doLabels(all, 'etiketten'); } },
      { label: 'Nur Umzugskisten mit Zielraum', meta: U.plural(moving.length, 'Etikett', 'Etiketten'), disabled: !moving.length, run: function () { doLabels(moving, 'etiketten-umzug'); } }
    ], '<p class="lead">Scannst du ein Etikett mit dem Scan-Symbol oben rechts, öffnet die App direkt den Inhalt der Kiste.</p>');
  }
  function openStorageInfo() {
    var est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
    var per = navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null);
    Promise.all([est, per]).then(function (r) {
      var e = r[0], p = r[1];
      var html = '<p class="lead">Alle Einträge, Fotos und Belege liegen nur auf diesem Gerät. Nichts wird ins Internet geschickt.</p>';
      if (e && e.usage != null) html += '<p class="lead">Belegt: <b>' + U.fmtBytes(e.usage) + '</b>' + (e.quota ? ' von etwa ' + U.fmtBytes(e.quota) : '') + '.</p>';
      html += '<p class="lead">' + (p === true ? 'Der Speicher ist dauerhaft geschützt.' : U.isStandalone() ? 'Installierte Apps werden von iOS nicht automatisch geleert.' : 'Tipp: Installiere die App auf dem Home-Bildschirm, dann bleibt der Speicher erhalten.') + '</p>';
      html += '<p class="lead">Mach trotzdem regelmäßig eine Sicherung (Mehr › Sicherung erstellen). Sie ist dein einziger Schutz, falls das Gerät verloren geht.</p>';
      openMenu('Speicher', [], html);
    });
  }
  function requestPersist() {
    if (prefs.persistAsked || !navigator.storage || !navigator.storage.persist) return;
    prefs.persistAsked = true; savePrefs();
    navigator.storage.persist().catch(function () { /* egal */ });
  }
  $('#restoreInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    X.readBackup(f).then(function (parsed) {
      var d = parsed.data;
      var nItems = parsed.kind === 'legacy' ? (d.gegenstaende || []).length : (d.items || []).length;
      var info = '<p class="lead">In der Datei: <b>' + U.plural(nItems, 'Gegenstand', 'Gegenstände') + '</b>' + (parsed.kind === 'legacy' ? '. Das ist ein Export der claude.ai-Version. Fotos sind darin nicht enthalten.' : '.') + '</p>';
      var run = function (mode) {
        return function () {
          var go2 = function () {
            runExport('Sicherung wird eingespielt', function () {
              return X.restore(parsed, mode, function (i, n) { $('#toastMsg').textContent = 'Sicherung wird eingespielt … ' + i + ' von ' + n + ' Dateien'; }).then(function (r) {
                U.toast('Fertig: ' + U.plural(r.items, 'Gegenstand', 'Gegenstände') + ', ' + U.plural(r.rooms, 'Raum', 'Räume') + ' und ' + U.plural(r.places, 'Ort', 'Orte') + ' übernommen.');
                render();
              });
            });
          };
          if (mode === 'replace') askConfirm('Alles ersetzen?', 'Alle Einträge und Fotos auf diesem Gerät werden gelöscht und durch die Sicherung ersetzt.', 'Ersetzen').then(function (ok) { if (ok) go2(); });
          else go2();
        };
      };
      openMenu('Sicherung einspielen', [
        { label: 'Hinzufügen', meta: 'Vorhandene Einträge bleiben. Gleiche Einträge werden aktualisiert.', run: run('merge') },
        { label: 'Alles ersetzen', meta: 'Löscht alles auf diesem Gerät und spielt die Sicherung ein.', danger: true, run: run('replace') }
      ], info);
    }, function (err) { U.toast('Die Datei konnte nicht gelesen werden: ' + (err && err.message || err)); });
  });

  function shoppingText() {
    var d = M.due();
    return 'Einkaufsliste\n' + d.shopping.map(function (x) {
      var need = (parseInt(x.it.minQty, 10) || 0) - M.qty(x.it);
      return '• ' + x.it.name + (need > 0 ? ' (' + need + ' Stück)' : '');
    }).join('\n');
  }
  function adText(it) {
    var lines = ['Verkaufe: ' + it.name];
    if (it.category) lines.push('Kategorie: ' + it.category);
    if (it.bought) { var d = U.parseDay(it.bought); lines.push('Gekauft: ' + d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })); }
    if (it.warranty && U.daysUntil(it.warranty) >= 0) lines.push('Noch Garantie bis ' + U.fmtDay(it.warranty));
    if (M.qty(it) > 1) lines.push('Anzahl: ' + M.qty(it));
    if (it.notes) lines.push('', it.notes);
    lines.push('', 'Preis: ' + (it.price ? U.money(it.price) + ' VB' : 'VB'), 'Abholung oder Versand nach Absprache. Privatverkauf, keine Garantie oder Rücknahme.');
    return lines.join('\n');
  }
  function photoFiles(it) {
    return Promise.all((it.photos || []).slice(0, 5).map(function (p, i) {
      return DB.getBlob(p.id).then(function (b) { return b ? new File([b], 'foto-' + (i + 1) + '.jpg', { type: 'image/jpeg' }) : null; });
    })).then(function (fs) { return fs.filter(Boolean); });
  }

  /* =========================================================
   * Klicks in der Hauptansicht
   * ========================================================= */
  var ACTIONS = {
    'add-item': function (el) { openEditor(null, presetFrom(el)); },
    'add-batch': function (el) { openBatch(presetFrom(el)); },
    'add-place': function (el) { var p = presetFrom(el); openPlaceEditor(null, { roomId: p.roomId || '', parentId: p.placeId || '' }); },
    'add-room': function () { openRoomEditor(null); },
    'edit-room': function (el) { var r = M.room(el.dataset.id); if (r) openRoomEditor(r); },
    'edit-place': function (el) { var p = M.place(el.dataset.id); if (p) openPlaceEditor(p); },
    'label-place': function (el) { var p = M.place(el.dataset.id); if (p) doLabels([p], 'etikett-' + (p.code || 'ort').toLowerCase()); },
    'select': enterSelect,
    'reset-filters': function () { S.room = 'all'; S.status = 'all'; prefs.room = 'all'; savePrefs(); setQuery(''); },
    'dismiss-install': function () { prefs.installDismissed = true; savePrefs(); render(); },
    'cal-new': function () { doCalendar(true); },
    'cal-all': function () { doCalendar(false); },
    'badge': enableBadge,
    'backup': doBackup,
    'restore': function () { $('#restoreInput').click(); },
    'csv': doCsv,
    'report': doReport,
    'labels': openLabelsMenu,
    'labels-boxes': function () { doLabels(DB.places.filter(function (p) { return p.kind === 'kiste'; }).sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); }), 'etiketten-kisten'); },
    'recog': function () {
      prefs.recog = !recogOn(); savePrefs(); render();
      U.toast(recogOn() ? 'Bilderkennung ist an' : 'Bilderkennung ist aus');
      if (recogOn()) W.Recognizer.load().catch(function () { U.toast('Die Bilderkennung konnte nicht geladen werden.'); });
    },
    'storage': openStorageInfo,
    'share-shopping': function () { openText('Einkaufsliste', shoppingText()); },
    'ad': function (el) { var it = M.item(el.dataset.id); if (it) openText('Anzeigentext', adText(it), photoFiles(it)); },
    'so-keep': function (el) { var it = M.item(el.dataset.id); if (it) updateItem(it, { disposition: '', price: null }, 'Doch behalten').then(function () { U.toast('Bleibt im Inventar'); }); },
    'so-done': function (el) {
      var it = M.item(el.dataset.id); if (!it) return;
      askConfirm('„' + it.name + '“ ist weg?', 'Der Eintrag und seine Fotos werden aus dem Inventar gelöscht.', 'Ja, löschen').then(function (ok) {
        if (!ok) return;
        DB.del('items', [it.id]).then(function () { DB.delBlobs(blobIdsOf(it)); U.toast('Aus dem Inventar entfernt'); });
      });
    },
    'new-box': function () { openPlaceEditor(null, { kind: 'kiste', roomId: '' }); },
    'new': function () { openNewMenu(); },
    'scan': function () { openScanner(); }
  };
  function presetFrom(el) {
    var p = {};
    if (el && el.dataset.room !== undefined) p.roomId = el.dataset.room;
    if (el && el.dataset.place) p.placeId = el.dataset.place;
    return p;
  }
  view.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-item]'))) {
      e.preventDefault();
      var id = t.dataset.item;
      if (S.selecting && t.classList.contains('card')) {
        if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
        var sel = S.selected.has(id);
        t.classList.toggle('is-selected', sel);
        t.setAttribute('aria-pressed', String(sel));
        var ck = $('.check', t); if (ck) ck.innerHTML = sel ? ICON.check : '';
        updateSelCount();
        return;
      }
      openDetail(id); return;
    }
    if ((t = e.target.closest('[data-chip]'))) { S.room = t.dataset.chip; prefs.room = S.room; savePrefs(); render(); return; }
    if ((t = e.target.closest('[data-act]'))) { var fn = ACTIONS[t.dataset.act]; if (fn) fn(t); return; }
    if ((t = e.target.closest('[data-task-done]'))) { taskDone(t.dataset.taskDone, t.dataset.task); return; }
    if ((t = e.target.closest('[data-qty]'))) { changeQty(t.dataset.id, +t.dataset.qty); return; }
    if ((t = e.target.closest('[data-mstatus]'))) { setMoveStatus(t.dataset.id, t.dataset.mstatus); return; }
  });
  view.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'statusSel') { S.status = t.value; render(); }
    else if (t.id === 'sortSel') { S.sort = t.value; prefs.sort = t.value; savePrefs(); render(); }
    else if (t.dataset.target) {
      var p = M.place(t.dataset.target); if (!p) return;
      DB.put('places', Object.assign({}, p, { moveTarget: t.value, updatedAt: Date.now() }));
    }
  });
  function setMoveStatus(id, status) {
    var p = M.place(id); if (!p || (p.moveStatus || '') === status) return;
    var patch = { moveStatus: status, updatedAt: Date.now() };
    var moved = false;
    if (status === 'ausgepackt' && p.moveTarget && M.room(p.moveTarget) && M.placeRoomId(p) !== p.moveTarget) {
      patch.roomId = p.moveTarget; patch.parentId = ''; moved = true;
    }
    var list = [Object.assign({}, p, patch)];
    if (moved) {
      M.descendantIds(p.id).forEach(function (cid) { if (cid !== p.id) { var c = M.place(cid); if (c) list.push(Object.assign({}, c, { roomId: p.moveTarget, updatedAt: Date.now() })); } });
    }
    DB.put('places', list).then(function () {
      if (moved) U.toast((p.code || p.name) + ' ist jetzt in ' + M.room(p.moveTarget).name);
    });
  }

  /* ---------- Suche ---------- */
  var qTimer = null;
  function setQuery(v) {
    $('#q').value = v; S.q = v; $('#qClear').hidden = !v;
    if (S.route !== 'items') go('items'); else render();
  }
  $('#q').addEventListener('input', function (e) {
    var v = e.target.value;
    $('#qClear').hidden = !v;
    clearTimeout(qTimer);
    if (S.route === 'home' && v.trim()) { S.q = v; go('items'); return; }
    qTimer = setTimeout(function () { S.q = v; render(); }, 150);
  });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });
  $('#qClear').addEventListener('click', function () { setQuery(''); $('#q').focus(); });

  /* ---------- Kopf ---------- */
  $('#backBtn').addEventListener('click', function () {
    if (S.route === 'place') {
      var p = M.place(S.arg);
      if (p && p.parentId && M.place(p.parentId)) go('place/' + encodeURIComponent(p.parentId));
      else go('room/' + encodeURIComponent(p ? (M.placeRoomId(p) || 'none') : 'none'));
    } else if (S.route === 'room') go('places');
    else if (TOP_ROUTES.indexOf(S.route) >= 0) go('');
    else go('more');
  });
  $('#fab').addEventListener('click', openNewMenu);
  function openNewMenu() {
    var preset = {};
    if (S.route === 'room') preset.roomId = S.arg === 'none' ? '' : S.arg;
    if (S.route === 'place' && M.place(S.arg)) { preset.placeId = S.arg; preset.roomId = M.placeRoomId(M.place(S.arg)); }
    if (S.route === 'items' && S.room !== 'all' && S.room !== 'none') preset.roomId = S.room;
    openMenu('Neu', [
      { label: 'Gegenstand erfassen', meta: 'Mit Foto, Ort und Details', run: function () { openEditor(null, preset); } },
      { label: 'Viele Fotos auf einmal', meta: 'Jedes Foto wird ein eigener Gegenstand', run: function () { openBatch(preset); } },
      { label: 'Möbel, Kiste oder Fach', meta: 'Zum Beispiel Regal, Schrank oder Umzugskiste', run: function () { openPlaceEditor(null, { roomId: preset.roomId || '', parentId: preset.placeId || '' }); } },
      { label: 'Raum', meta: 'Zum Beispiel Garage, Dachboden oder Auto', run: function () { openRoomEditor(null); } }
    ]);
  }

  /* =========================================================
   * Start
   * ========================================================= */
  function seedRooms() {
    if (DB.meta.seeded || DB.rooms.length) return Promise.resolve();
    var now = Date.now();
    var rooms = DEFAULT_ROOMS.map(function (n, i) { return { id: U.uid('r'), name: n, color: U.PALETTE[i % U.PALETTE.length], order: i, createdAt: now, updatedAt: now }; });
    return DB.put('rooms', rooms).then(function () { return DB.setMeta('seeded', true); });
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    if (/[?&]nosw\b/.test(location.search)) return; // nur zum Testen während der Entwicklung
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            U.toast('Eine neue Version ist da.', { action: 'Neu laden', ms: 0, onAction: function () { nw.postMessage('SKIP_WAITING'); } });
          }
        });
      });
    }).catch(function (e) { console.warn('Service Worker nicht registriert', e); });
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloaded) return; reloaded = true; location.reload(); });
  }

  DB.on(reindex);
  DB.on(render);
  parseHash();
  DB.open().then(function () {
    reindex();
    return seedRooms();
  }).then(function () {
    S.ready = true;
    render();
    registerSW();
    // Bilderkennung im Hintergrund vorbereiten, damit sie beim ersten Foto schnell ist
    if (recogOn() && DB.persistent) setTimeout(function () { W.Recognizer.load().catch(function () { /* wird beim Foto erneut versucht */ }); }, 4000);
  }).catch(function (e) {
    console.error(e);
    view.innerHTML = '<div class="empty"><h2>Die App konnte nicht starten</h2><p>' + esc(e && e.message || e) + '</p></div>';
  });
})(window.W = window.W || {});
