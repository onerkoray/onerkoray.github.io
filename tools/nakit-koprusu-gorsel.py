"""Nakit Köprüsü paylaşım kartı. Üret: bundled Python ile bu dosyayı çalıştır."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / 'nakit-koprusu-koray-oner.png'
im = Image.new('RGB', (1200, 630), '#10231e')
d = ImageDraw.Draw(im)
font = Path('C:/Windows/Fonts/segoeui.ttf')
bold = Path('C:/Windows/Fonts/segoeuib.ttf')
f = lambda size, heavy=False: ImageFont.truetype(str(bold if heavy else font), size)
d.rounded_rectangle((56, 52, 1144, 578), radius=30, fill='#173129', outline='#3d7561', width=2)
d.text((103, 91), 'KORAY ÖNER  /  FİNANSAL HESAPLAMA', font=f(24, True), fill='#89cfaf')
d.text((103, 157), 'Nakit Köprüsü', font=f(68, True), fill='#f4faf6')
d.text((103, 248), 'Kâr var. Nakit ne zaman gelir?', font=f(35), fill='#d6e5dc')
box = (104, 358, 1095, 526)
for y in (366, 432, 502):
    d.line((box[0], y, box[2], y), fill='#416558', width=2)
d.line((box[0], 432, box[2], 432), fill='#df9a63', width=3)
points = [(108, 466), (217, 486), (326, 506), (435, 477), (544, 448), (653, 418), (762, 387), (871, 358), (980, 329), (1090, 300)]
d.line(points, fill='#69d7a2', width=8, joint='curve')
for x,y in points:
    d.ellipse((x-6,y-6,x+6,y+6), fill='#9cf1c2')
d.text((104, 537), '12 aylık tahsilat • ödeme • işletme sermayesi', font=f(22), fill='#a8c9b5')
im.save(OUT, optimize=True)
print(OUT)
