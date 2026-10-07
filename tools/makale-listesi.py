#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Makale listelerini yazıların kendisinden üretir.

Neden: aynı yazının kartı üç yerde duruyor (/makaleler/, ana sayfa ve yazının
kendi "ilgili yazılar" bloğu). Elle yazıldığında başlık, özet ve tarih zamanla
ayrışıyor. Bu script başlığı, özeti ve tarihi doğrudan yazının HTML'inden okur;
kicker ve sıralama tools/makaleler.json'da tutulur.

Okuma süresi de gövde metninden hesaplanır (Türkçe için ~200 kelime/dakika).

Kullanım:
    python tools/makale-listesi.py          # listeleri yaz
    python tools/makale-listesi.py --check  # güncel mi, yazma (CI için)
"""

import io
import os
import re
import sys
import json
from html.parser import HTMLParser

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

MANIFEST = "tools/makaleler.json"
LISTE_SAYFA = "makaleler/index.html"
ANA_SAYFA = "index.html"

LBAS = "<!-- MAKALE-LISTESI:BASLANGIC -->"
LBIT = "<!-- MAKALE-LISTESI:BITIS -->"
ABAS = "<!-- ANA-MAKALELER:BASLANGIC -->"
ABIT = "<!-- ANA-MAKALELER:BITIS -->"

AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def oku(p):
    return io.open(p, encoding="utf-8").read()


def yaz(p, s):
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)


class Govde(HTMLParser):
    """Yazının okunabilir gövde metnini toplar (script/style hariç)."""

    def __init__(self):
        super().__init__()
        self.parcalar = []
        self._atla = 0

    def handle_starttag(self, t, a):
        if t in ("script", "style", "nav", "header", "footer"):
            self._atla += 1

    def handle_endtag(self, t):
        if t in ("script", "style", "nav", "header", "footer") and self._atla:
            self._atla -= 1

    def handle_data(self, d):
        if not self._atla:
            self.parcalar.append(d)

    def metin(self):
        return re.sub(r"\s+", " ", " ".join(self.parcalar))


def tarih_tr(iso):
    y, a, g = iso.split("-")
    return "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)


def yazi_bilgisi(kayit):
    slug = kayit["slug"]
    p = "makaleler/%s/index.html" % slug
    s = oku(p)

    m = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    baslik = re.sub(r"<[^>]+>", "", m.group(1))
    baslik = re.sub(r"\s+", " ", baslik).strip()

    d = re.search(r'<meta property="og:description" content="([^"]*)"', s)
    ozet = d.group(1).strip()

    t = re.search(r'"dateModified": "(\d{4}-\d{2}-\d{2})"', s)
    guncelleme = t.group(1)

    g = Govde()
    g.feed(s)
    kelime = len(g.metin().split())
    dakika = max(2, round(kelime / 200.0))

    return {
        "slug": slug,
        "kicker": kayit["kicker"],
        "baslik": baslik,
        "ozet": ozet,
        "guncelleme": guncelleme,
        "dakika": dakika,
        # SVG kart varsa o (her olcekte keskin, PNG'nin onda biri); yoksa PNG.
        "gorsel": kayit.get("gorsel", "images/makale/%s-kart.%s" % (slug, "svg" if os.path.exists(
            os.path.join(KOK, "images", "makale", slug + "-kart.svg")) else "png")),
        "alt": kayit["alt"],
    }


def meta(y, kok):
    return (
        '            <p class="ed-meta">\n'
        '              <span class="ed-author"><img src="%simages/koray-oner-portre-360.webp" '
        'width="24" height="24" alt="" loading="lazy" decoding="async">Koray Öner</span>\n'
        '              <span class="ed-sep" aria-hidden="true">·</span>\n'
        '              <span>%s dk okuma</span>\n'
        '              <span class="ed-sep" aria-hidden="true">·</span>\n'
        '              <span>Güncelleme: <time datetime="%s">%s</time></span>\n'
        '            </p>\n' % (kok, y["dakika"], y["guncelleme"], tarih_tr(y["guncelleme"]))
    )


def figure(y, onek, kok, sizes):
    return (
        '            <figure class="ed-figure">\n'
        '              <a href="%s%s/" tabindex="-1" aria-hidden="true">\n'
        '                <img class="ed-cover" src="%s%s" width="800" height="500"\n'
        '                     sizes="%s" alt="%s" loading="lazy" decoding="async">\n'
        "              </a>\n"
        "            </figure>\n" % (onek, y["slug"], kok, y["gorsel"], sizes, y["alt"])
    )


def mansett(y, onek, kok):
    return (
        '        <article class="ed-lead">\n'
        "          <div>\n"
        '            <p class="ed-kicker">%s</p>\n'
        '            <h2 class="ed-title"><a href="%s%s/">%s</a></h2>\n'
        '            <p class="ed-dek">%s</p>\n'
        "%s"
        "          </div>\n"
        "%s"
        "        </article>\n"
        % (y["kicker"], onek, y["slug"], y["baslik"], y["ozet"],
           meta(y, kok), figure(y, onek, kok, "(max-width: 820px) 100vw, 45vw"))
    )


def satir(y, onek, kok):
    return (
        '          <li class="ed-item">\n'
        "%s"
        "            <div>\n"
        '              <p class="ed-kicker">%s</p>\n'
        '              <h3 class="ed-title"><a href="%s%s/">%s</a></h3>\n'
        '              <p class="ed-dek">%s</p>\n'
        "%s"
        "            </div>\n"
        "          </li>\n"
        % (figure(y, onek, kok, "(max-width: 700px) 100vw, 260px"), y["kicker"],
           onek, y["slug"], y["baslik"], y["ozet"], meta(y, kok))
    )


def liste_blogu(yazilar, onek, kok, bas, bit, mansetli=True):
    p = [bas]
    kalan = yazilar
    if mansetli:
        p.append(mansett(yazilar[0], onek, kok))
        kalan = yazilar[1:]
    if kalan:
        if mansetli:
            p.append('        <div class="ed-rule"><h2>Diğer yazılar</h2></div>')
        p.append('        <ul class="ed-list">')
        for y in kalan:
            p.append(satir(y, onek, kok).rstrip("\n"))
        p.append("        </ul>")
    p.append("        " + bit)
    return "\n".join(p)


def kategori_blogu(yazilar, kategoriler, bas, bit):
    """/makaleler/: manşet (en yeni yazı) + kategori bölümleri.

    Bölüm kimlikleri content.json'daki kategori anahtarlarıdır (#vergi-belge);
    yazıların iz satırı ve /araclar/ aynı çapalara bağlanır. Çipler gerçek
    çapalardır, JS yoksa bölüme kaydırır; katalog.js varsa süzer. Yıl
    süzgeci yalnız birden fazla yayın yılı olduğunda çıkar: tek seçenekli
    süzgeç okura bir şey söylemez.
    """
    lead, kalan = yazilar[0], yazilar[1:]
    sira = [k for k in kategoriler if any(y["kategori"] == k for y in kalan)]
    yillar = sorted({y["yil"] for y in yazilar}, reverse=True)
    p = [bas]
    p.append('        <nav class="chips katalog-cipler" aria-label="Kategoriler" data-katalog-cipler>')
    p.append('          <a class="chip" href="#yazilar" data-bolum="" aria-current="true">Tümü '
             '<span class="chip-sayi">%d</span></a>' % len(yazilar))
    for k in sira:
        n = sum(1 for y in yazilar if y["kategori"] == k)
        p.append('          <a class="chip" href="#%s" data-bolum="%s">%s <span class="chip-sayi">%d</span></a>'
                 % (k, k, kategoriler[k].replace("&", "&amp;"), n))
    p.append("        </nav>")
    if len(yillar) > 1:
        p.append('        <nav class="chips katalog-cipler katalog-yil" aria-label="Yayın yılı" data-katalog-yil>')
        p.append('          <a class="chip" href="#yazilar" data-yil="" aria-current="true">Her yıl</a>')
        for yil in yillar:
            p.append('          <a class="chip" href="#yazilar" data-yil="%s">%s</a>' % (yil, yil))
        p.append("        </nav>")
    p.append('        <p class="katalog-durum" role="status" aria-live="polite"></p>')
    p.append('        <div id="yazilar">')
    p.append(mansett(lead, "", "../").rstrip("\n")
             .replace('<article class="ed-lead">',
                      '<article class="ed-lead" data-bolum-id="%s" data-yil="%s">' % (lead["kategori"], lead["yil"]), 1))
    for k in sira:
        grup = [y for y in kalan if y["kategori"] == k]
        p.append('        <section class="ed-bolum" id="%s" data-bolum-id="%s" aria-labelledby="%s-baslik">' % (k, k, k))
        p.append('          <div class="ed-rule"><h2 id="%s-baslik">%s</h2></div>' % (k, kategoriler[k].replace("&", "&amp;")))
        p.append('          <ul class="ed-list">')
        for y in grup:
            p.append(satir(y, "", "../").rstrip("\n")
                     .replace('<li class="ed-item">', '<li class="ed-item" data-yil="%s">' % y["yil"], 1))
        p.append("          </ul>")
        p.append("        </section>")
    p.append("        </div>")
    p.append("        " + bit)
    return "\n".join(p)


def uygula(icerik, bas, bit, yeni):
    i, j = icerik.find(bas), icerik.find(bit)
    if i == -1 or j == -1:
        print("İşaretçiler bulunamadı: %s / %s" % (bas, bit))
        sys.exit(2)
    return icerik[:i] + yeni + icerik[j + len(bit):]


def main():
    kayitlar = json.loads(oku(MANIFEST))
    yazilar = [yazi_bilgisi(k) for k in kayitlar]
    # En yeni güncelleme önce; eşitlikte manifest sırası korunur
    yazilar.sort(key=lambda y: y["guncelleme"], reverse=True)
    # Kategori ve yayın yılı tek kaynaktan: content.json
    icerik = json.loads(oku("content.json"))
    sayfa = {s["dosya"]: s for s in icerik["sayfalar"]}
    for y in yazilar:
        s = sayfa["makaleler/%s/index.html" % y["slug"]]
        y["kategori"], y["yil"] = s["category"], s["published"][:4]

    isler = [
        (LISTE_SAYFA, LBAS, LBIT, kategori_blogu(yazilar, icerik["kategoriler"], LBAS, LBIT)),
        (ANA_SAYFA, ABAS, ABIT,
         liste_blogu(yazilar[:3], "makaleler/", "", ABAS, ABIT, False)),
    ]

    degisen = []
    for dosya, bas, bit, yeni_blok in isler:
        eski = oku(dosya)
        yeni = uygula(eski, bas, bit, yeni_blok)
        if yeni != eski:
            degisen.append(dosya)
            if "--check" not in sys.argv:
                yaz(dosya, yeni)

    if "--check" in sys.argv:
        if degisen:
            print("Makale listeleri güncel değil: %s" % ", ".join(degisen))
            return 1
        print("Makale listeleri güncel.")
        return 0

    if not degisen:
        print("Değişiklik yok.")
        return 0
    for d in degisen:
        print("%s güncellendi." % d)
    return 0


sys.exit(main())
