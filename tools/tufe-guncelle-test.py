# -*- coding: utf-8 -*-
"""tools/tufe-guncelle.py'nin RET mantığı — ağsız, depodaki seriyle.

Gece çalışıp siteye veri yazan bir betikte en önemli kısım neyi YAZMADIĞI.
Bu test bozuk veri senaryolarını depodaki gerçek seriden türetip
dogrula()'nın her birini anlaşılır bir sebeple reddettiğini, temiz veriyi
ise kabul ettiğini sınar. İlk koşuda bir kusur buldu: resmî dönemin bir
ayı eksikse betik açık ret yerine KeyError ile çöküyordu.
"""
import copy
import importlib.util
import io
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("tg", os.path.join(KOK, "tools", "tufe-guncelle.py"))
tg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tg)

for akis in (sys.stdout, sys.stderr):
    try:
        akis.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

s = io.open(os.path.join(KOK, "finans", "tufe-serisi.js"), encoding="utf-8").read()
gercek = json.loads(re.search(r"/\*VERI\*/([\s\S]*?)/\*VERI-SON\*/", s).group(1))

gecen = hata = 0


def dene(ad, seri, eski, reddetmeli):
    global gecen, hata
    h = tg.dogrula(seri, eski)
    if bool(h) == reddetmeli:
        gecen += 1
        print("  tamam      " + ad)
    else:
        hata += 1
        print("  BASARISIZ  " + ad + ("  (" + h[0] + ")" if h else "  (kabul edildi)"))


print("TÜFE güncelleme — ret mantığı\n")

# KONTROL: temiz veri kabul edilmeli, yoksa her şeyi reddeden bir betik de geçerdi.
dene("KONTROL: temiz seri kabul", gercek, gercek, False)
son = max(gercek)
y, a = map(int, son.split("-"))
yeni_ay = "%04d-%02d" % (y + (a == 12), 1 if a == 12 else a + 1)
dene("KONTROL: yeni ay eklenen seri kabul",
     dict(gercek, **{yeni_ay: {"aylik": 2.1, "yillik": 30.0}}), gercek, False)

k = copy.deepcopy(gercek); del k["2025-03"]
dene("ay atlaması reddediliyor (resmî dönem içinde, çökmeden)", k, gercek, True)
k = {x: v for x, v in gercek.items() if x >= "2010-01"}
dene("240'tan az ay reddediliyor", k, {}, True)
k = copy.deepcopy(gercek); k["2024-10"] = {"aylik": 2.99, "yillik": k["2024-10"]["yillik"]}
dene("resmî dönem içinde değişen geçmiş ay reddediliyor", k, gercek, True)
k = copy.deepcopy(gercek); k["2012-05"] = {"aylik": 1.0, "yillik": k["2012-05"]["yillik"]}
dene("resmî dönem dışında değişen geçmiş ay reddediliyor", k, gercek, True)
k = {x: v for x, v in gercek.items() if x < son}
dene("geri giden kaynak reddediliyor", k, gercek, True)
k = copy.deepcopy(gercek); k[son] = {"aylik": 184.0, "yillik": 31.51}
dene("makul olmayan oran (virgül kayması) reddediliyor", k, {}, True)
k = copy.deepcopy(gercek); k["2025-02"] = {"aylik": 2.37, "yillik": k["2025-02"]["yillik"]}
dene("resmî artışı tutmayan seri reddediliyor (depo boşken)", k, {}, True)

print("\n%d gecti, %d kaldi. (TÜFE ret mantığı)" % (gecen, hata))
sys.exit(1 if hata else 0)
