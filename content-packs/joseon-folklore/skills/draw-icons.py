"""Original native 32px icons; only integer geometry. Pillow, no generated art API.
Run from repo root: python3 content-packs/joseon-folklore/skills/draw-icons.py
Existing FX evidence samples source PNGs, preserving their pixel grids.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('content-packs/joseon-folklore/skills')
STEERING = Path('/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/steering.md')
print(STEERING.read_text().strip())
(ROOT / 'icons').mkdir(parents=True, exist_ok=True)
(ROOT / 'review').mkdir(exist_ok=True)
C = dict(ink='#242335', dark='#41364c', steel='#718b96', silver='#abc6cf', white='#eef1d5', gold='#e5b95b', ochre='#a87839', brown='#6a493a', tan='#af7950', straw='#d6b776', paper='#f1dba0', red='#ad4146', flame='#ea7839', yellow='#ffd570', green='#79b777', deepgreen='#3e775e', cyan='#70cdd0', blue='#4b83af', purple='#9c7ab8')
art = json.loads((ROOT / 'art.json').read_text())

def new():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)

def poly(d, pts, fill, edge='ink'):
    d.polygon(pts, fill=C[fill])
    if edge:
        d.line(pts + [pts[0]], fill=C[edge], width=1)

def rect(d, box, fill, edge=None):
    d.rectangle(box, fill=C[fill], outline=C[edge] if edge else None)

def star(d, x, y, color='white'):
    d.line([(x-2,y),(x+2,y)], fill=C[color]); d.line([(x,y-2),(x,y+2)], fill=C[color])

def blade(d, ox=0, oy=0, fill='silver'):
    poly(d, [(7+ox,22+oy),(22+ox,5+oy),(25+ox,4+oy),(24+ox,8+oy),(10+ox,25+oy)], fill)
    d.line([(10+ox,22+oy),(23+ox,6+oy)], fill=C['white'])
    poly(d, [(5+ox,20+oy),(13+ox,25+oy),(12+ox,27+oy),(4+ox,22+oy)], 'gold')
    poly(d, [(5+ox,23+oy),(8+ox,25+oy),(4+ox,29+oy),(2+ox,27+oy)], 'brown')

def paper(d):
    poly(d, [(9,3),(21,3),(23,6),(22,26),(10,28),(8,25)], 'paper')
    d.line([(11,5),(19,5)], fill=C['ochre'])
    d.line([(10,25),(20,23)], fill=C['ochre'])
    poly(d, [(21,3),(21,7),(24,6)], 'straw')

def make(slug):
    im,d = new()
    if slug == 'cleaving-strike':
        poly(d, [(12,2),(20,2),(28,9),(29,16),(26,24),(23,27),(25,19),(25,11),(20,6)], 'cyan', None)
        blade(d)
        star(d, 27, 4, 'yellow')
    elif slug == 'iron-breath':
        poly(d, [(12,5),(19,5),(23,8),(27,9),(26,16),(23,16),(23,26),(8,26),(8,16),(5,16),(4,9),(9,8)], 'steel')
        poly(d, [(12,5),(19,5),(17,10),(14,10)], 'dark')
        rect(d,(10,13,21,15),'silver');rect(d,(10,18,21,20),'silver')
        rect(d,(9,23,22,25),'dark');rect(d,(14,23,17,25),'gold')
        d.line([(5,4),(8,2),(10,3)], fill=C['white']);d.line([(23,3),(26,2),(28,4)], fill=C['white'])
    elif slug == 'double-stab':
        poly(d, [(7,2),(12,14),(10,19),(7,17),(5,13)], 'silver')
        rect(d,(4,18,13,20),'gold','ink');rect(d,(7,21,10,28),'brown','ink')
        poly(d, [(24,2),(27,13),(25,17),(22,19),(20,14)], 'silver')
        rect(d,(19,18,28,20),'gold','ink');rect(d,(22,21,25,28),'brown','ink')
        d.line([(7,5),(8,14)],fill=C['white']);d.line([(24,5),(23,14)],fill=C['white'])
        star(d,16,9,'cyan')
    elif slug == 'venom-edge':
        blade(d,fill='green')
        d.line([(12,18),(21,8)],fill=C['yellow'])
        poly(d,[(22,18),(25,22),(25,25),(22,27),(20,24),(20,22)],'deepgreen')
        rect(d,(22,22,23,24),'green');rect(d,(26,13,27,15),'green')
    elif slug == 'ember-charm':
        paper(d)
        poly(d,[(11,21),(9,17),(13,12),(14,7),(18,12),(20,10),(22,17),(19,22),(15,24)],'red')
        poly(d,[(13,19),(13,15),(16,11),(18,16),(19,18),(17,22),(15,22)],'flame',None)
        poly(d,[(15,19),(16,15),(18,20),(16,22)],'yellow',None)
        rect(d,(25,8,26,10),'flame');rect(d,(5,17,6,19),'flame')
    elif slug == 'frost-charm':
        paper(d)
        for ends in [[(10,16),(21,16)],[(16,9),(16,23)],[(11,10),(21,22)],[(11,22),(21,10)]]:
            d.line(ends,fill=C['blue'],width=2)
        for x,y in [(12,11),(20,11),(12,21),(20,21)]:
            d.point((x,y),fill=C['cyan'])
        rect(d,(15,14,17,18),'white');star(d,26,6,'cyan');star(d,4,24,'cyan')
    elif slug == 'life-water':
        poly(d,[(13,3),(19,3),(20,6),(19,10),(22,14),(24,20),(23,25),(20,28),(10,28),(7,24),(7,19),(10,14),(13,10),(12,6)],'ochre')
        rect(d,(13,2,19,4),'brown','ink');rect(d,(12,9,20,11),'red','ink')
        poly(d,[(12,15),(10,20),(11,24),(14,26),(19,25),(21,22),(20,17)],'gold',None)
        poly(d,[(17,15),(20,20),(19,23),(17,24),(15,22),(15,20)],'blue')
        rect(d,(16,20,17,22),'cyan');star(d,26,9,'cyan')
    elif slug == 'purify':
        paper(d)
        d.line([(11,10),(18,10),(18,14),(12,14),(12,19),(19,19)],fill=C['red'],width=2)
        poly(d,[(3,21),(7,17),(11,17),(9,20),(6,23),(7,26),(15,27),(21,25),(24,21),(26,18),(28,19),(27,24),(23,28),(16,30),(7,29),(3,25)],'cyan',None)
        star(d,25,8,'white');star(d,5,10,'white')
    elif slug == 'tusk-charge':
        poly(d,[(6,10),(4,4),(11,7),(17,6),(25,8),(28,14),(27,23),(21,28),(10,27),(5,21)],'brown')
        poly(d,[(9,10),(14,8),(24,10),(26,16),(22,19),(11,17)],'tan',None)
        rect(d,(18,12,20,13),'red');rect(d,(20,19,27,24),'dark','ink')
        rect(d,(25,20,25,21),'tan');rect(d,(22,21,22,22),'tan')
        poly(d,[(17,22),(18,26),(21,26),(22,22),(20,24)],'white')
        poly(d,[(26,18),(29,16),(28,22),(26,24)],'paper')
        d.line([(2,13),(5,15)],fill=C['ochre']);d.line([(1,19),(4,20)],fill=C['ochre'])
    elif slug == 'straw-club':
        poly(d,[(20,2),(27,5),(27,12),(23,18),(19,19),(9,28),(6,28),(5,25),(15,15),(15,9)],'ochre')
        poly(d,[(20,4),(25,6),(25,11),(21,16),(18,15),(17,10)],'straw',None)
        d.line([(20,5),(18,12)],fill=C['paper']);d.line([(24,7),(22,14)],fill=C['paper'])
        d.line([(16,10),(25,14)],fill=C['brown'],width=2)
        d.line([(18,5),(27,9)],fill=C['red'],width=2)
        d.line([(7,24),(10,27)],fill=C['tan'])
        star(d,6,9,'gold')
    elif slug == 'sorrow-cry':
        poly(d,[(11,3),(20,3),(24,7),(26,15),(25,23),(27,28),(22,27),(18,30),(11,28),(5,29),(7,22),(6,13),(8,6)],'dark')
        poly(d,[(11,7),(20,7),(22,11),(21,20),(18,24),(12,22),(10,15)],'silver')
        poly(d,[(10,5),(18,4),(21,7),(12,11),(10,17),(8,22)],'ink',None)
        rect(d,(13,13,14,14),'ink');rect(d,(19,13,20,14),'ink')
        poly(d,[(15,16),(18,16),(19,20),(17,22),(15,21)],'ink')
        d.line([(12,16),(12,19)],fill=C['cyan']);d.line([(21,16),(21,19)],fill=C['cyan'])
        d.line([(3,11),(1,14),(2,19)],fill=C['purple']);d.line([(28,11),(30,14),(29,19)],fill=C['purple'])
    elif slug == 'bronze-smash':
        poly(d,[(3,21),(10,14),(16,20),(9,28),(5,29)],'brown')
        d.line([(5,24),(12,17)],fill=C['tan'])
        poly(d,[(12,3),(23,3),(28,8),(28,15),(21,21),(12,19),(7,13),(7,8)],'ochre')
        poly(d,[(13,5),(23,5),(25,8),(25,14),(20,18),(13,16),(10,12),(10,8)],'gold')
        poly(d,[(16,8),(21,8),(22,11),(20,14),(16,13),(14,10)],'ochre')
        rect(d,(16,9,18,10),'paper');d.line([(10,8),(12,6),(21,6)],fill=C['yellow'])
        star(d,28,24,'yellow');d.line([(24,27),(27,30)],fill=C['flame'])
    else:
        raise ValueError(slug)
    return im

hashes = []
native = Image.new('RGBA',(4*32,3*32))
sheet = Image.new('RGB',(4*176,3*174),(29,29,43))
sd = ImageDraw.Draw(sheet)
font = ImageFont.load_default()
for i,a in enumerate(art):
    slug = Path(a['sourcePath']).stem
    im = make(slug)
    assert im.mode == 'RGBA' and im.size == (32,32) and im.getbbox()
    assert set(im.getchannel('A').tobytes()) == {0,255}
    path = ROOT/'icons'/f'{slug}.png'
    im.save(path)
    native.paste(im,((i%4)*32,(i//4)*32))
    x,y = (i%4)*176,(i//4)*174
    # Transparent image inspected on checkerboard at exactly 4x native.
    for cy in range(0,128,16):
        for cx in range(0,128,16):
            color = (48,48,60) if (cx//16+cy//16)%2 else (37,37,49)
            sd.rectangle((x+24+cx,y+8+cy,x+39+cx,y+23+cy), fill=color)
    sheet.paste(im.resize((128,128),Image.Resampling.NEAREST),(x+24,y+8),im.resize((128,128),Image.Resampling.NEAREST))
    sd.text((x+8,y+140),f'{i+1:02} {slug}',fill=(225,222,201),font=font)
    hashes.append({'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[32,32], 'author':'GPT 6.1 sol high, original integer pixel geometry in draw-icons.py','paletteColors':len(im.getcolors()),'checks':{'rgba':True,'transparentAlphaValues':[0,255],'nonempty':True}})
native.save(ROOT/'review/icons-native.png');sheet.save(ROOT/'review/icons-4x.png')

# Reference contact sheets: each borrowed original layer is shown on its own,
# without pretending that this is a runtime recording or a new effect asset.
ch = json.loads((ROOT/'choreography-sources.json').read_text())
for kind in ['class','monster']:
    layers = [(c['skillId'],l) for c in ch if c['kind']==kind for l in c['layers']]
    fx = Image.new('RGB',(576, len(layers)*176),(29,29,43)); fd=ImageDraw.Draw(fx)
    for row,(skill,l) in enumerate(layers):
        orig = Image.open(l['path']).convert('RGBA')
        f = l['frame']; n = l['frames']
        assert orig.width >= f*n and orig.height >= f, (l['path'],orig.size,f,n)
        fd.text((8,row*176+3),f"{skill.replace('skill_jf_', '')}: {l['key']} [{l['anchor']}]",font=font,fill=(223,224,206))
        # 128px cells are shown at 1x; 32/64px cells at 2x/1x.
        for col,index in enumerate([max(0,n//4-1),n//2,n-2]):
            snap=orig.crop((index*f,0,(index+1)*f,f))
            if f==32:
                snap=snap.resize((64,64),Image.Resampling.NEAREST)
            fx.paste(snap,(24+col*184,row*176+24),snap)
            fd.text((24+col*184,row*176+156),f'f{index+1}/{n}',font=font,fill=(178,183,180))
    fx.save(ROOT/'review'/f'borrowed-fx-{kind}.png')
    # Native source frames (no reduction); original sheet paths/hashes in manifest.
    fxn=Image.new('RGBA',(3*128,len(layers)*144))
    for row,(_,l) in enumerate(layers):
        orig=Image.open(l['path']).convert('RGBA');f=l['frame'];n=l['frames']
        for col,index in enumerate([max(0,n//4-1),n//2,n-2]):
            snap=orig.crop((index*f,0,(index+1)*f,f))
            fxn.paste(snap,(col*128,row*144))
    fxn.save(ROOT/'review'/f'borrowed-fx-{kind}-native.png')
(ROOT/'art-hashes.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+'\n')
print(f'Saved {len(art)} original transparent icons and native/nearest FX reference sheets.')
