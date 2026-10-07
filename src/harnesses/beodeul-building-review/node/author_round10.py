"""Round 10: log cabins, every piece a native cell of the beodeul_city log kits (bd-out-cabin, bd-out-cabin-small, bd-out-log-*).
User 2026-10-07: "통나무 집 뭐 이런건 없는건가". Roofs/gables are cut from the two native cabins; walls are 16x32 log cells.
Letters: l/r corner log ends, w plain log wall, v window, x window with flower box, s shuttered window,
d/g/b/R door (brown/green/blue/red). Exactly one door; windows never in a corner or beside the door (same rule as round 9).
"""
import json,hashlib,sys
from PIL import Image
import author_round6 as old
import author_round7 as r7
from native_author import ROOT
SOURCE=ROOT/'harness-data/beodeul-building-review'
CELL={'l':'bd-out-log-l','r':'bd-out-log-r','w':'bd-out-log-wall','v':'bd-out-log-window','x':'bd-out-log-window-box','s':'bd-out-log-window-shut',
      'd':'bd-out-log-door','g':'bd-out-log-door-green','b':'bd-out-log-door-blue','R':'bd-out-log-door-red',
      'W':'bd-out-logg-wall','V':'bd-out-logg-window','L':'bd-out-logg-l','Q':'bd-out-logg-r','D':'bd-out-logg-door'}
DOORS='dgbRD';WINS='vxsV'
def wall(im,y,row):
    rec=r7.rec
    assert row[0] in 'lL' and row[-1] in 'rQ',row
    for k,c in enumerate(row):
        if c in WINS:
            assert 0<k<len(row)-1,'window in a corner: '+row
            assert row[k-1] not in DOORS and row[k+1] not in DOORS,'window beside door: '+row
        if c in DOORS:rec.setdefault('doors',[]).append({'x':k*16,'y':y,'w':16,'h':32})
        r7.part(im,CELL[c],[0,0,16,32],[k*16,y],True)
    rec.setdefault('facades',[]).append({'y':y,'row':row,'cell':[16,32],'material':'log'})
def roof(im,key,h):r7.part(im,key,[0,0,{'bd-out-cabin':80,'bd-out-cabin-small':64}[key],h],[0,0],False)
PLANS=[
 ('통나무 오두막',80,96,[('native','bd-out-cabin')]),
 ('작은 통나무집',64,64,[('native','bd-out-cabin-small')]),
 ('초록 문 통나무집',80,96,[('roof','bd-out-cabin',64),('wall',64,'lwgwr')]),
 ('통나무 이층집',80,128,[('roof','bd-out-cabin',64),('wall',64,'lvwvr'),('wall',96,'lwdwr')]),
 ('꽃창이 있는 통나무 이층집',80,128,[('roof','bd-out-cabin',64),('wall',64,'lxwxr'),('wall',96,'lwRwr')]),
 ('덧문 통나무 이층집',80,128,[('roof','bd-out-cabin',64),('wall',64,'lswsr'),('wall',96,'lwbwr')]),
 ('작은 통나무 이층집',64,96,[('roof','bd-out-cabin-small',32),('wall',32,'lvwr'),('wall',64,'lwdr')]),
]
def author():
    records=[]
    for n,(name,w,h,steps) in enumerate(PLANS,1):
        rec={'id':f'r10-building-{n:02}','name':name,'width':w,'height':h,'parts':[],'roofs':[],'steps':[list(map(str,s)) for s in steps]};r7.rec=rec;old.current=rec;im=Image.new('RGBA',(w,h))
        for s in steps:
            if s[0]=='native':r7.part(im,s[1],[0,0,w,h],[0,0],False)
            elif s[0]=='roof':roof(im,s[1],s[2])
            elif s[0]=='wall':wall(im,s[1],s[2])
        if s[0]=='native':
            # the native cabins carry their own door; record it so the single-door contract is checkable
            rec['doors']=[{'x':32,'y':64,'w':16,'h':32}] if 'small' not in s[1] else [{'x':16,'y':32,'w':16,'h':32}]
        if len(rec['doors'])!=1:raise ValueError((name,rec['doors']))
        rec['entrance']=rec['doors'][0]
        colors=sorted(set(im.getdata()));sym={c:'p'+str(i) for i,c in enumerate(colors)}
        rec['palette']={sym[c]:bytes(c).hex() for c in colors};rec['rows']=[' '.join(sym[im.getpixel((x,y))] for x in range(w)) for y in range(h)]
        path=ROOT/'public/assets/beodeul-architecture'/('review-'+rec['id']+'.png');im.save(path);rec['sourcePngHash']=hashlib.sha256(path.read_bytes()).hexdigest();records.append(rec)
    SOURCE.joinpath('round10-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2,default=str)+'\n')
    cands=[]
    for r in records:
        asset='review-'+r['id'];cands.append({'id':r['id'],'name':r['name'],'role':'주택','width':r['width'],'height':r['height'],'authoring':'native-parts','reference':'arch:cream','components':[{'source':'arch:'+asset,'rect':[0,0,r['width'],r['height']],'at':[0,0],'replace':False}],'entrance':r['entrance'],'description':r['name']+' · 버들항 통나무 키트(bd-out-cabin·bd-out-log-*) 칸만 사용. 문은 한 곳, 창은 모서리·문 옆 없음.','lighting':'원본 왼쪽 위 광원','perspective':'3/4 탑뷰 · 지붕 윗면과 남쪽 정면','source':'authored-native-grid/round-10','silhouette':r['name'],'round':10,'nativeAssetHashes':{asset:r['sourcePngHash']}})
    SOURCE.joinpath('round10-candidates.json').write_text(json.dumps(cands,ensure_ascii=False,indent=2)+'\n')
    print('Authored',len(records),'round-10 candidates; seed unchanged')
if __name__=='__main__':author()
