#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""1200x630 paylasim kapaklarindan kart kucuk resimleri uretir.

Neden gerekli: kapaklar yalnizca <meta property="og:image"> icinde yasiyordu,
yani sayfada hic render edilmiyordu. Google Gorseller sayfada gercekten yer
alan gorselleri indeksler; og:image bir sosyal paylasim sinyalidir. Kapaklari
ana sayfa kartlarinda gostermek icin hafif surumleri gerekiyor.

Cikti: images/thumbs/<ad>.webp  (600x315, kalite 82 — ~20-35 KB)

Kullanim:
    python tools/make-thumbs.py            # eksikleri uret
    python tools/make-thumbs.py --force    # hepsini yeniden uret
"""

import os
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(SRC, "thumbs")

W, H = 600, 315
QUALITY = 82

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

# Kendi kimligini tasiyan, images/ disindaki kapaklar
EXTRA = {
    "dither-studio": os.path.join(ROOT, "dither-studio", "og-image.png"),
    "decorpalette": os.path.join(ROOT, "decorpalette", "images", "og-cover.svg"),
}


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def svg_to_png(chrome, svg_path):
    """SVG'yi Pillow okuyamaz; headless tarayiciyla rasterize et."""
    tmp = tempfile.mkdtemp(prefix="thumb-")
    out = os.path.join(tmp, "shot.png")
    cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--force-device-scale-factor=1", "--window-size=1200,630",
           "--default-background-color=00000000",
           "--screenshot=" + out, "--user-data-dir=" + os.path.join(tmp, "u"),
           "file:///" + svg_path.replace("\\", "/")]
    subprocess.run(cmd, capture_output=True, timeout=90)
    return out if os.path.exists(out) else None


def write_thumb(src_png, name):
    im = Image.open(src_png).convert("RGB")
    im = im.resize((W, H), Image.LANCZOS)
    dest = os.path.join(OUT, name + ".webp")
    im.save(dest, "WEBP", quality=QUALITY, method=6)
    return dest


def main():
    force = "--force" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    chrome = find_chrome()

    jobs = {}
    for f in sorted(os.listdir(SRC)):
        if f.endswith("-koray-oner.png"):
            jobs[f[: -len("-koray-oner.png")]] = os.path.join(SRC, f)
    jobs.update(EXTRA)

    made = skipped = 0
    for name, src in sorted(jobs.items()):
        dest = os.path.join(OUT, name + ".webp")
        if os.path.exists(dest) and not force:
            skipped += 1
            continue
        if not os.path.exists(src):
            print("   !! kaynak yok:", src)
            continue
        png = src
        if src.lower().endswith(".svg"):
            if not chrome:
                print("   !! SVG icin tarayici bulunamadi:", name)
                continue
            png = svg_to_png(chrome, src)
            if not png:
                print("   !! SVG rasterize edilemedi:", name)
                continue
        d = write_thumb(png, name)
        print("   %-40s %6d bayt" % (os.path.basename(d), os.path.getsize(d)))
        made += 1

    print("\nUretilen: %d, atlanan: %d (--force ile hepsini yenile)" % (made, skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
