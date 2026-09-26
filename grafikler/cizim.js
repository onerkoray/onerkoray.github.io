/*!
 * Grafikler sayfasının SVG çizimi — node'da sayfaya statik, tarayıcıda ekran
 * genişliğinde yeniden çizilir. Aynı fonksiyon, aynı çıktı: JS olmadan ya da
 * arama motorunda görünen grafik, etkileşimli olanla birebir aynıdır.
 *
 * Renk yok: her işaret bir sınıf taşır, renk grafikler.css'teki --dv-*
 * tokenlarından gelir (tools/veri-renkleri.js marka rengini yasaklar).
 * Birim: viewBox genişliği = CSS pikseli; yazı her ekranda aynı boyda kalır.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GrafikCizim = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  function kacis(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Türkçe sayı: binlik nokta, ondalık virgül. */
  function sayi(v, ondalik) {
    var d = ondalik == null ? 0 : ondalik;
    var s = Math.abs(v).toFixed(d).split(".");
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (v < 0 && +Math.abs(v).toFixed(d) !== 0 ? "−" : "") + s.join(",");
  }

  function ayIndeksi(ay) { var p = ay.split("-"); return +p[0] * 12 + (+p[1] - 1); }
  function ayEtiket(ay) { var p = ay.split("-"); return AY_KISA[+p[1] - 1] + " " + p[0]; }

  function r1(v) { return Math.round(v * 10) / 10; }

  /* ---- ölçekler ---------------------------------------------------------- */
  function dogrusal(d0, d1, r0, r1_) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1_ - r0); };
    f.ters = function (p) { return d0 + (p - r0) / (r1_ - r0) * (d1 - d0); };
    return f;
  }
  function logaritmik(d0, d1, r0, r1_) {
    var a = Math.log(d0), b = Math.log(d1);
    var f = function (v) { return r0 + (Math.log(v) - a) / (b - a) * (r1_ - r0); };
    f.ters = function (p) { return Math.exp(a + (p - r0) / (r1_ - r0) * (b - a)); };
    return f;
  }

  /* ---- çizgi grafiği ------------------------------------------------------
     o = {
       id, genislik, yukseklik, etiket (aria),
       x: { tip: "ay" | "yil", min, max },          min/max: "2005-01" ya da 2000
       y: { tip: "lin" | "log", min, max, izgara: [..], bicim: fn },
       seriler: [{ ad, sinif, adim (bool), alan (bool), noktalar: [{x, y}] }],
       notlar:  [{ x, y, metin, alt, hiza: "sol"|"sag", sinif }],
       isaretler: [{ x, metin }],                    x ekseninde dikey çentik
       bantlar: [{ bas, son, sinif, metin }],        x aralığı gölgesi
       sifir: bool
     }                                                                         */
  function cizgi(o) {
    var W = o.genislik, H = o.yukseklik;
    var dar = W < 560;
    var kenar = { sol: dar ? 40 : 52, sag: dar ? 14 : 22, ust: 18, alt: 30 };
    var xDeger = o.x.tip === "ay" ? ayIndeksi : function (v) { return +v; };
    var x = dogrusal(xDeger(o.x.min), xDeger(o.x.max), kenar.sol, W - kenar.sag);
    var yOlcek = o.y.tip === "log" ? logaritmik : dogrusal;
    var y = yOlcek(o.y.min, o.y.max, H - kenar.alt, kenar.ust);
    var bicim = o.y.bicim || function (v) { return sayi(v); };
    var p = [];

    p.push('<svg class="gr-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + kacis(o.etiket) + '" data-grafik="' + o.id + '">');

    // bantlar (x aralığı)
    (o.bantlar || []).forEach(function (b) {
      var x0 = x(xDeger(b.bas)), x1 = x(xDeger(b.son));
      p.push('<rect class="gr-bant ' + (b.sinif || "") + '" x="' + r1(x0) + '" y="' + kenar.ust +
        '" width="' + r1(Math.max(1, x1 - x0)) + '" height="' + (H - kenar.ust - kenar.alt) + '"/>');
      if (b.metin && !dar) {
        p.push('<text class="gr-bant-metin" x="' + r1(x0 + 6) + '" y="' + (kenar.ust + 14) + '">' + kacis(b.metin) + "</text>");
      }
    });

    // yatay ızgara ve y etiketleri
    o.y.izgara.forEach(function (v) {
      var yy = r1(y(v));
      p.push('<line class="gr-izgara" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yy + '" y2="' + yy + '"/>');
      p.push('<text class="gr-eksen gr-eksen-y" x="' + (kenar.sol - 8) + '" y="' + r1(yy + 4) + '">' + kacis(bicim(v)) + "</text>");
    });
    if (o.referans != null) {
      var yr = r1(y(o.referans));
      p.push('<line class="gr-referans" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yr + '" y2="' + yr + '"/>');
    }
    if (o.sifir) {
      var y0 = r1(y(0));
      p.push('<line class="gr-sifir" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + y0 + '" y2="' + y0 + '"/>');
    }

    // x ekseni: yıl çentikleri
    var yil0 = o.x.tip === "ay" ? +String(o.x.min).slice(0, 4) : +o.x.min;
    var yil1 = o.x.tip === "ay" ? +String(o.x.max).slice(0, 4) : +o.x.max;
    var aralik = yil1 - yil0 > 14 ? (dar ? 5 : 2) : (dar ? 2 : 1);
    for (var yil = yil0; yil <= yil1; yil++) {
      if (yil % aralik) continue;
      var xv = o.x.tip === "ay" ? yil * 12 : yil;
      if (xv < xDeger(o.x.min) || xv > xDeger(o.x.max)) continue;
      var xx = r1(x(xv));
      p.push('<line class="gr-centik" x1="' + xx + '" x2="' + xx + '" y1="' + (H - kenar.alt) + '" y2="' + (H - kenar.alt + 5) + '"/>');
      p.push('<text class="gr-eksen gr-eksen-x" x="' + xx + '" y="' + (H - kenar.alt + 18) + '">' + yil + "</text>");
    }

    // seriler
    o.seriler.forEach(function (s, si) {
      var d = "", onceki = null, alanYol = "";
      s.noktalar.forEach(function (n, i) {
        if (n.y == null) { onceki = null; return; }
        var px = r1(x(xDeger(n.x))), py = r1(y(n.y));
        if (onceki === null) d += "M" + px + " " + py;
        else if (s.adim) d += "H" + px + "V" + py;
        else d += "L" + px + " " + py;
        onceki = [px, py];
      });
      if (s.alan) {
        var ilk = s.noktalar[0], son = s.noktalar[s.noktalar.length - 1];
        var taban = r1(y(o.y.tip === "log" ? o.y.min : Math.max(o.y.min, 0)));
        alanYol = d + "V" + taban + "H" + r1(x(xDeger(ilk.x))) + "Z";
        p.push('<path class="gr-alan ' + s.sinif + '" d="' + alanYol + '"/>');
      }
      p.push('<path class="gr-cizgi ' + s.sinif + '" data-seri="' + si + '" d="' + d + '"/>');
    });

    // dikey işaretler (ör. ikiye katlanma anları)
    (o.isaretler || []).forEach(function (m, i) {
      var xx = r1(x(xDeger(m.x))), yy = r1(y(m.y));
      p.push('<g class="gr-isaret" style="--sira:' + i + '">');
      p.push('<line x1="' + xx + '" x2="' + xx + '" y1="' + yy + '" y2="' + (H - kenar.alt) + '"/>');
      p.push('<circle cx="' + xx + '" cy="' + yy + '" r="3.5"/>');
      if (m.metin) {
        // Eğri sağa doğru yükseliyor: noktanın sağ altı boş. Sağ kenara
        // yakınsa etiket sola döner (bitiş notuyla çakışmasın).
        var sagaSigar = xx + 90 < W - kenar.sag;
        p.push('<text x="' + r1(sagaSigar ? xx + 7 : xx - 7) + '" y="' + r1(yy + 17) + '" text-anchor="' +
          (sagaSigar ? "start" : "end") + '">' + kacis(m.metin) + "</text>");
      }
      p.push("</g>");
    });

    // notlar (nokta + etiket)
    (o.notlar || []).forEach(function (n) {
      var xx = r1(x(xDeger(n.x))), yy = r1(y(n.y));
      var sag = n.hiza === "sag";
      var tx = sag ? xx - 10 : xx + 10;
      var ty = yy + (n.dy || 0);
      p.push('<g class="gr-not ' + (n.sinif || "") + '">');
      p.push('<circle class="gr-not-hale" cx="' + xx + '" cy="' + yy + '" r="9"/>');
      p.push('<circle class="gr-not-nokta" cx="' + xx + '" cy="' + yy + '" r="4"/>');
      p.push('<text class="gr-not-metin" x="' + tx + '" y="' + r1(ty - (n.alt ? 6 : -4)) + '" text-anchor="' + (sag ? "end" : "start") + '">' + kacis(n.metin) + "</text>");
      if (n.alt) {
        p.push('<text class="gr-not-alt" x="' + tx + '" y="' + r1(ty + 10) + '" text-anchor="' + (sag ? "end" : "start") + '">' + kacis(n.alt) + "</text>");
      }
      p.push("</g>");
    });

    // etkileşim katmanı: tarayıcı üzerine çizer
    p.push('<g class="gr-imlec" aria-hidden="true"></g>');
    p.push("</svg>");
    return { svg: p.join(""), x: x, y: y, kenar: kenar, xDeger: xDeger };
  }

  /* ---- ayrışan çubuklar (reel faiz) ---------------------------------------
     o = { id, genislik, yukseklik, etiket, noktalar: [{x: ay, y}], y: {min, max, izgara, bicim}, x: {min, max} } */
  function cubukAyrisan(o) {
    var W = o.genislik, H = o.yukseklik, dar = W < 560;
    var yillik = o.x.tip === "yil";
    var xd = yillik ? function (v) { return +v; } : ayIndeksi;
    var kenar = { sol: dar ? 40 : 52, sag: dar ? 14 : 22, ust: 12, alt: 30 };
    var x = dogrusal(xd(o.x.min), xd(o.x.max) + 1, kenar.sol, W - kenar.sag);
    var y = dogrusal(o.y.min, o.y.max, H - kenar.alt, kenar.ust);
    var bicim = o.y.bicim;
    var adet = xd(o.x.max) - xd(o.x.min) + 1;
    var bosluk = yillik ? Math.max(2, (W - kenar.sol - kenar.sag) / adet * 0.28) : 0.6;
    var gen = Math.max(0.6, (W - kenar.sol - kenar.sag) / adet - bosluk);
    var p = ['<svg class="gr-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + kacis(o.etiket) + '" data-grafik="' + o.id + '">'];
    o.y.izgara.forEach(function (v) {
      var yy = r1(y(v));
      p.push('<line class="gr-izgara" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yy + '" y2="' + yy + '"/>');
      p.push('<text class="gr-eksen gr-eksen-y" x="' + (kenar.sol - 8) + '" y="' + r1(yy + 4) + '">' + kacis(bicim(v)) + "</text>");
    });
    var y0 = r1(y(0));
    o.noktalar.forEach(function (n, i) {
      var xx = r1(x(xd(n.x)) + (yillik ? bosluk / 2 : 0.3)), yy = r1(y(n.y));
      var ust = Math.min(y0, yy), boy = Math.max(0.5, Math.abs(yy - y0));
      p.push('<rect class="gr-cubuk ' + (n.y < 0 ? "gr-kayip" : "gr-kazanc") + '" x="' + xx + '" y="' + r1(ust) +
        '" width="' + r1(gen) + '" height="' + r1(boy) + '" style="--i:' + i + '"/>');
    });
    p.push('<line class="gr-sifir" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + y0 + '" y2="' + y0 + '"/>');
    var yil0 = +String(o.x.min).slice(0, 4), yil1 = +String(o.x.max).slice(0, 4);
    var aralik = yillik ? (dar ? 5 : 2) : (dar ? 4 : 2);
    for (var yil = yil0; yil <= yil1; yil++) {
      if (yil % aralik || (!yillik && yil * 12 < ayIndeksi(o.x.min))) continue;
      var xx = r1(yillik ? x(yil) + (W - kenar.sol - kenar.sag) / adet / 2 : x(yil * 12));
      p.push('<line class="gr-centik" x1="' + xx + '" x2="' + xx + '" y1="' + (H - kenar.alt) + '" y2="' + (H - kenar.alt + 5) + '"/>');
      p.push('<text class="gr-eksen gr-eksen-x" x="' + xx + '" y="' + (H - kenar.alt + 18) + '">' + yil + "</text>");
    }
    p.push('<g class="gr-imlec" aria-hidden="true"></g></svg>');
    return { svg: p.join(""), x: x, y: y, kenar: kenar, xDeger: xd, gen: gen, bosluk: yillik ? bosluk : 0 };
  }

  /* ---- sıralı yatay çubuklar (dünya) — logaritmik x ------------------------
     o = { id, genislik, etiket, liste: [{ad, deger, vurgu}], x: {min, max, izgara}, ortanca } */
  function siraCubuk(o) {
    var W = o.genislik, dar = W < 560;
    var satir = dar ? 22 : 24;
    var kenar = { sol: dar ? 104 : 136, sag: dar ? 52 : 64, ust: 10, alt: 28 };
    var H = kenar.ust + kenar.alt + satir * o.liste.length;
    var lin = o.x.tip === "lin";
    var x = (lin ? dogrusal : logaritmik)(o.x.min, o.x.max, kenar.sol + (lin && o.x.min < 0 ? 0 : 0), W - kenar.sag);
    var sifirX = lin ? x(Math.max(o.x.min, 0)) : kenar.sol;
    var bicimX = o.x.bicim || function (v) { return "%" + sayi(v, v < 1 && v > 0 ? 1 : 0); };
    var p = ['<svg class="gr-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + kacis(o.etiket) + '" data-grafik="' + o.id + '">'];
    o.x.izgara.forEach(function (v) {
      var xx = r1(x(v));
      p.push('<line class="gr-izgara" x1="' + xx + '" x2="' + xx + '" y1="' + kenar.ust + '" y2="' + (H - kenar.alt) + '"/>');
      p.push('<text class="gr-eksen gr-eksen-x" x="' + xx + '" y="' + (H - kenar.alt + 18) + '">' + kacis(bicimX(v)) + "</text>");
    });
    o.liste.forEach(function (u, i) {
      var yy = kenar.ust + i * satir;
      var deger = Math.max(o.x.min, u.deger);
      var bitis = r1(x(deger));
      var eksi = u.deger < 0;
      var bas = eksi ? bitis : sifirX, gen = Math.max(2, Math.abs(bitis - sifirX));
      var etiket = (eksi ? "−%" : "%") + sayi(Math.abs(u.deger), 1);
      p.push('<g class="gr-sira' + (u.vurgu ? " gr-sira--vurgu" : "") + (eksi ? " gr-sira--eksi" : "") + '" style="--i:' + i + '">');
      p.push('<text class="gr-sira-ad" x="' + (kenar.sol - 10) + '" y="' + (yy + satir / 2 + 4) + '">' + kacis(u.ad) + "</text>");
      p.push('<rect class="gr-sira-cubuk" x="' + r1(bas) + '" y="' + (yy + 5) + '" width="' + r1(gen) +
        '" height="' + (satir - 10) + '" rx="2"/>');
      p.push('<text class="gr-sira-deger" x="' + r1(eksi ? sifirX + 6 : bitis + 6) + '" y="' + (yy + satir / 2 + 4) + '">' + etiket + "</text>");
      p.push("</g>");
    });
    if (lin && o.x.min < 0) {
      p.push('<line class="gr-sifir" x1="' + r1(sifirX) + '" x2="' + r1(sifirX) + '" y1="' + (kenar.ust - 4) + '" y2="' + (H - kenar.alt) + '"/>');
    }
    if (o.ortanca != null) {
      var xo = r1(x(o.ortanca));
      p.push('<line class="gr-ortanca" x1="' + xo + '" x2="' + xo + '" y1="' + (kenar.ust - 4) + '" y2="' + (H - kenar.alt) + '"/>');
    }
    p.push("</svg>");
    return { svg: p.join(""), H: H };
  }

  /* ---- ısı haritası (yıl × ay) ---------------------------------------------
     o = { id, genislik, etiket, satirlar: [{ yil, aylar: [12 değer | null] }], esikler: [..] }
     Renk sınıfı eşikten: gr-isi-e (eksi), gr-isi-1 … gr-isi-6. Değer yazısı
     hücre yeterince genişse basılır; dar ekranda ipucu okur. */
  function isi(o) {
    var W = o.genislik, dar = W < 560;
    var kenar = { sol: dar ? 34 : 46, sag: 4, ust: 22, alt: 6 };
    var hg = (W - kenar.sol - kenar.sag) / 12, hy = dar ? 15 : 19;
    var H = kenar.ust + kenar.alt + hy * o.satirlar.length;
    var yazili = hg >= 50;
    var p = ['<svg class="gr-svg gr-isi" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + kacis(o.etiket) + '" data-grafik="' + o.id + '">'];
    AY_KISA.forEach(function (a, i) {
      p.push('<text class="gr-eksen gr-eksen-x" x="' + r1(kenar.sol + hg * (i + .5)) + '" y="' + (kenar.ust - 8) + '">' +
        (dar ? a.charAt(0) : a) + "</text>");
    });
    o.satirlar.forEach(function (s, r) {
      var yy = kenar.ust + r * hy;
      p.push('<text class="gr-eksen gr-eksen-y" x="' + (kenar.sol - 6) + '" y="' + r1(yy + hy / 2 + 4) + '">' +
        (dar ? "'" + String(s.yil).slice(2) : s.yil) + "</text>");
      s.aylar.forEach(function (v, i) {
        if (v == null) return;
        var sinif = "gr-isi-e";
        if (v >= 0) { sinif = "gr-isi-1"; o.esikler.forEach(function (e, k) { if (v >= e) sinif = "gr-isi-" + (k + 2); }); }
        var xx = kenar.sol + i * hg;
        p.push('<rect class="gr-isi-hucre ' + sinif + '" x="' + r1(xx + .5) + '" y="' + r1(yy + .5) + '" width="' + r1(hg - 1) +
          '" height="' + r1(hy - 1) + '" data-ay="' + s.yil + "-" + (i < 9 ? "0" : "") + (i + 1) + '" data-v="' + v + '"/>');
        if (yazili) {
          p.push('<text class="gr-isi-yazi ' + sinif + '" x="' + r1(xx + hg / 2) + '" y="' + r1(yy + hy / 2 + 4) + '">' +
            sayi(v, 1) + "</text>");
        }
      });
    });
    p.push("</svg>");
    return { svg: p.join(""), H: H };
  }

  return {
    isi: isi,
    cizgi: cizgi,
    cubukAyrisan: cubukAyrisan,
    siraCubuk: siraCubuk,
    sayi: sayi,
    ayEtiket: ayEtiket,
    ayIndeksi: ayIndeksi,
    kacis: kacis
  };
});
