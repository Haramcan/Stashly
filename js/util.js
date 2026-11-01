// Kleine Helfer für die ganze App

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim();
}

export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Ähnlichkeit 0..1 zwischen zwei Wörtern */
export function sim(a, b) {
  if (!a || !b) return 0;
  const d = lev(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const money = (v) => (v == null || isNaN(v) ? '–' : eur.format(v));
export const num = (v) => new Intl.NumberFormat('de-DE').format(v || 0);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return d;
  return x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function toast(msg, opts = {}) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action;
    b.onclick = () => { opts.onAction?.(); el.remove(); };
    el.appendChild(b);
  }
  root.appendChild(el);
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 5000 : 2600));
  if (navigator.vibrate && opts.vibrate) navigator.vibrate(opts.vibrate);
}

/** Bottom-Sheet öffnen. render(el, close) füllt den Inhalt. Gibt close() zurück. */
export function sheet(title, render, opts = {}) {
  const root = document.getElementById('sheetRoot');
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="grab"></div><div class="sheet-head"><h3>${esc(title)}</h3>
    <button class="icon-btn" data-close aria-label="Schließen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="sheet-body"></div>`;
  let closed = false;
  const close = (v) => {
    if (closed) return;
    closed = true;
    bd.remove(); el.remove();
    window.removeEventListener('popstate', onPop);
    opts.onClose?.(v);
  };
  const onPop = () => close();
  bd.onclick = () => close();
  el.querySelector('[data-close]').onclick = () => close();
  // Wischen nach unten schließt
  let y0 = null;
  el.addEventListener('touchstart', (e) => { if (el.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0 && el.scrollTop <= 0) el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (dy > 110) close(); else el.style.transform = '';
  });
  root.append(bd, el);
  render(el.querySelector('.sheet-body'), close);
  return close;
}

export function confirmDialog(title, text, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let result = false;
    sheet(title, (body, close) => {
      body.innerHTML = `<p class="muted" style="margin-top:0">${esc(text)}</p>
        <div class="two"><button class="btn" data-no>Abbrechen</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button></div>`;
      body.querySelector('[data-no]').onclick = () => close();
      body.querySelector('[data-yes]').onclick = () => { result = true; close(); };
    }, { onClose: () => resolve(result) });
  });
}

export function zoomImage(src, fallback) {
  const z = document.createElement('div');
  z.className = 'zoom';
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = src;
  if (fallback) img.onerror = () => { img.onerror = null; img.src = fallback; };
  z.appendChild(img);
  z.onclick = () => z.remove();
  document.body.appendChild(z);
}

/** Bild verkleinern und als JPEG-Blob zurückgeben */
export async function compressImage(fileOrBlob, maxSide = 1400, quality = 0.85) {
  const bmp = await loadBitmap(fileOrBlob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
}

export async function loadBitmap(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* weiter */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(url) {
  return (await fetch(url)).blob();
}

export function download(name, data, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export async function shareOrDownload(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  download(name, blob, type);
}

export function pickFile(accept = 'image/*', { multiple = false, capture = null } = {}) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiple;
    if (capture) i.setAttribute('capture', capture);
    i.style.display = 'none';
    i.onchange = () => { resolve(multiple ? [...i.files] : i.files[0] || null); i.remove(); };
    document.body.appendChild(i);
    i.click();
  });
}

export const icon = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  binder: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h3v4H8zM13 7h3v4h-3zM8 13h3v4H8zM13 13h3v4h-3z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M6 7l1 13h10l1-13"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  flash: '<svg viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};
