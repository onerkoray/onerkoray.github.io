#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1200x630 OG (paylasim) kapaklarini uretir.

Neden gerekli: eski kapaklarin ICINE eski alan adi piksel olarak gomulmustu
(orn. "onerkoray.github.io/mtv-hesaplama"). Domain tasimasi metni degistirdi
ama gorseli degistiremezdi; link paylasildiginda hala eski adres gorunuyordu.

Yontem: HTML sablonu headless Chrome ile 1200x630 ekran goruntusune cevrilir.
Boylece sitenin kendi yazi tipi ve renkleriyle birebir ayni sonuc alinir.

Kullanim:
    python tools/make-og.py                 # hepsini uret
    python tools/make-og.py maas-hesaplama  # sadece belirtilenleri uret
    python tools/make-og.py --list          # uretilecekleri listele
"""

import base64
import html
import os
import shutil
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

# dosya adi -> (url yolu, beyaz bolum, krem bolum, alt yazi, rozetler)
SPEC = {
 "koray-oner-kapak": ("", "Ücretsiz açık kaynak", "web araçları",
   "Hesaplayıcılar, dönüştürücüler, üreteçler ve günlük hayatı kolaylaştıran pratik araçlar.",
   ["Ücretsiz", "Reklamsız", "Üyeliksiz", "Açık kaynak"]),

 "bordro": ("bordro", "Bordro", "Motoru",
   "Maaş hesaplarının açık çekirdeği: 2020-2026 parametreleri, metodoloji ve değişiklik günlüğü.",
   ["Açık kaynak", "2020-2026", "70 test", "MIT"]),

 "sahis-mi-limited-mi": ("makaleler/sahis-mi-limited-mi", "Sahis mi,", "Limited mi?",
   "Tek bir esik yok: kazanan gelir araliginda bes kez el degistiriyor. 2026 rakamlariyla.",
   ["Makale", "2026", "Kirilim noktalari", "Kaynakli"]),

 "asgari-ucret-nasil-belirlenir": ("makaleler/asgari-ucret-nasil-belirlenir", "Asgari Ucret", "Nasil Belirlenir?",
   "Komisyon, takvim ve az bilinen gercek: asgari ucret her calisanin netini degistirir.",
   ["Makale", "Komisyon", "Aralik takvimi", "Kaynakli"]),

 "maasim-neden-dustu": ("makaleler/maasim-neden-dustu", "Maaşım Neden", "Düştü?",
   "Kümülatif vergi matrahı ay ay: hangi ayda dilim atlarsınız, net neden bazen yükselir?",
   ["Makale", "2026 rakamları", "Kaynaklı", "Ay ay tablo"]),

 "maas-hesaplama": ("maas-hesaplama", "Brüt Net", "Maaş Hesaplama 2026",
   "Güncel vergi dilimleri, SGK tavanı ve damga vergisiyle ay ay 12 aylık bordro.",
   ["Ücretsiz", "Reklamsız", "12 aylık bordro", "Netten brüte"]),

 "calisma-bicimi-karsilastirma": ("calisma-bicimi-karsilastirma", "Şahıs mı, Limited mi,", "Maaşlı mı?",
   "Aynı maliyet dört çalışma biçiminde ne kadarını size bırakıyor? Vergi, prim ve gider dahil.",
   ["Ücretsiz", "Reklamsız", "4 senaryo", "Kesişim tablosu"]),

 "isten-ayrilma-hesaplama": ("isten-ayrilma-hesaplama", "İşten Ayrılma", "Paketi 2026",
   "Kıdem, ihbar, izin, son ücret ve işsizlik maaşı tek hesapta — ödeme takvimiyle.",
   ["Ücretsiz", "Reklamsız", "Hak matrisi", "Ödeme takvimi"]),

 "kidem-tazminati-hesaplama": ("kidem-tazminati-hesaplama", "Kıdem ve İhbar", "Tazminatı 2026",
   "Güncel tavan, giydirilmiş brüt ücret ve damga vergisiyle gün gün hesaplama.",
   ["Ücretsiz", "Reklamsız", "Güncel tavan", "PDF rapor"]),

 "issizlik-maasi-hesaplama": ("issizlik-maasi-hesaplama", "İşsizlik Maaşı", "Hesaplama 2026",
   "Son 4 aylık brüt kazanca ve prim gün sayısına göre ödenek, tavan ve süre.",
   ["Ücretsiz", "Reklamsız", "2026 parametreleri", "Süre hesabı"]),

 "serbest-meslek-makbuzu-hesaplama": ("serbest-meslek-makbuzu-hesaplama", "Serbest Meslek", "Makbuzu Hesaplama",
   "Brütten nete veya netten brüte; stopaj, KDV ve KDV tevkifatı dahil.",
   ["Ücretsiz", "Reklamsız", "Stopaj + KDV", "Tevkifat"]),

 "kdv-hesaplama": ("kdv-hesaplama", "KDV", "Hesaplama",
   "KDV hariç tutara KDV ekleyin ya da KDV dahil tutardan KDV'yi ayırın.",
   ["Ücretsiz", "Reklamsız", "%1 · %10 · %20", "Anında"]),

 "mtv-hesaplama": ("mtv-hesaplama", "MTV", "Hesaplama 2026",
   "Motor hacmi, yaş ve taşıt değerine göre yıllık vergi + taksitler.",
   ["Ücretsiz", "Reklamsız", "2026 tarifesi", "Projeksiyon"]),

 "otv-hesaplama": ("otv-hesaplama", "Araç ÖTV", "Hesaplama",
   "Motor hacmi ve matraha göre ÖTV, KDV ve anahtar teslim fiyat.",
   ["Ücretsiz", "Reklamsız", "Hibrit & elektrikli", "Vergi yükü"]),

 "gumruk-vergisi-hesaplama": ("gumruk-vergisi-hesaplama", "Gümrük Vergisi", "Hesaplama 2026",
   "Yurt dışı alışverişte vergi, IMEI kayıt harcı ve toplam maliyet.",
   ["Ücretsiz", "Reklamsız", "AB & diğer ülke", "IMEI harcı"]),

 "kredi-hesaplama": ("kredi-hesaplama", "Kredi", "Hesaplama 2026",
   "İhtiyaç, konut ve taşıt kredisinde taksit ve ay ay ödeme planı.",
   ["Ücretsiz", "Reklamsız", "Ödeme planı", "Toplam faiz"]),

 "vadeli-mevduat-hesaplama": ("vadeli-mevduat-hesaplama", "Vadeli Mevduat", "Faizi Hesaplama",
   "Anapara, faiz oranı ve vadeye göre brüt faiz, stopaj ve net getiri.",
   ["Ücretsiz", "Reklamsız", "Stopaj dahil", "Net getiri"]),

 "kira-artisi-hesaplama": ("kira-artisi-hesaplama", "Kira Artışı", "Hesaplama 2026",
   "Konut ve iş yeri kirasında 12 aylık TÜFE ortalamasına göre yasal azami oran.",
   ["Ücretsiz", "Reklamsız", "TÜFE tavanı", "Konut & iş yeri"]),

 "yuzde-hesaplama": ("yuzde-hesaplama", "Yüzde", "Hesaplama",
   "Bir sayının yüzdesi, iki sayı arasındaki yüzde, artış ve azalış.",
   ["Ücretsiz", "Reklamsız", "Formüllerle", "Örneklerle"]),

 "birim-cevirici": ("birim-cevirici", "Birim", "Çevirici",
   "Uzunluk, ağırlık, sıcaklık, alan, hacim, hız, veri ve zaman dönüşümü.",
   ["Ücretsiz", "Reklamsız", "8 kategori", "Anında"]),

 "hesap-bolusme": ("hesap-bolusme", "Hesap", "Bölüşme (AA)",
   "Grup harcamasını kişi sayısına böler, bahşiş ekler, kuruşu adil dağıtır.",
   ["Ücretsiz", "Reklamsız", "Bahşiş dahil", "Adil kuruş"]),

 "yas-hesaplama": ("yas-hesaplama", "Yaş", "Hesaplama",
   "Doğum tarihine göre yıl, ay, gün ve doğum gününe kalan süre.",
   ["Ücretsiz", "Reklamsız", "İki tarih arası", "Anında"]),

 "final-notu-hesaplama": ("final-notu-hesaplama", "Final Notu", "Hesaplama",
   "Vize notu ve ağırlıklara göre geçmek için gereken final notu.",
   ["Ücretsiz", "Reklamsız", "Ağırlıklı", "Ortalama"]),

 "internet-hiz-testi": ("internet-hiz-testi", "İnternet", "Hız Testi",
   "İndirme hızınızı ve ping değerinizi tarayıcınızda ölçün.",
   ["Ücretsiz", "Reklamsız", "Kayıtsız", "Ping ölçümü"]),

 "son-depremler": ("son-depremler", "Son", "Depremler",
   "Türkiye ve çevresindeki son depremler, canlı liste ve arşiv sorgusu.",
   ["Ücretsiz", "Reklamsız", "Canlı liste", "Arşiv"]),

 "keymint": ("keymint", "KeyMint", "Şifre Üreteci",
   "Güçlü ve rastgele şifre üretin. Tamamen tarayıcıda, hiçbir yere gönderilmez.",
   ["Ücretsiz", "Reklamsız", "Tarayıcıda", "Kriptografik"]),

 "sifre-guc-testi": ("keymint/sifre-guc-testi", "Şifre", "Güç Testi",
   "Parolanızın gücünü entropi ve tahmini kırılma süresiyle ölçün.",
   ["Ücretsiz", "Reklamsız", "Entropi", "Tarayıcıda"]),

 "pin-uretici": ("keymint/pin-uretici", "PIN Kodu", "Üreteci",
   "4, 6 veya 8 haneli rastgele ve güvenli PIN oluşturun.",
   ["Ücretsiz", "Reklamsız", "Kriptografik", "Zayıf kalıp uyarısı"]),

 "parola-cumlesi": ("keymint/parola-cumlesi", "Parola Cümlesi", "Üreteci",
   "Kolay hatırlanan ama güçlü, kelimelerden oluşan parolalar.",
   ["Ücretsiz", "Reklamsız", "Passphrase", "Tarayıcıda"]),

 "wifi-sifresi": ("keymint/wifi-sifresi", "WiFi Şifresi", "Üreteci",
   "Misafirlerin kolayca yazabileceği, karışan karakter içermeyen parolalar.",
   ["Ücretsiz", "Reklamsız", "Kolay yazılır", "Güçlü"]),

 "hash-uretici": ("keymint/hash-uretici", "Hash", "Üreteci",
   "Metninizin SHA-256, SHA-1 veya SHA-512 özetini anında hesaplayın.",
   ["Ücretsiz", "Reklamsız", "SHA-256", "Tarayıcıda"]),

 "uuid-uretici": ("keymint/uuid-uretici", "UUID", "Üreteci (v4)",
   "Rastgele ve benzersiz kimlikler üretin; tek tek veya toplu.",
   ["Ücretsiz", "Reklamsız", "v4", "Toplu üretim"]),

 "base64": ("keymint/base64", "Base64", "Kodlayıcı & Çözücü",
   "Metni Base64'e kodlayın veya Base64'ü metne çözün. UTF-8 uyumlu.",
   ["Ücretsiz", "Reklamsız", "UTF-8", "Tarayıcıda"]),

 "torba-yasa-ne-var-ne-yok": ("makaleler/torba-yasa-ne-var-ne-yok", "Torba Yasada", "Ne Var, Ne Yok?",
   "5 Eylül 2026: sunulmuş teklif yok. Çıkanlar, takvim ve beklentiler ayrı ayrı.",
   ["Kaynaklı", "Güncel", "Reklamsız", "Makale"]),

 "kademeli-emeklilik-son-durum": ("makaleler/kademeli-emeklilik-son-durum", "Kademeli Emeklilik", "Son Durum 2026",
   "Teklif Meclis'te hangi aşamada, kimleri kapsıyor ve şu an hangi şartlar geçerli?",
   ["Kaynaklı", "Güncel", "Reklamsız", "Makale"]),

 "doviz-kurlari": ("doviz-kurlari", "TCMB", "Döviz Kurları",
   "Merkez Bankası gösterge kurları, her iş günü otomatik güncellenir.",
   ["Ücretsiz", "Reklamsız", "Resmî veri", "Her iş günü"]),
}

TPL = """<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html,body {{ width:1200px; height:630px; overflow:hidden; }}
  body {{
    font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
    background:#0e7c66; color:#fff; position:relative;
    background-image:
      radial-gradient(1100px 700px at 118% 8%,  rgba(255,255,255,.10), transparent 60%),
      radial-gradient(760px 520px at 96% 92%,   rgba(255,255,255,.08), transparent 62%),
      linear-gradient(122deg, #0a5f4e 0%, #0e7c66 46%, #14957a 100%);
  }}
  .pad {{ position:absolute; inset:78px 78px 60px; display:flex; flex-direction:column; }}
  .brow {{ display:flex; align-items:center; gap:22px; }}
  .badge {{ width:66px; height:66px; border-radius:17px; background:rgba(255,255,255,.16);
            display:flex; align-items:center; justify-content:center; flex:none;
            box-shadow:0 2px 10px rgba(0,0,0,.14); }}
  .badge img {{ width:52px; height:52px; display:block; }}
  .url {{ font-size:27px; font-weight:700; letter-spacing:-.01em; color:#fff; }}
  h1 {{ margin-top:34px; font-size:{fs}px; font-weight:800; line-height:1.06; letter-spacing:-.028em; }}
  h1 .c {{ color:#ffd479; }}
  .sub {{ margin-top:22px; font-size:30px; line-height:1.35; color:rgba(255,255,255,.93);
          max-width:1000px; font-weight:400; }}
  .pills {{ margin-top:auto; display:flex; gap:14px; flex-wrap:wrap; }}
  .pill {{ border:2px solid rgba(255,255,255,.78); border-radius:999px; padding:11px 22px;
           font-size:22px; font-weight:700; white-space:nowrap; }}
  .by {{ margin-top:20px; font-size:22px; color:rgba(255,255,255,.85); }}
  .by b {{ color:#fff; font-weight:700; }}
</style></head><body>
  <div class="pad">
    <div class="brow">
      <div class="badge"><img src="data:image/svg+xml;base64,{logo}" alt=""></div>
      <div class="url">{url}</div>
    </div>
    <h1>{white}<br><span class="c">{cream}</span></h1>
    <p class="sub">{sub}</p>
    <div class="pills">{pills}</div>
    <div class="by">Geliştiren: <b>Koray Öner</b></div>
  </div>
</body></html>"""


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def logo_b64():
    # Animasyonlu <style> bloğunu çıkar: ekran görüntüsünde ilk kare alınır,
    # sabit hali daha güvenilir.
    s = open(os.path.join(ROOT, "logo.svg"), encoding="utf-8").read()
    import re
    s = re.sub(r"<style>.*?</style>", "", s, flags=re.S)
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def render(chrome, name, spec, logo):
    path, white, cream, sub, pills = spec
    url = DOMAIN + ("/" + path if path else "")
    longest = max(len(white), len(cream))
    fs = 86 if longest <= 18 else (76 if longest <= 24 else 66)

    doc = TPL.format(
        logo=logo, url=html.escape(url), white=html.escape(white), cream=html.escape(cream),
        sub=html.escape(sub), fs=fs,
        pills="".join('<span class="pill">%s</span>' % html.escape(p) for p in pills),
    )

    tmp = tempfile.mkdtemp(prefix="og-")
    try:
        src = os.path.join(tmp, "c.html")
        with open(src, "w", encoding="utf-8") as f:
            f.write(doc)
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
        dest = os.path.join(OUT, name + ("-koray-oner.png" if name != "koray-oner-kapak" else ".png"))
        shutil.copyfile(out, dest)
        size = os.path.getsize(dest)
        print("   %-46s %6d bayt  (%s)" % (os.path.basename(dest), size, url))
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--list" in sys.argv:
        for k, v in SPEC.items():
            print("%-34s -> %s/%s" % (k, DOMAIN, v[0]))
        return 0

    chrome = find_chrome()
    if not chrome:
        print("HATA: Chrome/Edge bulunamadi.", file=sys.stderr)
        return 1
    print("Tarayici:", chrome)

    logo = logo_b64()
    todo = args or list(SPEC.keys())
    ok = 0
    for name in todo:
        if name not in SPEC:
            print("!! taninmayan:", name)
            continue
        print("-", name)
        if render(chrome, name, SPEC[name], logo):
            ok += 1
    print("\nUretilen: %d / %d" % (ok, len(todo)))
    return 0 if ok == len(todo) else 1


if __name__ == "__main__":
    sys.exit(main())
