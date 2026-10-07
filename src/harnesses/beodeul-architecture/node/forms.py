"""Six structural families assembled at native pixel scale, separate from preserved houses."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, sys

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'public/assets/beodeul-forms';DATA=ROOT/'tiledata/beodeul-forms'
OUT.mkdir(parents=True,exist_ok=True);DATA.mkdir(parents=True,exist_ok=True)
city=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text())
arch=json.loads((ROOT/'src/assets/beodeulArchitectureCatalog.json').read_text())
atlases={'city':Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA'),
 'arch':Image.open(ROOT/'public/assets/beodeul-architecture/chipset.png').convert('RGBA')}
tables={'city':city,'arch':arch}
kits={k['id']:k for k in city['structureKits']}
for k in arch['buildings']:kits[k['id']]={**k,'source':'arch','rows':[{'upperTiles':r} for r in k['rows']]}

def sprite(key):
 k=kits[key];owner=k.get('source','city');a=atlases[owner];cols=128 if owner=='city' else 16
 im=Image.new('RGBA',(k['width']*16,k['height']*16))
 for y,r in enumerate(k['rows']):
  for x,n in enumerate(r['upperTiles']):
   if n>=0:im.paste(a.crop((n%cols*16,n//cols*16,n%cols*16+16,n//cols*16+16)),(x*16,y*16))
 return im

def pane(im,x,y,w=7,h=10,kind='cross'):
 d=ImageDraw.Draw(im);d.rectangle((x-1,y-1,x+w,y+h),fill='#4e392b');d.rectangle((x,y,x+w-1,y+h-1),fill='#557879')
 d.line((x+1,y+1,x+w-2,y+1),fill='#a3b4a0')
 if kind=='cross':d.line((x+w//2,y,x+w//2,y+h-1),fill='#af8455')
 d.line((x,y+h//2,x+w-1,y+h//2),fill='#a88252')

def remap(key,columns,height=None):
 s=sprite(key);k=kits[key];im=Image.new('RGBA',(len(columns)*16,(height or k['height'])*16))
 for x,sx in enumerate(columns):im.paste(s.crop((sx*16,0,sx*16+16,s.height)),(x*16,0))
 return im

specs=[]
def add(id,name,im,entrance,groundLines,roof,source,edits=()):
 specs.append(dict(id='bd-house-form-'+id,concept=id,name=name,im=im,entrance=entrance,groundLines=groundLines,
  roofDescription=roof,sourceKits=source,windowEdits=list(edits),doorCount=1))

# Long low house: extend roof and facade together. Door occurs only in source column 2.
long=remap('bd-house-h120_0',[0,1,2,3,4,4,4,4,5,6])
pane(long,20,66);pane(long,100,66);pane(long,132,66,kind='slit')
add('long','가로 긴 민가 · 낮은 긴 지붕',long,[2,5,1,1],[[0,9,5]],'좌우 용마루 / 낮은 벽', ['bd-house-h120_0'],[[18,64,30,79],[98,64,112,79],[130,64,143,79]])

# Vertical gable retains all native roof pixels. Different upper/lower windows.
narrow=sprite('bd-house-h117_1');pane(narrow,20,82,kind='slit');pane(narrow,36,82,kind='slit');pane(narrow,20,99,7,8)
add('narrow','좁은 이층집 · 세로 박공지붕',narrow,[2,7,1,1],[[0,3,7]],'앞뒤 용마루 / 높은 두 층', ['bd-house-h117_1'],[[18,80,46,94],[18,97,29,109]])

# Existing corrected L house extended only on the rear wing; the single forward door stays.
wing=remap('bd-house-village-sage',[0,1,2,3,4,5,6,6,7]);pane(wing,100,69,10,10)
add('wing','ㄱ자 민가 · 본채와 낮은 별채',wing,[1,7,1,1],[[0,2,7],[3,8,5]],'앞뒤 박공 + 가로 뒷채 / 높이가 다른 처마', ['bd-house-village-sage'],[[98,67,113,81]])

# Inn gets a broad hipped roof, dormers and a small roof over its projecting entrance.
inn=remap('bd-house-inn',[0,1,2,4,4,3,4,5,6,7],10)
dormer=sprite('bd-mpart-dormer');inn.alpha_composite(dormer,(26,30));inn.alpha_composite(dormer,(100,30))
porch=sprite('bd-mpart-porch');inn.alpha_composite(porch,(96,112))
# A low native timber threshold leads through the porch; no additional door is drawn.
inn.paste(sprite('bd-house-inn').crop((80,112,96,128)),(112,128))
add('inn','여관 · 넓은 지붕과 돌출 현관·다락창',inn,[7,8,1,1],[[0,5,7],[9,9,7],[6,8,9]],'넓은 우진각 / 다락창 둘 / 낮은 현관 처마', ['bd-house-inn','bd-mpart-dormer','bd-mpart-porch'])

# Smithy: stone body plus open low work shed. The shed has no door or second wall material.
smith=Image.new('RGBA',(144,112));smith.alpha_composite(sprite('bd-house-smithy_town'),(0,0))
roof=sprite('bd-house-smithy_town').crop((16,32,80,64));smith.alpha_composite(roof,(80,48))
d=ImageDraw.Draw(smith)
for x in [84,139]:
 d.rectangle((x,77,x+3,107),fill='#594332');d.line((x+1,78,x+1,106),fill='#aa8050')
d.line((82,79,142,79),fill='#473b2c',width=2)
chim=sprite('bd-out-chimney');smith.alpha_composite(chim,(16,0));smith.alpha_composite(chim,(16,16))
add('smithy','대장간 · 큰 굴뚝과 낮은 작업장',smith,[3,5,1,1],[[0,4,5],[5,8,6]],'작은 우진각 + 한 단 낮은 작업장 처마', ['bd-house-smithy_town','bd-out-chimney'])

# Wide log warehouse: one wide cargo entrance beneath a native copper roof awning.
warehouse=remap('bd-house-ware0',[0,1,1,1,2,3,1,1,1,1,5])
awning=sprite('bd-house-ware0').crop((16,32,80,48));warehouse.alpha_composite(awning,(48,74))
# Broaden the original single opening by copying its left/right native door leaves.
old=sprite('bd-house-ware0')
warehouse.paste(old.crop((32,80,48,112)),(64,80));warehouse.paste(old.crop((48,80,64,112)),(80,80))
add('warehouse','항구 창고 · 긴 몸체와 하역 차양',warehouse,[4,6,2,1],[[0,10,6]],'가로 긴 깊은 지붕 / 낮은 하역 차양', ['bd-house-ware0'])

seed=json.loads((ROOT/'harness-data/beodeul-architecture/seed.json').read_text())
assert [s['concept'] for s in specs]==seed['structuralFamilies']

if '--validate' in sys.argv or '--review' in sys.argv:
 manifest=json.loads((ROOT/'src/assets/beodeulFormsCatalog.json').read_text());sheet=Image.open(OUT/'chipset.png').convert('RGBA')
 assert len(manifest['buildings'])==6
 report=[]
 for expected,b in zip(specs,manifest['buildings']):
  im=Image.open(OUT/(b['concept']+'.png')).convert('RGBA');assert im.tobytes()==expected['im'].tobytes()
  assert b['doorCount']==1 and len([e for e in b['parts'] if e['kind']=='entrance'])==1
  assembled=Image.new('RGBA',im.size)
  for y,row in enumerate(b['rows']):
   for x,n in enumerate(row):
    if n>=0:assembled.paste(sheet.crop((n%16*16,n//16*16,n%16*16+16,n//16*16+16)),(x*16,y*16))
  assert assembled.tobytes()==im.tobytes()
  assert b['sha256']==hashlib.sha256(im.tobytes()).hexdigest()
  report.append(dict(id=b['id'],sha256=b['sha256'],sourceAssemblyMatches=True,oneEntrance=True))
 # Original city / corrected house sheet are read only in this authoring path.
 assert manifest['sourceHashes']=={key:hashlib.sha256(a.tobytes()).hexdigest() for key,a in atlases.items()}
 (DATA/'inspection.json').write_text(json.dumps(dict(buildings=report,originalSourcesUnchanged=True,visualVerdict='requires actual image review'),indent=2)+'\n')
 if '--review' in sys.argv:
  target=ROOT/'qa-runs/harnesses/beodeul-architecture';target.mkdir(parents=True,exist_ok=True)
  review=Image.open(OUT/'families.png');review.resize((review.width*3,review.height*3),Image.Resampling.NEAREST).save(target/'structural-families-review.png')
 print(json.dumps(dict(structuralFamilies=6,sourceAssemblyMatches=True)));sys.exit(0)

cells=[];priorities=[];passes=[];buildings=[]
def pack(im,blocked=None):
 grid=[]
 for y in range(im.height//16):
  row=[]
  for x in range(im.width//16):
   c=im.crop((x*16,y*16,x*16+16,y*16+16))
   if not c.getbbox():row.append(-1);continue
   n=len(cells);cells.append(c);priorities.append('upper');isblocked=blocked and (x,y) in blocked
   passes.append(dict(up=not isblocked,down=not isblocked,left=not isblocked,right=not isblocked));row.append(n)
  grid.append(row)
 return grid

for s in specs:
 im=s.pop('im');w,h=im.width//16,im.height//16
 # Walls block; roof overhangs use ★. Also test solid wall cells in the map author.
 blocked={(x,y) for x in range(w) for y in range(h) if y>=4 and im.crop((x*16,y*16,x*16+16,y*16+16)).getbbox()}
 if s['concept']=='warehouse':blocked={(x,y) for x in range(w) for y in range(5,h)}
 if s['concept']=='smithy':blocked={(x,y) for x in range(6) for y in range(4,6)}|{(5,6),(8,6)}
 if s['concept']=='inn':blocked={(x,y) for x in range(w) for y in range(4,8)}|{(6,8),(7,8),(8,8),(6,9),(8,9)}
 if s['concept']=='wing':blocked={(x,y) for x in range(w) for y in [4,5]}|{(x,y) for x in range(3) for y in [6,7]}
 dx,dy,ew,eh=s.pop('entrance');rows=pack(im,blocked)
 # Contact follows each wall base, including the L house's rear wing and the porch.
 shadow=Image.new('RGBA',((w+1)*16,(h+1)*16));foundation=Image.new('RGBA',shadow.size)
 ds=ImageDraw.Draw(shadow);df=ImageDraw.Draw(foundation)
 for x0,x1,y in s['groundLines']:
  for xx in range(x0*16,(x1+1)*16):
   foot=(y+1)*16-1
   ds.line((xx,foot,xx+5,foot+4),fill=(44,51,28,44));ds.point((xx,foot),fill=(40,40,25,105))
   if xx%5!=0:df.point((xx,foot),fill='#8b7650');df.point((xx,foot+1),fill='#61703b')
   if xx%11==3:df.point((xx,foot+2),fill='#81983f')
 im.save(OUT/(s['concept']+'.png'));shadow.save(OUT/(s['concept']+'-shadow.png'));foundation.save(OUT/(s['concept']+'-foundation.png'))
 buildings.append({**s,'width':w,'height':h,'rows':rows,'parts':[dict(id='door',kind='entrance',dx=dx,dy=dy,w=ew,h=eh)],
  'sha256':hashlib.sha256(im.tobytes()).hexdigest(),'shadowRows':pack(shadow),'foundationRows':pack(foundation),
  'perspective':dict(nativePixelScale=True,nativeRoofTop=True,sideRequired=False)})

count=(len(cells)+15)//16*16;sheet=Image.new('RGBA',(256,count))
for n,c in enumerate(cells):sheet.paste(c,(n%16*16,n//16*16))
sheet.save(OUT/'chipset.png')
manifest=dict(id='beodeul_forms',texture='tex_beodeul_forms',tileSize=16,tilesPerRow=16,count=count,buildings=buildings,
 priority=priorities+['upper']*(count-len(cells)),passability=passes+[dict(up=True,down=True,left=True,right=True)]*(count-len(cells)),
 sourceHashes={key:hashlib.sha256(a.tobytes()).hexdigest() for key,a in atlases.items()})
for file in [DATA/'catalog.json',ROOT/'src/assets/beodeulFormsCatalog.json']:file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
board=Image.new('RGBA',(432,300),(136,177,77,255))
for j,b in enumerate(buildings):
 x=j%3*144;y=j//3*150;im=Image.open(OUT/(b['concept']+'.png')).convert('RGBA')
 # Six bodies at exactly 1x, with complete foundations and contact shadows.
 if im.width>140:
  continue
 board.alpha_composite(Image.open(OUT/(b['concept']+'-shadow.png')).convert('RGBA'),(x,y))
 board.alpha_composite(im,(x,y));board.alpha_composite(Image.open(OUT/(b['concept']+'-foundation.png')).convert('RGBA'),(x,y))
# Wide bodies need genuine 176px slots, no downscaling.
board=Image.new('RGBA',(600,352),(136,177,77,255))
for j,b in enumerate(buildings):
 x=j%3*200+8;y=j//3*176+8
 for suffix in ['-shadow','','-foundation']:board.alpha_composite(Image.open(OUT/(b['concept']+suffix+'.png')).convert('RGBA'),(x,y))
board.save(OUT/'families.png')
print(json.dumps(dict(structuralFamilies=6,count=count)))
