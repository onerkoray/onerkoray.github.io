/* Nakit Köprüsü: aylık tahsilat ve ödeme zamanlaması. Para birimi TL.
 * Kâr (tahakkuk) ile nakit (gerçek ödeme) ayrı tutulur.
 * MIT — Koray Öner */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NakitKoprusu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const cents = n => Math.round((n + Number.EPSILON) * 100);
  const tl = n => n / 100;
  function number(v, name, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw Error(name + ' ' + min + '–' + max + ' aralığında olmalı.');
    return n;
  }
  function integer(v, name, max) {
    const n = number(v, name, 0, max);
    if (!Number.isInteger(n)) throw Error(name + ' tam ay olmalı.');
    return n;
  }
  function hesapla(g) {
    if (!Array.isArray(g.satislar) || g.satislar.length !== 12) throw Error('Tam 12 aylık satış planı girin.');
    const satislar = g.satislar.map((v, i) => cents(number(v, (i + 1) + '. ay satışı', 0, 1e10)));
    const oran = number(g.maliyetYuzde, 'Değişken maliyet oranı', 0, 200) / 100;
    const sabit = cents(number(g.sabitGider, 'Aylık sabit ödeme', 0, 1e10));
    const acilis = cents(number(g.acilisNakit, 'Açılış nakdi', 0, 1e11));
    const tahsil = integer(g.tahsilatAy, 'Tahsilat vadesi', 6);
    const stok = integer(g.stokAy, 'Stok hazırlığı', 3);
    const odeme = integer(g.odemeAy, 'Tedarikçi vadesi', 6);
    const tahsilatlar = Array(13).fill(0), odemeler = Array(13).fill(0);
    let gelecekAlacak = 0, gelecekBorc = 0, onHazirlik = 0, toplamSatis = 0, toplamMaliyet = 0;
    for (let i = 0; i < 12; i++) {
      const satis = satislar[i], maliyet = cents(tl(satis) * oran);
      toplamSatis += satis; toplamMaliyet += maliyet;
      const t = i + 1 + tahsil;
      if (t <= 12) tahsilatlar[t] += satis; else gelecekAlacak += satis;
      const due = i + 1 - stok + odeme;
      if (due <= 0) { odemeler[0] += maliyet; onHazirlik += maliyet; }
      else if (due <= 12) odemeler[due] += maliyet;
      else gelecekBorc += maliyet;
    }
    const aylar = [], iz = [{ ay: 0, nakit: tl(acilis - odemeler[0]), fark: tl(-odemeler[0]) }];
    let birikimli = -odemeler[0], enDusuk = birikimli, enDusukAy = 0, ilkAcik = acilis + birikimli < 0 ? 0 : null;
    for (let ay = 1; ay <= 12; ay++) {
      const giris = tahsilatlar[ay], cikis = odemeler[ay] + sabit;
      birikimli += giris - cikis;
      if (birikimli < enDusuk) { enDusuk = birikimli; enDusukAy = ay; }
      const nakit = acilis + birikimli;
      if (ilkAcik === null && nakit < 0) ilkAcik = ay;
      const row = { ay, satis: tl(satislar[ay - 1]), tahsilat: tl(giris), tedarik: tl(odemeler[ay]), sabit: tl(sabit), netAkis: tl(giris - cikis), kapanis: tl(nakit) };
      aylar.push(row); iz.push({ ay, nakit: row.kapanis, fark: tl(birikimli) });
    }
    const gereken = Math.max(0, -enDusuk);
    return {
      aylar, iz, gereken: tl(gereken), ilave: tl(Math.max(0, gereken - acilis)),
      enDusukAy, ilkAcik, kapanis: tl(acilis + birikimli),
      kar: tl(toplamSatis - toplamMaliyet - sabit * 12),
      satis: tl(toplamSatis), alacak: tl(gelecekAlacak), borc: tl(gelecekBorc),
      hazirlik: tl(onHazirlik), nakitDongusuGun: 30 * (stok + tahsil - odeme)
    };
  }
  function senaryolar(g) {
    const base = hesapla(g);
    const cases = [
      { ad: 'Plan', g },
      { ad: 'Tahsilat +1 ay', g: { ...g, tahsilatAy: Math.min(6, Number(g.tahsilatAy) + 1) } },
      { ad: 'Satış −%20', g: { ...g, satislar: g.satislar.map(v => Number(v) * .8) } },
      { ad: 'Değişken maliyet +%10', g: { ...g, maliyetYuzde: Math.min(200, Number(g.maliyetYuzde) * 1.1) } }
    ];
    return { plan: base, senaryolar: cases.map(c => ({ ad: c.ad, ...hesapla(c.g) })) };
  }
  return { hesapla, senaryolar };
});
