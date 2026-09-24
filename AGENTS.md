# İçerik kılavuzu — korayoner.dev

Bu sitede yazıyı, aracı ve görseli yapay zekâ ajanları da üretiyor. Bu belge
onların (ve insanların) yazmadan önce okuyacağı tek kural setidir. Genel SEO
tavsiyesi değil: yalnızca bu sitenin alanını kapsıyor.

**Alan:** Türkiye'de bordro, vergi, SGK, emeklilik ve hane/işletme finansı
için hesaplama araçları ve bunları açıklayan yazılar. Bu, Google'ın
"Your Money or Your Life" (YMYL) dediği alan: okurun maddi durumunu
etkileyen konular. Google bu konularda güvene **ekstra ağırlık** veriyor.

Son okuma: 2026-09-24

Okunan resmi kaynaklar (sayfaların kendi güncellenme tarihleriyle):

- [Yararlı, güvenilir, insan odaklı içerik oluşturma](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) — 2025-12-10
- [Google Arama spam politikaları](https://developers.google.com/search/docs/essentials/spam-policies) — 2026-08-28
- [Üretken yapay zekâ içeriği hakkında rehberlik](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) — 2025-12-10

Bu belgeler değişiyor. `tools/kilavuz-test.js`, "Son okuma" tarihi 183 günü
geçince CI'ı kırmızıya çevirir. O zaman kaynakları yeniden oku, değişeni
buraya işle, tarihi güncelle.

---

## 1. Google'ın açıkça cezalandırdıkları ve bu sitedeki karşılığı

Spam politikalarının tamamı değil, yalnızca bu sitenin gerçekten
düşebileceği tuzaklar:

**Ölçekli içerik istismarı (scaled content abuse).** Google'ın örneği:
"üretken yapay zekâ araçlarıyla, kullanıcıya değer katmadan çok sayıda sayfa
üretmek." Bu sitedeki risk somut: `maas-hesaplama/*-tl-brut-ne-kadar-net/`
sayfaları aynı şablondan çıkıyor. Eylül 2026'da ölçüldü: sekiz kelimelik
dizilerin %23–25'ini paylaşıyorlar (makalelerde aynı ölçü binde bir). Dizine
açık sekiz sayfanın altısı dizinde değil. Üreteçle farklılaştırma iki kez
denendi, ikisi de işe yaramadı. Kural:

- Yeni bir **programatik sayfa ailesi** (aynı şablon, değişen tek parametre)
  açma. Açmak gerekiyorsa önce her sayfanın başka hiçbir sayfada olmayan
  hangi bilgiyi taşıdığını yaz. Yazamıyorsan açma.
- Maaş şablonuna ortak paragraf ekleme. Ortak metin benzerliği artırır.
  [CI: Maaş sayfaları birbirine fazla benziyor mu]

**Sayfa tarihini taze göstermek.** Google, arama motoru için yazılmış
içeriğin uyarı işaretleri arasında şunu sayıyor: "İçerik esaslı değişmediği
halde sayfaların tarihini değiştirmek." Bu sitede tarihleri insanlar değil
üreteçler yazıyor ve kural zaten kurulu: stil damgası, görünmez meta ve site
geneli tarama commit'leri tarihi ileri kaydırmaz.

- Kartlardaki "Güncellendi" ve sitemap `lastmod` değerlerini elle düzenleme.
  [CI: Araç kartlarındaki güncelleme tarihleri güncel mi]
  [CI: Sitemap lastmod tarihleri güncel mi]
- Yazının yayın tarihini güncelleme tarihiyle ezme. Güncelleme ayrı bir
  "Güncelleme:" satırıdır. [CI: Makale kabuğu ve sınıfları]

**Kapı sayfaları (doorway abuse).** Aynı cevaba yönlendiren, yalnızca sorgu
için açılmış benzer sayfalar. Şehir, yıl ya da rakam varyantı sayfası
açmadan önce ölçekli içerik kuralını uygula.

**Anahtar kelime doldurma ve gizli metin.** Görünmeyen ya da okura değil
arama motoruna yazılmış metin ekleme. Kartlardaki `data-tags` özniteliği
yalnızca sitenin kendi arama filtresi içindir, sayfada metin olarak
görünmez. Oraya okurun gerçekten yazacağı kelimeleri koy.

**Yanıltıcı işlev (misleading functionality).** Hesaplıyormuş gibi görünen
ama hesaplamayan araç olmaz. Her araç motor testinden geçer; sonucu
bilinmeyen bir durum için rakam uydurulmaz.

**Kazıma (scraping).** Resmî kaynağın tablosunu yeniden yayımlamak tek
başına değer değildir. Tablo ancak yanında bu sitenin hesabı ya da
karşılaştırması olduğunda yayımlanır.

Bu sitede karşılığı olmayanlar (misafir/sponsorlu içerik, süresi dolmuş alan
adı, bağlantı satışı, gizleme) yine yasaktır. Ayrıca kural yazmaya gerek yok.

---

## 2. İnsan için yazılmış, işe yarar yazı burada neye benzer

Google'ın sorusu: "Okuyan kişi, yeterince öğrendiği hissiyle ayrılıyor mu,
yoksa tekrar aramak zorunda mı kalıyor?" Bu sitede cevabın biçimi:

- **Özgün hesap taşır.** Her yazının kendi hesabı vardır. Yazıdaki her rakam
  bir `sayi-testi.js` ya da motor testiyle yeniden üretilir. Başka sitenin
  rakamını aktarmak hesap sayılmaz.
- **Tek iddiası vardır ve görsel o iddiayı gösterir.** Görsel süs değildir.
  Örneğin enflasyon yazısının iddiası "oran yarıya iniyor ama TL artışı
  yalnız 400'den 280'e düşüyor"dur; grafik tam olarak bunu çizer.
- **Soruyu ilk paragrafta cevaplar**, gerisi gerekçedir.
- **Varsayımını açıkça söyler.** "Temsili", "varsayımsal", "ülke ortalaması
  değil" gibi ayrımlar yazının içinde durur.
- **Cevabı olmayan soruya cevap vaat etmez.** "Torba yasa ne zaman çıkacak"
  bilinmiyorsa başlık bunu bilir gibi yazılmaz.
- **Trend kovalamaz, takvim izler.** Konu, okurun karar vereceği tarihten
  seçilir: zam dönemi, beyan ayı, tavan değişimi. Search Console verisi de
  siteyi taşıyanın mevzuat takvimi olduğunu gösteriyor.
- **Kelime hedefi yoktur.** Google açıkça söylüyor: tercih ettiği bir kelime
  sayısı yok.
- **Başlık abartmaz.** Başlık ve ara başlık, içeriğin gerçekten söylediğini
  söyler.

---

## 3. E-E-A-T ve sayfada nasıl görünür

E-E-A-T dört kelime: **Experience** (deneyim), **Expertise** (uzmanlık),
**Authoritativeness** (otorite), **Trust** (güven). Google'a göre en önemlisi
güvendir: diğer üçü güvene katkı yapar, her içerik dördünü birden göstermek
zorunda değildir. YMYL konularında Google güçlü E-E-A-T'ye daha da fazla
ağırlık verir.

Bu sitede her birinin sayfadaki karşılığı:

| | Sayfada neyle görünür |
|---|---|
| **Güven** | Her iddianın yanında birincil kaynak bağlantısı ve kontrol tarihi. Tarihi geçen iddia bir `gecerlilik` bildirimi taşır. Düzeltmeler tarihli olarak [yayın ilkeleri](yayin-ilkeleri/) sayfasındaki düzeltme günlüğüne yazılır. |
| **Deneyim** | "Ölçüldü" dili. Bir şey iddia edilmez, hesaplanır ya da ölçülür, sayısı verilir. Bordro denetimi ve teklif karşılaştırma gibi araçlar farkı iddia değil ölçüm olarak sunar. |
| **Uzmanlık** | Doğru yasal dayanak (mülga madde değil, yürürlükteki madde). Metodoloji sayfaları ve açık kaynak kod: hesabın nasıl yapıldığı okunabilir. |
| **Otorite** | Tek bir yazar kimliği: Koray Öner. Person `@id`, `url` ve `sameAs` tek kümede; ORCID, Zenodo, GitHub, YouTube ve X bu kümeye bağlı. Kimlik bilgisini sayfa sayfa elle değiştirme. |

**Kim, nasıl, neden.** Google üç soru soruyor:

- **Kim?** İçeriği kimin yazdığı görünüyor mu? Her yazıda yazar satırı
  var ve yazar sayfası hakkımda.
- **Nasıl?** Otomasyon ya da yapay zekâ kullanıldıysa bu okura açık mı?
  Google bunu zorunlu tutmuyor ama soruyor. **Açık karar:** sitede şu an
  yapay zekâ kullanımına dair bir açıklama yok. Eklenip eklenmeyeceği ve
  nasıl ifade edileceği site sahibinin kararıdır; ajanlar bunu kendi
  başına yayımlamaz.
- **Neden?** Google'a göre en önemli soru bu. Yazı, önce okura yardım
  etmek için yazılır. Arama trafiği sonuçtur, amaç değildir.

---

## 4. Yayından önce kontrol listesi

Köşeli parantezde "CI:" ile işaretli maddeleri CI zaten denetliyor. Oradaki ad,
`.github/workflows/bordro-test.yml` içindeki adımın adıdır ve
`tools/kilavuz-test.js` her adın gerçekten var olduğunu doğrular. Geri
kalan maddeleri CI göremez. Onları elle geç.

**Rakam ve hukuk**

- [ ] Yazının kendi `sayi-testi.js`'i var ve yazıdaki rakamları yeniden
      üretiyor. Testi workflow'a eklemek yetmez, koşması gerekir:
      `tools/kilavuz-test.js`, `makaleler/` altındaki her testin workflow'da
      çağrıldığını doğrular. (Eylül 2026: 39 yazının 22'sinde test var.
      Eski 17 yazının bir kısmının tabloları motordan üretiliyor, bir kısmı
      testsiz. Yeni yazı testsiz yayımlanmaz.)
- [ ] Parametreler tek kaynaktan okunuyor, kopyası yok. [CI: Parametre kopyası var mı]
- [ ] Mülga maddeye atıf yok. [CI: Mülga maddeye atıf var mı]
- [ ] Tarihe bağlı her iddia bir geçerlilik tarihi taşıyor. [CI: Tarihe bağlı iddiaların süresi doldu mu]
- [ ] Kaynaklar birincil (Resmî Gazete, GİB, SGK, TÜİK, TCMB) ve bağlantıları çalışıyor. Elle kontrol et.
- [ ] Sınır durumları yazılmış: tavan, eşik, istisna ayının değiştiği yer. Elle kontrol et.

**Sayfa ve görsel**

- [ ] Kabuk şablondan kuruldu, gövde ezberden yazılmadı. [CI: Makale kabuğu ve sınıfları]
- [ ] Gövdede gerçek bir `<img>` var (Google Görseller). [CI: Görsel SEO regresyonları]
- [ ] Görsel `tools/makale-gorsel.js` içinde çizildi. Pillow ya da elle PNG yok. [CI: SVG makale kartları çizimle aynı]
- [ ] Paylaşım meta etiketleri tam. [CI: Paylaşım meta etiketleri tam mı]
- [ ] Görünür iz ile BreadcrumbList aynı. [CI: Görünür iz ve BreadcrumbList]
- [ ] JSON-LD geçerli; içine yorum konmadı. Geçersiz JSON-LD sessizce bütün işaretlemeyi düşürür. Elle kontrol et.
- [ ] Alt metin, görselin gösterdiği iddiayı söylüyor. Anahtar kelime listesi değil. Elle kontrol et.

**Okur için mi?**

- [ ] İlk paragraf soruyu cevaplıyor. Elle kontrol et.
- [ ] Başka sitede olmayan bir hesap, ölçüm ya da karşılaştırma var. Elle kontrol et.
- [ ] Varsayımlar yazının içinde açıkça söyleniyor. Elle kontrol et.
- [ ] Başlık, yazının söylediğinden fazlasını vaat etmiyor. Elle kontrol et.
- [ ] Yeni bir programatik sayfa ailesi açılmıyor. Açılıyorsa her sayfanın özgü bilgisi yazıldı. Elle kontrol et.
- [ ] Yayın tarihi korunuyor; değişiklik esaslıysa ayrı "Güncelleme:" satırı eklendi. [CI: Makale kabuğu ve sınıfları]

**Sonra**

- [ ] İki adımlı akış: içerik commit'i → geçmişten türeyen üreteçler →
      sitemap commit'i → CI'ın tamamı → tek push.
- [ ] Sitenin görünümünü geniş ölçekte değiştiren iş, yayından önce
      önce/sonra görüntüsüyle site sahibine gösterildi.
