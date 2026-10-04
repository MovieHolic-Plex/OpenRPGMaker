#!/usr/bin/env python3
"""Original integer-grid equipment art. Requires Python 3 and Pillow; no input art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json

ROOT = Path(__file__).resolve().parent
OUTLINE = '#242535'
GOLD = '#c9913c'
GOLD_LIGHT = '#ffe5a2'
GOLD_DARK = '#765033'
STEEL = '#97b6be'
STEEL_LIGHT = '#edf6e8'
STEEL_DARK = '#567780'


def canvas():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)


def sword():
    im, d = canvas()
    # Single curved edge, compact circular guard, wrapped wooden hilt.
    d.polygon([(10,22),(14,18),(22,11),(25,6),(26,2),(28,3),(28,8),
               (25,14),(17,21),(13,25)], fill=OUTLINE)
    d.polygon([(13,22),(17,18),(24,11),(26,6),(27,4),(27,8),
               (24,13),(16,20)], fill=STEEL)
    d.line([(14,22),(18,19),(25,12),(27,8)], fill=STEEL_LIGHT)
    d.line([(15,20),(22,13),(25,8)], fill=STEEL_DARK)
    d.ellipse((8,19,15,26), fill=OUTLINE)
    d.ellipse((9,20,14,25), fill=GOLD)
    d.line((10,21,13,22), fill=GOLD_LIGHT)
    d.line((9,24,12,25), fill=GOLD_DARK)
    d.polygon([(9,23),(11,25),(6,30),(3,27)], fill=OUTLINE)
    d.line((5,28,10,24), fill='#654334', width=2)
    for x,y in [(6,27),(8,25)]:
        d.line((x,y,x+1,y+1), fill='#bf8450')
    d.line((3,28,5,30), fill=GOLD)
    return im


def dagger():
    im, d = canvas()
    # A short knife; small bolster instead of a knight's crossguard.
    d.polygon([(11,20),(16,13),(24,5),(25,5),(25,9),(20,17),(15,22)], fill=OUTLINE)
    d.polygon([(13,19),(18,13),(24,7),(23,10),(18,17),(15,20)], fill=STEEL)
    d.line((15,19,23,9), fill=STEEL_LIGHT)
    d.line((13,19,21,10), fill=STEEL_DARK)
    d.polygon([(10,19),(12,18),(16,22),(14,24)], fill=OUTLINE)
    d.line((11,20,14,23), fill=GOLD_LIGHT)
    d.polygon([(11,22),(13,24),(8,29),(4,25),(8,21)], fill=OUTLINE)
    d.line((7,25,11,22), fill='#585563', width=2)
    d.line((7,27,12,23), fill='#30333f')
    d.line((6,24,8,26), fill='#a2a1a0')
    d.line((8,22,10,24), fill='#a2a1a0')
    d.line((4,25,7,28), fill=GOLD)
    d.line((5,25,7,27), fill=GOLD_LIGHT)
    return im


def bells():
    im, d = canvas()
    d.ellipse((9,3,23,14), fill=OUTLINE)
    d.ellipse((10,4,22,13), fill=GOLD)
    d.ellipse((12,6,20,11), fill=(0,0,0,0))
    d.arc((10,4,22,13), 185,285, fill=GOLD_LIGHT)
    d.rectangle((14,11,17,27), fill=OUTLINE)
    d.rectangle((15,12,16,26), fill='#805235')
    d.line((15,16,15,24), fill='#c29162')
    for endpoints in [(10,8,8,11),(22,8,24,11),(10,11,7,16),
                      (22,11,25,16),(12,13,10,21),(20,13,22,21)]:
        d.line(endpoints, fill=GOLD_DARK)
    # Seven separate globular bells, each with a dark sound slit.
    for x,y in [(6,8),(22,8),(5,14),(23,14),(8,19),(20,19),(14,6)]:
        d.ellipse((x,y,x+5,y+5), fill=OUTLINE)
        d.ellipse((x+1,y+1,x+4,y+4), fill=GOLD)
        d.point((x+1,y+1), fill=GOLD_LIGHT)
        d.line((x+2,y+3,x+3,y+3), fill=GOLD_DARK)
    d.rectangle((13,25,18,27), fill='#902f3d')
    d.line((13,27,11,30), fill='#e26557')
    d.line((17,27,19,30), fill='#902f3d')
    d.point((14,25), fill='#ffa579')
    return im


def fan():
    im, d = canvas()
    # Paper folds and bamboo ribs converge on the rivet.
    d.polygon([(2,12),(4,9),(7,6),(11,4),(16,3),(21,4),(25,6),
               (28,9),(30,12),(18,26),(14,26)], fill=OUTLINE)
    d.polygon([(3,12),(5,9),(8,7),(12,5),(16,4),(20,5),(24,7),
               (27,10),(29,12),(17,25),(15,25)], fill='#e4d6b0')
    d.polygon([(4,11),(8,7),(12,5),(16,4),(20,5),(24,7),(27,10),
               (26,13),(21,10),(16,9),(11,10),(6,14)], fill='#fff2cb')
    for endpoint in [(4,12),(8,7),(12,5),(16,4),(20,5),(24,7),(28,12)]:
        d.line((16,25,*endpoint), fill='#a58e62')
    d.line((3,12,15,26), fill=GOLD_DARK, width=2)
    d.line((29,12,17,26), fill=GOLD_DARK, width=2)
    d.line((4,12,15,25), fill='#d1ac68')
    d.line((28,12,17,25), fill='#d1ac68')
    d.ellipse((14,24,18,28), fill=OUTLINE)
    d.point((16,25), fill=GOLD_LIGHT)
    d.line((17,28,21,28), fill='#527f78')
    d.rectangle((21,27,23,29), fill='#78b59c')
    d.line((23,29,25,30), fill='#45695e')
    return im


def warrior_body():
    im, d = canvas()
    # Narrow sleeves, separate waist, pleated lower skirt: padded cheollik.
    d.polygon([(12,3),(19,3),(21,6),(25,8),(29,15),(24,18),
               (21,13),(21,18),(25,28),(23,30),(8,30),(6,28),
               (10,18),(10,13),(7,18),(2,15),(6,8),(10,6)], fill=OUTLINE)
    d.polygon([(11,7),(13,4),(18,4),(20,7),(24,9),(27,15),(24,16),
               (20,11),(20,18),(23,28),(21,29),(9,29),(8,27),(11,18),
               (11,11),(7,16),(4,15),(7,9)], fill='#365775')
    d.polygon([(12,8),(14,6),(16,9),(18,6),(20,8),(18,13),(14,16)], fill='#517b91')
    d.line([(13,4),(12,6),(17,12),(19,8),(18,4)], fill='#e9d9ae', width=2)
    d.line((14,8,18,12), fill='#adbcbb')
    for x in [10,13,16,19,22]:
        d.line((max(11,min(20,x)),19,x,27), fill='#233b59')
        d.line((max(12,min(19,x+1)),20,x+1,27), fill='#608399')
    d.rectangle((10,17,21,19), fill='#835a40')
    d.line((11,17,20,17), fill='#d5a266')
    d.rectangle((18,17,20,19), fill=GOLD)
    d.line((22,11,25,15), fill='#63869b')
    d.line((7,11,5,14), fill='#63869b')
    return im


def rogue_body():
    im, d = canvas()
    # Short jeogori, tapered sleeves, white collar and tied goreum.
    d.polygon([(12,5),(19,5),(22,8),(26,9),(29,20),(25,22),
               (22,17),(22,27),(10,27),(10,17),(7,22),(3,20),
               (6,9),(10,8)], fill=OUTLINE)
    d.polygon([(12,7),(14,6),(18,6),(20,9),(25,10),(27,19),(25,20),
               (21,13),(21,25),(11,25),(11,13),(7,20),(5,19),(7,10)], fill='#474650')
    d.polygon([(12,11),(15,8),(20,12),(19,24),(12,24)], fill='#62616c')
    d.line([(13,6),(12,8),(18,14),(20,10),(19,6)], fill='#ddd9c4', width=2)
    d.line((14,10,18,14), fill='#a5a1a0')
    d.line((12,16,12,23), fill='#82818a')
    d.line((21,17,21,24), fill='#282b3b')
    d.rectangle((10,24,22,26), fill='#72513c')
    d.line((11,24,21,24), fill='#bd9872')
    d.line((20,13,23,15), fill='#b9956b', width=2)
    d.line((21,14,20,20), fill='#997149')
    d.line((23,15,24,18), fill='#997149')
    d.line((7,12,6,17), fill='#77757e')
    d.line((25,12,26,18), fill='#77757e')
    return im


def shaman_body():
    im, d = canvas()
    # Red ritual cheollik: broad sleeves and a pleated skirt, coloured ribbons.
    d.polygon([(12,3),(19,3),(22,6),(26,7),(30,18),(24,21),
               (21,14),(21,20),(25,29),(7,29),(11,20),(11,14),
               (8,21),(2,18),(6,7),(10,6)], fill=OUTLINE)
    d.polygon([(12,5),(14,4),(18,4),(20,7),(25,8),(28,17),(25,19),
               (20,11),(20,20),(23,27),(9,27),(12,20),(12,11),
               (7,19),(4,17),(7,8)], fill='#a73d4b')
    d.polygon([(12,8),(16,7),(20,10),(19,18),(13,18)], fill='#d4605c')
    d.line([(13,4),(12,6),(17,12),(20,7),(18,4)], fill='#f6dfb0', width=2)
    for x in [11,14,17,20]:
        d.line((x,21,x-1,26), fill='#792f45')
        d.line((x+1,21,x+1,26), fill='#e17466')
    d.rectangle((11,18,21,20), fill='#d4b265')
    d.line((12,18,20,18), fill='#ffdda1')
    for x,col in [(16,'#568597'),(18,'#edc871'),(20,'#eee2ca')]:
        d.line((x,19,x+1,25), fill=col)
    d.line((25,11,27,16), fill='#ed806a')
    d.line((7,11,5,16), fill='#ed806a')
    d.line((4,18,7,19), fill='#e8ce9b')
    d.line((25,19,28,18), fill='#e8ce9b')
    return im


def taoist_body():
    im, d = canvas()
    # Dopo-inspired long straight robe, wide sleeves, thin blue waist cord.
    d.polygon([(12,2),(19,2),(22,5),(26,6),(30,17),(24,21),
               (21,14),(22,29),(10,29),(11,14),(8,21),(2,17),
               (6,6),(10,5)], fill=OUTLINE)
    d.polygon([(12,4),(14,3),(18,3),(20,6),(25,7),(28,16),(25,19),
               (20,11),(20,27),(11,27),(12,11),(7,19),(4,16),(7,7)], fill='#c8d5cc')
    d.polygon([(13,7),(16,6),(19,10),(19,26),(13,26)], fill='#f1edd8')
    d.line([(13,3),(12,5),(17,11),(20,6),(18,3)], fill='#fff8e4', width=2)
    d.line((17,11,16,26), fill='#8bacae')
    d.line((12,15,12,25), fill='#96b7b8')
    d.line((19,17,19,26), fill='#b4c3b8')
    d.line((10,15,21,15), fill='#507d8a')
    d.line((20,15,22,24), fill='#3b687a')
    d.line((21,16,24,21), fill='#6ba1aa')
    d.line((25,10,27,15), fill='#eef0d9')
    d.line((7,10,5,15), fill='#eef0d9')
    d.line((25,19,28,17), fill='#8bacae')
    d.line((4,17,7,19), fill='#8bacae')
    return im


PAINTERS = [('warrior-weapon-1',sword),('warrior-body-1',warrior_body),
            ('rogue-weapon-1',dagger),('rogue-body-1',rogue_body),
            ('shaman-weapon-1',bells),('shaman-body-1',shaman_body),
            ('taoist-weapon-1',fan),('taoist-body-1',taoist_body)]


def main():
    (ROOT/'icons').mkdir(exist_ok=True)
    (ROOT/'review').mkdir(exist_ok=True)
    assets = []
    for slug, painter in PAINTERS:
        im = painter()
        path = ROOT/'icons'/f'{slug}.png'
        im.save(path, optimize=False, compress_level=9)
        assets.append(dict(resourceId=f'jf-icon-{slug}',path=f'assets/joseon-folklore/equipment/{slug}.png',
                           sourcePath=f'icons/{slug}.png',width=32,height=32,
                           sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                           rgbaSha256=hashlib.sha256(im.tobytes()).hexdigest(),
                           origin='original integer-grid code art: equipment/draw.py',
                           copiedThirdPartyPixels=False))
    (ROOT/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n')
    sheet = Image.new('RGB',(896,480),'#e8ddc1')
    d = ImageDraw.Draw(sheet)
    d.text((12,8),'JF EQUIPMENT PILOT / ORIGINAL 32px / 6x NEAREST / DARK + LIGHT',fill=OUTLINE)
    for i,(slug,_) in enumerate(PAINTERS):
        x,y = (i//2)*224,(i%2)*224+28
        d.rectangle((x+8,y+24,x+207,y+219),fill='#242535')
        im = Image.open(ROOT/'icons'/f'{slug}.png').convert('RGBA')
        sheet.paste(im.resize((192,192),Image.Resampling.NEAREST),(x+12,y+26),im.resize((192,192),Image.Resampling.NEAREST))
        d.text((x+10,y+8),slug,fill=OUTLINE)
        sheet.paste(im,(x+174,y-5),im)
    sheet.save(ROOT/'review'/'pilot-contact.png',compress_level=9)
    print('Saved 8 original 32x32 RGBA icons, assets.json, review/pilot-contact.png')


if __name__ == '__main__':
    main()
