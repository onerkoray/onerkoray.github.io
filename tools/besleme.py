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

# ---------------------------------------------------------------------------
# BESLEME KAPSAMI
#
# Onceki surum yalnizca "*/index.html" ve "makaleler/*/index.html" glob'una
# bakiyordu. Bu SESSIZ bir kordu: fatura-olusturma/metodoloji/ yayinlandiginda
# besleme onu hic gormedi ve kontrol de gecti, cunku sayfanin var oldugunu
# bilmiyordu. Beslemenin engellemesi gereken bayatlamayi kuralin kendisi
# uretiyordu.
#
# Artik SITEDEKI HER dizine acik sayfa siniflandirilmak ZORUNDA: ya beslemeye
# girer ya da asagidaki listelerden birine gerekcesiyle yazilir. Siniflanmamis
# bir sayfa --check'i patlatir; yeni sayfa eklendiginde karar vermek gerekir.
# ---------------------------------------------------------------------------

# Kurumsal ve yasal sayfalar: "yeni icerik" degil, kalici sayfalar.
HARIC_KURUMSAL = {"hakkimda/", "iletisim/", "yayin-ilkeleri/", "gizlilik/", "kullanim-kosullari/"}

# Liste sayfalari: kendileri icerik degil, iceriklerin dizini.
HARIC_LISTE = {"makaleler/"}

# Her is gunu otomatik degisiyor; beslemeye girseydi her gun basa gecerdi.
HARIC_CANLI = {"doviz-kurlari/"}


def haric_turetilmis(u):
    """Tek bir aracin turetilmis alt sayfalari.

    maas-hesaplama/<tutar>-tl-brut-ne-kadar-net/ ve brut-net-tablosu, ayni
    aracin ciktilaridir; dokuzu birden beslemeye girseydi listeyi doldururdu.
    keymint alt araclari ve decorpalette dokumanlari da ust sayfalariyla
    birlikte anilir.
    """
    return ((u.startswith("maas-hesaplama/") and u != "maas-hesaplama/")
            or (u.startswith("keymint/") and u != "keymint/")
            or u.startswith("decorpalette/docs/"))


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


def tum_sayfalar():
    """Sitedeki butun HTML sayfalari (araclar ve icerik)."""
    bulunan = set()
    for desen in ("*.html", "*/*.html", "*/*/*.html", "*/*/*/*.html"):
        for p in glob.glob(desen):
            p = p.replace(os.sep, "/")
            if p.split("/")[0] in ("tools", "images", "node_modules"):
                continue
            ad = p.split("/")[-1]
            if ad == "404.html" or (ad.startswith("google") and ad.endswith(".html")):
                continue
            bulunan.add(p)
    return sorted(bulunan)


def url_yolu(p):
    if p == "index.html":
        return ""
    if p.endswith("/index.html"):
        return p[: -len("index.html")]
    return p


def siniflandir():
    """Her sayfayi ya beslemeye alir ya da gerekcesiyle disarida birakir.

    Doner: (adaylar, disarida, siniflanmamis)
    """
    adaylar, disarida, siniflanmamis = [], [], []
    for yol in tum_sayfalar():
        u = url_yolu(yol)
        if noindex_mi(oku(yol)):
            disarida.append((u, "noindex"))
        elif u == "":
            disarida.append((u, "ana sayfa"))
        elif u in HARIC_KURUMSAL:
            disarida.append((u, "kurumsal/yasal"))
        elif u in HARIC_LISTE:
            disarida.append((u, "liste sayfasi"))
        elif u in HARIC_CANLI:
            disarida.append((u, "gunluk degisiyor"))
        elif haric_turetilmis(u):
            disarida.append((u, "turetilmis alt sayfa"))
        elif u.endswith("/"):
            adaylar.append((SITE + "/" + u, yol))
        else:
            # .html ile biten, dizin olmayan sayfa: beklenmiyor
            siniflanmamis.append(u)
    return adaylar, disarida, siniflanmamis


def adaylar():
    return siniflandir()[0]


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

    _, disarida, siniflanmamis = siniflandir()
    if siniflanmamis:
        print("Siniflandirilmamis sayfa var; beslemeye girip girmeyecegine "
              "karar verilmeli:", file=sys.stderr)
        for u in siniflanmamis:
            print("  - " + u, file=sys.stderr)
        print("tools/besleme.py icindeki listelere ekleyin.", file=sys.stderr)
        return 1

    if "--kapsam" in sys.argv:
        ad, _, _ = siniflandir()
        print("Beslemede (%d):" % len(ad))
        for u, _y in ad:
            print("  + " + u.replace(SITE + "/", ""))
        print("")
        print("Disarida (%d):" % len(disarida))
        for u, neden in sorted(disarida):
            print("  - %-46s %s" % (u or "(ana sayfa)", neden))
        return 0

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
