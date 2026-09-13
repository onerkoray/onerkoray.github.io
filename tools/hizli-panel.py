# -*- coding: utf-8 -*-
"""Ana sayfadaki hızlı erişim panelini üretir ve doğrular.

NEDEN VAR: "Son eklenenler" listesi elle yazılmıştı ve iki yeni araç
eklendiğinde eskide kaldı — panel "son eklenenler" diyip eskimiş üç satır
gösteriyordu. Elle yazılan bir "son" listesi sessizce yanlışa döner; bu
dosya o listeyi VERİDEN üretiyor.

Tarih kaynağı: sayfanın index.html dosyasının ilk commit'i (git). Dosya
sisteminin mtime'ı güvenilmez — bir dosyaya dokunmak onu "yeni" yapardı.

  python tools/hizli-panel.py           # paneli tazele
  python tools/hizli-panel.py --check   # panel güncel mi
  python tools/hizli-panel.py --liste   # sayfaları tarihleriyle göster

EN ÇOK KULLANILANLAR NEDEN OTOMATİK DEĞİL: o liste kullanım verisi ister.
Analytics verisi derleme anında erişilebilir değil ve olsaydı bile siteyi
dış bir servise bağımlı hale getirirdi. Bu yüzden orası EDİTORYAL kalıyor;
bu dosyanın oradaki tek işi bağlantıların gerçekten var olduğunu
doğrulamak. Panelin başlığı da bu yüzden dürüst: "en çok kullanılanlar"
bir iddia değil, seçilmiş bir liste.
"""
import io
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "index.html")
ADET = 3            # panelde kaç "son eklenen" gösterilecek
ETIKET_SINIR = 30   # bundan uzun etiket panelde kesilir; kısası istenir

# Sitenin kendi bölümleri dışındaki alt projeler panele girmez: onlar ayrı
# ürünler, "yeni araç eklendi" anlamına gelmiyorlar.
HARIC_KOK = {"yayin-ilkeleri", "decorpalette", "keymint", "dither-studio", "images", "tools",
             "node_modules", "_cekirdek", "bordro"}

# Başlığı panele sığmayan sayfalar için kısa etiket. Bir sayfa buraya
# GEREKTİĞİNDE tool HATA VERİR ve adını söyler — sessizce kesilmesindense
# insanın kısa bir ad yazması daha iyi.
KISA = {
    "erken-kapatma-analizi": "Erken kapatma mı, yatırım mı?",
    "borc-mu-birikim-mi": "Borç mu, Birikim mi?",

    "kira-geliri-vergisi-hesaplama": "Kira Geliri Vergisi",
    "borc-kapatma-plani": "Borç Kapatma Planı",
    "makaleler/mevduat-faizi-enflasyon-reel-getiri": "Mevduat ve reel getiri",
    "fatura-olusturma": "Fatura ve Teklif Merkezi",
    "fatura-olusturma/metodoloji": "Fatura metodolojisi",
    "kredi-hesaplama/metodoloji": "Kredi metodolojisi",
    "makaleler/emekli-maasi-nasil-hesaplanir": "Emekli maaşı: yeni sistem mi?",
    "makaleler/uzun-vadeli-yatirim-nasil-yapilir": "Uzun vadeli yatırım",
    "makaleler/stopaj-nasil-hesaplanir": "Stopaj nasıl hesaplanır?",
    "makaleler/zam-net-maasa-ne-kadar-yansir": "Zam nete ne yansır?",
    "makaleler/vergi-kamasi-ucretin-gercek-yuku": "Vergi kaması",
    "finansal-ozgurluk-hesaplama": "Finansal Özgürlük (FIRE)",
    "finansal-ozgurluk-hesaplama/metodoloji": "FIRE metodolojisi",
    "zam-hesaplama": "Zam Hesaplama",
    "zam-hesaplama/metodoloji": "Zam metodolojisi",
    "birikim-hesaplama": "BES ve Birikim Hesaplama",
    "birikim-hesaplama/metodoloji": "Birikim metodolojisi",
    "ev-almak-mi-kiralamak-mi": "Ev almak mı, kiralamak mı?",
    "ev-almak-mi-kiralamak-mi/metodoloji": "Ev/kira metodolojisi",
    "makaleler/kredi-yillik-maliyet-orani": "Yıllık maliyet oranı nedir?",
    "makaleler/proforma-fatura-nedir": "Proforma fatura nedir?",
    "makaleler/kdv-tevkifati-nedir": "KDV tevkifatı nedir?",
    "isveren-maliyeti-hesaplama": "İşveren Maliyeti Hesaplama",
    "calisma-bicimi-karsilastirma": "Çalışma Biçimi Karşılaştırma",
    "serbest-meslek-makbuzu-hesaplama": "Serbest Meslek Makbuzu",
    "vergi-kamasi-hesaplama": "Vergi Kaması Hesaplama",
    "vergi-kamasi-hesaplama/metodoloji": "Vergi kaması metodolojisi",
    "ucret-kar-payi-optimizasyonu": "Ücret–Kâr Payı Optimizasyonu",
    "ucret-kar-payi-optimizasyonu/metodoloji": "Ücret–kâr payı metodolojisi",
}


