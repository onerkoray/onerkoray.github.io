# korayoner.dev

Koray Öner'in kişisel sitesi (korayoner.dev) ve açık kaynak proje koleksiyonunun ana giriş noktası.

Modern web teknolojileriyle (HTML, CSS, vanilla JavaScript) geliştirilen; hızlı, erişilebilir
ve ücretsiz web araçları. Framework yok, bağımlılık yok, derleme adımı yok.

**Canlı:** https://korayoner.dev/

## Projeler

- **[Brüt Net Maaş Hesaplama](https://korayoner.dev/maas-hesaplama/)** — 2020-2026 arası her bordro yılı için 12 aylık döküm, netten brüte çevirme.
- **[Bordro Motoru](https://korayoner.dev/bordro/)** — maaş hesaplarının açık çekirdeği: yıl yıl yasal parametreler, metodoloji, değişiklik günlüğü.
- **[Şahıs mı, Limited mi, Maaşlı mı?](https://korayoner.dev/calisma-bicimi-karsilastirma/)** — aynı yıllık maliyetin dört çalışma biçiminde ne kadarının elde kaldığı; kesişim tablosuyla.
- **[İşten Ayrılma Paketi Hesaplama](https://korayoner.dev/isten-ayrilma-hesaplama/)** — kıdem, ihbar, yıllık izin, son ay ücreti ve işsizlik maaşı tek hesapta; fesih türüne göre hak matrisi ve ödeme takvimi.
- **[Kıdem ve İhbar Tazminatı Hesaplama 2026](https://korayoner.dev/kidem-tazminati-hesaplama/)** — güncel tavanla kıdem/ihbar tazminatı.
- **[KDV Hesaplama](https://korayoner.dev/kdv-hesaplama/)** — KDV dahil/hariç tutar hesaplama.
- **[Yüzde Hesaplama](https://korayoner.dev/yuzde-hesaplama/)** — oran, indirim, artış/azalış.
- **[Yaş Hesaplama](https://korayoner.dev/yas-hesaplama/)** — yıl/ay/gün yaş ve doğum gününe kalan süre.
- **[Final Notu Hesaplama](https://korayoner.dev/final-notu-hesaplama/)** — geçme notu ve ortalama.
- **[İnternet Hız Testi](https://korayoner.dev/internet-hiz-testi/)** — indirme hızı ve ping.
- **[Son Depremler](https://korayoner.dev/son-depremler/)** — canlı Kandilli listesi, renkli diyagram, USGS tarih arşivi.
- **[KeyMint](https://korayoner.dev/keymint/)** — güvenli şifre üreteci.
- **[Dither Studio](https://korayoner.dev/dither-studio/)** — retro/piksel görsel efektleri.
- **[DecorPalette](https://korayoner.dev/decorpalette/)** — WCAG uyumlu renk paleti üreteci.

Tüm projeler bu tek repoda toplanmıştır; site [korayoner.dev](https://korayoner.dev/) üzerinden yayınlanır.

## Bordro Motoru

Ücret bordrosu hesaplayan araçların tamamı tek bir çekirdekten geçer. Çekirdek bağımlılıksızdır
ve hem tarayıcıda hem Node.js'te çalışır:

```js
var sonuc = Bordro.hesaplaYil(75000, 2026);
sonuc.aylar[0].net;                 // Ocak ayı net ücreti
sonuc.toplam.net;                   // yıllık toplam net
Bordro.nettenBrute(60000, 2026);    // hedef neti veren brüt
Bordro.yillar();                    // [2026, 2025, … 2020]
```

| Dosya | İşi |
| --- | --- |
| `bordro/parametreler.js` | 2020-2026 yasal parametreleri — tek doğruluk kaynağı |
| `bordro/motor.js` | Hesaplama: kümülatif tarife, SGK taban/tavan, istisnalar, damga, netten brüte |
| `bordro/cikis.js` | Çıkış paketi: fesih türü hak matrisi, kıdem, ihbar, izin, işsizlik ödeneği ve takvim |
| `bordro/test.js` | 70 doğrulama; en güçlüsü resmî net asgari ücret karşılaştırması |
| `bordro/cikis-test.js` | 98 doğrulama; en güçlüsü "hak yoksa tutar da yok" değişmezi |
| `bordro/calisma-bicimi.js` | Çalışan / şahıs / limited senaryolarını aynı toplam maliyet üzerinden karşılaştırır |
| `bordro/calisma-bicimi-test.js` | 75 doğrulama; en güçlüsü "ortak payda gerçekten ortak mı" |
| `tools/parametre-kopyasi.js` | Yasal parametrenin `bordro/` dışına kopyalanmasını CI'da engeller |
| `tools/bordro-tablo.js` | `bordro/index.html` parametre tablosunu parametrelerden üretir |
| `tools/metodoloji-blogu.py` | Araç sayfalarına metodoloji/künye bloğunu yerleştirir |
| `tools/sayfa-denetimi.py` | Kırık bağlantı, meta, görsel, başlık düzeni ve sitemap denetimi |
| `tools/makale-gorsel.js` | Makale kapakları: motordan üretilen veri illüstrasyonları |
| `tools/makale-listesi.py` | Makale listelerini yazıların kendisinden üretir (başlık, özet, okuma süresi) |
| `tools/make-og.py` | Paylaşım kartları: 8 palet × 4 düzen, aileye göre dağıtılır; `--kontrast` ile doğrulanır |
| `tools/css-kontrol.js` | CSS parantez dengesi — bozuk parantez sonraki kuralı sessizce düşürür |
| `tools/parametre-kopyasi.js` | Yasal parametrelerin motor dışına kopyalanmasını engeller |

```bash
node bordro/test.js                     # bordro motorunu doğrula
node bordro/cikis-test.js               # çıkış paketi motorunu doğrula
node bordro/calisma-bicimi-test.js      # çalışma biçimi motorunu doğrula
node tools/parametre-kopyasi.js         # parametre kopyası var mı
node tools/bordro-tablo.js              # parametre tablosunu yeniden üret
python tools/metodoloji-blogu.py        # künyeleri güncelle
python tools/sayfa-denetimi.py          # sayfa kalitesi denetimi
node tools/css-kontrol.js               # CSS parantez dengesi
python tools/make-og.py --kontrast      # kart paletleri AA geçiyor mu
python tools/make-og.py                 # paylaşım kartlarını yeniden üret (Chrome gerekir)
```

Yeni bir bordro yılı eklemek için `bordro/parametreler.js` içine bir yıl bloğu yazmak yeterlidir;
testler resmî net asgari ücret üzerinden doğrulamayı kendisi yapar.

## Yerel çalıştırma

```bash
git clone https://github.com/onerkoray/onerkoray.github.io.git
cd onerkoray.github.io
python -m http.server 8080
```

## Lisans

MIT © Koray Öner
