# -*- coding: utf-8 -*-
"""/koray-oner/ — Koray Öner'in çalışma dizinini depodan üretir.

NEDEN AYRI BİR SAYFA
--------------------
Hakkımda kim olduğunu, iletişim nasıl ulaşılacağını anlatıyor. Bu sayfa ise
yapılmış işin dizini: hangi araç, hangi yazı, hangi yayın, ne zaman ve hangi
alanda. Arama motoru açısından "Koray Öner" varlığını ürettiği somut işlere
bağlayan sayfa bu (CollectionPage + her işin author'u aynı Person @id).

NEDEN ÜRETİLİYOR
----------------
Liste ve rakamlar elle yazılsaydı ilk yeni araçta eskirdi. Araç sayısı,
yazı sayısı ve otomatik kontrol sayısı tools/hakkimda-rakamlar.py ile AYNI
fonksiyonlardan geliyor: iki sayfa farklı rakam gösteremez. Araç ve yazı
tarihleri git geçmişinden ve yazıların datePublished alanından okunuyor.

Kullanım:
    python tools/calisma-dizini.py           # sayfayı yaz
    python tools/calisma-dizini.py --check   # güncel mi (CI)
"""
import datetime as dt
import html
import importlib.util
import io
import json
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "koray-oner", "index.html")
ADRES = "https://korayoner.dev/koray-oner/"
KISI = "https://korayoner.dev/#oner-koray"
AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos",
         "Eylül", "Ekim", "Kasım", "Aralık"]
