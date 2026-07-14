/* Yaş Hesaplama — tarih farkı, yaş, doğum günü geri sayımı (bağımlılıksız) */
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }
  function set(id, html) { var e = el(id); if (e) e.innerHTML = html; }
  function toDate(id) {
    var e = el(id);
    if (!e || !e.value) return null;
    var p = e.value.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }
  function ymd(from, to) {
    // from <= to varsayımı
    var y = to.getFullYear() - from.getFullYear();
    var m = to.getMonth() - from.getMonth();
    var d = to.getDate() - from.getDate();
    if (d < 0) {
      m--;
      var prevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
      d += prevMonth;
    }
    if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: d };
  }

  function calcAge() {
    var dogum = toDate("p1-dogum"), hedef = toDate("p1-hedef");
    if (!dogum || !hedef) { set("p1-out", ""); return; }
    if (dogum > hedef) { set("p1-out", "Doğum tarihi, hesaplama tarihinden sonra olamaz."); return; }

    var a = ymd(dogum, hedef);
    var toplamGun = daysBetween(dogum, hedef);

    // Sonraki doğum günü
    var next = new Date(hedef.getFullYear(), dogum.getMonth(), dogum.getDate());
    if (next < hedef) next = new Date(hedef.getFullYear() + 1, dogum.getMonth(), dogum.getDate());
    var kalan = daysBetween(hedef, next);

    set("p1-out",
      a.y + " yıl " + a.m + " ay " + a.d + " gün" +
      '<span class="muted-note">Toplam ' + toplamGun.toLocaleString("tr-TR") + " gün · " +
      (kalan === 0 ? "Bugün doğum günün, kutlu olsun! 🎉" : "Doğum gününe " + kalan + " gün kaldı.") +
      "</span>");
  }

  function calcDiff() {
    var bas = toDate("p2-bas"), bit = toDate("p2-bit");
    if (!bas || !bit) { set("p2-out", ""); return; }
    var a = bas <= bit ? bas : bit;
    var b = bas <= bit ? bit : bas;
    var fark = ymd(a, b);
    var gun = daysBetween(a, b);
    set("p2-out",
      gun.toLocaleString("tr-TR") + " gün" +
      '<span class="muted-note">' + fark.y + " yıl " + fark.m + " ay " + fark.d + " gün · " +
      (Math.round(gun / 7)).toLocaleString("tr-TR") + " hafta</span>");
  }

  ["p1-dogum", "p1-hedef"].forEach(function (id) { var e = el(id); if (e) e.addEventListener("input", calcAge); });
  ["p2-bas", "p2-bit"].forEach(function (id) { var e = el(id); if (e) e.addEventListener("input", calcDiff); });

  // Sekmeler
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var sel = t === tab;
      t.setAttribute("aria-selected", String(sel));
      t.tabIndex = sel ? 0 : -1;
      var p = el(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sel;
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); tabs[idx].focus(); selectTab(tabs[idx]); }
    });
  });

  // Varsayılanlar: hedef = bugün, örnek doğum tarihi, iki tarih arası bugün→bugün
  var today = new Date();
  if (el("p1-hedef")) el("p1-hedef").value = iso(today);
  if (el("p1-dogum")) el("p1-dogum").value = iso(new Date(today.getFullYear() - 25, today.getMonth(), today.getDate()));
  if (el("p2-bas")) el("p2-bas").value = iso(today);
  if (el("p2-bit")) el("p2-bit").value = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));

  calcAge();
  calcDiff();
})();
