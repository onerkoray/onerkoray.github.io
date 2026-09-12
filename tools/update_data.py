#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resmi kaynaklardan veri cekip statik sayfalari YENIDEN URETIR.

Neden derleme zamaninda? Veriyi tarayicida cekmek SEO acisindan degersizdir:
arama motoru bos bir kabuk gorur. Burada uretilen veri HTML'in icine gomulur,
boylece hem indekslenir hem de dateModified gercek bir tazelik sinyali verir.

Kullanim:
    python tools/update_data.py            # sayfalari uret
    python tools/update_data.py --check    # sadece kaynaklari test et, yazma

GitHub Actions bunu gunluk calistirir; icerik degistiyse commit atar.
"""

import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://korayoner.dev"
UA = "Mozilla/5.0 (compatible; korayoner.dev/1.0; +https://korayoner.dev/)"

TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"

# Sayfada gosterilecek para birimleri (TCMB kodu -> gorunen ad)
SHOW = [
    ("USD", "ABD Doları"),
    ("EUR", "Euro"),
    ("GBP", "İngiliz Sterlini"),
    ("CHF", "İsviçre Frangı"),
    ("JPY", "Japon Yeni"),
    ("CAD", "Kanada Doları"),
    ("AUD", "Avustralya Doları"),
    ("SAR", "Suudi Riyali"),
    ("RUB", "Rus Rublesi"),
    ("CNY", "Çin Yuanı"),
]

AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def tr_sayi(x, basamak=4):
    """1234.5678 -> '1.234,5678' (Turkce sayi bicimi)"""
    s = ("%%.%df" % basamak) % x
    tam, _, kesir = s.partition(".")
    neg = tam.startswith("-")
    tam = tam.lstrip("-")
    parcali = ""
    while len(tam) > 3:
        parcali = "." + tam[-3:] + parcali
        tam = tam[:-3]
    out = tam + parcali + ("," + kesir if kesir else "")
    return ("-" if neg else "") + out


def tcmb_kurlar():
    """TCMB gunluk bultenini cozer. Doner: (tarih_iso, tarih_metin, [kayitlar])"""
    root = ET.fromstring(fetch(TCMB_URL))
    tarih = root.attrib.get("Tarih", "")           # 04.09.2026
    g, a, y = tarih.split(".")
    tarih_iso = "%s-%s-%s" % (y, a, g)
    tarih_metin = "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)

    bulunan = {}
    for cur in root.findall("Currency"):
        kod = cur.attrib.get("Kod")
        if kod not in dict(SHOW):
            continue

        def val(tag):
            el = cur.find(tag)
            if el is None or not (el.text or "").strip():
                return None
            return float(el.text.strip())

        birim = int((cur.findtext("Unit") or "1").strip())
        alis = val("ForexBuying") or val("BanknoteBuying")
        satis = val("ForexSelling") or val("BanknoteSelling")
        if alis is None or satis is None:
            continue
        # Birim 100 olan kurlari (JPY gibi) 1 birime normalize et
        bulunan[kod] = {"alis": alis / birim, "satis": satis / birim, "birim": birim}

    kayitlar = [(k, ad, bulunan[k]) for k, ad in SHOW if k in bulunan]
    if not kayitlar:
        raise RuntimeError("TCMB bulteninden hic kur cozulemedi")
    return tarih_iso, tarih_metin, kayitlar


# ---------------------------------------------------------------- gecmis seri
#
# NEDEN ARSIV BULTENI, EVDS DEGIL: TCMB'nin EVDS servisi API anahtari ister;
# anahtar derleme ortaminda bir sir olarak yasamak zorunda kalir ve anahtar
# donerse/suresi biterse sayfa sessizce eskir. Gunluk arsiv bultenleri
# (kurlar/YYYYMM/DDMMYYYY.xml) ayni resmi veriyi anahtarsiz veriyor.
# Hafta sonu ve resmi tatillerde 404 doner; bu hata degil, o gun bulten
# yayimlanmadigi anlamina gelir ve sessizce atlanir.
#
# Seri dosyaya YAZILIR ve commit edilir: boylece grafik derleme aninda
# HTML'e gomulu uretilir, ziyaretcinin tarayicisi hicbir gecmis veri
# cekmez ve arama motoru grafigi veriyle birlikte gorur.

SERI_YOL = os.path.join(ROOT, "doviz-kurlari", "seri.json")
SERI_GUN = 90          # kac takvim gunu geriye bakilir
SERI_PARA = ["USD", "EUR"]   # grafigi cizilen para birimleri


def _arsiv_gun(d):
    """Tek bir gunun bultenini cozer. Bulten yoksa None doner (hata degil)."""
    url = "https://www.tcmb.gov.tr/kurlar/%s/%s.xml" % (d.strftime("%Y%m"), d.strftime("%d%m%Y"))
    try:
        root = ET.fromstring(fetch(url, timeout=20))
    except Exception:
        return None
    cikti = {}
    for c in root.findall("Currency"):
        kod = c.get("CurrencyCode")
        if kod not in SERI_PARA:
            continue
        ham = (c.findtext("ForexSelling") or "").strip()
        birim = (c.findtext("Unit") or "1").strip()
        try:
            deger = float(ham) / float(birim or 1)
        except (TypeError, ValueError):
            continue
        cikti[kod] = round(deger, 4)
    return cikti or None


def seri_guncelle(bugun=None):
    """Eksik gunleri tamamlar ve seriyi dosyaya yazar. Doner: kayit listesi."""
    bugun = bugun or dt.date.today()
    try:
        with io.open(SERI_YOL, encoding="utf-8") as f:
            kayitlar = json.load(f).get("kayitlar", [])
    except (IOError, OSError, ValueError):
        kayitlar = []

    var_olan = set(k["tarih"] for k in kayitlar)
    baslangic = bugun - dt.timedelta(days=SERI_GUN)
    eklenen = 0
    d = baslangic
    while d <= bugun:
        iso = d.isoformat()
        # Hafta sonu bulten yok; bos istek atmayalim.
        if d.weekday() >= 5 or iso in var_olan:
            d += dt.timedelta(days=1)
            continue
        veri = _arsiv_gun(d)
        if veri and all(k in veri for k in SERI_PARA):
            kayitlar.append(dict(tarih=iso, **veri))
            eklenen += 1
            time.sleep(0.15)   # TCMB'ye karsi nazik ol
        d += dt.timedelta(days=1)

    # Pencere disina dusenleri at, sirala
    kayitlar = [k for k in kayitlar if k["tarih"] >= baslangic.isoformat()]
    kayitlar.sort(key=lambda k: k["tarih"])

    with io.open(SERI_YOL, "w", encoding="utf-8") as f:
        json.dump({"guncelleme": bugun.isoformat(), "kaynak": "TCMB gunluk bulten",
                   "aciklama": "Doviz satis kuru, 1 birim karsiligi TL.",
                   "kayitlar": kayitlar}, f, ensure_ascii=False, indent=1)
    return kayitlar, eklenen


# -------------------------------------------------------------------- altin
#
# TCMB altin YAYIMLAMIYOR: gunluk bultende yalnizca doviz var (22 para birimi
# + XDR). Gram altin serbest piyasa fiyatidir, resmi bir kur degildir; bu
# yuzden sayfada ayri bir bolumde ve "serbest piyasa" etiketiyle duruyor.
#
# Kaynak ucuncu taraf ve CORS'a acik (Access-Control-Allow-Origin: *), yani
# ayni veri hem derlemede hem tarayicida kullanilabiliyor. Hibrit kurulum
# bundan cikiyor: derlemede HTML'e gomuluyor (indekslenir), tarayicida
# tazeleniyor (gun ici hareket gorunur).
#
# HATA TOLERANSI: bu kaynak bizim degil. Cekilemezse derleme KIRILMAZ; son
# bilinen degerler dosyadan okunup kullanilir ve tazelik damgasi eski kalir.
# Aksi halde ucuncu tarafin kesintisi bizim gunluk veri akisimizi durdururdu
# - 9-11 Eylul'de yasanan sessiz durusun aynisi.

ALTIN_URL = "https://finans.truncgil.com/v4/today.json"
ALTIN_YOL = os.path.join(ROOT, "doviz-kurlari", "altin.json")
ALTIN_GOSTER = [
    ("GRA", "Gram altın"),
    ("CEYREKALTIN", "Çeyrek altın"),
    ("YARIMALTIN", "Yarım altın"),
    ("TAMALTIN", "Tam altın"),
    ("CUMHURIYETALTINI", "Cumhuriyet altını"),
    ("GUMUS", "Gümüş (gram)"),
]


def altin_verisi():
    """Serbest piyasa altin fiyatlarini ceker. Basarisiz olursa son bilinen
    veriyi dosyadan doner. Doner: (sozluk, tazelik_metni, taze_mi)."""
    try:
        ham = json.loads(fetch(ALTIN_URL, timeout=20).decode("utf-8"))
        cikti = {}
        for kod, ad in ALTIN_GOSTER:
            v = ham.get(kod) or {}
            satis = v.get("Selling")
            if not isinstance(satis, (int, float)) or satis <= 0:
                continue
            cikti[kod] = {
                "ad": ad,
                "alis": v.get("Buying") if isinstance(v.get("Buying"), (int, float)) else None,
                "satis": float(satis),
                "degisim": v.get("Change") if isinstance(v.get("Change"), (int, float)) else None,
            }
        if not cikti:
            raise RuntimeError("altin kalemi cozulemedi")
        paket = {"guncelleme": ham.get("Update_Date") or "",
                 "cekildi": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
                 "kaynak": ALTIN_URL, "kalemler": cikti}
        with io.open(ALTIN_YOL, "w", encoding="utf-8") as f:
            json.dump(paket, f, ensure_ascii=False, indent=1)
        return cikti, paket["guncelleme"], True
    except Exception as e:
        print("UYARI: altin verisi cekilemedi (%s); son bilinen deger kullanilacak" % e,
              file=sys.stderr)
        try:
            with io.open(ALTIN_YOL, encoding="utf-8") as f:
                paket = json.load(f)
            return paket.get("kalemler", {}), paket.get("guncelleme", ""), False
        except (IOError, OSError, ValueError):
            return {}, "", False


# ------------------------------------------------------------------- grafik
#
# Satir ici SVG, renkleri CSS degiskeninden aliyor: tek dosyada iki tema.
# Tek serili cizgi oldugu icin lejant yok - baslik zaten seriyi adlandiriyor
# (dataviz: ">=2 seri icin lejant, tek seride yok"). Cizgi 2px, izgara
# geri planda, etiketler SECICI: ilk, son, en dusuk ve en yuksek nokta.
# Her noktaya sayi yazmak grafigi tabloya cevirir.
#
# Olcek sifirdan BASLAMIYOR ve bu bilincli: kur serisinde sifir anlamsiz bir
# taban, %5'lik hareketi gorunmez yapardi. Bunu gizlememek icin y ekseninin
# alt ve ust degeri her zaman yaziliyor ve altyazida belirtiliyor.

CIZIM = dict(g=620, y=190, sol=52, sag=64, ust=18, alt=26)


def _svg_kacis(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def cizgi_svg(kayitlar, kod, ad, ek_id):
    """Tek serili cizgi grafik uretir. Doner: (svg_metni, ozet_sozluk)."""
    C = CIZIM
    nokta = [(k["tarih"], k[kod]) for k in kayitlar if kod in k]
    if len(nokta) < 3:
        return "", {}
    degerler = [v for _, v in nokta]
    dip, tepe = min(degerler), max(degerler)
    pay = (tepe - dip) or (tepe * 0.01) or 1.0
    lo, hi = dip - pay * 0.18, tepe + pay * 0.18
    ic_g = C["g"] - C["sol"] - C["sag"]
    ic_y = C["y"] - C["ust"] - C["alt"]

    def X(i):
        return C["sol"] + (ic_g * i / (len(nokta) - 1))

    def Y(v):
        return C["ust"] + ic_y * (1 - (v - lo) / (hi - lo))

    d = " ".join(("M" if i == 0 else "L") + "%.1f %.1f" % (X(i), Y(v))
                 for i, (_, v) in enumerate(nokta))
    alan = d + " L%.1f %.1f L%.1f %.1f Z" % (X(len(nokta) - 1), C["ust"] + ic_y, C["sol"], C["ust"] + ic_y)

    i_dip = degerler.index(dip)
    i_tepe = degerler.index(tepe)
    # Etiket cakismasi: iki isaretli nokta yatayda birbirine cok yakinsa
    # etiketleri ust uste biner. Onem sirasina gore yerlestirilir ve sigmayan
    # atlanir - nokta yine cizilir, yalnizca sayisi yazilmaz. Son deger en
    # onemlisi; ardindan ilk, sonra uc degerler gelir.
    ETIKET_ARALIK = 52.0
    yerlesen = []
    for i in (len(nokta) - 1, 0, i_tepe, i_dip):
        if i in yerlesen:
            continue
        if any(abs(X(i) - X(j)) < ETIKET_ARALIK for j in yerlesen):
            continue
        yerlesen.append(i)
    isaretli = sorted(set([0, len(nokta) - 1, i_dip, i_tepe]))

    def gun_ay(iso):
        y, m, g = iso.split("-")
        return "%d %s" % (int(g), AYLAR[int(m) - 1][:3])

    izgara = "".join(
        '<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (C["sol"], Y(v), C["g"] - C["sag"], Y(v))
        for v in (lo + (hi - lo) * f for f in (0.08, 0.5, 0.92)))

    # Eksen ucuna SENTETIK sinir yazilmiyor: lo/hi yalnizca cizim payi icin
    # uretilmis, veride karsiligi olmayan sayilar. Onceki surumde "45,67" gibi
    # hic gerceklesmemis bir kur eksende duruyordu. Gercek uc degerler zaten
    # dip/tepe noktalarinda dogrudan etiketli ve altyazida yaziyor.
    eksen = ""

    im = []
    for i in isaretli:
        iso, v = nokta[i]
        x, y = X(i), Y(v)
        ucta = i == len(nokta) - 1
        im.append('<circle cx="%.1f" cy="%.1f" r="%s" class="dk-nokta%s"/>' % (
            x, y, "4.5" if ucta else "3.5", " dk-son" if ucta else ""))
        if i not in yerlesen:
            continue
        hiza = "end" if ucta else ("start" if i == 0 else "middle")
        dx = -8 if ucta else (8 if i == 0 else 0)
        # Etiket, cizginin gittigi yonun TERSINE konuyor. Sabit bir kural
        # ("ustteyse yukari yaz") uc noktalarda etiketi cizginin uzerine
        # bindiriyordu: EUR serisinde ilk nokta asagi iniyor ve altina
        # yazilan sayi cizgiyle kesisiyordu.
        if i == 0:
            yukari = nokta[1][1] <= v
        elif ucta:
            yukari = nokta[-2][1] <= v
        else:
            yukari = i == i_tepe
        dy = -11 if yukari else 17
        im.append('<text x="%.1f" y="%.1f" text-anchor="%s" class="dk-etiket">%s</text>' % (
            x + dx, y + dy, hiza, tr_sayi(v, 2)))
    im = "".join(im)

    tarihler = ('<text x="%d" y="%d" class="dk-eksen">%s</text>'
                '<text x="%d" y="%d" text-anchor="end" class="dk-eksen">%s</text>') % (
        C["sol"], C["y"] - 6, gun_ay(nokta[0][0]), C["g"] - C["sag"], C["y"] - 6, gun_ay(nokta[-1][0]))

    ilk, son = degerler[0], degerler[-1]
    yuzde = (son / ilk - 1) * 100 if ilk else 0
    ozet = dict(ilk=ilk, son=son, dip=dip, tepe=tepe, yuzde=yuzde,
                bas=nokta[0][0], bit=nokta[-1][0], adet=len(nokta))
    yon = "yükseldi" if son >= ilk else "geriledi"
    desc = ("%s satış kuru %s – %s arasında %s TL'den %s TL'ye %s; "
            "dönem değişimi %%%s. En düşük %s TL, en yüksek %s TL. "
            "Ölçek sıfırdan başlamaz." % (
                ad, gun_ay(nokta[0][0]), gun_ay(nokta[-1][0]),
                tr_sayi(ilk, 4), tr_sayi(son, 4), yon, tr_sayi(abs(yuzde), 2),
                tr_sayi(dip, 4), tr_sayi(tepe, 4)))

    svg = ('<svg class="dk-grafik" viewBox="0 0 %d %d" role="img" '
           'aria-labelledby="%s-b %s-a">'
           '<title id="%s-b">%s/TL son %d iş günü</title>'
           '<desc id="%s-a">%s</desc>'
           '<g class="dk-izgara">%s</g>'
           '<path class="dk-alan" d="%s"/>'
           '<path class="dk-cizgi" d="%s"/>'
           '%s%s%s</svg>') % (
        C["g"], C["y"], ek_id, ek_id, ek_id, kod, len(nokta), ek_id,
        _svg_kacis(desc), izgara, alan, d, eksen, tarihler, im)
    return svg, ozet


PAGE = """<!DOCTYPE html>
<html lang="tr" data-theme="auto">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2GNZPW1LPT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-2GNZPW1LPT');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TCMB Döviz Kurları — {tarih_metin} | Koray Öner</title>
  <meta name="description" content="{tarih_metin} tarihli TCMB resmî döviz kurları: dolar {usd_satis} TL, euro {eur_satis} TL. Merkez Bankası efektif alış ve satış kurları, her iş günü güncellenir.">
  <meta name="author" content="Koray Öner">
  <link rel="author" href="https://github.com/onerkoray">
  <meta name="theme-color" content="#0e7c66" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0b0d10" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="{site}/doviz-kurlari/">

  <link rel="icon" href="../favicon.ico?v=2" sizes="32x32">
  <link rel="icon" href="../favicon.svg?v=2" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png?v=2">
  <link rel="alternate" type="application/atom+xml" title="Koray Öner — Yeni Araçlar" href="../atom.xml">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Koray Öner">
  <meta property="og:title" content="TCMB Döviz Kurları — {tarih_metin}">
  <meta property="og:description" content="Merkez Bankası resmî döviz kurları, her iş günü güncellenir. Dolar {usd_satis} TL, euro {eur_satis} TL.">
  <meta property="og:url" content="{site}/doviz-kurlari/">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:image" content="{site}/images/doviz-kurlari-koray-oner.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="TCMB Döviz Kurları — {tarih_metin}">
  <meta name="twitter:image" content="{site}/images/doviz-kurlari-koray-oner.png">

  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="grafik.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "WebSite",
        "@id": "{site}/#website",
        "url": "{site}/",
        "name": "Koray Öner",
        "alternateName": "korayoner.dev",
        "inLanguage": "tr",
        "publisher": {{ "@id": "{site}/#oner-koray" }}
      }},
      {{
        "@type": "WebPage",
        "@id": "{site}/doviz-kurlari/#webpage",
        "url": "{site}/doviz-kurlari/",
        "name": "TCMB Döviz Kurları — {tarih_metin}",
        "description": "Türkiye Cumhuriyet Merkez Bankası resmî döviz kurları, her iş günü güncellenir.",
        "inLanguage": "tr",
        "datePublished": "2026-09-04",
        "dateModified": "{tarih_iso}",
        "isPartOf": {{ "@id": "{site}/#website" }},
        "publisher": {{ "@id": "{site}/#oner-koray" }},
        "breadcrumb": {{ "@id": "{site}/doviz-kurlari/#breadcrumb" }}
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{site}/doviz-kurlari/#breadcrumb",
        "itemListElement": [
          {{ "@type": "ListItem", "position": 1, "name": "Ana Sayfa", "item": "{site}/" }},
          {{ "@type": "ListItem", "position": 2, "name": "TCMB Döviz Kurları", "item": "{site}/doviz-kurlari/" }}
        ]
      }},
      {{
        "@type": "Dataset",
        "@id": "{site}/doviz-kurlari/#dataset",
        "name": "TCMB günlük döviz kurları",
        "description": "Türkiye Cumhuriyet Merkez Bankası tarafından her iş günü yayımlanan gösterge niteliğindeki döviz alış ve satış kurları.",
        "inLanguage": "tr",
        "dateModified": "{tarih_iso}",
        "isAccessibleForFree": true,
        "creator": {{ "@id": "{site}/#oner-koray" }},
        "temporalCoverage": "{tarih_iso}",
        "license": "https://www.tcmb.gov.tr/"
      }},
      {{
        "@type": "Person",
        "@id": "{site}/#oner-koray",
        "name": "Koray Öner",
        "url": "{site}/"
      }},
      {{
        "@type": "FAQPage",
        "@id": "{site}/doviz-kurlari/#faq",
        "mainEntity": [
          {{ "@type": "Question", "name": "TCMB kuru ne sıklıkla güncellenir?",
            "acceptedAnswer": {{ "@type": "Answer", "text": "Merkez Bankası gösterge niteliğindeki kurları her iş günü saat 15.30 civarında yayımlar. Hafta sonu ve resmî tatillerde yeni bülten yayımlanmaz; son iş gününün kuru geçerli kalır." }} }},
          {{ "@type": "Question", "name": "Efektif kur ile döviz kuru arasındaki fark nedir?",
            "acceptedAnswer": {{ "@type": "Answer", "text": "Döviz kuru hesaptan hesaba yapılan transferlerde, efektif kur ise nakit alım satımda kullanılır. Efektif kur genellikle nakit taşıma maliyeti nedeniyle bir miktar farklıdır." }} }},
          {{ "@type": "Question", "name": "Bu kurlar bankaların uyguladığı kur mudur?",
            "acceptedAnswer": {{ "@type": "Answer", "text": "Hayır. TCMB kuru gösterge niteliğindedir ve resmî işlemlerde esas alınır. Bankalar ve döviz büroları kendi alış satış kurlarını uygular; bu kurlar TCMB kurundan farklı olabilir." }} }},
          {{ "@type": "Question", "name": "Gümrük vergisi hesabında hangi kur kullanılır?",
            "acceptedAnswer": {{ "@type": "Answer", "text": "Gümrük işlemlerinde, eşyanın gümrük beyannamesinin tescil edildiği tarihte geçerli olan TCMB döviz satış kuru esas alınır." }} }}
        ]
      }}
    ]
  }}
  </script>
