# -*- coding: utf-8 -*-
"""Favicon'ları tools/card-icons.json'dan üretir ve doğrular.

NEDEN YENİDEN YAZILDI (2026-09-13)
----------------------------------
Önceki sürüm her favicon'u "gradyanlı yeşil, rx=14 yuvarlak kare + beyaz
çizgi sembol" olarak üretiyordu. Üç sorun ölçüldü:

1. 16 PİKSELDE KAP SEMBOLÜ YUTUYORDU. Sekme şeridi favicon'u 16 pikselde
   çiziyor. Kap o 256 pikselin tamamını kaplarken sembol ortadaki 48x48'e
   sıkışıyordu; KDV, maaş ve kredi sekmede birbirinden ayırt edilemiyordu.
   Araca özgü çizim, tam da görünmesi gereken boyutta kayboluyordu.

2. YEŞİL, BEŞ PALETİN DÖRDÜYLE ÇELİŞİYORDU. Site vurgu rengi kullanıcı
   tarafından seçiliyor (data-accent: yeşil, mavi, mor, turuncu, gül).
   "Gül" seçen biri pembe bir sitede yeşil sekme simgesi görüyordu.

3. GRADYAN VE rx=14, style.css sonundaki editoryal katmanın siteden
   bilerek söktüğü "arkadaş canlısı SaaS" diliydi.

YENİ ÇÖZÜM: NÖTR MÜREKKEP KAP, OYULMUŞ SEMBOL
---------------------------------------------
  - Kap mürekkep rengi: hiçbir paletle çatışmaz, her ikisinde de nötr.
  - Köşe 2px — editoryal katmanla aynı yarıçap.
  - Sembol çizgi değil OYUK: 16 pikselde kütle olarak okunur, çizgi gibi
    dağılmaz.
  - prefers-color-scheme ile mürekkep ve kâğıt yer değiştirir; koyu sekme
    şeridinde de görünür kalır. (Eski sürüm iki temada da aynı yeşildi.)
  - Alt kenardaki ince çubuk vurgu rengini taşır. Statik dosyada varsayılan
    yeşil; script.js sayfa açılırken kullanıcının seçtiği palete göre
    favicon'u değiştirir.

VURGU ÇUBUĞU SEMBOLLE ÇAKIŞMIYOR
--------------------------------
İlk denemede vurgu sağ alt köşeye kare olarak konmuştu ve bazı sembollerin
(kredi, finansal ikiz) üstüne biniyordu. Sembol translate(4 3) ile 3..27
aralığına, çubuk ise 27.5'ten sonrasına yerleştirildi; ikisi komşu, üst üste
değil.

ÇİZGİ KALINLIĞI
---------------
Kart ikonları 24x24 kutuda stroke-width 2 ile çizilir. Burada kutu yine 24
ama kalınlık 2.4'e çıkarıldı: oyuk sembol koyu zeminde ince görünür ve 16
piksele indiğinde kaybolur. 2.4, 16 pikselde 1.2 efektif kalınlık demek.

ALT PROJELER BU SİSTEME GİRMEZ
------------------------------
decorpalette ve keymint sitenin hesaplama araçları değil, altında yayımlanan
ayrı ürünler. Kendi işaretleri var ve olmalı: decorpalette'in paleti üç
renkli noktayla ANLAM taşıyor, onu tek renge indirmek bilgiyi silmek olurdu.

    python tools/favikon.py           # favicon'ları üret
    python tools/favikon.py --check   # kaynakla aynı mı
"""
import io
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, "tools", "card-icons.json")

# style.css'teki --text / --bg değerleri. Burada değişirse favicon sitenin
# geri kalanından ayrışır.
MUREKKEP = "#17201d"
KAGIT = "#f5f7f6"
KOYU_MUREKKEP = "#e8eceb"
KOYU_KAGIT = "#14181d"
VARSAYILAN_VURGU = "#0e7c66"      # style.css --accent (yeşil)
YARICAP = 2                        # editoryal katmanla aynı

ALT_PROJELER = {"decorpalette", "keymint"}

# card-icons.json'da olmayan ama kendi simgesini hak eden bölümler.
# Semboller 24x24 kutuda, stroke ile çizilir (kart ikonlarıyla aynı dil).
EK_BOLUMLER = {
    # Makaleler: tek tek yazıların değil BÖLÜMÜN işareti. Yazılar araç
    # değil; her birine ayrı sembol uydurmak, aralarında olmayan bir
    # ayrımı varmış gibi gösterirdi.
    "makaleler": {
        "ad": "Makaleler",
        "svg": '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
    },
    # Bordro: metodoloji merkezi. Açık çekirdeği temsilen katmanlar.
    "bordro": {
        "ad": "Bordro Motoru metodolojisi",
        "svg": '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M2 14l10 5 10-5"/>',
    },
}

