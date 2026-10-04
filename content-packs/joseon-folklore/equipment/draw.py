#!/usr/bin/env python3
"""Original integer-grid equipment art. Requires Python 3 and Pillow; no input art."""
from pathlib import Path
from PIL import Image, ImageDraw
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


def advanced_sword(tier):
    im,d=canvas()
    blade = {2:[(9,22),(16,14),(23,7),(25,2),(28,3),(27,9),(20,17),(13,24)],
             3:[(9,22),(16,13),(24,5),(26,2),(29,3),(28,8),(20,18),(13,25)],
             4:[(9,22),(16,13),(22,7),(26,2),(29,2),(28,9),(22,16),(13,25)]}[tier]
    d.polygon(blade,fill=OUTLINE)
    d.polygon([(12,21),(18,14),(25,6),(27,4),(26,9),(19,17),(13,23)],fill=STEEL)
    d.line([(13,22),(20,16),(26,9),(27,5)],fill=STEEL_LIGHT)
    d.line([(12,21),(18,14),(25,6)],fill=STEEL_DARK)
    if tier>=3:
        d.line([(16,19),(23,11),(25,7)],fill='#c8d5cc')
    # Compact oval guard and different wrap, pommel and tassel layouts.
    d.ellipse((7,19,15,26),fill=OUTLINE)
    d.ellipse((8,20,14,25),fill=GOLD if tier!=3 else '#a5a1a0')
    d.line((9,21,12,21),fill=GOLD_LIGHT)
    d.polygon([(9,24),(11,26),(6,30),(2,27)],fill=OUTLINE)
    d.line((4,28,9,25),fill='#654334' if tier==2 else '#527f78',width=2)
    d.line((5,26,7,28),fill='#d1ac68')
    d.line((7,24,9,26),fill='#d1ac68')
    d.rectangle((2,27,4,29),fill=GOLD)
    if tier==3: d.line((4,29,9,30),fill='#902f3d')
    if tier==4:
        d.rectangle((3,27,5,29),fill='#78b59c')
        d.line((5,29,11,29),fill='#902f3d')
        d.line((9,29,12,30),fill='#e26557')
    return im


def advanced_dagger(tier):
    im,d=canvas()
    # Every blade is deliberately compact: max 14x16 vs swords 20x24.
    shapes={2:[(11,20),(12,13),(18,6),(22,5),(20,11),(16,19),(14,22)],
            3:[(11,19),(14,11),(21,5),(23,5),(21,11),(17,18),(14,22)],
            4:[(10,18),(14,10),(21,5),(24,5),(22,9),(18,15),(13,21)]}
    d.polygon(shapes[tier],fill=OUTLINE)
    d.polygon([(12,18),(15,12),(21,7),(20,11),(16,17),(14,20)],fill=STEEL)
    d.line([(14,19),(18,14),(21,9)],fill=STEEL_LIGHT)
    d.line((12,18,18,10),fill=STEEL_DARK)
    d.polygon([(9,18),(11,17),(16,22),(14,24)],fill=OUTLINE)
    d.line((10,19,14,23),fill='#c8d5cc' if tier==3 else GOLD_LIGHT)
    d.polygon([(10,21),(13,24),(8,29),(4,27),(4,25)],fill=OUTLINE)
    d.line((6,26,10,22),fill='#62616c' if tier==2 else '#507d8a',width=2)
    d.line((6,24,8,26),fill='#e4d6b0')
    d.line((8,22,10,24),fill='#e4d6b0')
    d.line((4,26,7,29),fill=GOLD)
    if tier>=3:
        d.rectangle((5,27,7,28),fill='#78b59c')
        d.line((7,28,11,30),fill='#902f3d')
    if tier==4:
        d.line((12,18,14,17),fill=GOLD)
        d.line((11,29,14,29),fill='#e26557')
    return im


