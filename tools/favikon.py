# -*- coding: utf-8 -*-
"""Araç faviconlarını tools/card-icons.json'dan üretir ve doğrular.

NEDEN VAR
---------
Araç faviconları elle çizilmişti ve zamanla dağıldı. Sekme şeridinde yan yana
duran iki korayoner.dev sayfası birbirine benzemiyordu:

    kök marka   : gradyan kare + BEYAZ tek renk </> işareti
    araç sayfası: DÜZ yeşil kare + SARI vurgulu çok renkli çizim

Faviconun işi "bu sekme hangi SİTE" sorusunu cevaplamaktır; ikinci soru
"hangi sayfa"dır. Eski hâlde birinci soru cevapsız kalıyordu. Üstelik bir
araç (finansal-emniyet-testi) yanlışlıkla başka bir aracın ikonunu
taşıyordu — aria-label hâlâ "Finansal özgürlük hesaplama" diyordu.

ÇÖZÜM: ÇERÇEVE SABİT, SEMBOL DEĞİŞKEN
-------------------------------------
Her favicon aynı marka kabını kullanır — kök favicon.svg ile birebir aynı
gradyan, aynı köşe yarıçapı, aynı beyaz tek renk çizgi. İçindeki sembol ise
o aracın ANA SAYFADAKİ KART SEMBOLÜNÜN AYNISI. Böylece:

  - sekme şeridinde bütün sayfalar tek bir siteye ait görünür,
  - kart ile sekme aynı sembolü gösterir (görsel süreklilik),
  - sembol tek yerde tanımlıdır: tools/card-icons.json.

ÇİZGİ KALINLIĞI HESAPLANDI, GÖZE BAKILMADI
------------------------------------------
Kart ikonları 24x24 kutuda stroke-width 2 ile çizilir. scale(2) ile 64x64
kutuya taşındığında efektif kalınlık 4 olur; kök markanın çizgileri 4,0-4,2.
Yani sembol markayla aynı ağırlıkta okunur. Ölçek 2'den başka bir değer
seçilseydi araç ikonları markadan ince ya da kalın görünürdü.

    python tools/favikon.py           # faviconları üret
    python tools/favikon.py --check   # kaynakla aynı mı
"""
import io
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, "tools", "card-icons.json")

# Kök favicon.svg ile AYNI değerler. Burada değişirse marka ikisi arasında
# ayrışır; bu yüzden değiştirmeden önce kök dosyaya da bakın.
GRADYAN_UST = "#14b28e"
GRADYAN_ALT = "#0a5f4e"
YARICAP = 14

# ALT PROJELER BU SİSTEME GİRMEZ.
# decorpalette ve keymint sitenin hesaplama araçları değil, altında yayımlanan
# ayrı ürünler. Kendi işaretleri var ve olmalı: decorpalette'in paleti üç
# renkli noktayla ANLAM taşıyor (renk paleti aracının konusu renktir), onu
# tek renk beyaza indirmek bilgiyi silmek olurdu. Marka çerçevesini onlara
# dayatmak, ayrı ürün olmalarını görsel olarak inkâr etmek demekti.
ALT_PROJELER = {"decorpalette", "keymint"}

SABLON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="%(ad)s">
  <defs>
    <linearGradient id="fv-bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="%(ust)s"/>
      <stop offset="1" stop-color="%(alt)s"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="%(r)d" fill="url(#fv-bg)"/>
  <g transform="translate(8 8) scale(2)" fill="none" stroke="#ffffff"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%(sembol)s</g>
</svg>
"""


def sembol(svg):
    """Kart ikonunun İÇİNİ alır; dış <svg> etiketi atılır.

    Renk ve çizgi nitelikleri dıştaki <g> tarafından verildiği için iç
    öğelerde bulunmaz — bu, card-icons.json'daki 32 ikonun tamamı için
    doğrulanmış bir değişmezdir (hepsinin svg başlığı birebir aynı).
    """
    i = svg.index(">") + 1
    j = svg.rindex("</svg>")
    return svg[i:j].strip()


def baslik(slug):
    """Aracın kendi sayfa başlığı — aria-label için."""
    yol = os.path.join(KOK, slug, "index.html")
    s = io.open(yol, encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", s, re.S)
    if not m:
        return slug
    t = re.sub(r"\s*\|\s*Koray Öner\s*$", "", m.group(1).strip())
    return t


def yerel_favicon_kullaniyor(slug):
    """Sayfa gerçekten yerel favicon.svg'ye bağlanıyor mu.

    Bağlanmayan bir dizine dosya üretmek ölü dosya bırakırdı; alt projeler
    (decorpalette, keymint) kendi markalarını korusun diye zaten
    card-icons.json'da yoklar.
    """
    yol = os.path.join(KOK, slug, "index.html")
    if not os.path.exists(yol):
        return False
    return 'href="favicon.svg' in io.open(yol, encoding="utf-8").read()


def uret():
    ikon = json.load(io.open(KAYNAK, encoding="utf-8"))
    cikti = {}
    for slug in sorted(ikon):
        if slug in ALT_PROJELER or not yerel_favicon_kullaniyor(slug):
            continue
        cikti[slug] = SABLON % {
            "ad": baslik(slug),
            "ust": GRADYAN_UST,
            "alt": GRADYAN_ALT,
            "r": YARICAP,
            "sembol": sembol(ikon[slug]["svg"]),
        }
    return cikti


def main():
    kontrol = "--check" in sys.argv
    cikti = uret()
    if not cikti:
        print("Hiçbir sayfa yerel favicon.svg kullanmıyor — kaynak mı değişti?",
              file=sys.stderr)
        return 1

    eskik, farkli, yazilan = [], [], []
    for slug, yeni in cikti.items():
        yol = os.path.join(KOK, slug, "favicon.svg")
        var = io.open(yol, encoding="utf-8").read() if os.path.exists(yol) else None
        if var is None:
            eskik.append(slug)
        elif var != yeni:
            farkli.append(slug)
        if not kontrol and var != yeni:
            io.open(yol, "w", encoding="utf-8", newline="").write(yeni)
            yazilan.append(slug)

    if kontrol:
        if eskik or farkli:
            if eskik:
                print("Favicon eksik: " + ", ".join(eskik))
            if farkli:
                print("Favicon kaynakla uyuşmuyor: " + ", ".join(farkli))
            print("Düzeltmek için: python tools/favikon.py")
            return 1
        print("Favicon'lar güncel (%d araç)." % len(cikti))
        return 0

    if yazilan:
        print("Favicon üretildi (%d/%d): %s"
              % (len(yazilan), len(cikti), ", ".join(yazilan)))
    else:
        print("Favicon'lar zaten güncel (%d araç)." % len(cikti))
    return 0


if __name__ == "__main__":
    sys.exit(main())
