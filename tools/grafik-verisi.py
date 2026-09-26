#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Grafikler sayfasının dış verisini çek, doğrula, finans/grafik-verisi.js'e yaz.

ÜÇ KAYNAK, ÜÇ DOĞRULAMA
-----------------------
1. DOLAR/TL, AY SONU — TCMB günlük kur arşivi (kurlar/YYYYMM/DDMMYYYY.xml,
   döviz satış). Her ayın son iş günü bülteni. 2005-01'den başlar: Aralık
   2004 bülteni eski TL cinsindendir (1 YTL = 1.000.000 TL), taban
   karışmasın diye alınmaz. Doğrulama: doviz-kurlari/seri.json aynı
   bültenleri gece gece tutuyor; iki yol aynı günde aynı kuru vermeli.

2. POLİTİKA FAİZİ — TCMB "1 Hafta Repo" tablosu (yalnızca DEĞİŞİKLİK
   tarihlerini listeler; faizin sabit tutulduğu toplantılar tabloda yoktur).
   2010-05-20'den önce politika faizi bir hafta vadeli repo değildi, seri
   oradan başlar. Doğrulama: bilinen dört karar tabloda aynen bulunmalı.

3. DÜNYADA ENFLASYON — Dünya Bankası WDI, FP.CPI.TOTL.ZG (tüketici
   fiyatları, yıllık ortalama % değişim). Doğrulama: Türkiye satırı,
   sitenin kendi TÜFE serisinden (finans/tufe-serisi.js) hesaplanan yıllık
   ortalama değişimle 2006'dan bu yana her yıl 0,05 puan içinde tutmalı.
   2026-09-26'da ölçüldü: 20 yılın en büyük farkı 0,022 puan.

REDDEDİLEN VERİ (dosya YAZILMAZ, çıkış kodu 1)
----------------------------------------------
- Depodaki geçmiş bir ayın kuru, geçmiş bir faiz kararı değişirse
  (bülten ve karar geriye dönük değişmez; değişim ayrıştırma hatasıdır).
- Aylık kur değişimi ±%40 dışında, faiz 0–100 dışında.
- Dünya Bankası Türkiye satırı TÜFE serisiyle tutmazsa.
  (Dünya Bankası son iki yılı revize edebilir; o yıllar üzerine yazılır.)

  python tools/grafik-verisi.py           # çek, doğrula, değiştiyse yaz
  python tools/grafik-verisi.py --check   # dosya ile kaynak kuralları tutarlı mı (ağsız)
