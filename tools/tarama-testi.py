# -*- coding: utf-8 -*-
"""arac-guncelleme.py'nin "bu commit bu sayfayi gercekten degistirdi mi"
kuralini sinar.

NEDEN AYRI BIR TEST: bu kural sitedeki HER lastmod tarihini ve ana
sayfadaki her kart tarihini belirliyor, ama ciktisi bir tarih oldugu icin
yanlisligi sessiz kaliyor -- ekranda 13 Eylul yerine 14 Eylul yazar,
kimse fark etmez. Kuralin kendisi burada dogrudan sinaniyor.

Sinanan kural iki elekten olusuyor: damga/bildirim normalizasyonu ve
tekrar esigi. Ikisi de "okuyucunun gordugu bir sey degisti mi" sorusunu
soruyor.

Kullanim: python tools/tarama-testi.py
"""
import importlib.util
import io
import os
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _modul():
    yol = os.path.join(KOK, "tools", "arac-guncelleme.py")
    spec = importlib.util.spec_from_file_location("arac_guncelleme", yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A = _modul()

gecen = [0]
hata = [0]


def dogru(ad, kosul, detay=""):
    if kosul:
        gecen[0] += 1
        print("  tamam      " + ad)
    else:
        hata[0] += 1
        print("  BASARISIZ  " + ad + (("  -- " + detay) if detay else ""))


_SAYAC = [0]


def commit(dosyalar):
    """Sahte bir 'git show' ciktisi kurar ve commit karmasini dondurur.

    dosyalar: {yol: [(isaret, satir), ...]}
    """
    _SAYAC[0] += 1
    h = "sahte%04d" % _SAYAC[0]
    parca = []
    for yol, satirlar in dosyalar.items():
        parca.append("diff --git a/%s b/%s" % (yol, yol))
        parca.append("--- a/%s" % yol)
        parca.append("+++ b/%s" % yol)
        parca.append("@@ -1 +1 @@")
        for isaret, satir in satirlar:
            parca.append(isaret + satir)
    cikti = "\n".join(parca)
    A.git = lambda *a, **k: cikti          # noqa: E731  (test cift yonlusu)
    return h


def degisti(dosyalar, yol):
    return A.ozlu_degisim(commit(dosyalar), yol)


print("Tarama commit'i ayirt etme kurali\n")

# --- 1) Damga tazelemesi icerik degisikligi degil ---------------------------
DAMGA = [("-", '  <link rel="stylesheet" href="../style.css?v=aaaa1111">'),
         ("+", '  <link rel="stylesheet" href="../style.css?v=bbbb2222">')]
dogru("yalnizca ?v= damgasi degisen sayfa ozlu sayilmaz",
      not degisti({"x/index.html": DAMGA}, "x/index.html"))

# KONTROL: ayni bicimde ama damga DISI bir degisiklik ozlu sayilmali.
# Bu olmadan yukaridaki iddia, fonksiyon her zaman False donse de gecerdi.
dogru("KONTROL: damga disi tek satirlik degisiklik ozlu sayilir",
      degisti({"x/index.html": [
          ("-", "  <h1>Eski baslik</h1>"),
          ("+", "  <h1>Yeni baslik</h1>")]}, "x/index.html"))

# --- 2) Gecerlilik bildirimi okuyucuya gorunmez ----------------------------
dogru("gecerlilik bildirimi eklemek ozlu sayilmaz",
      not degisti({"x/index.html": [
          ("+", '  <meta name="gecerlilik" content="2027-01-01">')]},
          "x/index.html"))

# --- 3) Ayni degisiklik cok sayfada: tarama --------------------------------
SUPURGE = [("-", '          "https://500px.com/p/korayoner"'),
           ("+", '          "https://500px.com/p/korayoner",'),
           ("+", '          "https://orcid.org/0009-0005-8730-3577"')]
kirkUc = dict(("s%02d/index.html" % i, list(SUPURGE)) for i in range(43))
dogru("ayni satir 43 sayfaya eklenirse hicbiri guncellenmis sayilmaz",
      not degisti(kirkUc, "s00/index.html"))

# KONTROL: ayni degisiklik az sayida sayfadaysa esgudumlu gercek is sayilir.
uc = dict(("s%02d/index.html" % i, list(SUPURGE)) for i in range(3))
dogru("KONTROL: ayni degisiklik 3 sayfadaysa ozlu sayilir",
      degisti(uc, "s00/index.html"))

# --- 4) KARISIK COMMIT -- kuralin var olma sebebi --------------------------
# 20 Eylul 2026: kirk bes dosyalik tek commit. Sekiz sayfa kendine ozgu
# icerik aldi, otuz yedi sayfa yalnizca stil damgasi. Dosya sayisina bakan
# onceki kural commit'i toptan eliyor ve icerigi degisen sekiz sayfayi da
# birlikte goturuyordu.
karisik = dict(("damga%02d/index.html" % i, list(DAMGA)) for i in range(37))
for i in range(8):
    karisik["ucret%d/index.html" % i] = [
        ("+", "  <dd>%d TL</dd>" % (40000 + i * 10000))]
dogru("karisik commit: icerigi degisen sayfa ozlu sayilir",
      degisti(karisik, "ucret0/index.html"))
dogru("karisik commit: ayni commit'te damga alan sayfa ozlu sayilmaz",
      not degisti(karisik, "damga00/index.html"))

# --- 5) Yol bicimleri ------------------------------------------------------
# Sitemap dosya yolu, kartlar klasor veriyor; ikisi de karsilanmali.
tek = {"arac/index.html": [("+", "  <p>yeni olcum</p>")]}
dogru("dosya yolu ile sorulabiliyor", degisti(tek, "arac/index.html"))
dogru("klasor yolu ile sorulabiliyor", degisti(tek, "arac"))
dogru("sondaki egik cizgi sorun degil", degisti(tek, "arac/"))
dogru("commit'in dokunmadigi yol ozlu degil", not degisti(tek, "baska"))

# KONTROL: klasor eslemesi ON EK olmali, ic ice gecen adlari yutmamali.
dogru("KONTROL: 'arac' sorgusu 'aracgereç' klasorunu yakalamaz",
      not degisti({"aracgerec/index.html": [("+", "  <p>x</p>")]}, "arac"))

# --- 6) Eklenen ve silinen ayni satir: net degisim yok ---------------------
dogru("ayni satirin silinip eklenmesi ozlu sayilmaz",
      not degisti({"x/index.html": [
          ("-", "  <p>ayni</p>"), ("+", "  <p>ayni</p>")]}, "x/index.html"))

print("\n%d gecti, %d kaldi. (tarama commit'i kurali)" % (gecen[0], hata[0]))
sys.exit(1 if hata[0] else 0)
