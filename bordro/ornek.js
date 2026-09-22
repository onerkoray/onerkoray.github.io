/* Sayfadaki canlı örnek, hesap için yalnızca ortak Bordro API'sini kullanır. */
(function () {
  "use strict";
  var B = window.Bordro;
  var form = document.getElementById("bordro-ornek");
  if (!B || !form) return;
  var yil = document.getElementById("ornek-yil");
  var ay = document.getElementById("ornek-ay");
  var tur = document.getElementById("ornek-tur");
  var tutar = document.getElementById("ornek-tutar");
  var hata = document.getElementById("ornek-hata");
  var sonuc = document.getElementById("ornek-sonuc");
  var nf = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
  function yaz(id, metin) { document.getElementById(id).textContent = metin; }
  function secim(el, deger, ad) {
    var o = document.createElement("option");
    o.value = deger; o.textContent = ad; el.appendChild(o);
  }
  B.yillar().forEach(function (y) { secim(yil, y, y); });
  B.AY_ADLARI.forEach(function (ad, i) { secim(ay, i, ad); });

  function hesapla(e) {
    if (e) e.preventDefault();
    var y = Number(yil.value), netMi = tur.value === "net";
    var p = B.parametre(y);
    // Tam yıl / tam ay örneği: her dönemin asgari ücretini karşılamalı.
    var taban = Math.max.apply(null, p.donemler.map(function (d) { return netMi ? d.asgariNet : d.asgariBrut; }));
    tutar.min = taban;
    yaz("ornek-tutar-etiket", netMi ? "Aylık hedef net (TL)" : "Aylık brüt ücret (TL)");
    yaz("ornek-sinir", "Tam yıl örneği için en az " + nf.format(taban) + ". Yıl içindeki tüm asgari ücret dönemleri dikkate alınır.");
    var g = Number(tutar.value);
    var uygun = tutar.value.trim() !== "" && Number.isFinite(g) && g >= taban && g <= Number(tutar.max);
    tutar.setAttribute("aria-invalid", uygun ? "false" : "true");
    if (!uygun) {
      hata.textContent = "Lütfen " + nf.format(taban) + " ile " + nf.format(Number(tutar.max)) + " arasında bir tutar girin.";
      sonuc.hidden = true;
      return;
    }
    hata.textContent = "";
    var brut = netMi ? B.nettenBruteYil(g, y) : g;
    var r = B.hesaplaYil(brut, y), a = r.aylar[Number(ay.value)];
    yaz("ornek-baslik", a.ayAdi + " " + y + " · " + (netMi ? "Sabit net sözleşme" : "Sabit brüt ücret"));
    yaz("ornek-net", nf.format(a.net));
    yaz("ornek-yillik", nf.format(r.toplam.net));
    yaz("ornek-maliyet", nf.format(a.isverenMaliyeti));
    var kalemler = [
      ["Brüt ücret", a.brut], ["SGK işçi payı", a.sgk], ["İşsizlik işçi payı", a.issizlik],
      ["Aylık vergi matrahı", a.matrah], ["Kümülatif vergi matrahı", a.kumulatifMatrah],
      ["Tarifeye göre gelir vergisi", a.vergiTarife], ["Uygulanan istisna / AGİ", a.istisna],
      ["Kesilen gelir vergisi", a.gelirVergisi], ["Damga vergisi", a.damga]
    ];
    var govde = document.getElementById("ornek-kalemler");
    govde.replaceChildren();
    kalemler.forEach(function (k) {
      var tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td");
      th.scope = "row"; th.textContent = k[0]; td.textContent = nf.format(k[1]);
      tr.appendChild(th); tr.appendChild(td); govde.appendChild(tr);
    });
    yaz("ornek-rejim", (p.istisnaRejimi === "agi" ? "AGİ rejimi. Geçmiş yıl sınırlamalarını aşağıda inceleyin." : "Asgari ücret istisnası uygulanır.") +
      " Ocak–Aralık tam çalışma, tek işveren ve teşviksiz maliyet varsayılır. Tutarlar gösterimde kuruşa yuvarlanır.");
    yaz("ornek-kod", (netMi ? "var brutler = Bordro.nettenBruteYil(" + g + ", " + y + ");\nvar sonuc = Bordro.hesaplaYil(brutler, " + y + ");" :
      "var sonuc = Bordro.hesaplaYil(" + g + ", " + y + ");") + "\nsonuc.aylar[" + ay.value + "]; // " + a.ayAdi);
    sonuc.hidden = false;
  }
  form.addEventListener("submit", hesapla);
  [yil, ay, tur].forEach(function (el) { el.addEventListener("change", hesapla); });
  tutar.addEventListener("input", hesapla);
  form.hidden = false;
  hesapla();
})();
