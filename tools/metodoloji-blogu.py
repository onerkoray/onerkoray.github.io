#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Her araç sayfasına görünür bir "metodoloji + kim yaptı" künyesi yerleştirir.

Neden: "Koray Öner" sorgusunda araçların çıkması için aracın kişiyle bağının
hem insan hem makine tarafından okunabilir olması gerekiyor. Blok statik HTML
olarak yazılır (JS ile enjekte edilmez), çünkü SEO değeri yalnızca kaynakta
duran metinden gelir.

Blok iki biçimde üretilir:
  A) Bordro Motoru'nu kullanan sayfalar (maas-hesaplama ve alt sayfaları)
     -> motora, metodolojiye ve değişiklik günlüğüne bağlanır.
  B) Diğer araçlar -> geliştiren kişiye ve sayfanın kendi kaynak bölümüne bağlanır.

Kullanım:
    python tools/metodoloji-blogu.py            # blokları yaz/güncelle
    python tools/metodoloji-blogu.py --check    # değişiklik gerekir mi, yazma
    python tools/metodoloji-blogu.py --list     # hedef sayfaları listele
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BAS = "<!-- METODOLOJI-BLOGU:BASLANGIC -->"
BIT = "<!-- METODOLOJI-BLOGU:BITIS -->"

# Araç olmayan sayfalar: kurumsal, yasal, içerik ve taslak sayfalar.
HARIC = {
    "gizlilik", "iletisim", "kullanim-kosullari", "hakkimda", "makaleler",
    "bordro",
}

# Bordro Motoru'nu fiilen kullanan araçlar. Buraya yazılmayan sayfa, motoru
# kullandığını iddia eden bir künye almaz.
MOTORLU = {
    "maas-hesaplama", "isten-ayrilma-hesaplama",
    "kidem-tazminati-hesaplama", "issizlik-maasi-hesaplama",
    "serbest-meslek-makbuzu-hesaplama", "calisma-bicimi-karsilastirma",
    "isveren-maliyeti-hesaplama",
    "fazla-mesai-hesaplama",
}

MOTOR_SURUMU = "1.0.1"
MOTOR_TARIHI = "2026-09-05"
MOTOR_TARIHI_TR = "5 Eylül 2026"


def hedefler():
    """Künye yerleştirilecek sayfalar: kök seviyedeki araçlar ve alt sayfaları."""
    bulunan = []
    for ad in sorted(os.listdir(ROOT)):
        klasor = os.path.join(ROOT, ad)
        if not os.path.isdir(klasor) or ad.startswith(".") or ad in HARIC:
            continue
        if ad in ("images", "tools", "well-known"):
            continue
        sayfa = os.path.join(klasor, "index.html")
        if os.path.isfile(sayfa):
            bulunan.append((sayfa, ad, 1))
        for alt in sorted(os.listdir(klasor)):
            altsayfa = os.path.join(klasor, alt, "index.html")
            if os.path.isfile(altsayfa):
                bulunan.append((altsayfa, ad, 2))
    return bulunan


