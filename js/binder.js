// Sammel-Binder: Lieblingskarten, teuerste Karten und Slabs schön präsentiert.
import { $, $$, esc, uid, sheet, toast, money, icon, confirmDialog, norm } from './util.js';
import * as store from './db.js';
import * as cat from './catalog.js';

let A = null; // Helfer aus app.js

export function initBinder(api) { A = api; }

/* ---------------- Daten ---------------- */
const COLORS = [
  ['#7a2430', 'Bordeaux'], ['#1e3a6e', 'Royalblau'], ['#1f5a46', 'Smaragd'],
  ['#2a2a2e', 'Schwarz'], ['#8a5a1c', 'Cognac'], ['#5b2a86', 'Violett'], ['#b5651d', 'Saiyajin-Orange'],
];
const PER_PAGE = 9;

export async function binders() {
  let list = await store.db.get('kv', 'binders');
  if (!Array.isArray(list)) {
    list = [{ id: 'fav', name: 'Lieblingskarten', color: COLORS[0][0], items: [] }];
    await store.db.put('kv', list, 'binders');
  }
  return list;
}
async function saveBinders(list) { await store.db.put('kv', list, 'binders'); }

/** Automatische Binder: teuerste Karten und alle gegradeten */
async function smartItems(id) {
  const entries = await store.entries();
  if (id === 'top') {
    const rows = [];
    for (const e of entries) {
      const c = A.cardOf(e);
      if (!c) continue;
      const per = e.value != null && e.value !== '' ? +e.value : A.marketPrice(c);
      if (per) rows.push({ entry: e.id, key: e.key, v: per });
    }
    rows.sort((a, b) => b.v - a.v);
    return rows.slice(0, 27);
  }
  if (id === 'graded') {
    return entries.filter((e) => e.graded)
      .sort((a, b) => (parseFloat(b.grade) || 0) - (parseFloat(a.grade) || 0) || (b.updated || 0) - (a.updated || 0))
      .map((e) => ({ entry: e.id, key: e.key }));
  }
  return [];
}
const SMART = {
  top: { id: 'top', name: 'Teuerste Karten', color: '#8a6d1c', smart: true, hint: 'Füllt sich automatisch mit deinen wertvollsten Karten.' },
  graded: { id: 'graded', name: 'Gegradet', color: '#23262d', smart: true, hint: 'Alle gegradeten Karten als Slab – sortiert nach Note.' },
};

async function getBinder(id) {
  if (SMART[id]) return { ...SMART[id], items: await smartItems(id) };
  return (await binders()).find((b) => b.id === id) || null;
}

/** Eintrag eines Binder-Fachs auflösen: Karte + (falls vorhanden) Exemplar aus der Sammlung */
async function resolve(item) {
  const entries = await store.entries();
  const e = item.entry ? entries.find((x) => x.id === item.entry) : null;
  if (e) return { c: A.cardOf(e), e };
  const i = item.key.indexOf(':');
  const game = item.key.slice(0, i);
  if (cat.GAMES[game]) await cat.load(game).catch(() => {});
  const c = cat.getCard(game, item.key.slice(i + 1));
  const e2 = entries.filter((x) => x.key === item.key).sort((a, b) => (b.graded ? 1 : 0) - (a.graded ? 1 : 0))[0];
  return { c, e: e2 || null };
}

