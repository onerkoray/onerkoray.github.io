#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1200x630 paylasim (OG) kapaklarini uretir.

NEDEN BU HALDE
--------------
Onceki surum koyu gradyanli kartlardi: her aile bir palet, aile icinde
donen dort duzen ve dort doku. Sistem calisiyordu ama iki sorunu vardi.

  1. KART BILGI TASIMIYORDU. Baslik ve rozetlerden ibaretti; paylasilan
     bagi goren kisi sayfaya girmeden bir sey ogrenmiyordu.
  2. AKISTA SESSIZ KALIYORDU. Telefonda bir paylasim karti ~440 px
     genisliginde gorunur. O olcekte rozetler ve alt yazi okunmaz;
     okunan tek sey en buyuk yazidir.

Yeni dil bu iki seyi duzeltiyor:

  CEVAP MANSETTIR. Sayfanin verdigi cevap sayiysa, kartin en buyuk yazisi
  o sayidir. Soru ustte kucuk durur. Insani akista durduran sey soru
  degil, sayidir — ve 28 maas sayfasinin karti boylece birbirinden
  kendiliginde ayrisir, renk hilesine gerek kalmaz.

  DEKORASYON YOK. Doku, rozet dizisi, gradyan, gölge, rozet logosu
  kaldirildi. Sayfanin anlatmadigi hicbir sekil kartta yer almiyor.
  Tek grafik, veri tasiyan cubuktur; o da yalnizca veri varsa cizilir.

IKI KART TURU
-------------
  veri    — sayfanin tek bir sayisal cevabi varsa (maas sayfalari):
            kunye, soru, dev cevap, brut-net cubugu, kesinti satiri
  baslik  — cevabi tek sayiya inmeyen sayfalar (araclar, bolumler):
            kunye, iki parcali dev baslik, tek satir aciklama

Ikinci turde UYDURMA SAYI ya da temsili grafik YOKTUR. Verisi olmayan
sayfaya veri gorunumlu bir sekil koymak, kartin tasidigi guveni bozar.

Yontem: HTML sablonu headless Chrome ile ekran goruntusune cevrilir;
boylece sitenin kendi yazi tipi ve renkleriyle birebir ayni sonuc alinir.

Kullanim:
    python tools/make-og.py                 # hepsini uret
    python tools/make-og.py maas-hesaplama  # sadece belirtilenleri uret
    python tools/make-og.py --list          # ne uretilecek, hangi renkle
    python tools/make-og.py --kontrast      # palet kontrast raporu