def adaylar():
    """Panele girebilecek sayfalar: araçlar, metodolojileri ve makaleler."""
    out = []
    for ad in sorted(os.listdir(KOK)):
        yol = os.path.join(KOK, ad)
        if not os.path.isdir(yol) or ad.startswith(".") or ad in HARIC_KOK:
            continue
        if os.path.exists(os.path.join(yol, "index.html")):
            out.append(ad)
        alt = os.path.join(yol, "metodoloji", "index.html")
        if os.path.exists(alt):
            out.append(ad + "/metodoloji")
    mak = os.path.join(KOK, "makaleler")
    if os.path.isdir(mak):
        for ad in sorted(os.listdir(mak)):
            if os.path.exists(os.path.join(mak, ad, "index.html")):
                out.append("makaleler/" + ad)
    return out


def noindex_mi(slug):
    s = io.open(os.path.join(KOK, slug, "index.html"), encoding="utf-8").read()
    return "noindex" in s


def tarih(slug):
    """index.html'in ilk commit'i: (unix zaman, kisa tarih).

    ZAMAN DAMGASI GEREKIYOR, TARIH YETMIYOR. Ilk surum yalnizca gunu
    (--date=short) okuyup esitlik halinde SLUG'a gore siraliyordu. Ayni gun
    birden fazla sayfa yayimlaninca sonuc sessizce yanlis oldu: yeni eklenen
    arac, adi alfabetik olarak asagida kaldigi icin "Son eklenenler"e hic
    girmedi. Panel dogru gorunuyordu ama en yeni sayfayi gizliyordu.
    Sig klonda bos doner (bkz. main).
    """
    yol = os.path.join(slug, "index.html").replace("\\", "/")
    r = subprocess.run(["git", "log", "--diff-filter=A", "--format=%at|%ad",
                        "--date=short", "-1", "--", yol],
                       cwd=KOK, capture_output=True)
    ham = r.stdout.decode("utf-8", "replace").strip()
    if not ham or "|" not in ham:
        return None
    zaman, gun = ham.split("|", 1)
    return (int(zaman), gun)


