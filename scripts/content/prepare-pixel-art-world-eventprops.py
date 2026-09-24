"""Metadata-only extraction from user PNGs; no source pixels copied into Git.
python3 scripts/content/prepare-pixel-art-world-eventprops.py /user/downloads
"""
import csv,hashlib,json,sys
from pathlib import Path
from urllib.parse import unquote,urlparse
from PIL import Image
root=Path(__file__).resolve().parents[2];downloads=Path(sys.argv[1]);base='https://yms.main.jp/dotartworld/'
rows=[r for r in csv.DictReader((root/'tiledata/pixel-art-world/download-catalog/direct-downloads.csv').open(encoding='utf-8-sig')) if any(p in r['source_page']for p in ['page3/chara01.html','page3/chara02.html','page3/chara-cars.html']) and r['local_path']]
restricted={'SC-SantaF01.png','SC-SantaF02.png','SC-CTsunagi01.png','yaranaika.png','SC-SantaC01.png','SC-SantaC02.png','SC-CFundosi01.png','PikoC-Girl01.png','PikoC-Teddy005.png'}
walking={'SC-Owl03.png','SC-Owl01.png','SC-Owl-Mail.png','SC-Carp01.png','SC-Turtle01.png','SC-Lama01.png','SC-Santa01.png','SC-Santa02.png','SC-SantaF01.png','SC-SantaF02.png','SC-CTsunagi01.png','SC-CFundosi01.png','PikoC-Girl01.png','PikoC-Teddy005.png'}
rowLoops=walking|{'SC-Nobori01.png','SC-Nobori02.png','SC-Nobori03.png','SC-Stone01.png','SC-Pointer01.png','SC-Candle01.png'}
labels={'SC-VdgMacine01.png':'자판기 · 두 이벤트 조립','SC-Cupboard01.png':'찬장·책장 개방','SC-Door-Evs01.png':'엘리베이터 층 표시기','SC-Polesign.png':'회전 폴사인과 정적 거리 소품','SC-WallLion01.png':'금색 사자 분수','SC-WallLion02.png':'회색 사자 분수','SC-Set-Schl01.png':'학교 수도대·열린 교문','SC-Set-Schl02.png':'학교 골대·수도대·타이어·심판대','SC-Labo03.png':'과학실 소품·전체 실험 장치','SC-Bd02.png':'가로 상점 간판','SC-Bd03.png':'높이 조정 상점 간판'}
labels.update({'SC-Nobori01.png':'음식점 세로 깃발 A','SC-Nobori02.png':'음식점 세로 깃발 B','SC-Nobori03.png':'무늬 세로 깃발','SC-Owl02.png':'부엉이 앉기·제자리 비행','SC-Owl03.png':'부엉이 걷기','SC-Owl01.png':'부엉이 비행','SC-Owl-Mail.png':'우편 부엉이 비행','SC-Carp01.png':'잉어 헤엄','SC-Turtle01.png':'거북 걷기','SC-Lama01.png':'라마 걷기','SC-Stone01.png':'발광 돌','SC-Pointer01.png':'반투명 화살표','SC-Candle01.png':'촛대 불꽃','SC-Lamp01.png':'색별 등불','SC-Santa01.png':'산타 걷기','SC-Santa02.png':'짐을 든 산타 걷기','SC-ChristmasTree01.png':'트리 점멸·장식 단계','SC-Skeleton01.png':'매달린 해골 표정','SC-Book02.png':'책의 색·펼침 상태','SC-Mushroom01.png':'버섯 묶음','SC-Pictures01.png':'벽 액자 묶음','SC-Noren01.png':'넓은 노렌 정적 상태','SC-Noren02.png':'좁은 노렌 정적 상태','SC-Labo01.png':'과학실 표본병·모형','SC-Labo02.png':'과학실 실험 용기','SC-Car01.png':'흰색·빨간 차 측면 바퀴','SC-Car03.png':'노랑·파란 차 측면 바퀴','SC-Car02.png':'네 색 차 앞뒤 정적 그림','SC-SantaF01.png':'XP RTP 산타 여성 A','SC-SantaF02.png':'XP RTP 산타 여성 B','SC-CTsunagi01.png':'XP RTP 작업복 캐릭터','yaranaika.png':'XP RTP 벤치·캐릭터','SC-SantaC01.png':'XP RTP 산타 의상 편집 부품','SC-SantaC02.png':'XP RTP 산타 모자 편집 부품','SC-CFundosi01.png':'XP RTP 캐릭터 편집 부품','PikoC-Girl01.png':'Piko XP 소녀','PikoC-Teddy005.png':'Piko XP 곰'})
audit=[];packs=[]
for r in rows:
 name=r['filename'];identity={k:r[k]for k in ['filename','sha256','source_page','download_url']}
 if name in ['SC-Door-Ev01.png','SC-Door-Ev02.png']:
  audit.append({**identity,'status':'already-supported-door','catalog':'doors.json','countedAgain':False});continue
 path=downloads/'by-source'/unquote(urlparse(r['download_url']).path).removeprefix('/dotartworld/');assert hashlib.sha256(path.read_bytes()).hexdigest()==r['sha256']
 im=Image.open(path).convert('RGBA');w,h=im.size;fw,fh=w//4,h//4
 rects=[[c*fw,y*fh,fw,fh]for y in range(4)for c in range(4)];notes=[];placement='free-standing';mode='static'
 if name.startswith('SC-WallLion'):
  rects=[[x*32,0,32,128]for x in range(4)];notes.append('분수의 사자 머리·물줄기·물보라를 포함한 전체128px 열이다. 32px 행 분할 금지. 원본 아래 여백도 보존하며 실제 벽과 수면은 따로 저작한다.');placement='wall-mounted'
 if name in ['SC-Bd02.png','SC-Bd03.png']:rects=[[0,y*h//4,w,h//4]for y in range(4)];placement='wall-mounted'
 if name=='SC-Cupboard01.png':
  rects=[[x,y*96,64,96]for y in range(4)for x in [32,96,192,256]];notes.append('실제 찬장/책장 전체64px 폭은 x32/96/192/256에 있다. 시트 전체를96px폭4열로 나누면 책장이 잘린다.')
 if name=='SC-Set-Schl01.png':rects=[[0,0,64,128],[64,0,64,128]];notes.append('수도대와 열린 교문 한 쌍은 각각64×128 전체이다. 교문을 걷기 애니메이션으로 재생하지 않는다.')
 if name=='SC-Set-Schl02.png':rects=[[x,y*64,ww,64]for y in range(4)for x,ww in [(0,96),(96,32)]]
 if name=='SC-Labo03.png':rects=[[x*32,y*32,32,32]for y in range(4)for x in range(4)if not(x>=2 and y==3)]+[[64,96,64,32]];notes.append('오른쪽 아래 플라스크/가열 실험 장치는64×32 한 그림이다. 위 행의 별도 삼각대와 온도계를 함께 잘라 묶지 않는다.');placement='surface-prop'
 if name=='yaranaika.png':rects=[[0,0,64,64],[64,0,32,64],[0,64,64,64]]
 frames=[];coverage=Image.new('1',(w,h));cp=coverage.load();ip=im.load()
 for i,(x,y,ww,hh) in enumerate(rects):
  crop=im.crop((x,y,x+ww,y+hh));alpha=crop.getchannel('A');bbox=alpha.getbbox()
  frames.append({'index':i,'sourceRect':[x,y,ww,hh],'sourceAnchor':[ww/2,hh],'alphaBounds':list(bbox)if bbox else None,'nonTransparentPixels':sum(v>0 for v in alpha.getdata()),'pixelSha256':hashlib.sha256(crop.tobytes()).hexdigest()})
  for yy in range(y,y+hh):
   for xx in range(x,x+ww):cp[xx,yy]=1
 assert all(not ip[x,y][3]or cp[x,y]for y in range(h)for x in range(w)),name+' missing source pixels'
 variants=[]
 def add(ids,label,kind='static',direction=None,parts=None):
  assert all(frames[i]['nonTransparentPixels']for i in ids),(name,ids)
  variants.append({'id':f'variant-{len(variants)}','name':label,'kind':kind,'direction':direction,'parts':parts or [{'x':0,'y':0,'frames':ids}], 'frameTimingMs':120,'timingProvenance':'editor-example-not-author-rate'})
 def static(indices=None):
  for i in indices if indices is not None else range(len(frames)):
   if frames[i]['nonTransparentPixels']:add([i],f'정적 그림 {i}')
 if name in rowLoops:
  for y in range(4):add(list(range(y*4,y*4+4)),f'{["남","서","동","북"][y]}향 동작'if name in walking else f'변형 {y+1}', 'loop', ['south','west','east','north'][y]if name in walking else None)
 elif name=='SC-Owl02.png':
  static(range(8));add([8,9,10,11],'제자리 비행','loop');add([12,13,14,15],'우편 제자리 비행','loop');notes.append('위 두 행은 앉은 자세/방향별 정적 그림이다. 가지 받침과 실제 위치를 별도로 조립한다.')
 elif name=='SC-Lamp01.png':
  for y in range(3):add(list(range(y*4,y*4+4)),f'발광 색 {y+1}','loop')
  static(range(12,16))
 elif name in ['SC-Skeleton01.png','SC-Cupboard01.png']:
  for c in range(4):add([c,c+4,c+8,c+12],f'변형 {c+1}', 'loop'if name=='SC-Skeleton01.png'else'sequence')
 elif name.startswith('SC-WallLion'):add([0,1,2,3],'전체 물줄기','loop')
 elif name=='SC-ChristmasTree01.png':
  add([0,1,2,3],'장식 트리 점멸','loop');add([4,5,6,7],'선물 트리 점멸','loop');static(range(8,16));notes.append('3행은 장식 증가 단계로 각 정적 상태를 선택한다.4행은 제작자가 명시한 비애니메이션이다.')
 elif name=='SC-Polesign.png':add([0,1,2,3],'이발소 회전 폴사인','loop');static(range(4,16));notes.append('폴사인 첫 행만 회전한다. 아래 행의 계산기/공중전화/우체통은 정적 소품이다.')
 elif name=='SC-VdgMacine01.png':
  for y in range(4):
   for c in [0,2]:add([y*4+c,y*4+c+1],f'자판기 {y*2+c//2+1}','assembly',parts=[{'x':0,'y':0,'frames':[y*4+c]},{'x':1,'y':0,'frames':[y*4+c+1]}])
  notes.append('제작자가 두 이벤트 조립이라고 명시했다.32×96 왼쪽/오른쪽 조각을 같은 y, x와x+1에 함께 놓는다. 각 반쪽을 완전한 자판기로 노출하지 않는다.')
 elif name in ['SC-Car01.png','SC-Car03.png']:
  for y in range(4):add(list(range(y*4,y*4+4)),f'색/방향 행 {y+1}','loop','west'if y%2==0 else'east')
  notes.append('행은 차 색/좌우 방향, 열은 바퀴 회전 상태다. 실제 승차·충돌·이동은 별도 구현한다. 차량 문 개방으로 해석하지 않는다.')
 elif name=='SC-Car02.png':
  static(range(8))
  for v in variants:v['direction']='south'if v['parts'][0]['frames'][0]<4 else'north'
  notes.append('첫 행은 앞(남), 둘째 행은 뒤(북), 열은4차색이다. 아래 두 행은 빈 칸이다. 자동 애니메이션이 아니다.')
 else:static()
 if name.startswith('SC-Noren'):placement='wall-mounted';notes.append('chara02의 비애니메이션 자료다. 커튼 모양/색 상태를 자동 바람 애니메이션으로 가정하지 않는다.')
 if name in ['SC-Book02.png','SC-Labo01.png','SC-Labo02.png','SC-Labo03.png']:placement='surface-prop'
 if name=='SC-Pictures01.png':placement='wall-mounted'
 if name=='SC-Door-Evs01.png':placement='wall-mounted';notes.append('문이 아니라 층 표시기다. 각 프레임은 표시등 위치의 정적 상태이며 층번호 연결은 저작자가 지정한다. 엘리베이터 이동을 자동으로 구현하지 않는다.')
 if name in ['SC-SantaC01.png','SC-SantaC02.png','SC-CFundosi01.png']:notes.append('제작자가 편집용으로 제공한 캐릭터/모자 부품이다. 완성된 NPC로 간주하지 않는다.')
 slug=name.removesuffix('.png').lower().replace('sc-','').replace('pikoc-','piko-')
 restrictedFlag=name in restricted;maxw=max(f['sourceRect'][2]for f in frames);maxh=max(f['sourceRect'][3]for f in frames)
 for f in frames:
  ww,hh=f['sourceRect'][2:];f['atlasOffset']=[(maxw-ww)//2,maxh-hh]
 pack={'id':'paw-eventprop-'+slug,'name':'Pixel Art World · '+labels.get(name,name.removesuffix('.png')),'filename':name,'sourcePage':next(p for p in r['source_page'].split(' | ')if 'page3/chara'in p),'downloadUrl':r['download_url'],'sha256':r['sha256'],'termsUrl':base+'page1/rule.html','width':w,'height':h,'frameWidth':maxw,'frameHeight':maxh,'atlasColumns':4,'frames':frames,'variants':variants,'placement':placement,'notes':notes,'rights':{'profile':'rpg-maker-xp-owner-and-maker-project-only'if restrictedFlag else'yms-general','runtimeImportAllowed':not restrictedFlag,'sharedProjectDefaultsAllowed':not restrictedFlag,'redistributeArt':False,'credit':'Pixel Art World / ドット絵世界 · yms'+(' / Piko'if name.startswith('Piko')else''),'checkedAt':'2026-09-24','reason':'RTP改変素材: XP所有者限定。一般規約のツクール専用マークはツクールシリーズ利用のゲーム制作に限定。OPRNゲームへの使用許可を意味しない。'if restrictedFlag else'No RPG Maker-only marker at this source; source pixels remain user-local.'}}
 packs.append(pack);audit.append({**identity,'packId':pack['id'],'status':'restricted-analysis-only'if restrictedFlag else'supported','variants':len(variants),'frames':len(frames)})
result={'schemaVersion':1,'sources':audit,'packs':packs,'excludedLinks':[{'filename':'SC-Funassi01.png','status':'catalog-character-exclusion','reason':'Existing download catalog excluded this third-party character; not one of the50 downloaded originals.'}]}
for path in ['tiledata/pixel-art-world/eventprops.json','src/assets/pixelArtWorldEventProps.json']:(root/path).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('sources',len(audit),'general',sum(p['rights']['runtimeImportAllowed']for p in packs),'restricted',sum(not p['rights']['runtimeImportAllowed']for p in packs),'variants',sum(len(p['variants'])for p in packs))
