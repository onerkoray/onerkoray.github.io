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
import json
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
    ("makaleler/kredi-karti-asgari-odeme/kart.js", "kart-borcu/kart.js"),
    ("kredi-karti-borcu-hesaplama/hesap.js", "kart-borcu/hesap.js"),
    ("kredi-karti-borcu-hesaplama/test.js", "kart-borcu/test.js"),
    ("nakit-koprusu/hesap.js", "nakit-koprusu/hesap.js"),
    ("nakit-koprusu/test.js", "nakit-koprusu/test.js"),
    ("basabas-hesaplama/hesap.js", "basabas-hesaplama/hesap.js"),
    ("basabas-hesaplama/test.js", "basabas-hesaplama/test.js"),
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

    # Faz 1 ortak finans motorlari. Ayri araclarin ustune bindikleri icin
    # bunlarin acik olmasi, uzerlerindeki her aracin acik olmasi demek.
    ("finans/kurallar.js",                "finans/kurallar.js"),
    ("finans/test.js",                    "finans/test.js"),
    ("finans/zaman-motoru.js",            "finans/zaman-motoru.js"),
    ("finans/zaman-test.js",              "finans/zaman-test.js"),
    ("finans/enflasyon-motoru.js",        "finans/enflasyon-motoru.js"),
    ("finans/enflasyon-test.js",          "finans/enflasyon-test.js"),
    ("finans/dagitim-motor.js",           "finans/dagitim-motor.js"),
    ("finans/dagitim-test.js",            "finans/dagitim-test.js"),
    ("finans/erken-kapatma-motoru.js",    "finans/erken-kapatma-motoru.js"),
    ("finans/erken-kapatma-test.js",      "finans/erken-kapatma-test.js"),
    ("finans/nakit-akisi-motoru.js",      "finans/nakit-akisi-motoru.js"),
    ("finans/nakit-akisi-test.js",        "finans/nakit-akisi-test.js"),
    ("finans/sankey.js",                  "finans/sankey.js"),
    ("finans/kisisel-enflasyon-motoru.js", "finans/kisisel-enflasyon-motoru.js"),
    ("finans/kisisel-enflasyon-test.js",  "finans/kisisel-enflasyon-test.js"),

    # Finansal Ikiz omurgasi: profil (veri katmani) ve yasam boyu
    # projeksiyon. Uzerlerine binen her sey bunlara bagli.
    ("finans/profil.js",                  "finans/profil.js"),
    ("finans/profil-test.js",             "finans/profil-test.js"),
    ("finans/ikiz-motoru.js",             "finans/ikiz-motoru.js"),
    ("finans/ikiz-test.js",               "finans/ikiz-test.js"),
    ("finans/hedef-motoru.js",            "finans/hedef-motoru.js"),
    ("finans/hedef-test.js",              "finans/hedef-test.js"),
    ("finans/karar-motoru.js",            "finans/karar-motoru.js"),
    ("finans/karar-test.js",              "finans/karar-test.js"),
    ("finans/bant.js",                    "finans/bant.js"),

    # Kopru: araclarin Ikiz profilinden OKUMASI. Tek yonlu.
    ("finans/profil-kopru.js",            "finans/profil-kopru.js"),
    ("finans/profil-kopru-test.js",       "finans/profil-kopru-test.js"),

    # Sifre uretimi: kriptografik rastgelelik, entropi ve kirilma suresi.
    ("keymint/sifre-motoru.js",           "keymint/sifre-motoru.js"),
    ("keymint/sifre-test.js",             "keymint/sifre-test.js"),

    ("bordro/emeklilik-parametreleri.js", "bordro/emeklilik-parametreleri.js"),
    ("bordro/emeklilik-motor.js",         "bordro/emeklilik-motor.js"),
    ("bordro/emeklilik-test.js",          "bordro/emeklilik-test.js"),
    ("bordro/gmsi-motor.js",              "bordro/gmsi-motor.js"),
    ("bordro/gmsi-test.js",               "bordro/gmsi-test.js"),
    ("bordro/borc-parametreleri.js",      "bordro/borc-parametreleri.js"),
    ("bordro/borc-motor.js",              "bordro/borc-motor.js"),
    ("bordro/borc-test.js",               "bordro/borc-test.js"),
    ("bordro/ek-odeme-motoru.js",         "bordro/ek-odeme-motoru.js"),
    ("bordro/ek-odeme-test.js",           "bordro/ek-odeme-test.js"),
]

