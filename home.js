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