ALANLAR = [
    ("maas", "Maaş, tazminat ve emeklilik", "Brütten nete maaş, kıdem ve ihbar, işsizlik maaşı, emekli aylığı ve zamları, SGK primleri.",
     ("Bordro", "Tazminat", "Emeklilik ve sosyal güvenlik")),
    ("vergi", "Vergi ve belge", "Gelir vergisi beyannamesi, KDV ve tevkifat, stopaj, kira geliri, veraset, MTV ve ÖTV, fatura.",
     ("Vergi", "Mevzuat")),
    ("finans", "Kredi ve hane finansı", "Kredi maliyeti, mevduat, enflasyon, kira artışı, birikim ve finansal karar araçları.",
     ("Finans",)),
    ("genel", "Genel araçlar", "Finans dışında geliştirilmiş, günlük kullanım için küçük araçlar.", ()),
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
    """Yalnız &, <, > ve çift tırnak; kesme işareti düz kalır (diğer sayfalar gibi)."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def uzun_tarih(iso):
    y, a, g = iso.split("-")
    return "%d %s %s" % (int(g), AYLAR[int(a) - 1], y)


def ilk_ekleme(yol):
    r = subprocess.run(["git", "log", "--diff-filter=A", "--format=%ad", "--date=short", "--", yol],
                       cwd=KOK, capture_output=True, text=True)
    t = r.stdout.split()
    return t[-1] if t else None


def araclar():
    s = oku("index.html")
    liste = []
    for cat, g in re.findall(r'<li class="project-card(?![^"]*--(?:soon|grafik))[^"]*" data-cat="([a-z]+)"[^>]*>([\s\S]*?)</li>', s):
        m = re.search(r'<h3><a href="([^"#]+)">([^<]+)</a></h3>', g)
        if not m:
            continue
        yol = m.group(1).rstrip("/")
        p = yol + "/index.html"
        if not os.path.exists(os.path.join(KOK, p)):
            continue
        acik = re.findall(r"<p>([\s\S]*?)</p>", g)
        tarih = ilk_ekleme(p)
        liste.append({"alan": cat, "yol": yol + "/", "ad": html.unescape(m.group(2)).strip(),
                      "aciklama": re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", acik[0]))).strip() if acik else "",
                      "tarih": tarih})
    return liste


def yazilar():
    konu = {x["slug"]: x.get("kicker", "") for x in json.load(io.open(os.path.join(KOK, "tools", "makaleler.json"), encoding="utf-8"))}
    liste = []
    for d in sorted(os.listdir(os.path.join(KOK, "makaleler"))):
        p = "makaleler/%s/index.html" % d
        if not os.path.exists(os.path.join(KOK, p)) or d not in konu:
            continue
        t = oku(p)
        dp = re.search(r'"datePublished":\s*"([^"]+)"', t)
        h1 = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", t)
        if not dp or not h1:
            continue
        liste.append({"yol": "makaleler/%s/" % d, "baslik": re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", h1.group(1)))).strip(),
                      "tarih": dp.group(1)[:10], "konu": konu[d]})
    return sorted(liste, key=lambda x: (x["tarih"], x["yol"]), reverse=True)


def yayinlar():
    r = subprocess.run(["node", "-e", "var Y=require('./yayinlar/yayin.js');console.log(JSON.stringify(Y.CALISMALAR))"],
                       cwd=KOK, capture_output=True, text=True, encoding="utf-8", check=True)
    return sorted(json.loads(r.stdout), key=lambda c: c["tarih"], reverse=True)


def cekirdek():
    p = json.load(io.open(os.path.join(KOK, "_cekirdek", "package.json"), encoding="utf-8"))
    return p["name"], p["version"]


# ---------------------------------------------------------------- büyüme çizgisi
def buyume_svg(ar, yz):
    """Yayındaki araç ve yazı sayısı, haftalık birikimli. Git tarihi olmayan
    araç sayılmaz (henüz commit'lenmemiş)."""
    olaylar = [(a["tarih"], "a") for a in ar if a["tarih"]] + [(y["tarih"], "y") for y in yz]
    if not olaylar:
        return ""
    bas = dt.date.fromisoformat(min(o[0] for o in olaylar))
    bas -= dt.timedelta(days=bas.weekday())
    son = dt.date.fromisoformat(max(o[0] for o in olaylar))
    haftalar = []
    h = bas
    while h <= son:
        haftalar.append(h)
        h += dt.timedelta(days=7)
    def say(tur, gun):
        return sum(1 for t, k in olaylar if k == tur and dt.date.fromisoformat(t) <= gun)
    noktalar = [(h + dt.timedelta(days=6), say("a", h + dt.timedelta(days=6)), say("y", h + dt.timedelta(days=6))) for h in haftalar]
    W, Hh, sol, sag, ust, alt = 960, 280, 44, 150, 16, 34
    enbuyuk = max(max(n[1], n[2]) for n in noktalar)
    tavan = ((enbuyuk + 19) // 20) * 20
    def x(i):
        return sol + (W - sol - sag) * (i / max(1, len(noktalar) - 1))
    def y(v):
        return ust + (Hh - ust - alt) * (1 - v / tavan)
    p = ['<svg class="kd-buyume" viewBox="0 0 %d %d" role="img" aria-label="%s">' % (W, Hh, kacis(
        "Yayındaki araç ve yazı sayısı, haftalık: %s'dan %s'e araç %d'den %d'ye, yazı %d'den %d'ye." % (
            uzun_tarih(noktalar[0][0].isoformat()), uzun_tarih(noktalar[-1][0].isoformat()),
            noktalar[0][1], noktalar[-1][1], noktalar[0][2], noktalar[-1][2])))]
    for v in range(0, tavan + 1, 20):
        p.append('<line class="kd-izgara" x1="%d" x2="%d" y1="%.1f" y2="%.1f"/><text class="kd-eksen kd-eksen-y" x="%d" y="%.1f">%d</text>'
                 % (sol, W - sag, y(v), y(v), sol - 8, y(v) + 4, v))
    ay_once = None
    for i, n in enumerate(noktalar):
        ay = n[0].strftime("%Y-%m")
        if ay != ay_once:
            p.append('<text class="kd-eksen kd-eksen-x" x="%.1f" y="%d">%s</text>' % (x(i), Hh - 10, AYLAR[n[0].month - 1][:3] + " " + str(n[0].year)))
            ay_once = ay
    for ind, sinif, ad in ((1, "kd-arac", "araç"), (2, "kd-yazi", "yazı")):
        d = "M" + " L".join("%.1f %.1f" % (x(i), y(n[ind])) for i, n in enumerate(noktalar))
        alan = d + " L%.1f %.1f L%.1f %.1f Z" % (x(len(noktalar) - 1), y(0), x(0), y(0))
        p.append('<path class="kd-dolgu %s" d="%s"/><path class="kd-cizgi %s" d="%s"/>' % (sinif, alan, sinif, d))
    son_n = noktalar[-1]
    ya, yy = y(son_n[1]), y(son_n[2])
    if abs(ya - yy) < 30:
        orta = (ya + yy) / 2
        ya, yy = (orta - 15, orta + 15) if son_n[1] >= son_n[2] else (orta + 15, orta - 15)
    for deger, yk, sinif, ad in ((son_n[1], ya, "kd-arac", "araç"), (son_n[2], yy, "kd-yazi", "yazı")):
        p.append('<text class="kd-son %s" x="%.1f" y="%.1f">%d %s</text>' % (sinif, W - sag + 10, yk + 5, deger, ad))
    p.append("</svg>")
    return "".join(p)


# ---------------------------------------------------------------- sayfa gövdesi
def govde():
    ar, yz, yy = araclar(), yazilar(), yayinlar()
    ad_c, surum = cekirdek()
    n_arac, n_yazi, n_ci = H.arac_sayisi(), H.makale_sayisi(), H.ci_komut_sayisi()
    n_yayin = len(yy)
    son_ar = sorted([a for a in ar if a["tarih"]], key=lambda a: (a["tarih"], a["ad"]), reverse=True)[:6]

    p = []
    p.append('''
    <section class="hero kd-hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <p class="eyebrow">Çalışma dizini</p>
        <h1 id="hero-title">Koray Öner</h1>
        <p class="lede">Türkiye'de maaş, vergi, SGK, emeklilik ve hane finansı için ücretsiz hesap araçları geliştiriyor; hesabın arkasındaki kuralı anlatan, her rakamı testle sabitlenmiş yazılar ve DOI ile kalıcı kaydı olan çalışmalar yayımlıyor. Bu sayfa hepsinin dizini: ne yapıldı, ne zaman, hangi alanda.</p>
        <p class="kd-yonlendir">Kim olduğu için <a href="../hakkimda/">hakkımda</a>, ulaşmak için <a href="../iletisim/">iletişim</a> sayfası.</p>
        <dl class="kd-sayilar">
          <div><dt>Hesaplama aracı</dt><dd>%d</dd></div>
          <div><dt>Testli yazı</dt><dd>%d</dd></div>
          <div><dt>DOI'li çalışma</dt><dd>%d</dd></div>
          <div><dt>Otomatik kontrol</dt><dd>%d</dd></div>
        </dl>
      </div>
    </section>''' % (n_arac, n_yazi, n_yayin, n_ci))

    p.append('''
    <section class="content kd-bolum" id="buyume" aria-labelledby="buyume-title">
      <div class="wrap">
        <h2 id="buyume-title">Nasıl büyüdü</h2>
        <p class="kd-aciklama">Sitedeki araç ve yazı sayısı, hafta hafta. Tarihler aracın siteye eklendiği commit'ten ve yazının yayın tarihinden okunuyor.</p>
        <figure class="kd-grafik">%s
          <figcaption><span class="kd-lejant kd-arac">Araçlar</span> <span class="kd-lejant kd-yazi">Yazılar</span></figcaption>
        </figure>
      </div>
    </section>''' % buyume_svg(ar, yz))

    p.append('''
    <section class="content kd-bolum" id="alanlar" aria-labelledby="alanlar-title">
      <div class="wrap">
        <h2 id="alanlar-title">Alanlar</h2>
        <div class="kd-alanlar">''')
    for kod, baslik, acik, konular in ALANLAR:
        liste = [a for a in ar if a["alan"] == kod]
        if not liste:
            continue
        ilgili = [y for y in yz if y["konu"] in konular]
        p.append('''
          <article class="kd-alan" aria-labelledby="alan-%s">
            <h3 id="alan-%s">%s</h3>
            <p class="kd-alan-sayi"><strong>%d</strong> araç%s</p>
            <p class="kd-alan-acik">%s</p>
            <ul class="kd-arac-listesi">%s</ul>%s
          </article>''' % (
            kod, kod, kacis(baslik), len(liste), (" · <strong>%d</strong> yazı" % len(ilgili)) if ilgili else "", kacis(acik),
            "".join('<li><a href="../%s">%s</a></li>' % (a["yol"], kacis(a["ad"])) for a in sorted(liste, key=lambda a: a["ad"])),
            ('\n            <p class="kd-alan-yazi">Son yazı: <a href="../%s">%s</a></p>' % (ilgili[0]["yol"], kacis(ilgili[0]["baslik"]))) if ilgili else ""))
    p.append('''
        </div>
      </div>
    </section>''')

    p.append('''
    <section class="content kd-bolum" id="son" aria-labelledby="son-title">
      <div class="wrap kd-iki">
        <div>
          <h2 id="son-title">Son yazılar</h2>
          <ol class="kd-akis">%s</ol>
          <p><a href="../makaleler/">Bütün yazılar (%d)</a></p>
        </div>
        <div>
          <h2 id="son-arac-title">Son eklenen araçlar</h2>
          <ol class="kd-akis">%s</ol>
          <p><a href="../#projects">Bütün araçlar (%d)</a></p>
        </div>
      </div>
    </section>''' % (
        "".join('<li><time datetime="%s">%s</time><a href="../%s">%s</a><span>%s</span></li>' % (
            y["tarih"], uzun_tarih(y["tarih"]), y["yol"], kacis(y["baslik"]), kacis(y["konu"])) for y in yz[:8]),
        n_yazi,
        "".join('<li><time datetime="%s">%s</time><a href="../%s">%s</a><span>%s</span></li>' % (
            a["tarih"], uzun_tarih(a["tarih"]), a["yol"], kacis(a["ad"]), kacis(a["aciklama"][:110] + ("…" if len(a["aciklama"]) > 110 else ""))) for a in son_ar),
        n_arac))

    p.append('''
    <section class="content kd-bolum" id="yayinlar" aria-labelledby="yayin-title">
      <div class="wrap">
        <h2 id="yayin-title">DOI ile kayıtlı çalışmalar</h2>
        <p class="kd-aciklama">Zenodo'da kalıcı kaydı olan çalışmalar; hepsi ORCID <a href="https://orcid.org/0009-0005-8730-3577" rel="noopener me">0009-0005-8730-3577</a> kimliğine bağlı. Ayrıntı ve özetler <a href="../yayinlar/">yayımlanmış çalışmalar</a> sayfasında.</p>
        <ol class="kd-yayinlar">%s</ol>
      </div>
    </section>''' % "".join(
        '<li><time datetime="%s">%s</time><a href="https://doi.org/%s" rel="noopener">%s</a>%s</li>' % (
            c["tarih"], uzun_tarih(c["tarih"]), c["doi"], kacis(c["baslik"]),
            (' <span>Sitede anlatan yazı: <a href="../%s/">oku</a></span>' % c["sayfa"]) if c.get("sayfa") else "") for c in yy))

    p.append('''
    <section class="content kd-bolum" id="acik-kaynak" aria-labelledby="ak-title">
      <div class="wrap kd-iki">
        <div>
          <h2 id="ak-title">Açık kaynak</h2>
          <p>Bordro, tazminat, emeklilik, kira geliri, vergi ve kredi hesaplarının çekirdeği <strong>%s</strong> adıyla npm'de yayında (sürüm %s). Bağımlılığı yok; tarayıcıda ve Node.js'te aynı kodla çalışıyor ve sitedeki araçlar da onu kullanıyor. Her değişiklikte %d otomatik kontrol koşuyor.</p>
          <p><a href="https://www.npmjs.com/package/%s" rel="noopener">npm</a> · <a href="https://github.com/onerkoray/hesap-cekirdegi" rel="noopener">GitHub</a></p>
        </div>
        <div>
          <h2 id="veri-title">Resmî veri hatları</h2>
          <p>Kur, enflasyon, faiz, altın ve mevduat serileri her gece resmî kaynaklardan çekilip birbirine karşı doğrulanıyor: TCMB, TÜİK, BIS ve Dünya Bankası. Tutmayan veri yayına girmiyor. Bu serilerden üretilen sayfalar: <a href="../grafikler/">ekonomi grafikleri</a>, <a href="../kira-artisi-hesaplama/">kira artışı</a>, <a href="../altin-mi-dolar-mi-mevduat-mi/">altın mı, dolar mı, mevduat mı</a>, <a href="../doviz-kurlari/">döviz kurları</a>.</p>
        </div>
      </div>
    </section>''' % (ad_c, surum, n_ci, ad_c))

    p.append('''
    <section class="content kd-bolum" id="kanallar" aria-labelledby="kanal-title">
      <div class="wrap">
        <h2 id="kanal-title">Başka yerlerde</h2>
        <ul class="kd-kanallar">
          <li><a href="https://github.com/onerkoray" rel="noopener me">GitHub</a><span>kaynak kod ve hesap çekirdeği</span></li>
          <li><a href="https://orcid.org/0009-0005-8730-3577" rel="noopener me">ORCID</a><span>akademik kimlik</span></li>
          <li><a href="https://www.youtube.com/@onerkoray" rel="noopener me">YouTube</a><span>araçları anlatan kısa videolar</span></li>
          <li><a href="https://x.com/korayonerdev" rel="noopener me">X</a><span>yeni araç ve yazı duyuruları</span></li>
          <li><a href="https://korayoner.substack.com/" rel="noopener me">Substack</a><span>yazılar</span></li>
          <li><a href="https://www.linkedin.com/in/korayoner/" rel="noopener me">LinkedIn</a><span>iş birliği</span></li>
        </ul>
      </div>
    </section>''')
    return "\n".join(p), ar, yz, yy, n_arac, n_yazi, n_yayin


def json_ld(ar, yz, yy):
    ogeler = []
    for a in sorted(ar, key=lambda a: a["ad"]):
        ogeler.append({"@type": "WebApplication", "name": a["ad"], "url": "https://korayoner.dev/" + a["yol"],
                       "applicationCategory": "FinanceApplication", "author": {"@id": KISI}})
    for y in yz:
        ogeler.append({"@type": "Article", "headline": y["baslik"], "url": "https://korayoner.dev/" + y["yol"],
                       "datePublished": y["tarih"], "author": {"@id": KISI}})
    for c in yy:
        ogeler.append({"@type": "ScholarlyArticle", "headline": c["baslik"], "url": "https://doi.org/" + c["doi"],
                       "datePublished": c["tarih"], "author": {"@id": KISI}})
    veri = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "@id": ADRES + "#sayfa", "url": ADRES, "name": "Koray Öner — Araçlar, Yazılar ve Yayınlar",
         "inLanguage": "tr", "about": {"@id": KISI}, "author": {"@id": KISI},
         "primaryImageOfPage": "https://korayoner.dev/images/hakkimda-koray-oner.jpg",
         "isPartOf": {"@id": "https://korayoner.dev/#website"},
         "breadcrumb": {"@id": ADRES + "#breadcrumb"},
         "mainEntity": {"@type": "ItemList", "numberOfItems": len(ogeler),
                        "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": o} for i, o in enumerate(ogeler)]}},
        {"@type": "BreadcrumbList", "@id": ADRES + "#breadcrumb", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Ana Sayfa", "item": "https://korayoner.dev/"},
            {"@type": "ListItem", "position": 2, "name": "Koray Öner", "item": ADRES}]}]}
    return '<script type="application/ld+json">' + json.dumps(veri, ensure_ascii=False) + "</script>"


