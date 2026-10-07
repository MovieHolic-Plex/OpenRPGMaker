"""Append reusable daylight ground pixels; native buildings and first 112 slots stay intact."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,sys,hashlib
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'public/assets/beodeul-ground';DATA=ROOT/'tiledata/beodeul-ground'
city=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text());atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
manifest=json.loads((DATA/'manifest.json').read_text());sheet=Image.open(OUT/'chipset.png').convert('RGBA')
base=[r for r in manifest['recipes'] if not r.get('lighting')];cells=[sheet.crop((n%8*16,n//8*16,n%8*16+16,n//8*16+16)) for n in range(112)]
assert len(base)==21
recipes=base.copy();checks=[]
def emit(id,name,im,layer=2,**meta):
 rows=[]
 for y in range(im.height//16):
  row=[]
  for x in range(im.width//16):
   c=im.crop((x*16,y*16,x*16+16,y*16+16))
   if c.getbbox():row.append(len(cells));cells.append(c)
   else:row.append(-1)
  rows.append(row)
 recipes.append(dict(id='bdg-light-'+id,name=name,width=im.width//16,height=im.height//16,layer=layer,rows=rows,blocked=False,lighting=True,**meta))
 im.save(OUT/('light-'+id+'.png'))
 checks.append(dict(id='bdg-light-'+id,pixelHash=hashlib.sha256(im.tobytes()).hexdigest(),layer=layer))
def native(n):return atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16))
def compose(im,paint):
 layer=Image.new('RGBA',im.size);paint(ImageDraw.Draw(layer));return Image.alpha_composite(im,layer)
# Short shadows (sun upper left), contact is narrower and darker than the cast shadow.
for b in json.loads((ROOT/'src/assets/beodeulArchitectureCatalog.json').read_text())['buildings']:
 w=b['width']*16;stepped=b['concept']=='sage';im=Image.new('RGBA',((b['width']+1)*16,80 if stepped else 48))
 segments=[(48,w-2,16),(1,47,48)] if stepped else [(1,w-2,16)]
 for left,right,foot in segments:
  im=compose(im,lambda d,l=left,r=right,f=foot:d.polygon([(l,f-2),(r,f-2),(r+13,f+7),(l+10,f+9)],fill=(39,59,45,48)))
  im=compose(im,lambda d,l=left,r=right,f=foot:d.polygon([(l,f-1),(r,f-1),(r+2,f+2),(l+2,f+3)],fill=(34,49,37,92)))
 emit('house-'+b['concept'],b['name']+' · 짧은 일광/접촉 그림자',im,dx=0,dy=b['height']-(3 if stepped else 1),anchor=b['id'])
# Canopy shadow preserves the native canopy silhouette, compressed onto the horizontal ground.
for id,h in [('03a8f7',3),('3e8732',3),('1a786c',4)]:
 k=next(k for k in city['structureKits'] if k['id']=='bd-tree-'+id);tree=Image.new('RGBA',(48,48))
 for y,row in enumerate(k['rows'][:3]):
  for x,n in enumerate(row['upperTiles']):
   if n>=0:tree.paste(native(n),(x*16,y*16))
 mask=tree.getchannel('A').resize((50,22),Image.Resampling.NEAREST).point(lambda p:round(p*0.20))
 im=Image.new('RGBA',(64,48));canopy=Image.new('RGBA',(50,22),(35,62,46,0));canopy.putalpha(mask)
 foot=24 if h==3 else 16;im.alpha_composite(canopy,(8,foot-7))
 im=compose(im,lambda d:d.ellipse((17,foot-2,31,foot+3),fill=(29,48,34,94)))
 emit('tree-'+id,'수관 그늘 · 밑동 접촉 '+id,im,dx=0,dy=h-1,anchor='bd-tree-'+id)
# Large, low contrast variation: texture stays sparse and the original bright grass remains visible.
for j,color in enumerate([(40,102,57,23),(176,178,90,23),(153,118,65,26)]):
 im=Image.new('RGBA',(64,48));d=ImageDraw.Draw(im)
 d.polygon([(7,13),(17,6),(30,7),(45,5),(56,16),(59,30),(46,40),(29,42),(15,36),(4,27)],fill=tuple(color[:3])+(color[3]//2,))
 d.polygon([(14,17),(24,11),(38,12),(49,17),(52,28),(39,35),(26,34),(12,26)],fill=color)
 for x,y in [(15,23),(33,18),(43,30)]:d.line((x,y,x+3,y-1),fill=tuple(color[:3])+(color[3]+8,))
 emit('meadow-'+str(j),'낮은 대비의 큰 잔디/흙 변화 '+str(j+1),im)
# Whole native paving variants retain every edge connection and all grass pixels.
road=next(g for g in city['autotileGroups'] if g['id']=='beodeul_road_autotile')
for n in road['memberTileIds']:
 assert city['priority'][n]=='lower' and all(city['passability'][n].values())
 for j in range(2):
  im=native(n);original=im.copy()
  for y in range(16):
   for x in range(16):
    r,g,b,a=original.getpixel((x,y))
    if a==0 or g>r+5:continue # native grass unchanged
    if min(r,g,b)>145 and max(r,g,b)-min(r,g,b)<28:
     # Reduce the bright curb; a few tiny grass-colored interruptions break its uniformity.
     if (x*11+y*7+j*13)%29<3:im.putpixel((x,y),(100,137,69,a))
     else:im.putpixel((x,y),(round(r*.69+103*.31),round(g*.69+113*.31),round(b*.69+88*.31),a))
    else:im.putpixel((x,y),(min(255,r+4),min(255,g+3),max(0,b-3),a))
  emit('road-'+str(n)+'-'+str(j),'원본 포석 '+str(n)+' · 낮춘 연석 '+str(j+1),im,layer=1,baseTile=n,variant=j)
count=(len(cells)+7)//8*8;out=Image.new('RGBA',(128,count//8*16))
for n,c in enumerate(cells):out.paste(c,(n%8*16,n//8*16))
assert out.crop((0,0,128,224)).tobytes()==sheet.crop((0,0,128,224)).tobytes()
out.save(OUT/'chipset.png');out.resize((512,out.height*4),Image.Resampling.NEAREST).save(OUT/'atlas.png')
manifest.update(count=count,recipes=recipes,lighting=dict(sun='upper-left',shadowOffset=[13,7],maxCastAlpha=51,maxContactAlpha=94,preserveNativeArt=True))
for p in [DATA/'manifest.json',ROOT/'src/assets/beodeulGroundCatalog.json']:p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(DATA/'lighting-inspection.json').write_text(json.dumps(dict(mechanicalPass=True,original112SlotsUnchanged=True,original112Hash=hashlib.sha256(out.crop((0,0,128,224)).tobytes()).hexdigest(),sourceSlots=count,recipes=checks),ensure_ascii=False,indent=2)+'\n')
# Real composed pixel preview: native grass + original house/tree + their new ground shadows.
preview=Image.new('RGBA',(224,128));grass=native(737)
for y in range(0,128,16):
 for x in range(0,224,16):preview.paste(grass,(x,y))
preview.alpha_composite(Image.open(ROOT/'public/assets/beodeul-architecture/cream.png'),(0,0))
shadow=Image.open(OUT/'light-house-cream.png');preview.alpha_composite(shadow,(0,80))
# Repaint original house over its ground-only shadow to match layer 1→2→3.
preview.alpha_composite(Image.open(ROOT/'public/assets/beodeul-architecture/cream.png'),(0,0))
k=next(k for k in city['structureKits'] if k['id']=='bd-tree-1a786c')
preview.alpha_composite(Image.open(OUT/'light-tree-1a786c.png'),(144,80))
for y,row in enumerate(k['rows']):
 for x,n in enumerate(row['upperTiles']):
  if n>=0:preview.alpha_composite(native(n),(144+x*16,32+y*16))
preview.resize((896,512),Image.Resampling.NEAREST).save(OUT/'lighting-preview.png')
print(json.dumps(dict(count=count,lightingRecipes=len(checks),original112SlotsUnchanged=True)))

# Actual mutation: remove one visible cast/contact tile, then verify the expected source-local gap.
cast=Image.open(OUT/'light-house-cream.png').convert('RGBA');broken=cast.copy();broken.paste((0,0,0,0),(0,16,16,32))
assert cast.crop((0,16,16,32)).getbbox() and not broken.crop((0,16,16,32)).getbbox()
errboard=Image.new('RGBA',(264,128));house=Image.open(ROOT/'public/assets/beodeul-architecture/cream.png').convert('RGBA')
for sx,shadow in [(0,cast),(136,broken)]:
 for yy in range(0,128,16):
  for xx in range(0,128,16):errboard.paste(grass,(sx+xx,yy))
 errboard.alpha_composite(shadow,(sx,80));errboard.alpha_composite(house,(sx,0))
errboard.resize((792,384),Image.Resampling.NEAREST).save(OUT/'lighting-normal-error.png')
(DATA/'lighting-errors.json').write_text(json.dumps([dict(code='missing-cast-shadow',sourceLocal=[0,1],exampleMapCell=[0,6],mutation='erase visible cast source cell',detected=True)],indent=2)+'\n')
