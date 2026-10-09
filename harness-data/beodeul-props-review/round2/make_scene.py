"""Lay the allowed props on a grass map (shadow + blocked-cell panel) — evidence for 'does it place well on tiles'."""
import json,os
from PIL import Image,ImageDraw
R=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.abspath(R+'/../../..');R1=R+'/../round1'
T=16;W,H=40,24
ts=json.load(open(ROOT+'/src/assets/beodeulCityTileset.json'));pas=ts['passability']
kits={k['id']:k for k in ts['structureKits']}
def blocked_mask(src):
    k=kits.get('bd-'+src)
    if not k:return None
    m=[[False]*k['width'] for _ in range(k['height'])]
    for y,r in enumerate(k['rows']):
        for x in range(k['width']):
            for n in (r['tiles'][x],r.get('upperTiles',[-1]*k['width'])[x]):
                if n>=0 and not any(pas[n].values()):m[y][x]=True
    return m
def pic(name):
    for p in (f'{R}/{name}.png',f'{R1}/existing-bd-{name}.png'):
        if os.path.exists(p):return Image.open(p).convert('RGBA')
    raise SystemExit(name)
GRASS=(84,160,52,255)
base=Image.new('RGBA',(W*T,H*T),GRASS)
d=ImageDraw.Draw(base)
import random;random.seed(4)
for _ in range(260):
    x,y=random.randrange(W*T-1),random.randrange(H*T-1);d.point((x,y),(96,176,60,255))
# dirt path
for x in range(0,W):
    for y in (14,15):base.paste((176,138,92,255),(x*T,y*T,x*T+T,y*T+T))
shadow=Image.new('RGBA',base.size,(0,0,0,0));sd=ImageDraw.Draw(shadow)
over=Image.new('RGBA',base.size,(0,0,0,0))
blk=[[False]*W for _ in range(H)]
placed=[]
def put(name,cx,cy,src=None,shift=0):
    """cx,cy = left, bottom row cell (base). name = picture; src = kit for blocked mask"""
    im=pic(name);w,h=im.width//T,im.height//T;x0,y0=cx,cy-h+1
    ex=(x0+0.1)*T,(cy+0.15)*T-3,(x0+w-0.1)*T,(cy+1)*T-1
    sd.ellipse(ex,fill=(20,50,20,110))
    placed.append((im,x0*T,y0*T))
    m=blocked_mask(src or name.replace('out-','out-'))
    if m is None:m=[[False]*w for _ in range(h)];m[-1]=[True]*w
    for yy in range(len(m)):
        for xx in range(len(m[0])):
            if m[yy][xx] and 0<=x0+xx<W and 0<=y0+yy<H:blk[y0+yy][x0+xx]=True
# market row (redrawn stalls)
put('stall_cheese_meat',4,9,'prop-stall_cheese_meat');put('stall_jug_bottle',7,9,'prop-stall_jug_bottle');put('stall_herb_flower',10,9,'prop-stall_herb_flower');put('stall_veg',13,9,'prop-stall_veg')
put('prop-flower_cart',18,9) if False else None
for n,x,y,s in [('prop-flower_cart',18,8,'prop-flower_cart'),('prop-veg_cart',21,8,'prop-veg_cart')]:put(n,x,y,s)
put('prop-well_roofed',28,9,'prop-well_roofed');put('prop-bench_wood',26,11,'prop-bench_wood');put('prop-bench_wood',31,11,'prop-bench_wood')
put('prop-lamp_double',24,13,'prop-lamp_double');put('prop-lamp_crook',34,13,'prop-lamp_crook');put('prop-statue_sage',36,9,'prop-statue_sage')
put('net_rack',3,13,'prop-net_rack');put('laundry_rack',6,13,'prop-laundry_rack');put('cloth_stand',9,13,'prop-cloth_stand');put('anchor_display',12,13,'prop-anchor_display')
put('bread_rack',15,13,'prop-bread_rack');put('sandwich_board',17,13,'prop-sandwich_board')
# harbor corner
for n,x,y in [('prop-crate_fish',2,18),('prop-crate_apple',3,18),('prop-fish_barrel',4,18),('prop-mooring_bollard',6,18),('prop-fish_crates',8,18),('prop-goods_pile',11,19),('prop-sword_barrel',13,18)]:put(n,x,y,n)
put('out-hay-barrels',16,18,'out-hay-barrels');put('out-woodpile',20,19,'out-woodpile');put('out-signpost',23,19,'out-signpost');put('out-hanging-sign',25,19,'out-hanging-sign')
put('prop-table_mugs',27,18,'prop-table_mugs');put('prop-parasol_table',30,18,'prop-parasol_table');put('prop-flowerbed',33,19,'prop-flowerbed');put('prop-planter_round',36,19,'prop-planter_round');put('prop-door_pots',38,19,'prop-door_pots')
# trees
for n,x,y in [('tree-28ad5e',1,6),('tree-c27062',2,6),('tree-eef4bc',0,6),('tree-f4f319',20,4),('tree-37f48b',24,4),('tree-1a786c',29,4),('tree-d43edd',34,5),('tree-03a8f7',8,5),('tree-a80c85',14,5)]:
    put(('tree-'+n[5:]) if False else n,x,y,'tree-'+n[5:])
put('mpart-cypress-tub',38,5,'mpart-cypress-tub');put('gate-wood',19,23) if False else None
# fences: wood yard bottom right + stone low wall
def fence(setname,cells,gate=None):
    sheet=Image.open(f'{R1}/{setname}.png').convert('RGBA');cs=set(cells)
    for (x,y) in cells:
        m=((x,y-1) in cs)*1+((x+1,y) in cs)*2+((x,y+1) in cs)*4+((x-1,y) in cs)*8
        tile=sheet.crop(((m%4)*T,(m//4)*T,(m%4)*T+T,(m//4)*T+T));placed.append((tile,x*T,y*T));blk[y][x]=True
        sd.ellipse((x*T+1,y*T+T-5,x*T+T-1,y*T+T-1),fill=(20,50,20,90))
ring=[(x,22) for x in range(15,32)]+[(x,16) for x in range(15,32)]+[(15,y) for y in range(17,22)]+[(31,y) for y in range(17,22)]
ring=[c for c in ring if c not in [(23,16),(24,16)]]
fence('fence-wood-set',ring)
fence('fence-stone-set',[(x,1) for x in range(0,12)]+[(11,y) for y in range(2,4)])
out=base.copy();out.alpha_composite(shadow)
for im,x,y in placed:out.alpha_composite(im,(x,y))
od=ImageDraw.Draw(over)
for y in range(H):
    for x in range(W):
        if blk[y][x]:od.rectangle((x*T,y*T,x*T+T-1,y*T+T-1),fill=(220,40,40,110),outline=(255,80,80,200))
        else:od.rectangle((x*T,y*T,x*T+T-1,y*T+T-1),outline=(255,255,255,24))
pas_img=out.copy();pas_img.alpha_composite(over)
for nm,im in (('scene',out),('scene-passability',pas_img)):im.resize((im.width*3,im.height*3),Image.NEAREST).save(f'/tmp/props-scene/{nm}.png')
print('ok',len(placed))