# Cekirdekteki dosyalar birbirini goreli yolla cagiriyor; klasor yapisi
# degistigi icin bu yollar duzeltilmeli.
YOL_DUZELTME = [
    ("../makaleler/kredi-karti-asgari-odeme/kart.js", "./kart.js"),
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
                    ("arsiv", "fatura-olusturma/arsiv-test.js"),
                    ("finans", "finans/test.js"),
                    ("zaman", "finans/zaman-test.js"),
                    ("enflasyon", "finans/enflasyon-test.js"),
                    ("dagitim", "finans/dagitim-test.js"),
                    ("erken-kapatma", "finans/erken-kapatma-test.js"),
                    ("emeklilik", "bordro/emeklilik-test.js"),
                    ("gmsi", "bordro/gmsi-test.js"),
                    ("borc", "bordro/borc-test.js"),
                    ("ek-odeme", "bordro/ek-odeme-test.js"),
                    ("nakit-akisi", "finans/nakit-akisi-test.js"),
                    ("kisisel-enflasyon", "finans/kisisel-enflasyon-test.js"),
                    ("profil", "finans/profil-test.js"),
                    ("ikiz", "finans/ikiz-test.js"),
                    ("hedef", "finans/hedef-test.js"),
                    ("karar", "finans/karar-test.js"),
                    ("kopru", "finans/profil-kopru-test.js"),
                    ("sifre", "keymint/sifre-test.js")):
        try:
            r = subprocess.run(["node", yol], capture_output=True, timeout=120)
            cikti = r.stdout.decode("utf-8", "replace")
            # Desen GENISLETILDI. Eskisi tam olarak "N gecti" ariyordu ve
            # dokuz test dosyasi sessizce 0 sayiliyordu: bazilari hic sayi
            # yazmiyordu, finans/test.js ise "N finans regresyon senaryosu
            # gecti" yaziyordu. README "toplam X test" diye bir IDDIA kurdugu
            # icin bu, dogrulanmamis bir sayi demekti.
            # Simdi araya soz giren bicimler ve ASCII "gecti" de kabul
            # ediliyor; son eslesme alininiyor (ozet satiri en sonda).
            m = re.findall(r"(\d+)[^\n]{0,60}?ge[çc]ti", cikti)
            sonuc[ad] = int(m[-1]) if m else 0
            if not m:
                print("UYARI: %s test sayisi okunamadi." % yol, file=sys.stderr)
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

> **In English** — Payroll and tax calculation core for Turkish
> legislation: gross-to-net salary, severance and notice pay, pension,
> rental income tax, credit cost and more. No dependencies, no build
> step; the same code runs in the browser and in Node.js. Legal
> parameters are kept in one place per year and pinned by %(toplam)s
> tests. MIT licensed.

## Kurulum

```bash
npm install hesap-cekirdegi
```

Kurulum şart değil: dosyalar bağımlılıksız ve tek başına çalışır,
doğrudan indirip `<script>` ile de kullanabilirsiniz.

## Kullanım

```js
const Bordro = require("hesap-cekirdegi/bordro/motor.js");

const yil = Bordro.hesaplaYil(60000, 2026);   // 60.000 TL brüt, 2026
yil.aylar[0].net;        // Ocak neti
yil.aylar[11].net;       // Aralık neti — kümülatif vergi yüzünden daha düşük
yil.aylar[0].isverenMaliyeti;
```

Diğer alanlar aynı biçimde çağrılır:

```js
const Cikis = require("hesap-cekirdegi/bordro/cikis.js");      // kıdem, ihbar
const Gmsi  = require("hesap-cekirdegi/bordro/gmsi-motor.js"); // kira geliri
const Kredi = require("hesap-cekirdegi/kredi/hesap.js");       // kredi maliyeti
```

Tarayıcıda `<script>` ile yüklendiğinde aynı modüller `window` üzerinde
durur (`window.Bordro`, `window.BordroCikis`, ...).

## Testler

