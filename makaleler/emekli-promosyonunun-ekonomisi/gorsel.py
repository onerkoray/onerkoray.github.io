"""Varsayımsal tekliflerin net fayda grafiği. Python + Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
FONT = next(p for p in [Path('C:/Windows/Fonts/segoeui.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists())
BOLD = FONT.with_name('segoeuib.ttf' if FONT.name == 'segoeui.ttf' else 'DejaVuSans-Bold.ttf')
for share in [False, True]:
    w, h = (1200, 630) if share else (800, 500)
    im = Image.new('RGB',(w,h),'#F4F1E9'); d = ImageDraw.Draw(im)
    def text(x,y,s,size=20,bold=False,anchor=None):
        d.text((x,y),s,font=ImageFont.truetype(str(BOLD if bold else FONT),size),fill='#17201D',anchor=anchor)
    text(40,25,'KORAY ÖNER  /  FİNANS',18,True)
    text(40,67,'Promosyonun etiketi ve net değeri',36 if share else 29,True)
    text(40,115,'Aynı vade. Farklı koşullar. Farklı kişisel kazanç.',22 if share else 20)
    left,right,top,bottom=75,w-50,190, h-120
    values=[18000]+[24000+p-8200 for p in [0,3000,6000]]
    for i,v in enumerate(values):
        x=left+(right-left)*(i+.5)/4;y=bottom-v/26000*(bottom-top)
        d.rectangle((x-44,y,x+44,bottom),fill='#2a78d6' if i==0 else '#eb6834')
        text(x,y-31,f'{v:,.0f}'.replace(',','.')+' TL',21,True,'mt')
        text(x,bottom+12,['A: sade','B: puan yok','B: yarısı','B: tamamı'][i],18,False,'mt')
    text(40,h-57,'Varsayımsal model · Bugünün TL’siyle net fayda',18)
    im.save(ROOT/'images/makale'/('emekli-promosyonunun-ekonomisi'+('' if share else '-kart')+'.png'),optimize=True)
