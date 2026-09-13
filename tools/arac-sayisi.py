# -*- coding: utf-8 -*-
"""Ana sayfadaki "N araç" iddiasını kart sayısından üretir.

NEDEN: bu sayı elle yazılmıştı ve eskimişti — sayfada 43 araç kartı dururken
iki yerde birden "34 araç" yazıyordu. Ziyaretçinin ilk gördüğü cümlelerden
biri, sayfanın kendi içeriğiyle çelişiyordu.

Hata türü tanıdık: DOĞRULANMAYAN BİR İDDİA. Sayfa bozulmuyor, kimse uyarı
almıyor, yalnızca yanlış. Araç eklendikçe fark büyüyor. Bu yüzden sayı artık
kartlardan sayılıyor ve --check ile CI'da doğrulanıyor.

"Yakında" kartı sayılmaz: henüz var olmayan bir aracı sayıya katmak, aynı
iddiayı başka bir yönden yanlış yapardı.

Kullanım:
    python tools/arac-sayisi.py           # sayıyı tazele
    python tools/arac-sayisi.py --check   # bayat sayı var mı
"""
import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "index.html")

# Sayının geçtiği yerler. Her biri "N araç" ile başlayan farklı bir cümle.
KALIPLAR = [
    re.compile(r'(<strong>)(\d+)( araç, açık hesap yöntemi\.</strong>)'),
    re.compile(r'(aria-atomic="true">)(\d+)( araç · kategori seçin veya arayın</p>)'),
]


def kart_sayisi(s):
    """Dizindeki gerçek araç kartları: "yakında" kartı hariç."""
    kartlar = re.findall(r'class="project-card([^"]*)"', s)
    return sum(1 for k in kartlar if "--soon" not in k)


def main():
    kontrol = "--check" in sys.argv
    s = io.open(SAYFA, encoding="utf-8").read()
    n = kart_sayisi(s)
    if n < 5:
        print("Araç kartı bulunamadı (%d) — denetim anlamsız." % n, file=sys.stderr)
        return 1

    ham = s
    bayat = []
    for kalip in KALIPLAR:
        m = kalip.search(s)
        if not m:
            print("Sayı kalıbı bulunamadı: " + kalip.pattern, file=sys.stderr)
            return 1
        if int(m.group(2)) != n:
            bayat.append((int(m.group(2)), n))
        s = kalip.sub(lambda mm: mm.group(1) + str(n) + mm.group(3), s, count=1)

    if kontrol:
        if bayat:
            print("Ana sayfadaki araç sayısı bayat (%d yer):" % len(bayat), file=sys.stderr)
            for eski, yeni in bayat:
                print("  %d -> %d" % (eski, yeni), file=sys.stderr)
            print("Calistir: python tools/arac-sayisi.py", file=sys.stderr)
            return 1
        print("Arac sayisi guncel (%d arac)." % n)
        return 0

    if s == ham:
        print("Arac sayisi zaten guncel (%d arac)." % n)
        return 0
    io.open(SAYFA, "w", encoding="utf-8", newline="").write(s)
    print("Arac sayisi %d olarak yazildi (%d yer)." % (n, len(bayat)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
