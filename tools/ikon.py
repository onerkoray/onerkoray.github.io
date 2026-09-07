# -*- coding: utf-8 -*-
"""favicon.svg'den favicon.ico ve apple-touch-icon.png uretir.

NEDEN BU DOSYA VAR: iki ikili dosya da favicon.svg'nin rasterlenmis halidir
ama arada hicbir bag yoktu. Marka isaretini SVG'de degistirip ikilileri
unutmak sessiz bir hata: sekmede eski logo, sitede yeni logo gorunur ve
tarayici favicon'u agresif onbellekledigi icin fark aylarca yakalanmaz.
--check bu bagi zorunlu kilar.

Rasterleme: Chrome bir kez 720px'te cizer, Pillow LANCZOS ile kucultur.
Dogrudan 16px cizim ince cizgileri kirpiyordu; buyuk cizip kucultmek
ayni cizgiyi gri tonlara yayarak daha okunur birakiyor.
"""
import io, os, shutil, struct, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(ROOT, "favicon.svg")
ICO_BOY = [16, 32, 48]
ATI_BOY = 180
ANA = 720                       # 180'in 4 kati; tum boylar buradan kuculur
# Esik olcumle secildi: ayni SVG farkli rasterleme yolundan gecirildiginde
# (720 yerine 1440'ta cizip kucultunce) fark en fazla %0,12 cikti; buna
# karsilik tek bir kose noktasini 1px oynatmak %2,7-4,3 uretiyor. %1,5 bu
# iki buyukluk arasinda duruyor, yani platform gurultusune takilmadan
# gercek geometri degisikligini yakaliyor.
ESIK = 1.5

CHROME = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
]
# CI Linux uzerinde kosuyor; PATH'ten de aranmasi gerekiyor.
CHROME_PATH = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]


def chrome_bul():
    for p in CHROME:
        if os.path.exists(p):
            return p
    for ad in CHROME_PATH:
        p = shutil.which(ad)
        if p:
            return p
    return None


