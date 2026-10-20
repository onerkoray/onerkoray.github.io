# -*- coding: utf-8 -*-
"""/en/ — sitenin ve Koray Öner'in çalışmalarının İngilizce tanıtımı.

NEDEN
-----
Site Türkçe; DOI'li çalışmalar, ORCID ve Zenodo ise uluslararası okura da
açık. "Koray Oner" diye İngilizce arayan birinin karşısına çıkacak bir sayfa
yoktu. /en/ bir çeviri değil, kısa bir tanıtım: kim, ne yapıyor, hesaplar
nasıl denetleniyor, nereden başlanır.

ARAMA BAĞLAMI
-------------
Türkçe ad sorgusunun sayfası /hakkimda/ (ProfilePage). /en/ onun İngilizce
karşılığı: iki sayfa hreflang ile birbirine bağlı (tr, en, x-default=tr), aynı
Person @id'sine işaret eder, yeni bir kimlik kaydı açmaz. Böylece iki dil
aynı sorguda yarışmaz.

NEDEN ÜRETİLİYOR
----------------
Sayılar (araç, yazı, otomatik kontrol), yayın listesi ve çekirdek paketin adı
elle yazılsaydı ilk yeni araçta eskirdi. Hepsi tools/hakkimda-rakamlar.py ile
aynı kaynaklardan (content.json, workflow, yayinlar/yayin.js) gelir.

Kullanım:
    python tools/en-sayfa.py           # yaz
    python tools/en-sayfa.py --check   # güncel mi (CI)
"""
import html
import importlib.util
import io
import json
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "en", "index.html")
SITE = "https://korayoner.dev"
AYLAR = ["January", "February", "March", "April", "May", "June", "July", "August",
         "September", "October", "November", "December"]

# Başlangıç için seçilmiş araçlar: adres, İngilizce ad, tek cümle.
ARACLAR = [
    ("maas-hesaplama", "Gross-to-net salary", "Monthly payroll for every month of the year, with income tax brackets, the SGK ceiling and the minimum-wage exemption; payroll years 2020–2026."),
    ("bordro-denetim", "Payslip audit", "Enter your payslip lines and see which deduction differs from the expected amount, and why."),
    ("kidem-tazminati-hesaplama", "Severance and notice pay", "Severance (kıdem) and notice (ihbar) pay with the current statutory ceiling."),
    ("emekli-ayligi-hesaplama", "Retirement pension", "How contribution days and earnings turn into a monthly pension under the SSK and Bağ-Kur rules."),
    ("ne-zaman-emekli-olurum", "Retirement date", "Earliest retirement date from your first insurance date, age and contribution days."),
    ("dilim-kaymasi-hesaplama", "Tax bracket creep", "How much extra income tax your wage pays because the brackets rose less than wages."),
    ("beyanname-hesaplama", "Annual income tax return", "Income tax on rent, freelance and multiple-employer income, with the declaration thresholds."),
    ("isveren-maliyeti-hesaplama", "Employer cost", "What a gross or net salary costs the employer, including SGK and unemployment insurance shares."),
]


def modul(ad, dosya):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(KOK, "tools", dosya))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


H = modul("hakkimda_rakamlar", "hakkimda-rakamlar.py")


def oku(p):
    return io.open(os.path.join(KOK, p), encoding="utf-8").read()


