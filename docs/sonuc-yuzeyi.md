# Sonuç yüzeyi v1 — tasarım ve taşıma referansı

14 Eylül 2026. Onaylanan kapsam: maaş, ÖTV ve MTV pilotları. Finansal motorlar ve yasal parametreler değiştirilmedi.

## Sahiplik ve kararlar

`arac-bilesenleri.css` kökte yaşar; yalnız `body.rs-tool` taşıyan sayfalarda etkindir. `rs-*` adları tek bir ortak sahip belirler. Ana `style.css` site kimliğini, gezinmeyi ve mevcut tema/veri tokenlarını yönetmeye devam eder. Yeni ortak dosya, bir aracın CSS'inin başka araçların görünümünü değiştirmesini önler; geçişi henüz yapılmamış araçlara yeni kuralları zorla uygulamaz.

Üç pilot artık yalnız ana CSS ile bu ortak dosyayı yükler. Önceden ödünç alınan `yuzde-hesaplama/style.css`, `serbest-meslek-makbuzu-hesaplama/style.css` ve pilotların eski stil dosyaları silinmedi: başka sayfaların bunlara bağımlılığı sürüyor. Bu sürüm o sayfaları taşımış sayılmaz.

`sonuc-yuzeyi.js` yalnız sayı okuma, güvenli metin üretimi, biçimleme ve sunum yardımcıları içerir; tarife veya bordro hesabı içermez. Yerel `script.js` dosyaları kendi motorlarını çağırır ve gereken sunum türlerini birleştirir. Yeni bağımlılık, derleyici, font veya CDN yoktur; davranış harici JS'dedir. Veri genişlikleri yalnız CSS özel değişkenleriyle aktarılır.

## Beş sonuç türü

| Tür / bileşen | Ne zaman ve hiyerarşi | Renk rolü | Yaklaşık 400px ekran | Boş / hatalı girdi |
|---|---|---|---|---|
| Tek sayı: `.rs-answer` | Bir ana cevap; önce dönem ve ölçü adı, sonra 2–3rem tutar ve küçük birim, sonra kapsam notu. | Ana sayı nötr metin rengidir; büyüklüğü veri vurgusunu taşır. | Sayı gerektiğinde satır kırar; birim görünür kalır. | Eski sayı kaldırılır; hangi girdinin gerektiği söylenir. |
| Kırılım: `.rs-stack`, `.rs-facts` | Ana toplamdan sonra onu oluşturan kalemler; çubuk yalnız oranı, metin kesin tutarı gösterir. | Sıralı kategoriler `--dv-1/2/3`; görünür açıklama her zaman vardır. | Etiket ve tutar alt alta; lejant tek sütundur. | Eksik/negatif bileşen veya sıfır toplamda oran çubuğu üretilmez; hesap yapılamıyorsa sonuç yerine açıklama çıkar. |
| Karşılaştırma: `.rs-compare` | Aynı dönem/birimdeki iki seçenek eşit ağırlıkta; seçenek adı, 1.25–1.5rem değer, farkın kapsamı. | Nötr değerler; üstünlük yalnız renkle ileri sürülmez. | Seçenek sırası korunarak alt alta iner. | Eksik seçenek sıfır sayılmaz; geçerli karşılaştırma oluşana kadar fark sunulmaz. |
| Eşik: `.rs-threshold` | Mevcut değer, sınır, mesafe ve ekonomik sonuç birlikte gösterilir. | `--dv-2` ince çizgi + açıklayıcı başlık; marka rengi kullanılmaz. | Mesafe satırları ve fiyat karşılaştırması tek sütundur. | Geçersiz girdi eşik uyarısı üretmez; eşik anlamlı değilse bölüm yoktur. |
| Zaman: `.rs-time`, `.rs-table` | Dönem sırası, aynı ölçek, her dönemin kesin değeri; büyük veri için başlıklı tablo. | Çubuk `--dv-1`; dilim geçişi `--dv-2` zemini ve görünür yazıyla belirtilir. | Kısa seride yıl/çubuk ve altında değer; geniş bordro odaklanabilir yatay kaydırma alanıdır. | Eski seri kaldırılır; tek dönem üretilemezse “Hesaplanamadı” denir, sıfır gibi çizilmez. |

