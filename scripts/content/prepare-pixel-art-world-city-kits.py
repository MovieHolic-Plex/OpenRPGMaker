#!/usr/bin/env python3
"""Build metadata-only exterior kits; local PNGs only, actual previews stay gitignored."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--source-dir', action='append', required=True)
parser.add_argument('--output', default='output/paw-city-kits')
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
files={'town':'ST-Town-E01.png','school':'ST-Schl-E01.png','park':'ST-Park-E01.png','xp-roof01':'SA-Roof01.png'}
expected_sha={'ST-Town-E01.png': 'd28c556e346a833c14caf3e4668bf1fcec67c7862bc7b63f9b2279207fe7a13e', 'ST-Schl-E01.png': '39b7b14027c50019479c609e44427163a52f38eef89af4c68ce6e4593a7b616f', 'ST-Park-E01.png': '4becd0ccc997e22003dc8a0f6fb8a6cc12379d14c004d9f744d9b4d0b07ad62e', 'SA-Roof01.png': '15d7faf904362bb07108b2e407fb750fd242f1c7db9c4ca2f5f27f2e0aec74bb'}
images={};sources=[]
masks=sorted({(m&15)|sum(d for d,c in [(16,3),(32,6),(64,12),(128,9)] if m&c==c and m&d) for m in range(256)})
for id,filename in files.items():
 paths=[Path(folder)/filename for folder in args.source_dir]
 path=next((p for p in paths if p.is_file()),None)
 if path is None:raise SystemExit('Missing local source '+filename)
 if hashlib.sha256(path.read_bytes()).hexdigest()!=expected_sha[filename]:raise SystemExit('Unreviewed source edition '+filename)
 image=Image.open(path).convert('RGBA');images[id]=image
 source={'id':id,'filename':filename,'url':'https://yms.main.jp/dotartworld/sozai/'+('autotile2/autotile-ex/' if id.startswith('xp-') else 'tileset/')+filename,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'width':image.width,'height':image.height,'tileSize':32,'tilesPerRow':8}
 if id.startswith('xp-'):source.update(format='xp-autotile',variantMasks=masks)
 else:source['format']='tileset'
 sources.append(source)

def ref(source,tile):return {'source':source,'tile':tile}
def new(id,name,w,h,kind='building',entrance=None,notes=''):
 k={'id':id,'name':name,'kind':kind,'width':w,'height':h,'lowerTiles':[None]*(w*h),'upperTiles':[None]*(w*h),'entrance':entrance,'approach':{'x':entrance['x'] if entrance else w//2,'y':h},'notes':notes};return k
def put(k,layer,x,y,source,tile):k[layer+'Tiles'][y*k['width']+x]=ref(source,tile)
def rect(k,layer,x,y,w,h,source,tile):
 for yy in range(y,y+h):
  for xx in range(x,x+w):put(k,layer,xx,yy,source,tile)
def block(k,layer,x,y,source,rows):
 for dy,row in enumerate(rows):
  for dx,tile in enumerate(row):
   if tile is not None:put(k,layer,x+dx,y+dy,source,tile)
def roof(k,x,y,w,h):
 for yy in range(h):
  for xx in range(w):
   inside=lambda a,b:0<=a<w and 0<=b<h
   mask=sum(bit for dx,dy,bit in [(0,-1,1),(1,0,2),(0,1,4),(-1,0,8),(1,-1,16),(1,1,32),(-1,1,64),(-1,-1,128)] if inside(xx+dx,yy+dy))
   put(k,'lower',x+xx,y+yy,'xp-roof01',masks.index(mask))

kits=[]
k=new('school-main','햇살 초등학교 본관',13,10,entrance={'x':6,'y':9},notes='두 층 교실과 중앙 정문. lower 벽/지붕은 차단, 창·문 upper도 통과로 오해하지 않는다. 정문 두 칸(6,9),(7,9)에 부모가 실내 전이 이벤트를 붙인다. approach=(6,10)은 외부 보도. 실제 학교 원본의 벽·창·문과 XP 지붕만 사용.');roof(k,0,0,13,3)
rect(k,'lower',0,3,13,7,'school',241)
for x in range(13):put(k,'lower',x,6,'school',256 if x==0 else 258 if x==12 else 257)
for x in range(13):put(k,'lower',x,9,'school',249)
for y in [4,7]:
 for x in [1,3,8,10]:block(k,'upper',x,y,'school',[[266,267],[274,275]])
block(k,'upper',6,8,'school',[[280,281],[288,289]])
put(k,'upper',6,3,'school',195)
kits.append(k)

k=new('clinic-small','푸른 창 지역 의원',9,7,entrance={'x':4,'y':6},notes='학교 원본의 공공건물 벽·푸른 창으로 재구성한 작은 의원. 병원 고유 외관이라고 주장하지 않는다. 의료 간판/시설명은 부모의 표지 이벤트로 붙인다. door=(4,6),(5,6), approach=(4,7). 계단이나 자동 출입 이벤트는 포함하지 않는다.');roof(k,0,0,9,2)
rect(k,'lower',0,2,9,5,'school',241)
for x in range(9):put(k,'lower',x,2,'school',241);put(k,'lower',x,6,'school',249)
for x in [1,6]:block(k,'upper',x,3,'school',[[266,267],[274,275]])
block(k,'upper',4,5,'school',[[280,281],[288,289]])
kits.append(k)

k=new('home-red-gable','붉은 지붕 목조 주택',6,9,entrance={'x':2,'y':8},notes='town 붉은 경사지붕을 실제 대각 마감 방향대로 확장. 투명 삼각 지붕 아래에 beige 박공 벽을 lower로 포함했다. 입구=(2,8), approach=(2,9). 한 칸 문 전체는259/267의 두 행.');
for y in range(3,6):rect(k,'lower',5-y,y,2*(y-2),1,'town',237)
block(k,'upper',0,0,'town',[[None,None,312,313,None,None],[None,312,320,321,313,None],[312,320,320,321,321,313],[320,320,328,329,321,321],[320,328,None,None,329,321],[328,None,None,None,None,329]])
for y,row in [(6,[216,217,217,217,217,218]),(7,[224,225,225,225,225,226]),(8,[232,233,233,233,233,234])]:block(k,'lower',0,y,'town',[row])
block(k,'upper',4,6,'town',[[262,263],[270,271]])
block(k,'upper',2,7,'town',[[259],[267]])
put(k,'upper',2,5,'town',304)
kits.append(k)

k=new('apartment-dark-roof','기와 지붕 이층 주택',10,9,entrance={'x':5,'y':8},notes='town 기와 지붕의 양쪽 마감과 중앙 반복을 사용한 이층 주택. 지붕 투명 아래 lower 외벽 받침 포함. 문=(5,8), approach=(5,9). 아래층과 위층 창은 서로 다른 원본 방향을 유지한다.');
block(k,'upper',0,0,'town',[[273]+[274]*8+[275],[281]+[282]*8+[283],[289]+[290]*8+[291],[297]+[298]*8+[299]])
rect(k,'lower',0,3,10,6,'town',57)
for x in range(10):put(k,'lower',x,5,'town',65);put(k,'lower',x,8,'town',65)
# Upper-floor windows are closed horizontal frames, not door fragments.
for x in [1,3,6,8]:block(k,'upper',x,4,'town',[[245],[253]])
for x in [1,3,7]:block(k,'upper',x,6,'town',[[262],[270]])
block(k,'upper',5,7,'town',[[260],[268]])
kits.append(k)

props=[('park-swings','그네',[[344,345,346],[352,353,354],[360,361,362]]),('park-slide','미끄럼틀',[[None,None,349,350,351],[None,356,357,358,359],[363,364,365,366,367]]),('park-bench-front','공원 벤치 정면',[[315,316],[323,324]]),('park-bench-back','공원 벤치 뒷면',[[331,332],[339,340]]),('park-lamp','공원 가로등',[[319],[327],[335],[343]]),('park-sandpit','모서리 사각 모래놀이터',[[312,313,313,314],[320,321,321,322],[328,329,329,330]]),('park-tree-planter','둥근 화단 나무',[[172,173,174,175],[180,181,182,183],[188,189,190,191],[196,197,198,199],[204,205,206,207],[212,213,214,215]])]
for id,name,rows in props:
 k=new(id,name,len(rows[0]),len(rows),'prop',notes='공원 원본의 완전한 고정 조각. upper 아래 기존 보도/잔디 lower를 보존. 통행은 부모가 점유영역과 투명 여백을 검토해 등록한다. entrance 없음; approach는 관찰/상호작용 방향 참고.');block(k,'upper',0,0,'park',rows);kits.append(k)
for id,name,tile in [('ground-park-grass','밝은 공원 잔디',0),('ground-park-soil','공원 흙길',2)]:
 k=new(id,name,1,1,'ground',notes='원본32px 반복 지면, lower 통행 가능. 별도 자동 경계/수변을 생성하지 않는다.');put(k,'lower',0,0,'park',tile);kits.append(k)

# Bake XP only into local proof sheets; catalog retains source identity + canonical mask index.
raw=images['xp-roof01'];baked=Image.new('RGBA',(256,192))
for index,mask in enumerate(masks):
 for q in range(4):
  right=q%2;bottom=q//2;dx=right*16;dy=bottom*16
  vertical=bool(mask&(4 if bottom else 1));horizontal=bool(mask&(2 if right else 8));diagonal=bool(mask&((32 if right else 64) if bottom else (16 if right else 128)))
  if mask==0:sx,sy=dx,dy
  elif vertical and horizontal and not diagonal:sx,sy=64+dx,dy
  else:sx=(32+dx if horizontal else 80 if right else 0);sy=(64+dy if vertical else 112 if bottom else 32)
  baked.paste(raw.crop((sx,sy,sx+16,sy+16)),(index%8*32+dx,index//8*32+dy))
images['xp-roof01']=baked
for k in kits:
 w,h=k['width'],k['height']
 if not(1<=w<=13 and 1<=h<=12) or any(len(k[layer])!=w*h for layer in ['lowerTiles','upperTiles']):raise ValueError('Invalid kit geometry '+k['id'])
 for layer in ['lowerTiles','upperTiles']:
  for r in k[layer]:
   if r is not None and (r['source'] not in images or not 0<=r['tile']<(47 if r['source'].startswith('xp-') else images[r['source']].width*images[r['source']].height//1024)):raise ValueError('Invalid source reference '+k['id'])
 preview=Image.new('RGBA',(w*32,(h+1)*32))
 grass=images['park'].crop((0,0,32,32))
 for y in range(h+1):
  for x in range(w):preview.paste(grass,(x*32,y*32))
 for layer in ['lowerTiles','upperTiles']:
  for index,r in enumerate(k[layer]):
   if r is None:continue
   image=images[r['source']];tile=r['tile'];chip=image.crop((tile%8*32,tile//8*32,tile%8*32+32,tile//8*32+32));preview.alpha_composite(chip,(index%w*32,index//w*32))
 preview.save(out/(k['id']+'.png'))
Path('tiledata/pixel-art-world/city-kits.json').write_text(json.dumps({'sources':sources,'kits':kits},ensure_ascii=False,indent=2)+'\n')
print([(k['id'],k['width'],k['height']) for k in kits])
