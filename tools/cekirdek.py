#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hesap cekirdegini ayri bir public depo icin paketler.

NEDEN VAR:
Site 86 sayfada "acik kaynak" diyor ve 32 baglantiyla depoya gonderiyor.
Bu iddia sitenin en buyuk farklilastiricisi: Bordro Motoru'nun guvenilirlik
argumaninin tamami "parametreler, hesap yontemi ve dogrulama testleri herkese
acik" cumlesine dayaniyor.

Ama sitenin TAMAMININ acik olmasi gerekmiyor. Acik olmasi gereken sey, iddia
edilen sey: HESAP CEKIRDEGI VE TESTLERI. Pazarlama metinleri, uretecler,
gorseller ve makale taslaklari bu iddianin parcasi degil.

Bu arac cekirdegi ayri bir klasore paketler; o klasor public bir depoya
yuklenir. Sitenin kendi deposu private olabilir.

TEK DOGRULUK KAYNAGI SITE DEPOSUDUR. Cekirdek deposu bir AYNA; buradan
uretilir. Iki yerde ayri ayri duzenlenirse sessizce ayrisirlar ve sitenin
"testlerimiz acik" iddiasi yanlisa doner.

Kullanim:
    python tools/cekirdek.py            # _cekirdek/ klasorunu uret
    python tools/cekirdek.py --check    # site iddialariyla tutarli mi (CI)
    python tools/cekirdek.py --liste    # hangi dosyalar cekirdekte
"""

import io
import os
import re
import sys
import shutil
import subprocess

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

# Cekirdek deposunun adresi. Sitedeki butun "kaynak kodu" baglantilari
# buraya isaret eder; degistirilecekse tek yer burasi.
DEPO = "https://github.com/onerkoray/hesap-cekirdegi"
CIKTI = "_cekirdek"

# Cekirdege GIREN dosyalar: kaynak -> hedef.
# Kural: yalnizca hesap yapan kod ve onu dogrulayan testler. Arayuz, uretec,
# gorsel ve icerik girmez.
DOSYALAR = [
    ("bordro/parametreler.js",            "bordro/parametreler.js"),
    ("bordro/motor.js",                   "bordro/motor.js"),
    ("bordro/cikis.js",                   "bordro/cikis.js"),
    ("bordro/calisma-bicimi.js",          "bordro/calisma-bicimi.js"),
    ("bordro/test.js",                    "bordro/test.js"),
    ("bordro/cikis-test.js",              "bordro/cikis-test.js"),
    ("bordro/calisma-bicimi-test.js",     "bordro/calisma-bicimi-test.js"),
    ("kredi-hesaplama/hesap.js",          "kredi/hesap.js"),
    ("kredi-hesaplama/test.js",           "kredi/test.js"),
    ("ev-almak-mi-kiralamak-mi/hesap.js", "ev-kira/hesap.js"),
    ("ev-almak-mi-kiralamak-mi/test.js",  "ev-kira/test.js"),
    ("finansal-emniyet-testi/hesap.js",     "emniyet/hesap.js"),
    ("finansal-emniyet-testi/test.js",      "emniyet/test.js"),
    ("finansal-ozgurluk-hesaplama/hesap.js",  "fire/hesap.js"),
    ("finansal-ozgurluk-hesaplama/test.js",   "fire/test.js"),
    ("vergi-kamasi-hesaplama/hesap.js",   "kama/hesap.js"),
    ("vergi-kamasi-hesaplama/test.js",    "kama/test.js"),
    ("ucret-kar-payi-optimizasyonu/hesap.js", "ucret-kar-payi/hesap.js"),
    ("ucret-kar-payi-optimizasyonu/test.js",  "ucret-kar-payi/test.js"),
    ("zam-hesaplama/hesap.js",            "zam/hesap.js"),
    ("zam-hesaplama/test.js",             "zam/test.js"),
    ("birikim-hesaplama/hesap.js",        "birikim/hesap.js"),
    ("birikim-hesaplama/test.js",         "birikim/test.js"),
    ("fatura-olusturma/fatura.js",        "fatura/fatura.js"),
    ("fatura-olusturma/arsiv.js",         "fatura/arsiv.js"),
    ("fatura-olusturma/test.js",          "fatura/test.js"),
    ("fatura-olusturma/arsiv-test.js",    "fatura/arsiv-test.js"),
]

# Cekirdekteki dosyalar birbirini goreli yolla cagiriyor; klasor yapisi
# degistigi icin bu yollar duzeltilmeli.
YOL_DUZELTME = [
    ('require("./fatura.js")', 'require("./fatura.js")'),   # ayni klasorde kaliyor
    # Ev/kira cekirdegi kredi cekirdegini cagiriyor. Sitede klasor adi
    # "kredi-hesaplama", pakette "kredi" -- yol duzeltilmezse paketlenmis
    # test dosya bulamiyor. (Ilk pakette tam bunu yakaladi.)
    ('require("../kredi-hesaplama/hesap.js")', 'require("../kredi/hesap.js")'),
    # Zam cekirdegi bordro motorunu cagiriyor; pakette klasor adi ayni
    # ('bordro') oldugu icin yol degismiyor ama kural burada dursun.
    # Ayni gerekce vergi kamasi (../bordro/motor.js) ve ucret-kar payi
    # (../bordro/calisma-bicimi.js) cekirdekleri icin de gecerli.

]

LISANS = """MIT License