SABLON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="%(ad)s">
  <style>
    .fv-kap { fill: %(murekkep)s }
    .fv-sem { stroke: %(kagit)s }
    @media (prefers-color-scheme: dark) {
      .fv-kap { fill: %(kmurekkep)s }
      .fv-sem { stroke: %(kkagit)s }
    }
  </style>
  <rect class="fv-kap" width="32" height="32" rx="%(r)d"/>
  <g class="fv-sem" transform="translate(4 3)" fill="none" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round">%(sembol)s</g>
  <rect class="fv-vurgu" x="4" y="27.5" width="24" height="3" rx="1.5" fill="%(vurgu)s"/>
</svg>
"""


def sembol(svg):
    """Kart ikonunun İÇİNİ alır; dış <svg> etiketi atılır."""
    i = svg.index(">") + 1
    j = svg.rindex("</svg>")
    return svg[i:j].strip()


def baslik(slug):
    """Bölümün kendi sayfa başlığı — aria-label için."""
    yol = os.path.join(KOK, slug, "index.html")
    if not os.path.exists(yol):
        return slug
    s = io.open(yol, encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", s, re.S)
    if not m:
        return slug
    return re.sub(r"\s*\|\s*Koray Öner\s*$", "", m.group(1).strip())


def ciz(ad, ic, vurgu=VARSAYILAN_VURGU):
    return SABLON % {
        "ad": ad, "sembol": ic, "r": YARICAP, "vurgu": vurgu,
        "murekkep": MUREKKEP, "kagit": KAGIT,
        "kmurekkep": KOYU_MUREKKEP, "kkagit": KOYU_KAGIT,
    }


def yerel_favicon_kullaniyor(slug):
    """Sayfa gerçekten yerel favicon.svg'ye bağlanıyor mu.

    Bağlanmayan bir dizine dosya üretmek ölü dosya bırakırdı.
    """
    yol = os.path.join(KOK, slug, "index.html")
    if not os.path.exists(yol):
        return False
    return 'href="favicon.svg' in io.open(yol, encoding="utf-8").read()


def uret():
    ikon = json.load(io.open(KAYNAK, encoding="utf-8"))
    cikti = {}
    for slug in sorted(ikon):
        if slug in ALT_PROJELER or not yerel_favicon_kullaniyor(slug):
            continue
        cikti[slug] = ciz(baslik(slug), sembol(ikon[slug]["svg"]))
    for slug, tanim in EK_BOLUMLER.items():
        if not yerel_favicon_kullaniyor(slug):
            continue
        cikti[slug] = ciz(baslik(slug) or tanim["ad"], tanim["svg"])
    # Kök marka: </> işareti. Aynı kabı kullanır ki hakkımda, iletişim ve
    # yasal sayfalar da aynı aileden görünsün.
    cikti[""] = ciz("Koray Öner",
                    '<path d="M8 6 3 12l5 6"/><path d="M16 6l5 6-5 6"/>'
                    '<path d="M14.5 4 9.5 20"/>')
    return cikti


def main():
    kontrol = "--check" in sys.argv
    cikti = uret()
    if len(cikti) < 10:
        print("Beklenenden az favicon (%d) — kaynak mı değişti?" % len(cikti),
              file=sys.stderr)
        return 1

    eksik, farkli, yazilan = [], [], []
    for slug, yeni in sorted(cikti.items()):
        yol = os.path.join(KOK, slug, "favicon.svg") if slug else os.path.join(KOK, "favicon.svg")
        var = io.open(yol, encoding="utf-8").read() if os.path.exists(yol) else None
        ad = slug or "(kök)"
        if var is None:
            eksik.append(ad)
        elif var != yeni:
            farkli.append(ad)
        if not kontrol and var != yeni:
            io.open(yol, "w", encoding="utf-8", newline="").write(yeni)
            yazilan.append(ad)

    if kontrol:
        if eksik or farkli:
            if eksik:
                print("Favicon eksik: " + ", ".join(eksik))
            if farkli:
                print("Favicon kaynakla uyuşmuyor: " + ", ".join(farkli))
            print("Düzeltmek için: python tools/favikon.py")
            return 1
        print("Favicon'lar güncel (%d bölüm)." % len(cikti))
        return 0

    if yazilan:
        print("Favicon üretildi (%d/%d)." % (len(yazilan), len(cikti)))
        for a in yazilan[:8]:
            print("  - " + a)
        if len(yazilan) > 8:
            print("  ... +%d" % (len(yazilan) - 8))
    else:
        print("Favicon'lar zaten güncel (%d bölüm)." % len(cikti))
    return 0


if __name__ == "__main__":
    sys.exit(main())
