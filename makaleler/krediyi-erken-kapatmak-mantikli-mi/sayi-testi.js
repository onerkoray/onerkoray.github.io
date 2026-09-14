"use strict";
/*
 * Erken kapatma yazısındaki sayıları bağımsız aylık akışla doğrular.
 *
 * TABLO HTML'DEN AYRIŞTIRILIR
 * ---------------------------
 * İlk sürüm yalnızca "sayfada geçiyor mu" diye bakıyordu. Bu kontrol,
 * aynı tutar sayfada BİRDEN FAZLA geçtiğinde bozulan hücreyi kaçırıyor:
 * 113.471,52 ve 126.824,18 yazıda ikişer kez geçiyor, biri bozulsa
 * diğeri eşleşiyor ve test sessizce geçiyordu — ölçüldü. Tablo artık
 * satır satır sökülüp hücre hücre karşılaştırılıyor; prozadaki tekrarlar
 * ayrıca SAYILARAK doğrulanıyor.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

const P = 100000, i = .02, n = 12;
const A = P * i / (1 - (1 + i) ** -n);
const fmt = v => v.toLocaleString("tr-TR",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Kaç kez geçtiğini de sayar: tekrarlanan bir tutarın YALNIZCA BİRİNİN
   bozulması, düz "içeriyor mu" kontrolünden kaçıyordu. */
const kacKez = t => html.split(t).length - 1;
function gecsin(t, beklenen) {
  const n2 = kacKez(t);
  assert.ok(n2 === beklenen,
    `${t} sayfada ${n2} kez geçiyor, beklenen ${beklenen}`);
}

/* --- taksit ve toplam --------------------------------------------- */
gecsin(fmt(A), 1);            // aylık taksit
gecsin(fmt(A * n), 2);        // kalan taksitlerin toplamı (kısa cevap + gövde)

/* --- tabloyu sök --------------------------------------------------- */
const tBlok = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
const satirlar = [...tBlok.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)]
    .map(x => x[1].replace(/<[^>]+>/g, "").trim()))
  .filter(r => r.length);
const govde = satirlar.slice(1);
assert.equal(govde.length, 3, "tabloda üç senaryo satırı olmalı");

/* --- her senaryoyu bağımsız simüle et ------------------------------ */
[.01, .02, .03].forEach((r, k) => {
  let debt = P, closure = 0, deposit = P;
  for (let month = 1; month <= n; month++) {
    debt = debt * (1 + i) - A;   // borç ay ay kapanıyor
    closure = closure * (1 + r) + A;
    deposit *= 1 + r;
  }
  /* Anüite özdeşliği: on iki taksit sonunda borç TAM kapanmalı. */
  assert.ok(Math.abs(debt) < 1e-7, `borç kapanmadı: ${debt}`);

  const s = govde[k];
  assert.equal(s[0], "%" + (k + 1), `satır etiketi: ${s[0]}`);
  assert.equal(s[1], fmt(closure), `kapat-ve-biriktir: ${s[1]} ≠ ${fmt(closure)}`);
  assert.equal(s[2], fmt(deposit), `mevduat+kredi: ${s[2]} ≠ ${fmt(deposit)}`);

  const fark = closure - deposit;
  if (r === i) {
    /* BAŞABAŞ ÖZDEŞLİĞİ: getiri kredi faizine eşitken iki yol birebir
       aynı sonucu vermeli. Modelde para kaybolmadığının kanıtı. */
    assert.ok(Math.abs(fark) < 1e-7, `başabaşta fark var: ${fark}`);
    assert.equal(s[3], "Eşit", s[3]);
  } else {
    assert.ok(s[3].includes(fmt(Math.abs(fark))),
      `fark hücresi: ${s[3]} içinde ${fmt(Math.abs(fark))} yok`);
    assert.ok(s[3].startsWith(fark > 0 ? "Kapatma" : "Mevduat"),
      `önde olan seçenek yanlış: ${s[3]}`);
  }
});

console.log("Erken kapatma makalesi: taksit, üç senaryo ve eşik doğrulandı " +
  "(tablo hücre hücre).");