def advanced_bells(tier):
    im,d=canvas()
    ring={2:(8,3,24,14),3:(7,3,25,15),4:(8,2,24,13)}[tier]
    d.ellipse(ring,outline=OUTLINE,width=3)
    d.ellipse((ring[0]+1,ring[1]+1,ring[2]-1,ring[3]-1),outline=GOLD,width=1)
    d.line((15,11,15,27),fill=OUTLINE,width=4)
    d.line((15,13,15,26),fill='#805235',width=2)
    d.line((14,15,14,24),fill='#c29162')
    # Seven recognisable bell bodies, attached by explicit stems.
    positions = [(4,7),(12,4),(22,7),(3,14),(23,14),(7,20),(19,20)]
    if tier==3: positions=[(3,6),(12,3),(23,6),(3,14),(23,14),(7,20),(19,20)]
    if tier==4: positions=[(4,6),(12,3),(22,6),(3,14),(23,14),(7,20),(19,20)]
    for x,y in positions:
        d.line((16,9,x+3,y+2),fill=GOLD_DARK)
    for x,y in positions:
        d.ellipse((x,y,x+5,y+5),fill=OUTLINE)
        d.ellipse((x+1,y+1,x+4,y+4),fill=GOLD if tier!=3 else '#c8d5cc')
        d.line((x+1,y+1,x+2,y+1),fill=GOLD_LIGHT if tier!=3 else STEEL_LIGHT)
        d.line((x+2,y+3,x+3,y+3),fill=GOLD_DARK)
        d.point((x+3,y+4),fill=GOLD_DARK)
    d.rectangle((13,26,18,27),fill='#902f3d')
    for x,col in [(13,'#e26557'),(16,'#568597'),(18,'#edc871')]:
        d.line((x,27,x-1,30),fill=col)
    if tier>=3:
        d.rectangle((14,16,17,18),fill='#527f78')
        d.point((15,16),fill='#78b59c')
    if tier==4:
        d.line((9,3,16,2),fill=GOLD_LIGHT)
        d.line((18,3,23,5),fill=GOLD_LIGHT)
    return im


def advanced_fan(tier):
    im,d=canvas()
    edge={2:[(2,13),(4,9),(9,5),(16,3),(23,5),(28,9),(30,13)],
          3:[(2,12),(3,8),(8,4),(16,2),(24,4),(29,8),(30,12)],
          4:[(2,13),(3,8),(7,4),(12,2),(20,2),(25,4),(29,8),(30,13)]}[tier]
    d.polygon(edge+[(18,25),(14,25)],fill=OUTLINE)
    d.polygon([(x,max(3,y+1)) for x,y in edge]+[(17,24),(15,24)],fill='#e4d6b0')
    d.polygon([(4,12),(8,7),(16,4),(24,7),(28,12),(23,12),(16,9),(9,12)],fill='#fff2cb')
    for x,y in [(4,12),(8,7),(12,5),(16,4),(20,5),(24,7),(28,12)]:
        d.line((16,24,x,y),fill='#a58e62')
    d.line((3,13,15,25),fill=GOLD_DARK,width=2)
    d.line((29,13,17,25),fill=GOLD_DARK,width=2)
    # Original stylised ridge/cloud/bamboo motifs, no writing or borrowed images.
    if tier==2:
        d.line([(7,15),(11,12),(15,15),(20,11),(25,15)],fill='#507d8a')
    elif tier==3:
        d.line([(7,14),(10,13),(12,14),(14,12),(17,13)],fill='#96b7b8')
        d.line([(19,11),(22,10),(25,12)],fill='#96b7b8')
    else:
        d.line((20,8,21,18),fill='#527f78')
        for y in [10,13,16]:
            d.line((20,y,17,y-2),fill='#78b59c')
            d.line((21,y,24,y-2),fill='#78b59c')
    d.ellipse((14,23,18,27),fill=OUTLINE)
    d.point((16,24),fill=GOLD_LIGHT)
    d.line((17,27,21,28),fill='#527f78')
    d.rectangle((21,27,23,29),fill='#78b59c')
    d.line((23,29,26,30),fill='#902f3d' if tier>=3 else '#45695e')
    return im