/* ---------------- Darstellung einer Karte ---------------- */
function art(c) {
  if (!c) return '';
  const spr = c.custom ? '' : cat.spriteHTML(c);
  if (spr) return spr;
  const src = c.custom ? '' : cat.cardImg(c, 'high');
  if (src) return `<img referrerpolicy="no-referrer" src="${esc(src)}" data-fb="${esc(cat.cardImgFallback(c, 'high'))}" alt="${esc(c.name)}">`;
  if (c.photo) return `<img data-photo="${esc(c.photo)}" alt="">`;
  return `<div class="ph">${esc(c.name)}<br>${esc(c.no || '')}</div>`;
}
const GRADER_STYLE = {
  PSA: ['#c8102e', '#fff'], BGS: ['#1a1a1a', '#d4af37'], CGC: ['#0a3d91', '#fff'], TAG: ['#111', '#fff'],
  SGC: ['#111', '#fff'], ACE: ['#004b8d', '#fff'], GMA: ['#5b2a86', '#fff'], PCA: ['#0b6e4f', '#fff'], AP: ['#333', '#fff'],
};
const GRADE_WORD = { 10: 'GEM MT', 9.5: 'MINT+', 9: 'MINT', 8.5: 'NM-MT+', 8: 'NM-MT', 7: 'NM', 6: 'EX-MT', 5: 'EX', 4: 'VG-EX', 3: 'VG', 2: 'GOOD', 1: 'PR' };
const isShiny = (c, v) => (v || 0) >= 10 || ['SCR', 'SEC', 'L', 'SR', 'SP', 'SPR', 'TR'].includes(c?.r) || c?.par;

function cardHTML(c, e, opts = {}) {
  const v = e ? A.entryValue(e) / (e.qty || 1) : A.marketPrice(c);
  if (e?.graded) {
    const [bg, fg] = GRADER_STYLE[e.grader] || ['#333', '#fff'];
    const word = GRADE_WORD[parseFloat(e.grade)] || e.gradeLabel || '';
    return `<div class="slab ${isShiny(c, v) ? 'shiny' : ''}">
      <div class="slab-label" style="--lb:${bg};--lf:${fg}">
        <div class="sl-left"><b>${esc(e.grader || 'GRADED')}</b><span>${esc(cat.cardName(c) || c?.name || '')}</span><span>${esc(c?.custom ? c.no : cat.cardNo(c))}${e.cert ? ' · #' + esc(e.cert) : ''}</span></div>
        <div class="sl-grade"><span>${esc(e.gradeLabel || word)}</span><b>${esc(e.grade || '–')}</b></div>
      </div>
      <div class="slab-card">${art(c)}<i class="shine"></i></div>
    </div>`;
  }
  return `<div class="sleeved ${isShiny(c, v) ? 'shiny' : ''}">${art(c)}<i class="shine"></i><i class="sleeve"></i></div>`;
}

/* ---------------- Übersicht ---------------- */
export async function viewBinders(token) {
  A.setTitle('Binder');
  A.addAction(icon.plus, () => newBinder(), 'Neuer Binder');
  const list = await binders();
  const all = [...list, SMART.top, SMART.graded];
  const covers = [];
  for (const b of all) {
    const items = b.smart ? await smartItems(b.id) : b.items;
    const prev = [];
    for (const it of items.slice(0, 3)) prev.push(await resolve(it));
    let value = 0;
    for (const it of items) { const r = await resolve(it); if (r.c) value += r.e ? A.entryValue(r.e) / (r.e.qty || 1) : A.marketPrice(r.c) || 0; }
    covers.push({ b, count: items.length, prev, value });
  }
  if (A.stale(token)) return;
  A.view.innerHTML = `
    <p class="muted small" style="margin:2px 2px 14px">Deine Highlights schön präsentiert. Lege Lieblingskarten in eigene Binder – die teuersten und gegradeten Karten sortiert die App automatisch.</p>
    <div class="covers">${covers.map(({ b, count, prev, value }) => `
      <a class="cover" href="#/binder/${esc(b.id)}" style="--bc:${esc(b.color)}">
        <div class="cover-rings"><i></i><i></i><i></i></div>
        <div class="cover-fan">${prev.map((r, i) => r.c ? `<div class="fan f${i}"><div class="pic">${art(r.c)}</div></div>` : '').join('') || '<div class="fan-empty">leer</div>'}</div>
        <div class="cover-plate"><b>${esc(b.name)}</b><span>${count} Karte${count === 1 ? '' : 'n'}${value ? ' · ' + money(value) : ''}${b.smart ? ' · automatisch' : ''}</span></div>
      </a>`).join('')}
    </div>
    <button class="btn block" id="newBinder" style="margin-top:14px">${icon.plus} Neuer Binder</button>`;
  $('#newBinder').onclick = () => newBinder();
  A.hydratePhotos(A.view);
}

