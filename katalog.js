/*!
 * Katalog süzgeci — /araclar/ ve /makaleler/ çipleri.
 *
 * Çipler gerçek çapalardır (JS yoksa bölüme kaydırır). JS varsa tıklanan
 * kategori çipi yalnız o bölümü gösterir, "Tümü" hepsini; yıl çipi (varsa)
 * yalnız o yılın yazılarını bırakır. Seçim aria-current ile işaretlenir ve
 * görünen sayı canlı bölgede duyurulur. Adres çubuğundaki çapa güncellenir,
 * sayfa kaymaz.
 *
 * Lisans: MIT — Koray Öner
 */
const OGE = ".project-card, .ed-item, .ed-lead";

function baslat() {
  document.querySelectorAll("[data-katalog-cipler]:not([data-katalog-yil])").forEach((cipler) => {
    const kok = cipler.parentElement;
    const yilCip = kok.querySelector("[data-katalog-yil]");
    const bolumler = [...kok.querySelectorAll("[data-bolum-id]")];
    const durum = kok.querySelector(".katalog-durum");
    let bolum = "", yil = "";

    function uygula() {
      let gorunen = 0;
      bolumler.forEach((b) => {
        const ogeler = b.matches(OGE) ? [b] : [...b.querySelectorAll(OGE)];
        let say = 0;
        ogeler.forEach((o) => {
          const y = o.getAttribute("data-yil");
          const acik = !yil || !y || y === yil;
          if (o !== b) o.hidden = !acik;
          if (acik) say++;
        });
        b.hidden = (!!bolum && b.getAttribute("data-bolum-id") !== bolum) || say === 0;
        if (!b.hidden) gorunen += say;
      });
      if (durum) durum.textContent = gorunen + " sonuç gösteriliyor";
    }
    function isaretle(grup, cip) {
      grup.querySelectorAll(".chip").forEach((c) => c.removeAttribute("aria-current"));
      cip.setAttribute("aria-current", "true");
    }

    cipler.addEventListener("click", (e) => {
      const cip = e.target.closest(".chip");
      if (!cip) return;
      e.preventDefault();
      bolum = cip.getAttribute("data-bolum") || "";
      isaretle(cipler, cip);
      uygula();
      history.replaceState(null, "", bolum ? "#" + bolum : location.pathname);
    });
    if (yilCip) yilCip.addEventListener("click", (e) => {
      const cip = e.target.closest(".chip");
      if (!cip) return;
      e.preventDefault();
      yil = cip.getAttribute("data-yil") || "";
      isaretle(yilCip, cip);
      uygula();
    });

    /* Doğrudan bir bölüm çapasıyla gelinirse o bölüm seçili açılır. */
    const ilk = location.hash.slice(1);
    const cip = ilk && cipler.querySelector('.chip[data-bolum="' + CSS.escape(ilk) + '"]');
    if (cip) { bolum = ilk; isaretle(cipler, cip); uygula(); }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat); else baslat();
