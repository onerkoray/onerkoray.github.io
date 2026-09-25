/*!
 * TL mi döviz mi — arayüz.
 *
 * Hesap YAPMAZ: bütün sayılar finans/doviz-basabas.js'ten; o da mevduat
 * hesabını finans/kurallar.js'ten alır. Kur alanı, kullanıcı değiştirmediyse,
 * gece güncellenen TCMB serisinin son değeriyle doldurulur.
 */
(function () {
  "use strict";

  var D = window.DovizBasabas;
  if (!D) return;
  function $(id) { return document.getElementById(id); }
  var form = $("tb-form"), cikti = $("tb-sonuc"), mesaj = $("tb-mesaj");
  if (!form || !cikti) return;

  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf4 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  function tl(n) { return nf2.format(n) + " TL"; }
  function yuzde(o) { return "%" + nf2.format(Math.abs(o) * 100); }
  function isaretli(o) { return (o >= 0 ? "+" : "−") + yuzde(o); }
  var SEMBOL = { USD: "$", EUR: "€" };

  function sayi(id) {
    var t = String($(id).value || "").trim();
    if (!t) return null;
    var v = parseFloat(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isFinite(v) ? v : null;
  }

  /* Son TCMB kuru: kullanıcı kur alanına dokunmadıysa doldurulur. */
  var seri = null, kurElle = false;
  $("tb-kur").addEventListener("input", function () { kurElle = true; });
  function kurDoldur() {
    if (!seri || kurElle) return;
    var son = seri.kayitlar[seri.kayitlar.length - 1], para = $("tb-para").value;
    if (!son || !son[para]) return;
    $("tb-kur").value = nf4.format(son[para]);
    $("tb-ornek").textContent = "Faiz oranları örnektir; bankanızın size verdiği oranı yazın. Kur: TCMB döviz satış, " +
      son.tarih.split("-").reverse().join(".") + ".";
  }
  $("tb-para").addEventListener("change", function () { kurDoldur(); });
  if (window.fetch) {
    fetch("../doviz-kurlari/seri.json").then(function (y) { return y.ok ? y.json() : null; })
      .then(function (j) { if (j && j.kayitlar && j.kayitlar.length) { seri = j; kurDoldur(); calistir(); } })
      .catch(function () {});
  }

  function satir(dt, dd) { return "<div><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"; }
  var VADELER = [32, 92, 181, 182, 365, 366, 730];
  var DEGISIMLER = [-0.05, 0, 0.025, null, 0.05, 0.10];

  function calistir() {
    var g = {
      anapara: sayi("tb-anapara"), tlFaiz: sayi("tb-tl-faiz"), dovizFaiz: sayi("tb-doviz-faiz"),
      gun: sayi("tb-gun"), kur: sayi("tb-kur"), makas: (sayi("tb-makas") || 0) / 100
    };
    var para = $("tb-para").value, sb = SEMBOL[para];
    cikti.innerHTML = "";
    if (g.anapara === null || g.tlFaiz === null || g.dovizFaiz === null || g.gun === null || g.kur === null) {
      mesaj.textContent = "Tutarları girin; hesap otomatik çalışır."; return;
    }
    try {
      var r = D.hesapla(g), h = [];
      h.push('<div class="tb-manset"><p>Kur ' + r.girdi.gun + " gün sonra <strong>" + nf4.format(r.basabasKur) +
        " TL</strong>'nin üstündeyse döviz, altındaysa TL kazanır.</p>" +
        "<p>Bu, kurun vade boyunca " + yuzde(r.gerekenArtis) + " artması demek; aynı getiriyle bir yıl yenilense yıllık " +
        yuzde(r.yillikArtis) + ".</p></div>");
      h.push('<div class="tb-kartlar">' +
        '<div class="tb-kart"><span class="tb-kart-ad">TL mevduat, vade sonu</span><span class="tb-kart-deger">' + tl(r.tl.vadeSonu) + "</span>" +
        '<span class="tb-kart-alt">Net faiz ' + tl(r.tl.net) + " · stopaj %" + nf2.format(r.tl.stopajOrani * 100) + "</span></div>" +
        '<div class="tb-kart"><span class="tb-kart-ad">Döviz mevduatı, vade sonu</span><span class="tb-kart-deger">' + nf2.format(r.doviz.vadeSonu) + " " + sb + "</span>" +
        '<span class="tb-kart-alt">' + nf2.format(r.doviz.anapara) + " " + sb + " anapara · net faiz " + nf2.format(r.doviz.net) + " " + sb + " · stopaj %25</span></div>" +
        "</div>");

      var sc = D.senaryo(g, DEGISIMLER.map(function (d) { return d === null ? r.gerekenArtis : d; }));
      var t = ['<div class="table-scroll"><table class="data-table tb-tablo"><caption>Vade sonunda kur şöyle olursa</caption>',
        '<thead><tr><th scope="col">Kur değişimi</th><th scope="col">Kur</th><th scope="col">Döviz yolu (TL)</th><th scope="col">TL yoluna göre</th></tr></thead><tbody>'];
      sc.forEach(function (s, i) {
        var bb = DEGISIMLER[i] === null;
        t.push("<tr" + (bb ? ' class="tb-basabas"' : "") + "><td>" + (bb ? "Başabaş " : "") + isaretli(s.degisim) + "</td><td>" + nf4.format(s.kur) +
          "</td><td>" + tl(s.dovizTl) + "</td><td>" + (Math.abs(s.fark) < 0.005 ? "eşit" : (s.fark > 0 ? "döviz önde " : "TL önde ") + tl(Math.abs(s.fark))) + "</td></tr>");
      });
      t.push("</tbody></table></div>");
      h.push(t.join(""));

      var v = D.vadeler(g, VADELER);
      var u = ['<div class="table-scroll"><table class="data-table tb-tablo"><caption>Aynı faizlerle farklı vadelerde gereken kur artışı</caption>',
        '<thead><tr><th scope="col">Vade</th><th scope="col">TL stopajı</th><th scope="col">Vade boyunca</th><th scope="col">Yıllık karşılık</th></tr></thead><tbody>'];
      v.forEach(function (x) {
        u.push("<tr" + (x.gun === r.girdi.gun ? ' class="tb-basabas"' : "") + "><td>" + x.gun + " gün</td><td>%" + nf2.format(x.stopajTl * 100) +
          "</td><td>" + yuzde(x.gerekenArtis) + "</td><td>" + yuzde(x.yillikArtis) + "</td></tr>");
      });
      u.push("</tbody></table></div>");
      h.push(u.join(""));

      var dl = ['<dl class="tb-olcu">'];
      dl.push(satir("TL brüt faiz", tl(r.tl.brut)));
      dl.push(satir("TL stopajı", tl(r.tl.stopaj)));
      dl.push(satir("Döviz brüt faiz", nf2.format(r.doviz.brut) + " " + sb));
      dl.push(satir("Döviz stopajı", nf2.format(r.doviz.stopaj) + " " + sb));
      if (r.girdi.makas > 0) dl.push(satir("Makasla bozdurma kuru (başabaşta)", nf4.format(r.basabasKur * (1 - r.girdi.makas)) + " TL"));
      dl.push("</dl>");
      h.push(dl.join(""));
      cikti.innerHTML = h.join("");
      mesaj.textContent = "Hesap tarayıcınızda yapıldı; girdiğiniz tutarlar hiçbir yere gönderilmedi.";
    } catch (e) {
      mesaj.textContent = e.message;
    }
  }
  var bekle;
  form.addEventListener("input", function () { clearTimeout(bekle); bekle = setTimeout(calistir, 80); });
  form.addEventListener("change", calistir);
  form.addEventListener("submit", function (e) { e.preventDefault(); calistir(); });
  calistir();
})();
