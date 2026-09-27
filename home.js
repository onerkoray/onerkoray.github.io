/* Grafik kartları: çizgi CSS ile çizilirken banttaki kat ×1'den sayar.
   Hareket azaltma tercihinde ya da JS yoksa sayı olduğu gibi durur. */
(function () {
  'use strict';
  var kartlar = document.querySelectorAll('.project-card--grafik');
  if (!kartlar.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function say(el) {
    var metin = el.getAttribute('data-deger') || el.textContent;
    var on = metin.charAt(0) === '×' ? '×' : '';
    var sayi = metin.slice(on.length), hedef = parseFloat(sayi.replace(/\./g, '').replace(',', '.'));
    var ondalik = (sayi.split(',')[1] || '').length;
    if (!isFinite(hedef)) return;
    function yaz(v) {
      var p = v.toFixed(ondalik).split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      el.textContent = on + p.join(',');
    }
    var bas = null;
    function kare(z) {
      if (bas === null) bas = z;
      var t = Math.min(1, (z - bas - 200) / 1900);
      if (t < 0) { window.requestAnimationFrame(kare); return; }
      var e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Çizgi logaritmik: sayaç da üstel ilerler, nokta ile aynı hızda büyür.
      yaz(Math.exp(Math.log(hedef) * e));
      if (t < 1) window.requestAnimationFrame(kare); else el.textContent = metin;
    }
    yaz(1);
    window.requestAnimationFrame(kare);
  }
  var gozcu = new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      if (!g.isIntersecting) return;
      gozcu.unobserve(g.target);
      var el = g.target.querySelector('.kart-iz-deger');
      if (el) say(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  Array.prototype.forEach.call(kartlar, function (k) { gozcu.observe(k); });
})();

/* Sayımlar sabit yazılmaz; ana sayfanın mevcut araç kartlarından türetilir. */
(function () {
  'use strict';
  var cards = Array.from(document.querySelectorAll('.project-card[data-tags]'));
  document.querySelectorAll('.directory-panel .chip[data-filter]').forEach(function (chip) {
    var category = chip.getAttribute('data-filter');
    var count = cards.filter(function (card) { return category === 'hepsi' || card.getAttribute('data-cat') === category; }).length;
    var badge = document.createElement('span');
    badge.className = 'chip-count';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = count;
    chip.appendChild(badge);
  });
})();
