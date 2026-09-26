/* Wo ist was – Töne und Vibration. Die Töne werden im Browser erzeugt, es gibt keine Tondateien. */
(function (W) {
  'use strict';
  var S = W.Sound = {};
  var AC = null, master = null, curVol = 1;
  // Welche Einstellung (Lautstärke 0–100) zu welchem Ton gehört
  var CH = { tap: 'vTap', tick: 'vTap', done: 'vTap', open: 'vMenu', close: 'vMenu', micOn: 'vMenu', micOff: 'vMenu', page: 'vPage', chime: 'vChime', swoosh: 'vSwipe', arm: 'vSwipe' };
  var HAP = { tap: 1, tick: 1, open: 1, close: 1, arm: 1, micOn: 1, done: 2, swoosh: 2, chime: 2 };

  S.cfg = function () { return {}; }; // wird von der App gesetzt und liefert die Einstellungen

  function ctx() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { AC = new C(); } catch (e) { return null; }
      master = AC.createGain();
      master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  // Auf dem iPhone darf Ton erst nach der ersten Berührung starten
  var touched = false;
  S.prime = function () { touched = true; ctx(); };
  document.addEventListener('pointerdown', S.prime, { once: true, capture: true });

  function tone(f, at, dur, type, gain, fEnd) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * curVol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, f0, f1, peak, q) {
    var c = ctx(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur * .9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * curVol), t + .04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur + .02);
  }
  function bell(f, at) { tone(f, at, 1.1, 'sine', .26); tone(f * 2.76, at, .45, 'sine', .06); tone(f * 5.4, at, .16, 'sine', .025); }

  var SND = {
    tap: function () { tone(1500, 0, .045, 'triangle', .22, 480); },
    tick: function () { tone(2400, 0, .02, 'square', .05); tone(1200, .012, .03, 'sine', .08); },
    done: function () { tone(1046, 0, .09, 'sine', .18); tone(1568, .07, .16, 'sine', .16); tone(3136, .07, .06, 'sine', .03); },
    open: function (step) { var st = (step || 55) / 1000; [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, .02 + i * st, .16, 'sine', .16); tone(f * 2, .02 + i * st, .05, 'sine', .04); }); },
    close: function () { tone(1046, 0, .07, 'sine', .14, 700); tone(660, .06, .09, 'sine', .12, 440); },
    page: function () { noise(.2, 500, 2600, .09, 1.2); },
    swoosh: function () { noise(.32, 3400, 600, .22, .9); tone(520, 0, .22, 'sine', .05, 240); },
    arm: function () { tone(1800, 0, .03, 'sine', .07); },
    micOn: function () { tone(660, 0, .09, 'sine', .16); tone(990, .08, .12, 'sine', .16); },
    micOff: function () { tone(990, 0, .08, 'sine', .14); tone(740, .07, .12, 'sine', .12); },
    chime: function (n) { for (var k = 0; k < (n || 1); k++) { bell(1319, k * .8); bell(1976, k * .8 + .15); } }
  };

  function vol(name) {
    var c = S.cfg(), v = c[CH[name]];
    v = v === undefined ? 60 : +v;
    return v <= 0 ? 0 : Math.pow(v / 100, 1.6) * 1.3;
  }

  /* Vibration: Android über navigator.vibrate, iPhone ab iOS 18 über einen versteckten Schalter */
  S.haptic = function (level) {
    var mode = S.cfg().haptic || 'light';
    if (!level || mode === 'off' || !touched) return; // Vibration erst nach der ersten Berührung
    var strong = level > 1 || mode === 'strong';
    try {
      if (navigator.vibrate) { navigator.vibrate(strong ? 22 : 9); return; }
      var l = document.getElementById('hapL');
      if (!l) return;
      l.click();
      if (strong) setTimeout(function () { l.click(); }, 90);
    } catch (e) { /* egal */ }
  };

  S.play = function (name, arg) {
    S.haptic(HAP[name]);
    curVol = vol(name);
    if (!curVol || !SND[name]) return;
    try { SND[name](arg); } catch (e) { /* egal */ }
  };
  S.chime = function () { S.play('chime', +(S.cfg().chimeRepeat || 2)); };
})(window.W = window.W || {});
