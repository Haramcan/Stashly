/* Wo ist was – QR-Etiketten scannen (Kamera oder Foto), alles lokal */
(function (W) {
  'use strict';
  var U = W.U;
  var stream = null, timer = null, active = false;

  var S = W.Scanner = {};

  function lib() { return U.loadScript('lib/jsQR.js'); }

  function decodeCanvas(c, both) {
    var x = c.getContext('2d');
    var d = x.getImageData(0, 0, c.width, c.height);
    var r = window.jsQR(d.data, c.width, c.height, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
    return r ? r.data : null;
  }

  /* Live-Kamera starten; onResult(text) wird einmal aufgerufen */
  S.start = function (video, onResult, onStatus) {
    S.stop();
    active = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Kamera wird hier nicht unterstützt.'));
    }
    return lib().then(function () {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    }).then(function (s) {
      if (!active) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      video.setAttribute('playsinline', '');
      video.muted = true;
      return video.play().then(function () {
        if (onStatus) onStatus('Halte die Kamera auf den QR-Code einer Kiste.');
        var c = document.createElement('canvas');
        var tick = function () {
          if (!active) return;
          if (video.readyState >= 2 && video.videoWidth) {
            var s2 = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
            c.width = Math.round(video.videoWidth * s2); c.height = Math.round(video.videoHeight * s2);
            c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
            var txt = null;
            try { txt = decodeCanvas(c, false); } catch (e) { txt = null; }
            if (txt) { S.stop(); onResult(txt); return; }
          }
          timer = setTimeout(tick, 180);
        };
        tick();
      });
    });
  };

  S.stop = function () {
    active = false;
    clearTimeout(timer); timer = null;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  };

  /* QR-Code aus einem Foto lesen */
  S.decodeFile = function (file) {
    return lib().then(function () { return U.loadImage(file); }).then(function (o) {
      var sizes = [1200, 800, 1600], res = null;
      for (var i = 0; i < sizes.length && !res; i++) {
        var c = U.drawScaled(o.img, sizes[i]);
        try { res = decodeCanvas(c, true); } catch (e) { res = null; }
      }
      URL.revokeObjectURL(o.url);
      return res;
    });
  };
})(window.W = window.W || {});
