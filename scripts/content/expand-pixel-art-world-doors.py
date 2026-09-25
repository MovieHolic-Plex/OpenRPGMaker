"""Rebuild reviewed additions from user-owned PNGs. Never copies artwork into the repository.
Usage: python3 scripts/content/expand-pixel-art-world-doors.py /path/to/downloads
"""
import csv, hashlib, json, sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1])
DEST = ROOT / 'tiledata/pixel-art-world/doors.json'
packs = json.loads(DEST.read_text())
# Preserve the original nine identities and frame arrays exactly.
original = {'Schl01','Schl02','SchlG01','SchlW01','SchlW02','Tolt01','Tolt02','Convi01','Convi02'}
packs = [p for p in packs if p['filename'].removeprefix('SC-Door-').removesuffix('.png') in original]
assert len(packs) == 9
rows = list(csv.DictReader((ROOT/'tiledata/pixel-art-world/download-catalog/direct-downloads.csv').open(encoding='utf-8-sig')))
rows = [r for r in rows if r['category']=='door_sprite']
hold = {'SC-Door-'+n+'.png' for n in ['WF01','WF02','WS01','WS02','WS03']}
audit=[]
labels={'Entce01':'유리 출입문','Entce02':'어두운 유리 출입문','Entce03':'극장 양문','Entce04':'병원 양문', 'Arch01':'아치 문과 정적 출입구','I01':'개인방 목재문','Metal01':'금속문 · 어두운 배경','Metal02':'금속문 · 밝은 배경','Metal03':'금속문 · 투명 개구부','Dg01':'하수도 격자문','Pri01':'철창 미닫이문','JP01':'일본풍 외관문 A','JP02':'일본풍 외관문 B','U01':'목욕탕 미닫이문과 정적 노렌','Cl01':'목재 미닫이문','Ruins01':'유적 석문','Ev01':'엘리베이터 외부문','Ev02':'엘리베이터 내부문','gate-euro03':'장식 양문 · 3열 규격'}
for r in rows:
 name=r['filename']; identity={k:r[k] for k in ['filename','sha256','download_url','source_page']}
 if not r['local_path']:
  audit.append({**identity,'status':'missing-source','reason':'Author link SC-Door-Schl03.png returns 404; not an alias for SchlG01.'});continue
 if name in hold:
  audit.append({**identity,'status':'rights-hold','reason':'door02 attributes these five sheets to Atelier Yaoyorozu. The linked contributor site returned 503 on 2026-09-24; separate contributor terms could not be verified. Yms terms describe yms copyright, so no broader grant is inferred.','contributor':'アトリエ・ヤオヨロヅ','contributorUrl':'http://atelieryaoyorozu.web.fc2.com/','width':int(r['width']),'height':int(r['height']),'observedGeometry':{'columns':4,'rows':4,'sequence':'vertical four opening states; columns select panel/side variants'}});continue
 if name=='SC-Door-Evs01.png':
  audit.append({**identity,'status':'excluded-non-door','reason':'chara01 explicitly identifies this as the elevator floor indicator, not a door. Outside this door-only importer.'});continue
 existing=next((p for p in packs if p['filename']==name),None)
 if existing:
  audit.append({**identity,'status':'supported','packId':existing['id'],'batch':'original-nine'});continue
 path=SOURCE/'by-source'/unquote(urlparse(r['download_url']).path).removeprefix('/dotartworld/')
 assert hashlib.sha256(path.read_bytes()).hexdigest()==r['sha256'],name
 im=Image.open(path).convert('RGBA'); width,height=im.size
 columns=3 if name=='!$Gate-Euro03.png' else 4; rowsCount=4
 fw,fh=width//columns,height//4;assert fw*columns==width and fh*4==height
 frames=[]
 for index in range(columns*4):
  x,y=index%columns*fw,index//columns*fh; crop=im.crop((x,y,x+fw,y+fh));alpha=crop.getchannel('A')
  frames.append({'index':index,'sourceRect':[x,y,fw,fh],'alphaBounds':alpha.getbbox(),'nonTransparentPixels':sum(v>0 for v in alpha.getdata()),'pixelSha256':hashlib.sha256(crop.tobytes()).hexdigest()})
 variants=[];excluded=[]
 def variant(c,seq,label,kind='animated'):
  assert all(frames[i]['nonTransparentPixels'] for i in seq),(name,seq)
  assert kind=='static' or len({frames[i]['pixelSha256'] for i in seq})==4,(name,seq)
  variants.append({'id':f'column-{c}' if kind=='animated' else f'static-{seq[0]}','name':label,'kind':kind,'sourceColumn':c,'openingFrames':seq,'closingFrames':list(reversed(seq)),'placement':'manual-event-graphic','frameTimingMs':100,'timingProvenance':'editor-example-not-author-specified'})
 notes=['원본 여백과 row-major 프레임 번호를 보존합니다. 단발 그림 명령은 충돌·이동·스위치를 설치하지 않습니다.']
 for c in range(columns):
  seq=[c+columns*r for r in range(4)]
  if name=='SC-Door-Arch01.png' and c<2:
   for row,i in enumerate(seq):variant(c,[i],f'정적 아치 {c+1} · 상태 {row+1}','static')
   continue
  if name=='SC-Door-U01.png' and c==2:
   for i,label in zip(seq[:3],['ゆ 노렌','男 노렌','女 노렌']):variant(c,[i],label+' · 정적 출입구 장식','static')
   continue
  if name=='SC-Door-Ruins01.png' and c==3:
   excluded.extend({'index':i,'reason':'Statue/pedestal, not a door.'} for i in seq);continue
  if name=='SC-Door-Ruins01.png' and c==2:
   seen=set()
   for i in seq:
    h=frames[i]['pixelSha256']
    if h in seen:excluded.append({'index':i,'reason':'Duplicate closed-door state; no opening animation inferred.'});continue
    seen.add(h);variant(c,[i],f'봉인 석문 · 정적 상태 {i//columns+1}','static')
   continue
  if all(frames[i]['nonTransparentPixels'] for i in seq):variant(c,seq,f'문 {c+1} · 닫힘→열림')
  else:assert all(not frames[i]['nonTransparentPixels'] for i in seq), (name,seq)
 if name=='SC-Door-Arch01.png':notes.append('제작자가 왼쪽 두 열은 애니메이션이 아니라고 명시했습니다. 8개 정적 상태와 오른쪽 두 문의 개방을 구분합니다.')
 if name=='SC-Door-U01.png':notes.append('0·1열만 개방 문입니다. 2열의 서로 다른 노렌 글자를 애니메이션으로 재생하지 않습니다.')
 if name=='SC-Door-Ruins01.png':notes.append('0·1열만 문 개방입니다. 2열은 닫힌 봉인 상태이며, 3열 조각상/받침은 문 범위 밖이라 제외합니다.')
 if columns==3:notes.append('240×256 원본은 80×64 프레임의 3열×4행입니다. 0열 [0,3,6,9]만 문이며 다른 두 열은 비어 있습니다. VX 파일명으로 XP 4열 규칙을 적용하지 않습니다.')
 slug=name.removeprefix('SC-Door-').removeprefix('SC-Door').removesuffix('.png').lower() if columns==4 else 'gate-euro03'
 stem=name.removeprefix('SC-Door-').removeprefix('SC-Door').removesuffix('.png') if columns==4 else 'gate-euro03'
 sourcepages=r['source_page'].split(' | ')
 page=next((p for p in sourcepages if '/page3/door' in p),sourcepages[0])
 p={'id':'paw-door-'+slug,'name':'Pixel Art World · '+labels.get(stem, '자동문 '+stem if stem.startswith('Auto') else '실내문 '+stem),'filename':name,'downloadUrl':r['download_url'],'sourcePage':page,'termsUrl':'https://yms.main.jp/dotartworld/page1/rule.html','sha256':r['sha256'],'width':width,'height':height,'frameWidth':fw,'frameHeight':fh,'columns':columns,'rows':4,'frames':frames,'variants':variants,'emptyFrameIndices':[f['index'] for f in frames if not f['nonTransparentPixels']],'excludedFrames':excluded,'credit':'Pixel Art World / ドット絵世界 · yms (https://yms.main.jp/dotartworld/)','rights':dict(packs[0]['rights']),'notes':notes}
 packs.append(p);audit.append({**identity,'status':'supported','packId':p['id'],'batch':'expanded','columns':columns,'rows':4,'animatedVariants':sum(v['kind']=='animated' for v in variants),'staticVariants':sum(v['kind']=='static' for v in variants)})
DEST.write_text(json.dumps(packs,ensure_ascii=False,indent=2)+'\n')
(ROOT/'tiledata/pixel-art-world/doors-audit.json').write_text(json.dumps({'checkedAt':'2026-09-24','scope':'All 50 door_sprite catalog links: 49 downloaded originals plus one dead author link.','sources':audit},ensure_ascii=False,indent=2)+'\n')
print(len(packs),'supported sources',sum(len(p['variants']) for p in packs),'variants',len(audit),'catalog rows')