Copyright (c) 2026 Koray Öner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


def oku(p):
    return io.open(p, encoding="utf-8").read()


def test_sayilari():
    """Testleri calistirip gecen sayilarini okur.

    README'ye elle sayi yazmak, testler degistiginde sessizce eskiyor.
    """
    sonuc = {}
    for ad, yol in (("bordro", "bordro/test.js"),
                    ("kredi", "kredi-hesaplama/test.js"),
                    ("cikis", "bordro/cikis-test.js"),
                    ("calisma", "bordro/calisma-bicimi-test.js"),
                    ("ev-kira", "ev-almak-mi-kiralamak-mi/test.js"),
                    ("emniyet", "finansal-emniyet-testi/test.js"),
                    ("fire", "finansal-ozgurluk-hesaplama/test.js"),
                    ("kama", "vergi-kamasi-hesaplama/test.js"),
                    ("ucret-kar-payi", "ucret-kar-payi-optimizasyonu/test.js"),
                    ("zam", "zam-hesaplama/test.js"),
                    ("birikim", "birikim-hesaplama/test.js"),
                    ("fatura", "fatura-olusturma/test.js"),
                    ("arsiv", "fatura-olusturma/arsiv-test.js")):
        try:
            r = subprocess.run(["node", yol], capture_output=True, timeout=120)
            m = re.search(r"(\d+) geçti", r.stdout.decode("utf-8", "replace"))
            sonuc[ad] = int(m.group(1)) if m else 0
        except Exception:
            sonuc[ad] = 0
    return sonuc


def surum():
    m = re.search(r'surum:\s*"([^"]+)"', oku("bordro/motor.js"))
    return m.group(1) if m else "?"


