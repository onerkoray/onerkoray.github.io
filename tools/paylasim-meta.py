#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eksik paylasim meta etiketlerini sayfanin kendi verisinden tamamlar.

NEDEN VAR:
Denetim iki bosluk buldu: 37 sayfada og:image:alt, 32 sayfada
twitter:description yoktu. Ikisi de sessiz eksiklerdir - sayfa acilir, kart
gorunur, kimse hata gormez:
  og:image:alt        -> paylasim kartinin alternatif metni. Ekran okuyucu
                         kullanan biri paylasilan baglantinin ne oldugunu
                         goremiyor.
  twitter:description -> X kendi aciklamasini bulamayinca kartta ya bos alan
                         birakiyor ya da sayfadan rastgele metin seciyor.

Degerler UYDURULMUYOR; sayfanin kendi og:title ve og:description'indan
tureniyor. Bir sayfada bu ikisi de yoksa dokunulmuyor ve rapor ediliyor.

Kullanim:
    python tools/paylasim-meta.py           # eksikleri tamamla
    python tools/paylasim-meta.py --check   # eksik var mi (CI)
"""

import io
import os
import re
import sys
import glob

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)


# 404 ve dogrulama dosyalari denetim disi (bkz. sayfa-denetimi.py)
def denetim_disi(p):
    ad = p.split("/")[-1]
    return ad == "404.html" or (ad.startswith("google") and ad.endswith(".html"))


def sayfalar():
    bulunan = set()
    for desen in ("*.html", "*/*.html", "*/*/*.html", "*/*/*/*.html"):
        for p in glob.glob(desen):
            p = p.replace(os.sep, "/")
            if p.split("/")[0] in ("tools", "images", "node_modules"):
                continue
            if denetim_disi(p):
                continue
            bulunan.add(p)
    return sorted(bulunan)


def oz(s, kalip):
    m = re.search(kalip, s, re.I | re.S)
    return m.group(1).strip() if m else None


def kisalt(metin, sinir=200):
    """X kartinda uzun aciklama kesiliyor; cumle sonunda kesmek daha temiz."""
    if len(metin) <= sinir:
        return metin
    kesik = metin[:sinir]
    for isaret in (". ", "! ", "? "):
        yer = kesik.rfind(isaret)
        if yer > sinir * 0.6:
            return kesik[: yer + 1].strip()
    return kesik.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def duzelt(s):
    """Eksik etiketleri ekler. Doner: (yeni_metin, eklenenler, kaynagi_olmayanlar)."""
    eklenen = []
    kaynak_yok = []

    og_baslik = oz(s, r'<meta property="og:title" content="([^"]*)"')
    # Alt metin gorsele bakamayan kisiye "bu kart neyi gosteriyor" der;
    # "| Koray Öner" site eki oraya ait degil, her kartta tekrar ederdi.
    if og_baslik:
        og_baslik = re.sub(r"\s*\|\s*Koray Öner\s*$", "", og_baslik).strip()
    og_aciklama = oz(s, r'<meta property="og:description" content="([^"]*)"')
    if not og_aciklama:
        og_aciklama = oz(s, r'<meta name="description" content="([^"]*)"')

    # --- og:image:alt : og:image olcu satirlarindan hemen sonra ---
    # Daha once yazilmis alt metinlerdeki site ekini de temizle
    # DIKKAT: burada duz metin replace KULLANILMAZ. Alt metin cogu sayfada
    # og:title ile birebir ayni oldugu icin, content="..." kalibinin ilk
    # eslesmesi og:title'dir; duz replace site ekini yanlis etiketten siler.
    # Bu hata bir kez yapildi ve 29 sayfanin og:title'ini bozdu.
    def alt_temizle(m):
        deger = re.sub(r"\s*\|\s*Koray Öner\s*$", "", m.group(1)).strip()
        return '<meta property="og:image:alt" content="%s">' % deger

    s, adet = re.subn(r'<meta property="og:image:alt" content="([^"]*\|\s*Koray Öner)">',
                      alt_temizle, s)
    if adet:
        eklenen.append("og:image:alt (site eki temizlendi)")

    if not re.search(r'<meta property="og:image:alt"', s, re.I):
        capa = re.search(r'([ \t]*)<meta property="og:image:height"[^>]*>\n', s, re.I)
        if not capa:
            capa = re.search(r'([ \t]*)<meta property="og:image"[^>]*>\n', s, re.I)
        if capa and og_baslik:
            etiket = '%s<meta property="og:image:alt" content="%s">\n' % (
                capa.group(1), og_baslik.replace('"', "&quot;"))
            s = s[: capa.end()] + etiket + s[capa.end():]
            eklenen.append("og:image:alt")
        elif not og_baslik:
            kaynak_yok.append("og:image:alt (og:title yok)")

    # --- twitter:description : twitter:title'dan hemen sonra ---
    if not re.search(r'<meta name="twitter:description"', s, re.I):
        capa = re.search(r'([ \t]*)<meta name="twitter:title"[^>]*>\n', s, re.I)
        if capa and og_aciklama:
            etiket = '%s<meta name="twitter:description" content="%s">\n' % (
                capa.group(1), kisalt(og_aciklama).replace('"', "&quot;"))
            s = s[: capa.end()] + etiket + s[capa.end():]
            eklenen.append("twitter:description")
        elif capa and not og_aciklama:
            kaynak_yok.append("twitter:description (aciklama yok)")

    return s, eklenen, kaynak_yok


def main():
    kontrol = "--check" in sys.argv
    degisen, sorunlu = [], []

    for p in sayfalar():
        eski = io.open(p, encoding="utf-8").read()
        # Paylasim karti olmayan sayfaya dokunulmaz
        if not re.search(r'<meta property="og:image"', eski, re.I):
            continue
        yeni, eklenen, kaynak_yok = duzelt(eski)
        if kaynak_yok:
            sorunlu.append((p, ", ".join(kaynak_yok)))
        if yeni != eski:
            degisen.append((p, ", ".join(eklenen)))
            if not kontrol:
                io.open(p, "w", encoding="utf-8", newline="").write(yeni)

    if kontrol:
        if degisen:
            print("Eksik paylaşım meta etiketi olan %d sayfa:" % len(degisen), file=sys.stderr)
            for p, e in degisen[:15]:
                print("  - %-52s %s" % (p, e), file=sys.stderr)
            if len(degisen) > 15:
                print("  ... +%d sayfa daha" % (len(degisen) - 15), file=sys.stderr)
            print("Düzeltmek için: python tools/paylasim-meta.py", file=sys.stderr)
            return 1
        print("Paylaşım meta etiketleri tam.")
        return 0

    print("%d sayfa güncellendi." % len(degisen))
    for p, e in degisen:
        print("  %-52s + %s" % (p, e))
    if sorunlu:
        print("\nKaynak verisi olmadığı için atlananlar:")
        for p, n in sorunlu:
            print("  %-52s %s" % (p, n))
    return 0


if __name__ == "__main__":
    sys.exit(main())