```bash
npm test          # paketteki bütün testler
node bordro/test.js   # tek bir paket
```

Testler bir bağımlılık kullanmaz; çıplak `node` ile koşar.

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

### `finans/` — ortak finans motorlari
Paranin zaman degeri (NPV, IRR, XNPV, XIRR, CAGR, annuite, amortisman),
enflasyon donusumleri (reel/nominal bolme yontemiyle, satin alma gucu),
marjinal nakit dagitimi ve kredi erken kapatma karari (TKHK m.27 ve m.37
tazminat kurallariyla). Ustlerindeki araclar bu motorlari paylasiyor;
ikinci bir uygulama yazilmiyor.

### `finansal-ikiz/` — yasam boyu projeksiyon
Finansal profilin sema ve dogrulama katmani (profil.js) ile ay ay yurutup
yil yil raporlayan projeksiyon motoru (ikiz-motoru.js). Belirsizlik
dagilim varsayilarak degil, UC ISIMLI SENARYOYLA temsil ediliyor;
varsayimlarin sahibi model degil kullanici. Ucret vergisi icin tarifenin
enflasyonla endekslendigi varsayiliyor ve bu varsayim motorun basinda
acikca yazili.

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
node finans/test.js                 # %(finans)d test
node finans/zaman-test.js           # %(zaman)d test
node finans/enflasyon-test.js       # %(enflasyon)d test
node finans/dagitim-test.js         # %(dagitim)d test
node finans/erken-kapatma-test.js   # %(erken_kapatma)d test
node bordro/emeklilik-test.js       # %(emeklilik)d test
node bordro/gmsi-test.js            # %(gmsi)d test
node bordro/borc-test.js            # %(borc)d test
node bordro/ek-odeme-test.js        # %(ek_odeme)d test
node finans/nakit-akisi-test.js     # %(nakit_akisi)d test
node finans/kisisel-enflasyon-test.js # %(kisisel)d test
node finans/profil-test.js          # %(profil)d test
node finans/ikiz-test.js            # %(ikiz)d test
node finans/hedef-test.js           # %(hedef)d test
node finans/karar-test.js           # %(karar)d test
node finans/profil-kopru-test.js    # %(kopru)d test
node keymint/sifre-test.js          # %(sifre)d test
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
        "finans": sayilar["finans"], "zaman": sayilar["zaman"],
        "enflasyon": sayilar["enflasyon"], "dagitim": sayilar["dagitim"],
        "erken_kapatma": sayilar["erken-kapatma"],
        "emeklilik": sayilar["emeklilik"], "gmsi": sayilar["gmsi"],
        "borc": sayilar["borc"], "ek_odeme": sayilar["ek-odeme"],
        "nakit_akisi": sayilar["nakit-akisi"],
        "kisisel": sayilar["kisisel-enflasyon"],
        "profil": sayilar["profil"], "ikiz": sayilar["ikiz"],
        "hedef": sayilar["hedef"], "karar": sayilar["karar"],
        "kopru": sayilar["kopru"],
        "sifre": sayilar["sifre"],
        "yil_ilk": min(yillar) if yillar else "?",
        "yil_son": max(yillar) if yillar else "?",
    }


def paket_json(sayilar):
    """npm paketi tanimi.

    SURUM ELLE YAZILMAZ: bordro/motor.js'teki surum alanindan okunur. Iki
    yerde tutulan bir surum numarasi sessizce ayrisir ve npm'deki paket ile
    depodaki kod farkli seyler soylemeye baslar.

    `exports` joker: moduller birbirini "./motor.js" gibi UZANTIYLA
    cagiriyor; tuketici de ayni yolu yazabilsin diye yol oldugu gibi
    aciliyor.
    """
    klasorler = sorted(set(os.path.dirname(h) for _, h in DOSYALAR))
    d = {
        "name": "hesap-cekirdegi",
        "version": surum(),
        "description": (
            "Turkiye mevzuatina gore bordro, tazminat, emeklilik, kira geliri, "
            "vergi ve kredi hesaplari. Bagimliliksiz; tarayicida ve Node.js'te "
            "ayni kodla calisir. Payroll and tax calculation core for Turkish "
            "legislation - dependency-free and test-pinned."
        ),
        "keywords": [
            "turkey", "turkiye", "payroll", "bordro", "maas", "salary",
            "tax", "vergi", "sgk", "kidem-tazminati", "severance",
            "gelir-vergisi", "income-tax", "kredi", "finance", "turkish",
        ],
        "license": "MIT",
        "author": "Koray Oner (https://korayoner.dev/)",
        "homepage": "https://korayoner.dev/bordro/",
        "repository": {"type": "git", "url": "git+%s.git" % DEPO},
        "bugs": {"url": "%s/issues" % DEPO},
        "type": "commonjs",
        "exports": {"./package.json": "./package.json", "./*": "./*"},
        "files": klasorler + ["README.md", "LICENSE", "test-all.js"],
        "scripts": {"test": "node test-all.js"},
        "engines": {"node": ">=12"},
    }
    return json.dumps(d, ensure_ascii=False, indent=2) + "\n"


