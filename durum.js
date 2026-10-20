/* Araç durumunu adreste tutan tek yer: paylaşılabilir hesap bağlantısı.
 *
 * Durum yalnız # sonrasında durur (#kira=15000&tarih=2026-10). Adresin bu
 * kısmı tarayıcıdan hiçbir isteğe çıkmaz: sunucu kaydına, analitiğe ya da
 * başka bir siteye giden "referrer" bilgisine girmez. Gizlilik sayfasının
 * "hesaplama verileriniz cihazınızdan çıkmaz" sözü buna dayanıyor.
 *
 * 20 Ekim 2026'ya kadar üç araç ve site araması durumu sorgu dizesinde (?kira=...)
 * tutuyordu; o kısım sayfa isteğiyle sunucuya ve analitiğe gider. Eski
 * bağlantılar çalışmaya devam etsin diye sorgu dizesi bir kez okunur ve
 * adres hemen # biçimine çevrilir.
 *
 * Sayfa içi çapalar (#hesapla) "=" taşımadığı için durumdan ayrılır ve
 * durum boşken korunur.
 *
 * İzlenen kural (tools/ayak-izi-test.js): location.search'ü bu dosyadan başka
 * hiçbir site betiği okuyamaz; adres yazan çağrı "?" kuramaz.
 */
(function (root) {
  "use strict";

  /* Saf kısım: tarayıcısız sınanabilir. */
  function ayristir(arama, parca) {
    var h = String(parca || "").replace(/^#/, "");
    if (h.indexOf("=") >= 0) return { durum: new URLSearchParams(h), eski: false };
    var q = String(arama || "").replace(/^\?/, "");
    if (q.indexOf("=") >= 0) return { durum: new URLSearchParams(q), eski: true };
    return { durum: new URLSearchParams(), eski: false };
  }

  function adres(yol, durum, parca) {
    var s = durum.toString();
    if (s) return yol + "#" + s;
    var h = String(parca || "").replace(/^#/, "");
    return yol + (h && h.indexOf("=") < 0 ? "#" + h : "");
  }

  function oku() {
    var l = root.location;
    var r = ayristir(l.search, l.hash);
    /* Eski ?... bağlantısı: sorgu dizesini hemen adresten kaldır. */
    if (r.eski) root.history.replaceState(null, "", adres(l.pathname, r.durum, ""));
    return r.durum;
  }

  function yaz(durum) {
    var l = root.location;
    var hedef = adres(l.pathname, durum, l.hash);
    if (hedef !== l.pathname + l.search + l.hash) root.history.replaceState(null, "", hedef);
  }

  var Durum = { oku: oku, yaz: yaz, ayristir: ayristir, adres: adres };
  if (typeof module === "object" && module.exports) module.exports = Durum;
  else root.Durum = Durum;
})(typeof window !== "undefined" ? window : this);
