# -*- coding: utf-8 -*-
"""Gözden geçirme kapısı için kontak sayfası üretir.

AGENTS.md "5. Görsel ve hareket standardı" bölümündeki gözden geçirme kapısının
aracı. Görsel bir değişiklik yayına çıkmadan önce sayfalar üç görünümde çekilir
ve tek bir PNG'de yan yana konur:

    masaüstü açık (1280)  ·  masaüstü koyu (1280)  ·  telefon (390)

Kareler "hareketi azalt" açıkken çekilir: aynı sayfa her seferinde aynı kareyi
verir, önce/sonra karşılaştırması animasyonun hangi anına denk geldiğine bağlı
olmaz. Hareketin kendisi ayrı denetlenir (tools/hareket-test.js).

Kullanım:
    python tools/kontak-sayfasi.py                     # varsayılan sayfalar
    python tools/kontak-sayfasi.py / maas-hesaplama/   # seçilen sayfalar
    python tools/kontak-sayfasi.py --cikti once.png    # çıktı adı

Çıktı varsayılan olarak _kontak/kontak.png (depoya girmez, .gitignore).
CI'da koşmaz: tarayıcı ve gözle bakan biri ister.
"""
import os, subprocess, sys, tempfile

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARSAYILAN = ["", "maas-hesaplama/", "ne-zaman-emekli-olurum/", "makaleler/", "makaleler/torba-yasa-ne-var-ne-yok/"]
PENCERE_ALT = 500   # başsız Chrome bundan dar pencere açmıyor
GORUNUMLER = [("Masaüstü · açık", 1280, 1400, False), ("Masaüstü · koyu", 1280, 1400, True), ("Telefon", 390, 1400, False)]
CHROME_ADAYLARI = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium",
]


def chrome_bul():
    for p in CHROME_ADAYLARI:
        if os.path.exists(p):
            return p
    sys.exit("Chrome bulunamadı.")


def cek(chrome, yol, gen, yuk, koyu, cikti, gecici):
    dosya = os.path.join(KOK, yol.replace("/", os.sep), "index.html") if not yol.endswith(".html") else os.path.join(KOK, yol)
    if not os.path.exists(dosya):
        sys.exit("Sayfa yok: " + yol)
    url = "file:///" + dosya.replace(os.sep, "/")
    pencere = gen
    if gen < PENCERE_ALT:
        # Başsız Chrome pencereyi ~500 pikselden dar açmıyor: sayfa o genişliğe
        # dizilip kırpılıyordu ve telefon karesi taşıyor gibi görünüyordu.
        # Telefon genişliği gerçek bir iframe ile verilir.
        sar = os.path.join(gecici, "telefon-%d.html" % gen)
        with open(sar, "w", encoding="utf-8") as f:
            f.write('<!doctype html><meta charset="utf-8"><body style="margin:0">'
                    '<iframe src="%s" style="border:0;display:block;width:%dpx;height:%dpx"></iframe>' % (url, gen, yuk))
        url, pencere = "file:///" + sar.replace(os.sep, "/"), PENCERE_ALT
    komut = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--disable-extensions",
             "--allow-file-access-from-files",
             "--force-device-scale-factor=1", "--window-size=%d,%d" % (pencere, yuk),
             "--force-prefers-reduced-motion", "--virtual-time-budget=4000",
             "--user-data-dir=" + os.path.join(gecici, "u%d%d" % (gen, koyu)),
             "--screenshot=" + cikti]
    if koyu:
        komut.append("--force-dark-mode")
    subprocess.run(komut + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90, check=False)
    if not os.path.exists(cikti):
        return False
    if pencere != gen:
        from PIL import Image
        Image.open(cikti).crop((0, 0, gen, yuk)).save(cikti)
    return True


def yazi_tipi(boy):
    from PIL import ImageFont
    for ad in (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf",
               "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(ad):
            return ImageFont.truetype(ad, boy)
    return ImageFont.load_default()


def main():
    from PIL import Image, ImageDraw
    arg = sys.argv[1:]
    cikti = os.path.join(KOK, "_kontak", "kontak.png")
    if "--cikti" in arg:
        i = arg.index("--cikti"); cikti = os.path.abspath(arg[i + 1]); del arg[i:i + 2]
    sayfalar = [a.lstrip("/") for a in arg] or VARSAYILAN
    os.makedirs(os.path.dirname(cikti), exist_ok=True)
    chrome = chrome_bul()
    HUCRE_Y, PAY, BASLIK = 700, 16, 34
    olcek = {1280: 0.5, 390: 0.5}
    sutun_gen = [int(g * olcek[g]) for _, g, _, _ in GORUNUMLER]
    gen = PAY + sum(w + PAY for w in sutun_gen)
    yuk = PAY + BASLIK + len(sayfalar) * (HUCRE_Y + BASLIK + PAY)
    tuval = Image.new("RGB", (gen, yuk), (236, 238, 237))
    ciz = ImageDraw.Draw(tuval)
    f_bas, f_kucuk = yazi_tipi(18), yazi_tipi(14)
    x = PAY
    for (ad, g, _, _), w in zip(GORUNUMLER, sutun_gen):
        ciz.text((x, PAY), ad, fill=(40, 48, 44), font=f_bas)
        x += w + PAY
    with tempfile.TemporaryDirectory() as gecici:
        for si, yol in enumerate(sayfalar):
            y0 = PAY + BASLIK + si * (HUCRE_Y + BASLIK + PAY)
            ciz.text((PAY, y0), "/" + yol, fill=(40, 48, 44), font=f_kucuk)
            x = PAY
            for gi, ((ad, g, h, koyu), w) in enumerate(zip(GORUNUMLER, sutun_gen)):
                png = os.path.join(gecici, "s%d_%d.png" % (si, gi))
                if cek(chrome, yol, g, h, koyu, png, gecici):
                    im = Image.open(png).convert("RGB")
                    im = im.resize((w, int(im.height * w / im.width)))
                    im = im.crop((0, 0, w, min(im.height, HUCRE_Y)))
                    tuval.paste(im, (x, y0 + 22))
                else:
                    ciz.text((x, y0 + 40), "çekilemedi", fill=(180, 40, 40), font=f_kucuk)
                x += w + PAY
            print("  /" + yol)
    tuval.save(cikti)
    print("Kontak sayfası:", os.path.relpath(cikti, KOK))


if __name__ == "__main__":
    main()