def etiket(slug):
    if slug in KISA:
        return KISA[slug]
    s = io.open(os.path.join(KOK, slug, "index.html"), encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", s, re.S)
    if not m:
        return None
    t = m.group(1).strip()
    t = re.sub(r"\s*\|\s*Koray Öner\s*$", "", t)
    t = re.split(r"\s+[—–]\s+", t)[0].strip()
    return t


def tur(slug):
    if slug.endswith("/metodoloji"):
        return "Metodoloji"
    if slug.startswith("makaleler/"):
        return "Makale"
    return "Araç"


def toplam():
    """Panele girecek sayfalar, yeniden eskiye.

    İki eleme var ve ikisi de ilk çalıştırmadan sonra eklendi, çünkü ham
    "en yeni üç sayfa" listesi işe yaramaz bir panel üretti:

      - METODOLOJİ SAYFALARI ELENİR. Metodoloji yeni bir şey değil, mevcut
        bir aracın belgesi. Ham liste ilk üçün ikisini metodolojiyle
        doldurmuştu; "son eklenenler"e bakan kişi yeni ARAÇ ve YAZI arıyor.
      - BÖLÜM BAŞINA TEK GİRDİ. Aynı gün üç makale yayımlandığında üçü
        birden paneli kaplıyor ve yeni araçları dışarı itiyordu.
    """
    kayit = []
    for slug in adaylar():
        if slug.endswith("/metodoloji") or noindex_mi(slug):
            continue
        t = tarih(slug)
        if t:
            kayit.append((t, slug))
    # Once zaman damgasina, sonra ada gore: ayni saniyede eklenen iki sayfa
    # icin ad yalnizca KARARLILIK saglar, sirayi belirlemez.
    kayit.sort(key=lambda x: (x[0][0], x[1]), reverse=True)

    gorulen, sonuc = set(), []
    for t, slug in kayit:
        bolum = slug.split("/")[0]
        if bolum in gorulen:
            continue
        gorulen.add(bolum)
        sonuc.append((t, slug))
    return sonuc


def blok(kayit):
    satir = []
    eksik = []
    for t, slug in kayit[:ADET]:
        e = etiket(slug)
        if not e:
            eksik.append(slug + " (başlık okunamadı)")
            continue
        if len(e) > ETIKET_SINIR:
            eksik.append('%s → "%s" (%d karakter, sınır %d)' % (slug, e, len(e), ETIKET_SINIR))
            continue
        satir.append('            <li><a href="%s/"><span>%s</span><em>%s</em></a></li>'
                     % (slug, e, tur(slug)))
    if eksik:
        print("Panele girecek sayfa için kısa etiket gerekiyor "
              "(tools/hizli-panel.py içindeki KISA):", file=sys.stderr)
        for x in eksik:
            print("  - " + x, file=sys.stderr)
        return None
    return ('          <ul class="hq-yeni">\n' + "\n".join(satir) + "\n          </ul>\n")


def panel_yaz(s, yeni):
    i = s.index('          <ul class="hq-yeni">')
    j = s.index("</ul>", i) + len("</ul>\n")
    return s[:i] + yeni + s[j:]


def hizli_baglantilar(s):
    """En çok kullanılanlar listesindeki hedefler gerçekten var mı?"""
    i = s.index('<aside class="hero-quick')
    j = s.index('</aside>', i)
    return re.findall(r'<li><a href="([^"#]+)"', s[i:j])


def main():
    kontrol = "--check" in sys.argv
    s = io.open(SAYFA, encoding="utf-8").read()

    kayit = toplam()
    if not kayit:
        # Sığ klonda (fetch-depth: 1) git geçmişi yok. Sessizce "hepsi
        # güncel" demek yanlış olurdu; açıkça söyleyip duruyoruz.
        print("git geçmişi okunamadı — sığ klon mu? (checkout fetch-depth: 0 gerekir)",
              file=sys.stderr)
        return 1

    if "--liste" in sys.argv:
        for t, slug in kayit[:20]:
            print("%s  %-42s %s" % (t[1], slug, tur(slug)))
        return 0

    # En çok kullanılanlar editoryal; yalnızca bağlantıları doğrulanıyor.
    kirik = [h for h in hizli_baglantilar(s)
             if not os.path.isdir(os.path.join(KOK, h.strip("/")))]
    if kirik:
        print("Panelde kırık bağlantı:", ", ".join(kirik), file=sys.stderr)
        return 1

    yeni = blok(kayit)
    if yeni is None:
        return 1
    guncel = panel_yaz(s, yeni)

    if kontrol:
        if guncel != s:
            print("Panel güncel değil — son eklenenler listesi eskimiş.")
            print("Düzeltmek için: python tools/hizli-panel.py")
            return 1
        print("Panel güncel (%s)." % ", ".join(k[1] for k in kayit[:ADET]))
        return 0

    if guncel != s:
        io.open(SAYFA, "w", encoding="utf-8", newline="").write(guncel)
        print("Panel güncellendi: " + ", ".join(k[1] for k in kayit[:ADET]))
    else:
        print("Panel zaten güncel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
