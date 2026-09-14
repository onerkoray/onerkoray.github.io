#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Makalelerin veri gorselini govdeye CRAWL EDILEBILIR bicimde yerlestirir.

NEDEN VAR
---------
2026-09-14 denetimi: 21 makalenin 12'sinin govdesinde TEK BIR <img> yoktu.
Bu makalelerin veri gorselleri CSS ile ciziliyor (.otv-*, .fm-*, .em-*,
.deposit-* siniflari) — sayfada guzel gorunuyor, tema degisince uyuyor,
testle sabitlenebiliyor. Ama Google Images bir CSS duzenini indeksleyemez.

Yani sitenin en ozgun gorsel varliklari — hesaplanmis, konuya ozel, baska
hicbir yerde olmayan grafikler — gorsel aramaya tamamen gorunmezdi.

COZUM YENI ASSET URETMEK DEGIL
------------------------------
tools/makale-gorsel.js her makale icin ZATEN iki dosya uretiyor:
  <slug>.png        1200x630  baslik blogu + grafik  (og:image)
  <slug>-kart.png    800x500  yalniz grafik          (kart gorseli)

Ikincisi tam olarak aranan sey: baslik mobilyasi olmayan saf veri gorseli.
Govdeye o konuyor. Sifir gorsel uretimi, sifir yeni bakim yuku.

NE ZAMAN EKLENIR
----------------
Yalnizca govdesinde BASKA <img> olmayan makalelere. Zaten gorseli olan
dokuz makaleye ikinci bir lead gorsel koymak tekrar olurdu. Karar her
kosuda yeniden olculuyor (yonetilen blok disindaki <img> sayisi), boylece
--check deterministik kaliyor.

ALT ve ALTYAZI AYRI SEYLERDIR
-----------------------------
  alt     — goremeyene grafigin NE GOSTERDIGINI anlatir
  altyazi — gorene grafigin BULGUSUNU soyler, gorunur metindir
Ikisi de tools/makaleler.json'dan geliyor; burada uydurulmuyor. Altyazisi
olmayan makaleye blok EKLENMEZ ve rapor edilir — kritik veriyi yalniz alt
icinde birakmamak icin.

LAZY YOK
--------
Bu gorsel sayfanin ilk ekranina yakin; LCP adayi. loading="lazy" konursa
LCP gecikir. width/height veriliyor ki yer kaymasi (CLS) olmasin.

  python tools/makale-gorseli.py           # yaz
  python tools/makale-gorseli.py --check   # guncel mi (CI)
"""
import io
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(KOK, "tools", "makaleler.json")
BAS = "<!-- LEAD-GORSEL:BASLANGIC -->"
BIT = "<!-- LEAD-GORSEL:BITIS -->"
GOVDE_CAPA = '<div class="wrap prose ed-body">'


def oku(p):
    return io.open(p, encoding="utf-8").read()


def yaz(p, s):
    io.open(p, "w", encoding="utf-8", newline="").write(s)


def kacis(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def blok(kayit):
    """Yonetilen figure blogu."""
    slug = kayit["slug"]
    return (
        BAS + "\n"
        '          <figure class="ed-veri-gorseli">\n'
        '            <img src="../../images/makale/%s-kart.png"\n'
        '                 width="800" height="500" decoding="async"\n'
        '                 alt="%s">\n'
        "            <figcaption>%s</figcaption>\n"
        "          </figure>\n"
        "          " % (slug, kacis(kayit["alt"]), kacis(kayit["altyazi"]))
    ) + BIT


def govde_img_sayisi(s):
    """Yonetilen blok ve yazar portresi DISINDAKI <img> sayisi."""
    g = re.sub(r"<head[\s\S]*?</head>", "", s)
    g = re.sub(re.escape(BAS) + r"[\s\S]*?" + re.escape(BIT), "", g)
    return len([t for t in re.findall(r"<img[^>]*>", g)
                if "portre" not in t and "brand-mark" not in t])


def uygula(kayit):
    """Bir makaleyi guncelle; (degisti, mesaj) dondurur."""
    slug = kayit["slug"]
    yol = os.path.join(KOK, "makaleler", slug, "index.html")
    if not os.path.exists(yol):
        return False, "sayfa yok"
    s = oku(yol)
    var = BAS in s
    gorsel = os.path.join(KOK, "images", "makale", "%s-kart.png" % slug)
    gerekli = (govde_img_sayisi(s) == 0
               and kayit.get("altyazi")
               and os.path.exists(gorsel))

    if gerekli and not var:
        i = s.index(GOVDE_CAPA) + len(GOVDE_CAPA)
        yeni = s[:i] + "\n          " + blok(kayit) + s[i:]
    elif gerekli and var:
        yeni = re.sub(re.escape(BAS) + r"[\s\S]*?" + re.escape(BIT),
                      lambda m: blok(kayit), s, count=1)
    elif var and not gerekli:
        # Makale kendi gorselini kazanmis: yonetilen blok kalkar.
        yeni = re.sub(r"\n\s*" + re.escape(BAS) + r"[\s\S]*?" + re.escape(BIT),
                      "", s, count=1)
    else:
        return False, ""

    if yeni == s:
        return False, ""
    if "--check" not in sys.argv:
        yaz(yol, yeni)
    return True, slug


def main():
    kayitlar = json.loads(oku(MANIFEST))
    degisen = []
    altyazisiz = []
    for k in kayitlar:
        yol = os.path.join(KOK, "makaleler", k["slug"], "index.html")
        if not os.path.exists(yol):
            continue
        s = oku(yol)
        if govde_img_sayisi(s) == 0 and not k.get("altyazi"):
            altyazisiz.append(k["slug"])
        d, ad = uygula(k)
        if d:
            degisen.append(ad)

    if altyazisiz:
        print("Altyazisi olmadigi icin atlanan (%d):" % len(altyazisiz))
        for a in altyazisiz:
            print("  - " + a)

    if "--check" in sys.argv:
        if degisen:
            print("Lead gorselleri guncel degil: %s" % ", ".join(degisen))
            print("Calistir: python tools/makale-gorseli.py")
            return 1
        print("Lead gorselleri guncel.")
        return 0

    if not degisen:
        print("Degisiklik yok.")
        return 0
    print("%d makalede lead gorseli yazildi." % len(degisen))
    for d in degisen:
        print("  " + d)
    return 0


sys.exit(main())
