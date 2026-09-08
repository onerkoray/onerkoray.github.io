/*!
 * FIRE simülasyonu — Web Worker.
 *
 * NEDEN VAR: ölçüldü. Tek bir simülasyon (2000 yol) 66 ms sürüyor, yani
 * ana iş parçacığında sorun değil. Ama güvenli çekim ikiye bölmeyle
 * çözüldüğü için ~40 tam simülasyon koşturuyor ve 1476 ms sürüyor —
 * bu arayüzü gözle görülür biçimde dondurur.
 *
 * Bu yüzden iş bölümü şöyle: ana simülasyon ana iş parçacığında (anında
 * sonuç), ÇÖZÜCÜLER burada. Worker'ı "mimari olsun diye" değil, ölçüm
 * gerektirdiği için kullanıyoruz.
 *
 * Kaynak mimaride (fireplanner) da ağır simülasyon worker'a veriliyor;
 * oradan alınan fikir bu.
 *
 * Lisans: MIT — Koray Öner
 */
"use strict";
/* eslint-env worker */
importScripts("hesap.js");

self.onmessage = function (e) {
  var d = e.data || {};
  var F = self.FIRE;
  if (!F) {
    self.postMessage({ id: d.id, hata: "cekirdek yuklenemedi" });
    return;
  }
  try {
    if (d.is === "guvenliCekim") {
      self.postMessage({ id: d.id, is: d.is, sonuc: F.guvenliCekim(d.girdi, d.hedef) });
    } else if (d.is === "gerekenBirikim") {
      self.postMessage({ id: d.id, is: d.is, sonuc: F.gerekenBirikim(d.girdi, d.hedef) });
    } else {
      self.postMessage({ id: d.id, hata: "bilinmeyen is: " + d.is });
    }
  } catch (hata) {
    self.postMessage({ id: d.id, hata: String(hata && hata.message ? hata.message : hata) });
  }
};
