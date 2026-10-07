"""Round 8: eight plain houses, one roof mass each, side wings never overlap the main roof.
Replaces the withdrawn round-7 collages. Same native parts and facade grids as round 7.
Run `python3 author_round8.py` to author drafts; `--merge` appends them to seed.json (do that only
when no gate/publish run is in progress: publish requires every active seed id to have a draft).
"""
from pathlib import Path
import json,hashlib,sys
from PIL import Image
import author_round6 as old
import author_round7 as r7
from native_author import ROOT
SOURCE=ROOT/'harness-data/beodeul-building-review'
W,R=r7.W,r7.R
PLANS=[
 (1,'박공 앞면 이층집',64,144,[W([0,80],['stts','sbDs']),R('gable',[0,16])]),
 (2,'금빛 기와 사각 지붕집',128,144,[W([0,80],['stbwwbts','sbwwDwbs']),R('hip',[0,16],128,'gold')]),
 (3,'좁고 높은 청회색 삼층집',80,176,[W([0,80],['sttts','sxwxs','sbDbs']),R('hip',[0,16],80,'slate')]),
 (4,'높이가 다른 연립 두 채',144,160,[W([0,64],['stts','swws','sbDs']),R('gable',[0,0]),W([64,96],['sbtbs','sbwws']),R('hip',[64,32],80)]),
 (5,'청회색 본채와 낮은 곁채',160,144,[W([0,80],['stbwts','sbwDws']),R('hip',[0,16],96,'slate'),W([96,112],['sbts']),R('gable',[96,48])]),
 (6,'돌벽 박공 이층집',64,144,[W([0,80],['stts','sbDs'],'stone'),R('gable',[0,16],kind='stone')]),
 (7,'돌벽 올리브 지붕집',96,144,[W([0,80],['stbbts','sbDbbs'],'stone'),R('hip',[0,16],96,'olive')]),
 (8,'왼쪽 곁채가 붙은 집',160,144,[W([64,80],['stbbts','sbbwbs']),R('hip',[64,16],96,'olive'),W([0,112],['sbDs']),R('gable',[0,48])]),
]
def author():
 records=[]
 for n,name,w,h,steps in PLANS:
  rec={'id':f'r8-building-{n:02}','name':name,'width':w,'height':h,'inspiration':'round 6 허용작과 같은 규칙: 지붕 덩어리 하나, 곁채는 본채 지붕과 겹치지 않음','parts':[],'roofs':[],'steps':steps}
  r7.rec=rec;old.current=rec;im=Image.new('RGBA',(w,h))
  for st in steps:
   if st[0]=='wall':r7.wall(im,*st[1:])
   elif st[0]=='roof':r7.roof(im,*st[1:])
  if len(rec.get('doors',[]))!=1:raise ValueError((name,rec.get('doors')))
  rec['entrance']=rec['doors'][0]
  colors=sorted(set(im.getdata()));sym={c:'p'+str(i) for i,c in enumerate(colors)}
  rec['palette']={sym[c]:bytes(c).hex() for c in colors};rec['rows']=[' '.join(sym[im.getpixel((x,y))] for x in range(w)) for y in range(h)]
  path=ROOT/'public/assets/beodeul-architecture'/('review-'+rec['id']+'.png');im.save(path);rec['sourcePngHash']=hashlib.sha256(path.read_bytes()).hexdigest();records.append(rec)
 SOURCE.joinpath('round8-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
 candidates=[]
 for r in records:
  asset='review-'+r['id'];candidates.append({'id':r['id'],'name':r['name'],'role':'주택','width':r['width'],'height':r['height'],'authoring':'native-parts','reference':'arch:cream','components':[{'source':'arch:'+asset,'rect':[0,0,r['width'],r['height']],'at':[0,0],'replace':False}],'entrance':r['entrance'],'description':r['name']+' · 지붕 하나가 분명히 읽히는 단순한 주택. 출입문은 한 곳이며 벽 재질을 통일했습니다.','lighting':'원본 왼쪽 위 광원','perspective':'3/4 탑뷰 · 지붕 윗면과 남쪽 정면','source':'authored-native-grid/round-8','silhouette':r['name'],'round':8,'nativeAssetHashes':{asset:r['sourcePngHash']}})
 SOURCE.joinpath('round8-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
 print('Authored',len(records),'round-8 candidates; seed unchanged')
def merge():
 seed=json.loads((SOURCE/'seed.json').read_text());cands=json.loads((SOURCE/'round8-candidates.json').read_text())
 seed['candidates']=[c for c in seed['candidates'] if not c['id'].startswith('r8-')]+cands;seed['round']=8
 (SOURCE/'seed.json').write_text(json.dumps(seed,ensure_ascii=False,indent=2)+'\n');print('seed now',len(seed['candidates']),'candidates')
if __name__=='__main__':
 merge() if '--merge' in sys.argv else author()