def kacis(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def tarih_en(iso):
    y, a, g = iso.split("-")
    return "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)


def yayinlar():
    r = subprocess.run(["node", "-e", "var Y=require('./yayinlar/yayin.js');console.log(JSON.stringify(Y.CALISMALAR))"],
                       cwd=KOK, capture_output=True, text=True, encoding="utf-8", check=True)
    return sorted(json.loads(r.stdout), key=lambda c: c["tarih"], reverse=True)


def cekirdek():
    return re.search(r'"name":\s*"([^"]+)"', oku(os.path.join("tools", "cekirdek.py"))).group(1)


def manifest():
    return json.loads(oku("content.json"))


def govde():
    M = manifest()
    adresler = {s["url"] for s in M["sayfalar"] if not s.get("noindex")}
    for slug, _, _ in ARACLAR:
        if SITE + "/" + slug + "/" not in adresler:
            raise SystemExit("/en/ listesindeki araç sitede yok ya da dizine kapalı: " + slug)
    n_arac, n_yazi, n_ci = H.arac_sayisi(), H.makale_sayisi(), H.ci_komut_sayisi()
    yy = yayinlar()
    paket = cekirdek()
    p = []
    p.append('''
    <section class="hero kd-hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <p class="eyebrow">In English</p>
        <h1 id="hero-title">Koray Öner</h1>
        <figure class="portre portre--kucuk kd-portre">
          <div class="portre-cerceve">
            <picture>
              <source srcset="../images/koray-oner-portre-360.webp" type="image/webp">
              <img src="../images/koray-oner-portre.jpg" width="160" height="160"
                   alt="Koray Öner, software developer" decoding="async">
            </picture>
          </div>
          <figcaption class="portre-etiket">
            <span class="portre-ad">Koray Öner</span>
            <span class="portre-rol">Software developer</span>
          </figcaption>
        </figure>
        <p class="lede">Koray Öner (also written Koray Oner) is a freelance software developer in Türkiye. He builds free, open-source calculators for Turkish payroll, income tax, social security (SGK) and pensions, and writes the articles that explain the rules behind them. This site, korayoner.dev, is where they live. The site itself is in Turkish; this page is a short overview in English.</p>
        <p class="kd-yonlendir">Türkçe: <a href="../hakkimda/" hreflang="tr" lang="tr">Hakkımda</a> · <a href="../koray-oner/" hreflang="tr" lang="tr">Çalışma dizini</a></p>
        <dl class="kd-sayilar">
          <div><dt>Calculators</dt><dd>%d</dd></div>
          <div><dt>Articles</dt><dd>%d</dd></div>
          <div><dt>Papers with a DOI</dt><dd>%d</dd></div>
          <div><dt>Automated checks</dt><dd>%d</dd></div>
        </dl>
      </div>
    </section>''' % (n_arac, n_yazi, len(yy), n_ci))

    p.append('''
    <section class="content kd-bolum" id="what" aria-labelledby="what-title">
      <div class="wrap prose">
        <h2 id="what-title">What the site does</h2>
        <p>Turkish payroll, tax and pension rules change at least once a year: the minimum wage, the income tax brackets and the social security ceiling each January, pensions every January and July. The calculators on this site apply the rules of each year, so a salary, a severance payment or a pension can be computed for the year it belongs to, not only for today.</p>
        <ul>
          <li>The calculators run in your browser. The amounts you enter are not sent to a server, and there is no sign-up and no advertising.</li>
          <li>Every legal parameter (brackets, ceilings, exemptions, rates) is read from a single source file and checked against the official text.</li>
          <li>Articles answer one question with the site's own calculation, and state their assumptions in the text.</li>
        </ul>
      </div>
    </section>''')

    p.append('''
    <section class="content kd-bolum" id="checks" aria-labelledby="checks-title">
      <div class="wrap prose">
        <h2 id="checks-title">How the numbers are checked</h2>
        <p>Sources are primary: the Official Gazette (Resmî Gazete), the Revenue Administration (GİB), the Social Security Institution (SGK), TurkStat (TÜİK) and the Central Bank (TCMB). Every number in an article that contains a calculation is reproduced by an automated test from the site's own calculation engines; %d checks run on every change. Claims that depend on a date carry an expiry date, and the build fails when it passes. Corrections are logged on the <a href="../yayin-ilkeleri/" hreflang="tr" lang="tr">publishing principles</a> page (in Turkish).</p>
        <p>AI agents help write code, drafts and charts. They are not a source of facts: the figures are recomputed by tests, and the responsibility is Koray Öner's.</p>
      </div>
    </section>''' % n_ci)

    p.append('''
    <section class="content kd-bolum" id="start" aria-labelledby="start-title">
      <div class="wrap">
        <h2 id="start-title">Where to start</h2>
        <p class="kd-aciklama">Selected calculators. The pages are in Turkish; the numbers speak for themselves.</p>
        <ul class="kd-kanallar">%s
        </ul>
        <p><a href="../araclar/" hreflang="tr" lang="tr">All %d calculators</a> · <a href="../makaleler/" hreflang="tr" lang="tr">All %d articles</a></p>
      </div>
    </section>''' % ("".join('\n          <li><a href="../%s/" hreflang="tr">%s</a><span>%s</span></li>' % (s, kacis(a), kacis(d)) for s, a, d in ARACLAR), n_arac, n_yazi))

    p.append('''
    <section class="content kd-bolum" id="research" aria-labelledby="research-title">
      <div class="wrap">
        <h2 id="research-title">Research with a DOI</h2>
        <p class="kd-aciklama">Papers deposited on Zenodo with a permanent DOI, all linked to ORCID <a href="https://orcid.org/0009-0005-8730-3577" rel="noopener me">0009-0005-8730-3577</a>. The papers are written in Turkish; titles are given as published.</p>
        <ol class="kd-yayinlar">%s</ol>
      </div>
    </section>''' % "".join(
        '<li><time datetime="%s">%s</time><a href="https://doi.org/%s" rel="noopener" lang="tr">%s</a></li>' % (
            c["tarih"], tarih_en(c["tarih"]), c["doi"], kacis(c["baslik"])) for c in yy))

    p.append('''
    <section class="content kd-bolum" id="open-source" aria-labelledby="oss-title">
      <div class="wrap prose">
        <h2 id="oss-title">Open source</h2>
        <p>The calculation core for payroll, severance, pensions, rental income, taxes and loans is published on npm as <strong>%s</strong> under the MIT licence. It has no dependencies, runs the same in the browser and in Node.js, and is the code the calculators on this site use. Source: <a href="https://github.com/onerkoray/hesap-cekirdegi" rel="noopener">GitHub</a> · <a href="https://www.npmjs.com/package/%s" rel="noopener">npm</a>.</p>
      </div>
    </section>''' % (paket, paket))

    p.append('''
    <section class="content kd-bolum" id="elsewhere" aria-labelledby="elsewhere-title">
      <div class="wrap">
        <h2 id="elsewhere-title">Elsewhere and contact</h2>
        <ul class="kd-kanallar">
          <li><a href="https://orcid.org/0009-0005-8730-3577" rel="noopener me">ORCID</a><span>research identity</span></li>
          <li><a href="https://github.com/onerkoray" rel="noopener me">GitHub</a><span>source code and the calculation core</span></li>
          <li><a href="https://www.youtube.com/@onerkoray" rel="noopener me">YouTube</a><span>short videos on the calculators (Turkish)</span></li>
          <li><a href="https://x.com/korayonerdev" rel="noopener me">X</a><span>announcements of new tools and articles</span></li>
          <li><a href="https://www.linkedin.com/in/korayoner/" rel="noopener me">LinkedIn</a><span>collaboration</span></li>
        </ul>
        <p>Email: <a href="mailto:iletisim@korayoner.dev">iletisim@korayoner.dev</a>. Error reports and questions are welcome in English or Turkish.</p>
      </div>
    </section>''')
    return "\n".join(p), n_arac, n_yazi, len(yy)


def blok(s, ad, icerik):
    bas, bit = "<!-- %s:BASLANGIC -->" % ad, "<!-- %s:BITIS -->" % ad
    i, j = s.find(bas), s.find(bit)
    if i < 0 or j < 0:
        raise SystemExit("Blok işareti yok: " + ad)
    return s[:i + len(bas)] + icerik + s[j:]


def uret(s):
    g, n_arac, n_yazi, n_yayin = govde()
    acik = ("Koray Öner (Koray Oner), software developer in Türkiye: %d free calculators for Turkish payroll, "
            "tax and pensions, %d tested articles and %d papers with a DOI." % (n_arac, n_yazi, n_yayin))
    s = blok(s, "EN-GOVDE", g + "\n    ")
    for kalip in (r'(<meta name="description" content=")[^"]*(")', r'(<meta property="og:description" content=")[^"]*(")',
                  r'(<meta name="twitter:description" content=")[^"]*(")'):
        s = re.sub(kalip, lambda m: m.group(1) + kacis(acik) + m.group(2), s)
    return s, acik


def main():
    eski = io.open(SAYFA, encoding="utf-8").read()
    yeni, acik = uret(eski)
    if len(acik) > 165:
        print("Açıklama 165 karakteri aşıyor (%d)." % len(acik))
        return 1
    if "--check" in sys.argv:
        if yeni != eski:
            print("/en/ bayat — 'python tools/en-sayfa.py' çalıştırın.")
            return 1
        print("/en/ güncel.")
        return 0
    if yeni != eski:
        io.open(SAYFA, "w", encoding="utf-8", newline="\n").write(yeni)
        print("/en/ yazıldı.")
    else:
        print("/en/ zaten güncel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
