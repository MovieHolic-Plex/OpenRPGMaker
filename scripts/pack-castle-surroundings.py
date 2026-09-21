#!/usr/bin/env python3
"""Pack measured source-art rectangles, retaining every original Castle2 cell.
No screenshot pixels, scaling, recolouring, or generated art is used.
"""
from pathlib import Path
from PIL import Image
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/castle-surroundings'
SRC = OUT / 'sources'
# All rectangles are source pixels. irregular masks separate neighbouring objects.
SPECS = {
 'boatLeft': ('farming_fishing.png', (224,448,128,64), '나룻배 · 왼쪽', None),
 'boatRight': ('farming_fishing.png', (352,448,128,64), '나룻배 · 오른쪽', None),
 'dock': ('farming_fishing.png', (448,0,96,96), '목조 부두', None),
 'sacks': ('farming_fishing.png', (96,64,64,64), '곡물 포대', None),
 'firewood': ('farming_fishing.png', (96,0,64,64), '장작 더미', None),
 'produce': ('farming_fishing.png', (256,320,224,48), '채소 진열 상자', None),
 'reeds': ('hyptosis-batch3.png', (832,288,32,64), '물가 갈대', None),
 'corn': ('plants.png', (192,192,32,64), '옥수수', None),
 'tomato': ('plants.png', (128,192,32,64), '토마토', None),
 'tree': ('hyptosis-batch1.png', (384,512,128,288), '큰 활엽수', [(0,0,128,144),(32,144,32,112),(0,256,96,32)]),
 'soil': ('hyptosis-batch1.png', (224,96,32,32), '텃밭 흙', None),
 'bush': ('hyptosis-batch1.png', (384,256,64,64), '짙은 덤불', None),
 'boulders': ('hyptosis-batch3.png', (512,64,128,96), '큰 바위', None),
 'cairn': ('hyptosis-batch3.png', (448,0,32,64), '돌무더기', None),
 'stela': ('hyptosis-batch3.png', (352,288,32,64), '회색 석상', None),
 'grass': ('hyptosis-batch3.png', (800,288,64,64), '수변 풀', None),
 'vine': ('hyptosis-batch3.png', (384,192,96,96), '성벽 덩굴', None),
}
atlas = Image.new('RGBA',(512,1536))
original = Image.open(ROOT/'public/assets/opengameart-castle-tiles.png').convert('RGBA')
atlas.paste(original,(0,0))
x,y,row_h=0,512,0
parts={}
for key,(file,box,label,masks) in SPECS.items():
 sx,sy,w,h=box
 source=Image.open(SRC/file).convert('RGBA')
 piece=source.crop((sx,sy,sx+w,sy+h))
 if masks:
  masked=Image.new('RGBA',piece.size)
  for mx,my,mw,mh in masks: masked.paste(piece.crop((mx,my,mx+mw,my+mh)),(mx,my))
  piece=masked
 if key=='tree':
  # Canopy and trunk are separate source modules. Join with canopy in front,
  # omitting the atlas's neighbouring wall/path and its 16px separator row.
  tree=Image.new('RGBA',(128,240))
  tree.paste(source.crop((416,672,448,768)),(32,112))
  tree.paste(source.crop((384,768,480,800)),(0,208))
  tree.alpha_composite(source.crop((384,512,512,656)),(0,0))
  piece=tree;w,h=piece.size
 if x+w>512:x,y,row_h=0,y+row_h,0
 atlas.paste(piece,(x,y))
 parts[key]={'rect':[x//16,y//16,w//16,h//16], 'label':label,
   'source':file,'sourceRect':box,'sourceSha256':hashlib.sha256((SRC/file).read_bytes()).hexdigest()}
 if key=='tree':parts[key]['assembly']='canopy (384,512,128,144) over trunk (416,672,32,96) at (32,112), roots (384,768,96,32) at (0,208)'
 x+=w;row_h=max(row_h,h)
atlas=atlas.crop((0,0,512,y+row_h))
assert atlas.crop((0,0,512,512)).tobytes()==original.tobytes()
atlas.save(OUT/'atlas.png')
alpha=[]
for ty in range(atlas.height//16):
 for tx in range(32):
  lo,hi=atlas.crop((tx*16,ty*16,tx*16+16,ty*16+16)).getchannel('A').getextrema()
  alpha.append('E' if hi==0 else 'O' if lo==255 else 'T')
manifest={'width':512,'height':atlas.height,'count':len(alpha),'alpha':''.join(alpha),'parts':parts,
 'sha256':hashlib.sha256((OUT/'atlas.png').read_bytes()).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'size':atlas.size,'parts':len(parts),'sha256':manifest['sha256']}))