Karşılaştırmanın çalışan iki seçenekli örneği ÖTV eşik bölümündedir; üç seçenekli gelecekteki araçlar için üçüncü sütun varyantı o aracın testleriyle eklenmelidir. `answer()` para pilotları için TL üretir; yaş/yüzde aracına taşınırken birim parametresi ayrıca eklenmelidir.

## Görsel kararların nedenleri

- 2px köşe, 1px ayırıcı, gölgesiz ve hareketsiz sonuç: tutar bir eylem düğmesi gibi görünmemeli; mevcut editoryal kimlik korunmalı.
- Sistem fontları, mono büyük harf etiketler ve tabular sayılar: yeni yükleme maliyeti olmadan taranabilir hiyerarşi ve rakam hizası sağlar.
- Tek ana değer, daha küçük ikincil değerler: yıllık toplam ile bir aylık maaşın aynı önem düzeyinde karıştırılmasını önler.
- Kategorik veri renkleri bütün paletlerde sabittir; kazanç/kayıp anlamı taşımayan net maaş, vergi veya MTV çubuğuna polarite rengi verilmez.
- Çubuklarda asgari görsel genişlik yoktur: küçük bir payın olduğundan büyük görünmesini önler. Kesin tutarlar çubuktan bağımsız okunabilir.
- Ana sonuç görünür; kapsam/hesap ayrıntıları yerel `<details>` içindedir: hızlı cevabı kolaylaştırırken denetlenebilirliği korur. Varsayım ve eşik etkisi katlanmaz.
- Hata halinde eski sonuç temizlenir ve alan `aria-invalid` ile işaretlenir; kısa `role=status` mesajı tüm bordronun tekrar okunmasını önler.
- Damgasız sistem temasında pilotlara özel koyu nötr yüzey yedeği vardır; mevcut `auto` anahtarıyla birlikte çalışır, diğer sayfaları değiştirmez.
- MTV'deki iki taksit eşit iki sütunu doldurur; maaşın üç yıllık göstergesi üç sütunu doldurur. Dar ekranda tümü tek sütuna iner.

## Pilotlarda kullanıcıya yansıyan değişiklik

**Maaş:** Seçilen ayın neti ana cevaptır; brüt, sosyal primler ve ödenen vergiler aynı ayı izler. Yıllık toplam, ortalama ve Aralık neti ikinci düzeydedir. 12 aylık bordro korunur; vergi dilimi geçişleri metinle işaretlenir. Netten brüte çözümün Ocak ayını hedeflediği açıkça yazılır. Mevcut asgari ücret tabanı uygulandığında kullanılan tutar açıklanır.

**ÖTV:** Anahtar teslim fiyatın altında araç bedeli, ÖTV ve KDV bileşimi vardır. Var olan eşik hesabı mevcut fiyatla eşikteki fiyatı karşılaştırır; farkın hem matrah hem vergi değişimini içerdiği söylenir. Yerel sayısal alandaki ondalık nokta binlik ayırıcı sanılmaz.

**MTV:** Yıllık toplam ve iki taksit önce gelir. Sekiz yıllık seri yalnız mevcut tarife sabitken yaş etkisini gösterdiğini açıklar; gelecekteki zam tahmini olarak sunulmaz. Tam tutarlar iki ondalıkla, çubuklar gerçek ortak oranla gösterilir.

## Değişen dosyalar ve gerekçeleri

| Dosya | Gerekçe |
|---|---|
| `arac-bilesenleri.css` | Sonuç türlerini ve ödünç araç CSS'inden ayrılan gerekli form kurallarını tek, kapsamı sınırlı ortak sahipte toplar. |
| `sonuc-yuzeyi.js` | Güvenli çıktı, Türkçe sayı biçimi, girdi doğrulama ve kırılım sunumunu motorlardan ayrı paylaşır. |
| `maas-hesaplama/index.html` | Ortak varlıkları, ay seçimini ve kısa durum bildirimini bağlar. |
| `maas-hesaplama/script.js` | Aylık kırılım/yıllık özet hiyerarşisini ve erişilebilir bordroyu kurar, geçersiz sonuçları temizler. |
| `otv-hesaplama/index.html` | Ödünç stil bağımlılıklarını kaldırıp ortak sonuç ve durum bölgelerini bağlar. |
| `otv-hesaplama/script.js` | Ana fiyat, bileşim ve eşik karşılaştırmasını üretir, yerel ondalık girdiyi doğru okur. |
| `mtv-hesaplama/index.html` | Otomobil ve motosiklet panellerini ortak yüzeye ve durum bildirimlerine geçirir. |
| `mtv-hesaplama/script.js` | Yıllık tutar/taksit önceliğini ve dürüst ölçekli zaman serisini kurar. |
| `tools/sonuc-yuzeyi-test.js` | Üç gerçek motorla sunum/girdi regresyonlarını ve ortak stil sahipliğini bağımlılıksız doğrular. |
| `.github/workflows/bordro-test.yml` | Yeni sonuç yüzeyi regresyonlarının her push'ta çalışmasını sağlar. |
| `docs/sonuc-yuzeyi.md` | Tasarım kararlarını, sınırları ve aşamalı taşıma sözleşmesini kalıcılaştırır. |

