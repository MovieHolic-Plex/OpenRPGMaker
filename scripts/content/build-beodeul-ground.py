"""Shared hand-pixel grounding and lawn decorations. No image generation."""
from pathlib import Path
from PIL import Image, ImageDraw
import random
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/beodeul-ground'
DATA=ROOT/'tiledata/beodeul-ground'
OUT.mkdir(parents=True,exist_ok=True)
DATA.mkdir(parents=True,exist_ok=True)
GREEN=[(53,103,27,255),(75,128,32,255),(107,157,41,255),(148,188,64,255)]
rng=random.Random(1004)

def translucent(im,paint):
    layer=Image.new('RGBA',im.size);paint(ImageDraw.Draw(layer))
    return Image.alpha_composite(im,layer)

def patch(im,cx,cy):
    return translucent(im,lambda d:d.polygon(
        [(cx-14,cy),(cx-10,cy-5),(cx-2,cy-7),(cx+8,cy-5),
         (cx+15,cy),(cx+10,cy+5),(cx+1,cy+6),(cx-10,cy+4)],
        fill=(84,139,34,38)))

def tuft(d,x,y,h=5):
    d.line((x-3,y,x+4,y),fill=GREEN[1])
    for dx,dy,end in [(-3,-h+2,-1),(0,-h,0),(3,-h+1,1)]:
        d.line((x+end,y,x+dx,y+dy),fill=GREEN[1])
        d.line((x+end+1,y-1,x+dx+1,y+dy+1),fill=GREEN[2])
        d.point((x+dx,y+dy),fill=GREEN[3])
    d.point((x,y),fill=GREEN[0])

def flower(d,x,y,color):
    d.line((x,y,x,y-4),fill=GREEN[1])
    d.line((x,y-1,x-2,y-2),fill=GREEN[2])
    d.line((x,y-2,x+2,y-3),fill=GREEN[3])
    for dx,dy in [(-1,-5),(1,-5),(0,-6),(0,-4)]:d.point((x+dx,y+dy),fill=color)
    d.point((x,y-5),fill=(234,194,77,255))
    d.point((x+1,y-4),fill=(143,107,97,255))

def stone(im,x,y,w=7):
    im=translucent(im,lambda d:d.ellipse((x-1,y-1,x+w+2,y+2),fill=(35,58,25,68)))
    d=ImageDraw.Draw(im)
    d.polygon([(x,y),(x+1,y-3),(x+3,y-4),(x+w-2,y-3),(x+w,y-1),
               (x+w-1,y+1),(x+1,y+1)],fill=(104,112,81,255))
    d.line((x+1,y-2,x+w-3,y-3),fill=(168,168,126,255))
    d.line((x+2,y-1,x+w-2,y-1),fill=(137,144,108,255))
    d.line((x+2,y+1,x+w-1,y+1),fill=(66,84,47,255))
    tuft(d,x+w,y+2,3)
    return im

def barrel(im,cx,ground_y):
    im=translucent(im,lambda d:d.ellipse((cx-6,ground_y-1,cx+9,ground_y+3),fill=(34,55,24,75)))
    d=ImageDraw.Draw(im);top=ground_y-14
    d.rounded_rectangle((cx-5,top+2,cx+5,ground_y),radius=2,fill=(88,57,30,255))
    for dx,color in [(-4,(122,80,41,255)),(-2,(153,106,52,255)),(0,(127,81,38,255)),(2,(107,67,31,255))]:
        d.line((cx+dx,top+4,cx+dx,ground_y-1),fill=color)
    d.ellipse((cx-5,top,cx+5,top+4),fill=(72,53,32,255))
    d.arc((cx-5,top,cx+5,top+4),180,360,fill=(177,132,72,255))
    d.line((cx-3,top+2,cx+3,top+2),fill=(119,83,43,255))
    for yy in [top+6,ground_y-3]:
        d.line((cx-5,yy,cx+5,yy),fill=(56,61,47,255))
        d.line((cx-4,yy-1,cx+4,yy-1),fill=(126,126,90,255))
    return im

