#!/usr/bin/env python3
"""Native coordinate field cast, extending the campaign's original sprite pipeline.

Original 16px silhouettes in the engine's 24x32 cells; no source-image editing,
tracing, downloaded character pixels, blur or fractional rasterization.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, base64, hashlib

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/emerald-monster/cast'
INK = '#304643'; SKIN = '#e8b790'; LIT = '#f8d9af'; SHADE = '#bc826f'
# role, coat/main, light, shadow, hair, headwear, accessory
CAST = [
    ('traveler', '#409583', '#88cdb0', '#286d67', '#594439', 'cap', 'pack'),
    ('rival', '#8b6eb2', '#baa5d0', '#594d87', '#ae6044', 'band', 'pack'),
    ('professor', '#e6e5d3', '#fff9e0', '#a0b2aa', '#70513b', 'beard', 'coat'),
    ('nurse', '#dc8494', '#f4c8c1', '#a95978', '#7a5142', 'nurse', 'apron'),
    ('merchant', '#549db0', '#95cfca', '#346f87', '#5c4742', 'cap', 'apron'),
    ('mother', '#b77664', '#e0b18c', '#885b64', '#6d5140', 'long', 'dress'),
    ('resident', '#83a873', '#c1d08f', '#517b65', '#74563e', 'short', 'overall'),
    ('gym_leader', '#5b7998', '#a5c4c5', '#405770', '#414c53', 'short', 'jacket'),
    ('company_agent', '#57616b', '#95a6a6', '#394551', '#674742', 'band', 'badge'),
    ('captain', '#739bab', '#d4e0d4', '#426c86', '#97724b', 'captain', 'jacket'),
    ('worker', '#c18d54', '#e5bf79', '#846345', '#694e3d', 'helmet', 'overall'),
    ('explorer', '#b5a775', '#ddd0a0', '#81775b', '#785445', 'brim', 'pack'),
    ('student', '#cf9170', '#efd2a0', '#9c6856', '#644838', 'short', 'pack'),
    ('ranger', '#728f70', '#afc696', '#4a6d60', '#8b6a47', 'band', 'jacket'),
    ('moon_leader', '#a081ad', '#d2b9cf', '#705d89', '#615079', 'long', 'dress'),
    ('hiker', '#958066', '#c5b799', '#666658', '#70513a', 'beard', 'pack'),
]

def frame(spec, direction, pose):
    role, main, light, dark, hair, hat, accessory = spec
    im = Image.new('RGBA', (24,32)); d=ImageDraw.Draw(im)
    stride = (-1,0,1)[pose]; bob = 0 if pose==1 else -1
    def r(box,c): d.rectangle(box, fill=c)
    def p(points,c): d.polygon(points,fill=c)
    # Shoes and trousers are independently posed, not a shifted whole frame.
    if direction in ('down','up'):
        r((8,25,10,29+stride), '#596966');r((13,25,15,29-stride),'#42524f')
        r((7,29+stride,11,30+stride),INK);r((12,29-stride,16,30-stride),INK)
        r((8,29+stride,10,29+stride),'#a2ac99')
    else:
        r((9+stride,25,11+stride,30), '#5a6966');r((12-stride,25,14-stride,29),'#465652')
        r((8+stride,30,12+stride,31),INK);r((11-stride,29,15-stride,30),INK)
    y=16+bob
    # Jacket shoulders, subtle lit left plane, shadow under sleeves/waist.
    p([(7,y),(16,y),(18,y+3),(16,25),(7,25),(5,y+3)],INK)
    r((7,y+1,16,24),main);r((7,y+1,9,22),light);r((15,y+3,16,24),dark)
    r((8,24,15,25),dark)
    swing = stride if direction != 'up' else -stride
    r((5,y+3+swing,6,y+7+swing),main);r((5,y+7+swing,6,y+8+swing),SKIN)
    r((17,y+3-swing,18,y+7-swing),dark);r((17,y+7-swing,18,y+8-swing),SHADE)
    if accessory=='coat':
        r((8,y+1,9,25),light);r((14,y+1,15,25),light);r((10,y+2,13,22),'#629d83')
        r((8,21,10,21),dark);r((14,21,15,21),dark)
    elif accessory=='apron' and direction!='up':
        p([(9,y+3),(14,y+3),(16,24),(8,24)],'#e4e5d1');r((10,21,14,21),'#a9bcae')
    elif accessory=='dress':
        p([(8,21),(15,21),(17,26),(6,26)],main);r((7,25,16,26),dark)
    elif accessory=='overall':
        r((9,y+1,10,21),dark);r((14,y+1,15,21),dark);r((9,21,15,24),dark)
        r((10,22,11,22),light)
    elif accessory=='badge':
        r((13,y+3,15,y+5),'#d1a55e');r((14,y+3,14,y+3),'#edcf88')
    elif accessory=='jacket':
        r((11,y+1,12,24),dark);r((8,21,9,22),light);r((14,21,15,22),dark)
    # Rounded head with ears; front vs rear anatomy is explicitly drawn.
    hy=4+bob
    p([(8,hy),(15,hy),(17,hy+3),(17,hy+9),(15,hy+12),(8,hy+12),(6,hy+9),(6,hy+3)],INK)
    r((8,hy+1,15,hy+10),SKIN);r((7,hy+4,16,hy+8),SKIN)
    r((8,hy+2,10,hy+7),LIT);r((15,hy+5,16,hy+9),SHADE)
    r((5,hy+6,6,hy+8),SHADE);r((17,hy+6,18,hy+8),SHADE)
    if direction=='up':
        p([(8,hy+1),(15,hy+1),(16,hy+4),(16,hy+10),(14,hy+12),(9,hy+12),(7,hy+9),(7,hy+4)],hair)
        r((8,hy+2,11,hy+3),'#aa8460');r((9,hy+11,14,hy+12),dark)
        if accessory=='pack':
            r((8,y+3,15,24),INK);r((9,y+4,14,23),'#b89861');r((10,y+5,13,y+6),'#d6bd83');r((10,21,13,22),'#80694e')
    elif direction=='down':
        p([(7,hy+4),(7,hy+2),(9,hy),(15,hy),(17,hy+3),(16,hy+5),(13,hy+3),(10,hy+4)],hair)
        r((8,hy+1,11,hy+1),'#af8a5d')
        r((9,hy+7,9,hy+8),INK);r((14,hy+7,14,hy+8),INK)
        r((11,hy+9,12,hy+9),SHADE);r((10,hy+11,13,hy+11),'#996b62')
        if hat=='beard': p([(8,hy+10),(10,hy+9),(14,hy+9),(16,hy+10),(14,hy+12),(10,hy+12)],hair)
    else:
        right=direction=='right'
        # Nose, visible eye and ear change side, keeping light from above-left.
        nx=17 if right else 6; ex=14 if right else 9
        r((nx,hy+8,nx+1,hy+9),SKIN);r((ex,hy+6,ex,hy+8),INK)
        p([(7,hy+3),(8,hy),(15,hy),(17,hy+3),(16,hy+5),(11 if right else 14,hy+4),(9 if right else 16,hy+8),(7,hy+7)],hair)
        r((8,hy+1,11,hy+2),'#a7825b')
        if hat=='beard': r((10,hy+10,15,hy+12),hair)
        if accessory=='pack':
            x=7 if right else 15;r((x,y+3,x+2,23),'#b99860');r((x,y+3,x+1,y+4),'#d9c18c')
    if hat=='long':
        r((6,hy+5,7,y+4),hair);r((16,hy+5,17,y+4),hair)
        if direction=='up':r((7,hy+8,16,y+3),hair)
    if hat in ('cap','helmet','brim','captain','nurse','band'):
        hc=light if hat in ('captain','nurse') else '#d4b878' if hat=='brim' else main
        if hat=='band':
            r((7,hy+3,16,hy+4),hc);r((8,hy+3,11,hy+3),light)
        else:
            p([(7,hy+4),(7,hy+1),(9,hy-1),(14,hy-1),(16,hy+1),(17,hy+4)],INK)
            r((8,hy,15,hy+3),hc);r((9,hy,12,hy),light)
            bx=6 if direction=='left' else 8; bw=11 if direction=='right' else 9
            r((bx,hy+4,min(19,bx+bw),hy+5),dark if hat!='nurse' else '#ac607e')
            if hat=='nurse':r((11,hy+1,12,hy+2),'#d78b96')
            if hat=='helmet':r((11,hy,12,hy+3),light)
    return im

def main():
    OUT.mkdir(parents=True,exist_ok=True); assets={}; receipts=[]
    for sheet_index in range(2):
        sheet=Image.new('RGBA',(288,256)); roles=[]
        for i,spec in enumerate(CAST[sheet_index*8:sheet_index*8+8]):
            roles.append(spec[0]); gx=(i%4)*72; gy=(i//4)*128
            for row,direction in enumerate(('up','right','down','left')):
                for pose in range(3):sheet.alpha_composite(frame(spec,direction,pose),(gx+pose*24,gy+row*32))
        path=OUT/f'field-cast-{sheet_index+1}.png';sheet.save(path,optimize=True);raw=path.read_bytes()
        rid=f'oprn_emerald_field_cast_{sheet_index+1}'
        assets[rid]={'id':rid,'kind':'charset','name':f'비취섬 필드 인물 {sheet_index+1}','dataUrl':'data:image/png;base64,'+base64.b64encode(raw).decode(),'meta':{'width':288,'height':256,'frameWidth':24,'frameHeight':32,'frames':96}}
        receipts.append({'id':rid,'file':path.name,'sha256':hashlib.sha256(raw).hexdigest(),'roles':roles,'nativeCell':[24,32],'silhouetteWidth':16,'frameOrder':['up','right','down','left'],'walkOrder':['leftStep','idle','rightStep'],'alpha':'RGBA transparent','baseline':31,'source':'scripts/content/emerald-field-cast.py'})
    (OUT/'uploaded-cast.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n')
    (OUT/'catalog.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2)+'\n')
    (OUT/'SOURCES.md').write_text('# Original Emerald reference field cast\n\nCC0 1.0 original integer-coordinate pixel art. No Nintendo, RTP or Scarloxy pixels copied. Source: `scripts/content/emerald-field-cast.py`. Sixteen roles, four directions, three real step poses. Native16px silhouette in mandatory24×32 engine cells.\n')
    print(json.dumps({'sheets':len(assets),'characters':len(CAST),'frames':192,'receipt':str(OUT/'catalog.json')}))

if __name__=='__main__':main()