Önbellek damgaları `tools/stil-damgasi.py` ile üretilir; elle değiştirilmez. Yayın sırasında ana sayfa araç tarihleri ve sitemap gibi türetilmiş kayıtlar kendi üreticileriyle güncellenir.

## Doğrulama

- Yeni Node testi: 38 kontrol; parser, HTML kaçışları, çubuk oranları, maaşın mevcut bütün yılları, ay seçimi, boş/yanlış giriş, ÖTV eşik/ondalık, MTV sekiz dönem ve eski sonuç temizleme.
- Tarayıcı: 400px ve 1280px × light/dark/damgasız sistem × yeşil/turuncu × üç pilot = 36 düzen kontrolü; yatay sayfa taşması yok, veri renkleri aynı, sonuç yüzeyleri 2px/gölgesiz/transform'suz.
- Mobilde altı tema/palet durumunda her pilotun sonuçları, masaüstünde üç pilot ve mobil ÖTV eşik karşılaştırması/MTV seri ayrıntısı görsel olarak incelendi. Sistem tercihli test bu oturumun açık sistem görünümündeydi; açık/koyu temalar ayrıca zorlandı.
- Klavyeyle sekme ve ay seçimi, boş alanı silme, hatadan geri dönüş ve bordronun odaklanabilir yatay kaydırma alanı kontrol edildi.
- Mevcut motor testleri: bordro 126, ÖTV 65, MTV 94 kontrol geçti. CSS, veri rengi, sayfa (122 sayfada sıfır bulgu), stil damgası, kart ve favicon (20 kontrol) doğrulamaları geçti; CI bunlara ek site regresyonlarını korur.

## Sonraki taşıma sırası

1. **Basit tek cevaplı araçlar:** KDV, yüzde, yaş gibi araçlarda doğru birim ve sıfır/boş farkını netleştir; `answer()` birimini genelleştir ve bu araçların `yuzde-hesaplama/style.css` bağımlılığını tek tek kaldır.
2. **Bordro ailesi:** Fazla mesai, işsizlik, kıdem/ihbar; `.sum-card` / `.payroll` tüketicilerini kırılım ve zaman türlerine geçir. Motor referanslarıyla sayısal eşitlik her araçta korunmalı.
3. **Belge/vergi kırılımları:** Serbest meslek makbuzu ve `.bd-table` tüketicileri; ortak `.rs-facts`/`.rs-table` ile alan sahipliğini düzelt.
4. **Karşılaştırmalı karar araçları:** Şahıs/limited, gider yöntemleri; eşit dönem/birim sözleşmesini yaz, gerekirse üç seçenek varyantını ekle. Ana sayı zorlaması yapma.
5. **Uzun seri ve senaryolar:** Kredi, birikim ve fizibilite; kısa seri veya tablo seçimini veri yoğunluğuna göre yap, negatif akış için sıfır ekseni ve polariteyi ayrıca doğrula.

Her araçta eski/yeni çıktıyı aynı girdilerle karşılaştır, üç tema/iki palet/mobil kontrolünü yap, ortak dosyayı bağla ve ancak sonra eski CSS bağını kaldır. Eski `.sum-card`, `.payroll`, `.bd-table`, `.stack`, `.proj` tanımları tüm tüketiciler taşınıp `rg` ile sıfır kullanım doğrulanınca silinir. Aynı isimlere global alias eklemek eski sahiplik sorununu gizleyeceği için yapılmaz.
