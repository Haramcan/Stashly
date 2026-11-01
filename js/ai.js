// Optionale KI-Erkennung mit Claude (braucht Internet und einen eigenen API-Schlüssel).
// Der Schlüssel bleibt nur auf diesem Gerät gespeichert und wird nie in Sicherungen exportiert.
import { blobToDataURL } from './util.js';
import * as cat from './catalog.js';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['game', 'card_number', 'name', 'set_code', 'language', 'graded', 'grading_company', 'grade', 'cert_number'],
        properties: {
          game: { type: 'string', enum: ['dbfw', 'op', 'pokemon', 'other'] },
          card_number: { type: 'string' },
          name: { type: 'string' },
          set_code: { type: 'string' },
          language: { type: 'string' },
          graded: { type: 'boolean' },
          grading_company: { type: 'string' },
          grade: { type: 'string' },
          cert_number: { type: 'string' },
        },
      },
    },
  },
};

const PROMPT = `Identify every trading card visible in this photo. Games: "dbfw" = Dragon Ball Super Card Game Fusion World, "op" = One Piece Card Game, "pokemon" = Pokémon TCG, otherwise "other".
For each card give:
- card_number exactly as printed. Bandai cards: e.g. "FB01-139", "FS03-05", "OP05-119", "ST10-006", "EB01-012", "P-041". Pokémon: the collector number before the slash, e.g. "151" for "151/165", or "TG05", "SWSH050".
- name as printed (keep the printed language), set_code (e.g. Pokémon set abbreviation like "MEW" or "PAL" if visible, else ""), language of the card text in German (e.g. "Deutsch", "Englisch", "Japanisch").
- graded: true only if the card is inside a grading slab; then grading_company (PSA, BGS, CGC, TAG, SGC, ...), grade (e.g. "10", "9.5") and cert_number from the label, else empty strings.
Use "" when something is not readable. Order the cards left-to-right, top-to-bottom.`;

export async function aiRecognize(blob, s) {
  if (!s.aiKey) throw new Error('Kein API-Schlüssel hinterlegt (Mehr › Einstellungen › KI-Erkennung).');
  if (!navigator.onLine) throw new Error('Für die KI-Erkennung brauchst du Internet.');
  const dataUrl = await blobToDataURL(blob);
  const [head, b64] = dataUrl.split(',');
  const media = /image\/(png|webp|gif)/.exec(head)?.[0] || 'image/jpeg';
  const model = s.aiModel || 'claude-opus-5-5';
  // Ausweich-Modell bei Ablehnung durch Sicherheitsfilter: nur Opus 5.5 und Sonnet 5.5 unterstützen das
  const withFallback = /^claude-(opus|sonnet)-5-5$/.test(model);
  const headers = {
    'content-type': 'application/json',
    'x-api-key': s.aiKey,
    'anthropic-version': '2026-10-21',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (withFallback) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      ...(withFallback ? { fallbacks: 'default' } : {}),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error('API-Schlüssel ungültig. Bitte in den Einstellungen prüfen.');
    if (res.status === 429) throw new Error('Zu viele Anfragen – bitte kurz warten.');
    throw new Error('KI-Fehler: ' + msg);
  }
  if (data.stop_reason === 'refusal') throw new Error('Die KI hat die Anfrage abgelehnt.');
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    parsed = m ? JSON.parse(m[0]) : { cards: [] };
  }
  return (parsed.cards || []).map((x) => ({ ...x, matches: matchAi(x) }));
}

/** KI-Ergebnis mit der Datenbank abgleichen */
function matchAi(x) {
  const games = x.game && cat.GAMES[x.game] ? [x.game] : cat.GAME_IDS;
  const out = [];
  const no = (x.card_number || '').trim();
  for (const g of games) {
    if (!cat.isLoaded(g) || !no) continue;
    let list = cat.lookupNo(g, g === 'pokemon' ? no.split('/')[0] : no);
    if (g === 'pokemon' && list.length > 1) {
      const right = parseInt((no.split('/')[1] || '').replace(/\D/g, ''), 10);
      const abbr = (x.set_code || '').toUpperCase();
      const scored = list.map((c) => {
        const s = cat.getSet('pokemon', c.set);
        let sc = 0;
        if (abbr && s?.abbr?.toUpperCase() === abbr) sc += 3;
        if (right && s?.official === right) sc += 2;
        const nm = (x.name || '').toLowerCase();
        if (nm && (c.name.toLowerCase() === nm || (c.nameDe || '').toLowerCase() === nm)) sc += 2;
        return { c, sc };
      }).sort((a, b) => b.sc - a.sc);
      list = scored.filter((s) => s.sc >= scored[0].sc - 1).map((s) => s.c);
    }
    out.push(...list);
  }
  if (!out.length && x.name) out.push(...cat.search(x.name, { games, limit: 12 }));
  return out.slice(0, 12);
}
