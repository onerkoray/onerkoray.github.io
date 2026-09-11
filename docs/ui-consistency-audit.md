# UI tutarlılık denetimi — 11 Eylül 2026

## Kapsam ve yöntem

110 HTML ve 33 CSS dosyasının envanteri incelendi. Ortak stiller, sayfalara yüklenen ek stiller ve aynı semantik görevi üstlenen seçiciler karşılaştırıldı. Mimari statik HTML/CSS/JavaScript; yeni çatı veya bağımlılık eklenmedi. Tarayıcı incelemesi aşağıdaki temsilî sayfalar üzerinde yapıldı; 110 sayfanın tamamına tek tek görsel onay verildiği iddia edilmiyor.

## Bulgular ve uygulanan düzeltmeler

| Alan | Tutarsızlık | Sonuç |
|---|---|---|
| Sayfa başlıkları | Araçlar sans-serif; makale listesi ve detayları farklı serif aileleri/ölçekleri; genel H1 ayrıca daha büyüktü. | Aynı arayüz fontu, responsive sayfa başlığı ölçeği, satır yüksekliği ve harf aralığı kullanılıyor. |
| Başlık hiyerarşisi | Büyük bölüm ve bilgi kartı başlıkları sayfa başlığıyla yarışabiliyordu. | Genel H2 alt ölçeğe, bilgi kartı H2'leri kart başlığı ölçeğine bağlandı. HTML başlık seviyeleri korundu. |
| Açıklamalar | Araç girişinde 1rem/1.6; makalelerde farklı, daha büyük bir ölçek/1.55. | Girişler 1.05rem ve 1.65 satır yüksekliğini paylaşıyor. |
| Liste kartları | Araç başlıkları 1.16rem, makale liste başlıkları ayrı ölçek; açıklamalar da farklıydı. | Normal liste başlıkları 1.16rem, açıklamaları .93rem; font, renk ve satır yüksekliği ortak. |
| Kart ve form yüzeyleri | Köşeler 2/8/9/10/12/16/18px değerleriyle farklı katmanlarda tekrar ediyordu. | Ana kart, iç yüzey ve form kontrolü ayrı ortak tokenlarla yönetiliyor; aynı görevli yüzeyler bunlara bağlandı. |
| Metadata/kategori | Kategori yazılarında aile, ağırlık ve harf aralığı ayrışıyordu. | Kategoriler ortak mono etiket ölçeğinde; yazar/tarih satırı ayrı okunabilir metadata tokenında. |
| Breadcrumb | Ortak tanım, araç CSS'inde tekrar edilip ortak metadata ölçeğini eziyordu. | Gereksiz yerel kopya kaldırıldı. |
| Header | 768px ana sayfa menüsü ve tema düğmeleri yatay taşıyordu. | Mevcut ikinci satırlı menü 980px ve altında kullanılıyor; bağlantılar korunuyor. |
| Navigation | Gerçek geçerli sayfa bazı menülerde belirtilmiyordu; geçiş tanımı da tekrar ediyordu. | Tam sayfa bağlantısına `aria-current="page"` ekleniyor; mevcut çizgiyle vurgulanıyor. Sayfa içi çapalar bu işareti almıyor. |
| Seçili sekmeler | Koyu temada açık vurgu rengi üzerinde beyaz metin yetersiz kontrast üretiyordu. | Sabit koyu vurgu zemini üzerinde beyaz yazı. Beş palette hesaplanan kontrast 6.45–8.21:1. |
| Form durumları | Kontrol köşeleri ve odak çizgileri farklı; genel minimum yükseklik checkbox/radio'yu da kapsıyordu. | Metin kontrolleri ortak 44px minimum ve 10px köşe kullanıyor; checkbox/radio/range gibi özel kontroller hariç. Odak çizgisi ve disabled görünümü ortak. |
| Hareket | Makale kapaklarının hover ölçeklemesi azaltılmış hareket tercihini açıkça izlemiyordu. | Mevcut efekt yalnız uygun fare ve hareket tercihinde çalışıyor. Yeni animasyon eklenmedi. |