"""
import calendar
import datetime as dt
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEDEF = os.path.join(KOK, "finans", "grafik-verisi.js")
SERI_JSON = os.path.join(KOK, "doviz-kurlari", "seri.json")
UA = "Mozilla/5.0 (korayoner.dev veri guncelleme; +https://korayoner.dev/)"

KUR_ILK = "2005-01"
REPO_URL = ("https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/"
            "Temel+Faaliyetler/Para+Politikasi/Merkez+Bankasi+Faiz+Oranlari/1+Hafta+Repo")
REPO_CAPA = [("2010-05-20", 7.0), ("2018-09-14", 24.0), ("2023-08-25", 25.0), ("2024-03-22", 50.0)]

WB_GOSTERGE = "FP.CPI.TOTL.ZG"
WB_ILK = 2000
# G20 üyeleri; Avrupa Birliği yerine euro bölgesi (EMU) — para politikası
# tek olan ekonomi o. Sıra: kod, Türkçe ad.
ULKELER = [
    ("TUR", "Türkiye"), ("ARG", "Arjantin"), ("RUS", "Rusya"), ("BRA", "Brezilya"),
    ("MEX", "Meksika"), ("ZAF", "Güney Afrika"), ("IND", "Hindistan"), ("IDN", "Endonezya"),
    ("SAU", "Suudi Arabistan"), ("CHN", "Çin"), ("KOR", "Güney Kore"), ("JPN", "Japonya"),
    ("USA", "ABD"), ("GBR", "Birleşik Krallık"), ("DEU", "Almanya"), ("FRA", "Fransa"),
    ("ITA", "İtalya"), ("CAN", "Kanada"), ("AUS", "Avustralya"), ("EMU", "Euro bölgesi"),
]


def al(url, zaman=30):
    istek = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=zaman) as y:
        return y.read()


# ------------------------------------------------------------------ mevcut dosya
def oku():
    if not os.path.exists(HEDEF):
        return None
    metin = io.open(HEDEF, encoding="utf-8").read()
    m = re.search(r"/\*VERI\*/(.*?)/\*VERI-SON\*/", metin, re.S)
    return json.loads(m.group(1)) if m else None


def yaz(veri):
    govde = json.dumps(veri, ensure_ascii=False, indent=2, sort_keys=False)
    metin = u'''/*!
 * Grafikler sayfasının dış verisi — ÜRETİLİR, ELLE DÜZENLENMEZ.
 *
 * Üreteç : tools/grafik-verisi.py (her iş günü, veri-guncelle.yml)
 * Kaynaklar ve doğrulama kuralları üretecin başındaki açıklamada.
 *
 *   kur          ay sonu TCMB döviz satış kuru, 1 birim = TL
 *   politikaFaizi  [tarih, yüzde] — yalnızca faizin DEĞİŞTİĞİ kararlar
 *   dunya        Dünya Bankası, tüketici fiyatları yıllık ortalama % değişim
 *
 * Lisans: MIT — Koray Öner, https://korayoner.dev/
 */
(function (root, factory) {
  "use strict";
  var v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.GrafikVerisi = v;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return /*VERI*/__GOVDE__/*VERI-SON*/;
});
'''.replace("__GOVDE__", govde)
    io.open(HEDEF, "w", encoding="utf-8", newline="\n").write(metin)


# ------------------------------------------------------------------ 1) kur
def bulten(gun):
    url = "https://www.tcmb.gov.tr/kurlar/%s/%s.xml" % (gun.strftime("%Y%m"), gun.strftime("%d%m%Y"))
    try:
        kok = ET.fromstring(al(url, 20))
    except Exception:
        return None
    cikti = {}
    for c in kok.findall("Currency"):
        kod = c.get("CurrencyCode")
        if kod not in ("USD", "EUR"):
            continue
        try:
            cikti[kod] = round(float(c.findtext("ForexSelling").strip()) / float((c.findtext("Unit") or "1").strip()), 4)
        except (AttributeError, TypeError, ValueError):
            pass
    return cikti if len(cikti) == 2 else None


def ay_sonu(yil, ay):
    son = dt.date(yil, ay, calendar.monthrange(yil, ay)[1])
    for geri in range(10):
        g = son - dt.timedelta(days=geri)
        if g.weekday() >= 5:
            continue
        b = bulten(g)
        if b:
            b["tarih"] = g.isoformat()
            return b
        time.sleep(0.2)
    raise RuntimeError("%d-%02d için ay sonu bülteni bulunamadı" % (yil, ay))


def aylar(ilk, son):
    y, a = map(int, ilk.split("-"))
    sy, sa = map(int, son.split("-"))
    while (y, a) <= (sy, sa):
        yield y, a
        a += 1
        if a == 13:
            y, a = y + 1, 1


def kur_guncelle(eski):
    bugun = dt.date.today()
    onceki = (bugun.replace(day=1) - dt.timedelta(days=1))
    son = "%d-%02d" % (onceki.year, onceki.month)       # son TAMAMLANMIŞ ay
    kur = dict(eski or {})
    for y, a in aylar(KUR_ILK, son):
        anahtar = "%d-%02d" % (y, a)
        if anahtar in kur:
            continue
        kur[anahtar] = ay_sonu(y, a)
        sys.stdout.write(".")
        sys.stdout.flush()
    return kur


def kur_dogrula(kur, eski):
    hata = []
    anahtarlar = sorted(kur)
    if anahtarlar[0] != KUR_ILK:
        hata.append("kur serisi %s ile başlamalı" % KUR_ILK)
    beklenen = ["%d-%02d" % ya for ya in aylar(anahtarlar[0], anahtarlar[-1])]
    if beklenen != anahtarlar:
        hata.append("kur serisinde ay atlaması var")
    for k in eski or {}:
        if eski[k] != kur.get(k):
            hata.append("geçmiş ay değişti: %s" % k)
    for a, b in zip(anahtarlar, anahtarlar[1:]):
        for p in ("USD", "EUR"):
            oran = kur[b][p] / kur[a][p]
            if not 0.6 < oran < 1.4:
                hata.append("%s %s aylık değişim makul değil (%.2f)" % (b, p, oran))
    # İkinci yol: gece tutulan günlük seri aynı bültenleri içeriyor.
    try:
        gunluk = {r["tarih"]: r for r in json.load(io.open(SERI_JSON, encoding="utf-8"))["kayitlar"]}
    except (IOError, ValueError, KeyError):
        gunluk = {}
    eslesen = 0
    for k in anahtarlar:
        g = gunluk.get(kur[k]["tarih"])
        if g:
            eslesen += 1
            for p in ("USD", "EUR"):
                if abs(g[p] - kur[k][p]) > 0.00015:
                    hata.append("%s %s: arşiv %.4f, günlük seri %.4f" % (k, p, kur[k][p], g[p]))
    return hata, eslesen


# ------------------------------------------------------------------ 2) politika faizi
def repo_cek():
    ham = al(REPO_URL)
    for kodlama in ("utf-8", "cp1254", "iso-8859-9"):
        try:
            metin = ham.decode(kodlama)
            break
        except UnicodeDecodeError:
            continue
    kararlar = []
    for satir in re.findall(r"<tr[^>]*>(.*?)</tr>", metin, re.S):
        h = [re.sub(r"<[^>]+>|&nbsp;", "", x).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", satir, re.S)]
        if len(h) >= 3 and re.match(r"\d\d\.\d\d\.\d{4}$", h[0]):
            g, a, y = h[0].split(".")
            kararlar.append(["%s-%s-%s" % (y, a, g), float(h[2].replace(",", "."))])
    kararlar.sort()
    return kararlar


def repo_dogrula(kararlar, eski):
    hata = []
    sozluk = dict((t, v) for t, v in kararlar)
    for t, v in REPO_CAPA:
        if sozluk.get(t) != v:
            hata.append("bilinen karar eksik ya da farklı: %s %%%s" % (t, v))
    for t, v in eski or []:
        if sozluk.get(t) != v:
            hata.append("geçmiş karar değişti: %s" % t)
    for t, v in kararlar:
        if not 0 < v < 100:
            hata.append("makul olmayan faiz: %s %s" % (t, v))
    if len(kararlar) < 50:
        hata.append("tablo kısa: %d karar" % len(kararlar))
    return hata


# ------------------------------------------------------------------ 3) Dünya Bankası
def wb_cek():
    kodlar = ";".join(k for k, _ in ULKELER)
    url = ("https://api.worldbank.org/v2/country/%s/indicator/%s?format=json&date=%d:%d&per_page=2000"
           % (kodlar, WB_GOSTERGE, WB_ILK, dt.date.today().year))
    ust, satirlar = json.loads(al(url, 60))
    dunya = {k: {} for k, _ in ULKELER}
    for r in satirlar:
        k = r["countryiso3code"]
        if k in dunya and r["value"] is not None:
            dunya[k][r["date"]] = round(r["value"], 2)
    return dunya, ust.get("lastupdated", "")


def tufe_yillik_ortalama():
    """finans/tufe-serisi.js'ten yıllık ortalama % değişim (node ile okunur)."""
    js = ("var T=require('./finans/tufe-serisi.js'),v=100,i={};"
          "Object.keys(T.aylar).sort().forEach(function(a){v*=1+T.aylar[a].aylik/100;i[a]=v;});"
          "var o={};for(var y=2005;y<=2100;y++){var s=0,n=0;for(var m=1;m<=12;m++){var k=y+'-'+(m<10?'0':'')+m;"
          "if(k in i){s+=i[k];n++;}}if(n===12)o[y]=s/12;}var r={};"
          "Object.keys(o).forEach(function(y){if(o[y-1])r[y]=100*(o[y]/o[y-1]-1);});"
          "console.log(JSON.stringify(r));")
    cikti = subprocess.run(["node", "-e", js], cwd=KOK, capture_output=True, text=True, check=True).stdout
    return json.loads(cikti)


