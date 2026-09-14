/* Araç ÖTV — arayüz katmanı.
 *
 * Oranlar, eşikler ve satır çözümü burada DEĞİL: tarife.js'te. Bu dosya
 * formu kanunun karar ağacına bağlar ve sonucu çizer.
 *
 * Formun işi: aracın hangi satıra düştüğünü KULLANICIYA SORDURTMAMAK.
 * Eskiden "Hibrit — HEV (>50 kW e-motor, ≤1800 cm³)" diye bir seçenek
 * vardı; koşul etikette yazıyordu ama hiç sorulmuyordu. Elektrik motoru
 * 20 kW olan bir mild hybrid sahibi de onu seçiyor ve %70 görüyordu.
 * Şimdi koşullar veri olarak soruluyor, satırı tarife.js belirliyor.
 */
(function () {
  "use strict";

  var T = window.OtvTarife, R = window.SonucYuzeyi;
  if (!T) return;

  var nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return isFinite(n) ? nf.format(Math.round(n * 100) / 100) : "—"; }
  function el(id) { return document.getElementById(id); }
  function num(id) { return R.read(el(id)); }
  function set(id, html) { var e = el(id); if (e) e.innerHTML = html; }
  function goster(id, acik) { var e = el(id); if (e) e.hidden = !acik; }

  function esikNotu(r) {
    var f=T.esikFarki(r.satirNesnesi,r.matrah);
    if(!f||r.matrah>f.esik*1.10)return '';
    return '<aside class="rs-threshold" aria-label="ÖTV eşik etkisi"><h3>Bir alt dilimin üzerindesiniz</h3>'+R.facts([
      ['Mevcut matrah',fmt(r.matrah)+' TL'],['Bir alt dilimin üst sınırı',fmt(f.esik)+' TL'],['Matrahın sınırı aşan kısmı',fmt(r.matrah-f.esik)+' TL']])+
      '<dl class="rs-compare"><div><dt>Mevcut matrahta anahtar teslim</dt><dd>'+fmt(r.toplam)+' TL</dd></div><div><dt>Eşikteki matrahta anahtar teslim</dt><dd>'+fmt(f.esikteToplam)+' TL</dd></div></dl><p class="rs-note"><strong>'+fmt(f.fark)+' TL toplam fiyat farkı.</strong> Bu fark matrah değişimini ve vergi etkisini birlikte içerir. ÖTV kademeli değildir: eşik aşılınca üst oran matrahın tamamına uygulanır.</p></aside>';
  }
  function hata(metin){set('otv-out',R.notice(metin));el('otv-status').textContent='Hesaplanamadı. '+metin;}

  function hesapla() {
    var tip = el("otv-tip").value;
    var hibrit = tip === "hibrit" || tip === "phev";

    /* Form kanunun o satır için sorduğu şeyleri gösteriyor. */
    goster("hacim-wrap", tip !== "elektrik");
    goster("ekw-wrap", hibrit);
    goster("co2-wrap", tip === "phev");
    goster("menzil-wrap", tip === "phev");
    goster("kw-wrap", tip === "elektrik");

    var sorun=R.validate(el('otv-form'),[]); if(sorun){hata(sorun);return;}
    var r = T.hesapla({
      tur: tip,
      hacim: num("otv-hacim"),
      elektrikKw: hibrit ? num("otv-ekw") : NaN,
      co2: num("otv-co2"),
      menzil: num("otv-menzil"),
      kw: num("otv-kw"),
      matrah: num("otv-matrah")
    });

    if (r.hata) { hata('Vergisiz fiyatı ve araç özelliklerini kontrol edin; tutarlar sıfırdan büyük olmalı.'); return; }

    set('otv-out', R.answer('Anahtar teslim fiyat',r.toplam,'Vergisiz bedel + ÖTV + KDV')+
      '<h3>Fiyatın bileşimi</h3>'+R.stack([['Araç bedeli',r.matrah],['ÖTV',r.otv],['KDV',r.kdv]])+
      R.facts([['Vergisiz araç bedeli',fmt(r.matrah)+' TL'],['ÖTV · %'+r.oran,fmt(r.otv)+' TL'],['KDV · ÖTV dahil tutar üzerinden',fmt(r.kdv)+' TL'],['Toplam vergi',fmt(r.vergi)+' TL']])+
      esikNotu(r)+r.notlar.map(R.notice).join('')+
      '<details class="rs-details"><summary>Uygulanan tarife satırı</summary>'+R.facts([['Satır',r.satir],['ÖTV oranı','%'+r.oran],['KDV oranı','%'+(T.KDV*100)]])+'</details>');
    el('otv-status').textContent='Hesap güncellendi. Anahtar teslim fiyat: '+fmt(r.toplam)+' TL.';
  }

  ["otv-tip", "otv-hacim", "otv-ekw", "otv-co2", "otv-menzil", "otv-kw", "otv-matrah"]
    .forEach(function (id) {
      var e = el(id);
      if (e) { e.addEventListener("input", hesapla); e.addEventListener("change", hesapla); }
    });

  el('otv-form').addEventListener('submit',function(e){e.preventDefault();hesapla();});
  hesapla();
})();