def benioku(sayilar):
    toplam = sum(sayilar.values())
    yillar = re.findall(r"^\s{2}(\d{4}):", oku("bordro/parametreler.js"), re.M)
    return """# Hesap Çekirdeği

[korayoner.dev](https://korayoner.dev/) üzerindeki hesaplama araçlarını çalıştıran
bağımlılıksız çekirdek. Türkiye mevzuatına göre ücret bordrosu ve fatura tutarı
hesaplar. Tarayıcıda ve Node.js'te aynı kodla çalışır.

**Bu depo bir aynadır.** Kaynak, sitenin kendi deposudur; buraya
`tools/cekirdek.py` ile üretilir. Katkı ve hata bildirimi için
[iletişim](https://korayoner.dev/iletisim/) sayfasını kullanın.

## Neden ayrı bir depo?

Site 80'den fazla sayfada "hesap yöntemi ve doğrulama testleri herkese açıktır"
diyor. Açık olması gereken şey tam olarak budur: **hesap yapan kod ve onu
doğrulayan testler.** Pazarlama metinleri, görsel üreteçleri ve içerik taslakları
bu iddianın parçası değil; onlar sitenin kendi deposunda kalıyor.

## İçerik

### `bordro/` — ücret bordrosu (%(yil_ilk)s-%(yil_son)s)
Kümülatif gelir vergisi tarifesi (GVK m.103), asgari ücret istisnası (m.32),
SGK taban ve tavanı (5510 m.82), damga vergisi, netten brüte iteratif çözüm,
kıdem ve ihbar tazminatı, işsizlik ödeneği, çalışma biçimi karşılaştırması.

### `kredi/` — kredi maliyeti
Eşit taksitli (annüite) kredi, KKDF ve BSMV ile brütleşmiş aylık maliyet oranı,
kuruş tamsayısı üzerinde amortisman, yıllık maliyet oranı (YMO), erken kapama,
ek ödeme senaryosu ve iki teklifin karşılaştırılması.

### `fatura/` — fatura ve teklif
Tam sayı kuruş aritmetiği, satır ve genel iskonto (en büyük artık yöntemiyle
dağıtım), KDV tevkifatı, tutar yazıyla, VKN/TCKN ve IBAN sağlaması, belge
arşivi ve teklif→fatura dönüşümü.

## Testler

```
node bordro/test.js                 # %(bordro)d test
node bordro/cikis-test.js           # %(cikis)d test
node bordro/calisma-bicimi-test.js  # %(calisma)d test
node kredi/test.js                  # %(kredi)d test
node fatura/test.js                 # %(fatura)d test
node fatura/arsiv-test.js           # %(arsiv)d test
```

Toplam **%(toplam)d test**. Bordro tarafındaki en güçlü referans şudur: brüt
asgari ücret girildiğinde motorun ürettiği net, Asgari Ücret Tespit
Komisyonu'nun ilan ettiği resmî net asgari ücrete eşit olmalıdır. Bu, tarife +
SGK + istisna + damga zincirinin tamamını tek seferde doğrular ve kapsanan her
yıl için bağımsız bir kontrol noktasıdır.

## Metodoloji

Hesapların adım adım açıklaması, kullanılan yasal parametreler ve dayanaklar:

- [Bordro Motoru metodolojisi](https://korayoner.dev/bordro/)
- [Fatura Merkezi metodolojisi](https://korayoner.dev/fatura-olusturma/metodoloji/)

## Sürüm

Bordro Motoru **%(surum)s** · Kapsanan yıllar: %(yil_ilk)s-%(yil_son)s

## Lisans

MIT — bkz. [LICENSE](LICENSE).

Araçlar bilgilendirme amaçlıdır; mali müşavirlik, hukuki danışmanlık veya resmî
kurum görüşü yerine geçmez.
""" % {
        "bordro": sayilar["bordro"], "cikis": sayilar["cikis"],
        "calisma": sayilar["calisma"], "fatura": sayilar["fatura"],
        "kredi": sayilar["kredi"],
        "arsiv": sayilar["arsiv"], "toplam": toplam, "surum": surum(),
        "yil_ilk": min(yillar) if yillar else "?",
        "yil_son": max(yillar) if yillar else "?",
    }


def eksikler():
    """Cekirdekte olmasi gerekip de olmayan dosyalar."""
    yok = [k for k, _ in DOSYALAR if not os.path.exists(k)]
    return yok


