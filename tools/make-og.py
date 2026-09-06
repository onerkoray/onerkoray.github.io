#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1200x630 paylasim (OG) kapaklarini uretir.

NEDEN BU HALDE
--------------
Ilk surum tek sablondu: her sayfa ayni yesil gradyan, ayni iki satir baslik,
ayni "Ucretsiz / Reklamsiz" rozet dizisi. 74 sayfanin karti birbirinin ayniydi;
akista ust uste iki link paylasildiginda ikisi tek gorsel gibi okunuyordu.
Paylasim karti dikkat cekmek icindir; tekrar dikkati oldurur.

Cozum bir "kart sistemi": marka imzasi SABIT kalir (logo rozeti, alan adi
satiri, Koray Oner kunyesi), geri kalan her sey DEGISIR.

  palet   -> sayfanin ailesine gore (renk bilgi tasir, rastgele degil)
  duzen   -> aile icinde sirayla dagitilir (ayni renkte iki kart ayni durmaz)
  doku    -> arka plan geometrisi, duzenle capraz esleneir
  simge   -> araca ait ikon (tools/card-icons.json) filigran olarak
  rakam   -> maas sayfalarinda kart GERCEK sonucu gosterir

KONTRAST HESAPLANDI, BAKILMADI
------------------------------
Eski sablonun en acik gradyan duragi #14957a idi; uzerindeki beyaz metin
3.28:1 ile WCAG AA'nin altinda kaliyordu. Buradaki sekiz palet, beyaz metin
>= 5.0:1 ve vurgu rengi >= 4.5:1 gecene kadar en acik duraklari koyultularak
turetildi (asagidaki tabloda olculen degerler yazili). Yeni renk eklerken
`--kontrast` ile dogrula, goze guvenme.

Yontem: HTML sablonu headless Chrome ile ekran goruntusune cevrilir; boylece
sitenin kendi yazi tipi ve renkleriyle birebir ayni sonuc alinir.

Kullanim:
    python tools/make-og.py                 # hepsini uret
    python tools/make-og.py maas-hesaplama  # sadece belirtilenleri uret
    python tools/make-og.py --list          # ne uretilecek, hangi tema ile
    python tools/make-og.py --kontrast      # palet kontrast raporu
