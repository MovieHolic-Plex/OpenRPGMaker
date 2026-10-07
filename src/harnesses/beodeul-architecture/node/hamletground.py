"""Append common hamlet terrain, preserving the 304 existing ground slots."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,math
ROOT=Path(__file__).resolve().parents[4]; OUT=ROOT/'public/assets/beodeul-ground'; DATA=ROOT/'tiledata/beodeul-ground'
m=json.loads((DATA/'manifest.json').read_text()); sheet=Image.open(OUT/'chipset.png').convert('RGBA')
assert m['count']==304
cells=[sheet.crop((n%8*16,n//8*16,n%8*16+16,n//8*16+16)) for n in range(304)]; oldhash=hashlib.sha256(sheet.tobytes()).hexdigest()
atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
def native(n):return atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16))
grass=native(737); stone=native(3221)
def emit(name,im,layer=1,**meta):
 rows=[]
 for y in range(im.height//16):
  row=[]
  for x in range(im.width//16):
   row.append(len(cells));cells.append(im.crop((x*16,y*16,x*16+16,y*16+16)))
  rows.append(row)
 r=dict(id='bdg-hamlet-'+name,name='마을 지면 · '+name,width=im.width//16,height=im.height//16,layer=layer,rows=rows,blocked=False,hamlet=True,**meta)
 m['recipes'].append(r); im.save(OUT/('hamlet-'+name+'.png'))
# N/E/S/W bits 1/2/4/8. No painted curb. Pixel transitions follow neighboring material cells.
for kind in ['soil','stone','meadow']:
 for mask in range(16):
  im=grass.copy()
  for y in range(16):
   for x in range(16):
    distances=[v for bit,v in [(1,y+.5),(2,15.5-x),(4,15.5-y),(8,x+.5)] if not mask&bit]
    d=min(distances,default=20)
    # Two missing adjacent neighbors produce a rounded corner rather than a square clipped tile.
    for a,b,xx,yy in [(1,8,x+.5,y+.5),(1,2,15.5-x,y+.5),(4,8,x+.5,15.5-y),(4,2,15.5-x,15.5-y)]:
     if not mask&a and not mask&b and xx<5 and yy<5:d=min(d,math.hypot(xx-5,yy-5)*-1+5.4)
    noise=((x//2*7+y//2*11)%7-3)*.22
    w=max(0,min(1,(d-1+noise)/3.4))
    r,g,b,a=grass.getpixel((x,y)); v=(((x//2*73856093 ^ y//2*19349663 ^ 9137)*83492791)%7-3)*2
    color={'soil':(151+v,137+v,83+v),'meadow':(r*.90,g*.94,b*.88),'stone':stone.getpixel((x,y))[:3]}[kind]
    if kind=='stone':color=tuple(c*.84+t*.16 for c,t in zip(color,(135,139,103)))
    if kind=='meadow':w*=.85
    if kind=='soil':w*=.82
    im.putpixel((x,y),tuple(round(c*(1-w)+t*w) for c,t in zip((r,g,b),color))+(255,))
  emit(kind+'-'+str(mask),im,kind=kind,mask=mask)
# Small irregular stones in worn soil, for a doorstep or infrequently used approach.
for j in range(4):
 im=grass.copy();d=ImageDraw.Draw(im)
 for box in [[(1,4,7,9),(9,10,15,14)],[(3,1,10,6),(8,9,14,13)],[(1,8,7,13),(9,2,15,7)],[(3,4,11,10)]][j]:
  x0,y0,x1,y1=box;d.polygon([(x0+1,y0),(x1-1,y0),(x1,y0+2),(x1-1,y1),(x0,y1-1),(x0,y0+2)],fill=(139,139,111,255));d.line((x0+1,y0,x1-2,y0),fill=(175,171,137,255));d.line((x0+1,y1,x1-2,y1),fill=(102,114,81,255))
 emit('steps-'+str(j),im,kind='steps',variant=j)
# A modest vegetable bed, three furrows and clustered green leaves. Ground overlay, all passable.
im=Image.new('RGBA',(48,32));d=ImageDraw.Draw(im)
d.polygon([(4,3),(43,2),(47,24),(41,29),(3,28),(0,8)],fill=(130,106,65,190))
for yy in [7,15,23]:
 d.line((3,yy+2,44,yy+2),fill=(91,87,50,210))
 for xx in [8,19,31,41]:
  d.rectangle((xx-3,yy,xx+2,yy+2),fill=(54,103,43,255));d.rectangle((xx-1,yy-2,xx+1,yy+1),fill=(100,148,54,255));d.point((xx,yy-2),fill=(147,177,76,255))
emit('vegetable-bed',im,layer=2,kind='vegetable-bed')
m['count']=(len(cells)+7)//8*8;result=Image.new('RGBA',(128,m['count']//8*16))
for n,c in enumerate(cells):result.paste(c,(n%8*16,n//8*16))
assert hashlib.sha256(result.crop((0,0,128,sheet.height)).tobytes()).hexdigest()==oldhash
result.save(OUT/'chipset.png');result.resize((512,result.height*4),Image.Resampling.NEAREST).save(OUT/'atlas.png')
for p in [DATA/'manifest.json',ROOT/'src/assets/beodeulGroundCatalog.json']:p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(DATA/'hamlet-inspection.json').write_text(json.dumps(dict(original304Hash=oldhash,original304Unchanged=True,sourceSlots=m['count']),indent=2)+'\n')
print(dict(hamletRecipes=53,count=m['count'],original304Unchanged=True))

# Actual assembly error: an interior tile at the grass-facing northwest corner removes its transition.
normal=Image.new('RGBA',(80,80));broken=Image.new('RGBA',(80,80))
for im in [normal,broken]:
 for yy in range(0,80,16):
  for xx in range(0,80,16):im.paste(grass,(xx,yy))
for yy,row in enumerate([[6,14,12],[7,15,13],[3,11,9]]):
 for xx,mask in enumerate(row):
  tile=Image.open(OUT/('hamlet-soil-'+str(mask)+'.png'))
  normal.paste(tile,(16+xx*16,16+yy*16));broken.paste(tile,(16+xx*16,16+yy*16))
broken.paste(Image.open(OUT/'hamlet-soil-15.png'),(16,16))
assert normal.crop((16,16,32,32)).tobytes()!=broken.crop((16,16,32,32)).tobytes()
board=Image.new('RGBA',(168,80));board.paste(normal,(0,0));board.paste(broken,(88,0));board.resize((672,320),Image.Resampling.NEAREST).save(OUT/'hamlet-normal-error.png')
(DATA/'hamlet-errors.json').write_text(json.dumps([dict(code='grass-transition-missing',exampleMapCell=[0,0],expectedMask=6,actualMask=15,detected=True)],indent=2)+'\n')