"""

import glob
import html
import io
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
# Editoryal kart: ACIK zemin, koyu murekkep, aile basina TEK vurgu.
# Onceki surum bunun tersiydi (koyu zemin, beyaz yazi, dort duraklı
# gradyan). Acik zemin akista daha az yoruyor ve buyuk rakami one
# cikariyor; ayrica gradyan olmadigi icin kart her boyutta ayni okunuyor.
ZEMIN = "#F4F1E9"      # sicak kirik beyaz
MUREKKEP = "#17201D"   # siyaha yakin fume — baslik ve rakam
IKINCIL = "#5A625C"    # soru, aciklama, kunye
SOLUK = "#727972"      # alan adi — zeminde 3,96 kontrast
HAT = "#DDD6C6"        # ince kural
NOTR = "#C6BFAE"       # cubuktaki kesinti dilimi (vurgu DEGIL: veri degil)

# Aile -> vurgu. Renk bilgi tasisin diye sayfa turune bagli, hash'e degil.
AILE_VURGU = {
    "bordro":   "#0E6657",   # maas, tazminat, bordro motoru — turkuaz
    "vergi":    "#7A1F2B",   # KDV, MTV, OTV, gumruk — bordo
    "finans":   "#1B3A6B",   # kredi, mevduat, kira, doviz — lacivert
    "guvenlik": "#1F6B8C",   # KeyMint ailesi — arduvaz mavisi
    "gunluk":   "#A8521F",   # yuzde, birim, yas, final — sicak turuncu
    "canli":    "#3F6E33",   # deprem, hiz testi — koyu yesil
    "marka":    "#0E6657",   # kapak ve kurumsal sayfalar
    "yazi":     "#5B3A66",   # makaleler bolumu — koyu mor
}

# Kartin ust satirindaki kunye. Aileyi okura anlatan tek kelime obegi.
AILE_KUNYE = {
    "bordro":   "MAAŞ VE BORDRO",
    "vergi":    "VERGİ HESAPLAMA",
    "finans":   "FİNANS HESAPLAMA",
    "guvenlik": "GÜVENLİK ARAÇLARI",
    "gunluk":   "GÜNLÜK ARAÇLAR",
    "canli":    "CANLI VERİ",
    "marka":    "KORAYONER.DEV",
    "yazi":     "MAKALELER",
}


# ------------------------------------------------------------------- spec ---
# dosya adi -> (url yolu, ust baslik, alt baslik, aciklama, rozetler, aile)
# Rozetler artik cizilmiyor (kart dekorasyonu kaldirildi) ama veri
# yapisi korunuyor: eski kayitlar bozulmasin, ileride gerekirse
# baska bir yerde kullanilabilsin.
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

 "pesin-mi-taksit-mi": ("pesin-mi-taksit-mi", "Peşin mi,", "Taksit mi?",
   "Üç teklif, net getiri ve bütçe: ödemeleri aynı tarihin parasıyla karşılaştırın.",
   ["Bugünkü maliyet", "Başa baş getiri", "Ödeme planı"], "vergi"),

 "cikis-takvimi": ("cikis-takvimi", "Çıkış", "Takvimi",
   "Ayrılma tarihindeki eşikler: bir gün on binlerce lira değiştirebiliyor.",
   ["Eşik taraması", "Kendi tarihlerinize göre"], "bordro"),

 "isten-ayrilma-hesaplama": ("isten-ayrilma-hesaplama", "İşten Ayrılma", "Paketi 2026",
   "Kıdem, ihbar, izin, son ücret ve işsizlik maaşı tek hesapta — ödeme takvimiyle.",
   ["Hak matrisi", "Ödeme takvimi"], "bordro"),

 "kidem-tazminati-hesaplama": ("kidem-tazminati-hesaplama", "Kıdem ve İhbar", "Tazminatı 2026",
   "Güncel tavan, giydirilmiş brüt ücret ve damga vergisiyle gün gün hesaplama.",
   ["Güncel tavan", "PDF rapor"], "bordro"),

 "fazla-mesai-hesaplama": ("fazla-mesai-hesaplama", "Fazla Mesai", "Ücreti 2026",
   "Brütü değil elinize geçeni hesaplayın: aynı mesai ocakta ve aralıkta farklı net bırakır.",
   ["%50 ve %25", "12 ay karşılaştırma"], "bordro"),

 "isveren-maliyeti-hesaplama": ("isveren-maliyeti-hesaplama", "İşveren", "Maliyeti 2026",
   "Bir çalışan işverene ne kadara mal oluyor? SGK işveren payı ve 5 puanlık indirim dahil.",
   ["Brüt & net mod", "5 puan indirimi"], "bordro"),

 "issizlik-maasi-hesaplama": ("issizlik-maasi-hesaplama", "İşsizlik Maaşı", "Hesaplama 2026",
   "Son 4 aylık brüt kazanca ve prim gün sayısına göre ödenek, tavan ve süre.",
   ["2026 parametreleri", "Süre hesabı"], "bordro"),

 "borc-mu-birikim-mi": ("borc-mu-birikim-mi", "Borc mu,", "Birikim mi?",
   "Her hedefin vergi ve enflasyon sonrasi gercek getirisi, aylik dagilim.",
   ["Reel getiri", "Oncelik analizi"], "vergi"),

 "borc-kapatma-plani": ("borc-kapatma-plani", "Borc Kapatma", "Plani",
   "Cig, kartopu ve asgari odeme stratejileri ay ay karsilastirmali.",
   ["Simulasyon", "TCMB oranlari"], "vergi"),

 "beyanname-hesaplama": ("beyanname-hesaplama", "Beyanname", "Gerekir mi?",
   "Bütün gelirleri birlikte değerlendirir: sınır gelirin kendisine değil toplama bakar.",
   ["GVK m.86", "Bütün gelirler"], "vergi"),

 "kira-geliri-vergisi-hesaplama": ("kira-geliri-vergisi-hesaplama", "Kira Geliri", "Vergisi 2026",
   "Mesken istisnasi, goturu ve gercek gider karsilastirmasi, stopaj mahsubu.",
   ["GVK m.21 / m.74", "Iki yontem"], "vergi"),

 "emekli-ayligi-hesaplama": ("emekli-ayligi-hesaplama", "Emekli Aylığı", "Hesaplama 2026",
   "Aylık bağlama oranı, üç dönemin kısmi aylıkları ve alt sınır aylık.",
   ["5510 s.K. m.29", "Üç dönem"], "bordro"),

 "serbest-meslek-makbuzu-hesaplama": ("serbest-meslek-makbuzu-hesaplama", "Serbest Meslek", "Makbuzu Hesaplama",
   "Brütten nete veya netten brüte; stopaj, KDV ve KDV tevkifatı dahil.",
   ["Stopaj + KDV", "Tevkifat"], "bordro"),

 "fatura-metodoloji": ("fatura-olusturma/metodoloji", "Fatura Merkezi", "Metodolojisi",
   "Kuruş aritmetiği, iskonto dağıtımı, tevkifat ve 159 test. Sunucusuz bir aracın açık defteri.",
   ["159 test", "MIT"], "vergi"),

 "fatura-olusturma": ("fatura-olusturma", "Fatura", "Oluşturma ve PDF",
   "KDV, iskonto, tevkifat ve tutar yazıyla — dört şablonda faturanızı hazırlayıp PDF indirin.",
   ["4 şablon", "Üyeliksiz"], "vergi"),

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

 "ev-kira-metodoloji": ("ev-almak-mi-kiralamak-mi/metodoloji", "Ev mi Kira mı", "Metodolojisi",
   "Farkın yatırılması kuralı, peşinatın fırsat maliyeti ve başabaş yılı nasıl bulunuyor? 31 test.",
   ["31 test", "MIT"], "finans"),

 "ev-almak-mi-kiralamak-mi": ("ev-almak-mi-kiralamak-mi", "Ev Almak mı", "Kiralamak mı?",
   "Kira ödemek boşa para değil. Doğru soru: peşinatı yatırsaydınız ne olurdu?",
   ["Başabaş yılı", "Fırsat maliyeti"], "finans"),

 "zam-metodoloji": ("zam-hesaplama/metodoloji", "Zam Hesabı", "Metodolojisi",
   "Brüt zam oranı neden nete aynen yansımaz? Kümülatif matrah, SGK tavanı ve üç bölge. 40 test.",
   ["40 test", "MIT"], "bordro"),

 "zam-hesaplama": ("zam-hesaplama", "Zam Hesaplama", "ve Maaş Pazarlığı",
   "%50 brüt zam nete %43,8 yansıyor. Net %30 artış için brütte %34 istemek gerekiyor.",
   ["Net karşılık", "Pazarlık"], "bordro"),

 "vergi-kamasi-metodoloji": ("vergi-kamasi-hesaplama/metodoloji", "Vergi Kaması", "Metodolojisi",
   "OECD tanımı, marjinal oranın kapalı formdan türetilmesi ve ölçümle karşılaştırılması. 39 test.",
   ["39 test", "MIT"], "bordro"),

 "vergi-kamasi-hesaplama": ("vergi-kamasi-hesaplama", "Vergi Kaması", "Hesaplama",
   "İşveren maliyeti ile net ücret arasındaki fark. Zirve 100.000 TL'de değil, SGK tavanında.",
   ["OECD tanımı", "Marjinal oran"], "bordro"),

 "finansal-ikiz": ("finansal-ikiz", "Finansal", "İkiz",
   "Finansal hayatınızın dijital ikizi: yirmi yıllık servet eğrisi, üç senaryo ve en etkili değişken.",
   ["Üç senaryo", "20 yıl"], "finans"),

 "kisisel-enflasyon": ("kisisel-enflasyon", "Kişisel", "Enflasyon",
   "Resmî oran bir sepet ortalaması. Kendi sepetiniz ne kadar pahalandı, hangi kalem kaç puan ekledi?",
   ["Kendi sepetiniz", "Katkı ayrıştırması"], "finans"),

 "nakit-akisi-analizi": ("nakit-akisi-analizi", "Nakit Akışı", "Analizi",
   "İşveren maliyetinden her gider kalemine kadar tüm akış tek diyagramda — ve her kalemin ömür bedeli.",
   ["Sankey", "Ömür bedeli"], "finans"),

 "emekli-zammi-hesaplama": ("emekli-zammi-hesaplama", "Emekli", "Zammı",
   "SSK ve Bağ-Kur aylıklarının Ocak ve Temmuz artışı, açıklanan TÜFE verisinden. Tahmin değil, senaryo.",
   ["5510 m.55", "Her gün güncel"], "bordro"),

 "teklif-karsilastirma": ("teklif-karsilastirma", "İki Teklif", "Karşılaştırma",
   "Ocakta önde görünen teklif yılda geride kalabilir. İki teklifi yıllık toplam net üzerinden ölçer.",
   ["Yıllık toplam net", "Tersinme uyarısı"], "bordro"),

 "bordro-denetim": ("bordro-denetim", "Bordro", "Denetimi",
   "Bordronuzdaki kesinti satırlarını beklenen tutarla karşılaştırır; fark varsa sebebini ölçerek gösterir.",
   ["Kümülatif matrah", "Satır satır fark"], "bordro"),

 "prim-ikramiye-vergisi": ("prim-ikramiye-vergisi", "Prim ve İkramiye", "Vergisi",
   "İkramiyeyi Aralık’ta almak vergiyi değiştirmez. Değiştiren şey SGK tavanı — ölçülüp gösteriliyor.",
   ["Marjinal oran", "SGK tavanı"], "bordro"),

 "ucret-kar-payi-metodoloji": ("ucret-kar-payi-optimizasyonu/metodoloji", "Ücret–Kâr Payı", "Metodolojisi",
   "Beyan eşiğindeki süreksizlik, ikiye bölmeyle çözüm ve çekirdek tutarlılığı. 34 test.",
   ["34 test", "MIT"], "finans"),

 "ucret-kar-payi-optimizasyonu": ("ucret-kar-payi-optimizasyonu", "Ücret–Kâr Payı", "Optimizasyonu",
   "Ortak kazancı ücret olarak mı, kâr payı olarak mı almalı? Beyan eşiğini geçmek netinizi düşürür.",
   ["Optimum ücret", "Beyan eşiği"], "finans"),

 "emniyet-metodoloji": ("finansal-emniyet-testi/metodoloji", "Emniyet Testi", "Metodolojisi",
   "Nakit tabani, sok senaryolari, guvenli karar tutari ve 108 test.",
   ["108 test", "MIT"], "finans"),

 "finansal-emniyet-testi": ("finansal-emniyet-testi", "Finansal Emniyet", "Testi",
   "Karsilayabilmek baska, guvenle karsilayabilmek baska. Karariniz yedi soktan geciyor.",
   ["7 senaryo", "Emniyet skoru"], "finans"),

 "fire-metodoloji": ("finansal-ozgurluk-hesaplama/metodoloji", "FIRE Simülasyonu", "Metodolojisi",
   "Monte Carlo nasıl kuruldu? Korelasyonlu getiri-enflasyon, Student-t ve 40 test.",
   ["40 test", "MIT"], "finans"),

 "finansal-ozgurluk-hesaplama": ("finansal-ozgurluk-hesaplama", "Finansal Özgürlük", "Hesaplama (FIRE)",
   "Tek bir gelecek değil binlerce senaryo. Bu plan hangi olasılıkla tutar?",
   ["Monte Carlo", "Olasılık"], "finans"),

 "birikim-metodoloji": ("birikim-hesaplama/metodoloji", "Birikim Hesabı", "Metodolojisi",
   "Reel getiri neden çıkarmayla değil Fisher denklemiyle bulunur? BES devlet katkısı ve stopaj. 67 test.",
   ["67 test", "MIT"], "finans"),

 "birikim-hesaplama": ("birikim-hesaplama", "BES ve Birikim", "Hesaplama",
   "%45 getiri, %40 enflasyon: kazancınız %5 değil %3,57. Reel getiri, devlet katkısı ve hak kazanma.",
   ["Reel getiri", "Devlet katkısı"], "finans"),

 "kredi-metodoloji": ("kredi-hesaplama/metodoloji", "Kredi Hesabı", "Metodolojisi",
   "Taksit formülü, brütleşmiş maliyet oranı, YMO ve erken kapama nasıl hesaplanıyor? 64 test.",
   ["64 test", "MIT"], "finans"),

 "kredi-hesaplama": ("kredi-hesaplama", "Kredi Hesaplama", "ve Gerçek Maliyet",
   "Bankanın ilan ettiği faiz ödeyeceğiniz maliyet değildir: KKDF, BSMV ve masraflarla yıllık maliyet oranı.",
   ["YMO hesabı", "Ödeme planı"], "finans"),

 "vadeli-mevduat-hesaplama": ("vadeli-mevduat-hesaplama", "Vadeli Mevduat", "Faizi Hesaplama",
   "Anapara, faiz oranı ve vadeye göre brüt faiz, stopaj ve net getiri.",
   ["Stopaj dahil", "Net getiri"], "finans"),

 "kira-artisi-hesaplama": ("kira-artisi-hesaplama", "Kira Artışı", "Hesaplama 2026",
   "Konut ve iş yeri kirasında 12 aylık TÜFE ortalamasına göre yasal azami oran.",
   ["TÜFE tavanı", "Konut & iş yeri"], "finans"),

 "doviz-kurlari": ("doviz-kurlari", "TCMB", "Döviz Kurları",
   "Merkez Bankası gösterge kurları, her iş günü otomatik güncellenir.",
   ["Resmî veri", "Her iş günü"], "finans"),

 "erken-kapatma-analizi": ("erken-kapatma-analizi", "Erken Kapatmak mı,", "Yatırım mı?",
   "Kararın tersine döndüğü getiri eşiği ve erken ödeme tazminatının yasal sınırı (TKHK m.27, m.37).",
   ["Başabaş eşiği", "TKHK m.27/37"], "finans"),

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
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def kontrast(a, b):
    la, lb = _isik(a), _isik(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def kontrast_raporu():
    """Her vurgu rengini ZEMIN uzerinde dogrular.

    Onceki surumde olcut beyaz yazinin koyu zemin uzerindeki kontrastiydi.
    Kart tersine dondugu icin olcut de dondu: artik koyu murekkep ve
    vurgu renginin ACIK zemin uzerindeki okunurlugu olculuyor.

    Sinirlar: govde metni 4.5 (WCAG AA), buyuk baslik 3.0. Vurgu hem
    kunye (kucuk) hem cubuk (buyuk alan) icin kullanildigindan kucuk
    metin sinirina tabi.
    """
    kotu = 0
    print("%-10s %-9s  zemin@vurgu  durum" % ("aile", "renk"))
    for aile in sorted(AILE_VURGU):
        v = AILE_VURGU[aile]
        o = kontrast(v, ZEMIN)
        gecti = o >= 4.5
        kotu += 0 if gecti else 1
        print("%-10s %-9s  %11.2f  %s" % (aile, v, o, "geçti" if gecti else "KALDI"))

    print()
    for ad, renk, sinir in (("mürekkep", MUREKKEP, 7.0),
                            ("ikincil", IKINCIL, 4.5),
                            ("soluk", SOLUK, 3.0),
                            ("nötr çubuk", NOTR, 1.3)):
        o = kontrast(renk, ZEMIN)
        gecti = o >= sinir
        kotu += 0 if gecti else 1
        print("%-10s %-9s  %11.2f  %s (alt sınır %.1f)"
              % (ad, renk, o, "geçti" if gecti else "KALDI", sinir))

    print("\n%d renk, %d kaldı." % (len(AILE_VURGU) + 4, kotu))
    return 1 if kotu else 0


# --------------------------------------------------------------- sablonlar --
# Tek sablon, iki govde. Dokuya, gradyana, rozete, logoya yer yok:
# kartin tasidigi her isaret bir seyi SOYLEMEK zorunda.

SAYFA = string.Template("""<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><style>
  html,body{margin:0;padding:0;background:$zemin}
  body{width:1200px;height:630px;overflow:hidden}
  svg{display:block}
  /* TEK AILE, IKI AGIRLIK. Sistem grotesk yigini — site de ayni
     yigini kullaniyor, kart ile sayfa ayni yazi tipinde okunuyor. */
  text{font-family:"Segoe UI Variable Display","Segoe UI",Inter,
       "Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:500;fill:$murekkep}
  .kunye{font-size:15px;font-weight:700;letter-spacing:.18em;fill:$vurgu}
  .soru{font-size:32px;fill:$ikincil}
  .cevap{font-size:$punto;font-weight:800;letter-spacing:-.035em}
  .birim{font-size:52px;font-weight:700;fill:$ikincil;letter-spacing:-.02em}
  .satir{font-size:20px;fill:$ikincil;font-variant-numeric:tabular-nums}
  .baslik{font-size:${bpunto}px;font-weight:800;letter-spacing:-.03em;line-height:1}
  .vurgulu{fill:$vurgu}
  .aciklama{font-size:24px;fill:$ikincil}
  .imza{font-size:15px;font-weight:700;letter-spacing:.2em;fill:$ikincil}
  .alan{font-size:15px;font-weight:500;letter-spacing:.06em;fill:$soluk}
</style></head><body>
<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="$alt">
  <rect width="1200" height="630" fill="$zemin"/>
$govde
  <line x1="64" y1="556" x2="1136" y2="556" stroke="$hat" stroke-width="1"/>
  <text class="imza" x="64" y="588">KORAY ÖNER</text>
  <text class="alan" x="1136" y="588" text-anchor="end">$url</text>
</svg>
</body></html>""")


def _e(s):
    return html.escape(s or "", quote=True)


def veri_govdesi(kunye, soru, cevap, birimX, cubuk, satirlar):
    """Cevabi sayi olan sayfa: rakam mansettir."""
    ic = ['  <text class="kunye" x="64" y="104">%s</text>' % _e(kunye),
          '  <text class="soru" x="64" y="182">%s</text>' % _e(soru),
          '  <text class="cevap" x="64" y="318">%s</text>' % _e(cevap),
          '  <text class="birim" x="%d" y="318">TL</text>' % birimX]
    # Cubuk TAM GENISLIK (1072 px): dar cubukta kucuk dilim goze
    # gorunmuyordu. Dilimler arasi bosluk yok; 2 px ayirici kucuk dilimi
    # tamamen yok edebiliyor, ayrim ton farkiyla saglaniyor.
    x = 64
    for genislik, renk in cubuk:
        ic.append('  <rect x="%.1f" y="392" width="%.1f" height="40" fill="%s"/>'
                  % (x, genislik, renk))
        x += genislik
    y = 472
    for s in satirlar:
        ic.append('  <text class="satir" x="64" y="%d">%s</text>' % (y, _e(s)))
        y += 30
    return "\n".join(ic)


def baslik_govdesi(kunye, ust, alt, aciklama):
    """Cevabi tek sayiya inmeyen sayfa: baslik mansettir.

    Iki parcali baslik SPEC'ten olduğu gibi geliyor; ikinci parca vurgu
    renginde. Uydurma sayi ya da temsili grafik YOK.
    """
    ic = ['  <text class="kunye" x="64" y="104">%s</text>' % _e(kunye)]
    y = 236 if alt else 210
    ic.append('  <text class="baslik" x="64" y="%d">%s</text>' % (y, _e(ust)))
    if alt:
        ic.append('  <text class="baslik vurgulu" x="64" y="%d">%s</text>'
                  % (y + 92, _e(alt)))
    if aciklama:
        ay = y + (170 if alt else 78)
        for i, satir in enumerate(_sar(aciklama, 62)[:2]):
            ic.append('  <text class="aciklama" x="64" y="%d">%s</text>'
                      % (ay + i * 34, _e(satir)))
    return "\n".join(ic)


def _sar(metin, en):
    """Aciklamayi kelime sinirinda sarar; kirpma yok, tasma yok."""
    kelimeler = metin.split()
    satirlar, cur = [], ""
    for k in kelimeler:
        if len(cur) + len(k) + 1 > en and cur:
            satirlar.append(cur)
            cur = k
        else:
            cur = (cur + " " + k).strip()
    if cur:
        satirlar.append(cur)
    return satirlar


def _sayi(s):
    return float(str(s).replace(".", "").replace(",", "."))


def _tl(n):
    return "{:,.2f}".format(n).replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def belge(ad, spec, vurgu, rakam=None):
    yol, ust, alt, aciklama, _rozet, aile = spec
    kunye = AILE_KUNYE.get(aile, aile.upper())
    # Kartta yalniz alan adi: tam yol paylasim platformunun kendi
    # kunyesinde zaten yaziyor, kartta tekrar olur ve imza satirini
    # sikistirir.
    url = DOMAIN

    if rakam:
        # Kesintiler brut ile netin FARKI: bordro yeniden hesaplanmiyor,
        # sayfanin kendi iki sayisindan cikiyor.
        brut = _sayi(rakam["brut"])
        net = _sayi(rakam["ocakTam"])
        kesinti = brut - net
        tam = 1072.0
        kesintiEn = tam * kesinti / brut
        cubuk = [(kesintiEn, NOTR), (tam - kesintiEn, vurgu)]
        cevap = rakam["ocakTam"]
        # "TL" rakamin hemen sagina: karakter basina ~0.56 em (800 agirlik).
        punto = 112 if len(cevap) <= 10 else 96
        birimX = 64 + int(len(cevap) * punto * 0.555) + 28
        govde = veri_govdesi(
            kunye, ust, cevap, birimX, cubuk,
            ["Kesintiler %s TL" % _tl(kesinti),
             "Aralık ayında net %s TL" % rakam["aralikTam"]])
        alt_metin = "%s: %s TL net" % (ust, cevap)
    else:
        govde = baslik_govdesi(kunye, ust, alt, aciklama)
        punto = 112
        alt_metin = " ".join(x for x in (ust, alt) if x)

    return SAYFA.substitute(
        zemin=ZEMIN, murekkep=MUREKKEP, ikincil=IKINCIL, soluk=SOLUK,
        hat=HAT, vurgu=vurgu, punto="%dpx" % punto, bpunto=_bpunto(ust, alt),
        govde=govde, url=url, alt=_e(alt_metin))


def _bpunto(ust, alt):
    """Baslik puntosu en uzun satira gore: tasma olmasin, kucuk de kalmasin."""
    en = max(len(ust or ""), len(alt or ""))
    if en <= 14:
        return 88
    if en <= 20:
        return 72
    if en <= 26:
        return 60
    return 50


# ------------------------------------------------------- maas sayfa kartlari -

def maas_spec():
    """maas-hesaplama/<tutar>-tl-brut-ne-kadar-net/ sayfalarindan kart uretir.

    Rakamlar SAYFANIN KENDI og:description'indan okunur; kart ile sayfa
    ayrisamaz. Bordro burada yeniden hesaplanmiyor — kesinti, brut ile
    netin farkidir.
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
        brut = re.sub(r"\s*Brüt.*", "", re.sub(r"<[^>]+>", "", h.group(1))).strip()
        brutSayi = re.sub(r"[^\d.]", "", brut)
        out["maas-" + klasor] = (
            "maas-hesaplama/" + klasor,
            "%s brüt maaşın neti" % brut,
            "", "", [], "bordro",
            {"brut": brutSayi, "ocakTam": m.group(1), "aralikTam": m.group(2)},
        )
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


def main():
    if "--kontrast" in sys.argv:
        return kontrast_raporu()

    hepsi = tum_spec()

    if "--list" in sys.argv:
        for ad in sorted(hepsi):
            v = hepsi[ad]
            tur = "veri" if len(v) > 6 else "başlık"
            print("%-46s %-9s %-7s -> %s/%s"
                  % (ad, v[5], tur, DOMAIN, v[0]))
        return 0

    chrome = find_chrome()
    if not chrome:
        print("HATA: Chrome/Edge bulunamadi.", file=sys.stderr)
        return 1
    print("Tarayici:", chrome)

    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    todo = args or sorted(hepsi)
    ok = 0
    for ad in todo:
        if ad not in hepsi:
            print("!! taninmayan:", ad)
            continue
        spec = hepsi[ad]
        rakam = spec[6] if len(spec) > 6 else None
        aile = spec[5]
        if aile not in AILE_VURGU:
            raise SystemExit("Bilinmeyen kart ailesi: %r" % aile)
        print("-", ad)
        doc = belge(ad, spec[:6], AILE_VURGU[aile], rakam)
        if render(chrome, ad, doc):
            ok += 1
    print("\nÜretilen: %d / %d" % (ok, len(todo)))
    return 0 if ok == len(todo) else 1


if __name__ == "__main__":
    sys.exit(main())
