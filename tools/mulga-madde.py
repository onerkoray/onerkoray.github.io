# -*- coding: utf-8 -*-
"""Yürürlükten kalkmış bir kanun maddesine atıf yapılmış mı?

NEDEN VAR
---------
193 sayılı Gelir Vergisi Kanunu'nun 32. maddesi (asgari geçim indirimi),
7349 sayılı Kanun'un 3. maddesiyle 1 Ocak 2022'den geçerli olmak üzere
YÜRÜRLÜKTEN KALDIRILDI. Yerine aynı Kanun'un 23/1-(18) bendindeki asgari
ücret istisnası geldi.

Buna rağmen sitede sekiz ayrı yerde "GVK m.32 — asgari ücret istisnası"
yazıyordu. Hesaplar doğruydu; yanlış olan DAYANAKTI. Bu, bu sitede en
pahalı hata türü: sayfa açılıyor, araç çalışıyor, sayı doğru çıkıyor ve
kaynak satırı okuyucuyu mülga bir maddeye gönderiyor. Hiçbir test
patlamıyordu çünkü hiçbir test dayanağa bakmıyordu.

NE YAKALIYOR
------------
"Gelir Vergisi Kanunu" bağlamında geçen m.32 atıflarını. Bağlam
pencereyle sınırlı, çünkü m.32 BAŞKA kanunlarda yürürlükte:
  - 5520 sayılı Kurumlar Vergisi Kanunu m.32 (kurumlar vergisi oranı)
  - 4857 sayılı İş Kanunu m.32 (ücretin ödenmesi)
Bunlara dokunulmuyor.

MÜLGA OLDUĞU SÖYLENEREK yapılan atıf serbest: parametreler.js 2020-2021
yıllarının AGİ'sini anlatırken m.32'yi anmak zorunda ve "(mülga)" diye
işaretliyor. Kapı bu işareti tanıyor.

Kullanım:
    python tools/mulga-madde.py           # bulguları listele
    python tools/mulga-madde.py --check   # bulgu varsa kırmızı (CI)
"""
import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Taranan dosya türleri ve atlanan dizinler
UZANTI = (".html", ".js")
ATLA = (".git", "node_modules", "images", "tools" + os.sep + "__pycache__")

# m.32 atfının önündeki bu kadar karakterde "Gelir Vergisi Kanunu" veya
# "GVK" geçiyorsa atıf GVK'ya yapılmış sayılır.
PENCERE = 90

# Atıf mülga olduğu söylenerek yapılmışsa serbest.
MULGA = re.compile(r"m[üu]lga", re.IGNORECASE)

# "m.32", "m. 32", "madde 32" biçimleri
ATIF = re.compile(r"m(?:adde)?\.?\s*32\b")
GVK = re.compile(r"Gelir\s+Vergisi\s+Kanunu|GVK|193\s+say[ıi]l[ıi]", re.IGNORECASE)


def dosyalar():
    for kok, dizinler, adlar in os.walk(KOK):
        dizinler[:] = [d for d in dizinler if not d.startswith(".")
                       and d not in ("node_modules", "images")]
        for ad in adlar:
            if ad.endswith(UZANTI):
                yield os.path.join(kok, ad)


def bulgular():
    cikti = []
    for yol in dosyalar():
        try:
            s = io.open(yol, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for m in ATIF.finditer(s):
            bas = max(0, m.start() - PENCERE)
            onceki = s[bas:m.start()]
            if not GVK.search(onceki):
                continue                      # başka kanunun m.32'si
            cevre = s[bas:m.end() + 40]
            if MULGA.search(cevre):
                continue                      # mülga olduğu söylenmiş
            cikti.append((os.path.relpath(yol, KOK).replace(os.sep, "/"),
                          " ".join(cevre.split())))
    return cikti


def main():
    kontrol = "--check" in sys.argv
    b = bulgular()
    if not b:
        print("Mulga madde atfi yok.")
        return 0
    print("Mulga GVK m.32 atfi bulunan %d yer:" % len(b))
    for yol, cevre in b:
        print("  - %s" % yol)
        print("      ...%s..." % cevre[:120])
    if kontrol:
        print("\nGVK m.32 (asgari gecim indirimi) 7349 s.K. ile 1.1.2022'den "
              "itibaren mulgadir; asgari ucret istisnasi m.23/1-(18)'dedir.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
