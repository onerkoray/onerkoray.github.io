# -*- coding: utf-8 -*-
"""sitemap.xml'deki <lastmod> tarihlerini ANLAMLI degisime gore tazeler.

NEDEN: lastmod bir iddiadir -- "bu sayfanin icerigi bu tarihte degisti".
Yanlis bir lastmod, arama motorunu bos yere getirir ve zamanla o alanin
tumune guvenmemeyi ogretir. Yani sisirilmis lastmod, tazelik sinyalini
guclendirmez; SUSTURUR.

Bu yuzden tarih "dosyaya en son ne zaman dokunuldu" degil, "iceriginde en
son ne zaman ozlu bir degisiklik oldu" sorusunun cevabi. Iki sey elenir:

  1. TARAMA COMMIT'LERI. Bir onbellek damgasi tazelemesi ya da bir meta
     etiketi eklemesi 118 sayfanin hepsine dokunur; bu, hicbir sayfanin
     "guncellendigi" anlamina gelmez.
  2. YALNIZCA DAMGA DEGISEN commit'ler. style.css?v=abc -> ?v=def bir
     icerik degisikligi degil.

Bu ayrimi arac-guncelleme.py zaten yapiyordu (ana sayfadaki kart
tarihleri icin). Mantik BURAYA KOPYALANMIYOR, oradan ithal ediliyor:
iki yerde duran iki kopya, kacinilmaz olarak birbirinden ayrisir.

Kullanim:
    python tools/site-haritasi.py           # lastmod'lari tazele
    python tools/site-haritasi.py --check   # bayat lastmod var mi
"""
import importlib.util
import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARITA = os.path.join(KOK, "sitemap.xml")
KOKADRES = "https://korayoner.dev"


def _arac_modulu():
    """arac-guncelleme.py'yi ithal eder (tire yuzunden normal import olmaz)."""
    yol = os.path.join(KOK, "tools", "arac-guncelleme.py")
    spec = importlib.util.spec_from_file_location("arac_guncelleme", yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)      # __main__ degil, main() calismaz
    return m


def dosya_yolu(loc):
    """https://korayoner.dev/x/ -> x/index.html"""
    yol = loc[len(KOKADRES):].lstrip("/")
    if yol == "" or yol.endswith("/"):
        return yol + "index.html"
    return yol


def main():
    kontrol = "--check" in sys.argv
    A = _arac_modulu()
    boyut = A.commit_boyutlari()

    s = io.open(HARITA, encoding="utf-8").read()
    ham = s

    girdiler = re.findall(r"<loc>([^<]+)</loc>", s)
    degisen, bulunamayan = [], []

    for loc in girdiler:
        p = dosya_yolu(loc)
        if not os.path.exists(os.path.join(KOK, p)):
            bulunamayan.append(loc)
            continue
        iso, _h = A.anlamli_tarih(p, boyut)
        if not iso:
            continue

        # Bu <loc>'a ait <lastmod>'u bul: ayni <url> blogu icinde.
        desen = re.compile(
            r"(<loc>" + re.escape(loc) + r"</loc>\s*<lastmod>)([^<]+)(</lastmod>)")
        m = desen.search(s)
        if not m:
            continue
        if m.group(2)[:10] != iso:
            degisen.append((loc, m.group(2)[:10], iso))
            s = desen.sub(lambda mm: mm.group(1) + iso + mm.group(3), s, count=1)

    if bulunamayan:
        print("Sitemap'te dosyasi olmayan adres (%d):" % len(bulunamayan),
              file=sys.stderr)
        for x in bulunamayan[:10]:
            print("  - " + x, file=sys.stderr)
        return 1

    if kontrol:
        if s != ham:
            print("sitemap.xml'de bayat lastmod var (%d):" % len(degisen),
                  file=sys.stderr)
            for loc, eski, yeni in degisen[:12]:
                print("  %-52s %s -> %s"
                      % (loc[len(KOKADRES):], eski, yeni), file=sys.stderr)
            print("Calistir: python tools/site-haritasi.py", file=sys.stderr)
            return 1
        print("sitemap lastmod tarihleri guncel (%d adres)." % len(girdiler))
        return 0

    if s == ham:
        print("sitemap lastmod tarihleri zaten guncel (%d adres)." % len(girdiler))
        return 0

    io.open(HARITA, "w", encoding="utf-8", newline="").write(s)
    print("%d adresin lastmod tarihi tazelendi (%d adres tarandi)."
          % (len(degisen), len(girdiler)))
    for loc, eski, yeni in degisen[:12]:
        print("  %-52s %s -> %s" % (loc[len(KOKADRES):], eski, yeni))
    if len(degisen) > 12:
        print("  ... +%d adres daha" % (len(degisen) - 12))
    return 0


if __name__ == "__main__":
    sys.exit(main())
