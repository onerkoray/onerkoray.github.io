# -*- coding: utf-8 -*-
"""HTML'deki stil, betik ve marka simgesi baglantilarina ozet damgasi basar.

NEDEN: stil dosyalari "Cache-Control: max-age=3600" ile sunuluyor. HTML
aninda tazeleniyor ama CSS bir saate kadar eski kaliyor; arada ziyaretci
YENI HTML + ESKI CSS goruyor. 2026-09-07'de tam olarak bu yasandi:
panele eklenen "Son eklenenler" blogu, CSS'i onbellekte olan tarayicida
ham h3 ve italik etiket olarak gorundu. Sayfa bozuk degildi, sadece
stilinden bir saat once gelmisti.

Ikon damgalari (?v=2, ?v=3) elle bumplaniyor ve unutulabiliyor; burada
damga DOSYANIN ICERIGINDEN uretiliyor, yani unutulacak bir sey yok.
CSS veya JS degisince damga kendiliginden degisir, degismezse --check kirilir.

Kullanim:
    python tools/stil-damgasi.py           # damgalari tazele
    python tools/stil-damgasi.py --check   # bayat damga var mi
"""
import hashlib
import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLA = {".git", "_cekirdek", "node_modules", "__pycache__"}
# Ters bolu kullanilmiyor: karakter siniflari ayni isi goruyor ve
# duzenli ifade metin islemleri sirasinda bozulmuyor.
KALIP = re.compile('(href|src)="([^"?]+[.](?:css|js))(?:[?]v=[0-9a-f]+)?"')

# SIMGELER DE DAMGALANIYOR (2026-09-13'ten beri).
# Favicon baglantilari ELLE "?v=3", "?v=4" tasiyordu ve bump etmek
# unutulabilir bir adimdi. Favicon sistemi yeniden cizildiginde tam da bu
# tuzaga dusuluyordu: dosyalar degisir, ziyaretcilerin sekmesinde eski
# simge kalirdi -- ve hata sessizdir, kimse bildirmez.
#
# Logo da her sayfanin ust cubugunda kullaniliyor. Yeni cizim herkesin
# onbellegine ayni anda ulassin diye onu da damgala. Diger gorseller kapsamda
# degil; butun gorselleri damgalamak ayri ve cok daha buyuk bir karar olurdu.
SIMGE_KALIP = re.compile(
    '(href)="((?:[^"?]*/)?(?:favicon[.]svg|favicon[.]ico|apple-touch-icon[.]png))'
    '(?:[?]v=[0-9a-z]+)?"')
LOGO_KALIP = re.compile('(src)="((?:[^"?]*/)?logo[.]svg)(?:[?]v=[0-9a-z]+)?"')

_ozet = {}


def ozet(yol):
    if yol not in _ozet:
        # Git normalizes text to LF; Windows and Linux must produce the same stamp.
        data = io.open(yol, "rb").read().replace(b"\r\n", b"\n")
        h = hashlib.sha256(data).hexdigest()[:8]
        _ozet[yol] = h
    return _ozet[yol]


def html_dosyalari():
    for kok, dizinler, dosyalar in os.walk(KOK):
        dizinler[:] = [d for d in dizinler if d not in ATLA]
        for ad in dosyalar:
            if ad.endswith(".html"):
                yield os.path.join(kok, ad)


def isle(kontrol):
    bayat, yazilan = [], 0
    sayac = [0]        # ic fonksiyondan artirilabilsin diye liste
    for hy in html_dosyalari():
        s = io.open(hy, encoding="utf-8").read()
        dizin = os.path.dirname(hy)

        def degistir(m):
            bagil = m.group(2)
            hedef = os.path.normpath(os.path.join(dizin, bagil))
            if not os.path.exists(hedef):
                return m.group(0)      # dis kaynak ya da kirik: dokunma
            sayac[0] += 1
            return '%s="%s?v=%s"' % (m.group(1), bagil, ozet(hedef))

        yeni, _ = KALIP.subn(degistir, s)
        yeni, _ = SIMGE_KALIP.subn(degistir, yeni)
        yeni, _ = LOGO_KALIP.subn(degistir, yeni)
        if yeni != s:
            if kontrol:
                bayat.append(os.path.relpath(hy, KOK).replace("\\", "/"))
            else:
                io.open(hy, "w", encoding="utf-8", newline="").write(yeni)
                yazilan += 1

    if kontrol:
        if bayat:
            print("Stil damgasi bayat olan %d sayfa:" % len(bayat))
            for b in bayat[:12]:
                print("  -", b)
            if len(bayat) > 12:
                print("  ... ve %d sayfa daha" % (len(bayat) - 12))
            print("Duzeltmek icin: python tools/stil-damgasi.py")
            return 1
        print("Stil damgalari guncel (%d baglanti)." % sayac[0])
        return 0
    print("%d sayfada stil damgasi tazelendi (%d baglanti)." % (yazilan, sayac[0]))
    return 0


if __name__ == "__main__":
    sys.exit(isle("--check" in sys.argv))
