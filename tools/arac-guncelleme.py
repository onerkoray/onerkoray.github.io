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

AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

KART = re.compile(
    r'(<li class="project-card(?![^"]*--soon)[^"]*"[^>]*>.*?</li>)', re.S)
BAGLANTI = re.compile(r'<h3><a href="([^"#?]+)"')
MEVCUT = re.compile(r'\s*<p class="card-updated">.*?</p>', re.S)
# Kartin son paragrafi ile </div> arasindaki yer. SATIR SONU DESENLE
# YAKALANIYOR: duz "</p>\n            </div>" karsilastirmasi, deponun CRLF
# ile checkout edildigi bir Windows kopyasinda hicbir seye uymuyordu. Sonuc
# sessiz veri kaybiydi: eski tarih siliniyor, yenisi yazilamiyordu ve hata
# ancak CI'da (LF) goruluyordu. Satir sonu ve girinti artik dosyadan okunuyor.
GOVDE_SON = re.compile(r"</p>(\r?\n)([ \t]*)</div>")


def git(*a):
    r = subprocess.run(["git"] + list(a), cwd=KOK, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    return r.stdout


DAMGA = re.compile(r"[?]v=[0-9a-f]+")

# Gecerlilik bildirimi (tools/gecerlilik.js) okuyucuya GORUNMEZ: sayfanin
# ne zaman gozden gecirilmesi gerektigini soyler, iceriginde ne yazdigini
# degil. Eklenmesini "sayfa guncellendi" diye sunmak lastmod'u sisirir --
# ve sisirilmis lastmod tazelik sinyalini guclendirmez, susturur.
GECERLILIK = re.compile(r'<meta\s+name="gecerlilik"')

# Arama motoru sahiplik dogrulama etiketi de okuyucuya GORUNMEZ. Ayni
# gerekce: eklenmesini "sayfa guncellendi" diye sunmak lastmod'u sisirir.
DOGRULAMA = re.compile(r'<meta\s+name="google-site-verification"')


# SITE KABUGU sayfanin icerigi degil. 26 Eylul 2026'da ust baslik 173
# sayfada tek standarda cekildi: menuye Araclar/Makaleler eklendi, marka
# adina sinif verildi, tema betigi eklendi. Tekrar esigi bunun cogunu
# yakaladi ama menusu tek satirda yazilmis ya da kendine ozgu ogeler tasiyan
# 18 aracin diff'i baska hicbir sayfaya benzemiyordu; kartlari "bugun
# guncellendi" oldu. Oysa okura sunulan icerik degismemisti. Ucuncu elek
# dosyanin once/sonra halini baslik, altbilgi ve site betikleri cikarilmis
# olarak karsilastirir; geriye fark kalmiyorsa degisiklik ozlu degildir.
KABUK_BAS = re.compile(r'<header class="site-header"[^>]*>.*?</header>', re.S)
KABUK_DIP = re.compile(r'<footer class="site-footer"[^>]*>.*?</footer>', re.S)
KABUK_BETIK = re.compile(
    r'<script src="[^"]*(?:tema-erken|script)[.]js(?:[?]v=[0-9a-f]+)?"(?: defer)?></script>')


def _kabuksuz(metin):
    metin = KABUK_BAS.sub("", metin)
    metin = KABUK_DIP.sub("", metin)
    metin = KABUK_BETIK.sub("", metin)
    metin = DAMGA.sub("", metin)
    return re.sub(r"\s+", " ", metin)


def yalniz_kabuk(h, yol):
    """Commit bu HTML dosyasinda yalnizca site kabugunu mu degistirdi?"""
    if not yol.endswith(".html"):
        return False
    once = git("show", h + "^:" + yol)
    sonra = git("show", h + ":" + yol)
    if not once or not sonra:          # yeni ya da silinmis dosya
        return False
    return _kabuksuz(once) == _kabuksuz(sonra)


# Ayni degisiklik kac dosyada tekrarlarsa "site geneli tarama" sayilir.
# Uc sayfayi ayni sekilde duzenlemek esgudumlu gercek bir istir; kirk sayfaya
# ayni satiri basmak taramadir. Eldeki dagilim bu araligi bos birakiyor.
TARAMA_TEKRARI = 10

_IMZA = {}


def _imzalar(h):
    """Commit'teki her dosyanin normalize edilmis diff imzasi.

    Tek 'git show' ile butun commit okunuyor; ayni commit birden cok sayfa
    icin sorulduguda tekrar cagrilmasin diye sonuc saklaniyor.
    """
    if h in _IMZA:
        return _IMZA[h]
    tablo, yol, ekli, silik = {}, None, [], []

    def kapat():
        if yol is not None:
            tablo[yol] = (tuple(sorted(ekli)), tuple(sorted(silik)))

    for satir in git("show", "--format=", "--unified=0", h).split("\n"):
        if satir.startswith("diff --git "):
            kapat()
            parca = satir.split(" b/", 1)
            yol = parca[1].strip() if len(parca) == 2 else None
            ekli, silik = [], []
            continue
        if yol is None:
            continue
        if satir.startswith("+++") or satir.startswith("---"):
            continue
        if GECERLILIK.search(satir) or DOGRULAMA.search(satir):
            continue
        if satir.startswith("+"):
            # Ilk kez damga eklenmesi de yalnizca onbellek degisimidir.
            ekli.append(DAMGA.sub("", satir[1:]))
        elif satir.startswith("-"):
            silik.append(DAMGA.sub("", satir[1:]))
    kapat()
    _IMZA[h] = tablo
    return tablo


def ozlu_degisim(h, yol):
    """Commit bu sayfaya GERCEK bir degisiklik getirdi mi?

    Iki elek var, ikisi de ayni soruyu soruyor: okuyucunun gordugu bir sey
    degisti mi?

    1. DAMGA VE BILDIRIM. "Keep asset cache stamps consistent" commit'i
       ondokuz dosyaya dokunuyor ama yaptigi tek sey ?v= damgalarini
       tazelemek. Damgalar normalize edilip once/sonra satirlari
       karsilastiriliyor; geriye bir sey kalmiyorsa degisiklik ozlu degildir.
       Gecerlilik bildirimi satirlari da ayni sebeple elenir.

    2. TEKRAR. Bir menu ogesini yuz on bes sayfaya eklemek her sayfada ozlu
       gorunur ama hicbirinin icerigi guncellenmemistir. Burada bakilan sey
       commit'in BOYUTU degil, bu sayfaya gelen degisikligin AYNISININ kac
       dosyada daha bulundugu.

       Onceki surum boyuta bakiyordu: kirk dosyadan buyuk commit toptan
       elenirdi. 20 Eylul 2026'da kirk bes dosyalik bir commit bu kurali
       curuttu -- sekiz maas sayfasi gercek icerik aldi, kirk kadar sayfa
       yalnizca stil damgasi. Sayiya bakan kural karisik commit'i ayirt
       edemez ve icerigi degisen sayfalari da eledi; lastmod eski tarihte
       kalinca sayfalarin yeniden taranmasi icin hicbir sinyal kalmadi.
       Sekle bakan kural ayni commit'in icinde ikisini ayirabiliyor.
    """
    tablo = _imzalar(h)
    # Cagiranlardan biri dosya yolu ("x/index.html"), digeri klasor ("x")
    # veriyor; ikisi de karsilanmali.
    kendi = [(k, v) for k, v in tablo.items()
             if k == yol or k.startswith(yol.rstrip("/") + "/")]
    if not kendi:
        return False
    for dosya, imza in kendi:
        if imza[0] == imza[1]:      # normalize sonrasi geriye bir sey yok
            continue
        tekrar = sum(1 for v in tablo.values() if v == imza)
        if tekrar < TARAMA_TEKRARI and not yalniz_kabuk(h, dosya):
            return True
    return False


def anlamli_tarih(yol):
    """Aracin klasorune dokunan, ozlu en son commit."""
    for h in git("log", "--format=%H", "--", yol).split():
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
    kayit = []

    def degistir(m):
        kart = m.group(1)
        b = BAGLANTI.search(kart)
        if not b:
            return kart
        yol = b.group(1).strip("/")
        if not os.path.isdir(os.path.join(KOK, yol)):
            return kart
        iso, _ = anlamli_tarih(yol)
        if not iso:
            return kart
        kayit.append((yol, iso))
        temiz = MEVCUT.sub("", kart)

        # Kart govdesinin sonuna, baglanti satirindan sonra. Satir sonu ve
        # girinti eslesmeden aliniyor ki dosyanin kendi bicimi korunsun.
        def yerlestir(m):
            nl, girinti = m.group(1), m.group(2)
            return ("</p>" + nl + girinti + "  "
                    + '<p class="card-updated">Güncellendi: '
                    + '<time datetime="%s">%s</time></p>' % (iso, uzun_tarih(iso))
                    + nl + girinti + "</div>")

        yeni_kart, adet = GOVDE_SON.subn(yerlestir, temiz, 1)
        if not adet:
            raise SystemExit(
                "Kart govdesinin sonu bulunamadi: %s. index.html'in yapisi "
                "degistiyse GOVDE_SON deseni guncellenmeli." % yol)
        return yeni_kart

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