def wb_dogrula(dunya):
    hata = []
    tufe = tufe_yillik_ortalama()
    sinanan = 0
    for yil, deger in dunya.get("TUR", {}).items():
        if yil in tufe:
            sinanan += 1
            if abs(tufe[yil] - deger) > 0.05:
                hata.append("Dünya Bankası TUR %s = %.2f, TÜFE serisi %.2f" % (yil, deger, tufe[yil]))
    if sinanan < 15:
        hata.append("Türkiye satırı TÜFE ile yalnızca %d yılda sınanabildi" % sinanan)
    # Arjantin'in 2007–2016 satırı Dünya Bankası'nda yok: resmî istatistik
    # (INDEC) o yıllarda güvenilirliğini yitirmişti. Eksik yıl hata değil;
    # hata, sıralama grafiğinin yılında bir ülkenin eksik olması.
    if karsilastirma_yili(dunya) is None:
        hata.append("bütün ülkelerin verisinin bulunduğu bir yıl yok")
    return hata, sinanan


def karsilastirma_yili(dunya):
    """Bütün ülkelerde verisi olan en son yıl (sıralama grafiği bu yılı çizer)."""
    ortak = None
    for k, _ in ULKELER:
        yillar = set(dunya.get(k, {}))
        ortak = yillar if ortak is None else ortak & yillar
    return max(ortak) if ortak else None