function newBinder(existing = null, onDone) {
  sheet(existing ? 'Binder bearbeiten' : 'Neuer Binder', (body, close) => {
    let color = existing?.color || COLORS[1][0];
    body.innerHTML = `<form class="form">
      <div class="field"><label>Name</label><input name="name" required maxlength="40" value="${esc(existing?.name || '')}" placeholder="z. B. Goku-Sammlung, Secret Rares, Trade-Binder"></div>
      <div class="field"><span class="lbl">Farbe</span><div class="swatches">${COLORS.map(([c, n]) => `<button type="button" class="sw ${c === color ? 'on' : ''}" data-c="${c}" style="--bc:${c}" title="${n}"></button>`).join('')}</div></div>
      <div class="${existing ? 'two' : ''}">${existing ? `<button type="button" class="btn danger" data-del>${icon.trash} Löschen</button>` : ''}
      <button class="btn primary block" type="submit">${icon.check} ${existing ? 'Speichern' : 'Anlegen'}</button></div></form>`;
    body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { color = b.dataset.c; body.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Binder löschen?', 'Die Karten bleiben in deiner Sammlung, nur der Binder verschwindet.', 'Löschen', true))) return;
      await saveBinders((await binders()).filter((b) => b.id !== existing.id));
      close(); toast('Binder gelöscht'); A.go('#/binders');
    });
    body.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const name = ev.target.name.value.trim() || 'Mein Binder';
      const list = await binders();
      if (existing) Object.assign(list.find((b) => b.id === existing.id), { name, color });
      else list.push({ id: uid().slice(0, 8), name, color, items: [] });
      await saveBinders(list);
      close();
      toast(existing ? 'Gespeichert' : 'Binder angelegt');
      if (onDone) onDone(); else A.go(existing ? `#/binder/${existing.id}` : `#/binder/${list[list.length - 1].id}`);
    };
  });
}

/* ---------------- Binder ansehen ---------------- */
const bstate = { page: 0, id: null, edit: false };

