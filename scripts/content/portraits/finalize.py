"""out3 의 전신·흉상 → 저장소용: 분홍 테두리 제거, 여백 잘라내기, 128색 PNG."""
import sys, numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'.omo/asset-gen-tmp/portraits/out3'; DST=ROOT/'public/assets/shared/portraits'; EM=['base','happy','sad','angry','surprised']
def clean(im):
  a=np.array(im.convert('RGBA')).astype(int); r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
  mag=(np.minimum(r,b)-g)  # 분홍(#FF00FF) 성분
  al=np.where(al<128,0,255)
  for _ in range(3):  # 가장자리 띠에서 분홍기 도는 칸만 벗긴다
    solid=al>0; edge=solid & ~ndimage.binary_erosion(solid)
    kill=edge & (mag>40) & (r>120) & (b>120)
    if not kill.any(): break
    al[kill]=0
  # 고립된 점(4칸 이하 덩이) 제거
  lab,n=ndimage.label(al>0); sizes=ndimage.sum(np.ones_like(lab),lab,range(1,n+1))
  for i,s in enumerate(sizes,1):
    if s<=40: al[lab==i]=0
  a[...,3]=al
  out=Image.fromarray(a.astype(np.uint8),'RGBA')
  bb=out.getbbox(); return out.crop(bb)
def quant(im):
  q=im.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
  return q
tot=0; n=0
slugs=sys.argv[1:] or sorted(p.name for p in SRC.iterdir() if p.is_dir())
for s in slugs:
  stem=s.removesuffix('-expressions'); d=DST/stem; d.mkdir(parents=True,exist_ok=True)
  for e in EM:
    for k in ('full','bust'):
      im=clean(Image.open(SRC/s/f'{k}-{e}.png')); q=quant(im); p=d/f'{k}-{e}.png'; q.save(p,optimize=True); tot+=p.stat().st_size; n+=1
print(n,'files',round(tot/1e6,1),'MB')