KOSUCU = r'''#!/usr/bin/env node
/*!
 * Pakette bulunan BUTUN testleri kosar.   node test-all.js
 *
 * Tek komut olmasinin sebebi: bu paket bir AYNA, site deposundan
 * uretiliyor. Uretim sirasinda bir yol duzeltmesi atlanirsa paket
 * sessizce bozuk cikabiliyor. Tuketici de katkici da tek komutla
 * butunun saglam oldugunu gorebilmeli.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

function bul(dizin, out) {
  fs.readdirSync(dizin, { withFileTypes: true }).forEach(function (d) {
    var p = path.join(dizin, d.name);
    if (d.isDirectory()) { if (d.name !== "node_modules") bul(p, out); }
    else if (/test\.js$/.test(d.name)) out.push(p);
  });
  return out;
}

var dosyalar = bul(__dirname, []).sort();
var kalan = 0;
dosyalar.forEach(function (p) {
  var ad = path.relative(__dirname, p).split(path.sep).join("/");
  var r = cp.spawnSync(process.execPath, [p], { encoding: "utf8" });
  var son = (r.stdout || "").trim().split("\n").pop() || "";
  if (r.status !== 0) {
    kalan++;
    console.log("  BASARISIZ  " + ad);
    console.log((r.stderr || r.stdout || "").trim().split("\n").slice(-6)
      .map(function (x) { return "      " + x; }).join("\n"));
  } else {
    while (ad.length < 42) { ad += " "; }
    console.log("  tamam      " + ad + son);
  }
});
console.log("\n" + dosyalar.length + " test dosyasi, " + kalan + " basarisiz.");
process.exit(kalan ? 1 : 0);
'''


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

    # .git KORUNUR. Bu dizin artik gercek bir depo: uzak adresi, gecmisi
    # ve npm surum etiketleri orada duruyor. Dizinin tamamini silmek o
    # gecmisi sessizce yok ediyordu -- yeniden kurulan dizin tertemiz
    # gorunur, yalnizca bir daha push edilemez. Icerik silinir, .git kalir.
    if os.path.exists(CIKTI):
        for ad in os.listdir(CIKTI):
            if ad == ".git":
                continue
            yol = os.path.join(CIKTI, ad)
            shutil.rmtree(yol) if os.path.isdir(yol) else os.remove(yol)
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
    # package.json ve test kosucusu da URETILIYOR, elle konmuyor: bu
    # dizin her kosuda silinip yeniden kuruluyor, elle konan dosya
    # ilk senkronda kaybolurdu.
    io.open(os.path.join(CIKTI, "package.json"), "w", encoding="utf-8",
            newline="").write(paket_json(sayilar))
    io.open(os.path.join(CIKTI, "test-all.js"), "w", encoding="utf-8",
            newline="").write(KOSUCU)

    print("Çekirdek paketlendi: %s/ (%d dosya, %d test)" % (
        CIKTI, len(DOSYALAR) + 4, sum(sayilar.values())))
    # Depo ARTIK VAR; ilk kurulum talimati yaniltici olurdu (git init
    # mevcut gecmisi gormezden gelir). Anlatilan sey senkron.
    print("Yayımlamak için (%s):" % DEPO)
    print("  cd %s && git add -A && git commit -m \"...\" && git push" % CIKTI)
    print("  npm publish            # surum: package.json (motor.js'ten turer)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