</head>
<body>
  <a class="skip-link" href="#main">İçeriğe geç</a>

  <header class="site-header" role="banner">
    <div class="wrap header-inner">
      <a class="brand" href="../" aria-label="Koray Öner ana sayfa">
        <img class="brand-mark" src="../logo.svg" width="32" height="32" alt="" aria-hidden="true">
        <span class="brand-name">Koray Öner</span>
      </a>
      <nav class="site-nav" aria-label="Birincil">
        <ul>
          <li><a href="../">Ana Sayfa</a></li>
          <li><a href="#kurlar">Kurlar</a></li>
          <li><a href="#sss">SSS</a></li>
        </ul>
      </nav>
      <button class="theme-toggle" type="button" id="themeToggle" aria-label="Temayı değiştir">
        <span class="theme-toggle-icon" aria-hidden="true"></span>
        <span class="theme-toggle-label">Tema</span>
      </button>
    </div>
  </header>

  <main id="main">
    <nav class="breadcrumb wrap" aria-label="Site haritası">
      <a href="../">Ana Sayfa</a> <span aria-hidden="true">/</span> <span>TCMB Döviz Kurları</span>
    </nav>

    <section class="hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <p class="eyebrow">Günlük veri</p>
        <h1 id="hero-title">TCMB Döviz Kurları</h1>
        <p class="lede">
          Türkiye Cumhuriyet Merkez Bankası'nın <strong>{tarih_metin}</strong> tarihli
          gösterge niteliğindeki döviz kurları. Dolar <strong>{usd_satis} TL</strong>,
          euro <strong>{eur_satis} TL</strong>.
        </p>
        <p class="muted">
          <time datetime="{tarih_iso}">{tarih_metin}</time> tarihli bülten ·
          her iş günü otomatik güncellenir
        </p>
      </div>
    </section>

    <section id="kurlar" class="calc" aria-labelledby="kurlar-title">
      <div class="wrap">
        <h2 id="kurlar-title" class="visually-hidden">Güncel kur tablosu</h2>
        <div class="table-wrap">
          <table class="data-table">
            <caption>{tarih_metin} tarihli TCMB döviz kurları (1 birim karşılığı TL)</caption>
            <thead>
              <tr><th scope="col">Para birimi</th><th scope="col">Kod</th>
                  <th scope="col">Alış</th><th scope="col">Satış</th></tr>
            </thead>
            <tbody>
{satirlar}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="seyir" class="calc" aria-labelledby="seyir-title">
      <div class="wrap">
        <h2 id="seyir-title">Son {seri_gun} iş gününün seyri</h2>
        <p class="muted">
          {seri_bas} – {seri_bit} arası TCMB satış kurları. Her grafik tek para birimini
          gösterir; iki seri aynı eksene bindirilmemiştir.
        </p>
        <div class="dk-grafikler">
{grafikler}
        </div>
        <details class="dk-veri">
          <summary>Grafiklerin verisi (ay sonu değerleri)</summary>
          <table>
            <thead><tr><th scope="col">Tarih</th><th scope="col">USD</th><th scope="col">EUR</th></tr></thead>
            <tbody>
{seri_satirlari}
            </tbody>
          </table>
          <p>Tam seri: <a href="seri.json">seri.json</a> · Kaynak: TCMB günlük bültenleri.</p>
        </details>
      </div>
    </section>

    <section id="altin" class="calc" aria-labelledby="altin-title">
      <div class="wrap">
        <h2 id="altin-title">Serbest piyasa altın ve gümüş</h2>
        <p class="muted">
          Bu değerler <strong>TCMB kuru değildir</strong>. Merkez Bankası altın fiyatı
          yayımlamaz; aşağıdakiler serbest piyasa göstergesidir ve gün içinde değişir.
        </p>
        <div class="table-wrap">
          <table class="data-table">
            <caption>Serbest piyasa altın ve gümüş fiyatları (TL)</caption>
            <thead>
              <tr><th scope="col">Kalem</th><th scope="col">Alış</th>
                  <th scope="col">Satış</th><th scope="col">Günlük değişim</th></tr>
            </thead>
            <tbody data-altin-govde>
{altin_satirlari}
            </tbody>
          </table>
        </div>
        <p class="dk-tazelik">
          <span data-altin-damga>Kaynak güncellemesi: {altin_guncelleme}</span>
          <span class="dk-tazelik-not">Sayfa açıldığında bu bölüm tazelenir; üstteki TCMB
            tablosu resmî bültendir ve yalnızca iş günü bir kez değişir.</span>
        </p>
      </div>
    </section>

    <article class="content">
      <div class="wrap prose">
        <h2>TCMB kuru nedir, nerede kullanılır?</h2>
        <p>
          Merkez Bankası her iş günü <strong>gösterge niteliğinde</strong> döviz kurları yayımlar.
          Bu kurlar bankaların vitrinlerindeki alım satım fiyatları değildir; resmî işlemlerde
          esas alınan referans değerlerdir. Vergi matrahının hesaplanmasında, gümrük
          beyannamelerinde, mali tabloların değerlemesinde ve kamu alacaklarının
          hesaplanmasında bu kur kullanılır.
        </p>
        <p>
          Tabloda <strong>alış</strong> ve <strong>satış</strong> olmak üzere iki değer bulunur.
          Yurt dışından yaptığınız bir alışverişin maliyetini hesaplarken satış kuru,
          yurt dışından gelen bir ödemenin TL karşılığını bulurken alış kuru esas alınır.
        </p>
        <p>
          Bültende bazı para birimleri (örneğin Japon Yeni) 100 birim üzerinden yayımlanır.
          Bu tabloda tüm kurlar karşılaştırılabilir olması için <strong>1 birim karşılığına
          normalize edilmiştir</strong>.
        </p>

        <h2>Hangi araçta hangi kur işinize yarar?</h2>
        <ul>
          <li><a href="../gumruk-vergisi-hesaplama/">Gümrük Vergisi Hesaplama</a> — yurt dışı
              alışverişte vergi, beyannamenin tescil tarihindeki <strong>satış kuru</strong>
              üzerinden hesaplanır.</li>
          <li><a href="../serbest-meslek-makbuzu-hesaplama/">Serbest Meslek Makbuzu</a> — döviz
              cinsinden düzenlenen makbuzlarda TL karşılığı bu kurla bulunur.</li>
          <li><a href="../vadeli-mevduat-hesaplama/">Vadeli Mevduat</a> — döviz mevduatının
              TL getirisini karşılaştırmak için.</li>
          <li><a href="../birim-cevirici/">Birim Çevirici</a> — diğer ölçü dönüşümleri için.</li>
        </ul>

        <div class="sources">
          <h2 id="kaynak-title">Veri kaynağı ve güncelleme</h2>
          <p>
            <span class="updated">Bülten tarihi: {tarih_metin}</span> ·
            Sayfa her iş günü otomatik olarak yeniden üretilir.
          </p>
          <p>
            Veriler doğrudan
            <a href="https://www.tcmb.gov.tr/" rel="noopener">Türkiye Cumhuriyet Merkez Bankası</a>
            günlük döviz kurları bülteninden alınır; ara bir sağlayıcı kullanılmaz, veri elle
            girilmez.
          </p>
          <p>
            <strong>Dikkat:</strong> TCMB kuru gösterge niteliğindedir. Bankalar ve döviz
            büroları kendi kurlarını uygular. Hafta sonu ve resmî tatillerde yeni bülten
            yayımlanmaz; son iş gününün kuru geçerli kalır. Kapsam ve sınırlar için
            <a href="../kullanim-kosullari/">Kullanım Koşulları</a>.
          </p>
        </div>
      </div>
    </article>

    <section id="sss" class="faq">
      <div class="wrap prose">
        <h2>Sık sorulan sorular</h2>
        <div class="faq-list">
          <details><summary>TCMB kuru ne sıklıkla güncellenir?</summary><p>Merkez Bankası gösterge niteliğindeki kurları her iş günü saat 15.30 civarında yayımlar. Hafta sonu ve resmî tatillerde yeni bülten yayımlanmaz; son iş gününün kuru geçerli kalır.</p></details>
          <details><summary>Efektif kur ile döviz kuru arasındaki fark nedir?</summary><p>Döviz kuru hesaptan hesaba yapılan transferlerde, efektif kur ise nakit alım satımda kullanılır. Efektif kur, nakit taşıma maliyeti nedeniyle genellikle bir miktar farklıdır.</p></details>
          <details><summary>Bu kurlar bankaların uyguladığı kur mudur?</summary><p>Hayır. TCMB kuru gösterge niteliğindedir ve resmî işlemlerde esas alınır. Bankalar ve döviz büroları kendi alış satış kurlarını uygular.</p></details>
          <details><summary>Gümrük vergisi hesabında hangi kur kullanılır?</summary><p>Gümrük işlemlerinde, eşyanın gümrük beyannamesinin tescil edildiği tarihte geçerli olan TCMB döviz satış kuru esas alınır.</p></details>
          <details><summary>Veriler nereden geliyor?</summary><p>Doğrudan TCMB'nin günlük kur bülteninden. Sayfa her iş günü otomatik olarak yeniden üretilir, veriler elle girilmez.</p></details>
        </div>
      </div>
    </section>

    <section class="related">
      <div class="wrap prose">
        <h2>İlgili araçlar</h2>
        <ul>
          <li><a href="../gumruk-vergisi-hesaplama/">Gümrük Vergisi Hesaplama</a> — yurt dışı alışverişte toplam maliyet.</li>
          <li><a href="../vadeli-mevduat-hesaplama/">Vadeli Mevduat Hesaplama</a> — net getiri ve stopaj.</li>
          <li><a href="../kredi-hesaplama/">Kredi Hesaplama</a> — taksit ve ödeme planı.</li>
          <li><a href="../">Tüm araçlar</a></li>
        </ul>
      </div>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="wrap footer-legal">
      <p class="muted">© <span id="year">2026</span> Koray Öner · Ücretsiz ve açık kaynak.</p>
      <ul class="footer-links" aria-label="Yasal ve kurumsal bağlantılar">
        <li><a href="../hakkimda/">Hakkımda</a></li>
        <li><a href="../makaleler/">Makaleler</a></li>
        <li><a href="../iletisim/">İletişim</a></li>
        <li><a href="../gizlilik/">Gizlilik Politikası &amp; KVKK</a></li>
        <li><a href="../kullanim-kosullari/">Kullanım Koşulları</a></li>
      <li><a href="/yayin-ilkeleri/">Yayın ilkeleri ve kaynaklar</a></li>
        </ul>
    </div>
  </footer>

  <script src="../script.js" defer></script>
  <script src="altin.js" defer></script>