def blok(s, ad, icerik):
    bas, bit = "<!-- %s:BASLANGIC -->" % ad, "<!-- %s:BITIS -->" % ad
    i, j = s.find(bas), s.find(bit)
    if i < 0 or j < 0:
        raise SystemExit("Blok işareti yok: " + ad)
    return s[:i + len(bas)] + icerik + s[j:]


def uret(s):
    g, ar, yz, yy, n_arac, n_yazi, n_yayin = govde()
    acik = ("Koray Öner'in çalışmaları tek yerde: %d hesaplama aracı, %d testli yazı, %d DOI'li yayın ve açık kaynak hesap çekirdeği; alanlara ve tarihe göre."
            % (n_arac, n_yazi, n_yayin))
    s = blok(s, "DIZIN-GOVDE", g + "\n    ")
    s = blok(s, "DIZIN-LD", json_ld(ar, yz, yy))
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
            print("Çalışma dizini bayat — 'python tools/calisma-dizini.py' çalıştırın.")
            return 1
        print("Çalışma dizini güncel.")
        return 0
    if yeni != eski:
        io.open(SAYFA, "w", encoding="utf-8", newline="\n").write(yeni)
        print("Çalışma dizini yazıldı.")
    else:
        print("Çalışma dizini zaten güncel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
