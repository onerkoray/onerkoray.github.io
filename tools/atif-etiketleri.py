#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DOI tasiyan makalelere Highwire Press (citation_*) etiketleri yazar.

NEDEN VAR:
Sitede DOI'li uc calisma var ve ucunde de SIFIR citation_* etiketi vardi.
Bu etiketler akademik kaynakcilarin okudugu tek makine-okunur bicimdir:
Google Scholar, Semantic Scholar, Zotero ve Mendeley bir sayfayi
"alintilanabilir calisma" olarak ancak bunlarla taniyor. JSON-LD
ScholarlyArticle semasi arama motorlari icin dogru, ama bu araclarin
hicbiri onu okumuyor -- Zotero bir korayoner.dev yazisini kaydettiginde
"Web Page" diyordu, "Journal Article" degil.

DEGERLER UYDURULMUYOR:
Her etiket sayfanin KENDI JSON-LD grafindan tureniyor. Baslik, ozet,
tarih, DOI, anahtar kelimeler ve yazar zaten orada duruyor; burada
ikinci bir dogruluk kaynagi acilmiyor. Grafinda DOI olmayan sayfaya
DOKUNULMUYOR -- DOI'siz bir calismayi alintilanabilir gostermek yanlis
beyandir.

citation_pdf_url YAZILMIYOR:
Scholar bu etiketi tam metnin PDF adresi olarak okur. Sitede PDF yok;
Zenodo'daki PDF'e isaret etmek baska alan adina yonlendirme olurdu ve
Scholar bunu tam metin saymaz. Yoklugu dogru bilgidir.

Kullanim:
    python tools/atif-etiketleri.py           # etiketleri yaz/tazele
    python tools/atif-etiketleri.py --check   # bayat mi (CI)
"""

import io
import os
import re
import sys
import json
import glob

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOK)

BAS = "<!-- ATIF-ETIKETLERI:BASLANGIC -->"
BIT = "<!-- ATIF-ETIKETLERI:BITIS -->"

# Etiketin gomulecegi yer: </head>'den hemen once degil, JSON-LD'den
# once -- meta bloklari basta dursun, yapisal veri sonda.
CAPA = re.compile(r'(\n[ \t]*)<script type="application/ld\+json">')


def graf(html):
    """Sayfanin JSON-LD @graph dugumlerini dondurur."""
    dugumler = []
    for m in re.finditer(
            r'<script type="application/ld\+json">(.*?)</script>',
            html, re.S):
        try:
            d = json.loads(m.group(1))
        except ValueError:
            continue
        for n in (d.get("@graph") or [d]):
            if isinstance(n, dict):
                dugumler.append(n)
    return dugumler


def doi_of(n):
    """Dugumun DOI'si (varsa). Hem identifier hem sameAs kabul ediliyor."""
    i = n.get("identifier")
    if isinstance(i, dict) and i.get("propertyID") == "DOI":
        return i.get("value")
    if isinstance(i, list):
        for x in i:
            if isinstance(x, dict) and x.get("propertyID") == "DOI":
                return x.get("value")
    return None


def makale_dugumu(html):
    """DOI tasiyan makale dugumu; yoksa None."""
    for n in graf(html):
        t = n.get("@type")
        if t in ("ScholarlyArticle", "Article", "TechArticle", "BlogPosting"):
            if doi_of(n):
                return n
    return None


def metin(v):
    """Semada ayni alan hem duz metin hem nesne olabiliyor:
       mainEntityOfPage kimi sayfada "https://..." kimi sayfada
       {"@id": "https://..."}. Ikisini de tek bicime indiriyoruz."""
    if isinstance(v, dict):
        return v.get("@id") or v.get("url") or v.get("name") or ""
    if isinstance(v, list):
        return ", ".join([metin(x) for x in v if metin(x)])
    return v or ""


def kacir(v):
    s = metin(v)
    return (s.replace("&", "&amp;").replace('"', "&quot;")
             .replace("<", "&lt;").replace(">", "&gt;"))


def tarih(iso):
    """2026-09-15 -> 2026/09/15 (Highwire bicimi)."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", metin(iso))
    return "%s/%s/%s" % m.groups() if m else (iso or "")


def etiketler(n, girinti):
    """Dugumden citation_* bloku uretir."""
    satir = []

    def ek(ad, deger):
        if deger:
            satir.append('%s<meta name="%s" content="%s">'
                         % (girinti, ad, kacir(deger)))

    ek("citation_title", n.get("headline"))
    # Ingilizce baslik varsa Scholar'in eslestirmesine yardim ediyor.
    ek("citation_title_english", n.get("alternativeHeadline"))
    # Tek yazarli site; ad semadaki Person dugumunden degil sabit
    # bicimden geliyor cunku Highwire "Soyad, Ad" bekliyor.
    ek("citation_author", "Öner, Koray")
    ek("citation_publication_date", tarih(n.get("datePublished")))
    ek("citation_online_date", tarih(n.get("datePublished")))
    ek("citation_doi", doi_of(n))
    ek("citation_abstract_html_url", n.get("mainEntityOfPage"))
    ek("citation_language", n.get("inLanguage"))
    kw = metin(n.get("keywords"))
    # Highwire anahtar kelimeleri noktali virgulle ayiriyor.
    ek("citation_keywords", "; ".join(
        [k.strip() for k in (kw or "").split(",") if k.strip()]))
    return satir


def blok(n, girinti):
    return ("%s%s\n%s\n%s%s"
            % (girinti, BAS, "\n".join(etiketler(n, girinti)), girinti, BIT))


def isle(yol, yaz):
    html = io.open(yol, encoding="utf-8").read()
    n = makale_dugumu(html)

    var = BAS in html
    if not n:
        # DOI yoksa etiket de olmamali: DOI geri alinmissa blok temizlenir.
        if var:
            yeni = re.sub(re.escape(BAS) + r".*?" + re.escape(BIT) + r"\n?",
                          "", html, flags=re.S)
            if yaz:
                io.open(yol, "w", encoding="utf-8", newline="").write(yeni)
            return "temizlendi"
        return None

    m = CAPA.search(html)
    if not m:
        return "capa-yok"
    girinti = m.group(1).lstrip("\n")
    yenisi = blok(n, girinti)

    if var:
        mevcut = re.search(re.escape(BAS) + r".*?" + re.escape(BIT), html, re.S)
        if mevcut and mevcut.group(0) == yenisi.strip():
            return None
        yeni = html[:mevcut.start()] + yenisi.strip() + html[mevcut.end():]
    else:
        yeni = html[:m.start()] + "\n" + yenisi + html[m.start():]

    if yaz:
        io.open(yol, "w", encoding="utf-8", newline="").write(yeni)
    return "guncellendi"


def main():
    kontrol = "--check" in sys.argv
    degisen = []
    for yol in sorted(glob.glob("makaleler/*/index.html")):
        d = isle(yol, not kontrol)
        if d:
            degisen.append((yol, d))

    if not degisen:
        print("Atif etiketleri guncel.")
        return 0

    if kontrol:
        print("Atif etiketleri bayat olan %d sayfa:" % len(degisen))
        for yol, d in degisen:
            print("  - %s (%s)" % (yol, d))
        print("Duzeltmek icin: python tools/atif-etiketleri.py")
        return 1

    for yol, d in degisen:
        print("  %s: %s" % (yol, d))
    print("%d sayfada atif etiketleri yazildi." % len(degisen))
    return 0


if __name__ == "__main__":
    sys.exit(main())
