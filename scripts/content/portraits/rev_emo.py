import sys, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
O=Path(__file__).resolve().parents[3]/'.omo/asset-gen-tmp/portraits/out3'; EM=['base','happy','sad','angry','surprised']
def trim(im):
  a=np.array(im.convert('RGBA')); ys,xs=np.where(a[...,3]>20); return im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
def fit(im,h,w):
  im=trim(im); s=min(h/im.height,w/im.width); return im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))))
slugs=sys.argv[1:] or sorted(p.name for p in O.iterdir() if p.is_dir())
rows=[]
for s in slugs:
  r=Image.new('RGB',(5*230,190),(44,44,52)); d=ImageDraw.Draw(r)
  for i,e in enumerate(EM):
    fp=O/s/f'full-{e}.png'; bp=O/s/f'bust-{e}.png'
    if fp.exists():
      f=fit(Image.open(fp),175,100); r.paste(f,(i*230+2,2),f); b=fit(Image.open(bp),120,120); r.paste(b,(i*230+105,2),b)
  d.text((2,178),s[:-12],fill=(255,255,0)); rows.append(r)
for k in range(0,len(rows),13):
  g=Image.new('RGB',(5*230,190*13))
  for i,r in enumerate(rows[k:k+13]): g.paste(r,(0,i*190))
  g.save(f'rev-emo-{k//13}.png')
print(len(rows))
