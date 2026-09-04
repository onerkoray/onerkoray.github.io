# Dither Studio

**1-bit · 8-bit · 16-bit · 32-bit dithering görsel oluşturma aracı.**

Nous Research portalındaki dithering estetiğinden ilham alan, tamamen tarayıcıda çalışan bir görsel dönüştürme aracı. Görsellerinizi klasik retro/piksel dokusuna dönüştürür. Hiçbir görsel sunucuya yüklenmez — tüm işleme istemci tarafında yapılır.

🔗 **Canlı demo:** https://korayoner.dev/dither-studio/

## Özellikler

- **Bit derinlikleri:** 1-bit (iki renk palet), 8-bit (3-3-2 RGB), 16-bit (5-6-5 RGB), 32-bit (tam renk + hafif dither).
- **Dithering yöntemleri:** Floyd–Steinberg, Atkinson, Ordered (Bayer 4×4 & 8×8), veya sadece kuantalama.
- **1-bit paletleri:** Kağıt, Terminal, Amber, Buz, Mono.
- **Ayarlar:** piksel boyutu, kontrast, parlaklık, serpentine tarama.
- **PNG dışa aktarma.**
- Sürükle-bırak veya dosya seçici; gömülü örnek görsel.

## Kullanım

Statik site — derleme adımı yok. Yerelde çalıştırmak için:

```bash
# herhangi bir statik sunucu yeterli
python -m http.server 8000
# veya
npx serve
```

Ardından `http://localhost:8000` adresini açın.

## Yayınlama (GitHub Pages)

1. Bu klasörü bir GitHub deposuna push edin (`dither-studio` önerilir).
2. Depo ayarları → **Pages** → kaynak olarak `main` / `root` seçin.
3. Site `https://<kullanıcı-adı>.github.io/dither-studio/` adresinde yayınlanır.

> Not: `sitemap.xml`, `robots.txt` ve meta etiketlerindeki URL'ler `korayoner.dev/dither-studio/` içindir. Farklı bir alan adı kullanıyorsanız bunları güncelleyin.

## Teknoloji

Saf HTML + CSS + Vanilla JavaScript (Canvas API). Bağımlılık yok.

## Lisans

[MIT](./LICENSE) © [Koray Öner](https://korayoner.dev/)

---

Tasarım ve geliştirme: **Koray Öner**.
