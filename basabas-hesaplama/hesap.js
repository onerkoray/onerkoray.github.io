/* Başabaş / hedef faaliyet kârı. MIT — Koray Öner.
 * Para kuruş, komisyon baz puan olarak tamsayıya çevrilir. Bölme yalnızca
 * sonuçta yapılır; gereken adet ve fiyat tam sınırda bir birim fazla çıkmaz.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Basabas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCALE = 10000n;
  function para(v, ad) {
    if (!Number.isFinite(v) || v < 0 || v > 1e9 || Number(v.toFixed(2)) !== v)
      throw Error(ad + ': 0–1 milyar aralığında, en fazla iki ondalıklı tutar girin.');
    return BigInt(Math.round(v * 100));
  }
  function adet(v, ad) {
    if (!Number.isSafeInteger(v) || v < 0 || v > 1e9) throw Error(ad + ': 0–1 milyar aralığında tam sayı girin.');
    return BigInt(v);
  }
  function yukari(n, d) { return (n + d - 1n) / d; }
  function hesapla(g) {
    const f = para(g.sabit, 'Sabit gider'), p = para(g.fiyat, 'Satış fiyatı');
    const v = para(g.degisken, 'Birim değişken gider'), t = para(g.hedef, 'Hedef kâr');
    if (p === 0n) throw Error('Satış fiyatı sıfırdan büyük olmalı.');
    if (!Number.isFinite(g.komisyon) || g.komisyon < 0 || g.komisyon > 100 || Number(g.komisyon.toFixed(2)) !== g.komisyon)
      throw Error('Komisyon: %0–100 arasında, en fazla iki ondalıklı oran girin.');
    const b = BigInt(Math.round(g.komisyon * 100)), q = adet(g.adet, 'Satış adedi');
    const c = adet(g.kapasite, 'Aylık kapasite');
    const katki = p * (SCALE - b) - v * SCALE;
    function gereken(k) {
      if (k === 0n) return 0;
      return katki > 0n ? Number(yukari(k * SCALE, katki)) : null;
    }
    const basabas = gereken(f), hedefAdet = gereken(f + t);
    const kar = n => Number(katki * n - f * SCALE) / 1e6;
    const gelir = Number(p * q) / 100;
    const komisyon = Number(p * q * b) / 1e6;
    const degisken = Number(v * q) / 100;
    const hedefFiyat = q > 0n && b < SCALE
      ? Number(yukari((v * q + f + t) * SCALE, q * (SCALE - b))) / 100 : null;
    // Güvenlik payı sürekli başabaş miktarına göre ölçülür; gerekli adet yukarı yuvarlanır.
    const guvenlik = q > 0n && katki > 0n ? 1 - Number(f * SCALE) / Number(katki * q) : null;
    return { katki: Number(katki) / 1e6, katkiOrani: Number(katki) / Number(p * SCALE),
      basabas, basabasCiro: basabas === null ? null : Number(p) / 100 * basabas,
      hedefAdet, hedefFiyat, kar: kar(q), gelir, komisyon, degisken,
      toplamGider: g.sabit + degisken + komisyon, guvenlik,
      kapasiteKari: kar(c), kapasiteYeterli: hedefAdet !== null && hedefAdet <= g.kapasite,
      planKapasiteyiAsiyor: q > c,
      senaryolar: [-10, -5, 0, 5, 10].map(yuzde => {
        const fiyat = Math.round(g.fiyat * (100 + yuzde)) / 100;
        const k = BigInt(Math.round(fiyat * 100)) * (SCALE - b) - v * SCALE;
        return { yuzde, fiyat, kar: Number(k * q - f * SCALE) / 1e6,
          basabas: f === 0n ? 0 : k > 0n ? Number(yukari(f * SCALE, k)) : null };
      }) };
  }
  return { hesapla };
});