def firewood(im,x,y):
    im=translucent(im,lambda d:d.ellipse((x-2,y-1,x+18,y+2),fill=(37,57,25,64)))
    d=ImageDraw.Draw(im)
    for dx,dy in [(0,0),(7,0),(3,-3)]:
        d.rectangle((x+dx,y+dy-3,x+dx+8,y+dy),fill=(86,53,27,255))
        d.line((x+dx+1,y+dy-3,x+dx+7,y+dy-3),fill=(136,91,44,255))
        d.ellipse((x+dx+6,y+dy-3,x+dx+9,y+dy),fill=(169,125,66,255))
        d.point((x+dx+7,y+dy-1),fill=(91,63,33,255))
    return im

recipes=[]
cells=[]
def emit(id,name,im,layer=4,blocked=False):
    width,height=im.width//16,im.height//16
    rows=[]
    for y in range(height):
        row=[]
        for x in range(width):
            cell=im.crop((x*16,y*16,x*16+16,y*16+16))
            if cell.getbbox():row.append(len(cells));cells.append(cell)
            else:row.append(-1)
        rows.append(row)
    recipes.append(dict(id='bdg-'+id,name=name,width=width,height=height,layer=layer,rows=rows,
                        blocked=blocked))
    im.save(OUT/(id+'.png'))

for variant in range(3):
    im=patch(Image.new('RGBA',(32,16)),16,9)
    d=ImageDraw.Draw(im)
    for dx,dy,h in [(-7,1,4),(-1,-2,6),(5,2,5),(10,-2,3)]:
        tuft(d,16+dx+rng.randrange(-1,2),9+dy+rng.randrange(-1,2),h+rng.randrange(2))
    emit('grass-'+str(variant),'풀 무더기 '+str(variant+1),im)
for key,color in [('pink',(232,168,185,255)),('white',(213,224,189,255)),('blue',(139,185,220,255))]:
    im=patch(Image.new('RGBA',(32,16)),16,10);d=ImageDraw.Draw(im)
    for x,y in [(8,12),(15,14),(24,11)]:flower(d,x,y,color)
    emit('flowers-'+key,'작은 꽃 군락 '+key,im)
im=stone(Image.new('RGBA',(16,16)),3,10,6)
emit('stones','잔돌과 풀',im)
im=Image.new('RGBA',(32,16));d=ImageDraw.Draw(im)
for x,y in [(4,8),(12,12),(24,6),(20,13)]:
    d.line((x,y,x+2,y-1),fill=(132,140,51,255));d.point((x+1,y),fill=(91,108,37,255))
emit('litter','나무 아래 낙엽',im,2)

im=Image.new('RGBA',(48,16));cx,cy=24,8
im=translucent(im,lambda d:(d.ellipse((cx-12,cy-2,cx+18,cy+5),fill=(31,57,22,34)),
                           d.ellipse((cx-6,cy-1,cx+8,cy+2),fill=(29,48,20,86))))
t=ImageDraw.Draw(im)
t.polygon([(cx-2,0),(cx+2,0),(cx+2,cy-3),(cx+8,cy-1),(cx+10,cy),(cx+7,cy+1),
           (cx+3,cy-1),(cx+1,cy+2),(cx-2,cy+1),(cx-3,cy-1),(cx-7,cy+1),
           (cx-10,cy),(cx-6,cy-3),(cx-4,0)],fill=(78,61,34,255))
t.polygon([(cx-2,0),(cx,0),(cx,cy-5),(cx-2,cy-3),(cx-5,cy-1),
           (cx-6,cy-1),(cx-3,cy-5)],fill=(133,98,52,255))