</body>
</html>
"""


def doviz_sayfasi_uret():
    tarih_iso, tarih_metin, kayitlar = tcmb_kurlar()
    d = dict((k, v) for k, _, v in kayitlar)

    satirlar = []
    for kod, ad, v in kayitlar:
        satirlar.append(
            '              <tr><th scope="row">%s</th><td>%s</td>'
            "<td>%s</td><td>%s</td></tr>" % (ad, kod, tr_sayi(v["alis"]), tr_sayi(v["satis"]))
        )

    # --- gecmis seri + grafikler -------------------------------------------
    seri, _ = seri_guncelle()
    grafikler, ozetler = [], {}
    for kod, ad in (("USD", "ABD Doları"), ("EUR", "Euro")):
        svg, oz = cizgi_svg(seri, kod, ad, "g-" + kod.lower())
        if not svg:
            continue
        ozetler[kod] = oz
        ok = "▲" if oz["yuzde"] >= 0 else "▼"
        grafikler.append(
            '          <figure class="dk-kart">\n'
            '            <div class="dk-kart-bas">\n'
            '              <span class="dk-kart-ad">%s/TL<small>%s</small></span>\n'
            '              <span class="dk-delta"><span aria-hidden="true">%s</span> %%%s'
            ' <span>dönem</span></span>\n'
            '            </div>\n'
            '%s\n'
            '            <figcaption>%s iş günü · en düşük %s TL, en yüksek %s TL.'
            ' Ölçek sıfırdan başlamaz; dönem içi hareketi görünür kılmak için eksen'
            ' veri aralığına daraltılmıştır.</figcaption>\n'
            '          </figure>' % (
                kod, ad, ok, tr_sayi(abs(oz["yuzde"]), 2), svg,
                oz["adet"], tr_sayi(oz["dip"], 4), tr_sayi(oz["tepe"], 4)))

    # Ay sonu ozeti: tam seriyi tabloya dokmek okunmaz olurdu.
    ay_son = {}
    for k in seri:
        ay_son[k["tarih"][:7]] = k

    def _uzun_tarih(iso):
        return "%d %s %s" % (int(iso[8:]), AYLAR[int(iso[5:7]) - 1], iso[:4])

    seri_satirlari = "\n".join(
        '              <tr><th scope="row">%s</th><td>%s</td><td>%s</td></tr>' % (
            _uzun_tarih(k["tarih"]), tr_sayi(k["USD"]), tr_sayi(k["EUR"]))
        for _, k in sorted(ay_son.items()))

    # --- serbest piyasa altin ----------------------------------------------
    altin, altin_guncelleme, altin_taze = altin_verisi()
    altin_satirlari = "\n".join(
        '              <tr><th scope="row">%s</th><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            v["ad"],
            tr_sayi(v["alis"], 2) if v["alis"] else "—",
            tr_sayi(v["satis"], 2),
            ("%s %%%s" % ("▲" if v["degisim"] >= 0 else "▼", tr_sayi(abs(v["degisim"]), 2)))
            if v["degisim"] is not None else "—")
        for _, v in sorted(altin.items(), key=lambda kv: [k for k, _ in ALTIN_GOSTER].index(kv[0])))
    if not altin_satirlari:
        altin_satirlari = ('              <tr><td colspan="4">Altın verisi şu anda '
                           'alınamadı.</td></tr>')

    oz = ozetler.get("USD") or {}

    html = PAGE.format(
        site=SITE,
        tarih_iso=tarih_iso,
        tarih_metin=tarih_metin,
        usd_satis=tr_sayi(d["USD"]["satis"], 2),
        eur_satis=tr_sayi(d["EUR"]["satis"], 2),
        satirlar="\n".join(satirlar),
        grafikler="\n".join(grafikler),
        seri_satirlari=seri_satirlari,
        seri_gun=oz.get("adet", 0),
        seri_bas=_uzun_tarih(oz["bas"]) if oz else "",
        seri_bit=_uzun_tarih(oz["bit"]) if oz else "",
        altin_satirlari=altin_satirlari,
        altin_guncelleme=altin_guncelleme or "bilinmiyor",
    )

    out_dir = os.path.join(ROOT, "doviz-kurlari")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "index.html")

    eski = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    if eski == html:
        print("doviz-kurlari: degisiklik yok")
        return False
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("doviz-kurlari: guncellendi (%s, %d para birimi)" % (tarih_metin, len(kayitlar)))
    return True


def sitemap_lastmod_guncelle(yollar):
    """Guncellenen sayfalarin sitemap lastmod degerini bugune ceker."""
    p = os.path.join(ROOT, "sitemap.xml")
    s = open(p, encoding="utf-8").read()
    bugun = dt.date.today().isoformat()
    degisti = False
    for yol in yollar:
        loc = "%s/%s/" % (SITE, yol)
        if loc not in s:
            # sitemap'te yoksa ekle
            yeni = ('  <url><loc>%s</loc><lastmod>%s</lastmod>'
                    "<changefreq>daily</changefreq><priority>0.8</priority></url>\n" % (loc, bugun))
            s = s.replace("</urlset>", yeni + "</urlset>")
            degisti = True
            continue
        pat = re.compile(r"(<loc>%s</loc>\s*\n?\s*<lastmod>)\d{4}-\d{2}-\d{2}(</lastmod>)"
                         % re.escape(loc))
        s2, n = pat.subn(r"\g<1>%s\g<2>" % bugun, s)
        if n:
            s, degisti = s2, True
    if degisti:
        open(p, "w", encoding="utf-8", newline="").write(s)
        print("sitemap.xml: lastmod guncellendi")
    return degisti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="sadece kaynaklari test et, dosya yazma")
    args = ap.parse_args()

    if args.check:
        tarih_iso, tarih_metin, kayitlar = tcmb_kurlar()
        print("TCMB erisimi TAMAM — bulten %s, %d para birimi cozuldu" % (tarih_metin, len(kayitlar)))
        for kod, ad, v in kayitlar[:5]:
            print("   %-4s %-22s alis %s  satis %s" % (kod, ad, tr_sayi(v["alis"]), tr_sayi(v["satis"])))
        return 0

    degisen = []
    try:
        if doviz_sayfasi_uret():
            degisen.append("doviz-kurlari")
    except Exception as e:
        print("HATA: doviz sayfasi uretilemedi: %s" % e, file=sys.stderr)
        return 1

    if degisen:
        sitemap_lastmod_guncelle(degisen)
    print("Bitti. Degisen sayfa: %s" % (", ".join(degisen) or "yok"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
