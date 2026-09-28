/*!
 * "Altın mı, dolar mı, mevduat mı?" sayfasının görünümü: sonuç kartları,
 * değer grafiği ve kazanan haritası. Sayfa betiği (tarayıcı) ve
 * tools/varlik-sayfa.js (sunucu tarafı ön çizim) aynı kodu kullanır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var V = root.VarlikMotoru, C = root.GrafikCizim;
  if (!V && typeof require === "function") {
    V = require("../finans/varlik-motoru.js");
    C = require("../grafikler/cizim.js");
  }
  var v = factory(V, C);
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.VarlikGorunum = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function (V, C) {
  "use strict";

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
    "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var sayi = C.sayi, kacis = C.kacis;
  /* Seri sınıfı: kategorik sıra sabit (renk varlığı izler, sırasını değil). */
  var SINIF = { dolar: "bir", altin: "iki", mevduat: "uc", euro: "dort", nakit: "soluk" };

  function tl(v) { return sayi(Math.round(v)) + " TL"; }
  function yuzde(v, d) { return (v < 0 ? "−%" : "%") + sayi(Math.abs(v) * 100, d == null ? 1 : d); }
  function kat(v) { return "×" + sayi(v, v >= 10 ? 1 : 2); }
  function ayAdi(ay) { var p = ay.split("-"); return AYLAR[+p[1] - 1] + " " + p[0]; }
  function ayKisa(ay) { var p = ay.split("-"); return AY_KISA[+p[1] - 1] + " " + p[0]; }

  /* Yıl ekleri: 2005'te, 2010'da, 2026'dan. Ünlü uyumu okunuşun son kelimesinden. */
  function sonKelime(n) {
    var BIR = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
    var ON = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
    if (n % 10) return BIR[n % 10];
    if (n % 100) return ON[(n % 100) / 10];
    return n % 1000 ? "yüz" : "bin";
  }
  function ek(n, son) {
    var k = sonKelime(n), u = (k.match(/[aıoueiöü]/g) || []).pop();
    return "'" + (/[çfhkpsşt]$/.test(k) ? "t" : "d") + ("aıou".indexOf(u) >= 0 ? "a" : "e") + son;
  }
  function ayDa(ay) { return ayAdi(ay) + ek(+ay.slice(0, 4), ""); }
  function sureMetni(ay) {
    var y = Math.floor(ay / 12), m = ay % 12;
    return (y ? y + " yıl" : "") + (y && m ? " " : "") + (m ? m + " ay" : "");
  }

  /* ---- sonuç kartları ---------------------------------------------------- */
  function sonucHtml(o) {
    var kartlar = o.sira.concat(["nakit"]).map(function (k, i) {
      var r = o.sonuclar[k], ilk = i === 0;
      var reelSinif = r.reel >= 0 ? "vk-arti" : "vk-eksi";
      return '<div class="vk-kart vk-' + SINIF[k] + (ilk ? " vk-ilk" : "") + '">' +
        '<span class="vk-ad"><i aria-hidden="true"></i>' + V.ADLAR[k] + (ilk ? ' <b class="vk-rozet">en yüksek</b>' : "") + "</span>" +
        '<strong class="vk-deger">' + tl(r.deger) + "</strong>" +
        '<span class="vk-satir">nominal ' + kat(1 + r.nominal) + " · yıllık " + yuzde(r.yillikNominal) + "</span>" +
        '<span class="vk-satir ' + reelSinif + '">enflasyondan sonra ' + yuzde(r.reel) +
        (o.ay >= 12 ? " (yılda " + yuzde(r.yillikReel) + ")" : "") + "</span>" +
        "</div>";
    }).join("");
    return '<p class="vk-baslik">' + tl(o.tutar) + ", " + ayAdi(o.bas) + " sonunda yatırılsaydı, " + ayAdi(o.son) +
      " sonunda (" + sureMetni(o.ay) + "):</p>" +
      '<div class="vk-kartlar">' + kartlar + "</div>" +
      '<p class="vk-not">Aynı sürede fiyatlar <strong>' + kat(o.tufe.carpan) + "</strong> arttı (yılda " + yuzde(o.tufe.yillik) +
      "). Alım gücünü korumak için " + tl(o.tufe.gereken) + " gerekirdi. Mevduattan kesilen stopaj, bugünkü değeriyle " +
      tl(o.stopajMaliyeti) + " tutuyor.</p>";
  }

  /* ---- değer grafiği (logaritmik) ---------------------------------------- */
  /* 1-2-5 çok sıkışırsa 1-3 (logda neredeyse eşit aralık), o da sıkışırsa
     yalnız 10'un kuvvetleri. Kuvvet sınaması tam sayıyla: log10(1e6) % 1
     kayan noktada 0,9999… çıkıyor ve 1 Mn etiketi düşüyordu. */
  function logIzgara(min, max) {
    function adimla(carpanlar) {
      var liste = [], k = Math.pow(10, Math.floor(Math.log(min) / Math.LN10));
      while (k <= max * 1.0001) {
        carpanlar.forEach(function (c) { var v = Math.round(k * c); if (v >= min && v <= max) liste.push(v); });
        k *= 10;
      }
      return liste;
    }
    var l = adimla([1, 2, 5]);
    if (l.length > 7) l = adimla([1, 3]);
    if (l.length > 7) l = adimla([1]);
    return l;
  }
  function kisaTl(v) {
    if (v >= 1e9) return sayi(v / 1e9, v >= 1e10 ? 0 : 1) + " Mr";
    if (v >= 1e6) return sayi(v / 1e6, v >= 1e7 ? 0 : 1) + " Mn";
    if (v >= 1e3) return sayi(v / 1e3, 0) + " B";
    return sayi(v, 0);
  }
  function grafikSecenek(o, W) {
    var dar = W < 560, y = o.yol;
    var ciz = ["altin", "dolar", "mevduat"];
    var min = Infinity, max = -Infinity;
    y.forEach(function (s) { ciz.concat(["tufe"]).forEach(function (k) { min = Math.min(min, s[k]); max = Math.max(max, s[k]); }); });
    var pay = Math.pow(max / min, 0.04);
    min /= pay; max *= pay;
    var seriler = [{ ad: "TÜFE (gereken)", sinif: "gr-s-soluk", noktalar: y.map(function (s) { return { x: s.ay, y: s.tufe }; }) }]
      .concat(ciz.map(function (k) {
        return { ad: V.ADLAR[k], sinif: "gr-s-" + SINIF[k], noktalar: y.map(function (s) { return { x: s.ay, y: s[k] }; }) };
      }));
    var son = y[y.length - 1], H = dar ? 260 : 340, UST = 18, ALT = 30;
    /* Bitiş etiketleri üst üste binmesin. Her etiket iki satır (~32 px):
       piksel konumuna göre sıralanır, aradaki boşluk 32'den azsa aşağıdaki
       itilir. Nokta yerinde kalır, yalnızca yazı kayar (dy). */
    function py(v) { return H - ALT - (Math.log(v / min) / Math.log(max / min)) * (H - ALT - UST); }
    var notlar = ciz.map(function (k) {
      return { x: son.ay, y: son[k], metin: kisaTl(son[k]), alt: V.ADLAR[k], hiza: "sag", sinif: "gr-not--" + SINIF[k], p: py(son[k]) };
    }).sort(function (a, b) { return a.p - b.p; });
    var onceki = -Infinity;
    notlar.forEach(function (n) {
      var hedef = Math.max(n.p, onceki + 32);
      n.dy = hedef - n.p; onceki = hedef; delete n.p;
    });
    return {
      id: dar ? "varlik-dar" : "varlik", genislik: W, yukseklik: H,
      etiket: tl(o.tutar) + ", " + ayAdi(o.bas) + "–" + ayAdi(o.son) + ": gram altın " + tl(son.altin) + ", dolar " +
        tl(son.dolar) + ", TL mevduat " + tl(son.mevduat) + "; alım gücünü korumak için gereken " + tl(son.tufe) + ".",
      x: { tip: "ay", min: o.bas, max: o.son },
      y: { tip: "log", min: min, max: max, izgara: logIzgara(min, max), bicim: kisaTl },
      seriler: seriler, notlar: dar ? [] : notlar
    };
  }
  function grafikHtml(o) {
    var genis = C.cizgi(grafikSecenek(o, 1000)).svg;
    var dar = C.cizgi(grafikSecenek(o, 380)).svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
    return '<div class="vk-grafik-genis gr-tuval">' + genis + '</div><div class="vk-grafik-dar gr-tuval">' + dar + "</div>" +
      '<ul class="vk-lejant">' + ["altin", "dolar", "mevduat"].map(function (k) {
        return '<li class="vk-' + SINIF[k] + '"><i aria-hidden="true"></i>' + V.ADLAR[k] + "</li>";
      }).join("") + '<li class="vk-soluk vk-kesik"><i aria-hidden="true"></i>TÜFE: alım gücünü korumak için gereken</li></ul>';
  }

  /* ---- kazanan haritası -------------------------------------------------- */
  function haritaHtml(sure) {
    var h = V.harita(sure), yillar = {}, hucre = 22, sol = 44, ust = 22;
    h.forEach(function (x) { var y = x.bas.slice(0, 4); (yillar[y] = yillar[y] || {})[+x.bas.slice(5)] = x; });
    var ys = Object.keys(yillar).sort(), W = sol + 12 * hucre + 2, H = ust + ys.length * hucre + 2;
    var p = ['<svg class="vk-harita-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' +
      kacis(sure / 12 + " yıl tutulduğunda her başlangıç ayında en yüksek sonucu veren varlık. Tablo aşağıda.") + '">'];
    AY_KISA.forEach(function (a, i) {
      p.push('<text class="vk-h-ay" x="' + (sol + i * hucre + hucre / 2) + '" y="14">' + a.charAt(0) + "</text>");
    });
    ys.forEach(function (y, r) {
      var yy = ust + r * hucre;
      p.push('<text class="vk-h-yil" x="' + (sol - 6) + '" y="' + (yy + hucre / 2 + 4) + '">' + y + "</text>");
      for (var m = 1; m <= 12; m++) {
        var x = yillar[y][m];
        if (!x) continue;
        p.push('<rect class="vk-h vk-h-' + SINIF[x.kazanan] + (x.enflasyonuYendi ? "" : " vk-h-yenik") + '" x="' + (sol + (m - 1) * hucre + 1) +
          '" y="' + (yy + 1) + '" width="' + (hucre - 2) + '" height="' + (hucre - 2) + '" rx="3" data-bas="' + x.bas +
          '"><title>' + ayAdi(x.bas) + " → " + ayAdi(x.son) + ": " + V.ADLAR[x.kazanan] + " " + kat(x.carpanlar[x.kazanan]) +
          ", TÜFE " + kat(x.tufe) + "</title></rect>");
      }
    });
    p.push("</svg>");
    var k = V.kazanmaSayilari(sure);
    var lejant = ["altin", "dolar", "euro", "mevduat"].map(function (a) {
      return '<li class="vk-' + SINIF[a] + '"><i aria-hidden="true"></i>' + V.ADLAR[a] + ": <strong>" + k.say[a] + "</strong></li>";
    }).join("");
    return '<div class="vk-harita-kap">' + p.join("") + "</div>" +
      '<ul class="vk-lejant vk-harita-lejant">' + lejant + '<li class="vk-yenik-lejant"><i aria-hidden="true"></i>Soluk kare: en iyisi bile enflasyonun gerisinde</li></ul>' +
      '<p class="vk-not">En iyi seçenek enflasyonu <strong>' + k.enflasyonuYenen + " / " + k.toplam +
      "</strong> başlangıç ayında geçti.</p>";
  }

  /* Tüm süreler için özet tablo (sunucu tarafında yazılır). */
  function sayilarTablosu() {
    var satir = [12, 36, 60, 120].map(function (s) {
      var k = V.kazanmaSayilari(s);
      return "<tr><th scope=\"row\">" + s / 12 + " yıl</th><td class=\"sayi\">" + k.toplam + "</td>" +
        ["altin", "dolar", "euro", "mevduat"].map(function (a) {
          return "<td class=\"sayi\">" + k.say[a] + " <small>(" + yuzde(k.say[a] / k.toplam, 0) + ")</small></td>";
        }).join("") + "</tr>";
    }).join("");
    return '<div class="table-scroll"><table class="veri-tablo vk-tablo"><caption>Başlangıç ayına göre kaç kez hangisi birinci geldi, ' +
      ayAdi(V.ILK) + "–" + ayAdi(V.SON) + "</caption><thead><tr><th scope=\"col\">Tutma süresi</th><th scope=\"col\" class=\"sayi\">Başlangıç</th>" +
      ["altin", "dolar", "euro", "mevduat"].map(function (a) { return '<th scope="col" class="sayi">' + V.ADLAR[a] + "</th>"; }).join("") +
      "</tr></thead><tbody>" + satir + "</tbody></table></div>";
  }

  function stopajTablosu() {
    var satir = V.STOPAJ.map(function (s, i) {
      var p = s.bas.split("-"), bas = +p[2] + " " + AYLAR[+p[1] - 1] + " " + p[0];
      var sonTarih = "";
      if (V.STOPAJ[i + 1]) {
        var d = new Date(Date.UTC(+V.STOPAJ[i + 1].bas.slice(0, 4), +V.STOPAJ[i + 1].bas.slice(5, 7) - 1, +V.STOPAJ[i + 1].bas.slice(8, 10)) - 86400000);
        sonTarih = d.getUTCDate() + " " + AYLAR[d.getUTCMonth()] + " " + d.getUTCFullYear();
      }
      return "<tr><td>" + bas + " – " + (sonTarih || "bugün") + "</td><td class=\"sayi\">%" + sayi(s.oran, s.oran % 1 ? 1 : 0) +
        "</td><td>" + kacis(s.dayanak) + "</td></tr>";
    }).join("");
    return '<div class="table-scroll"><table class="veri-tablo vk-tablo"><caption>TL mevduatta 6 aya kadar vadede stopaj (hesabın açıldığı ya da yenilendiği tarihe göre)</caption>' +
      '<thead><tr><th scope="col">Dönem</th><th scope="col" class="sayi">Stopaj</th><th scope="col">Dayanak</th></tr></thead><tbody>' +
      satir + "</tbody></table></div>";
  }

  return {
    sayi: sayi, tl: tl, yuzde: yuzde, kat: kat, ayAdi: ayAdi, ayKisa: ayKisa, ayDa: ayDa, sureMetni: sureMetni, kacis: kacis,
    kisaTl: kisaTl, SINIF: SINIF,
    sonucHtml: sonucHtml, grafikSecenek: grafikSecenek, grafikHtml: grafikHtml,
    haritaHtml: haritaHtml, sayilarTablosu: sayilarTablosu, stopajTablosu: stopajTablosu,
    VARSAYILAN: { tutar: 100000, bas: V.ILK, son: V.SON, sure: 60 }
  };
});
