import sys, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
TAG=sys.argv[1] if len(sys.argv)>1 else 'base'; ONLY=sys.argv[2:]
sys.argv=['x','--out3']; P2=str(Path(__file__).with_name('portraits2.py')); src=open(P2).read().split('def main')[0]; ns={'__file__':P2}; exec(src,ns)
O=Path(__file__).resolve().parents[3]/'.omo/asset-gen-tmp/portraits/out3'; CH=ns['CHIPS']
def trim(im):
  a=np.array(im.convert('RGBA')); m=a[...,3]>20; ys,xs=np.where(m)
  return im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)) if len(xs) else im
def fit(im,h,w=None):
  im=trim(im); s=h/im.height
  if w and im.width*s>w: s=w/im.width
  return im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))))
slugs=ONLY or sorted(p.name for p in O.iterdir() if p.is_dir())
tiles=[]
for s in slugs:
  t=Image.new('RGB',(560,300),(44,44,52)); d=ImageDraw.Draw(t)
  f=ns['face_panel'](s,0).convert('RGB').resize((100,100)); t.paste(f,(4,4))
  if s in CH: c=ns['chip_panel'](s,h=120,scale=4).convert('RGB'); t.paste(c.crop((0,0,min(c.width,100),120)),(4,110))
  fp=O/s/f'full-{TAG}.png'; bp=O/s/f'bust-{TAG}.png'
  if fp.exists():
    fu=fit(Image.open(fp),270,220); t.paste(fu,(110,6),fu)
    n=ns['heads'](s)
    if n:
      for i in range(1,int(n)+1): y=6+270*i/n; d.line((110,y,110+fu.width,y),fill=(255,220,0))
    bu=fit(Image.open(bp),200,220); t.paste(bu,(335,6),bu)
  d.text((4,285),f"{s[:-12]} N={ns['heads'](s)}",fill=(255,255,255)); tiles.append(t)
per=12
for k in range(0,len(tiles),per):
  g=Image.new('RGB',(560*3,300*4))
  for i,t in enumerate(tiles[k:k+per]): g.paste(t,((i%3)*560,(i//3)*300))
  g.save(f'rev-{TAG}-{k//per}.png')
print(len(tiles))
