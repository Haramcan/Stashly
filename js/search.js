/* Wo ist was – Suche mit Fragen, Synonymen und Tippfehler-Toleranz (komplett lokal) */
(function (W) {
  'use strict';
  var U = W.U;

  var STOP = ('wo ist sind war mein meine meinen meinem meiner dein deine der die das den dem des ein eine einen einem einer ' +
    'ich du wir hab habe haben hat hatte gibt es liegt liegen steht stehen finde finden such suche suchen zeig zeige zeigen mir ' +
    'alle alles im in ins auf unter uber bei von vom mit noch und oder was welche welcher welches wieviel wie viele viel ' +
    'da dort hier denn nochmal eigentlich bitte gerade grad the a an irgendwo irgendwas etwas mal nach zum zur fur ' +
    'ab bald schon bis wann demnachst nachstes nachste sachen dinge ding zeug gegenstand gegenstande').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  /* Gruppen von Wörtern, die dasselbe meinen (normalisiert: klein, ohne Umlaute, ß→ss) */
  var SYN = [
    'kabel ladekabel usbkabel usb leitung strippe',
    'ladegerat netzteil ladeteil adapter lader',
    'bohrmaschine akkuschrauber schrauber bohrer schlagbohrer',
    'schraubenzieher schraubendreher',
    'handy smartphone telefon iphone mobiltelefon',
    'laptop notebook rechner computer pc macbook',
    'fernseher tv glotze bildschirm',
    'monitor bildschirm display',
    'kopfhorer headset earbuds airpods ohrhorer',
    'lautsprecher box boxen speaker',
    'kamera fotoapparat',
    'tasse becher kaffeebecher',
    'topf kochtopf',
    'pfanne bratpfanne',
    'messer kuchenmesser',
    'jacke mantel anorak',
    'schuhe schuh sneaker turnschuhe stiefel',
    'pullover pulli sweatshirt hoodie',
    'hose jeans',
    'dokument dokumente unterlagen papiere ordner akte vertrag',
    'batterie batterien akku akkus',
    'lampe leuchte licht gluhbirne leuchtmittel birne',
    'spiel spiele brettspiel gesellschaftsspiel',
    'buch bucher roman',
    'fahrrad rad bike velo',
    'koffer reisetasche trolley',
    'decke wolldecke kuscheldecke',
    'bettwasche bettbezug',
    'handtuch handtucher',
    'medikament medikamente tabletten arznei medizin',
    'pflaster verband verbandskasten',
    'werkzeugkasten werkzeugkoffer werkzeug',
    'weihnachten weihnachtsdeko christbaumschmuck',
    'schlussel schlusselbund',
    'drucker printer',
    'maus computermaus',
    'tastatur keyboard',
    'staubsauger sauger',
    'fohn haartrockner',
    'rasierer rasierapparat',
    'grill griller',
    'schere',
    'kiste box karton',
    'tesa klebeband klebefilm',
    'kleber klebstoff',
    'stift kuli kugelschreiber bleistift',
    'router wlan',
    'spielzeug spielsachen',
    'kuscheltier stofftier teddy',
    'reisepass pass ausweis',
    'werkzeug tool tools'
  ].map(function (g) { return g.split(' '); });
  var SYNMAP = {};
  SYN.forEach(function (g) { g.forEach(function (w) { (SYNMAP[w] = SYNMAP[w] || []).push(g); }); });

  var INTENTS = [
    { key: 'lent', label: 'Verliehen', words: ['verliehen', 'ausgeliehen', 'geliehen', 'verborgt', 'verborgt'] },
    { key: 'expiry', label: 'Läuft ab', words: ['ablauf', 'ablaufen', 'lauft', 'abgelaufen', 'mhd', 'haltbar', 'haltbarkeit', 'verfallen', 'verfall', 'ablaufdatum'] },
    { key: 'warranty', label: 'Garantie', words: ['garantie', 'gewahrleistung'] },
    { key: 'shopping', label: 'Einkaufsliste', words: ['einkaufen', 'einkaufsliste', 'nachkaufen', 'aufgebraucht', 'leer', 'nachfullen'] },
    { key: 'sortout', label: 'Aussortieren', words: ['verkaufen', 'verschenken', 'aussortieren', 'entsorgen', 'aussortiert'] },
    { key: 'nophoto', label: 'Ohne Foto', words: ['ohnefoto'] }
  ];

  function stem(w) {
    var ends = ['ern', 'en', 'er', 'es', 'e', 'n', 's'];
    for (var i = 0; i < ends.length; i++) {
      var e = ends[i];
      if (w.length - e.length >= 4 && w.slice(-e.length) === e) return w.slice(0, -e.length);
    }
    return w;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function words(s) { return U.norm(s).split(/[^a-z0-9]+/).filter(Boolean); }

  function variants(tok) {
    var set = {}, s = stem(tok);
    set[tok] = 1; set[s] = 1;
    [tok, s].forEach(function (w) {
      (SYNMAP[w] || []).forEach(function (g) { g.forEach(function (x) { set[x] = 1; }); });
    });
    return Object.keys(set);
  }
  function wordMatches(w, v) {
    if (w === v) return 3;
    if (v.length >= 3 && w.indexOf(v) === 0) return 2;
    if (v.length >= 4 && w.indexOf(v) > 0) return 2;          // zusammengesetzte Wörter: „Ladekabel“ enthält „kabel“
    if (v.length >= 4 && stem(w) === stem(v)) return 2;
    if (v.length >= 5 && w.length >= 4) {
      var max = v.length >= 8 ? 2 : 1;
      if (lev(w, v, max) <= max) return 1;                      // Tippfehler
    }
    return 0;
  }

  /*
   * Anfrage verstehen. ctx: { rooms: [...], places: [...] }
   * Ergebnis: { tokens: [{raw, variants}], intents: [...], roomId, placeId, labels: [...] }
   */
  function parse(q, ctx) {
    var nq = U.norm(q);
    var out = { tokens: [], intents: [], roomId: null, placeId: null, labels: [] };
    if (!nq.trim()) return out;
    nq = nq.replace(/ohne\s+fotos?|kein(e|en)?\s+fotos?/g, ' ohnefoto ');
    nq = nq.replace(/wer\s+hat/g, ' verliehen ');
    var toks = nq.split(/[^a-z0-9]+/).filter(Boolean);

    // Absichten (verliehen, läuft ab …)
    toks = toks.filter(function (t) {
      for (var i = 0; i < INTENTS.length; i++) {
        if (INTENTS[i].words.indexOf(t) >= 0) {
          if (out.intents.indexOf(INTENTS[i].key) < 0) { out.intents.push(INTENTS[i].key); out.labels.push(INTENTS[i].label); }
          return false;
        }
      }
      return true;
    });

    // Raum erkennen („im Keller“)
    var rooms = (ctx && ctx.rooms) || [];
    toks = toks.filter(function (t) {
      if (out.roomId || STOPSET[t]) return true;
      for (var i = 0; i < rooms.length; i++) {
        var rn = U.norm(rooms[i].name).replace(/[^a-z0-9]/g, '');
        if (!rn) continue;
        var prefix = t.length >= 3 && rn.indexOf(t) === 0 && t.length >= rn.length * 0.3 && /zimmer$/.test(rn);
        if (t === rn || stem(t) === stem(rn) || prefix || (rn.length >= 5 && lev(t, rn, 1) <= 1)) {
          out.roomId = rooms[i].id; out.labels.push('Raum: ' + rooms[i].name);
          return false;
        }
      }
      return true;
    });

    // Kiste über Nummer erkennen („K3“, „k-12“)
    var places = (ctx && ctx.places) || [];
    var joined = ' ' + toks.join(' ') + ' ';
    places.forEach(function (p) {
      if (out.placeId || !p.code) return;
      var c = U.norm(p.code).replace(/[^a-z0-9]/g, '');
      if (c.length >= 2 && (joined.indexOf(' ' + c + ' ') >= 0)) {
        out.placeId = p.id; out.labels.push('Ort: ' + (p.code ? p.code + ' ' : '') + p.name);
        toks = toks.filter(function (t) { return t !== c; });
      }
    });
    // Kiste über Nummer mit Bindestrich/Leerzeichen („k 3“)
    if (!out.placeId) {
      for (var i = 0; i + 1 < toks.length; i++) {
        var pair = toks[i] + toks[i + 1];
        var hit = places.filter(function (p) { return p.code && U.norm(p.code).replace(/[^a-z0-9]/g, '') === pair; })[0];
        if (hit) { out.placeId = hit.id; out.labels.push('Ort: ' + hit.code + ' ' + hit.name); toks.splice(i, 2); break; }
      }
    }

    toks = toks.filter(function (t) { return !STOPSET[t] && t.length >= 2; });
    out.tokens = toks.map(function (t) { return { raw: t, variants: variants(t) }; });
    return out;
  }

  /* Text eines Gegenstands in Felder mit Gewicht zerlegen */
  function hayOf(item, extra) {
    return [
      { w: 3, words: words(item.name) },
      { w: 2, words: words([item.category, (item.tags || []).join(' ')].join(' ')) },
      { w: 1, words: words([item.spot, item.notes, item.serial, item.lentTo, extra].join(' ')) }
    ];
  }
  /* Punktzahl je Suchwort; 0 = nicht gefunden */
  function scoreToken(hay, tok) {
    var best = 0;
    for (var f = 0; f < hay.length; f++) {
      var field = hay[f];
      for (var i = 0; i < field.words.length; i++) {
        for (var v = 0; v < tok.variants.length; v++) {
          var m = wordMatches(field.words[i], tok.variants[v]);
          if (m) {
            var s = m * field.w * (tok.variants[v] === tok.raw ? 1 : 0.8);
            if (s > best) best = s;
          }
        }
      }
    }
    return best;
  }

  W.Search = { parse: parse, hayOf: hayOf, scoreToken: scoreToken, stem: stem };
})(window.W = window.W || {});
