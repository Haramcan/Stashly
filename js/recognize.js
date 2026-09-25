/* Wo ist was – Bilderkennung direkt auf dem Gerät (MobileNet V2, TensorFlow.js). Keine Daten verlassen das Gerät. */
(function (W) {
  'use strict';
  var U = W.U;
  var SIZE = 224;
  var model = null, loading = null;

  var R = W.Recognizer = { state: 'idle', backend: '' };

  R.load = function () {
    if (loading) return loading;
    R.state = 'loading';
    loading = U.loadScript('lib/tf.min.js')
      .then(function () { return U.loadScript('js/labels-de.js'); })
      .then(function () {
        if (!window.tf) throw new Error('TensorFlow fehlt');
        window.tf.enableProdMode();
        return window.tf.setBackend('webgl').catch(function () { return false; }).then(function (ok) {
          if (ok === false || window.tf.getBackend() !== 'webgl') return window.tf.setBackend('cpu');
        });
      })
      .then(function () { return window.tf.ready(); })
      .then(function () { return window.tf.loadGraphModel('model/model.json'); })
      .then(function (m) {
        model = m;
        R.backend = window.tf.getBackend();
        // Aufwärmen, damit die erste echte Erkennung schnell ist
        var t = window.tf.zeros([1, SIZE, SIZE, 3]);
        var out = model.predict(t);
        return out.data().then(function () { t.dispose(); out.dispose(); });
      })
      .then(function () { R.state = 'ready'; return true; })
      .catch(function (e) {
        console.error('Erkennung konnte nicht geladen werden', e);
        R.state = 'error'; loading = null;
        throw e;
      });
    return loading;
  };

  /* Bild mittig quadratisch zuschneiden und auf 224 px bringen */
  function toCanvas(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s = Math.min(w, h);
    var c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SIZE, SIZE);
    return c;
  }

  /* Liefert bis zu `top` Vorschläge: [{name, category, p}] */
  R.classify = function (blob, top) {
    top = top || 3;
    return R.load().then(function () { return U.loadImage(blob); }).then(function (o) {
      var tf = window.tf;
      var canvas = toCanvas(o.img);
      URL.revokeObjectURL(o.url);
      var probs = tf.tidy(function () {
        // Das TF-Hub-Modell erwartet Farbwerte zwischen 0 und 1
        var x = tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0);
        var logits = model.predict(x);
        return tf.softmax(logits.slice([0, 1], [-1, 1000])).squeeze();
      });
      return probs.data().then(function (arr) {
        probs.dispose();
        var idx = [];
        for (var i = 0; i < arr.length; i++) idx.push(i);
        idx.sort(function (a, b) { return arr[b] - arr[a]; });
        var labels = window.WIW_LABELS || [];
        var seen = {}, res = [];
        for (var k = 0; k < idx.length && res.length < top && k < 25; k++) {
          var i2 = idx[k], p = arr[i2];
          if (p < 0.03) break;
          var l = labels[i2] || ['Unbekannt', 'Sonstiges'];
          if (seen[l[0]]) { seen[l[0]].p += p; continue; }
          var entry = { name: l[0], category: l[1], p: p };
          seen[l[0]] = entry; res.push(entry);
        }
        res.sort(function (a, b) { return b.p - a.p; });
        return res;
      });
    });
  };
})(window.W = window.W || {});