"""

import base64
import glob
import hashlib
import html
import io
import json
import os
import re
import shutil
import string
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images")
DOMAIN = "korayoner.dev"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

# ---------------------------------------------------------------- paletler --
# (koyu durak, orta durak, acik durak, vurgu)  — kontrastla dogrulandi
PALETLER = {
    "orman":    ("#063b32", "#0a5949", "#0f6a58", "#ffd479"),
    "gece":     ("#101a4d", "#1e2f7a", "#2c44a8", "#7fd8ff"),
    "murdum":   ("#3d1233", "#6a1f52", "#8e2a63", "#ffc2d8"),
    "terminal": ("#0b1015", "#131c25", "#1b2836", "#4ee1a0"),
    "kiremit":  ("#6b2413", "#90351b", "#a54121", "#ffd8a8"),
    "celik":    ("#1f2c38", "#33475a", "#425c75", "#ffc857"),
    "okyanus":  ("#0a3a52", "#0e5370", "#126787", "#7ff0d8"),
    "bordo":    ("#4a0f1e", "#75182e", "#96203b", "#ffc9a3"),
}

# Aile -> palet. Renk bilgi tasisin diye sayfa turune bagli, hash'e degil.
AILE_PALET = {
    "bordro":   "orman",      # maas, tazminat, bordro motoru
    "vergi":    "gece",       # KDV, MTV, OTV, gumruk
    "finans":   "murdum",     # kredi, mevduat, kira, doviz
    "guvenlik": "terminal",   # KeyMint ailesi
    "gunluk":   "kiremit",    # yuzde, birim, yas, final, hesap bolusme
    "canli":    "celik",      # deprem, hiz testi
    "marka":    "okyanus",    # kapak ve kurumsal sayfalar
    "yazi":     "bordo",      # makaleler bolumu
}

# maas-<tutar> sayfalari tek bir seri: 20'sinin de duzeni "rakam" (icerik
# rakamin kendisi, duzeni degistirmek keyfi olurdu). Ama 20 kart tek renkte
# olunca seri yine tek kart gibi okunuyor; tutar sirasina gore renk rampasina
# yayiliyorlar. Dusuk brutler yesil, yukari dogru maviye ve bordoya kayiyor.
MAAS_RAMPA = ["orman", "okyanus", "gece", "murdum", "bordo"]

DUZENLER = ["afis", "bolunmus", "serit", "izgara"]
DOKULAR = ["nokta", "cizgi", "capraz", "yay"]

# ------------------------------------------------------------------- spec ---
# dosya adi -> (url yolu, beyaz bolum, vurgulu bolum, alt yazi, rozetler, aile)
SPEC = {
 "koray-oner-kapak": ("", "Ücretsiz açık kaynak", "web araçları",
   "Hesaplayıcılar, dönüştürücüler, üreteçler ve günlük hayatı kolaylaştıran pratik araçlar.",
   ["Açık kaynak", "Üyeliksiz"], "marka"),

 "bordro": ("bordro", "Bordro", "Motoru",
   "Maaş hesaplarının açık çekirdeği: 2020-2026 parametreleri, metodoloji ve değişiklik günlüğü.",
   ["2020-2026", "252 test", "MIT"], "bordro"),

 "maas-hesaplama": ("maas-hesaplama", "Brüt Net", "Maaş Hesaplama 2026",
   "Güncel vergi dilimleri, SGK tavanı ve damga vergisiyle ay ay 12 aylık bordro.",
   ["12 aylık bordro", "Netten brüte"], "bordro"),

 "maas-brut-net-tablosu": ("maas-hesaplama/brut-net-tablosu", "2026 Brüt-Net", "Maaş Tablosu",
   "35.000 TL'den 500.000 TL'ye kadar brütlerin Ocak, Aralık ve ortalama net karşılığı — tek tabloda.",
   ["20 tutar", "Ay ay döküm"], "bordro"),

 "calisma-bicimi-karsilastirma": ("calisma-bicimi-karsilastirma", "Şahıs mı, Limited mi,", "Maaşlı mı?",
   "Aynı maliyet dört çalışma biçiminde ne kadarını size bırakıyor? Vergi, prim ve gider dahil.",
   ["4 senaryo", "Kesişim tablosu"], "bordro"),

 "isten-ayrilma-hesaplama": ("isten-ayrilma-hesaplama", "İşten Ayrılma", "Paketi 2026",
   "Kıdem, ihbar, izin, son ücret ve işsizlik maaşı tek hesapta — ödeme takvimiyle.",
   ["Hak matrisi", "Ödeme takvimi"], "bordro"),

 "kidem-tazminati-hesaplama": ("kidem-tazminati-hesaplama", "Kıdem ve İhbar", "Tazminatı 2026",
   "Güncel tavan, giydirilmiş brüt ücret ve damga vergisiyle gün gün hesaplama.",
   ["Güncel tavan", "PDF rapor"], "bordro"),

 "isveren-maliyeti-hesaplama": ("isveren-maliyeti-hesaplama", "İşveren", "Maliyeti 2026",
   "Bir çalışan işverene ne kadara mal oluyor? SGK işveren payı ve 5 puanlık indirim dahil.",
   ["Brüt & net mod", "5 puan indirimi"], "bordro"),

 "issizlik-maasi-hesaplama": ("issizlik-maasi-hesaplama", "İşsizlik Maaşı", "Hesaplama 2026",
   "Son 4 aylık brüt kazanca ve prim gün sayısına göre ödenek, tavan ve süre.",
   ["2026 parametreleri", "Süre hesabı"], "bordro"),

 "serbest-meslek-makbuzu-hesaplama": ("serbest-meslek-makbuzu-hesaplama", "Serbest Meslek", "Makbuzu Hesaplama",
   "Brütten nete veya netten brüte; stopaj, KDV ve KDV tevkifatı dahil.",
   ["Stopaj + KDV", "Tevkifat"], "bordro"),

 "kdv-hesaplama": ("kdv-hesaplama", "KDV", "Hesaplama",
   "KDV hariç tutara KDV ekleyin ya da KDV dahil tutardan KDV'yi ayırın.",
   ["%1 · %10 · %20", "Anında"], "vergi"),

 "mtv-hesaplama": ("mtv-hesaplama", "MTV", "Hesaplama 2026",
   "Motor hacmi, yaş ve taşıt değerine göre yıllık vergi + taksitler.",
   ["2026 tarifesi", "Projeksiyon"], "vergi"),

 "otv-hesaplama": ("otv-hesaplama", "Araç ÖTV", "Hesaplama",
   "Motor hacmi ve matraha göre ÖTV, KDV ve anahtar teslim fiyat.",
   ["Hibrit & elektrikli", "Vergi yükü"], "vergi"),

 "gumruk-vergisi-hesaplama": ("gumruk-vergisi-hesaplama", "Gümrük Vergisi", "Hesaplama 2026",
   "Yurt dışı alışverişte vergi, IMEI kayıt harcı ve toplam maliyet.",
   ["AB & diğer ülke", "IMEI harcı"], "vergi"),

 "kredi-hesaplama": ("kredi-hesaplama", "Kredi", "Hesaplama 2026",
   "İhtiyaç, konut ve taşıt kredisinde taksit ve ay ay ödeme planı.",
   ["Ödeme planı", "Toplam faiz"], "finans"),

 "vadeli-mevduat-hesaplama": ("vadeli-mevduat-hesaplama", "Vadeli Mevduat", "Faizi Hesaplama",
   "Anapara, faiz oranı ve vadeye göre brüt faiz, stopaj ve net getiri.",
   ["Stopaj dahil", "Net getiri"], "finans"),

 "kira-artisi-hesaplama": ("kira-artisi-hesaplama", "Kira Artışı", "Hesaplama 2026",
   "Konut ve iş yeri kirasında 12 aylık TÜFE ortalamasına göre yasal azami oran.",
   ["TÜFE tavanı", "Konut & iş yeri"], "finans"),

 "doviz-kurlari": ("doviz-kurlari", "TCMB", "Döviz Kurları",
   "Merkez Bankası gösterge kurları, her iş günü otomatik güncellenir.",
   ["Resmî veri", "Her iş günü"], "finans"),

 "yuzde-hesaplama": ("yuzde-hesaplama", "Yüzde", "Hesaplama",
   "Bir sayının yüzdesi, iki sayı arasındaki yüzde, artış ve azalış.",
   ["Formüllerle", "Örneklerle"], "gunluk"),

 "birim-cevirici": ("birim-cevirici", "Birim", "Çevirici",
   "Uzunluk, ağırlık, sıcaklık, alan, hacim, hız, veri ve zaman dönüşümü.",
   ["8 kategori", "Anında"], "gunluk"),

 "hesap-bolusme": ("hesap-bolusme", "Hesap", "Bölüşme (AA)",
   "Grup harcamasını kişi sayısına böler, bahşiş ekler, kuruşu adil dağıtır.",
   ["Bahşiş dahil", "Adil kuruş"], "gunluk"),

 "yas-hesaplama": ("yas-hesaplama", "Yaş", "Hesaplama",
   "Doğum tarihine göre yıl, ay, gün ve doğum gününe kalan süre.",
   ["İki tarih arası", "Anında"], "gunluk"),

 "final-notu-hesaplama": ("final-notu-hesaplama", "Final Notu", "Hesaplama",
   "Vize notu ve ağırlıklara göre geçmek için gereken final notu.",
   ["Ağırlıklı", "Ortalama"], "gunluk"),

 "internet-hiz-testi": ("internet-hiz-testi", "İnternet", "Hız Testi",
   "İndirme hızınızı ve ping değerinizi tarayıcınızda ölçün.",
   ["Kayıtsız", "Ping ölçümü"], "canli"),

 "son-depremler": ("son-depremler", "Son", "Depremler",
   "Türkiye ve çevresindeki son depremler, canlı liste ve arşiv sorgusu.",
   ["Canlı liste", "Arşiv"], "canli"),

 "keymint": ("keymint", "KeyMint", "Şifre Üreteci",
   "Güçlü ve rastgele şifre üretin. Tamamen tarayıcıda, hiçbir yere gönderilmez.",
   ["Tarayıcıda", "Kriptografik"], "guvenlik"),

 "sifre-guc-testi": ("keymint/sifre-guc-testi", "Şifre", "Güç Testi",
   "Parolanızın gücünü entropi ve tahmini kırılma süresiyle ölçün.",
   ["Entropi", "Tarayıcıda"], "guvenlik"),

 "pin-uretici": ("keymint/pin-uretici", "PIN Kodu", "Üreteci",
   "4, 6 veya 8 haneli rastgele ve güvenli PIN oluşturun.",
   ["Kriptografik", "Zayıf kalıp uyarısı"], "guvenlik"),

 "parola-cumlesi": ("keymint/parola-cumlesi", "Parola Cümlesi", "Üreteci",
   "Kolay hatırlanan ama güçlü, kelimelerden oluşan parolalar.",
   ["Passphrase", "Tarayıcıda"], "guvenlik"),

 "wifi-sifresi": ("keymint/wifi-sifresi", "WiFi Şifresi", "Üreteci",
   "Misafirlerin kolayca yazabileceği, karışan karakter içermeyen parolalar.",
   ["Kolay yazılır", "Güçlü"], "guvenlik"),

 "hash-uretici": ("keymint/hash-uretici", "Hash", "Üreteci",
   "Metninizin SHA-256, SHA-1 veya SHA-512 özetini anında hesaplayın.",
   ["SHA-256", "Tarayıcıda"], "guvenlik"),

 "uuid-uretici": ("keymint/uuid-uretici", "UUID", "Üreteci (v4)",
   "Rastgele ve benzersiz kimlikler üretin; tek tek veya toplu.",
   ["v4", "Toplu üretim"], "guvenlik"),

 "base64": ("keymint/base64", "Base64", "Kodlayıcı & Çözücü",
   "Metni Base64'e kodlayın veya Base64'ü metne çözün. UTF-8 uyumlu.",
   ["UTF-8", "Tarayıcıda"], "guvenlik"),

 # Kurumsal sayfalar: eskiden hepsi ayni genel kapagi paylasiyordu.
 "makaleler": ("makaleler", "Bordro, vergi ve", "emeklilik yazıları",
   "Mevzuatı motorla test eden, kaynaklı ve tarihli yazılar. Reklam yok, sponsor yok.",
   ["Kaynaklı", "Güncel"], "yazi"),

 "iletisim": ("iletisim", "İletişim", "ve geri bildirim",
   "Hata bildirimi, öneri ve iş birliği için doğrudan ulaşın.",
   ["Hata bildirimi", "Öneri"], "marka"),

 "gizlilik": ("gizlilik", "Gizlilik ve", "KVKK aydınlatma",
   "Hangi veri toplanıyor, neden ve ne kadar süreyle? Hesaplamalar tarayıcınızda kalır.",
   ["Tarayıcıda hesap", "Açık metin"], "marka"),

 "kullanim-kosullari": ("kullanim-kosullari", "Kullanım", "Koşulları",
   "Araçların kapsamı, doğruluk taahhüdü ve sorumluluk reddi.",
   ["Açık metin", "MIT"], "marka"),
}

# ---------------------------------------------------------------- kontrast --

def _srgb(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _isik(h):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def kontrast(a, b):
    la, lb = _isik(a), _isik(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def kontrast_raporu():
    """Paletleri dogrular. Yeni renk eklendiginde once bunu calistir."""
    beyaz = "#ffffff"
    kotu = 0
    print("%-9s  beyaz@orta beyaz@açık  vurgu@orta vurgu@açık" % "palet")
    for ad, (d1, d2, d3, v) in PALETLER.items():
        olcum = [kontrast(beyaz, d2), kontrast(beyaz, d3),
                 kontrast(v, d2), kontrast(v, d3)]
        sinir = [5.0, 5.0, 4.5, 4.5]
        gecti = all(o >= s for o, s in zip(olcum, sinir))
        if not gecti:
            kotu += 1
        print("%-9s  %9.2f %10.2f %11.2f %10.2f   %s"
              % (ad, olcum[0], olcum[1], olcum[2], olcum[3],
                 "geçti" if gecti else "KALDI"))
    print("\n%d palet, %d kaldı." % (len(PALETLER), kotu))
    return 1 if kotu else 0


# ------------------------------------------------------------------ tema ----

def tohum(ad):
    """Ada bagli kararli sayi — her uretimde ayni kart cikar."""
    return int(hashlib.md5(ad.encode("utf-8")).hexdigest()[:8], 16)


def tema(ad, aile, sira):
    """Palet aileden, duzen ve doku aile icindeki siradan gelir.

    Sira kullanmanin sebebi: saf hash ayni ailede iki karta ayni duzeni
    verebiliyor. Sirayla dagitinca ayni renkteki kartlar birbirinden
    kesin olarak ayrisiyor.
    """
    palet = AILE_PALET.get(aile, "marka")
    duzen = DUZENLER[sira % len(DUZENLER)]
    doku = DOKULAR[(sira // len(DUZENLER) + sira) % len(DOKULAR)]
    t = tohum(ad)
    return {
        "palet": palet,
        "renkler": PALETLER[palet],
        "duzen": duzen,
        "doku": doku,
        "aci": 108 + (t % 5) * 12,          # gradyan acisi 108-156
        "isikX": 84 + (t >> 3) % 40,        # parlama odagi konumu
        "isikY": 2 + (t >> 7) % 24,
    }


# card-icons.json arac kartlari icin yazilmisti; kimi sayfanin orada karsiligi
# yok (KeyMint alt araclari, kurumsal sayfalar, bordro). Ikonsuz kalan kart
# "bolunmus" duzenine dustugunde yan panel bombos kaliyordu — asagidakiler o
# boslugu kapatiyor.
OG_IKON = {
    'bordro': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    'makaleler': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a1 1 0 0 1 1 1v14a2 2 0 0 0 2-2V8h-3"/><path d="M4 4v15a2 2 0 0 0 2 2h12"/><path d="M7 8h7M7 12h7M7 16h4"/></svg>',
    'iletisim': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
    'gizlilik': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>',
    'kullanim-kosullari': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
    'koray-oner-kapak': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="M13 6l-2 12"/></svg>',
    'sifre-guc-testi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M12 8v5"/><circle cx="12" cy="16" r="1"/></svg>',
    'pin-uretici': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="1.4"/><circle cx="12" cy="10" r="1.4"/><circle cx="16" cy="10" r="1.4"/><path d="M8 15h8"/></svg>',
    'parola-cumlesi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
    'wifi-sifresi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a16 16 0 0 1 20 0"/><path d="M5 12.3a11 11 0 0 1 14 0"/><path d="M8.5 15.8a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/></svg>',
    'hash-uretici': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 7 21M17 3l-2 18M4 8h17M3 16h17"/></svg>',
    'uuid-uretici': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4"/><path d="M15 10h4M15 14h4"/></svg>',
    'base64': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6-5 6 5 6"/><path d="m15 6 5 6-5 6"/></svg>',
}


def ikonlar():
    p = os.path.join(ROOT, "tools", "card-icons.json")
    try:
        ham = json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for slug, kayit in ham.items():
        svg = kayit["svg"]
        svg = re.sub(r'stroke-width="[^"]*"', 'stroke-width="1.35"', svg)
        svg = svg.replace('stroke="currentColor"', 'stroke="currentColor"')
        out[slug] = svg
    for slug, svg in OG_IKON.items():
        out.setdefault(slug, svg)
    return out


def logo_b64():
    # Animasyonlu <style> blogu cikarilir: ekran goruntusunde ilk kare alinir,
    # sabit hali daha guvenilir.
    s = io.open(os.path.join(ROOT, "logo.svg"), encoding="utf-8").read()
    s = re.sub(r"<style>.*?</style>", "", s, flags=re.S)
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


# --------------------------------------------------------------- sablonlar --
# string.Template kullaniliyor: CSS'te { } ve % bol, .format/% ile kacis
# yazmak sablonu okunmaz hale getiriyordu. CSS'te $ isareti gecmiyor.

ORTAK_CSS = string.Template("""
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; overflow:hidden; }
  body {
    font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
    color:#fff; position:relative; background:$koyu;
    background-image:
      radial-gradient(980px 640px at ${isikX}% ${isikY}%, rgba(255,255,255,.13), transparent 62%),
      linear-gradient(${aci}deg, $koyu 0%, $orta 52%, $acik 100%);
  }
  .doku { position:absolute; inset:0; pointer-events:none; }
  .halka { position:absolute; border:2px solid rgba(255,255,255,.13); border-radius:50%; }
  .pad { position:absolute; inset:70px 74px 58px; display:flex; flex-direction:column; }
  .brow { display:flex; align-items:center; gap:20px; }
  .badge { width:62px; height:62px; border-radius:16px; background:rgba(255,255,255,.17);
           display:flex; align-items:center; justify-content:center; flex:none; }
  .badge img { width:48px; height:48px; display:block; }
  .url { font-size:26px; font-weight:700; letter-spacing:-.01em; }
  .vurgu { color:$vurgu; }
  .sub { font-size:29px; line-height:1.36; color:rgba(255,255,255,.93); font-weight:400; }
  .pills { display:flex; gap:13px; flex-wrap:wrap; }
  .pill { border:2px solid rgba(255,255,255,.72); border-radius:999px; padding:10px 21px;
          font-size:21px; font-weight:700; white-space:nowrap; }
  .by { font-size:21px; color:rgba(255,255,255,.82); }
  .by b { color:#fff; font-weight:700; }
  .fil { position:absolute; color:$vurgu; opacity:.15; }
  .fil svg { width:100%; height:100%; display:block; fill:none; }
""")

DOKU_CSS = {
    "nokta": """.doku { background-image:radial-gradient(rgba(255,255,255,.17) 1.7px, transparent 1.8px);
                        background-size:28px 28px; }""",
    "cizgi": """.doku { background-image:repeating-linear-gradient(0deg,
                        rgba(255,255,255,.09) 0 1px, transparent 1px 15px); }""",
    "capraz": """.doku { background-image:repeating-linear-gradient(45deg,
                         rgba(255,255,255,.075) 0 3px, transparent 3px 18px); }""",
    "yay": ".doku { background:none; }",
}

DOKU_HTML = {
    "yay": ('<div class="doku">'
            '<div class="halka" style="width:520px;height:520px;right:-130px;top:-150px"></div>'
            '<div class="halka" style="width:760px;height:760px;right:-250px;top:-270px"></div>'
            '<div class="halka" style="width:1020px;height:1020px;right:-380px;top:-400px"></div>'
            "</div>"),
}


def doku_blogu(ad):
    return DOKU_HTML.get(ad, '<div class="doku"></div>')


# Her duzen kendi CSS'ini ve govdesini tasir. Ortak kisim yukarida.
DUZEN_CSS = {
 "afis": """
  h1 { margin-top:32px; font-size:${fs}px; font-weight:800; line-height:1.05; letter-spacing:-.028em; }
  .sub { margin-top:20px; max-width:960px; }
  .pills { margin-top:auto; }
  .by { margin-top:19px; }
  .fil { width:300px; height:300px; right:-26px; bottom:-30px; }
 """,
 "bolunmus": """
  body { display:block; }
  .yan { position:absolute; right:0; top:0; bottom:0; width:396px; background:$koyu;
         border-left:3px solid $vurgu; display:flex; align-items:center; justify-content:center; }
  .yan .fil { position:static; width:236px; height:236px; opacity:.85; }
  .pad { right:470px; }
  h1 { margin-top:30px; font-size:${fs}px; font-weight:800; line-height:1.06; letter-spacing:-.028em; }
  .sub { margin-top:18px; font-size:26px; }
  .pills { margin-top:auto; }
  .by { margin-top:17px; }
 """,
 "serit": """
  /* Sol kenar seridi kimligi tasir; vurgulu satirin arkasina kutu koymak
     tasma uretiyordu (metin kutudan sarkiyordu) — kaldirildi. */
  body::before { content:""; position:absolute; left:0; top:0; bottom:0; width:14px;
                 background:$vurgu; }
  .pad { inset:70px 74px 58px 92px; }
  h1 { margin-top:auto; font-size:${fsb}px; font-weight:800; line-height:1.02;
       letter-spacing:-.034em; }
  h1 .vurgu { display:inline-block; margin-top:6px; }
  .sub { margin-top:24px; max-width:900px; font-size:27px; }
  .satirlar { margin-top:26px; display:flex; align-items:center; gap:16px; font-size:22px;
              font-weight:700; color:rgba(255,255,255,.9); }
  .satirlar .nk { color:$vurgu; }
  .by { margin-top:18px; }
  .fil { width:250px; height:250px; right:52px; top:56px; opacity:.2; }
 """,
 "izgara": """
  .kutu { margin-top:26px; background:rgba(0,0,0,.26); border:2px solid rgba(255,255,255,.24);
          border-left:6px solid $vurgu; border-radius:20px; padding:34px 38px 32px;
          display:flex; flex-direction:column; flex:1; }
  h1 { font-size:${fs}px; font-weight:800; line-height:1.05; letter-spacing:-.028em; }
  .sub { margin-top:18px; max-width:820px; font-size:27px; }
  .pills { margin-top:auto; }
  .by { margin-top:16px; }
  .fil { width:190px; height:190px; right:66px; top:150px; opacity:.28; }
 """,
 "rakam": """
  h1 { margin-top:26px; font-size:52px; font-weight:800; line-height:1.06; letter-spacing:-.028em;
       max-width:660px; }
  .tablo { margin-top:auto; display:flex; align-items:flex-end; gap:38px; }
  .hane .et { font-size:22px; font-weight:700; color:rgba(255,255,255,.8);
              text-transform:uppercase; letter-spacing:.08em; }
  .hane .dg { font-size:88px; font-weight:800; letter-spacing:-.035em; line-height:1.02;
              margin-top:4px; }
  .hane .dg small { font-size:34px; font-weight:700; margin-left:6px; }
  .ok { font-size:60px; font-weight:800; color:$vurgu; padding-bottom:18px; }
  .fark { padding-bottom:14px; font-size:29px; font-weight:800; color:$vurgu; max-width:270px;
          line-height:1.2; letter-spacing:-.01em; white-space:nowrap; }
  .by { margin-top:22px; }
  .fil { width:270px; height:270px; right:-16px; top:64px; opacity:.13; }
 """,
}

SAYFA = string.Template("""<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>
$ortak
$doku
$duzen
</style></head><body>
$dokuHtml
$govde
</body></html>""")

BROW = string.Template("""    <div class="brow">
      <div class="badge"><img src="data:image/svg+xml;base64,$logo" alt=""></div>
      <div class="url">$url</div>
    </div>""")


def pill_html(rozetler):
    return "".join('<span class="pill">%s</span>' % html.escape(p) for p in rozetler)


def by_html():
    return '<div class="by">Geliştiren: <b>Koray Öner</b> · Ücretsiz, reklamsız</div>'


def govde_yap(duzen, ctx):
    b = BROW.substitute(logo=ctx["logo"], url=html.escape(ctx["url"]))
    baslik = ('<h1>%s<br><span class="vurgu">%s</span></h1>'
              % (html.escape(ctx["beyaz"]), html.escape(ctx["vurgulu"])))
    sub = '<p class="sub">%s</p>' % html.escape(ctx["sub"])
    pills = '<div class="pills">%s</div>' % pill_html(ctx["rozetler"])
    fil = '<div class="fil">%s</div>' % ctx["ikon"] if ctx["ikon"] else ""

    if duzen == "afis":
        return ('  <div class="pad">%s%s%s%s%s</div>%s'
                % (b, baslik, sub, pills, by_html(), fil))

    if duzen == "bolunmus":
        yan = '  <div class="yan">%s</div>' % (
            '<div class="fil">%s</div>' % ctx["ikon"] if ctx["ikon"] else "")
        return ('  <div class="pad">%s%s%s%s%s</div>\n%s'
                % (b, baslik, sub, pills, by_html(), yan))

    if duzen == "serit":
        satir = ('<div class="satirlar">%s</div>'
                 % ('<span class="nk">•</span>'.join(
                     "<span>%s</span>" % html.escape(p) for p in ctx["rozetler"])))
        return ('  <div class="pad">%s%s%s%s%s</div>%s'
                % (b, baslik, sub, satir, by_html(), fil))

    if duzen == "izgara":
        return ('  <div class="pad">%s<div class="kutu">%s%s%s</div>%s</div>%s'
                % (b, baslik, sub, pills, by_html(), fil))

    if duzen == "rakam":
        r = ctx["rakam"]
        tablo = (
            '<div class="tablo">'
            '<div class="hane"><div class="et">Ocak neti</div>'
            '<div class="dg">%s<small>TL</small></div></div>'
            '<div class="ok">&#8594;</div>'
            '<div class="hane"><div class="et">Aralık neti</div>'
            '<div class="dg">%s<small>TL</small></div></div>'
            '<div class="fark">%s TL erir</div>'
            "</div>" % (html.escape(r["ocak"]), html.escape(r["aralik"]),
                        html.escape(r["fark"])))
        return ('  <div class="pad">%s<h1>%s</h1>%s%s</div>%s'
                % (b, html.escape(ctx["beyaz"]), tablo, by_html(), fil))

    raise ValueError("bilinmeyen duzen: " + duzen)


def punto(beyaz, vurgulu, duzen):
    uzun = max(len(beyaz), len(vurgulu))
    if duzen == "bolunmus":
        return 62 if uzun <= 18 else (54 if uzun <= 24 else 46)
    if duzen == "izgara":
        return 66 if uzun <= 18 else (58 if uzun <= 24 else 50)
    return 84 if uzun <= 18 else (74 if uzun <= 24 else 64)


def belge(ad, spec, t, logo, ikon, rakam=None):
    yol, beyaz, vurgulu, sub, rozetler, _aile = spec
    koyu, orta, acik, vurgu = t["renkler"]
    duzen = "rakam" if rakam else t["duzen"]
    fs = punto(beyaz, vurgulu, duzen)

    ortak = ORTAK_CSS.substitute(koyu=koyu, orta=orta, acik=acik, vurgu=vurgu,
                                 aci=t["aci"], isikX=t["isikX"], isikY=t["isikY"])
    duzen_css = string.Template(DUZEN_CSS[duzen]).substitute(
        koyu=koyu, orta=orta, acik=acik, vurgu=vurgu, fs=fs, fsb=fs + 14)

    ctx = {
        "logo": logo, "url": DOMAIN + ("/" + yol if yol else ""),
        "beyaz": beyaz, "vurgulu": vurgulu, "sub": sub, "rozetler": rozetler,
        "ikon": ikon or "", "rakam": rakam,
    }
    return SAYFA.substitute(ortak=ortak, doku=DOKU_CSS[t["doku"]], duzen=duzen_css,
                            dokuHtml=doku_blogu(t["doku"]), govde=govde_yap(duzen, ctx))


# ------------------------------------------------------- maas sayfa kartlari -

def _sayi(s):
    return float(s.replace(".", "").replace(",", "."))


def maas_spec():
    """maas-hesaplama/<tutar>-tl-brut-ne-kadar-net/ sayfalarindan kart uretir.

    Rakamlar sayfanin og:description'indan okunur; boylece kart ile sayfa
    ayrisamaz. Kart, sitenin imza bulgusunu gosteriyor: ayni brut ucret
    Ocak'ta ve Aralik'ta ayni neti vermiyor.
    """
    out = {}
    kok = os.path.join(ROOT, "maas-hesaplama")
    for p in sorted(glob.glob(os.path.join(kok, "*-tl-brut-ne-kadar-net", "index.html"))):
        klasor = os.path.basename(os.path.dirname(p))
        s = io.open(p, encoding="utf-8").read()
        d = re.search(r'og:description" content="([^"]*)"', s)
        h = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
        if not d or not h:
            continue
        m = re.search(r"Ocak ([\d.,]+) TL, Aralık ([\d.,]+) TL", d.group(1))
        if not m:
            continue
        ocak, aralik = m.group(1), m.group(2)
        fark = _sayi(ocak) - _sayi(aralik)
        brut = re.sub(r"\s*Brüt.*", "", re.sub(r"<[^>]+>", "", h.group(1))).strip()
        out["maas-" + klasor] = (
            "maas-hesaplama/" + klasor,
            brut + " brüt maaş, yıl içinde ne kadar net bırakıyor?",
            "",
            "",
            [],
            "bordro",
        )
        out["maas-" + klasor] += ({
            "ocak": ocak.rsplit(",", 1)[0],
            "aralik": aralik.rsplit(",", 1)[0],
            "fark": "{:,.0f}".format(fark).replace(",", "."),
        },)
    return out


# ------------------------------------------------------------------ render --

def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def render(chrome, ad, doc):
    tmp = tempfile.mkdtemp(prefix="og-")
    try:
        src = os.path.join(tmp, "c.html")
        io.open(src, "w", encoding="utf-8").write(doc)
        out = os.path.join(tmp, "shot.png")
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
               "--force-device-scale-factor=1", "--window-size=1200,630",
               "--default-background-color=00000000",
               "--screenshot=" + out, "--user-data-dir=" + os.path.join(tmp, "u"),
               "file:///" + src.replace("\\", "/")]
        r = subprocess.run(cmd, capture_output=True, timeout=90)
        if not os.path.exists(out):
            print("   HATA:", r.stderr.decode("utf-8", "replace")[:200])
            return False
        dest = os.path.join(
            OUT, ad + ("-koray-oner.png" if ad != "koray-oner-kapak" else ".png"))
        shutil.copyfile(out, dest)
        print("   %-52s %6d bayt" % (os.path.basename(dest), os.path.getsize(dest)))
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def tum_spec():
    hepsi = dict((k, v) for k, v in SPEC.items())
    hepsi.update(maas_spec())
    return hepsi


def maas_tutar(ad):
    m = re.match(r"maas-(\d+)-tl-", ad)
    return int(m.group(1)) if m else None


def temalar(hepsi):
    """Aile icinde sirali dagitim — ayni renkteki kartlar farkli duzen alsin."""
    sayac = {}
    out = {}
    seri = sorted([a for a in hepsi if maas_tutar(a) is not None], key=maas_tutar)
    for ad in sorted(hepsi):
        aile = hepsi[ad][5]
        i = sayac.get(aile, 0)
        sayac[aile] = i + 1
        t = tema(ad, aile, i)
        if ad in seri:
            j = seri.index(ad) * len(MAAS_RAMPA) // len(seri)
            t["palet"] = MAAS_RAMPA[j]
            t["renkler"] = PALETLER[t["palet"]]
        out[ad] = t
    return out


def main():
    if "--kontrast" in sys.argv:
        return kontrast_raporu()

    hepsi = tum_spec()
    tm = temalar(hepsi)

    if "--list" in sys.argv:
        for ad in sorted(hepsi):
            v = hepsi[ad]
            t = tm[ad]
            rk = " rakam" if len(v) > 6 else ""
            print("%-46s %-9s %-9s %-7s%s  -> %s/%s"
                  % (ad, v[5], t["palet"], t["duzen"] + rk, "", DOMAIN, v[0]))
        return 0

    chrome = find_chrome()
    if not chrome:
        print("HATA: Chrome/Edge bulunamadi.", file=sys.stderr)
        return 1
    print("Tarayici:", chrome)

    logo = logo_b64()
    ikon = ikonlar()
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    todo = args or sorted(hepsi)
    ok = 0
    for ad in todo:
        if ad not in hepsi:
            print("!! taninmayan:", ad)
            continue
        spec = hepsi[ad]
        rakam = spec[6] if len(spec) > 6 else None
        # ikon slug'i: maas-* kartlari maas-hesaplama ikonunu kullanir
        slug = "maas-hesaplama" if ad.startswith("maas-") and rakam else ad
        print("-", ad)
        doc = belge(ad, spec[:6], tm[ad], logo, ikon.get(slug), rakam)
        if render(chrome, ad, doc):
            ok += 1
    print("\nÜretilen: %d / %d" % (ok, len(todo)))
    return 0 if ok == len(todo) else 1


if __name__ == "__main__":
    sys.exit(main())
