"""Round 9: the 19 pending designs (round 7 keepers + round 8) rebuilt on a native-cell facade.

User review 2026-10-07: "windows are oddly placed in too many houses". Cause: rounds 7/8 mixed three window styles
(small shuttered corner pane, gold-framed lancet, shuttered glass), pressed lancets side by side with no timber post
between, put panes into corner posts, and repeated the eave-shadow band on every storey.
The originals (arch:brick, arch:church) show the rule: ONE window style, one per bay between timber posts, never in a
corner or next to a door, eave shadow only under the roof. Every facade cell here is a 16x32 crop of those originals.
Letters: e end post, w plain, b brace, v window, D door. Roofs/towers are the same native parts as round 7.
"""
from pathlib import Path
import json,hashlib,sys
from PIL import Image
import author_round6 as old
import author_round7 as r7
from native_author import ROOT
SOURCE=ROOT/'harness-data/beodeul-building-review'
# plaster cells from arch:brick. A = row under the roof / upper storeys (eave shadow + floor ledge), B = ground storey (foundation).
PLASTER={'A':{'eL':[0,64,16,96],'eR':[96,64,112,96],'w':[0,64,16,96],'bL':[32,64,48,96],'bR':[64,64,80,96],'v':[16,64,32,96]},
         'B':{'eL':[0,96,16,128],'eR':[96,96,112,128],'w':[0,96,16,128],'bL':[16,96,32,128],'bR':[48,96,64,128],'v':[64,96,80,128],'D':[32,96,48,128]}}
# stone cells from arch:church (narrow tall windows only).
STONE={'A':{'e':[80,144,96,176],'w':[80,144,96,176],'b':[80,144,96,176],'v':[64,144,80,176]},
       'B':{'e':[80,176,96,208],'w':[80,176,96,208],'b':[80,176,96,208],'v':[64,176,80,208],'D':[112,176,128,208]}}
def part(im,key,rect,at):r7.part(im,key,rect,at,True)
def wall9(im,at,rows,kind='plaster'):
    rec=r7.rec;n=len(rows[0]);assert all(len(r)==n for r in rows),rows
    x0,y0=at
    for j,row in enumerate(rows):
        y=y0+j*32;ground=(y+32==im.height);tier='B' if ground else 'A'
        for k,c in enumerate(row):
            x=x0+k*16
            if kind=='stone':
                cells=STONE[tier];key='arch:church'
                rect=cells[c if c in cells else 'w']
            else:
                cells=PLASTER[tier];key='arch:brick'
                if c=='e':rect=cells['eL' if k==0 else 'eR']
                elif c=='b':rect=cells['bL' if k<n/2 else 'bR']
                else:rect=cells[c]
            if c=='D':
                assert ground and k not in (0,n-1)
                rec.setdefault('doors',[]).append({'x':x,'y':y,'w':16,'h':32})
            if c=='v':assert 0<k<n-1,'window in a corner post: '+row
            if k>0 and row[k-1]=='D' and c=='v':raise ValueError('window beside door: '+row)
            if k<n-1 and row[k+1]=='D' and c=='v':raise ValueError('window beside door: '+row)
            part(im,key,rect,[x,y])
    rec.setdefault('facades',[]).append({'at':at,'rows':rows,'cell':[16,32],'material':kind,'source':'arch:brick' if kind!='stone' else 'arch:church'})
