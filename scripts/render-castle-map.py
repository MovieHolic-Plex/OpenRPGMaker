#!/usr/bin/env python3
"""Render authored map cells for visual inspection. Never substitutes the reference screenshot."""
import argparse,json,base64,io
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('project');p.add_argument('--map',default='map_castle_keep_3');p.add_argument('--out',required=True);args=p.parse_args()
raw=json.loads(Path(args.project).read_text());raw=raw[0] if isinstance(raw,list) else raw
project=raw.get('current_json',raw);m=project['maps'][args.map]
assert m['tilesetId'] in ['opengameart_castle','castle_courtyard_harbor'],'Screenshot tilesets are not accepted'
root=Path(__file__).resolve().parents[1]
original=Image.open(root/'public/assets/opengameart-castle-tiles.png').convert('RGBA')
atlas=original
if m['tilesetId']=='castle_courtyard_harbor':
 asset=project['assets']['uploaded'][project['tilesets'][m['tilesetId']]['image']['id']]
 atlas=Image.open(io.BytesIO(base64.b64decode(asset['dataUrl'].split(',')[1]))).convert('RGBA')
 assert atlas.crop((0,0,512,512)).tobytes()==original.tobytes(),'Original castle pixels changed'
out=Image.new('RGBA',(m['width']*16,m['height']*16))
for name in ['lower','upper']:
 for i,t in enumerate(m[name+'Tiles']):
  for tile in [t]+m.get(name+'TileStacks',{}).get(str(i),[]):
   if tile<0:continue
   if tile>=atlas.width*atlas.height//256:raise ValueError(f'Invalid source tile {tile}')
   x=tile%32*16;y=tile//32*16
   out.alpha_composite(atlas.crop((x,y,x+16,y+16)),(i%m['width']*16,i//m['width']*16))
assert out.getchannel('A').getextrema()==(255,255), 'Unbacked transparent cell'
out.convert('RGB').save(args.out)
print(args.out)
