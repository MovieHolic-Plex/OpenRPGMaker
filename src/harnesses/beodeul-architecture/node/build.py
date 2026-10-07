"""Minimal edits to original Beodeul pixels. Native roof geometry and silhouettes are preserved."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json
from gable import refine_stone_gable
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'public/assets/beodeul-architecture'; DATA=ROOT/'tiledata/beodeul-architecture'
OUT.mkdir(parents=True,exist_ok=True);DATA.mkdir(parents=True,exist_ok=True)
city=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text())
atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
kits={k['id']:k for k in city['structureKits']}
prior=json.loads((DATA/'catalog.json').read_text()) if (DATA/'catalog.json').exists() else None

def native(name):
 k=kits['bd-house-'+name];im=Image.new('RGBA',(k['width']*16,k['height']*16))
 for y,r in enumerate(k['rows']):
  for x,n in enumerate(r['upperTiles']):
   if n>=0:im.paste(atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16)),(x*16,y*16))
 return k,im

def pane(im,box,kind='cross',glass='#55858a'):
 # Localized panes inside original timber frame; preserve roof, wall and frame texture.
 d=ImageDraw.Draw(im);x0,y0,x1,y1=box
 d.rectangle(box,fill='#342c28');d.rectangle((x0+1,y0+1,x1-1,y1-1),fill=glass)
 if kind=='cross':d.line(((x0+x1)//2,y0+1,(x0+x1)//2,y1-1),fill='#ac8052')
 if kind!='slit':d.line((x0+1,(y0+y1)//2,x1-1,(y0+y1)//2),fill='#ac8052')
 d.point((x0+2,y0+2),fill='#a4b7ab')

specs=[('cream','h101_0','원본 회벽·목골 별채집 · 작은 덧문창','shuttered'),
 ('brick','h104_0','원본 회벽·목골 이층집 · 세로창','tall'),
 ('stone','h112_0','원본 사암 돌벽 박공집 · 작은 원형창','round'),
 ('sage','h109_1','원본 회벽·목골 ㄱ자집 · 가로창','wide'),
 ('ochre','h107_0','원본 회벽·목골 낮은 집 · 쌍창','paired'),
 ('church','cathedral','원본 석조 성당 · 푸른 첨탑','native-church')]
# Keep allocated cell numbers stable across builds; newly required native cells append.
cells=[Image.new('RGBA',(16,16)) for _ in range(prior['count'] if prior else 0)]
priority=['lower']*len(cells);passage=[dict(up=True,down=True,left=True,right=True) for _ in cells]
bs=[];sprites=[]
for concept,source,label,style in specs:
 k,original=native(source);im=original.copy();edits=[]
 if concept=='cream':
  # The annex had a second wooden door and a different wall material. Reuse native plaster/timber cells.
  im.paste(original.crop((16,64,32,96)),(80,64));im.paste(original.crop((64,64,80,96)),(96,64))
  pane(im,(85,70,91,82),'cross');d=ImageDraw.Draw(im)
  d.rectangle((82,70,83,82),fill='#617151');d.rectangle((93,70,94,82),fill='#617151')
  edits=[(80,64,112,96)]
 elif concept=='brick':
  for x in [16,48,80]:pane(im,(x+3,66,x+10,77),'slit',glass='#486d7b');edits.append((x+3,66,x+11,78))
  pane(im,(67,98,74,109),'slit',glass='#486d7b');edits.append((67,98,75,110))
 elif concept=='stone':
  # Recolor only pink masonry pixels, retaining every joint and the original texture.
  for y in range(64,96):
   for x in range(im.width):
    r,g,b,a=im.getpixel((x,y))
    if a and r>=g and b>g and r-g<65:
     im.putpixel((x,y),(min(255,r+3),min(255,g+10),max(0,b-17),a))
  # Correct the entire triangular wall, not isolated plaster-colour pixels.
  gablemask=refine_stone_gable(im,original)
  gablemask.save(OUT/'stone-gable-mask.png')
  edits=[(0,64,64,96)]
 elif concept=='sage':
  # Close only the rear wing's duplicate door with an original wall cell. Main porch door stays.
  im.paste(original.crop((80,64,96,96)),(64,64));pane(im,(66,69,77,83),'cross')
  edits=[(64,64,80,96)]
 elif concept=='ochre':
  # Keep existing window and add one matching native frame at the opposite end.
  im.paste(original.crop((16,64,32,80)),(64,64));pane(im,(67,66,74,77),'cross',glass='#58817b')
  edits=[(64,64,80,80)]
 elif concept=='church':
  # Replace only the duplicate upper door with the adjacent original stone/window column.
  im.paste(original.crop((80,144,96,176)),(112,144));edits=[(112,144,128,176)]
 # Clip local edits to the native silhouette, preserving edge and transparency exactly.
 for yy in range(im.height):
  for xx in range(im.width):
   before=original.getpixel((xx,yy));after=im.getpixel((xx,yy))
   if before[3]==0 or after[3]==0:im.putpixel((xx,yy),before)
 im.putalpha(original.getchannel('A'))
 # User correction: restore native roof pixels exactly; only stone gable wall changes.
 assert im.getchannel('A').tobytes()==original.getchannel('A').tobytes(),f'silhouette changed {source}'
 for y in range(im.height):
  for x in range(im.width):
   if im.getpixel((x,y))!=original.getpixel((x,y)):
    assert (concept=='stone' and gablemask.getpixel((x,y))) or any(x0<=x<x1 and y0<=y<y1 for x0,y0,x1,y1 in edits),(source,x,y)
 if concept=='stone':
  for yy in range(64):
   for xx in range(im.width):
    if not gablemask.getpixel((xx,yy)):assert im.getpixel((xx,yy))==original.getpixel((xx,yy)),('roof changed',xx,yy)
 else:assert im.crop((0,0,im.width,48)).tobytes()==original.crop((0,0,im.width,48)).tobytes()
 im.save(OUT/(concept+'.png'));original.save(OUT/(concept+'-native.png'))
 old=next((b for b in prior['buildings'] if b['concept']==concept),None) if prior else None
 grid=[]
 for y in range(k['height']):
  row=[]
  for x in range(k['width']):
   cell=im.crop((x*16,y*16,x*16+16,y*16+16))
   if not cell.getbbox():row.append(-1);continue
   n=old['rows'][y][x] if old else -1
   if n<0:n=len(cells);cells.append(Image.new('RGBA',(16,16)));priority.append('lower');passage.append(dict(up=True,down=True,left=True,right=True))
   cells[n]=cell;row.append(n);nativeN=k['rows'][y]['upperTiles'][x]
   priority[n]=city['priority'][nativeN];passage[n]=city['passability'][nativeN]
  grid.append(row)
 changed=sum(a!=b for a,b in zip(original.getdata(),im.getdata()))
 bs.append(dict(id='bd-house-village-'+concept,sourceKit=k['id'],concept=concept,name=label,width=k['width'],height=k['height'],rows=grid,parts=k['parts'],windowStyle=style,doorCount=1,edits=edits,preservedPixelRatio=1-changed/(im.width*im.height),perspective=dict(nativeRoof=True,nativeRoofGeometry=True,sideRequired=False),gableCorrection=dict(mask='stone-gable-mask.png',windowCenter=[31,53],roofPixelsUnchanged=True) if concept=='stone' else None,appearanceVersion=5))
 sprites.append((im,original))
count=(len(cells)+15)//16*16
sheet=Image.new('RGBA',(256,count))
for n,c in enumerate(cells):sheet.paste(c,(n%16*16,n//16*16))
sheet.save(OUT/'chipset.png');sheet.resize((768,sheet.height*3),Image.Resampling.NEAREST).save(OUT/'atlas.png')
manifest=dict(id='beodeul_architecture',texture='tex_beodeul_architecture',tileSize=16,tilesPerRow=16,count=count,paintedCount=sum(bool(c.getbbox()) for c in cells),buildings=bs,priority=priority+['lower']*(count-len(cells)),passability=passage+[dict(up=True,down=True,left=True,right=True)]*(count-len(cells)),appearanceVersion=5)
for p in [DATA/'catalog.json',ROOT/'src/assets/beodeulArchitectureCatalog.json']:p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
board=Image.new('RGBA',(640,440),(88,138,57,255))
comparison=Image.new('RGBA',(640,900),(88,138,57,255))
for j,(im,original) in enumerate(sprites):
 board.alpha_composite(im,((j%3)*210+10,(j//3)*190+10))
 comparison.alpha_composite(original,((j%3)*210+10,(j//3)*400+10))
 comparison.alpha_composite(im,((j%3)*210+10,(j//3)*400+150 if j<3 else (j//3)*400+230))
board.save(OUT/'buildings.png');comparison.save(OUT/'native-comparison.png')
good=sprites[2][0];bad=good.copy();ImageDraw.Draw(bad).rectangle((31,39,32,61),fill='#785b40')
errors=Image.new('RGBA',(good.width*2+8,good.height),(90,138,57,255));errors.alpha_composite(good,(0,0));errors.alpha_composite(bad,(good.width+8,0))
errors.resize((errors.width*3,errors.height*3),Image.Resampling.NEAREST).save(OUT/'normal-error.png')
(DATA/'errors.json').write_text(json.dumps([dict(code='gable-post-through-window',x=1,y=3,mutation='restore a timber post through the round window',detected=bad.crop((28,50,35,57)).tobytes()!=good.crop((28,50,35,57)).tobytes())],indent=2)+'\n')
print(json.dumps(dict(count=count,buildings=len(bs),nativeSilhouettesPreserved=True,pixelRetention=[round(b['preservedPixelRatio'],3) for b in bs])))