# ------------------------------------------------------------------ ana akış
def main():
    eski = oku() or {}
    if "--check" in sys.argv:
        if not eski:
            print("finans/grafik-verisi.js yok")
            return 1
        h1, eslesen = kur_dogrula(eski["kur"], None)
        h2 = repo_dogrula(eski["politikaFaizi"], None)
        h3, sinanan = wb_dogrula(eski["dunya"])
        hata = h1 + h2 + h3
        for x in hata:
            print("  HATA  " + x)
        print("Grafik verisi: %d ay kur (%d ay günlük seriyle eşleşti), %d faiz kararı, "
              "%d ülke (TUR %d yılda TÜFE ile tutuyor)." % (
                  len(eski["kur"]), eslesen, len(eski["politikaFaizi"]), len(eski["dunya"]), sinanan))
        return 1 if hata else 0

    kur = kur_guncelle(eski.get("kur"))
    print()
    h1, eslesen = kur_dogrula(kur, eski.get("kur"))
    kararlar = repo_cek()
    h2 = repo_dogrula(kararlar, eski.get("politikaFaizi"))
    dunya, wb_tarih = wb_cek()
    h3, sinanan = wb_dogrula(dunya)
    hata = h1 + h2 + h3
    if hata:
        for x in hata:
            print("  RED  " + x)
        print("Veri reddedildi; finans/grafik-verisi.js yazılmadı.")
        return 1
    yeni = {
        "kaynaklar": {
            "kur": "TCMB günlük kur bülteni arşivi, döviz satış, ayın son iş günü",
            "kurUrl": "https://www.tcmb.gov.tr/kurlar/kurlar_tr.html",
            "politikaFaizi": "TCMB, Merkez Bankası Faiz Oranları — 1 Hafta Repo",
            "politikaFaiziUrl": REPO_URL,
            "dunya": "Dünya Bankası, Dünya Kalkınma Göstergeleri — " + WB_GOSTERGE,
            "dunyaUrl": "https://data.worldbank.org/indicator/" + WB_GOSTERGE,
            "dunyaGuncelleme": wb_tarih,
        },
        "ulkeler": [[k, ad] for k, ad in ULKELER],
        "kur": dict(sorted(kur.items())),
        "politikaFaizi": kararlar,
        "dunya": {k: dict(sorted(v.items())) for k, v in dunya.items()},
    }
    karsilastir = dict(yeni)
    if eski and json.dumps(eski, sort_keys=True) == json.dumps(karsilastir, sort_keys=True):
        print("Grafik verisi güncel.")
        return 0
    yaz(yeni)
    print("Grafik verisi yazıldı: %d ay kur (%d ay günlük seriyle eşleşti), %d faiz kararı, "
          "%d ülke (TUR %d yılda TÜFE ile tutuyor)." % (len(kur), eslesen, len(kararlar), len(dunya), sinanan))
    return 0


if __name__ == "__main__":
    sys.exit(main())
