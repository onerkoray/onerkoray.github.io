"""22 Eylül 2026 finans yazılarının hesaplanmış kapakları. Python + Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images/makale'
FONT = next(p for p in [Path('C:/Windows/Fonts/segoeui.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists())
BOLD = FONT.with_name('segoeuib.ttf' if FONT.name == 'segoeui.ttf' else 'DejaVuSans-Bold.ttf')
BG, INK, MUTED, BLUE, ORANGE = '#F4F1E9', '#17201D', '#5A625C', '#2a78d6', '#eb6834'

def make(slug, title, subtitle, cash=False):
    for share in [False, True]:
        w, h = (1200, 630) if share else (800, 500)
        im = Image.new('RGB', (w, h), BG)
        d = ImageDraw.Draw(im)
        def text(x, y, s, size=22, color=INK, bold=False, anchor=None):
            d.text((x, y), s, fill=color, font=ImageFont.truetype(str(BOLD if bold else FONT), size), anchor=anchor)
        text(40, 25, 'KORAY ÖNER  /  FİNANS', 18, MUTED, True)
        text(40, 66, title, 38 if share else 29, bold=True)
        text(40, 118 if share else 108, subtitle, 22 if share else 19, MUTED)
        x0, x1 = 70, w-60
        top, bottom = (190, 490) if share else (170, 375)
        if not cash:
            values = [1000, 1000*1.4, 1000*1.4*1.2]
            for i, (v, label, rate) in enumerate(zip(values, ['Başlangıç','1. yıl sonu','2. yıl sonu'], ['','+%40','+%20'])):
                x = x0 + (x1-x0)*(i+.5)/3
                y = bottom-v/1900*(bottom-top)
                d.rectangle((x-55,y,x+55,bottom), fill=BLUE)
                text(x,y-29,f'{v:,.0f}'.replace(',','.')+' TL',22,bold=True,anchor='mt')
                text(x,bottom+12,label,20,anchor='mt')
                text(x,bottom+43,rate,21,bold=True,anchor='mt')
        else:
            start, stop = [0,150,-250,-350,0], [150,-250,-350,-150,-150]
            labels = ['Kâr','Alacak','Stok','Ticari borç','Net nakit']
            numbers = ['+150','−400','−100','+200','−150']
            def yy(v): return top + (200-v)/600*(bottom-top)
            d.line((x0,yy(0),x1,yy(0)),fill=MUTED,width=1)
            for i,(a,b) in enumerate(zip(start,stop)):
                x=x0+(x1-x0)*(i+.5)/5
                d.rectangle((x-34,min(yy(a),yy(b)),x+34,max(yy(a),yy(b))),fill=BLUE if b>=a else ORANGE)
                text(x,min(yy(a),yy(b))-26,numbers[i],21,bold=True,anchor='mt')
                text(x,bottom+15,labels[i],18,anchor='mt')
                if i<3:
                    nx=x0+(x1-x0)*(i+1.5)/5
                    d.line((x+34,yy(b),nx-34,yy(b)),fill=MUTED,width=1)
        text(40,h-50,'Varsayımsal örnek · '+('Tutarlar bin TL' if cash else 'Aynı miktar ve kalitede sepet'),18,MUTED)
        im.save(OUT/(slug+('' if share else '-kart')+'.png'),optimize=True)

make('enflasyon-duserken-fiyatlar-neden-dusmuyor','Enflasyon yavaşlıyor, fiyat yükseliyor','Artış %40’tan %20’ye düşüyor; iki yılda toplam artış %68.')
make('ciro-artarken-nakit-neden-azalir','Kâr var, nakit azalıyor','150 bin TL kârdan −150 bin TL nakit değişimine.',True)
