/* Kart Borcu Rotası: TCMB/BDDK oranları makaledeki tek kaynaktan okunur. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../makaleler/kredi-karti-asgari-odeme/kart.js'));
  } else {
    root.KartRotasi = factory(root.KartBorcu);
  }
})(typeof self !== 'undefined' ? self : this, function (kart) {
  'use strict';
  if (!kart) throw new Error('Kart oran modülü yüklenmedi.');

  var AY_SINIRI = 120;
  function kurus(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function yukariKurus(n) { return Math.ceil((n - 0.00000001) * 100) / 100; }

  function dogrula(p) {
    var alanlar = ['borc', 'limit', 'butce', 'harcama', 'harcamaAy', 'hedefAy'];
    alanlar.forEach(function (ad) {
      if (!Number.isFinite(p[ad])) throw new Error(ad + ' geçerli bir sayı olmalı.');
    });
    if (p.borc <= 0 || p.borc > 100000000) throw new Error('Borç 0 ile 100 milyon TL arasında olmalı.');
    if (p.limit < p.borc || p.limit > 100000000) throw new Error('Kart limiti borçtan az olamaz ve 100 milyon TL’yi aşamaz.');
    if (p.butce <= 0 || p.butce > 100000000) throw new Error('Aylık ödeme bütçesi pozitif olmalı.');
    if (p.harcama < 0 || p.harcama > 100000000) throw new Error('Yeni harcama negatif olamaz.');
    if (!Number.isInteger(p.harcamaAy) || p.harcamaAy < 0 || p.harcamaAy > 24) throw new Error('Yeni harcama süresi 0–24 ay olmalı.');
    if (!Number.isInteger(p.hedefAy) || p.hedefAy < 1 || p.hedefAy > 60) throw new Error('Hedef süre 1–60 ay olmalı.');
    if (p.ozelOran !== null && (!Number.isFinite(p.ozelOran) || p.ozelOran < 0 || p.ozelOran > 0.20)) {
      throw new Error('Bankanın aylık faiz oranı %0–20 arasında olmalı.');
    }
    if (p.ozelOran !== null && p.ozelOran > kart.bant(p.borc).akdi) {
      throw new Error('Bankanızın oranı, bu borç bandındaki TCMB azami akdi faizi aşamaz.');
    }
    if (p.harcama > 0 && p.harcamaAy >= p.hedefAy) {
      throw new Error('Hedef ayda yeni harcama sürerse dönem sonu borcu sıfır olamaz. Harcama süresini kısaltın.');
    }
  }

  function oran(p, donemBorcu) {
    var azami = kart.bant(donemBorcu).akdi;
    return p.ozelOran === null ? azami : Math.min(p.ozelOran, azami);
  }

  function simule(p, tur, butce, aySiniri) {
    var kalan = kurus(p.borc);
    var odemeToplam = 0, faizToplam = 0, kkdfToplam = 0, bsmvToplam = 0, harcamaToplam = 0;
    var satirlar = [], asgariOran = kart.asgariOrani(p.limit);
    var sinir = aySiniri || AY_SINIRI;
    for (var ay = 1; ay <= sinir; ay++) {
      var acilis = kalan;
      var asgari = Math.min(acilis, yukariKurus(acilis * asgariOran));
      if (tur === 'butce' && butce + 0.000001 < asgari) {
        return sonuc('butce-yetersiz', ay, kalan, asgari - butce);
      }
      var odeme = tur === 'asgari' ? asgari : Math.min(acilis, kurus(butce));
      var faizMatrahi = kurus(acilis - odeme);
      var aylikOran = oran(p, acilis);
      var faiz = kurus(faizMatrahi * aylikOran);
      var kkdf = kurus(faiz * kart.KKDF);
      var bsmv = kurus(faiz * kart.BSMV);
      var yeniHarcama = ay <= p.harcamaAy ? kurus(p.harcama) : 0;
      kalan = kurus(faizMatrahi + faiz + kkdf + bsmv + yeniHarcama);
      odemeToplam = kurus(odemeToplam + odeme);
      faizToplam = kurus(faizToplam + faiz);
      kkdfToplam = kurus(kkdfToplam + kkdf);
      bsmvToplam = kurus(bsmvToplam + bsmv);
      harcamaToplam = kurus(harcamaToplam + yeniHarcama);
      satirlar.push({ ay: ay, acilis: acilis, asgari: asgari, odeme: odeme,
        faiz: faiz, kkdf: kkdf, bsmv: bsmv, harcama: yeniHarcama, kalan: kalan, oran: aylikOran });
      if (kalan > p.limit + 0.000001) return sonuc('limit-asildi', ay, kalan, kalan - p.limit);
      if (kalan === 0 && ay >= p.harcamaAy) return sonuc('bitti', ay, kalan, 0);
    }
    return sonuc('ufuk', sinir, kalan, 0);

    function sonuc(durum, ay, bakiye, fark) {
      return { durum: durum, ay: ay, kalan: kurus(bakiye), fark: kurus(fark),
        odemeToplam: odemeToplam, faiz: faizToplam, kkdf: kkdfToplam, bsmv: bsmvToplam,
        maliyet: kurus(faizToplam + kkdfToplam + bsmvToplam), harcamaToplam: harcamaToplam,
        satirlar: satirlar };
    }
  }

  function gerekenButce(p) {
    if (p.harcama > 0 && p.harcamaAy >= p.hedefAy) return null;
    var alt = Math.ceil(p.borc * kart.asgariOrani(p.limit) * 100);
    var ust = Math.ceil((p.borc + p.harcama * p.harcamaAy + 1) * 100);
    while (alt < ust) {
      var orta = Math.floor((alt + ust) / 2);
      var sonuc = simule(p, 'butce', orta / 100, p.hedefAy);
      if (sonuc.durum === 'bitti') ust = orta;
      else alt = orta + 1;
    }
    var son = simule(p, 'butce', alt / 100, p.hedefAy);
    return son.durum === 'bitti' ? { butce: alt / 100, plan: son } : null;
  }

  function analiz(girdi) {
    var p = {
      borc: Number(girdi.borc), limit: Number(girdi.limit), butce: Number(girdi.butce),
      harcama: Number(girdi.harcama), harcamaAy: Number(girdi.harcamaAy), hedefAy: Number(girdi.hedefAy),
      ozelOran: girdi.ozelOran === null || girdi.ozelOran === '' || girdi.ozelOran === undefined
        ? null : Number(girdi.ozelOran)
    };
    dogrula(p);
    var ilkAsgari = yukariKurus(p.borc * kart.asgariOrani(p.limit));
    var ilkFaiz = kurus(kurus(p.borc - ilkAsgari) * oran(p, p.borc));
    var ilkYuk = kurus(ilkFaiz + kurus(ilkFaiz * kart.KKDF) + kurus(ilkFaiz * kart.BSMV));
    return {
      parametreler: p, oranTarihi: kart.ORAN_TARIHI,
      ilkAsgari: ilkAsgari, asgariOran: kart.asgariOrani(p.limit),
      ilkOran: oran(p, p.borc),
      asgariyleDengeHarcama: kurus(ilkAsgari - ilkYuk),
      asgariPlan: simule(p, 'asgari'),
      butcePlan: simule(p, 'butce', p.butce),
      hedef: gerekenButce(p)
    };
  }

  return { analiz: analiz, simule: simule, gerekenButce: gerekenButce, kurus: kurus };
});
