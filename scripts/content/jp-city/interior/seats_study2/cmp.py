# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,json,os
sys.path.insert(0,'/tmp/seats34')
import extract
from PIL import Image,ImageDraw
def load(spec):
  # spec: ["label","tileset","prop"] or ["label","png path"]
  if len(spec)==2: return spec[0],Image.open(spec[1]).convert('RGBA')
  return spec[0],extract.render(spec[1],spec[2])
def sheet(specs,out,s=8):
  ims=[load(x) for x in specs]
  W=sum(max(i.width*s, 140)+i.width+24 for _,i in ims); H=max(i.height for _,i in ims)*s+24
  C=Image.new('RGBA',(W,H),(30,32,38,255)); d=ImageDraw.Draw(C); x=4
  for l,i in ims:
    b=extract.bg(i.width,i.height,s); b.alpha_composite(i.resize((i.width*s,i.height*s),Image.NEAREST)); C.alpha_composite(b,(x,20))
    b1=extract.bg(i.width,i.height,1); b1.alpha_composite(i); C.alpha_composite(b1,(x+i.width*s+6,20))
    d.text((x,4),l[:26],fill='white',font=extract.font); x+=max(i.width*s,140)+i.width+24
  C.save(out)
if __name__=='__main__': sheet(json.load(open(sys.argv[1])),sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 8)
