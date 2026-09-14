/* MTV Hesaplama 2026 — arayüz.
 *
 * Tarife, eşikler ve kurallar burada DEĞİL: tarife.js'te. Bu dosya
 * yalnızca formu tarifenin sorduğu soruya uyduruyor ve sonucun her
 * adımını gösteriyor.
 *
 * Formun asıl işi: YANLIŞ SORUYU SORMAMAK. Elektrikli araç seçilince
 * silindir hacmi alanı kaybolur, yerine motor gücü (kW) gelir — kanun
 * elektrikli taşıtı kW'a göre satıra yerleştirdiği için. Eskiden form
 * elektrikli araç sahibine de cm³ soruyordu; sahip olmadığı bir sayıyı
 * tahmin etmek zorunda kalıyordu.
 */
(function () {
  "use strict";

  var T = window.MtvTarife, R = window.SonucYuzeyi;
  if (!T) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat("tr-TR");
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function tam(n) { return isFinite(n) ? nf0.format(Math.round(n)) : "—"; }
  function el(id) { return document.getElementById(id); }
  function num(id) { return R.read(el(id)); }
  function set(id, html) { var e = el(id); if (e) e.innerHTML = html; }
  function goster(id, acik) { var e = el(id); if (e) e.hidden = !acik; }

  var YIL = T.YIL;

  function secenekler(id, liste) {
    var e = el(id);
    if (!e) return;
    e.innerHTML = liste.map(function (etiket, i) {
      return '<option value="' + i + '">' + etiket + "</option>";
    }).join("");
  }
  secenekler("oto-hacim", T.HACIM_ETIKET);
  secenekler("moto-hacim", T.MOTO_ETIKET);
  var oh = el("oto-hacim"); if (oh) oh.value = "1";   // en yaygın dilim: 1301–1600

  function tablo(rows) { return R.facts(rows.filter(function(r){return r[2]!=='bd-total'&&r[0].indexOf('taksit')<0;})); }
  function uyari(metin) {return R.notice(metin);}
  function hata(prefix,metin){set(prefix+'-out',R.notice(metin));el(prefix+'-status').textContent='Hesaplanamadı. '+metin;}
  function sonuc(prefix,s,rows,ek,girdi){
    set(prefix+'-out',R.answer(YIL+' · Yıllık MTV',s.vergi,'Seçilen taşıt bilgileri için yıllık toplam')+
      R.metrics([['1. taksit · Ocak',fmt(s.taksit)+' TL'],['2. taksit · Temmuz',fmt(s.taksit)+' TL']])+
      ek+projeksiyon(girdi)+'<details class="rs-details"><summary>Tarife ve hesap ayrıntıları</summary>'+tablo(rows)+'</details>');
    el(prefix+'-status').textContent='Hesap güncellendi. Yıllık MTV: '+fmt(s.vergi)+' TL.';
  }

  /* Projeksiyon: tarife sabit kalırsa yaş grubu değiştikçe vergi nasıl
     düşer. Aynı hesaplayıcıyı kullanır ki projeksiyon ile ana sonuç
     ayrışamasın. */
  function projeksiyon(girdi) {
    var kalemler = [], enBuyuk = 0;
    for (var y = YIL; y < YIL + 8; y++) {
      var g = {};
      for (var k in girdi) if (Object.prototype.hasOwnProperty.call(girdi, k)) g[k] = girdi[k];
      g.yil = y;
      var s = T.hesapla(g);
      if (s.hata || !isFinite(s.vergi)) {kalemler.push([y,null]);continue;}
      kalemler.push([y, s.vergi]);
      if (s.vergi > enBuyuk) enBuyuk = s.vergi;
    }
    if (!kalemler.length) return "";
    var out='<h3>Yaş değiştikçe yıllık MTV</h3><p class="rs-note"><strong>'+YIL+' tarifesi sabit tutulmuştur.</strong> Gelecekteki zamları tahmin etmez; yalnız araç yaşı değişiminin etkisini gösterir. Çubukların başlangıcı sıfır, ölçeği ortaktır.</p><ol class="rs-time">';
    kalemler.forEach(function(it){
      var pct=it[1]!==null&&enBuyuk>0?it[1]/enBuyuk*100:0;
      out+='<li><span class="rs-time-year">'+it[0]+'</span><span class="rs-time-track" aria-hidden="true"><span class="rs-time-bar" style="--rs-share:'+pct+'%"></span></span><span class="rs-time-value">'+(it[1]===null?'Hesaplanamadı':fmt(it[1])+' TL')+'</span></li>';
    });
    return out+'</ol>';
  }

  /* ---------------------------------------------------------------- *
   * Otomobil
   * ---------------------------------------------------------------- */
  function hesapOto() {
    var elektrik = el("oto-yakit").value === "elektrik";
    var eski = el("oto-tescil").value === "eski";

    /* Form kendini tarifeye göre düzenliyor. */
    goster("oto-hacim-alan", !elektrik);
    goster("oto-kw-alan", elektrik);
    goster("oto-deger-alan", !eski);     // değer kademesi yalnızca (I)'de
    goster("oto-kasko-alan", eski);      // kasko istisnası yalnızca (I/A)'da

    var sorun=R.validate(el('panel-1'),['oto-kasko']);if(sorun){hata('oto',sorun);return;}
    var girdi = {
      tur: "otomobil",
      tescil: eski ? "eski" : "yeni",
      yakit: elektrik ? "elektrik" : "icten",
      bant: parseInt(el("oto-hacim").value, 10) || 0,
      kw: num("oto-kw"),
      modelYili: num("oto-model"),
      deger: num("oto-deger"),
      kasko: num("oto-kasko")
    };

    var s = T.hesapla(girdi);
    if (s.hata === "kw") {
      hata("oto", "Elektrikli araçta vergi motor gücüne göre belirlenir. " +
        "Aracınızın kW değerini girin — ruhsatın “motor gücü” satırında yazar.");
      return;
    }
    if (s.hata) { hata('oto','Model yılını ve taşıt bilgilerini kontrol edin. Geçerli bir tarife sonucu üretilemedi.'); return; }

    var r = [
      ["Uygulanan tarife", s.tarife],
      [elektrik ? "Motor gücü" : "Motor silindir hacmi", s.bantEtiket],
      ["Araç yaşı (" + YIL + ")", s.yas + " yaş — " + s.yasEtiket]
    ];
    if (!eski) {
      r.push(["Taşıt değeri kademesi",
        (s.kademe + 1) + ". kademe (" + s.kademeSayisi + " kademeden)"]);
    } else {
      r.push(["Taşıt değeri kademesi", "Uygulanmaz — (I/A) tarifesinde kademe yoktur"]);
    }
    r.push(["Tarifedeki tutar", fmt(s.tarifeTutari) + " TL"]);
    if (elektrik) {
      r.push(["Elektrikli araç oranı",
        "Tarifenin %25'i — " + fmt(s.tarifeTutari) + " × 0,25"]);
    }
    if (s.kaskoIndirimi) {
      r.push(["Kasko istisnası",
        "Vergi kasko değerinin %5'ini (" + fmt(s.kaskoSiniri) + " TL) aştı; " +
        "bir önceki satır (" + s.kaskoBanti + ") esas alındı"]);
    }
    r.push(["Yıllık MTV (" + YIL + ")", fmt(s.vergi) + " TL", "bd-total"]);
    r.push(["1. taksit (Ocak)", fmt(s.taksit) + " TL"]);
    r.push(["2. taksit (Temmuz)", fmt(s.taksit) + " TL"]);

    var ek = "";
    if (s.kaskoIlkSatir) {
      ek += uyari("Vergi, kasko değerinizin %5'ini aşıyor; ancak tarifenin ilk " +
        "satırındasınız ve kanunun dayandığı “bir önceki satır” yok.");
    }
    if (!eski && isFinite(girdi.kasko) && girdi.kasko > 0) {
      ek += uyari("2018 sonrası tescilli araçlarda kaskoya bağlı indirim kendiliğinden " +
        "işlemez: kanun %10'luk sınırı Cumhurbaşkanı yetkisine bırakmıştır. " +
        "Bu yüzden hesaba katılmadı.");
    }

    sonuc('oto',s,r,ek,girdi);
  }

  /* ---------------------------------------------------------------- *
   * Motosiklet
   * ---------------------------------------------------------------- */
  function hesapMoto() {
    var elektrik = el("moto-yakit").value === "elektrik";
    goster("moto-hacim-alan", !elektrik);
    goster("moto-kw-alan", elektrik);

    var sorun=R.validate(el('panel-2'),[]);if(sorun){hata('moto',sorun);return;}
    var girdi = {
      tur: "motosiklet",
      yakit: elektrik ? "elektrik" : "icten",
      bant: parseInt(el("moto-hacim").value, 10) || 0,
      kw: num("moto-kw"),
      modelYili: num("moto-model")
    };

    var s = T.hesapla(girdi);
    if (s.hata === "moto-kw-disi") {
      hata("moto", "Kanunun motosiklet tarifesi " + T.MOTO_KW_ALT +
        " kW'ın üzerinde başlar. Bu güçteki elektrikli taşıtlar tarifede yer almaz; " +
        "vergi durumunu tescil kaydınızdan teyit edin.");
      return;
    }
    if (s.hata) { hata('moto','Model yılını ve motor bilgilerini kontrol edin. Geçerli bir tarife sonucu üretilemedi.'); return; }

    var r = [
      ["Uygulanan tarife", s.tarife],
      [elektrik ? "Motor gücü" : "Motor hacmi", s.bantEtiket],
      ["Araç yaşı (" + YIL + ")", s.yas + " yaş — " + s.yasEtiket],
      ["Tarifedeki tutar", fmt(s.tarifeTutari) + " TL"]
    ];
    if (elektrik) {
      r.push(["Elektrikli taşıt oranı", "Tarifenin %25'i"]);
    }
    r.push(["Yıllık MTV (" + YIL + ")", fmt(s.vergi) + " TL", "bd-total"]);
    r.push(["1. taksit (Ocak)", fmt(s.taksit) + " TL"]);
    r.push(["2. taksit (Temmuz)", fmt(s.taksit) + " TL"]);

    sonuc('moto',s,r,'',girdi);
  }

  function hesapla() { hesapOto(); hesapMoto(); }

  ["oto-hacim", "oto-kw", "oto-model", "oto-tescil", "oto-deger", "oto-kasko",
    "oto-yakit", "moto-hacim", "moto-kw", "moto-model", "moto-yakit"
  ].forEach(function (id) {
    var e = el(id);
    if (e) { e.addEventListener("input", hesapla); e.addEventListener("change", hesapla); }
  });

  /* Sekmeler */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function sekmeSec(tab) {
    tabs.forEach(function (t) {
      var sec = t === tab;
      t.setAttribute("aria-selected", String(sec));
      t.tabIndex = sec ? 0 : -1;
      var p = el(t.getAttribute("aria-controls"));
      if (p) p.hidden = !sec;
    });
    hesapla();
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

  document.querySelectorAll('form.panel').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();hesapla();});});
  hesapla();
})();
