# -*- coding: utf-8 -*-
"""Ana sayfadaki kart karolarini tools/card-icons.json'dan uretir.

ONCESI: her kart 600x200 bir .webp goruntusuydu (make-card-tiles.py).
Goruntu oldugu icin icindeki sembol hareket edemiyordu, ekranda
bulaniklasiyordu ve 27 istek / 116KB tutuyordu.

SIMDI: karo sayfanin kendi ogesi. Zemin CSS gradyani, sembol gercek SVG.
Boylece her sembol tek tek hareket edebiliyor, uzerine gelince tepki
veriyor ve her piksel yogunlugunda net kaliyor.

Sembol BURADA YAZILMIYOR, card-icons.json'dan aliniyor - ikonlarin tek
dogruluk kaynagi orasi. --check ikisinin ayni kaldigini dogruluyor;
biri degisip digeri kalirsa kart ile arac ikonu birbirini tutmaz.

Kullanim:
    python tools/kart-karo.py           # karolari uret
    python tools/kart-karo.py --check   # karolar kaynakla ayni mi
"""
import io
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "index.html")
KAYNAK = os.path.join(KOK, "tools", "card-icons.json")

# Eski <img ...> karosu ya da uretilmis <div class="karo"> karosu.
ESKI_IMG = re.compile(
    '<img class="project-cover project-cover--tile" src="images/tiles/'
    '([a-z0-9-]+)[.]webp"[^>]*>', re.S)
KARO = re.compile(
    '<div class="karo karo--([a-z]+)" data-karo="([a-z0-9-]+)" aria-hidden="true">'
    '(.*?)</div>', re.S)


def karo_html(slug, rec):
    return ('<div class="karo karo--%s" data-karo="%s" aria-hidden="true">'
            '<span class="karo-ikon">%s</span></div>'
            % (rec["cat"], slug, rec["svg"].strip()))


def main():
    kontrol = "--check" in sys.argv
    ikon = json.load(io.open(KAYNAK, encoding="utf-8"))
    s = io.open(SAYFA, encoding="utf-8").read()
    bulgu = []

    # 1) ilk gecis: kalmis <img> karolari
    def img_degistir(m):
        slug = m.group(1)
        if slug not in ikon:
            bulgu.append("%s card-icons.json'da yok" % slug)
            return m.group(0)
        return karo_html(slug, ikon[slug])

    yeni, img_sayisi = ESKI_IMG.subn(img_degistir, s)

    # 2) mevcut karolar kaynakla ayni mi
    def karo_degistir(m):
        cat, slug, ic = m.group(1), m.group(2), m.group(3)
        if slug not in ikon:
            bulgu.append("%s card-icons.json'da yok" % slug)
            return m.group(0)
        return karo_html(slug, ikon[slug])

    yeni, karo_sayisi = KARO.subn(karo_degistir, yeni)

    if bulgu:
        for b in bulgu:
            print("BULGU:", b)
        return 1

    if kontrol:
        if yeni != s:
            print("Kart karolari card-icons.json ile ayni degil.")
            print("Duzeltmek icin: python tools/kart-karo.py")
            return 1
        print("Kart karolari guncel (%d karo)." % karo_sayisi)
        return 0

    if yeni != s:
        io.open(SAYFA, "w", encoding="utf-8", newline="").write(yeni)
    # img_sayisi kadari bu calismada goruntuden cevrildi; karo_sayisi
    # zaten TOPLAM karo sayisi (cevrilenler dahil), ikisi toplanmaz.
    print("%d karo yazildi (%d'i goruntuden cevrildi)." % (karo_sayisi, img_sayisi))
    return 0


if __name__ == "__main__":
    sys.exit(main())
