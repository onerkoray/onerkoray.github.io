# -*- coding: utf-8 -*-
"""Sitedeki dış bağlantıların sağlığını tarar.

NEDEN VAR
---------
sayfa-denetimi.py iç bağlantıları çözüyor ama dış bağlantılara hiç
bakmıyor. Kaynak göstererek iddia kuran bir sitede açılmayan kaynak
bağlantısı, sitenin en güçlü iddiasını — birincil kaynağa dayanmayı —
sessizce boşaltır. Sayfa bozulmaz, kimse uyarı almaz; yalnızca okur
kaynağı denetleyemez.

İlk tarama 96 dış bağlantıdan birini ölü buldu:
finansalokuryazarlik.gov.tr sunucu hatası veriyordu ve
erken-kapatma-analizi sayfasında "erken ödeme hakkı" kaynağı olarak
gösteriliyordu.

NEDEN CI'DA DEĞİL
-----------------
Bu kontrol ağa bağlı. CI'ya konsaydı üç sorun doğardı: kamu siteleri
bakıma girdiğinde yapılan iş alakasız biçimde kırmızıya dönerdi, her
koşuda yüz istek atılırdı ve sonuç belirlenimci olmazdı. Bu deponun
bütün kapıları belirlenimci; ağ bağımlı bir kapı onları da şüpheli
hâle getirirdi.

Bu yüzden ELLE koşulur: yeni kaynak eklendiğinde ve arada bir.

ÜÇ DURUM AYRI RAPORLANIR
------------------------
"Ölü", "erişilemedi" ve "belirsiz" aynı şey değil. Sunucunun 404/410
ya da 5xx dönmesi kusurdur. 401/403/405/999 ise çoğu zaman bot koruması
olur; doi.org, oecd.org, imf.org ve consumerfinance.gov tam tarayıcı
başlıklarıyla da 403 dönüyor. Bunları "ölü" saymak gürültü üretir ve
gerçek bulguyu gizler, o yüzden ayrı listelenip insana bırakılır.

Kullanım:
    python tools/dis-baglanti-taramasi.py
"""
import io
import os
import re
import sys
import glob
import json
import collections
import subprocess
from concurrent.futures import ThreadPoolExecutor

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

ATLA = ("node_modules", ".git", "_cekirdek")
KENDI = ("korayoner.dev", "onerkoray.github.io")

# BELİRSİZ: bu kodlar "kaynak yok" demez. 401/403/405/999 çoğu zaman
# bot koruması ya da veri merkezi IP engelidir; doi.org, oecd.org,
# imf.org ve consumerfinance.gov tam tarayıcı başlıklarıyla da 403
# dönüyor ama gerçek kullanıcıda açılıyor.
#
# Ayırt EDİLEMEYEN şeyi "ölü" diye raporlamak kapıyı güvenilmez yapar:
# her koşuda aynı satırlar çıkar, insan bakmayı bırakır ve gerçek bir
# ölü bağlantı o gürültünün içinde kaybolur.
BELIRSIZ_KODLAR = (401, 403, 405, 429, 999)

TARAYICI = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"


def baglantilar():
    """Görünür <a href> içindeki dış adresler. JSON-LD hariç: oradaki
    sameAs bir kimlik beyanı, ziyaret edilecek kaynak değil."""
    out = collections.defaultdict(set)
    for p in glob.glob("**/*.html", recursive=True):
        if p.startswith(ATLA):
            continue
        s = io.open(p, encoding="utf-8", errors="replace").read()
        g = re.sub(r"<script[\s\S]*?</script>", "", s)
        for u in re.findall(r'<a[^>]+href="(https?://[^"]+)"', g):
            if any(k in u for k in KENDI):
                continue
            out[u.replace("&amp;", "&")].add(p.replace(os.sep, "/"))
    return out


def durum(u):
    """Önce HEAD, olmazsa ilk baytı isteyen GET."""
    son = None
    for ek in (["-I"], ["-r", "0-0"]):
        r = subprocess.run(
            ["curl", "-sS", "-o", os.devnull, "-w", "%{http_code}",
             "--max-time", "25", "-L", "-A", TARAYICI] + ek + [u],
            capture_output=True, text=True)
        kod = (r.stdout or "").strip()[-3:]
        if r.returncode == 0 and kod.isdigit() and kod != "000":
            # 405/403 "yontem kabul edilmiyor" demek, "kaynak yok" degil.
            # HEAD'i reddeden sunucuda GET denenmeden karar verilemez;
            # ilk surum bunu atlayip saglam adresleri olu gosterdi.
            if ek == ["-I"] and int(kod) in (403, 405):
                son = int(kod)
                continue
            return (u, int(kod))
        son = r.returncode
    return (u, son if isinstance(son, int) and son > 99 else None)


def main():
    bag = baglantilar()
    print("dış bağlantı: %d\n" % len(bag))
    with ThreadPoolExecutor(max_workers=8) as ex:
        sonuc = list(ex.map(durum, sorted(bag)))

    olu, belirsiz, erisilemez, iyi = [], [], [], 0
    for u, kod in sonuc:
        if kod is None:
            erisilemez.append(u)
        elif 200 <= kod < 400:
            iyi += 1
        elif kod in BELIRSIZ_KODLAR:
            belirsiz.append((u, kod))
        else:
            olu.append((u, kod))

    print("sağlıklı: %d" % iyi)
    print("buradan erişilemedi: %d" % len(erisilemez))
    print("belirsiz (bot koruması olabilir): %d" % len(belirsiz))

    print("\n=== ÖLÜ: %d ===" % len(olu))
    for u, k in sorted(olu, key=lambda x: -x[1]):
        print("  %3d  %s" % (k, u))
        for p in sorted(bag[u])[:4]:
            print("       %s" % p)

    if belirsiz:
        print("\n--- belirsiz (elle açıp bakılmalı) ---")
        for u, k in sorted(belirsiz, key=lambda x: -x[1]):
            print("  %3d  %s" % (k, u))

    # KONTROL: tarama gerçekten bağlantı buldu mu? Boş bir taramanın
    # "ölü yok" demesi hiçbir şey anlatmaz.
    if len(bag) < 40:
        print("\nKONTROL BAŞARISIZ: beklenenden az bağlantı (%d)" % len(bag))
        return 1
    return 1 if olu else 0


if __name__ == "__main__":
    sys.exit(main())
