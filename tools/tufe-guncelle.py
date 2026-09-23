#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TÜFE aylık değişim serisini TCMB'den çek, finans/tufe-serisi.js'e yaz.

NEDEN BU KAYNAK
---------------
finans/enflasyon-motoru.js yıllarca "TÜFE serisi burada yok: güvenilir,
anahtarsız bir kaynak henüz doğrulanmadı" diyordu. TÜİK'in veri portalı
bir JS uygulaması (sunucu boş kabuk döndürüyor), EVDS anahtar istiyor.
TCMB'nin "Tüketici Fiyatları" sayfası ise TÜİK verisini STATİK bir HTML
tablosunda yayımlıyor: 2005'ten bugüne aylık ve yıllık % değişim.

NEDEN GÜVENİLİR SAYIYORUZ
-------------------------
Tablonun kendisi değil, ondan türeyen sonuç denetleniyor: 5510 s.K. m.55
uyarınca SSK ve Bağ-Kur aylıkları önceki altı ayın TÜFE değişimi kadar
artar. Aylık oranların bileşiği açıklanmış dört resmî artışı iki
ondalığa kadar veriyor (Ocak 2024 %37,57 · Temmuz 2024 %24,73 ·
Ocak 2025 %15,75 · Temmuz 2025 %16,67). Kaynak geçmişi değiştirirse ya da
biçim bozulursa bu kontrol düşer ve dosya YAZILMAZ.

REDDEDİLEN VERİ
---------------
- 240'tan az ay, ay atlaması, makul aralık dışı oran
- son ayı depodaki son aydan GERİDE olan tablo (kaynak geri gitmiş)
- depodaki bir geçmiş ayın DEĞİŞMESİ (TÜİK geçmişi revize etmez; değişim
  ayrıştırma hatasıdır)

  python tools/tufe-guncelle.py          # çek, doğrula, değiştiyse yaz
  python tools/tufe-guncelle.py --check  # yalnızca kaynağı dene
