/* Wo ist was – Oberfläche */
(function (W) {
  'use strict';
  var U = W.U, DB = W.DB, X = W.Export, $ = U.$, $$ = U.$$, esc = U.esc;
  var APP_VERSION = '1.2.1';

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
  var DEFAULTS = {
    labels: false, pos: 'left', anim: 'soft', tempo: 'normal', iconAnim: 'always', keepScroll: true, voice: true,
    hQuick: true, hNext: true, hFav: true, hRecent: true, hRooms: true, hStats: true, hBackup: true,
    vTap: 70, vMenu: 60, vPage: 40, vChime: 85, vSwipe: 70, chimeRepeat: '2',
    alert: 'bell', ring: true, pill: true, showCount: true, swipe: true, snoozeDefault: 'morgen',
    accent: 'green', iconColor: 'multi', look: 'auto', haptic: 'light', lockAfter: '0', recog: true
  };
  function P(k) { return prefs[k] === undefined ? DEFAULTS[k] : prefs[k]; }
  W.Sound.cfg = function () { return Object.assign({}, DEFAULTS, prefs); };
  W.Lock.init({ cfg: function () { return prefs; }, save: savePrefs, onChange: function () { if (S.ready) render(); } });
  W.Lock.boot();
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

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
    r.count = M.reminders().active.length;
    return r;
  };
  /* Erinnerungen: Ablauf, Garantie, Wartung, Einkaufsliste und eigene Erinnerungen (per Sprache).
     Jede hat einen festen Schlüssel. Erledigte stehen in meta.dueDone, verschobene in meta.dueSnooze. */
  M.reminders = function () {
    var done = DB.meta.dueDone || {}, snz = DB.meta.dueSnooze || {}, now = Date.now(), all = [];
    DB.items.forEach(function (it) {
      var loc = M.shortLoc(it);
      var n = U.daysUntil(it.expiry);
      if (n !== null && n <= 14) all.push({ key: 'e:' + it.id + ':' + it.expiry, type: 'expiry', it: it, n: n, title: n < 0 ? 'Abgelaufen' : 'Läuft ab', text: it.name + ' · ' + loc, when: U.relDays(n) });
      var w = U.daysUntil(it.warranty);
      if (w !== null && w >= 0 && w <= 60) all.push({ key: 'w:' + it.id + ':' + it.warranty, type: 'warranty', it: it, n: w, title: 'Garantie endet', text: it.name, when: U.relDays(w) });
      (it.tasks || []).forEach(function (t) {
        var d = U.daysUntil(t.next);
        if (d !== null && d <= 14) all.push({ key: 't:' + it.id + ':' + t.id + ':' + t.next, type: 'maint', it: it, task: t, n: d, title: t.title, text: it.name + ' · ' + loc, when: d < 0 ? 'überfällig ' + U.relDays(d) : U.relDays(d) });
      });
      if (M.needsBuying(it)) all.push({ key: 's:' + it.id + ':' + it.minQty, type: 'shop', it: it, n: 0.5, title: 'Nachkaufen', text: it.name + ' · mindestens ' + it.minQty, when: 'Einkaufsliste' });
    });
    (DB.meta.reminders || []).forEach(function (r) {
      var d = U.daysUntil(r.date);
      var x = { key: 'r:' + r.id, type: 'remind', rem: r, n: d === null ? 0 : d, title: 'Erinnerung', text: r.text, when: d === null ? '' : U.relDays(d) };
      // Eigene Erinnerungen für später warten unter „Später“, bis ihr Tag da ist
      if (d !== null && d > 0) { var at = U.parseDay(r.date); at.setHours(8, 0, 0, 0); x.until = at.getTime(); x.planned = true; }
      all.push(x);
    });
    var out = { active: [], later: [] };
    all.forEach(function (x) {
      if (done[x.key]) return;
      var until = snz[x.key] || x.until;
      if (until && until > now) { x.until = until; out.later.push(x); } else out.active.push(x);
    });
    out.active.sort(function (a, b) { return a.n - b.n; });
    out.later.sort(function (a, b) { return a.until - b.until; });
    return out;
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
  var ROUTES = ['home', 'items', 'places', 'room', 'place', 'due', 'more', 'sortout', 'moving', 'settings'];
  var TOP_ROUTES = ['items', 'places', 'due', 'more'];
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('/');
    var r = parts[0] || 'home';
    if (ROUTES.indexOf(r) < 0) r = 'home';
    S.route = r;
    S.arg = parts[1] ? decodeURIComponent(parts[1]) : null;
  }
  function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); }
  var scrollMem = {}, curKey = location.hash || '#/';
  window.addEventListener('hashchange', function () {
    var prevRoute = S.route, prevSec = sectionOf(S.route);
    scrollMem[curKey] = window.scrollY;
    var g = makeGhost();
    parseHash();
    curKey = location.hash || '#/';
    closeAllSheets();
    setNav(false);
    if (S.route === 'home' && S.q) { S.q = ''; $('#q').value = ''; $('#qClear').hidden = true; }
    if (S.route !== 'items') exitSelect(true);
    if (S.route === 'due') clearUnseen();
    render();
    // Zurück an dieselbe Stelle statt immer ganz nach oben
    window.scrollTo(0, P('keepScroll') ? (scrollMem[curKey] || 0) : 0);
    var from = navFrom; navFrom = null;
    playTransition(g, prevRoute, from);
    if (sectionOf(S.route) !== prevSec) setTimeout(function () { animIcon($('#orbIc'), true); }, 160);
    if (S.route === 'home' && P('iconAnim') === 'always') U.$$('.nav-tile .nav-ic', view).forEach(function (ic, i) { setTimeout(function () { animIcon(ic); }, 260 + i * 90); });
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

  var TITLES = { home: 'Wo ist was', items: 'Dinge', places: 'Orte', due: 'Fällig', more: 'Mehr', sortout: 'Aussortieren', moving: 'Umzug', settings: 'Einstellungen' };
  var SW = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var BELL = '<g class="bell"><path d="M6 9.5a6 6 0 0 1 12 0c0 5.3 2.2 7 2.2 7H3.8S6 14.8 6 9.5z"/><path d="M10 20a2 2 0 0 0 4 0"/></g>';
  /* Symbole mit beweglichen Teilen (für die eigene Animation je Symbol) */
  var NI = {
    home: '<svg viewBox="0 0 24 24" ' + SW + '><g class="p-house"><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></g><g class="p-roof"><path d="M3.5 11 12 4l8.5 7"/></g></svg>',
    items: '<svg viewBox="0 0 24 24" ' + SW + '><g class="p-box"><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/></g><g class="p-lid"><rect x="3" y="4" width="18" height="5" rx="1.5"/></g></svg>',
    places: '<svg viewBox="0 0 24 24" ' + SW + '><g class="p-pin"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle class="p-pindot" cx="12" cy="10" r="2.4"/></g></svg>',
    due: '<svg viewBox="0 0 24 24" ' + SW + '>' + BELL + '</svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle class="p-d1" cx="5.5" cy="12" r="2.1"/><circle class="p-d2" cx="12" cy="12" r="2.1"/><circle class="p-d3" cx="18.5" cy="12" r="2.1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><g class="p-gear"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g></svg>',
    clock: '<svg viewBox="0 0 24 24" ' + SW + '><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><g class="p-plus"><path d="M12 5v14M5 12h14"/></g></svg>',
    scan: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/></svg>',
    photos: '<svg viewBox="0 0 24 24" ' + SW + '><rect x="7" y="3" width="14" height="13" rx="2"/><rect x="3" y="7" width="14" height="13" rx="2"/><path d="m3 17 4-4 3 3 2-2 5 5"/></svg>',
    save: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
    expiry: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M7 3h10M7 21h10"/><path d="M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l2.4-2.3A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21"/></svg>',
    warranty: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    maint: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.4-1.4a4 4 0 0 1-5-5L3 8l3-3 3.3 3.3a4 4 0 0 1 5.4-2z"/></svg>',
    shop: '<svg viewBox="0 0 24 24" ' + SW + '><path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
    remind: '<svg viewBox="0 0 24 24" ' + SW + '>' + BELL + '</svg>'
  };
  var NAV = [
    { id: 'home', path: '', label: 'Start' },
    { id: 'items', path: 'items', label: 'Dinge' },
    { id: 'places', path: 'places', label: 'Orte' },
    { id: 'due', path: 'due', label: 'Fällig' },
    { id: 'more', path: 'more', label: 'Mehr' }
  ];
  function sectionOf(r) { return r === 'room' || r === 'place' ? 'places' : (r === 'sortout' || r === 'moving' || r === 'settings') ? 'more' : r; }
  function navMeta(id, due) {
    if (id === 'home') return 'Übersicht';
    if (id === 'items') return U.plural(DB.items.length, 'Gegenstand', 'Gegenstände');
    if (id === 'places') {
      var n = DB.places.length;
      return U.plural(M.rooms().length, 'Raum', 'Räume') + (n ? ' · ' + U.plural(n, 'Möbel/Kiste', 'Möbel/Kisten') : '');
    }
    if (id === 'due') return due.count ? due.count + ' fällig' : 'Alles erledigt';
    return 'Einstellungen, Sicherung, Berichte';
  }
  function badgeText(n) { return n > 99 ? '99+' : String(n); }
  function restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // Symbol-Animation: „Immer“ spielt sie auch von selbst, „Beim Antippen“ nur mit force
  function animIcon(el, force) {
    var m = P('iconAnim');
    if (!el || m === 'off' || reduceMotion) return;
    if (!force && m !== 'always') return;
    restart(el, 'anim');
  }
  function updateChrome() {
    var r = S.route, title = TITLES[r] || 'Wo ist was';
    if (r === 'room') { var rm = S.arg === 'none' ? { name: 'Ohne Raum' } : M.room(S.arg); title = rm ? rm.name : 'Raum'; }
    if (r === 'place') { var p = M.place(S.arg); title = p ? p.name : 'Ort'; }
    $('#viewTitle').textContent = title;
    document.title = r === 'home' ? 'Wo ist was' : title + ' – Wo ist was';
    $('#backBtn').hidden = r === 'home';
    $('#searchWrap').hidden = r !== 'items' && r !== 'home';
    $('#searchWrap').classList.toggle('no-mic', !P('voice'));
    $('#qMic').hidden = !P('voice');
    $('#eVoice').hidden = !P('voice');
    $('#fab').hidden = S.selecting || ['items', 'places', 'room', 'place'].indexOf(r) < 0;
    document.body.classList.toggle('hide-orb', S.selecting);
    if (S.selecting) setNav(false);
    $('#selectBar').hidden = !S.selecting;
    var sec = sectionOf(r), ic = $('#orbIc');
    if (ic.dataset.sec !== sec) { ic.innerHTML = NI[sec]; ic.dataset.sec = sec; orb.style.setProperty('--c', 'var(--c-' + sec + ')'); }
    updateAppBadge(M.due().count);
  }

  /* ---------- Rundmenü: die Bereiche fächern sich als Welle um den Knopf ---------- */
  // Winkel in Grad (0 = rechts, -90 = oben), ohne Namen (r, a) und mit Namen (lr, la)
  var LAYOUT = {
    left: { r: 160, a: [-92, -62, -32, -4], lr: 176, la: [-94, -63, -32, 1], lbl: 'out' },
    mid: { r: 120, a: [-166, -115, -65, -14], lr: 130, la: [-160, -113, -67, -20], lbl: 'below' },
    right: { r: 160, a: [-88, -118, -148, -176], lr: 176, la: [-86, -117, -148, -181], lbl: 'out' }
  };
  var TEMPO = { fast: { step: 35, dur: 420 }, normal: { step: 55, dur: 550 }, calm: { step: 85, dur: 700 } };
  var orb = $('#orb'), petalsEl = $('#petals'), navOpen = false, navFrom = null;
  function tempo() { return TEMPO[P('tempo')] || TEMPO.normal; }
  function orbCenter() { var b = orb.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
  function renderPetals() {
    var cur = sectionOf(S.route), others = NAV.filter(function (n) { return n.id !== cur; });
    var L = LAYOUT[P('pos')] || LAYOUT.left, T = tempo(), labels = P('labels'), due = M.due();
    var R = labels ? L.lr : L.r, A = labels ? L.la : L.a, o = orbCenter(), k = others.length;
    petalsEl.innerHTML = others.map(function (n, i) {
      var a = A[i] * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      var x = Math.round(ca * R), y = Math.round(sa * R), lx = 0, ly = 46;
      if (L.lbl === 'out') { var hw = n.label.length * 3.7 + 10; lx = Math.round(ca * (44 + hw)); ly = Math.round(sa * 54); }
      var cnt = n.id === 'due' ? due.count : 0;
      return '<button class="petal" type="button" data-nav="' + n.path + '" data-px="' + (o.x + x) + '" data-py="' + (o.y + y) + '" tabindex="-1" aria-label="' + esc(n.label) + (cnt ? ', ' + cnt + ' fällig' : '') + '"' +
        ' style="--c:var(--c-' + n.id + ');--ox:' + o.x + 'px;--oy:' + o.y + 'px;--x:' + x + 'px;--y:' + y + 'px;--lx:' + lx + 'px;--ly:' + ly + 'px;--d-in:' + (i * T.step) + 'ms;--d-out:' + ((k - 1 - i) * Math.round(T.step * .6)) + 'ms">' +
        '<span class="dot">' + NI[n.id] + '</span>' + (cnt ? '<b class="badge">' + badgeText(cnt) + '</b>' : '') + '<span class="lbl" aria-hidden="true">' + esc(n.label) + '</span></button>';
    }).join('');
    // Jedes Symbol spielt seine Animation, sobald sein Kreis angekommen ist; die Glocke läutet bei Fälligem
    U.$$('.petal', petalsEl).forEach(function (pt, i) {
      var isDue = pt.dataset.nav === 'due' && due.count;
      if (P('iconAnim') !== 'always' && !(isDue && P('ring'))) return;
      setTimeout(function () {
        if (!navOpen) return;
        if (P('iconAnim') === 'always') animIcon($('.dot', pt), true); else restart($('.dot', pt), 'ring');
        if (isDue && P('ring')) restart($('.badge', pt), 'jiggle');
      }, i * T.step + T.dur * .55);
    });
  }
  function setNav(open) {
    if (open === navOpen) return;
    navOpen = open;
    document.body.classList.toggle('nav-open', open);
    orb.setAttribute('aria-expanded', String(open));
    orb.setAttribute('aria-label', open ? 'Schließen' : 'Bereiche öffnen');
    U.$$('.petal', petalsEl).forEach(function (b) { b.tabIndex = open ? 0 : -1; });
  }
  orb.addEventListener('click', function () {
    var want = !navOpen;
    if (want) { renderPetals(); W.Sound.play('open', tempo().step); } else W.Sound.play('close');
    // Ein Bild Pause, damit die Welle auch beim ersten Öffnen läuft
    requestAnimationFrame(function () { requestAnimationFrame(function () { setNav(want); }); });
  });
  $('#navScrim').addEventListener('click', function () { W.Sound.play('close'); setNav(false); });
  petalsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-nav]'); if (!b) return;
    W.Sound.play('tap');
    navFrom = { x: +b.dataset.px, y: +b.dataset.py };
    setNav(false);
    go(b.dataset.nav);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && navOpen && !stack.length) { W.Sound.play('close'); setNav(false); } });
  window.addEventListener('resize', function () { setNav(false); placeBubble(); });

  /* ---------- Seitenwechsel: die alte Seite blendet als Abbild aus, die neue legt sich darüber ---------- */
  var DEPTH = { home: 0, items: 1, places: 1, due: 1, more: 1, room: 2, sortout: 2, moving: 2, settings: 2, place: 3 };
  var EASE = 'cubic-bezier(.32,.72,0,1)';
  function makeGhost() {
    if (P('anim') === 'off' || reduceMotion || !view.animate || !S.ready) return null;
    var r = view.getBoundingClientRect(), g = view.cloneNode(true);
    g.removeAttribute('id'); g.removeAttribute('aria-live'); g.setAttribute('aria-hidden', 'true');
    g.classList.add('ghost');
    g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.width = r.width + 'px';
    g.style.height = Math.max(0, window.innerHeight - r.top) + 'px';
    document.body.appendChild(g);
    return g;
  }
  function playTransition(g, prevRoute, from) {
    if (!g) return;
    var dP = DEPTH[prevRoute] || 0, dN = DEPTH[S.route] || 0, cleaned = false;
    function done() {
      if (cleaned) return; cleaned = true;
      g.remove(); view.classList.remove('entering'); view.style.transformOrigin = ''; view.style.minHeight = '';
    }
    setTimeout(done, 900);
    view.classList.add('entering');
    W.Sound.play('page');
    if (!from && dN !== dP) {
      // tiefer hinein = von rechts, zurück = von links (wie auf dem iPhone)
      var s = dN > dP ? 1 : -1;
      view.animate([{ transform: 'translateX(' + (s * 44) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: EASE });
      g.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(' + (-s * 28) + 'px)', opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).onfinish = done;
      return;
    }
    var p = from || { x: window.innerWidth / 2, y: window.innerHeight - 60 };
    if (P('anim') === 'circle') {
      view.style.minHeight = '100vh';
      var r = view.getBoundingClientRect(), cx = p.x - r.left, cy = p.y - r.top;
      var R = Math.ceil(Math.hypot(Math.max(p.x, window.innerWidth - p.x), Math.max(p.y, window.innerHeight - p.y)));
      view.animate([{ clipPath: 'circle(28px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + cx + 'px ' + cy + 'px)' }], { duration: 480, easing: EASE }).onfinish = done;
      return;
    }
    var r2 = view.getBoundingClientRect();
    view.style.transformOrigin = (p.x - r2.left) + 'px ' + (p.y - r2.top) + 'px';
    view.animate([{ transform: 'translateY(16px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: EASE });
    g.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).onfinish = done;
  }

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
      '<div class="card-photo">' + img + (q !== 1 ? '<span class="qty' + (q === 0 ? ' zero' : '') + '">' + (q === 0 ? 'leer' : '×' + q) + '</span>' : '') +
      (it.fav ? '<span class="fstar" aria-label="Favorit">' + NI.star + '</span>' : '') + '</div>' +
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

  function miniHTML(it) {
    var ph = (it.photos || [])[0];
    return '<button class="recent-item" type="button" data-item="' + esc(it.id) + '"><span class="recent-photo">' +
      (ph ? imgTag(ph.t || ph.id, '', true) : '<span class="ph-empty" aria-hidden="true">' + esc(initials(it.name)) + '</span>') +
      '</span>' + (it.fav ? '<span class="fstar" aria-label="Favorit">' + NI.star + '</span>' : '') + '<span class="recent-name">' + esc(it.name) + '</span></button>';
  }
  function nextRowHTML(x) {
    var inner = '<span class="ni">' + remIcon(x.type) + '</span><span class="nt"><b>' + esc(x.title) + '</b><small>' + esc(x.text) + '</small></span><span class="when">' + esc(x.when) + '</span>';
    return '<div class="nwrap" data-rkey="' + esc(x.key) + '">' + (x.it ? '<button class="nrow" type="button" data-item="' + esc(x.it.id) + '">' + inner + '</button>' : '<a class="nrow" href="#/due">' + inner + '</a>') +
      '<button class="dn" type="button" data-rem-done="' + esc(x.key) + '" aria-label="Erledigt">' + ICON.check + '</button></div>';
  }
  VIEWS.home = function () {
    var h = installBanner() + storageBanner();
    var due = M.due();
    h += '<div class="home-grid">' + NAV.slice(1).map(function (n) {
      return '<a class="nav-tile" href="#/' + n.path + '" data-navtile style="--c:var(--c-' + n.id + ')">' +
        '<span class="nav-ic" aria-hidden="true">' + NI[n.id] + '</span>' +
        (n.id === 'due' && due.count ? '<b class="nav-badge">' + badgeText(due.count) + '</b>' : '') +
        '<span class="nav-tile-txt"><b>' + esc(n.label) + '</b><small>' + esc(navMeta(n.id, due)) + '</small></span></a>';
    }).join('') + '</div>';
    if (P('hQuick')) h += '<div class="quick">' +
      '<button class="qa primary" type="button" data-act="new"><span class="qi">' + NI.plus + '</span>Neu erfassen</button>' +
      '<button class="qa" type="button" data-act="scan"><span class="qi">' + NI.scan + '</span>Scannen</button>' +
      '<button class="qa" type="button" data-act="add-batch"><span class="qi">' + NI.photos + '</span>Viele Fotos</button></div>';
    if (P('hNext')) {
      var act = M.reminders().active;
      h += '<section class="hsec"><div class="hhead"><h2>Als Nächstes fällig</h2><a class="linkish" href="#/due">Alle</a></div><div class="next">' +
        (act.length ? act.slice(0, 3).map(nextRowHTML).join('') : '<div class="next-empty">Nichts fällig. Alles erledigt.</div>') + '</div></section>';
    }
    if (P('hFav')) {
      var favs = DB.items.filter(function (it) { return it.fav; }).sort(function (a, b) { return natural(a.name, b.name); });
      h += '<section class="hsec"><div class="hhead"><h2>Favoriten</h2></div>' + (favs.length ? '<div class="strip">' + favs.map(miniHTML).join('') + '</div>' :
        '<div class="next"><div class="next-empty">Tippe bei einem Gegenstand oben auf ★, dann steht er hier.</div></div>') + '</section>';
    }
    var recent = DB.items.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 8);
    if (P('hRecent') && recent.length) h += '<section class="hsec"><div class="hhead"><h2>Zuletzt erfasst</h2><a class="linkish" href="#/items">Alle</a></div><div class="strip">' + recent.map(miniHTML).join('') + '</div></section>';
    if (P('hRooms') && M.rooms().length) {
      h += '<section class="hsec"><div class="hhead"><h2>Räume</h2><a class="linkish" href="#/places">Alle</a></div><div class="strip">' + M.rooms().map(function (r) {
        return '<a class="rchip" href="#/room/' + encodeURIComponent(r.id) + '"><span class="dot" style="--c:' + U.safeColor(r.color) + '"></span>' + esc(r.name) + ' <small>' + M.itemsInRoom(r.id).length + '</small></a>';
      }).join('') + '</div></section>';
    }
    if (P('hStats') && DB.items.length) {
      var total = DB.items.reduce(function (s2, it) { return s2 + M.val(it); }, 0), photos = DB.items.reduce(function (s2, it) { return s2 + (it.photos || []).length; }, 0);
      h += '<section class="hsec"><div class="hhead"><h2>Dein Inventar</h2></div><div class="stats"><div class="stat"><b>' + DB.items.length + '</b><small>Gegenstände</small></div>' +
        '<div class="stat"><b>' + U.money(total).replace(/,00\s?€$/, ' €') + '</b><small>Gesamtwert</small></div><div class="stat"><b>' + photos + '</b><small>Fotos</small></div></div></section>';
    }
    if (P('hBackup') && DB.items.length) {
      var lb = DB.meta.lastBackup;
      h += '<section class="hsec"><div class="backup-row"><span class="ni" style="background:var(--surface-2);color:var(--muted)">' + NI.save + '</span><span class="bt"><b>Sicherung</b><small>' +
        (lb ? 'Letzte Sicherung ' + U.relDays(-Math.floor((Date.now() - lb) / 864e5)).replace(/^heute$/, 'heute').replace(/^seit /, 'vor ') : 'Noch nie gesichert') + '</small></span>' +
        '<button class="btn small btn-primary" type="button" data-act="backup">Jetzt sichern</button></div></section>';
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
  function remIcon(t) { return NI[t] || NI.due; }
  function untilText(t) {
    var d = new Date(t), today = new Date(), tm = new Date(); tm.setDate(tm.getDate() + 1);
    var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return 'heute ' + hm;
    if (d.toDateString() === tm.toDateString()) return 'morgen ' + hm;
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  function remRowHTML(x) {
    var body = '<b>' + esc(x.title) + '</b><small>' + esc(x.text) + (x.when ? ' · <span class="w">' + esc(x.when) + '</span>' : '') + '</small>';
    return '<div class="swipe" data-rkey="' + esc(x.key) + '">' +
      '<div class="sbg"><span class="stx">Erledigt</span><span class="sck">' + ICON.check + '</span></div>' +
      '<div class="sbg2"><span class="sck">' + NI.clock + '</span><span class="stx">Später</span></div>' +
      '<div class="rem"><span class="ric">' + remIcon(x.type) + '</span>' +
      (x.it ? '<button class="rmain" type="button" data-item="' + esc(x.it.id) + '">' + body + '</button>' : '<div class="rmain">' + body + '</div>') +
      '<button class="dn sz" type="button" data-rem-snooze="' + esc(x.key) + '" aria-label="Später erinnern">' + NI.clock + '</button>' +
      '<button class="dn" type="button" data-rem-done="' + esc(x.key) + '" aria-label="Erledigt">' + ICON.check + '</button></div></div>';
  }
  function laterRowHTML(x) {
    return '<div class="rem snz"><span class="ric">' + remIcon(x.type) + '</span><div class="rmain"><b>' + esc(x.title) + '</b><small>' + esc(x.text) + ' · ' + (x.planned ? 'geplant ' : 'wieder ') + esc(untilText(x.until)) + '</small></div>' +
      '<button class="later" type="button" data-rem-now="' + esc(x.key) + '">Jetzt</button></div>';
  }
  VIEWS.due = function () {
    var d = M.due(), rem = M.reminders(), h = '';
    if (d.backup) {
      var lb = DB.meta.lastBackup;
      h += '<section class="panel warn" style="margin-bottom:12px"><h3>Sicherung empfohlen</h3><p>' + (lb ? 'Letzte Sicherung vor ' + Math.floor((Date.now() - lb) / 864e5) + ' Tagen.' : 'Du hast noch keine Sicherung gemacht.') +
        ' Deine Daten liegen nur auf diesem Gerät. Eine Sicherung schützt vor Verlust, falls das iPhone kaputtgeht.</p><div class="row-btns"><button class="btn small btn-primary" type="button" data-act="backup">Jetzt sichern</button></div></section>';
    }
    if (!rem.active.length) {
      h += '<div class="empty"><h2>Alles erledigt</h2><p>Hier erscheinen Ablaufdaten, Wartungen, auslaufende Garantien und die Einkaufsliste, sobald du sie bei Gegenständen einträgst.</p></div>';
    } else {
      h += '<div class="rem-list">' + rem.active.map(remRowHTML).join('') + '</div>';
      var shop = rem.active.some(function (x) { return x.type === 'shop'; });
      h += '<div class="rem-foot">' + (rem.active.length > 1 ? '<button class="linkbtn" type="button" data-rem-all>Alle als erledigt markieren</button>' : '') +
        (shop ? '<button class="linkbtn" type="button" data-act="share-shopping">Einkaufsliste teilen</button>' : '') + '</div>';
      if (P('swipe')) h += '<p class="hint" style="text-align:center;margin:0 0 6px">Nach links wischen = erledigt, nach rechts = später</p>';
    }
    if (rem.later.length) h += '<div class="sub-head">Später</div><div class="rem-list">' + rem.later.map(laterRowHTML).join('') + '</div>';
    h += '<div class="panels" style="margin-top:18px">';
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
    var h = '<div class="menu-list" style="margin-bottom:14px"><a class="row hl" href="#/settings"><span class="ric">' + NI.gear + '</span><span class="row-txt"><span class="row-name">Einstellungen</span>' +
      '<span class="row-meta">Menü, Töne, Farben, Erinnerungen, Spracheingabe, Sperre</span></span>' + ICON.chev + '</a></div>';
    h += '<div class="tiles">' +
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
    h += '<div class="sub-head">Privat</div><div class="menu-list">' +
      row('vault', 'Archiv & Tresor', 'Dinge wegschließen, Fotos, Dokumente und Passwörter – verschlüsselt und nur auf diesem Gerät') +
      '</div>';
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
    h += '<p class="meta-line" style="margin-top:18px">Wo ist was · Version ' + APP_VERSION + (U.isStandalone() ? ' · installiert' : '') + '</p>';
    return h;
  };

  /* ---------- Einstellungen ---------- */
  var ACC = {
    green: { n: 'Grün', l: ['#2F5D50', '#DDE9E4'], d: ['#86C9B3', '#1F3830'] },
    blue: { n: 'Blau', l: ['#2F5BA8', '#DCE6F6'], d: ['#8DB3EE', '#1C2B44'] },
    purple: { n: 'Lila', l: ['#6A4FB0', '#E8E1F7'], d: ['#B7A5F0', '#2C2445'] },
    orange: { n: 'Orange', l: ['#B35416', '#F6E4D6'], d: ['#F0A36A', '#3D2A1B'] },
    rose: { n: 'Rosé', l: ['#B0405F', '#F5DEE5'], d: ['#F09AB1', '#40202A'] },
    graphite: { n: 'Graphit', l: ['#2E3A36', '#E1E6E4'], d: ['#D5DEDA', '#2A3330'] }
  };
  var faceOk = false;
  W.Lock.faceAvailable().then(function (v) { faceOk = !!v; if (S.route === 'settings') render(); });
  function sseg(key, opts) {
    return '<div class="pseg" role="group">' + opts.map(function (o) {
      return '<button type="button" data-set="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (String(P(key)) === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function ssw(key, title, sub, checked) {
    var on = checked === undefined ? !!P(key) : checked;
    return '<label class="set-row"><span class="st"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><input class="switch" type="checkbox" data-set="' + key + '"' + (on ? ' checked' : '') + '></label>';
  }
  function scol(title, sub, inner) { return '<div class="set-row col"><span class="st"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + inner + '</div>'; }
  function sgroup(title, inner, note) { return '<div class="set-group"><div class="set-title">' + title + '</div><div class="set-card">' + inner + '</div>' + (note ? '<p class="set-note">' + note + '</p>' : '') + '</div>'; }
  function sslider(key, title, snd) {
    var v = +P(key) || 0;
    return '<div class="set-row col vol-row"><div class="vol-head"><span class="st"><b>' + title + '</b></span><output id="o-' + key + '">' + (v ? v + ' %' : 'aus') + '</output>' +
      '<button class="play" type="button" data-preview="' + snd + '" aria-label="' + title + ' anhören"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg></button></div>' +
      '<input class="range" type="range" min="0" max="100" step="5" value="' + v + '" data-set="' + key + '" aria-label="' + title + '" style="--p:' + v + '%"></div>';
  }
  function swatchesHTML() {
    return '<div class="swatches" role="group">' + Object.keys(ACC).map(function (k) {
      return '<button type="button" data-set="accent" data-val="' + k + '" aria-pressed="' + (P('accent') === k) + '" style="--sw:' + ACC[k].l[0] + '"><span>' + ICON.check + '</span>' + ACC[k].n + '</button>';
    }).join('') + '</div>';
  }
  VIEWS.settings = function () {
    var h = '';
    h += sgroup('Menü unten',
      ssw('labels', 'Namen unter den Symbolen', 'Die Kreise rücken dafür etwas auseinander') +
      scol('Position des Knopfs', '', sseg('pos', [['left', 'Links'], ['mid', 'Mitte'], ['right', 'Rechts']])));
    h += sgroup('Animationen',
      scol('Seitenwechsel', 'Was passiert, wenn du einen Bereich antippst', sseg('anim', [['soft', 'Sanft'], ['circle', 'Kreis'], ['off', 'Aus']])) +
      scol('Tempo der Welle', '', sseg('tempo', [['fast', 'Schnell'], ['normal', 'Normal'], ['calm', 'Ruhig']])) +
      scol('Symbol-Animationen', 'Haus hüpft, Kiste klappt auf, Nadel fällt, Glocke läutet, Punkte winken', sseg('iconAnim', [['off', 'Aus'], ['tap', 'Beim Antippen'], ['always', 'Immer']])));
    h += sgroup('Bedienung',
      ssw('keepScroll', 'Scroll-Position merken', 'Beim Zurückgehen landest du wieder an derselben Stelle') +
      ssw('swipe', 'Wischen bei Erinnerungen', 'Nach links = erledigt, nach rechts = später') +
      scol('„Später“ beim Wischen', '', sseg('snoozeDefault', [['1h', '1 Std.'], ['abend', 'Abend'], ['morgen', 'Morgen'], ['woche', 'Woche']])));
    h += sgroup('Spracheingabe',
      ssw('voice', 'Mikrofon in der Suche und beim Erfassen', 'Zum Beispiel „Wo ist das Ladekabel?“ oder „Leg die Bohrmaschine in die Garage“'),
      W.Voice.supported() ? 'Die Erkennung läuft über Apple und braucht meist Internet. Ohne Internet nutzt du die Diktier-Taste auf der Tastatur.' : 'Dieser Browser hat keine Spracherkennung. Die Diktier-Taste auf der Tastatur geht trotzdem.');
    h += sgroup('Startbildschirm',
      ssw('hQuick', 'Schnellaktionen', 'Neu erfassen, Scannen, Viele Fotos') +
      ssw('hNext', 'Als Nächstes fällig', 'Die nächsten drei Erinnerungen') +
      ssw('hFav', 'Favoriten', 'Mit ★ markierte Sachen, die du oft suchst') +
      ssw('hRecent', 'Zuletzt erfasst', 'Reihe mit Fotos zum Wischen') +
      ssw('hRooms', 'Räume', 'Schnellzugriff mit Anzahl pro Raum') +
      ssw('hStats', 'Dein Inventar', 'Anzahl, Gesamtwert und Fotos') +
      ssw('hBackup', 'Sicherung', 'Wann zuletzt gesichert wurde'));
    h += sgroup('Erinnerungen',
      scol('Hinweis am runden Knopf', 'Solange du bei „Fällig“ noch nicht reingeschaut hast', sseg('alert', [['bell', 'Glocke'], ['pulse', 'Pulsieren'], ['both', 'Beides'], ['off', 'Aus']])) +
      ssw('ring', 'Glocke wackelt', 'Die kleine Glocke läutet alle paar Sekunden, die Zahl rüttelt sich') +
      ssw('pill', 'Kurzer Text-Hinweis', 'Zeigt einige Sekunden, was fällig ist, mit ✓ und „Später“') +
      ssw('showCount', 'Zahl anzeigen', 'Rote Zahl an Glocke, Kachel und Menü') +
      '<div class="set-row"><button class="btn small" type="button" data-set-test>Test-Erinnerung</button></div>',
      'Die App kann nur Bescheid geben, solange sie geöffnet ist. Für Erinnerungen bei geschlossener App gibt es unter „Fällig“ den Export in den iPhone-Kalender.');
    h += sgroup('Lautstärke der Töne',
      sslider('vTap', 'Klicks beim Antippen', 'tap') + sslider('vMenu', 'Menü auf- und zuklappen', 'open') + sslider('vPage', 'Seitenwechsel', 'page') +
      sslider('vChime', 'Glocke bei Erinnerungen', 'chime') + sslider('vSwipe', 'Wegwischen', 'swoosh') +
      scol('Glocke wiederholen', '', sseg('chimeRepeat', [['1', '1 ×'], ['2', '2 ×']])),
      'Ganz nach links geschoben ist der Ton aus. Ist das iPhone stumm geschaltet, bleiben alle Töne aus.');
    h += sgroup('Vibration',
      scol('Beim Antippen und bei Erinnerungen', 'Kurzes Rütteln, passend zu den Tönen', sseg('haptic', [['off', 'Aus'], ['light', 'Leicht'], ['strong', 'Stark']])),
      'Auf dem iPhone geht das ab iOS 18.');
    h += sgroup('Farben & Darstellung',
      scol('Akzentfarbe', 'Knöpfe, Schalter, Markierungen und der Knopf „+“', swatchesHTML()) +
      scol('Symbolfarben', 'Jeder Bereich in eigener Farbe oder alles in der Akzentfarbe', sseg('iconColor', [['multi', 'Bunt'], ['mono', 'Einfarbig']])) +
      scol('Design', '', sseg('look', [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']])));
    var locked = W.Lock.enabled();
    h += sgroup('Sicherheit',
      ssw('lock', 'App-Sperre', 'Beim Öffnen mit einem Code entsperren', locked) +
      (locked ? scol('Sperren nach', 'Wie lange die App im Hintergrund sein darf', sseg('lockAfter', [['0', 'Sofort'], ['1', '1 Min.'], ['5', '5 Min.']])) +
        (faceOk ? ssw('face', 'Face ID verwenden', 'Mit deinem Gesicht statt mit dem Code entsperren', !!prefs.lockCred) : '') +
        '<div class="set-row"><div class="set-btns"><button class="btn small" type="button" data-lock-now>Jetzt sperren</button><button class="btn small" type="button" data-lock-code>Code ändern</button></div></div>' : ''),
      'Die Sperre hält andere vom Durchblättern ab. Die Daten auf dem Gerät werden dadurch nicht verschlüsselt.');
    h += sgroup('Allgemein',
      ssw('recog', 'Bilderkennung', 'Schlägt beim Fotografieren einen Namen vor. Läuft komplett auf dem Gerät, ohne Internet.', recogOn()) +
      '<button class="set-row" type="button" data-act="storage"><span class="st"><b>Speicher</b><small>' + (DB.persistent ? 'Alle Daten liegen nur auf diesem Gerät. Tippen für Details.' : 'Speichern ist in diesem Browser nicht möglich.') + '</small></span>' + ICON.chev + '</button>');
    h += '<p class="meta-line" style="margin-top:18px">Wo ist was · Version ' + APP_VERSION + (U.isStandalone() ? ' · installiert' : '') + '</p>';
    return h;
  };
  function isDark() {
    var look = P('look');
    if (look === 'dark') return true;
    if (look === 'light') return false;
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  // Einstellungen auf die Oberfläche anwenden
  function applyPrefs() {
    var b = document.body, d = document.documentElement;
    ['left', 'mid', 'right'].forEach(function (p) { b.classList.toggle('pos-' + p, P('pos') === p); });
    b.classList.toggle('no-labels', !P('labels'));
    b.classList.toggle('no-count', !P('showCount'));
    b.style.setProperty('--wave-dur', tempo().dur + 'ms');
    if (P('look') === 'auto') d.removeAttribute('data-look'); else d.setAttribute('data-look', P('look'));
    var a = ACC[P('accent')] || ACC.green, dk = isDark(), c = dk ? a.d : a.l;
    d.style.setProperty('--accent', c[0]);
    d.style.setProperty('--accent-soft', c[1]);
    d.style.setProperty('--accent-ink', dk ? '#0F1513' : '#FFFFFF');
    ['home', 'items', 'places', 'due', 'more'].forEach(function (k) {
      if (P('iconColor') === 'mono') d.style.setProperty('--c-' + k, c[0]); else d.style.removeProperty('--c-' + k);
    });
    U.$$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', getComputedStyle(d).getPropertyValue('--bg').trim() || m.getAttribute('content')); });
    placeBubble();
    showAlert();
  }
  if (window.matchMedia) try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs); } catch (e) { /* ältere Browser */ }

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
   * Erinnerungen: erledigen, später, rückgängig, ankündigen
   * ========================================================= */
  var SNZ = { '1h': ['In 1 Stunde', 'in 1 Stunde'], abend: ['Heute Abend', 'heute Abend'], morgen: ['Morgen früh', 'morgen früh'], woche: ['In 1 Woche', 'in einer Woche'] };
  function metaMap(k) { return Object.assign({}, DB.meta[k] || {}); }
  function findRem(key) { var r = M.reminders(); return r.active.concat(r.later).filter(function (x) { return x.key === key; })[0] || null; }
  function snoozeUntil(k) {
    var d = new Date();
    if (k === '1h') return Date.now() + 3600e3;
    if (k === 'abend') { d.setHours(19, 0, 0, 0); if (d.getTime() < Date.now() + 15 * 60e3) d.setDate(d.getDate() + 1); return d.getTime(); }
    d.setDate(d.getDate() + (k === 'woche' ? 7 : 1)); d.setHours(8, 0, 0, 0);
    return d.getTime();
  }
  // Vorher-Zustand merken, damit „Rückgängig“ alles zurückholt
  function snapshot(items) {
    return { items: items.filter(Boolean).map(function (it) { return JSON.parse(JSON.stringify(M.item(it.id) || it)); }),
      done: metaMap('dueDone'), snz: metaMap('dueSnooze'), rems: (DB.meta.reminders || []).slice() };
  }
  function undo(snap) {
    W.Sound.play('tap');
    Promise.all([DB.setMeta('dueDone', snap.done), DB.setMeta('dueSnooze', snap.snz), DB.setMeta('reminders', snap.rems)]).then(function () {
      return snap.items.length ? DB.put('items', snap.items.map(function (it) { return Object.assign(it, { updatedAt: Date.now() }); })) : null;
    }).then(function () { markSeenSilently(); render(); });
  }
  // Was „erledigt“ je Art bedeutet
  function jobFor(x) {
    if (x.type === 'maint') return function () {
      var it = M.item(x.it.id); if (!it) return Promise.resolve();
      var today = U.today();
      var tasks = (it.tasks || []).map(function (t) { return t.id === x.task.id ? Object.assign({}, t, { last: today, next: U.addInterval(today, t.every, t.unit) }) : t; });
      return updateItem(it, { tasks: tasks }, 'Erledigt: ' + x.task.title);
    };
    if (x.type === 'shop') return function () {
      var it = M.item(x.it.id); if (!it) return Promise.resolve();
      return updateItem(it, { qty: Math.max(M.qty(it), parseInt(it.minQty, 10) || 1) }, 'Nachgekauft');
    };
    if (x.type === 'remind') return function () { return DB.setMeta('reminders', (DB.meta.reminders || []).filter(function (r) { return r.id !== x.rem.id; })); };
    return function () { var d = metaMap('dueDone'); d[x.key] = Date.now(); return DB.setMeta('dueDone', d); };
  }
  function doneText(x) {
    if (x.type === 'maint') { var nx = U.addInterval(U.today(), x.task.every, x.task.unit); return 'Erledigt. Nächstes Mal am ' + U.fmtDay(nx); }
    if (x.type === 'shop') return '„' + x.it.name + '“ ist nachgekauft';
    return 'Erledigt: ' + (x.it ? x.it.name : x.text);
  }
  // Lücke weich schließen, die Zeilen darunter rutschen nach
  function collapse(el, cb) {
    if (!el || !el.animate || reduceMotion) { cb(); return; }
    var h = el.offsetHeight, gap = el.classList.contains('swipe') ? 8 : 0;
    el.style.overflow = 'hidden';
    el.animate([{ height: h + 'px', marginBottom: '0px', opacity: 1 }, { height: '0px', marginBottom: (-gap) + 'px', opacity: 0 }], { duration: 320, easing: EASE, fill: 'forwards' }).onfinish = cb;
  }
  function animateOut(el, how, cb) {
    if (!el) { cb(); return; }
    if (how === 'swipe') { collapse(el, cb); return; }
    var b = el.querySelector('[data-rem-done]');
    if (b && how === 'done') { b.classList.add('ok'); b.innerHTML = ICON.check; }
    var inner = el.querySelector('.rem') || el;
    setTimeout(function () {
      if (inner.animate && !reduceMotion) inner.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24px)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      setTimeout(function () { collapse(el, cb); }, 120);
    }, how === 'done' ? 240 : 0);
  }
  function afterRemChange() { unseen = Math.min(unseen, M.reminders().active.length); showAlert(); render(); }
  function doneRem(key, how, el) {
    var x = findRem(key); if (!x) return;
    var snap = snapshot([x.it]), job = jobFor(x);
    W.Sound.play(how === 'swipe' ? 'swoosh' : 'done');
    hidePillFor(key);
    animateOut(el, how || 'done', function () { job().then(afterRemChange); });
    U.toast(doneText(x), { action: 'Rückgängig', ms: 5000, onAction: function () { undo(snap); } });
  }
  function doneAll() {
    var list = M.reminders().active; if (!list.length) return;
    var snap = snapshot(list.map(function (x) { return x.it; }));
    W.Sound.play('done');
    list.reduce(function (pr, x) { return pr.then(jobFor(x)); }, Promise.resolve()).then(afterRemChange);
    U.toast(U.plural(list.length, 'Erinnerung', 'Erinnerungen') + ' erledigt', { action: 'Rückgängig', ms: 5000, onAction: function () { undo(snap); } });
  }
  function snoozeRem(key, which, how, el) {
    var x = findRem(key); if (!x) return;
    var snap = snapshot([]), sz = metaMap('dueSnooze');
    sz[key] = snoozeUntil(which);
    var seen = (DB.meta.dueSeen || []).filter(function (k) { return k !== key; });
    W.Sound.play(how === 'swipe' ? 'swoosh' : 'tap');
    hidePillFor(key);
    animateOut(el, how || 'snooze', function () {
      Promise.all([DB.setMeta('dueSnooze', sz), DB.setMeta('dueSeen', seen)]).then(afterRemChange);
    });
    U.toast('Erinnert dich ' + SNZ[which][1], { action: 'Rückgängig', ms: 5000, onAction: function () { undo(snap); } });
  }
  function openSnooze(key) {
    var x = findRem(key); if (!x) return;
    W.Sound.play('tap');
    openMenu('Später erinnern', Object.keys(SNZ).map(function (k) {
      return { label: SNZ[k][0], meta: k === P('snoozeDefault') ? 'Standard beim Wischen nach rechts' : '', run: function () { snoozeRem(key, k, 'menu', view.querySelector('[data-rkey="' + CSS.escape(key) + '"]')); } };
    }), '<p class="lead">' + esc(x.title + ' · ' + x.text) + '</p>');
  }
  // „Jetzt“: Verschobenes oder Geplantes sofort wieder anzeigen
  function remNow(key) {
    W.Sound.play('tap');
    var sz = metaMap('dueSnooze'); delete sz[key];
    var jobs = [DB.setMeta('dueSnooze', sz)];
    if (key.indexOf('r:') === 0) jobs.push(DB.setMeta('reminders', (DB.meta.reminders || []).map(function (r) { return 'r:' + r.id === key ? Object.assign({}, r, { date: U.today() }) : r; })));
    Promise.all(jobs).then(function () { markSeenSilently(); render(); });
  }
  function addReminder(text, date) {
    var list = (DB.meta.reminders || []).concat([{ id: U.uid('m'), text: text, date: date, createdAt: Date.now() }]);
    return DB.setMeta('reminders', list).then(function () { markSeenSilently(); render(); });
  }

  /* ---------- Hinweis am runden Knopf ---------- */
  var unseen = 0, pillTimer = null, ringTimer = null, PILL_MS = 3800;
  function wantBell() { var a = P('alert'); return a === 'bell' || a === 'both'; }
  function wantPulse() { var a = P('alert'); return a === 'pulse' || a === 'both'; }
  function placeBubble() {
    var o = orbCenter(), right = P('pos') === 'right', b = $('#nbub'), dx = right ? -24 : 24;
    b.style.setProperty('--bx', (o.x + dx) + 'px'); b.style.setProperty('--by', (o.y - 24) + 'px');
    b.style.setProperty('--fx', (-dx) + 'px'); b.style.setProperty('--fy', '24px');
    ['#sonar1', '#sonar2'].forEach(function (sel) { var e = $(sel); e.style.setProperty('--ox', o.x + 'px'); e.style.setProperty('--oy', o.y + 'px'); });
  }
  function ringBubble() { if (!P('ring')) return; restart($('#nbubIc'), 'ring'); var c = $('#ncount'); if (!c.hidden) restart(c, 'jiggle'); }
  function showAlert() {
    var b = $('#nbub'), c = $('#ncount');
    c.textContent = badgeText(unseen); c.hidden = unseen < 2;
    b.classList.toggle('on', unseen > 0 && wantBell());
    orb.classList.toggle('pulse', unseen > 0 && wantPulse() && !reduceMotion);
    clearInterval(ringTimer);
    if (unseen > 0 && wantBell()) ringTimer = setInterval(function () { if (!navOpen && document.visibilityState === 'visible') ringBubble(); }, 4500);
  }
  function clearUnseen() { unseen = 0; showAlert(); $('#npill').classList.remove('on'); clearTimeout(pillTimer); }
  function hidePillFor(key) { var p = $('#npill'); if (p.dataset.key === key) { p.classList.remove('on'); clearTimeout(pillTimer); } }
  function announce(list) {
    W.Sound.chime();
    placeBubble();
    ['#sonar1', '#sonar2'].forEach(function (sel, i) { var e = $(sel); e.style.setProperty('--sd', (i * .18) + 's'); restart(e, 'go'); });
    if (orb.animate && !reduceMotion) orb.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(.95)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
    var b = $('#nbub');
    b.classList.remove('on'); void b.offsetWidth;
    setTimeout(function () { showAlert(); setTimeout(ringBubble, 420); }, 90);
    if (!P('pill')) return;
    var first = list[0], p = $('#npill'), single = list.length === 1 && !first.demo;
    p.dataset.key = single ? first.key : '';
    p.classList.toggle('multi', !single);
    $('#npIc').innerHTML = remIcon(first.type);
    $('#npT').textContent = list.length > 1 ? list.length + ' neue Erinnerungen' : first.title;
    $('#npS').textContent = list.length > 1 ? first.title + ': ' + first.text : first.text + (first.when ? ' · ' + first.when : '');
    p.style.setProperty('--nt', PILL_MS + 'ms');
    p.classList.remove('on'); clearTimeout(pillTimer);
    setTimeout(function () { void p.offsetWidth; p.classList.add('on'); }, 380);
    pillTimer = setTimeout(function () { p.classList.remove('on'); }, 380 + PILL_MS);
  }
  // Neues Fälliges ankündigen: beim Start, wenn die App wieder nach vorn kommt, und jede Minute
  function checkReminders() {
    if (!S.ready || W.Lock.isOpen()) return;
    var act = M.reminders().active, seen = DB.meta.dueSeen || [], now = Date.now();
    var sz = metaMap('dueSnooze'), changed = false;
    Object.keys(sz).forEach(function (k) { if (sz[k] <= now) { delete sz[k]; changed = true; } });
    if (changed) DB.setMeta('dueSnooze', sz);
    var fresh = act.filter(function (x) { return seen.indexOf(x.key) < 0; });
    if (!fresh.length) { if (changed) render(); return; }
    DB.setMeta('dueSeen', act.map(function (x) { return x.key; }));
    if (S.route === 'due') { render(); return; }
    unseen += fresh.length;
    announce(fresh);
    render();
  }
  // Was du selbst gerade einträgst, soll nicht klingeln
  function markSeenSilently() {
    if (!S.ready) return;
    var act = M.reminders().active, seen = DB.meta.dueSeen || [], sz = DB.meta.dueSnooze || {};
    var add = act.filter(function (x) { return seen.indexOf(x.key) < 0 && !sz[x.key]; }).map(function (x) { return x.key; });
    if (add.length) DB.setMeta('dueSeen', seen.concat(add));
  }
  function openDueFromOrb() { W.Sound.play('tap'); navFrom = orbCenter(); clearUnseen(); if (S.route === 'due') render(); else go('due'); }
  $('#nbub').addEventListener('click', openDueFromOrb);
  $('#npMain').addEventListener('click', openDueFromOrb);
  $('#npDone').innerHTML = ICON.check;
  $('#npSnooze').innerHTML = NI.clock;
  $('#npDone').addEventListener('click', function () { var k = $('#npill').dataset.key; if (k) { unseen = Math.max(0, unseen - 1); doneRem(k, 'done', view.querySelector('[data-rkey="' + CSS.escape(k) + '"]')); } });
  $('#npSnooze').addEventListener('click', function () { var k = $('#npill').dataset.key; if (k) { unseen = Math.max(0, unseen - 1); showAlert(); $('#npill').classList.remove('on'); openSnooze(k); } });
  $('#npill').addEventListener('pointerenter', function () { this.classList.add('hold'); clearTimeout(pillTimer); });
  $('#npill').addEventListener('pointerleave', function () { var p = this; p.classList.remove('hold'); clearTimeout(pillTimer); pillTimer = setTimeout(function () { p.classList.remove('on'); }, 1500); });

  /* ---------- Wischen: nach links = erledigt, nach rechts = später ---------- */
  var sw8 = null, swipedAt = 0;
  view.addEventListener('pointerdown', function (e) {
    if (!P('swipe') || e.button > 0) return;
    var w = e.target.closest('.swipe'); if (!w || e.target.closest('.dn')) return;
    sw8 = { w: w, row: $('.rem', w), x0: e.clientX, y0: e.clientY, dx: 0, on: false, id: e.pointerId };
  });
  view.addEventListener('pointermove', function (e) {
    var d = sw8;
    if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dy) > 10) { sw8 = null; return; }
      if (Math.abs(dx) < 10) return;
      d.on = true;
      try { d.w.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
      d.w.classList.add('dragging');
    }
    var dir = dx < 0 ? -1 : 1;
    if (dir !== d.dir) { d.dir = dir; d.w.classList.toggle('dirR', dir > 0); d.armed = false; d.w.classList.remove('armed'); }
    // Über den Auslösepunkt hinaus wird es zäher
    var TH = 110, ax = Math.abs(dx), eff = ax <= TH ? ax : TH + (ax - TH) * .45;
    d.dx = dir * eff;
    d.row.style.transition = 'none';
    d.row.style.transform = 'translateX(' + d.dx + 'px)';
    d.w.style.setProperty('--pr', Math.min(1, eff / TH).toFixed(3));
    var armed = eff >= TH;
    if (armed !== !!d.armed) { d.armed = armed; d.w.classList.toggle('armed', armed); if (armed) W.Sound.play('arm'); }
    var dt = e.timeStamp - (d.t || e.timeStamp);
    d.v = dt > 0 ? (e.clientX - (d.lx || e.clientX)) / dt : 0; d.lx = e.clientX; d.t = e.timeStamp;
  });
  function endSwipe(e) {
    var d = sw8;
    if (!d || e.pointerId !== d.id) return;
    sw8 = null;
    if (!d.on) return;
    swipedAt = Date.now();
    var dir = d.dx < 0 ? -1 : 1, key = d.w.dataset.rkey;
    var fling = Math.abs(d.v || 0) > .6 && Math.abs(d.dx) > 40 && (d.v < 0 ? -1 : 1) === dir;
    if (d.armed || fling) {
      d.w.classList.remove('dragging'); d.w.classList.add('leaving', 'armed');
      d.w.style.setProperty('--pr', '1');
      d.row.style.transition = 'transform .24s cubic-bezier(.55,0,.85,.45)';
      d.row.style.transform = 'translateX(' + (dir * 115) + '%)';
      setTimeout(function () { if (dir < 0) doneRem(key, 'swipe', d.w); else snoozeRem(key, P('snoozeDefault'), 'swipe', d.w); }, 200);
    } else {
      d.row.style.transition = 'transform .45s cubic-bezier(.34,1.4,.64,1)';
      d.row.style.transform = '';
      d.w.classList.remove('armed');
      d.w.style.setProperty('--pr', '0');
      setTimeout(function () { d.w.classList.remove('dragging'); }, 300);
    }
  }
  view.addEventListener('pointerup', endSwipe);
  view.addEventListener('pointercancel', endSwipe);

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
    $('#dFav').setAttribute('aria-pressed', String(!!it.fav));
    $('#dFav').setAttribute('aria-label', it.fav ? 'Favorit entfernen' : 'Als Favorit markieren');
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
    h += placeTimeline(it);
    if (W.VaultUI) {
      h += '<div class="menu-list" style="margin-top:14px"><button class="row" type="button" data-dact="tovault"><span class="ric">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>' +
        '</span><span class="row-txt"><span class="row-name">In den Tresor legen</span><span class="row-meta">Verschlüsselt wegschließen, mit Fotos. Danach nur mit dem Tresor-Code sichtbar.</span></span>' + ICON.chev + '</button></div>';
    }
    if ((it.history || []).length) {
      h += '<details class="plain"><summary>Verlauf (' + it.history.length + ')</summary><ul class="hist" style="margin-top:8px">' + it.history.slice().reverse().slice(0, 20).map(function (e) {
        return '<li><b>' + new Date(e.t).toLocaleDateString('de-DE') + '</b> ' + esc(e.text) + '</li>';
      }).join('') + '</ul></details>';
    }
    $('#dBody').innerHTML = h;
    hydrate($('#dBody'));
  }
  // Frühere Orte aus dem Verlauf („Verschoben: A → B“), neueste zuerst
  function placeTimeline(it) {
    var moves = (it.history || []).map(function (e) { var m = /^Verschoben: (.*) → (.*)$/.exec(e.text || ''); return m ? { t: e.t, from: m[1] } : null; }).filter(Boolean);
    var day = function (t) { return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
    var h = '<div class="ihist"><h3>Wo war es zuletzt?</h3>';
    if (!moves.length) return h + '<p class="tl-empty">Noch keine früheren Orte. Wenn du den Gegenstand verschiebst, merkt sich die App, wo er vorher war.</p></div>';
    h += '<ol class="tl"><li class="cur"><i></i><b>' + esc(M.locText(it)) + '</b><small>Jetzt · seit ' + day(moves[moves.length - 1].t) + '</small></li>';
    for (var i = moves.length - 1; i >= 0; i--) {
      var from = i > 0 ? moves[i - 1].t : it.createdAt;
      h += '<li><i></i><b>' + esc(moves[i].from) + '</b><small>' + (from ? day(from) + ' – ' : 'bis ') + day(moves[i].t) + '</small></li>';
    }
    return h + '</ol></div>';
  }
  $('#dFav').addEventListener('click', function () {
    var it = M.item(detailId); if (!it) return;
    var on = !it.fav, b = this;
    W.Sound.play(on ? 'done' : 'tick');
    restart(b, 'pop');
    updateItem(it, { fav: on }).then(function () { U.toast(on ? '„' + it.name + '“ ist jetzt ein Favorit' : 'Kein Favorit mehr'); });
  });
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
      if (a === 'tovault') sendToVault(it);
    }
  });
  /* Gegenstand verschlüsselt in den Tresor verschieben: Schnappschuss an den Tresor übergeben,
     der die Fotos verschlüsselt. Erst wenn das geklappt hat, wird das Original gelöscht. */
  function sendToVault(it) {
    var snap = {
      name: it.name, place: M.locText(it), note: it.notes || '',
      value: it.value, photoIds: (it.photos || []).map(function (p) { return { id: p.id, t: p.t }; }),
      docs: (it.docs || []).map(function (d) { return { id: d.id, name: d.name, type: d.type, size: d.size }; })
    };
    closeSheet($('#sheetDetail'));
    W.VaultUI.open({ importItem: snap, onImported: function () {
      DB.del('items', it.id).then(function () { DB.delBlobs(blobIdsOf(it)); });
    } });
  }
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
    'vault': function () { if (W.VaultUI) W.VaultUI.open(); },
    'backup': doBackup,
    'restore': function () { $('#restoreInput').click(); },
    'csv': doCsv,
    'report': doReport,
    'labels': openLabelsMenu,
    'labels-boxes': function () { doLabels(DB.places.filter(function (p) { return p.kind === 'kiste'; }).sort(function (a, b) { return natural(a.code || a.name, b.code || b.name); }), 'etiketten-kisten'); },
    'recog': function () {
      prefs.recog = !recogOn(); savePrefs(); if (S.route !== 'settings') render();
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
    if (Date.now() - swipedAt < 400 && e.target.closest('.swipe')) { e.preventDefault(); return; }
    if ((t = e.target.closest('[data-rem-done]'))) { doneRem(t.dataset.remDone, 'done', t.closest('.swipe,.nwrap')); return; }
    if ((t = e.target.closest('[data-rem-snooze]'))) { openSnooze(t.dataset.remSnooze); return; }
    if ((t = e.target.closest('[data-rem-now]'))) { remNow(t.dataset.remNow); return; }
    if ((t = e.target.closest('[data-rem-all]'))) { doneAll(); return; }
    if ((t = e.target.closest('[data-navtile]'))) { var ib = $('.nav-ic', t).getBoundingClientRect(); navFrom = { x: ib.left + ib.width / 2, y: ib.top + ib.height / 2 }; return; }
    if ((t = e.target.closest('button[data-set][data-val]'))) { setPref(t.dataset.set, t.dataset.val, t); return; }
    if ((t = e.target.closest('[data-preview]'))) { var sn = t.dataset.preview; if (sn === 'chime') W.Sound.chime(); else W.Sound.play(sn, sn === 'open' ? tempo().step : undefined); return; }
    if ((t = e.target.closest('[data-set-test]'))) {
      unseen++;
      announce([{ demo: true, type: 'warranty', title: 'So sieht eine Erinnerung aus', text: 'Test aus den Einstellungen', when: '' }]);
      return;
    }
    if ((t = e.target.closest('[data-lock-now]'))) { W.Lock.lockNow(); return; }
    if ((t = e.target.closest('[data-lock-code]'))) { W.Lock.setup(function (ok) { if (ok) U.toast('Neuer Code gespeichert'); render(); }); return; }
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
  function setPref(key, val, btn) {
    prefs[key] = val; savePrefs(); applyPrefs();
    if (btn) U.$$('button', btn.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
    if (key === 'chimeRepeat') W.Sound.chime();
    if (key === 'look' || key === 'accent') updateChrome();
  }
  view.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.matches('input.range[data-set]')) return;
    prefs[t.dataset.set] = +t.value; savePrefs();
    t.style.setProperty('--p', t.value + '%');
    var o = $('#o-' + t.dataset.set); if (o) o.textContent = +t.value ? t.value + ' %' : 'aus';
  });
  view.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('input.range[data-set]')) {
      var k0 = t.dataset.set;
      if (k0 === 'vChime') W.Sound.chime(); else W.Sound.play({ vTap: 'tap', vMenu: 'open', vPage: 'page', vSwipe: 'swoosh' }[k0]);
      return;
    }
    if (t.matches('input.switch[data-set]')) {
      var k = t.dataset.set;
      if (k === 'lock') {
        if (t.checked) W.Lock.setup(function (ok) { if (ok) U.toast('App-Sperre ist an'); render(); });
        else { prefs.lock = false; delete prefs.lockHash; delete prefs.lockCred; savePrefs(); U.toast('App-Sperre ist aus'); render(); }
        return;
      }
      if (k === 'face') {
        if (t.checked) W.Lock.enrollFace().then(function (id) { prefs.lockCred = id; savePrefs(); U.toast('Face ID ist eingerichtet'); }, function () { t.checked = false; U.toast('Face ID konnte nicht eingerichtet werden.'); });
        else { delete prefs.lockCred; savePrefs(); }
        return;
      }
      if (k === 'recog') { ACTIONS.recog(); return; }
      prefs[k] = t.checked; savePrefs(); applyPrefs(); updateChrome();
      return;
    }
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

  /* ---------- Spracheingabe ---------- */
  var ART = /^(die|der|das|den|dem|des|mein|meine|meinen|meinem|meiner|ein|eine|einen|einem)\s+/i;
  function cap(t) { t = String(t || '').trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function stripArt(t) { return String(t || '').trim().replace(ART, '').trim(); }
  function words(t) { return U.norm(t).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 && !ART.test(w + ' '); }); }
  function findItemFor(text) {
    var tk = words(stripArt(text)); if (!tk.length) return null;
    var best = null, bestScore = 0;
    DB.items.forEach(function (it) {
      var n = U.norm(it.name), sc = tk.reduce(function (a, w) { return a + (n.indexOf(w) >= 0 ? 1 : 0); }, 0);
      if (sc > bestScore || (sc === bestScore && sc > 0 && best && it.name.length < best.name.length)) { best = it; bestScore = sc; }
    });
    return bestScore ? best : null;
  }
  function escRe(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function findPlaceIn(text) {
    var n = ' ' + U.norm(text) + ' ', best = null;
    DB.places.forEach(function (p) {
      var code = U.norm(p.code || ''), name = U.norm(p.name || '');
      var hit = (code && new RegExp('[^a-z0-9]' + escRe(code) + '[^a-z0-9]').test(n)) || (name.length > 2 && n.indexOf(name) >= 0);
      if (hit && (!best || name.length > U.norm(best.name).length)) best = p;
    });
    return best;
  }
  function findRoomIn(text) {
    var n = U.norm(text), best = null;
    M.rooms().forEach(function (r) { var rn = U.norm(r.name); if (rn && n.indexOf(rn) >= 0 && (!best || rn.length > U.norm(best.name).length)) best = r; });
    return best;
  }
  // Übrig gebliebene Wörter nach Raum und Möbel/Kiste werden zum „genauen Ort“
  function restSpot(text, room, place) {
    var t = ' ' + text + ' ';
    [room && room.name, place && place.name, place && place.code, place && KIND[place.kind]].filter(Boolean).forEach(function (w) { t = t.replace(new RegExp('(^|\\s)' + escRe(w) + '(?=\\s|$)', 'ig'), ' '); });
    return cap(t.replace(/\s+(im|in|ins|in der|in dem|auf|auf dem|auf der|unter|unterm|an|am|bei|beim|zu|zur|zum)\s+/ig, ' ').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim().replace(ART, '').replace(/^(die|der|das|den|dem|des|ein|eine|einen|einem|mein|meine|meinen|meinem)$/i, ''));
  }
  function parseCommand(t) {
    var s0 = t.toLowerCase().replace(/[.!?]+$/g, '').trim(), m;
    m = s0.match(/^(?:leg|lege|pack|packe|stell|stelle|tu|tue|bring|bringe|verschieb|verschiebe|räum|räume|häng|hänge)\s+(.+?)\s+(?:in|ins|auf|unter|zu|zur|zum|nach|an|in die|in den|in das)\s+(.+)$/);
    if (m) return { type: 'move', what: m[1], where: m[2] };
    m = s0.match(/^(?:die|der|das|mein|meine|unser|unsere)?\s*(.+?)\s+(?:ist|sind)\s+(?:leer|alle|aufgebraucht)$/);
    if (m) return { type: 'shop', what: m[1] };
    m = s0.match(/^erinnere mich\s+(morgen|übermorgen|heute abend|heute|nächste woche|in einer woche)?\s*(?:an|daran,?)?\s*(.+)$/);
    if (m) return { type: 'remind', when: m[1] || 'morgen', what: m[2] };
    return null;
  }
  function runCommand(c) {
    if (c.type === 'move') {
      var it = findItemFor(c.what);
      if (!it) { U.toast('„' + cap(stripArt(c.what)) + '“ habe ich nicht gefunden.'); setQuery(stripArt(c.what)); return; }
      var place = findPlaceIn(c.where), room = place ? M.room(M.placeRoomId(place)) : findRoomIn(c.where);
      if (!place && !room) { U.toast('Den Ort „' + cap(stripArt(c.where)) + '“ kenne ich noch nicht. Leg ihn unter Orte an.'); return; }
      var n = Object.assign({}, it, { roomId: room ? room.id : '', placeId: place ? place.id : '', spot: restSpot(c.where, room, place), updatedAt: Date.now() });
      var txt = locationChangeText(it, n); if (txt) n.history = histPush(it, txt);
      DB.put('items', n).then(function () { W.Sound.play('done'); U.toast('„' + it.name + '“ liegt jetzt: ' + M.locText(n)); openDetail(it.id); });
    } else if (c.type === 'shop') {
      var it2 = findItemFor(c.what);
      if (it2) updateItem(it2, { qty: 0, minQty: parseInt(it2.minQty, 10) > 0 ? it2.minQty : 1 }, 'Leer, auf die Einkaufsliste').then(function () { markSeenSilently(); W.Sound.play('done'); U.toast('„' + it2.name + '“ steht auf der Einkaufsliste'); });
      else addReminder(cap(stripArt(c.what)) + ' kaufen', U.today()).then(function () { W.Sound.play('done'); U.toast('„' + cap(stripArt(c.what)) + ' kaufen“ steht bei Fällig'); });
    } else if (c.type === 'remind') {
      var add = { 'morgen': 1, 'übermorgen': 2, 'heute': 0, 'heute abend': 0, 'nächste woche': 7, 'in einer woche': 7 }[c.when];
      var date = add ? U.addInterval(U.today(), add, 'd') : U.today();
      addReminder(cap(stripArt(c.what)), date).then(function () { W.Sound.play('done'); U.toast('Erinnerung für ' + c.when + ' angelegt'); });
    }
  }
  function voiceSearch() {
    W.Voice.listen({
      hint: 'Frag „Wo ist das Ladekabel?“ oder sag „Leg die Bohrmaschine in die Garage“, „Milch ist leer“ oder „Erinnere mich morgen an …“',
      onResult: function (t) { var c = parseCommand(t); if (c) runCommand(c); else setQuery(t.replace(/[.!]+$/, '')); },
      onKeyboard: function () { $('#q').focus(); }
    });
  }
  $('#qMic').addEventListener('click', voiceSearch);
  // Erfassen: „Winterstiefel im Flur, unterster Schuhschrank“ → Name, Raum, Möbel/Kiste, genauer Ort
  function fillFromVoice(t) {
    var clean = t.replace(/[.!?]+$/, '').trim();
    var place = findPlaceIn(clean), room = place ? M.room(M.placeRoomId(place)) : findRoomIn(clean);
    var parts = clean.split(/,|\s+(?:im|in der|in dem|in|auf dem|auf der|auf|unter|bei)\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
    var name = cap(stripArt(parts.shift() || ''));
    var spot = restSpot(parts.join(' '), room, place);
    var f = $('#f-name');
    if (name) { f.value = name; restart(f, 'filled'); $('#nameField').classList.remove('err'); $('#nameErr').hidden = true; }
    if (room) {
      var rs = $('#f-room'), ps = $('#f-place');
      rs.innerHTML = roomOptionsHTML(room.id, true); rs.value = room.id; rs.dataset.prev = room.id;
      ps.innerHTML = placeOptionsHTML(room.id, place ? place.id : '', { withNew: true }); ps.dataset.prev = ps.value;
      fillDatalists(room.id);
      setTimeout(function () { restart(rs, 'filled'); if (place) restart(ps, 'filled'); }, 180);
    }
    if (spot) setTimeout(function () { var sp = $('#f-spot'); sp.value = spot; restart(sp, 'filled'); }, 360);
    W.Sound.play('done');
  }
  $('#eVoice').addEventListener('click', function () {
    W.Voice.listen({ hint: 'Sag Name, Raum und Ort, z. B. „Akkuschrauber, Garage, Werkbank“', onResult: fillFromVoice, onKeyboard: function () { $('#f-name').focus(); } });
  });

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

  /* ---------- Töne und Animation beim Antippen ----------
     Erst beim Loslassen, und nur wenn der Finger kaum bewegt wurde: wer nur scrollt, hört nichts. */
  var tapCand = null;
  document.addEventListener('pointerdown', function (e) {
    tapCand = null;
    var t = e.target;
    if (!t.closest || t.closest('#lock,#voice,#vaultui,.orb,.petal,.dn,.swipe,.range,.play,#nbub,#npill,#qMic')) return;
    if (t.closest('.switch,.pseg button,.seg button,.swatches button')) { tapCand = { id: e.pointerId, x: e.clientX, y: e.clientY, snd: 'tick' }; return; }
    var hit = t.closest('.btn,.row,.chip,.card,.icon-btn,.qa,.rchip,.nav-tile,.recent-item,.fab,.linkish,.linkbtn,.tag,.dymo,.favbtn,.avoice,.nrow,.set-row,.mini-list .main');
    if (!hit) return;
    var ic = hit.matches('.nav-tile') ? $('.nav-ic', hit) : hit.matches('.qa') ? $('.qi', hit) : hit.matches('.fab') ? hit : hit.matches('.row') ? $('.ric', hit) : null;
    tapCand = { id: e.pointerId, x: e.clientX, y: e.clientY, snd: 'tap', ic: ic };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (tapCand && e.pointerId === tapCand.id && Math.abs(e.clientX - tapCand.x) + Math.abs(e.clientY - tapCand.y) > 10) tapCand = null;
  }, true);
  document.addEventListener('pointercancel', function () { tapCand = null; }, true);
  window.addEventListener('scroll', function () { tapCand = null; }, { passive: true, capture: true });
  document.addEventListener('pointerup', function (e) {
    var c = tapCand; tapCand = null;
    if (!c || e.pointerId !== c.id) return;
    W.Sound.play(c.snd);
    if (c.ic) animIcon(c.ic, true);
  }, true);

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
  DB.on(markSeenSilently);
  applyPrefs();
  parseHash();
  DB.open().then(function () {
    reindex();
    return seedRooms();
  }).then(function () {
    S.ready = true;
    render();
    registerSW();
    setTimeout(checkReminders, 1200);
    setInterval(checkReminders, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(checkReminders, 700); });
    // Bilderkennung im Hintergrund vorbereiten, damit sie beim ersten Foto schnell ist
    if (recogOn() && DB.persistent) setTimeout(function () { W.Recognizer.load().catch(function () { /* wird beim Foto erneut versucht */ }); }, 4000);
  }).catch(function (e) {
    console.error(e);
    view.innerHTML = '<div class="empty"><h2>Die App konnte nicht starten</h2><p>' + esc(e && e.message || e) + '</p></div>';
  });
})(window.W = window.W || {});
