/* Emekli Zammı Hesaplama — arayüz.
   Hesap finans/emekli-zammi-motoru.js'te; burada yalnızca okuma ve yazma.
   Sayfanın statik tabloları aynı motordan tools/emekli-zammi-sayfa.js ile
   üretiliyor, yani ikisi aynı seriden aynı sonucu verir. */
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

  if (d.kesin) $("ez-varsayim-alan").hidden = true;

  function varsayim() {
    var v = $("ez-varsayim").value;
    $("ez-ozel-alan").hidden = v !== "ozel";
    if (v === "gecen-yil") {
      var ilk = d.aylar[d.aciklananSayisi], son = d.aylar[5];
      return { oran: Z.gecenYilAyniAylar(d),
        ad: "geçen yılın aynı ayları (" + Z.AY_ADLARI[ilk.ay - 1] + "–" + Z.AY_ADLARI[son.ay - 1] + " " + (son.yil - 1) + ")" };
    }
    if (v === "ozel") {
      var o = sayi("ez-ozel");
      if (!isFinite(o) || o <= -100) return null;
      return { oran: o / 100, ad: "her ay %" + String(o).replace(".", ",") };
    }
    var n = Number(v);
    return { oran: n, ad: n === 0 ? "aylık enflasyon sıfır" : "her ay %" + String(n * 100).replace(".", ",") };
  }

  function yaz() {
    var aylik = sayi("ez-aylik");
    var oran, aciklama;
    if (d.kesin) {
      oran = d.birikim;
      $("ez-etiket").textContent = d.ad + " zammı · kesinleşti";
      aciklama = "Altı ayın hepsi açıklandı. Aylığınız bu oranda artar.";
    } else {
      var v = varsayim();
      if (!v) { $("ez-oran").textContent = "—"; $("ez-aciklama").textContent = "Geçerli bir aylık oran girin."; return; }
      oran = Z.senaryo(d, v.oran);
      $("ez-etiket").textContent = d.ad + " zammı · senaryo";
      aciklama = d.aciklananSayisi + " ay açıklandı (" + yuzde(d.birikim) + "); kalan " +
        d.eksikSayisi + " ay için varsayım: " + v.ad + ".";
    }
    $("ez-oran").textContent = yuzde(oran);
    $("ez-aciklama").textContent = aciklama;
    $("ez-kesin").textContent = yuzde(d.birikim) + " (" + d.aciklananSayisi + "/6 ay)";

    if (!isFinite(aylik) || aylik <= 0) {
      ["ez-yeni", "ez-artis", "ez-alti"].forEach(function (id) { $(id).textContent = "—"; });
      return;
    }
    var yeni = Z.yeniAylik(aylik, oran);
    $("ez-yeni").textContent = tl(yeni);
    $("ez-artis").textContent = "+" + tl(yeni - aylik);
    $("ez-alti").textContent = "+" + tl((yeni - aylik) * 6);
  }

  ["ez-aylik", "ez-varsayim", "ez-ozel"].forEach(function (id) {
    $(id).addEventListener("input", yaz);
    $(id).addEventListener("change", yaz);
  });
  yaz();
})();
