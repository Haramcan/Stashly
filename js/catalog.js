// Kartendatenbank: lädt data/<spiel>.json und baut Suchindizes.
import { norm } from './util.js';

export const GAMES = {
  dbfw: {
    id: 'dbfw', name: 'Dragon Ball Super Fusion World', short: 'Dragon Ball FW', color: '#ff8a1f',
    variants: ['Standard', 'Foil', 'Promo / Stempel', 'Sonstige'],
  },
  op: {
    id: 'op', name: 'One Piece Card Game', short: 'One Piece', color: '#e8414b',
    variants: ['Standard', 'Foil', 'Promo / Stempel', 'Sonstige'],
  },
  pokemon: {
    id: 'pokemon', name: 'Pokémon TCG', short: 'Pokémon', color: '#ffcb05',
    variants: ['Normal', 'Holo', 'Reverse Holo', '1st Edition', 'Promo / Stempel', 'Sonstige'],
  },
};
export const GAME_IDS = Object.keys(GAMES);
export const OTHER_GAME = { id: 'custom', name: 'Eigene Karten', short: 'Eigene', color: '#a78bfa', variants: ['Standard', 'Foil', 'Sonstige'] };
export const gameInfo = (g) => GAMES[g] || OTHER_GAME;

export const CONDITIONS = [
  ['MT', 'Mint'], ['NM', 'Near Mint'], ['EX', 'Excellent'], ['GD', 'Good'],
  ['LP', 'Light Played'], ['PL', 'Played'], ['PO', 'Poor'],
];
export const LANGS = ['Deutsch', 'Englisch', 'Japanisch', 'Französisch', 'Italienisch', 'Spanisch', 'Portugiesisch', 'Chinesisch', 'Koreanisch'];
export const GRADERS = ['PSA', 'BGS', 'CGC', 'TAG', 'SGC', 'ACE', 'GMA', 'PCA', 'AP', 'Sonstige'];

const cache = {};
const loading = {};
let pkLang = 'de';
export function setPkLang(l) { pkLang = l; }

export function isLoaded(game) { return !!cache[game]; }

export async function load(game) {
  if (cache[game]) return cache[game];
  if (!GAMES[game]) return null;
  if (!loading[game]) {
    loading[game] = fetch(`data/${game}.json`)
      .then((r) => { if (!r.ok) throw new Error(`data/${game}.json: ${r.status}`); return r.json(); })
      .then((d) => { cache[game] = index(game, d); mergeUser(game); return cache[game]; })
      .catch((e) => { delete loading[game]; throw e; });
  }
  return loading[game];
}

export async function loadAll(games = GAME_IDS) {
  return Promise.all(games.map((g) => load(g).catch((e) => { console.error(e); return null; })));
}

/* ---------- Selbst angelegte Karten (neue Sets, die noch nicht in der Datenbank sind) ---------- */
let userCat = { sets: [], cards: [] };
export function setUserCatalog(u) {
  userCat = { sets: [...(u?.sets || [])], cards: [...(u?.cards || [])] };
  for (const g of GAME_IDS) if (cache[g]) mergeUser(g);
}
export function getUserCatalog() { return userCat; }

function mergeUser(game) {
  const d = cache[game];
  if (!d) return;
  const touched = new Set();
  userCat.sets.filter((s) => s.game === game).forEach((s, i) => {
    if (d.setById.has(s.id)) return;
    s.order = s.order ?? -1000 + i;
    s.game = game;
    d.sets.push(s); d.setById.set(s.id, s);
    if (!d.bySet.has(s.id)) d.bySet.set(s.id, []);
    s.cardCount = d.bySet.get(s.id).length;
  });
  for (const c of userCat.cards) {
    if (c.game !== game || d.byId.has(c.id)) continue;
    d.cards.push(c); d.byId.set(c.id, c);
    if (!d.bySet.has(c.set)) d.bySet.set(c.set, []);
    d.bySet.get(c.set).push(c);
    const k = game === 'pokemon' ? normLocal(c.no) : normNo(c.no);
    if (!d.byNo.has(k)) d.byNo.set(k, []);
    d.byNo.get(k).push(c);
    touched.add(c.set);
  }
  for (const sid of touched) { const s = d.setById.get(sid); if (s) s.cardCount = d.bySet.get(sid).length; }
}

