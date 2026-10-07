"""Compose depth from native trees; append common groves, undergrowth and connected fencing."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,random
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'public/assets/beodeul-ground';DATA=ROOT/'tiledata/beodeul-ground'
m=json.loads((DATA/'manifest.json').read_text());sheet=Image.open(OUT/'chipset.png').convert('RGBA');assert m['count']==368
cells=[sheet.crop((n%8*16,n//8*16,n%8*16+16,n//8*16+16)) for n in range(368)]
oldhash=hashlib.sha256(sheet.tobytes()).hexdigest()
city=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text());kits={k['id']:k for k in city['structureKits']}
atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
def original(id):
 k=kits['bd-tree-'+id];im=Image.new('RGBA',(k['width']*16,(k['height']+1)*16))
 for y,r in enumerate(k['rows']):
  for x,n in enumerate(r['upperTiles']):
   if n>=0:im.alpha_composite(atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16)),(x*16,y*16))
 if k['height']==3:
  im.alpha_composite(Image.open(OUT/'tree-neck.png').convert('RGBA'),(0,32))
  im.alpha_composite(Image.open(OUT/'roots.png').convert('RGBA'),(0,48))
 return im,k
def emit(name,im,layer,blocked=(),**meta):
 rows=[];upper=[]
 for y in range(im.height//16):
  row=[]
  for x in range(im.width//16):
   tile=im.crop((x*16,y*16,x*16+16,y*16+16))
   if tile.getbbox():row.append(len(cells));cells.append(tile)
   else:row.append(-1)
   if layer in (3,4) and (x,y) not in blocked:upper.append([x,y])
  rows.append(row)
 r=dict(id='bdg-woodland-'+name,name='숲 깊이 · '+name,width=im.width//16,height=im.height//16,layer=layer,rows=rows,blocked=False,woodland=True,blockingCells=[list(p) for p in blocked],upperCells=upper,**meta)
 m['recipes'].append(r);im.save(OUT/('woodland-'+name+'.png'));return r
def grove(name,w,h,trees):
 im=Image.new('RGBA',(w*16,h*16));shadow=Image.new('RGBA',im.size);d=ImageDraw.Draw(shadow);blocked=set();overlap=0;anchors=[]
 # Native sprites overlap by pixels and are ordered by their actual ground contact, not tile rectangle tops.
 ordered=sorted(trees,key=lambda t:t[2]+(3 if t[0]!='1a786c' else 4)*16)
 for id,x,y in ordered:
  sprite,k=original(id);foot=y+k['height']*16-5;cx=x+24
  d.ellipse((cx-17,foot-5,cx+22,foot+8),fill=(30,49,27,65))
  d.ellipse((cx-8,foot-3,cx+12,foot+4),fill=(29,43,23,115))
  assert x>=0 and y>=0 and x+sprite.width<=im.width and y+sprite.height<=im.height,(name,id,x,y)
  for yy in range(sprite.height):
   for xx in range(sprite.width):
    if sprite.getpixel((xx,yy))[3] and im.getpixel((x+xx,y+yy))[3]:overlap+=1
  im.alpha_composite(sprite,(x,y));blocked.add((cx//16,foot//16));anchors.append(dict(kit='bd-tree-'+id,pixelX=x,pixelY=y,foot=[cx,foot]))
 assert overlap>80
 emit(name,im,3,blocked,anchors=anchors,overlapPixels=overlap)
 emit(name+'-shadow',shadow,2,kind='grove-shadow')
grove('north',8,5,[('03a8f7',0,0),('1a786c',32,0),('3e8732',58,13),('03a8f7',80,2)])
grove('north-open',8,5,[('1a786c',0,0),('03a8f7',36,4),('3e8732',70,8)])
grove('west',7,9,[('1a786c',0,0),('03a8f7',35,5),('3e8732',8,40),('1a786c',48,48),('03a8f7',0,78),('3e8732',43,80)])
grove('east',7,8,[('03a8f7',0,0),('1a786c',48,0),('3e8732',21,25),('03a8f7',0,64),('1a786c',54,48)])
for variant in range(2):
 im=Image.new('RGBA',(48,32));d=ImageDraw.Draw(im);rng=random.Random(902+variant)
 # Tall tuft groups have a dark contact mass, shaded stems and directional highlights, rather than dots.
 d.ellipse((2,15,46,29),fill=(35,63,29,60))
 for x,y in [(7,24),(14,21),(23,26),(31,20),(40,25)]:
  d.line((x-5,y,x+5,y),fill=(39,79,33,255))
  for dx in [-4,-1,2,4]:
   height=rng.randrange(5,11);end=x+dx
   d.line((x,y,end,y-height),fill=(58,105,42,255));d.line((x+1,y-1,end+1,y-height+1),fill=(97,141,54,255));d.point((end,y-height),fill=(146,174,78,255))
  d.line((x-3,y+1,x+4,y+1),fill=(48,83,34,255))
 emit('fringe-'+str(variant),im,4,kind='fringe')
# Continuous rails and upright posts, with small top faces. No built-in accidental gap.
for orientation in ['horizontal','vertical','corner']:
 im=Image.new('RGBA',(16,16));d=ImageDraw.Draw(im)
 if orientation in ['horizontal','corner']:
  for yy in [5,10]:d.rectangle((0,yy,15,yy+2),fill=(88,58,33,255));d.line((0,yy,15,yy),fill=(161,119,66,255))
  for x in [1,12]:d.rectangle((x,3,x+2,13),fill=(109,71,37,255));d.line((x,3,x+2,3),fill=(187,141,77,255));d.line((x+2,4,x+2,13),fill=(70,49,29,255))
 if orientation=='corner':d.rectangle((6,0,8,10),fill=(91,61,34,255));d.line((6,0,6,10),fill=(157,113,60,255))
 if orientation=='vertical':
  d.rectangle((6,0,8,15),fill=(91,61,34,255));d.line((6,0,6,15),fill=(157,113,60,255))
  for yy in [1,11]:d.rectangle((4,yy,10,yy+3),fill=(110,73,39,255));d.line((4,yy,10,yy),fill=(186,140,76,255))
 emit('fence-'+orientation,im,3,[(0,0)],kind='fence')
m['count']=(len(cells)+7)//8*8;result=Image.new('RGBA',(128,m['count']//8*16))
for n,c in enumerate(cells):result.paste(c,(n%8*16,n//8*16))
assert hashlib.sha256(result.crop((0,0,128,736)).tobytes()).hexdigest()==oldhash
result.save(OUT/'chipset.png');result.resize((512,result.height*4),Image.Resampling.NEAREST).save(OUT/'atlas.png')
for p in [DATA/'manifest.json',ROOT/'src/assets/beodeulGroundCatalog.json']:p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(DATA/'woodland-inspection.json').write_text(json.dumps(dict(original368Hash=oldhash,original368Unchanged=True,count=m['count']),indent=2)+'\n')
print(dict(count=m['count'],groveOverlaps=[r['overlapPixels'] for r in m['recipes'] if 'overlapPixels' in r]))
normal=Image.open(OUT/'woodland-north.png').convert('RGBA');broken=Image.new('RGBA',normal.size)
north=next(r for r in m['recipes'] if r['id']=='bdg-woodland-north')
for a in reversed(north['anchors']):
 sprite,k=original(a['kit'].replace('bd-tree-',''));broken.alpha_composite(sprite,(a['pixelX'],a['pixelY']))
changed=[(x,y) for y in range(normal.height) for x in range(normal.width) if normal.getpixel((x,y))!=broken.getpixel((x,y))];assert changed
board=Image.new('RGBA',(normal.width*2+8,normal.height),(88,138,57,255));board.alpha_composite(normal,(0,0));board.alpha_composite(broken,(normal.width+8,0));board.resize((board.width*3,board.height*3),Image.Resampling.NEAREST).save(OUT/'woodland-normal-error.png')
(DATA/'woodland-errors.json').write_text(json.dumps([dict(code='back-tree-over-front',sourcePixel=changed[0],sourceCell=[changed[0][0]//16,changed[0][1]//16],changedPixels=len(changed),detected=True)],indent=2)+'\n')
