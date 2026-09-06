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
import os
import re
import sys
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
  <meta property="og:image" content="{site}/images/doviz-kurlari-koray-oner.png?v=2">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="TCMB Döviz Kurları — {tarih_metin}">
  <meta name="twitter:image" content="{site}/images/doviz-kurlari-koray-oner.png?v=2">

  <link rel="stylesheet" href="../style.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
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
        <li><a href="../iletisim/">İletişim</a></li>
        <li><a href="../gizlilik/">Gizlilik Politikası &amp; KVKK</a></li>
        <li><a href="../kullanim-kosullari/">Kullanım Koşulları</a></li>
      </ul>
    </div>
  </footer>

  <script src="../script.js" defer></script>
  <script src="/bg-network.js" defer></script>
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

    html = PAGE.format(
        site=SITE,
        tarih_iso=tarih_iso,
        tarih_metin=tarih_metin,
        usd_satis=tr_sayi(d["USD"]["satis"], 2),
        eur_satis=tr_sayi(d["EUR"]["satis"], 2),
        satirlar="\n".join(satirlar),
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