def advanced_body(role,tier):
    im,d=canvas()
    palettes={'warrior':('#365775','#517b91','#233b59'),
              'rogue':('#474650','#77757e','#282b3b'),
              'shaman':('#a73d4b','#e17466','#792f45'),
              'taoist':('#c8d5cc','#f1edd8','#8bacae')}
    base,light,shade=palettes[role]
    wide=role in ('shaman','taoist')
    bottom=27 if role=='rogue' and tier==2 else 29
    waist=17 if role in ('warrior','shaman') else 16
    cuff_y=19 if wide else 17
    d.polygon([(12,3),(19,3),(22,6),(26,7),(30,cuff_y-2),(25,cuff_y+2),
               (21,13),(21,waist+2),(24,bottom),(8,bottom),(11,waist+2),
               (11,13),(7,cuff_y+2),(2,cuff_y-2),(6,7),(10,6)],fill=OUTLINE)
    d.polygon([(12,5),(14,4),(18,4),(20,7),(25,8),(28,cuff_y-2),
               (25,cuff_y),(20,11),(20,waist+2),(22,bottom-1),(10,bottom-1),
               (12,waist+2),(12,11),(7,cuff_y),(4,cuff_y-2),(7,8)],fill=base)
    d.polygon([(12,8),(16,7),(20,10),(19,waist),(13,waist)],fill=light)
    d.line([(13,4),(12,6),(17,12),(20,7),(18,4)],fill='#fff2cb',width=2)
    d.line((7,10,5,cuff_y-3),fill=light)
    d.line((25,10,27,cuff_y-3),fill=light)
    if role=='warrior':
        # Cloth wrap/waistcoat variations, never metal armour.
        if tier==2:
            d.polygon([(10,8),(13,8),(14,16),(10,16)],fill='#835a40')
            d.polygon([(19,8),(22,8),(22,16),(18,16)],fill='#835a40')
        elif tier==3:
            d.line((11,9,20,15),fill='#adbcbb',width=2)
            d.line((10,14,19,17),fill='#517b91')
        else:
            d.line((11,8,11,17),fill='#78b59c')
            d.line((20,8,20,17),fill='#78b59c')
        for x in [11,14,17,20]:
            d.line((x,19,x-1,bottom-2),fill=shade)
            d.line((x+1,20,x+1,bottom-2),fill=light)
        if tier==4:
            d.line((16,20,16,28),fill=OUTLINE)
            d.line((17,21,18,28),fill=shade)
    elif role=='rogue':
        if tier==2:
            d.polygon([(10,8),(13,8),(15,15),(14,23),(10,23)],fill='#282b3b')
            d.polygon([(19,8),(22,8),(22,23),(17,23),(17,15)],fill='#282b3b')
            d.line((12,10,14,16),fill=light)
        else:
            d.line((16,17,16,27),fill=shade)
            d.line((12,19,11,27),fill=light)
            d.line((19,20,20,27),fill=light)
        if tier==4:
            d.line((10,11,13,15),fill='#adbcbb')
            d.line((20,18,22,26),fill='#527f78',width=2)
    elif role=='shaman':
        for x in [11,14,17,20]:
            d.line((x,20,x-1,27),fill=shade)
            d.line((x+1,21,x+1,27),fill=light)
        ribbons=['#568597','#edc871','#eee2ca','#78b59c','#902f3d']
        for i,col in enumerate(ribbons): d.line((14+i,19,14+i,26),fill=col)
        if tier>=3:
            d.line((4,cuff_y-2,7,cuff_y),fill='#fff2cb',width=2)
            d.line((25,cuff_y,28,cuff_y-2),fill='#fff2cb',width=2)
        if tier==4:
            d.line((12,9,16,15),fill=GOLD_LIGHT)
            d.line((20,9,16,15),fill=GOLD_LIGHT)
    else:
        d.line((16,12,16,27),fill=shade)
        d.line((12,18,12,27),fill=light)
        d.line((20,18,21,27),fill=shade)
        if tier>=3:
            d.line((10,8,11,15),fill='#365775',width=2)
            d.line((21,8,20,15),fill='#365775',width=2)
            d.line((10,28,22,28),fill='#365775')
        if tier==4:
            d.line((24,11,26,16),fill='#527f78')
            d.line((7,12,5,16),fill='#527f78')
    belt='#507d8a' if role=='taoist' else '#835a40' if role=='rogue' else '#d4b265'
    d.line((11,waist,21,waist),fill=belt,width=2)
    if role!='shaman':
        d.line((20,waist,22,waist+6),fill=belt)
        d.line((20,waist,24,waist+3),fill=belt)
    if tier>=3: d.point((19,waist),fill=GOLD_LIGHT)
    if tier==4: d.rectangle((18,waist,20,waist+1),fill='#78b59c')
    return im


def shared_head(index):
    im,d=canvas()
    if index==1:
        # Curved horsehair mesh band, side eyelets and ties.
        d.polygon([(5,10),(9,7),(22,7),(27,10),(27,21),(23,23),(8,23),(4,20)],fill=OUTLINE)
        d.polygon([(6,11),(10,9),(21,9),(25,11),(25,19),(22,21),(8,21),(6,19)],fill='#474650')
        for x in range(7,25,3):d.line((x,11,x,19),fill='#77757e')
        for y in range(12,20,3):d.line((7,y,24,y),fill='#282b3b')
        d.line((7,20,24,20),fill='#a5a1a0')
        d.ellipse((5,15,8,18),fill=GOLD)
        d.ellipse((23,15,26,18),fill=GOLD)
        d.line((5,18,3,27),fill='#62616c')
        d.line((26,18,28,26),fill='#62616c')
    else:
        d.polygon([(2,18),(6,13),(13,6),(16,4),(19,6),(26,13),(30,18),
                   (28,22),(22,25),(10,25),(4,22)],fill=OUTLINE)
        d.polygon([(3,18),(8,13),(16,5),(24,13),(29,18),(27,21),(22,23),(10,23),(5,21)],fill='#c9913c')
        for x in [5,9,13,18,22,27]:d.line((16,6,x,20),fill='#ffe5a2')
        d.line([(4,18),(10,20),(22,20),(28,18)],fill='#765033')
        d.line([(7,15),(12,16),(21,16),(25,15)],fill='#a58e62')
        d.line((10,24,12,29),fill='#654334')
        d.line((22,24,19,29),fill='#654334')
    return im