def kaynak_basligi(html):
    """Sayfanın kendi kaynak bölümünün başlığı ("Veri kaynakları", "Veri kaynağı ve güncelleme"...)."""
    m = re.search(r'<h2 id="kaynak-title">(.*?)</h2>', html, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


def gozden_gecirme(html):
    """Sayfanın kendi beyan ettiği son gözden geçirme tarihi, varsa."""
    m = re.search(r'class="updated">Parametreler en son (.*?) tarihinde', html)
    return m.group(1) if m else None


def satir(etiket, deger):
    return "            <div><dt>%s</dt><dd>%s</dd></div>" % (etiket, deger)


def blok(html, kok, motorlu):
    tarih = gozden_gecirme(html)
    baslik = kaynak_basligi(html) or "Veri kaynakları"
    hesaplayici = motorlu or 'id="kaynak-title"' in html

    if motorlu:
        metin = (
            "Bu sayfadaki hesapları <a href=\"%(k)shakkimda/\" rel=\"author\"><strong>Koray Öner</strong></a> "
            "geliştirdi ve sürdürüyor. Sonuçlar, açık kaynaklı "
            "<a href=\"%(k)sbordro/\">Bordro Motoru</a> çekirdeğinden gelir: kullanılan yasal parametreler, "
            "adım adım hesap yöntemi ve doğrulama testleri "
            "<a href=\"%(k)sbordro/#metodoloji\">metodoloji sayfasında</a> herkese açıktır."
        ) % {"k": kok}
        satirlar = [
            satir("Geliştiren", "<a href=\"%shakkimda/\" rel=\"author\">Koray Öner</a>" % kok),
            satir("Hesaplama çekirdeği", "<a href=\"%sbordro/\">Bordro Motoru %s</a>" % (kok, MOTOR_SURUMU)),
            satir("Son gözden geçirme", "<time datetime=\"%s\">%s</time>" % (MOTOR_TARIHI, MOTOR_TARIHI_TR)),
            satir("Değişiklik günlüğü", "<a href=\"%sbordro/#gunluk\">Yayımlanıyor</a>" % kok),
        ]
    # Bölüm kimliğine bakılır, metnine değil: bloğun kendisi de "Veri kaynakları"
    # ifadesini içerdiğinden metin araması ikinci çalıştırmada kendini kirletir.
    elif 'id="kaynak-title"' in html:
        metin = (
            "Bu aracı <a href=\"%(k)shakkimda/\" rel=\"author\"><strong>Koray Öner</strong></a> geliştirdi ve "
            "sürdürüyor. Kullanılan oran ve tutarların dayandığı mevzuat ile resmî kaynaklar bu sayfadaki "
            "<em>%(b)s</em> bölümünde tek tek belirtilir. Ücret ve bordro hesaplarında kullanılan "
            "ortak çekirdek olan <a href=\"%(k)sbordro/\">Bordro Motoru</a> ise metodolojisi, parametreleri ve "
            "değişiklik günlüğüyle birlikte açık yayımlanır."
        ) % {"k": kok, "b": baslik}
        satirlar = [
            satir("Geliştiren", "<a href=\"%shakkimda/\" rel=\"author\">Koray Öner</a>" % kok),
            satir("Yöntem", "Sayfadaki <em>%s</em> bölümü" % baslik),
        ]
        if tarih:
            satirlar.append(satir("Son gözden geçirme", tarih))
        satirlar.append(satir("Kaynak kod",
                              "<a href=\"https://github.com/onerkoray/onerkoray.github.io\" rel=\"noopener\">GitHub</a>"))
    else:
        # Mevzuata dayanmayan araçlar (üreteçler, dönüştürücüler, ölçüm araçları):
        # burada anlatılacak bir "kaynak" yok; künye kişiyi ve gizlilik davranışını belgeler.
        metin = (
            "Bu aracı <a href=\"%(k)shakkimda/\" rel=\"author\"><strong>Koray Öner</strong></a> geliştirdi ve "
            "sürdürüyor. Ücretsizdir, reklam içermez ve bütün işlem tarayıcınızda yapılır — girdiğiniz veriler "
            "hiçbir yere gönderilmez. Kaynak kodu herkese açıktır; "
            "<a href=\"%(k)s\">diğer araçlara</a> buradan ulaşabilirsiniz."
        ) % {"k": kok}
        satirlar = [
            satir("Geliştiren", "<a href=\"%shakkimda/\" rel=\"author\">Koray Öner</a>" % kok),
            satir("Çalışma yeri", "Tarayıcınız — sunucuya veri gitmez"),
            satir("Kaynak kod",
                  "<a href=\"https://github.com/onerkoray/onerkoray.github.io\" rel=\"noopener\">GitHub</a>"),
        ]

    return "\n".join([
        "  " + BAS,
        "  <section class=\"method\" aria-labelledby=\"metod-title\">",
        "    <div class=\"wrap\">",
        "      <div class=\"method-card\">",
        "        <img class=\"method-portrait\" src=\"%simages/koray-oner-portre-360.webp\" width=\"84\" height=\"84\"" % kok,
        "             alt=\"Koray Öner\" loading=\"lazy\" decoding=\"async\">",
        "        <div class=\"method-body\">",
        "          <h2 id=\"metod-title\">%s</h2>" % (
            "Bu aracı kim yaptı, nasıl hesaplıyor?" if hesaplayici else "Bu aracı kim yaptı?"),
        "          <p>%s</p>" % metin,
        "          <dl class=\"method-meta\">",
        "\n".join(satirlar),
        "          </dl>",
        "        </div>",
        "      </div>",
        "    </div>",
        "  </section>",
        "  " + BIT,
    ])


def uygula(html, yeni_blok):
    # Varsa eski blok tamamen sökülür, sonra kanonik yerine yeniden yazılır.
    # Böylece hem içerik hem de konum tek bir yerden yönetilir.
    i, j = html.find(BAS), html.find(BIT)
    if i != -1 and j != -1:
        html = (html[:i].rstrip() + "\n" + html[j + len(BIT):].lstrip("\n"))

    # Künye içeriktir: <main> landmark'ının içinde, son bölüm olarak durmalı.
    yer = html.find("</main>")
    if yer == -1:
        yer = html.find("<footer class=\"site-footer\"")
    if yer == -1:
        return None
    return html[:yer].rstrip() + "\n\n" + yeni_blok + "\n\n  " + html[yer:].lstrip()


def main():
    kontrol = "--check" in sys.argv
    if "--list" in sys.argv:
        for sayfa, ad, derinlik in hedefler():
            print("%-2d %s" % (derinlik, os.path.relpath(sayfa, ROOT)))
        return 0

    degisen, atlanan = [], []
    for sayfa, ad, derinlik in hedefler():
        with io.open(sayfa, encoding="utf-8") as f:
            html = f.read()
        kok = "../" * derinlik
        motorlu = ad in MOTORLU
        yeni = uygula(html, blok(html, kok, motorlu))
        if yeni is None:
            atlanan.append(os.path.relpath(sayfa, ROOT))
            continue
        if yeni == html:
            continue
        degisen.append(os.path.relpath(sayfa, ROOT))
        if not kontrol:
            with io.open(sayfa, "w", encoding="utf-8", newline="\n") as f:
                f.write(yeni)

    for s in atlanan:
        print("atlandı (footer yok): %s" % s)
    if kontrol:
        if degisen:
            print("%d sayfa güncel değil." % len(degisen))
            return 1
        print("Tüm künyeler güncel.")
        return 0
    print("%d sayfa güncellendi." % len(degisen))
    return 0


if __name__ == "__main__":
    sys.exit(main())
