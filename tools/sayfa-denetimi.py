#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sayfa kalitesi denetimi: kırık bağlantı, meta, görsel, başlık düzeni, sitemap.

Neden: bunlar sessiz hatalardır. Kırık bir iç bağlantı, 60 karakteri aşan bir
başlık ya da h1'den h3'e atlayan bir başlık düzeni hiçbir yerde hata vermez;
sayfa açılır, her şey çalışıyor görünür. Elle bakıldığında da gözden kaçar.

Denetlenenler:
  1. İç bağlantı ve kaynak bütünlüğü (href/src)
  2. <title> var mı, 60 karakteri aşıyor mu, tekrar ediyor mu
     (60 sınırı: aşınca Google SERP'te "| Koray Öner" ekini kesiyor)
  3. meta description var mı, uzunluğu makul mü, tekrar ediyor mu
  4. canonical var mı
  5. Görsellerde alt ve width/height (CLS)
  6. Tek h1 ve başlık seviyesi atlaması
  7. Sitemap ile gerçek sayfaların örtüşmesi

Kullanım:
    python tools/sayfa-denetimi.py          # bulguları listele
    python tools/sayfa-denetimi.py --check  # bulgu varsa hata ver (CI)
"""

import io
import collections
import json
import os
import re
import sys
import glob
from html.parser import HTMLParser

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

# Denetim dışı sayfalar. Bunların başlığı, canonical'ı ya da sitemap kaydı
# OLMAMALIDIR; kural ihlali değil, tasarım gereğidir:
#   - 404 sayfaları: dizine girmemeli
#   - Google Search Console doğrulama dosyası: içeriği değiştirilemez
def denetim_disi(p):
    ad = p.split("/")[-1]
    return ad == "404.html" or ad.startswith("google") and ad.endswith(".html")

TITLE_SINIR = 60
DESC_ALT, DESC_UST = 70, 165


def sayfalari_bul():
    bulunan = set()
    for desen in ("*.html", "*/*.html", "*/*/*.html", "*/*/*/*.html"):
        for p in glob.glob(desen):
            p = p.replace(os.sep, "/")
            if p.split("/")[0] in ("tools", "images", "node_modules"):
                continue
            bulunan.add(p)
    return sorted(bulunan)


def oku(p):
    return io.open(p, encoding="utf-8").read()


class Basliklar(HTMLParser):
    def __init__(self):
        super().__init__()
        self.seviye = []
        self._metin = []
        self._aktif = None

    def handle_starttag(self, t, a):
        if t in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._aktif = int(t[1])
            self._metin.append("")

    def handle_data(self, d):
        if self._aktif and self._metin:
            self._metin[-1] += d

    def handle_endtag(self, t):
        if t in ("h1", "h2", "h3", "h4", "h5", "h6") and self._aktif:
            self.seviye.append((self._aktif, re.sub(r"\s+", " ", self._metin[-1]).strip()[:44]))
            self._aktif = None


def main():
    sayfalar = sayfalari_bul()
    bulgular = []

    def bulgu(tur, sayfa, detay=""):
        bulgular.append((tur, sayfa, detay))

    # Site geneli sema toplayicilari (bkz. 8)
    # Olcum kimligi toplayicisi (bkz. 10)
    olcum_kimlikleri = collections.defaultdict(list)
    gtag_sayisi = {}

    sema_tekil = collections.defaultdict(list)
    sema_person = set()
    sema_website = set()


    basliklar, aciklamalar = {}, {}

    for p in sayfalar:
        s = oku(p)
        dizin = os.path.dirname(p)

        # 1) bağlantı ve kaynak bütünlüğü
        hedefler = set(re.findall(r'href="([^"]+)"', s)) | set(re.findall(r'src="([^"]+)"', s))
        for href in hedefler:
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:", "//")):
                continue
            yol = href.split("#")[0].split("?")[0]
            if not yol:
                continue
            taban = "" if yol.startswith("/") else dizin
            hedef = os.path.normpath(os.path.join(taban, yol.lstrip("/")))
            if not (os.path.exists(hedef) or os.path.exists(os.path.join(hedef, "index.html"))):
                bulgu("KIRIK BAGLANTI", p, href)

        # 1b) yapisal ve guvenlik kontrolleri
        # Bu dort sinif denetim disindaydi ve elle yapilan taramada bulundu;
        # buraya alindi ki bir daha sessizce girmesinler.
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
            try:
                veri = json.loads(m.group(1))
            except Exception as e:
                bulgu("JSON-LD BOZUK", p, str(e)[:60])
                continue
            # Site geneli sema kimligi: asagida (8) toplu degerlendiriliyor.
            dugumler = veri.get("@graph", [veri]) if isinstance(veri, dict) else veri
            for d in dugumler:
                if not isinstance(d, dict):
                    continue
                tur = d.get("@type")
                if isinstance(tur, list):
                    tur = "/".join(str(x) for x in tur)
                if tur == "ProfilePage":
                    sema_tekil[tur].append(p)
                if tur == "WebSite":
                    sema_website.add((d.get("@id"), d.get("url"), d.get("name")))
                if tur == "Person" and d.get("@id"):
                    sema_person.add(d["@id"])

        # Analitik etiketi: eksikse o sayfanin trafigi hic gorunmez,
        # fazlaysa sayfa goruntulemesi ikiye katlanir. Ikisi de sessiz.
        bulunan = re.findall(r'gtag/js\?id=(G-[A-Z0-9]+)', s)
        gtag_sayisi[p] = len(bulunan)
        for g in set(bulunan):
            olcum_kimlikleri[g].append(p)

        kimlikler = re.findall(r'\sid="([^"]+)"', s)
        for kimlik, adet in collections.Counter(kimlikler).items():
            if adet > 1:
                bulgu("TEKRARLI ID", p, "id=%s (%d kez)" % (kimlik, adet))

        for m in re.finditer(r'<a[^>]*target="_blank"[^>]*>', s):
            if "noopener" not in m.group(0):
                bulgu("BLANK NOOPENER YOK", p, m.group(0)[:60])

        # http:// yalnizca ALT KAYNAK icin sorun (karisik icerik). Disa giden
        # baglanti degil: Kandilli'nin https karsiligi yok, o bilincli kaldi.
        for m in re.finditer(r'src="(http://[^"]+)"', s):
            bulgu("HTTP KAYNAK", p, m.group(1)[:60])

        if denetim_disi(p):
            continue

        # 2) title
        m = re.search(r"<title>(.*?)</title>", s, re.S)
        if not m:
            bulgu("TITLE YOK", p)
        else:
            t = re.sub(r"\s+", " ", m.group(1)).strip()
            if len(t) > TITLE_SINIR:
                bulgu("TITLE UZUN", p, "%d karakter (sinir %d)" % (len(t), TITLE_SINIR))
            basliklar.setdefault(t, []).append(p)

        # 3) description
        d = re.search(r'<meta name="description" content="([^"]*)"', s)
        if not d:
            bulgu("DESCRIPTION YOK", p)
        else:
            dt = d.group(1).strip()
            if len(dt) > DESC_UST:
                bulgu("DESCRIPTION UZUN", p, "%d karakter (ust %d)" % (len(dt), DESC_UST))
            elif len(dt) < DESC_ALT:
                bulgu("DESCRIPTION KISA", p, "%d karakter (alt %d)" % (len(dt), DESC_ALT))
            aciklamalar.setdefault(dt, []).append(p)

        # 4) canonical
        if not re.search(r'<link rel="canonical"', s):
            bulgu("CANONICAL YOK", p)

        # 5) görseller
        for tag in re.findall(r"<img\b[^>]*>", s):
            if "alt=" not in tag:
                bulgu("IMG ALT YOK", p, tag[:80])
            if ("width=" not in tag or "height=" not in tag) and "aria-hidden" not in tag:
                bulgu("IMG BOYUT YOK", p, tag[:80])

        # 6) başlık düzeni
        b = Basliklar()
        b.feed(s)
        h1 = [x for x in b.seviye if x[0] == 1]
        if len(h1) == 0:
            bulgu("H1 YOK", p)
        elif len(h1) > 1:
            bulgu("BIRDEN FAZLA H1", p, "%d adet" % len(h1))
        onceki = None
        for lvl, metin in b.seviye:
            if onceki is not None and lvl > onceki + 1:
                bulgu("BASLIK ATLAMASI", p, "h%d -> h%d (%s)" % (onceki, lvl, metin))
            onceki = lvl

    for t, ps in basliklar.items():
        if len(ps) > 1:
            bulgu("TITLE TEKRAR", ", ".join(ps), t[:60])
    for d, ps in aciklamalar.items():
        if len(ps) > 1:
            bulgu("DESCRIPTION TEKRAR", ", ".join(ps), d[:60])

    # 7) sitemap kapsamı
    #
    # noindex sayfalar bu kuralın dışındadır ve KURALI TERSİNE ÇEVİRİR:
    # "dizine girme" diyen bir sayfayı sitemap'e koymak Google'a çelişkili iki
    # sinyal göndermek olur. Bu yüzden noindex sayfa sitemap'te OLMAMALIDIR;
    # varsa bulgu üretilir.
    if os.path.exists("sitemap.xml"):
        sm = oku("sitemap.xml")
        sm_urls = set(re.findall(r"<loc>https://korayoner\.dev/(.*?)</loc>", sm))
        sayfa_urls = set()
        noindex_urls = set()
        for p in sayfalar:
            if denetim_disi(p):
                continue
            if p.endswith("/index.html"):
                u = p[: -len("index.html")]
            elif p == "index.html":
                u = ""
            else:
                u = p
            if re.search(r'<meta[^>]+name="robots"[^>]*noindex', oku(p), re.I):
                noindex_urls.add(u)
            else:
                sayfa_urls.add(u)
        for u in sorted(sayfa_urls - sm_urls):
            bulgu("SITEMAP EKSIK", u or "(ana sayfa)")
        for u in sorted(sm_urls - sayfa_urls - noindex_urls):
            bulgu("SITEMAP FAZLA", u, "sayfa dosyasi yok")
        for u in sorted(sm_urls & noindex_urls):
            bulgu("SITEMAP CELISKI", u, "sayfa noindex ama sitemap'te")

    # 8) CNAME dosyası — taşıyıcı, silinirse site ikiye bölünür
    #
    # Site Vercel'de yayınlanıyor ama depoda GitHub Pages hâlâ açık. Pages'i
    # ayakta tutan tek şey CNAME dosyası: onu görünce onerkoray.github.io'yu
    # korayoner.dev'e 301'liyor ve kendi kopyasını SUNMUYOR.
    #
    # CNAME silinirse Pages sitenin tamamını onerkoray.github.io altında
    # yayınlamaya başlar: her sayfanın ikinci bir kopyası, kendi canonical'ı
    # başka alan adını gösterirken. Bu, bir alan adı taşımasında yapılabilecek
    # en pahalı hatadır ve hiçbir yerde hata vermez — site çalışmaya devam eder.
    if not os.path.exists("CNAME"):
        bulgu("CNAME YOK", "CNAME",
              "GitHub Pages siteyi onerkoray.github.io altinda kopyalayacak")
    else:
        cname = oku("CNAME").strip()
        if cname != "korayoner.dev":
            bulgu("CNAME YANLIS", "CNAME",
                  "beklenen korayoner.dev, bulunan: " + (cname or "(bos)"))

    # 9) site geneli şema tutarlılığı
    #
    # Bu üç kural elle bulunması imkânsız hatalara karşı. Ana sayfa hem kendini
    # ProfilePage ilan ediyordu hem de /hakkimda/ aynı şeyi söylüyordu; site
    # Google'a "bu kişinin iki profil sayfası var" diyordu ve Google birini
    # seçip diğerini "kopya, farklı standart sayfa" olarak işaretledi.
    # Aynı biçimde tek alan adı altında iki WebSite düğümü site kimliğini böler.
    # WEBSITE KURALI DEĞİŞTİ — sayım değil TUTARLILIK.
    # Eski hâli "site genelinde en fazla bir WebSite düğümü" diyordu ve
    # ProfilePage kuralından analojiyle yazılmıştı. Analoji tutmuyor:
    # iki ProfilePage, iki AYRI sayfanın aynı rolü üstlenmesidir (gerçek
    # çakışma). Aynı WebSite düğümünün her sayfada tekrarlanması ise tek bir
    # varlığın tekrar tekrar BEYAN EDİLMESİDİR ve JSON-LD'de @id atıfları
    # sayfa grafiği içinde çözüldüğü için gereklidir: düğüm yoksa o sayfadaki
    # "isPartOf" hiçbir şeye bağlanmaz. Yaygın eklentiler (Yoast, RankMath)
    # da bu yüzden düğümü her sayfaya basar.
    # Asıl tehlike -- site kimliğinin bölünmesi -- ancak düğümler BİRBİRİNDEN
    # FARKLIYSA doğar; kural artık tam olarak onu arıyor.
    if len(sema_website) > 1:
        bulgu("SEMA CAKISMASI", "site geneli",
              "%d farkli WebSite kimligi: %s"
              % (len(sema_website), " | ".join(sorted(str(x) for x in sema_website))))

    for tur, sinir, aciklama in (
        ("ProfilePage", 1, "kişinin tek bir profil sayfası olmalı"),
    ):
        yerler = sema_tekil.get(tur, [])
        if len(yerler) > sinir:
            bulgu("SEMA CAKISMASI", ", ".join(sorted(yerler)),
                  "%d adet %s - %s" % (len(yerler), tur, aciklama))

    if len(sema_person) > 1:
        bulgu("SEMA KIMLIK COKLU", "site geneli",
              "Person @id tutarsiz: " + ", ".join(sorted(sema_person)))

    # 10) analitik etiketi
    #
    # Beklenen: her denetlenen sayfada TAM BIR gtag blogu ve site genelinde
    # TEK bir olcum kimligi. Ucu de bir kez bozuldu; bu kural o gunu
    # tekrar etmesin diye burada.
    beklenen = [x for x in sayfalar if not denetim_disi(x)]
    if len(olcum_kimlikleri) > 1:
        for g, ps in sorted(olcum_kimlikleri.items()):
            bulgu("OLCUM KIMLIGI COKLU", ", ".join(sorted(ps)[:3]),
                  "%s (%d sayfa)" % (g, len(ps)))
    for p2 in beklenen:
        adet = gtag_sayisi.get(p2, 0)
        if adet == 0:
            bulgu("ANALITIK YOK", p2, "sayfanin trafigi olculmuyor")
        elif adet > 1:
            bulgu("GTAG TEKRARI", p2, "%d kez yuklenmis" % adet)

    # 11) ana sayfa kategori filtresi
    #
    # Kart filtresi TAM ESITLIK ile calisiyor (cat === activeCat). Bir kartin
    # data-cat degeri hicbir chip'in data-filter degeriyle eslesmiyorsa o kart
    # "Tumu" disinda HICBIR filtrede gorunmez. Sayfa bozulmadigi icin bu
    # sessizce yasar: kredi araci tam olarak boyle kaybolmustu
    # (data-cat="finans", boyle bir chip yok).
    kok_html = os.path.join(KOK, "index.html")
    if os.path.exists(kok_html):
        h = io.open(kok_html, encoding="utf-8").read()
        kategoriler = set(re.findall(r'data-cat="([a-z]+)"', h))
        filtreler = set(re.findall(r'data-filter="([a-z]+)"', h)) - {"hepsi"}
        for c in sorted(kategoriler - filtreler):
            bulgu("KATEGORI FILTRESIZ", "index.html",
                  '"%s" kategorisinde kart var ama o filtre yok' % c)
        for f in sorted(filtreler - kategoriler):
            bulgu("FILTRE BOS", "index.html",
                  '"%s" filtresi hicbir karti gostermiyor' % f)

    # 12) sitenin KENDINI ilan ettigi adresler https ve dogru alan adi mi
    #
    # onerkoray.github.io -> korayoner.dev yonlendirmesi iki adim: GitHub
    # once http://korayoner.dev'e gonderiyor (kendi sertifikasi olmadigi
    # icin), Vercel oradan https'e cikiyor. O ilk adim bizim elimizde degil.
    # Elimizde olan sey, SITENIN KENDI beyanlarina http:// ya da eski alan
    # adinin hic girmemesi: canonical, og:url ve site haritasi Google'a
    # "dogru adres bu" diyen yerler. Oralara bir http:// sizarsa yonlendirme
    # zinciri uzar ve kanonik sinyal bolunur -- sayfa yine acildigi icin de
    # kimse fark etmez.
    beyanlar = [
        (r'rel="canonical"\s+href="([^"]+)"', "canonical"),
        (r'property="og:url"\s+content="([^"]+)"', "og:url"),
    ]
    for p3 in sayfalar:
        if denetim_disi(p3):
            continue
        s3 = io.open(os.path.join(KOK, p3), encoding="utf-8").read()
        for kalip, ad in beyanlar:
            for u in re.findall(kalip, s3):
                if u.startswith("http://"):
                    bulgu("BEYAN HTTP", p3, "%s: %s" % (ad, u))
                elif "onerkoray.github.io" in u:
                    bulgu("BEYAN ESKI ALAN", p3, "%s: %s" % (ad, u))

    for ad3, yol3 in (("sitemap.xml", "sitemap.xml"), ("atom.xml", "atom.xml")):
        t3 = os.path.join(KOK, yol3)
        if not os.path.exists(t3):
            continue
        icerik3 = io.open(t3, encoding="utf-8").read()
        if "http://korayoner" in icerik3 or "http://onerkoray" in icerik3:
            bulgu("BEYAN HTTP", ad3, "http:// adres iceriyor")
        if "onerkoray.github.io" in icerik3:
            bulgu("BEYAN ESKI ALAN", ad3, "eski alan adi iceriyor")

    # 13) paylasim kart gorseli GERCEKTEN var mi ve beyan dogru mu
    #
    # paylasim-meta.py etiketlerin VAR OLDUGUNU denetliyor; dosyanin
    # kendisini kimse denetlemiyordu. Eksik ya da yanlis boyutlu bir kart
    # gorseli sayfayi bozmaz -- yalnizca X/WhatsApp/LinkedIn onizlemesi
    # gorselsiz cikar ve bu ancak paylasildiginda fark edilir. Sessiz hata
    # tanimina birebir uyuyor.
    #
    # Boyut da denetleniyor: og:image:width/height dosyayla uyusmazsa
    # bazi tarayicilar gorseli hic almiyor.
    try:
        from PIL import Image as _Img
    except Exception:
        _Img = None

    for p4 in sayfalar:
        if denetim_disi(p4):
            continue
        s4 = io.open(os.path.join(KOK, p4), encoding="utf-8").read()
        adresler = re.findall(
            r'(?:og:image|twitter:image)"\s+content="https://korayoner[.]dev/([^"]+)"', s4)
        for rel in set(adresler):
            hedef4 = os.path.join(KOK, rel.replace("/", os.sep))
            if not os.path.exists(hedef4):
                bulgu("KART GORSELI YOK", p4, rel)
                continue
            if _Img is None:
                continue
            g = re.search(r'og:image:width"\s+content="([0-9]+)"', s4)
            y = re.search(r'og:image:height"\s+content="([0-9]+)"', s4)
            if not (g and y):
                continue
            try:
                gw, gh = _Img.open(hedef4).size
            except Exception:
                bulgu("KART GORSELI OKUNAMIYOR", p4, rel)
                continue
            if (gw, gh) != (int(g.group(1)), int(y.group(1))):
                bulgu("KART GORSEL BOYUTU", p4,
                      "%s gercek %dx%d, beyan %sx%s" % (rel, gw, gh, g.group(1), y.group(1)))

    # 14) CSP connect-src'deki her dis sunucu gizlilik sayfasinda yazili mi
    #
    # Site "verileriniz cihazinizdan cikmaz" diyor; bu dogru ama TAM degil:
    # birkac sayfa dis API cagiriyor ve her fetch, karsi tarafa ziyaretcinin
    # IP adresini birakir. Gizlilik sayfasi bunlari tek tek sayiyor.
    #
    # Risk sessiz: CSP'ye yeni bir sunucu eklemek bir satirlik is, gizlilik
    # sayfasini guncellemeyi unutmak ise hicbir hataya yol acmaz -- sadece
    # beyan ile gercek ayrisir. Bu kural o ikisini birbirine bagliyor.
    vercel_yol = os.path.join(KOK, "vercel.json")
    gizlilik_yol = os.path.join(KOK, "gizlilik", "index.html")
    if os.path.exists(vercel_yol) and os.path.exists(gizlilik_yol):
        vj = io.open(vercel_yol, encoding="utf-8").read()
        gz = io.open(gizlilik_yol, encoding="utf-8").read()
        m5 = re.search(r'connect-src ([^"]+)', vj)
        if m5:
            sunucular = re.findall(r"https://([a-z0-9.-]+[.][a-z]{2,})", m5.group(1))
            # Google'in olcum sunuculari gizlilikte "Google Analytics" basligi
            # altinda anlatiliyor; host adiyla degil hizmet adiyla.
            muaf = {"www.google-analytics.com", "region1.google-analytics.com"}
            for h in sorted(set(sunucular) - muaf):
                if h not in gz:
                    bulgu("GIZLILIKTE YOK", "gizlilik/index.html",
                          "CSP connect-src'de izinli ama sayfada yazmiyor: " + h)

    # 15) CSP betik hash'i sayfalardaki satir ici betikle uyusuyor mu
    #
    # script-src'den 'unsafe-inline' kaldirildi; satir ici gtag blogu artik
    # SHA-256 hash'iyle izinli. Bu CSP'yi belirgin sekilde sertlestiriyor
    # ama bir tuzak yaratiyor: gtag blogunda tek bir bosluk degisirse hash
    # tutmaz, tarayici betigi calistirmaz ve ANALITIK BUTUN SITEDE SESSIZCE
    # DURUR. Sayfa acilmaya devam ettigi icin kimse fark etmez.
    #
    # Bu kural hash'i sayfalardan yeniden hesaplayip CSP ile karsilastiriyor.
    if os.path.exists(vercel_yol):
        vj2 = io.open(vercel_yol, encoding="utf-8").read()
        m6 = re.search(r'script-src ([^"]+)', vj2)
        if m6 and "'unsafe-inline'" not in m6.group(1):
            import hashlib, base64
            hashler = set(re.findall(r"'(sha256-[A-Za-z0-9+/=]+)'", m6.group(1)))
            govdeler = set()
            for p6 in sayfalar:
                if denetim_disi(p6):
                    continue
                s6 = io.open(os.path.join(KOK, p6), encoding="utf-8").read()
                for mm in re.finditer(r"<script(?![^>]*src=)([^>]*)>(.*?)</script>", s6, re.S):
                    tp = re.search(r'type="([^"]+)"', mm.group(1))
                    if tp and "json" in tp.group(1):
                        continue   # ld+json calistirilmaz, script-src kapsaminda degil
                    d6 = hashlib.sha256(mm.group(2).encode("utf-8")).digest()
                    govdeler.add("sha256-" + base64.b64encode(d6).decode())
            for g6 in sorted(govdeler - hashler):
                bulgu("CSP HASH TUTMUYOR", "vercel.json",
                      "sayfalarda izinsiz satir ici betik var: " + g6)
            for h6 in sorted(hashler - govdeler):
                bulgu("CSP HASH ARTIK", "vercel.json",
                      "CSP'de karsiligi olmayan hash: " + h6)

    # rapor
    print("%d sayfa tarandi, %d bulgu" % (len(sayfalar), len(bulgular)))
    if not bulgular:
        print("Temiz.")
        return 0
    print("")
    gruplar = {}
    for tur, sayfa, detay in bulgular:
        gruplar.setdefault(tur, []).append((sayfa, detay))
    for tur in sorted(gruplar, key=lambda t: -len(gruplar[t])):
        print("### %s (%d)" % (tur, len(gruplar[tur])))
        for sayfa, detay in gruplar[tur][:15]:
            print("   %-54s %s" % (sayfa, detay))
        if len(gruplar[tur]) > 15:
            print("   ... +%d tane daha" % (len(gruplar[tur]) - 15))
        print("")
    return 1


kod = main()
if "--check" in sys.argv:
    sys.exit(kod)