def shared_accessory(index):
    im,d=canvas()
    if index==1:
        d.ellipse((11,2,21,10),outline=OUTLINE,width=2)
        d.arc((12,3,20,9),175,360,fill='#edc871')
        d.polygon([(12,9),(20,9),(24,15),(23,24),(19,27),(11,27),(7,23),(8,15)],fill=OUTLINE)
        d.polygon([(12,11),(20,11),(22,16),(21,23),(18,25),(12,25),(9,22),(10,16)],fill='#a73d4b')
        d.polygon([(12,12),(18,12),(19,23),(12,23),(10,20)],fill='#e17466')
        d.line((10,12,22,12),fill=GOLD_LIGHT)
        d.line((14,16,18,20),fill='#e4d6b0')
        d.line((18,16,14,20),fill='#e4d6b0')
        d.line((18,26,20,29),fill=GOLD)
        d.line((20,28,23,29),fill='#edc871')
    else:
        d.ellipse((13,2,19,7),outline=GOLD,width=1)
        d.line((16,7,16,12),fill='#902f3d',width=2)
        d.polygon([(16,10),(23,16),(16,23),(9,16)],fill=OUTLINE)
        d.polygon([(16,12),(21,16),(16,21),(11,16)],fill='#527f78')
        d.line((13,15,16,12),fill='#c8d5cc')
        d.line((12,16,16,20),fill='#78b59c')
        d.point((17,16),fill=GOLD_LIGHT)
        d.rectangle((14,22,18,24),fill=GOLD)
        for x in [12,14,16,18,20]:
            d.line((16,24,x,29),fill='#902f3d' if x%4 else '#e26557')
        d.line((13,27,19,27),fill='#d4605c')
    return im


for _role,_weapon in [('warrior',advanced_sword),('rogue',advanced_dagger),
                      ('shaman',advanced_bells),('taoist',advanced_fan)]:
    for _tier in [2,3,4]:
        PAINTERS.append((f'{_role}-weapon-{_tier}',lambda t=_tier,p=_weapon:p(t)))
        PAINTERS.append((f'{_role}-body-{_tier}',lambda r=_role,t=_tier:advanced_body(r,t)))
for _kind,_fn in [('head',shared_head),('accessory',shared_accessory)]:
    for _index in [1,2]:
        PAINTERS.append((f'shared-{_kind}-{_index}',lambda i=_index,p=_fn:p(i)))


def contact(name,slugs,columns=4):
    rows=(len(slugs)+columns-1)//columns
    sheet=Image.new('RGB',(columns*208,rows*218+28),'#e8ddc1')
    d=ImageDraw.Draw(sheet)
    d.text((10,8),f'JF {name.upper()} / ORIGINAL 32px + 5x NEAREST / LIGHT + DARK',fill=OUTLINE)
    for i,slug in enumerate(slugs):
        x,y=(i%columns)*208,(i//columns)*218+28
        d.text((x+8,y+5),slug,fill=OUTLINE)
        im=Image.open(ROOT/'icons'/f'{slug}.png').convert('RGBA')
        sheet.paste(im,(x+168,y),im)
        d.rectangle((x+18,y+40,x+189,y+207),fill=OUTLINE)
        zoom=im.resize((160,160),Image.Resampling.NEAREST)
        sheet.paste(zoom,(x+24,y+44),zoom)
    sheet.save(ROOT/'review'/f'{name}.png',compress_level=9)


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
    for i,(slug,_) in enumerate(PAINTERS[:8]):
        x,y = (i//2)*224,(i%2)*224+28
        d.rectangle((x+8,y+24,x+207,y+219),fill='#242535')
        im = Image.open(ROOT/'icons'/f'{slug}.png').convert('RGBA')
        sheet.paste(im.resize((192,192),Image.Resampling.NEAREST),(x+12,y+26),im.resize((192,192),Image.Resampling.NEAREST))
        d.text((x+10,y+8),slug,fill=OUTLINE)
        sheet.paste(im,(x+174,y-5),im)
    sheet.save(ROOT/'review'/'pilot-contact.png',compress_level=9)
    for role in ['warrior','rogue','shaman','taoist']:
        contact(role+'-full',[f'{role}-{kind}-{tier}' for kind in ['weapon','body'] for tier in [1,2,3,4]])
    contact('shared-full',[f'shared-{kind}-{i}' for kind in ['head','accessory'] for i in [1,2]])
    contact('full-contact',[slug for slug,_ in PAINTERS],columns=6)
    print('Saved 36 original 32x32 RGBA icons, assets.json and full review sheets; pilot art unchanged.')


if __name__ == '__main__':
    main()
