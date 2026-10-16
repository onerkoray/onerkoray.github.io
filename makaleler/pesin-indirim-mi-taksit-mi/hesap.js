"use strict";

/* Taksitlerin bugünkü değeri. Oran, vergiler ve masraflar sonrası
 * erişilebilir aylık net fırsat getirisidir; banka teklifi değildir. */
function bugunkuDeger(taksit, adet, aylikOran, ilkAy) {
  if (!(taksit > 0) || !Number.isInteger(adet) || adet < 1 ||
      !(aylikOran >= 0) || !Number.isInteger(ilkAy) || ilkAy < 0) {
    throw new RangeError("Geçerli taksit, adet, oran ve ilk ay gerekli.");
  }
  var toplam = 0;
  for (var i = 0; i < adet; i++) toplam += taksit / Math.pow(1 + aylikOran, i + ilkAy);
  return toplam;
}

function esikOran(pesin, taksit, adet, ilkAy) {
  if (!(pesin > 0) || pesin > taksit * adet) throw new RangeError("Peşin fiyat toplam taksiti aşamaz.");
  var alt = 0, ust = 1;
  for (var i = 0; i < 100; i++) {
    var orta = (alt + ust) / 2;
    if (bugunkuDeger(taksit, adet, orta, ilkAy) > pesin) alt = orta;
    else ust = orta;
  }
  return (alt + ust) / 2;
}

function ornek() {
  var pesin = 10800, taksit = 2000, adet = 6;
  return {
    etiket: 12000, pesin: pesin, taksit: taksit, adet: adet,
    indirim: 12000 - pesin,
    esikSonrakiAy: esikOran(pesin, taksit, adet, 1),
    esikBugun: esikOran(pesin, taksit, adet, 0),
    ikiSonraki: bugunkuDeger(taksit, adet, 0.02, 1),
    ikiBugun: bugunkuDeger(taksit, adet, 0.02, 0),
    dortSonraki: bugunkuDeger(taksit, adet, 0.04, 1),
    dortBugun: bugunkuDeger(taksit, adet, 0.04, 0)
  };
}

module.exports = { bugunkuDeger: bugunkuDeger, esikOran: esikOran, ornek: ornek };