def main():
    kontrol = "--check" in sys.argv

    yok = eksikler()
    if yok:
        print("Çekirdeğe girmesi gereken dosya bulunamadı:", file=sys.stderr)
        for k in yok:
            print("  - " + k, file=sys.stderr)
        return 1

    # Site, cekirdek deposuna dogru adresle baglaniyor mu?
    hatali = []
    for kok, _dizin, dosyalar in os.walk("."):
        if any(x in kok for x in (".git", "node_modules", "_cekirdek")):
            continue
        for d in dosyalar:
            if not d.endswith(".html"):
                continue
            p = os.path.join(kok, d).replace(os.sep, "/").lstrip("./")
            s = oku(p)
            if "github.com/onerkoray/onerkoray.github.io" in s:
                hatali.append(p)
    if hatali:
        print("Site hâlâ eski depo adresine bağlanıyor (%d sayfa);" % len(hatali),
              file=sys.stderr)
        print("çekirdek ayrı depoya taşındıysa bunlar %s olmalı:" % DEPO, file=sys.stderr)
        for p in hatali[:8]:
            print("  - " + p, file=sys.stderr)
        if len(hatali) > 8:
            print("  ... +%d sayfa daha" % (len(hatali) - 8), file=sys.stderr)
        return 1

    if "--liste" in sys.argv:
        print("Çekirdek deposu: " + DEPO)
        for kaynak, hedef in DOSYALAR:
            print("  %-34s -> %s" % (kaynak, hedef))
        return 0

    if kontrol:
        print("Çekirdek tutarlı (%d dosya, hedef %s)." % (len(DOSYALAR), DEPO))
        return 0

    if os.path.exists(CIKTI):
        shutil.rmtree(CIKTI)
    for kaynak, hedef in DOSYALAR:
        h = os.path.join(CIKTI, hedef)
        os.makedirs(os.path.dirname(h), exist_ok=True)
        # YOL_DUZELTME buraya kadar TANIMLIYDI AMA HIC UYGULANMIYORDU:
        # dosyalar duz kopyalaniyordu. Ev/kira cekirdegi eklenince ortaya
        # cikti -- pakette klasor adi "kredi", kaynakta "kredi-hesaplama"
        # oldugu icin paketlenmis test modulu bulamadi.
        icerik = io.open(kaynak, encoding="utf-8").read()
        for eski, yeni in YOL_DUZELTME:
            icerik = icerik.replace(eski, yeni)
        io.open(h, "w", encoding="utf-8", newline="").write(icerik)

    # Paketlenmis testler GERCEKTEN kosuyor mu? Yol duzeltmesi unutulursa
    # paket sessizce bozuk cikiyordu; artik burada yakalaniyor.
    for klasor in sorted(set(os.path.dirname(h) for _, h in DOSYALAR)):
        for dosya in sorted(os.listdir(os.path.join(CIKTI, klasor))):
            if not dosya.endswith("test.js"):
                continue
            yol = os.path.join(CIKTI, klasor, dosya)
            r = subprocess.run(["node", yol], capture_output=True)
            if r.returncode != 0:
                print("Paketlenmis test kosmuyor: %s/%s" % (klasor, dosya), file=sys.stderr)
                print(r.stderr.decode("utf-8", "replace")[:400], file=sys.stderr)
                return 1

    sayilar = test_sayilari()
    io.open(os.path.join(CIKTI, "README.md"), "w", encoding="utf-8", newline="").write(
        benioku(sayilar))
    io.open(os.path.join(CIKTI, "LICENSE"), "w", encoding="utf-8", newline="").write(LISANS)

    print("Çekirdek paketlendi: %s/ (%d dosya, %d test)" % (
        CIKTI, len(DOSYALAR) + 2, sum(sayilar.values())))
    print("Yükleme:")
    print("  cd %s && git init -b main && git add -A" % CIKTI)
    print("  git commit -m \"Hesap cekirdegi\"")
    print("  git remote add origin %s.git && git push -u origin main --force" % DEPO)
    return 0


if __name__ == "__main__":
    sys.exit(main())
