#!/usr/bin/env node
/*!
 * 404 sayfası her derinlikte çalışıyor mu?
 *
 * Sunucu olmayan HER adres için 404.html'i o adresin kendisinde sunar:
 * /makaleler/olmayan-yazi/ açıldığında sayfa oradaymış gibi yüklenir. Göreli
 * yol ("style.css", "yayinlar/") bu yüzden yanlış yere gider. 30 Eylül
 * 2026'da canlıda doğrulandı: derin bir adreste 404 tamamen stilsizdi ve
 * menü bağlantıları kırıktı. Kural: 404.html'deki her src/href ya kökten
 * ("/…") ya da tam adresle başlar; yerel css/js/simge damgalıdır.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var html = fs.readFileSync(path.join(__dirname, "..", "404.html"), "utf8");
var hata = [], gecen = 0;
var re = /\b(src|href)=(["'])([^"']*)\2/g, m;
while ((m = re.exec(html))) {
  var v = m[3];
  if (/^(https?:|\/|#|mailto:|tel:|data:)/.test(v)) {
    gecen++;
    if (/^\/[^/].*\.(css|js|svg|ico|png)$/.test(v.split("#")[0])) hata.push("damgasız yerel varlık: " + v);
  } else {
    hata.push("göreli yol: " + m[1] + '="' + v + '"');
  }
}
if (hata.length) {
  console.error("404 sayfası derin adreste bozulur:\n  " + hata.join("\n  "));
  process.exit(1);
}
console.log("404 sayfası: " + gecen + " bağlantı kökten ya da tam adresle, yerel varlıklar damgalı.");
