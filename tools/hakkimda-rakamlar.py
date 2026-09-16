# -*- coding: utf-8 -*-
"""/hakkimda/ sayfasındaki "Sayılarla" bloğunu depodan üretir.

NEDEN
-----
Sayfa artık şunu iddia ediyor: "bir hesabın doğruluğunu iddia ediyorsanız,
o iddianın denetlenebilir olması gerekir". Aynı sayfanın kendi sayılarını
elle yazması bu cümleyi çürütürdü — ve eskiyeceği kesindi. Araç sayısı
tam olarak bu şekilde bir kez eskimişti: sayfada 43 kart varken iki yerde
birden "34 araç" yazıyordu (bkz. tools/arac-sayisi.py).

ARAÇ SAYISI BURADA YENİDEN SAYILMIYOR
-------------------------------------
Ana sayfadaki kartlardan okunuyor — tools/arac-sayisi.py ile AYNI kaynak
ve aynı kural ("yakında" kartı sayılmaz). İkinci bir sayım ölçütü koymak,
iki sayfanın farklı sayı göstermesiyle biterdi.

Kullanım:
    python tools/hakkimda-rakamlar.py           # bloğu yaz
    python tools/hakkimda-rakamlar.py --check   # güncel mi (CI)
"""
import io
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "hakkimda", "index.html")
ANA = os.path.join(KOK, "index.html")
BAS = "<!-- HAKKIMDA-RAKAMLAR:BASLANGIC -->"
BIT = "<!-- HAKKIMDA-RAKAMLAR:BITIS -->"


def arac_sayisi():
    """Ana sayfadaki gerçek araç kartları — arac-sayisi.py ile aynı kural."""
    s = io.open(ANA, encoding="utf-8").read()
    kartlar = re.findall(r'class="project-card([^"]*)"', s)
    return sum(1 for k in kartlar if "--soon" not in k)


def makale_sayisi():
    yol = os.path.join(KOK, "makaleler")
    return sum(1 for d in os.listdir(yol)
               if os.path.isdir(os.path.join(yol, d))
               and os.path.exists(os.path.join(yol, d, "index.html")))


def ci_komut_sayisi():
    """Her push'ta koşan kontrol komutu sayısı."""
    yol = os.path.join(KOK, ".github", "workflows", "bordro-test.yml")
    s = io.open(yol, encoding="utf-8").read()
    n = 0
    for m in re.finditer(r"^(\s*)run:\s*(\|)?\s*(.*)$", s, re.M):
        girinti = len(m.group(1))
        if m.group(2):
            for satir in s[m.end():].split("\n")[1:]:
                if not satir.strip():
                    continue
                if len(satir) - len(satir.lstrip()) <= girinti:
                    break
                if not satir.strip().startswith("#"):
                    n += 1
        elif m.group(3).strip():
            n += 1
    return n


def parametre_yillari():
    s = io.open(os.path.join(KOK, "bordro", "parametreler.js"), encoding="utf-8").read()
    y = sorted(set(re.findall(r"^\s*(20\d\d)\s*:", s, re.M)))
    return (y[0], y[-1]) if y else ("", "")


def gecerlilik_sayisi():
    """<meta name="gecerlilik"> taşıyan, yani son kullanma tarihi olan sayfa."""
    n = 0
    for d, ds, fs in os.walk(KOK):
        ds[:] = [x for x in ds if x not in (".git", "_cekirdek", "node_modules")]
        for f in fs:
            if f != "index.html":
                continue
            s = io.open(os.path.join(d, f), encoding="utf-8", errors="replace").read()
            if 'name="gecerlilik"' in s:
                n += 1
    return n


def uret():
    ilk, son = parametre_yillari()
    satirlar = [
        ("%d" % arac_sayisi(), "ücretsiz hesaplama aracı"),
        ("%d" % makale_sayisi(), "makale — her sayısı testle sabitlenmiş"),
        ("%d" % ci_komut_sayisi(), "otomatik kontrol, her değişiklikte"),
        ("%s–%s" % (ilk, son), "yılları için doğrulanmış bordro parametreleri"),
        ("%d" % gecerlilik_sayisi(), "sayfa, yeniden kontrol tarihini kendi taşıyor"),
    ]
    ic = ["        <ul>"]
    for sayi, aciklama in satirlar:
        ic.append("          <li><strong>%s</strong> %s</li>" % (sayi, aciklama))
    ic.append("        </ul>")
    ic.append("        <p class=\"legal-note\">Bu sayılar elle yazılmıyor; her derlemede")
    ic.append("          depodan sayılıp bu bloğa yazılıyor ve bayatladığında derleme kırılıyor.</p>")
    return "\n".join([BAS] + ic + [BIT])


def main():
    kontrol = "--check" in sys.argv
    s = io.open(SAYFA, encoding="utf-8").read()
    i, j = s.find(BAS), s.find(BIT)
    if i < 0 or j < 0:
        print("Sayfada blok işareti yok: %s / %s" % (BAS, BIT), file=sys.stderr)
        return 1

    mevcut = s[i:j + len(BIT)]
    yeni = uret()
    if mevcut == yeni:
        print("Hakkimda rakamlari guncel.")
        return 0
    if kontrol:
        print("Hakkimda rakamlari bayat — "
              "'python tools/hakkimda-rakamlar.py' calistirin.", file=sys.stderr)
        return 1
    io.open(SAYFA, "w", encoding="utf-8", newline="").write(
        s[:i] + yeni + s[j + len(BIT):])
    print("Hakkimda rakamlari yazildi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
