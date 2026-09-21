# -*- coding: utf-8 -*-
"""Ana sayfadaki hızlı erişim panelini üretir ve doğrular.

NEDEN VAR: "Son eklenenler" listesi elle yazılmıştı ve iki yeni araç
eklendiğinde eskide kaldı — panel "son eklenenler" diyip eskimiş üç satır
gösteriyordu. Elle yazılan bir "son" listesi sessizce yanlışa döner; bu
dosya o listeyi VERİDEN üretiyor.

Tarih kaynağı: sayfanın index.html dosyasının ilk commit'i (git). Dosya
sisteminin mtime'ı güvenilmez — bir dosyaya dokunmak onu "yeni" yapardı.
Yayın: .github/workflows/pages.yml, doğrulama tamamlandıktan sonra paneli
tam Git geçmişinden yeniden üretir ve üretilen index.html'i Pages'e yollar.
Kaynak index.html'deki liste yalnızca yerel önizleme kopyasıdır; canlı liste
için ikinci bir commit veya günlük veri güncellemesini beklemek gerekmez.

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
import html
from pathlib import Path
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, "index.html")
ADET = 3            # panelde kaç "son eklenen" gösterilecek

# Sitenin kendi bölümleri dışındaki alt projeler panele girmez: onlar ayrı
# ürünler, "yeni araç eklendi" anlamına gelmiyorlar.
HARIC_KOK = {"yayin-ilkeleri", "decorpalette", "keymint", "dither-studio", "images", "tools",
             "node_modules", "_cekirdek", "bordro", "makaleler", "hakkimda",
             "iletisim", "gizlilik", "kullanim-kosullari"}

# İsteğe bağlı editoryal kısa başlıklar. Yeni sayfalar bu listeye kayıt
# gerektirmez; HTML başlıkları doğrudan kullanılır ve kartta satıra sarılır.
KISA = {
    "makaleler/bes-devlet-katkisi-ne-kadar-degerli": "Devlet Katkısı Değerli mi?",
    "makaleler/torba-yasa-beklenti-tutuyor-mu": "Beklentiler Tuttu mu?",
    "pesin-mi-taksit-mi": "Peşin mi, Taksit mi?",
    "yatirim-fizibilite-hesaplama": "Yatırım Fizibilitesi",
    "finansal-ikiz": "Finansal İkiz",
    "kisisel-enflasyon": "Kişisel Enflasyon",
    "nakit-akisi-analizi": "Nakit Akışı Analizi",
    "prim-ikramiye-vergisi": "Prim ve İkramiye Vergisi",
    "erken-kapatma-analizi": "Erken kapatma mı, yatırım mı?",
    "borc-mu-birikim-mi": "Borç mu, Birikim mi?",

    "beyanname-hesaplama": "Beyanname gerekir mi?",
    "kira-geliri-vergisi-hesaplama": "Kira Geliri Vergisi",
    "borc-kapatma-plani": "Borç Kapatma Planı",
    "makaleler/tasarruf-kimde-finansman-kimde": "Tasarruf kimde?",
    "makaleler/kredi-tavani-ve-banka-karliligi": "Kredi tavanı tutuyor mu?",
    "makaleler/sgk-prim-tavani-9-kat": "SGK tavanı 9 kat",
    "makaleler/yeniden-degerleme-orani-nedir": "Yeniden değerleme nedir?",
    "makaleler/ikramiye-hangi-ay-odenmeli": "İkramiye hangi ay?",
    "makaleler/kredi-karti-asgari-odeme": "Asgari ödersem ne olur?",
    "makaleler/iki-isten-maas-beyanname-siniri": "İki işten maaş, beyanname?",
    "makaleler/dilim-kaymasi-2022-2026": "Dilim kayması var mı?",
    "makaleler/serbest-meslek-makbuzu-stopaj-kdv": "Makbuzda ne kalıyor?",
    "makaleler/krediyi-erken-kapatmak-mantikli-mi": "Erken kapatmak mantıklı mı?",
    "makaleler/vergi-dilimleri-asgari-ucrete-yetisemiyor": "Dilimler ve asgari ücret",
    "makaleler/mtv-2026-ne-kadar": "2026 MTV ne kadar?",
    "makaleler/emekliligin-finansal-matematigi": "Emekliliğin matematiği",
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
    s = Path(KOK, slug, "index.html").read_text(encoding="utf-8")
    return "noindex" in s


def tarih(slug):
    """index.html'in ilk commit'i: (unix zaman, kisa tarih).

    ZAMAN DAMGASI GEREKIYOR, TARIH YETMIYOR. Ilk surum yalnizca gunu
    (--date=short) okuyup esitlik halinde SLUG'a gore siraliyordu. Ayni gun
    birden fazla sayfa yayimlaninca sonuc sessizce yanlis oldu: yeni eklenen
    arac, adi alfabetik olarak asagida kaldigi icin "Son eklenenler"e hic
    girmedi. Panel dogru gorunuyordu ama en yeni sayfayi gizliyordu.
    Sığ klon, kök commit'teki dosyaları yeni sanabilir; main bunu reddeder.
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
    s = Path(KOK, slug, "index.html").read_text(encoding="utf-8")
    m = re.search(r"<title>(.*?)</title>", s, re.S)
    if not m:
        return None
    t = html.unescape(m.group(1)).strip()
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
    """Yeni araç ve makaleler, tür kotası olmadan yayın sırasına göre."""
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

    return kayit


def blok(kayit):
    satir = []
    eksik = []
    for t, slug in kayit[:ADET]:
        e = etiket(slug)
        if not e:
            eksik.append(slug + " (başlık okunamadı)")
            continue
        satir.append('            <li><a href="%s/"><span>%s</span><em>%s</em></a></li>'
                     % (html.escape(slug, quote=True), html.escape(e), tur(slug)))
    if eksik:
        print("Panele girecek sayfanın başlığı okunamadı:", file=sys.stderr)
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
    gecmis = subprocess.run(["git", "rev-parse", "--is-shallow-repository"],
                             cwd=KOK, capture_output=True, text=True)
    if gecmis.returncode != 0 or gecmis.stdout.strip() != "false":
        print("Tam Git geçmişi gerekli (checkout fetch-depth: 0).", file=sys.stderr)
        return 1
    s = Path(SAYFA).read_text(encoding="utf-8")

    kayit = toplam()
    if not kayit:
        print("Git geçmişinde yayımlanmış araç veya makale bulunamadı.",
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
        Path(SAYFA).write_text(guncel, encoding="utf-8", newline="")
        print("Panel güncellendi: " + ", ".join(k[1] for k in kayit[:ADET]))
    else:
        print("Panel zaten güncel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
