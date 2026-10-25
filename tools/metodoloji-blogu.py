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
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BAS = "<!-- METODOLOJI-BLOGU:BASLANGIC -->"
BIT = "<!-- METODOLOJI-BLOGU:BITIS -->"

# Araç olmayan sayfalar: kurumsal, yasal, içerik ve taslak sayfalar.
HARIC = {
    "yayin-ilkeleri", "gizlilik", "iletisim", "kullanim-kosullari", "hakkimda", "makaleler",
    "koray-oner",
    "en",          # İngilizce tanıtım (hakkımda'nın karşılığı), araç değil
    "bordro",
    "ara",
    "araclar",
}

# Bordro Motoru'nu fiilen kullanan araçlar. Buraya yazılmayan sayfa, motoru
# kullandığını iddia eden bir künye almaz.
MOTORLU = {
    "maas-hesaplama", "isten-ayrilma-hesaplama",
    "kidem-tazminati-hesaplama", "issizlik-maasi-hesaplama",
    "serbest-meslek-makbuzu-hesaplama", "calisma-bicimi-karsilastirma",
    "isveren-maliyeti-hesaplama",
    "fazla-mesai-hesaplama",
    "emekli-calisan-maas-hesaplama",
}

MOTOR_SURUMU = "1.3.0"
# Motorlu araçların hesap ve parametre dosyaları. 25 Ekim 2026'ya kadar burada
# elle yazılmış bir "son gözden geçirme" tarihi (5 Eylül) duruyordu ve
# parametreler o tarihten sonra beş kez değişmişti. Tarih artık git'ten.
MOTOR_DOSYALARI = ("bordro/parametreler.js", "bordro/motor.js")

AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
         "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
# Sayfanın yüklediği ama hesap ya da parametre taşımayan ortak betikler.
ORTAK_BETIK = {"onay.js", "tema-erken.js", "script.js", "durum.js", "arama.js",
               "sonuc-yuzeyi.js", "katalog.js", "home.js", "live.js", "tablo.js"}
HESAP_ADI = re.compile(r"parametre|tarife|hesap|motor|seri|veri")
_GIT = {}


def git_tarihi(yol):
    """Dosyanın son commit tarihi (YYYY-AA-GG); izlenmiyorsa None."""
    if yol not in _GIT:
        r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", yol], cwd=ROOT,
                           capture_output=True, text=True, encoding="utf-8")
        _GIT[yol] = r.stdout.strip() or None
    return _GIT[yol]


def uzun(iso):
    y, a, g = iso.split("-")
    return "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)


def hesap_dosyalari(sayfa, html, motorlu):
    """Sayfanın hesabını ve yasal parametrelerini taşıyan dosyalar (kök göreli)."""
    if motorlu:
        return list(MOTOR_DOSYALARI)
    dizin = os.path.dirname(sayfa)
    yerel = []
    for src in re.findall(r'<script[^>]*\ssrc="([^"?#]+\.js)', html):
        if src.startswith(("http", "/")):
            continue
        tam = os.path.normpath(os.path.join(dizin, src))
        goreli = os.path.relpath(tam, ROOT).replace(os.sep, "/")
        if goreli.startswith("..") or not os.path.isfile(tam):
            continue
        if "/" not in goreli and goreli in ORTAK_BETIK:
            continue
        yerel.append(goreli)
    hesap = [y for y in yerel if HESAP_ADI.search(os.path.basename(y)) or y.startswith(("bordro/", "finans/"))]
    return hesap or yerel


def hesap_tarihi(sayfa, html, motorlu):
    tarihler = [t for t in (git_tarihi(y) for y in hesap_dosyalari(sayfa, html, motorlu)) if t]
    return max(tarihler) if tarihler else None


def zaman(iso):
    return "<time datetime=\"%s\">%s</time>" % (iso, uzun(iso))


GOZDEN = re.compile(r'(<span class="updated">)(?:Parametreler en son [^<]*? tarihinde gözden geçirildi\.'
                    r'|Hesap ve parametreler en son <time datetime="[\d-]+">[^<]*</time> tarihinde güncellendi\.)(</span>)')


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
    """Sayfada parametre tarihi cümlesi var mı (eski ya da yeni biçim)."""
    return bool(GOZDEN.search(html))


def satir(etiket, deger):
    return "            <div><dt>%s</dt><dd>%s</dd></div>" % (etiket, deger)


