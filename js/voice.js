/* Wo ist was – Spracheingabe über die Spracherkennung des Browsers (Safari: Siri-Erkennung, braucht meist Internet) */
(function (W) {
  'use strict';
  var U = W.U, $ = U.$;
  var V = W.Voice = {};
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, cur = null, gotText = '';

  V.supported = function () { return !!SR; };

  var box, txt, hint, retry, cancel, alt;
  function els() {
    if (box) return;
    box = $('#voice'); txt = $('#vText'); hint = $('#vHint'); retry = $('#vRetry'); cancel = $('#vCancel'); alt = $('#vAlt');
    cancel.addEventListener('click', function () { V.stop(true); });
    retry.addEventListener('click', function () { if (cur) V.listen(cur); });
    alt.addEventListener('click', function () { var o = cur; V.stop(true); if (o && o.onKeyboard) o.onKeyboard(); });
    box.addEventListener('click', function (e) { if (e.target === box) V.stop(true); });
  }
  function show(text, wait) { txt.textContent = text; txt.classList.toggle('wait', !!wait); }
  function state(cls) { box.classList.remove('talking', 'done', 'error'); if (cls) box.classList.add(cls); }
  function problem(msg) {
    state('error');
    show(msg, true);
    retry.hidden = !SR; alt.hidden = false;
  }

  /* opts: { hint, onResult(text), onKeyboard() } */
  V.listen = function (opts) {
    els();
    V.stop(false);
    cur = opts; gotText = '';
    state('');
    retry.hidden = true; alt.hidden = true;
    hint.textContent = opts.hint || '';
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add('on'); });
    W.Sound.play('micOn');
    if (!SR) {
      problem('Die Spracherkennung gibt es in diesem Browser nicht. Tippe ins Feld und nutze das Mikrofon auf der Tastatur.');
      return;
    }
    show('Ich höre zu …', true);
    try {
      rec = new SR();
      rec.lang = 'de-DE';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = function (e) {
        var t = '';
        for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        gotText = t.trim();
        state('talking');
        show(gotText);
        if (e.results[e.results.length - 1].isFinal) finish();
      };
      rec.onerror = function (e) {
        var c = e && e.error;
        rec = null;
        if (c === 'aborted') return;
        if (c === 'not-allowed' || c === 'service-not-allowed') problem('Das Mikrofon ist nicht erlaubt. Erlaube es unter Einstellungen › Apps › Safari › Mikrofon.');
        else if (c === 'network') problem('Die Spracherkennung braucht gerade Internet.');
        else if (c === 'no-speech') problem('Ich habe nichts gehört. Versuch es noch einmal.');
        else problem('Das hat nicht geklappt. Versuch es noch einmal.');
      };
      rec.onend = function () { if (rec && gotText) finish(); else if (rec && !gotText) problem('Ich habe nichts gehört. Versuch es noch einmal.'); rec = null; };
      rec.start();
    } catch (err) {
      rec = null;
      problem('Die Spracherkennung konnte nicht starten.');
    }
  };
  function finish() {
    var o = cur, t = gotText;
    if (!o || !t) return;
    var r = rec; rec = null;
    if (r) { r.onend = null; try { r.stop(); } catch (e) { /* egal */ } }
    state('done');
    W.Sound.play('micOff');
    setTimeout(function () {
      close();
      cur = null;
      if (o.onResult) o.onResult(t);
    }, 550);
  }
  function close() {
    box.classList.remove('on');
    setTimeout(function () { if (!box.classList.contains('on')) box.hidden = true; }, 320);
  }
  V.stop = function (sound) {
    els();
    if (rec) { var r = rec; rec = null; r.onend = null; r.onerror = null; try { r.abort(); } catch (e) { /* egal */ } }
    if (!box.hidden && sound) W.Sound.play('micOff');
    if (!box.hidden) close();
    if (sound) cur = null;
  };
  V.isOpen = function () { return box && !box.hidden; };
})(window.W = window.W || {});
