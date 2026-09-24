(function () {
  'use strict';
  var form = document.getElementById('rota-form');
  if (!form || !window.KartRotasi) return;
  var engine = window.KartRotasi;
  var para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
  var yuzde = new Intl.NumberFormat('tr-TR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var sonAnaliz = null;
  function el(id) { return document.getElementById(id); }
  function tl(v) { return para.format(v); }
  function durumYaz(plan) {
    if (plan.durum === 'bitti') return plan.ay + '. ay';
    if (plan.durum === 'ufuk') return '120 ayda bitmedi';
    if (plan.durum === 'limit-asildi') return plan.ay + '. ay limit aşılıyor';
    return plan.ay + '. ay asgariyi karşılamıyor';
  }
  function girdi() {
    var banka = el('oranTipi').value === 'banka';
    return {
      borc: el('borc').value, limit: el('limit').value, butce: el('butce').value,
      harcama: el('harcama').value, harcamaAy: el('harcamaAy').value,
      hedefAy: el('hedefAy').value,
      ozelOran: banka ? (el('bankaOran').value.trim() === '' ? NaN : Number(el('bankaOran').value) / 100) : null
    };
  }
  function htmlKpi(etiket, deger, alt, vurgu) {
    return '<div class="rota-kpi' + (vurgu ? ' rota-kpi--accent' : '') + '"><span>' + etiket +
      '</span><strong>' + deger + '</strong><small>' + alt + '</small></div>';
  }
  function renderKpis(a) {
    var hedef = a.hedef;
    var tasarruf = a.asgariPlan.durum === 'bitti' && a.butcePlan.durum === 'bitti'
      ? a.asgariPlan.maliyet - a.butcePlan.maliyet : null;
    el('rota-kpis').innerHTML =
      htmlKpi('İlk ay asgari ödeme', tl(a.ilkAsgari), yuzde.format(a.asgariOran) + ' · kart limitine göre', false) +
      htmlKpi(a.parametreler.hedefAy + ' ay hedefi için', hedef ? tl(hedef.butce) : 'Uygulanamaz',
        hedef ? 'Gereken en düşük sabit aylık bütçe' : 'Harcama hedef ayda sürüyor', true) +
      htmlKpi('Bütçenizin faiz tasarrufu', tasarruf !== null && tasarruf >= 0 ? tl(tasarruf) : '—',
        'Asgari ödeme yoluna karşı toplam faiz + vergiler', false);
    el('rota-denge').textContent = 'İlk ay yalnızca asgari ödeme yapılırsa, o ay borcun artmaması için yeni harcama en fazla ' +
      tl(Math.max(0, a.asgariyleDengeHarcama)) + ' olabilir. Bu tutar sonraki aylar için sabit bir sınır değildir.';
  }
  function renderTablo(a) {
    var yollar = [
      { ad: 'Yalnızca asgari', plan: a.asgariPlan },
      { ad: 'Aylık bütçem', plan: a.butcePlan },
      { ad: 'Hedef süre', plan: a.hedef && a.hedef.plan }
    ];
    el('rota-karsilastirma').innerHTML = yollar.map(function (y) {
      if (!y.plan) return '<tr><th scope="row">' + y.ad + '</th><td>Uygulanamaz</td><td>—</td><td>—</td></tr>';
      var tamam = y.plan.durum === 'bitti';
      return '<tr><th scope="row">' + y.ad + '</th><td>' + durumYaz(y.plan) + '</td><td>' +
        (tamam ? tl(y.plan.maliyet) : '—') + '</td><td>' + (tamam ? tl(y.plan.odemeToplam) : '—') + '</td></tr>';
    }).join('');
    var plan = a.butcePlan.satirlar.length ? a.butcePlan : a.asgariPlan;
    el('rota-aylik').innerHTML = plan.satirlar.map(function (s) {
      return '<tr><th scope="row">' + s.ay + '</th><td>' + tl(s.acilis) + '</td><td>' + tl(s.asgari) +
        '</td><td>' + tl(s.odeme) + '</td><td>' + tl(s.faiz + s.kkdf + s.bsmv) +
        '</td><td>' + tl(s.harcama) + '</td><td>' + tl(s.kalan) + '</td></tr>';
    }).join('');
  }
  function grafik(a) {
    var svg = el('rota-chart');
    var w = 700, h = 290, sol = 58, sag = 18, ust = 22, alt = 34;
    var ayMax = Math.min(36, Math.max(12, a.asgariPlan.ay, a.butcePlan.ay));
    el('rota-chart-note').textContent = Math.max(a.asgariPlan.ay, a.butcePlan.ay) > 36
      ? 'Grafikte ilk 36 ay gösterilir; tam bitiş süresi karşılaştırma tablosundadır.' : '';
    var maxBorc = Math.max(a.parametreler.borc, a.parametreler.limit * .5);
    [a.asgariPlan, a.butcePlan].forEach(function (p) {
      p.satirlar.slice(0, ayMax).forEach(function (s) { maxBorc = Math.max(maxBorc, s.kalan); });
    });
    maxBorc *= 1.08;
    function x(ay) { return sol + ay / ayMax * (w - sol - sag); }
    function y(deger) { return ust + (1 - deger / maxBorc) * (h - ust - alt); }
    var parca = [];
    for (var i = 0; i <= 4; i++) {
      var deger = maxBorc * (4 - i) / 4;
      var yy = y(deger);
      parca.push('<line x1="' + sol + '" y1="' + yy + '" x2="' + (w - sag) + '" y2="' + yy + '" class="rota-grid"/>');
      parca.push('<text x="' + (sol - 9) + '" y="' + (yy + 4) + '" text-anchor="end" class="rota-axis">' +
        (Math.round(deger / 1000)) + 'b</text>');
    }
    [0, Math.round(ayMax / 4), Math.round(ayMax / 2), Math.round(ayMax * .75), ayMax].forEach(function (ay) {
      parca.push('<text x="' + x(ay) + '" y="' + (h - 8) + '" text-anchor="middle" class="rota-axis">' + ay + '. ay</text>');
    });
    [['min', a.asgariPlan], ['plan', a.butcePlan]].forEach(function (d) {
      var noktalar = [{ ay: 0, kalan: a.parametreler.borc }].concat(d[1].satirlar.slice(0, ayMax));
      var yol = noktalar.map(function (s, n) { return (n ? 'L' : 'M') + x(s.ay).toFixed(1) + ' ' + y(s.kalan).toFixed(1); }).join(' ');
      parca.push('<path d="' + yol + '" class="rota-line rota-line--' + d[0] + '"/>');
      var son = noktalar[noktalar.length - 1];
      parca.push('<circle cx="' + x(son.ay).toFixed(1) + '" cy="' + y(son.kalan).toFixed(1) +
        '" r="4" class="rota-end rota-end--' + d[0] + '"/>');
    });
    svg.innerHTML = parca.join('');
  }
  function uyarilar(a) {
    var metin = [];
    if (a.butcePlan.durum === 'butce-yetersiz') metin.push('Aylık bütçe ' + a.butcePlan.ay + '. ay asgari ödemesini ' + tl(a.butcePlan.fark) + ' karşılayamıyor. Gecikme senaryosu hesaplanmadı.');
    if (a.butcePlan.durum === 'limit-asildi') metin.push('Bu ödeme ve yeni harcama planı ' + a.butcePlan.ay + '. ay kart limitini ' + tl(a.butcePlan.fark) + ' aşıyor; plan uygulanamaz sayıldı. Bankanın işlemi onaylayacağı varsayılmadı.');
    if (a.asgariPlan.durum === 'limit-asildi') metin.push('Yalnızca asgari ödeme yolu ' + a.asgariPlan.ay + '. ay limitin üzerine çıkıyor.');
    if (a.asgariPlan.durum === 'ufuk' || a.butcePlan.durum === 'ufuk') metin.push('120 aylık taramada borç tamamen bitmedi; sonuçlara bitiş süresi yazılmadı.');
    if (a.hedef && a.hedef.plan.ay < a.parametreler.hedefAy && a.hedef.butce === a.ilkAsgari) metin.push('İlk ayın zorunlu asgarisi, hedef süre için gereken bütçeden yüksek; bu nedenle hedef plan daha erken bitiyor.');
    if (a.parametreler.harcama > 0 && a.parametreler.harcamaAy === 0) metin.push('Yeni harcama süresi 0 olduğu için girilen harcama hesaba katılmadı.');
    var kutu = el('rota-uyari');
    kutu.hidden = !metin.length;
    kutu.textContent = metin.join(' ');
  }
  function hesapla() {
    var hata = el('rota-error');
    hata.hidden = true;
    try {
      var a = engine.analiz(girdi());
      sonAnaliz = a;
      el('sonuc').hidden = false;
      renderKpis(a);
      renderTablo(a);
      grafik(a);
      uyarilar(a);
      el('sonuc-ozet').textContent = tl(a.parametreler.borc) + ' borç için aylık ' + tl(a.parametreler.butce) +
        ' ayırırsanız: ' + durumYaz(a.butcePlan) + '. İlk ay kullanılan akdi faiz ' +
        yuzde.format(a.ilkOran) + (a.parametreler.ozelOran === null ? ' (TCMB azami bant varsayımı).' : ' (girdiğiniz banka oranı).');
    } catch (e) {
      sonAnaliz = null;
      el('sonuc').hidden = true;
      hata.textContent = e.message;
      hata.hidden = false;
    }
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); hesapla(); });
  el('oranTipi').addEventListener('change', function () {
    var banka = this.value === 'banka';
    el('bankaOranAlani').hidden = !banka;
    el('bankaOran').required = banka;
  });
  document.querySelectorAll('[data-ornek]').forEach(function (dugme) {
    dugme.addEventListener('click', function () {
      var ornek = this.dataset.ornek;
      var deger = ornek === 'dar' ? [85000, 120000, 20000, 12, 0, 0] :
        ornek === 'harcama' ? [40000, 50000, 12000, 9, 2500, 4] :
          [40000, 50000, 10000, 6, 0, 0];
      ['borc', 'limit', 'butce', 'hedefAy', 'harcama', 'harcamaAy'].forEach(function (id, i) { el(id).value = deger[i]; });
      el('oranTipi').value = 'tcmb';
      el('bankaOranAlani').hidden = true;
      el('bankaOran').required = false;
      if (ornek === 'harcama') document.querySelector('.rota-advanced').open = true;
      hesapla();
    });
  });
  el('rota-csv').addEventListener('click', function () {
    if (!sonAnaliz) return;
    var satirlar = ['Ay;Açılış;Asgari;Ödeme;Faiz;KKDF;BSMV;Yeni harcama;Kalan;Plan durumu'];
    var plan = sonAnaliz.butcePlan.satirlar.length ? sonAnaliz.butcePlan : sonAnaliz.asgariPlan;
    plan.satirlar.forEach(function (s) {
      satirlar.push([s.ay, s.acilis, s.asgari, s.odeme, s.faiz, s.kkdf, s.bsmv, s.harcama, s.kalan]
        .map(function (n) { return String(n).replace('.', ','); }).join(';') + ';' + plan.durum);
    });
    var url = URL.createObjectURL(new Blob(['\ufeff' + satirlar.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'kart-borcu-rotasi.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  hesapla();
})();