"""
import html
import io
import json
import os
import re
import sys
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEDEF = os.path.join(KOK, "finans", "tufe-serisi.js")
KAYNAK = ("https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/"
          "Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari")
UA = "Mozilla/5.0 (korayoner.dev veri guncelleme; +https://korayoner.dev/)"

# Açıklanmış resmî SSK/Bağ-Kur artışları: (zam yılı, zam ayı, oran %).
# Seri bunları üretemiyorsa güvenilmez.
RESMI = [(2024, 1, 37.57), (2024, 7, 24.73), (2025, 1, 15.75), (2025, 7, 16.67)]


def cek():
    req = urllib.request.Request(KAYNAK, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def ayristir(s):
    seri = {}
    for satir in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", s):
        h = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip()
             for x in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", satir)]
        if len(h) == 3 and re.match(r"^\d\d-\d{4}$", h[0]):
            ay, yil = h[0].split("-")
            seri["%s-%s" % (yil, ay)] = {"yillik": float(h[1]), "aylik": float(h[2])}
    return seri


def sonraki(anahtar):
    y, a = map(int, anahtar.split("-"))
    return "%04d-%02d" % (y + (a == 12), 1 if a == 12 else a + 1)


def donem_artisi(seri, yil, ay):
    """Ocak zammı: önceki yılın Tem–Ara; Temmuz zammı: aynı yılın Oca–Haz."""
    aylar = (["%04d-%02d" % (yil - 1, m) for m in range(7, 13)] if ay == 1
             else ["%04d-%02d" % (yil, m) for m in range(1, 7)])
    k = 1.0
    for a in aylar:
        k *= 1 + seri[a]["aylik"] / 100
    return (k - 1) * 100


def dogrula(seri, eski):
    hatalar = []
    anahtarlar = sorted(seri)
    if len(anahtarlar) < 240:
        hatalar.append("yalnızca %d ay ayrıştırıldı (>=240 beklenir)" % len(anahtarlar))
        return hatalar
    for a, b in zip(anahtarlar, anahtarlar[1:]):
        if sonraki(a) != b:
            hatalar.append("ay atlaması: %s -> %s" % (a, b))
    for a in anahtarlar:
        v = seri[a]
        if not (-10 < v["aylik"] < 30):
            hatalar.append("%s aylık oran makul değil: %s" % (a, v["aylik"]))
        if not (-10 < v["yillik"] < 150):
            hatalar.append("%s yıllık oran makul değil: %s" % (a, v["yillik"]))
    for yil, ay, resmi in RESMI:
        try:
            h = donem_artisi(seri, yil, ay)
        except KeyError as eksik:
            # Resmî dönemin bir ayı yoksa çökme değil, anlaşılır ret.
            hatalar.append("%d/%02d resmî artışının ayı seride yok: %s" % (yil, ay, eksik))
            continue
        if abs(round(h, 2) - resmi) > 0.005:
            hatalar.append("%d/%02d resmî artış %.2f, seriden %.4f" % (yil, ay, resmi, h))
    if eski:
        if max(anahtarlar) < max(eski):
            hatalar.append("kaynak geri gitmiş: son ay %s < depodaki %s" % (max(anahtarlar), max(eski)))
        for a, v in eski.items():
            if a in seri and seri[a]["aylik"] != v["aylik"]:
                hatalar.append("geçmiş ay değişmiş: %s %s -> %s" % (a, v["aylik"], seri[a]["aylik"]))
    return hatalar


def mevcut():
    if not os.path.exists(HEDEF):
        return {}
    m = re.search(r"/\*VERI\*/([\s\S]*?)/\*VERI-SON\*/", io.open(HEDEF, encoding="utf-8").read())
    return json.loads(m.group(1)) if m else {}


def yaz(seri):
    satirlar = []
    for a in sorted(seri):
        satirlar.append('    "%s": {"aylik": %s, "yillik": %s}' % (a, seri[a]["aylik"], seri[a]["yillik"]))
    govde = "{\n" + ",\n".join(satirlar) + "\n  }"
    metin = u"""/*!
 * TÜFE aylık ve yıllık %% değişim serisi — ÜRETİLİR, ELLE DÜZENLENMEZ.
 *
 * Kaynak : TCMB, Tüketici Fiyatları (TÜİK verisi)
 *          %s
 * Üreteç : tools/tufe-guncelle.py (her iş günü, veri-guncelle.yml)
 *
 * Üreteç yazmadan önce seriden açıklanmış dört SSK/Bağ-Kur artışını yeniden
 * hesaplar; tutmazsa dosya yazılmaz. Geçmiş bir ayın değişmesi ve kaynağın
 * geri gitmesi de reddedilir.
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.TufeSerisi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var aylar = /*VERI*/%s/*VERI-SON*/;
  var anahtarlar = Object.keys(aylar).sort();
  return {
    kaynak: "TCMB, Tüketici Fiyatları (TÜİK verisi)",
    kaynakUrl: "%s",
    aylar: aylar,
    ilkAy: anahtarlar[0],
    sonAy: anahtarlar[anahtarlar.length - 1]
  };
});
""" % (KAYNAK, govde, KAYNAK)
    io.open(HEDEF, "w", encoding="utf-8", newline="\n").write(metin)


def main():
    for akis in (sys.stdout, sys.stderr):
        try:
            akis.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    kontrol = "--check" in sys.argv
    seri = ayristir(cek())
    eski = mevcut()
    hatalar = dogrula(seri, eski)
    if hatalar:
        print("TÜFE serisi REDDEDİLDİ, dosya yazılmadı:", file=sys.stderr)
        for h in hatalar[:20]:
            print("  - " + h, file=sys.stderr)
        return 1
    son = max(seri)
    print("TCMB TÜFE tablosu TAMAM — %d ay, %s -> %s; son ay aylık %%%s" % (
        len(seri), min(seri), son, seri[son]["aylik"]))
    if kontrol:
        return 0
    if seri == eski:
        print("TÜFE serisi değişmedi.")
        return 0
    yaz(seri)
    yeni = sorted(set(seri) - set(eski))
    if len(yeni) > 6:
        ozet = ": %d ay (%s -> %s)" % (len(yeni), yeni[0], yeni[-1])
    else:
        ozet = (": yeni ay " + ", ".join(yeni)) if yeni else ""
    print("TÜFE serisi yazıldı%s." % ozet)
    return 0


if __name__ == "__main__":
    sys.exit(main())
