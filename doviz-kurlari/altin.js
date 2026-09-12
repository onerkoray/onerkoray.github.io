/* Serbest piyasa altin/gumus bolumunu sayfa acilinca tazeler.
 *
 * NEDEN YALNIZCA ALTIN: TCMB bulteni is gununde bir kez, 15.30 civari
 * yayimlanir ve sayfa 16.10'da yeniden uretilir - yani ustteki resmi tablo
 * zaten alinabilecek en taze veridir, tarayicidan tekrar cekmek hicbir yeni
 * bilgi getirmez. Ayrica TCMB Access-Control-Allow-Origin gondermiyor, yani
 * tarayicidan cekilmesi teknik olarak da mumkun degil. Altin ise serbest
 * piyasada gun ici hareket ediyor; tazelenmesi gercek bilgi katiyor.
 *
 * SAYFA BUNSUZ DA TAMDIR: butun degerler HTML'e derleme aninda gomulu
 * geliyor. Bu dosya calismazsa (JS kapali, istek engellendi, kaynak coktu)
 * ziyaretci yine de fiyatlari gorur; yalnizca damga eski kalir. Bu yuzden
 * hicbir sey temizlenmiyor, yalnizca UZERINE yaziliyor.
 */
(function () {
  "use strict";

  var KAYNAK = "https://finans.truncgil.com/v4/today.json";
  var govde = document.querySelector("[data-altin-govde]");
  var damga = document.querySelector("[data-altin-damga]");
  if (!govde || !damga) return;

  /* Sunucudaki ALTIN_GOSTER ile ayni sira ve ayni adlar. */
  var KALEMLER = [
    ["GRA", "Gram altın"],
    ["CEYREKALTIN", "Çeyrek altın"],
    ["YARIMALTIN", "Yarım altın"],
    ["TAMALTIN", "Tam altın"],
    ["CUMHURIYETALTINI", "Cumhuriyet altını"],
    ["GUMUS", "Gümüş (gram)"]
  ];

  function tr(n) {
    return Number(n).toLocaleString("tr-TR", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  /* Metin olarak yaziyoruz: gelen veri ucuncu taraftan geliyor ve
     innerHTML ile basmak o kaynagi sayfaya kod yazma hakki vermek olurdu. */
  function hucre(satir, metin) {
    var td = document.createElement("td");
    td.textContent = metin;
    satir.appendChild(td);
  }

  function ciz(veri) {
    var parca = document.createDocumentFragment();
    var yazilan = 0;

    KALEMLER.forEach(function (k) {
      var v = veri[k[0]];
      if (!v || typeof v.Selling !== "number" || v.Selling <= 0) return;

      var tr_ = document.createElement("tr");
      var th = document.createElement("th");
      th.setAttribute("scope", "row");
      th.textContent = k[1];
      tr_.appendChild(th);

      hucre(tr_, typeof v.Buying === "number" && v.Buying > 0 ? tr(v.Buying) : "—");
      hucre(tr_, tr(v.Selling));
      hucre(tr_, typeof v.Change === "number"
        ? (v.Change >= 0 ? "▲" : "▼") + " %" + tr(Math.abs(v.Change))
        : "—");

      parca.appendChild(tr_);
      yazilan++;
    });

    if (!yazilan) return false;
    govde.replaceChildren(parca);
    return true;
  }

  fetch(KAYNAK, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      if (!d || !ciz(d)) return;
      var t = typeof d.Update_Date === "string" ? d.Update_Date : "";
      damga.textContent = t
        ? "Kaynak güncellemesi: " + t + " (bu sayfada tazelendi)"
        : "Bu sayfada tazelendi";
    })
    .catch(function () {
      /* Sessiz gecilir: derleme aninda gomulen degerler ekranda duruyor.
         Kullaniciya "hata" gostermek, gordugu veri dogruyken kafa karistirir. */
    });
})();
