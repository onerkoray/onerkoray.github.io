#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Her sayfanın üst menüsünü tek, aynı menüye çeker.

NEDEN
-----
7 Ekim 2026'da site sahibi, makalelere girince Grafikler'in menüden
kaybolduğunu gördü. Ölçüldü: 170 sayfada ~90 farklı menü vardı. Ana
sayfada altı bölüm, makaleler sayfasında başka altı öğe; araçlarda sayfa
içi atlamalar (Hesapla, Nasıl hesaplanır, S.S.S.), yazılarda ilgili bir
araç. Okur sayfa değiştirdikçe menü değişiyor, aynı bölüme her yerden
ulaşamıyordu.

KURAL
-----
  * Genel menü her sayfada aynı yedi öğe, aynı sırada:
        Araçlar · Makaleler · Grafikler · Bordro Motoru · Yayınlar · Hakkımda · Ara
    Ana sayfaya logo götürür; alt sayfalardaki konum izi "Ana Sayfa" ile
    başlar.
  * Sayfanın ait olduğu bölüm işaretlenir: sayfanın kendisiyse
    aria-current="page", bölümün içindeyse aria-current="true".
  * Sayfa içi atlamalar (#...) kaybolmaz: başlığın hemen altındaki
    "Bu sayfada" satırına taşınır (<nav class="yerel-menu">). Sayfa dışına
    giden eski menü öğeleri (ilgili araç, "Aracı aç") düşer; yazının
    gövdesi ve konum izi o bağlantıları zaten taşıyor.
  * 404.html her derinlikte sunulduğu için kök yolları kullanır.

Menü ve "Bu sayfada" satırı site kabuğudur: kart tarihini ve sitemap
lastmod'unu ilerletmez (arac-guncelleme.py ikisini de kabuktan sayar).

Kullanım:
    python tools/menu.py            # yaz
    python tools/menu.py --check    # bütün sayfalar kanonik mi (CI)
"""

import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLA = {".git", "node_modules", "_cekirdek", "_karsilastirma", "docs",
        "decorpalette", "dither-studio", "_kontak", "tools"}

# (etiket, kökten yol, bölüm anahtarı)
MENU = [
    ("Araçlar", "#projects", "araclar"),
    ("Makaleler", "makaleler/", "makaleler"),
    ("Grafikler", "grafikler/", "grafikler"),
    ("Bordro Motoru", "bordro/", "bordro"),
    ("Yayınlar", "yayinlar/", "yayinlar"),
    ("Hakkımda", "hakkimda/", "hakkimda"),
    # Ara: JS ile arama paletini açar (Ctrl/Cmd+K, "/"); JS yoksa /ara/.
    ("Ara", "ara/", "ara"),
]

# Bölüm eşlemesi: kök klasör -> menü anahtarı. Listede olmayan her klasör
# bir araçtır (alt sayfaları ve metodolojileri dahil).
BOLUM = {
    "makaleler": "makaleler",
    "grafikler": "grafikler", "diyagramlar": "grafikler",
    "bordro": "bordro",
    "yayinlar": "yayinlar",
    "hakkimda": "hakkimda", "koray-oner": "hakkimda", "iletisim": "hakkimda",
    "yayin-ilkeleri": "hakkimda", "gizlilik": "hakkimda", "kullanim-kosullari": "hakkimda",
    "ara": "ara",
}

NAV = re.compile(r'(?P<girinti>[ \t]*)<nav class="site-nav" aria-label="Birincil">.*?</nav>', re.S)
YEREL = re.compile(r'\n[ \t]*<nav class="yerel-menu" aria-label="Bu sayfada">.*?</nav>\n', re.S)
LINK = re.compile(r'<a\b([^>]*)>(.*?)</a>', re.S)


def sayfalar():
    for kok, dizinler, dosyalar in os.walk(KOK):
        dizinler[:] = sorted(d for d in dizinler if d not in ATLA and not d.startswith("."))
        for f in sorted(dosyalar):
            if f.endswith(".html"):
                yield os.path.join(kok, f)


def goreli(yol):
    return os.path.relpath(yol, KOK).replace(os.sep, "/")


def bolum(gyol):
    if gyol in ("index.html", "404.html"):
        return "araclar" if gyol == "index.html" else None
    ilk = gyol.split("/")[0]
    if gyol.count("/") == 0:
        return None            # kökteki diğer tekil sayfalar (doğrulama dosyaları vb.)
    return BOLUM.get(ilk, "araclar")


def onek(gyol):
    if gyol == "404.html":
        return "/"
    return "../" * gyol.count("/")


def menu_html(gyol, girinti):
    on, aktif = onek(gyol), bolum(gyol)
    satirlar = [girinti + '<nav class="site-nav" aria-label="Birincil">', girinti + "  <ul>"]
    for etiket, yol, anahtar in MENU:
        if yol.startswith("#"):
            href = yol if gyol == "index.html" else on + yol      # ../#projects, 404'te /#projects
        else:
            href = on + yol
        isaret = ""
        if anahtar == aktif:
            kendisi = (gyol == "index.html" and anahtar == "araclar") or gyol == yol + "index.html"
            isaret = ' aria-current="%s"' % ("page" if kendisi else "true")
        satirlar.append(girinti + '    <li><a href="%s"%s>%s</a></li>' % (href, isaret, etiket))
    satirlar += [girinti + "  </ul>", girinti + "</nav>"]
    return "\n".join(satirlar)


def yerel_html(ogeler):
    if not ogeler:
        return ""
    lis = "".join('<li><a href="%s">%s</a></li>' % (h, e) for h, e in ogeler)
    return ('\n  <nav class="yerel-menu" aria-label="Bu sayfada">\n'
            '    <div class="wrap"><span class="yerel-menu__baslik">Bu sayfada</span>'
            "<ul>" + lis + "</ul></div>\n"
            "  </nav>\n")


def yerel_ogeler(html):
    """Sayfa içi atlamalar: önce mevcut "Bu sayfada" satırından, yoksa eski
    menünün # ile başlayan öğelerinden (genel menüdekiler hariç)."""
    m = YEREL.search(html)
    kaynak = m.group(0) if m else (NAV.search(html).group(0) if NAV.search(html) else "")
    ogeler = []
    for oz, ic in LINK.findall(kaynak):
        h = re.search(r'href="([^"]*)"', oz)
        if not h or not h.group(1).startswith("#") or h.group(1) == "#projects":
            continue
        etiket = re.sub(r"<[^>]+>", "", ic).strip()
        if (h.group(1), etiket) not in ogeler:
            ogeler.append((h.group(1), etiket))
    return ogeler


def donustur(html, gyol):
    m = NAV.search(html)
    if not m:
        return html
    yerel = yerel_ogeler(html)
    html = YEREL.sub("\n", html)
    html = NAV.sub(lambda x: menu_html(gyol, x.group("girinti")), html, count=1)
    if yerel:
        i = html.find("</header>")
        if i < 0:
            raise SystemExit("Başlık sonu bulunamadı: " + gyol)
        j = i + len("</header>")
        if html.startswith("\n", j):          # çoğu sayfa: </header> satır sonuyla biter
            html = html[:j + 1] + yerel_html(yerel).lstrip("\n") + html[j + 1:]
        else:                                  # sıkışık yazılmış sayfa: </header><main>
            html = html[:j] + yerel_html(yerel).rstrip("\n") + "\n  " + html[j:]
    return html


def main():
    kontrol = "--check" in sys.argv
    bayat, yazilan = [], 0
    for yol in sayfalar():
        gyol = goreli(yol)
        eski = io.open(yol, encoding="utf-8", newline="").read()
        yeni = donustur(eski, gyol)
        if yeni != eski:
            if kontrol:
                bayat.append(gyol)
            else:
                io.open(yol, "w", encoding="utf-8", newline="").write(yeni)
                yazilan += 1
    if kontrol:
        if bayat:
            print("Menü kanonik değil (%d sayfa): %s" % (len(bayat), ", ".join(bayat[:8])))
            print("Çalıştır: python tools/menu.py")
            sys.exit(1)
        print("Bütün sayfalarda menü aynı.")
    else:
        print("%d sayfanın menüsü yazıldı." % yazilan)


if __name__ == "__main__":
    main()