def ciz():
    """favicon.svg'yi ANA x ANA saydam zeminli PNG olarak dondurur."""
    exe = chrome_bul()
    if not exe:
        sys.exit("Chrome bulunamadi.")
    gecici = tempfile.mkdtemp(prefix="ikon-")
    svg = io.open(KAYNAK, encoding="utf-8").read()
    sayfa = os.path.join(gecici, "i.html")
    io.open(sayfa, "w", encoding="utf-8", newline="").write(
        "<style>html,body{margin:0;padding:0;background:transparent}"
        "svg{display:block;width:%dpx;height:%dpx}</style>%s" % (ANA, ANA, svg))
    cikti = os.path.join(gecici, "i.png")
    subprocess.call([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                     "--default-background-color=00000000",
                     "--force-device-scale-factor=1",
                     "--window-size=%d,%d" % (ANA, ANA),
                     "--screenshot=" + cikti, sayfa],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not os.path.exists(cikti):
        sys.exit("Chrome ciktisi olusmadi.")
    return Image.open(cikti).convert("RGBA").copy()


def kucult(ana, n):
    return ana.resize((n, n), Image.LANCZOS)


def fark(a, b):
    """Belirgin sekilde degisen piksellerin yuzdesi.

    Ilk surum ORTALAMA kanal farkini oluyordu ve yanilticiydi: eski ile yeni
    marka ayni yesil zemin uzerinde ayni beyaz </> oldugu icin piksellerin
    cogu zaten ayni, ortalama fark esigin hemen ustunde kaliyordu. Yani daha
    kucuk bir degisiklik guard'i hic tetiklemeyecekti. Bunun yerine "kac
    piksel gercekten degisti" olculuyor; 24 esigi kenar yumusatma
    gurultusunu eler, geometri kaymasini elemez."""
    if a.size != b.size:
        return 100.0
    pa, pb = a.load(), b.load()
    n = 0
    for y in range(a.size[1]):
        for x in range(a.size[0]):
            ka, kb = pa[x, y], pb[x, y]
            if max(abs(ka[i] - kb[i]) for i in range(4)) > 24:
                n += 1
    return 100.0 * n / float(a.size[0] * a.size[1])


def ico_yaz(yol, kareler):
    """ICO'yu elle yazar.

    Pillow'un kendi ICO yazicisi kareleri thumbnail() ile kendisi kucultuyor;
    o zaman --check'in karsilastirdigi piksellerle dosyaya giren pikseller
    ayni yoldan gecmemis oluyor ve guard kendi urettigi dosyaya takiliyor.
    Kareleri burada hazir verip 32bit BMP olarak yazmak bu belirsizligi
    tamamen kaldiriyor.
    """
    govde, dizin, kayma = [], [], 6 + 16 * len(kareler)
    for n in sorted(kareler):
        im = kareler[n]
        basl = struct.pack("<IiiHHIIiiII", 40, n, n * 2, 1, 32, 0, 0, 0, 0, 0, 0)
        px = im.load()
        veri = bytearray()
        for y in range(n - 1, -1, -1):          # BMP satirlari alttan yukari
            for x in range(n):
                r, g, b, a = px[x, y]
                veri += bytes(bytearray((b, g, r, a)))
        maske = bytearray(((n + 31) // 32) * 4 * n)   # alfa BGRA'da; maske bos
        kare = basl + bytes(veri) + bytes(maske)
        dizin.append(struct.pack("<BBBBHHII", n if n < 256 else 0,
                                 n if n < 256 else 0, 0, 0, 1, 32,
                                 len(kare), kayma))
        kayma += len(kare)
        govde.append(kare)
    with open(yol, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(kareler)))
        for d in dizin:
            f.write(d)
        for g in govde:
            f.write(g)


def mevcut_ico():
    yol = os.path.join(ROOT, "favicon.ico")
    if not os.path.exists(yol):
        return {}
    im = Image.open(yol)
    out = {}
    for s in sorted(im.info.get("sizes", [])):
        im.size = s
        out[s[0]] = im.convert("RGBA").copy()
    return out


def main():
    kontrol = "--check" in sys.argv
    ana = ciz()
    yeni_ico = dict((n, kucult(ana, n)) for n in ICO_BOY)
    yeni_ati = kucult(ana, ATI_BOY)

    if kontrol:
        bulgu = []
        eski = mevcut_ico()
        if sorted(eski) != ICO_BOY:
            bulgu.append("favicon.ico kare listesi %s, beklenen %s" % (sorted(eski), ICO_BOY))
        else:
            for n in ICO_BOY:
                f = fark(eski[n], yeni_ico[n])
                if f > ESIK:
                    bulgu.append("favicon.ico %dpx favicon.svg ile uyusmuyor (piksellerin %%%.1f'i farkli)" % (n, f))
        ap = os.path.join(ROOT, "apple-touch-icon.png")
        if not os.path.exists(ap):
            bulgu.append("apple-touch-icon.png yok")
        else:
            f = fark(Image.open(ap).convert("RGBA"), yeni_ati)
            if f > ESIK:
                bulgu.append("apple-touch-icon.png favicon.svg ile uyusmuyor (piksellerin %%%.1f'i farkli)" % f)
        if bulgu:
            for b in bulgu:
                print("BULGU:", b)
            print("Ikonlari tazelemek icin: python tools/ikon.py")
            sys.exit(1)
        print("Ikonlar favicon.svg ile uyumlu.")
        return

    yeni_ati.save(os.path.join(ROOT, "apple-touch-icon.png"))
    ico_yaz(os.path.join(ROOT, "favicon.ico"), yeni_ico)
    print("favicon.ico (%s) ve apple-touch-icon.png (%d) yazildi."
          % ("/".join(str(n) for n in ICO_BOY), ATI_BOY))


if __name__ == "__main__":
    main()