W9=lambda at,rows,kind='plaster':['wall9',at,rows,kind]
R=r7.R
# (name,width,height,from,steps) — footprints and roofs unchanged from the rounds they replace.
PLANS=[
 ('작은 돌집',64,112,'r7-01',[W9([0,80],['ebDe'],'stone'),R('gable',[0,16],kind='stone')]),
 ('길게 누운 지붕의 농가',128,112,'r7-02',[W9([0,80],['evbbDbve']),R('hip',[0,16],128,'olive')]),
 ('높은 본채와 낮은 부엌집',144,144,'r7-03',[W9([64,112],['evbve']),W9([0,80],['evve','ebDe']),R('hip',[64,48],80),R('gable',[0,16])]),
 ('가운데 박공이 솟은 상인집',160,160,'r7-04',[W9([0,96],['evbvbvbvbe','ebbvbDbvbe']),R('hip',[0,32],160,'slate'),W9([48,64],['evve']),R('gable',[48,0])]),
 ('삼층 주택',96,176,'r7-06',[W9([0,80],['evbbve','evbbve','ebbDbe']),R('hip',[0,16],96,'slate')]),
 ('높은 돌집과 낮은 살림채',160,192,'r7-07',[W9([0,160],['evbbDbbbve'],'stone'),R('hip',[0,96],160,'slate'),W9([96,64],['evve','evve','evve','evve'],'stone'),R('gable',[96,0],kind='stone')]),
 ('두 박공 사이의 넓은 집',160,160,'r7-08',[W9([0,96],['evbvbbvbve','ebvbbDbvbe']),R('hip',[0,32],160),W9([0,64],['evve']),W9([96,64],['evve']),R('gable',[0,0]),R('gable',[96,0])]),
 ('긴 맨사드 지붕의 연립집',176,160,'r7-09',[W9([0,96],['evbvbbbvbve','evbbvbDbvbe']),R('mansard',[0,0],176)]),
 ('종 지붕 탑이 붙은 집',144,160,'r7-17',[W9([0,128],['evbDbe']),R('hip',[0,64],96,'gold'),['tower',[80,16],'bell']]),
 ('꺾인 너와와 낮은 기와채',176,144,'r7-22',[W9([0,80],['evbbvb','ebbDbb']),W9([96,112],['bvbve']),R('hip',[96,48],80,'gold'),R('gambrel',[0,16])]),
 ('종 지붕 다락을 얹은 집',128,176,'r7-24',[W9([32,72],['evve']),R('bell',[32,16]),W9([0,144],['evbbDbve']),R('hip',[0,80],128,'olive')]),
 ('박공 앞면 이층집',64,144,'r8-01',[W9([0,80],['evve','ebDe']),R('gable',[0,16])]),
 ('금빛 기와 사각 지붕집',128,144,'r8-02',[W9([0,80],['ebvbvbve','ebvbDbve']),R('hip',[0,16],128,'gold')]),
 ('좁고 높은 청회색 삼층집',80,176,'r8-03',[W9([0,80],['evbve','evbve','ebDbe']),R('hip',[0,16],80,'slate')]),
 ('높이가 다른 연립 두 채',144,160,'r8-04',[W9([0,64],['evve','evve','ebDe']),R('gable',[0,0]),W9([64,96],['evbve','evbve']),R('hip',[64,32],80)]),
 ('청회색 본채와 낮은 곁채',160,144,'r8-05',[W9([0,80],['evbbve','ebbDbe']),R('hip',[0,16],96,'slate'),W9([96,112],['evve']),R('gable',[96,48])]),
 ('돌벽 박공 이층집',64,144,'r8-06',[W9([0,80],['evve','ebDe'],'stone'),R('gable',[0,16],kind='stone')]),
 ('돌벽 올리브 지붕집',96,144,'r8-07',[W9([0,80],['evbbve','ebbDbe'],'stone'),R('hip',[0,16],96,'olive')]),
 ('왼쪽 곁채가 붙은 집',160,144,'r8-08',[W9([64,80],['evbbve','evbbve']),R('hip',[64,16],96,'olive'),W9([0,112],['ebDe']),R('gable',[0,48])]),
]
def render(name,w,h,steps):
    rec={'name':name,'width':w,'height':h,'parts':[],'roofs':[],'steps':steps};r7.rec=rec;old.current=rec;im=Image.new('RGBA',(w,h))
    for st in steps:
        if st[0]=='wall9':wall9(im,*st[1:])
        elif st[0]=='roof':r7.roof(im,*st[1:])
        elif st[0]=='tower':
            at,style=st[1:]
            r7.part(im,'arch:review-r5-mill-round-roof',[0,0,64,144],tuple(at))
            r7.part(im,'arch:review-r6-building-10',[0,0,64,56],tuple(at),True)
            r7.part(im,'arch:review-r6-building-10',[22,108,42,144],(at[0]+22,at[1]+108),True)
            if style=='bell':r7.part(im,'arch:review-r6-building-05',[0,0,64,56],tuple(at),True)
    if len(rec.get('doors',[]))!=1:raise ValueError((name,rec.get('doors')))
    return rec,im
def author():
    records=[]
    for n,(name,w,h,src,steps) in enumerate(PLANS,1):
        rec,im=render(name,w,h,steps);rec['id']=f'r9-building-{n:02}';rec['replaces']=src;rec['entrance']=rec['doors'][0]
        colors=sorted(set(im.getdata()));sym={c:'p'+str(i) for i,c in enumerate(colors)}
        rec['palette']={sym[c]:bytes(c).hex() for c in colors};rec['rows']=[' '.join(sym[im.getpixel((x,y))] for x in range(w)) for y in range(h)]
        path=ROOT/'public/assets/beodeul-architecture'/('review-'+rec['id']+'.png');im.save(path);rec['sourcePngHash']=hashlib.sha256(path.read_bytes()).hexdigest();records.append(rec)
    SOURCE.joinpath('round9-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2,default=str)+'\n')
    cands=[]
    for r in records:
        asset='review-'+r['id'];cands.append({'id':r['id'],'name':r['name'],'role':'주택','width':r['width'],'height':r['height'],'authoring':'native-parts','reference':'arch:cream','components':[{'source':'arch:'+asset,'rect':[0,0,r['width'],r['height']],'at':[0,0],'replace':False}],'entrance':r['entrance'],'description':r['name']+' · 원본 칸(brick·church)만 쓴 창: 한 종류, 칸마다 가운데 하나, 모서리·문 옆 없음. 출입문은 한 곳.','lighting':'원본 왼쪽 위 광원','perspective':'3/4 탑뷰 · 지붕 윗면과 남쪽 정면','source':'authored-native-grid/round-9','silhouette':r['name'],'round':9,'replaces':r['replaces'],'nativeAssetHashes':{asset:r['sourcePngHash']}})
    SOURCE.joinpath('round9-candidates.json').write_text(json.dumps(cands,ensure_ascii=False,indent=2)+'\n')
    print('Authored',len(records),'round-9 candidates; seed unchanged')
if __name__=='__main__':author()
