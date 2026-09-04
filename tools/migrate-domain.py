#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Siteyi onerkoray.github.io adresinden yeni bir alan adina tasir.

Tek islemde:
  - Tum HTML/XML/TXT/JSON/MD dosyalarindaki mutlak URL'leri (canonical, og:url,
    JSON-LD @id ve url alanlari, sitemap, atom, robots, security.txt) yeni alana cevirir.
  - Yasal sayfalara ve security.txt'ye iletisim e-postasini yerlestirir.
  - Yeni domain icin CNAME dosyasi olusturur (GitHub Pages'te birakilirsa gerekir).

Kullanim:
    python tools/migrate-domain.py ornekdomain.com --email iletisim@ornekdomain.com
        -> KURU CALISMA: hicbir dosya degismez, sadece rapor basar.

    python tools/migrate-domain.py ornekdomain.com --email iletisim@ornekdomain.com --apply
        -> Degisiklikleri yazar.

Geri almak icin:  git checkout -- .
"""

import argparse
import os
import re
import sys

OLD_HOST = "onerkoray.github.io"
OLD_URL = "https://" + OLD_HOST

TEXT_EXT = {".html", ".xml", ".txt", ".json", ".md", ".js", ".css"}
SKIP_DIRS = {".git", "images", "node_modules", ".vercel"}

# Bu dosyalarda domain gecse bile DOKUNULMAZ (disariya bakan gercek adresler)
SKIP_FILES = {"README.md"}

EMAIL_SLOT = "<!-- CONTACT-EMAIL-SLOT -->"


def email_block(email, indent="        "):
    return (
        '{i}<p>\n'
        '{i}  İletişim adresi: <a href="mailto:{e}">{e}</a>\n'
        '{i}</p>'
    ).format(i=indent, e=email)


def walk_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn in SKIP_FILES:
                continue
            if os.path.splitext(fn)[1].lower() in TEXT_EXT:
                yield os.path.join(dirpath, fn)


def main():
    ap = argparse.ArgumentParser(description="Siteyi yeni alan adina tasir.")
    ap.add_argument("domain", help="Yeni alan adi, ornek: hesavo.com (https:// yazma)")
    ap.add_argument("--email", help="Sitede gorunecek iletisim e-postasi, ornek: iletisim@hesavo.com")
    ap.add_argument("--apply", action="store_true", help="Degisiklikleri gercekten yaz")
    ap.add_argument("--no-cname", action="store_true", help="CNAME dosyasi olusturma (Vercel'de gerekmez)")
    args = ap.parse_args()

    domain = args.domain.strip().lower()
    domain = re.sub(r"^https?://", "", domain).strip("/")
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", domain):
        sys.exit("HATA: gecersiz alan adi: %s" % domain)
    if args.email and "@" not in args.email:
        sys.exit("HATA: gecersiz e-posta: %s" % args.email)

    new_url = "https://" + domain
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("Kok dizin : %s" % root)
    print("Eski adres: %s" % OLD_URL)
    print("Yeni adres: %s" % new_url)
    print("E-posta   : %s" % (args.email or "(atlandi)"))
    print("Mod       : %s" % ("YAZ (--apply)" if args.apply else "KURU CALISMA"))
    print("-" * 62)

    total_url = 0
    total_mail = 0
    touched = []

    for path in walk_files(root):
        rel = os.path.relpath(path, root)
        try:
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
        except UnicodeDecodeError:
            continue

        out = src
        n_url = out.count(OLD_URL) + len(re.findall(r"(?<!/)\b" + re.escape(OLD_HOST), out))
        out = out.replace(OLD_URL, new_url)
        out = out.replace(OLD_HOST, domain)
        n_url = src.count(OLD_HOST)

        n_mail = 0
        if args.email and EMAIL_SLOT in out:
            indent = " " * 8
            out = out.replace(EMAIL_SLOT, email_block(args.email, indent))
            n_mail = 1

        # security.txt: Contact satirini e-postaya cevir
        if args.email and rel.replace("\\", "/").endswith(".well-known/security.txt"):
            out2, c = re.subn(r"^Contact: .*$", "Contact: mailto:%s" % args.email,
                              out, count=1, flags=re.M)
            if c:
                out = out2
                n_mail += 1

        if out != src:
            total_url += n_url
            total_mail += n_mail
            touched.append((rel, n_url, n_mail))
            if args.apply:
                with open(path, "w", encoding="utf-8", newline="") as fh:
                    fh.write(out)

    for rel, n_url, n_mail in sorted(touched):
        extra = "  +e-posta" if n_mail else ""
        print("  %-58s %3d URL%s" % (rel, n_url, extra))

    print("-" * 62)
    print("Dosya: %d   URL degisikligi: %d   E-posta yerlesimi: %d"
          % (len(touched), total_url, total_mail))

    # CNAME (GitHub Pages icin)
    cname_path = os.path.join(root, "CNAME")
    if not args.no_cname:
        if args.apply:
            with open(cname_path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(domain + "\n")
            print("CNAME yazildi -> %s" % domain)
        else:
            print("CNAME yazilacak -> %s  (Vercel kullanacaksan --no-cname ver)" % domain)

    if not args.apply:
        print("\nKuru calisma bitti. Uygulamak icin ayni komuta --apply ekle.")
    else:
        print("\nBitti. Kontrol: git diff --stat   |   Geri al: git checkout -- .")
        print("Unutma: GSC'ye yeni domain mulku ekle, sitemap gonder, "
              "eski mulkte adres degisikligi aracini calistir.")


if __name__ == "__main__":
    main()
