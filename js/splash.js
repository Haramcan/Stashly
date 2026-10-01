/* Wo ist was – Startanimation: füllt die herausströmenden Dinge und räumt den Startbildschirm nach dem Ablauf wieder weg.
   Läuft unabhängig von der übrigen App, damit der Startbildschirm auch dann verschwindet, wenn etwas anderes klemmt. */
(function () {
  'use strict';
  var box = document.getElementById('startsplash');
  if (!box) return;

  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var items = box.querySelector('.sp-items');

  // Allerlei Dinge aus dem Haushalt (einfache Symbole)
  var SW = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = [
    '<path d="M8 3l-4 4 2.5 2.5L8 8v13h8V8l1.5 1.5L20 7l-4-4a4 4 0 0 1-8 0z"/>',
    '<circle cx="8" cy="15" r="4.5"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
    '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M8 3v14"/>',
    '<path d="M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 9h2.5a2 2 0 0 1 0 5H16"/><path d="M8 3v2M11 3v2"/>',
    '<path d="M9 3h6l1 7H8z"/><path d="M12 10v7"/><path d="M8 21h8l-1-4H9z"/>',
    '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2.5h5L16 7"/>',
    '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9V6a3 3 0 0 1 6 0M4 13h16"/>',
    '<path d="M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/>',
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a13 13 0 0 0 0 17M3.5 12h17"/>',
    '<path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 17v-4H7v6H6a2 2 0 0 1-2-2z"/>',
    '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
    '<path d="M9 3v6M15 3v6M7 9h10l-1 5a4 4 0 0 1-8 0z"/><path d="M12 18v3"/>'
  ];
  var COLORS = ['#F3D34A', '#86C9B3', '#8DB3EE', '#F0A36A', '#F1F4F1', '#B7A5F0', '#F3D34A', '#86C9B3', '#F0A36A', '#8DB3EE', '#F1F4F1', '#B7A5F0'];

  if (items && !reduce) {
    var html = '';
    for (var i = 0; i < ICONS.length; i++) {
      var dir = i % 2 ? 1 : -1, spread = (0.3 + (i % 6) / 6) * 78;
      var x0 = dir * (4 + (i % 3) * 5), x1 = dir * spread + (i % 2 ? 6 : -6);
      var delay = (0.75 + i * 0.075).toFixed(3) + 's';
      html += '<span class="sp-fly" style="--d:' + delay + ';--x0:' + x0 + 'px;--x1:' + x1 + 'px">' +
        '<span class="chip" style="background:' + COLORS[i] + ';color:#132019">' +
        '<svg viewBox="0 0 24 24" ' + SW + '>' + ICONS[i] + '</svg></span></span>';
    }
    items.innerHTML = html;
  }

  var gone = false;
  function remove() {
    if (gone) return;
    gone = true;
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }
  // Nach dem Ablauf wegräumen; die Zeit deckt die CSS-Animation ab (mit Puffer).
  setTimeout(remove, reduce ? 1400 : 3600);
  // Sicherheitsnetz, falls ein Tab lange im Hintergrund lag.
  box.addEventListener('animationend', function (e) {
    if (e.animationName === 'sp-reveal' || e.animationName === 'sp-fade') remove();
  });
})();