/** Set-Code aus einer Kartennummer ableiten: FB12-001 -> FB12, OP18-001 -> OP-18 */
export function setIdFromNo(game, no) {
  const m = /^([A-Z]+)(\d*)-/.exec(normNo(no));
  if (!m) return '';
  if (game === 'op') {
    if (!m[2]) return 'P';
    const guess = `${m[1]}-${m[2]}`;
    const existing = sets('op').find((s) => s.id === guess || s.id.split('-').join('') === m[1] + m[2] || s.id.includes(m[1] + m[2]));
    return existing ? existing.id : guess;
  }
  if (!m[2]) return m[1] === 'FP' || m[1] === 'E' ? 'PROMO' : m[1];
  return m[1] + m[2];
}
export function gameFromNo(no) {
  const p = (/^([A-Z]+)/.exec(normNo(no)) || [])[1] || '';
  if (['FB', 'FS', 'SB', 'FP', 'E'].includes(p)) return 'dbfw';
  if (['OP', 'EB', 'PRB', 'P'].includes(p)) return 'op';
  return '';
}

/** Neue Karte (und ggf. neues Set) aufnehmen. Gibt die Karte zurück. */
export function addUserCard({ game, no, name, rarity = '', parallel = false, img = '', photo = '', setName = '' }) {
  no = normNo(no);
  const setId = setIdFromNo(game, no) || 'NEU';
  if (!getSet(game, setId) && !userCat.sets.some((s) => s.game === game && s.id === setId)) {
    userCat.sets.push({ id: setId, name: setName || 'Neues Set (selbst angelegt)', kind: 'booster', game, user: 1, order: -1000 - userCat.sets.length, count: 0 });
  }
  const exists = lookupNo(game, no).length > 0;
  const id = exists || parallel ? `${no}_u${Date.now().toString(36)}` : no;
  const c = { id, no, p: exists || parallel ? 'u' : '', set: setId, name: name || no, r: rarity, img, photo, user: 1, game };
  if (c.p) c.par = 1;
  userCat.cards.push(c);
  mergeUser(game);
  return c;
}
export function removeUserCard(game, id) {
  userCat.cards = userCat.cards.filter((c) => !(c.game === game && c.id === id));
  const d = cache[game];
  if (d) {
    const c = d.byId.get(id);
    if (c) {
      d.byId.delete(id);
      d.cards.splice(d.cards.indexOf(c), 1);
      const l = d.bySet.get(c.set); if (l) l.splice(l.indexOf(c), 1);
      const k = game === 'pokemon' ? normLocal(c.no) : normNo(c.no);
      const n = d.byNo.get(k); if (n) n.splice(n.indexOf(c), 1);
      const s = d.setById.get(c.set); if (s) s.cardCount = (d.bySet.get(c.set) || []).length;
    }
  }
}

export function normNo(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[‐-―−_]/g, '-');
}
/** Pokémon-Nummer ohne führende Nullen: "007" -> "7", "TG05" -> "TG5" */
export function normLocal(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]*)0+(\d)/, '$1$2');
}

function index(game, d) {
  const sets = d.sets;
  const setById = new Map(sets.map((s) => [s.id, s]));
  const cards = d.cards;
  const byId = new Map();
  const bySet = new Map();
  const byNo = new Map();
  for (const c of cards) {
    c.game = game;
    byId.set(c.id, c);
    if (!bySet.has(c.set)) bySet.set(c.set, []);
    bySet.get(c.set).push(c);
    const k = game === 'pokemon' ? normLocal(c.no) : normNo(c.no);
    if (!byNo.has(k)) byNo.set(k, []);
    byNo.get(k).push(c);
  }
  for (const s of sets) {
    const list = bySet.get(s.id) || [];
    s.cardCount = list.length;
    s.game = game;
  }
  // Pokémon: Sets nach offizieller Kartenanzahl, für die Scan-Zuordnung "25/165"
  const byOfficial = new Map();
  if (game === 'pokemon') {
    for (const s of sets) {
      const k = s.official || s.total;
      if (!byOfficial.has(k)) byOfficial.set(k, []);
      byOfficial.get(k).push(s);
    }
  }
  return { game, sets, setById, cards, byId, bySet, byNo, byOfficial, imgBase: d.imgBase, updated: d.updated };
}

export function getCard(game, id) {
  return cache[game]?.byId.get(id) || null;
}
export function getSet(game, id) {
  return cache[game]?.setById.get(id) || null;
}
export function setCards(game, setId) {
  return cache[game]?.bySet.get(setId) || [];
}
export function sets(game) {
  return cache[game]?.sets || [];
}

