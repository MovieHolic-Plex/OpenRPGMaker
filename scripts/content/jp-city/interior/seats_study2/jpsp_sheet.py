# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,json
sys.path.insert(0,'/tmp/seats34'); import cmp, extract
from PIL import Image,ImageDraw
def sheet(ids,out,s=6,maxw=1900):
  specs=[['POS chair S','/home/main/z-project/rpg-zzu-interior-seats-34/tiledata/hand-interior/pick/candidates/chair_S/v5.png'],['POS hs-bench-row-s','jp_city_interior','hs-bench-row-s']]
  for i in ids: specs+=[['OLD '+i,'jp_city_interior',i],['NEW '+i,'/tmp/seats34/study2/out/batch/'+i+'.png']]
  ims=[cmp.load(x) for x in specs]
  cells=[];x=4;y=0;rowh=0;rows=[]
  for k,(l,i) in enumerate(ims):
    cw=max(i.width*s,150)+i.width+24
    if (x+cw>maxw) or k==2: y+=rowh;x=4;rowh=0
    cells.append((l,i,x,y)); x+=cw; rowh=max(rowh,i.height*s+26)
  H=y+rowh; C=Image.new('RGBA',(maxw,H),(30,32,38,255)); d=ImageDraw.Draw(C)
  for l,i,x,y in cells:
    b=extract.bg(i.width,i.height,s); b.alpha_composite(i.resize((i.width*s,i.height*s),Image.NEAREST)); C.alpha_composite(b,(x,y+20))
    b1=extract.bg(i.width,i.height,1); b1.alpha_composite(i); C.alpha_composite(b1,(x+i.width*s+6,y+20))
    d.text((x,y+4),l[:30],fill='white',font=extract.font)
  C.save(out); print(out,C.size)
if __name__=='__main__': sheet(sys.argv[2].split(','),sys.argv[1],int(sys.argv[3]) if len(sys.argv)>3 else 6)
