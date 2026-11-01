// TCG Sammlung – Hauptprogramm (Ansichten, Navigation)
import { $, $$, esc, uid, debounce, toast, sheet, confirmDialog, zoomImage, compressImage, pickFile, money, num, pct, fmtDate, icon, norm, shareOrDownload, download } from './util.js';
import * as store from './db.js';
import * as cat from './catalog.js';
import { GAMES, GAME_IDS, CONDITIONS, LANGS, GRADERS, gameInfo } from './catalog.js';

const view = $('#view');
const titleEl = $('#title');
const backBtn = $('#backBtn');
const topActions = $('#topActions');
let S = null; // Einstellungen
let owned = new Map(); // "game:cardId" -> { qty, entries }
let wishSet = new Set();
let priceMap = new Map();
let routeToken = 0;
let lastHash = '#/home';

/* ======================================================================
   Navigation
   Normal läuft sie über die Adresse (#/sets …). Eingebettet (z. B. als
   Vorschau in einem Rahmen) kann die Adresse gesperrt sein – dann merkt
   sich die App die Seiten selbst.
   ====================================================================== */
const EMBEDDED = (() => { try { return window.self !== window.top; } catch { return true; } })();
const navStack = [];
let memHash = '#/home';
function curHash() { return EMBEDDED ? memHash : (location.hash || '#/home'); }
// Richtung der letzten Navigation: 'forward' (neue Seite), 'replace' (Seite tauschen), 'back' (zurück)
let navDir = 'forward';
let navPending = false;
let curDir = 'forward';
const scrollPos = new Map();
let renderedHash = null;
function go(h) {
  navDir = 'forward'; navPending = true;
  if (EMBEDDED) { if (h !== memHash) { navStack.push(memHash); memHash = h; } route(); }
  else if (location.hash === h) route();
  else location.hash = h;
}
function replaceRoute(h) {
  navDir = 'replace'; navPending = true;
  if (EMBEDDED) { memHash = h; route(); } else location.replace(h);
}
function goBack() {
  navDir = 'back'; navPending = true;
  if (EMBEDDED) { memHash = navStack.pop() || '#/home'; route(); }
  else if (history.length > 1) history.back();
  else location.hash = '#/home';
}

/* ======================================================================
   Start
   ====================================================================== */
// Fehler sichtbar machen statt einer "toten" Seite
window.addEventListener('error', (e) => { if (e.message) toast('Fehler: ' + e.message, { ms: 6000 }); });
window.addEventListener('unhandledrejection', (e) => toast('Fehler: ' + (e.reason?.message || e.reason), { ms: 6000 }));

async function init() {
  S = await store.settings();
  if (!store.persistent) setTimeout(() => toast('Hinweis: Dieser Browser erlaubt hier kein Speichern – Einträge gehen beim Schließen verloren.', { ms: 7000 }), 800);
  applyTheme();
  cat.setPkLang(S.pkLang);
  await refreshOwned();
  store.onChange(async () => { await refreshOwned(); });
  window.addEventListener('hashchange', () => {
    if (EMBEDDED) return;
    if (!navPending) navDir = 'back'; // Zurück-Taste des Browsers / Android
    route();
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  backBtn.onclick = () => goBack();
  // Links auf App-Seiten selbst abfangen (funktioniert auch eingebettet)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  // Bild-Fallback (z. B. deutsches Pokémon-Bild fehlt -> englisch, sonst Platzhalter)
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fb = img.dataset.fb;
    if (fb && img.src !== fb) { img.dataset.fb = ''; img.src = fb; return; }
    if (img.closest('.pic')) {
      img.style.display = 'none';
      const ph = img.parentElement.querySelector('.ph');
      if (ph) ph.hidden = false;
    } else img.style.visibility = 'hidden';
  }, true);
  cat.setUserCatalog(await store.db.get('kv', 'userCatalog'));
  const extra = await store.db.get('kv', 'pokemonExtra');
  if (extra) cat.load('pokemon').then(() => cat.mergePokemonExtra(extra)).catch(() => {});
  route();
  registerSW();
  store.requestPersist().catch(() => {});
}

function applyTheme() {
  let t = S.theme;
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  const tc = $('meta[name="theme-color"]');
  if (tc) tc.content = t === 'light' ? '#f3f5fa' : '#0f1420';
}

async function refreshOwned() {
  const list = await store.entries();
  owned = new Map();
  for (const e of list) {
    const o = owned.get(e.key) || { qty: 0, entries: [] };
    o.qty += e.qty || 0;
    o.entries.push(e);
    owned.set(e.key, o);
  }
  wishSet = new Set((await store.wishlist()).map((w) => w.key));
  priceMap = await store.prices();
}

const keyOf = (c) => `${c.game}:${c.id}`;
/** Preis als Text, "ab …" wenn Cardmarket nur Angebote, aber keine Verkäufe kennt */
const priceText = (c) => { const v = marketPrice(c); return v == null ? '' : (c.eurLow && !priceMap.get(keyOf(c))?.eur ? 'ab ' : '') + money(v); };
/** Eingeblendete Spiele (Einstellungen) */
const activeGames = () => { const a = GAME_IDS.filter((g) => (S.games || GAME_IDS).includes(g)); return a.length ? a : ['dbfw']; };
/** Lädt die eingeblendeten Spiele und alle, von denen du Karten hast */
async function loadNeeded() {
  const used = new Set(activeGames());
  for (const k of owned.keys()) used.add(k.split(':')[0]);
  for (const k of wishSet) used.add(k.split(':')[0]);
  return cat.loadAll(GAME_IDS.filter((g) => used.has(g)));
}
const ownedQty = (c) => owned.get(keyOf(c))?.qty || 0;

/** Marktwert pro Stück in EUR (eigener Wert > Online-Preis > TCGplayer-Schätzung) */
function marketPrice(c) {
  if (!c) return null;
  const p = priceMap.get(keyOf(c));
  if (p?.eur != null) return p.eur;
  if (c.eur != null) return c.eur;
  if (c.usd != null) return Math.round(c.usd * S.usdRate * 100) / 100;
  if (p?.usd != null) return Math.round(p.usd * S.usdRate * 100) / 100;
  return null;
}
function entryValue(e) {
  const per = e.value != null && e.value !== '' ? +e.value : (e.graded ? null : marketPrice(cardOf(e)));
  return per != null ? per * (e.qty || 1) : 0;
}
function cardOf(e) {
  if (e.custom) return { game: e.game, id: 'custom:' + e.id, name: e.custom.name, no: e.custom.no || '', set: e.custom.set || '', custom: true, photo: e.photos?.[0] };
  return cat.getCard(e.game, e.cardId);
}

/* ======================================================================
   Router
   ====================================================================== */
