/* Memur Zammı Hesaplama — arayüz.
   Hesap finans/emekli-zammi-motoru.js'te (memurZammi); burada yalnızca
   okuma ve yazma. Statik tablolar aynı motordan tools/memur-zammi-sayfa.js
   ile üretiliyor. */
(function () {
  "use strict";
  var Z = window.EmekliZammiMotoru;
  if (!Z) return;

  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function yuzde(o) { return "%" + nf2.format(Math.round(o * 10000) / 100); }
  function tl(n) { return "₺" + nf0.format(Math.round(n)); }
  function $(id) { return document.getElementById(id); }

  function sayi(id) {
    var t = String($(id).value || "").trim().replace(/\s/g, "");
    if (!t) return NaN;
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    return Number(t);
  }

  var s = Z.siradaki();
  var d = Z.donem(s.zamYili, s.zamAyi);
  if (d.kesin) $("mz-varsayim-alan").hidden = true;

  function varsayim() {
    var v = $("mz-varsayim").value;
    $("mz-ozel-alan").hidden = v !== "ozel";
    if (v === "gecen-yil") {
      var ilk = d.aylar[d.aciklananSayisi], son = d.aylar[5];
      return { oran: Z.gecenYilAyniAylar(d),
        ad: "geçen yılın aynı ayları (" + Z.AY_ADLARI[ilk.ay - 1] + "–" + Z.AY_ADLARI[son.ay - 1] + " " + (son.yil - 1) + ")" };
    }
    if (v === "ozel") {
      var o = sayi("mz-ozel");
      if (!isFinite(o) || o <= -100) return null;
      return { oran: o / 100, ad: "her ay %" + String(o).replace(".", ",") };
    }
    var n = Number(v);
    return { oran: n, ad: n === 0 ? "aylık enflasyon sıfır" : "her ay %" + String(n * 100).replace(".", ",") };
  }

  function yaz() {
    var tufe, aciklama;
    if (d.kesin) {
      tufe = d.birikim;
      $("mz-etiket").textContent = d.ad + " memur zammı · kesinleşti";
      aciklama = "Altı ayın hepsi açıklandı; altı aylık TÜFE " + yuzde(tufe) + ".";
    } else {
      var v = varsayim();
      if (!v) { $("mz-oran").textContent = "—"; $("mz-aciklama").textContent = "Geçerli bir aylık oran girin."; return; }
      tufe = Z.senaryo(d, v.oran);
      $("mz-etiket").textContent = d.ad + " memur zammı · senaryo";
      aciklama = d.aciklananSayisi + " ay açıklandı (" + yuzde(d.birikim) + "); kalan " + d.eksikSayisi +
        " ay için varsayım: " + v.ad + ". Altı aylık TÜFE " + yuzde(tufe) + ".";
    }
    var m = Z.memurZammi(tufe, d.zamYili, d.zamAyi);
    $("mz-oran").textContent = yuzde(m.toplam);
    $("mz-aciklama").textContent = aciklama;
    $("mz-ts").textContent = yuzde(m.tsYeni);
    $("mz-fark").textContent = m.fark > 0 ? yuzde(m.fark) : "yok (TÜFE " + yuzde(m.tsOnceki) + " altında)";

    var maas = sayi("mz-maas");
    if (!isFinite(maas) || maas <= 0) { $("mz-yeni").textContent = "—"; $("mz-artis").textContent = "—"; return; }
    var yeni = maas * (1 + m.toplam);
    $("mz-yeni").textContent = tl(yeni);
    $("mz-artis").textContent = "+" + tl(yeni - maas);
  }

  ["mz-maas", "mz-varsayim", "mz-ozel"].forEach(function (id) {
    $(id).addEventListener("input", yaz);
    $(id).addEventListener("change", yaz);
  });
  yaz();
})();
