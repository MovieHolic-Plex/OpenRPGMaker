# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,os,json;sys.path.insert(0,'/tmp/seats34');import cmp
from PIL import Image
C='/home/main/z-project/rpg-zzu-interior-seats-34/tiledata/hand-interior/pick/candidates/'
def make(name,ids,s,per):
  rows=[[['POS chair S',C+'chair_S/v5.png'],['POS hs-bench-row-s','jp_city_interior','hs-bench-row-s']]]
  for k in range(0,len(ids),per):
    r=[]
    for i in ids[k:k+per]: r+= [['OLD '+i,'mc/b_'+i+'.png'],['NEW '+i,'out/batch/'+i+'.png']]
    rows.append(r)
  ims=[]
  for j,r in enumerate(rows):
    cmp.sheet(r,f'/tmp/mcrow{j}.png',s if j else 7); ims.append(Image.open(f'/tmp/mcrow{j}.png'))
  W=max(i.width for i in ims); H=sum(i.height for i in ims)
  out=Image.new('RGBA',(W,H),(30,32,38,255)); y=0
  for i in ims: out.paste(i,(0,y)); y+=i.height
  out.save(name); print(name,out.size)
G=json.load(open('mc/groups.json'))
for n,(ids,s,per) in G.items(): make(f'mc/j-{n}.png',ids,s,per)
