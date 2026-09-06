#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sayfa kalitesi denetimi: kırık bağlantı, meta, görsel, başlık düzeni, sitemap.

Neden: bunlar sessiz hatalardır. Kırık bir iç bağlantı, 60 karakteri aşan bir
başlık ya da h1'den h3'e atlayan bir başlık düzeni hiçbir yerde hata vermez;
sayfa açılır, her şey çalışıyor görünür. Elle bakıldığında da gözden kaçar.

Denetlenenler:
  1. İç bağlantı ve kaynak bütünlüğü (href/src)
  2. <title> var mı, 60 karakteri aşıyor mu, tekrar ediyor mu
     (60 sınırı: aşınca Google SERP'te "| Koray Öner" ekini kesiyor)
  3. meta description var mı, uzunluğu makul mü, tekrar ediyor mu
  4. canonical var mı
  5. Görsellerde alt ve width/height (CLS)
  6. Tek h1 ve başlık seviyesi atlaması
  7. Sitemap ile gerçek sayfaların örtüşmesi

Kullanım:
    python tools/sayfa-denetimi.py          # bulguları listele
    python tools/sayfa-denetimi.py --check  # bulgu varsa hata ver (CI)
"""

import io
import os
import re
import sys
import glob
from html.parser import HTMLParser

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

# Denetim dışı sayfalar. Bunların başlığı, canonical'ı ya da sitemap kaydı
# OLMAMALIDIR; kural ihlali değil, tasarım gereğidir:
#   - 404 sayfaları: dizine girmemeli
#   - Google Search Console doğrulama dosyası: içeriği değiştirilemez
def denetim_disi(p):
    ad = p.split("/")[-1]
    return ad == "404.html" or ad.startswith("google") and ad.endswith(".html")

TITLE_SINIR = 60
DESC_ALT, DESC_UST = 70, 165


def sayfalari_bul():
    bulunan = set()
    for desen in ("*.html", "*/*.html", "*/*/*.html", "*/*/*/*.html"):
        for p in glob.glob(desen):
            p = p.replace(os.sep, "/")
            if p.split("/")[0] in ("tools", "images", "node_modules"):
                continue
            bulunan.add(p)
    return sorted(bulunan)


def oku(p):
    return io.open(p, encoding="utf-8").read()


class Basliklar(HTMLParser):
    def __init__(self):
        super().__init__()
        self.seviye = []
        self._metin = []
        self._aktif = None

    def handle_starttag(self, t, a):
        if t in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._aktif = int(t[1])
            self._metin.append("")

    def handle_data(self, d):
        if self._aktif and self._metin:
            self._metin[-1] += d

    def handle_endtag(self, t):
        if t in ("h1", "h2", "h3", "h4", "h5", "h6") and self._aktif:
            self.seviye.append((self._aktif, re.sub(r"\s+", " ", self._metin[-1]).strip()[:44]))
            self._aktif = None


def main():
    sayfalar = sayfalari_bul()
    bulgular = []

    def bulgu(tur, sayfa, detay=""):
        bulgular.append((tur, sayfa, detay))

    basliklar, aciklamalar = {}, {}

    for p in sayfalar:
        s = oku(p)
        dizin = os.path.dirname(p)

        # 1) bağlantı ve kaynak bütünlüğü
        hedefler = set(re.findall(r'href="([^"]+)"', s)) | set(re.findall(r'src="([^"]+)"', s))
        for href in hedefler:
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:", "//")):
                continue
            yol = href.split("#")[0].split("?")[0]
            if not yol:
                continue
            taban = "" if yol.startswith("/") else dizin
            hedef = os.path.normpath(os.path.join(taban, yol.lstrip("/")))
            if not (os.path.exists(hedef) or os.path.exists(os.path.join(hedef, "index.html"))):
                bulgu("KIRIK BAGLANTI", p, href)

        if denetim_disi(p):
            continue

        # 2) title
        m = re.search(r"<title>(.*?)</title>", s, re.S)
        if not m:
            bulgu("TITLE YOK", p)
        else:
            t = re.sub(r"\s+", " ", m.group(1)).strip()
            if len(t) > TITLE_SINIR:
                bulgu("TITLE UZUN", p, "%d karakter (sinir %d)" % (len(t), TITLE_SINIR))
            basliklar.setdefault(t, []).append(p)

        # 3) description
        d = re.search(r'<meta name="description" content="([^"]*)"', s)
        if not d:
            bulgu("DESCRIPTION YOK", p)
        else:
            dt = d.group(1).strip()
            if len(dt) > DESC_UST:
                bulgu("DESCRIPTION UZUN", p, "%d karakter (ust %d)" % (len(dt), DESC_UST))
            elif len(dt) < DESC_ALT:
                bulgu("DESCRIPTION KISA", p, "%d karakter (alt %d)" % (len(dt), DESC_ALT))
            aciklamalar.setdefault(dt, []).append(p)

        # 4) canonical
        if not re.search(r'<link rel="canonical"', s):
            bulgu("CANONICAL YOK", p)

        # 5) görseller
        for tag in re.findall(r"<img\b[^>]*>", s):
            if "alt=" not in tag:
                bulgu("IMG ALT YOK", p, tag[:80])
            if ("width=" not in tag or "height=" not in tag) and "aria-hidden" not in tag:
                bulgu("IMG BOYUT YOK", p, tag[:80])

        # 6) başlık düzeni
        b = Basliklar()
        b.feed(s)
        h1 = [x for x in b.seviye if x[0] == 1]
        if len(h1) == 0:
            bulgu("H1 YOK", p)
        elif len(h1) > 1:
            bulgu("BIRDEN FAZLA H1", p, "%d adet" % len(h1))
        onceki = None
        for lvl, metin in b.seviye:
            if onceki is not None and lvl > onceki + 1:
                bulgu("BASLIK ATLAMASI", p, "h%d -> h%d (%s)" % (onceki, lvl, metin))
            onceki = lvl

    for t, ps in basliklar.items():
        if len(ps) > 1:
            bulgu("TITLE TEKRAR", ", ".join(ps), t[:60])
    for d, ps in aciklamalar.items():
        if len(ps) > 1:
            bulgu("DESCRIPTION TEKRAR", ", ".join(ps), d[:60])

    # 7) sitemap kapsamı
    if os.path.exists("sitemap.xml"):
        sm = oku("sitemap.xml")
        sm_urls = set(re.findall(r"<loc>https://korayoner\.dev/(.*?)</loc>", sm))
        sayfa_urls = set()
        for p in sayfalar:
            if denetim_disi(p):
                continue
            if p.endswith("/index.html"):
                sayfa_urls.add(p[: -len("index.html")])
            elif p == "index.html":
                sayfa_urls.add("")
            else:
                sayfa_urls.add(p)
        for u in sorted(sayfa_urls - sm_urls):
            bulgu("SITEMAP EKSIK", u or "(ana sayfa)")
        for u in sorted(sm_urls - sayfa_urls):
            bulgu("SITEMAP FAZLA", u, "sayfa dosyasi yok")

    # rapor
    print("%d sayfa tarandi, %d bulgu" % (len(sayfalar), len(bulgular)))
    if not bulgular:
        print("Temiz.")
        return 0
    print("")
    gruplar = {}
    for tur, sayfa, detay in bulgular:
        gruplar.setdefault(tur, []).append((sayfa, detay))
    for tur in sorted(gruplar, key=lambda t: -len(gruplar[t])):
        print("### %s (%d)" % (tur, len(gruplar[tur])))
        for sayfa, detay in gruplar[tur][:15]:
            print("   %-54s %s" % (sayfa, detay))
        if len(gruplar[tur]) > 15:
            print("   ... +%d tane daha" % (len(gruplar[tur]) - 15))
        print("")
    return 1


kod = main()
if "--check" in sys.argv:
    sys.exit(kod)