t.line((cx+2,cy-5,cx+6,cy-1),fill=(114,85,43,255))
t.line((cx-1,cy-4,cx,cy),fill=(155,117,61,255))
for dx in [-9,-5,4,9]:tuft(t,cx+dx,cy+2,2)
emit('roots','3×3 수관 아래 퍼지는 밑동',im)

im=Image.new('RGBA',(48,16));cx,cy=24,13
im=translucent(im,lambda d:(d.ellipse((cx-12,cy-2,cx+18,cy+3),fill=(31,57,22,34)),
                           d.ellipse((cx-6,cy-1,cx+8,cy+2),fill=(29,48,20,86))))
emit('root-shadow','기존 뿌리 아래 접지 그림자',im,2)

# Thin contact strip for h101_0 only. The entire door column stays transparent.
im=Image.new('RGBA',(112,32));d=ImageDraw.Draw(im)
warm=[(120,99,66,255),(110,91,59,255),(133,112,74,255),(106,91,58,255)]
for x in range(1,80):
    if not 32<=x<48:d.point((x,15),fill=warm[(x//4)%4])
for x in [2,9,17,24,30,50,60,75,89,109]:tuft(d,x,17,2)
im=translucent(im,lambda d:d.line((1,18,111,18),fill=(124,105,53,55)))
im.paste((0,0,0,0),(32,0,48,32))
emit('foundation','h101_0 얇은 기초·풀 경계',im)

im=Image.new('RGBA',(32,16));im=translucent(im,lambda d:d.polygon(
    [(1,12),(4,6),(15,4),(27,7),(29,12),(20,15),(7,15)],fill=(131,106,52,95)))
d=ImageDraw.Draw(im)
for x,y in [(4,13),(15,15),(25,13)]:tuft(d,x,y,4)
for x,y,c in [(6,12,(217,226,183,255)),(12,10,(232,167,181,255)),
              (19,13,(217,226,183,255)),(25,11,(232,167,181,255))]:flower(d,x,y,c)
emit('flowerbed','집 앞 작은 화단',im)
emit('barrel','집 곁 작은 통',barrel(Image.new('RGBA',(16,32)),7,26),blocked=True)
emit('firewood','집 곁 장작',firewood(Image.new('RGBA',(32,16)),4,11),blocked=True)
im=Image.new('RGBA',(32,16));im=translucent(im,lambda d:d.polygon(
    [(2,6),(7,2),(20,3),(29,8),(25,14),(11,13),(1,10)],fill=(148,123,62,95)))
emit('worn-soil','밟힌 흙',im,2)

# Append after the original 41 cells: bridge the crown/roots seam without renumbering shipped art.
im=Image.new('RGBA',(48,16));d=ImageDraw.Draw(im)
d.polygon([(20,9),(24,8),(26,10),(27,15),(20,15),(21,12)],fill=(78,61,34,255))
d.polygon([(21,10),(23,9),(24,10),(23,15),(21,15)],fill=(133,98,52,255))
d.line((24,11,25,15),fill=(105,78,39,255))
# Leaves sit in front of the upper bark, so the trunk emerges from the crown.
for x,y in [(19,9),(22,8),(25,8),(27,10)]:
    d.line((x,y,x+2,y+1),fill=(44,92,24,255));d.point((x,y),fill=(89,137,38,255))
emit('tree-neck','수관 안쪽에서 이어지는 줄기',im)

# Preserve all original 48 slots, including blank padding, before extending foundations.
while len(cells)<48:cells.append(Image.new('RGBA',(16,16)))
profiles={
    'h104_0':(7,[(0,6,0)],2),
    'h107_0':(6,[(0,5,0)],3),
    'h112_0':(4,[(0,3,0)],2),
    'h109_1':(8,[(3,7,0),(0,2,2)],1),
    'cathedral':(12,[(0,11,0)],7),
}
for key,(width,segments,doorcol) in profiles.items():
    height=max(row for _,_,row in segments)+2
    im=Image.new('RGBA',(width*16,height*16));d=ImageDraw.Draw(im)
    for left,right,row in segments:
        for x in range(left*16+1,(right+1)*16-1):
            if row==height-2 and doorcol*16<=x<(doorcol+1)*16:continue
            d.line((x,row*16+14,x,row*16+15),fill=warm[(x//4)%4])
        for x in range(left*16+3,(right+1)*16-2,11):
            if row==height-2 and doorcol*16<=x<(doorcol+1)*16:continue
            tuft(d,x,row*16+17,2)
    im.paste((0,0,0,0),(doorcol*16,(height-2)*16,(doorcol+1)*16,height*16))
    emit('foundation-'+key,key+' 전용 기초·풀 경계',im)

count=(len(cells)+7)//8*8
sheet=Image.new('RGBA',(128,count//8*16))
for i,cell in enumerate(cells):sheet.paste(cell,(i%8*16,i//8*16))
sheet.save(OUT/'chipset.png')
sheet.resize((512,sheet.height*4),Image.Resampling.NEAREST).save(OUT/'atlas.png')
manifest=dict(id='beodeul_ground',texture='tex_beodeul_ground',tileSize=16,tilesPerRow=8,count=count,recipes=recipes)
(DATA/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/assets/beodeulGroundCatalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
assert im.getbbox() is not None
assert Image.open(OUT/'foundation.png').crop((32,0,48,32)).getbbox() is None
city=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text())
kit=next(k for k in city['structureKits'] if k['id']=='bd-tree-03a8f7')
atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
example=Image.new('RGBA',(48,64))
grass=atlas.crop((737%128*16,737//128*16,737%128*16+16,737//128*16+16))
for y in range(4):
    for x in range(3):example.paste(grass,(x*16,y*16))
for y,row in enumerate(kit['rows']):
    for x,n in enumerate(row['upperTiles']):
        example.alpha_composite(atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16)),(x*16,y*16))
wrong=example.copy()
example.alpha_composite(Image.open(OUT/'tree-neck.png'),(0,32))
example.alpha_composite(Image.open(OUT/'roots.png'),(0,48))
example.save(OUT/'example-native.png')
comparison=Image.new('RGBA',(104,64),(0,0,0,0))
comparison.paste(example,(0,0));comparison.paste(wrong,(56,0))
comparison.resize((624,384),Image.Resampling.NEAREST).save(OUT/'normal-error.png')
roots=next(r for r in recipes if r['id']=='bdg-roots')
neck=next(r for r in recipes if r['id']=='bdg-tree-neck')
expected=dict(width=3,height=4,lowerTiles=[737]*12,
              lowerOverlayTiles=[-1]*12,upperTiles=[n for row in kit['rows'] for n in row['upperTiles']]+[-1]*3,
              upperOverlayTiles=[-1]*6+[city['count']+n if n>=0 else -1 for n in neck['rows'][0]]+[city['count']+n if n>=0 else -1 for n in roots['rows'][0]],
              tileGrafts=[dict(targetTile=city['count']+n,sourceChipset=manifest['texture'],sourceTile=n)
                          for n in roots['rows'][0]+neck['rows'][0] if n>=0],
              errors=[dict(code='missing-root',x=1,y=3)])
# Alter a real assembled row, then diagnose the missing root at its actual map cell.
def validate_example(l4):
    return ([dict(code='missing-root',x=1,y=3)]
            if l4[10] != city['count']+roots['rows'][0][1] else [])
assert not validate_example(expected['upperOverlayTiles'])
wrong_l4=expected['upperOverlayTiles'][:]
wrong_l4[9:12]=[-1]*3
assert validate_example(wrong_l4)==expected['errors']
assert example.crop((16,48,32,64)).tobytes()!=wrong.crop((16,48,32,64)).tobytes()
(DATA/'example.json').write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(count=count,recipes=len(recipes),sheetSize=sheet.size,doorColumnUntouched=True)))