## Ortak yapılar ve değiştirilen dosyalar

- `style.css`: `--type-page-*`, `--type-card-*`, `--type-metadata`, `--type-label`, `--leading-*`, `--tracking-title`, `--radius-*`, `--space-*`, `--page-gutter`, `--shadow-card`, `--surface-note`, `--motion-*`; ortak başlıklar, form durumları ve tablet header düzeltmesi.
- `live.css`: mevcut araç kartlarının başlık, açıklama, boşluk ve yüzey değerleri ortak tokenlara bağlandı.
- `makaleler/editoryal.css`: liste/detay başlıkları ve girişler, bilgi kartları, kategori/metadata, görsel köşeleri ve hareket tercihi standardize edildi.
- `yuzde-hesaplama/style.css`: tekrar eden breadcrumb kuralları kaldırıldı; panel ve FAQ yüzeyleri ortaklaştırıldı.
- `script.js`: yalnız navigation için geçerli sayfa işareti eklendi. Hesaplama kodu değiştirilmedi.
- HTML dosyaları: CSS/JS önbellek damgaları yenilendi. İçerik, canonical, yapılandırılmış veri ve başlık seviyeleri değiştirilmedi.

## Bilinçli korunan farklılıklar

- Ana sayfanın tanıtım başlığı normal sayfa başlığından daha büyük; manşet yazı normal liste öğesinden daha belirgin.
- Makale gövdesindeki serif bölüm başlıkları ve dar okuma sütunu uzun metin hiyerarşisi için korundu. Sayfa başlığı, kartlar ve yardımcı arayüz artık ortak aileyi kullanıyor.
- Araçların etkileşimli kartlarıyla makalelerin görsel/metin listeleri aynı kutuya zorlanmadı. Sonuç kartları, form panelleri ve açıklama kutularının görev farkları korundu.
- Yazar/tarih bilgisi normal yazı; kategori ve kısa teknik etiketler mono. CTA etiketleri kategori bilgisiyle birleştirilmedi.
- Footer, mevcut tablo/kod bloğu düzenleri, finansal uyarıların anlam renkleri ve tekil hesaplayıcı yerleşimleri yeniden yazılmadı. Ortak olmayan pagination/tooltip bileşenleri envanterde bulunmadığından yeni bileşen üretilmedi.
- KeyMint, DecorPalette ve Dither Studio gibi ayrı ürünlerin kimliği; renk paletleri, faviconlar ve logolar korundu.

## Doğrulama

- Ana sayfa, maaş aracı, makale listesi ve mevduat makalesi: **390 / 768 / 1280 / 1600px**, toplam **16 son yerleşim kontrolü**; sayfa taşması yok, her sayfada tek H1.
- Araç/makale sayfa başlıkları mobilde 29.6px, 1280px'de 46.08px, geniş ekranda 48px; giriş açıklamaları 16.8px. Araç ve normal makale kartlarında başlık 18.56px, açıklama 14.88px olarak tarayıcıdan doğrulandı.
- İşten ayrılma, Bordro Motoru ve yayın ilkeleri sayfalarında ek mobil taşma kontrolleri geçti.
- Açık/koyu tema; aktif menü, görünür odak, arama boş durumu, arama temizleme, kategori filtresi ve hesaplama formunun çıktı üretmesi kontrol edildi.
- Maaş sekmelerinde sağ ok tuşuyla odak/seçim ve panel gizliliği doğrulandı. Azaltılmış hareket kuralları kod üzerinden incelendi.
- CSS denetimi, JavaScript sözdizimi, makale listesi ve 444 stil bağlantısının damgaları geçti. Sayfa denetimi: **110 sayfa, 0 bulgu**. Mevcut bordro testleri: **96 geçti, 0 hata**.

Bu çalışma tam WCAG sertifikasyonu veya her tarayıcıda piksel eşitliği iddiası taşımaz; ortak sistem ve kritik kullanıcı akışlarına yönelik kontrollü bir tutarlılık düzeltmesidir.
