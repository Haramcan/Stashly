// Kartenerkennung offline: Texterkennung (Tesseract) + Abgleich mit der Kartendatenbank.
import * as cat from './catalog.js';
import { norm, sim } from './util.js';

let workerP = null;
let progressCb = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Texterkennung konnte nicht geladen werden.'));
    document.head.appendChild(s);
  });
}

export function getWorker(onProgress) {
  progressCb = onProgress || null;
  if (!workerP) {
    workerP = (async () => {
      await loadScript('lib/tesseract/tesseract.min.js');
      const base = new URL('lib/tesseract/', location.href).href;
      const w = await window.Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        // eingebettet (fremder Rahmen) darf ein Worker nur über eine blob:-Adresse starten
        workerBlobURL: (() => { try { return window.self !== window.top; } catch { return true; } })(),
        logger: (m) => progressCb?.(m),
      });
      await w.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
      return w;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

/* ---------- Bildaufbereitung ---------- */
/**
 * Schneidet ein Foto auf die Karte zu: alles, was der Randfarbe (Tisch, Hintergrund) ähnelt, fällt weg.
 * Gibt das Original zurück, wenn keine plausible Karte gefunden wird.
 */
export function autoCrop(src) {
  const W = 160, H = Math.max(1, Math.round((src.height / src.width) * W));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const px = (i, j) => { const k = (j * W + i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
  const border = [];
  for (let i = 0; i < W; i++) { border.push(px(i, 0), px(i, H - 1)); }
  for (let j = 0; j < H; j++) { border.push(px(0, j), px(W - 1, j)); }
  const med = [0, 1, 2].map((ch) => border.map((p) => p[ch]).sort((a, b) => a - b)[border.length >> 1]);
  const diff = (p) => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]);
  const rows = new Array(H).fill(0), cols = new Array(W).fill(0);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (diff(px(i, j)) > 60) { rows[j]++; cols[i]++; }
  const first = (arr, n, th) => arr.findIndex((v) => v > th * n);
  const last = (arr, n, th) => arr.length - 1 - [...arr].reverse().findIndex((v) => v > th * n);
  const top = first(rows, W, 0.35), bottom = last(rows, W, 0.35), left = first(cols, H, 0.35), right = last(cols, H, 0.35);
  if (top < 0 || left < 0 || bottom <= top || right <= left) return src;
  const bw = right - left + 1, bh = bottom - top + 1;
  if (bw * bh < 0.2 * W * H) return src;
  const ratio = bw / bh;
  if (ratio < 0.5 || ratio > 0.95) return src; // keine Hochkant-Karte erkannt
  if (bw > 0.97 * W && bh > 0.97 * H) return src; // schon formatfüllend
  const s = src.width / W, pad = 0.015;
  const sx = Math.max(0, (left - bw * pad) * s), sy = Math.max(0, (top - bh * pad) * s);
  const sw = Math.min(src.width - sx, bw * (1 + 2 * pad) * s), sh = Math.min(src.height - sy, bh * (1 + 2 * pad) * s);
  const out = document.createElement('canvas');
  out.width = Math.round(sw); out.height = Math.round(sh);
  out.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

function region(src, x, y, w, h, targetW, { gray = true, contrast = true } = {}) {
  const sw = src.width, sh = src.height;
  const rx = Math.max(0, Math.round(x * sw)), ry = Math.max(0, Math.round(y * sh));
  const rw = Math.min(sw - rx, Math.round(w * sw)), rh = Math.min(sh - ry, Math.round(h * sh));
  const scale = targetW / rw;
  const c = document.createElement('canvas');
  c.width = Math.round(rw * scale);
  c.height = Math.round(rh * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, rx, ry, rw, rh, 0, 0, c.width, c.height);
  if (gray) {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
      let v = d[i];
      if (contrast) v = ((v - min) / span) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

let curPsm = '11';
async function ocr(canvas, psm = '11') {
  const w = await getWorker(progressCb);
  if (psm !== curPsm) { await w.setParameters({ tessedit_pageseg_mode: psm }); curPsm = psm; }
  const { data } = await w.recognize(canvas);
  return data.text || '';
}

/* ---------- Codes im Text finden ---------- */
const DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', T: '7', S: '5', Z: '2', B: '8', G: '6' };
const LETTER = { 0: 'O', 8: 'B', 5: 'S', 1: 'I', 6: 'G', 2: 'Z' };
const toDigits = (s) => s.split('').map((ch) => DIGIT[ch] ?? ch).join('');
const toLetters = (s) => s.split('').map((ch) => LETTER[ch] ?? ch).join('');
const CONFUSE = { 0: '869', 1: '74', 2: '7', 3: '89', 4: '1', 5: '68', 6: '580', 7: '12', 8: '93605', 9: '830' };
const PREFIXES = ['FB', 'FS', 'SB', 'ST', 'FP', 'E', 'OP', 'EB', 'PRB', 'P'];

export function findBandaiCodes(text) {
  let T = ' ' + text.toUpperCase().replace(/[—–~_=]/g, '-') + ' ';
  // Leerzeichen innerhalb von Nummern entfernen ("OPO 1-120" -> "OPO1-120", "FB01 - 139" -> "FB01-139")
  T = T.replace(/([A-Z0-9])\s(?=[A-Z0-9]{0,3}\s?-)/g, '$1').replace(/\s?-\s?(?=[0-9OQDILSZBTG|])/g, '-');
  const out = new Set();
  // z. B. FB01-001, OP01-001, ST01-001, FS01-01, PRB01-001, EB01-001 (dahinter klebt oft die Seltenheit)
  const re = /([A-Z0-9]{1,3})([0-9OQDILSZBTG|]{2})[-.]([0-9OQDILSZBTG|]{2,3})/g;
  let m;
  while ((m = re.exec(T))) {
    re.lastIndex = m.index + 1;
    const pre = toLetters(m[1]);
    if (!PREFIXES.includes(pre)) continue;
    const d = toDigits(m[3]);
    out.add(`${pre}${toDigits(m[2])}-${d}`);
    if (d.length === 3) out.add(`${pre}${toDigits(m[2])}-${d.slice(0, 2)}`);
  }
  // Promos ohne Setnummer: P-001, FP-001, E-02, E-001
  const re2 = /(?:^|[^A-Z0-9])([A-Z0-9]{1,2})-([0-9OQDILSZBTG|]{2,3})/g;
  while ((m = re2.exec(T))) {
    re2.lastIndex = m.index + 1;
    const pre = toLetters(m[1]);
    if (!['P', 'FP', 'E'].includes(pre)) continue;
    const d = toDigits(m[2]);
    out.add(`${pre}-${d}`);
    if (d.length === 3) out.add(`${pre}-${d.slice(0, 2)}`);
  }
  return [...out];
}

export function findPokemonNumbers(text) {
  const T = text.toUpperCase();
  const out = [];
  const re = /([A-Z]{0,3})([0-9OQDILSZB]{1,3})\s?\/\s?([A-Z]{0,3})([0-9OQDILSZB]{2,3})/g;
  let m;
  while ((m = re.exec(T))) {
    re.lastIndex = m.index + 1;
    if (m.index > 0 && /[0-9A-Z]/.test(T[m.index - 1])) continue; // nicht mitten in einer Zahl beginnen
    const right = parseInt(toDigits(m[4]), 10);
    if (isNaN(right)) continue;
    const digits = toDigits(m[2]);
    if (!/^\d+$/.test(digits)) continue;
    out.push({ left: digits, right, rightPre: m[3] || '' });
    if (m[1]) out.push({ left: m[1] + digits, right, rightPre: m[3] || '' });
  }
  // Schrägstrich nicht erkannt ("4102" statt "4/102") – nur schwacher Hinweis, wird über den Namen bestätigt
  const re3 = /(?:^|[^0-9\/])([0-9OQDILSZB]{3,6})(?![0-9\/])/g;
  while ((m = re3.exec(T))) {
    const d = toDigits(m[1]);
    if (!/^\d+$/.test(d)) continue;
    for (let i = 1; i <= 3 && i < d.length - 1; i++) {
      const right = d.slice(i);
      if (right.length < 2 || right.length > 3 || right[0] === '0') continue;
      out.push({ left: d.slice(0, i), right: parseInt(right, 10), weak: true });
    }
  }
  // Promos wie "SWSH050", "SVP 045", "SM60", "XY120"
  const re2 = /\b(SWSH|SVP|SV|SM|XY|BW|HGSS|DP|NP)\s?([0-9OQDILSZB]{2,3})\b/g;
  while ((m = re2.exec(T))) out.push({ left: m[1] + toDigits(m[2]), right: null, promo: true });
  return out;
}

export function findGrading(text) {
  const T = text.toUpperCase();
  const comp = /\bPSA\b/.test(T) ? 'PSA' : /\b(BGS|BECKETT)\b/.test(T) ? 'BGS' : /\bCGC\b/.test(T) ? 'CGC'
    : /\bTAG\b/.test(T) ? 'TAG' : /\bSGC\b/.test(T) ? 'SGC' : /\bPCA\b/.test(T) ? 'PCA' : /\bGMA\b/.test(T) ? 'GMA' : '';
  if (!comp) return null;
  const g = /(GEM\s*MT|GEM\s*MINT|PRISTINE|MINT\+?|NM-MT\+?|NM\+?|EX-MT|PERFECT|BLACK\s*LABEL)?\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1\.5|1)(?![0-9.])/.exec(T);
  const cert = /\b(\d{7,10})\b/.exec(T);
  return { company: comp, grade: g ? g[2] : '', cert: cert ? cert[1] : '' };
}

/* ---------- Namensabgleich ---------- */
function words(text) {
  return norm(text).split(' ').filter((w) => (w.length >= 3 || /^(ex|gx|v)$/.test(w)) && !/^\d+$/.test(w));
}
const SUFFIX = new Set(['ex', 'gx', 'v', 'vmax', 'vstar', 'lv', 'x', 'break', 'prime', 'star', 'δ']);
const STOP = new Set(['the', 'and', 'your', 'you', 'this', 'card', 'cards', 'turn', 'play', 'when', 'from', 'with', 'opponent', 'choose', 'battle', 'leader', 'power', 'cost', 'attack', 'damage', 'pokemon', 'trainer', 'energy', 'basic', 'stage', 'weakness', 'resistance', 'retreat', 'illus', 'during', 'that', 'has', 'can', 'for', 'its', 'are', 'der', 'die', 'das', 'und', 'ein', 'eine', 'dein', 'deine', 'karte', 'karten', 'schaden', 'angriff', 'schwache', 'resistenz', 'ruckzug', 'character', 'event', 'stage', 'don', 'counter', 'trigger', 'blocker', 'main', 'end', 'extra', 'effect', 'skill', 'skills', 'auto', 'activate', 'once', 'per', 'draw', 'hand', 'deck', 'life', 'area', 'up', 'to', 'of', 'or', 'if', 'a', 'an', 'in', 'on', 'is', 'it', 'be']);

function nameScore(card, tokens) {
  if (!tokens.length) return 0;
  const names = [card.name, card.nameDe].filter(Boolean);
  let best = 0;
  for (const n of names) {
    const nt = norm(n).split(' ').filter((w) => w.length >= 2);
    if (!nt.length) continue;
    let s = 0, wsum = 0;
    for (const w of nt) {
      const weight = SUFFIX.has(w) ? 0.35 : w.length <= 2 || STOP.has(w) ? 0.15 : 1;
      let b = 0;
      for (const t of tokens) {
        if (t.length < 3 && t !== w) continue;
        const v = sim(w, t);
        if (v > b) b = v;
        if (b === 1) break;
      }
      s += b * weight;
      wsum += weight;
    }
    best = Math.max(best, s / wsum);
  }
  return best;
}

// Regelboxen ("Pokémon ex rule") verraten die Kartenart
const RULES = [
  [/pok[eé]mon\s*\S{0,2}\s*[e€@]?x\s*(rule|regel)/i, 'ex'],
  [/vstar\s*(rule|regel)/i, 'VSTAR'],
  [/vmax\s*(rule|regel)/i, 'VMAX'],
  [/\bv\s*(rule|regel)/i, 'V'],
  [/gx\s*(rule|regel)/i, 'GX'],
];

let nameIdx = null;
let nameIdxKey = '';
function buildNameIndex(games) {
  const idx = new Map();
  for (const g of games) {
    if (!cat.isLoaded(g)) continue;
    for (const s of cat.sets(g)) {
      for (const c of cat.setCards(g, s.id)) {
        const ws = new Set([...norm(c.name).split(' '), ...norm(c.nameDe || '').split(' ')]);
        for (const w of ws) {
          if (w.length < 4 || STOP.has(w)) continue;
          if (!idx.has(w)) idx.set(w, []);
          idx.get(w).push(c);
        }
      }
    }
  }
  return idx;
}

/* ---------- Hauptfunktion ---------- */
/**
 * canvas: Kartenausschnitt (Hochformat). full: optional ganzes Kamerabild (für Grading-Etiketten).
 * Liefert { candidates: [{card, score, why}], text, grading }
 */
export async function recognize(canvas, { games = cat.GAME_IDS, full = null, onStep = () => {} } = {}) {
  await Promise.all(games.map((g) => cat.load(g).catch(() => null)));
  const texts = [];

  onStep('Lese Kartennummer …');
  texts.push(await ocr(region(canvas, 0, 0.8, 1, 0.2, 1500, { gray: false })));
  let res = match(texts.join('\n'), games, texts[0]);
  const hasCode = () => res.candidates.some((x) => x.score >= 70);
  // Kartennummern sind winzig: Ecken vergrößert lesen (rechts: Bandai/alte Pokémon, links: neue Pokémon)
  const extra = [
    [[0.55, 0.82, 0.45, 0.17, 1000, { gray: false }], '6'],
    [[0.55, 0.82, 0.45, 0.17, 700, {}], '11'],
    [[0, 0.84, 0.5, 0.15, 1100, { gray: false }], '11'],
    [[0.6, 0.88, 0.4, 0.12, 1100, { gray: false }], '6'],
    [[0, 0.8, 1, 0.2, 1700, {}], '6'],
  ];
  for (const [r, psm] of extra) {
    if (hasCode()) break;
    onStep('Lese Kartennummer (Detail) …');
    texts.push(await ocr(region(canvas, ...r), psm));
    res = match(texts.join('\n'), games, texts[0]);
  }
  const confident = () => res.candidates.length && res.candidates[0].score >= 90 &&
    (res.candidates.length === 1 || res.candidates[0].score - res.candidates[1].score >= 15);
  onStep('Lese Kartenname …');
  texts.push(await ocr(region(canvas, 0, 0, 1, 0.2, 1400)));
  res = match(texts.join('\n'), games, texts[0]);
  if (!confident()) {
    onStep('Lese ganze Karte …');
    texts.push(await ocr(region(full || canvas, 0, 0, 1, 1, 1300, { contrast: false })));
    res = match(texts.join('\n'), games, texts[0]);
  }
  if (full && !res.grading) {
    // Grading-Etikett liegt oft außerhalb des Rahmens
    const g = findGrading(texts.join('\n'));
    if (g) res.grading = g;
  }
  res.text = texts.join('\n---\n').trim();
  return res;
}

export function match(text, games = cat.GAME_IDS, primary = '') {
  const tokens = words(text).filter((w) => !STOP.has(w));
  const ptokens = primary ? words(primary).filter((w) => !STOP.has(w)) : [];
  const found = new Map(); // id -> {card, score, why}
  const add = (card, score, why) => {
    const k = card.game + ':' + card.id;
    const cur = found.get(k);
    if (!cur || cur.score < score) found.set(k, { card, score, why });
  };

  // Bandai-Spiele (Dragon Ball, One Piece)
  for (const code of findBandaiCodes(text)) {
    for (const g of games.filter((x) => x !== 'pokemon')) {
      const list = cat.lookupNo(g, code);
      for (const c of list) {
        const ns = nameScore(c, tokens);
        add(c, 80 + ns * 20 - (c.p ? 2 : 0), `Nummer ${code}`);
      }
      // Eine Ziffer falsch gelesen (8/9/3 …)? Nachbarn nur zählen, wenn der Name klar passt
      const m = /^(.*-)(\d+)$/.exec(code);
      if (!m) continue;
      for (let i = 0; i < m[2].length; i++) {
        for (const alt of CONFUSE[m[2][i]] || []) {
          const code2 = m[1] + m[2].slice(0, i) + alt + m[2].slice(i + 1);
          for (const c of cat.lookupNo(g, code2)) {
            const ns = nameScore(c, tokens);
            add(c, ns >= 0.85 ? 62 + ns * 34 - (c.p ? 2 : 0) : 30 + ns * 10, `Nummer ${code2}?`);
          }
        }
      }
    }
  }

  // Pokémon
  if (games.includes('pokemon') && cat.isLoaded('pokemon')) {
    const T = ' ' + text.toUpperCase().replace(/[^A-Z0-9]+/g, ' ') + ' ';
    for (const n of findPokemonNumbers(text)) {
      const list = cat.lookupNo('pokemon', n.left);
      for (const c of list) {
        const s = cat.getSet('pokemon', c.set);
        let score = 35;
        if (n.right != null && s) {
          if (s.official === n.right) score += 35;
          else if (s.total === n.right) score += 25;
          else if (n.rightPre) score += 10;
          else continue;
        }
        if (n.promo) score += 15;
        if (n.weak) {
          if (nameScore(c, tokens) < 0.8) continue;
          score -= 12;
        }
        if (s?.abbr && T.includes(' ' + s.abbr.toUpperCase() + ' ')) score += 12;
        for (const [re, suf] of RULES) if (re.test(text) && new RegExp(`\\b${suf}$`, 'i').test(c.name)) score += 10;
        if (s?.date) score += Math.max(0, Math.min(4, (parseInt(s.date, 10) - 2004) / 5));
        const ns = nameScore(c, tokens);
        score += ns * 30;
        add(c, Math.min(score, 130), `Nummer ${n.left}${n.right ? '/' + n.right : ''}${n.weak ? ' (unsicher)' : ''}`);
      }
    }
  }

  // Ohne Nummer: über den Namen suchen
  if (found.size < 3 && tokens.length) {
    const key = cat.GAME_IDS.filter(cat.isLoaded).join() + ':' + cat.getUserCatalog().cards.length;
    if (!nameIdx || nameIdxKey !== key) { nameIdx = buildNameIndex(cat.GAME_IDS); nameIdxKey = key; }
    const hits = new Map();
    for (const t of tokens) {
      if (t.length < 4 || STOP.has(t)) continue;
      const list = nameIdx.get(t);
      if (!list || list.length > 400) continue;
      for (const c of list) {
        if (!games.includes(c.game)) continue;
        hits.set(c, (hits.get(c) || 0) + 1);
      }
    }
    const ranked = [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200);
    // Ziffernfolgen im Text: Teilnummern bestätigen den Namen (z. B. "120613" enthält "120" von OP01-120)
    // nur Folgen mit echten Ziffern – sonst würden Wörter wie "SOLID" zu "50110"
    const seqs = (text.toUpperCase().match(/[0-9OQDILSZB]{1,8}/g) || [])
      .filter((x) => (x.match(/\d/g) || []).length >= Math.max(1, x.length - 1))
      .map(toDigits).filter((x) => /^\d+$/.test(x));
    for (const [c] of ranked) {
      const ns = nameScore(c, tokens);
      if (ns < 0.75) continue;
      let bonus = 0, why = 'Name';
      if (c.game === 'pokemon') {
        const s = cat.getSet('pokemon', c.set);
        const n = String(parseInt(c.no, 10));
        if (n !== 'NaN' && s?.official && seqs.some((q) => q === n + s.official || q === c.no + s.official)) { bonus = 30; why = 'Name + Nummer'; }
        else if (c.no.length >= 2 && seqs.includes(c.no)) { bonus = 3; why = 'Name'; }
      } else {
        const suf = c.no.split('-').pop();
        const pre = c.no.split('-')[0].replace(/\D/g, '');
        if (pre && seqs.some((q) => q.includes(pre + suf))) { bonus = 28; why = 'Name + Nummer'; }
        else if (suf.length === 3 && seqs.some((q) => q === suf || (q.startsWith(suf) && q.length <= 6))) { bonus = 18; why = 'Name + Nummer'; }
        else if (suf.length === 2 && seqs.some((q) => q === suf)) { bonus = 8; why = 'Name + Nummer?'; }
      }
      // Name steht im Namensfeld (unterer Streifen) und nicht nur irgendwo im Effekttext
      const nameTokens = norm(c.name).split(' ').filter((w) => w.length > 2 && !STOP.has(w)).length;
      if (ns >= 0.85) bonus += Math.min(12, (nameTokens - 1) * 5);
      if (ptokens.length && nameScore(c, ptokens) >= 0.85) bonus += 8 + Math.min(6, nameTokens * 2);
      add(c, ns * 55 + bonus - (c.p ? 1 : 0), why);
    }
  }

  const candidates = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 24);
  // Nummern, die wie echte Kartennummern aussehen, aber (noch) nicht in der Datenbank sind -> neue Karte/neues Set
  const unknown = [];
  if (!candidates.some((x) => x.score >= 90)) {
    for (const code of findBandaiCodes(text)) {
      const g = cat.gameFromNo(code);
      if (!g || !games.includes(g)) continue;
      if (!/-(\d{3})$/.test(code) && !/^FS\d{2}-\d{2}$/.test(code)) continue;
      if (cat.lookupNo(g, code).length) continue;
      if (!unknown.some((u) => u.no === code)) unknown.push({ game: g, no: code });
    }
  }
  return { candidates, grading: findGrading(text), unknown };
}

export function invalidateNameIndex() { nameIdx = null; }

/** Mögliche Kartennamen aus dem erkannten Text (für das Anlegen neuer Karten) */
export function nameHints(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.replace(/[^A-Za-zÄÖÜäöüß .:'-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > 28) continue;
    if (!/^[A-ZÄÖÜ]/.test(t) || !/[a-zäöü]/.test(t)) continue;
    if (STOP.has(t.toLowerCase())) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}
