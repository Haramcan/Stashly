/* Wo ist was – Farbschemen: legen alle Farben der App auf einmal fest (Hintergrund, Karten, Schrift,
   Akzent, Bereichsfarben, Startbildschirm). „Standard“ nutzt weiter Akzentfarbe und Hell/Dunkel aus den
   Einstellungen. Läuft schon im <head>, damit beim Start nichts in falschen Farben aufblitzt. */
(function (W) {
  'use strict';
  // Gemeinsame Werte für helle und dunkle Schemen
  var DARK = {
    scrim: 'rgba(0,0,0,.62)', shadow: '0 1px 2px rgba(0,0,0,.4),0 10px 28px rgba(0,0,0,.45)',
    'glass-shadow': '0 1px 1px rgba(0,0,0,.3),0 12px 34px rgba(0,0,0,.5)', 'glass-hi': 'rgba(255,255,255,.12)', 'glass-line': 'rgba(255,255,255,.09)'
  };
  var LIGHT = {
    scrim: 'rgba(12,18,24,.46)', 'glass-hi': 'rgba(255,255,255,.9)'
  };
  function mk(dark, v) { return Object.assign({}, dark ? DARK : LIGHT, v); }

  var LIST = [
    { id: 'midnight', n: 'Mitternacht Rot', d: 'Schwarz · Rot', dark: true, v: mk(true, {
      bg: '#0B0B0D', surface: '#161618', 'surface-2': '#1F1E21', ink: '#F3EEEE', muted: '#A79E9F', line: '#2E2B2E',
      accent: '#FF5A52', 'accent-ink': '#1A0605', 'accent-soft': '#3A1516',
      label: '#FFD166', 'label-ink': '#1E1602', tape: '#F3EEEE', 'tape-ink': '#0B0B0D',
      danger: '#FF9A85', 'danger-soft': '#3D1C17', warn: '#FFC857', 'warn-soft': '#372B12',
      'c-home': '#F3EEEE', 'c-items': '#FF5A52', 'c-places': '#FF9F43', 'c-due': '#FFD166', 'c-archive': '#D9B978', 'c-more': '#F28FB0', 'on-c': '#140808',
      glass: 'rgba(28,24,27,.74)', 'switch-off': '#3D3638', alarm: '#FF5A52', star: '#FFD166',
      'sp-a': '#5A1419', 'sp-b': '#2C0B0E', 'sp-c': '#0B0B0D' }) },
    { id: 'ocean', n: 'Ozean', d: 'Marineblau · Türkis', dark: true, v: mk(true, {
      bg: '#0A1626', surface: '#10213A', 'surface-2': '#162A47', ink: '#E6EFF8', muted: '#93A9C2', line: '#21385A',
      accent: '#3FD4C8', 'accent-ink': '#04201E', 'accent-soft': '#0E3A44',
      label: '#F2C661', 'label-ink': '#1F1802', tape: '#E6EFF8', 'tape-ink': '#0A1626',
      danger: '#FF8F86', 'danger-soft': '#3A1E28', warn: '#F2C661', 'warn-soft': '#2F2E1F',
      'c-home': '#E6EFF8', 'c-items': '#3FD4C8', 'c-places': '#72A9FF', 'c-due': '#FFB46B', 'c-archive': '#D9B978', 'c-more': '#B7A0FF', 'on-c': '#06121F',
      glass: 'rgba(18,36,60,.74)', 'switch-off': '#2B4466', alarm: '#FF6F66', star: '#F2C661',
      'sp-a': '#13426A', 'sp-b': '#0C2742', 'sp-c': '#071322' }) },
    { id: 'glacier', n: 'Gletscher', d: 'Eisblau · Blau', dark: false, v: mk(false, {
      bg: '#E9F0F7', surface: '#FFFFFF', 'surface-2': '#F3F7FB', ink: '#0F1D2E', muted: '#526379', line: '#D2DEEA',
      accent: '#1F5FD1', 'accent-ink': '#FFFFFF', 'accent-soft': '#DCE7FA',
      label: '#F3D34A', 'label-ink': '#2A2505', tape: '#0F1D2E', 'tape-ink': '#E9F0F7',
      danger: '#B4302B', 'danger-soft': '#F8E1DF', warn: '#8A5E00', 'warn-soft': '#F6EBC9',
      'c-home': '#0F1D2E', 'c-items': '#1F5FD1', 'c-places': '#0B7F8C', 'c-due': '#B44F12', 'c-archive': '#8A6A2E', 'c-more': '#6A4FC4', 'on-c': '#FFFFFF',
      glass: 'rgba(255,255,255,.76)', 'glass-line': 'rgba(15,29,46,.08)', shadow: '0 1px 2px rgba(15,29,46,.06),0 10px 28px rgba(15,29,46,.10)',
      'glass-shadow': '0 1px 1px rgba(15,29,46,.04),0 12px 34px rgba(15,29,46,.16)', 'switch-off': '#C5D2DF', alarm: '#C9372C', star: '#E0A21B',
      'sp-a': '#2668DA', 'sp-b': '#184CA8', 'sp-c': '#0E2E66' }) },
    { id: 'sand', n: 'Sand', d: 'Beige · Terrakotta', dark: false, v: mk(false, {
      bg: '#F3ECE2', surface: '#FFFCF7', 'surface-2': '#F8F2E9', ink: '#2B2119', muted: '#6E6051', line: '#E3D7C7',
      accent: '#A84A28', 'accent-ink': '#FFFFFF', 'accent-soft': '#F3DED2',
      label: '#F2CF5B', 'label-ink': '#2A2104', tape: '#2B2119', 'tape-ink': '#F3ECE2',
      danger: '#A8322B', 'danger-soft': '#F6DFDA', warn: '#845A00', 'warn-soft': '#F4E7C6',
      'c-home': '#2B2119', 'c-items': '#A84A28', 'c-places': '#4A7656', 'c-due': '#996000', 'c-archive': '#8A6A2E', 'c-more': '#7A5AA6', 'on-c': '#FFFFFF',
      glass: 'rgba(255,252,247,.78)', 'glass-line': 'rgba(43,33,25,.08)', shadow: '0 1px 2px rgba(43,33,25,.06),0 10px 28px rgba(43,33,25,.10)',
      'glass-shadow': '0 1px 1px rgba(43,33,25,.04),0 12px 34px rgba(43,33,25,.16)', 'switch-off': '#D9CDBC', alarm: '#C2382B', star: '#D99A16',
      'sp-a': '#B5562F', 'sp-b': '#924222', 'sp-c': '#5C2812' }) },
    { id: 'forest', n: 'Wald', d: 'Moosgrün · Gold', dark: true, v: mk(true, {
      bg: '#0E1712', surface: '#16211A', 'surface-2': '#1C2A21', ink: '#E9EEE5', muted: '#9CAA96', line: '#2A3B2F',
      accent: '#D6B25E', 'accent-ink': '#1B1405', 'accent-soft': '#3A3219',
      label: '#E8C95A', 'label-ink': '#1E1A02', tape: '#E9EEE5', 'tape-ink': '#0E1712',
      danger: '#F2907F', 'danger-soft': '#3A201B', warn: '#E8C95A', 'warn-soft': '#33301A',
      'c-home': '#E9EEE5', 'c-items': '#8FCB8B', 'c-places': '#80B7CB', 'c-due': '#E9A35C', 'c-archive': '#D6B25E', 'c-more': '#C5A9E2', 'on-c': '#0E1712',
      glass: 'rgba(26,38,30,.74)', 'switch-off': '#33463A', alarm: '#E5574B', star: '#E8C95A',
      'sp-a': '#26472F', 'sp-b': '#172C1F', 'sp-c': '#0B140F' }) },
    { id: 'lavender', n: 'Lavendel', d: 'Zartlila · Violett', dark: false, v: mk(false, {
      bg: '#F1EEF8', surface: '#FFFFFF', 'surface-2': '#F7F5FC', ink: '#221B33', muted: '#615A75', line: '#DDD7EB',
      accent: '#6A45C9', 'accent-ink': '#FFFFFF', 'accent-soft': '#E7DEFA',
      label: '#F3D34A', 'label-ink': '#2A2505', tape: '#221B33', 'tape-ink': '#F1EEF8',
      danger: '#B23A3A', 'danger-soft': '#F7E1E3', warn: '#855C00', 'warn-soft': '#F5EACB',
      'c-home': '#221B33', 'c-items': '#6A45C9', 'c-places': '#2C77AE', 'c-due': '#C2552A', 'c-archive': '#8A6A2E', 'c-more': '#A83B85', 'on-c': '#FFFFFF',
      glass: 'rgba(255,255,255,.76)', 'glass-line': 'rgba(34,27,51,.08)', shadow: '0 1px 2px rgba(34,27,51,.06),0 10px 28px rgba(34,27,51,.10)',
      'glass-shadow': '0 1px 1px rgba(34,27,51,.04),0 12px 34px rgba(34,27,51,.16)', 'switch-off': '#D3CCE3', alarm: '#C9372C', star: '#E0A21B',
      'sp-a': '#7050D0', 'sp-b': '#5535A8', 'sp-c': '#32206B' }) },
    { id: 'graphite', n: 'Graphit', d: 'Dunkelgrau · Weiß', dark: true, v: mk(true, {
      bg: '#121314', surface: '#1B1C1E', 'surface-2': '#242528', ink: '#EDEDED', muted: '#A2A3A6', line: '#313236',
      accent: '#F2F2F2', 'accent-ink': '#121314', 'accent-soft': '#2F3033',
      label: '#E2C23B', 'label-ink': '#1E1A02', tape: '#EDEDED', 'tape-ink': '#121314',
      danger: '#F28B80', 'danger-soft': '#3A1F1C', warn: '#E6BE5A', 'warn-soft': '#363019',
      'c-home': '#EDEDED', 'c-items': '#A9D6C3', 'c-places': '#AAC4E9', 'c-due': '#F1BA8B', 'c-archive': '#DAC59B', 'c-more': '#C6BAEA', 'on-c': '#121314',
      glass: 'rgba(36,37,40,.74)', 'switch-off': '#3A3B3F', alarm: '#E5574B', star: '#E6BE5A',
      'sp-a': '#2E2F33', 'sp-b': '#1C1D1F', 'sp-c': '#0E0F10' }) }
  ];
  var BY = {}; LIST.forEach(function (t) { BY[t.id] = t; });
  var KEYS = {}; LIST.forEach(function (t) { Object.keys(t.v).forEach(function (k) { KEYS[k] = 1; }); });
  KEYS = Object.keys(KEYS);

  var T = W.Themes = { list: LIST, get: function (id) { return BY[id] || null; } };
  // Setzt ein Schema (oder entfernt es bei „Standard“). Gibt das Schema zurück, sonst null.
  T.apply = function (id) {
    var d = document.documentElement, t = BY[id] || null;
    KEYS.forEach(function (k) { d.style.removeProperty('--' + k); });
    if (!t) { d.removeAttribute('data-theme'); d.style.removeProperty('color-scheme'); return null; }
    d.setAttribute('data-theme', t.id);
    d.setAttribute('data-look', t.dark ? 'dark' : 'light');
    d.style.setProperty('color-scheme', t.dark ? 'dark' : 'light');
    Object.keys(t.v).forEach(function (k) { d.style.setProperty('--' + k, t.v[k]); });
    return t;
  };
  try { var p = JSON.parse(localStorage.getItem('wiw-prefs') || '{}'); if (p.theme) T.apply(p.theme); } catch (e) { /* egal */ }
})(window.W = window.W || {});
