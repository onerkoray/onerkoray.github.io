# -*- coding: utf-8 -*-
"""Ana sayfadaki arac kartlarina "son guncelleme" tarihi yazar.

NEDEN VAR: Kartlarda aracin ne zaman elden gectigi gorunmuyordu. Bir hesaplama
aracinda bu bilgi sustan daha degerli: ziyaretci "2026 parametreleri islendi
mi" sorusunun cevabini kartta gorebilmeli.

NEDEN HAM GIT TARIHI DEGIL: deponun son commit'ini kullanmak yanlis cevap
veriyor. 2026-09-11'de yapilan tipografi ve renk taramalari 97-124 dosyaya
birden dokundu; ham kural bu yuzden 18 aracin 18'ine ayni tarihi yaziyordu.
Ayni tarihi tasiyan 34 kart hem bilgi tasimaz hem de "otomatik uretilmis"
gorunur.

KURAL: bir aracin tarihi, o aracin klasorune dokunan VE site geneli tarama
OLMAYAN en son commit'tir. Tarama esigi asagida; 40 dosya alt ve ust kumeyi
temiz ayiriyor (gercek arac isi 1-26 dosya, taramalar 97-124). Esik bir
tahmin degil, olculmus bir bosluga oturuyor.

Tarih kaynagi git; dosya sisteminin mtime'i degil. Bir dosyaya dokunmak onu
"guncel" yapmamali.

IKI ADIMLI AKIS: tarihler commit edilmis gecmisten okunuyor, dolayisiyla bir
araci degistiren commit kendi kartini bayatlatir - commit atilmadan o
commit'in tarihi bilinemez. Bir aracta ozlu degisiklik yaptiktan sonra
commit'le, sonra bu scripti calistirip index.html'i ayri bir commit'le
ekle. Ikinci commit yalnizca index.html'e dokundugu icin hicbir aracin
tarihini degistirmez; akis tek adimda kapanir.

Kullanim:
    python tools/arac-guncelleme.py           # kartlari tazele
    python tools/arac-guncelleme.py --check   # kartlar guncel mi (CI)
    python tools/arac-guncelleme.py --liste   # hangi arac hangi tarih, neden
"""
import argparse
import io
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "index.html")

# Site geneli tarama esigi. Olculen dagilim: gercek arac calismasi 1-26
# dosya, tipografi/renk taramalari 97-124 dosya. Arada genis bir bosluk var.
TARAMA_ESIGI = 40

AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

KART = re.compile(
    r'(<li class="project-card(?![^"]*--soon)[^"]*"[^>]*>.*?</li>)', re.S)
BAGLANTI = re.compile(r'<h3><a href="([^"#?]+)"')
MEVCUT = re.compile(r'\s*<p class="card-updated">.*?</p>', re.S)
GOVDE_SON = "</div>\n          </li>"


def git(*a):
    r = subprocess.run(["git"] + list(a), cwd=KOK, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    return r.stdout


def commit_boyutlari():
    """Her commit'in dokundugu dosya sayisi. Tek gecis; log basina bir cagri
    yapmak 34 arac x yuzlerce commit'te dakikalar suruyordu."""
    boyut = {}
    for blok in git("log", "--format=@@%H", "--name-only").split("@@"):
        satir = [s for s in blok.strip().split("\n") if s.strip()]
        if satir:
            boyut[satir[0]] = len(satir) - 1
    return boyut


DAMGA = re.compile(r"[?]v=[0-9a-f]+")


def ozlu_degisim(h, yol):
    """Commit bu araca GERCEK bir degisiklik getirdi mi?

    Dosya sayisi tek basina yetmiyor. "Keep asset cache stamps consistent"
    commit'i 19 dosyaya dokunup esigi geciyor ama yaptigi tek sey ?v=
    damgalarini tazelemek; bunu "arac guncellendi" diye sunmak yalan olur.
    Burada damgalar normalize edilip once/sonra satirlari karsilastiriliyor:
    geriye bir sey kalmiyorsa degisiklik ozlu degildir.
    """
    diff = git("show", "--format=", "--unified=0", h, "--", yol)
    ekli, silik = [], []
    for satir in diff.split("\n"):
        if satir.startswith("+++") or satir.startswith("---"):
            continue
        if satir.startswith("+"):
            ekli.append(DAMGA.sub("?v=", satir[1:]))
        elif satir.startswith("-"):
            silik.append(DAMGA.sub("?v=", satir[1:]))
    return sorted(ekli) != sorted(silik)


def anlamli_tarih(yol, boyut):
    """Aracin klasorune dokunan, tarama olmayan ve ozlu en son commit."""
    for h in git("log", "--format=%H", "--", yol).split():
        if boyut.get(h, 10 ** 6) > TARAMA_ESIGI:
            continue
        if not ozlu_degisim(h, yol):
            continue
        iso = git("log", "-1", "--format=%ad", "--date=short", h).strip()
        if iso:
            return iso, h
    return "", ""


def uzun_tarih(iso):
    y, a, g = iso.split("-")
    return "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)


def sayfayi_uret(mevcut):
    boyut = commit_boyutlari()
    kayit = []

    def degistir(m):
        kart = m.group(1)
        b = BAGLANTI.search(kart)
        if not b:
            return kart
        yol = b.group(1).strip("/")
        if not os.path.isdir(os.path.join(KOK, yol)):
            return kart
        iso, _ = anlamli_tarih(yol, boyut)
        if not iso:
            return kart
        kayit.append((yol, iso))
        temiz = MEVCUT.sub("", kart)
        satir = ('\n              <p class="card-updated">Güncellendi: '
                 '<time datetime="%s">%s</time></p>' % (iso, uzun_tarih(iso)))
        # Kart govdesinin sonuna, baglanti satirindan sonra.
        return temiz.replace("</p>\n            </div>",
                             "</p>" + satir + "\n            </div>", 1)

    return KART.sub(degistir, mevcut), kayit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--liste", action="store_true")
    args = ap.parse_args()

    mevcut = io.open(SAYFA, encoding="utf-8", newline="").read()
    yeni, kayit = sayfayi_uret(mevcut)

    if args.liste:
        for yol, iso in sorted(kayit, key=lambda k: k[1], reverse=True):
            print("%-40s %s" % (yol, uzun_tarih(iso)))
        print("\n%d arac kartina tarih yazilacak." % len(kayit))
        return 0

    if args.check:
        if yeni != mevcut:
            print("Arac kartlarindaki guncelleme tarihleri bayat. "
                  "Calistir: python tools/arac-guncelleme.py", file=sys.stderr)
            return 1
        print("Arac kartlari guncel.")
        return 0

    if yeni == mevcut:
        print("Arac kartlari zaten guncel.")
        return 0
    io.open(SAYFA, "w", encoding="utf-8", newline="").write(yeni)
    print("%d arac kartina guncelleme tarihi yazildi." % len(kayit))
    return 0


if __name__ == "__main__":
    sys.exit(main())
