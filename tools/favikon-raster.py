# -*- coding: utf-8 -*-
"""favicon.ico ve apple-touch-icon.png'yi kök işaretten üretir.

NEDEN AYRI BİR ARAÇ
-------------------
SVG favicon temaya ve seçilen palete uyum sağlar; bu iki raster dosya
sağlayamaz. Yine de var olmaları gerekiyor: .ico eski tarayıcılar, yer
imleri ve arama motorlarının küçük simgesi için; apple-touch-icon ise iOS
ana ekranı için. Yeşil gradyanlı eski sürümde bırakılsalardı, favicon'un
geri kalanı mürekkebe geçmişken sekme/yer imi karışımı ortaya çıkardı.

NEDEN SVG RASTERİZE EDİLMİYOR
-----------------------------
Kök işaret üç çizgiden ibaret; Pillow ile doğrudan çizmek bir tarayıcı
bağımlılığı eklemekten basit ve CI'da çalışır. Koordinatlar favicon.svg
ile AYNI 32 birimlik uzaydan geliyor — orada değişirse burada da
değişmeli, bu yüzden ikisi yan yana duruyor.

KENAR YUMUŞATMA: 8 KAT BÜYÜK ÇİZİP KÜÇÜLTME
-------------------------------------------
Pillow'un çizgi çizimi kenar yumuşatma yapmaz. 16 pikselde doğrudan
çizilen bir çizgi merdiven basamağı gibi görünür. Sekiz kat büyük çizip
LANCZOS ile küçültmek, tarayıcının SVG'den ürettiğine yakın bir sonuç
veriyor.

iOS KÖŞEYİ KENDİ YUVARLAR
-------------------------
apple-touch-icon'da köşe yarıçapı YOK: iOS kendi maskesini uyguluyor ve
üstüne bizimki eklenirse çift yuvarlak köşe çıkar.

    python tools/favikon-raster.py
    python tools/favikon-raster.py --check
"""
import io
import os
import sys

from PIL import Image, ImageDraw

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICO = os.path.join(KOK, "favicon.ico")
APPLE = os.path.join(KOK, "apple-touch-icon.png")

# favicon.svg ile aynı değerler.
MUREKKEP = (23, 32, 29, 255)       # #17201d
KAGIT = (245, 247, 246, 255)       # #f5f7f6
VURGU = (14, 124, 102, 255)        # #0e7c66
YARICAP = 2                        # 32 birimlik uzayda

# Kök işaret </> — favicon.svg'deki 24 kutusu + translate(4 3).
CIZGILER = [
    [(12, 9), (7, 15), (12, 21)],      # sol chevron
    [(20, 9), (25, 15), (20, 21)],     # sağ chevron
    [(18.5, 7), (13.5, 23)],           # eğik çizgi
]
KALINLIK = 2.4
VURGU_KUTU = (4, 27.5, 28, 30.5)   # sol, üst, sağ, alt

KAT = 8                            # kenar yumuşatma için büyütme katsayısı


def ciz(boyut, yuvarlak=True):
    """Kök işareti verilen boyutta üretir."""
    b = boyut * KAT
    k = b / 32.0
    im = Image.new("RGBA", (b, b), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if yuvarlak:
        d.rounded_rectangle([0, 0, b - 1, b - 1], radius=YARICAP * k, fill=MUREKKEP)
    else:
        d.rectangle([0, 0, b - 1, b - 1], fill=MUREKKEP)

    g = max(1, int(round(KALINLIK * k)))
    for yol in CIZGILER:
        n = [(x * k, y * k) for x, y in yol]
        d.line(n, fill=KAGIT, width=g, joint="curve")
        # Yuvarlak uç: Pillow'un line'ı uçları kare bırakıyor.
        for x, y in (n[0], n[-1]):
            r = g / 2.0
            d.ellipse([x - r, y - r, x + r, y + r], fill=KAGIT)

    x0, y0, x1, y1 = [v * k for v in VURGU_KUTU]
    d.rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) / 2.0, fill=VURGU)

    return im.resize((boyut, boyut), Image.LANCZOS)


def uret():
    """(ico baytları, apple baytları)"""
    tampon = io.BytesIO()
    # 48'den üretip Pillow'a küçültmesini bırakmak yerine her boyut AYRI
    # çiziliyor: 16 pikselde çizgi kalınlığı yuvarlanarak belirleniyor ve
    # küçültme o kararı bozuyor.
    kareler = [ciz(n) for n in (48, 32, 16)]
    kareler[0].save(tampon, format="ICO", sizes=[(48, 48), (32, 32), (16, 16)],
                    append_images=kareler[1:])
    ico = tampon.getvalue()

    tampon2 = io.BytesIO()
    ciz(180, yuvarlak=False).save(tampon2, format="PNG", optimize=True)
    return ico, tampon2.getvalue()


def main():
    kontrol = "--check" in sys.argv
    ico, apple = uret()
    bayat = []
    for yol, yeni in ((ICO, ico), (APPLE, apple)):
        var = open(yol, "rb").read() if os.path.exists(yol) else None
        if var != yeni:
            bayat.append(os.path.basename(yol))
            if not kontrol:
                open(yol, "wb").write(yeni)

    if kontrol:
        if bayat:
            print("Raster simgeler kaynakla uyuşmuyor: " + ", ".join(bayat),
                  file=sys.stderr)
            print("Calistir: python tools/favikon-raster.py", file=sys.stderr)
            return 1
        print("Raster simgeler guncel (favicon.ico, apple-touch-icon.png).")
        return 0

    if bayat:
        print("Raster simgeler uretildi: " + ", ".join(bayat))
    else:
        print("Raster simgeler zaten guncel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
