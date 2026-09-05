/* Çalışma Biçimi Karşılaştırma — arayüz katmanı.
   Bütün vergi ve prim hesabı ../bordro/calisma-bicimi.js içindedir. */
(function () {
  "use strict";
  var K = window.BordroCalismaBicimi;
  var B = window.Bordro;
  if (!K || !B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function fmt0(n) { return isFinite(n) ? nf0.format(Math.round(n)) : "—"; }
  function yuzde(x) { return "%" + (x * 100).toFixed(1).replace(".", ","); }
  function el(id) { return document.getElementById(id); }

  function num(id) {
    var e = el(id);
    if (!e) return NaN;
    var ham = String(e.value).trim().replace(/\s/g, "");
    if (ham === "") return NaN;
    if (ham.indexOf(",") >= 0) {
      ham = ham.replace(/\./g, "").replace(",", ".");
    } else {
      var p = ham.split(".");
      if (p.length > 1 && p.slice(1).every(function (x) { return x.length === 3; })) ham = p.join("");
    }
    var v = parseFloat(ham);
    return isNaN(v) ? NaN : v;
  }

  function girdi() {
    var bagkur = num("in-bagkur");
    var ucret = num("in-ucret");
    return {
      yillikMaliyet: num("in-maliyet"),
      yillikGider: isNaN(num("in-gider")) ? 0 : num("in-gider"),
      ihracatOrani: parseFloat(el("in-ihracat").value) || 0,
      bagkurMatrahi: isNaN(bagkur) ? undefined : bagkur,
      bagkurIndirimi: el("in-indirim").checked,
      ortakUcretBrut: isNaN(ucret) ? undefined : ucret
    };
  }

  /* ---------- özet kartları ---------- */

  function ozetCiz(r) {
    var kartlar = r.senaryolar.map(function (s) {
      return '<li class="cmp-card' + (s.enIyi ? " is-best" : "") + '">' +
        (s.enIyi ? '<span class="cmp-flag">En çok kalan</span>' : "") +
        "<h3>" + s.kisa + "</h3>" +
        '<p class="cmp-net">' + fmt0(s.net) + " TL</p>" +
        '<p class="cmp-sub">yılda net · aylık ' + fmt0(s.aylikNet) + " TL</p>" +
        '<dl class="cmp-meta">' +
          "<div><dt>Devlete giden</dt><dd>" + fmt0(s.devleteGiden) + " TL</dd></div>" +
          "<div><dt>Efektif yük</dt><dd>" + yuzde(s.efektifYuk) + "</dd></div>" +
          (s.enIyi
            ? "<div><dt>Fark</dt><dd>—</dd></div>"
            : '<div><dt>Farkı</dt><dd class="cmp-diff">' + fmt0(s.fark) + " TL</dd></div>") +
        "</dl></li>";
    }).join("");

    el("summary").innerHTML =
      '<p class="cmp-intro">Yıllık <strong>' + fmt0(r.girdi.yillikMaliyet) +
      " TL</strong> toplam maliyet, " + r.yil + " parametreleriyle:</p>" +
      '<ul class="cmp-grid">' + kartlar + "</ul>";
  }

  /* ---------- kalem kalem döküm ---------- */

  function satir(baslik, deger, sinif) {
    return "<tr" + (sinif ? ' class="' + sinif + '"' : "") + "><th>" + baslik + "</th>" + deger + "</tr>";
  }
  function hucreler(r, f) {
    return r.senaryolar.map(function (s) { return "<td>" + f(s) + "</td>"; }).join("");
  }

  function dokumCiz(r) {
    var s = [];
    s.push(satir("Yıllık toplam maliyet", hucreler(r, function (x) { return fmt0(r.girdi.yillikMaliyet); })));
    s.push(satir("Düşülen işletme gideri", hucreler(r, function (x) {
      return x.giderYazabilir ? "− " + fmt0(x.gider) : '<span class="na">yazılamaz</span>';
    })));
    s.push(satir("Sigorta primi", hucreler(r, function (x) { return "− " + fmt0(x.prim); })));
    s.push(satir("Vergi (toplam)", hucreler(r, function (x) { return "− " + fmt0(x.vergi); })));
    s.push(satir("<strong>Elde kalan net</strong>", hucreler(r, function (x) {
      return "<strong>" + fmt0(x.net) + "</strong>";
    }), "row-total"));
    s.push(satir("Aylık ortalama net", hucreler(r, function (x) { return fmt0(x.aylikNet); })));
    s.push(satir("Efektif yük", hucreler(r, function (x) { return yuzde(x.efektifYuk); })));

    s.push(satir("<em>Vergi kırılımı</em>", hucreler(r, function () { return ""; }), "row-head"));
    function kalem(baslik, alan) {
      s.push(satir(baslik, hucreler(r, function (x) {
        return x[alan] ? fmt0(x[alan]) : '<span class="na">—</span>';
      })));
    }
    kalem("Gelir vergisi", "vGelir");
    kalem("Damga vergisi", "vDamga");
    kalem("Kurumlar vergisi", "vKurumlar");
    kalem("Kâr payı stopajı", "vStopaj");
    s.push(satir("Beyan sonrası ek vergi / iade", hucreler(r, function (x) {
      if (!x.vBeyanFarki) return '<span class="na">—</span>';
      return x.vBeyanFarki > 0
        ? fmt0(x.vBeyanFarki)
        : '<span class="refund">iade ' + fmt0(-x.vBeyanFarki) + "</span>";
    })));
    s.push(satir("Vergi matrahı", hucreler(r, function (x) {
      return x.matrah === null || x.matrah === undefined ? '<span class="na">—</span>' : fmt0(x.matrah);
    })));
    s.push(satir("Hizmet ihracatı indirimi", hucreler(r, function (x) {
      return x.ihracatIndirimi ? fmt0(x.ihracatIndirimi) : '<span class="na">—</span>';
    })));

    var basliklar = r.senaryolar.map(function (x) {
      return '<th scope="col"' + (x.enIyi ? ' class="is-best"' : "") + ">" + x.kisa + "</th>";
    }).join("");

    el("detail").innerHTML =
      '<h3 class="block-title">Kalem kalem döküm</h3>' +
      '<div class="table-scroll"><table class="payroll cmp-table">' +
      '<caption class="visually-hidden">Çalışma biçimlerinin kalem kalem karşılaştırması</caption>' +
      '<thead><tr><th scope="col">Kalem</th>' + basliklar + "</tr></thead><tbody>" +
      s.join("") + "</tbody></table></div>" +
      '<p class="muted-note table-note">Tutarlar yıllık ve TL cinsindendir. ' +
      '"Devlete giden" = toplam maliyet − işletme gideri − elde kalan net; çalışan senaryosunda ' +
      "işveren primlerini de kapsar. Hesaplama çekirdeği: " +
      '<a href="../bordro/">açık kaynak bordro motoru</a>.</p>';
  }

  /* ---------- senaryo notları ---------- */

  function notlarCiz(r) {
    el("notes").innerHTML =
      '<h3 class="block-title">Senaryoların ayrıntısı</h3>' +
      '<div class="note-grid">' + r.senaryolar.map(function (s) {
        return '<div class="note-card' + (s.enIyi ? " is-best" : "") + '">' +
          "<h4>" + s.ad + "</h4><ul>" +
          s.notlar.map(function (n) { return "<li>" + n + "</li>"; }).join("") +
          "</ul></div>";
      }).join("") + "</div>";
  }

  /* ---------- kesişim tablosu ---------- */

  var KADEMELER = [600000, 900000, 1200000, 1800000, 2400000, 3000000, 4000000, 6000000, 9000000];

  function kesisimCiz(g) {
    var satirlar = KADEMELER.map(function (m) {
      // Gider ve ihracat oranı kullanıcının girdiği gibi, gider maliyetle orantılı ölçeklenir.
      var oran = g.yillikMaliyet > 0 ? g.yillikGider / g.yillikMaliyet : 0;
      var r = K.karsilastir({
        yillikMaliyet: m,
        yillikGider: m * oran,
        ihracatOrani: g.ihracatOrani,
        bagkurMatrahi: g.bagkurMatrahi,
        bagkurIndirimi: g.bagkurIndirimi,
        ortakUcretBrut: g.ortakUcretBrut
      });
      var hucre = r.senaryolar.map(function (s) {
        return '<td class="' + (s.enIyi ? "win" : "") + '">' + fmt0(s.net) + "</td>";
      }).join("");
      return '<tr><th scope="row">' + fmt0(m) + "</th>" + hucre +
        '<td class="win-name">' + r.enIyi.kisa + "</td></tr>";
    }).join("");

    var ilk = K.karsilastir({ yillikMaliyet: KADEMELER[0], yillikGider: 0, ihracatOrani: g.ihracatOrani });
    var basliklar = ilk.senaryolar.map(function (s) {
      return '<th scope="col">' + s.kisa + "</th>";
    }).join("");

    el("crossover").innerHTML =
      '<div class="table-scroll"><table class="payroll cmp-table">' +
      '<caption class="visually-hidden">Gelir düzeyine göre en avantajlı çalışma biçimi</caption>' +
      '<thead><tr><th scope="col">Yıllık toplam maliyet</th>' + basliklar +
      '<th scope="col">Öne geçen</th></tr></thead><tbody>' + satirlar + "</tbody></table></div>" +
      '<p class="muted-note table-note">Her satırda elde kalan yıllık net gösterilir; ' +
      "yeşil hücre o gelir düzeyinde öne geçen biçimdir. Gider, girdiğiniz oranla " +
      "(maliyetin " + yuzde(g.yillikMaliyet > 0 ? g.yillikGider / g.yillikMaliyet : 0) +
      "'i) her kademeye ölçeklenir.</p>";
  }

  /* ---------- ana akış ---------- */

  function hesapla() {
    var g = girdi();
    var msg = el("msg");

    if (isNaN(g.yillikMaliyet) || g.yillikMaliyet <= 0) {
      el("results").hidden = true;
      msg.textContent = "Karşı tarafın yıllık toplam maliyetini girin.";
      msg.hidden = false;
      return;
    }
    var asgariYillik = B.parametre(B.sonYil()).donemler[0].asgariBrut * 12;
    if (g.yillikMaliyet < asgariYillik) {
      el("results").hidden = true;
      msg.textContent = "Yıllık maliyet, brüt asgari ücretin yıllık tutarından (" +
        fmt0(asgariYillik) + " TL) düşük olamaz.";
      msg.hidden = false;
      return;
    }
    msg.hidden = true;

    var r;
    try {
      r = K.karsilastir(g);
    } catch (e) {
      el("results").hidden = true;
      msg.textContent = e.message;
      msg.hidden = false;
      return;
    }

    ozetCiz(r);
    dokumCiz(r);
    notlarCiz(r);
    kesisimCiz(r.girdi.yillikMaliyet ? {
      yillikMaliyet: r.girdi.yillikMaliyet,
      yillikGider: r.girdi.yillikGider,
      ihracatOrani: r.girdi.ihracatOrani,
      bagkurMatrahi: g.bagkurMatrahi,
      bagkurIndirimi: g.bagkurIndirimi,
      ortakUcretBrut: g.ortakUcretBrut
    } : g);
    el("results").hidden = false;
  }

  ["in-maliyet", "in-gider", "in-ihracat", "in-bagkur", "in-indirim", "in-ucret"]
    .forEach(function (id) {
      var e = el(id);
      if (e) { e.addEventListener("input", hesapla); e.addEventListener("change", hesapla); }
    });

  hesapla();
})();
