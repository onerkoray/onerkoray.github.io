# -*- coding: utf-8 -*-
"""/hakkimda/ sayfasındaki "Sayılarla" bloğunu depodan üretir.

NEDEN
-----
Sayfa artık şunu iddia ediyor: "bir hesabın doğruluğunu iddia ediyorsanız,
o iddianın denetlenebilir olması gerekir". Aynı sayfanın kendi sayılarını
elle yazması bu cümleyi çürütürdü — ve eskiyeceği kesindi. Araç sayısı
tam olarak bu şekilde bir kez eskimişti: sayfada 43 kart varken iki yerde
birden "34 araç" yazıyordu (bkz. tools/arac-sayisi.py).

ARAÇ VE YAZI SAYISI BURADA YENİDEN SAYILMIYOR
---------------------------------------------
İçerik manifestinden (content.json sayaclar) okunuyor: ana sayfa
(tools/arac-sayisi.py), çalışma dizini, Atom akışları ve llms.txt ile AYNI
kaynak. İkinci bir sayım ölçütü koymak, iki sayfanın farklı sayı
göstermesiyle biterdi (7 Ekim 2026'ya kadar araç kartlardan, yazı
klasörlerden sayılıyordu).

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


def sayaclar():
    """İçerik manifestinin sayaçları (scripts/build-manifest.mjs): araç ve
    yazı sayısı ana sayfa, çalışma dizini, akışlar ve llms.txt ile aynı yerden."""
    import json
    return json.load(io.open(os.path.join(KOK, "content.json"), encoding="utf-8"))["sayaclar"]


def arac_sayisi():
    return sayaclar()["arac"]


def makale_sayisi():
    return sayaclar()["makale"]


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


DBAS = "<!-- DIL-DAGILIMI:BASLANGIC -->"
DBIT = "<!-- DIL-DAGILIMI:BITIS -->"
DILLER = (("HTML", (".html",)), ("JavaScript", (".js", ".mjs")), ("CSS", (".css",)), ("Python", (".py",)))


def dil_dagilimi():
    """Ana sayfadaki dil çubuğu: depoda izlenen dosyaların bayt payı, tam
    sayıya en büyük kalan yöntemiyle yuvarlanmış (toplam 100). 7 Ekim 2026'ya
    kadar çubuk elle yazılmıştı (TypeScript %24 — depoda TypeScript yok) ve
    JavaScript kapalıyken her dil "0%" görünüyordu."""
    import subprocess
    r = subprocess.run(["git", "ls-files", "-z"], cwd=KOK, capture_output=True, check=True)
    bayt = dict((ad, 0) for ad, _ in DILLER)
    for yol in r.stdout.decode("utf-8").split("\0"):
        tam = os.path.join(KOK, yol)
        if not yol or yol.endswith(".min.js") or not os.path.isfile(tam):
            continue
        for ad, uzantilar in DILLER:
            if yol.endswith(uzantilar):
                bayt[ad] += os.path.getsize(tam)
    toplam = sum(bayt.values()) or 1
    ham = [(ad, 100.0 * bayt[ad] / toplam) for ad, _ in DILLER]
    yuzde = dict((ad, int(x)) for ad, x in ham)
    for ad, x in sorted(ham, key=lambda t: t[1] - int(t[1]), reverse=True)[:100 - sum(yuzde.values())]:
        yuzde[ad] += 1
    sira = sorted(yuzde.items(), key=lambda t: -t[1])
    g = "            "
    ic = ['          <div class="lang-wrap">',
          g + '<div class="lang-bar" role="img" aria-label="Bu sitenin deposunda dil dağılımı: %s">'
          % ", ".join("%s %%%d" % (ad, v) for ad, v in sira)]
    ic += [g + '  <span data-lang="%s" data-pct="%d" style="flex-grow:%d"></span>' % (ad, v, v) for ad, v in sira]
    ic += [g + "</div>", g + '<ul class="lang-legend">']
    ic += [g + "  <li>%s <b>%%%d</b></li>" % (ad, v) for ad, v in sira]
    ic += [g + "</ul>", "          </div>"]
    return DBAS + "\n" + "\n".join(ic) + "\n          " + DBIT


def ana_sayfa(kontrol):
    s = io.open(ANA, encoding="utf-8").read()
    i, j = s.find(DBAS), s.find(DBIT)
    if i < 0 or j < 0:
        print("Ana sayfada dil bloğu yok: %s" % DBAS, file=sys.stderr)
        return 1
    yeni = s[:i] + dil_dagilimi() + s[j + len(DBIT):]
    if yeni == s:
        return 0
    if kontrol:
        print("Ana sayfadaki dil dağılımı bayat — 'python tools/hakkimda-rakamlar.py' calistirin.", file=sys.stderr)
        return 1
    io.open(ANA, "w", encoding="utf-8", newline="").write(yeni)
    print("Ana sayfadaki dil dağılımı yazıldı.")
    return 0


def main():
    kontrol = "--check" in sys.argv
    if ana_sayfa(kontrol):
        return 1
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
