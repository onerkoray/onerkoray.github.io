/*!
 * Diyagramlar sayfasının SVG çizimi. Node'da sayfaya statik yazılır,
 * tarayıcıda kutu genişliğinde yeniden çizilir: aynı fonksiyon, aynı çıktı.
 *
 * Renk yok: her işaret anlam sınıfı taşır, renk diyagramlar.css'teki --dv-*
 * tokenlarından gelir. Anlam bütün sayfada aynı:
 *   dg-net    sana kalan (net ücret, kredide anapara)   --dv-1
 *   dg-vergi  vergi ve faiz, geri dönmeyen maliyet      --dv-2
 *   dg-prim   sosyal güvenlik primi, karşılığı olan     --dv-mute
 * Birim: viewBox genişliği = CSS pikseli; yazı her ekranda aynı boyda kalır.
 *
 * Her işaret data-ipucu taşır: "başlık||ad::değer::sınıf||…". Tarayıcı
 * ipucunu bundan kurar; JS'siz okur için her şeklin tablosu var.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.DiyagramCizim = v;
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
  function tl(v) { return sayi(v) + " TL"; }
  function yuzde(oran, d) { return "%" + sayi(oran * 100, d == null ? 1 : d); }
  /* Eksen için kısa tutar: 33 bin, 297 bin, 1,32 mn */
  function kisa(v) {
    if (v >= 1e6) return sayi(v / 1e6, 2) + " mn";
    return sayi(Math.round(v / 1000)) + " bin";
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function ipucu(baslik, satirlar) {
    return kacis(baslik + satirlar.map(function (s) { return "||" + s[0] + "::" + s[1] + "::" + (s[2] || ""); }).join(""));
  }
  function svgAc(W, H, etiket, id) {
    return '<svg class="dg-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + kacis(etiket) + '" data-diyagram="' + id + '">';
  }
  function yazi(sinif, x, y, metin, hiza) {
    return '<text class="' + sinif + '" x="' + r1(x) + '" y="' + r1(y) + '"' +
      (hiza ? ' text-anchor="' + hiza + '"' : "") + ">" + kacis(metin) + "</text>";
  }

  /* ================================================================ SANKEY
     İşveren maliyeti → (brüt ücret | işveren primi) → (net | vergi | prim).
     Değerler 100 liralık birimde yazılır: soru "ne kadarı" değil "kaçta kaçı". */
  function sankey(o) {
    var W = o.genislik, dar = W < 640;
    var u = o.veri, t = u.yillik;
    var toplam = t.isverenMaliyeti;
    var calisanPrim = t.sgk + t.issizlik;
    var vergi = t.gelirVergisi + t.damga;
    var prim = calisanPrim + t.isverenPrim;
    var H = dar ? 380 : 420;
    var kenar = { ust: 40, alt: 10, sol: dar ? 4 : 168, sag: dar ? 122 : 226 };
    var en = dar ? 10 : 14;
    var bosluk = dar ? 16 : 24;
    var olcek = (H - kenar.ust - kenar.alt - 2 * bosluk) / toplam;
    var x0 = kenar.sol, x2 = W - kenar.sag - en, x1 = Math.round((x0 + x2) / 2 + (dar ? 6 : 0));
    var yuz = function (v) { return sayi(v / toplam * 100, 1); };

    // düğümler
    var d0 = { x: x0, y: kenar.ust + bosluk, h: toplam * olcek };
    var dBrut = { x: x1, y: kenar.ust + bosluk / 2, h: t.brut * olcek };
    var dIsv = { x: x1, y: dBrut.y + dBrut.h + bosluk, h: t.isverenPrim * olcek };
    var dNet = { x: x2, y: kenar.ust, h: t.net * olcek };
    var dVer = { x: x2, y: dNet.y + dNet.h + bosluk, h: vergi * olcek };
    var dPrim = { x: x2, y: dVer.y + dVer.h + bosluk, h: prim * olcek };

    function bant(xa, ya, xb, yb, w) {
      var xm = (xa + xb) / 2;
      return "M" + r1(xa) + " " + r1(ya) + "C" + r1(xm) + " " + r1(ya) + " " + r1(xm) + " " + r1(yb) + " " + r1(xb) + " " + r1(yb) +
        "V" + r1(yb + w) + "C" + r1(xm) + " " + r1(yb + w) + " " + r1(xm) + " " + r1(ya + w) + " " + r1(xa) + " " + r1(ya + w) + "Z";
    }
    var p = [svgAc(W, H, o.etiket, "sankey")];

    // sütun başlıkları
    var bas = dar ? ["İşveren", "Bordro", "Nereye"] : ["İşveren öder", "Bordroda", "Nereye gider"];
    p.push(yazi("dg-sutun", dar ? x0 : x0 + en, 14, bas[0], dar ? "start" : "end"));
    p.push(yazi("dg-sutun", x1 + en / 2, 14, bas[1], "middle"));
    p.push(yazi("dg-sutun", x2, 14, bas[2], "start"));

    // bağlantılar: önce nötr akış, sonra anlamlı kollar
    var baglar = [
      { s: "dg-akis", d: bant(x0 + en, d0.y, x1, dBrut.y, t.brut * olcek), ad: "Brüt ücret", v: t.brut },
      { s: "dg-prim", d: bant(x0 + en, d0.y + t.brut * olcek, x1, dIsv.y, t.isverenPrim * olcek), ad: "İşveren primi (SGK + işsizlik)", v: t.isverenPrim },
      { s: "dg-net", d: bant(x1 + en, dBrut.y, x2, dNet.y, t.net * olcek), ad: "Net ücret", v: t.net },
      { s: "dg-vergi", d: bant(x1 + en, dBrut.y + t.net * olcek, x2, dVer.y, vergi * olcek), ad: "Gelir vergisi + damga vergisi", v: vergi },
      { s: "dg-prim", d: bant(x1 + en, dBrut.y + (t.net + vergi) * olcek, x2, dPrim.y, calisanPrim * olcek), ad: "Çalışan primi (SGK + işsizlik)", v: calisanPrim },
      { s: "dg-prim", d: bant(x1 + en, dIsv.y, x2, dPrim.y + calisanPrim * olcek, t.isverenPrim * olcek), ad: "İşveren primi (SGK + işsizlik)", v: t.isverenPrim }
    ];
    p.push('<g class="dg-baglar">');
    baglar.forEach(function (b, i) {
      p.push('<path class="dg-bag ' + b.s + '" d="' + b.d + '" data-ipucu="' +
        ipucu(b.ad, [["Yılda", tl(b.v)], ["Ayda", tl(b.v / 12)], ["100 liranın", yuz(b.v) + " TL"]]) + '" style="--i:' + i + '"/>');
    });
    p.push("</g>");

    // düğüm çubukları
    function dugum(d, sinif) {
      return '<rect class="dg-dugum ' + sinif + '" x="' + r1(d.x) + '" y="' + r1(d.y) + '" width="' + en + '" height="' + r1(Math.max(1, d.h)) + '"/>';
    }
    p.push(dugum(d0, "dg-d-kaynak"), dugum(dBrut, "dg-d-kaynak"), dugum(dIsv, "dg-prim"),
      dugum(dNet, "dg-net"), dugum(dVer, "dg-vergi"), dugum(dPrim, "dg-prim"));

    // etiketler
    if (dar) {
      p.push(yazi("dg-etiket", x0, d0.y - 8, "100 TL"));
    } else {
      var ey = d0.y + d0.h / 2;
      p.push(yazi("dg-etiket", x0 - 12, ey - 22, "İşveren maliyeti", "end"));
      p.push(yazi("dg-buyuk", x0 - 12, ey + 6, "100 TL", "end"));
      p.push(yazi("dg-kucuk", x0 - 12, ey + 26, "yılda " + tl(toplam), "end"));
    }
    /* Dar ekranda ara etiket düğümün soluna, gelen akışın üstüne yazılır:
       sağda son sütunun etiketleriyle çarpışırdı. */
    function araEtiket(d, ad, v) {
      var x = dar ? d.x - 6 : d.x + en + 8, y = d.y + 16;
      p.push('<text class="dg-ara" x="' + r1(x) + '" y="' + r1(y) + '"' + (dar ? ' text-anchor="end"' : "") + ">" + kacis(ad) +
        ' <tspan class="dg-ara-deger">' + yuz(v) + "</tspan></text>");
    }
    araEtiket(dBrut, dar ? "Brüt" : "Brüt ücret", t.brut);
    araEtiket(dIsv, dar ? "İşv. primi" : "İşveren primi", t.isverenPrim);

    function sonEtiket(d, ad, v, sinif) {
      var x = d.x + en + 10, orta = d.y + d.h / 2;
      var ince = d.h < 44;
      p.push('<g class="dg-son ' + sinif + '">');
      if (ince) {
        p.push('<text class="dg-etiket" x="' + r1(x) + '" y="' + r1(orta + 5) + '">' + kacis(ad) +
          ' <tspan class="dg-orta-deger">' + yuz(v) + "</tspan></text>");
      } else {
        p.push(yazi("dg-etiket", x, orta - (dar ? 8 : 12), ad));
        p.push(yazi("dg-buyuk dg-renkli", x, orta + (dar ? 14 : 16), yuz(v) + " TL"));
        if (!dar) p.push(yazi("dg-kucuk", x, orta + 34, "ayda " + tl(v / 12)));
      }
      p.push("</g>");
    }
    sonEtiket(dNet, dar ? "Net ücret" : "Çalışana net", t.net, "dg-net");
    sonEtiket(dVer, "Vergi", vergi, "dg-vergi");
    sonEtiket(dPrim, dar ? "SGK primi" : "SGK primleri", prim, "dg-prim");

    p.push("</svg>");
    return { svg: p.join(""), H: H };
  }

  /* ========================================================= AYLIK NET
     On iki sütun, her biri aynı brüt. Alttan: net, vergi, prim. Brüt sabit
     olduğu için net katmanının üst kenarı ay ay aşağı iner; kesikli çizgi
     Ocak netini tutar ki fark gözle ölçülsün. */
  function aylik(o) {
    var W = o.genislik, dar = W < 640;
    var u = o.veri, A = u.aylar;
    var H = dar ? 300 : 340;
    var kenar = { sol: dar ? 42 : 58, sag: dar ? 6 : 132, ust: 40, alt: 30 };
    var tepe = u.brutAy;
    var adim = guzelAdim(tepe / 4);
    var ustSinir = Math.ceil(tepe / adim) * adim;
    var y = function (v) { return H - kenar.alt - v / ustSinir * (H - kenar.ust - kenar.alt); };
    var yuva = (W - kenar.sol - kenar.sag) / 12;
    var gen = Math.min(46, yuva * (dar ? 0.7 : 0.62));
    var p = [svgAc(W, H, o.etiket, "aylik")];

    for (var g = 0; g <= ustSinir + 1; g += adim) {
      var yy = r1(y(g));
      p.push('<line class="dg-izgara" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yy + '" y2="' + yy + '"/>');
      p.push(yazi("dg-eksen", kenar.sol - 8, yy + 4, dar ? kisa(g).replace(" bin", "b") : kisa(g), "end"));
    }

    A.forEach(function (a, i) {
      var x = kenar.sol + i * yuva + (yuva - gen) / 2;
      var katlar = [
        { s: "dg-net", v: a.net, ad: "Net" },
        { s: "dg-vergi", v: a.gelirVergisi + a.damga, ad: "Vergi" },
        { s: "dg-prim", v: a.prim, ad: "SGK + işsizlik" }
      ];
      var alt = 0;
      p.push('<g class="dg-sutun-g" data-ipucu="' + ipucu(a.ayAdi + " " + u.yil + " · brüt " + tl(a.brut), [
        ["Net", tl(a.net), "dg-net"], ["Gelir vergisi", tl(a.gelirVergisi), "dg-vergi"],
        ["Damga vergisi", tl(a.damga), "dg-vergi"], ["SGK + işsizlik", tl(a.prim), "dg-prim"],
        ["Vergi dilimi", "%" + sayi(a.dilim * 100)]]) + '">');
      // görünmez vuruş alanı: ince katmanlarda da ipucu yakalansın
      p.push('<rect class="dg-vurus" x="' + r1(kenar.sol + i * yuva) + '" y="' + kenar.ust + '" width="' + r1(yuva) + '" height="' + (H - kenar.ust - kenar.alt) + '"/>');
      katlar.forEach(function (k) {
        var y0 = y(alt), y1 = y(alt + k.v);
        p.push('<rect class="dg-kat ' + k.s + '" x="' + r1(x) + '" y="' + r1(y1) + '" width="' + r1(gen) + '" height="' + r1(Math.max(0, y0 - y1 - 1)) + '"/>');
        alt += k.v;
      });
      p.push("</g>");
      p.push(yazi("dg-eksen", x + gen / 2, H - kenar.alt + 18, dar ? AY_KISA[i].charAt(0) : AY_KISA[i], "middle"));
      // dilim geçişi: sütunun üstünde küçük işaret
      if (a.dilimGecisi) {
        p.push('<g class="dg-dilim"><line x1="' + r1(x) + '" x2="' + r1(x + gen) + '" y1="' + (kenar.ust - 12) + '" y2="' + (kenar.ust - 12) + '"/>' +
          yazi("", x + gen / 2, kenar.ust - 18, "%" + sayi(a.dilim * 100), "middle") + "</g>");
      }
    });

    // Ocak neti referansı ve en düşük aya ölçü çizgisi
    var ref = r1(y(A[0].net));
    p.push('<line class="dg-referans" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + ref + '" y2="' + ref + '"/>');
    var m = u.enDusuk, mi = m.ay - 1;
    var mx = r1(kenar.sol + mi * yuva + yuva / 2 + gen / 2 + 7);
    var my = r1(y(m.net));
    p.push('<g class="dg-olcu"><line x1="' + mx + '" x2="' + mx + '" y1="' + ref + '" y2="' + my + '"/>' +
      '<line x1="' + (mx - 4) + '" x2="' + (mx + 4) + '" y1="' + ref + '" y2="' + ref + '"/>' +
      '<line x1="' + (mx - 4) + '" x2="' + (mx + 4) + '" y1="' + my + '" y2="' + my + '"/></g>');
    if (!dar) {
      p.push(yazi("dg-not", W - kenar.sag + 10, ref - 6, "Ocak neti"));
      p.push(yazi("dg-not dg-not-deger", W - kenar.sag + 10, ref + 12, tl(A[0].net)));
      p.push(yazi("dg-not dg-renkli-vergi", W - kenar.sag + 10, my + 18, "−" + tl(A[0].net - m.net)));
      p.push(yazi("dg-kucuk", W - kenar.sag + 10, my + 34, dipZamani(u)));
    }
    p.push("</svg>");
    return { svg: p.join(""), H: H };
  }

  function guzelAdim(ham) {
    var us = Math.pow(10, Math.floor(Math.log(ham) / Math.LN10));
    var k = ham / us;
    return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * us;
  }

  /* ============================================================= KREDİ
     Her ay aynı taksit; içi değişir. Basamaklı alan: ay ay ayrık ödeme. */
  function kredi(o) {
    var W = o.genislik, dar = W < 640;
    var k = o.veri, S = k.satirlar, n = S.length;
    var H = dar ? 280 : 320;
    var kenar = { sol: dar ? 44 : 58, sag: dar ? 8 : 150, ust: 22, alt: 34 };
    var tepe = Math.max.apply(null, S.map(function (s) { return s.taksit; }));
    var adim = guzelAdim(tepe / 4);
    var ustSinir = Math.ceil(tepe / adim) * adim;
    var y = function (v) { return H - kenar.alt - v / ustSinir * (H - kenar.ust - kenar.alt); };
    var x = function (ay) { return kenar.sol + (ay - 1) / n * (W - kenar.sol - kenar.sag); };
    var p = [svgAc(W, H, o.etiket, "kredi")];
    /* KKDF + BSMV taralı: faizle aynı renk ailesinde (ikisi de paranın
       bedeli) ama renk körlüğünde ve baskıda da ayrışsın. */
    p.push('<defs><pattern id="dg-tarama" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect class="dg-tarama-zemin" width="6" height="6"/><line class="dg-tarama-cizgi" x1="1" y1="0" x2="1" y2="6"/></pattern></defs>');

    for (var g = 0; g <= ustSinir + 1; g += adim) {
      var yy = r1(y(g));
      p.push('<line class="dg-izgara" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yy + '" y2="' + yy + '"/>');
      p.push(yazi("dg-eksen", kenar.sol - 8, yy + 4, sayi(g), "end"));
    }

    // katman sınırları: alt0 = 0, alt1 = anapara, alt2 = anapara + faiz, alt3 = taksit
    function basamak(fn) {
      var d = "";
      S.forEach(function (s, i) {
        var xa = r1(x(s.ay)), xb = r1(x(s.ay + 1)), yy = r1(y(fn(s)));
        d += (i === 0 ? "M" + xa + " " + yy : "V" + yy) + "H" + xb;
      });
      return d;
    }
    function ters(fn) {
      var d = "";
      for (var i = S.length - 1; i >= 0; i--) {
        var s = S[i];
        d += "V" + r1(y(fn(s))) + "H" + r1(x(s.ay));
      }
      return d;
    }
    var f0 = function () { return 0; };
    var f1 = function (s) { return s.anapara; };
    var f2 = function (s) { return s.anapara + s.faiz; };
    var f3 = function (s) { return s.taksit; };
    p.push('<path class="dg-alan dg-net" d="' + basamak(f1) + ters(f0) + 'Z"/>');
    p.push('<path class="dg-alan dg-vergi" d="' + basamak(f2) + ters(f1) + 'Z"/>');
    p.push('<path class="dg-alan dg-vergi dg-tarali" d="' + basamak(f3) + ters(f2) + 'Z"/>');
    p.push('<path class="dg-sinir" d="' + basamak(f1) + '"/>');

    // yarı çizgisi ve kesişim
    var yari = r1(y(S[0].taksit / 2));
    p.push('<line class="dg-referans" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yari + '" y2="' + yari + '"/>');
    if (k.kesisimAyi) {
      var s = S[k.kesisimAyi - 1];
      var kx = r1(x(s.ay + 0.5)), ky = r1(y(s.anapara));
      p.push('<g class="dg-isaret"><line x1="' + kx + '" x2="' + kx + '" y1="' + kenar.ust + '" y2="' + (H - kenar.alt) + '"/>' +
        '<circle cx="' + kx + '" cy="' + ky + '" r="5"/></g>');
      p.push('<text class="dg-not dg-hale" x="' + r1(kx + 9) + '" y="' + (kenar.ust + 14) + '">' + kacis(s.ay + ". ay") + "</text>");
      if (!dar) p.push(yazi("dg-kucuk dg-hale", kx + 9, kenar.ust + 30, "anapara ilk kez faiz + vergiyi geçiyor"));
    }

    // katman adları: ilk ayların içinde, halolu
    var ax = x(2) + 2;
    var s0 = S[0];
    p.push(yazi("dg-katman-ad dg-hale", ax, y(s0.anapara / 2) + 4, "Anapara"));
    p.push(yazi("dg-katman-ad dg-hale", ax, y(s0.anapara + s0.faiz / 2) + 4, "Faiz"));
    p.push(yazi("dg-katman-ad dg-hale", ax, y(s0.anapara + s0.faiz + (s0.kkdf + s0.bsmv) / 2) + 4, "KKDF + BSMV"));

    // sağ uç: son taksitin anapara payı, mavi alanın ortasında. İlk
    // taksitin faiz payını başlık söylüyor; ikinci bir sağ etiket çakışırdı.
    if (!dar) {
      var son = S[n - 1], orta = y(son.anapara / 2);
      p.push(yazi("dg-not", W - kenar.sag + 10, orta - 6, "Son taksit"));
      p.push(yazi("dg-not dg-not-deger", W - kenar.sag + 10, orta + 12, yuzde(son.anapara / son.taksit) + " anapara"));
    }

    // x ekseni
    [1, 6, 12, 18, 24, 30, 36, 48, 60].filter(function (a) { return a <= n; }).forEach(function (a) {
      var xx = r1(x(a + 0.5));
      p.push('<line class="dg-centik" x1="' + xx + '" x2="' + xx + '" y1="' + (H - kenar.alt) + '" y2="' + (H - kenar.alt + 5) + '"/>');
      p.push(yazi("dg-eksen", xx, H - kenar.alt + 18, a + (a === 1 ? ". ay" : ""), "middle"));
    });

    // ipucu vuruş alanları
    p.push('<g class="dg-vuruslar">');
    S.forEach(function (s) {
      p.push('<rect class="dg-vurus" x="' + r1(x(s.ay)) + '" y="' + kenar.ust + '" width="' + r1(x(s.ay + 1) - x(s.ay)) + '" height="' + (H - kenar.ust - kenar.alt) +
        '" data-ipucu="' + ipucu(s.ay + ". taksit · " + tl(s.taksit), [
          ["Anapara", tl(s.anapara), "dg-net"], ["Faiz", tl(s.faiz), "dg-vergi"],
          ["KKDF", tl(s.kkdf), "dg-vergi"], ["BSMV", tl(s.bsmv), "dg-vergi"], ["Kalan borç", tl(s.kalan)]]) + '"/>');
    });
    p.push("</g></svg>");
    return { svg: p.join(""), H: H };
  }

  /* ======================================================= KESİNTİ EĞRİSİ
     x: aylık brüt, logaritmik (asgari ücretten 40 katına). y: brütün yüzdesi. */
  function egri(o) {
    var W = o.genislik, dar = W < 640;
    var e = o.veri, N = e.noktalar;
    var H = dar ? 300 : 360;
    var kenar = { sol: dar ? 36 : 48, sag: dar ? 10 : 24, ust: 30, alt: 46 };
    var b0 = N[0].brutAy, b1 = N[N.length - 1].brutAy;
    var x = function (b) { return kenar.sol + (Math.log(b) - Math.log(b0)) / (Math.log(b1) - Math.log(b0)) * (W - kenar.sol - kenar.sag); };
    var yMax = 0.5;
    var y = function (v) { return H - kenar.alt - v / yMax * (H - kenar.ust - kenar.alt); };
    var p = [svgAc(W, H, o.etiket, "egri")];

    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(function (v) {
      var yy = r1(y(v));
      p.push('<line class="dg-izgara" x1="' + kenar.sol + '" x2="' + (W - kenar.sag) + '" y1="' + yy + '" y2="' + yy + '"/>');
      p.push(yazi("dg-eksen", kenar.sol - 8, yy + 4, "%" + Math.round(v * 100), "end"));
    });
    var katlar = dar ? [1, 3, 9, 30] : [1, 2, 3, 5, 9, 20, 40];
    katlar.forEach(function (k) {
      var b = e.asgariBrut * k, xx = r1(x(b));
      p.push('<line class="dg-centik" x1="' + xx + '" x2="' + xx + '" y1="' + (H - kenar.alt) + '" y2="' + (H - kenar.alt + 5) + '"/>');
      p.push(yazi("dg-eksen", xx, H - kenar.alt + 18, kisa(b), "middle"));
      p.push(yazi("dg-eksen dg-eksen-kat", xx, H - kenar.alt + 33, "×" + k, "middle"));
    });

    // SGK tavanı
    var tx = r1(x(e.sgkTavan));
    p.push('<line class="dg-tavan" x1="' + tx + '" x2="' + tx + '" y1="' + (kenar.ust - 8) + '" y2="' + (H - kenar.alt) + '"/>');
    p.push(yazi("dg-sutun", tx, kenar.ust - 14, "SGK tavanı", "middle"));

    function yol(fn) {
      return N.map(function (n, i) { return (i ? "L" : "M") + r1(x(n.brutAy)) + " " + r1(y(fn(n))); }).join("");
    }
    p.push('<path class="dg-cizgi dg-marj" d="' + yol(function (n) { return n.marjinal; }) + '"/>');
    p.push('<path class="dg-cizgi dg-ort" d="' + yol(function (n) { return n.ortalama; }) + '"/>');

    // doğrudan etiketler
    var lm = N.filter(function (n) { return n.kat >= 1.6; })[0];
    if (!dar) {
      p.push(yazi("dg-cizgi-ad dg-marj-ad dg-hale", x(lm.brutAy) - 6, y(lm.marjinal) - 10, "son liradan kesilen", "end"));
      var lo = N.filter(function (n) { return n.kat >= 5.5; })[0];
      p.push(yazi("dg-cizgi-ad dg-ort-ad dg-hale", x(lo.brutAy) + 6, y(lo.ortalama) + 22, "ortalama kesinti"));
    }

    // tepe, dip ve geri dönüş
    function nokta(b, v, sinif) {
      return '<circle class="dg-nokta ' + sinif + '" cx="' + r1(x(b)) + '" cy="' + r1(y(v)) + '" r="5"/>';
    }
    p.push(nokta(e.tepe.brutAy, e.tepe.ortalama, "dg-n-tepe"));
    p.push(yazi("dg-not dg-hale", x(e.tepe.brutAy) - 8, y(e.tepe.ortalama) - 12, yuzde(e.tepe.ortalama), "end"));
    if (e.geriDonus) {
      p.push(nokta(e.geriDonus.brutAy, e.tepe.ortalama, "dg-n-geri"));
      if (!dar) {
        p.push(yazi("dg-kucuk dg-hale", x(e.geriDonus.brutAy), y(e.tepe.ortalama) + 22, "aynı orana dönüş: " + kisa(e.geriDonus.brutAy) + " TL", "middle"));
      }
    }
    if (o.secili) {
      var sx = r1(x(o.secili.brutAy)), sy = r1(y(o.secili.ortalama));
      p.push('<g class="dg-secili"><circle cx="' + sx + '" cy="' + sy + '" r="9"/><circle cx="' + sx + '" cy="' + sy + '" r="3.5"/></g>');
      p.push(yazi("dg-not dg-hale", sx + 12, sy + 20, "seçili maaş · " + yuzde(o.secili.ortalama)));
    }

    // ipucu vuruş alanları: komşu örneklerin orta noktasına kadar
    p.push('<g class="dg-vuruslar">');
    N.forEach(function (n, i) {
      var sol = i ? (x(N[i - 1].brutAy) + x(n.brutAy)) / 2 : kenar.sol;
      var sag = i < N.length - 1 ? (x(n.brutAy) + x(N[i + 1].brutAy)) / 2 : W - kenar.sag;
      if (sag - sol < 0.2) return;
      p.push('<rect class="dg-vurus" x="' + r1(sol) + '" y="' + kenar.ust + '" width="' + r1(sag - sol) + '" height="' + (H - kenar.ust - kenar.alt) +
        '" data-x="' + r1(x(n.brutAy)) + '" data-ipucu="' + ipucu("Aylık brüt " + tl(n.brutAy) + " · asgarinin " + sayi(n.kat, 1) + " katı", [
          ["Ortalama kesinti", yuzde(n.ortalama), "dg-ort"], ["Son liradan kesilen", yuzde(n.marjinal), "dg-marj"]]) + '"/>');
    });
    p.push("</g></svg>");
    return { svg: p.join(""), H: H };
  }

  /* ============================================================ METİNLER
     Sayfadaki her data-s alanı buradan dolar: üreteç de tarayıcı da aynı
     fonksiyonu çağırır, JS'li ve JS'siz sayfa aynı cümleyi söyler. Ekler
     sayıya göre değişmesin diye cümleler ek almayan kalıpla kuruldu; ay
     adlarının ayrılma hâli tablodan gelir. */
  var AYDAN = { "Ocak": "Ocak'tan", "Şubat": "Şubat'tan", "Mart": "Mart'tan", "Nisan": "Nisan'dan",
    "Mayıs": "Mayıs'tan", "Haziran": "Haziran'dan", "Temmuz": "Temmuz'dan", "Ağustos": "Ağustos'tan",
    "Eylül": "Eylül'den", "Ekim": "Ekim'den", "Kasım": "Kasım'dan", "Aralık": "Aralık'tan" };
  var KAT_YAZI = { 1: "asgari ücret", 2: "asgari ücretin iki katı", 3: "asgari ücretin üç katı", 5: "asgari ücretin beş katı" };

  /* En düşük net son aydaysa "Aralık'tan itibaren" değil "Aralık'ta". */
  function dipZamani(u) {
    return u.enDusuk.ay === 12 ? "Aralık'ta" : AYDAN[u.enDusuk.ayAdi] + " itibaren";
  }

  function ucretMetin(u, secili) {
    var A = u.aylar, t = u.yillik;
    var fark = A[0].net - u.enDusuk.net;
    var gecis = A.filter(function (a) { return a.dilimGecisi; }).length;
    var m = {
      katYazi: KAT_YAZI[u.kat] || ("asgari ücretin " + sayi(u.kat, 1) + " katı"),
      brutAy: tl(u.brutAy),
      netPay: sayi(u.netPay * 100, 1), vergiPay: sayi(u.vergiPay * 100, 1), primPay: sayi(u.primPay * 100, 1),
      isverenAy: tl(t.isverenMaliyeti / 12), netAy: tl(t.net / 12),
      seciliOran: yuzde(secili.ortalama)
    };
    m.aylikBaslik = fark < 1
      ? "Bu maaşta net yıl boyu aynı: her ay " + tl(A[0].net) + "; istisna gelir vergisini sıfırlıyor"
      : "Aynı brüt maaş, Ocak'ta " + tl(A[0].net) + ", " + dipZamani(u) + " " + tl(u.enDusuk.net) + " net ediyor";
    m.aylikOz = fark < 1
      ? "Asgari ücretin gelir vergisi ve damga vergisi istisnası tam; kümülatif matrah dilim atlasa da vergi doğmuyor. Kesinti yalnızca SGK ve işsizlik primi."
      : "Gelir vergisi yıl boyu biriken matraha göre kesilir. Birikim bir dilim sınırını geçtiğinde o aydan sonra her lira daha yüksek oranla vergilenir; brüt aynı kalırken net düşer. Bu maaşta yıl içinde " +
        (gecis === 1 ? "bir" : gecis === 2 ? "iki" : gecis === 3 ? "üç" : sayi(gecis)) + " dilim geçişi var; Ocak netine göre yıl toplamında " + tl(A.reduce(function (s, a) { return s + (A[0].net - a.net); }, 0)) + " eksik." +
        (u.temmuzArtisi > 0.5 ? " Temmuzda net " + tl(u.temmuzArtisi) + " artıyor: asgari ücret istisnası da biriken tutar üzerinden hesaplanır ve o ay büyür." : "");
    return m;
  }

  function sabitMetin(k, e) {
    return {
      krAnapara: tl(k.girdi.anapara), krVade: String(k.girdi.vade), krFaiz: "%" + sayi(k.girdi.aylikFaiz, 2),
      krKkdf: "%" + sayi(k.girdi.kkdf), krBsmv: "%" + sayi(k.girdi.bsmv),
      taksit: tl(k.taksit), ilkMal: sayi(k.ilkMaliyetPay * 100, 1), kesisim: String(k.kesisimAyi),
      topMal: tl(k.toplamMaliyet), topFaiz: tl(k.toplamFaiz), topVergi: tl(k.toplamVergi),
      topOdeme: tl(k.toplamOdeme), malPay: sayi(k.toplamMaliyet / k.girdi.anapara * 100, 1),
      sonAnapara: sayi(k.sonAnaparaPay * 100, 1),
      tepe: yuzde(e.tepe.ortalama), tavan: tl(e.sgkTavan), tavanKat: sayi(e.tavanKat),
      geri: e.geriDonus ? tl(Math.round(e.geriDonus.brutAy / 1000) * 1000) : "—",
      geriKat: e.geriDonus ? sayi(e.geriDonus.kat, 1) : "—",
      dip: yuzde(e.dip.ortalama), ilkOran: yuzde(e.ilk.ortalama), yil: String(e.yil)
    };
  }

  /* ============================================================ TABLOLAR */
  function tablo(baslik, basliklar, satirlar) {
    return '<div class="dg-tablo-kap"><table><caption>' + kacis(baslik) + "</caption><thead><tr>" +
      basliklar.map(function (b, i) { return '<th scope="col"' + (i ? ' class="sayi"' : "") + ">" + kacis(b) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + satirlar.map(function (s) {
        return "<tr>" + s.map(function (h, i) { return i ? '<td class="sayi">' + kacis(h) + "</td>" : '<th scope="row">' + kacis(h) + "</th>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }
  function tabloSankey(u) {
    var t = u.yillik, top = t.isverenMaliyeti;
    var s = function (ad, v) { return [ad, tl(v), tl(v / 12), sayi(v / top * 100, 1)]; };
    return tablo("İşveren maliyetinin dağılımı, " + u.yil + ", aylık brüt " + tl(u.brutAy), ["Kalem", "Yıllık", "Aylık ortalama", "100 liranın"], [
      s("İşveren maliyeti", top), s("İşveren primi (SGK + işsizlik)", t.isverenPrim), s("Brüt ücret", t.brut),
      s("Çalışan primi (SGK + işsizlik)", t.sgk + t.issizlik), s("Gelir vergisi", t.gelirVergisi), s("Damga vergisi", t.damga), s("Net ücret", t.net)]);
  }
  function tabloAylik(u) {
    return tablo("Aylık bordro, " + u.yil + ", brüt " + tl(u.brutAy), ["Ay", "SGK + işsizlik", "Gelir vergisi", "Damga", "Net", "Dilim"],
      u.aylar.map(function (a) { return [a.ayAdi, tl(a.prim), tl(a.gelirVergisi), tl(a.damga), tl(a.net), "%" + sayi(a.dilim * 100)]; }));
  }
  function tabloKredi(k) {
    return tablo("Ödeme planı: " + tl(k.girdi.anapara) + ", " + k.girdi.vade + " ay, aylık %" + sayi(k.girdi.aylikFaiz, 2) + " faiz",
      ["Ay", "Taksit", "Anapara", "Faiz", "KKDF", "BSMV", "Kalan"],
      k.satirlar.map(function (s) { return [s.ay + ". ay", tl(s.taksit), tl(s.anapara), tl(s.faiz), tl(s.kkdf), tl(s.bsmv), tl(s.kalan)]; }));
  }
  var TABLO_KATLARI = [1, 1.5, 2, 3, 4, 5, 7, 9, 10, 12, 15, 20, 25, 30, 40];
  function tabloEgri(e, noktaFn) {
    return tablo("Aylık brüte göre kesinti oranı, " + e.yil, ["Aylık brüt", "Asgarinin katı", "Ortalama kesinti", "Son liradan kesilen"],
      TABLO_KATLARI.map(function (k) { var n = noktaFn(k); return [tl(n.brutAy), "×" + sayi(k, 1), yuzde(n.ortalama), yuzde(n.marjinal)]; }));
  }

  return {
    sankey: sankey, aylik: aylik, kredi: kredi, egri: egri,
    ucretMetin: ucretMetin, sabitMetin: sabitMetin, dipZamani: dipZamani,
    tabloSankey: tabloSankey, tabloAylik: tabloAylik, tabloKredi: tabloKredi, tabloEgri: tabloEgri, TABLO_KATLARI: TABLO_KATLARI,
    sayi: sayi, tl: tl, yuzde: yuzde, kisa: kisa, kacis: kacis
  };
});
