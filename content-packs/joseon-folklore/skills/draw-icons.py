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
    elif slug == 'whirlwind-cut':
        poly(d,[(4,12),(7,6),(15,3),(24,6),(28,13),(26,20),(20,26),(10,27),(4,23),(10,24),(19,22),(24,16),(23,11),(18,8),(12,8),(8,13)],'cyan',None)
        blade(d,fill='silver');star(d,26,27,'white')
    elif slug == 'earth-split':
        poly(d,[(3,22),(9,15),(23,15),(29,22),(25,28),(7,28)],'brown')
        poly(d,[(3,22),(9,15),(23,15),(29,22)],'tan')
        d.line([(16,16),(13,19),(19,21),(14,25),(17,28)],fill=C['ink'],width=2)
        poly(d,[(14,2),(18,2),(18,9),(22,9),(16,16),(10,9),(14,9)],'silver');star(d,5,14,'gold')
    elif slug == 'blood-oath':
        poly(d,[(8,27),(7,18),(4,12),(6,10),(10,15),(10,7),(12,6),(13,14),(14,4),(16,4),(17,14),(19,6),(21,7),(20,16),(23,12),(25,14),(22,23),(18,28)],'tan')
        poly(d,[(14,15),(17,19),(17,22),(14,24),(12,22),(12,19)],'red')
        d.line([(10,24),(19,25)],fill=C['brown']);star(d,26,5,'red')
    elif slug == 'mountain-guard':
        poly(d,[(2,20),(10,7),(15,15),(21,3),(30,21)],'deepgreen')
        poly(d,[(17,9),(21,3),(25,11),(21,8)],'white',None)
        poly(d,[(9,16),(16,13),(24,16),(23,24),(16,30),(10,24)],'steel')
        poly(d,[(12,18),(16,16),(21,18),(20,23),(16,27),(12,23)],'gold')
        rect(d,(15,18,17,24),'silver')
    elif slug == 'shadow-step':
        for x,y,fill in [(3,5,'dark'),(9,9,'purple'),(16,14,'silver')]:
            poly(d,[(x,y),(x+5,y),(x+8,y+4),(x+7,y+12),(x+4,y+14),(x+1,y+11)],fill)
            d.line([(x+1,y+4),(x+5,y+7),(x+7,y+3)],fill=C['ink'])
        star(d,27,9,'cyan')
    elif slug == 'heart-pierce':
        poly(d,[(6,11),(6,6),(10,3),(15,6),(20,3),(25,7),(25,12),(15,22)],'red')
        poly(d,[(12,25),(23,12),(27,10),(26,15),(16,28)],'silver')
        d.line([(15,25),(25,13)],fill=C['white']);rect(d,(8,25,17,27),'gold','ink')
        poly(d,[(10,27),(13,28),(10,31),(7,29)],'brown');star(d,28,6,'white')
    elif slug == 'smoke-screen':
        poly(d,[(9,21),(23,21),(22,28),(11,28)],'ochre')
        rect(d,(8,20,24,22),'gold','ink')
        for x,y,w,h in [(4,8,10,8),(11,3,10,10),(17,8,10,8),(7,13,15,7)]:
            d.ellipse((x,y,x+w,y+h),fill=C['steel'])
        d.line([(9,10),(14,6),(20,8),(23,12)],fill=C['silver'],width=2)
        rect(d,(14,18,17,20),'dark')
    elif slug == 'moon-slash':
        for ox,oy in [(0,0),(4,8)]:
            poly(d,[(4+ox,11+oy),(9+ox,4+oy),(17+ox,2+oy),(24+ox,6+oy),(18+ox,5+oy),(12+ox,7+oy),(9+ox,13+oy),(12+ox,20+oy),(7+ox,17+oy)],'silver')
            d.line([(6+ox,11+oy),(11+ox,5+oy),(17+ox,4+oy)],fill=C['white'])
        star(d,26,24,'cyan')
    elif slug == 'thunder-charm':
        paper(d)
        poly(d,[(17,6),(11,16),(16,16),(13,24),(22,12),(17,12),(20,6)],'yellow','ochre')
        star(d,4,9,'gold');star(d,27,21,'gold')
    elif slug == 'spirit-drain':
        poly(d,[(19,5),(24,8),(27,16),(25,23),(21,27),(24,21),(24,13),(20,9)],'purple',None)
        poly(d,[(13,7),(17,6),(21,10),(20,16),(17,20),(13,18),(10,15)],'cyan')
        rect(d,(13,11,14,12),'ink');rect(d,(17,10,18,11),'ink')
        poly(d,[(18,19),(10,19),(10,16),(3,22),(10,28),(10,25),(18,25)],'green')
        star(d,6,7,'white')
    elif slug == 'ghost-seal':
        paper(d)
        rect(d,(11,11,20,22),'red','ink');rect(d,(13,14,18,19),'paper')
        d.arc((12,6,19,16),180,360,fill=C['dark'],width=2)
        rect(d,(15,15,16,18),'red');star(d,26,11,'gold')
    elif slug == 'heaven-fire':
        poly(d,[(13,2),(17,2),(19,9),(16,16),(12,9)],'gold')
        poly(d,[(6,4),(8,6),(11,14),(8,20),(4,14)],'flame')
        poly(d,[(23,4),(26,10),(28,17),(25,23),(21,16)],'flame')
        poly(d,[(10,17),(14,10),(18,16),(22,14),(25,22),(21,28),(11,29),(7,24)],'red')
        poly(d,[(12,24),(14,18),(17,23),(19,20),(21,26),(16,28)],'yellow',None)
    elif slug == 'protective-talisman':
        paper(d)
        poly(d,[(10,11),(16,8),(22,11),(21,21),(16,25),(11,21)],'blue')
        poly(d,[(12,12),(16,10),(20,12),(19,20),(16,22),(13,20)],'cyan')
        rect(d,(15,12,17,19),'white');star(d,26,22,'cyan')
    elif slug == 'revive':
        poly(d,[(14,21),(14,10),(10,10),(16,3),(22,10),(18,10),(18,21)],'white')
        poly(d,[(16,29),(7,26),(4,20),(11,22),(16,26),(21,22),(28,20),(25,27)],'green')
        poly(d,[(16,26),(11,23),(10,17),(15,19),(16,23),(20,17),(22,21),(21,25)],'paper')
        star(d,6,8,'gold');star(d,26,8,'gold')
    elif slug == 'spring-rain':
        for x,y in [(5,3),(15,1),(25,4)]:
            poly(d,[(x,y),(x+3,y+5),(x+2,y+8),(x-1,y+8),(x-2,y+5)],'cyan')
        d.line([(16,29),(16,15)],fill=C['deepgreen'],width=2)
        poly(d,[(16,23),(12,17),(6,16),(9,22),(16,26)],'green')
        poly(d,[(16,19),(21,13),(27,13),(24,19),(16,22)],'green')
        d.line([(8,19),(15,24)],fill=C['yellow']);d.line([(18,19),(24,16)],fill=C['yellow'])
    elif slug == 'heaven-blessing':
        for box in [(4,6,13,14),(10,3,21,14),(18,6,28,14)]:
            d.ellipse(box,fill=C['paper'],outline=C['ochre'])
        rect(d,(5,11,27,14),'paper')
        poly(d,[(9,18),(22,18),(22,28),(9,28)],'gold')
        rect(d,(12,20,19,25),'red');rect(d,(14,22,17,23),'paper')
        d.line([(8,17),(6,21)],fill=C['yellow']);d.line([(26,17),(28,21)],fill=C['yellow']);star(d,16,16,'white')
    elif slug == 'poison-bite':
        poly(d,[(3,5),(9,7),(16,5),(24,7),(28,4),(29,14),(26,20),(19,23),(10,22),(4,16)],'deepgreen')
        poly(d,[(6,11),(25,11),(23,18),(16,20),(8,17)],'ink',None)
        poly(d,[(8,9),(13,10),(11,18)],'white');poly(d,[(20,10),(25,9),(22,18)],'white')
        poly(d,[(15,23),(18,27),(16,30),(13,29),(12,26)],'green')
        rect(d,(15,26,16,28),'yellow')
    elif slug == 'wing-flurry':
        poly(d,[(14,15),(9,6),(2,3),(5,9),(3,11),(8,15),(6,19),(12,21),(15,26),(18,21),(25,19),(23,15),(28,11),(26,8),(29,3),(21,6),(17,15)],'dark')
        d.line([(5,6),(10,12),(13,19)],fill=C['purple']);d.line([(25,6),(20,12),(17,19)],fill=C['purple'])
        rect(d,(14,12,17,22),'brown');star(d,5,26,'cyan');star(d,27,25,'cyan')
    elif slug == 'ghost-fire':
        poly(d,[(16,3),(21,10),(25,9),(24,17),(28,21),(24,27),(17,30),(9,28),(5,22),(8,16),(7,10),(12,13)],'deepgreen')
        poly(d,[(16,9),(18,15),(22,15),(21,22),(17,27),(10,24),(11,19)],'green',None)
        poly(d,[(14,17),(18,16),(20,21),(17,25),(13,23)],'yellow',None)
        rect(d,(13,19,14,20),'ink');rect(d,(17,19,18,20),'ink')
    elif slug == 'drowning-hand':
        poly(d,[(9,28),(7,17),(4,9),(6,7),(10,13),(10,4),(12,3),(14,13),(16,2),(18,3),(18,14),(22,5),(24,6),(22,17),(27,12),(29,14),(23,24),(20,29)],'blue')
        d.line([(11,16),(13,23),(18,25),(22,21)],fill=C['cyan'],width=2)
        d.line([(3,28),(8,26),(13,29),(21,28),(27,30)],fill=C['cyan']);star(d,26,5,'white')
    elif slug == 'grave-grasp':
        poly(d,[(3,27),(6,20),(10,18),(10,9),(12,5),(21,5),(24,10),(24,23),(28,27)],'steel')
        poly(d,[(13,8),(20,8),(21,12),(20,21),(13,21)],'dark')
        rect(d,(15,11,18,17),'purple');rect(d,(13,13,20,14),'purple')
        poly(d,[(2,28),(8,25),(16,26),(23,24),(30,28)],'brown');star(d,5,13,'purple')
    elif slug == 'fox-charm':
        poly(d,[(5,3),(13,10),(18,10),(26,3),(25,16),(21,23),(16,27),(10,23),(6,16)],'tan')
        poly(d,[(8,6),(12,12),(8,13)],'dark');poly(d,[(23,6),(19,12),(23,13)],'dark')
        poly(d,[(9,17),(15,20),(22,17),(20,22),(16,25),(11,22)],'paper',None)
        d.line([(9,15),(12,16)],fill=C['purple'],width=2);d.line([(19,16),(22,15)],fill=C['purple'],width=2)
        rect(d,(14,21,17,22),'ink');star(d,3,22,'purple');star(d,28,24,'purple')
    elif slug == 'stone-crush':
        poly(d,[(8,4),(21,3),(28,10),(26,21),(20,27),(8,25),(3,15)],'steel')
        poly(d,[(9,5),(20,5),(24,11),(13,15),(5,13)],'silver',None)
        d.line([(21,6),(15,12),(18,17),(12,22),(14,25)],fill=C['dark'],width=2)
        d.line([(2,27),(6,30),(10,28)],fill=C['ochre']);star(d,28,27,'gold')
    elif slug == 'bamboo-whip':
        poly(d,[(4,28),(7,14),(12,5),(20,3),(27,8),(28,15),(26,20),(24,18),(25,12),(22,8),(16,8),(12,13),(10,21),(8,30)],'green')
        for pts in [[(5,23),(10,24)],[(7,16),(12,18)],[(12,6),(15,10)],[(22,4),(20,8)]]:
            d.line(pts,fill=C['deepgreen'],width=2)
        d.line([(8,27),(10,17),(14,11)],fill=C['yellow'])
        poly(d,[(12,16),(17,15),(14,20)],'deepgreen')
    else:
        raise ValueError(slug)
    return im

hashes = []
columns=6;rows=(len(art)+columns-1)//columns
native = Image.new('RGBA',(columns*32,rows*32))
sheet = Image.new('RGB',(columns*176,rows*174),(29,29,43))
sd = ImageDraw.Draw(sheet)
font = ImageFont.load_default()
for i,a in enumerate(art):
    slug = Path(a['sourcePath']).stem
    im = make(slug)
    assert im.mode == 'RGBA' and im.size == (32,32) and im.getbbox()
    assert set(im.getchannel('A').tobytes()) == {0,255}
    path = ROOT/'icons'/f'{slug}.png'
    im.save(path)
    native.paste(im,((i%columns)*32,(i//columns)*32))
    x,y = (i%columns)*176,(i//columns)*174
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
    for start in range(0,len(layers),6):
        fx.crop((0,start*176,576,min(start+6,len(layers))*176)).save(ROOT/'review'/f'borrowed-fx-{kind}-{start//6+1}.png')
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
