/* Maaş Hesaplama — arayüz katmanı.
   Tüm bordro matematiği ../bordro/motor.js içindedir; bu dosya yalnızca
   formu okur, motoru çağırır ve sonucu çizer. */
(function () {
  "use strict";
  var B = window.Bordro, R = window.SonucYuzeyi;
  var sonSonuc = null, seciliAy = 0;
  if (!B) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function yuzde(o) { return "%" + String(Math.round(o * 100)); }
  function el(id) { return document.getElementById(id); }
  function num(id) { return R.read(el(id)); }

  /* ---------- yıl ve seçenekler ---------- */

  var elYear = el("in-year");
  var elAgi = el("in-agi");
  var agiSarma = el("agi-row");

  function seciliYil() {
    var y = elYear ? parseInt(elYear.value, 10) : B.sonYil();
    return isNaN(y) ? B.sonYil() : y;
  }
  function secenekler() {
    var o = {};
    if (elAgi && elAgi.value) o.agiOrani = parseFloat(elAgi.value);
    return o;
  }

  function yilSecimiKur() {
    if (!elYear) return;
    elYear.innerHTML = B.yillar().map(function (y) {
      return '<option value="' + y + '">' + y + " bordro yılı</option>";
    }).join("");
    elYear.value = String(B.sonYil());
  }

  /* AGİ seçimi yalnızca AGİ rejiminin geçerli olduğu yıllarda anlamlıdır. */
  function agiGorunurlugu() {
    if (!agiSarma) return;
    agiSarma.hidden = B.parametre(seciliYil()).istisnaRejimi !== "agi";
  }

  /* ---------- çizim ---------- */

  function ozetCiz(hedef, sonuc) {
    var a=sonuc.aylar[seciliAy], t=sonuc.toplam, P=sonuc.parametre;
    var d=P.donemler[P.donemler.length-1];
    hedef.innerHTML=R.answer(a.ayAdi+' '+sonuc.yil+' · Net maaş',a.net,'Bu ayın brütü: '+fmt(a.brut)+' TL')+
      '<h3>Brütten elinize geçen tutara</h3>'+R.stack([['Net maaş',a.net],['SGK + işsizlik',a.sgk+a.issizlik],['Gelir vergisi + damga',a.gelirVergisi+a.damga]])+
      R.facts([['Brüt maaş',fmt(a.brut)+' TL'],['SGK işçi payı',fmt(a.sgk)+' TL'],['İşsizlik sigortası',fmt(a.issizlik)+' TL'],['Gelir vergisi · istisna sonrası',fmt(a.gelirVergisi)+' TL'],['Damga vergisi',fmt(a.damga)+' TL']])+
      (a.dilimGecisi?R.notice(a.ayAdi+' ayında üst vergi dilimine geçiliyor. Aşağıdaki bordroda bu ay ayrıca işaretlendi.'):'')+
      '<h3>Yılın bütünü</h3>'+R.metrics([['Yıllık toplam net',fmt(t.net)+' TL'],['Aylık ortalama net',fmt(t.ortalamaNet)+' TL'],['Aralık net maaşı',fmt(t.sonAyNet)+' TL']])+
      '<details class="rs-details"><summary>Vergi, istisna ve işveren maliyeti</summary>'+R.facts([
        ['Yıllık vergi + damga',fmt(t.gelirVergisi+t.damga)+' TL'],
        [P.istisnaRejimi==='agi'?'Yıllık AGİ ile düşen vergi':'Yıllık asgari ücret istisnası',fmt(t.istisna)+' TL'],
        [a.ayAdi+' · İşveren maliyeti, teşviksiz',fmt(a.isverenMaliyeti)+' TL'],
        ['Asgari brüt · yılın son dönemi',fmt(d.asgariBrut)+' TL'],['Asgari net · yılın son dönemi',fmt(d.asgariNet)+' TL']])+'</details>';
  }

  function tabloCiz(hedef, sonuc) {
    var P = sonuc.parametre;
    var html = '<h3>12 aylık bordro</h3><p class="rs-note">Tutarlar TL. Dar ekranda tabloyu yatay kaydırabilirsiniz.</p><div class="rs-scroll" tabindex="0" role="region" aria-label="12 aylık bordro tablosu"><table class="rs-table">' +
      '<caption>' + sonuc.yil + " yılı 12 aylık bordro dökümü</caption>" +
      "<thead><tr><th scope='col'>Ay</th><th scope='col'>Brüt</th><th scope='col'>SGK %14</th><th scope='col'>İşsizlik %1</th>" +
      "<th scope='col'>Gelir vergisi</th><th scope='col'>İstisna</th><th scope='col'>Damga</th><th scope='col'>Dilim</th><th scope='col'>Net maaş</th></tr></thead><tbody>";

    sonuc.aylar.forEach(function (a) {
      html += '<tr' + (a.dilimGecisi ? ' class="rs-event"' : "") + "><th scope='row'>" + a.ayAdi +
        (a.dilimGecisi ? ' <span class="rs-event-label">Üst dilime geçiş</span>' : "") +
        "</th><td>" + fmt(a.brut) + "</td><td>" + fmt(a.sgk) + "</td><td>" + fmt(a.issizlik) +
        "</td><td>" + fmt(a.gelirVergisi) + "</td><td>" + fmt(a.istisna) + "</td><td>" + fmt(a.damga) +
        '</td><td class="rate">' + yuzde(a.dilim) + "</td><td><strong>" + fmt(a.net) + "</strong></td></tr>";
    });

    html += "</tbody></table></div>";

    var notlar = [];
    notlar.push(P.istisnaRejimi === "agi"
      ? "Bu yılda asgari geçim indirimi (AGİ) rejimi geçerlidir; damga vergisi brütün tamamı üzerinden alınır."
      : "Gelir vergisi sütunu, asgari ücret istisnası düşüldükten sonra fiilen ödenen tutardır.");
    if (P.donemler.length > 1) {
      notlar.push("Asgari ücret yıl içinde değiştiği için Temmuz'dan itibaren istisna, damga tabanı ve SGK tavanı yeni tutar üzerinden uygulanır.");
    }
    var gecis = sonuc.aylar.filter(function (a) { return a.dilimGecisi; });
    if (gecis.length) {
      notlar.push("Üst dilime geçiş olarak işaretlenen ay(lar) — " + gecis.map(function (a) { return a.ayAdi; }).join(", ") +
        " — kümülatif matrahın üst vergi dilimine geçtiği aylardır.");
    }
    if (P.notlar) notlar.push(P.notlar);

    html += '<p class="rs-note">' + notlar.join(" ") + " Tutarlar TL cinsindendir.</p>" +
      '<p class="rs-note">Hesaplama çekirdeği: <a href="../bordro/">açık kaynak bordro motoru</a> ' +
      "· " + sonuc.yil + " dayanağı: " + P.dayanak + "</p>";

    hedef.innerHTML = html;
  }

  function sonucGoster(sonuc) {
    sonSonuc=sonuc;
    if(!el('rs-month').options.length) el('rs-month').innerHTML=sonuc.aylar.map(function(a,i){return '<option value="'+i+'">'+R.esc(a.ayAdi)+'</option>';}).join('');
    ozetCiz(el("summary"), sonuc);
    tabloCiz(el("table"), sonuc);
    el("results").hidden = false;
  }

  el('rs-month').addEventListener('change',function(){seciliAy=Number(this.value);if(sonSonuc){ozetCiz(el('summary'),sonSonuc);el('rs-status').textContent=sonSonuc.aylar[seciliAy].ayAdi+' net maaşı: '+fmt(sonSonuc.aylar[seciliAy].net)+' TL';}});
  function gecersiz(id) { sonSonuc=null; el('results').hidden=true; el('summary').innerHTML=''; el('table').innerHTML=''; el('net-out').innerHTML=''; el(id).setAttribute('aria-invalid','true'); el('rs-status').textContent='Hesaplanamadı. Sıfırdan büyük, geçerli bir maaş tutarı girin.'; }
  /* ---------- girişler ---------- */

  function brutHesapla() {
    var yil = seciliYil(), g = num("in-gross");
    if (!isFinite(g) || g <= 0) { gecersiz("in-gross"); return; }
    el("in-gross").removeAttribute("aria-invalid");
    var asgari = B.parametre(yil).donemler[0].asgariBrut;
    el("rs-status").textContent=g<asgari?"Girdi asgari ücretin altında; hesapta "+fmt(asgari)+" TL brüt kullanıldı.":"Bordro güncellendi.";
    if (g < asgari) g = asgari;
    sonucGoster(B.hesaplaYil(g, yil, secenekler()));
  }

  function netHesapla() {
    var yil = seciliYil(), n = num("in-net"), cikti = el("net-out");
    if (!isFinite(n) || n <= 0) { gecersiz("in-net"); return; }
    el("in-net").removeAttribute("aria-invalid");
    var asgariBrut = B.parametre(yil).donemler[0].asgariBrut;
    var asgariNet = B.hesaplaYil(asgariBrut, yil, secenekler()).aylar[0].net;
    el("rs-status").textContent=n<asgariNet?"Hedef asgari netin altında; hesapta "+fmt(asgariNet)+" TL net kullanıldı.":"Ocak hedef netine göre bordro güncellendi.";
    if (n < asgariNet) n = asgariNet;
    var brut = B.nettenBrute(n, yil, 0, secenekler());
    cikti.innerHTML = "Gereken brüt maaş: " + fmt(brut) + " TL" +
      '<span class="muted-note">' + yil + " yılı Ocak ayı neti " + fmt(n) +
      " TL olacak şekilde çözüldü. Aşağıda 12 aylık döküm.</span>";
    sonucGoster(B.hesaplaYil(brut, yil, secenekler()));
  }

  function aktifSekme() {
    var t = document.querySelector('[role="tab"][aria-selected="true"]');
    return t && t.id === "tab-2" ? netHesapla : brutHesapla;
  }
  function yenile() { agiGorunurlugu(); aktifSekme()(); }

  yilSecimiKur();
  agiGorunurlugu();

  var elGross = el("in-gross"), elNet = el("in-net");
  /* PROFİL KÖPRÜSÜ. Bu sayfada bordro motoru zaten yüklü, o yüzden
     tembel yüklemeye gerek yok: tek alan, tek atama. */
  if (window.ProfilKopru) {
    window.ProfilKopru.bagla({
      hedef: document.getElementById("pk-alan"),
      alanlar: ["gelir"],
      yol: "../finansal-ikiz/",
      uygunMu: function (p) {
        return p.gelirler.some(function (g) {
          return g.tur === "ucret" && g.aylikBrut > 0;
        });
      },
      doldur: function (p) {
        var en = null;
        p.gelirler.forEach(function (g) {
          if (g.tur === "ucret" && g.aylikBrut > 0 &&
              (!en || g.aylikBrut > en.aylikBrut)) en = g;
        });
        if (!en || !elGross) return [];
        elGross.value = Math.round(en.aylikBrut);
        brutHesapla();
        return ["aylık brüt maaş"];
      }
    });
  }

  if (elGross) elGross.addEventListener("input", brutHesapla);
  if (elNet) elNet.addEventListener("input", netHesapla);
  if (elYear) elYear.addEventListener("change", yenile);
  if (elAgi) elAgi.addEventListener("change", yenile);

  /* Sekmeler */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function sekmeSec(tab) {
    tabs.forEach(function (t) {
      var sec = t === tab;
      t.setAttribute("aria-selected", String(sec));
      t.tabIndex = sec ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sec;
    });
    if (tab.id === "tab-1") brutHesapla(); else netHesapla();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { sekmeSec(tab); });
    tab.addEventListener("keydown", function (e) {
      var idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); tabs[idx].focus(); sekmeSec(tabs[idx]); }
    });
  });

  document.querySelectorAll("form.panel").forEach(function(f){f.addEventListener("submit",function(e){e.preventDefault();aktifSekme()();});});
  brutHesapla();
})();
