"""Measure existing bundled PNGs. Metadata only: never changes sprite artwork."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[2]
rows={}
for family in ['charset-battlers','party-pixel','pixel-enemies']:
 for p in sorted((root/'public/assets/generated'/family).glob('*.png')):
  im=Image.open(p).convert('RGBA');cell=im.width//3
  if cell*3!=im.width or im.height<cell*3:continue
  coords={'idle':(0,0),'strike':(1,3) if family=='charset-battlers' else (2,1),'attack':(1,0) if family=='charset-battlers' else (2,1)}
  bounds={}
  for key,(col,row) in coords.items():
   box=im.crop((col*cell,row*cell,(col+1)*cell,(row+1)*cell)).getchannel('A').point(lambda a:255 if a>127 else 0).getbbox()
   if box:bounds[key]=[round(x/cell,6) for x in box]
  if len(bounds)!=3:raise ValueError(str(p)+' missing contact pose')
  rows['assets/generated/'+family+'/'+p.name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cell':cell,**bounds}
(root/'src/assets/battleContactBounds.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
print('Measured',len(rows),'existing sprite sheets')
