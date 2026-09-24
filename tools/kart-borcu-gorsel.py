"""Kart Borcu Rotası paylaşım görseli. Sayısal eğrileri hesap motorundan üretir."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / 'kart-borcu-rotasi.png'
data = json.loads(subprocess.check_output([
    'node', '-e',
    "const r=require('./kredi-karti-borcu-hesaplama/hesap.js').analiz({borc:40000,limit:50000,butce:10000,harcama:0,harcamaAy:0,hedefAy:6,ozelOran:null});console.log(JSON.stringify({min:r.asgariPlan.satirlar.map(x=>x.kalan),plan:r.butcePlan.satirlar.map(x=>x.kalan)}))"
], cwd=ROOT, text=True))

im = Image.new('RGB', (1200, 630), '#10231e')
d = ImageDraw.Draw(im)
regular = Path('C:/Windows/Fonts/segoeui.ttf')
bold = Path('C:/Windows/Fonts/segoeuib.ttf')
font = lambda size, heavy=False: ImageFont.truetype(str(bold if heavy else regular), size)
d.rounded_rectangle((52, 50, 1148, 580), radius=26, fill='#173129', outline='#3d7561', width=2)
d.text((100, 88), 'KORAY ÖNER  /  FİNANSAL HESAPLAMA', font=font(24, True), fill='#8bd4b1')
d.text((100, 151), 'Kart Borcu Rotası', font=font(68, True), fill='#f4faf6')
d.text((100, 244), 'Aynı borç. Üç farklı ödeme yolu.', font=font(34), fill='#d6e5dc')

left, top, right, bottom = 103, 334, 970, 515
for i in range(4):
    y = top + i * (bottom - top) / 3
    d.line((left, y, right, y), fill='#416558', width=2)
def points(values):
    seq = [40000] + values[:12]
    return [(left + i * (right-left)/12, bottom - v/45000*(bottom-top)) for i, v in enumerate(seq)]
minimum = points(data['min'])
planned = points(data['plan'])
d.line(minimum, fill='#e5a46d', width=6, joint='curve')
d.line(planned, fill='#69d7a2', width=8, joint='curve')
for x, y in (minimum[-1], planned[-1]):
    d.ellipse((x-7, y-7, x+7, y+7), fill='#f4faf6')
d.text((996, 363), 'ASGARİ', font=font(20, True), fill='#e5a46d')
d.text((996, 398), 'BÜTÇE', font=font(20, True), fill='#69d7a2')
d.text((103, 536), 'Bitiş ayı  •  faiz + vergi  •  hedef ödeme', font=font(23), fill='#a8c9b5')
im.save(OUT, optimize=True)
print(OUT)
