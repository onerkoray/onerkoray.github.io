#!/usr/bin/env node
/*
 * Gecikme zammı — sayfadaki SSS rakamları ve oran tablosu.
 * Sayfadaki statik oran tablosu motorun oran listesiyle satır satır aynı
 * olmalı (2018'den bu yana); yeni oran eklenince sayfa da güncellenmeli.
 *
 * Kullanım: node gecikme-zammi-hesaplama/test.js
 */
"use strict";

var path = require("path");
var fs = require("fs");
var S = require("../tools/makale-sayi.js");
var G = require(path.join(S.KOK, "finans", "gecikme-zammi.js"));
var t = S.yazi(__dirname);

var r = G.hesapla({ tutar: 100000, vade: "2025-03-31", odeme: "2026-09-25" });
t.gecsin("toplam zam", "gecikme zammı " + S.tl(r.zam) + " TL, toplam borç " + S.tl(r.toplam) + " TL");
t.gecsin("birinci dönem", S.tl(r.donemler[0].zam) + " TL'si %4,5'lik dönemden (" + r.donemler[0].ay + " ay " + r.donemler[0].gun + " gün)");
t.gecsin("ikinci dönem", S.tl(r.donemler[1].zam) + " TL'si 13 Kasım 2025'ten sonraki %3,7'lik dönemden (" + r.donemler[1].ay + " ay " + r.donemler[1].gun + " gün)");
t.dogru("iki dönem ve oranlar", r.donemler.length === 2 && r.donemler[0].oran === 0.045 && r.donemler[1].oran === 0.037);
var k = G.hesapla({ tutar: 100000, vade: "2026-01-10", odeme: "2026-03-25" });
t.gecsin("gün örneği", "%3,7 ile " + S.tl(k.zam) + " TL zam");
var son = G.ORANLAR[G.ORANLAR.length - 1];
t.gecsin("güncel oran", "aylık %" + String(Math.round(son.oran * 1000) / 10).replace(".", ",") + " (10556");
t.gecsin("yıllık basit", "yıllık basit %" + String(Math.round(son.oran * 12 * 1000) / 10).replace(".", ","));

/* Statik oran tablosu = motorun listesi (2018'den bu yana, yeniden eskiye) */
var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var tablo = html.slice(html.indexOf("Gecikme zammı oranları, 2018"), html.indexOf("</table>", html.indexOf("Gecikme zammı oranları, 2018")));
var satirlar = tablo.match(/<tr><th scope="row">[^<]+<\/th><td>[^<]+<\/td>/g) || [];
var beklenen = G.ORANLAR.filter(function (x) { return x.bas >= "2018-01-01"; }).reverse().map(function (x) {
  return '<tr><th scope="row">' + x.bas.split("-").reverse().join(".") + "</th><td>%" + String(Math.round(x.oran * 1000) / 10).replace(".", ",") + "</td>";
});
t.dogru("sayfadaki oran tablosu motorla aynı", JSON.stringify(satirlar) === JSON.stringify(beklenen), satirlar.length + " satır");
t.bitir();