const routes = [
  [/^#?\/?(home)?$/, viewHome, 'home'],
  [/^#\/collection$/, viewCollection, 'collection'],
  [/^#\/catalog(?:\/(\w+))?$/, viewCatalog, 'catalog'],
  [/^#\/set\/(\w+)\/(.+)$/, viewSet, 'catalog'],
  [/^#\/card\/(\w+)\/(.+)$/, viewCard, null],
  [/^#\/scan$/, viewScan, 'scan'],
  [/^#\/wish$/, viewWish, 'more'],
  [/^#\/stats$/, viewStats, 'more'],
  [/^#\/dupes$/, viewDupes, 'more'],
  [/^#\/bulk$/, viewBulk, 'more'],
  [/^#\/more$/, viewMore, 'more'],
  [/^#\/settings$/, viewSettings, 'more'],
  [/^#\/backup$/, viewBackup, 'more'],
  [/^#\/help$/, viewHelp, 'more'],
  [/^#\/search$/, viewSearch, null],
];

async function route() {
  const h = curHash();
  const token = ++routeToken;
  curDir = navDir;
  navDir = 'forward'; navPending = false;
  if (renderedHash && renderedHash !== h) scrollPos.set(renderedHash, window.scrollY);
  if (h !== '#/scan') {
    lastHash = h;
    // Zurück-Taste (Android) schließt offene Fenster und den Scanner
    $$('.sheet-backdrop').forEach((b) => b.click());
    $('.scanner [data-close]')?.click();
  }
  for (const [re, fn, tab] of routes) {
    const m = h.match(re);
    if (!m) continue;
    if (tab) $$('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    topActions.innerHTML = '';
    backBtn.hidden = /^#?\/?(home|collection|scan|more)?$/.test(h) || /^#\/catalog(\/\w+)?$/.test(h);
    view.innerHTML = '<div class="loader"><span class="spin"></span>Lade …</div>';
    try {
      await fn(...m.slice(1).map((x) => (x ? decodeURIComponent(x) : x)), token);
    } catch (e) {
      console.error(e);
      if (token === routeToken) view.innerHTML = `<div class="empty"><b>Fehler</b>${esc(e.message)}</div>`;
    }
    if (token === routeToken) {
      renderedHash = h;
      const y = curDir === 'back' ? scrollPos.get(h) : 0;
      // Zurück: dorthin, wo du warst. Sonst oben anfangen.
      window.scrollTo(0, y || 0);
      if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    }
    return;
  }
  replaceRoute('#/home');
}
const stale = (t) => t !== undefined && t !== routeToken;
function setTitle(t) { topActions.innerHTML = ''; titleEl.textContent = t; document.title = t === 'TCG Sammlung' ? t : `${t} – TCG Sammlung`; }
function addAction(html, onclick, label = '') {
  const b = document.createElement('button');
  b.className = 'icon-btn';
  b.innerHTML = html;
  b.setAttribute('aria-label', label);
  b.onclick = onclick;
  topActions.appendChild(b);
  return b;
}

/* ======================================================================
   Kachel einer Karte
   ====================================================================== */
function tileHTML(c, o = {}) {
  if (!c) return '';
  const q = o.qty ?? ownedQty(c);
  const isMissing = o.markMissing && !q;
  const spr = c.custom ? '' : cat.spriteHTML(c);
  const src = c.custom || spr ? '' : cat.cardImg(c, 'low');
  const fb = c.custom ? '' : cat.cardImgFallback(c, 'low');
  const name = c.custom ? c.name : cat.cardName(c);
  const flags = [];
  if (o.graded) flags.push(`<span class="badge grade">${esc(o.graded)}</span>`);
  if (c.par) flags.push('<span class="badge" style="background:#7c4dff;color:#fff">P</span>');
  return `<div class="tcg ${isMissing ? 'missing' : ''} ${o.selected ? 'selected' : ''}" data-key="${esc(keyOf(c))}" ${o.idx != null ? `data-idx="${o.idx}"` : ''} ${o.entry ? `data-entry="${esc(o.entry)}"` : ''}>
    <div class="pic">
      ${spr || (src ? `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(src)}" ${fb ? `data-fb="${esc(fb)}"` : ''} alt="${esc(name)}">` : c.photo ? `<img data-photo="${esc(c.photo)}" alt="">` : '')}
      <div class="ph" ${spr || src || c.photo ? 'hidden' : ''}>${esc(name)}<br>${esc(c.no || '')}</div>
      ${q ? `<span class="qty">${q}×</span>` : ''}
      ${o.minus && q ? `<button class="minus" data-minus aria-label="Eine entfernen">−</button>` : ''}
      ${flags.length ? `<div class="flags">${flags.join('')}</div>` : ''}
      ${o.showWish !== false && wishSet.has(keyOf(c)) ? `<span class="wishmark">${icon.heart}</span>` : ''}
    </div>
    ${o.caption === false ? '' : `<div class="cap"><div class="n">${esc(name)}</div><div class="c">${esc(o.sub ?? (c.custom ? (c.no || 'Eigene Karte') : cat.cardNo(c)))}</div>${o.price ? `<div class="pr">${esc(o.price)}</div>` : ''}</div>`}
  </div>`;
}
async function hydratePhotos(root) {
  for (const img of $$('img[data-photo]', root)) {
    const u = await store.photoURL(img.dataset.photo);
    if (u) img.src = u;
  }
}
function bindTiles(root, onTap) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.tcg');
    if (!t || !root.contains(t)) return;
    onTap(t, e);
  });
}
function openCardKey(key) {
  const i = key.indexOf(':');
  go(`#/card/${key.slice(0, i)}/${encodeURIComponent(key.slice(i + 1))}`);
}

/* ======================================================================
   Start
   ====================================================================== */
async function viewHome(_, token) {
  setTitle('TCG Sammlung');
  addAction(icon.search, () => go('#/search'), 'Suchen');
  const list = await store.entries();
  await loadNeeded();
  if (stale(token)) return;
  const totalQty = list.reduce((a, e) => a + (e.qty || 0), 0);
  const value = list.reduce((a, e) => a + entryValue(e), 0);
  const graded = list.filter((e) => e.graded).reduce((a, e) => a + (e.qty || 0), 0);
  const per = {};
  for (const e of list) {
    const g = per[e.game] || (per[e.game] = { qty: 0, uniq: new Set(), value: 0 });
    g.qty += e.qty || 0;
    g.uniq.add(e.key);
    g.value += entryValue(e);
  }
  const recent = [...list].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 12);
  const backupOld = list.length >= 10 && (Date.now() - (S.lastBackup || 0)) > 30 * 864e5;

  view.innerHTML = `
    <div class="hero">
      <div class="stat"><b>${num(totalQty)}</b><span>Karten</span></div>
      <div class="stat"><b>${money(value)}</b><span>Wert (geschätzt)</span></div>
      <div class="stat"><b>${num(graded)}</b><span>Gegradet</span></div>
    </div>
    ${backupOld ? `<div class="notice warn" style="margin-top:12px">${S.lastBackup ? 'Deine letzte Sicherung ist über 30 Tage alt.' : 'Du hast noch keine Sicherung deiner Sammlung.'} <a href="#/backup" style="font-weight:700;text-decoration:underline">Jetzt sichern</a></div>` : ''}
    <h2>Deine Spiele</h2>
    <div class="games">
      ${activeGames().map((g) => {
        const p = per[g];
        const total = cat.sets(g).reduce((a, s) => a + s.cardCount, 0);
        return `<a class="game-tile game-${g}" href="#/catalog/${g}">
          <div><div class="gname">${esc(GAMES[g].short)}</div><div class="gsub">${num(cat.sets(g).length)} Sets · ${num(total)} Karten in der Datenbank</div></div>
          <div class="row"><div class="gnum">${num(p?.qty || 0)}</div><div class="muted small" style="flex:1">Karten · ${num(p?.uniq.size || 0)} verschiedene</div><b>${p ? money(p.value) : ''}</b></div>
        </a>`;
      }).join('')}
    </div>
    ${!list.length ? `<div class="notice" style="margin-top:14px"><b>Willkommen!</b> So startest du:<br>
      1. Einmal im WLAN den <a href="#/backup" style="text-decoration:underline;font-weight:700">Scanner offline vorbereiten</a>.<br>
      2. Unten auf den runden Knopf tippen und eine Karte fotografieren – oder unter <b>Sets</b> den Abhak-Modus nutzen.<br>
      <a href="#/help" style="text-decoration:underline;font-weight:700">Alle Tipps</a></div>` : ''}
    ${(() => {
      const prog = [];
      for (const g of GAME_IDS.filter(cat.isLoaded)) {
        const sids = new Set(list.filter((e) => e.game === g).map((e) => cat.getCard(g, e.cardId)?.set).filter(Boolean));
        for (const sid of sids) {
          const cs = cat.setCards(g, sid);
          const have = cs.filter((c) => owned.has(keyOf(c))).length;
          if (cs.length) prog.push({ g, s: cat.getSet(g, sid), have, total: cs.length });
        }
      }
      prog.sort((a, b) => b.have / b.total - a.have / a.total);
      return prog.length ? `<div class="section-head"><h2>Sets in Arbeit</h2><a href="#/stats">Alle</a></div>
        <div class="list">${prog.slice(0, 4).map((x) => `<a class="item" href="#/set/${x.g}/${encodeURIComponent(x.s.id)}" style="--gc:${GAMES[x.g].color}"><span class="set-code">${esc(cat.setCode(x.s))}</span><div class="grow"><div class="title">${esc(cat.setName(x.s))}</div><div class="progress" style="margin-top:6px"><i style="width:${pct(x.have, x.total)}%"></i></div></div><span class="pct">${x.have}/${x.total}</span></a>`).join('')}</div>` : '';
    })()}
    ${activeGames().length < GAME_IDS.length ? `<p class="small muted" style="margin:8px 2px 0">Weitere Spiele (${GAME_IDS.filter((g) => !activeGames().includes(g)).map((g) => GAMES[g].short).join(', ')}) kannst du unter <a href="#/settings" style="color:var(--accent);font-weight:700">Einstellungen</a> einblenden.</p>` : ''}
    <h2>Schnellzugriff</h2>
    <div class="quick">
      <a href="#/scan">${icon.camera}Scannen</a>
      <a href="#/search">${icon.search}Suchen</a>
      <a href="#/wish">${icon.heart}Wunschliste</a>
      <a href="#/stats">${icon.chart}Statistik</a>
    </div>
    <div class="section-head"><h2>Zuletzt hinzugefügt</h2>${recent.length ? '<a href="#/collection">Alle</a>' : ''}</div>
    ${recent.length ? `<div class="grid" id="recent">${recent.map((e) => {
      const c = cardOf(e);
      return c ? tileHTML(c, { qty: e.qty, graded: e.graded ? `${e.grader} ${e.grade}` : '', entry: e.id }) : '';
    }).join('')}</div>` : `<div class="empty">${icon.camera}<b>Noch keine Karten</b>Tippe unten auf <b>Scannen</b>, fotografiere eine Karte – oder stöbere unter <b>Sets</b> und hake ab, was du hast.</div>`}
  `;
  const r = $('#recent');
  if (r) { bindTiles(r, (t) => openCardKey(t.dataset.key)); hydratePhotos(r); }
}

/* ======================================================================
   Sammlung
   ====================================================================== */
const colState = { game: 'all', q: '', sort: 'new', graded: false, view: null };
async function viewCollection(_, token) {
  if (curDir !== 'back') colState.q = '';
  setTitle('Sammlung');
  colState.view = colState.view || S.collectionView || 'grid';
  const vbtn = addAction(colState.view === 'grid' ? icon.list : icon.grid, async () => {
    colState.view = colState.view === 'grid' ? 'list' : 'grid';
    await store.setSetting('collectionView', colState.view);
    viewCollection(null, routeToken);
  }, 'Ansicht');
  addAction(icon.download, exportCSV, 'Als CSV exportieren');
  await loadNeeded();
  if (stale(token)) return;
  const list = await store.entries();
  const gamesInUse = [...new Set(list.map((e) => e.game))];
  view.innerHTML = `
    <div class="bar"><div class="search">${icon.search}<input type="search" id="cq" placeholder="In deiner Sammlung suchen …" value="${esc(colState.q)}"></div></div>
    <div class="chips" id="cgames">
      ${[['all', 'Alle'], ...GAME_IDS.filter((g) => activeGames().includes(g) || gamesInUse.includes(g)).map((g) => [g, GAMES[g].short]), ...(gamesInUse.includes('custom') ? [['custom', 'Eigene']] : [])].map(([k, l]) => `<button class="chip ${colState.game === k ? 'on' : ''}" data-g="${k}">${l}</button>`).join('')}
      <button class="chip ${colState.graded ? 'on' : ''}" data-graded>Gegradet</button>
    </div>
    <div class="toolbar">
      <select id="csort">
        ${[['new', 'Neueste zuerst'], ['old', 'Älteste zuerst'], ['name', 'Name A–Z'], ['no', 'Set & Nummer'], ['value', 'Wert absteigend'], ['qty', 'Anzahl']].map(([k, l]) => `<option value="${k}" ${colState.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="spacer"></span><span class="muted small" id="ccount"></span>
    </div>
    <div id="clist"></div>`;
  const draw = () => {
    let items = list.slice();
    if (colState.game !== 'all') items = items.filter((e) => e.game === colState.game);
    if (colState.graded) items = items.filter((e) => e.graded);
    const q = norm(colState.q);
    if (q) {
      items = items.filter((e) => {
        const c = cardOf(e);
        const s = c && !c.custom ? cat.getSet(c.game, c.set) : null;
        return norm(`${c?.name} ${c?.nameDe || ''} ${c?.no} ${c?.id} ${s?.name || ''} ${s?.nameDe || ''} ${e.location || ''} ${e.notes || ''} ${e.grader || ''} ${e.lang || ''} ${e.variant || ''}`).includes(q);
      });
    }
    const cmpNo = (a, b) => {
      const ca = cardOf(a), cb = cardOf(b);
      return `${a.game}|${ca?.set}|${ca?.no}`.localeCompare(`${b.game}|${cb?.set}|${cb?.no}`, 'de', { numeric: true });
    };
    const sorters = {
      new: (a, b) => (b.created || 0) - (a.created || 0),
      old: (a, b) => (a.created || 0) - (b.created || 0),
      name: (a, b) => (cat.cardName(cardOf(a)) || '').localeCompare(cat.cardName(cardOf(b)) || '', 'de'),
      no: cmpNo,
      value: (a, b) => entryValue(b) - entryValue(a),
      qty: (a, b) => (b.qty || 0) - (a.qty || 0),
    };
    items.sort(sorters[colState.sort]);
    const total = items.reduce((a, e) => a + (e.qty || 0), 0);
    $('#ccount').textContent = `${num(total)} Karten · ${money(items.reduce((a, e) => a + entryValue(e), 0))}`;
    const el = $('#clist');
    if (!items.length) {
      el.innerHTML = list.length ? '<div class="empty"><b>Nichts gefunden</b>Andere Filter probieren.</div>'
        : `<div class="empty">${icon.box}<b>Deine Sammlung ist leer</b>Scanne Karten oder hake sie unter „Sets“ ab.</div>`;
      return;
    }
    if (colState.view === 'list') {
      el.innerHTML = `<div class="list">${items.slice(0, 600).map((e) => {
        const c = cardOf(e);
        if (!c) return '';
        const s = !c.custom ? cat.getSet(c.game, c.set) : null;
        const v = entryValue(e);
        return `<div class="item" data-entry="${esc(e.id)}" data-key="${esc(keyOf(c))}">
          ${c.custom ? `<img class="set-logo" style="width:40px;height:56px;object-fit:cover;border-radius:5px" data-photo="${esc(c.photo || '')}" alt="">` : cat.spriteHTML(c) ? `<div style="width:40px;height:56px;border-radius:5px;overflow:hidden;flex:none;position:relative">${cat.spriteHTML(c)}</div>` : `<img loading="lazy" referrerpolicy="no-referrer" style="width:40px;height:56px;object-fit:cover;border-radius:5px;flex:none" src="${esc(cat.cardImg(c))}" data-fb="${esc(cat.cardImgFallback(c))}" alt="">`}
          <div class="grow"><div class="title">${e.qty > 1 ? `${e.qty}× ` : ''}${esc(cat.cardName(c) || c.name)}</div>
          <div class="sub">${esc(c.custom ? c.no : cat.cardNo(c))} · ${esc(s ? cat.setCode(s) : (c.set || 'Eigene'))} · ${esc(e.condition || '')} ${esc(e.lang || '')}${e.graded ? ` · <b>${esc(e.grader)} ${esc(e.grade)}</b>` : ''}</div></div>
          <b class="small">${v ? money(v) : ''}</b>
        </div>`;
      }).join('')}</div>`;
      el.querySelectorAll('.item').forEach((it) => { it.onclick = () => openEntry(it.dataset.entry); });
    } else {
      el.innerHTML = `<div class="grid">${items.slice(0, 600).map((e) => {
        const c = cardOf(e);
        return c ? tileHTML(c, { qty: e.qty, graded: e.graded ? `${e.grader} ${e.grade}` : '', entry: e.id, sub: `${c.custom ? c.no : cat.cardNo(c)}${e.variant && !/^(Standard|Normal)$/.test(e.variant) ? ' · ' + e.variant : ''}` }) : '';
      }).join('')}</div>`;
      bindTiles(el, (t) => {
        const e = list.find((x) => x.id === t.dataset.entry);
        if (e?.custom) openEntry(e.id); else openCardKey(t.dataset.key);
      });
    }
    if (items.length > 600) el.insertAdjacentHTML('beforeend', `<p class="muted small" style="text-align:center">… und ${items.length - 600} weitere. Nutze Suche oder Filter.</p>`);
    hydratePhotos(el);
  };
  $('#cq').oninput = debounce((e) => { colState.q = e.target.value; draw(); }, 150);
  $$('#cgames [data-g]').forEach((b) => (b.onclick = () => { colState.game = b.dataset.g; $$('#cgames [data-g]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  $('#cgames [data-graded]').onclick = (e) => { colState.graded = !colState.graded; e.currentTarget.classList.toggle('on', colState.graded); draw(); };
  $('#csort').onchange = (e) => { colState.sort = e.target.value; draw(); };
  vbtn.innerHTML = colState.view === 'grid' ? icon.list : icon.grid;
  draw();
}

async function openEntry(id) {
  const e = (await store.entries()).find((x) => x.id === id);
  if (!e) return;
  const c = cardOf(e);
  openEntrySheet(c, e);
}

/* ======================================================================
   Katalog / Sets
   ====================================================================== */
const catState = { game: null, q: '', serie: 'all' };
async function viewCatalog(game, token) {
  game = game && GAMES[game] ? game : catState.game && activeGames().includes(catState.game) ? catState.game : activeGames()[0];
  if (curDir !== 'back' || catState.game !== game) catState.q = '';
  catState.game = game;
  setTitle('Sets');
  addAction(icon.search, () => go('#/search'), 'Karten suchen');
  view.innerHTML = '<div class="loader"><span class="spin"></span>Lade Kartendatenbank …</div>';
  await cat.load(game);
  if (stale(token)) return;
  const sets = cat.sets(game);
  const progress = (s) => {
    let have = 0;
    for (const c of cat.setCards(game, s.id)) if (owned.has(keyOf(c))) have++;
    return have;
  };
  view.innerHTML = `
    <div class="chips" id="ggames" ${activeGames().length < 2 && activeGames().includes(game) ? 'hidden' : ''}>${[...new Set([...activeGames(), game])].map((g) => `<button class="chip ${g === game ? 'on' : ''}" data-g="${g}">${GAMES[g].short}</button>`).join('')}</div>
    <div class="bar" style="margin-top:6px"><div class="search">${icon.search}<input type="search" id="sq" placeholder="Set suchen (Name oder Code) …" value="${esc(catState.q)}"></div></div>
    <div class="toolbar"><label class="row small muted"><span class="switch"><input type="checkbox" id="onlyMine"><span></span></span> Nur Sets mit meinen Karten</label></div>
    <div id="slist"></div>`;
  $$('#ggames [data-g]').forEach((b) => (b.onclick = () => go(`#/catalog/${b.dataset.g}`)));
  const draw = () => {
    const q = norm(catState.q);
    const mine = $('#onlyMine').checked;
    let list = sets.slice().sort(setSort(game));
    if (q) list = list.filter((s) => norm(`${s.id} ${s.abbr || ''} ${s.name} ${s.nameDe || ''} ${s.serie || ''}`).includes(q));
    const rows = list.map((s) => ({ s, have: progress(s) })).filter((x) => !mine || x.have);
    const groups = new Map();
    for (const r of rows) {
      const g = setGroup(game, r.s);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    }
    if (game !== 'pokemon') {
      const order = GROUP_ORDER[game];
      const sorted = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
      groups.clear();
      sorted.forEach(([k, v]) => groups.set(k, v));
    }
    $('#slist').innerHTML = rows.length ? [...groups.entries()].map(([g, rs]) => `
      <h2>${esc(g)}</h2>
      <div class="list game-${game}">${rs.map(({ s, have }) => {
        const total = s.cardCount;
        const logo = cat.setLogo(s);
        return `<a class="item set-item" href="#/set/${game}/${encodeURIComponent(s.id)}">
          ${logo ? `<img class="set-logo" loading="lazy" referrerpolicy="no-referrer" src="${esc(logo)}" data-fb="${esc(cat.setLogoFallback(s))}" alt="">` : `<span class="set-code">${esc(cat.setCode(s))}</span>`}
          <div class="grow"><div class="title">${esc(cat.setName(s))}</div>
            <div class="sub">${esc(cat.setCode(s))}${s.date ? ' · ' + esc(fmtDate(s.date)) : ''} · ${num(total)} Karten</div>
            <div class="progress" style="margin-top:6px"><i style="width:${pct(have, total)}%"></i></div></div>
          <span class="pct">${have}/${total}</span>
        </a>`;
      }).join('')}</div>`).join('') : '<div class="empty"><b>Keine Sets gefunden</b></div>';
  };
  $('#sq').oninput = debounce((e) => { catState.q = e.target.value; draw(); }, 150);
  $('#onlyMine').onchange = draw;
  draw();
}

/* Reihenfolge der Sets: FB01, FB02, … dann Manga/Story Booster, Starter Decks, Promos */
const GROUP_ORDER = {
  dbfw: ['Booster Packs', 'Manga Booster', 'Story Booster', 'Starter Decks', 'Promos & Event-Packs', 'Weitere Sets'],
  op: ['Booster Packs', 'Extra Booster', 'Premium Booster', 'Starter Decks', 'Promos & Sonstiges', 'Weitere Sets'],
};
function setGroup(game, s) {
  if (game === 'pokemon') return s.serie || 'Weitere Sets';
  const p = (/^[A-Z]+/.exec(s.id) || [''])[0];
  if (game === 'dbfw') {
    return { FB: 'Booster Packs', SB: 'Manga Booster', ST: 'Story Booster', FS: 'Starter Decks', PROMO: 'Promos & Event-Packs', REP: 'Promos & Event-Packs' }[p] || 'Weitere Sets';
  }
  return { OP: 'Booster Packs', EB: 'Extra Booster', PRB: 'Premium Booster', ST: 'Starter Decks', P: 'Promos & Sonstiges', OTHER: 'Promos & Sonstiges' }[p] || 'Weitere Sets';
}
function setSort(game) {
  if (game === 'pokemon') return (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.order - b.order;
  const key = (s) => { const n = /\d+/.exec(s.id); return [(/^[A-Z]+/.exec(s.id) || [''])[0], n ? +n[0] : 0]; };
  return (a, b) => { const ka = key(a), kb = key(b); return ka[0].localeCompare(kb[0]) || ka[1] - kb[1] || a.id.localeCompare(b.id); };
}

const setState = { filter: 'all', view: null, tick: false, sort: 'no' };
async function viewSet(game, setId, token) {
  await cat.load(game);
  if (stale(token)) return;
  const s = cat.getSet(game, setId);
  if (!s) throw new Error('Set nicht gefunden');
  setState.view = setState.view || S.setView || 'grid';
  setTitle(`${cat.setCode(s)} ${cat.setName(s)}`);
  addAction(setState.view === 'binder' ? icon.grid : icon.binder, async () => {
    setState.view = setState.view === 'binder' ? 'grid' : 'binder';
    await store.setSetting('setView', setState.view);
    viewSet(game, setId, routeToken);
  }, 'Binder-Ansicht');
  addAction(icon.sliders, () => setMenu(game, s), 'Mehr');
  const cards = cat.setCards(game, setId).slice();
  const collator = new Intl.Collator('de', { numeric: true });
  const sortCards = () => {
    if (setState.sort === 'name') cards.sort((a, b) => cat.cardName(a).localeCompare(cat.cardName(b), 'de'));
    else if (setState.sort === 'rarity') cards.sort((a, b) => (a.r || '').localeCompare(b.r || '') || collator.compare(a.id, b.id));
    else if (setState.sort === 'price') cards.sort((a, b) => (marketPrice(b) || 0) - (marketPrice(a) || 0));
    else {
      // Karten mit der eigenen Set-Nummer zuerst, Sonder-Parallels älterer Karten ans Ende
      const pre = setId.replace(/-/g, '');
      const own = (c) => (game === 'pokemon' || c.no.replace(/-.*/, '') === pre || !/\d/.test(pre) ? 0 : 1);
      cards.sort((a, b) => own(a) - own(b) || collator.compare(a.no, b.no) || (a.p || '').localeCompare(b.p || '') || collator.compare(a.id, b.id));
    }
  };
  sortCards();
  const hasPar = cards.some((c) => c.par);
  const rarities = [...new Set(cards.map((c) => c.r).filter(Boolean))];
  const logo = cat.setLogo(s);
  const head = () => {
    const have = cards.filter((c) => owned.has(keyOf(c))).length;
    const base = cards.filter((c) => !c.par);
    const haveBase = base.filter((c) => owned.has(keyOf(c))).length;
    const val = cards.reduce((a, c) => a + (owned.has(keyOf(c)) ? (marketPrice(c) || 0) * ownedQty(c) : 0), 0);
    const priced = cards.filter((c) => marketPrice(c) != null);
    const missVal = cards.reduce((a, c) => a + (!owned.has(keyOf(c)) && !c.par ? marketPrice(c) || 0 : 0), 0);
    const pd = cat.pricesDate(game);
    return `<div class="panel game-${game}" style="--gc:${GAMES[game].color}">
      <div class="row">${logo ? `<img src="${esc(logo)}" data-fb="${esc(cat.setLogoFallback(s))}" referrerpolicy="no-referrer" style="height:44px;max-width:120px;object-fit:contain" alt="">` : `<span class="set-code" style="width:64px;height:44px">${esc(cat.setCode(s))}</span>`}
        <div class="grow" style="flex:1;min-width:0"><b>${have} / ${cards.length}</b> <span class="muted small">gesammelt (${pct(have, cards.length)} %)</span>
        ${hasPar ? `<div class="muted small">Ohne Parallels: ${haveBase} / ${base.length}</div>` : ''}
        ${s.date ? `<div class="muted small">Erschienen ${fmtDate(s.date)}${s.official ? ` · ${s.official} offizielle Karten` : ''}</div>` : ''}
        ${priced.length ? `<div class="small" style="margin-top:4px">Wert deiner Karten: <b style="font-size:16px">${money(val)}</b></div>
          <div class="muted tiny">Fehlende Karten ohne Parallels: ca. ${money(missVal)}${pd ? ` · Cardmarket, Stand ${fmtDate(pd)}` : ''}</div>` : ''}</div></div>
      <div class="progress" style="margin-top:10px"><i style="width:${pct(have, cards.length)}%"></i></div>
    </div>`;
  };
  view.innerHTML = `<div id="shead"></div>
    <div class="chips" id="sfilter" style="margin-top:12px">
      ${[['all', 'Alle'], ['have', 'Habe ich'], ['miss', 'Fehlen'], ...(hasPar ? [['base', 'Ohne Parallel'], ['par', 'Nur Parallel']] : []), ['wish', 'Wunschliste'], ...rarities.slice(0, 14).map((r) => ['r:' + r, r])].map(([k, l]) => `<button class="chip ${setState.filter === k ? 'on' : ''}" data-f="${esc(k)}">${esc(l)}</button>`).join('')}
    </div>
    <div class="toolbar">
      <select id="ssort">${[['no', 'Nummer'], ['name', 'Name'], ['rarity', 'Seltenheit'], ['price', 'Preis']].map(([k, l]) => `<option value="${k}" ${setState.sort === k ? 'selected' : ''}>Sortieren: ${l}</option>`).join('')}</select>
      <span class="spacer"></span>
      <label class="row small" style="font-weight:650"><span class="switch"><input type="checkbox" id="tick" ${setState.tick ? 'checked' : ''}><span></span></span> Abhak-Modus</label>
    </div>
    ${setState.tick ? `<div class="notice row" id="tickhint" style="margin-bottom:10px;align-items:center"><span style="flex:1">Tippen: +1 · <b>−</b>: eine entfernen · Halten: Karte öffnen</span>
      <button class="btn sm" id="tickUndo" disabled>↶ Rückgängig</button></div>` : ''}
    <div id="sgrid"></div>`;
  $('#shead').innerHTML = head();
  const tile = (c) => tileHTML(c, { markMissing: true, sub: `${cat.cardNo(c)}${c.r ? ' · ' + c.r : ''}`, price: priceText(c), minus: setState.tick });
  // Verlauf im Abhak-Modus: jede Aktion lässt sich zurücknehmen, auch mehrere hintereinander
  const tickHistory = [];
  const updUndo = () => { const b = $('#tickUndo'); if (b) { b.disabled = !tickHistory.length; b.textContent = tickHistory.length ? `↶ Rückgängig (${tickHistory.length})` : '↶ Rückgängig'; } };
  const refreshTile = (c) => {
    $('#shead').innerHTML = head();
    $$('#sgrid .tcg').filter((t) => t.dataset.key === keyOf(c)).forEach((t) => { t.outerHTML = setState.view === 'binder' ? tileHTML(c, { markMissing: true, minus: setState.tick }) : tile(c); });
  };
  const draw = () => {
    const f = setState.filter;
    const list = cards.filter((c) => {
      const has = owned.has(keyOf(c));
      if (f === 'have') return has;
      if (f === 'miss') return !has;
      if (f === 'base') return !c.par;
      if (f === 'par') return c.par;
      if (f === 'wish') return wishSet.has(keyOf(c));
      if (f.startsWith('r:')) return c.r === f.slice(2);
      return true;
    });
    const el = $('#sgrid');
    if (!list.length) { el.innerHTML = '<div class="empty"><b>Keine Karten</b>für diesen Filter.</div>'; return; }
    if (setState.view === 'binder') {
      const pages = [];
      for (let i = 0; i < list.length; i += 9) pages.push(list.slice(i, i + 9));
      el.innerHTML = `<div class="binder">${pages.map((p, pi) => `<div><div class="muted tiny" style="margin:0 4px 4px">Seite ${pi + 1}</div><div class="binder-page">${p.map((c) => tileHTML(c, { markMissing: true, minus: setState.tick })).join('')}${'<div class="slot-empty"></div>'.repeat(9 - p.length)}</div></div>`).join('')}</div>`;
    } else {
      el.innerHTML = `<div class="grid">${list.map((c) => tile(c)).join('')}</div>`;
    }
    hydratePhotos(el);
  };
  draw();
  // Antippen / Gedrückt halten
  let pressTimer = null, longPressed = false;
  const grid = $('#sgrid');
  grid.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tcg');
    if (!t || !setState.tick) return;
    longPressed = false;
    pressTimer = setTimeout(() => { longPressed = true; navigator.vibrate?.(20); openCardKey(t.dataset.key); }, 550);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => grid.addEventListener(ev, () => clearTimeout(pressTimer)));
  grid.addEventListener('contextmenu', (e) => { if (setState.tick) e.preventDefault(); });
  bindTiles(grid, async (t, ev) => {
    if (longPressed) return;
    if (!setState.tick) return openCardKey(t.dataset.key);
    const c = cat.getCard(game, t.dataset.key.slice(game.length + 1));
    if (ev.target.closest('[data-minus]')) {
      const r = await removeOne(c);
      if (!r) return;
      tickHistory.push({ type: 'remove', r, c });
      navigator.vibrate?.(8);
      refreshTile(c); updUndo();
      toast(`${cat.cardName(c)} → ${ownedQty(c)}×`);
      return;
    }
    const r = await quickAdd(c, { silent: true });
    tickHistory.push({ type: 'add', r, c });
    navigator.vibrate?.(12);
    refreshTile(c); updUndo();
    toast(`${cat.cardName(c)} → ${ownedQty(c)}×${priceText(c) ? ' · ' + priceText(c) : ''}`);
  });
  $('#tickUndo')?.addEventListener('click', async () => {
    const h = tickHistory.pop();
    if (!h) return;
    if (h.type === 'add') await undoQuickAdd(h.r);
    else await restoreRemoved(h.r);
    refreshTile(h.c); updUndo();
    toast(`Rückgängig: ${cat.cardName(h.c)} → ${ownedQty(h.c)}×`);
  });
  $$('#sfilter [data-f]').forEach((b) => (b.onclick = () => { setState.filter = b.dataset.f; $$('#sfilter [data-f]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  $('#ssort').onchange = (e) => { setState.sort = e.target.value; sortCards(); draw(); };
  $('#tick').onchange = (e) => { setState.tick = e.target.checked; viewSet(game, setId, routeToken); };
}

function setMenu(game, s) {
  sheet(`${cat.setCode(s)} – Aktionen`, (body, close) => {
    body.innerHTML = `<div class="list">
      <div class="item" data-a="missing">${icon.list}<div class="grow"><div class="title">Fehlende Karten teilen</div><div class="sub">Liste als Text – z. B. für Tauschpartner</div></div></div>
      <div class="item" data-a="wishall">${icon.heart}<div class="grow"><div class="title">Alle fehlenden auf die Wunschliste</div></div></div>
      <div class="item" data-a="offline">${icon.download}<div class="grow"><div class="title">Bilder für offline speichern</div><div class="sub">Lädt alle Kartenbilder dieses Sets aufs Gerät</div></div></div>
      ${game === 'pokemon' ? `<div class="item" data-a="prices">${icon.refresh}<div class="grow"><div class="title">Preise meiner Karten laden</div><div class="sub">Cardmarket-Preise über TCGdex (Internet)</div></div></div>` : ''}
      <div class="item" data-a="cm">${icon.tag}<div class="grow"><div class="title">Set bei Cardmarket öffnen</div></div></div>
    </div>`;
    body.querySelectorAll('[data-a]').forEach((it) => (it.onclick = async () => {
      const a = it.dataset.a;
      const cards = cat.setCards(game, s.id);
      if (a === 'missing') {
        const miss = cards.filter((c) => !owned.has(keyOf(c)));
        const text = `Mir fehlen aus ${cat.setCode(s)} ${cat.setName(s)} (${miss.length}):\n` + miss.map((c) => `${cat.cardNo(c)} ${cat.cardName(c)}${c.r ? ` [${c.r}]` : ''}`).join('\n');
        if (navigator.share) navigator.share({ text }).catch(() => {});
        else { await navigator.clipboard?.writeText(text); toast('Liste kopiert'); }
      } else if (a === 'wishall') {
        let n = 0;
        for (const c of cards) if (!owned.has(keyOf(c)) && !wishSet.has(keyOf(c))) { await store.toggleWish(keyOf(c), { game, cardId: c.id }); n++; }
        await refreshOwned();
        toast(`${n} Karten auf die Wunschliste gesetzt`);
        close();
      } else if (a === 'offline') {
        close();
        cacheImages(cards);
      } else if (a === 'prices') {
        close();
        updatePrices(cards.filter((c) => owned.has(keyOf(c))));
      } else if (a === 'cm') {
        window.open(cardmarketUrl({ game, name: cat.setName(s), no: '' }, cat.setName(s)), '_blank');
      }
    }));
  });
}

async function cacheImages(cards) {
  if (!navigator.onLine) return toast('Dafür brauchst du Internet.');
  const urls = cards.map((c) => cat.cardImg(c, 'low')).filter(Boolean);
  let done = 0;
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.keep = '1';
  $('#toastRoot').appendChild(t);
  const upd = () => { t.textContent = `Bilder speichern … ${done}/${urls.length}`; };
  upd();
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const u = queue.shift();
      try { await fetch(u, { mode: 'no-cors', referrerPolicy: 'no-referrer' }); } catch { /* weiter */ }
      done++; upd();
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  t.remove();
  toast(`${done} Bilder offline gespeichert`);
}

/* ======================================================================
   Karten-Detail
   ====================================================================== */
async function viewCard(game, id, token) {
  if (GAMES[game]) await cat.load(game);
  if (stale(token)) return;
  const c = cat.getCard(game, id);
  if (!c) throw new Error('Karte nicht gefunden');
  const s = cat.getSet(game, c.set);
  setTitle(cat.cardName(c));
  const key = keyOf(c);
  const wb = addAction(icon.heart, async () => {
    const on = await store.toggleWish(key, { game, cardId: c.id });
    await refreshOwned();
    wb.style.color = on ? '#ff6b9a' : '';
    toast(on ? 'Auf der Wunschliste' : 'Von der Wunschliste entfernt');
  }, 'Wunschliste');
  if (wishSet.has(key)) wb.style.color = '#ff6b9a';
  addAction(icon.plus, () => openEntrySheet(c, null), 'Hinzufügen');

  const siblings = cat.setCards(game, c.set).slice().sort((a, b) => new Intl.Collator('de', { numeric: true }).compare(a.id, b.id));
  const idx = siblings.findIndex((x) => x.id === c.id);
  const prev = siblings[idx - 1], next = siblings[idx + 1];
  const versions = cat.lookupNo(game, c.no).filter((x) => x.id !== c.id && (game !== 'pokemon' || x.set === c.set));
  const sameName = game === 'pokemon' ? cat.search(c.name, { games: ['pokemon'], limit: 40 }).filter((x) => x.id !== c.id && x.name === c.name).slice(0, 18) : [];
  const o = owned.get(key);
  const mp = marketPrice(c);
  const p = priceMap.get(key);

  view.innerHTML = `
    <div class="detail-top">
      <div>
        <div class="detail-img" id="dimg">
          <div class="pic">${cat.spriteHTML(c) || (cat.cardImg(c, 'high') ? `<img referrerpolicy="no-referrer" src="${esc(cat.cardImg(c, 'high'))}" data-fb="${esc(cat.cardImgFallback(c, 'high'))}" alt="${esc(cat.cardName(c))}">` : c.photo ? `<img data-photo="${esc(c.photo)}" alt="">` : `<div class="ph" style="position:absolute;inset:0;display:grid;place-items:center">${esc(c.no)}</div>`)}</div>
          <div class="holo"></div>
        </div>
        <div class="row" style="justify-content:space-between;margin-top:10px">
          <button class="btn sm ghost" ${prev ? `data-go="${esc(prev.id)}"` : 'disabled'}>‹ ${prev ? esc(cat.cardNo(prev)) : ''}</button>
          <span class="muted tiny">${idx + 1} / ${siblings.length}</span>
          <button class="btn sm ghost" ${next ? `data-go="${esc(next.id)}"` : 'disabled'}>${next ? esc(cat.cardNo(next)) : ''} ›</button>
        </div>
      </div>
      <div class="stack">
        <div>
          <span class="badge game-${game}">${esc(GAMES[game].short)}</span>
          ${c.par ? '<span class="badge" style="background:#7c4dff;color:#fff">Parallel</span>' : ''}
          ${c.user ? `<span class="badge">Selbst angelegt</span> <button class="btn sm ghost" data-deluser style="min-height:26px;padding:2px 8px">${icon.trash}</button>` : ''}
          <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-top:6px">${esc(cat.cardName(c))}</div>
          ${c.nameDe && S.pkLang === 'de' && c.nameDe !== c.name ? `<div class="muted small">${esc(c.name)}</div>` : ''}
          ${c.nameDe && S.pkLang !== 'de' ? `<div class="muted small">${esc(c.nameDe)}</div>` : ''}
        </div>
        <dl class="kv">
          <dt>Nummer</dt><dd>${esc(cat.cardNo(c))}</dd>
          <dt>Set</dt><dd><a href="#/set/${game}/${encodeURIComponent(c.set)}" style="color:var(--accent)">${esc(cat.setCode(s))} · ${esc(cat.setName(s))}</a></dd>
          ${c.r ? `<dt>Seltenheit</dt><dd>${esc(c.r)}</dd>` : ''}
          ${c.type ? `<dt>Typ</dt><dd>${esc(c.type)}</dd>` : ''}
          ${c.color ? `<dt>Farbe</dt><dd>${esc(c.color)}</dd>` : ''}
          ${s?.date ? `<dt>Erschienen</dt><dd>${esc(fmtDate(s.date))}</dd>` : ''}
        </dl>
        <div>
          <h3>Preis</h3>
          <div class="price-box" id="pbox">
            ${c.eur != null ? `<div class="stat"><b>${c.eurLow ? 'ab ' : ''}${money(c.eur)}</b><span>${c.eurLow ? 'Cardmarket, günstigstes Angebot' : 'Cardmarket Trend'}${cat.pricesDate(c.game) ? ` · ${fmtDate(cat.pricesDate(c.game))}` : ''}</span></div>` : ''}
            ${c.usd != null ? `<div class="stat"><b>$${c.usd.toFixed(2)}</b><span>TCGplayer Markt (≈ ${money(c.usd * S.usdRate)})</span></div>` : ''}
            ${p?.trend != null ? `<div class="stat"><b>${money(p.trend)}</b><span>Cardmarket Trend</span></div>` : ''}
            ${p?.avg30 != null ? `<div class="stat"><b>${money(p.avg30)}</b><span>Ø 30 Tage</span></div>` : ''}
            ${p?.low != null ? `<div class="stat"><b>${money(p.low)}</b><span>Ab</span></div>` : ''}
            ${mp == null && !p ? `<div class="muted small">Kein Preis gespeichert. Trag den Wert beim Exemplar ein${game === 'pokemon' ? ' oder lade ihn online' : ''}.</div>` : ''}
          </div>
          ${p?.at ? `<div class="faint tiny" style="margin-top:4px">Stand ${fmtDate(p.at)}</div>` : ''}
          <div class="row wrap" style="margin-top:10px">
            ${game === 'pokemon' ? `<button class="btn sm" data-price>${icon.refresh} Preis laden</button>` : ''}
            <a class="btn sm" target="_blank" rel="noopener" href="${esc(cardmarketUrl(c))}">Cardmarket</a>
            <a class="btn sm" target="_blank" rel="noopener" href="${esc(ebayUrl(c))}">eBay verkauft</a>
          </div>
        </div>
      </div>
    </div>
    <div class="section-head"><h2>Meine Exemplare ${o ? `(${o.qty})` : ''}</h2></div>
    <div class="list" id="entries">
      ${o ? o.entries.map((e) => `<div class="entry" data-e="${esc(e.id)}">
          <div class="grow" style="flex:1;min-width:0"><b>${e.qty}× ${esc(e.variant || 'Standard')}</b>
          <div class="sub muted small">${esc(e.condition || '')} · ${esc(e.lang || '')}${e.location ? ' · 📍 ' + esc(e.location) : ''}${e.buyPrice ? ' · gekauft ' + money(e.buyPrice) : ''}</div></div>
          ${e.graded ? `<span class="badge grade">${esc(e.grader)} ${esc(e.grade)}</span>` : ''}
          <b class="small">${entryValue(e) ? money(entryValue(e)) : ''}</b>${icon.chev}
        </div>`).join('') : '<div class="entry muted" style="cursor:default">Noch nicht in deiner Sammlung.</div>'}
    </div>
    <div class="two" style="margin-top:10px">
      <button class="btn" data-quick>${icon.plus} +1 Schnell</button>
      <button class="btn primary" data-add>${icon.edit} Hinzufügen…</button>
    </div>
    ${versions.length ? `<h2>Andere Versionen</h2><div class="grid small" id="versions">${versions.map((x) => tileHTML(x, { markMissing: true })).join('')}</div>` : ''}
    ${sameName.length ? `<h2>Gleicher Name, andere Sets</h2><div class="grid small" id="samename">${sameName.map((x) => tileHTML(x, { markMissing: true })).join('')}</div>` : ''}
  `;
  const img = $('#dimg');
  hydratePhotos(img);
  img.querySelector('.pic').onclick = () => { const i = img.querySelector('img'); if (i?.src) zoomImage(i.src); };
  img.addEventListener('pointermove', (e) => {
    const r = img.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    img.classList.add('tilt');
    img.querySelector('.pic').style.transform = `perspective(700px) rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 14}deg)`;
    img.querySelector('.holo').style.backgroundPosition = `${x * 100}% ${y * 100}%`;
  });
  img.addEventListener('pointerleave', () => { img.classList.remove('tilt'); img.querySelector('.pic').style.transform = ''; });
  $$('[data-go]').forEach((b) => (b.onclick = () => replaceRoute(`#/card/${game}/${encodeURIComponent(b.dataset.go)}`)));
  $$('#entries [data-e]').forEach((it) => (it.onclick = () => openEntry(it.dataset.e)));
  $('[data-quick]').onclick = async () => {
    const e = await quickAdd(c);
    viewCard(game, id, routeToken);
    return e;
  };
  $('[data-add]').onclick = () => openEntrySheet(c, null);
  $('[data-deluser]')?.addEventListener('click', async () => {
    if (owned.has(key)) return toast('Erst die Exemplare dieser Karte aus der Sammlung löschen.');
    if (!(await confirmDialog('Karte entfernen?', 'Die selbst angelegte Karte wird aus der Datenbank entfernt.', 'Entfernen', true))) return;
    cat.removeUserCard(game, c.id);
    await store.db.put('kv', cat.getUserCatalog(), 'userCatalog');
    toast('Entfernt');
    replaceRoute(`#/set/${game}/${encodeURIComponent(c.set)}`);
  });
  $('[data-price]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await updatePrices([c], true);
    viewCard(game, id, routeToken);
  });
  ['#versions', '#samename'].forEach((sel) => { const el = $(sel); if (el) bindTiles(el, (t) => openCardKey(t.dataset.key)); });
  // Wischen für vor/zurück
  let x0 = null;
  img.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 70) {
      const t = dx < 0 ? next : prev;
      if (t) replaceRoute(`#/card/${game}/${encodeURIComponent(t.id)}`);
    }
  });
}

function cardmarketUrl(c, q) {
  const g = { pokemon: 'Pokemon', op: 'OnePiece', dbfw: 'DragonBallSuper' }[c.game] || 'Pokemon';
  const term = q || (c.game === 'pokemon' ? c.name : `${c.no} ${c.name}`);
  return `https://www.cardmarket.com/de/${g}/Products/Search?searchString=${encodeURIComponent(term)}`;
}
function ebayUrl(c) {
  const g = { pokemon: 'pokemon', op: 'one piece', dbfw: 'fusion world' }[c.game] || '';
  const s = cat.getSet(c.game, c.set);
  const term = c.game === 'pokemon' ? `${c.name} ${cat.cardNo(c)} ${s?.name || ''}` : `${g} ${c.no} ${c.name}${c.par ? ' parallel' : ''}`;
  return `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(term)}&LH_Sold=1&LH_Complete=1`;
}

async function updatePrices(cards, single = false) {
  if (!navigator.onLine) return toast('Dafür brauchst du Internet.');
  let ok = 0;
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.keep = '1';
  if (!single) $('#toastRoot').appendChild(t);
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    t.textContent = `Preise laden … ${i + 1}/${cards.length}`;
    try {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(c.id)}`);
      if (!r.ok) continue;
      const d = await r.json();
      const cm = d.pricing?.cardmarket;
      const tp = d.pricing?.tcgplayer;
      const tpm = tp && Object.values(tp).find((v) => v && typeof v === 'object' && v.marketPrice != null);
      if (!cm && !tpm) continue;
      const eur = cm?.trend ?? cm?.avg ?? null;
      await store.setPrice(keyOf(c), {
        eur: eur ?? (tpm ? Math.round(tpm.marketPrice * S.usdRate * 100) / 100 : null),
        trend: cm?.trend ?? null, avg30: cm?.avg30 ?? null, low: cm?.low ?? null,
        usd: tpm?.marketPrice ?? null,
      });
      ok++;
    } catch (e) { console.warn(e); }
  }
  t.remove();
  priceMap = await store.prices();
  toast(ok ? `${ok} Preis${ok === 1 ? '' : 'e'} aktualisiert` : 'Kein Preis gefunden');
}

/* ======================================================================
   Hinzufügen / Bearbeiten
   ====================================================================== */
async function quickAdd(c, extra = {}) {
  const key = keyOf(c);
  const list = await store.entries();
  const grading = extra.grading;
  const lang = extra.lang && LANGS.includes(extra.lang) ? extra.lang : S.defaultLang;
  // gleiche Standard-Zeile hochzählen statt neue anlegen
  let e = !grading && list.find((x) => x.key === key && !x.graded && x.lang === lang && x.condition === S.defaultCondition && (x.variant || '') === gameInfo(c.game).variants[0] && !x.photos?.length);
  let created = false;
  if (e) {
    e.qty = (e.qty || 0) + 1;
  } else {
    created = true;
    e = {
      id: uid(), key, game: c.game, cardId: c.id, qty: 1,
      variant: gameInfo(c.game).variants[0], lang, condition: S.defaultCondition,
      graded: !!grading, grader: grading?.company || '', grade: grading?.grade || '', cert: grading?.cert || '',
      photos: [],
    };
    if (extra.photoBlob) e.photos.push(await store.savePhoto(await compressImage(extra.photoBlob, 1400)));
  }
  await store.saveEntry(e);
  await refreshOwned();
  if (!extra.silent) {
    toast(`${cat.cardName(c)} hinzugefügt (${ownedQty(c)}×)`, {
      action: 'Rückgängig', vibrate: 15,
      onAction: async () => { await undoQuickAdd({ e, created }); if (curHash().startsWith('#/card')) route(); },
    });
  }
  return { e, created };
}
/** Ein Exemplar entfernen: bevorzugt die zuletzt geänderte, nicht gegradete Zeile */
async function removeOne(c) {
  const list = (await store.entries()).filter((e) => e.key === keyOf(c));
  if (!list.length) return null;
  list.sort((a, b) => (a.graded ? 1 : 0) - (b.graded ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
  const e = list[0];
  const before = { ...e, photos: [...(e.photos || [])] };
  if ((e.qty || 1) > 1) { e.qty -= 1; await store.saveEntry(e); }
  else {
    // Fotos nicht löschen, damit "Rückgängig" alles wiederherstellen kann
    const keep = { ...e, photos: [] };
    await store.saveEntry(keep);
    await store.deleteEntry(e.id);
  }
  await refreshOwned();
  return before;
}
async function restoreRemoved(before) {
  await store.saveEntry({ ...before });
  await refreshOwned();
}

async function undoQuickAdd(r) {
  if (!r) return;
  if (r.created) await store.deleteEntry(r.e.id);
  else { r.e.qty = Math.max(0, r.e.qty - 1); if (r.e.qty) await store.saveEntry(r.e); else await store.deleteEntry(r.e.id); }
  await refreshOwned();
}

async function openEntrySheet(c, e, prefill = {}) {
  const isNew = !e;
  const game = c?.game || e?.game || 'custom';
  const gi = gameInfo(game);
  e = e ? { ...e, photos: [...(e.photos || [])] } : {
    id: uid(), key: c && !c.custom ? keyOf(c) : '', game, cardId: c && !c.custom ? c.id : null, qty: 1,
    variant: gi.variants[0], lang: S.defaultLang, condition: S.defaultCondition,
    graded: !!prefill.grading, grader: prefill.grading?.company || 'PSA', grade: prefill.grading?.grade || '', cert: prefill.grading?.cert || '',
    photos: [], custom: prefill.custom || null,
  };
  if (prefill.photoBlob && isNew) {
    e._pendingPhoto = prefill.photoBlob;
  }
  const locations = [...new Set((await store.entries()).map((x) => x.location).filter(Boolean))];
  const title = e.custom ? (isNew ? 'Eigene Karte' : e.custom.name || 'Eigene Karte') : `${cat.cardName(c)} · ${cat.cardNo(c)}`;
  sheet(isNew ? `Hinzufügen: ${title}` : title, async (body, close) => {
    const photoUrls = {};
    for (const p of e.photos) photoUrls[p] = await store.photoURL(p);
    const seg = (name, opts, val) => `<div class="seg" data-seg="${name}">${opts.map(([k, l]) => `<button type="button" class="${k === val ? 'on' : ''}" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    body.innerHTML = `<form class="form" autocomplete="off">
      ${e.custom ? `
        <div class="field"><label>Spiel</label><select name="game">${[...GAME_IDS.map((g) => [g, GAMES[g].short]), ['custom', 'Anderes Spiel']].map(([k, l]) => `<option value="${k}" ${k === e.game ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Name</label><input name="cname" required value="${esc(e.custom.name || '')}" placeholder="z. B. Son Goku"></div>
        <div class="two"><div class="field"><label>Set</label><input name="cset" value="${esc(e.custom.set || '')}" placeholder="z. B. FB01"></div>
        <div class="field"><label>Nummer</label><input name="cno" value="${esc(e.custom.no || '')}" placeholder="z. B. FB01-139"></div></div>` : ''}
      <div class="row" style="justify-content:space-between">
        <div class="field" style="margin:0"><span class="lbl">Anzahl</span>
          <div class="stepper"><button type="button" data-step="-1">−</button><input name="qty" type="number" inputmode="numeric" min="1" value="${e.qty || 1}"><button type="button" data-step="1">+</button></div></div>
        <label class="row" style="font-weight:700"><span>Gegradet</span><span class="switch"><input type="checkbox" name="graded" ${e.graded ? 'checked' : ''}><span></span></span></label>
      </div>
      <div id="gradeBox" ${e.graded ? '' : 'hidden'} class="panel" style="display:grid;gap:12px">
        <div class="field"><span class="lbl">Grading-Firma</span>${seg('grader', GRADERS.map((g) => [g, g]), e.grader || 'PSA')}</div>
        <div class="two">
          <div class="field"><label>Note</label><select name="grade">${['', '10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', 'Authentic'].map((g) => `<option ${g === String(e.grade) ? 'selected' : ''} value="${g}">${g || '–'}</option>`).join('')}</select></div>
          <div class="field"><label>Zertifikat-Nr.</label><input name="cert" inputmode="numeric" value="${esc(e.cert || '')}"></div>
        </div>
        <div class="field"><label>Label / Zusatz</label><input name="gradeLabel" value="${esc(e.gradeLabel || '')}" placeholder="z. B. Gem Mint, Black Label, Pristine"></div>
      </div>
      <div class="field"><span class="lbl">Version</span>${seg('variant', gi.variants.map((v) => [v, v]), e.variant || gi.variants[0])}</div>
      <div class="field" id="condBox" ${e.graded ? 'hidden' : ''}><span class="lbl">Zustand</span>${seg('condition', CONDITIONS.map(([k]) => [k, k]), e.condition || 'NM')}
        <div class="faint tiny" style="margin:4px 2px 0">${CONDITIONS.map(([k, l]) => `${k} = ${l}`).join(' · ')}</div></div>
      <div class="field"><label>Sprache</label><select name="lang">${LANGS.map((l) => `<option ${l === e.lang ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="two">
        <div class="field"><label>Kaufpreis (€/Stk.)</label><input name="buyPrice" type="number" step="0.01" inputmode="decimal" value="${esc(e.buyPrice ?? '')}"></div>
        <div class="field"><label>Kaufdatum</label><input name="buyDate" type="date" value="${esc(e.buyDate || '')}"></div>
      </div>
      <div class="field"><label>Aktueller Wert (€/Stk.)</label><input name="value" type="number" step="0.01" inputmode="decimal" value="${esc(e.value ?? '')}" placeholder="${(() => { const mp = c && !c.custom ? marketPrice(c) : null; return mp != null ? 'Marktpreis ' + money(mp) + ' – leer lassen = automatisch' : 'leer = unbekannt'; })()}"></div>
      <div class="field"><label>Lagerort</label><input name="location" list="locs" value="${esc(e.location || '')}" placeholder="z. B. Binder 1, Toploader-Box"><datalist id="locs">${locations.map((l) => `<option value="${esc(l)}">`).join('')}</datalist></div>
      <div class="field"><label>Notizen</label><textarea name="notes" placeholder="z. B. aus Display gezogen, Tausch mit …">${esc(e.notes || '')}</textarea></div>
      <div class="field"><span class="lbl">Eigene Fotos (z. B. Vorder-/Rückseite, Slab)</span>
        <div class="photos" id="photos"></div></div>
      <div class="${isNew ? '' : 'two'}">
        ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon.trash} Löschen</button>`}
        <button type="submit" class="btn primary block">${icon.check} ${isNew ? 'Hinzufügen' : 'Speichern'}</button>
      </div>
    </form>`;
    const f = body.querySelector('form');
    const pending = e._pendingPhoto ? [e._pendingPhoto] : [];
    delete e._pendingPhoto;
    const drawPhotos = () => {
      const el = body.querySelector('#photos');
      el.innerHTML = e.photos.map((p) => `<div class="ph-item"><img src="${esc(photoUrls[p] || '')}" alt=""><button type="button" data-rm="${esc(p)}">×</button></div>`).join('') +
        pending.map((b, i) => `<div class="ph-item"><img src="${URL.createObjectURL(b)}" alt=""><button type="button" data-rmp="${i}">×</button></div>`).join('') +
        `<button type="button" class="ph-add" data-addphoto>${icon.camera}</button>`;
      el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { e.photos = e.photos.filter((x) => x !== b.dataset.rm); drawPhotos(); }));
      el.querySelectorAll('[data-rmp]').forEach((b) => (b.onclick = () => { pending.splice(+b.dataset.rmp, 1); drawPhotos(); }));
      el.querySelector('[data-addphoto]').onclick = async () => {
        const files = await pickFile('image/*', { multiple: true });
        for (const fl of files || []) pending.push(await compressImage(fl, 1400));
        drawPhotos();
      };
      el.querySelectorAll('.ph-item img').forEach((im) => (im.onclick = () => zoomImage(im.src)));
    };
    drawPhotos();
    body.querySelectorAll('[data-seg]').forEach((sg) => sg.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    })));
    body.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => { f.qty.value = Math.max(1, (+f.qty.value || 1) + +b.dataset.step); }));
    f.graded.onchange = () => { body.querySelector('#gradeBox').hidden = !f.graded.checked; body.querySelector('#condBox').hidden = f.graded.checked; };
    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Exemplar löschen?', 'Dieser Eintrag wird aus deiner Sammlung entfernt.', 'Löschen', true))) return;
      const removed = await store.deleteEntry(e.id);
      await refreshOwned();
      close();
      toast('Gelöscht', { action: 'Rückgängig', onAction: async () => { await store.saveEntry(removed); await refreshOwned(); route(); } });
      route();
    });
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const segVal = (n) => body.querySelector(`[data-seg="${n}"] .on`)?.dataset.v;
      e.qty = Math.max(1, parseInt(f.qty.value, 10) || 1);
      e.graded = f.graded.checked;
      e.grader = e.graded ? segVal('grader') : '';
      e.grade = e.graded ? f.grade.value : '';
      e.cert = e.graded ? f.cert.value.trim() : '';
      e.gradeLabel = e.graded ? f.gradeLabel.value.trim() : '';
      e.variant = segVal('variant');
      e.condition = e.graded ? '' : segVal('condition');
      e.lang = f.lang.value;
      e.buyPrice = f.buyPrice.value === '' ? null : +f.buyPrice.value;
      e.buyDate = f.buyDate.value;
      e.value = f.value.value === '' ? null : +f.value.value;
      e.location = f.location.value.trim();
      e.notes = f.notes.value.trim();
      if (e.custom) {
        e.game = f.game.value;
        e.custom = { name: f.cname.value.trim() || 'Unbenannt', set: f.cset.value.trim(), no: f.cno.value.trim() };
        e.key = `${e.game}:custom:${e.id}`;
      }
      for (const b of pending) e.photos.push(await store.savePhoto(b));
      await store.saveEntry(e);
      await refreshOwned();
      close();
      toast(isNew ? 'Hinzugefügt' : 'Gespeichert', { vibrate: 15 });
      prefill.onSaved?.(e);
      if (!document.querySelector('.scanner')) route();
    };
  });
}

/** Neue Karte (z. B. aus einem neuen Set) in die Datenbank aufnehmen */
function openNewCard(pre = {}) {
  const games = GAME_IDS.filter((g) => g !== 'pokemon');
  let game = pre.game && games.includes(pre.game) ? pre.game : cat.gameFromNo(pre.no || '') || (activeGames().includes('dbfw') ? 'dbfw' : games[0]);
  let img = '';
  let ownPhoto = pre.photoBlob || null;
  sheet('Neue Karte anlegen', (body, close) => {
    body.innerHTML = `<form class="form" autocomplete="off">
      <div class="notice small">Für Karten, die noch nicht in der Datenbank sind – z. B. aus einem gerade erschienenen Set. Das Set wird automatisch angelegt. Neue Pokémon-Sets holst du unter <a href="#/backup" style="text-decoration:underline">Sicherung › Neue Pokémon-Sets online suchen</a>.</div>
      <div class="field"><span class="lbl">Spiel</span><div class="seg" data-seg="game">${games.map((g) => `<button type="button" class="${g === game ? 'on' : ''}" data-v="${g}">${GAMES[g].short}</button>`).join('')}</div></div>
      <div class="two">
        <div class="field"><label>Kartennummer</label><input name="no" required value="${esc((pre.no || '').toUpperCase())}" placeholder="z. B. FB12-001" autocapitalize="characters"></div>
        <div class="field"><label>Seltenheit</label><select name="r">${['', 'C', 'UC', 'R', 'SR', 'SCR', 'L', 'SEC', 'SP', 'PR', 'TR'].map((r) => `<option>${r}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Name</label><input name="name" value="${esc(pre.name || '')}" placeholder="z. B. Son Goku">
        ${pre.hints?.length ? `<div class="chips" style="margin-top:6px">${pre.hints.map((h) => `<button type="button" class="chip" data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}</div>
      <label class="row small" style="font-weight:650"><span class="switch"><input type="checkbox" name="par"><span></span></span> Parallel- / Sonderversion</label>
      <div class="panel small" id="setInfo"></div>
      <div class="field" id="setNameBox" hidden><label>Name des neuen Sets (optional)</label><input name="setName" placeholder="z. B. Booster Pack – …"></div>
      <div class="row" style="align-items:flex-start;gap:12px">
        <div style="width:96px;flex:none"><div class="pic" style="aspect-ratio:63/88;border-radius:8px;overflow:hidden;background:var(--card2)"><img id="nimg" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:none"></div></div>
        <div class="stack small" style="flex:1"><div id="imgState" class="muted">Bild wird gesucht …</div>
          <button type="button" class="btn sm" data-photo>${icon.camera} Eigenes Foto</button></div>
      </div>
      <button type="submit" class="btn primary block">${icon.check} ${pre.noAdd ? 'Anlegen' : 'Anlegen und +1 in die Sammlung'}</button>
    </form>`;
    const f = body.querySelector('form');
    const nimg = body.querySelector('#nimg');
    const state = body.querySelector('#imgState');
    const showOwn = () => {
      if (ownPhoto) { nimg.src = URL.createObjectURL(ownPhoto); nimg.style.display = ''; state.textContent = 'Dein Foto wird als Bild verwendet.'; }
      else { nimg.style.display = 'none'; state.textContent = 'Kein Bild – du kannst ein Foto machen.'; }
    };
    let probeToken = 0;
    const probe = () => {
      const no = cat.normNo(f.no.value);
      const sid = cat.setIdFromNo(game, no);
      const s = sid ? cat.getSet(game, sid) : null;
      const exists = no && cat.lookupNo(game, no).length;
      body.querySelector('#setInfo').innerHTML = !no ? 'Nummer eingeben, z. B. FB12-001.'
        : exists ? `<b style="color:var(--warn)">${esc(no)} gibt es schon.</b> Sie wird als eigene Version angelegt – oder <a href="#/search" style="text-decoration:underline">suche</a> die vorhandene Karte.`
        : s ? `Kommt in das Set <b>${esc(cat.setCode(s))} – ${esc(cat.setName(s))}</b>.`
        : sid ? `<b>Neues Set ${esc(sid)}</b> wird angelegt.` : 'Unbekanntes Nummernformat.';
      body.querySelector('#setNameBox').hidden = !(sid && !s);
      img = '';
      // Offizielles Bild suchen (Dragon Ball: Bilder der offiziellen Kartenliste dürfen eingebunden werden)
      if (game === 'dbfw' && /^[A-Z]+\d*-\d+$/.test(no)) {
        const t = ++probeToken;
        const tries = f.par.checked ? [`${no}_p1.webp`, `${no}_f_p1.webp`] : [`${no}.webp`, `${no}_f.webp`];
        state.textContent = 'Suche offizielles Bild …';
        const next = (i) => {
          if (t !== probeToken) return;
          if (i >= tries.length) return showOwn();
          const im = new Image();
          im.referrerPolicy = 'no-referrer';
          im.onload = () => { if (t !== probeToken) return; img = tries[i]; nimg.src = im.src; nimg.style.display = ''; state.innerHTML = '<b style="color:var(--ok)">Offizielles Kartenbild gefunden ✓</b>'; };
          im.onerror = () => next(i + 1);
          im.src = 'https://www.dbs-cardgame.com/fw/images/cards/card/en/' + tries[i];
        };
        if (navigator.onLine) next(0); else showOwn();
      } else showOwn();
    };
    probe();
    f.no.oninput = debounce(probe, 400);
    f.par.onchange = probe;
    body.querySelectorAll('[data-seg="game"] button').forEach((b) => (b.onclick = () => {
      game = b.dataset.v;
      body.querySelectorAll('[data-seg="game"] button').forEach((x) => x.classList.toggle('on', x === b));
      probe();
    }));
    body.querySelectorAll('[data-hint]').forEach((b) => (b.onclick = () => { f.name.value = b.dataset.hint; }));
    body.querySelector('[data-photo]').onclick = async () => {
      const file = await pickFile('image/*', { capture: 'environment' });
      if (!file) return;
      ownPhoto = await compressImage(file, 1200);
      probeToken++;
      img = '';
      showOwn();
    };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const no = cat.normNo(f.no.value);
      if (!/^[A-Z]+\d*-\d+$/.test(no)) return toast('Bitte eine Kartennummer wie FB12-001 eingeben.');
      await cat.load(game);
      const existing = cat.lookupNo(game, no);
      if (existing.length && !f.par.checked) {
        close();
        toast(`${no} gibt es schon in der Datenbank`);
        openCardKey(keyOf(existing.find((c) => !c.p) || existing[0]));
        return;
      }
      let photo = '';
      if (!img && ownPhoto) photo = await store.savePhoto(await compressImage(ownPhoto, 1200));
      const c = cat.addUserCard({ game, no, name: f.name.value.trim(), rarity: f.r.value, parallel: f.par.checked, img, photo, setName: f.setName.value.trim() });
      await store.db.put('kv', cat.getUserCatalog(), 'userCatalog');
      close();
      if (!pre.noAdd) await quickAdd(c, { silent: true });
      toast(`${c.no} ${c.name} angelegt${pre.noAdd ? '' : ' und hinzugefügt'}`, { vibrate: 20 });
      pre.onSaved?.(c);
      if (!document.querySelector('.scanner')) route();
    };
  });
}

function openCustom(prefill = {}) {
  openEntrySheet(null, null, { ...prefill, custom: { name: '', set: '', no: '' } });
}

/* ======================================================================
   Scanner
   ====================================================================== */
async function viewScan() {
  setTitle('Scannen');
  view.innerHTML = `<div class="empty">${icon.camera}<b>Scanner</b>Die Kamera öffnet sich …<br><br><button class="btn primary" id="reopen">Kamera öffnen</button></div>`;
  const open = async () => {
    const { openScanner } = await import('./scan.js');
    openScanner({
      settings: S,
      setSetting: store.setSetting,
      quickAdd: (c, extra) => quickAdd(c, extra),
      openAdd: (c, prefill) => openEntrySheet(c, null, prefill),
      openCustom: (prefill) => openCustom(prefill),
      openNewCard: (prefill) => openNewCard(prefill),
      games: activeGames(),
      tileHTML: (c, o) => tileHTML(c, { ...o, caption: true }),
      hydrate: (el) => hydratePhotos(el),
      ownedQty,
      onClose: () => { if (curHash() === '#/scan') replaceRoute(lastHash || '#/home'); },
    });
  };
  $('#reopen').onclick = open;
  open();
}

/* ======================================================================
   Suche (alle Spiele)
   ====================================================================== */
async function viewSearch(_, token) {
  setTitle('Karten suchen');
  view.innerHTML = `<div class="bar"><div class="search">${icon.search}<input type="search" id="gq" placeholder="Name oder Nummer (z. B. Glurak, OP01-120, FB01-139)" autofocus></div></div>
    <div class="chips" id="sg" ${activeGames().length < 2 ? 'hidden' : ''}>${[['all', 'Alle'], ...activeGames().map((g) => [g, GAMES[g].short])].map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-g="${k}">${l}</button>`).join('')}</div>
    <div id="sr"><div class="empty">${icon.search}<b>Durchsuche alle Datenbanken</b>Name oder Kartennummer eingeben.</div></div>`;
  await loadNeeded();
  if (stale(token)) return;
  let g = 'all';
  const run = () => {
    const q = $('#gq').value;
    if (!q.trim()) return;
    const res = cat.search(q, { games: g === 'all' ? activeGames() : [g], limit: 150 });
    $('#sr').innerHTML = res.length ? `<p class="muted small">${res.length}${res.length === 150 ? '+' : ''} Treffer</p><div class="grid">${res.map((c) => {
      const s = cat.getSet(c.game, c.set);
      return tileHTML(c, { markMissing: false, sub: `${cat.cardNo(c)} · ${cat.setCode(s)}` });
    }).join('')}</div>` : `<div class="empty"><b>Keine Treffer</b>${cat.gameFromNo(q.trim()) ? `<br><br><button class="btn primary" id="srNew">${icon.plus} ${esc(q.trim().toUpperCase())} als neue Karte anlegen</button>` : ''}</div>`;
    $('#srNew')?.addEventListener('click', () => openNewCard({ no: q.trim() }));
    hydratePhotos($('#sr'));
  };
  $('#gq').oninput = debounce(run, 220);
  $$('#sg [data-g]').forEach((b) => (b.onclick = () => { g = b.dataset.g; $$('#sg [data-g]').forEach((x) => x.classList.toggle('on', x === b)); run(); }));
  bindTiles($('#sr'), (t) => openCardKey(t.dataset.key));
  setTimeout(() => $('#gq')?.focus(), 100);
}

/* ======================================================================
   Wunschliste
   ====================================================================== */
async function viewWish(_, token) {
  setTitle('Wunschliste');
  await loadNeeded();
  if (stale(token)) return;
  const list = (await store.wishlist()).slice().sort((a, b) => (b.added || 0) - (a.added || 0));
  const cards = list.map((w) => cat.getCard(w.game, w.cardId)).filter(Boolean);
  const total = cards.reduce((a, c) => a + (marketPrice(c) || 0), 0);
  if (cards.length) {
    addAction(icon.upload, () => {
      const text = 'Meine Wunschliste:\n' + cards.map((c) => `${cat.cardNo(c)} ${cat.cardName(c)} (${GAMES[c.game].short})`).join('\n');
      if (navigator.share) navigator.share({ text }).catch(() => {}); else { navigator.clipboard?.writeText(text); toast('Kopiert'); }
    }, 'Teilen');
  }
  view.innerHTML = cards.length ? `
    <div class="toolbar"><span class="muted small">${cards.length} Karten${total ? ` · ca. ${money(total)}` : ''}</span><span class="spacer"></span>
    <span class="muted tiny">Gesammelte Karten sind markiert</span></div>
    <div class="grid" id="wl">${cards.map((c) => tileHTML(c, { sub: `${cat.cardNo(c)}${marketPrice(c) ? ' · ' + money(marketPrice(c)) : ''}`, showWish: false })).join('')}</div>`
    : `<div class="empty">${icon.heart}<b>Wunschliste ist leer</b>Öffne eine Karte und tippe oben auf das Herz – oder setze in einem Set alle fehlenden Karten auf einmal drauf.</div>`;
  const wl = $('#wl');
  if (wl) { bindTiles(wl, (t) => openCardKey(t.dataset.key)); hydratePhotos(wl); }
}

/* ======================================================================
   Schnell-Eingabe per Liste
   ====================================================================== */
function parseBulk(text) {
  const out = [];
  for (let raw of text.split(/\n|;/)) {
    let line = raw.trim();
    if (!line) continue;
    let qty = 1;
    const q = /^(\d{1,3})\s*[x×*]\s*|^(\d{1,3})\s+(?=\S*[A-Za-z])/.exec(line);
    if (q) { qty = parseInt(q[1] || q[2], 10); line = line.slice(q[0].length).trim(); }
    const qe = /\s*[x×*]\s*(\d{1,3})$/.exec(line);
    if (qe) { qty = parseInt(qe[1], 10); line = line.slice(0, qe.index).trim(); }
    let cards = [];
    const code = line.toUpperCase().replace(/\s+/g, ' ');
    // Bandai-Nummer (Dragon Ball / One Piece), auch mit Parallel-Kennung "_p1"
    const b = /^([A-Z]{1,3}\d{0,2}-\d{2,3})(?:[ _]?(P\d|R\d))?/.exec(code.replace(/ /g, ''));
    if (b) {
      for (const g of ['dbfw', 'op']) {
        const list = cat.lookupNo(g, b[1]);
        if (b[2]) cards.push(...list.filter((c) => c.p.toUpperCase() === b[2]));
        else cards.push(...list.filter((c) => !c.p));
      }
    }
    // Pokémon: TCGdex-ID "sv03.5-006" oder Setkürzel + Nummer "MEW 6" / "MEW 006/165"
    if (!cards.length && cat.isLoaded('pokemon')) {
      const id = cat.getCard('pokemon', line.toLowerCase()) || cat.getCard('pokemon', line);
      if (id) cards.push(id);
      const m = /^([A-Z0-9.]{2,8})\s+([A-Z]{0,3}\d{1,3})(?:\s*\/\s*\d+)?$/.exec(code);
      if (!cards.length && m) {
        const sets = cat.sets('pokemon').filter((s) => (s.abbr || '').toUpperCase() === m[1] || s.id.toUpperCase() === m[1]);
        for (const s of sets) cards.push(...cat.setCards('pokemon', s.id).filter((c) => cat.normLocal(c.no) === cat.normLocal(m[2])));
      }
    }
    if (!cards.length && line.length >= 3) cards = cat.search(line, { limit: 6 });
    const hg = cat.gameFromNo(line.toUpperCase().replace(/\s+/g, ''));
    if (!cards.length && hg && !activeGames().includes(hg)) { out.push({ line: raw.trim(), qty, cards: [], pick: null, hidden: hg }); continue; }
    out.push({ line: raw.trim(), qty, cards, pick: cards.length === 1 || b ? cards[0] : cards[0] || null, sure: cards.length === 1 });
  }
  return out;
}

async function viewBulk(_, token) {
  setTitle('Schnell-Eingabe');
  await loadNeeded();
  if (stale(token)) return;
  view.innerHTML = `
    <div class="notice">Eine Karte pro Zeile. Beispiele:<br>
      <code>FB01-139</code> · <code>3x OP01-120</code> · <code>OP05-119_p1</code> (Parallel) · <code>MEW 6</code> oder <code>sv03.5-006</code> (Pokémon) · auch Namen wie <code>Glurak ex</code></div>
    <div class="field" style="margin-top:12px"><textarea id="bulk" rows="7" placeholder="FB01-139&#10;2x OP01-120&#10;MEW 199" style="width:100%;font-family:ui-monospace,Menlo,monospace"></textarea></div>
    <div class="two" style="margin-top:10px">
      <select id="bulkLang" class="btn">${LANGS.map((l) => `<option ${l === S.defaultLang ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn" id="bulkCheck">${icon.search} Prüfen</button>
    </div>
    <div id="bulkRes" style="margin-top:14px"></div>`;
  let rows = [];
  const draw = () => {
    const ok = rows.filter((r) => r.pick);
    $('#bulkRes').innerHTML = rows.length ? `
      <div class="list">${rows.map((r, i) => `<div class="item" data-i="${i}">
        ${r.pick && cat.spriteHTML(r.pick) ? `<div style="width:38px;height:53px;border-radius:4px;overflow:hidden;flex:none;position:relative">${cat.spriteHTML(r.pick)}</div>` : r.pick ? `<img referrerpolicy="no-referrer" src="${esc(cat.cardImg(r.pick))}" data-fb="${esc(cat.cardImgFallback(r.pick))}" style="width:38px;height:53px;object-fit:cover;border-radius:4px;flex:none" alt="">` : `<span style="width:38px;text-align:center;color:var(--bad)">✕</span>`}
        <div class="grow"><div class="title">${r.pick ? `${r.qty}× ${esc(cat.cardName(r.pick))}` : esc(r.line)}</div>
        <div class="sub">${r.pick ? `${esc(cat.cardNo(r.pick))} · ${esc(cat.setCode(cat.getSet(r.pick.game, r.pick.set)))} · ${esc(GAMES[r.pick.game].short)}` : (r.hidden ? `${GAMES[r.hidden].short} ist ausgeblendet – unter <a href="#/settings" style="text-decoration:underline">Einstellungen</a> einblenden` : cat.gameFromNo(r.line.replace(/^\d+\s*[x×*]\s*/i, '').trim()) ? '<b style="color:var(--accent)">nicht in der Datenbank – antippen zum Anlegen</b>' : 'nicht gefunden')}${r.cards.length > 1 ? ` · <b style="color:var(--warn)">${r.cards.length} Möglichkeiten – antippen</b>` : ''}</div></div>
      </div>`).join('')}</div>
      <button class="btn primary block" id="bulkAdd" style="margin-top:12px" ${ok.length ? '' : 'disabled'}>${icon.plus} ${ok.reduce((a, r) => a + r.qty, 0)} Karten hinzufügen</button>` : '';
    $$('#bulkRes [data-i]').forEach((it) => (it.onclick = () => {
      const r = rows[+it.dataset.i];
      if (!r.pick && !r.hidden && cat.gameFromNo(r.line.replace(/^\d+\s*[x×*]\s*/i, '').trim())) {
        openNewCard({ no: r.line.replace(/^\d+\s*[x×*]\s*/i, '').replace(/\s*[x×*]\s*\d+$/i, '').trim(), noAdd: true, onSaved: (c) => { r.pick = c; r.cards = [c]; draw(); } });
        return;
      }
      if (r.cards.length < 2) return;
      sheet('Welche Karte?', (body, close) => {
        body.innerHTML = `<div class="grid">${r.cards.map((c, j) => tileHTML(c, { idx: j, sub: `${cat.cardNo(c)} · ${cat.setCode(cat.getSet(c.game, c.set))}` })).join('')}</div>`;
        bindTiles(body, (t) => { r.pick = r.cards[+t.dataset.idx]; close(); draw(); });
      });
    }));
    $('#bulkAdd')?.addEventListener('click', async () => {
      let n = 0;
      for (const r of rows) {
        if (!r.pick) continue;
        for (let k = 0; k < r.qty; k++) await quickAdd(r.pick, { silent: true, lang: $('#bulkLang').value });
        n += r.qty;
      }
      toast(`${n} Karten hinzugefügt`, { vibrate: 20 });
      $('#bulk').value = '';
      rows = [];
      draw();
    });
  };
  $('#bulkCheck').onclick = () => { rows = parseBulk($('#bulk').value); draw(); };
}

/* ======================================================================
   Doppelte Karten / Tauschliste
   ====================================================================== */
async function viewDupes(_, token) {
  setTitle('Doppelte Karten');
  await loadNeeded();
  if (stale(token)) return;
  const keep = Math.max(1, parseInt(S.keepCount || 1, 10));
  const rows = [];
  for (const [key, o] of owned) {
    const raw = o.entries.filter((e) => !e.graded).reduce((a, e) => a + (e.qty || 0), 0);
    if (raw <= keep) continue;
    const c = cardOf(o.entries[0]);
    if (c) rows.push({ c, extra: raw - keep });
  }
  rows.sort((a, b) => `${a.c.game}${a.c.set}${a.c.no}`.localeCompare(`${b.c.game}${b.c.set}${b.c.no}`, 'de', { numeric: true }));
  const total = rows.reduce((a, r) => a + r.extra, 0);
  const val = rows.reduce((a, r) => a + (marketPrice(r.c) || 0) * r.extra, 0);
  if (rows.length) {
    addAction(icon.upload, () => {
      const text = `Tauschliste (${total} Karten):\n` + rows.map((r) => `${r.extra}× ${cat.cardNo(r.c) || r.c.no} ${cat.cardName(r.c) || r.c.name} (${gameInfo(r.c.game).short})`).join('\n');
      if (navigator.share) navigator.share({ text }).catch(() => {}); else { navigator.clipboard?.writeText(text); toast('Kopiert'); }
    }, 'Teilen');
  }
  view.innerHTML = `
    <div class="toolbar"><span class="muted small">Behalten pro Karte:</span>
      <div class="stepper"><button data-k="-1">−</button><input id="keep" value="${keep}" readonly><button data-k="1">+</button></div>
      <span class="spacer"></span></div>
    ${rows.length ? `<p class="muted small">${total} Karten zum Tauschen${val ? ` · ca. ${money(val)}` : ''}. Gegradete Karten zählen nicht.</p>
      <div class="grid" id="dl">${rows.map((r) => tileHTML(r.c, { qty: r.extra, sub: `${r.c.custom ? r.c.no : cat.cardNo(r.c)} · ${r.extra} übrig` })).join('')}</div>`
    : `<div class="empty">${icon.refresh}<b>Keine doppelten Karten</b>Sobald du eine Karte öfter als ${keep}× hast, erscheint sie hier.</div>`}`;
  $$('[data-k]').forEach((b) => (b.onclick = async () => { await store.setSetting('keepCount', Math.max(1, keep + +b.dataset.k)); viewDupes(null, routeToken); }));
  const dl = $('#dl');
  if (dl) { bindTiles(dl, (t) => openCardKey(t.dataset.key)); hydratePhotos(dl); }
}

/* ======================================================================
   Statistik
   ====================================================================== */
async function viewStats(_, token) {
  setTitle('Statistik');
  await loadNeeded();
  if (stale(token)) return;
  const list = await store.entries();
  if (!list.length) { view.innerHTML = `<div class="empty">${icon.chart}<b>Noch keine Daten</b>Sobald du Karten erfasst, siehst du hier Werte und Fortschritt.</div>`; return; }
  const total = list.reduce((a, e) => a + entryValue(e), 0);
  const spent = list.reduce((a, e) => a + (e.buyPrice || 0) * (e.qty || 1), 0);
  const byGame = {};
  for (const e of list) {
    const g = byGame[e.game] || (byGame[e.game] = { qty: 0, value: 0 });
    g.qty += e.qty || 0; g.value += entryValue(e);
  }
  const maxV = Math.max(1, ...Object.values(byGame).map((x) => x.value));
  const top = [...list].map((e) => ({ e, v: entryValue(e) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 12);
  const graded = list.filter((e) => e.graded);
  const byGrader = {};
  for (const e of graded) byGrader[`${e.grader} ${e.grade}`] = (byGrader[`${e.grader} ${e.grade}`] || 0) + (e.qty || 1);
  // Set-Fortschritt
  const setProg = [];
  for (const g of GAME_IDS) {
    const seen = new Set(list.filter((e) => e.game === g).map((e) => cat.getCard(g, e.cardId)?.set).filter(Boolean));
    for (const sid of seen) {
      const s = cat.getSet(g, sid);
      const cs = cat.setCards(g, sid);
      const have = cs.filter((c) => owned.has(keyOf(c))).length;
      setProg.push({ g, s, have, total: cs.length });
    }
  }
  setProg.sort((a, b) => b.have / b.total - a.have / a.total);
  const byRarity = {};
  for (const e of list) { const c = cardOf(e); if (c?.r) byRarity[c.r] = (byRarity[c.r] || 0) + (e.qty || 0); }
  view.innerHTML = `
    <div class="hero">
      <div class="stat"><b>${money(total)}</b><span>Gesamtwert</span></div>
      <div class="stat"><b>${money(spent)}</b><span>Ausgegeben</span></div>
      <div class="stat"><b style="color:${total - spent >= 0 ? 'var(--ok)' : 'var(--bad)'}">${spent ? (total - spent >= 0 ? '+' : '') + money(total - spent) : '–'}</b><span>Differenz</span></div>
    </div>
    <p class="faint tiny">Wert = eigener Wert, sonst gespeicherter Marktpreis. Gegradete Karten zählen nur mit eigenem Wert.</p>
    <h2>Nach Spiel</h2>
    <div class="panel bars">${Object.entries(byGame).map(([g, x]) => `<div class="b game-${g}"><span>${esc(gameInfo(g).short)}</span><div class="progress"><i style="width:${(x.value / maxV) * 100}%;background:${gameInfo(g).color}"></i></div><b style="text-align:right">${money(x.value)}</b></div><div class="muted tiny" style="margin:-4px 0 4px">${num(x.qty)} Karten</div>`).join('')}</div>
    ${top.length ? `<h2>Wertvollste Karten</h2><div class="list">${top.map(({ e, v }) => { const c = cardOf(e); return `<div class="item" data-entry="${esc(e.id)}"><div class="grow"><div class="title">${e.qty > 1 ? e.qty + '× ' : ''}${esc(cat.cardName(c) || c?.name)}</div><div class="sub">${esc(c?.custom ? c.no : cat.cardNo(c))}${e.graded ? ` · ${esc(e.grader)} ${esc(e.grade)}` : ''}</div></div><b>${money(v)}</b></div>`; }).join('')}</div>` : ''}
    ${graded.length ? `<h2>Gegradet (${graded.reduce((a, e) => a + (e.qty || 1), 0)})</h2><div class="row wrap">${Object.entries(byGrader).sort().map(([k, n]) => `<span class="badge grade">${esc(k)} · ${n}×</span>`).join('')}</div>` : ''}
    ${Object.keys(byRarity).length ? `<h2>Nach Seltenheit</h2><div class="row wrap">${Object.entries(byRarity).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="badge">${esc(k)} · ${n}</span>`).join('')}</div>` : ''}
    <h2>Set-Fortschritt</h2>
    <div class="list">${setProg.slice(0, 40).map((x) => `<a class="item" href="#/set/${x.g}/${encodeURIComponent(x.s.id)}" style="--gc:${GAMES[x.g].color}"><span class="set-code">${esc(cat.setCode(x.s))}</span><div class="grow"><div class="title">${esc(cat.setName(x.s))}</div><div class="progress" style="margin-top:6px"><i style="width:${pct(x.have, x.total)}%"></i></div></div><span class="pct">${x.have}/${x.total}</span></a>`).join('')}</div>`;
  $$('[data-entry]').forEach((it) => (it.onclick = () => openEntry(it.dataset.entry)));
}

/* ======================================================================
   Mehr / Einstellungen / Sicherung / Hilfe
   ====================================================================== */
async function viewMore() {
  setTitle('Mehr');
  const item = (href, ic, t, sub) => `<a class="item" href="${href}">${ic}<div class="grow"><div class="title">${t}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${icon.chev}</a>`;
  view.innerHTML = `
    <div class="list">
      ${item('#/wish', icon.heart, 'Wunschliste', `${wishSet.size} Karten`)}
      ${item('#/stats', icon.chart, 'Statistik & Wert', 'Wert, Top-Karten, Set-Fortschritt')}
      ${item('#/dupes', icon.refresh, 'Doppelte Karten', 'Tauschliste – alles, was du mehrfach hast')}
      ${item('#/search', icon.search, 'Karten suchen', 'Alle Datenbanken durchsuchen')}
      ${item('#/bulk', icon.list, 'Schnell-Eingabe per Liste', 'Kartennummern eintippen oder einfügen, z. B. „3x FB01-139“')}
      <div class="item" id="addNew">${icon.plus}<div class="grow"><div class="title">Neue Karte in die Datenbank</div><div class="sub">Für neue Sets und Karten, die noch fehlen</div></div>${icon.chev}</div>
      <div class="item" id="addCustom">${icon.plus}<div class="grow"><div class="title">Karte aus anderem Spiel</div><div class="sub">Eigener Eintrag mit Foto, z. B. für andere Sammelkarten</div></div>${icon.chev}</div>
    </div>
    <h2>App</h2>
    <div class="list">
      ${item('#/settings', icon.sliders, 'Einstellungen', 'Darstellung, Sprache, Scanner, KI')}
      ${item('#/backup', icon.shield, 'Sicherung & Export', 'Backup, CSV für Excel, Daten aktualisieren')}
      ${item('#/help', icon.spark, 'Hilfe & Tipps', 'So funktioniert die App')}
    </div>
    <p class="faint tiny" style="text-align:center;margin-top:24px">TCG Sammlung · Daten: offizielle Kartenlisten von Bandai, TCGdex (Pokémon).<br>Keine offizielle App von Bandai, The Pokémon Company oder Toei.</p>`;
  $('#addCustom').onclick = () => openCustom();
  $('#addNew').onclick = () => openNewCard({});
}

async function viewSettings() {
  setTitle('Einstellungen');
  const seg = (k, opts) => `<div class="seg" data-set="${k}">${opts.map(([v, l]) => `<button class="${String(S[k]) === String(v) ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  view.innerHTML = `<div class="form">
    <div class="field"><span class="lbl">Angezeigte Spiele</span>
      <div class="list">${GAME_IDS.map((g) => `<label class="item" style="cursor:pointer"><span class="badge game-${g}">${GAMES[g].short}</span><div class="grow small muted">${{ dbfw: 'FB01–FB11, Manga & Story Booster, Starter Decks, Promos', op: 'OP-01–OP-17, EB, PRB, Starter Decks, Promos', pokemon: '205 Sets von Base bis Mega-Entwicklung' }[g]}</div>
        <span class="switch"><input type="checkbox" data-game="${g}" ${activeGames().includes(g) ? 'checked' : ''}><span></span></span></label>`).join('')}</div>
      <div class="faint tiny" style="margin:4px 2px">Ausgeblendete Spiele werden nicht geladen – die App startet dann schneller.</div></div>
    <div class="field"><span class="lbl">Darstellung</span>${seg('theme', [['dark', 'Dunkel'], ['light', 'Hell'], ['auto', 'System']])}</div>
    <div class="field"><span class="lbl">Pokémon-Namen & Bilder</span>${seg('pkLang', [['de', 'Deutsch'], ['en', 'Englisch']])}
      <div class="faint tiny" style="margin:4px 2px">Deutsche Bilder gibt es nicht für jede Karte – dann wird das englische gezeigt.</div></div>
    <div class="two">
      <div class="field"><label>Standard-Sprache</label><select data-sel="defaultLang">${LANGS.map((l) => `<option ${l === S.defaultLang ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Standard-Zustand</label><select data-sel="defaultCondition">${CONDITIONS.map(([k, l]) => `<option value="${k}" ${k === S.defaultCondition ? 'selected' : ''}>${k} – ${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Dollar-Kurs (1 USD in EUR)</label><input type="number" step="0.01" data-num="usdRate" value="${S.usdRate}"><div class="faint tiny" style="margin:4px 2px">Für die One-Piece-Preise von TCGplayer.</div></div>
    <h2>KI-Erkennung (optional)</h2>
    <div class="notice">Ohne Internet erkennt die App Karten über die aufgedruckte Nummer. Mit einem eigenen <b>Claude API-Schlüssel</b> (console.anthropic.com) erkennt sie auch schwierige Fotos, mehrere Karten auf einem Bild und Grading-Slabs. Jede Erkennung kostet ein paar Cent bei Anthropic. Der Schlüssel bleibt nur auf diesem Gerät.</div>
    <div class="field"><label>API-Schlüssel</label><input type="password" data-text="aiKey" value="${esc(S.aiKey)}" placeholder="sk-ant-…" autocomplete="off"></div>
    <div class="field"><label>Modell</label><select data-sel="aiModel">${[['claude-opus-5-5', 'Claude Opus 5.5 (beste Erkennung)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (günstiger)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (am günstigsten)']].map(([k, l]) => `<option value="${k}" ${k === S.aiModel ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <label class="row" style="font-weight:650"><span class="switch"><input type="checkbox" data-bool="aiAuto" ${S.aiAuto ? 'checked' : ''}><span></span></span> KI automatisch beim Scannen verwenden (wenn online)</label>
    <button class="btn" id="aiTest">${icon.spark} Schlüssel testen</button>
  </div>`;
  $$('[data-set]').forEach((sg) => sg.querySelectorAll('button').forEach((b) => (b.onclick = async () => {
    sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    await store.setSetting(sg.dataset.set, b.dataset.v);
    if (sg.dataset.set === 'theme') applyTheme();
    if (sg.dataset.set === 'pkLang') cat.setPkLang(b.dataset.v);
  })));
  $$('[data-sel]').forEach((s) => (s.onchange = () => store.setSetting(s.dataset.sel, s.value)));
  $$('[data-game]').forEach((x) => (x.onchange = async () => {
    const on = $$('[data-game]').filter((y) => y.checked).map((y) => y.dataset.game);
    if (!on.length) { x.checked = true; return toast('Mindestens ein Spiel muss eingeblendet sein.'); }
    await store.setSetting('games', on);
  }));
  $$('[data-num]').forEach((s) => (s.onchange = () => store.setSetting(s.dataset.num, parseFloat(s.value) || 0)));
  $$('[data-text]').forEach((s) => (s.onchange = () => store.setSetting(s.dataset.text, s.value.trim())));
  $$('[data-bool]').forEach((s) => (s.onchange = () => store.setSetting(s.dataset.bool, s.checked)));
  $('#aiTest').onclick = async (ev) => {
    const b = ev.currentTarget;
    await store.setSetting('aiKey', $('[data-text="aiKey"]').value.trim());
    if (!S.aiKey) return toast('Bitte zuerst einen Schlüssel eintragen.');
    b.disabled = true;
    try {
      const r = await fetch('https://api.anthropic.com/v1/models/' + encodeURIComponent(S.aiModel), {
        headers: { 'x-api-key': S.aiKey, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      });
      toast(r.ok ? 'Schlüssel funktioniert ✓' : r.status === 401 ? 'Schlüssel ungültig' : `Fehler ${r.status}`);
    } catch { toast('Keine Verbindung'); }
    b.disabled = false;
  };
}

async function viewBackup() {
  setTitle('Sicherung & Export');
  const list = await store.entries();
  view.innerHTML = `
    <div class="notice ${Date.now() - (S.lastBackup || 0) > 30 * 864e5 && list.length ? 'warn' : ''}">Deine Sammlung liegt nur auf diesem Gerät. Erstelle regelmäßig eine Sicherung und speichere sie z. B. in iCloud Drive oder Google Drive.
      ${S.lastBackup ? `<br><b>Letzte Sicherung: ${fmtDate(S.lastBackup)}</b>` : ''}</div>
    <h2>Sicherung</h2>
    <div class="list">
      <div class="item" data-a="backup">${icon.download}<div class="grow"><div class="title">Sicherung erstellen</div><div class="sub">Alle Karten, Wunschliste und Fotos als Datei</div></div></div>
      <div class="item" data-a="backupLite">${icon.download}<div class="grow"><div class="title">Sicherung ohne Fotos</div><div class="sub">Kleinere Datei</div></div></div>
      <div class="item" data-a="restore">${icon.upload}<div class="grow"><div class="title">Sicherung einspielen</div><div class="sub">Ergänzt deine Sammlung oder ersetzt sie</div></div></div>
    </div>
    <h2>Export</h2>
    <div class="list">
      <div class="item" data-a="csv">${icon.list}<div class="grow"><div class="title">Als CSV (Excel, Numbers)</div><div class="sub">${list.length} Einträge</div></div></div>
    </div>
    <h2>Kartendatenbank</h2>
    <div class="list" id="dbinfo"></div>
    <div class="row wrap" style="margin-top:10px">
      <button class="btn" data-a="pkupdate">${icon.refresh} Neue Pokémon-Sets online suchen</button>
      <button class="btn" data-a="pkprices">${icon.refresh} Pokémon-Preise meiner Karten</button>
      <button class="btn" data-a="ocr">${icon.download} Scanner offline vorbereiten</button>
    </div>
    <p class="faint tiny">Dragon Ball und One Piece werden mit App-Updates aktualisiert (Skript <code>tools/build_data.py</code>).</p>
    <h2>Gefahrenzone</h2>
    <button class="btn danger" data-a="wipe">${icon.trash} Alle meine Daten löschen</button>`;
  await loadNeeded();
  $('#dbinfo').innerHTML = cat.dataInfo().map((d) => `<div class="item"><span class="badge game-${d.game}">${GAMES[d.game].short}</span><div class="grow"><div class="title">${num(d.sets)} Sets · ${num(d.cards)} Karten</div><div class="sub">Stand ${fmtDate(d.updated)}</div></div></div>`).join('');
  $$('[data-a]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'backup' || a === 'backupLite') {
      toast('Sicherung wird erstellt …');
      const data = await store.exportAll({ withPhotos: a === 'backup' });
      const name = `tcg-sammlung-${new Date().toISOString().slice(0, 10)}.json`;
      await shareOrDownload(name, JSON.stringify(data), 'application/json');
      await store.setSetting('lastBackup', Date.now());
    } else if (a === 'restore') {
      const f = await pickFile('application/json,.json');
      if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch { return toast('Datei kann nicht gelesen werden.'); }
      sheet('Sicherung einspielen', (body, close) => {
        body.innerHTML = `<p class="muted">${(data.entries || []).length} Einträge, ${(data.wish || []).length} Wünsche, ${Object.keys(data.photos || {}).length} Fotos vom ${fmtDate(data.exported)}.</p>
          <div class="two"><button class="btn" data-m="merge">Ergänzen</button><button class="btn danger" data-m="replace">Ersetzen</button></div>`;
        body.querySelectorAll('[data-m]').forEach((x) => (x.onclick = async () => {
          try {
            const r = await store.importAll(data, { replace: x.dataset.m === 'replace' });
            S = await store.settings();
            await refreshOwned();
            toast(`${r.entries} Einträge eingespielt`);
            close();
          } catch (err) { toast(err.message); }
        }));
      });
    } else if (a === 'csv') exportCSV();
    else if (a === 'pkupdate') {
      if (!navigator.onLine) return toast('Dafür brauchst du Internet.');
      b.disabled = true;
      try {
        const r = await cat.updatePokemonOnline((t) => { b.textContent = t; });
        if (r.sets) {
          const prev = (await store.db.get('kv', 'pokemonExtra')) || { sets: [], cards: [] };
          await store.db.put('kv', { sets: [...prev.sets, ...r.extra.sets], cards: [...prev.cards, ...r.extra.cards] }, 'pokemonExtra');
        }
        toast(r.sets ? `${r.sets} neue Sets, ${r.cards} Karten ergänzt` : 'Alles aktuell');
      } catch (e) { toast('Fehler: ' + e.message); }
      viewBackup();
    } else if (a === 'pkprices') {
      await cat.load('pokemon');
      const cards = [...owned.keys()].filter((k) => k.startsWith('pokemon:')).map((k) => cat.getCard('pokemon', k.slice(8))).filter(Boolean);
      if (!cards.length) return toast('Keine Pokémon-Karten in der Sammlung.');
      updatePrices(cards);
    } else if (a === 'ocr') {
      b.disabled = true;
      b.innerHTML = '<span class="spin"></span> Lade Texterkennung …';
      try {
        const { getWorker } = await import('./recognize.js');
        await getWorker((m) => { if (m.progress != null) b.innerHTML = `<span class="spin"></span> ${Math.round(m.progress * 100)} % ${esc(m.status || '')}`; });
        toast('Scanner ist offline bereit ✓');
        b.innerHTML = `${icon.check} Scanner bereit`;
      } catch (e) { toast(e.message); b.disabled = false; b.innerHTML = 'Erneut versuchen'; }
    } else if (a === 'wipe') {
      if (!(await confirmDialog('Wirklich alles löschen?', 'Alle Karten, Fotos und die Wunschliste werden gelöscht. Erstelle vorher eine Sicherung!', 'Alles löschen', true))) return;
      await store.importAll({ app: 'tcg-sammlung', entries: [], wish: [], photos: {} }, { replace: true });
      await refreshOwned();
      toast('Alle Daten gelöscht');
    }
  }));
}

async function exportCSV() {
  await loadNeeded();
  const list = await store.entries();
  const cols = ['Spiel', 'Set', 'Set-Name', 'Nummer', 'Name', 'Seltenheit', 'Anzahl', 'Version', 'Zustand', 'Sprache', 'Gegradet', 'Grading', 'Note', 'Zertifikat', 'Kaufpreis', 'Kaufdatum', 'Wert/Stk', 'Wert gesamt', 'Lagerort', 'Notizen', 'Hinzugefügt'];
  const q = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = list.map((e) => {
    const c = cardOf(e);
    const s = c && !c.custom ? cat.getSet(c.game, c.set) : null;
    const per = e.value ?? marketPrice(c);
    const de = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));
    return [gameInfo(e.game).short, s ? cat.setCode(s) : c?.set, s ? cat.setName(s) : '', c ? (c.custom ? c.no : cat.cardNo(c)) : '', cat.cardName(c) || c?.name, c?.r || '', e.qty, e.variant, e.condition, e.lang, e.graded ? 'ja' : 'nein', e.grader, e.grade, e.cert, de(e.buyPrice), e.buyDate, de(per), de(entryValue(e) || ''), e.location, e.notes, e.created ? new Date(e.created).toISOString().slice(0, 10) : ''].map(q).join(';');
  });
  const csv = '﻿' + cols.join(';') + '\n' + rows.join('\n');
  shareOrDownload(`tcg-sammlung-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
}

async function viewHelp() {
  setTitle('Hilfe & Tipps');
  view.innerHTML = `<div class="stack">
    <div class="panel"><h3>📷 Karten scannen</h3><p class="muted small">Tippe unten auf den runden Knopf. Halte die Karte gerade und formatfüllend in den Rahmen, ohne Spiegelung, und löse aus. Die App liest die aufgedruckte Kartennummer (z. B. <b>FB01-139</b>, <b>OP05-119</b> oder <b>025/165</b>) und den Namen und schlägt die passende Karte vor. Das funktioniert komplett offline.</p>
    <p class="muted small"><b>Serien-Scan</b> (Kisten-Symbol rechts unten): „+1 hinzufügen“ legt die Karte ab und die Kamera ist sofort wieder bereit – ideal nach dem Booster-Öffnen.</p>
    <p class="muted small">Oben kannst du das Spiel festlegen. Das macht die Erkennung schneller und genauer.</p></div>
    <div class="panel"><h3>✅ Abhak-Modus</h3><p class="muted small">Unter <b>Sets</b> ein Set öffnen und „Abhak-Modus“ einschalten: Jedes Antippen zählt die Karte +1. So trägst du ganze Sets in Minuten ein. Gedrückt halten öffnet die Karte.</p></div>
    <div class="panel"><h3>🏅 Gegradete Karten</h3><p class="muted small">Beim Hinzufügen „Gegradet“ einschalten und Firma (PSA, BGS, CGC, TAG …), Note und Zertifikatsnummer eintragen. Der Scanner erkennt PSA/BGS/CGC-Etiketten oft automatisch. Mache am besten ein eigenes Foto vom Slab.</p></div>
    <div class="panel"><h3>💶 Preise</h3><p class="muted small">One Piece: TCGplayer-Marktpreise sind eingebaut (Stand des Updates). Pokémon: Cardmarket-Preise per Knopf online laden. Dragon Ball und One Piece: Cardmarket-Preise sind eingebaut (Stand des letzten Updates) und werden im Set unter jeder Karte angezeigt.</p></div>
    <div class="panel"><h3>✨ KI-Erkennung</h3><p class="muted small">Optional: Mit einem eigenen Claude API-Schlüssel (Einstellungen) erkennt die App auch mehrere Karten auf einem Foto (z. B. eine ganze Binder-Seite) und Grading-Slabs.</p></div>
    <div class="panel"><h3>📴 Offline</h3><p class="muted small">Nach dem ersten Start funktioniert alles ohne Internet. Kartenbilder werden beim Anschauen gespeichert. Über „Set › Bilder für offline speichern“ holst du ein ganzes Set auf einmal.</p></div>
    <div class="panel"><h3>💾 Sicherung</h3><p class="muted small">Deine Daten liegen nur auf dem Gerät. Unter Mehr › Sicherung regelmäßig eine Sicherung erstellen und in der Cloud ablegen.</p></div>
  </div>`;
}

/* ======================================================================
   Service Worker / Updates
   ====================================================================== */
function registerSW() {
  if (EMBEDDED) return; // eingebettet (Vorschau) gibt es keinen Offline-Modus
  try { registerSWInner(); } catch (e) { console.warn('Offline-Modus nicht verfügbar:', e); }
}
function registerSWInner() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const ask = (w) => toast('Neue Version verfügbar', { action: 'Neu laden', ms: 15000, onAction: () => w.postMessage('SKIP_WAITING') });
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('SW', e));
  // Nur nach einem Update neu laden, nicht bei der allerersten Installation
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

init().catch((e) => {
  console.error(e);
  view.innerHTML = `<div class="empty"><b>Die App konnte nicht starten</b>${esc(e?.message || String(e))}</div>`;
});
