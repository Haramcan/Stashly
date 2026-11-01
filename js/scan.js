// Scanner: Kamera, Foto auswerten, Treffer anzeigen.
import { esc, sheet, toast, icon, pickFile, loadBitmap, compressImage } from './util.js';
import * as cat from './catalog.js';
import { recognize, getWorker, findGrading, nameHints, autoCrop } from './recognize.js';
import { aiRecognize } from './ai.js';

let active = null;

/**
 * ctx: { settings, setSetting, quickAdd(card, extra), openAdd(card, prefill), openCard(card), tileHTML(card), ownedQty(card) }
 */
export async function openScanner(ctx) {
  if (active) return;
  const s = ctx.settings;
  const root = document.createElement('div');
  root.className = 'scanner';
  const shownGames = ctx.games || cat.GAME_IDS;
  const labels = { dbfw: 'Dragon Ball', op: 'One Piece', pokemon: 'Pokémon' };
  if (s.scanGame !== 'auto' && !shownGames.includes(s.scanGame)) s.scanGame = 'auto';
  const gameChips = shownGames.length > 1 ? [['auto', 'Alle'], ...shownGames.map((g) => [g, labels[g]])] : [];
  root.innerHTML = `
    <video playsinline muted autoplay></video>
    <canvas class="still" hidden></canvas>
    <div class="s-top">
      <button class="icon-btn" data-close aria-label="Schließen">${icon.close}</button>
      <div class="chips" style="flex:1">${gameChips.map(([k, l]) => `<button class="chip ${s.scanGame === k ? 'on' : ''}" data-game="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="frame"><div class="line"></div></div>
    <div class="hint">Karte in den Rahmen halten und auslösen</div>
    <div class="s-bottom">
      <button class="round" data-gallery aria-label="Foto aus Galerie">${icon.image}</button>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <button class="shutter" data-shoot aria-label="Auslösen"></button>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <button class="round" data-batch aria-label="Serien-Scan" title="Serien-Scan" style="${s.scanBatch ? 'background:#3ecf8e;color:#04150d' : ''}">${icon.box}</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('fullscreen');
  const video = root.querySelector('video');
  const still = root.querySelector('.still');
  const frame = root.querySelector('.frame');
  const hint = root.querySelector('.hint');
  let stream = null;
  let busy = false;
  let sessionCount = 0;
  const state = { root, close };
  active = state;

  const setHint = (t) => { hint.textContent = t; };

  async function startCam() {
    still.hidden = true;
    video.hidden = false;
    if (stream) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // hohe Auflösung: die Kartennummer ist winzig
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.torch) addTorch(track);
      if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      setHint(s.scanBatch ? 'Serien-Scan: Karte für Karte auslösen' : 'Karte in den Rahmen halten und auslösen');
    } catch (e) {
      console.warn(e);
      setHint('Kamera nicht verfügbar. Tippe auf den Auslöser, um ein Foto aufzunehmen, oder wähle ein Bild.');
      stream = null;
    }
  }
  function addTorch(track) {
    if (root.querySelector('[data-torch]')) return;
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.dataset.torch = '1';
    b.innerHTML = icon.flash;
    let on = false;
    b.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); b.style.color = on ? '#ffcb05' : ''; };
    root.querySelector('.s-top').appendChild(b);
  }
  function stopCam() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  function close() {
    stopCam();
    root.remove();
    document.body.classList.remove('fullscreen');
    active = null;
    if (sessionCount) toast(`${sessionCount} Karte${sessionCount === 1 ? '' : 'n'} erfasst`);
    ctx.onClose?.();
  }

  root.querySelector('[data-close]').onclick = close;
  root.querySelectorAll('[data-game]').forEach((b) => {
    b.onclick = async () => {
      root.querySelectorAll('[data-game]').forEach((x) => x.classList.toggle('on', x === b));
      await ctx.setSetting('scanGame', b.dataset.game);
    };
  });
  root.querySelector('[data-batch]').onclick = async (e) => {
    const on = !s.scanBatch;
    await ctx.setSetting('scanBatch', on);
    e.currentTarget.style.cssText = on ? 'background:#3ecf8e;color:#04150d' : '';
    toast(on ? 'Serien-Scan an: „+1“ legt die Karte direkt ab und scannt weiter' : 'Serien-Scan aus');
  };
  root.querySelector('[data-gallery]').onclick = async () => {
    const f = await pickFile('image/*');
    if (f) handleImage(await loadBitmap(f), f, false);
  };
  root.querySelector('[data-shoot]').onclick = async () => {
    if (busy) return;
    if (!stream) {
      const f = await pickFile('image/*', { capture: 'environment' });
      if (f) handleImage(await loadBitmap(f), f, false);
      return;
    }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    const full = document.createElement('canvas');
    full.width = vw; full.height = vh;
    full.getContext('2d').drawImage(video, 0, 0, vw, vh);
    // Rahmen auf Videokoordinaten umrechnen (object-fit: cover)
    const er = video.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const scale = Math.max(er.width / vw, er.height / vh);
    const ox = (er.width - vw * scale) / 2, oy = (er.height - vh * scale) / 2;
    const mx = fr.width * 0.04, my = fr.height * 0.03;
    let x = (fr.left - er.left - ox - mx) / scale, y = (fr.top - er.top - oy - my) / scale;
    let w = (fr.width + 2 * mx) / scale, h = (fr.height + 2 * my) / scale;
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
    const crop = document.createElement('canvas');
    crop.width = Math.round(w); crop.height = Math.round(h);
    crop.getContext('2d').drawImage(full, x, y, w, h, 0, 0, crop.width, crop.height);
    // Standbild zeigen
    still.width = er.width * devicePixelRatio; still.height = er.height * devicePixelRatio;
    const sc = still.getContext('2d');
    sc.drawImage(video, -ox / scale, -oy / scale, er.width / scale, er.height / scale, 0, 0, still.width, still.height);
    still.hidden = false;
    navigator.vibrate?.(15);
    handleImage(crop, null, true, full);
  };

  async function handleImage(src, file, fromCam, full = null) {
    busy = true;
    frame.classList.add('busy');
    let canvas = src;
    if (!(src instanceof HTMLCanvasElement)) {
      canvas = document.createElement('canvas');
      canvas.width = src.width; canvas.height = src.height;
      canvas.getContext('2d').drawImage(src, 0, 0);
    }
    if (!fromCam) {
      // Foto aus der Galerie: auf die Karte zuschneiden, das ganze Bild bleibt für Grading-Etiketten
      full = canvas;
      canvas = autoCrop(canvas);
      still.hidden = false;
      still.width = canvas.width; still.height = canvas.height;
      still.getContext('2d').drawImage(canvas, 0, 0);
      still.style.objectFit = 'contain';
    } else still.style.objectFit = '';
    const photoBlob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    const games = s.scanGame === 'auto' ? shownGames : [s.scanGame];
    let result = null;
    try {
      if (s.aiAuto && s.aiKey && navigator.onLine) {
        setHint('KI erkennt die Karte …');
        const ai = await aiRecognize(await compressImage(full ? await canvasBlob(full) : photoBlob, 1600, 0.85), s);
        busy = false; frame.classList.remove('busy');
        return showAi(ai, photoBlob);
      }
      setHint('Texterkennung wird geladen …');
      result = await recognize(canvas, {
        games, full,
        onStep: (t) => setHint(t),
      });
    } catch (e) {
      console.error(e);
      toast(e.message || 'Erkennung fehlgeschlagen');
      result = { candidates: [], text: '', grading: null, error: e.message };
    }
    busy = false;
    frame.classList.remove('busy');
    result.hints = nameHints(result.text);
    showResult(result, photoBlob, full);
  }

  const canvasBlob = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));

  function resume() {
    startCam();
    setHint(s.scanBatch ? `Serien-Scan: ${sessionCount} erfasst – nächste Karte` : 'Karte in den Rahmen halten und auslösen');
  }

  function showResult(result, photoBlob, full) {
    const cands = result.candidates || [];
    let chosen = cands[0]?.card || null;
    let acted = false;
    const grading = result.grading;
    const unknown = result.unknown || [];
    sheet(unknown.length && !(cands[0]?.score >= 90) ? 'Neue Karte?' : cands.length ? 'Karte erkannt' : 'Nicht sicher erkannt', (body, closeSheet) => {
      const render = () => {
        const best = cands.find((x) => x.card === chosen);
        const conf = !best ? '' : best.score >= 90 ? '<span class="conf hi">sicher</span>' : best.score >= 60 ? '<span class="conf mid">wahrscheinlich</span>' : '<span class="conf lo">unsicher</span>';
        const set = chosen ? cat.getSet(chosen.game, chosen.set) : null;
        body.innerHTML = `
          ${unknown.length ? `<div class="notice" style="margin-bottom:14px"><b>Neue Karte entdeckt: ${esc(unknown[0].no)}</b><br>
            Diese Nummer ist noch nicht in der Datenbank – vermutlich ein neues Set. Leg sie einfach an, dann ist sie ab sofort dabei.
            <button class="btn primary block" data-newcard style="margin-top:10px">${icon.plus} ${esc(unknown[0].no)} neu anlegen</button></div>` : ''}
          ${chosen ? `<div class="match-best">
            <div class="pic">${cat.cardImg(chosen, 'high') ? `<img referrerpolicy="no-referrer" src="${esc(cat.cardImg(chosen, 'high'))}" data-fb="${esc(cat.cardImgFallback(chosen, 'high'))}" alt="">` : chosen.photo ? `<img data-photo="${esc(chosen.photo)}" alt="">` : ''}</div>
            <div class="stack">
              <div><span class="badge game-${chosen.game}">${esc(cat.GAMES[chosen.game].short)}</span> ${conf}</div>
              <div style="font-size:18px;font-weight:800;line-height:1.2">${esc(cat.cardName(chosen))}</div>
              <div class="muted small">${esc(cat.cardNo(chosen))}${chosen.r ? ' · ' + esc(chosen.r) : ''}<br>${esc(cat.setCode(set))} – ${esc(cat.setName(set))}</div>
              ${ctx.ownedQty(chosen) ? `<div class="small" style="color:var(--ok);font-weight:700">Schon ${ctx.ownedQty(chosen)}× in deiner Sammlung</div>` : ''}
              ${grading ? `<div class="badge grade">${esc(grading.company)} ${esc(grading.grade)}</div>` : ''}
            </div></div>
            <div class="two" style="margin-top:14px">
              <button class="btn" data-detail>${icon.edit} Details…</button>
              <button class="btn primary" data-quick>${icon.plus} +1 hinzufügen</button>
            </div>` : `<div class="notice warn">Keine passende Karte gefunden. Tipp: Karte gerade und formatfüllend in den Rahmen, ohne Spiegelung. Oder unten nach Name/Nummer suchen.</div>`}
          ${cands.length > 1 ? `<h2>Andere Möglichkeiten</h2><div class="grid small">${cands.slice(0, 18).map((x, i) => ctx.tileHTML(x.card, { idx: i, selected: x.card === chosen })).join('')}</div>` : ''}
          <h2>Suchen</h2>
          <div class="search">${icon.search}<input type="search" placeholder="Name oder Nummer, z. B. FB01-139 oder Glurak" data-q></div>
          <div class="grid small" data-sres style="margin-top:10px"></div>
          <div class="row wrap" style="margin-top:16px">
            ${s.aiKey ? `<button class="btn" data-ai>${icon.spark} Mit KI erkennen</button>` : ''}
            <button class="btn" data-again>${icon.camera} Nochmal</button>
            <button class="btn ghost" data-custom>Karte fehlt? Neu anlegen</button>
          </div>
          ${result.text ? `<details style="margin-top:14px"><summary class="muted small">Erkannter Text</summary><div class="ocr-text">${esc(result.text)}</div></details>` : ''}`;
        ctx.hydrate?.(body);
        body.querySelectorAll('.grid.small:not([data-sres]) .tcg').forEach((el) => {
          el.onclick = () => { chosen = cands[+el.dataset.idx].card; render(); };
        });
        const q = body.querySelector('[data-q]');
        const sres = body.querySelector('[data-sres]');
        let found = [];
        q.oninput = () => {
          found = cat.search(q.value, { games: s.scanGame === 'auto' ? shownGames : [s.scanGame], limit: 30 });
          sres.innerHTML = found.map((c, i) => ctx.tileHTML(c, { idx: i })).join('');
          ctx.hydrate?.(sres);
          sres.querySelectorAll('.tcg').forEach((el) => {
            el.onclick = () => {
              const c = found[+el.dataset.idx];
              if (!cands.some((x) => x.card === c)) cands.unshift({ card: c, score: 100, why: 'Suche' });
              chosen = c; render();
              body.parentElement.scrollTop = 0;
            };
          });
        };
        body.querySelector('[data-quick]')?.addEventListener('click', async () => {
          acted = true;
          await ctx.quickAdd(chosen, { grading, photoBlob: grading ? photoBlob : null });
          sessionCount++;
          closeSheet();
        });
        body.querySelector('[data-detail]')?.addEventListener('click', () => {
          acted = true;
          closeSheet();
          ctx.openAdd(chosen, { grading, photoBlob, onSaved: () => { sessionCount++; } });
        });
        body.querySelector('[data-again]').onclick = () => closeSheet();
        const openNew = (no) => { acted = true; closeSheet(); ctx.openNewCard({ no, game: unknown[0]?.game, photoBlob, hints: result.hints || [], onSaved: () => { sessionCount++; } }); };
        body.querySelector('[data-custom]').onclick = () => openNew(unknown[0]?.no || '');
        body.querySelector('[data-newcard]')?.addEventListener('click', () => openNew(unknown[0].no));
        body.querySelector('[data-ai]')?.addEventListener('click', async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          b.innerHTML = '<span class="spin"></span> KI denkt …';
          try {
            const ai = await aiRecognize(await compressImage(full ? await canvasBlob(full) : photoBlob, 1600, 0.85), s);
            acted = true;
            closeSheet();
            showAi(ai, photoBlob);
          } catch (err) {
            toast(err.message);
            b.disabled = false;
            b.innerHTML = `${icon.spark} Mit KI erkennen`;
          }
        });
      };
      render();
    }, {
      onClose: () => {
        if (!acted || s.scanBatch) resume();
        else if (acted && !s.scanBatch) { /* Formular offen oder fertig */ resume(); }
      },
    });
  }

  function showAi(list, photoBlob) {
    let acted = false;
    sheet(list.length > 1 ? `${list.length} Karten erkannt (KI)` : 'KI-Ergebnis', (body, closeSheet) => {
      if (!list.length) {
        body.innerHTML = '<div class="notice warn">Die KI hat keine Karte erkannt.</div>';
        return;
      }
      const picks = list.map((x) => x.matches[0] || null);
      const render = () => {
        body.innerHTML = list.map((x, i) => `
          <div class="panel" style="margin-bottom:10px">
            <div class="row"><b style="flex:1">${esc(x.name || '?')}</b><span class="muted small">${esc(x.card_number)}</span></div>
            <div class="muted small">${esc(cat.GAMES[x.game]?.short || 'Unbekannt')}${x.language ? ' · ' + esc(x.language) : ''}${x.graded ? ` · <b>${esc(x.grading_company)} ${esc(x.grade)}</b>` : ''}</div>
            ${x.matches.length ? `<div class="grid small" style="margin-top:8px">${x.matches.map((c, j) => ctx.tileHTML(c, { idx: `${i}:${j}`, selected: picks[i] === c })).join('')}</div>`
              : cat.GAMES[x.game] && !shownGames.includes(x.game) ? `<div class="small muted" style="margin-top:6px">${esc(cat.GAMES[x.game].short)} ist ausgeblendet (Einstellungen).</div>`
              : `<div class="small" style="color:var(--warn);margin-top:6px">Nicht in der Datenbank.</div><button class="btn sm" data-ainew="${i}" style="margin-top:6px">${icon.plus} Neu anlegen</button>`}
          </div>`).join('') + `
          <div class="two"><button class="btn" data-cancel>Abbrechen</button>
          <button class="btn primary" data-addall>${icon.plus} ${list.length > 1 ? 'Alle hinzufügen' : 'Hinzufügen'}</button></div>`;
        body.querySelectorAll('.tcg').forEach((el) => {
          el.onclick = () => { const [i, j] = el.dataset.idx.split(':').map(Number); picks[i] = picks[i] === list[i].matches[j] ? null : list[i].matches[j]; render(); };
        });
        body.querySelector('[data-cancel]').onclick = () => closeSheet();
        body.querySelectorAll('[data-ainew]').forEach((b) => (b.onclick = () => {
          const x = list[+b.dataset.ainew];
          acted = true;
          closeSheet();
          ctx.openNewCard({ no: x.card_number, game: x.game, name: x.name, photoBlob, onSaved: () => { sessionCount++; } });
        }));
        body.querySelector('[data-addall]').onclick = async () => {
          acted = true;
          let n = 0;
          for (let i = 0; i < list.length; i++) {
            if (!picks[i]) continue;
            const x = list[i];
            const grading = x.graded ? { company: x.grading_company, grade: x.grade, cert: x.cert_number } : null;
            await ctx.quickAdd(picks[i], { grading, lang: x.language, silent: list.length > 1, photoBlob: grading && list.length === 1 ? photoBlob : null });
            n++;
          }
          sessionCount += n;
          if (list.length > 1) toast(`${n} Karten hinzugefügt`);
          closeSheet();
        };
      };
      render();
    }, { onClose: () => { resume(); } });
  }

  startCam();
  // Texterkennung schon mal im Hintergrund laden
  if (!(s.aiAuto && s.aiKey)) setTimeout(() => getWorker().catch(() => {}), 400);
  return state;
}

export function closeScanner() { active?.close(); }
export { findGrading };
