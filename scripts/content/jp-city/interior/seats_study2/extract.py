# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import json,re,sys,os
from PIL import Image,ImageDraw,ImageFont
R=os.environ.get('ROOT','/home/main/z-project/rpg-zzu-interior-seats-34')
spec={'jp_city_interior':('jpInteriorSpec','public/assets/jp-city/jp-city-chipset.png'),
 'modern_city_interior':('modernCityRoomSpec','public/assets/modern-city/modern-city-chipset.png'),
 'atlas_biome_interior':('handInteriorSpec','public/assets/atlas-interior/interior-chipset.png')}
S={k:(json.load(open(f'{R}/src/assets/{a}.json')),Image.open(f'{R}/{b}').convert('RGBA')) for k,(a,b) in spec.items()}
def render(ts,pid):
  sp,im=S[ts]; tpr=im.width//16
  cells=sp['objects'][pid]['cells']
  xs=[c[0] for c in cells]; ys=[c[1] for c in cells]
  mx,my=min(xs),min(ys)
  out=Image.new('RGBA',((max(xs)-mx+1)*16,(max(ys)-my+1)*16))
  for dx,dy,tid,l in sorted(cells,key=lambda c:(c[3],c[1],c[0])):
    t=im.crop(((tid%tpr)*16,(tid//tpr)*16,(tid%tpr)*16+16,(tid//tpr)*16+16)); out.alpha_composite(t,((dx-mx)*16,(dy-my)*16))
  return out
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
def bg(w,h,s):
  b=Image.new('RGBA',(w*s,h*s),(196,170,130,255)); d=ImageDraw.Draw(b)
  for y in range(h):
    for x in range(w):
      if (x//4+y//4)%2: d.rectangle([x*s,y*s,x*s+s-1,y*s+s-1],fill=(186,160,120,255))
  return b
def sheet(items,out,s=6,cols=5):
  ims=[(lab,render(ts,pid)) for lab,ts,pid in items]
  cw=max(i.width for _,i in ims)*s+ max(i.width for _,i in ims)+30; cw=max(cw,200)
  rows=[ims[i:i+cols] for i in range(0,len(ims),cols)]
  rh=[max(i.height for _,i in r)*s+30 for r in rows]
  C=Image.new('RGBA',(cw*cols,sum(rh)),(30,32,38,255)); d=ImageDraw.Draw(C); y=0
  for r,h in zip(rows,rh):
    for j,(lab,i) in enumerate(r):
      x=j*cw; b=bg(i.width,i.height,s); b.alpha_composite(i.resize((i.width*s,i.height*s),Image.NEAREST)); C.alpha_composite(b,(x+4,y+16))
      b1=bg(i.width,i.height,1); b1.alpha_composite(i); C.alpha_composite(b1,(x+8+i.width*s,y+16))
      d.text((x+4,y+2),lab[:30],fill=(240,240,240),font=font)
    y+=h
  C.save(out)
if __name__=='__main__':
  items=json.load(open(sys.argv[1])); sheet([tuple(x) for x in items],sys.argv[2])