export async function viewBinder(id, token) {
  const b = await getBinder(id);
  if (!b) throw new Error('Binder nicht gefunden');
  if (bstate.id !== id) { bstate.id = id; bstate.page = 0; bstate.edit = false; }
  const slots = [];
  for (const it of b.items) { const r = await resolve(it); if (r.c) slots.push({ ...r, it }); }
  if (A.stale(token)) return;
  A.setTitle(b.name);
  if (!b.smart) {
    A.addAction(icon.edit, () => { bstate.edit = !bstate.edit; render(); }, 'Bearbeiten');
    A.addAction(icon.sliders, () => newBinder(b, () => A.route()), 'Einstellungen');
  }
  const wide = () => window.innerWidth >= 900;
  const total = slots.reduce((a, s) => a + (s.e ? A.entryValue(s.e) / (s.e.qty || 1) : A.marketPrice(s.c) || 0), 0);

  function pages() {
    const n = slots.length + (b.smart ? 0 : 1); // ein freies Fach zum Hinzufügen
    const p = Math.max(1, Math.ceil(n / PER_PAGE));
    return wide() ? p + (p % 2) : p;
  }
  function pageHTML(p) {
    let html = '';
    for (let i = 0; i < PER_PAGE; i++) {
      const idx = p * PER_PAGE + i;
      const s = slots[idx];
      if (s) {
        const v = s.e ? A.entryValue(s.e) / (s.e.qty || 1) : A.marketPrice(s.c);
        html += `<div class="pocket filled" data-i="${idx}">
          ${cardHTML(s.c, s.e)}
          ${b.id === 'top' && v ? `<span class="pocket-price">${money(v)}</span>` : ''}
          ${bstate.edit ? `<div class="pocket-tools"><button data-mv="-1" data-i="${idx}" aria-label="Nach vorne">‹</button><button data-rm="${idx}" aria-label="Entfernen">✕</button><button data-mv="1" data-i="${idx}" aria-label="Nach hinten">›</button></div>` : ''}
        </div>`;
      } else if (!b.smart && idx === slots.length) {
        html += `<button class="pocket add" data-add aria-label="Karte hinzufügen">${icon.plus}<span>Karte einlegen</span></button>`;
      } else html += '<div class="pocket"></div>';
    }
    return `<div class="bpage">${html}<div class="holes"><i></i><i></i><i></i></div></div>`;
  }
  function render(dir = 0) {
    const n = pages();
    const step = wide() ? 2 : 1;
    bstate.page = Math.min(Math.max(0, bstate.page), n - 1);
    if (wide()) bstate.page -= bstate.page % 2;
    // breit: immer eine Doppelseite wie im echten Binder
    const shown = [bstate.page, ...(wide() ? [bstate.page + 1] : [])];
    A.view.innerHTML = `
      <div class="binder-view" style="--bc:${esc(b.color)}">
        <div class="binder-head">
          <div><b>${slots.length}</b> Karte${slots.length === 1 ? '' : 'n'}${total ? ` · Wert <b>${money(total)}</b>` : ''}</div>
          <div class="muted small">${b.smart ? esc(b.hint) : bstate.edit ? 'Bearbeiten: ‹ › verschieben, ✕ herausnehmen' : 'Wischen oder Pfeile zum Blättern · Karte antippen'}</div>
        </div>
        ${slots.length || !b.smart ? `<div class="spread ${dir > 0 ? 'turn-next' : dir < 0 ? 'turn-prev' : ''}">${shown.map((p) => pageHTML(p)).join('')}</div>
        <div class="pager">
          <button class="btn sm" data-prev ${bstate.page === 0 ? 'disabled' : ''}>‹ Zurück</button>
          <span class="muted small">Seite ${bstate.page + 1}${shown.length > 1 ? '–' + (bstate.page + 2) : ''} von ${n}</span>
          <button class="btn sm" data-next ${bstate.page + step >= n ? 'disabled' : ''}>Weiter ›</button>
        </div>` : `<div class="empty">${icon.binder}<b>Noch leer</b>${b.id === 'graded' ? 'Trage bei einer Karte „Gegradet“ ein – dann liegt sie hier als Slab.' : 'Gib deinen Karten einen Wert oder lade Preise – dann erscheinen die teuersten hier.'}</div>`}
      </div>`;
    A.hydratePhotos(A.view);
    const flip = (d) => { const nn = bstate.page + d * step; if (nn < 0 || nn >= pages()) return; bstate.page = nn; render(d); };
    $('[data-prev]')?.addEventListener('click', () => flip(-1));
    $('[data-next]')?.addEventListener('click', () => flip(1));
    const spread = $('.spread');
    if (spread) {
      let x0 = null;
      spread.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      spread.addEventListener('touchend', (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) flip(dx < 0 ? 1 : -1);
      });
      spread.addEventListener('click', async (ev) => {
        const t = ev.target;
        if (t.closest('[data-add]')) return pickCards(b, () => A.route());
        const rm = t.closest('[data-rm]');
        if (rm) {
          const list = await binders(); const bb = list.find((x) => x.id === b.id);
          const i = +rm.dataset.rm; const removed = slots[i];
          bb.items = bb.items.filter((it) => it !== removed.it && !(it.key === removed.it.key && it.entry === removed.it.entry));
          await saveBinders(list); slots.splice(i, 1); render(); toast('Aus dem Binder genommen');
          return;
        }
        const mv = t.closest('[data-mv]');
        if (mv) {
          const i = +mv.dataset.i, j = i + +mv.dataset.mv;
          if (j < 0 || j >= slots.length) return;
          [slots[i], slots[j]] = [slots[j], slots[i]];
          const list = await binders(); const bb = list.find((x) => x.id === b.id);
          bb.items = slots.map((s) => s.it);
          await saveBinders(list); render();
          return;
        }
        const p = t.closest('.pocket.filled');
        if (p && !bstate.edit) showcase(slots[+p.dataset.i]);
      });
      // Glanz folgt dem Finger / der Maus
      spread.addEventListener('pointermove', (e) => {
        const el = e.target.closest('.sleeved, .slab');
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    }
  }
  render();
}

/* ---------------- Große Ansicht einer Karte ---------------- */
function showcase(s) {
  const { c, e } = s;
  const v = e ? A.entryValue(e) / (e.qty || 1) : A.marketPrice(c);
  const set = c.custom ? null : cat.getSet(c.game, c.set);
  const z = document.createElement('div');
  z.className = 'showcase';
  z.innerHTML = `<div class="sc-stage">${cardHTML(c, e)}</div>
    <div class="sc-info">
      <b>${esc(cat.cardName(c) || c.name)}</b>
      <span>${esc(c.custom ? c.no : cat.cardNo(c))}${set ? ' · ' + esc(cat.setCode(set)) + ' ' + esc(cat.setName(set)) : ''}${c.r ? ' · ' + esc(c.r) : ''}</span>
      ${e?.graded ? `<span>${esc(e.grader)} ${esc(e.grade)}${e.cert ? ' · Zertifikat ' + esc(e.cert) : ''}</span>` : ''}
      ${v ? `<span class="sc-price">${money(v)}</span>` : ''}
      <div class="row" style="justify-content:center;margin-top:10px">
        ${c.custom ? '' : `<button class="btn sm" data-open>Karte öffnen</button>`}
        <button class="btn sm" data-close>Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(z);
  A.hydratePhotos(z);
  const card = z.querySelector('.sleeved, .slab');
  const tilt = (cx, cy) => {
    const r = card.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (cx - r.left) / r.width)), y = Math.min(1, Math.max(0, (cy - r.top) / r.height));
    card.style.transform = `rotateY(${(x - 0.5) * 22}deg) rotateX(${(0.5 - y) * 22}deg)`;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
  };
  z.addEventListener('pointermove', (ev) => tilt(ev.clientX, ev.clientY));
  z.addEventListener('touchmove', (ev) => { tilt(ev.touches[0].clientX, ev.touches[0].clientY); }, { passive: true });
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  const close = () => { z.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  z.querySelector('[data-close]').onclick = close;
  z.querySelector('[data-open]')?.addEventListener('click', () => { close(); A.openCardKey(`${c.game}:${c.id}`); });
  z.addEventListener('click', (ev) => { if (ev.target === z || ev.target.classList.contains('sc-stage')) close(); });
}

/* ---------------- Karten auswählen ---------------- */
async function pickCards(b, onDone) {
  const entries = await store.entries();
  const rows = entries.map((e) => ({ e, c: A.cardOf(e) })).filter((r) => r.c);
  rows.sort((a, b2) => (A.entryValue(b2.e) / (b2.e.qty || 1)) - (A.entryValue(a.e) / (a.e.qty || 1)));
  sheet(`In „${b.name}“ legen`, (body, close) => {
    if (!rows.length) {
      body.innerHTML = '<div class="empty"><b>Deine Sammlung ist noch leer</b>Füge zuerst Karten hinzu – dann kannst du sie hier einlegen.</div>';
      return;
    }
    const inB = new Set(b.items.map((it) => it.entry || it.key));
    const added = [];
    const draw = (q = '') => {
      const nq = norm(q);
      const list = rows.filter((r) => !nq || norm(`${r.c.name} ${r.c.nameDe || ''} ${r.c.no} ${r.c.set}`).includes(nq));
      body.querySelector('#pk').innerHTML = list.slice(0, 120).map((r) => {
        const on = inB.has(r.e.id) || added.includes(r.e.id);
        return A.tileHTML(r.c, { qty: r.e.qty, graded: r.e.graded ? `${r.e.grader} ${r.e.grade}` : '', entry: r.e.id, selected: on, price: A.priceText(r.c), sub: on ? 'im Binder ✓' : undefined });
      }).join('');
      A.hydratePhotos(body);
    };
    body.innerHTML = `<div class="search" style="margin-bottom:10px">${icon.search}<input type="search" id="pq" placeholder="In deiner Sammlung suchen …"></div>
      <div class="grid" id="pk"></div>
      <button class="btn primary block" id="pdone" style="margin-top:12px">${icon.check} Fertig</button>`;
    draw();
    body.querySelector('#pq').oninput = (e) => draw(e.target.value);
    body.querySelector('#pk').addEventListener('click', async (ev) => {
      const t = ev.target.closest('.tcg');
      if (!t) return;
      const id = t.dataset.entry;
      if (inB.has(id) || added.includes(id)) return toast('Liegt schon im Binder');
      const list = await binders(); const bb = list.find((x) => x.id === b.id);
      const r = rows.find((x) => x.e.id === id);
      bb.items.push({ entry: id, key: r.e.key });
      b.items = bb.items;
      await saveBinders(list);
      added.push(id);
      t.classList.add('selected');
      toast(`${A.cardName(r.c)} eingelegt`);
    });
    body.querySelector('#pdone').onclick = () => close();
  }, { onClose: onDone });
}

/** Von der Kartenansicht aus: Karte in einen Binder legen */
export async function addToBinder(c) {
  const list = await binders();
  const entries = (await store.entries()).filter((e) => e.key === `${c.game}:${c.id}`);
  sheet('In einen Binder legen', (body, close) => {
    const pickEntry = entries.length > 1;
    let entry = entries.find((e) => e.graded) || entries[0] || null;
    body.innerHTML = `
      ${!entries.length ? '<div class="notice small" style="margin-bottom:10px">Diese Karte ist noch nicht in deiner Sammlung – sie wird trotzdem im Binder gezeigt.</div>' : ''}
      ${pickEntry ? `<div class="field" style="margin-bottom:12px"><span class="lbl">Welches Exemplar?</span><div class="seg" data-seg="entry">${entries.map((e) => `<button type="button" class="${e === entry ? 'on' : ''}" data-e="${esc(e.id)}">${e.graded ? `${esc(e.grader)} ${esc(e.grade)}` : `${esc(e.variant || 'Standard')} ${esc(e.condition || '')}`}</button>`).join('')}</div></div>` : ''}
      <div class="list">${list.map((b) => `<div class="item" data-b="${esc(b.id)}"><span class="mini-cover" style="--bc:${esc(b.color)}"></span><div class="grow"><div class="title">${esc(b.name)}</div><div class="sub">${b.items.length} Karten</div></div>${icon.chev}</div>`).join('')}
        <div class="item" data-new>${icon.plus}<div class="grow"><div class="title">Neuer Binder …</div></div></div></div>`;
    body.querySelectorAll('[data-e]').forEach((x) => (x.onclick = () => { entry = entries.find((e) => e.id === x.dataset.e); body.querySelectorAll('[data-e]').forEach((y) => y.classList.toggle('on', y === x)); }));
    body.querySelector('[data-new]').onclick = () => { close(); newBinder(null, () => addToBinder(c)); };
    body.querySelectorAll('[data-b]').forEach((it) => (it.onclick = async () => {
      const all = await binders(); const bb = all.find((x) => x.id === it.dataset.b);
      const item = { key: `${c.game}:${c.id}`, ...(entry ? { entry: entry.id } : {}) };
      if (bb.items.some((x) => x.key === item.key && (x.entry || '') === (item.entry || ''))) { toast('Liegt schon in diesem Binder'); return; }
      bb.items.push(item);
      await saveBinders(all);
      close();
      toast(`In „${bb.name}“ gelegt`, { action: 'Ansehen', onAction: () => A.go(`#/binder/${bb.id}`) });
    }));
  });
}