export function cardName(c) {
  if (!c) return '';
  if (c.game === 'pokemon' && pkLang === 'de' && c.nameDe) return c.nameDe;
  return c.name;
}
export function setName(s) {
  if (!s) return '';
  if (s.game === 'pokemon' && pkLang === 'de' && s.nameDe) return s.nameDe;
  return prettySetName(s.name);
}
export function prettySetName(n) {
  // "BOOSTER PACK -AWAKENED PULSE-" -> "Booster Pack – Awakened Pulse"
  if (!n) return '';
  let t = n.replace(/\s*-\s*([^-]+?)\s*-\s*$/, ' – $1').replace(/\s+-([^-]+)-\s*/, ' – $1 ');
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8) {
    t = t.toLowerCase().replace(/(^|[\s\-–(/])([a-zäöü])/g, (m, a, b) => a + b.toUpperCase())
      .replace(/\bEx\b/g, 'EX').replace(/\bVol\./g, 'Vol.').replace(/\bOf\b/g, 'of').replace(/\bThe\b(?!^)/g, 'the');
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  // "Booster Pack – Blazing Aura" -> "Blazing Aura" (die Gruppe heißt ohnehin "Booster")
  return t.replace(/^Booster Pack\s*–\s*/i, '').replace(/[’']S\b/g, '’s').trim();
}
export function setCode(s) {
  if (!s) return '';
  if (s.game === 'pokemon') return s.abbr || s.id.toUpperCase();
  return s.id;
}

/** Bild-URL einer Karte. size: 'low' (Raster) oder 'high' (Detail) */
export function cardImg(c, size = 'low') {
  if (!c) return '';
  const d = cache[c.game];
  if (!d) return '';
  if (c.game === 'pokemon') {
    if (!c.img) return '';
    let p = c.img;
    if (pkLang === 'de' && c.de) p = p.replace(/^en\//, 'de/');
    return `${d.imgBase}${p}/${size}.webp`;
  }
  return c.img ? d.imgBase + c.img : '';
}
/** Ersatzbild, falls die bevorzugte Sprache fehlt */
export function cardImgFallback(c, size = 'low') {
  if (c?.game === 'pokemon' && c.img && c.de && pkLang === 'de') return `${cache.pokemon.imgBase}${c.img}/${size}.webp`;
  return '';
}
export function setLogo(s) {
  if (s?.game === 'pokemon' && s.logo) {
    const p = pkLang === 'de' ? s.logo.replace(/^en\//, 'de/') : s.logo;
    return `${cache.pokemon.imgBase}${p}.webp`;
  }
  return '';
}
export function setLogoFallback(s) {
  if (s?.game === 'pokemon' && s.logo) return `${cache.pokemon.imgBase}${s.logo}.webp`;
  return '';
}

/** Anzeige-Nummer einer Karte inkl. Parallel-Kennzeichen */
export function cardNo(c) {
  if (!c) return '';
  if (c.game === 'pokemon') {
    const s = getSet('pokemon', c.set);
    const off = s?.official;
    return off && /^\d+$/.test(c.no) ? `${c.no}/${String(off).padStart(c.no.length, '0')}` : c.no;
  }
  return c.no + (c.p ? ` ${parallelLabel(c.p)}` : '');
}
export function parallelLabel(p) {
  if (!p) return '';
  const m = /^p(\d+)$/.exec(p);
  if (m) return m[1] === '1' ? '(Parallel)' : `(Parallel ${m[1]})`;
  if (p === 'u') return '(eigene Version)';
  const r = /^r(\d+)$/.exec(p);
  if (r) return r[1] === '1' ? '(Reprint)' : `(Reprint ${r[1]})`;
  return `(${p})`;
}

/** Freitextsuche über die geladenen Spiele */
export function search(q, { games = GAME_IDS, limit = 80, setId = null } = {}) {
  const nq = norm(q);
  if (!nq) return [];
  const words = nq.split(' ');
  const qNo = normNo(q);
  const out = [];
  for (const g of games) {
    const d = cache[g];
    if (!d) continue;
    for (const c of d.cards) {
      if (setId && c.set !== setId) continue;
      let score = 0;
      const no = g === 'pokemon' ? c.no : normNo(c.no);
      if (no === qNo || c.id.toUpperCase() === qNo) score = 100;
      else if (qNo.length >= 3 && normNo(c.id).startsWith(qNo)) score = 60;
      else {
        if (!c._n) c._n = norm(`${c.name} ${c.nameDe || ''} ${c.no} ${c.set}`);
        let ok = true;
        for (const w of words) {
          const i = c._n.indexOf(w);
          if (i < 0) { ok = false; break; }
          score += i === 0 || c._n[i - 1] === ' ' ? 12 : 6;
        }
        if (!ok) continue;
        const n1 = norm(c.name), n2 = c.nameDe ? norm(c.nameDe) : '';
        if (n1 === nq || n2 === nq) score += 60;
        else if (n1.startsWith(nq) || n2.startsWith(nq)) score += 25;
        if (c.par) score -= 1;
      }
      out.push({ c, score });
    }
  }
  out.sort((a, b) => b.score - a.score || (a.c.p ? 1 : 0) - (b.c.p ? 1 : 0));
  return out.slice(0, limit).map((x) => x.c);
}

export function lookupNo(game, no) {
  const d = cache[game];
  if (!d) return [];
  return d.byNo.get(game === 'pokemon' ? normLocal(no) : normNo(no)) || [];
}

export function dataInfo() {
  return GAME_IDS.map((g) => ({ game: g, loaded: !!cache[g], sets: cache[g]?.sets.length || 0, cards: cache[g]?.cards.length || 0, updated: cache[g]?.updated }));
}

/** Pokémon-Daten online (TCGdex) nachladen: neue Sets/Karten ergänzen */
export async function updatePokemonOnline(progress = () => {}) {
  const d = await load('pokemon');
  const TD = 'https://api.tcgdex.net/v2/';
  const list = await (await fetch(TD + 'en/sets')).json();
  const missing = list.filter((s) => !d.setById.has(s.id) && !/^A\d|^P-A/.test(s.id));
  let added = 0;
  for (let i = 0; i < missing.length; i++) {
    progress(`${i + 1}/${missing.length}: ${missing[i].name}`);
    try {
      const sd = await (await fetch(TD + 'en/sets/' + encodeURIComponent(missing[i].id))).json();
      if (sd.serie?.id === 'tcgp') continue;
      const s = {
        id: sd.id, name: sd.name, nameDe: '', serie: sd.serie?.name || '', serieId: sd.serie?.id || '',
        date: sd.releaseDate || '', total: sd.cardCount?.total || 0, official: sd.cardCount?.official || 0,
        logo: (sd.logo || '').replace(d.imgBase, ''), symbol: (sd.symbol || '').replace(d.imgBase, ''),
        kind: 'booster', abbr: sd.abbreviation?.official || '', game: 'pokemon', order: d.sets.length,
      };
      d.sets.push(s);
      d.setById.set(s.id, s);
      const arr = [];
      for (const c of sd.cards || []) {
        const card = { id: c.id, no: c.localId, set: s.id, name: c.name, img: (c.image || '').replace(d.imgBase, ''), game: 'pokemon' };
        d.cards.push(card); d.byId.set(card.id, card); arr.push(card);
        const k = normLocal(card.no);
        if (!d.byNo.has(k)) d.byNo.set(k, []);
        d.byNo.get(k).push(card);
        added++;
      }
      d.bySet.set(s.id, arr);
      s.cardCount = arr.length;
      const k = s.official || s.total;
      if (!d.byOfficial.has(k)) d.byOfficial.set(k, []);
      d.byOfficial.get(k).push(s);
    } catch (e) { console.warn(e); }
  }
  return { sets: missing.length, cards: added, extra: { sets: d.sets.filter((s) => missing.some((m) => m.id === s.id)), cards: d.cards.filter((c) => missing.some((m) => m.id === c.set)) } };
}

/** Zusätzliche (online nachgeladene) Pokémon-Sets beim Start wieder einhängen */
export function mergePokemonExtra(extra) {
  const d = cache.pokemon;
  if (!d || !extra) return;
  for (const s of extra.sets || []) {
    if (d.setById.has(s.id)) continue;
    s.game = 'pokemon';
    d.sets.push(s); d.setById.set(s.id, s); d.bySet.set(s.id, []);
    const k = s.official || s.total;
    if (!d.byOfficial.has(k)) d.byOfficial.set(k, []);
    d.byOfficial.get(k).push(s);
  }
  for (const c of extra.cards || []) {
    if (d.byId.has(c.id)) continue;
    c.game = 'pokemon';
    d.cards.push(c); d.byId.set(c.id, c);
    (d.bySet.get(c.set) || d.bySet.set(c.set, []).get(c.set)).push(c);
    const k = normLocal(c.no);
    if (!d.byNo.has(k)) d.byNo.set(k, []);
    d.byNo.get(k).push(c);
  }
  for (const s of extra.sets || []) s.cardCount = (d.bySet.get(s.id) || []).length;
}
