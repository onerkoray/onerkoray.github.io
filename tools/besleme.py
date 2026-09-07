#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atom.xml beslemesini sayfalardan uretir ve eksik girdileri yakalar.

NEDEN VAR:
Besleme elle bakiliyordu ve sessizce bayatladi: son dort arac (fatura
olusturma, isveren maliyeti, fazla mesai) eklenmemisti. Besleme robots.txt'te
"Sitemap:" olarak duyuruldugu icin bu, yeni sayfalarin bir kesif yolunu
kaybetmesi demek. Hicbir yerde hata vermeyen, yalnizca eksik kalan bir hata.

TASARIM KARARI:
Var olan girdilerin TARIHLERI KORUNUR. Besleme "yeni ne var" listesidir;
her uretimde bugunun tarihini basmak butun arsivi bugun yayinlanmis gibi
gosterirdi. Yalnizca eksik sayfalar bugunun tarihiyle eklenir, silinen
sayfalar cikarilir, baslik ve ozet sayfadan tazelenir.

Kullanim:
    python tools/besleme.py           # beslemeyi guncelle
    python tools/besleme.py --check   # guncelleme gerekiyor mu (CI)
"""

import io
import os
import re
import sys
import glob
import datetime

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

SITE = "https://korayoner.dev"
BESLEME = "atom.xml"

# Beslemeye GIRMEYECEK sayfalar. Gerekce her biri icin ayri:
#   kurumsal/yasal sayfalar -> "yeni icerik" degil
#   makaleler/ ve index     -> liste sayfasi, kendisi icerik degil
#   doviz-kurlari           -> her is gunu otomatik degisiyor, beslemeyi bogar
#   bordro                  -> arac degil, metodoloji belgesi
HARIC_KOK = {
    "hakkimda", "iletisim", "gizlilik", "kullanim-kosullari",
    "makaleler", "doviz-kurlari", "bordro",
}


def oku(p):
    return io.open(p, encoding="utf-8").read()


def bugun():
    return datetime.date.today().isoformat()


def kacis(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def sayfa_bilgisi(yol):
    """Sayfanin basligi ve meta aciklamasi."""
    s = oku(yol)
    b = re.search(r"<title>(.*?)</title>", s, re.S)
    a = re.search(r'<meta name="description" content="(.*?)"', s, re.S)
    baslik = (b.group(1) if b else "").strip()
    # "| Koray Öner" eki beslemede gereksiz, her girdide tekrar ederdi
    baslik = re.sub(r"\s*\|\s*Koray Öner\s*$", "", baslik)
    return baslik, (a.group(1) if a else "").strip()


def noindex_mi(s):
    return bool(re.search(r'<meta[^>]+name="robots"[^>]*noindex', s, re.I))


def adaylar():
    """Beslemede olmasi gereken sayfalar: kok seviyedeki araclar ve makaleler."""
    bulunan = []
    for yol in sorted(glob.glob("*/index.html")) + sorted(glob.glob("makaleler/*/index.html")):
        yol = yol.replace(os.sep, "/")
        parca = yol.split("/")
        if parca[0] in ("tools", "images"):
            continue
        if len(parca) == 2 and parca[0] in HARIC_KOK:
            continue
        if noindex_mi(oku(yol)):
            continue
        bulunan.append((SITE + "/" + yol[: -len("index.html")], yol))
    return bulunan


def mevcut_girdiler(s):
    """Var olan beslemeden url -> tarih eslemesi."""
    esleme = {}
    for g in re.findall(r"(?s)<entry>(.*?)</entry>", s):
        l = re.search(r'<link[^>]*href="([^"]+)"', g)
        u = re.search(r"<updated>([^<]+)</updated>", g)
        if l:
            esleme[l.group(1)] = u.group(1) if u else None
    return esleme


def uret():
    eski = oku(BESLEME) if os.path.exists(BESLEME) else ""
    tarihler = mevcut_girdiler(eski)

    kayitlar = []
    yeni_eklenen = []
    for url, yol in adaylar():
        baslik, ozet = sayfa_bilgisi(yol)
        tarih = tarihler.get(url)
        if not tarih:
            tarih = bugun() + "T00:00:00+03:00"
            yeni_eklenen.append(url)
        kayitlar.append({"url": url, "baslik": baslik, "ozet": ozet, "tarih": tarih})

    # en yeni ustte
    kayitlar.sort(key=lambda k: k["tarih"], reverse=True)

    en_yeni = kayitlar[0]["tarih"] if kayitlar else bugun() + "T00:00:00+03:00"
    satir = []
    satir.append('<?xml version="1.0" encoding="UTF-8"?>')
    satir.append('<feed xmlns="http://www.w3.org/2005/Atom">')
    satir.append("  <title>Koray Öner — Ücretsiz Web Araçları</title>")
    satir.append("  <subtitle>Türkiye için ücretsiz, reklamsız hesaplama araçları: "
                 "maaş, vergi, kredi ve daha fazlası.</subtitle>")
    satir.append('  <link href="%s/atom.xml" rel="self" type="application/atom+xml"/>' % SITE)
    satir.append('  <link href="%s/" rel="alternate" type="text/html"/>' % SITE)
    satir.append("  <id>%s/</id>" % SITE)
    satir.append("  <updated>%s</updated>" % en_yeni)
    satir.append("  <author><name>Koray Öner</name><uri>%s/</uri></author>" % SITE)
    satir.append("  <icon>%s/favicon.svg</icon>" % SITE)
    for k in kayitlar:
        satir.append("")
        satir.append("  <entry>")
        satir.append("    <title>%s</title>" % kacis(k["baslik"]))
        satir.append('    <link href="%s"/>' % k["url"])
        satir.append("    <id>%s</id>" % k["url"])
        satir.append("    <updated>%s</updated>" % k["tarih"])
        if k["ozet"]:
            satir.append("    <summary>%s</summary>" % kacis(k["ozet"]))
        satir.append("  </entry>")
    satir.append("</feed>")
    return "\n".join(satir) + "\n", yeni_eklenen, len(kayitlar)


def main():
    kontrol = "--check" in sys.argv
    yeni, eklenen, adet = uret()
    eski = oku(BESLEME) if os.path.exists(BESLEME) else ""

    if yeni == eski:
        print("Besleme güncel (%d girdi)." % adet)
        return 0

    if kontrol:
        print("Besleme güncel değil.", file=sys.stderr)
        if eklenen:
            print("Beslemede olmayan sayfalar:", file=sys.stderr)
            for u in eklenen:
                print("  - " + u, file=sys.stderr)
        print("Düzeltmek için: python tools/besleme.py", file=sys.stderr)
        return 1

    io.open(BESLEME, "w", encoding="utf-8", newline="").write(yeni)
    print("Besleme güncellendi: %d girdi." % adet)
    for u in eklenen:
        print("  + " + u)
    return 0


if __name__ == "__main__":
    sys.exit(main())