def blok(html, kok, motorlu, tarih=None):
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
            satir("Hesap ve parametreler", zaman(tarih)),
            satir("Değişiklik günlüğü", "<a href=\"%sbordro/#gunluk\">Yayımlanıyor</a>" % kok),
        ]
    # Bölüm kimliğine bakılır, metnine değil: bloğun kendisi de "Veri kaynakları"
    # ifadesini içerdiğinden metin araması ikinci çalıştırmada kendini kirletir.
    elif 'href="https://korayoner.dev/pesin-mi-taksit-mi/"' in html:
        metin = (
            'Bu aracı <a href="%shakkimda/" rel="author"><strong>Koray Öner</strong></a> geliştirdi ve sürdürüyor. '
            'Kullanıcının girdiği teklifleri aylık nakit akışlarına çevirir. Bugünkü değer formülü, '
            'varsayımlar ve kapsam bu sayfadaki <a href="#yontem">hesap yönteminde</a> açıklanır. '
            'Hesaplar tarayıcıda yapılır; oranlar piyasa verisi değil, kullanıcı varsayımıdır.'
        ) % kok
        satirlar = [
            satir("Geliştiren", '<a href="%shakkimda/" rel="author">Koray Öner</a>' % kok),
            satir("Yöntem", '<a href="#yontem">Aylık nakit akışlarının bugünkü değeri</a>'),
            satir("Kaynak kod ve testler", '<a href="https://korayoner.dev/pesin-mi-taksit-mi/motor.js">Hesap motoru</a> · <a href="https://korayoner.dev/pesin-mi-taksit-mi/test.js">Sayısal testler</a>'),
        ]
    # Grafikler sayfası bir araç değil, veri sayfası: okur bir şey girmez,
    # künye veri kaynağını ve doğrulama yolunu belgeler.
    elif 'href="https://korayoner.dev/grafikler/"' in html:
        metin = (
            'Bu sayfayı <a href="%(k)shakkimda/" rel="author"><strong>Koray Öner</strong></a> hazırladı ve '
            'sürdürüyor. Grafikler TÜİK, TCMB ve Dünya Bankası verisinden her iş günü yeniden üretilir; '
            'sayfadaki her rakam bir hesap modülünden gelir ve ayrı bir testle ikinci bir yoldan '
            'yeniden hesaplanır. Tanımlar ve doğrulama kuralları <a href="#yontem">yöntem bölümünde</a>.'
        ) % {"k": kok}
        satirlar = [
            satir("Hazırlayan", '<a href="%shakkimda/" rel="author">Koray Öner</a>' % kok),
            satir("Veri", "TÜİK, TCMB, Dünya Bankası — her iş günü"),
            satir("Hesap ve testler", '<a href="https://korayoner.dev/grafikler/hesap.js">Hesap modülü</a> · '
                  '<a href="https://korayoner.dev/grafikler/test.js">Testler</a>'),
        ]
        hesaplayici = False
    # Diyagramlar sayfası da araç değil: okur bir şey girmez (yalnız temsili
    # maaşı seçer), künye rakamların hangi motordan geldiğini belgeler.
    elif 'href="https://korayoner.dev/diyagramlar/"' in html:
        metin = (
            'Bu sayfayı <a href="%(k)shakkimda/" rel="author"><strong>Koray Öner</strong></a> hazırladı ve '
            'sürdürüyor. Diyagramlar sitenin kendi hesap motorlarından çizilir: bordro için '
            '<a href="%(k)sbordro/">Bordro Motoru</a>, kredi için kredi hesaplama aracının motoru. Sayfadaki her '
            'rakam bu motorlardan üretilir ve ayrı bir testle ikinci bir yoldan yeniden hesaplanır. Varsayımlar '
            '<a href="#yontem">yöntem bölümünde</a>.'
        ) % {"k": kok}
        satirlar = [
            satir("Hazırlayan", '<a href="%shakkimda/" rel="author">Koray Öner</a>' % kok),
            satir("Hesap", '<a href="%sbordro/">Bordro Motoru %s</a> · <a href="%skredi-hesaplama/">Kredi motoru</a>' % (kok, MOTOR_SURUMU, kok)),
            satir("Kod ve testler", '<a href="https://korayoner.dev/diyagramlar/hesap.js">Hesap modülü</a> · '
                  '<a href="https://korayoner.dev/diyagramlar/test.js">Testler</a>'),
        ]
        hesaplayici = False
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
            satirlar.append(satir("Hesap ve parametreler", zaman(tarih)))
        satirlar.append(satir("Kaynak kod",
                              "<a href=\"https://github.com/onerkoray/hesap-cekirdegi\" rel=\"noopener\">GitHub</a>"))
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
                  "<a href=\"https://github.com/onerkoray/hesap-cekirdegi\" rel=\"noopener\">GitHub</a>"),
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
            "Bu sayfayı kim hazırladı, veri nereden geliyor?" if 'href="https://korayoner.dev/grafikler/"' in html
            else "Bu sayfayı kim hazırladı, rakamlar nereden geliyor?" if 'href="https://korayoner.dev/diyagramlar/"' in html
            else "Bu aracı kim yaptı, nasıl hesaplıyor?" if hesaplayici else "Bu aracı kim yaptı?"),
        "          <p>%s</p>" % metin,
        "          <p><a href=\"/yayin-ilkeleri/\">Yayın ilkeleri, kapsam ve düzeltmeler</a></p>",
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
        cumle = gozden_gecirme(html)
        tarih = hesap_tarihi(sayfa, html, motorlu) if (motorlu or cumle) else None
        if cumle and tarih:
            html2 = GOZDEN.sub(lambda m: m.group(1) + "Hesap ve parametreler en son %s tarihinde güncellendi." % zaman(tarih) + m.group(2), html)
        else:
            html2 = html
        yeni = uygula(html2, blok(html2, kok, motorlu, tarih))
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
