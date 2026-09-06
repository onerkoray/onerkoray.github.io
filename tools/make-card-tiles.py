#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ana sayfa kartlari icin ince, sade gorsel uretir.

Neden ayri: 1200x630 paylasim kapaklari afis olarak tasarlandi. Karta
sigdirilinca ictekni metin 8-9 piksele dusuyor, okunmuyor ve tasarimi
bogiyordu. Paylasim kapaklari og:image olarak kaliyor; kartlar bu 3:1
metinsiz karolari kullaniyor.

Cikti: images/tiles/<slug>.webp  (1200x400 render -> 600x200 WebP, ~6-10 KB)

Kullanim:
    python tools/make-card-tiles.py           # hepsini uret
    python tools/make-card-tiles.py maas-hesaplama
"""

import base64
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "tiles")

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

# Kategoriye gore ton farki — TEK HUE AILESI (yesil) icinde derinlik kademesi.
# Onceden uc ayri renkti (yesil / teal / mavi); marka yesile alininca mavi
# karolar kimlikle catisiyordu. Ayrim korundu ama tek aile icinde kaldi.
GRADIENTS = {
    "maas":  ("#053b33", "#0e7c66"),   # marka yesili — imza kategori
    "vergi": ("#06413f", "#11888a"),   # teale kacan yesil
    "genel": ("#0d4536", "#37a06f"),   # acik, taze yesil
}

TPL = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html,body {{ width:1200px; height:400px; overflow:hidden; }}
  body {{
    font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
    background:{c1}; color:#fff; position:relative;
    background-image:
      radial-gradient(760px 420px at 88% -10%, rgba(255,255,255,.13), transparent 62%),
      linear-gradient(115deg, {c1} 0%, {c2} 100%);
  }}
  .dots {{
    position:absolute; inset:0;
    background-image:radial-gradient(rgba(255,255,255,.10) 1.4px, transparent 1.4px);
    background-size:26px 26px; opacity:.30;
  }}
  .pad {{ position:absolute; inset:0; display:flex; align-items:center; padding:0 72px; }}
  .icon {{ width:150px; height:150px; flex:none; opacity:.97; }}
  .icon svg {{ width:100%; height:100%; display:block; }}
  .rule {{
    position:absolute; right:72px; top:50%; transform:translateY(-50%);
    width:4px; height:150px; border-radius:99px;
    background:linear-gradient(180deg, rgba(255,255,255,.65), rgba(255,255,255,.12));
  }}
</style></head><body>
  <div class="dots"></div>
  <div class="rule"></div>
  <div class="pad"><div class="icon">{svg}</div></div>
</body></html>"""


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def read_cards():
    """Ikon ve kategoriler tools/card-icons.json'da tutulur.

    Onceden ana sayfadaki kart rozetlerinden okunuyordu; rozetler karodaki
    ikonu tekrarladigi icin kaldirilinca bu kaynak kayboldu. Yeni arac
    eklerken bu dosyaya bir satir ekle.
    """
    path = os.path.join(ROOT, "tools", "card-icons.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for slug, rec in data.items():
        icon = rec["svg"]
        # rozette kucuk cizilmisti; karo icin daha kalin ve beyaz olsun
        icon = re.sub(r'stroke-width="[^"]*"', 'stroke-width="1.6"', icon)
        icon = icon.replace('stroke="currentColor"', 'stroke="#ffffff"')
        if "stroke=" not in icon:
            icon = icon.replace("<svg ", '<svg stroke="#ffffff" ', 1)
        out[slug] = {"cat": rec["cat"], "svg": icon}
    return out


def render(chrome, slug, cat, svg):
    c1, c2 = GRADIENTS.get(cat, GRADIENTS["genel"])
    doc = TPL.format(c1=c1, c2=c2, svg=svg)
    tmp = tempfile.mkdtemp(prefix="tile-")
    try:
        src = os.path.join(tmp, "t.html")
        with open(src, "w", encoding="utf-8") as f:
            f.write(doc)
        shot = os.path.join(tmp, "s.png")
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
               "--force-device-scale-factor=1", "--window-size=1200,400",
               "--default-background-color=00000000",
               "--screenshot=" + shot, "--user-data-dir=" + os.path.join(tmp, "u"),
               "file:///" + src.replace("\\", "/")]
        r = subprocess.run(cmd, capture_output=True, timeout=90)
        if not os.path.exists(shot):
            print("   HATA:", r.stderr.decode("utf-8", "replace")[:160])
            return False
        im = Image.open(shot).convert("RGB").resize((600, 200), Image.LANCZOS)
        dest = os.path.join(OUT, slug + ".webp")
        im.save(dest, "WEBP", quality=86, method=6)
        print("   %-40s %6d bayt" % (slug + ".webp", os.path.getsize(dest)))
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    os.makedirs(OUT, exist_ok=True)
    chrome = find_chrome()
    if not chrome:
        print("HATA: Chrome/Edge bulunamadi.", file=sys.stderr)
        return 1
    cards = read_cards()
    todo = args or sorted(cards)
    ok = 0
    for slug in todo:
        if slug not in cards:
            print("!! kart yok:", slug)
            continue
        if render(chrome, slug, cards[slug]["cat"], cards[slug]["svg"]):
            ok += 1
    print("\nUretilen: %d / %d" % (ok, len(todo)))
    return 0 if ok == len(todo) else 1


if __name__ == "__main__":
    sys.exit(main())
